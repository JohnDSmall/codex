import type { Contact, StrengthTier } from "./types";

export type OrgCount = { name: string; count: number };
export type AreaCodeCount = { code: string; count: number };

/**
 * Where the network actually works, counting each person once.
 *
 * `organization` alone is the wrong field: it is the free-text iCloud import,
 * set on ~134 of 1,193 contacts and full of memo text ("Personal", "Lax",
 * "Michigan Head Coach"). `primary_company` is the curated field and is set on
 * ~339. Reading only `organization` made the chart report Snorkel at 4 as the
 * top employer while primary_company had Deloitte at 60.
 */
export function topOrganizations(contacts: Contact[], limit = 12): OrgCount[] {
  const counts = new Map<string, number>();
  for (const c of contacts) {
    const org = c.primary_company?.trim() || c.organization?.trim();
    if (!org) continue;
    counts.set(org, (counts.get(org) ?? 0) + 1);
  }
  return [...counts.entries()]
    .map(([name, count]) => ({ name, count }))
    .sort((a, b) => b.count - a.count)
    .slice(0, limit);
}

export type CompetencyBucket = { label: string; count: number };
export type StrengthBucket = { tier: StrengthTier | "unrated"; label: string; count: number };

/**
 * Competency 1-10, plus an explicit Unrated bucket. Unrated is not zero and
 * must stay visually separate, or an unfilled book reads as a book of
 * incompetents.
 */
export function competencyDistribution(contacts: Contact[]): {
  buckets: CompetencyBucket[];
  rated: number;
  unrated: number;
  average: number | null;
} {
  const counts = new Map<number, number>();
  let rated = 0;
  let sum = 0;
  for (const c of contacts) {
    if (c.competency == null) continue;
    rated++;
    sum += c.competency;
    counts.set(c.competency, (counts.get(c.competency) ?? 0) + 1);
  }
  const buckets: CompetencyBucket[] = Array.from({ length: 10 }, (_, i) => ({
    label: String(i + 1),
    count: counts.get(i + 1) ?? 0,
  }));
  return {
    buckets,
    rated,
    unrated: contacts.length - rated,
    average: rated ? sum / rated : null,
  };
}

const STRENGTH_ORDER: { tier: StrengthTier; label: string }[] = [
  { tier: "strong", label: "Strong" },
  { tier: "medium", label: "Medium" },
  { tier: "weak", label: "Weak" },
  { tier: "loose", label: "Loose" },
  { tier: "none", label: "None" },
];

export function strengthDistribution(contacts: Contact[]): StrengthBucket[] {
  const counts = new Map<string, number>();
  for (const c of contacts) {
    const t = c.strength_tier ?? "none";
    counts.set(t, (counts.get(t) ?? 0) + 1);
  }
  return STRENGTH_ORDER.map(({ tier, label }) => ({
    tier,
    label,
    count: counts.get(tier) ?? 0,
  }));
}

function extractAreaCode(phone: string): string | null {
  // Strip non-digits, then look for a US-style 10-digit number.
  const digits = phone.replace(/\D+/g, "");
  if (digits.length === 11 && digits.startsWith("1")) return digits.slice(1, 4);
  if (digits.length === 10) return digits.slice(0, 3);
  return null;
}

export function topAreaCodes(contacts: Contact[], limit = 12): AreaCodeCount[] {
  const counts = new Map<string, number>();
  for (const c of contacts) {
    for (const p of c.phones) {
      const ac = extractAreaCode(p.value);
      if (!ac) continue;
      counts.set(ac, (counts.get(ac) ?? 0) + 1);
    }
  }
  return [...counts.entries()]
    .map(([code, count]) => ({ code, count }))
    .sort((a, b) => b.count - a.count)
    .slice(0, limit);
}

export type Summary = {
  total: number;
  withPhone: number;
  withEmail: number;
  withOrg: number;
  withAddress: number;
  withBirthday: number;
};

export function summarize(contacts: Contact[]): Summary {
  let withPhone = 0;
  let withEmail = 0;
  let withOrg = 0;
  let withAddress = 0;
  let withBirthday = 0;
  for (const c of contacts) {
    if (c.phones.length > 0) withPhone++;
    if (c.emails.length > 0) withEmail++;
    if (c.organization) withOrg++;
    if (c.addresses.length > 0) withAddress++;
    if (c.birthday) withBirthday++;
  }
  return {
    total: contacts.length,
    withPhone,
    withEmail,
    withOrg,
    withAddress,
    withBirthday,
  };
}

export function displayName(c: Contact): string {
  if (c.full_name) return c.full_name;
  const parts = [c.first_name, c.middle_name, c.last_name].filter(Boolean);
  return parts.length ? parts.join(" ") : c.organization ?? "(no name)";
}
