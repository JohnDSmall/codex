// Company name → logo resolution.
//
// `companies.logo_path` in Supabase is the source of truth for which image a
// company uses; this module no longer hardcodes filenames. What stays here is
// the part the database can't answer: the many ways a single company is spelled
// across contact records (`organization`, `primary_company`, `company_tags`).
//
// Everything below is pure and synchronous so it can run inside Client
// Components. Load the map server-side with `loadCompanyLogoMap()` from
// `lib/company-logos-server.ts` and pass it down as a prop.

/** Normalized company name → public path, e.g. "84.51" → "/company_logos/8451.png". */
export type CompanyLogoMap = Record<string, string>;

export type CompanyLogoRow = {
  company_id: string;
  display_name: string | null;
  logo_path: string | null;
};

// Name variant → the canonical company name in the `companies` table.
// Derived from the filename map this module used to carry, so every spelling
// that resolved before still resolves. Add an entry when contact data spells a
// company differently than its `companies` row.
const NAME_ALIASES: Record<string, string> = {
  "8451": "84.51",
  abusch: "Anheuser-Busch",
  alight: "Alight Solutions",
  alixpartners: "Alix Partners",
  "alston bird": "Alston & Bird",
  amex: "American Express",
  aston: "Aston Martin",
  att: "AT&T",
  audacious: "Audacious Ventures",
  avanade: "Avande",
  bae: "BAE Systems",
  bain: "Bain & Company",
  "bain & co": "Bain & Company",
  "bain and company": "Bain & Company",
  beghou: "Beghou Consulting",
  bofa: "Bank of America",
  booz: "Booz Allen Hamilton",
  "booz allen": "Booz Allen Hamilton",
  "boston consulting group": "BCG",
  citigroup: "Citi",
  "del morgan": "DelMorgan & Co.",
  "ernst & young": "EY",
  "f-prime": "F-Prime Capital",
  fprime: "F-Prime Capital",
  freelancer: "Self Employed",
  fti: "FTI Consulting",
  gallo: "Gallo Wine",
  groupharm: "Group Harmonics",
  gs: "Goldman Sachs",
  iac: "IA Collaborative",
  idea: "IDEA Center",
  ieq: "IEQ Capital",
  invesity: "INVENSITY",
  "j.p. morgan": "JP Morgan",
  jpmorgan: "JP Morgan",
  kh: "Kraft Heinz",
  "l.e.k. consulting": "L.E.K.",
  "l'oreal": "Loreal",
  lek: "L.E.K.",
  mckinsey: "McKinsey & Company",
  mvw: "Marriott Vacation Worldwide",
  paraveda: "Pariveda",
  "procter & gamble": "P&G",
  reflection: "Reflection AI",
  saltai: "Salt AI",
  scale: "Scale AI",
  servicenow: "Service Now",
  snorkel: "Snorkel AI",
  texas: "University of Texas",
  "ut austin": "University of Texas",
  "valley capital": "Valley Capital Partners",
  "valor equity": "Valor Equity Partners",
  wellington: "Wellington Management",
  wellsfargo: "Wells Fargo",
  "west monroe partners": "West Monroe",
  "western michigan": "Western Michigan University",
  wmu: "Western Michigan University",
  yale: "Yale University",
};

export function normalizeCompanyName(name: string): string {
  return name
    .toLowerCase()
    .replace(/[,]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

// Drops corporate suffixes so "Acme Group" can match an "Acme" row.
function stripSuffixes(key: string): string {
  return key
    .replace(/\b(the|inc|llc|ltd|corp|corporation|company|co|group|partners)\b/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

/**
 * Build the lookup from `companies` rows. Both `company_id` and `display_name`
 * are indexed, since contact data uses either. Rows without a `logo_path` are
 * skipped — they simply have no logo yet.
 */
export function buildCompanyLogoMap(rows: CompanyLogoRow[]): CompanyLogoMap {
  const map: CompanyLogoMap = {};
  for (const row of rows) {
    if (!row.logo_path) continue;
    for (const candidate of [row.company_id, row.display_name]) {
      if (!candidate) continue;
      const key = normalizeCompanyName(candidate);
      if (key) map[key] = row.logo_path;
    }
  }
  // Point each known spelling variant at whatever its canonical company resolved to.
  for (const [variant, canonical] of Object.entries(NAME_ALIASES)) {
    const target = map[normalizeCompanyName(canonical)];
    if (target && !map[variant]) map[variant] = target;
  }
  return map;
}

/** Resolve a company name to a logo path, or null when it has no logo. */
export function logoForCompany(
  name: string | null | undefined,
  map: CompanyLogoMap,
): string | null {
  if (!name) return null;
  const key = normalizeCompanyName(name);
  if (map[key]) return map[key];
  const stripped = stripSuffixes(key);
  if (stripped !== key && map[stripped]) return map[stripped];
  return null;
}
