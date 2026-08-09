/*
 * Readable merchant names for bank-derived expense rows.
 *
 * Bank memos are unreadable and unbatchable as-is —
 * "Two Lincoln Squa DES:WEB PMTS ID:V2XZ8K INDN:CameronCorse CO" is a different
 * string every month, so the spending page grouped nine rent payments as nine
 * separate merchants. Mapping to "2 Lincoln Square" makes them one.
 *
 * Both /ephemeris/expenses and /ephemeris/spending render `merchant ||
 * description`, and "Top merchants" groups on the same expression, so setting
 * `merchant` fixes the list and the roll-up together.
 *
 * Shared by import_bofa_expenses.js and the backfill so the two cannot drift.
 */

/** [pattern, readable name]. First match wins, so order matters. */
const MERCHANT_RULES = [
  [/TWO LINCOLN SQUA/i, "2 Lincoln Square"],
  [/YARDI/i, "Yardi"],
  [/\bIRS\b|USATAXPYMT/i, "IRS"],
  [/NYS DTF/i, "NYS Tax"],
  [/AMERICAN EXPRESS|\bAMEX\b/i, "American Express"],
  [/CHASE CREDIT/i, "Chase Credit Card"],
  [/CRD 7061|ACCT# 7061|Credit Card Bill Payment|payment to CRD/i, "BofA Credit Card"],
  [/\bVENMO\b/i, "Venmo"],
  [/CONDUENT/i, "Conduent"],
  [/COBRA/i, "COBRA"],
  [/PATIENTCO/i, "Patientco"],
  [/BKOFAMERICA BC\b.*WITHDRWL|BKOFAMERICA ATM/i, "BofA branch withdrawal"],
  [/CHECK ORDER/i, "Check order"],
  [/WIRE TYPE|FX ORDER/i, "FX transfer"],
  [/BERKSHIRE BANK/i, "Berkshire Bank"],
  [/SCHWAB/i, "Schwab"],
  [/DES:FEE|SERVICE CHARGE|OVERDRAFT/i, "Bank fee"],

  // Legacy spreadsheet rows. Their descriptions are readable but carry a
  // qualifier ("CVS Office supplies", "Chat GPT Subscription"), so grouping on
  // the raw description splits one merchant across several buckets.
  [/STARRY/i, "Starry"],
  [/FIGMA/i, "Figma"],
  [/CHAT ?GPT|OPENAI/i, "ChatGPT"],
  [/GOOGLE CLOUD/i, "Google Cloud"],
  [/CONED|CON EDISON/i, "ConEd"],
  [/CLAUDE|ANTHROPIC/i, "Claude"],
  [/EXPRESS ?VPN/i, "ExpressVPN"],
  [/DRIVEREASY/i, "DriverEasy"],
  [/TYPEFORM/i, "Typeform"],
  [/\bCVS\b/i, "CVS"],
  [/MOBBIN/i, "Mobbin"],
  [/MACAFEE|MCAFEE/i, "McAfee"],
  [/FIVERR/i, "Fiverr"],
  [/CURSOR/i, "Cursor"],
];

/**
 * Zelle memos name the payee: "Zelle payment to DAVID S DIAMONDS INC for ...".
 * Keep the payee so each counterparty batches separately.
 */
function zellePayee(desc) {
  const m = String(desc).match(/Zelle payment to ([^;]+?)(?:\s+for\b|;|$)/i);
  if (!m) return null;
  const name = m[1].trim().replace(/\s+/g, " ");
  return name ? `Zelle: ${titleCase(name)}` : null;
}

/** "DAVID S DIAMONDS INC" -> "David S Diamonds Inc"; leaves mixed case alone. */
function titleCase(s) {
  if (!/[a-z]/.test(s)) {
    return s
      .toLowerCase()
      .replace(/\b([a-z])/g, (c) => c.toUpperCase())
      .replace(/\b(Llc|Inc|Co)\b/g, (w) => w.toUpperCase());
  }
  return s;
}

/**
 * @param {string} desc  raw bank memo, or a generated description
 * @param {string|null} card  "Amex" | "BofA" | "Chase" when the row is a card payment
 * @returns {string|null} readable merchant, or null when nothing is confident
 */
function merchantFor(desc, card = null) {
  // Card-payment allocation rows: batch under the card itself. The underlying
  // merchants live on the card statement, which this model does not import.
  if (card === "Amex") return "American Express";
  if (card === "BofA") return "BofA Credit Card";
  if (card === "Chase") return "Chase Credit Card";

  const zelle = zellePayee(desc);
  if (zelle) return zelle;

  for (const [re, name] of MERCHANT_RULES) if (re.test(desc)) return name;
  return null;
}

module.exports = { merchantFor, MERCHANT_RULES };
