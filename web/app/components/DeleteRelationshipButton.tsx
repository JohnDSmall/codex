"use client";

import { useState, useTransition } from "react";
import { Trash2 } from "lucide-react";
import { deleteContactAndRedirect } from "@/lib/actions";

export function DeleteRelationshipButton({
  id,
  name,
}: {
  id: string;
  name: string;
}) {
  const [confirming, setConfirming] = useState(false);
  const [pending, startTransition] = useTransition();

  function onDelete() {
    startTransition(async () => {
      await deleteContactAndRedirect(id);
    });
  }

  if (confirming) {
    return (
      <div className="inline-flex items-center gap-2">
        <span className="text-sm text-neutral-600 dark:text-neutral-400">
          Delete {name}?
        </span>
        <button
          type="button"
          onClick={onDelete}
          disabled={pending}
          className="inline-flex items-center gap-1.5 rounded-lg bg-rose-600 hover:bg-rose-500 disabled:opacity-60 px-3 py-1.5 text-sm font-medium text-white"
        >
          <Trash2 className="w-3.5 h-3.5" /> {pending ? "Deleting…" : "Confirm"}
        </button>
        <button
          type="button"
          onClick={() => setConfirming(false)}
          disabled={pending}
          className="rounded-lg border border-neutral-300 dark:border-neutral-700 px-3 py-1.5 text-sm hover:bg-neutral-100 dark:hover:bg-neutral-800"
        >
          Cancel
        </button>
      </div>
    );
  }

  return (
    <button
      type="button"
      onClick={() => setConfirming(true)}
      className="inline-flex items-center gap-1.5 rounded-lg border border-rose-300 dark:border-rose-500/40 text-rose-600 dark:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-500/10 px-3 py-1.5 text-sm font-medium"
    >
      <Trash2 className="w-3.5 h-3.5" /> Delete
    </button>
  );
}
