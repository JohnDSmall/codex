import "server-only";
import { supabaseAdmin } from "./supabase-server";
import { ACTIVITY_CATEGORIES, type Activity } from "./planner";

export * from "./planner";

function isMissingTable(error: { code?: string; message?: string } | null): boolean {
  if (!error) return false;
  return (
    error.code === "PGRST205" ||
    error.code === "42P01" ||
    /planner_activities/.test(error.message ?? "")
  );
}

/**
 * Every activity. Personal scale — hundreds of rows, one query. Returns
 * `tableMissing: true` instead of throwing until the planner migration runs,
 * so /planner banners rather than 500s (house rule).
 */
export async function loadActivities(): Promise<{ activities: Activity[]; tableMissing: boolean }> {
  const { data, error } = await supabaseAdmin
    .from("planner_activities")
    .select("id, title, category, start_date, end_date, note")
    .order("start_date", { ascending: true });
  if (error) {
    if (isMissingTable(error)) return { activities: [], tableMissing: true };
    throw error;
  }
  const activities = ((data ?? []) as Record<string, unknown>[]).map((r) => ({
    id: String(r.id),
    title: String(r.title ?? ""),
    category: (ACTIVITY_CATEGORIES as readonly string[]).includes(String(r.category))
      ? (r.category as Activity["category"])
      : "misc",
    start_date: String(r.start_date),
    end_date: String(r.end_date),
    note: (r.note as string | null) ?? null,
  }));
  return { activities, tableMissing: false };
}
