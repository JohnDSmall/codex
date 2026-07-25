"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import type { Contact, StrengthTier } from "@/lib/types";
import { displayName } from "@/lib/relationship";
import { RelationshipCard } from "./RelationshipCard";

type StrengthFilter = "all" | StrengthTier;
type FollowUpFilter = "all" | "scheduled" | "overdue" | "none";
type TrackedFilter = "tracked" | "untracked" | "all";

type SearchField =
  | "any"
  | "name"
  | "company"
  | "university"
  | "interest"
  | "tag"
  | "phone"
  | "email"
  | "notes";

const SEARCH_FIELDS: { value: SearchField; label: string; placeholder: string }[] = [
  { value: "any", label: "Any field", placeholder: "Search any field…" },
  { value: "name", label: "Name", placeholder: "Search by name…" },
  { value: "company", label: "Company", placeholder: "Search by company…" },
  { value: "university", label: "University", placeholder: "Search by university…" },
  { value: "interest", label: "Interest", placeholder: "Search by interest…" },
  { value: "tag", label: "Tag", placeholder: "Search by connection tag…" },
  { value: "phone", label: "Phone", placeholder: "Search by phone number…" },
  { value: "email", label: "Email", placeholder: "Search by email…" },
  { value: "notes", label: "Notes", placeholder: "Search inside notes…" },
];

const PAGE_SIZE = 60;

function fieldValues(c: Contact, field: SearchField): string[] {
  switch (field) {
    case "name":
      return [c.full_name, c.first_name, c.last_name, c.nickname].filter(Boolean) as string[];
    case "company":
      return [
        c.primary_company,
        c.organization,
        c.job_title,
        ...(c.company_tags ?? []),
      ].filter(Boolean) as string[];
    case "university":
      return c.university_tags ?? [];
    case "interest":
      return c.interest_tags ?? [];
    case "tag":
      return [...(c.connection_tags ?? []), ...(c.categories ?? [])];
    case "phone":
      return c.phones.map((p) => p.value);
    case "email":
      return c.emails.map((e) => e.value);
    case "notes":
      return [
        c.notes,
        c.looking_for,
        c.connection_source,
        ...(c.timeline_notes ?? []).map((n) => n.content),
        ...(c.reminders ?? []),
      ].filter(Boolean) as string[];
    case "any":
    default:
      return [
        c.full_name,
        c.first_name,
        c.last_name,
        c.nickname,
        c.primary_company,
        c.organization,
        c.job_title,
        ...(c.company_tags ?? []),
        ...(c.university_tags ?? []),
        ...(c.interest_tags ?? []),
        ...(c.connection_tags ?? []),
        ...(c.categories ?? []),
        ...c.phones.map((p) => p.value),
        ...c.emails.map((e) => e.value),
        c.notes,
        c.looking_for,
        c.connection_source,
        ...(c.timeline_notes ?? []).map((n) => n.content),
        ...(c.reminders ?? []),
      ].filter(Boolean) as string[];
  }
}

function matchesSearch(c: Contact, q: string, field: SearchField): boolean {
  if (!q) return true;
  const needle = q.toLowerCase();
  const hay = fieldValues(c, field).join(" ").toLowerCase();
  return hay.includes(needle);
}

function isOverdue(c: Contact): boolean {
  if (!c.target_contact_date) return false;
  return new Date(c.target_contact_date + "T00:00:00").getTime() < Date.now();
}

