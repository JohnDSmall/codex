/**
 * Spending buckets and partner rules, read from the same JSON files that
 * ephemeris/refresh.js uses — so the importer and the UI cannot drift.
 *
 *   lib/rules/categories.json        the 12 buckets and their group
 *   lib/rules/partner-merchants.json shared-card charges that are the partner's
 */
import categories from "./rules/categories.json";
import partner from "./rules/partner-merchants.json";

export type Bucket = { name: string; group: string; note?: string };

export const BUCKETS: Bucket[] = categories.buckets;

/** Old business-chart categories are parked under this parent and hidden from pickers. */
export const LEGACY_PARENT = "Legacy";

const GROUP_OF = new Map(BUCKETS.map((b) => [b.name, b.group]));

/** Roll-up group for a bucket name; legacy or unknown names fall into "Other". */
export function groupOf(bucketName: string | null | undefined): string {
  if (!bucketName) return "Uncategorized";
  return GROUP_OF.get(bucketName) ?? "Other";
}

/** Display order for groups on roll-ups. */
export const GROUP_ORDER = ["Essentials", "Lifestyle", "Work", "Other", "Uncategorized"];

const PARTNER_CARDS = new Set<string>(partner.cards ?? []);
const PARTNER_MERCHANTS = (partner.merchants ?? []).map((m: string) => m.toUpperCase());

export const PARTNER_VENDOR = "Partner (shared card)";

/** True when a card charge belongs to the partner's share of a shared card. */
export function isPartnerCharge(card: string, merchant: string | null, description: string): boolean {
  if (!PARTNER_CARDS.has(card) || PARTNER_MERCHANTS.length === 0) return false;
  const hay = `${merchant ?? ""}\n${description}`.toUpperCase();
  return PARTNER_MERCHANTS.some((p) => hay.includes(p));
}
