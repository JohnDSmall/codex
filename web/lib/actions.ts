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
  skill_tags?: string[];
  competency?: number | null;
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
  "skill_tags",
  "competency",
  "university_tags",
  "reminders",
  "timeline_notes",
];

/** Drop exact repeats, preserving order and keeping the first occurrence. */
function dedupe<T>(list: T[]): T[] {
  const seen = new Set<string>();
  const out: T[] = [];
  for (const item of list) {
    const k = typeof item === "string" ? item : JSON.stringify(item);
    if (seen.has(k)) continue;
    seen.add(k);
    out.push(item);
  }
  return out;
}

/**
 * Repeated `timeline_notes` entries reached the database through the legacy
 * relationship merge, whose source JSON contained the same note more than once
 * — one contact showed the same entry four times. Nothing appends here (writes
 * replace the whole array), so de-duplicating on the way in is enough to stop
 * it recurring from any path that goes through these actions.
 */
const DEDUPED_LIST_KEYS = [
  "timeline_notes",
  "reminders",
  "company_tags",
  "connection_tags",
  "interest_tags",
  "skill_tags",
  "university_tags",
] as const;

function normalize(input: EditableContactInput): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const k of EDITABLE_KEYS) {
    if (k in input) {
      const v = input[k];
      // Treat empty strings as null for nullable text columns
      if (typeof v === "string" && v.trim() === "") {
        out[k] = null;
      } else if (Array.isArray(v) && (DEDUPED_LIST_KEYS as readonly string[]).includes(k)) {
        out[k] = dedupe(v as unknown[]);
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
