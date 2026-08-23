"use client";

import { useMemo, useState, useTransition } from "react";
import Link from "next/link";
import { AlertTriangle, Check, Plus } from "lucide-react";
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
  type Pace,
} from "@/lib/goals";

export type GoalRow = { goal: Goal; progress: GoalProgress; entryCount: number };

type StatusFilter = GoalStatus | "all";

export function GoalsList({
  rows,
  today,
  addEntry,
}: {
  rows: GoalRow[];
  today: string;
  addEntry: (goalId: string, fd: FormData) => Promise<void>;
}) {
  const [status, setStatus] = useState<StatusFilter>("active");
  const [category, setCategory] = useState<GoalCategory | "all">("all");

  const counts = useMemo(() => {
    const c: Record<string, number> = { all: rows.length };
    for (const r of rows) c[r.goal.status] = (c[r.goal.status] ?? 0) + 1;
    return c;
  }, [rows]);

  const statusFiltered = useMemo(
    () => rows.filter((r) => status === "all" || r.goal.status === status),
    [rows, status],
  );

  const filtered = useMemo(
    () => statusFiltered.filter((r) => category === "all" || r.goal.category === category),
    [statusFiltered, category],
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

      <PaceSummary
        rows={statusFiltered}
        statusLabel={status === "all" ? "All" : STATUS_LABEL[status]}
        category={category}
        onCategory={setCategory}
      />

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
                  <GoalCard key={r.goal.id} row={r} today={today} addEntry={addEntry} />
                ))}
              </div>
            </section>
          );
        })
      )}
    </>
  );
}

/** Pace tallies for the current status tab: overall row + one row per category.
 *  Clicking a category row filters the list to it; clicking again clears. */
