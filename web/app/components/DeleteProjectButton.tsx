"use client";

import { useState, useTransition } from "react";
import { Trash2 } from "lucide-react";
import { deleteProject } from "@/lib/projects-actions";

export function DeleteProjectButton({ id, name }: { id: string; name: string }) {
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);

  return (
    <>
      <button
        type="button"
        disabled={pending}
        onClick={() => {
          if (
            !window.confirm(
              `Delete "${name}"?\n\nLinked hours and income rows are kept — they are unlinked, not deleted.`,
            )
          )
            return;
          setError(null);
          start(async () => {
            try {
              await deleteProject(id);
            } catch (e) {
              setError(e instanceof Error ? e.message : "Delete failed.");
            }
          });
        }}
        className="inline-flex items-center gap-1.5 rounded-lg border border-neutral-300 dark:border-neutral-700 px-3 py-2 text-sm text-neutral-600 dark:text-neutral-300 hover:border-rose-400 hover:text-rose-600 dark:hover:text-rose-400 disabled:opacity-50"
      >
        <Trash2 className="w-4 h-4" /> Delete
      </button>
      {error ? <span className="text-xs text-rose-600">{error}</span> : null}
    </>
  );
}
