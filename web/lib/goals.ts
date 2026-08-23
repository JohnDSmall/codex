// Pure goal types + math. No server imports, so client components can use it.

export const GOAL_CATEGORIES = ["financial", "professional", "health", "social", "misc"] as const;
export type GoalCategory = (typeof GOAL_CATEGORIES)[number];

export const GOAL_STATUSES = ["pending", "active", "paused", "completed", "deprecated"] as const;
export type GoalStatus = (typeof GOAL_STATUSES)[number];

export type GoalMeasure = "cumulative" | "absolute";
export type GoalDirection = "at_least" | "at_most";

export type Goal = {
  id: string;
  title: string;
  category: GoalCategory;
  status: GoalStatus;
  measure: GoalMeasure;
  direction: GoalDirection;
  target: number;
  start_value: number;
  unit: string | null;
  start_date: string;
  end_date: string;
  notes: string | null;
  source: string | null;
  completed_at: string | null;
  created_at: string;
};

export type GoalEntry = {
  id: string;
  goal_id: string;
  entry_date: string;
  value: number;
  note: string | null;
  created_at: string;
};

export const CATEGORY_LABEL: Record<GoalCategory, string> = {
  financial: "Financial",
  professional: "Professional",
  health: "Health",
  social: "Social",
  misc: "Misc",
};

export const STATUS_LABEL: Record<GoalStatus, string> = {
  pending: "Pending",
  active: "Active",
  paused: "Paused",
  completed: "Completed",
  deprecated: "Deprecated",
};

/** Days until a goal's end date counts as "coming up". */
export const ENDING_SOON_DAYS = 14;

export type Pace = "on_track" | "at_risk" | "off_track" | "not_started" | "ended";

export type GoalProgress = {
  /** Derived current value (see goals migration header for the rule). */
  current: number;
  /** Where a linear pace says you should be today, clamped to the date range. */
  expected: number;
  /** Progress made ÷ progress expected. 1 = exactly on pace. */
  ratio: number;
  pace: Pace;
  /** Fraction of the date range elapsed, 0..1. */
  elapsed: number;
  /** current − target, signed. Negative = still short (for at_least). */
  delta: number;
  /** Fraction of the whole target achieved, 0..1+ (for the progress bar). */
  fraction: number;
  daysLeft: number;
  endingSoon: boolean;
  /** Whether the target itself has been met, regardless of pace. */
  achieved: boolean;
  lastEntryDate: string | null;
};

const DAY = 86_400_000;
const dayNum = (iso: string) => Math.round(Date.parse(iso + "T00:00:00Z") / DAY);

export function currentValue(goal: Goal, entries: GoalEntry[]): number {
  if (goal.measure === "absolute") {
    if (entries.length === 0) return goal.start_value;
    // entries arrive sorted by (entry_date, created_at) ascending
    return entries[entries.length - 1].value;
  }
  return goal.start_value + entries.reduce((s, e) => s + e.value, 0);
}

export function expectedAt(goal: Goal, elapsed: number): number {
  return goal.start_value + (goal.target - goal.start_value) * elapsed;
}

export function elapsedFraction(goal: Goal, today: string): number {
  const s = dayNum(goal.start_date);
  const e = dayNum(goal.end_date);
  const t = dayNum(today);
  if (e <= s) return t >= e ? 1 : 0;
  return Math.min(1, Math.max(0, (t - s) / (e - s)));
}

/** Pace from a progress ratio: ≥100% on track, 80–100% at risk, below that off track. */
export function paceFromRatio(ratio: number): Exclude<Pace, "not_started" | "ended"> {
  if (ratio >= 1) return "on_track";
  if (ratio >= 0.8) return "at_risk";
  return "off_track";
}

