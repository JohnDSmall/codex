/*
 * Rule engine shared by refresh.js. The rule files live under web/lib/rules so
 * the Next app reads the very same JSON (partner flag, bucket groups) — one
 * source of truth, no drift between importer and UI.
 */
const fs = require("fs");
const path = require("path");
const { merchantFor } = require("../merchant_names");

const RULES_DIR = path.resolve(__dirname, "..", "..", "web", "lib", "rules");
const readJson = (f) => JSON.parse(fs.readFileSync(path.join(RULES_DIR, f), "utf8"));

const categories = readJson("categories.json");
const categoryRules = readJson("category-rules.json");
const partner = readJson("partner-merchants.json");

const BUCKETS = categories.buckets;
const BUCKET_NAMES = new Set(BUCKETS.map((b) => b.name));
const LEGACY = categories.legacy;

for (const r of categoryRules.rules) {
  if (!BUCKET_NAMES.has(r.bucket)) throw new Error(`category-rules.json: unknown bucket "${r.bucket}" for "${r.match}"`);
}
const RULES = categoryRules.rules.map((r) => [r.match.toUpperCase(), r.bucket]);

/** Bucket name for a raw memo, or null when no rule matches. First match wins. */
function categorize(desc) {
  const up = String(desc ?? "").toUpperCase();
  for (const [pat, bucket] of RULES) if (up.includes(pat)) return bucket;
  return null;
}

/** Where a legacy business-chart category lands, or null. undefined = not a legacy name. */
function legacyBucket(oldName) {
  return Object.prototype.hasOwnProperty.call(LEGACY, oldName) ? LEGACY[oldName] : undefined;
}

const PARTNER_CARDS = new Set(partner.cards ?? []);
const PARTNER = (partner.merchants ?? []).map((m) => String(m).toUpperCase());
function isPartnerCharge(card, merchant, desc) {
  if (!PARTNER_CARDS.has(card) || PARTNER.length === 0) return false;
  const hay = `${merchant ?? ""}\n${desc ?? ""}`.toUpperCase();
  return PARTNER.some((p) => hay.includes(p));
}

/** Card memos are noisier than bank memos; same cleaner as import_card_transactions.js. */
const US_STATES = "AL|AK|AZ|AR|CA|CO|CT|DE|FL|GA|HI|ID|IL|IN|IA|KS|KY|LA|ME|MD|MA|MI|MN|MS|MO|MT|NE|NV|NH|NJ|NM|NY|NC|ND|OH|OK|OR|PA|RI|SC|SD|TN|TX|UT|VT|VA|WA|WV|WI|WY|DC|PR";
function cardMerchant(desc) {
  const known = merchantFor(desc);
  if (known) return known;
  let d = String(desc)
    .replace(/^(AplPay|DD \*|TST\*|MTA\*|SQ \*|PAYPAL \*|NVN\* TRP \*?)\s*/i, "")
    .replace(/\s+/g, " ")
    .trim();
  d = d.replace(new RegExp(`\\s+(${US_STATES})$`, "i"), "");
  d = d.replace(/\s+#\d+.*$/, "");
  d = d.replace(/\s+(NEW YORK|BROOKLYN|SAN FRANCISCO|LONDON|PALMA DE MALLORCA)\b.*$/i, "");
  d = d.replace(/\*[A-Z0-9]{6,}.*$/i, "");
  d = d.replace(/\s+\d{3}-\d{3}-\d{4}.*$/, "");
  return d.trim().slice(0, 60) || null;
}

/** Append rules (array of {match, bucket}) to category-rules.json, skipping duplicates. */
function appendRules(newRules) {
  const file = path.join(RULES_DIR, "category-rules.json");
  const json = JSON.parse(fs.readFileSync(file, "utf8"));
  const have = new Set(json.rules.map((r) => r.match.toUpperCase()));
  let added = 0;
  for (const r of newRules) {
    if (!BUCKET_NAMES.has(r.bucket)) throw new Error(`unknown bucket "${r.bucket}" for "${r.match}"`);
    if (have.has(r.match.toUpperCase())) continue;
    json.rules.push({ match: r.match, bucket: r.bucket });
    have.add(r.match.toUpperCase());
    added++;
  }
  fs.writeFileSync(file, JSON.stringify(json, null, 2) + "\n");
  return added;
}

module.exports = { BUCKETS, BUCKET_NAMES, categorize, legacyBucket, isPartnerCharge, cardMerchant, merchantFor, appendRules, RULES_DIR };