function PaceSummary({
  rows,
  statusLabel,
  category,
  onCategory,
}: {
  rows: GoalRow[];
  statusLabel: string;
  category: GoalCategory | "all";
  onCategory: (c: GoalCategory | "all") => void;
}) {
  const tally = (list: GoalRow[]) => {
    const t = { total: list.length, on_track: 0, at_risk: 0, off_track: 0, other: 0, achieved: 0 };
    for (const r of list) {
      const p = r.progress.pace;
      if (p === "on_track") t.on_track++;
      else if (p === "at_risk") t.at_risk++;
      else if (p === "off_track" || p === "ended") t.off_track++;
      else t.other++;
      if (r.progress.achieved) t.achieved++;
    }
    return t;
  };

  const overall = tally(rows);
  if (overall.total === 0) return null;

  const line = (t: ReturnType<typeof tally>) => (
    <div className="flex items-center gap-3 text-sm tabular-nums">
      <span className="text-emerald-600 dark:text-emerald-400 font-medium">{t.on_track} on track</span>
      <span className="text-amber-600 dark:text-amber-400 font-medium">{t.at_risk} at risk</span>
      <span className="text-rose-600 dark:text-rose-400 font-medium">{t.off_track} off track</span>
      {t.other > 0 && <span className="text-neutral-400">{t.other} not started</span>}
    </div>
  );

  const bar = (t: ReturnType<typeof tally>) =>
    t.total === 0 ? null : (
      <div className="h-1.5 w-full rounded-full overflow-hidden flex bg-neutral-100 dark:bg-neutral-800">
        <div className="bg-emerald-500" style={{ width: `${(100 * t.on_track) / t.total}%` }} />
        <div className="bg-amber-500" style={{ width: `${(100 * t.at_risk) / t.total}%` }} />
        <div className="bg-rose-500" style={{ width: `${(100 * t.off_track) / t.total}%` }} />
      </div>
    );

  return (
    <div className="rounded-xl border border-neutral-200 dark:border-neutral-800 bg-white dark:bg-neutral-900 p-4 space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 className="text-sm font-medium">
          {statusLabel} goals · <span className="tabular-nums">{overall.total}</span>
          <span className="ml-2 text-xs text-neutral-500">
            {Math.round((100 * overall.achieved) / overall.total)}% hit their target
          </span>
        </h2>
        {line(overall)}
      </div>
      {bar(overall)}

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-2 pt-1">
        {GOAL_CATEGORIES.map((c) => {
          const t = tally(rows.filter((r) => r.goal.category === c));
          const selected = category === c;
          return (
            <button
              key={c}
              onClick={() => onCategory(selected ? "all" : c)}
              disabled={t.total === 0}
              className={`rounded-lg border p-2.5 text-left disabled:opacity-40 ${
                selected
                  ? "border-indigo-500 ring-1 ring-indigo-500"
                  : "border-neutral-200 dark:border-neutral-800 hover:border-indigo-400 dark:hover:border-indigo-500"
              }`}
              title={t.total === 0 ? "No goals" : `Filter to ${CATEGORY_LABEL[c]}`}
            >
              <div className="flex items-baseline justify-between">
                <span className="text-xs font-medium uppercase tracking-wider text-neutral-500">
                  {CATEGORY_LABEL[c]}
                </span>
                <span className="text-sm font-semibold tabular-nums">{t.total}</span>
              </div>
              <div className="mt-1.5">{bar(t)}</div>
              <div className="mt-1 text-[11px] text-neutral-500 tabular-nums">
                {t.total === 0 ? "—" : `${t.on_track}✓ · ${t.at_risk}⚠ · ${t.off_track}✗`}
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );
}

export function GoalCard({
  row,
  today,
  addEntry,
}: {
  row: GoalRow;
  today: string;
  addEntry: (goalId: string, fd: FormData) => Promise<void>;
}) {
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
    <div className="rounded-xl border border-neutral-200 dark:border-neutral-800 bg-white dark:bg-neutral-900 p-4 hover:border-indigo-400 dark:hover:border-indigo-500">
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <Link
            href={`/goals/${goal.id}`}
            className="font-medium truncate block hover:text-indigo-600 dark:hover:text-indigo-400 focus:outline-none focus:underline"
          >
            {goal.title}
          </Link>
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

      {(goal.status === "active" || goal.status === "pending" || goal.status === "paused") && (
        <QuickLog goal={goal} pace={p.pace} today={today} addEntry={addEntry} />
      )}
    </div>
  );
}

/** Inline entry logging on the card: value + optional date, no page hop. */
function QuickLog({
  goal,
  pace,
  today,
  addEntry,
}: {
  goal: Goal;
  pace: Pace;
  today: string;
  addEntry: (goalId: string, fd: FormData) => Promise<void>;
}) {
  const [pending, start] = useTransition();
  const [justLogged, setJustLogged] = useState(false);

  return (
    <form
      action={(fd) =>
        start(async () => {
          await addEntry(goal.id, fd);
          setJustLogged(true);
          setTimeout(() => setJustLogged(false), 2500);
        })
      }
      className="mt-3 pt-3 border-t border-neutral-100 dark:border-neutral-800 flex items-center gap-2"
      onSubmit={(e) => e.stopPropagation()}
    >
      <input
        name="value"
        type="number"
        step="any"
        required
        disabled={pending}
        placeholder={goal.measure === "cumulative" ? `+${goal.unit ?? "amount"}` : goal.unit ?? "value"}
        className="w-24 min-w-0 flex-1 rounded-lg border border-neutral-300 dark:border-neutral-700 bg-white dark:bg-neutral-900 px-2.5 py-1.5 text-sm outline-none focus:border-indigo-500"
        aria-label={`Log ${goal.measure === "cumulative" ? "an increment" : "a reading"} for ${goal.title}`}
      />
      <input
        name="entry_date"
        type="date"
        defaultValue={today}
        required
        disabled={pending}
        className="rounded-lg border border-neutral-300 dark:border-neutral-700 bg-white dark:bg-neutral-900 px-2 py-1.5 text-xs text-neutral-500 outline-none focus:border-indigo-500"
        aria-label="Entry date"
      />
      <button
        type="submit"
        disabled={pending}
        className={`inline-flex items-center gap-1 rounded-lg px-2.5 py-1.5 text-sm font-medium text-white disabled:opacity-50 ${
          justLogged ? "bg-emerald-600" : "bg-indigo-600 hover:bg-indigo-500"
        }`}
        title={pace === "not_started" ? "Logs before the start date still count" : "Log entry"}
      >
        {justLogged ? <Check className="w-4 h-4" /> : <Plus className="w-4 h-4" />}
        {justLogged ? "Logged" : "Log"}
      </button>
    </form>
  );
}
