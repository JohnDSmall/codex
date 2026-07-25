import type { Contact, StrengthTier } from "./types";

export function displayName(c: Contact): string {
  if (c.full_name) return c.full_name;
  const parts = [c.first_name, c.middle_name, c.last_name].filter(Boolean);
  if (parts.length) return parts.join(" ");
  return c.organization ?? "(no name)";
}

export function primaryCompany(c: Contact): string | null {
  return c.primary_company || c.organization;
}

/** Companies to surface on the card: primary first, then company_tags (from old curated data),
 *  then any iCloud vCard categories as a fallback. */
export function cardCompanies(c: Contact): string[] {
  const list: string[] = [];
  const primary = primaryCompany(c);
  if (primary) list.push(primary);
  for (const t of c.company_tags ?? []) {
    if (t && !list.includes(t)) list.push(t);
  }
  for (const cat of c.categories ?? []) {
    if (cat && !list.includes(cat)) list.push(cat);
  }
  return list;
}

/** Days from today to target_contact_date. Negative = overdue. Null = no target date set.
 *  Note: target_contact_date is the source of truth; follow_up_fl was inconsistently set in the
 *  legacy data, so we don't gate on it. */
export function daysToContact(c: Contact): number | null {
  if (!c.target_contact_date) return null;
  const target = new Date(c.target_contact_date + "T00:00:00");
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  return Math.round((target.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
}

export function strengthLabel(tier: StrengthTier): string {
  return tier === "none" ? "None" : tier.charAt(0).toUpperCase() + tier.slice(1);
}

export function strengthBadgeClass(tier: StrengthTier): string {
  switch (tier) {
    case "strong":
      return "bg-emerald-100 text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-300";
    case "medium":
      return "bg-amber-100 text-amber-700 dark:bg-amber-500/15 dark:text-amber-300";
    case "weak":
      return "bg-orange-100 text-orange-700 dark:bg-orange-500/15 dark:text-orange-300";
    case "loose":
      return "bg-sky-100 text-sky-700 dark:bg-sky-500/15 dark:text-sky-300";
    default:
      return "bg-neutral-100 text-neutral-600 dark:bg-neutral-800 dark:text-neutral-400";
  }
}

export function formatDateLong(d: string | null): string | null {
  if (!d) return null;
  try {
    return new Date(d + "T00:00:00").toLocaleDateString(undefined, {
      year: "numeric",
      month: "short",
      day: "numeric",
    });
  } catch {
    return d;
  }
}

// For full ISO timestamps (e.g. imported_at / updated_at), shows date + time.
export function formatTimestamp(ts: string | null): string | null {
  if (!ts) return null;
  try {
    return new Date(ts).toLocaleString(undefined, {
      year: "numeric",
      month: "short",
      day: "numeric",
      hour: "numeric",
      minute: "2-digit",
    });
  } catch {
    return ts;
  }
}
