/*
 * One-command expense refresh. Dry-run by default; nothing is written without --apply.
 *
 *   node refresh.js                 # dry run: read statements, show what would change
 *   node refresh.js --apply         # write it
 *   node refresh.js review-apply    # read the filled-in review CSV, add its rules, then re-run
 *
 * Reads every CSV under the statements folder (override with --statements <dir>):
 *   %USERPROFILE%\Documents\Codex Statements\{bank,amex,bofa-card}
 *
 * What it does, in order:
 *   1. Ensure the 12 buckets exist in eph_categories (parent = group) and park the
 *      old business-chart categories under parent "Legacy" so the UI hides them.
 *   2. Upsert every card charge into eph_card_transactions (dedupe_key), with the
 *      bucket from category-rules.json.
 *   3. Re-apply the rules to EVERY card charge already in the table.
 *   4. Insert new bank debits into eph_expenses. Direct spend is one row, bucketed
 *      by rule. A card payment is split across buckets in proportion to that
 *      card's charges in the previous calendar month (eph_card_transactions is the
 *      source now, so old statements need not be present). Internal CHK<->SAV and
 *      brokerage transfers are excluded, exactly as before.
 *   5. Re-bucket every existing direct expense (rule first, then the legacy map)
 *      and RE-SPLIT every existing card payment from the current card mix, so the
 *      whole history follows the current rules. Payment groups are identified by
 *      (date, card); their rows are replaced in place.
 *   6. Write review-uncategorized.csv next to the statements: merchants with no
 *      rule, largest first. Fill the `bucket` column and run `review-apply`.
 *   7. Print the monthly series. EYEBALL IT — a wrong number is silent (RUNBOOK).
 *
 * A backup of every category_id about to change, and every payment row about to
 * be replaced, is written to ephemeris/backups/ before any write.
 */
const fs = require("fs");
const path = require("path");
const os = require("os");
const { readBankDir, readAmexDir, readBofaCardDir, parseCsv } = require("./lib/statements.cjs");
const R = require("./lib/rules.cjs");

const argv = process.argv.slice(2);
const APPLY = argv.includes("--apply");
const MODE = argv.find((a) => !a.startsWith("--")) ?? "refresh";
const argVal = (f) => { const i = argv.indexOf(f); return i === -1 ? null : argv[i + 1]; };
const STATEMENTS = argVal("--statements") ?? path.join(os.homedir(), "Documents", "Codex Statements");
const REVIEW_CSV = path.join(STATEMENTS, "review-uncategorized.csv");
const BACKUPS = path.join(__dirname, "backups");

