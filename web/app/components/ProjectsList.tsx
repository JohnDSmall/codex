"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import type { ProjectWithTotals } from "@/lib/projects-server";
import { ProjectCard } from "./ProjectCard";

type StatusFilter = "all" | ProjectWithTotals["status"];

const STATUS_OPTIONS: { value: StatusFilter; label: string }[] = [
  { value: "all", label: "All statuses" },
  { value: "active", label: "Active" },
  { value: "on_hold", label: "On hold" },
  { value: "completed", label: "Completed" },
  { value: "inactive", label: "Inactive" },
  { value: "abandoned", label: "Abandoned" },
];

function matches(p: ProjectWithTotals, q: string): boolean {
  if (!q) return true;
  const needle = q.toLowerCase();
  const hay = [
    p.name,
    p.client,
    p.description,
    ...p.tags,
    ...p.contacts.map((c) => c.name),
  ]
    .filter(Boolean)
    .join(" ")
    .toLowerCase();
  return hay.includes(needle);
}

export function ProjectsList({ projects }: { projects: ProjectWithTotals[] }) {
  const [query, setQuery] = useState("");
  const [status, setStatus] = useState<StatusFilter>("all");

  const clients = useMemo(() => {
    const set = new Set<string>();
    for (const p of projects) if (p.client) set.add(p.client);
    return ["all", ...Array.from(set).sort()];
  }, [projects]);
  const [client, setClient] = useState<string>("all");

  const filtered = useMemo(() => {
    return projects.filter((p) => {
      if (!matches(p, query)) return false;
      if (status !== "all" && p.status !== status) return false;
      if (client !== "all" && p.client !== client) return false;
      return true;
    });
  }, [projects, query, status, client]);

  return (
    <>
      <div className="rounded-xl border border-neutral-200 dark:border-neutral-800 bg-white dark:bg-neutral-900 p-3 flex flex-wrap items-center gap-3">
        <input
          type="search"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search project, client, tag, contact…"
          className="flex-1 min-w-[240px] rounded-lg border border-neutral-300 dark:border-neutral-700 bg-transparent px-3 py-2 text-sm outline-none focus:border-indigo-500"
        />
        <select
          value={status}
          onChange={(e) => setStatus(e.target.value as StatusFilter)}
          className="rounded-lg border border-neutral-300 dark:border-neutral-700 bg-white dark:bg-neutral-900 px-3 py-2 text-sm outline-none focus:border-indigo-500"
        >
          {STATUS_OPTIONS.map((o) => (
            <option key={o.value} value={o.value}>{o.label}</option>
          ))}
        </select>
        <select
          value={client}
          onChange={(e) => setClient(e.target.value)}
          className="rounded-lg border border-neutral-300 dark:border-neutral-700 bg-white dark:bg-neutral-900 px-3 py-2 text-sm outline-none focus:border-indigo-500"
        >
          {clients.map((c) => (
            <option key={c} value={c}>{c === "all" ? "All clients" : c}</option>
          ))}
        </select>
        <div className="text-sm text-neutral-500 tabular-nums">
          {filtered.length} / {projects.length}
        </div>
      </div>

      {filtered.length === 0 ? (
        <div className="rounded-xl border border-neutral-200 dark:border-neutral-800 bg-white dark:bg-neutral-900 p-10 text-center text-neutral-500">
          No projects match these filters.
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filtered.map((p) => (
            <Link
              key={p.id}
              href={`/projects/${p.id}`}
              className="block focus:outline-none focus:ring-2 focus:ring-indigo-500 rounded-xl"
            >
              <ProjectCard project={p} />
            </Link>
          ))}
        </div>
      )}
    </>
  );
}
