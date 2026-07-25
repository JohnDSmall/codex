import "server-only";
import { supabaseAdmin } from "./supabase-server";
import type { Contact } from "./types";

const CONTACT_COLUMNS = [
  "id",
  "uid",
  "full_name",
  "first_name",
  "last_name",
  "middle_name",
  "prefix",
  "suffix",
  "nickname",
  "organization",
  "job_title",
  "department",
  "phones",
  "emails",
  "addresses",
  "urls",
  "social",
  "related",
  "birthday",
  "anniversary",
  "notes",
  "categories",
  "imported_at",
  "updated_at",
  "strength_tier",
  "priority",
  "follow_up_fl",
  "last_contact_date",
  "target_contact_date",
  "contact_frequency",
  "reminders",
  "timeline_notes",
  "tracked",
  "linkedin",
  "primary_company",
  "company_tags",
  "connection_tags",
  "interest_tags",
  "university_tags",
  "connection_source",
  "looking_for",
  "added_date",
].join(",");

export async function loadAllContacts(): Promise<Contact[]> {
  const all: Contact[] = [];
  const pageSize = 1000;
  let from = 0;
  while (true) {
    const { data, error } = await supabaseAdmin
      .from("contacts")
      .select(CONTACT_COLUMNS)
      .order("full_name", { ascending: true, nullsFirst: false })
      .range(from, from + pageSize - 1);
    if (error) throw error;
    if (!data || data.length === 0) break;
    all.push(...(data as unknown as Contact[]));
    if (data.length < pageSize) break;
    from += pageSize;
  }
  return all;
}

export async function loadContactById(id: string): Promise<Contact | null> {
  const { data, error } = await supabaseAdmin
    .from("contacts")
    .select(CONTACT_COLUMNS)
    .eq("id", id)
    .single();
  if (error) {
    if (error.code === "PGRST116") return null;
    throw error;
  }
  return data as unknown as Contact;
}
