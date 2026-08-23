"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { supabaseAdmin } from "./supabase-server";
import { GOAL_CATEGORIES, GOAL_STATUSES } from "./goals";

const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;

function str(fd: FormData, key: string): string {
  return String(fd.get(key) ?? "").trim();
}

function parseNum(raw: string, label: string): number {
  const n = Number(raw.replace(/[,\s]/g, ""));
  if (!Number.isFinite(n)) throw new Error(`${label} must be a number.`);
  return n;
}

function goalPatchFromForm(fd: FormData) {
  const title = str(fd, "title");
  if (!title) throw new Error("Title is required.");

  const category = str(fd, "category");
  if (!(GOAL_CATEGORIES as readonly string[]).includes(category)) throw new Error("Invalid category.");

  const status = str(fd, "status") || "pending";
  if (!(GOAL_STATUSES as readonly string[]).includes(status)) throw new Error("Invalid status.");

  const measure = str(fd, "measure") === "absolute" ? "absolute" : "cumulative";
  const direction = str(fd, "direction") === "at_most" ? "at_most" : "at_least";

  const start_date = str(fd, "start_date");
  const end_date = str(fd, "end_date");
  if (!ISO_DATE.test(start_date) || !ISO_DATE.test(end_date)) throw new Error("Start and end dates are required.");
  if (end_date < start_date) throw new Error("End date must be on or after the start date.");

  const target = parseNum(str(fd, "target") || "", "Target");
  const start_value = parseNum(str(fd, "start_value") || "0", "Starting value");

  return {
    title,
    category,
    status,
    measure,
    direction,
    target,
    start_value,
    unit: str(fd, "unit") || null,
    start_date,
    end_date,
    notes: str(fd, "notes") || null,
  };
}

function revalidateGoals(id?: string) {
  revalidatePath("/goals");
  if (id) revalidatePath(`/goals/${id}`);
}

export async function createGoal(formData: FormData) {
  const patch = goalPatchFromForm(formData);
  const { data, error } = await supabaseAdmin.from("goals").insert(patch).select("id").single();
  if (error) throw new Error(error.message);
  revalidateGoals();
  redirect(`/goals/${(data as { id: string }).id}`);
}

export async function updateGoal(id: string, formData: FormData) {
  const patch = goalPatchFromForm(formData);
  const { error } = await supabaseAdmin
    .from("goals")
    .update({ ...patch, updated_at: new Date().toISOString() })
    .eq("id", id);
  if (error) throw new Error(error.message);
  revalidateGoals(id);
  redirect(`/goals/${id}`);
}

export async function setGoalStatus(id: string, status: string) {
  if (!(GOAL_STATUSES as readonly string[]).includes(status)) throw new Error("Invalid status.");
  const patch: Record<string, unknown> = { status, updated_at: new Date().toISOString() };
  if (status === "completed") patch.completed_at = new Date().toISOString().slice(0, 10);
  else patch.completed_at = null;
  const { error } = await supabaseAdmin.from("goals").update(patch).eq("id", id);
  if (error) throw new Error(error.message);
  revalidateGoals(id);
}

export async function deleteGoal(id: string) {
  // Entries cascade via the FK.
  const { error } = await supabaseAdmin.from("goals").delete().eq("id", id);
  if (error) throw new Error(error.message);
  revalidateGoals();
  redirect("/goals");
}

/** Log one increment (or one reading, for absolute goals). Timestamped by created_at. */
export async function addEntry(goalId: string, formData: FormData) {
  const entry_date = str(formData, "entry_date");
  if (!ISO_DATE.test(entry_date)) throw new Error("A valid date is required.");
  const value = parseNum(str(formData, "value"), "Value");
  const note = str(formData, "note") || null;

  const { error } = await supabaseAdmin
    .from("goal_entries")
    .insert({ goal_id: goalId, entry_date, value, note });
  if (error) throw new Error(error.message);
  revalidateGoals(goalId);
}

export async function deleteEntry(id: string, goalId: string) {
  const { error } = await supabaseAdmin.from("goal_entries").delete().eq("id", id);
  if (error) throw new Error(error.message);
  revalidateGoals(goalId);
}
