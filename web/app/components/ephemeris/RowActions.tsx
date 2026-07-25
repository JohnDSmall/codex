"use client";

import { useState, useTransition, type ReactNode } from "react";
import { Trash2, Plus, X } from "lucide-react";

/**
 * Deletes are hard deletes with no undo (same as the Flask app), so unlike the
 * original this asks for confirmation first.
 */
export function DeleteButton({
  onDelete,
  label,
}: {
  onDelete: () => Promise<void>;
  label: string;
}) {
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);

  return (
    <>
      <button
        type="button"
        disabled={pending}
        title={`Delete ${label}`}
        aria-label={`Delete ${label}`}
        onClick={() => {
          if (!window.confirm(`Delete ${label}? This cannot be undone.`)) return;
          setError(null);
          start(async () => {
            try {
              await onDelete();
            } catch (e) {
              setError(e instanceof Error ? e.message : "Delete failed.");
            }
          });
        }}
        className="rounded-md p-1.5 text-neutral-400 hover:text-rose-600 dark:hover:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-500/10 transition-colors disabled:opacity-40"
      >
        <Trash2 className="w-3.5 h-3.5" />
      </button>
      {error ? <span className="text-xs text-rose-600">{error}</span> : null}
    </>
  );
}

/** Collapsible "Add" panel wrapping a Server Action form. */
export function AddPanel({
  title,
  action,
  children,
}: {
  title: string;
  action: (formData: FormData) => Promise<void>;
  children: ReactNode;
}) {
  const [open, setOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="inline-flex items-center gap-1.5 rounded-lg border border-neutral-200 dark:border-neutral-700 px-3 py-1.5 text-sm text-neutral-600 dark:text-neutral-300 hover:bg-neutral-100 dark:hover:bg-neutral-800 transition-colors"
      >
        <Plus className="w-3.5 h-3.5" />
        {title}
      </button>
    );
  }

  return (
    <div className="rounded-xl border border-neutral-200 dark:border-neutral-800 bg-white dark:bg-neutral-900 p-4 space-y-3">
      <div className="flex items-center justify-between">
        <h2 className="text-sm font-medium text-neutral-700 dark:text-neutral-300">{title}</h2>
        <button
          type="button"
          onClick={() => setOpen(false)}
          aria-label="Close"
          className="rounded-md p-1 text-neutral-400 hover:text-neutral-700 dark:hover:text-neutral-200"
        >
          <X className="w-4 h-4" />
        </button>
      </div>
      <form
        action={async (fd) => {
          setError(null);
          try {
            await action(fd);
            setOpen(false);
          } catch (e) {
            setError(e instanceof Error ? e.message : "Could not save.");
          }
        }}
        className="flex flex-wrap items-end gap-2"
      >
        {children}
      </form>
      {error ? <p className="text-xs text-rose-600">{error}</p> : null}
    </div>
  );
}

export const fieldCls =
  "rounded-lg border border-neutral-200 dark:border-neutral-700 bg-white dark:bg-neutral-950 px-2.5 py-1.5 text-sm min-w-0";

export function Field({
  label,
  children,
  grow = false,
}: {
  label: string;
  children: ReactNode;
  grow?: boolean;
}) {
  return (
    <label className={`flex flex-col gap-1 ${grow ? "flex-1 min-w-[10rem]" : ""}`}>
      <span className="text-xs text-neutral-500">{label}</span>
      {children}
    </label>
  );
}

export function SubmitButton({ children }: { children: ReactNode }) {
  return (
    <button
      type="submit"
      className="rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white px-3 py-1.5 text-sm font-medium"
    >
      {children}
    </button>
  );
}
