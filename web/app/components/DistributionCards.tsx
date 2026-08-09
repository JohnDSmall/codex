import type { CompetencyBucket, StrengthBucket } from "@/lib/stats";

/**
 * Horizontal bars rather than a chart library: these are small, ordered,
 * labelled distributions where the number matters more than the shape, and
 * they render on the server with no hydration cost.
 */
function Bar({
  label,
  count,
  max,
  tone = "indigo",
  hint,
}: {
  label: string;
  count: number;
  max: number;
  tone?: "indigo" | "emerald" | "neutral";
  hint?: string;
}) {
  const pct = max > 0 ? (count / max) * 100 : 0;
  const fill =
    tone === "emerald" ? "bg-emerald-500" : tone === "neutral" ? "bg-neutral-400" : "bg-indigo-500";
  return (
    <div className="flex items-center gap-3 text-sm">
      <span className="w-16 shrink-0 text-neutral-600 dark:text-neutral-400">{label}</span>
      <span className="flex-1 h-2 rounded-full bg-neutral-100 dark:bg-neutral-800 overflow-hidden">
        <span className={`block h-full ${fill}`} style={{ width: `${pct}%` }} />
      </span>
      <span className="w-12 shrink-0 text-right tabular-nums font-medium">{count}</span>
      {hint ? <span className="w-14 shrink-0 text-right text-xs text-neutral-400">{hint}</span> : null}
    </div>
  );
}

export function CompetencyCard({
  buckets,
  rated,
  unrated,
  average,
}: {
  buckets: CompetencyBucket[];
  rated: number;
  unrated: number;
  average: number | null;
}) {
  const max = Math.max(1, ...buckets.map((b) => b.count));
  return (
    <div className="rounded-xl border border-neutral-200 dark:border-neutral-800 bg-white dark:bg-neutral-900 p-4">
      <div className="flex items-baseline justify-between gap-3 mb-3">
        <h3 className="font-semibold text-sm">Competency</h3>
        <span className="text-xs text-neutral-500">
          {average === null ? "none rated yet" : `avg ${average.toFixed(1)} / 10`}
        </span>
      </div>

      {rated === 0 ? (
        <p className="text-sm text-neutral-500">
          Nobody rated yet. Set a competency on a relationship and it will show here.
        </p>
      ) : (
        <div className="space-y-1.5">
          {buckets.map((b) => (
            <Bar key={b.label} label={b.label} count={b.count} max={max} />
          ))}
        </div>
      )}

      {/* Unrated is deliberately outside the 1-10 bars: it is missing data, not
          a low score, and folding it in would drag the distribution down. */}
      <div className="mt-3 pt-3 border-t border-neutral-100 dark:border-neutral-800 flex items-center justify-between text-xs">
        <span className="text-neutral-500">Rated</span>
        <span className="tabular-nums font-medium">{rated}</span>
      </div>
      <div className="flex items-center justify-between text-xs mt-1">
        <span className="text-neutral-500">Unrated</span>
        <span className="tabular-nums text-neutral-400">{unrated}</span>
      </div>
    </div>
  );
}

export function StrengthCard({ buckets }: { buckets: StrengthBucket[] }) {
  const max = Math.max(1, ...buckets.map((b) => b.count));
  const total = buckets.reduce((s, b) => s + b.count, 0);
  const connected = buckets.filter((b) => b.tier !== "none").reduce((s, b) => s + b.count, 0);
  return (
    <div className="rounded-xl border border-neutral-200 dark:border-neutral-800 bg-white dark:bg-neutral-900 p-4">
      <div className="flex items-baseline justify-between gap-3 mb-3">
        <h3 className="font-semibold text-sm">Connection strength</h3>
        <span className="text-xs text-neutral-500">
          {total > 0 ? `${Math.round((connected / total) * 100)}% tiered` : ""}
        </span>
      </div>
      <div className="space-y-1.5">
        {buckets.map((b) => (
          <Bar
            key={b.tier}
            label={b.label}
            count={b.count}
            max={max}
            tone={b.tier === "none" ? "neutral" : b.tier === "strong" ? "emerald" : "indigo"}
            hint={total > 0 ? `${Math.round((b.count / total) * 100)}%` : undefined}
          />
        ))}
      </div>
      <p className="mt-3 pt-3 border-t border-neutral-100 dark:border-neutral-800 text-xs text-neutral-500">
        &ldquo;None&rdquo; means untiered, not a weak relationship — most of the book is an
        untriaged phone import.
      </p>
    </div>
  );
}
