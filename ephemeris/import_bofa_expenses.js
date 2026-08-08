/*
 * Import expenses from the BofA checking/savings statements into eph_expenses.
 *
 *   node import_bofa_expenses.js --bank <chk.csv> <sav.csv> \
 *        [--amex <dir>] [--card <dir>] [--apply]
 *
 * MODEL (agreed 2026-08-08): an expense is money that actually left the bank.
 * Card *payments* are therefore the expense, at the date they were paid, and
 * card line items are NOT imported as rows -- the Amex is shared with a partner,
 * so its line items overstate what was personally spent.
 *
 * Card statements are still read, but only to derive CATEGORY PROPORTIONS: a
 * payment is split across categories in the same ratio as that card's charges
 * in the preceding calendar month. Where no statement covers that month, the
 * payment stays uncategorized rather than being guessed.
 *
 * Excluded entirely:
 *   - internal CHK<->SAV transfers  (same money moving)
 *   - transfers to brokerages       (net worth moving, tracked in /wealth)
 *
 * Categorization rules are read from CATEGORY_RULES in import_csv.py so there
 * is one source of truth rather than two drifting copies.
 */
const fs = require("fs");
const path = require("path");

const argv = process.argv.slice(2);
const APPLY = argv.includes("--apply");
function argList(flag) {
  const i = argv.indexOf(flag);
  if (i === -1) return [];
  const out = [];
  for (let j = i + 1; j < argv.length && !argv[j].startsWith("--"); j++) out.push(argv[j]);
  return out;
}
const BANK = argList("--bank");
const AMEX_DIR = argList("--amex")[0] ?? null;
const CARD_DIR = argList("--card")[0] ?? null;
if (!BANK.length) {
  console.error("usage: node import_bofa_expenses.js --bank <chk.csv> <sav.csv> [--amex <dir>] [--card <dir>] [--apply]");
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
const num = (s) => {
  const n = Number(String(s || "").replace(/[",$\s]/g, ""));
  return Number.isFinite(n) ? n : null;
};
const iso = (mdy) => {
  const m = String(mdy).match(/^(\d{2})\/(\d{2})\/(\d{4})$/);
  return m ? `${m[3]}-${m[1]}-${m[2]}` : null;
};
const prevMonth = (ym) => {
  const [y, m] = ym.split("-").map(Number);
  const d = new Date(Date.UTC(y, m - 2, 1));
  return d.toISOString().slice(0, 7);
};

/* -------------------------------------------- rules shared with import_csv */

/** Parse CATEGORY_RULES out of import_csv.py so both importers agree. */
function loadCategoryRules() {
  const src = fs.readFileSync(path.join(__dirname, "import_csv.py"), "utf8");
  const block = src.slice(src.indexOf("CATEGORY_RULES = ["), src.indexOf("]", src.indexOf("CATEGORY_RULES = [")));
  const rules = [];
  for (const m of block.matchAll(/\(\s*"([^"]+)"\s*,\s*"([^"]+)"\s*\)/g)) {
    rules.push([m[1].toUpperCase(), m[2]]);
  }
  if (!rules.length) throw new Error("could not parse CATEGORY_RULES from import_csv.py");
  return rules;
}
const CATEGORY_RULES = loadCategoryRules();
const categorize = (desc) => {
  const up = String(desc).toUpperCase();
  for (const [pat, cat] of CATEGORY_RULES) if (up.includes(pat)) return cat;
  return null;
};

/* ------------------------------------------------------------ bank debits */

const isInternalTransfer = (d) => /Online Banking transfer (from|to) (SAV|CHK)/i.test(d);

/**
 * Money moved to investments is net worth changing shape, not spend — it is
 * tracked in /wealth. Note `BRK`: BofA labels a brokerage transfer with that
 * account code and no broker name, so matching only on broker names missed
 * $90,000 across two rows and inflated Apr/May 2025 spend accordingly.
 */
const isInvestmentTransfer = (d) =>
  /SCHWAB|FIDELITY|VANGUARD|BETTERMENT|ROBINHOOD|COINBASE|WEALTHFRONT/i.test(d) ||
  /Online Banking transfer (from|to) BRK\b/i.test(d);
const cardOf = (d) => {
  if (/AMERICAN EXPRESS|AMEX/i.test(d)) return "Amex";
  if (/CRD 7061|ACCT# 7061|Credit Card Bill Payment|payment to CRD/i.test(d)) return "BofA";
  if (/CHASE CREDIT/i.test(d)) return "Chase";
  return null;
};

/** Direct (non-card) spend rules, applied before CATEGORY_RULES. */
const DIRECT_RULES = [
  [/TWO LINCOLN SQUA|YARDI/i, "Personal - Housing"],
  [/\bIRS\b|USATAXPYMT|NYS DTF|Tax Paymnt/i, "F&O - Taxes"],
  [/VENMO/i, "Personal - Misc"],
  [/PATIENTCO|PHARMACY|MEDICAL|DENTAL/i, "Personal - Health & Wellness"],
  [/CHECK ORDER|DES:FEE|SERVICE CHARGE|OVERDRAFT/i, "F&O - Bank Fees & Service Charges"],
  [/ZELLE PAYMENT TO/i, "Personal - Misc"],
  [/BKOFAMERICA (BC|ATM)|CASH WITHDRAWAL|WITHDRAWAL/i, "Personal - Misc"],
  [/WIRE TYPE|FX ORDER|BERKSHIRE BANK/i, "F&O - Uncategorized Expense"],
  [/CONDUENT/i, "F&O - Uncategorized Expense"],
];

function readBank(file) {
  const rows = parseCsv(fs.readFileSync(file, "utf8"));
  const h = rows.findIndex((r) => r[0] === "Date" && r[1] === "Description");
  if (h === -1) throw new Error(`${path.basename(file)}: no "Date,Description" header`);
  const account = /saving/i.test(path.basename(file)) ? "BofA Savings" : "BofA Checking";
  return rows.slice(h + 1)
    .filter((r) => r.length >= 3 && iso(r[0]) && num(r[2]) !== null && num(r[2]) < 0)
    .map((r) => ({
      date: iso(r[0]),
      desc: String(r[1]).replace(/\s+/g, " ").trim(),
      amount: -num(r[2]),
      account,
      source_file: path.basename(file),
    }));
}

/* ------------------------------------------------- card statements (ratios) */

/**
 * De-duplicate by the highest count seen in any ONE file, not by collapsing to
 * a single row. Statement exports overlap, but two identical $3.00 subway fares
 * on the same day are a round trip -- collapsing them loses real money.
 */
function dedupeByMaxPerFile(perFile) {
  const best = new Map();
  for (const { list } of perFile) {
    const local = new Map();
    for (const r of list) {
      const k = `${r.date}|${r.amount.toFixed(2)}|${r.desc}`;
      if (!local.has(k)) local.set(k, { n: 0, r });
      local.get(k).n++;
    }
    for (const [k, v] of local) {
      if (!best.has(k) || best.get(k).n < v.n) best.set(k, v);
    }
  }
  const out = [];
  for (const { n, r } of best.values()) for (let i = 0; i < n; i++) out.push(r);
  return out;
}

function readAmexDir(dir) {
  const perFile = [];
  for (const f of fs.readdirSync(dir)) {
    if (!f.toLowerCase().endsWith(".csv")) continue;
    const rows = parseCsv(fs.readFileSync(path.join(dir, f), "utf8"));
    const h = rows.findIndex((r) => /^date$/i.test((r[0] || "").trim()));
    const list = [];
    for (const r of rows.slice(h + 1)) {
      if (r.length < 3 || !iso(r[0]) || num(r[2]) === null) continue;
      list.push({ date: iso(r[0]), desc: String(r[1]).replace(/\s+/g, " ").trim(), amount: num(r[2]) });
    }
    perFile.push({ file: f, list });
  }
  return dedupeByMaxPerFile(perFile).filter((r) => r.amount > 0);
}

function readCardDir(dir) {
  const perFile = [];
  for (const f of fs.readdirSync(dir)) {
    if (!f.toLowerCase().endsWith(".csv")) continue;
    const rows = parseCsv(fs.readFileSync(path.join(dir, f), "utf8"));
    const h = rows.findIndex((r) => /posted date/i.test((r[0] || "").trim()));
    const list = [];
    for (const r of rows.slice(h + 1)) {
      if (r.length < 5 || !iso(r[0]) || num(r[4]) === null) continue;
      list.push({ date: iso(r[0]), desc: String(r[2]).replace(/\s+/g, " ").trim(), amount: -num(r[4]) });
    }
    perFile.push({ file: f, list });
  }
  return dedupeByMaxPerFile(perFile).filter((r) => r.amount > 0);
}

/** month -> { category -> share }, from that month's charges on one card. */
function monthlyCategoryShares(charges) {
  const byMonth = new Map();
  for (const c of charges) {
    const m = c.date.slice(0, 7);
    const cat = categorize(c.desc) ?? "F&O - Uncategorized Expense";
    if (!byMonth.has(m)) byMonth.set(m, new Map());
    const inner = byMonth.get(m);
    inner.set(cat, (inner.get(cat) ?? 0) + c.amount);
  }
  const shares = new Map();
  for (const [m, inner] of byMonth) {
    const total = [...inner.values()].reduce((s, v) => s + v, 0);
    if (total <= 0) continue;
    shares.set(m, new Map([...inner].map(([c, v]) => [c, v / total])));
  }
  return shares;
}

/* ------------------------------------------------------------------ run */

(async () => {
  const debits = BANK.flatMap(readBank);
  const transfers = debits.filter((r) => isInternalTransfer(r.desc));
  const investments = debits.filter((r) => !isInternalTransfer(r.desc) && isInvestmentTransfer(r.desc));
  const spend = debits.filter((r) => !isInternalTransfer(r.desc) && !isInvestmentTransfer(r.desc));

  const amex = AMEX_DIR ? readAmexDir(AMEX_DIR) : [];
  const card = CARD_DIR ? readCardDir(CARD_DIR) : [];
  const shares = { Amex: monthlyCategoryShares(amex), BofA: monthlyCategoryShares(card) };

  // Build expense rows. A card payment fans out into one row per category.
  const out = [];
  let uncategorizedPayments = 0;
  for (const r of spend) {
    const cardName = cardOf(r.desc);
    if (!cardName) {
      let cat = null;
      for (const [re, c] of DIRECT_RULES) if (re.test(r.desc)) { cat = c; break; }
      cat ??= categorize(r.desc);
      out.push({
        date: r.date, amount: r.amount, category: cat,
        description: r.desc.slice(0, 120),
        merchant: null, card: null, source: r.source_file, account: r.account,
        notes: `Bank debit from ${r.account} (${r.source_file})`,
      });
      continue;
    }

    const table = shares[cardName];
    const ratio = table ? table.get(prevMonth(r.date.slice(0, 7))) ?? null : null;
    if (!ratio) {
      uncategorizedPayments++;
      out.push({
        date: r.date, amount: r.amount, category: null,
        description: `${cardName} card payment`,
        merchant: null, card: cardName, source: r.source_file, account: r.account,
        notes: `Card payment from ${r.account}; no ${cardName} statement covers ${prevMonth(r.date.slice(0, 7))}, so it is uncategorized`,
      });
      continue;
    }
    // Largest-remainder split so the parts sum exactly to the payment.
    const parts = [...ratio.entries()]
      .map(([cat, share]) => ({ cat, exact: r.amount * share }))
      .sort((a, b) => b.exact - a.exact);
    let allocated = 0;
    parts.forEach((p, i) => {
      p.amount = i === parts.length - 1
        ? Math.round((r.amount - allocated) * 100) / 100
        : Math.round(p.exact * 100) / 100;
      allocated += p.amount;
    });
    for (const p of parts) {
      if (p.amount <= 0) continue;
      out.push({
        date: r.date, amount: p.amount, category: p.cat,
        description: `${cardName} card payment — ${p.cat} share`,
        merchant: null, card: cardName, source: r.source_file, account: r.account,
        notes: `Allocated ${(100 * p.amount / r.amount).toFixed(1)}% of a $${r.amount.toFixed(2)} ${cardName} payment, by ${prevMonth(r.date.slice(0, 7))} charge mix`,
      });
    }
  }

  const sum = (a) => a.reduce((s, r) => s + r.amount, 0);
  console.log(`===== ${APPLY ? "APPLY" : "DRY RUN"} =====`);
  console.log(`bank debits          : ${debits.length} rows, $${sum(debits).toFixed(2)}`);
  console.log(`  internal transfers : ${transfers.length} excluded ($${sum(transfers).toFixed(2)})`);
  console.log(`  investment moves   : ${investments.length} excluded ($${sum(investments).toFixed(2)})`);
  console.log(`  spend              : ${spend.length} rows, $${sum(spend).toFixed(2)}`);
  console.log(`amex charges read    : ${amex.length} ($${sum(amex).toFixed(2)}) — proportions only`);
  console.log(`bofa card charges    : ${card.length} ($${sum(card).toFixed(2)}) — proportions only`);
  console.log(`expense rows to write: ${out.length} ($${sum(out).toFixed(2)})`);
  console.log(`  card payments left uncategorized: ${uncategorizedPayments}\n`);

  const byCat = new Map();
  for (const r of out) {
    const k = r.category ?? "(uncategorized)";
    if (!byCat.has(k)) byCat.set(k, { n: 0, v: 0 });
    const a = byCat.get(k); a.n++; a.v += r.amount;
  }
  console.log("--- by category ---");
  for (const [k, a] of [...byCat.entries()].sort((x, y) => y[1].v - x[1].v)) {
    console.log(`  ${k.padEnd(42)} ${String(a.n).padStart(4)} rows  $${a.v.toFixed(2).padStart(12)}`);
  }

  const byMonth = new Map();
  for (const r of out) byMonth.set(r.date.slice(0, 7), (byMonth.get(r.date.slice(0, 7)) ?? 0) + r.amount);
  console.log("\n--- monthly spend ---");
  for (const [m, v] of [...byMonth.entries()].sort()) console.log(`  ${m}  $${v.toFixed(2)}`);

  if (!APPLY) { console.log("\ndry run - nothing written. re-run with --apply"); return; }

  const [cats, tags, existing] = await Promise.all([
    fetch(`${env.SUPABASE_URL}/rest/v1/eph_categories?select=id,name`, { headers: H }).then((r) => r.json()),
    fetch(`${env.SUPABASE_URL}/rest/v1/eph_tags?select=id,name`, { headers: H }).then((r) => r.json()),
    fetch(`${env.SUPABASE_URL}/rest/v1/eph_expenses?select=date,amount,description`, { headers: H }).then((r) => r.json()),
  ]);
  const catId = new Map(cats.map((c) => [c.name, c.id]));
  const personalTag = (tags.find((t) => t.name === "Personal") ?? {}).id ?? null;
  if (!personalTag) { console.error('ABORT: no eph_tags row named "Personal" — an untagged row vanishes into the dashboard Untagged bucket.'); process.exit(1); }

  const seen = new Set(existing.map((r) => `${r.date}|${Number(r.amount).toFixed(2)}|${r.description}`));
  const fresh = out.filter((r) => !seen.has(`${r.date}|${r.amount.toFixed(2)}|${r.description}`));
  console.log(`\n${out.length - fresh.length} already present, inserting ${fresh.length}`);
  if (!fresh.length) return;

  const payload = fresh.map((r) => ({
    date: r.date,
    description: r.description,
    amount: r.amount,
    category_id: r.category ? catId.get(r.category) ?? null : null,
    tag_id: personalTag,
    card: r.card,
    merchant: r.merchant,
    source: r.source,
    notes: r.notes,
  }));
  for (let i = 0; i < payload.length; i += 500) {
    const chunk = payload.slice(i, i + 500);
    const res = await fetch(`${env.SUPABASE_URL}/rest/v1/eph_expenses`, {
      method: "POST", headers: H, body: JSON.stringify(chunk),
    });
    if (!res.ok) { console.error(`INSERT FAILED ${res.status}: ${await res.text()}`); process.exit(1); }
    console.log(`  inserted ${chunk.length}`);
  }
  console.log("done.");
})().catch((e) => { console.error("FAILED:", e.message); process.exit(1); });
