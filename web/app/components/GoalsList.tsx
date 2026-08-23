"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { AlertTriangle } from "lucide-react";
import {
  CATEGORY_LABEL,
  GOAL_CATEGORIES,
  PACE_LABEL,
  STATUS_LABEL,
  fmtNum,
  paceClass,
  type Goal,
  type GoalCategory,
  type GoalProgress,
  type GoalStatus,
} from "@/lib/goals";

export type GoalRow = { goal: Goal; progress: GoalProgress; entryCount: number };

type StatusFilter = GoalStatus | "all";

export function GoalsList({ rows, today }: { rows: GoalRow[]; today: string }) {
  const [status, setStatus] = useState<StatusFilter>("active");
  const [category, setCategory] = useState<GoalCategory | "all">("all");

  const counts = useMemo(() => {
    const c: Record<string, number> = { all: rows.length };
    for (const r of rows) c[r.goal.status] = (c[r.goal.status] ?? 0) + 1;
    return c;
  }, [rows]);

  const filtered = useMemo(
    () =>
      rows.filter(
        (r) =>
          (status === "all" || r.goal.status === status) &&
          (category === "all" || r.goal.category === category),
      ),
    [rows, status, category],
  );

  const grouped = useMemo(() => {
    const m = new Map<GoalCategory, GoalRow[]>();
    for (const c of GOAL_CATEGORIES) m.set(c, []);
    for (const r of filtered) m.get(r.goal.category)!.push(r);
    // Worst pace first inside a category, then soonest deadline.
    const rank = { off_track: 0, ended: 0, at_risk: 1, not_started: 2, on_track: 3 } as const;
    for (const list of m.values()) {
      list.sort(
        (a, b) =>
          rank[a.progress.pace] - rank[b.progress.pace] ||
          a.goal.end_date.localeCompare(b.goal.end_date),
      );
    }
    return m;
  }, [filtered]);

  const endingSoon = filtered.filter((r) => r.progress.endingSoon);

  return (
    <>
      <div className="rounded-xl border border-neutral-200 dark:border-neutral-800 bg-white dark:bg-neutral-900 p-3 flex flex-wrap items-center gap-2">
        {(["active", "pending", "paused", "completed", "deprecated", "all"] as StatusFilter[]).map((s) => (
          <button
            key={s}
            onClick={() => setStatus(s)}
            className={`rounded-lg px-3 py-1.5 text-sm border ${
              status === s
                ? "bg-indigo-600 border-indigo-600 text-white"
                : "border-neutral-300 dark:border-neutral-700 hover:bg-neutral-50 dark:hover:bg-neutral-800"
            }`}
          >
            {s === "all" ? "All" : STATUS_LABEL[s]}{" "}
            <span className={`tabular-nums ${status === s ? "text-indigo-200" : "text-neutral-400"}`}>
              {counts[s] ?? 0}
            </span>
          </button>
        ))}
        <select
          value={category}
          onChange={(e) => setCategory(e.target.value as GoalCategory | "all")}
          className="ml-auto rounded-lg border border-neutral-300 dark:border-neutral-700 bg-white dark:bg-neutral-900 px-3 py-1.5 text-sm outline-none focus:border-indigo-500"
        >
          <option value="all">All categories</option>
          {GOAL_CATEGORIES.map((c) => (
            <option key={c} value={c}>{CATEGORY_LABEL[c]}</option>
          ))}
        </select>
      </div>

      {endingSoon.length > 0 && (
        <div className="rounded-xl border border-amber-300 dark:border-amber-500/40 bg-amber-50 dark:bg-amber-500/10 px-4 py-3 text-sm text-amber-800 dark:text-amber-200 flex items-start gap-2">
          <AlertTriangle className="w-4 h-4 mt-0.5 shrink-0" />
          <div>
            <strong className="font-medium">Deadline coming up:</strong>{" "}
            {endingSoon.map((r, i) => (
              <span key={r.goal.id}>
                {i > 0 && ", "}
                <Link href={`/goals/${r.goal.id}`} className="underline">
                  {r.goal.title}
                </Link>{" "}
                ({r.progress.daysLeft === 0 ? "today" : `${r.progress.daysLeft}d`})
              </span>
            ))}
          </div>
        </div>
      )}

      {filtered.length === 0 ? (
        <div className="rounded-xl border border-neutral-200 dark:border-neutral-800 bg-white dark:bg-neutral-900 p-10 text-center text-neutral-500">
          No {status === "all" ? "" : STATUS_LABEL[status].toLowerCase() + " "}goals
          {category === "all" ? "" : ` in ${CATEGORY_LABEL[category]}`}.
        </div>
      ) : (
        GOAL_CATEGORIES.map((c) => {
          const list = grouped.get(c) ?? [];
          if (list.length === 0) return null;
          return (
            <section key={c} className="space-y-3">
              <h2 className="text-sm font-semibold uppercase tracking-wider text-neutral-500">
                {CATEGORY_LABEL[c]} <span className="text-neutral-400 tabular-nums">{list.length}</span>
              </h2>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                {list.map((r) => (
                  <GoalCard key={r.goal.id} row={r} today={today} />
                ))}
              </div>
            </section>
          );
        })
      )}
    </>
  );
}

