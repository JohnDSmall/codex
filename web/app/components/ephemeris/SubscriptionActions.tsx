"use client";

import { useState, useTransition } from "react";
import { Check, X, RotateCcw } from "lucide-react";

type Action = "confirm" | "reject" | "clear";

export function SubscriptionActions({
  merchant,
  status,
  onSet,
}: {
  merchant: string;
  status: "confirmed" | "rejected" | null;
  onSet: (action: Action) => Promise<void>;
}) {
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);

  const run = (action: Action) => {
    setError(null);
    start(async () => {
      try {
        await onSet(action);
      } catch (e) {
        setError(e instanceof Error ? e.message : "Failed.");
      }
    });
  };

  const btn =
    "rounded-md p-1.5 transition-colors disabled:opacity-40 text-neutral-400";

  return (
    <div className="flex items-center justify-end gap-0.5">
      {status !== "confirmed" && (
        <button
          type="button"
          disabled={pending}
          onClick={() => run("confirm")}
          title={`Confirm ${merchant} as a subscription`}
          aria-label={`Confirm ${merchant} as a subscription`}
          className={`${btn} hover:text-emerald-600 dark:hover:text-emerald-400 hover:bg-emerald-50 dark:hover:bg-emerald-500/10`}
        >
          <Check className="w-3.5 h-3.5" />
        </button>
      )}
      {status !== "rejected" && (
        <button
          type="button"
          disabled={pending}
          onClick={() => run("reject")}
          title={`Reject ${merchant} — not a subscription`}
          aria-label={`Reject ${merchant} as a subscription`}
          className={`${btn} hover:text-rose-600 dark:hover:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-500/10`}
        >
          <X className="w-3.5 h-3.5" />
        </button>
      )}
      {status !== null && (
        <button
          type="button"
          disabled={pending}
          onClick={() => run("clear")}
          title={`Clear manual override for ${merchant}`}
          aria-label={`Clear manual override for ${merchant}`}
          className={`${btn} hover:text-neutral-700 dark:hover:text-neutral-200 hover:bg-neutral-100 dark:hover:bg-neutral-800`}
        >
          <RotateCcw className="w-3.5 h-3.5" />
        </button>
      )}
      {error ? <span className="text-xs text-rose-600">{error}</span> : null}
    </div>
  );
}
