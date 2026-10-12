/*
 * Statement CSV readers shared by refresh.js. Formats:
 *   bank      BofA checking/savings export: "Date,Description,Amount,Running Bal." after a summary block
 *   amex      "Date,Description,Amount" (charges positive, payments/credits negative)
 *   bofa-card "Posted Date,Reference Number,Payee,Address,Amount" (charges negative)
 *
 * De-duplication across overlapping exports keeps the HIGHEST count of an
 * identical (date, amount, memo) seen in any ONE file — two $3.00 subway fares
 * on one day are a round trip, not a duplicate, but the same file exported
 * twice adds nothing. Same rule as the 2026-08-08 importers.
 */
const fs = require("fs");
const path = require("path");

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
  const m = String(mdy).match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
  return m ? `${m[3]}-${m[1].padStart(2, "0")}-${m[2].padStart(2, "0")}` : null;
};
const clean = (s) => String(s).replace(/\s+/g, " ").trim();

function csvFiles(dir) {
  if (!dir || !fs.existsSync(dir)) return [];
  return fs.readdirSync(dir).filter((f) => f.toLowerCase().endsWith(".csv")).sort().map((f) => path.join(dir, f));
}

/** Bank debits only (negative amounts), as positive spend. */
function readBankDir(dir) {
  const out = [];
  for (const file of csvFiles(dir)) {
    const rows = parseCsv(fs.readFileSync(file, "utf8"));
    const h = rows.findIndex((r) => r[0] === "Date" && r[1] === "Description");
    if (h === -1) throw new Error(`${path.basename(file)}: no "Date,Description" header — is this a BofA bank export?`);
    const account = /sav/i.test(path.basename(file)) ? "BofA Savings" : "BofA Checking";
    for (const r of rows.slice(h + 1)) {
      if (r.length < 3 || !iso(r[0]) || num(r[2]) === null || num(r[2]) >= 0) continue;
      out.push({ date: iso(r[0]), desc: clean(r[1]), amount: -num(r[2]), account, file: path.basename(file) });
    }
  }
  return dedupeByMaxPerFile(out);
}

function readAmexDir(dir) {
  const out = [];
  for (const file of csvFiles(dir)) {
    const rows = parseCsv(fs.readFileSync(file, "utf8"));
    const h = rows.findIndex((r) => /^date$/i.test((r[0] || "").trim()));
    for (const r of rows.slice(h + 1)) {
      if (r.length < 3 || !iso(r[0]) || num(r[2]) === null) continue;
      out.push({ card: "Amex", date: iso(r[0]), desc: clean(r[1]), amount: num(r[2]), file: path.basename(file) });
    }
  }
  return dedupeByMaxPerFile(out).filter((r) => r.amount > 0);
}

function readBofaCardDir(dir) {
  const out = [];
  for (const file of csvFiles(dir)) {
    const rows = parseCsv(fs.readFileSync(file, "utf8"));
    const h = rows.findIndex((r) => /posted date/i.test((r[0] || "").trim()));
    for (const r of rows.slice(h + 1)) {
      if (r.length < 5 || !iso(r[0]) || num(r[4]) === null) continue;
      out.push({ card: "BofA", date: iso(r[0]), desc: clean(r[2]), amount: -num(r[4]), file: path.basename(file) });
    }
  }
  return dedupeByMaxPerFile(out).filter((r) => r.amount > 0);
}

/** rows carry `file`; returns rows with an `occurrence` index per (date|amount|desc). */
function dedupeByMaxPerFile(rows) {
  const perFile = new Map();
  for (const r of rows) {
    const k = `${r.date}|${r.amount.toFixed(2)}|${r.desc}`;
    if (!perFile.has(r.file)) perFile.set(r.file, new Map());
    const local = perFile.get(r.file);
    if (!local.has(k)) local.set(k, { n: 0, r });
    local.get(k).n++;
  }
  const best = new Map();
  for (const local of perFile.values()) {
    for (const [k, v] of local) if (!best.has(k) || best.get(k).n < v.n) best.set(k, v);
  }
  const out = [];
  for (const { n, r } of best.values()) for (let i = 0; i < n; i++) out.push({ ...r, occurrence: i });
  return out.sort((a, b) => a.date.localeCompare(b.date));
}

module.exports = { readBankDir, readAmexDir, readBofaCardDir, parseCsv, iso, num };
