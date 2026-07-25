import type { ReactNode } from "react";

/* Formatting — matches WealthView so money reads identically app-wide. */

export function fmtMoney(n: number): string {
  const sign = n < 0 ? "-" : "";
  const abs = Math.abs(n);
  if (abs >= 1_000_000) return `${sign}$${(abs / 1_000_000).toFixed(2)}M`;
  if (abs >= 1_000) return `${sign}$${(abs / 1_000).toFixed(abs >= 10_000 ? 0 : 1)}k`;
  return `${sign}$${abs.toLocaleString()}`;
}

export function fmtMoneyFull(n: number): string {
  return n.toLocaleString(undefined, {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 0,
  });
}

export function fmtMoneyExact(n: number): string {
  return n.toLocaleString(undefined, {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

/** "2026-03" -> "Mar 2026" */
export function fmtMonth(m: string): string {
  const [y, mm] = m.split("-");
  const d = new Date(Date.UTC(Number(y), Number(mm) - 1, 1));
  return d.toLocaleString(undefined, { month: "short", year: "numeric", timeZone: "UTC" });
}

/* Primitives */

export function PageHeader({ title, subtitle }: { title: string; subtitle?: ReactNode }) {
  return (
    <header>
      <h1 className="text-2xl font-semibold">{title}</h1>
      {subtitle ? <p className="text-sm text-neutral-500">{subtitle}</p> : null}
    </header>
  );
}

export function Kpi({
  label,
  value,
  hint,
  accent = false,
  tone,
}: {
  label: string;
  value: string;
  hint?: ReactNode;
  accent?: boolean;
  tone?: "positive" | "negative";
}) {
  const toneClass =
    tone === "positive"
      ? "text-emerald-600 dark:text-emerald-400"
      : tone === "negative"
        ? "text-rose-600 dark:text-rose-400"
        : accent
          ? "text-indigo-700 dark:text-indigo-300"
          : "";
  return (
    <div
      className={`rounded-xl border p-4 ${
        accent
          ? "border-indigo-200 dark:border-indigo-500/30 bg-indigo-50/40 dark:bg-indigo-500/5"
          : "border-neutral-200 dark:border-neutral-800 bg-white dark:bg-neutral-900"
      }`}
    >
      <div className="text-xs uppercase tracking-wider text-neutral-500">{label}</div>
      <div className={`mt-1 text-3xl font-semibold tabular-nums ${toneClass}`}>{value}</div>
      {hint ? <div className="mt-1 text-xs text-neutral-400">{hint}</div> : null}
    </div>
  );
}

export function Card({
  title,
  action,
  children,
  padded = true,
}: {
  title?: string;
  action?: ReactNode;
  children: ReactNode;
  padded?: boolean;
}) {
  return (
    <div className="rounded-xl border border-neutral-200 dark:border-neutral-800 bg-white dark:bg-neutral-900 overflow-hidden">
      {title ? (
        <div className="px-4 py-3 border-b border-neutral-200 dark:border-neutral-800 flex items-center justify-between gap-3">
          <h2 className="text-sm font-medium text-neutral-700 dark:text-neutral-300">{title}</h2>
          {action}
        </div>
      ) : null}
      <div className={padded ? "p-4" : ""}>{children}</div>
    </div>
  );
}

/** Tables scroll inside their own container so the page never scrolls sideways. */
export function TableWrap({ children }: { children: ReactNode }) {
  return <div className="overflow-x-auto">{children}</div>;
}

export function Th({
  children,
  right = false,
}: {
  children: ReactNode;
  right?: boolean;
}) {
  return (
    <th className={`px-4 py-2 font-medium whitespace-nowrap ${right ? "text-right" : ""}`}>
      {children}
    </th>
  );
}

export function Td({
  children,
  right = false,
  muted = false,
  className = "",
}: {
  children: ReactNode;
  right?: boolean;
  muted?: boolean;
  className?: string;
}) {
  return (
    <td
      className={`px-4 py-2 ${right ? "text-right tabular-nums" : ""} ${
        muted ? "text-neutral-500" : ""
      } ${className}`}
    >
      {children}
    </td>
  );
}

export function Empty({ children }: { children: ReactNode }) {
  return <p className="text-sm text-neutral-400">{children}</p>;
}

export function TagPill({ name }: { name: string | null }) {
  if (!name) return <span className="text-neutral-400">—</span>;
  return (
    <span className="inline-flex items-center rounded-md bg-neutral-100 dark:bg-neutral-800 px-2 py-0.5 text-xs text-neutral-600 dark:text-neutral-300 whitespace-nowrap">
      {name}
    </span>
  );
}