/* ------------------------------------------------------------------- env */
const env = {};
for (const line of fs.readFileSync(path.resolve(__dirname, "..", "web", ".env.local"), "utf8").split(/\r?\n/)) {
  const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*?)\s*$/);
  if (m) env[m[1]] = m[2].replace(/^["']|["']$/g, ""); // .env.local wins over the shell (RUNBOOK)
}
if (!env.SUPABASE_URL || !env.SUPABASE_SERVICE_KEY) throw new Error("web/.env.local must set SUPABASE_URL and SUPABASE_SERVICE_KEY");

async function rest(method, pathq, { body, prefer } = {}) {
  const res = await fetch(`${env.SUPABASE_URL}/rest/v1/${pathq}`, {
    method,
    headers: {
      apikey: env.SUPABASE_SERVICE_KEY,
      Authorization: `Bearer ${env.SUPABASE_SERVICE_KEY}`,
      "Content-Type": "application/json",
      ...(prefer ? { Prefer: prefer } : {}),
    },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  const text = await res.text();
  if (!res.ok) throw new Error(`${method} ${pathq} -> ${res.status}: ${text.slice(0, 400)}`);
  return text ? JSON.parse(text) : null;
}
async function getAll(pathq) {
  const out = [];
  for (let off = 0; ; off += 1000) {
    const b = await rest("GET", `${pathq}${pathq.includes("?") ? "&" : "?"}offset=${off}&limit=1000`);
    out.push(...b);
    if (b.length < 1000) return out;
  }
}
async function chunked(method, pathq, rows, prefer, size = 500) {
  for (let i = 0; i < rows.length; i += size) await rest(method, pathq, { body: rows.slice(i, i + size), prefer });
}

/* --------------------------------------------------------------- helpers */
const money = (n) => `$${n.toFixed(2)}`;
const sum = (a, f = (r) => r.amount) => a.reduce((s, r) => s + f(r), 0);
const prevMonth = (ym) => { const [y, m] = ym.split("-").map(Number); return new Date(Date.UTC(y, m - 2, 1)).toISOString().slice(0, 7); };
const isInternalTransfer = (d) => /Online Banking transfer (from|to) (SAV|CHK)/i.test(d);
const isInvestmentTransfer = (d) =>
  /SCHWAB|FIDELITY|VANGUARD|BETTERMENT|ROBINHOOD|COINBASE|WEALTHFRONT/i.test(d) ||
  /Online Banking transfer (from|to) BRK\b/i.test(d);
const cardOf = (d) => {
  if (/AMERICAN EXPRESS|AMEX/i.test(d)) return "Amex";
  if (/CRD 7061|ACCT# 7061|Credit Card Bill Payment|payment to CRD/i.test(d)) return "BofA";
  if (/CHASE CREDIT/i.test(d)) return "Chase";
  return null;
};
const isPaymentRow = (e) => !!e.card && /card payment/i.test(e.description);

/** Largest-remainder split of `total` across weights, exact to the cent. */
function splitExact(total, weights) {
  const parts = [...weights.entries()].map(([k, w]) => ({ k, exact: total * w })).sort((a, b) => b.exact - a.exact);
  let allocated = 0;
  parts.forEach((p, i) => {
    p.amount = i === parts.length - 1 ? Math.round((total - allocated) * 100) / 100 : Math.round(p.exact * 100) / 100;
    allocated += p.amount;
  });
  return parts.filter((p) => p.amount > 0);
}

/* ---------------------------------------------------------- review-apply */
if (MODE === "review-apply") {
  if (!fs.existsSync(REVIEW_CSV)) { console.error(`no ${REVIEW_CSV} — run a refresh first`); process.exit(1); }
  const rows = parseCsv(fs.readFileSync(REVIEW_CSV, "utf8"));
  const h = rows[0].map((c) => c.trim().toLowerCase());
  const iMatch = h.indexOf("match"), iBucket = h.indexOf("bucket");
  const add = [];
  for (const r of rows.slice(1)) {
    const match = (r[iMatch] ?? "").trim(), bucket = (r[iBucket] ?? "").trim();
    if (!match || !bucket) continue;
    if (!R.BUCKET_NAMES.has(bucket)) { console.error(`skip "${match}": "${bucket}" is not a bucket. Buckets: ${[...R.BUCKET_NAMES].join(", ")}`); continue; }
    add.push({ match, bucket });
  }
  const added = R.appendRules(add);
  console.log(`${added} rule(s) added to web/lib/rules/category-rules.json (${add.length - added} already present).`);
  console.log(`Now run: node refresh.js${APPLY ? " --apply" : ""}`);
  process.exit(0);
}

/* ---------------------------------------------------------------- refresh */
(async () => {
  console.log(`===== ${APPLY ? "APPLY" : "DRY RUN"} · statements: ${STATEMENTS} =====\n`);

  // ---- 1. buckets
  const cats = await getAll("eph_categories?select=id,parent,name&order=name");
  const byName = new Map(cats.map((c) => [c.name, c]));
  const newBuckets = R.BUCKETS.filter((b) => !byName.has(b.name));
  const toLegacy = cats.filter((c) => !R.BUCKET_NAMES.has(c.name) && c.parent !== "Legacy");
  console.log(`buckets: ${R.BUCKETS.length} defined, ${newBuckets.length} to create, ${toLegacy.length} old categories to park under "Legacy"`);
  if (APPLY) {
    if (newBuckets.length) {
      const made = await rest("POST", "eph_categories", { body: newBuckets.map((b) => ({ name: b.name, parent: b.group })), prefer: "return=representation" });
      for (const c of made) byName.set(c.name, c);
    }
    for (const c of toLegacy) await rest("PATCH", `eph_categories?id=eq.${c.id}`, { body: { parent: "Legacy", updated_at: new Date().toISOString() }, prefer: "return=minimal" });
  } else {
    for (const b of newBuckets) byName.set(b.name, { id: `dry-${b.name}`, name: b.name, parent: b.group });
  }
  const bucketId = (name) => (name ? byName.get(name)?.id ?? null : null);
  const nameOfId = new Map([...byName.values()].map((c) => [c.id, c.name]));

  // ---- 2. card charges from statements
  const amex = readAmexDir(path.join(STATEMENTS, "amex"));
  const bofa = readBofaCardDir(path.join(STATEMENTS, "bofa-card"));
  const charges = [...amex, ...bofa].map((r) => ({
    card: r.card, date: r.date, description: r.desc.slice(0, 200), merchant: R.cardMerchant(r.desc),
    amount: r.amount, bucket: R.categorize(r.desc), source_file: r.file,
    dedupe_key: `${r.card}|${r.date}|${r.amount.toFixed(2)}|${r.desc}|${r.occurrence}`.slice(0, 300),
  }));
  const existingTx = await getAll("eph_card_transactions?select=id,card,date,description,merchant,amount,category_id,dedupe_key&order=date");
  const haveKey = new Set(existingTx.map((t) => t.dedupe_key));
  const newCharges = charges.filter((c) => !haveKey.has(c.dedupe_key));
  console.log(`card charges: ${charges.length} in statements (Amex ${amex.length}, BofA ${bofa.length}); ${existingTx.length} in DB; ${newCharges.length} new`);
  if (APPLY && newCharges.length) {
    await chunked("POST", "eph_card_transactions?on_conflict=dedupe_key", newCharges.map((c) => ({
      card: c.card, date: c.date, description: c.description, merchant: c.merchant, amount: c.amount,
      category_id: bucketId(c.bucket), source_file: c.source_file, dedupe_key: c.dedupe_key,
    })), "resolution=merge-duplicates,return=minimal");
  }

  // ---- 3. re-rule every card charge
  const allTx = [...existingTx, ...newCharges.map((c) => ({ ...c, id: null, category_id: bucketId(c.bucket) }))];
  const txChanges = [];
  for (const t of existingTx) {
    const want = bucketId(R.categorize(t.description));
    if (want !== t.category_id) txChanges.push({ id: t.id, from: t.category_id, to: want });
    t.category_id = want;
  }
  console.log(`card charges re-bucketed: ${txChanges.length} change`);

  // ---- 4. bank debits -> expenses
  const debits = readBankDir(path.join(STATEMENTS, "bank"));
  const transfers = debits.filter((r) => isInternalTransfer(r.desc));
  const investments = debits.filter((r) => !isInternalTransfer(r.desc) && isInvestmentTransfer(r.desc));
  const spend = debits.filter((r) => !isInternalTransfer(r.desc) && !isInvestmentTransfer(r.desc));
  console.log(`bank debits: ${debits.length} rows ${money(sum(debits))}; excluded ${transfers.length} internal transfers ${money(sum(transfers))}, ${investments.length} investment moves ${money(sum(investments))}; spend ${spend.length} rows ${money(sum(spend))}`);

  const expenses = await getAll("eph_expenses?select=id,date,description,amount,card,merchant,source,notes,category_id,tag_id&order=date");
  const tags = await getAll("eph_tags?select=id,name");
  const personalTag = tags.find((t) => t.name === "Personal")?.id;
  if (!personalTag) throw new Error('ABORT: no eph_tags row named "Personal" (untagged rows vanish into the dashboard Untagged bucket)');

  const directKey = (d, a, desc) => `${d}|${Number(a).toFixed(2)}|${desc}`;
  const haveDirect = new Set(expenses.filter((e) => !isPaymentRow(e)).map((e) => directKey(e.date, e.amount, e.description)));

  // Existing payment groups: (date|card) -> rows
  const groups = new Map();
  for (const e of expenses.filter(isPaymentRow)) {
    const k = `${e.date}|${e.card}`;
    if (!groups.has(k)) groups.set(k, { date: e.date, card: e.card, rows: [], total: 0, source: e.source });
    const g = groups.get(k); g.rows.push(e); g.total = Math.round((g.total + Number(e.amount)) * 100) / 100;
  }

  const newDirect = [], newPayments = new Map();
  for (const r of spend) {
    const card = cardOf(r.desc);
    if (!card) {
      const description = r.desc.slice(0, 120);
      if (haveDirect.has(directKey(r.date, r.amount, description))) continue;
      newDirect.push({ date: r.date, description, amount: r.amount, bucket: R.categorize(r.desc), merchant: R.merchantFor(r.desc), source: r.file, notes: `Bank debit from ${r.account} (${r.file})` });
      haveDirect.add(directKey(r.date, r.amount, description));
    } else {
      const k = `${r.date}|${card}`;
      if (!newPayments.has(k)) newPayments.set(k, { date: r.date, card, total: 0, source: r.file, account: r.account });
      const p = newPayments.get(k); p.total = Math.round((p.total + r.amount) * 100) / 100;
    }
  }
  // A payment group is new when nothing exists for that (date, card). If one exists with a
  // different total (a second payment the same day in a newer export), top it up as its own group? No —
  // keep it simple and honest: report the mismatch, do not guess.
  const freshPayments = [], mismatched = [];
  for (const [k, p] of newPayments) {
    const g = groups.get(k);
    if (!g) freshPayments.push(p);
    else if (Math.abs(g.total - p.total) > 0.005) mismatched.push({ ...p, inDb: g.total });
  }
  console.log(`expenses: ${expenses.length} in DB; new direct rows ${newDirect.length} ${money(sum(newDirect))}; new card payments ${freshPayments.length} ${money(sum(freshPayments, (p) => p.total))}`);
  if (mismatched.length) {
    console.log(`  WARNING ${mismatched.length} payment day(s) differ between DB and statements (not touched):`);
    for (const m of mismatched) console.log(`    ${m.date} ${m.card}: DB ${money(m.inDb)} vs statements ${money(m.total)}`);
  }

  // ---- 5. re-bucket direct rows, re-split payments
  // card mix per (card, month) -> Map(bucketId|null -> amount), from the full (updated) card table
  const mix = new Map();
  for (const t of allTx) {
    const k = `${t.card}|${t.date.slice(0, 7)}`;
    if (!mix.has(k)) mix.set(k, new Map());
    const m = mix.get(k); m.set(t.category_id, (m.get(t.category_id) ?? 0) + Number(t.amount));
  }
  const splitPayment = (p) => {
    const m = mix.get(`${p.card}|${prevMonth(p.date.slice(0, 7))}`);
    const base = { date: p.date, card: p.card, merchant: R.merchantFor("", p.card), source: p.source, tag_id: personalTag };
    if (!m || sum([...m.values()], (v) => v) <= 0) {
      return [{ ...base, amount: p.total, category_id: null, description: `${p.card} card payment`, notes: `Card payment; no ${p.card} charges on file for ${prevMonth(p.date.slice(0, 7))}, so it is uncategorized` }];
    }
    const total = sum([...m.values()], (v) => v);
    const weights = new Map([...m].map(([cid, v]) => [cid, v / total]));
    return splitExact(p.total, weights).map((part) => ({
      ...base, amount: part.amount, category_id: part.k,
      description: `${p.card} card payment — ${part.k ? nameOfId.get(part.k) ?? "?" : "Uncategorized"} share`,
      notes: `Allocated ${(100 * part.amount / p.total).toFixed(1)}% of a ${money(p.total)} ${p.card} payment by the ${prevMonth(p.date.slice(0, 7))} charge mix`,
    }));
  };

  const directChanges = [];
  for (const e of expenses) {
    if (isPaymentRow(e)) continue;
    const byRule = R.categorize(e.description);
    let want;
    if (byRule) want = bucketId(byRule);
    else {
      const oldName = e.category_id ? nameOfId.get(e.category_id) : null;
      if (oldName && R.BUCKET_NAMES.has(oldName)) want = e.category_id;           // already a bucket, no rule: keep
      else if (oldName) { const lb = R.legacyBucket(oldName); want = lb === undefined ? e.category_id : bucketId(lb); }
      else want = null;
    }
    if (want !== e.category_id) directChanges.push({ id: e.id, from: e.category_id, to: want, desc: e.description });
  }
  const resplits = [];
  for (const g of groups.values()) {
    const rows = splitPayment({ date: g.date, card: g.card, total: g.total, source: g.source });
    const same = rows.length === g.rows.length && rows.every((r) => g.rows.some((o) => Number(o.amount) === r.amount && o.category_id === r.category_id));
    if (!same) resplits.push({ group: g, rows });
  }
  console.log(`direct expenses re-bucketed: ${directChanges.length} change; card payment groups: ${groups.size}, ${resplits.length} re-split`);

  // ---- summary of resulting buckets
  const after = new Map();
  const addTo = (cid, amt) => { const n = cid ? nameOfId.get(cid) ?? "?" : "(uncategorized)"; after.set(n, (after.get(n) ?? 0) + amt); };
  const changedDirect = new Map(directChanges.map((c) => [c.id, c.to]));
  const resplitIds = new Set(resplits.flatMap((r) => r.group.rows.map((x) => x.id)));
  for (const e of expenses) { if (resplitIds.has(e.id)) continue; addTo(changedDirect.has(e.id) ? changedDirect.get(e.id) : e.category_id, Number(e.amount)); }
  for (const r of resplits) for (const row of r.rows) addTo(row.category_id, row.amount);
  for (const d of newDirect) addTo(bucketId(d.bucket), d.amount);
  for (const p of freshPayments) for (const row of splitPayment(p)) addTo(row.category_id, row.amount);
  console.log("\n--- expenses by bucket (after) ---");
  for (const [k, v] of [...after].sort((a, b) => b[1] - a[1])) console.log(`  ${k.padEnd(24)} ${money(v).padStart(13)}`);

  // monthly series
  const months = new Map();
  for (const e of expenses) months.set(e.date.slice(0, 7), (months.get(e.date.slice(0, 7)) ?? 0) + Number(e.amount));
  for (const d of newDirect) months.set(d.date.slice(0, 7), (months.get(d.date.slice(0, 7)) ?? 0) + d.amount);
  for (const p of freshPayments) months.set(p.date.slice(0, 7), (months.get(p.date.slice(0, 7)) ?? 0) + p.total);
  console.log("\n--- monthly spend (after; eyeball this) ---");
  for (const [m, v] of [...months].sort()) console.log(`  ${m}  ${money(v).padStart(12)}${newDirect.some((d) => d.date.startsWith(m)) || freshPayments.some((p) => p.date.startsWith(m)) ? "  *new rows" : ""}`);

  // ---- 6. review queue: card charges + direct rows with no rule
  const queue = new Map();
  const push = (card, merchant, desc, amt) => {
    const k = `${card}|${merchant}`;
    if (!queue.has(k)) queue.set(k, { card, merchant, n: 0, total: 0, sample: desc });
    const q = queue.get(k); q.n++; q.total += amt;
  };
  for (const t of allTx) if (!R.categorize(t.description)) push(t.card, t.merchant || t.description, t.description, Number(t.amount));
  for (const e of expenses) if (!isPaymentRow(e) && !R.categorize(e.description)) push("bank", e.merchant || e.description, e.description, Number(e.amount));
  for (const d of newDirect) if (!d.bucket) push("bank", d.merchant || d.description, d.description, d.amount);
  const review = [...queue.values()].sort((a, b) => b.total - a.total);
  const csv = ["card,match,bucket,n,total,sample"].concat(review.map((q) => [q.card, q.merchant, "", q.n, q.total.toFixed(2), q.sample].map((v) => `"${String(v).replace(/"/g, '""')}"`).join(","))).join("\n");
  fs.writeFileSync(REVIEW_CSV, csv + "\n");
  console.log(`\nreview queue: ${review.length} merchants with no rule (${money(sum(review, (q) => q.total))}) -> ${REVIEW_CSV}`);
  for (const q of review.slice(0, 12)) console.log(`  ${q.card.padEnd(5)} ${String(q.n).padStart(3)} ${money(q.total).padStart(11)}  ${q.merchant}`);
  console.log("  Fill the `bucket` column (use `match` to narrow the pattern), then: node refresh.js review-apply");

  if (!APPLY) { console.log("\ndry run - nothing written. re-run with --apply"); return; }

  // ---- write
  fs.mkdirSync(BACKUPS, { recursive: true });
  const stamp = new Date().toISOString().replace(/[:.]/g, "-");
  fs.writeFileSync(path.join(BACKUPS, `${stamp}-refresh.json`), JSON.stringify({ txChanges, directChanges, replacedPaymentRows: resplits.flatMap((r) => r.group.rows) }, null, 1));
  console.log(`\nbackup written to backups/${stamp}-refresh.json`);

  for (const c of txChanges) await rest("PATCH", `eph_card_transactions?id=eq.${c.id}`, { body: { category_id: c.to, updated_at: new Date().toISOString() }, prefer: "return=minimal" });
  console.log(`  card charges updated: ${txChanges.length}`);
  for (const c of directChanges) await rest("PATCH", `eph_expenses?id=eq.${c.id}`, { body: { category_id: c.to, updated_at: new Date().toISOString() }, prefer: "return=minimal" });
  console.log(`  direct expenses updated: ${directChanges.length}`);
  for (const r of resplits) {
    await rest("DELETE", `eph_expenses?id=in.(${r.group.rows.map((x) => x.id).join(",")})`, { prefer: "return=minimal" });
    await rest("POST", "eph_expenses", { body: r.rows, prefer: "return=minimal" });
  }
  console.log(`  card payments re-split: ${resplits.length}`);
  if (newDirect.length) await chunked("POST", "eph_expenses", newDirect.map((d) => ({ date: d.date, description: d.description, amount: d.amount, category_id: bucketId(d.bucket), tag_id: personalTag, card: null, merchant: d.merchant, source: d.source, notes: d.notes })), "return=minimal");
  console.log(`  new direct expenses inserted: ${newDirect.length}`);
  let payRows = 0;
  for (const p of freshPayments) { const rows = splitPayment(p); payRows += rows.length; await rest("POST", "eph_expenses", { body: rows, prefer: "return=minimal" }); }
  console.log(`  new card payments inserted: ${freshPayments.length} (${payRows} rows)`);
  console.log("done.");
})().catch((e) => { console.error("FAILED:", e.message); process.exit(1); });
