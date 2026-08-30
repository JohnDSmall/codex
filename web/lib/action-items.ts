// Pure action-item types. Categories reuse the planner palette so the whole
// app speaks one color language.

import { ACTIVITY_CATEGORIES, type ActivityCategory } from "./planner";

export const ACTION_CATEGORIES = ACTIVITY_CATEGORIES;
export type ActionCategory = ActivityCategory;

export const ACTION_PRIORITIES = ["high", "medium", "low"] as const;
export type ActionPriority = (typeof ACTION_PRIORITIES)[number];

export type ActionStatus = "active" | "completed";

export type ActionItem = {
  id: string;
  seq: number;
  description: string;
  priority: ActionPriority;
  category: ActionCategory;
  status: ActionStatus;
  due_date: string | null;
  completed_at: string | null;
  created_at: string;
  updated_at: string;
};

export type ActionNote = {
  id: string;
  item_id: string;
  content: string;
  created_at: string;
};

export const PRIORITY_LABEL: Record<ActionPriority, string> = {
  high: "High",
  medium: "Medium",
  low: "Low",
};

export const PRIORITY_CLASS: Record<ActionPriority, string> = {
  high: "bg-rose-100 dark:bg-rose-500/15 text-rose-700 dark:text-rose-300",
  medium: "bg-amber-100 dark:bg-amber-500/15 text-amber-700 dark:text-amber-300",
  low: "bg-neutral-100 dark:bg-neutral-800 text-neutral-600 dark:text-neutral-300",
};

export const PRIORITY_RANK: Record<ActionPriority, number> = { high: 0, medium: 1, low: 2 };
