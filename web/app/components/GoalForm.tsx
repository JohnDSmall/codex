import {
  CATEGORY_LABEL,
  GOAL_CATEGORIES,
  GOAL_STATUSES,
  STATUS_LABEL,
  type Goal,
} from "@/lib/goals";

type Defaults = Partial<Pick<
  Goal,
  | "title" | "category" | "status" | "measure" | "direction" | "target" | "start_value" | "unit"
  | "start_date" | "end_date" | "notes"
>>;

const input =
  "w-full rounded-lg border border-neutral-300 dark:border-neutral-700 bg-white dark:bg-neutral-900 px-3 py-2 text-sm outline-none focus:border-indigo-500";
const label = "block text-xs font-medium uppercase tracking-wider text-neutral-500 mb-1";

/** Plain server-action form; used by /goals/new and /goals/[id]/edit. */
export function GoalForm({
  action,
  submitLabel,
  defaults = {},
}: {
  action: (formData: FormData) => Promise<void>;
  submitLabel: string;
  defaults?: Defaults;
}) {
  return (
    <form
      action={action}
      className="rounded-xl border border-neutral-200 dark:border-neutral-800 bg-white dark:bg-neutral-900 p-5 space-y-5"
    >
      <div>
        <label className={label} htmlFor="title">Title</label>
        <input id="title" name="title" required defaultValue={defaults.title ?? ""} className={input} placeholder="Run 800 miles" />
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div>
          <label className={label} htmlFor="category">Category</label>
          <select id="category" name="category" defaultValue={defaults.category ?? "misc"} className={input}>
            {GOAL_CATEGORIES.map((c) => (
              <option key={c} value={c}>{CATEGORY_LABEL[c]}</option>
            ))}
          </select>
        </div>
        <div>
          <label className={label} htmlFor="status">Status</label>
          <select id="status" name="status" defaultValue={defaults.status ?? "pending"} className={input}>
            {GOAL_STATUSES.map((s) => (
              <option key={s} value={s}>{STATUS_LABEL[s]}</option>
            ))}
          </select>
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div>
          <label className={label} htmlFor="start_date">Start date</label>
          <input id="start_date" name="start_date" type="date" required defaultValue={defaults.start_date ?? ""} className={input} />
        </div>
        <div>
          <label className={label} htmlFor="end_date">End date</label>
          <input id="end_date" name="end_date" type="date" required defaultValue={defaults.end_date ?? ""} className={input} />
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div>
          <label className={label} htmlFor="target">Target</label>
          <input id="target" name="target" type="number" step="any" required defaultValue={defaults.target ?? ""} className={input} />
        </div>
        <div>
          <label className={label} htmlFor="start_value">Starting value</label>
          <input id="start_value" name="start_value" type="number" step="any" defaultValue={defaults.start_value ?? 0} className={input} />
        </div>
        <div>
          <label className={label} htmlFor="unit">Unit</label>
          <input id="unit" name="unit" defaultValue={defaults.unit ?? ""} className={input} placeholder="mi, lbs, $, books…" />
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div>
          <label className={label} htmlFor="measure">How entries count</label>
          <select id="measure" name="measure" defaultValue={defaults.measure ?? "cumulative"} className={input}>
            <option value="cumulative">Cumulative — entries add up (“+12 miles”)</option>
            <option value="absolute">Absolute — newest entry is the value (“187 lbs”)</option>
          </select>
        </div>
        <div>
          <label className={label} htmlFor="direction">Direction</label>
          <select id="direction" name="direction" defaultValue={defaults.direction ?? "at_least"} className={input}>
            <option value="at_least">Reach at least the target</option>
            <option value="at_most">Get down to at most the target</option>
          </select>
        </div>
      </div>

      <div>
        <label className={label} htmlFor="notes">Notes</label>
        <textarea id="notes" name="notes" rows={3} defaultValue={defaults.notes ?? ""} className={input} />
      </div>

      <p className="text-xs text-neutral-500">
        Binary goals (“finalize the proposal”): target 1, cumulative, and log a single entry of 1 when it’s
        done. Pace is linear: at any date you’re expected to be proportionally between the starting value and
        the target. ≥100% of expected is on track, 80–100% at risk, below that off track.
      </p>

      <div className="flex justify-end">
        <button
          type="submit"
          className="rounded-lg bg-indigo-600 hover:bg-indigo-500 px-4 py-2 text-sm font-medium text-white"
        >
          {submitLabel}
        </button>
      </div>
    </form>
  );
}
