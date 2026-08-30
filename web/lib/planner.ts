// Pure planner types + palette. No server imports, safe for client components.

export const ACTIVITY_CATEGORIES = [
  "work",
  "family_friends",
  "health",
  "travel",
  "personal",
  "misc",
] as const;
export type ActivityCategory = (typeof ACTIVITY_CATEGORIES)[number];

export type Activity = {
  id: string;
  title: string;
  category: ActivityCategory;
  start_date: string; // inclusive ISO date
  end_date: string; // inclusive ISO date
  note: string | null;
};

export const ACTIVITY_CATEGORY_LABEL: Record<ActivityCategory, string> = {
  work: "Work",
  family_friends: "Family & Friends",
  health: "Health",
  travel: "Travel",
  personal: "Personal",
  misc: "Misc",
};

/** Bar + dot styling per category, tuned for both themes. */
export const ACTIVITY_CATEGORY_CLASS: Record<ActivityCategory, { bar: string; dot: string }> = {
  work: {
    bar: "bg-sky-100 dark:bg-sky-500/20 text-sky-800 dark:text-sky-200 border-sky-300 dark:border-sky-500/40",
    dot: "bg-sky-500",
  },
  family_friends: {
    bar: "bg-violet-100 dark:bg-violet-500/20 text-violet-800 dark:text-violet-200 border-violet-300 dark:border-violet-500/40",
    dot: "bg-violet-500",
  },
  health: {
    bar: "bg-emerald-100 dark:bg-emerald-500/20 text-emerald-800 dark:text-emerald-200 border-emerald-300 dark:border-emerald-500/40",
    dot: "bg-emerald-500",
  },
  travel: {
    bar: "bg-amber-100 dark:bg-amber-500/20 text-amber-800 dark:text-amber-200 border-amber-300 dark:border-amber-500/40",
    dot: "bg-amber-500",
  },
  personal: {
    bar: "bg-pink-100 dark:bg-pink-500/20 text-pink-800 dark:text-pink-200 border-pink-300 dark:border-pink-500/40",
    dot: "bg-pink-500",
  },
  misc: {
    bar: "bg-neutral-200 dark:bg-neutral-700/60 text-neutral-700 dark:text-neutral-200 border-neutral-300 dark:border-neutral-600",
    dot: "bg-neutral-400",
  },
};
