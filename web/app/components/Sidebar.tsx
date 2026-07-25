"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  LayoutDashboard,
  CalendarDays,
  Target,
  Users,
  FolderKanban,
  LineChart,
  Coins,
  BookOpen,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";

type NavItem = { href: string; label: string; icon: LucideIcon };

const NAV: NavItem[] = [
  { href: "/", label: "Dashboard", icon: LayoutDashboard },
  { href: "/planner", label: "Planner", icon: CalendarDays },
  { href: "/goals", label: "Goals", icon: Target },
  { href: "/relationships", label: "Relationships", icon: Users },
  { href: "/projects", label: "Projects", icon: FolderKanban },
  { href: "/financials", label: "Financials", icon: LineChart },
  { href: "/wealth", label: "Wealth", icon: Coins },
];

export function Sidebar() {
  const pathname = usePathname();
  return (
    <aside className="sticky top-0 h-screen w-60 shrink-0 border-r border-neutral-200 dark:border-neutral-800 bg-white dark:bg-neutral-900 flex flex-col">
      <div className="px-5 py-5 flex items-center gap-2.5 border-b border-neutral-200 dark:border-neutral-800">
        <BookOpen className="w-5 h-5 text-indigo-500" />
        <span className="font-semibold tracking-tight text-lg">Codex</span>
      </div>
      <nav className="flex-1 px-2 py-3 space-y-0.5">
        {NAV.map((item) => {
          const active = isActive(pathname, item.href);
          const Icon = item.icon;
          return (
            <Link
              key={item.href}
              href={item.href}
              className={
                "flex items-center gap-3 rounded-lg px-3 py-2 text-sm transition-colors " +
                (active
                  ? "bg-indigo-50 dark:bg-indigo-500/10 text-indigo-700 dark:text-indigo-300 font-medium"
                  : "text-neutral-600 dark:text-neutral-400 hover:bg-neutral-100 dark:hover:bg-neutral-800 hover:text-neutral-900 dark:hover:text-neutral-100")
              }
            >
              <Icon className="w-4 h-4 shrink-0" />
              <span>{item.label}</span>
            </Link>
          );
        })}
      </nav>
      <div className="px-5 py-3 text-xs text-neutral-400 border-t border-neutral-200 dark:border-neutral-800">
        v0.1
      </div>
    </aside>
  );
}

function isActive(pathname: string, href: string): boolean {
  if (href === "/") return pathname === "/";
  return pathname === href || pathname.startsWith(href + "/");
}
