import { Calendar, Clock, DollarSign, Users } from "lucide-react";
import type { Project } from "@/lib/projects-server";

function fmtMoney(n: number): string {
  if (!n) return "$0";
  if (Math.abs(n) >= 1000) {
    return "$" + (n / 1000).toFixed(n >= 10000 ? 0 : 1) + "k";
  }
  return "$" + n.toLocaleString();
}

function fmtDate(d: string | null): string | null {
  if (!d) return null;
  try {
    return new Date(d + "T00:00:00").toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" });
  } catch {
    return d;
  }
}

function statusBadgeClass(s: Project["status"]): string {
  switch (s) {
    case "active":
      return "bg-emerald-100 text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-300";
    case "completed":
      return "bg-indigo-100 text-indigo-700 dark:bg-indigo-500/15 dark:text-indigo-300";
    case "on_hold":
      return "bg-amber-100 text-amber-700 dark:bg-amber-500/15 dark:text-amber-300";
    case "abandoned":
      return "bg-rose-100 text-rose-700 dark:bg-rose-500/15 dark:text-rose-300";
    default:
      return "bg-neutral-100 text-neutral-700 dark:bg-neutral-800 dark:text-neutral-300";
  }
}

function priorityClass(p: string): string {
  const v = p.toLowerCase();
  if (v === "high") return "text-rose-600 dark:text-rose-300";
  if (v === "medium") return "text-amber-600 dark:text-amber-300";
  return "text-neutral-500";
}

export function ProjectCard({ project }: { project: Project }) {
  const due = fmtDate(project.due_date);
  const actionPct =
    project.total_actions > 0
      ? Math.round((project.completed_actions / project.total_actions) * 100)
      : 0;
  const hoursPct =
    project.estimated_hours > 0
      ? Math.min(100, Math.round((project.hours_spent / project.estimated_hours) * 100))
      : 0;
  return (
    <div className="h-full rounded-xl border border-neutral-200 dark:border-neutral-800 bg-white dark:bg-neutral-900 p-4 hover:border-neutral-300 dark:hover:border-neutral-700 hover:shadow-sm transition-all">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <h3 className="font-semibold leading-tight truncate">{project.name}</h3>
          {project.client && (
            <div className="text-xs text-neutral-500 mt-0.5 truncate">{project.client}</div>
          )}
        </div>
        <div className="flex flex-col items-end gap-1 shrink-0">
          <span className={`rounded-full px-2 py-0.5 text-xs font-medium capitalize ${statusBadgeClass(project.status)}`}>
            {project.status.replace("_", " ")}
          </span>
          <span className={`text-xs capitalize ${priorityClass(project.priority)}`}>
            {project.priority} priority
          </span>
        </div>
      </div>

      {project.description && (
        <p className="mt-3 text-sm text-neutral-600 dark:text-neutral-400 line-clamp-2">
          {project.description}
        </p>
      )}

      <dl className="mt-3 grid grid-cols-2 gap-x-3 gap-y-2 text-xs">
        <div>
          <dt className="text-neutral-500 flex items-center gap-1"><DollarSign className="w-3 h-3" /> Revenue</dt>
          <dd className="font-medium tabular-nums">
            {fmtMoney(project.revenue)}
            {project.projected_revenue > project.revenue && (
              <span className="text-neutral-400"> / {fmtMoney(project.projected_revenue)}</span>
            )}
          </dd>
        </div>
        <div>
          <dt className="text-neutral-500 flex items-center gap-1"><Clock className="w-3 h-3" /> Hours</dt>
          <dd className="font-medium tabular-nums">
            {project.hours_spent}
            {project.estimated_hours > 0 && (
              <span className="text-neutral-400"> / {project.estimated_hours}</span>
            )}
          </dd>
        </div>
        {due && (
          <div className="col-span-2">
            <dt className="text-neutral-500 flex items-center gap-1"><Calendar className="w-3 h-3" /> Due</dt>
            <dd className="font-medium">{due}</dd>
          </div>
        )}
      </dl>

      {project.estimated_hours > 0 && (
        <div className="mt-3">
          <div className="h-1.5 w-full rounded-full bg-neutral-100 dark:bg-neutral-800 overflow-hidden">
            <div
              className="h-full bg-indigo-500"
              style={{ width: `${hoursPct}%` }}
            />
          </div>
          <div className="mt-1 text-[10px] text-neutral-500 tabular-nums">
            {hoursPct}% of estimated hours
          </div>
        </div>
      )}

      {project.total_actions > 0 && (
        <div className="mt-2 text-[10px] text-neutral-500 tabular-nums">
          {project.completed_actions} / {project.total_actions} actions ({actionPct}%)
        </div>
      )}

      {(project.tags.length > 0 || project.contacts.length > 0) && (
        <div className="mt-3 pt-3 border-t border-neutral-100 dark:border-neutral-800 space-y-2">
          {project.tags.length > 0 && (
            <div className="flex flex-wrap gap-1">
              {project.tags.map((t) => (
                <span key={t} className="rounded-full bg-neutral-100 dark:bg-neutral-800 px-2 py-0.5 text-[11px]">
                  {t}
                </span>
              ))}
            </div>
          )}
          {project.contacts.length > 0 && (
            <div className="flex items-center gap-1.5 text-xs text-neutral-500">
              <Users className="w-3 h-3" />
              <span className="truncate">
                {project.contacts.map((c) => c.name).filter(Boolean).join(", ")}
              </span>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
