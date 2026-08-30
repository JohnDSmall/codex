import "server-only";
import { supabaseAdmin } from "./supabase-server";
import {
  ACTION_CATEGORIES,
  ACTION_PRIORITIES,
  type ActionItem,
  type ActionNote,
} from "./action-items";

export * from "./action-items";

function isMissingTable(error: { code?: string; message?: string } | null): boolean {
  if (!error) return false;
  return (
    error.code === "PGRST205" ||
    error.code === "42P01" ||
    /action_item/.test(error.message ?? "")
  );
}

function rowToItem(r: Record<string, unknown>): ActionItem {
  return {
    id: String(r.id),
    seq: Number(r.seq ?? 0),
    description: String(r.description ?? ""),
    priority: (ACTION_PRIORITIES as readonly string[]).includes(String(r.priority))
      ? (r.priority as ActionItem["priority"])
      : "medium",
    category: (ACTION_CATEGORIES as readonly string[]).includes(String(r.category))
      ? (r.category as ActionItem["category"])
      : "misc",
    status: r.status === "completed" ? "completed" : "active",
    due_date: (r.due_date as string | null) ?? null,
    completed_at: (r.completed_at as string | null) ?? null,
    created_at: String(r.created_at ?? ""),
    updated_at: String(r.updated_at ?? ""),
  };
}

/** All items + all notes; tableMissing instead of a 500 pre-migration (house rule). */
export async function loadActionItems(): Promise<{
  items: ActionItem[];
  notes: ActionNote[];
  tableMissing: boolean;
}> {
  const { data, error } = await supabaseAdmin
    .from("action_items")
    .select("*")
    .order("seq", { ascending: false });
  if (error) {
    if (isMissingTable(error)) return { items: [], notes: [], tableMissing: true };
    throw error;
  }
  const items = ((data ?? []) as Record<string, unknown>[]).map(rowToItem);

  const { data: noteRows, error: nErr } = await supabaseAdmin
    .from("action_item_notes")
    .select("*")
    .order("created_at", { ascending: true });
  if (nErr) throw nErr;
  const notes = ((noteRows ?? []) as Record<string, unknown>[]).map((r) => ({
    id: String(r.id),
    item_id: String(r.item_id),
    content: String(r.content ?? ""),
    created_at: String(r.created_at ?? ""),
  }));

  return { items, notes, tableMissing: false };
}

/** date -> count of ACTIVE items due that day, for the planner calendar badges. */
export async function loadDueCounts(): Promise<Record<string, number>> {
  const { data, error } = await supabaseAdmin
    .from("action_items")
    .select("due_date")
    .eq("status", "active")
    .not("due_date", "is", null);
  if (error) {
    if (isMissingTable(error)) return {};
    throw error;
  }
  const out: Record<string, number> = {};
  for (const r of (data ?? []) as { due_date: string }[]) {
    out[r.due_date] = (out[r.due_date] ?? 0) + 1;
  }
  return out;
}
