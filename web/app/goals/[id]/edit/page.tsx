import Link from "next/link";
import { notFound } from "next/navigation";
import { loadGoal } from "@/lib/goals-server";
import { updateGoal } from "@/lib/goals-actions";
import { GoalForm } from "../../../components/GoalForm";

export const dynamic = "force-dynamic";

export default async function EditGoalPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const today = new Date().toISOString().slice(0, 10);
  const loaded = await loadGoal(id, today);
  if (!loaded) notFound();
  const { goal } = loaded;
  const action = updateGoal.bind(null, goal.id);

  return (
    <div className="mx-auto max-w-3xl px-4 sm:px-6 lg:px-8 py-8 space-y-6">
      <header>
        <Link href={`/goals/${goal.id}`} className="text-sm text-indigo-600 dark:text-indigo-400 hover:underline">
          ← {goal.title}
        </Link>
        <h1 className="mt-2 text-2xl font-semibold">Edit goal</h1>
      </header>
      <GoalForm action={action} submitLabel="Save changes" defaults={goal} />
    </div>
  );
}
