import Link from "next/link";
import { Plus } from "lucide-react";
import { loadProjectsWithTotals } from "@/lib/projects-server";
import { ProjectsList } from "../components/ProjectsList";

export const dynamic = "force-dynamic";

export default async function ProjectsPage() {
  const { projects, linksMissing } = await loadProjectsWithTotals();
  const hours = projects.reduce((s, p) => s + p.totals.hoursLogged, 0);
  const revenue = projects.reduce((s, p) => s + p.totals.revenueLinked, 0);

  return (
    <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 py-8 space-y-6">
      <header className="flex items-end justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-2xl font-semibold">Projects</h1>
          <p className="text-sm text-neutral-500">
            {projects.length} projects
            {!linksMissing && (
              <>
                {" · "}
                <span className="tabular-nums">{hours.toFixed(1)}</span> hours logged{" · "}
                <span className="tabular-nums">
                  {revenue.toLocaleString(undefined, {
                    style: "currency",
                    currency: "USD",
                    maximumFractionDigits: 0,
                  })}
                </span>{" "}
                collected
              </>
            )}
          </p>
        </div>
        <Link
          href="/projects/new"
          className="inline-flex items-center gap-1.5 rounded-lg bg-indigo-600 hover:bg-indigo-500 px-3 py-2 text-sm font-medium text-white"
        >
          <Plus className="w-4 h-4" /> New project
        </Link>
      </header>

      {linksMissing && (
        <div className="rounded-xl border border-amber-300 dark:border-amber-500/40 bg-amber-50 dark:bg-amber-500/10 px-4 py-3 text-sm text-amber-800 dark:text-amber-200">
          <strong className="font-medium">Migration pending.</strong> Apply{" "}
          <code className="text-xs">supabase/migrations/20260802120000_project_links.sql</code> to
          link hours and revenue to projects. Until then these totals read zero — the underlying
          hour and income rows are untouched.
        </div>
      )}

      <ProjectsList projects={projects} />
    </div>
  );
}
