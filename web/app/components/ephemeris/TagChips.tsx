import Link from "next/link";
import type { Tag } from "@/lib/ephemeris-server";

export function TagChips({
  tags,
  active,
  basePath,
}: {
  tags: Tag[];
  active: string | null;
  basePath: string;
}) {
  const cls = (on: boolean) =>
    "rounded-md px-2.5 py-1 text-xs transition-colors " +
    (on
      ? "bg-indigo-50 dark:bg-indigo-500/10 text-indigo-700 dark:text-indigo-300 font-medium"
      : "text-neutral-500 hover:bg-neutral-100 dark:hover:bg-neutral-800");

  return (
    <div className="flex flex-wrap items-center gap-1.5">
      <span className="text-xs text-neutral-400">Tag:</span>
      <Link href={basePath} className={cls(!active)}>
        All
      </Link>
      {tags.map((t) => (
        <Link key={t.id} href={`${basePath}?tag=${t.id}`} className={cls(active === t.id)}>
          {t.name}
        </Link>
      ))}
    </div>
  );
}
