"use server";

import { revalidatePath } from "next/cache";
import { supabaseAdmin } from "./supabase-server";
import { ACTIVITY_CATEGORIES } from "./planner";

const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;

function activityFromForm(fd: FormData) {
  const title = String(fd.get("title") ?? "").trim();
  if (!title) throw new Error("Title is required.");

  const category = String(fd.get("category") ?? "").trim();
  if (!(ACTIVITY_CATEGORIES as readonly string[]).includes(category)) throw new Error("Invalid category.");

  const start_date = String(fd.get("start_date") ?? "").trim();
  let end_date = String(fd.get("end_date") ?? "").trim() || start_date;
  if (!ISO_DATE.test(start_date) || !ISO_DATE.test(end_date)) throw new Error("Valid dates are required.");
  if (end_date < start_date) end_date = start_date;

  const note = String(fd.get("note") ?? "").trim() || null;
  return { title, category, start_date, end_date, note };
}

export async function createActivity(formData: FormData) {
  const row = activityFromForm(formData);
  const { error } = await supabaseAdmin.from("planner_activities").insert(row);
  if (error) throw new Error(error.message);
  revalidatePath("/planner");
}

export async function updateActivity(id: string, formData: FormData) {
  const row = activityFromForm(formData);
  const { error } = await supabaseAdmin
    .from("planner_activities")
    .update({ ...row, updated_at: new Date().toISOString() })
    .eq("id", id);
  if (error) throw new Error(error.message);
  revalidatePath("/planner");
}

export async function deleteActivity(id: string) {
  const { error } = await supabaseAdmin.from("planner_activities").delete().eq("id", id);
  if (error) throw new Error(error.message);
  revalidatePath("/planner");
}
