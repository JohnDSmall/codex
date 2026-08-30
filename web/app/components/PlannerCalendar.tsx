"use client";

import { useMemo, useState, useTransition } from "react";
import { ChevronLeft, ChevronRight, Plus, Trash2, X } from "lucide-react";
import {
  ACTIVITY_CATEGORIES,
  ACTIVITY_CATEGORY_CLASS,
  ACTIVITY_CATEGORY_LABEL,
  type Activity,
  type ActivityCategory,
} from "@/lib/planner";

// ---------------------------------------------------------------- date utils
// All math on ISO date strings / day numbers; no Date-object timezone traps.
const DAY = 86_400_000;
const toNum = (iso: string) => Math.round(Date.parse(iso + "T00:00:00Z") / DAY);
const toISO = (n: number) => new Date(n * DAY).toISOString().slice(0, 10);
const MONTHS = ["January","February","March","April","May","June","July","August","September","October","November","December"];
const WEEKDAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

type Ym = { year: number; month: number }; // month 1-12

function monthOf(iso: string): Ym {
  return { year: Number(iso.slice(0, 4)), month: Number(iso.slice(5, 7)) };
}
function shiftMonth({ year, month }: Ym, by: number): Ym {
  const m = month - 1 + by;
  return { year: year + Math.floor(m / 12), month: ((m % 12) + 12) % 12 + 1 };
}
function firstOf({ year, month }: Ym): string {
  return `${year}-${String(month).padStart(2, "0")}-01`;
}
/** 6 rows of 7 day-numbers, starting the Sunday on/before the 1st. */
function gridOf(ym: Ym): number[][] {
  const first = toNum(firstOf(ym));
  const dow = new Date(first * DAY).getUTCDay();
  const start = first - dow;
  return Array.from({ length: 6 }, (_, w) => Array.from({ length: 7 }, (_, d) => start + w * 7 + d));
}

// -------------------------------------------------------------- lane packing
type Segment = {
  activity: Activity;
  col: number; // 1-7 grid column start
  span: number;
  lane: number;
  continuesLeft: boolean;
  continuesRight: boolean;
};

/** Bars for one week row: greedy lane assignment, longer blocks first. */
function packWeek(days: number[], activities: Activity[]): Segment[] {
  const weekStart = days[0];
  const weekEnd = days[6];
  const overlapping = activities
    .map((a) => ({ a, s: toNum(a.start_date), e: toNum(a.end_date) }))
    .filter(({ s, e }) => s <= weekEnd && e >= weekStart)
    .sort((x, y) => x.s - y.s || y.e - y.s - (x.e - x.s) || x.a.title.localeCompare(y.a.title));

  const laneEnds: number[] = []; // last occupied day per lane
  const out: Segment[] = [];
  for (const { a, s, e } of overlapping) {
    const from = Math.max(s, weekStart);
    const to = Math.min(e, weekEnd);
    let lane = laneEnds.findIndex((end) => end < from);
    if (lane === -1) { lane = laneEnds.length; laneEnds.push(to); } else laneEnds[lane] = to;
    out.push({
      activity: a,
      col: from - weekStart + 1,
      span: to - from + 1,
      lane,
      continuesLeft: s < weekStart,
      continuesRight: e > weekEnd,
    });
  }
  return out;
}

// ------------------------------------------------------------------- editor
type Draft = {
  id: string | null; // null = creating
  title: string;
  category: ActivityCategory;
  start_date: string;
  end_date: string;
  note: string;
};