export function GoalCard({ row, today }: { row: GoalRow; today: string }) {
  const { goal, progress: p } = row;
  const cls = paceClass(p.pace);
  const pct = Math.min(1, Math.max(0, p.fraction));
  const ratioPct = Math.round(p.ratio * 100);
  const isLive = goal.status === "active";
  const remaining = Math.abs(p.delta);
  const deltaText =
    p.achieved
      ? `target met${p.delta !== 0 ? ` · ${goal.direction === "at_most" ? "under" : "over"} by ${fmtNum(remaining, goal.unit)}` : ""}`
      : `${fmtNum(remaining, goal.unit)} to go`;

  return (
    <Link
      href={`/goals/${goal.id}`}
      className="block rounded-xl border border-neutral-200 dark:border-neutral-800 bg-white dark:bg-neutral-900 p-4 hover:border-indigo-400 dark:hover:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-500"
    >
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <div className="font-medium truncate">{goal.title}</div>
          <div className="text-xs text-neutral-500">
            {goal.start_date} → {goal.end_date}
            {goal.status !== "active" && <> · {STATUS_LABEL[goal.status]}</>}
          </div>
        </div>
        <span className={`shrink-0 rounded-md px-2 py-0.5 text-xs font-medium ${cls.badge}`}>
          {goal.status === "completed" && !p.achieved ? `${Math.round(p.fraction * 100)}%` : PACE_LABEL[p.pace]}
        </span>
      </div>

      <div className="mt-3 h-2 rounded-full bg-neutral-100 dark:bg-neutral-800 overflow-hidden relative">
        <div className={`h-full ${cls.bar}`} style={{ width: `${pct * 100}%` }} />
        {isLive && p.elapsed > 0 && p.elapsed < 1 && goal.direction === "at_least" && (
          <div
            className="absolute top-0 h-full w-0.5 bg-neutral-500/70"
            style={{ left: `${p.elapsed * 100}%` }}
            title="Where you should be today"
          />
        )}
      </div>

      <div className="mt-2 flex items-baseline justify-between gap-2 text-sm">
        <div className="tabular-nums">
          <span className="font-semibold">{fmtNum(p.current)}</span>
          <span className="text-neutral-500"> / {fmtNum(goal.target, goal.unit)}</span>
        </div>
        <div className="text-xs text-neutral-500 tabular-nums text-right">{deltaText}</div>
      </div>

      <div className="mt-1 flex items-center justify-between text-xs text-neutral-500 tabular-nums">
        <span>
          {isLive && p.pace !== "not_started" ? `${ratioPct}% of expected pace` : " "}
        </span>
        <span>
          {isLive
            ? p.daysLeft < 0
              ? "ended"
              : p.daysLeft === 0
                ? "ends today"
                : `${p.daysLeft}d left`
            : p.lastEntryDate
              ? `last entry ${p.lastEntryDate}`
              : today < goal.start_date
                ? "starts " + goal.start_date
                : ""}
        </span>
      </div>
      {p.endingSoon && (
        <div className="mt-2 inline-flex items-center gap-1 text-xs text-amber-700 dark:text-amber-300">
          <AlertTriangle className="w-3 h-3" /> deadline in {p.daysLeft === 0 ? "0 days" : `${p.daysLeft}d`}
        </div>
      )}
    </Link>
  );
}
