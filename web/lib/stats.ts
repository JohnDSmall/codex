import type { Contact, StrengthTier } from "./types";

export type OrgCount = { name: string; count: number };

/**
 * Companies by how many people are TAGGED with them — `company_tags`, not
 * `primary_company`. Someone who worked at Scale and is now at Handshake AI
 * counts under both, which is the point: the question is "who do I know
 * connected to X", not "who is employed by X today".
 *
 * A person therefore contributes to several rows, so these counts do not sum to
 * the contact total.
 *
 * `organization` is deliberately unused: it is the free-text iCloud import, set
 * on ~134 of 1,193 contacts and full of memo text ("Personal", "Lax", "Michigan
 * Head Coach"). Reading it made the chart report Snorkel at 4 as the top
 * employer.
 */
export function topOrganizations(contacts: Contact[], limit = 12): OrgCount[] {
  const counts = new Map<string, number>();
  for (const c of contacts) {
    for (const raw of c.company_tags ?? []) {
      const tag = raw?.trim();
      if (!tag) continue;
      counts.set(tag, (counts.get(tag) ?? 0) + 1);
    }
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
