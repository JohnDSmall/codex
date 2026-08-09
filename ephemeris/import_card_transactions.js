/*
 * Load credit-card line items into eph_card_transactions as reference data.
 *
 *   node import_card_transactions.js --amex <dir> --card <dir> [--apply]
 *
 * These are NOT expenses. Expenses are cash that left the bank (the card
 * payments); these are what the card was used for, kept so a card payment can
 * be drilled into. Keeping them in their own table means no query can
 * accidentally double-count them.
 *
 * Idempotent via dedupe_key = card|date|amount|description|occurrence. The
 * occurrence index is what allows two identical $3.00 subway fares on one day
 * to both survive while a statement re-export does not duplicate anything.
 */
const fs = require("fs");
const path = require("path");
const { merchantFor } = require("./merchant_names");

const argv = process.argv.slice(2);
const APPLY = argv.includes("--apply");
function arg(flag) {
  const i = argv.indexOf(flag);
  return i === -1 ? null : argv[i + 1] ?? null;
}
const AMEX_DIR = arg("--amex");
const CARD_DIR = arg("--card");
if (!AMEX_DIR && !CARD_DIR) {
  console.error("usage: node import_card_transactions.js --amex <dir> --card <dir> [--apply]");
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
  Prefer: "return=representation,resolution=merge-duplicates",
};

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

/** Reuse the Python rules so card categories match expense categories. */
function loadCategoryRules() {
  const src = fs.readFileSync(path.join(__dirname, "import_csv.py"), "utf8");
  const start = src.indexOf("CATEGORY_RULES = [");
  const block = src.slice(start, src.indexOf("]", start));
  const rules = [];
  for (const m of block.matchAll(/\(\s*"([^"]+)"\s*,\s*"([^"]+)"\s*\)/g)) rules.push([m[1].toUpperCase(), m[2]]);
  return rules;
}
const CATEGORY_RULES = loadCategoryRules();
const categorize = (d) => {
  const up = String(d).toUpperCase();
  for (const [pat, cat] of CATEGORY_RULES) if (up.includes(pat)) return cat;
  return null;
};

/** Highest count within any one file — see import_bofa_expenses.js. */
function dedupeByMaxPerFile(perFile) {
  const best = new Map();
  for (const { list } of perFile) {
    const local = new Map();
    for (const r of list) {
      const k = `${r.date}|${r.amount.toFixed(2)}|${r.desc}`;
      if (!local.has(k)) local.set(k, { n: 0, r });
      local.get(k).n++;
    }
    for (const [k, v] of local) if (!best.has(k) || best.get(k).n < v.n) best.set(k, v);
  }
  const out = [];
  for (const { n, r } of best.values()) for (let i = 0; i < n; i++) out.push({ ...r, occurrence: i });
  return out;
}

function readAmex(dir) {
  const perFile = [];
  for (const f of fs.readdirSync(dir)) {
    if (!f.toLowerCase().endsWith(".csv")) continue;
    const rows = parseCsv(fs.readFileSync(path.join(dir, f), "utf8"));
    const h = rows.findIndex((r) => /^date$/i.test((r[0] || "").trim()));
    const list = [];
    for (const r of rows.slice(h + 1)) {
      if (r.length < 3 || !iso(r[0]) || num(r[2]) === null) continue;
      list.push({ card: "Amex", date: iso(r[0]), desc: String(r[1]).replace(/\s+/g, " ").trim(), amount: num(r[2]), file: f });
    }
    perFile.push({ file: f, list });
  }
  return dedupeByMaxPerFile(perFile).filter((r) => r.amount > 0);
}

function readBofa(dir) {
  const perFile = [];
  for (const f of fs.readdirSync(dir)) {
    if (!f.toLowerCase().endsWith(".csv")) continue;
    const rows = parseCsv(fs.readFileSync(path.join(dir, f), "utf8"));
    const h = rows.findIndex((r) => /posted date/i.test((r[0] || "").trim()));
    const list = [];
    for (const r of rows.slice(h + 1)) {
      if (r.length < 5 || !iso(r[0]) || num(r[4]) === null) continue;
      list.push({ card: "BofA", date: iso(r[0]), desc: String(r[2]).replace(/\s+/g, " ").trim(), amount: -num(r[4]), file: f });
    }
    perFile.push({ file: f, list });
  }
  return dedupeByMaxPerFile(perFile).filter((r) => r.amount > 0);
}

/**
 * Card memos are noisier than bank memos: "AplPay CVS PHARMACY NEW YORK NY".
 * Strip the network prefix and trailing city/state so the same shop batches.
 */
