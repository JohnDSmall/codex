"use server";

import { revalidatePath } from "next/cache";
import { supabaseAdmin } from "./supabase-server";
import { ACTION_CATEGORIES, ACTION_PRIORITIES } from "./action-items";

const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;

function revalidate() {
  revalidatePath("/actions");
  revalidatePath("/planner"); // due badges
}

/** Touch updated_at — every mutation, notes included, counts as an update. */
async function touch(id: string, extra: Record<string, unknown> = {}) {
  const { error } = await supabaseAdmin
    .from("action_items")
    .update({ ...extra, updated_at: new Date().toISOString() })
    .eq("id", id);
  if (error) throw new Error(error.message);
}

export async function createActionItem(formData: FormData) {
  const description = String(formData.get("description") ?? "").trim();
  if (!description) throw new Error("Description is required.");

  const priority = String(formData.get("priority") ?? "medium");
  if (!(ACTION_PRIORITIES as readonly string[]).includes(priority)) throw new Error("Invalid priority.");

  const category = String(formData.get("category") ?? "work");
  if (!(ACTION_CATEGORIES as readonly string[]).includes(category)) throw new Error("Invalid category.");

  const due = String(formData.get("due_date") ?? "").trim();
  const due_date = ISO_DATE.test(due) ? due : null;

  const { error } = await supabaseAdmin
    .from("action_items")
    .insert({ description, priority, category, due_date });
  if (error) throw new Error(error.message);
  revalidate();
}

export async function setActionPriority(id: string, priority: string) {
  if (!(ACTION_PRIORITIES as readonly string[]).includes(priority)) throw new Error("Invalid priority.");
  await touch(id, { priority });
  revalidate();
}

export async function setActionCategory(id: string, category: string) {
  if (!(ACTION_CATEGORIES as readonly string[]).includes(category)) throw new Error("Invalid category.");
  await touch(id, { category });
  revalidate();
}

export async function setActionDueDate(id: string, due: string) {
  await touch(id, { due_date: ISO_DATE.test(due) ? due : null });
  revalidate();
}

export async function setActionDescription(id: string, description: string) {
  const d = description.trim();
  if (!d) throw new Error("Description is required.");
  await touch(id, { description: d });
  revalidate();
}

/** Close (or reopen) an item. */
export async function setActionStatus(id: string, status: string) {
  if (status !== "active" && status !== "completed") throw new Error("Invalid status.");
  await touch(id, {
    status,
    completed_at: status === "completed" ? new Date().toISOString().slice(0, 10) : null,
  });
  revalidate();
}

export async function deleteActionItem(id: string) {
  // Notes cascade via the FK.
  const { error } = await supabaseAdmin.from("action_items").delete().eq("id", id);
  if (error) throw new Error(error.message);
  revalidate();
}

export async function addActionNote(itemId: string, formData: FormData) {
  const content = String(formData.get("content") ?? "").trim();
  if (!content) throw new Error("Note is empty.");
  const { error } = await supabaseAdmin
    .from("action_item_notes")
    .insert({ item_id: itemId, content });
  if (error) throw new Error(error.message);
  await touch(itemId);
  revalidate();
}

export async function deleteActionNote(id: string, itemId: string) {
  const { error } = await supabaseAdmin.from("action_item_notes").delete().eq("id", id);
  if (error) throw new Error(error.message);
  await touch(itemId);
  revalidate();
}