export function RelationshipsList({ contacts }: { contacts: Contact[] }) {
  const [query, setQuery] = useState("");
  const [searchField, setSearchField] = useState<SearchField>("name");
  const [tracked, setTracked] = useState<TrackedFilter>("tracked");
  const [strength, setStrength] = useState<StrengthFilter>("all");
  const [followUp, setFollowUp] = useState<FollowUpFilter>("all");
  const [shown, setShown] = useState(PAGE_SIZE);

  const filtered = useMemo(() => {
    return contacts.filter((c) => {
      if (!matchesSearch(c, query, searchField)) return false;
      if (tracked === "tracked" && !c.tracked) return false;
      if (tracked === "untracked" && c.tracked) return false;
      if (strength !== "all" && c.strength_tier !== strength) return false;
      if (followUp === "scheduled" && !c.target_contact_date) return false;
      if (followUp === "overdue" && !isOverdue(c)) return false;
      if (followUp === "none" && c.target_contact_date) return false;
      return true;
    });
  }, [contacts, query, searchField, tracked, strength, followUp]);

  const visible = filtered.slice(0, shown);

  function handleQuery(v: string) {
    setQuery(v);
    setShown(PAGE_SIZE);
  }

  function handleFieldChange(v: string) {
    setSearchField(v as SearchField);
    setShown(PAGE_SIZE);
  }

  const placeholder =
    SEARCH_FIELDS.find((f) => f.value === searchField)?.placeholder ?? "Search…";

  return (
    <>
      <div className="rounded-xl border border-neutral-200 dark:border-neutral-800 bg-white dark:bg-neutral-900 p-3 flex flex-wrap items-center gap-3">
        <div className="flex flex-1 min-w-[280px] items-stretch overflow-hidden rounded-lg border border-neutral-300 dark:border-neutral-700 focus-within:border-indigo-500">
          <select
            value={searchField}
            onChange={(e) => handleFieldChange(e.target.value)}
            className="bg-neutral-50 dark:bg-neutral-800 border-r border-neutral-300 dark:border-neutral-700 px-3 text-sm outline-none cursor-pointer"
            aria-label="Search field"
          >
            {SEARCH_FIELDS.map((f) => (
              <option key={f.value} value={f.value}>
                {f.label}
              </option>
            ))}
          </select>
          <input
            type="search"
            value={query}
            onChange={(e) => handleQuery(e.target.value)}
            placeholder={placeholder}
            className="flex-1 min-w-0 bg-transparent px-3 py-2 text-sm outline-none"
          />
        </div>
        <Select
          value={tracked}
          onChange={(v) => setTracked(v as TrackedFilter)}
          options={[
            { value: "tracked", label: "Tracked only" },
            { value: "untracked", label: "Untracked only" },
            { value: "all", label: "All relationships" },
          ]}
        />
        <Select
          value={strength}
          onChange={(v) => setStrength(v as StrengthFilter)}
          options={[
            { value: "all", label: "All strengths" },
            { value: "strong", label: "Strong" },
            { value: "medium", label: "Medium" },
            { value: "weak", label: "Weak" },
            { value: "loose", label: "Loose" },
            { value: "none", label: "Untiered" },
          ]}
        />
        <Select
          value={followUp}
          onChange={(v) => setFollowUp(v as FollowUpFilter)}
          options={[
            { value: "all", label: "All follow-ups" },
            { value: "scheduled", label: "Scheduled" },
            { value: "overdue", label: "Overdue" },
            { value: "none", label: "Not following up" },
          ]}
        />
        <div className="text-sm text-neutral-500 tabular-nums whitespace-nowrap">
          {filtered.length.toLocaleString()} / {contacts.length.toLocaleString()}
        </div>
      </div>

      {filtered.length === 0 ? (
        <div className="rounded-xl border border-neutral-200 dark:border-neutral-800 bg-white dark:bg-neutral-900 p-10 text-center text-neutral-500">
          No relationships match these filters.
        </div>
      ) : (
        <>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {visible.map((c) => (
              <Link
                key={c.id}
                href={`/relationships/${c.id}`}
                className="block focus:outline-none focus:ring-2 focus:ring-indigo-500 rounded-xl"
              >
                <RelationshipCard contact={c} />
              </Link>
            ))}
          </div>
          {shown < filtered.length && (
            <div className="flex justify-center pt-2">
              <button
                onClick={() => setShown((s) => s + PAGE_SIZE)}
                className="rounded-lg border border-neutral-300 dark:border-neutral-700 bg-white dark:bg-neutral-900 px-4 py-2 text-sm font-medium hover:bg-neutral-50 dark:hover:bg-neutral-800"
              >
                Show more · {Math.min(PAGE_SIZE, filtered.length - shown)} of {filtered.length - shown} remaining
              </button>
            </div>
          )}
        </>
      )}
    </>
  );
}

function Select({
  value,
  onChange,
  options,
}: {
  value: string;
  onChange: (v: string) => void;
  options: { value: string; label: string }[];
}) {
  return (
    <select
      value={value}
      onChange={(e) => onChange(e.target.value)}
      className="rounded-lg border border-neutral-300 dark:border-neutral-700 bg-white dark:bg-neutral-900 px-3 py-2 text-sm outline-none focus:border-indigo-500"
    >
      {options.map((o) => (
        <option key={o.value} value={o.value}>
          {o.label}
        </option>
      ))}
    </select>
  );
}

// Re-export displayName for places that import it via the component
export { displayName };
