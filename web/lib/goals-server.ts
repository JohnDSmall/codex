import "server-only";
import { supabaseAdmin } from "./supabase-server";
import {
  type Goal,
  type GoalEntry,
  type GoalStatus,
  GOAL_CATEGORIES,
  GOAL_STATUSES,
} from "./goals";

export * from "./goals";

const num = (v: unknown): number => (v == null ? 0 : Number(v));

function rowToGoal(r: Record<string, unknown>): Goal {
  return {
    id: String(r.id),
    title: String(r.title ?? ""),
    category: (GOAL_CATEGORIES as readonly string[]).includes(String(r.category))
      ? (r.category as Goal["category"])
      : "misc",
    status: (GOAL_STATUSES as readonly string[]).includes(String(r.status))
      ? (r.status as GoalStatus)
      : "pending",
    measure: r.measure === "absolute" ? "absolute" : "cumulative",
    direction: r.direction === "at_most" ? "at_most" : "at_least",
    target: num(r.target),
    start_value: num(r.start_value),
    unit: (r.unit as string | null) ?? null,
    start_date: String(r.start_date),
    end_date: String(r.end_date),
    notes: (r.notes as string | null) ?? null,
    source: (r.source as string | null) ?? null,
    completed_at: (r.completed_at as string | null) ?? null,
    created_at: String(r.created_at ?? ""),
  };
}

function rowToEntry(r: Record<string, unknown>): GoalEntry {
  return {
    id: String(r.id),
    goal_id: String(r.goal_id),
    entry_date: String(r.entry_date),
    value: num(r.value),
    note: (r.note as string | null) ?? null,
    created_at: String(r.created_at ?? ""),
  };
}

/** True when the error means the migration hasn't been applied yet. */
function isMissingTable(error: { code?: string; message?: string } | null): boolean {
  if (!error) return false;
  return (
    error.code === "PGRST205" ||
    error.code === "42P01" ||
    /goal_entries|goals/.test(error.message ?? "")
  );
}

/**
 * Every goal plus every entry. Returns `tableMissing: true` instead of throwing
 * when the goals migration hasn't run, so /goals renders a banner rather than
 * a 500 (same rule as /wealth and /projects).
 *
 * Also auto-completes: any `active` goal whose end_date is already past is
 * flipped to `completed` here, in the DB and in the returned list, so the
 * lifecycle never needs a manual "mark done" for goals that simply ran out of
 * calendar.
 */
export async function loadGoalsWithEntries(today: string): Promise<{
  goals: Goal[];
  entries: GoalEntry[];
  tableMissing: boolean;
}> {
  const { data, error } = await supabaseAdmin
    .from("goals")
    .select("*")
    .order("end_date", { ascending: true })
    .order("title", { ascending: true });
  if (error) {
    if (isMissingTable(error)) return { goals: [], entries: [], tableMissing: true };
    throw error;
  }
  let goals = ((data ?? []) as Record<string, unknown>[]).map(rowToGoal);
  goals = await autoCompleteExpired(goals, today);

  const entries = await loadAllEntries();
  return { goals, entries, tableMissing: false };
}

async function loadAllEntries(): Promise<GoalEntry[]> {
  const out: GoalEntry[] = [];
  const pageSize = 1000;
  for (let from = 0; ; from += pageSize) {
    const { data, error } = await supabaseAdmin
      .from("goal_entries")
      .select("*")
      .order("entry_date", { ascending: true })
      .order("created_at", { ascending: true })
      .range(from, from + pageSize - 1);
    if (error) throw error;
    const batch = (data ?? []) as Record<string, unknown>[];
    out.push(...batch.map(rowToEntry));
    if (batch.length < pageSize) return out;
  }
}

export async function loadGoal(
  id: string,
  today: string,
): Promise<{ goal: Goal; entries: GoalEntry[] } | null> {
  const { data, error } = await supabaseAdmin.from("goals").select("*").eq("id", id).maybeSingle();
  if (error) {
    if (isMissingTable(error)) return null;
    throw error;
  }
  if (!data) return null;
  const [goal] = await autoCompleteExpired([rowToGoal(data as Record<string, unknown>)], today);

  const { data: rows, error: eErr } = await supabaseAdmin
    .from("goal_entries")
    .select("*")
    .eq("goal_id", id)
    .order("entry_date", { ascending: true })
    .order("created_at", { ascending: true });
  if (eErr) throw eErr;
  return { goal, entries: ((rows ?? []) as Record<string, unknown>[]).map(rowToEntry) };
}

/** Flip `active` goals whose end_date < today to `completed`, in DB and in memory. */
async function autoCompleteExpired(goals: Goal[], today: string): Promise<Goal[]> {
  const expired = goals.filter((g) => g.status === "active" && g.end_date < today);
  if (expired.length === 0) return goals;
  const ids = expired.map((g) => g.id);
  const { error } = await supabaseAdmin
    .from("goals")
    .update({ status: "completed", updated_at: new Date().toISOString() })
    .in("id", ids)
    .eq("status", "active");
  if (error) throw error;
  // completed_at = the goal's own end_date, set per row.
  for (const g of expired) {
    await supabaseAdmin.from("goals").update({ completed_at: g.end_date }).eq("id", g.id).is("completed_at", null);
  }
  const set = new Set(ids);
  return goals.map((g) => (set.has(g.id) ? { ...g, status: "completed", completed_at: g.completed_at ?? g.end_date } : g));
}
