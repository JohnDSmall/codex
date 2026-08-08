/*
 * Import income from Bank of America checking / savings statement CSVs into
 * eph_income, assigning Type (income_type) and Company (company_id).
 *
 *   node import_bofa_income.js <csv> [<csv> ...]            # dry run, writes nothing
 *   node import_bofa_income.js <csv> [<csv> ...] --apply    # insert
 *
 * Income is credits only. Internal CHK<->SAV transfers are excluded: they are
 * the same money moving, and counting them would roughly double 2026 income.
 * Debits are ignored entirely -- this importer is income-only.
 *
 * Re-running is safe: a row is skipped if eph_income already holds one with the
 * same date, amount and source_account.
 */
const fs = require("fs");
const path = require("path");

const APPLY = process.argv.includes("--apply");
const FILES = process.argv.slice(2).filter((a) => !a.startsWith("--"));
if (!FILES.length) {
  console.error("usage: node import_bofa_income.js <csv> [<csv> ...] [--apply]");
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

/** BofA files carry a summary preamble; the real table starts at this header. */
function rowsOf(file) {
  const rows = parseCsv(fs.readFileSync(file, "utf8"));
  const h = rows.findIndex((r) => r[0] === "Date" && r[1] === "Description");
  if (h === -1) throw new Error(`${path.basename(file)}: no "Date,Description" header`);
  const account = /savings/i.test(path.basename(file)) ? "BofA Savings" : "BofA Checking";
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

// Money moving between the user's own two accounts is not income.
const isInternalTransfer = (d) => /Online Banking transfer (from|to) (SAV|CHK)/i.test(d);

/**
 * Rules agreed 2026-08-08. Each returns { type, company, description }.
 * `company` is a companies.company_id, or null where no company applies.
 */
function classify(row) {
  const d = row.desc;

  // Semi-monthly payroll: "Handshake-OSV DES:PAYROLL### ..." on the 15th and
  // the last day of the month.
  if (/^Handshake-OSV\b/i.test(d)) {
    const day = Number(row.date.slice(8, 10));
    const month = MONTHS[Number(row.date.slice(5, 7)) - 1];
    const year = row.date.slice(0, 4);
    const half = day <= 20 ? "first half" : "second half";
    return {
      type: "Salary",
      company: "Handshake AI",
      description: `Salary payment from Handshake AI for the ${half} of ${month} ${year}`,
    };
  }

  // Everything else from Handshake: irregular dates and amounts ($10.22 to
  // $3,394.21) -- expense reimbursements.
  if (/^Handshake\b/i.test(d)) {
    return {
      type: "Expense Reimbursement",
      company: "Handshake AI",
      description: `Expense reimbursement from Handshake AI (${longDate(row.date)})`,
    };
  }

  // One-time government payments. Both are tax reimbursements; the mobile
  // deposit carries no counterparty in the memo, so it is matched explicitly.
  if (/APA TREAS 310/i.test(d)) {
    return {
      type: "Misc",
      company: null,
      description: `Tax reimbursement from the US Treasury (${longDate(row.date)})`,
    };
  }
  if (/BKOFAMERICA MOBILE.*DEPOSIT/i.test(d)) {
    return {
      type: "Misc",
      company: null,
      description: `Tax reimbursement from the government, deposited by mobile check (${longDate(row.date)})`,
    };
  }

  if (/^Interest Earned/i.test(d)) {
    return {
      type: "Misc",
      company: null,
      description: `Interest earned on ${row.account} (${longDate(row.date)})`,
    };
  }
  if (/Rebate|Rewards/i.test(d)) {
    return {
      type: "Misc",
      company: null,
      description: `Preferred Rewards ATM fee rebate (${longDate(row.date)})`,
    };
  }

  return null; // unrecognised -> reported, never guessed
}

/* ------------------------------------------------------------------ run */

(async () => {
  const all = FILES.flatMap(rowsOf);
  const credits = all.filter((r) => r.amount > 0);
  const transfers = credits.filter((r) => isInternalTransfer(r.desc));
  const candidates = credits.filter((r) => !isInternalTransfer(r.desc));

  const classified = [], unknown = [];
  for (const r of candidates) {
    const c = classify(r);
    if (c) classified.push({ ...r, ...c });
    else unknown.push(r);
  }

  // Existing rows, for idempotency.
  const res = await fetch(
    `${env.SUPABASE_URL}/rest/v1/eph_income?select=date,amount,source_account`,
    { headers: H },
  );
  if (!res.ok) throw new Error(`load existing -> ${res.status}`);
  const existing = new Set(
    (await res.json()).map((r) => `${r.date}|${Number(r.amount).toFixed(2)}|${r.source_account ?? ""}`),
  );
  const fresh = classified.filter(
    (r) => !existing.has(`${r.date}|${r.amount.toFixed(2)}|${r.account}`),
  );
  const dupes = classified.length - fresh.length;

  console.log(`===== ${APPLY ? "APPLY" : "DRY RUN"} =====`);
  console.log(`files            : ${FILES.map((f) => path.basename(f)).join(", ")}`);
  console.log(`credit rows      : ${credits.length}`);
  console.log(`internal transfer: ${transfers.length} excluded ($${transfers.reduce((s, r) => s + r.amount, 0).toFixed(2)})`);
  console.log(`to import        : ${fresh.length}${dupes ? `  (${dupes} already present, skipped)` : ""}`);
  console.log(`unrecognised     : ${unknown.length}\n`);

  const by = new Map();
  for (const r of fresh) {
    const k = `${r.type} / ${r.company ?? "(no company)"}`;
    if (!by.has(k)) by.set(k, []);
    by.get(k).push(r);
  }
  for (const [k, v] of [...by.entries()].sort((a, b) =>
    b[1].reduce((s, r) => s + r.amount, 0) - a[1].reduce((s, r) => s + r.amount, 0))) {
    console.log(`--- ${k}  |  ${v.length} rows, $${v.reduce((s, r) => s + r.amount, 0).toFixed(2)}`);
    for (const r of v) {
      console.log(`    ${r.date}  ${("$" + r.amount.toFixed(2)).padStart(11)}  ${r.account.padEnd(14)} ${r.description}`);
    }
  }
  if (unknown.length) {
    console.log(`\n--- UNRECOGNISED (not imported) ---`);
    for (const r of unknown) console.log(`    ${r.date}  $${r.amount.toFixed(2)}  ${r.desc.slice(0, 80)}`);
  }
  console.log(`\ntotal to import: $${fresh.reduce((s, r) => s + r.amount, 0).toFixed(2)}`);

  if (!APPLY) { console.log("\ndry run - nothing written. re-run with --apply"); return; }
  if (!fresh.length) { console.log("\nnothing to insert."); return; }

  const payload = fresh.map((r) => ({
    date: r.date,
    description: r.description,
    amount: r.amount,
    income_type: r.type,
    company_id: r.company,
    client: r.company,
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