export function PlannerCalendar({
  activities,
  dueCounts = {},
  today,
  createActivity,
  updateActivity,
  deleteActivity,
}: {
  activities: Activity[];
  /** date -> count of open action items due that day (badge in the day cell). */
  dueCounts?: Record<string, number>;
  today: string;
  createActivity: (fd: FormData) => Promise<void>;
  updateActivity: (id: string, fd: FormData) => Promise<void>;
  deleteActivity: (id: string) => Promise<void>;
}) {
  const [ym, setYm] = useState<Ym>(monthOf(today));
  const [draft, setDraft] = useState<Draft | null>(null);
  const [pending, start] = useTransition();

  const grid = useMemo(() => gridOf(ym), [ym]);
  const weeks = useMemo(
    () => grid.map((days) => ({ days, segments: packWeek(days, activities) })),
    [grid, activities],
  );
  const todayNum = toNum(today);

  const monthActivities = useMemo(() => {
    const s = toNum(firstOf(ym));
    const e = toNum(firstOf(shiftMonth(ym, 1))) - 1;
    return activities.filter((a) => toNum(a.start_date) <= e && toNum(a.end_date) >= s);
  }, [activities, ym]);

  const catCounts = useMemo(() => {
    const c = new Map<ActivityCategory, number>();
    for (const a of monthActivities) c.set(a.category, (c.get(a.category) ?? 0) + 1);
    return c;
  }, [monthActivities]);

  const openNew = (dateISO: string) =>
    setDraft({ id: null, title: "", category: "personal", start_date: dateISO, end_date: dateISO, note: "" });
  const openEdit = (a: Activity) =>
    setDraft({ id: a.id, title: a.title, category: a.category, start_date: a.start_date, end_date: a.end_date, note: a.note ?? "" });

  const save = (fd: FormData) =>
    start(async () => {
      if (draft?.id) await updateActivity(draft.id, fd);
      else await createActivity(fd);
      setDraft(null);
    });

  return (
    <div className="space-y-4">
      {/* month navigation */}
      <div className="rounded-xl border border-neutral-200 dark:border-neutral-800 bg-white dark:bg-neutral-900 p-3 flex flex-wrap items-center gap-3">
        <div className="flex items-center gap-1">
          <button onClick={() => setYm((m) => shiftMonth(m, -1))} aria-label="Previous month"
            className="rounded-lg border border-neutral-300 dark:border-neutral-700 p-1.5 hover:bg-neutral-50 dark:hover:bg-neutral-800">
            <ChevronLeft className="w-4 h-4" />
          </button>
          <button onClick={() => setYm(monthOf(today))}
            className="rounded-lg border border-neutral-300 dark:border-neutral-700 px-3 py-1.5 text-sm hover:bg-neutral-50 dark:hover:bg-neutral-800">
            Today
          </button>
          <button onClick={() => setYm((m) => shiftMonth(m, 1))} aria-label="Next month"
            className="rounded-lg border border-neutral-300 dark:border-neutral-700 p-1.5 hover:bg-neutral-50 dark:hover:bg-neutral-800">
            <ChevronRight className="w-4 h-4" />
          </button>
        </div>
        <h2 className="text-lg font-semibold tabular-nums">{MONTHS[ym.month - 1]} {ym.year}</h2>

        {/* legend, doubling as this month's per-category tally */}
        <div className="ml-auto flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-neutral-600 dark:text-neutral-300">
          {ACTIVITY_CATEGORIES.map((c) => (
            <span key={c} className="inline-flex items-center gap-1.5">
              <span className={`w-2.5 h-2.5 rounded-full ${ACTIVITY_CATEGORY_CLASS[c].dot}`} />
              {ACTIVITY_CATEGORY_LABEL[c]}
              {catCounts.get(c) ? <span className="tabular-nums text-neutral-400">{catCounts.get(c)}</span> : null}
            </span>
          ))}
        </div>
        <button
          onClick={() => openNew(today)}
          className="inline-flex items-center gap-1.5 rounded-lg bg-indigo-600 hover:bg-indigo-500 px-3 py-1.5 text-sm font-medium text-white">
          <Plus className="w-4 h-4" /> Add activity
        </button>
      </div>

      {/* month grid */}
      <div className="rounded-xl border border-neutral-200 dark:border-neutral-800 bg-white dark:bg-neutral-900 overflow-hidden">
        <div className="grid grid-cols-7 border-b border-neutral-200 dark:border-neutral-800 text-xs font-medium uppercase tracking-wider text-neutral-500">
          {WEEKDAYS.map((d) => <div key={d} className="px-2 py-2 text-center">{d}</div>)}
        </div>
        {weeks.map(({ days, segments }, w) => {
          const lanes = segments.length ? Math.max(...segments.map((s) => s.lane)) + 1 : 0;
          return (
            <div key={w} className="relative border-b last:border-b-0 border-neutral-200 dark:border-neutral-800">
              {/* day cells (background layer, clickable to add) */}
              <div className="grid grid-cols-7 absolute inset-0">
                {days.map((n) => {
                  const iso = toISO(n);
                  const inMonth = monthOf(iso).month === ym.month;
                  return (
                    <button
                      key={n}
                      onClick={() => openNew(iso)}
                      title={`Add activity on ${iso}`}
                      className={`border-r last:border-r-0 border-neutral-100 dark:border-neutral-800 text-left align-top hover:bg-indigo-50/60 dark:hover:bg-indigo-500/5 ${
                        inMonth ? "" : "bg-neutral-50/70 dark:bg-neutral-950/40"
                      }`}
                    />
                  );
                })}
              </div>
              {/* content layer: day numbers + activity bars */}
              <div className="relative pointer-events-none" style={{ minHeight: `${2.1 + lanes * 1.75}rem` }}>
                <div className="grid grid-cols-7">
                  {days.map((n) => {
                    const iso = toISO(n);
                    const inMonth = monthOf(iso).month === ym.month;
                    const isToday = n === todayNum;
                    const due = dueCounts[iso] ?? 0;
                    return (
                      <div key={n} className="px-1.5 pt-1.5 pb-0.5 flex items-center gap-1">
                        <span
                          className={`inline-flex items-center justify-center w-6 h-6 rounded-full text-xs tabular-nums ${
                            isToday
                              ? "bg-indigo-600 text-white font-semibold"
                              : inMonth
                                ? "text-neutral-700 dark:text-neutral-300"
                                : "text-neutral-400 dark:text-neutral-600"
                          }`}
                        >
                          {Number(iso.slice(8, 10))}
                        </span>
                        {due > 0 && (
                          <a
                            href="/actions"
                            title={`${due} action item${due === 1 ? "" : "s"} due ${iso}`}
                            className={`pointer-events-auto rounded-full px-1.5 py-px text-[10px] font-semibold tabular-nums ${
                              n < todayNum
                                ? "bg-rose-100 dark:bg-rose-500/20 text-rose-700 dark:text-rose-300"
                                : "bg-indigo-100 dark:bg-indigo-500/20 text-indigo-700 dark:text-indigo-300"
                            }`}
                          >
                            {due} due
                          </a>
                        )}
                      </div>
                    );
                  })}
                </div>
                {lanes > 0 && (
                  <div
                    className="grid grid-cols-7 gap-y-1 px-0.5 pb-1"
                    style={{ gridTemplateRows: `repeat(${lanes}, 1.5rem)` }}
                  >
                    {segments.map((s) => {
                      const cls = ACTIVITY_CATEGORY_CLASS[s.activity.category];
                      return (
                        <button
                          key={`${s.activity.id}:${s.col}`}
                          onClick={() => openEdit(s.activity)}
                          style={{ gridColumn: `${s.col} / span ${s.span}`, gridRow: s.lane + 1 }}
                          title={`${s.activity.title} · ${s.activity.start_date}${s.activity.end_date !== s.activity.start_date ? ` → ${s.activity.end_date}` : ""}`}
                          className={`pointer-events-auto mx-0.5 border px-1.5 text-xs font-medium truncate text-left leading-6 ${cls.bar} ${
                            s.continuesLeft ? "rounded-l-none border-l-0" : "rounded-l-md"
                          } ${s.continuesRight ? "rounded-r-none border-r-0" : "rounded-r-md"}`}
                        >
                          {s.continuesLeft ? "… " : ""}{s.activity.title}
                        </button>
                      );
                    })}
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {/* editor modal */}
      {draft && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" onClick={() => !pending && setDraft(null)}>
          <div
            className="w-full max-w-md rounded-xl border border-neutral-200 dark:border-neutral-700 bg-white dark:bg-neutral-900 p-5 shadow-xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-semibold">{draft.id ? "Edit activity" : "New activity"}</h3>
              <button onClick={() => setDraft(null)} aria-label="Close" className="text-neutral-400 hover:text-neutral-600 dark:hover:text-neutral-200">
                <X className="w-5 h-5" />
              </button>
            </div>
            <form action={save} className="space-y-4">
              <div>
                <label className="block text-xs font-medium uppercase tracking-wider text-neutral-500 mb-1" htmlFor="title">Title</label>
                <input id="title" name="title" required autoFocus defaultValue={draft.title}
                  className="w-full rounded-lg border border-neutral-300 dark:border-neutral-700 bg-white dark:bg-neutral-900 px-3 py-2 text-sm outline-none focus:border-indigo-500" />
              </div>
              <div>
                <label className="block text-xs font-medium uppercase tracking-wider text-neutral-500 mb-1" htmlFor="category">Category</label>
                <select id="category" name="category" defaultValue={draft.category}
                  className="w-full rounded-lg border border-neutral-300 dark:border-neutral-700 bg-white dark:bg-neutral-900 px-3 py-2 text-sm outline-none focus:border-indigo-500">
                  {ACTIVITY_CATEGORIES.map((c) => (
                    <option key={c} value={c}>{ACTIVITY_CATEGORY_LABEL[c]}</option>
                  ))}
                </select>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium uppercase tracking-wider text-neutral-500 mb-1" htmlFor="start_date">Start</label>
                  <input id="start_date" name="start_date" type="date" required defaultValue={draft.start_date}
                    className="w-full rounded-lg border border-neutral-300 dark:border-neutral-700 bg-white dark:bg-neutral-900 px-3 py-2 text-sm outline-none focus:border-indigo-500" />
                </div>
                <div>
                  <label className="block text-xs font-medium uppercase tracking-wider text-neutral-500 mb-1" htmlFor="end_date">End</label>
                  <input id="end_date" name="end_date" type="date" defaultValue={draft.end_date}
                    className="w-full rounded-lg border border-neutral-300 dark:border-neutral-700 bg-white dark:bg-neutral-900 px-3 py-2 text-sm outline-none focus:border-indigo-500" />
                </div>
              </div>
              <div>
                <label className="block text-xs font-medium uppercase tracking-wider text-neutral-500 mb-1" htmlFor="note">Note</label>
                <textarea id="note" name="note" rows={2} defaultValue={draft.note}
                  className="w-full rounded-lg border border-neutral-300 dark:border-neutral-700 bg-white dark:bg-neutral-900 px-3 py-2 text-sm outline-none focus:border-indigo-500" />
              </div>
              <div className="flex items-center justify-between pt-1">
                {draft.id ? (
                  <button type="button" disabled={pending}
                    onClick={() => start(async () => { await deleteActivity(draft.id!); setDraft(null); })}
                    className="inline-flex items-center gap-1.5 rounded-lg border border-rose-300 dark:border-rose-500/40 px-3 py-2 text-sm text-rose-600 dark:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-500/10 disabled:opacity-50">
                    <Trash2 className="w-4 h-4" /> Delete
                  </button>
                ) : <span />}
                <button type="submit" disabled={pending}
                  className="rounded-lg bg-indigo-600 hover:bg-indigo-500 px-4 py-2 text-sm font-medium text-white disabled:opacity-50">
                  {draft.id ? "Save changes" : "Add to calendar"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
