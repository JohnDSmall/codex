import type { Summary } from "@/lib/stats";

function pct(n: number, d: number): string {
  if (d === 0) return "0%";
  return `${Math.round((n / d) * 100)}%`;
}

export function StatsCards({ s }: { s: Summary }) {
  const cards = [
    { label: "Total contacts", value: s.total.toLocaleString(), sub: null },
    { label: "With phone", value: s.withPhone.toLocaleString(), sub: pct(s.withPhone, s.total) },
    { label: "With email", value: s.withEmail.toLocaleString(), sub: pct(s.withEmail, s.total) },
    { label: "With org", value: s.withOrg.toLocaleString(), sub: pct(s.withOrg, s.total) },
    { label: "With address", value: s.withAddress.toLocaleString(), sub: pct(s.withAddress, s.total) },
    { label: "With birthday", value: s.withBirthday.toLocaleString(), sub: pct(s.withBirthday, s.total) },
  ];
  return (
    <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
      {cards.map((c) => (
        <div
          key={c.label}
          className="rounded-xl border border-neutral-200 dark:border-neutral-800 bg-white dark:bg-neutral-900 p-4"
        >
          <div className="text-xs uppercase tracking-wider text-neutral-500 dark:text-neutral-400">
            {c.label}
          </div>
          <div className="mt-1 text-2xl font-semibold tabular-nums">{c.value}</div>
          {c.sub && (
            <div className="text-xs text-neutral-500 dark:text-neutral-400 tabular-nums">{c.sub}</div>
          )}
        </div>
      ))}
    </div>
  );
}
