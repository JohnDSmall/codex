import Link from "next/link";
import { createGoal } from "@/lib/goals-actions";
import { GoalForm } from "../../components/GoalForm";

export default function NewGoalPage() {
  const today = new Date().toISOString().slice(0, 10);
  const endOfYear = `${today.slice(0, 4)}-12-31`;
  return (
    <div className="mx-auto max-w-3xl px-4 sm:px-6 lg:px-8 py-8 space-y-6">
      <header>
        <Link href="/goals" className="text-sm text-indigo-600 dark:text-indigo-400 hover:underline">
          ← Goals
        </Link>
        <h1 className="mt-2 text-2xl font-semibold">New goal</h1>
        <p className="text-sm text-neutral-500">
          Log it as pending for later, or set it active to start tracking now.
        </p>
      </header>
      <GoalForm
        action={createGoal}
        submitLabel="Create goal"
        defaults={{ start_date: today, end_date: endOfYear, status: "pending" }}
      />
    </div>
  );
}
