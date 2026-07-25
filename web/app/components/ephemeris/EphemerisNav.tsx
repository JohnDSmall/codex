"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const TABS = [
  { href: "/ephemeris", label: "Overview" },
  { href: "/ephemeris/spending", label: "Spending" },
  { href: "/ephemeris/subscriptions", label: "Subscriptions" },
  { href: "/ephemeris/expenses", label: "Expenses" },
  { href: "/ephemeris/income", label: "Income" },
  { href: "/ephemeris/assets", label: "Assets" },
  { href: "/ephemeris/hours", label: "Hours" },
];

export function EphemerisNav() {
  const pathname = usePathname();
  return (
    <nav className="flex gap-1 overflow-x-auto border-b border-neutral-200 dark:border-neutral-800 -mb-px">
      {TABS.map((t) => {
        const active = t.href === "/ephemeris" ? pathname === t.href : pathname.startsWith(t.href);
        return (
          <Link
            key={t.href}
            href={t.href}
            className={
              "whitespace-nowrap px-3 py-2 text-sm border-b-2 transition-colors " +
              (active
                ? "border-indigo-500 text-indigo-700 dark:text-indigo-300 font-medium"
                : "border-transparent text-neutral-500 hover:text-neutral-900 dark:hover:text-neutral-100")
            }
          >
            {t.label}
          </Link>
        );
      })}
    </nav>
  );
}