export function computeProgress(goal: Goal, entries: GoalEntry[], today: string): GoalProgress {
  const current = currentValue(goal, entries);
  const elapsed = elapsedFraction(goal, today);
  const expected = expectedAt(goal, elapsed);
  const span = goal.target - goal.start_value; // signed distance to cover
  const made = current - goal.start_value;
  const need = expected - goal.start_value;

  // Progress relative to the direction of travel. For at_most, "made" and
  // "need" are both negative, so the ratio comes out positive either way.
  let ratio: number;
  if (span === 0) {
    ratio = goal.direction === "at_most" ? (current <= goal.target ? 1 : 0) : current >= goal.target ? 1 : 0;
  } else if (need === 0) {
    ratio = made / span >= 0 ? 1 : 0;
  } else {
    ratio = made / need;
  }
  if (!Number.isFinite(ratio)) ratio = 0;

  const fraction = span === 0 ? (ratio >= 1 ? 1 : 0) : Math.max(0, made / span);
  const achieved = goal.direction === "at_most" ? current <= goal.target : current >= goal.target;
  const daysLeft = dayNum(goal.end_date) - dayNum(today);

  let pace: Pace;
  if (achieved) pace = "on_track";
  else if (today < goal.start_date) pace = "not_started";
  else if (today > goal.end_date) pace = "ended";
  else pace = paceFromRatio(ratio);

  const lastEntryDate = entries.length ? entries[entries.length - 1].entry_date : null;

  return {
    current,
    expected,
    ratio,
    pace,
    elapsed,
    delta: current - goal.target,
    fraction,
    daysLeft,
    endingSoon: goal.status === "active" && daysLeft >= 0 && daysLeft <= ENDING_SOON_DAYS,
    achieved,
    lastEntryDate,
  };
}

export type SeriesPoint = { date: string; actual: number; expected: number };

/**
 * Actual-vs-expected series for the chart: one point per entry date, plus the
 * start and end of the range so the expected line always spans the whole goal.
 */
export function buildSeries(goal: Goal, entries: GoalEntry[], today: string): SeriesPoint[] {
  const dates = new Set<string>([goal.start_date, goal.end_date]);
  if (today >= goal.start_date && today <= goal.end_date) dates.add(today);
  for (const e of entries) dates.add(e.entry_date);
  const sorted = Array.from(dates).sort();

  let running = goal.start_value;
  let i = 0;
  const out: SeriesPoint[] = [];
  for (const d of sorted) {
    while (i < entries.length && entries[i].entry_date <= d) {
      running = goal.measure === "absolute" ? entries[i].value : running + entries[i].value;
      i++;
    }
    const hasData = d <= today && (d === goal.start_date || i > 0);
    out.push({
      date: d,
      actual: hasData ? running : NaN,
      expected: expectedAt(goal, elapsedFraction(goal, d)),
    });
  }
  return out;
}

export function fmtNum(n: number, unit?: string | null): string {
  const s = Math.abs(n) >= 100 || Number.isInteger(n) ? n.toLocaleString(undefined, { maximumFractionDigits: 0 }) : n.toLocaleString(undefined, { maximumFractionDigits: 2 });
  return unit ? `${s} ${unit}` : s;
}

export const PACE_LABEL: Record<Pace, string> = {
  on_track: "On track",
  at_risk: "At risk",
  off_track: "Off track",
  not_started: "Not started",
  ended: "Ended short",
};

/** Tailwind classes for the pace badge / bar. */
export function paceClass(p: Pace): { badge: string; bar: string } {
  switch (p) {
    case "on_track":
      return { badge: "bg-emerald-100 dark:bg-emerald-500/15 text-emerald-700 dark:text-emerald-300", bar: "bg-emerald-500" };
    case "at_risk":
      return { badge: "bg-amber-100 dark:bg-amber-500/15 text-amber-700 dark:text-amber-300", bar: "bg-amber-500" };
    case "off_track":
    case "ended":
      return { badge: "bg-rose-100 dark:bg-rose-500/15 text-rose-700 dark:text-rose-300", bar: "bg-rose-500" };
    default:
      return { badge: "bg-neutral-100 dark:bg-neutral-800 text-neutral-600 dark:text-neutral-300", bar: "bg-neutral-400" };
  }
}
