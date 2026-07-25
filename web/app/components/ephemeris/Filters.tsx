import Link from "next/link";
import type { Category, Filters as F, Tag } from "@/lib/ephemeris-server";
import { lastCompletedMonthRange, trailing3moRange } from "@/lib/ephemeris-server";

const inputCls =
  "rounded-lg border border-neutral-200 dark:border-neutral-700 bg-white dark:bg-neutral-950 px-2.5 py-1.5 text-sm min-w-0";

/**
 * Plain GET form: submitting always emits `from` and `to` (even when blank),
 * which is exactly how "all time" is expressed. Works without JS.
 */
export function Filters({
  basePath,
  filters,
  tags,
  cards,
  categories,
  showCategory = false,
  showSearch = true,
  extraHidden,
}: {
  basePath: string;
  filters: F;
  tags: Tag[];
  cards: string[];
  categories?: Category[];
  showCategory?: boolean;
  showSearch?: boolean;
  extraHidden?: Record<string, string>;
}) {
  const [lmFrom, lmTo] = lastCompletedMonthRange();
  const [m3From, m3To] = trailing3moRange();
  const year = new Date().getUTCFullYear();

  const presets = [
    { label: "Last month", href: `${basePath}?from=${lmFrom}&to=${lmTo}` },
    { label: "Last 3 months", href: `${basePath}?from=${m3From}&to=${m3To}` },
    { label: "YTD", href: `${basePath}?from=${year}-01-01&to=${year}-12-31` },
    { label: "All time", href: `${basePath}?from=&to=` },
  ];

  const activeHref = `${basePath}?from=${filters.from_date ?? ""}&to=${filters.to_date ?? ""}`;

  return (
    <div className="rounded-xl border border-neutral-200 dark:border-neutral-800 bg-white dark:bg-neutral-900 p-3 space-y-3">
      <form method="get" action={basePath} className="flex flex-wrap items-end gap-2">
        {Object.entries(extraHidden ?? {}).map(([k, v]) => (
          <input key={k} type="hidden" name={k} value={v} />
        ))}

        <label className="flex flex-col gap-1">
          <span className="text-xs text-neutral-500">From</span>
          <input type="date" name="from" defaultValue={filters.from_date ?? ""} className={inputCls} />
        </label>

        <label className="flex flex-col gap-1">
          <span className="text-xs text-neutral-500">To</span>
          <input type="date" name="to" defaultValue={filters.to_date ?? ""} className={inputCls} />
        </label>

        <label className="flex flex-col gap-1">
          <span className="text-xs text-neutral-500">Tag</span>
          <select name="tag" defaultValue={filters.tag ?? ""} className={inputCls}>
            <option value="">All tags</option>
            {tags.map((t) => (
              <option key={t.id} value={t.id}>
                {t.name}
              </option>
            ))}
          </select>
        </label>

        {cards.length > 0 && (
          <label className="flex flex-col gap-1">
            <span className="text-xs text-neutral-500">Card</span>
            <select name="card" defaultValue={filters.card ?? ""} className={inputCls}>
              <option value="">All cards</option>
              {cards.map((c) => (
                <option key={c} value={c}>
                  {c}
                </option>
              ))}
            </select>
          </label>
        )}

        {showCategory && categories && categories.length > 0 && (
          <label className="flex flex-col gap-1">
            <span className="text-xs text-neutral-500">Category</span>
            <select name="category" defaultValue={filters.category ?? ""} className={inputCls}>
              <option value="">All categories</option>
              {categories.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.parent} · {c.name}
                </option>
              ))}
            </select>
          </label>
        )}

        {showSearch && (
          <label className="flex flex-col gap-1 flex-1 min-w-[12rem]">
            <span className="text-xs text-neutral-500">Search</span>
            <input
              type="search"
              name="q"
              defaultValue={filters.q ?? ""}
              placeholder="merchant or description"
              className={inputCls + " w-full"}
            />
          </label>
        )}

        <button
          type="submit"
          className="rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white px-3 py-1.5 text-sm font-medium"
        >
          Apply
        </button>
      </form>

      <div className="flex flex-wrap items-center gap-1.5 text-xs">
        <span className="text-neutral-400">Quick range:</span>
        {presets.map((p) => (
          <Link
            key={p.label}
            href={p.href}
            className={
              "rounded-md px-2 py-1 transition-colors " +
              (p.href === activeHref
                ? "bg-indigo-50 dark:bg-indigo-500/10 text-indigo-700 dark:text-indigo-300 font-medium"
                : "text-neutral-500 hover:bg-neutral-100 dark:hover:bg-neutral-800")
            }
          >
            {p.label}
          </Link>
        ))}
      </div>
    </div>
  );
}

/** Renders the human-readable window the current filters describe. */
export function RangeLabel({ filters }: { filters: F }) {
  if (!filters.from_date && !filters.to_date) return <>all time</>;
  if (filters.from_date && filters.to_date) {
    return (
      <>
        {filters.from_date} → {filters.to_date}
      </>
    );
  }
  return <>{filters.from_date ? `from ${filters.from_date}` : `through ${filters.to_date}`}</>;
}