const US_STATES = "AL|AK|AZ|AR|CA|CO|CT|DE|FL|GA|HI|ID|IL|IN|IA|KS|KY|LA|ME|MD|MA|MI|MN|MS|MO|MT|NE|NV|NH|NJ|NM|NY|NC|ND|OH|OK|OR|PA|RI|SC|SD|TN|TX|UT|VT|VA|WA|WV|WI|WY|DC|PR";
function cardMerchant(desc) {
  const known = merchantFor(desc);
  if (known) return known;
  let d = String(desc)
    .replace(/^(AplPay|DD \*|TST\*|MTA\*|SQ \*|PAYPAL \*|NVN\* TRP \*?)\s*/i, "")
    .replace(/\s+/g, " ")
    .trim();
  d = d.replace(new RegExp(`\\s+(${US_STATES})$`, "i"), "");
  d = d.replace(/\s+#\d+.*$/, "");                       // "CVS/PHARMACY #02671" -> "CVS/PHARMACY"
  d = d.replace(/\s+(NEW YORK|BROOKLYN|SAN FRANCISCO|LONDON|PALMA DE MALLORCA)\b.*$/i, "");
  d = d.replace(/\*[A-Z0-9]{6,}.*$/i, "");               // "AMAZON MKTPL*DP3VP5MW3" -> "AMAZON MKTPL"
  d = d.replace(/\s+\d{3}-\d{3}-\d{4}.*$/, "");          // trailing phone numbers
  return d.trim().slice(0, 60) || null;
}

(async () => {
  const rows = [
    ...(AMEX_DIR ? readAmex(AMEX_DIR) : []),
    ...(CARD_DIR ? readBofa(CARD_DIR) : []),
  ].map((r) => ({
    card: r.card,
    date: r.date,
    description: r.desc.slice(0, 200),
    merchant: cardMerchant(r.desc),
    amount: r.amount,
    category: categorize(r.desc),
    source_file: r.file,
    dedupe_key: `${r.card}|${r.date}|${r.amount.toFixed(2)}|${r.desc}|${r.occurrence}`.slice(0, 300),
  }));

  const sum = (a) => a.reduce((s, r) => s + r.amount, 0);
  console.log(`===== ${APPLY ? "APPLY" : "DRY RUN"} =====`);
  for (const card of ["Amex", "BofA"]) {
    const v = rows.filter((r) => r.card === card);
    if (!v.length) continue;
    const dates = v.map((r) => r.date).sort();
    console.log(`  ${card.padEnd(5)} ${String(v.length).padStart(4)} charges  $${sum(v).toFixed(2).padStart(11)}  ${dates[0]} .. ${dates[dates.length - 1]}`);
  }
  console.log(`  total ${rows.length} rows, $${sum(rows).toFixed(2)}`);
  console.log(`  categorized: ${rows.filter((r) => r.category).length}   merchant set: ${rows.filter((r) => r.merchant).length}`);

  const byMerchant = new Map();
  for (const r of rows) {
    const k = r.merchant ?? "(none)";
    if (!byMerchant.has(k)) byMerchant.set(k, { n: 0, v: 0 });
    const a = byMerchant.get(k); a.n++; a.v += r.amount;
  }
  console.log(`\n--- top card merchants (${byMerchant.size} distinct) ---`);
  for (const [k, a] of [...byMerchant.entries()].sort((x, y) => y[1].v - x[1].v).slice(0, 18)) {
    console.log(`  ${String(a.n).padStart(4)}  $${a.v.toFixed(2).padStart(10)}  ${k}`);
  }

  if (!APPLY) { console.log("\ndry run - nothing written. re-run with --apply"); return; }

  const cats = await (await fetch(`${env.SUPABASE_URL}/rest/v1/eph_categories?select=id,name`, { headers: H })).json();
  const catId = new Map(cats.map((c) => [c.name, c.id]));
  const payload = rows.map((r) => ({
    card: r.card, date: r.date, description: r.description, merchant: r.merchant,
    amount: r.amount, category_id: r.category ? catId.get(r.category) ?? null : null,
    source_file: r.source_file, dedupe_key: r.dedupe_key,
  }));

  let written = 0;
  for (let i = 0; i < payload.length; i += 500) {
    const chunk = payload.slice(i, i + 500);
    const res = await fetch(`${env.SUPABASE_URL}/rest/v1/eph_card_transactions?on_conflict=dedupe_key`, {
      method: "POST", headers: H, body: JSON.stringify(chunk),
    });
    if (!res.ok) { console.error(`INSERT FAILED ${res.status}: ${await res.text()}`); process.exit(1); }
    written += (await res.json()).length;
    console.log(`  upserted ${written}/${payload.length}`);
  }
  console.log("done.");
})().catch((e) => { console.error("FAILED:", e.message); process.exit(1); });
