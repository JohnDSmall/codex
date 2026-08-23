import Link from "next/link";
import { notFound } from "next/navigation";
import { Pencil } from "lucide-react";
import { buildSeries, computeProgress, loadGoal } from "@/lib/goals-server";
import { addEntry, deleteEntry, deleteGoal, setGoalStatus } from "@/lib/goals-actions";
import { GoalDetail } from "../../components/GoalDetail";

export const dynamic = "force-dynamic";

export default async function GoalPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const today = new Date().toISOString().slice(0, 10);
  const loaded = await loadGoal(id, today);
  if (!loaded) notFound();
  const { goal, entries } = loaded;

  const progress = computeProgress(goal, entries, today);
  const series = buildSeries(goal, entries, today);

  return (
    <div className="mx-auto max-w-5xl px-4 sm:px-6 lg:px-8 py-8 space-y-6">
      <header className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <Link href="/goals" className="text-sm text-indigo-600 dark:text-indigo-400 hover:underline">
            ← Goals
          </Link>
          <h1 className="mt-2 text-2xl font-semibold">{goal.title}</h1>
          <p className="text-sm text-neutral-500">
            {goal.start_date} → {goal.end_date}
            {goal.source ? ` · source: ${goal.source}` : ""}
          </p>
        </div>
        <Link
          href={`/goals/${goal.id}/edit`}
          className="inline-flex items-center gap-1.5 rounded-lg border border-neutral-300 dark:border-neutral-700 px-3 py-2 text-sm hover:bg-neutral-50 dark:hover:bg-neutral-800"
        >
          <Pencil className="w-4 h-4" /> Edit
        </Link>
      </header>

      <GoalDetail
        goal={goal}
        entries={[...entries].reverse()}
        progress={progress}
        series={series}
        today={today}
        addEntry={addEntry}
        deleteEntry={deleteEntry}
        setGoalStatus={setGoalStatus}
        deleteGoal={deleteGoal}
      />
    </div>
  );
}
