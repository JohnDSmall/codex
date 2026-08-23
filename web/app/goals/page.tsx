import Link from "next/link";
import { Plus } from "lucide-react";
import { computeProgress, loadGoalsWithEntries } from "@/lib/goals-server";
import { addEntry } from "@/lib/goals-actions";
import { GoalsList, type GoalRow } from "../components/GoalsList";

export const dynamic = "force-dynamic";

export default async function GoalsPage() {
  const today = new Date().toISOString().slice(0, 10);
  const { goals, entries, tableMissing } = await loadGoalsWithEntries(today);

  const byGoal = new Map<string, typeof entries>();
  for (const e of entries) {
    const list = byGoal.get(e.goal_id);
    if (list) list.push(e);
    else byGoal.set(e.goal_id, [e]);
  }

  const rows: GoalRow[] = goals.map((g) => ({
    goal: g,
    progress: computeProgress(g, byGoal.get(g.id) ?? [], today),
    entryCount: byGoal.get(g.id)?.length ?? 0,
  }));

  const active = rows.filter((r) => r.goal.status === "active");
  const onTrack = active.filter((r) => r.progress.pace === "on_track").length;

  return (
    <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 py-8 space-y-6">
      <header className="flex items-end justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-2xl font-semibold">Goals</h1>
          <p className="text-sm text-neutral-500">
            {tableMissing ? (
              "Migration pending"
            ) : (
              <>
                {active.length} active · {onTrack} on track · {goals.length} total ·{" "}
                {entries.length.toLocaleString()} logged entries
              </>
            )}
          </p>
        </div>
        <Link
          href="/goals/new"
          className="inline-flex items-center gap-1.5 rounded-lg bg-indigo-600 hover:bg-indigo-500 px-3 py-2 text-sm font-medium text-white"
        >
          <Plus className="w-4 h-4" /> New goal
        </Link>
      </header>

      {tableMissing ? (
        <div className="rounded-xl border border-amber-300 dark:border-amber-500/40 bg-amber-50 dark:bg-amber-500/10 px-4 py-3 text-sm text-amber-800 dark:text-amber-200">
          <strong className="font-medium">Migration pending.</strong> Apply{" "}
          <code className="text-xs">supabase/migrations/20260823120000_goals.sql</code> in the Supabase
          SQL editor to create the <code className="text-xs">goals</code> and{" "}
          <code className="text-xs">goal_entries</code> tables.
        </div>
      ) : (
        <GoalsList rows={rows} today={today} addEntry={addEntry} />
      )}
    </div>
  );
}
