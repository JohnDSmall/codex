import { loadActivities } from "@/lib/planner-server";
import { createActivity, deleteActivity, updateActivity } from "@/lib/planner-actions";
import { PlannerCalendar } from "../components/PlannerCalendar";

export const dynamic = "force-dynamic";

export default async function PlannerPage() {
  const { activities, tableMissing } = await loadActivities();
  const today = new Date().toISOString().slice(0, 10);

  return (
    <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 py-8 space-y-6">
      <header>
        <h1 className="text-2xl font-semibold">Planner</h1>
        <p className="text-sm text-neutral-500">
          {tableMissing
            ? "Migration pending"
            : `${activities.length} activit${activities.length === 1 ? "y" : "ies"} on the calendar`}
        </p>
      </header>

      {tableMissing ? (
        <div className="rounded-xl border border-amber-300 dark:border-amber-500/40 bg-amber-50 dark:bg-amber-500/10 px-4 py-3 text-sm text-amber-800 dark:text-amber-200">
          <strong className="font-medium">Migration pending.</strong> Apply{" "}
          <code className="text-xs">supabase/migrations/20260830120000_planner.sql</code> in the
          Supabase SQL editor to create <code className="text-xs">planner_activities</code>.
        </div>
      ) : (
        <PlannerCalendar
          activities={activities}
          today={today}
          createActivity={createActivity}
          updateActivity={updateActivity}
          deleteActivity={deleteActivity}
        />
      )}
    </div>
  );
}
