"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { supabaseAdmin } from "./supabase-server";

export type EditableContactInput = {
  full_name?: string | null;
  first_name?: string | null;
  last_name?: string | null;
  nickname?: string | null;
  organization?: string | null;
  job_title?: string | null;
  primary_company?: string | null;
  strength_tier?: "strong" | "medium" | "weak" | "loose" | "none";
  priority?: "high" | "medium" | "low";
  tracked?: boolean;
  follow_up_fl?: boolean;
  last_contact_date?: string | null;
  target_contact_date?: string | null;
  contact_frequency?: "weekly" | "monthly" | "quarterly" | "biannually" | "yearly" | null;
  linkedin?: string | null;
  notes?: string | null;
  looking_for?: string | null;
  connection_source?: string | null;
  company_tags?: string[];
  connection_tags?: string[];
  interest_tags?: string[];
  university_tags?: string[];
  reminders?: string[];
  timeline_notes?: { date: string; content: string }[];
};

const EDITABLE_KEYS: (keyof EditableContactInput)[] = [
  "full_name",
  "first_name",
  "last_name",
  "nickname",
  "organization",
  "job_title",
  "primary_company",
  "strength_tier",
  "priority",
  "tracked",
  "follow_up_fl",
  "last_contact_date",
  "target_contact_date",
  "contact_frequency",
  "linkedin",
  "notes",
  "looking_for",
  "connection_source",
  "company_tags",
  "connection_tags",
  "interest_tags",
  "university_tags",
  "reminders",
  "timeline_notes",
];

function normalize(input: EditableContactInput): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const k of EDITABLE_KEYS) {
    if (k in input) {
      const v = input[k];
      // Treat empty strings as null for nullable text columns
      if (typeof v === "string" && v.trim() === "") {
        out[k] = null;
      } else {
        out[k] = v;
      }
    }
  }
  return out;
}

export async function updateContact(id: string, patch: EditableContactInput) {
  const clean = normalize(patch);
  clean.updated_at = new Date().toISOString();
  const { error } = await supabaseAdmin.from("contacts").update(clean).eq("id", id);
  if (error) throw new Error(error.message);
  revalidatePath(`/relationships/${id}`);
  revalidatePath("/relationships");
}

export async function createContact(data: EditableContactInput): Promise<string> {
  const clean = normalize(data);
  if (!clean.full_name) {
    throw new Error("Name is required.");
  }
  // Manual creates default to tracked=true since you wouldn't bother adding otherwise.
  if (!("tracked" in clean)) clean.tracked = true;
  clean.source = "manual";

  const { data: row, error } = await supabaseAdmin
    .from("contacts")
    .insert(clean)
    .select("id")
    .single();
  if (error) throw new Error(error.message);
  revalidatePath("/relationships");
  return (row as { id: string }).id;
}

export async function deleteContact(id: string) {
  const { error } = await supabaseAdmin.from("contacts").delete().eq("id", id);
  if (error) throw new Error(error.message);
  revalidatePath("/relationships");
}

export async function deleteContactAndRedirect(id: string) {
  await deleteContact(id);
  redirect("/relationships");
}

export async function createContactAndRedirect(data: EditableContactInput) {
  const id = await createContact(data);
  redirect(`/relationships/${id}`);
}

export async function updateContactAndRedirect(id: string, patch: EditableContactInput) {
  await updateContact(id, patch);
  redirect(`/relationships/${id}`);
}
