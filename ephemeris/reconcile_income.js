/*
 * Reconcile BofA statement credits against eph_income, and import the gaps.
 *
 *   node reconcile_income.js <csv> [<csv> ...]           # report only
 *   node reconcile_income.js <csv> [<csv> ...] --apply   # insert the gaps
 *
 * Unlike import_bofa_income.js (which assumed a clean, non-overlapping window),
 * this matches each statement credit against rows already in eph_income by
 * date + amount. Legacy rows carry no source_account, so that field cannot be
 * part of the key or every historical row would look like a gap and be
 * duplicated.
 *
 * Three buckets are reported:
 *   MATCHED    -- already recorded; skipped
 *   GAP        -- in the bank, missing from eph_income; inserted with --apply
 *   DB-ONLY    -- recorded but absent from the statements in that window;
 *                 never touched, only reported for you to look at
 */
const fs = require("fs");
const path = require("path");

const APPLY = process.argv.includes("--apply");
const FILES = process.argv.slice(2).filter((a) => !a.startsWith("--"));
if (!FILES.length) {
  console.error("usage: node reconcile_income.js <csv> [<csv> ...] [--apply]");
  process.exit(1);
}

const WEB = path.resolve(__dirname, "..", "web");
const env = {};
for (const line of fs.readFileSync(path.join(WEB, ".env.local"), "utf8").split(/\r?\n/)) {
  const m = line.match(/^\s*([A-Z_]+)\s*=\s*(.*)\s*$/);
  if (m) env[m[1]] = m[2].replace(/^["']|["']$/g, "");
}
const H = {
  apikey: env.SUPABASE_SERVICE_KEY,
  Authorization: `Bearer ${env.SUPABASE_SERVICE_KEY}`,
  "Content-Type": "application/json",
  Prefer: "return=representation",
};

/* ------------------------------------------------------------------ csv */

function parseCsv(text) {
  const rows = [];
  let row = [], cur = "", q = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (q) {
      if (c === '"') { if (text[i + 1] === '"') { cur += '"'; i++; } else q = false; }
      else cur += c;
    } else if (c === '"') q = true;
    else if (c === ",") { row.push(cur); cur = ""; }
    else if (c === "\n") { row.push(cur); rows.push(row); row = []; cur = ""; }
    else if (c !== "\r") cur += c;
  }
  if (cur || row.length) { row.push(cur); rows.push(row); }
  return rows;
}
const money = (s) => {
  const n = Number(String(s || "").replace(/[",$\s]/g, ""));
  return Number.isFinite(n) ? n : null;
};
const isoDate = (mdy) => {
  const m = mdy.match(/^(\d{2})\/(\d{2})\/(\d{4})$/);
  return m ? `${m[3]}-${m[1]}-${m[2]}` : null;
};
const MONTHS = ["January", "February", "March", "April", "May", "June", "July",
  "August", "September", "October", "November", "December"];
const longDate = (iso) => {
  const [y, m, d] = iso.split("-").map(Number);
  return `${d} ${MONTHS[m - 1].slice(0, 3)} ${y}`;
};

function rowsOf(file) {
  const rows = parseCsv(fs.readFileSync(file, "utf8"));
  const h = rows.findIndex((r) => r[0] === "Date" && r[1] === "Description");
  if (h === -1) throw new Error(`${path.basename(file)}: no "Date,Description" header`);
  const account = /saving/i.test(path.basename(file)) ? "BofA Savings" : "BofA Checking";
  return rows.slice(h + 1)
    .filter((r) => r.length >= 3 && isoDate(r[0]) && money(r[2]) !== null)
    .map((r) => ({
      date: isoDate(r[0]),
      desc: String(r[1]).replace(/\s+/g, " ").trim(),
      amount: money(r[2]),
      account,
      source_file: path.basename(file),
    }));
}

/* ------------------------------------------------------- categorization */

const isInternalTransfer = (d) => /Online Banking transfer (from|to) (SAV|CHK)/i.test(d);

/** Micro-deposits banks and payroll systems send to verify an account. */
const isVerification = (d) =>
  /Yardi Penny Test|ACCTVERIFY|Transfer PEOPLE CENTER|DES:BVC\b/i.test(d);

const halfOf = (iso) => {
  const day = Number(iso.slice(8, 10));
  const month = MONTHS[Number(iso.slice(5, 7)) - 1];
  return `${day <= 20 ? "first half" : "second half"} of ${month} ${iso.slice(0, 4)}`;
};

function classify(row) {
  const d = row.desc;

  if (/^Handshake-OSV\b/i.test(d)) {
    return { type: "Salary", company: "Handshake AI",
      description: `Salary payment from Handshake AI for the ${halfOf(row.date)}` };
  }
  if (/^Handshake\b/i.test(d)) {
    return { type: "Expense Reimbursement", company: "Handshake AI",
      description: `Expense reimbursement from Handshake AI (${longDate(row.date)})` };
  }

  // "SNORKEL AI DES:PAYROLL" is the semi-monthly run; "Snorkel AI Inc" with a
  // random DES code is the reimbursement rail (same as Handshake's two rails).
  if (/^SNORKEL AI\b.*PAYROLL/i.test(d)) {
    return { type: "Salary", company: "Snorkel",
      description: `Salary payment from Snorkel AI for the ${halfOf(row.date)}` };
  }
  if (/^Snorkel AI Inc\b/i.test(d)) {
    return { type: "Expense Reimbursement", company: "Snorkel",
      description: `Expense reimbursement from Snorkel AI (${longDate(row.date)})` };
  }

  // Halo paid by Zelle; the memo states which it is.
  if (/^Zelle payment from/i.test(d)) {
    const reimb = /expense reimbursement/i.test(d);
    // "for <memo>; Conf# ..." -- keep the memo, drop the confirmation number.
    const memo = (d.match(/\bfor (.+?)(?:;\s*Conf#.*)?$/i) || [, ""])[1].trim();
    return {
      type: reimb ? "Expense Reimbursement" : "Contract",
      company: "Halo",
      description: `${reimb ? "Expense reimbursement" : "Contract payment"} from Powered by Halo${memo ? ` — ${memo}` : ""} (${longDate(row.date)})`,
    };
  }

  if (/APA TREAS 310/i.test(d)) {
    return { type: "Misc", company: null,
      description: `Tax reimbursement from the US Treasury (${longDate(row.date)})` };
  }
  if (/DES:CASHREWARD/i.test(d)) {
    return { type: "Misc", company: null,
      description: `Bank of America cash rewards (${longDate(row.date)})` };
  }
  if (/^Interest Earned/i.test(d)) {
    return { type: "Misc", company: null,
      description: `Interest earned on ${row.account} (${longDate(row.date)})` };
  }
  if (/Rebate|Preferred Rewards/i.test(d)) {
    return { type: "Misc", company: null,
      description: `Preferred Rewards ATM fee rebate (${longDate(row.date)})` };
  }

  // Cheque and branch deposits carry no counterparty -- never guessed.
  return null;
}

/**
 * company_id -> eph_tags name. An imported row with a null tag_id vanishes into
 * the dashboard's "Untagged" bucket, which is how $129k went missing once
 * already -- so every inserted row gets a tag.
 */
const TAG_FOR_COMPANY = {
  "Handshake AI": "Handshake AI",
  Snorkel: "Snorkel",
  Halo: "Halo",
  "7 Shot Tennis": "7 Shot Tennis",
  "Backcountry Academics": "Freelance Consulting",
  "Four One One": "Freelance Consulting",
};
const TAG_NO_COMPANY = "Personal"; // interest, tax refunds, cash rewards

/* ------------------------------------------------------------------ run */

(async () => {
  const all = FILES.flatMap(rowsOf);
  const credits = all.filter((r) => r.amount > 0);
  const transfers = credits.filter((r) => isInternalTransfer(r.desc));
  const verifications = credits.filter((r) => !isInternalTransfer(r.desc) && isVerification(r.desc));
  const candidates = credits.filter((r) => !isInternalTransfer(r.desc) && !isVerification(r.desc));

  const dates = all.map((r) => r.date).sort();
  const from = dates[0], to = dates[dates.length - 1];

  const res = await fetch(
    `${env.SUPABASE_URL}/rest/v1/eph_income?select=id,date,amount,description,company_id,income_type,source_account&order=date`,
    { headers: H },
  );
  if (!res.ok) throw new Error(`load eph_income -> ${res.status}`);
  const db = await res.json();

  // date+amount is the only key legacy rows can be matched on.
  const dbIndex = new Map();
  for (const r of db) {
    const k = `${r.date}|${Number(r.amount).toFixed(2)}`;
    if (!dbIndex.has(k)) dbIndex.set(k, []);
    dbIndex.get(k).push(r);
  }

  const matched = [], gaps = [], unknown = [];
  const consumed = new Set();
  for (const r of candidates) {
    const k = `${r.date}|${r.amount.toFixed(2)}`;
    const pool = (dbIndex.get(k) || []).filter((x) => !consumed.has(x.id));
    if (pool.length) { consumed.add(pool[0].id); matched.push({ ...r, db: pool[0] }); continue; }
    const c = classify(r);
    if (c) gaps.push({ ...r, ...c });
    else unknown.push(r);
  }

  const inWindow = db.filter((r) => r.date >= from && r.date <= to);
  const dbOnly = inWindow.filter((r) => !consumed.has(r.id));

  const sum = (a) => a.reduce((s, r) => s + (r.amount ?? Number(r.amount) ?? 0), 0);
  console.log(`===== ${APPLY ? "APPLY" : "REPORT"} =====`);
  console.log(`files          : ${FILES.map((f) => path.basename(f)).join(", ")}`);
  console.log(`window         : ${from} .. ${to}`);
  console.log(`credits        : ${credits.length}`);
  console.log(`  transfers    : ${transfers.length} excluded ($${sum(transfers).toFixed(2)})`);
  console.log(`  verification : ${verifications.length} excluded ($${sum(verifications).toFixed(2)})`);
  console.log(`  MATCHED      : ${matched.length} already in eph_income ($${sum(matched).toFixed(2)})`);
  console.log(`  GAP          : ${gaps.length} to import ($${sum(gaps).toFixed(2)})`);
  console.log(`  UNRECOGNISED : ${unknown.length} ($${sum(unknown).toFixed(2)})`);
  console.log(`  DB-ONLY      : ${dbOnly.length} recorded but not in these statements ($${dbOnly.reduce((s, r) => s + Number(r.amount), 0).toFixed(2)})\n`);

  const by = new Map();
  for (const r of gaps) {
    const k = `${r.type} / ${r.company ?? "(no company)"}`;
    if (!by.has(k)) by.set(k, []);
    by.get(k).push(r);
  }
  for (const [k, v] of [...by.entries()].sort((a, b) => sum(b[1]) - sum(a[1]))) {
    console.log(`--- GAP: ${k}  |  ${v.length} rows, $${sum(v).toFixed(2)}`);
    for (const r of v) console.log(`    ${r.date}  ${("$" + r.amount.toFixed(2)).padStart(11)}  ${r.description.slice(0, 78)}`);
  }
  if (unknown.length) {
    console.log(`\n--- UNRECOGNISED (never guessed, not imported) ---`);
    for (const r of unknown) console.log(`    ${r.date}  ${("$" + r.amount.toFixed(2)).padStart(11)}  ${r.account}  ${r.desc.slice(0, 66)}`);
  }
  if (dbOnly.length) {
    console.log(`\n--- DB-ONLY: recorded, but no matching credit in these statements ---`);
    for (const r of dbOnly) console.log(`    ${r.date}  ${("$" + Number(r.amount).toFixed(2)).padStart(11)}  ${String(r.description).slice(0, 56)}  [${r.company_id ?? "-"}]`);
  }

  if (!APPLY) { console.log("\nreport only - nothing written. re-run with --apply"); return; }
  if (!gaps.length) { console.log("\nno gaps to insert."); return; }

  const tagRes = await fetch(`${env.SUPABASE_URL}/rest/v1/eph_tags?select=id,name`, { headers: H });
  const tagId = new Map((await tagRes.json()).map((t) => [t.name, t.id]));
  const missingTags = [...new Set(gaps.map((r) =>
    r.company ? TAG_FOR_COMPANY[r.company] : TAG_NO_COMPANY))].filter((n) => n && !tagId.has(n));
  if (missingTags.length) {
    console.error(`ABORT: no eph_tags row named ${missingTags.map((t) => `"${t}"`).join(", ")}.`);
    console.error("Create the tag first — an untagged row disappears into the dashboard's Untagged bucket.");
    process.exit(1);
  }

  const payload = gaps.map((r) => ({
    date: r.date,
    description: r.description,
    amount: r.amount,
    income_type: r.type,
    company_id: r.company,
    client: r.company,
    tag_id: tagId.get(r.company ? TAG_FOR_COMPANY[r.company] : TAG_NO_COMPANY) ?? null,
    source_account: r.account,
    source_file: r.source_file,
    notes: `Imported from ${r.source_file}: ${r.desc.slice(0, 180)}`,
  }));
  const ins = await fetch(`${env.SUPABASE_URL}/rest/v1/eph_income`, {
    method: "POST", headers: H, body: JSON.stringify(payload),
  });
  const body = await ins.json();
  if (!ins.ok) { console.error(`INSERT FAILED ${ins.status}: ${JSON.stringify(body)}`); process.exit(1); }
  console.log(`\ninserted ${body.length} rows.`);
})().catch((e) => { console.error("FAILED:", e.message); process.exit(1); });
