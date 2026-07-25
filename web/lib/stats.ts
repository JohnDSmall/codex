import type { Contact } from "./types";

export type OrgCount = { name: string; count: number };
export type AreaCodeCount = { code: string; count: number };

export function topOrganizations(contacts: Contact[], limit = 12): OrgCount[] {
  const counts = new Map<string, number>();
  for (const c of contacts) {
    const org = c.organization?.trim();
    if (!org) continue;
    counts.set(org, (counts.get(org) ?? 0) + 1);
  }
  return [...counts.entries()]
    .map(([name, count]) => ({ name, count }))
    .sort((a, b) => b.count - a.count)
    .slice(0, limit);
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
