"use client";

import { useState, useTransition } from "react";
import {
  CartesianGrid,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
  Legend,
} from "recharts";
import { AlertTriangle, Plus, Trash2 } from "lucide-react";
import {
  CATEGORY_LABEL,
  GOAL_STATUSES,
  PACE_LABEL,
  STATUS_LABEL,
  fmtNum,
  paceClass,
  type Goal,
  type GoalEntry,
  type GoalProgress,
  type SeriesPoint,
} from "@/lib/goals";

const fmtDate = (iso: string) => {
  const [y, m, d] = iso.split("-");
  return `${m}/${d}/${y.slice(2)}`;
};

export function GoalDetail({
  goal,
  entries,
  progress: p,
  series,
  today,
  addEntry,
  deleteEntry,
  setGoalStatus,
  deleteGoal,
}: {
  goal: Goal;
  /** Newest first. */
  entries: GoalEntry[];
  progress: GoalProgress;
  series: SeriesPoint[];
  today: string;
  addEntry: (goalId: string, fd: FormData) => Promise<void>;
  deleteEntry: (id: string, goalId: string) => Promise<void>;
  setGoalStatus: (id: string, status: string) => Promise<void>;
  deleteGoal: (id: string) => Promise<void>;
}) {
  const cls = paceClass(p.pace);
  const [pending, start] = useTransition();
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [showAll, setShowAll] = useState(false);
  const visible = showAll ? entries : entries.slice(0, 30);

  const chartData = series.map((s) => ({
    date: s.date,
    actual: Number.isNaN(s.actual) ? null : +s.actual.toFixed(2),
    expected: +s.expected.toFixed(2),
  }));

  return (
    <div className="space-y-6">
      {/* status + pace strip */}
      <div className="rounded-xl border border-neutral-200 dark:border-neutral-800 bg-white dark:bg-neutral-900 p-4 flex flex-wrap items-center gap-3">
        <span className={`rounded-md px-2.5 py-1 text-sm font-medium ${cls.badge}`}>{PACE_LABEL[p.pace]}</span>
        <span className="text-sm text-neutral-500">{CATEGORY_LABEL[goal.category]}</span>
        <span className="text-sm text-neutral-500">·</span>
        <span className="text-sm text-neutral-500">
          {goal.measure === "cumulative" ? "cumulative" : "absolute"} ·{" "}
          {goal.direction === "at_least" ? "reach at least" : "get down to"} {fmtNum(goal.target, goal.unit)}
        </span>
        {p.endingSoon && (
          <span className="inline-flex items-center gap-1 text-sm text-amber-700 dark:text-amber-300">
            <AlertTriangle className="w-4 h-4" /> deadline in {p.daysLeft}d
          </span>
        )}
        <label className="ml-auto flex items-center gap-2 text-sm">
          <span className="text-neutral-500">Status</span>
          <select
            value={goal.status}
            disabled={pending}
            onChange={(e) => {
              const v = e.target.value;
              start(() => setGoalStatus(goal.id, v));
            }}
            className="rounded-lg border border-neutral-300 dark:border-neutral-700 bg-white dark:bg-neutral-900 px-2 py-1 text-sm outline-none focus:border-indigo-500"
          >
            {GOAL_STATUSES.map((s) => (
              <option key={s} value={s}>{STATUS_LABEL[s]}</option>
            ))}
          </select>
        </label>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Kpi label="Current" value={fmtNum(p.current, goal.unit)} />
        <Kpi label="Target" value={fmtNum(goal.target, goal.unit)} />
        <Kpi
          label={p.achieved ? (goal.direction === "at_most" ? "Under by" : "Over by") : "Remaining"}
          value={fmtNum(Math.abs(p.delta), goal.unit)}
          accent={p.achieved}
        />
        <Kpi
          label={goal.status === "active" ? "Expected today" : "Expected at end"}
          value={`${fmtNum(p.expected, goal.unit)} · ${Math.round(p.ratio * 100)}%`}
          sub={goal.status === "active" ? `${Math.round(p.elapsed * 100)}% of time elapsed · ${p.daysLeft < 0 ? "ended" : `${p.daysLeft}d left`}` : undefined}
        />
      </div>

      {/* chart */}
      <div className="rounded-xl border border-neutral-200 dark:border-neutral-800 bg-white dark:bg-neutral-900 p-4">
        <h2 className="text-sm font-medium mb-2">Progress over time</h2>
        <div className="h-64">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={chartData} margin={{ left: 8, right: 8, top: 8, bottom: 8 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#e5e5e5" className="dark:stroke-neutral-700" />
              <XAxis dataKey="date" stroke="#737373" fontSize={11} tickFormatter={fmtDate} minTickGap={24} />
              <YAxis stroke="#737373" fontSize={11} width={56} />
              <Tooltip
                labelFormatter={(l) => fmtDate(String(l))}
                formatter={(v, name) => [fmtNum(Number(v ?? 0), goal.unit), name === "actual" ? "Actual" : "Expected"]}
                contentStyle={{ borderRadius: 8, fontSize: 12 }}
              />
              <Legend wrapperStyle={{ fontSize: 11 }} />
              <Line type="monotone" dataKey="expected" name="Expected pace" stroke="#a3a3a3" strokeDasharray="4 4" dot={false} isAnimationActive={false} />
              <Line type="stepAfter" dataKey="actual" name="Actual" stroke="#6366f1" strokeWidth={2} dot={entries.length < 60} connectNulls={false} isAnimationActive={false} />
            </LineChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* add entry */}
      <form
        action={(fd) => start(() => addEntry(goal.id, fd))}
        className="rounded-xl border border-neutral-200 dark:border-neutral-800 bg-white dark:bg-neutral-900 p-4 grid grid-cols-1 sm:grid-cols-[auto_auto_1fr_auto] gap-3 items-end"
      >
        <div>
          <label className="block text-xs text-neutral-500 mb-1" htmlFor="entry_date">Date</label>
          <input id="entry_date" name="entry_date" type="date" required defaultValue={today} className="rounded-lg border border-neutral-300 dark:border-neutral-700 bg-white dark:bg-neutral-900 px-3 py-2 text-sm outline-none focus:border-indigo-500" />
        </div>
        <div>
          <label className="block text-xs text-neutral-500 mb-1" htmlFor="value">
            {goal.measure === "cumulative" ? "Add" : "New value"}{goal.unit ? ` (${goal.unit})` : ""}
          </label>
          <input id="value" name="value" type="number" step="any" required className="w-32 rounded-lg border border-neutral-300 dark:border-neutral-700 bg-white dark:bg-neutral-900 px-3 py-2 text-sm outline-none focus:border-indigo-500" />
        </div>
        <div>
          <label className="block text-xs text-neutral-500 mb-1" htmlFor="note">Note</label>
          <input id="note" name="note" className="w-full rounded-lg border border-neutral-300 dark:border-neutral-700 bg-white dark:bg-neutral-900 px-3 py-2 text-sm outline-none focus:border-indigo-500" placeholder="optional" />
        </div>
        <button
          type="submit"
          disabled={pending}
          className="inline-flex items-center gap-1.5 rounded-lg bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 px-3 py-2 text-sm font-medium text-white"
        >
          <Plus className="w-4 h-4" /> Log
        </button>
      </form>

      {/* entries */}
      <div className="rounded-xl border border-neutral-200 dark:border-neutral-800 bg-white dark:bg-neutral-900 overflow-hidden">
        <div className="px-4 py-3 flex items-center justify-between">
          <h2 className="text-sm font-medium">
            Log <span className="text-neutral-400 tabular-nums">{entries.length}</span>
          </h2>
          {entries.length > 30 && (
            <button onClick={() => setShowAll((v) => !v)} className="text-sm text-indigo-600 dark:text-indigo-400 hover:underline">
              {showAll ? "Show latest 30" : `Show all ${entries.length}`}
            </button>
          )}
        </div>
        {entries.length === 0 ? (
          <div className="px-4 pb-6 text-sm text-neutral-500">Nothing logged yet.</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="text-xs uppercase tracking-wider text-neutral-500 bg-neutral-50 dark:bg-neutral-800/50">
                <tr>
                  <th className="text-left px-4 py-2">Date</th>
                  <th className="text-right px-4 py-2">{goal.measure === "cumulative" ? "Added" : "Value"}</th>
                  <th className="text-left px-4 py-2">Note</th>
                  <th className="text-left px-4 py-2">Logged</th>
                  <th className="px-2 py-2" />
                </tr>
              </thead>
              <tbody>
                {visible.map((e) => (
                  <tr key={e.id} className="border-t border-neutral-100 dark:border-neutral-800">
                    <td className="px-4 py-2 tabular-nums whitespace-nowrap">{e.entry_date}</td>
                    <td className="px-4 py-2 tabular-nums text-right whitespace-nowrap">
                      {goal.measure === "cumulative" && e.value > 0 ? "+" : ""}
                      {fmtNum(e.value)}
                    </td>
                    <td className="px-4 py-2 text-neutral-500">{e.note ?? ""}</td>
                    <td className="px-4 py-2 text-neutral-400 text-xs whitespace-nowrap">
                      {e.created_at ? e.created_at.slice(0, 16).replace("T", " ") : ""}
                    </td>
                    <td className="px-2 py-2 text-right">
                      <button
                        onClick={() => start(() => deleteEntry(e.id, goal.id))}
                        disabled={pending}
                        title="Delete entry"
                        className="text-neutral-400 hover:text-rose-600 disabled:opacity-50"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {goal.notes && (
        <div className="rounded-xl border border-neutral-200 dark:border-neutral-800 bg-white dark:bg-neutral-900 p-4 text-sm whitespace-pre-wrap">
          {goal.notes}
        </div>
      )}

      {/* delete */}
      <div className="flex justify-end">
        {confirmDelete ? (
          <div className="flex items-center gap-2 text-sm">
            <span className="text-neutral-500">Delete this goal and its {entries.length} entries?</span>
            <button onClick={() => start(() => deleteGoal(goal.id))} disabled={pending} className="rounded-lg bg-rose-600 hover:bg-rose-500 px-3 py-1.5 text-white">
              Delete
            </button>
            <button onClick={() => setConfirmDelete(false)} className="rounded-lg border border-neutral-300 dark:border-neutral-700 px-3 py-1.5">
              Cancel
            </button>
          </div>
        ) : (
          <button onClick={() => setConfirmDelete(true)} className="text-sm text-neutral-400 hover:text-rose-600">
            Delete goal
          </button>
        )}
      </div>
    </div>
  );
}

function Kpi({ label, value, sub, accent = false }: { label: string; value: string; sub?: string; accent?: boolean }) {
  return (
    <div className="rounded-xl border border-neutral-200 dark:border-neutral-800 bg-white dark:bg-neutral-900 p-4">
      <div className="text-xs uppercase tracking-wider text-neutral-500">{label}</div>
      <div className={`mt-1 text-lg font-semibold tabular-nums ${accent ? "text-emerald-600 dark:text-emerald-400" : ""}`}>{value}</div>
      {sub && <div className="text-xs text-neutral-500 mt-0.5">{sub}</div>}
    </div>
  );
}
