import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, Clock, DollarSign, Pencil, Target, Users } from "lucide-react";
import { loadProjectDetail } from "@/lib/projects-server";
import { ProjectHoursPanel } from "../../components/ProjectHoursPanel";
import { ProjectIncomePanel } from "../../components/ProjectIncomePanel";
import { DeleteProjectButton } from "../../components/DeleteProjectButton";

export const dynamic = "force-dynamic";

const money = (n: number) =>
  n.toLocaleString(undefined, { style: "currency", currency: "USD", maximumFractionDigits: 0 });

function fmtDate(d: string | null): string | null {
  if (!d) return null;
  try {
    return new Date(d + "T00:00:00").toLocaleDateString(undefined, {
      month: "short",
      day: "numeric",
      year: "numeric",
    });
  } catch {
    return d;
  }
}

function statusClass(s: string): string {
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

function Kpi({
  label,
  icon,
  value,
  sub,
  pct,
}: {
  label: string;
  icon: React.ReactNode;
  value: string;
  sub?: string | null;
  pct?: number | null;
}) {
  return (
    <div className="rounded-xl border border-neutral-200 dark:border-neutral-800 bg-white dark:bg-neutral-900 p-4">
      <div className="flex items-center gap-1.5 text-xs text-neutral-500">
        {icon}
        {label}
      </div>
      <div className="mt-1 text-2xl font-semibold tabular-nums">{value}</div>
      {sub ? <div className="text-xs text-neutral-500 mt-0.5">{sub}</div> : null}
      {typeof pct === "number" ? (
        <div className="mt-2 h-1.5 w-full rounded-full bg-neutral-100 dark:bg-neutral-800 overflow-hidden">
          <div className="h-full bg-indigo-500" style={{ width: `${Math.min(100, pct)}%` }} />
        </div>
      ) : null}
    </div>
  );
}

export default async function ProjectDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const detail = await loadProjectDetail(id);
  if (!detail) notFound();

  const { project: p, totals, hours, income, unlinkedIncome, linksMissing } = detail;
  const remaining = p.estimated_hours - totals.hoursLogged;
  const hoursPct = p.estimated_hours > 0 ? (totals.hoursLogged / p.estimated_hours) * 100 : null;
  const revPct = p.projected_revenue > 0 ? (totals.revenueLinked / p.projected_revenue) * 100 : null;
  // Pre-link figures kept on the row; shown only where the log has nothing to say.
  const legacyHours = totals.hourEntries === 0 && Number(p.hours_spent) > 0 ? Number(p.hours_spent) : null;
  const legacyRevenue = totals.incomeEntries === 0 && Number(p.revenue) > 0 ? Number(p.revenue) : null;

  return (
    <div className="mx-auto max-w-5xl px-4 sm:px-6 lg:px-8 py-8 space-y-6">
      <Link
        href="/projects"
        className="inline-flex items-center gap-1.5 text-sm text-neutral-500 hover:text-neutral-800 dark:hover:text-neutral-200"
      >
        <ArrowLeft className="w-4 h-4" /> All projects
      </Link>

      <header className="flex items-start justify-between gap-4 flex-wrap">
        <div className="min-w-0">
          <h1 className="text-2xl font-semibold">{p.name}</h1>
          <div className="mt-1 flex items-center gap-2 flex-wrap text-sm text-neutral-500">
            {p.client ? <span>{p.client}</span> : null}
            <span className={`rounded-full px-2 py-0.5 text-xs font-medium capitalize ${statusClass(p.status)}`}>
              {p.status.replace("_", " ")}
            </span>
            <span className="text-xs capitalize">{p.priority} priority</span>
            {fmtDate(p.start_date) || fmtDate(p.due_date) ? (
              <span className="text-xs">
                {fmtDate(p.start_date) ?? "?"} → {fmtDate(p.due_date) ?? "?"}
              </span>
            ) : null}
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Link
            href={`/projects/${p.id}/edit`}
            className="inline-flex items-center gap-1.5 rounded-lg bg-indigo-600 hover:bg-indigo-500 px-3 py-2 text-sm font-medium text-white"
          >
            <Pencil className="w-4 h-4" /> Edit
          </Link>
          <DeleteProjectButton id={p.id} name={p.name} />
        </div>
      </header>

      {linksMissing && (
        <div className="rounded-xl border border-amber-300 dark:border-amber-500/40 bg-amber-50 dark:bg-amber-500/10 px-4 py-3 text-sm text-amber-800 dark:text-amber-200">
          <strong className="font-medium">Migration pending.</strong> Hours and revenue can&apos;t be
          linked to projects until{" "}
          <code className="text-xs">20260802120000_project_links.sql</code> is applied. Totals below
          read zero and the logging controls are hidden until then.
        </div>
      )}

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <Kpi
          label="Hours logged"
          icon={<Clock className="w-3.5 h-3.5" />}
          value={totals.hoursLogged.toFixed(1)}
          sub={
            p.estimated_hours > 0
              ? `of ${p.estimated_hours} estimated · ${remaining.toFixed(1)} left`
              : `${totals.hourEntries} entries`
          }
          pct={hoursPct}
        />
        <Kpi
          label="Revenue collected"
          icon={<DollarSign className="w-3.5 h-3.5" />}
          value={money(totals.revenueLinked)}
          sub={
            p.projected_revenue > 0
              ? `of ${money(p.projected_revenue)} projected`
              : `${totals.incomeEntries} linked rows`
          }
          pct={revPct}
        />
        <Kpi
          label="Cost"
          icon={<Target className="w-3.5 h-3.5" />}
          value={money(Number(p.cost))}
          sub={totals.revenueLinked ? `margin ${money(totals.revenueLinked - Number(p.cost))}` : null}
        />
        <Kpi
          label="Actions"
          icon={<Users className="w-3.5 h-3.5" />}
          value={`${p.completed_actions} / ${p.total_actions}`}
          sub={p.total_actions > 0 ? `${Math.round((p.completed_actions / p.total_actions) * 100)}% complete` : null}
          pct={p.total_actions > 0 ? (p.completed_actions / p.total_actions) * 100 : null}
        />
      </div>

      {(legacyHours || legacyRevenue) && !linksMissing && (
        <p className="text-xs text-neutral-500">
          Recorded on this project before linking existed:{" "}
          {legacyHours ? <span className="tabular-nums">{legacyHours} h</span> : null}
          {legacyHours && legacyRevenue ? " · " : null}
          {legacyRevenue ? <span className="tabular-nums">{money(legacyRevenue)}</span> : null}. Link
          the underlying rows below and this figure becomes redundant.
        </p>
      )}

      {(p.description || p.tags.length > 0 || p.contacts.length > 0) && (
        <section className="rounded-xl border border-neutral-200 dark:border-neutral-800 bg-white dark:bg-neutral-900 p-4 space-y-3">
          {p.description ? (
            <p className="text-sm text-neutral-700 dark:text-neutral-300 whitespace-pre-wrap">
              {p.description}
            </p>
          ) : null}
          {p.tags.length > 0 && (
            <div className="flex flex-wrap gap-1">
              {p.tags.map((t) => (
                <span key={t} className="rounded-full bg-neutral-100 dark:bg-neutral-800 px-2 py-0.5 text-[11px]">
                  {t}
                </span>
              ))}
            </div>
          )}
          {p.contacts.length > 0 && (
            <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-neutral-600 dark:text-neutral-400">
              {p.contacts.map((c, i) => (
                <span key={i}>
                  <span className="font-medium text-neutral-800 dark:text-neutral-200">{c.name}</span>
                  {c.role ? ` · ${c.role}` : ""}
                  {c.email ? (
                    <>
                      {" · "}
                      <a href={`mailto:${c.email}`} className="text-indigo-600 dark:text-indigo-400 hover:underline">
                        {c.email}
                      </a>
                    </>
                  ) : null}
                </span>
              ))}
            </div>
          )}
        </section>
      )}

      <ProjectHoursPanel
        projectId={p.id}
        client={p.client}
        entries={hours}
        disabled={linksMissing}
      />

      <ProjectIncomePanel
        projectId={p.id}
        client={p.client}
        entries={income}
        unlinked={unlinkedIncome}
        disabled={linksMissing}
      />
    </div>
  );
}
