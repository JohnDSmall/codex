"use client";

import { useMemo, useState } from "react";
import type { Contact } from "@/lib/types";
import { displayName } from "@/lib/stats";

type SortKey = "name" | "organization" | "phones" | "emails";
type SortDir = "asc" | "desc";

function cmpStr(a: string | null, b: string | null, dir: SortDir): number {
  const av = (a ?? "").toLowerCase();
  const bv = (b ?? "").toLowerCase();
  // Empty values always sort to the bottom regardless of direction.
  if (!av && !bv) return 0;
  if (!av) return 1;
  if (!bv) return -1;
  if (av === bv) return 0;
  return (av < bv ? -1 : 1) * (dir === "asc" ? 1 : -1);
}

function cmpNum(a: number, b: number, dir: SortDir): number {
  return (a - b) * (dir === "asc" ? 1 : -1);
}

function matches(c: Contact, q: string): boolean {
  if (!q) return true;
  const needle = q.toLowerCase();
  const hay = [
    c.full_name,
    c.first_name,
    c.last_name,
    c.nickname,
    c.organization,
    c.job_title,
    c.notes,
    ...c.phones.map((p) => p.value),
    ...c.emails.map((e) => e.value),
    ...c.categories,
  ]
    .filter(Boolean)
    .join(" ")
    .toLowerCase();
  return hay.includes(needle);
}

export function ContactsTable({
  contacts,
  onSelect,
}: {
  contacts: Contact[];
  onSelect: (c: Contact) => void;
}) {
  const [query, setQuery] = useState("");
  const [sortKey, setSortKey] = useState<SortKey>("name");
  const [sortDir, setSortDir] = useState<SortDir>("asc");

  const filtered = useMemo(() => contacts.filter((c) => matches(c, query)), [contacts, query]);

  const sorted = useMemo(() => {
    const arr = [...filtered];
    arr.sort((a, b) => {
      switch (sortKey) {
        case "name": {
          const an = a.full_name || a.first_name || a.last_name || a.organization;
          const bn = b.full_name || b.first_name || b.last_name || b.organization;
          return cmpStr(an, bn, sortDir);
        }
        case "organization":
          return cmpStr(a.organization, b.organization, sortDir);
        case "phones":
          return cmpNum(a.phones.length, b.phones.length, sortDir);
        case "emails":
          return cmpNum(a.emails.length, b.emails.length, sortDir);
      }
    });
    return arr;
  }, [filtered, sortKey, sortDir]);

  function toggleSort(k: SortKey) {
    if (sortKey === k) {
      setSortDir(sortDir === "asc" ? "desc" : "asc");
    } else {
      setSortKey(k);
      setSortDir("asc");
    }
  }

  const arrow = (k: SortKey) => (sortKey === k ? (sortDir === "asc" ? " ↑" : " ↓") : "");

  return (
    <div className="rounded-xl border border-neutral-200 dark:border-neutral-800 bg-white dark:bg-neutral-900 overflow-hidden">
      <div className="flex items-center gap-3 p-3 border-b border-neutral-200 dark:border-neutral-800">
        <input
          type="search"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search name, org, phone, email, notes…"
          className="w-full rounded-lg border border-neutral-300 dark:border-neutral-700 bg-transparent px-3 py-2 text-sm outline-none focus:border-indigo-500"
        />
        <div className="text-sm text-neutral-500 tabular-nums whitespace-nowrap">
          {sorted.length.toLocaleString()} / {contacts.length.toLocaleString()}
        </div>
      </div>
      <div className="max-h-[640px] overflow-auto">
        <table className="w-full text-sm">
          <thead className="sticky top-0 bg-neutral-50 dark:bg-neutral-950 z-10">
            <tr className="text-left text-neutral-500">
              <Th onClick={() => toggleSort("name")}>Name{arrow("name")}</Th>
              <Th onClick={() => toggleSort("organization")}>Organization{arrow("organization")}</Th>
              <Th onClick={() => toggleSort("phones")} className="w-24">
                Phones{arrow("phones")}
              </Th>
              <Th onClick={() => toggleSort("emails")} className="w-24">
                Emails{arrow("emails")}
              </Th>
              <th className="px-3 py-2 font-medium">Primary contact</th>
            </tr>
          </thead>
          <tbody>
            {sorted.map((c) => (
              <tr
                key={c.id}
                onClick={() => onSelect(c)}
                className="border-t border-neutral-100 dark:border-neutral-800 hover:bg-neutral-50 dark:hover:bg-neutral-950 cursor-pointer"
              >
                <td className="px-3 py-2 font-medium">{displayName(c)}</td>
                <td className="px-3 py-2 text-neutral-600 dark:text-neutral-400">
                  {c.organization ?? ""}
                </td>
                <td className="px-3 py-2 tabular-nums text-neutral-600 dark:text-neutral-400">
                  {c.phones.length || ""}
                </td>
                <td className="px-3 py-2 tabular-nums text-neutral-600 dark:text-neutral-400">
                  {c.emails.length || ""}
                </td>
                <td className="px-3 py-2 text-neutral-600 dark:text-neutral-400 font-mono text-xs truncate max-w-[280px]">
                  {c.phones[0]?.value ?? c.emails[0]?.value ?? ""}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {sorted.length === 0 && (
          <div className="text-center p-12 text-neutral-500">No contacts match your search.</div>
        )}
      </div>
    </div>
  );
}

function Th({
  children,
  onClick,
  className = "",
}: {
  children: React.ReactNode;
  onClick?: () => void;
  className?: string;
}) {
  return (
    <th
      onClick={onClick}
      className={`px-3 py-2 font-medium select-none ${onClick ? "cursor-pointer hover:text-neutral-900 dark:hover:text-neutral-100" : ""} ${className}`}
    >
      {children}
    </th>
  );
}
