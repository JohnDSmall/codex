"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Plus, X } from "lucide-react";
import type {
  Contact,
  ContactFrequency,
  Priority,
  StrengthTier,
  TimelineNote,
} from "@/lib/types";
import type { EditableContactInput } from "@/lib/actions";

type Mode = "create" | "edit";

const STRENGTHS: { value: StrengthTier; label: string }[] = [
  { value: "none", label: "None" },
  { value: "loose", label: "Loose" },
  { value: "weak", label: "Weak" },
  { value: "medium", label: "Medium" },
  { value: "strong", label: "Strong" },
];

const PRIORITIES: { value: Priority; label: string }[] = [
  { value: "low", label: "Low" },
  { value: "medium", label: "Medium" },
  { value: "high", label: "High" },
];

const FREQUENCIES: { value: NonNullable<ContactFrequency> | ""; label: string }[] = [
  { value: "", label: "None" },
  { value: "weekly", label: "Weekly" },
  { value: "monthly", label: "Monthly" },
  { value: "quarterly", label: "Quarterly" },
  { value: "biannually", label: "Biannually" },
  { value: "yearly", label: "Yearly" },
];

type FormState = Required<{
  full_name: string;
  nickname: string;
  job_title: string;
  primary_company: string;
  strength_tier: StrengthTier;
  priority: Priority;
  tracked: boolean;
  follow_up_fl: boolean;
  last_contact_date: string;
  target_contact_date: string;
  contact_frequency: "" | NonNullable<ContactFrequency>;
  linkedin: string;
  notes: string;
  looking_for: string;
  connection_source: string;
  company_tags: string[];
  connection_tags: string[];
  interest_tags: string[];
  university_tags: string[];
  reminders: string[];
  timeline_notes: TimelineNote[];
}>;

function initialState(c?: Contact | null): FormState {
  return {
    full_name: c?.full_name ?? "",
    nickname: c?.nickname ?? "",
    job_title: c?.job_title ?? "",
    primary_company: c?.primary_company ?? c?.organization ?? "",
    strength_tier: c?.strength_tier ?? "none",
    priority: c?.priority ?? "low",
    tracked: c?.tracked ?? true,
    follow_up_fl: c?.follow_up_fl ?? false,
    last_contact_date: c?.last_contact_date ?? "",
    target_contact_date: c?.target_contact_date ?? "",
    contact_frequency: (c?.contact_frequency as NonNullable<ContactFrequency> | undefined) ?? "",
    linkedin: c?.linkedin ?? "",
    notes: c?.notes ?? "",
    looking_for: c?.looking_for ?? "",
    connection_source: c?.connection_source ?? "",
    company_tags: c?.company_tags ?? [],
    connection_tags: c?.connection_tags ?? [],
    interest_tags: c?.interest_tags ?? [],
    university_tags: c?.university_tags ?? [],
    reminders: c?.reminders ?? [],
    timeline_notes: c?.timeline_notes ?? [],
  };
}

function toInput(s: FormState): EditableContactInput {
  return {
    full_name: s.full_name.trim() || null,
    nickname: s.nickname,
    job_title: s.job_title,
    primary_company: s.primary_company,
    strength_tier: s.strength_tier,
    priority: s.priority,
    tracked: s.tracked,
    follow_up_fl: s.follow_up_fl,
    last_contact_date: s.last_contact_date || null,
    target_contact_date: s.target_contact_date || null,
    contact_frequency: s.contact_frequency || null,
    linkedin: s.linkedin,
    notes: s.notes,
    looking_for: s.looking_for,
    connection_source: s.connection_source,
    company_tags: s.company_tags,
    connection_tags: s.connection_tags,
    interest_tags: s.interest_tags,
    university_tags: s.university_tags,
    reminders: s.reminders.filter((r) => r.trim() !== ""),
    timeline_notes: s.timeline_notes.filter((n) => n.content.trim() !== ""),
  };
}

export function RelationshipForm({
  mode,
  contact,
  onSubmit,
  cancelHref,
}: {
  mode: Mode;
  contact?: Contact | null;
  onSubmit: (input: EditableContactInput) => Promise<void>;
  cancelHref: string;
}) {
  const router = useRouter();
  const [state, setState] = useState<FormState>(() => initialState(contact));
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function set<K extends keyof FormState>(key: K, value: FormState[K]) {
    setState((s) => ({ ...s, [key]: value }));
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (!state.full_name.trim()) {
      setError("Name is required.");
      return;
    }
    startTransition(async () => {
      try {
        await onSubmit(toInput(state));
        // Server action handles redirect; nothing else to do.
      } catch (err) {
        setError(err instanceof Error ? err.message : String(err));
      }
    });
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      {error && (
        <div className="rounded-lg border border-rose-200 dark:border-rose-500/40 bg-rose-50 dark:bg-rose-500/10 text-rose-700 dark:text-rose-300 p-3 text-sm">
          {error}
        </div>
      )}

      <Section title="Identity">
        <Field label="Full name" required>
          <input
            type="text"
            value={state.full_name}
            onChange={(e) => set("full_name", e.target.value)}
            className={inputClass}
            required
          />
        </Field>
        <Field label="Nickname">
          <input type="text" value={state.nickname} onChange={(e) => set("nickname", e.target.value)} className={inputClass} />
        </Field>
        <Field label="Job title">
          <input type="text" value={state.job_title} onChange={(e) => set("job_title", e.target.value)} className={inputClass} />
        </Field>
        <Field label="Primary company">
          <input type="text" value={state.primary_company} onChange={(e) => set("primary_company", e.target.value)} className={inputClass} />
        </Field>
        <Field label="LinkedIn URL">
          <input type="url" value={state.linkedin} onChange={(e) => set("linkedin", e.target.value)} className={inputClass} placeholder="https://linkedin.com/in/…" />
        </Field>
      </Section>

      <Section title="Status">
        <Field label="Strength">
          <select value={state.strength_tier} onChange={(e) => set("strength_tier", e.target.value as StrengthTier)} className={inputClass}>
            {STRENGTHS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
          </select>
        </Field>
        <Field label="Priority">
          <select value={state.priority} onChange={(e) => set("priority", e.target.value as Priority)} className={inputClass}>
            {PRIORITIES.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
          </select>
        </Field>
        <Field label="Tracked">
          <label className="flex items-center gap-2 text-sm">
            <input type="checkbox" checked={state.tracked} onChange={(e) => set("tracked", e.target.checked)} className="rounded" />
            <span className="text-neutral-600 dark:text-neutral-400">Show as a tracked relationship</span>
          </label>
        </Field>
        <Field label="Follow-up flag">
          <label className="flex items-center gap-2 text-sm">
            <input type="checkbox" checked={state.follow_up_fl} onChange={(e) => set("follow_up_fl", e.target.checked)} className="rounded" />
            <span className="text-neutral-600 dark:text-neutral-400">Actively following up</span>
          </label>
        </Field>
      </Section>

      <Section title="Schedule">
        <Field label="Last contact date">
          <input type="date" value={state.last_contact_date} onChange={(e) => set("last_contact_date", e.target.value)} className={inputClass} />
        </Field>
        <Field label="Next contact date">
          <input type="date" value={state.target_contact_date} onChange={(e) => set("target_contact_date", e.target.value)} className={inputClass} />
        </Field>
        <Field label="Cadence">
          <select value={state.contact_frequency} onChange={(e) => set("contact_frequency", e.target.value as FormState["contact_frequency"])} className={inputClass}>
            {FREQUENCIES.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
          </select>
        </Field>
      </Section>

      <Section title="Profile">
        <Field label="How we connected">
          <input type="text" value={state.connection_source} onChange={(e) => set("connection_source", e.target.value)} className={inputClass} placeholder="e.g. Met at Halo dinner via Greg Andrews" />
        </Field>
        <Field label="Looking for">
          <textarea value={state.looking_for} onChange={(e) => set("looking_for", e.target.value)} className={inputClass} rows={2} />
        </Field>
        <Field label="Company tags" fullWidth>
          <ChipInput
            values={state.company_tags}
            onChange={(v) => set("company_tags", v)}
            placeholder="Add a past or related company…"
          />
        </Field>
        <Field label="Connection tags" fullWidth>
          <ChipInput
            values={state.connection_tags}
            onChange={(v) => set("connection_tags", v)}
            placeholder="e.g. Poker, Data Analyst…"
          />
        </Field>
        <Field label="Interests" fullWidth>
          <ChipInput
            values={state.interest_tags}
            onChange={(v) => set("interest_tags", v)}
            placeholder="e.g. AI, Endurance Sports…"
          />
        </Field>
        <Field label="Universities" fullWidth>
          <ChipInput
            values={state.university_tags}
            onChange={(v) => set("university_tags", v)}
            placeholder="e.g. Notre Dame…"
          />
        </Field>
      </Section>

      <Section title="Reminders">
        <Field fullWidth>
          <ChipInput
            values={state.reminders}
            onChange={(v) => set("reminders", v)}
            placeholder="Add a reminder, then press Enter…"
            multiline
          />
        </Field>
      </Section>

      <Section title="Timeline notes">
        <Field fullWidth>
          <TimelineEditor
            notes={state.timeline_notes}
            onChange={(v) => set("timeline_notes", v)}
          />
        </Field>
      </Section>

      <Section title="Notes">
        <Field fullWidth>
          <textarea value={state.notes} onChange={(e) => set("notes", e.target.value)} className={inputClass} rows={5} />
        </Field>
      </Section>

      <div className="flex items-center justify-end gap-2 sticky bottom-0 bg-neutral-50/95 dark:bg-neutral-950/95 backdrop-blur border-t border-neutral-200 dark:border-neutral-800 py-3 -mx-4 px-4">
        <button
          type="button"
          onClick={() => router.push(cancelHref)}
          className="rounded-lg border border-neutral-300 dark:border-neutral-700 px-4 py-2 text-sm hover:bg-neutral-100 dark:hover:bg-neutral-800"
          disabled={pending}
        >
          Cancel
        </button>
        <button
          type="submit"
          disabled={pending}
          className="rounded-lg bg-indigo-600 hover:bg-indigo-500 disabled:opacity-60 px-4 py-2 text-sm font-medium text-white"
        >
          {pending ? "Saving…" : mode === "create" ? "Create relationship" : "Save changes"}
        </button>
      </div>
    </form>
  );
}

const inputClass =
  "w-full rounded-lg border border-neutral-300 dark:border-neutral-700 bg-white dark:bg-neutral-900 px-3 py-2 text-sm outline-none focus:border-indigo-500";

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="rounded-xl border border-neutral-200 dark:border-neutral-800 bg-white dark:bg-neutral-900 p-4">
      <h2 className="text-sm font-medium text-neutral-700 dark:text-neutral-300 mb-3">{title}</h2>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">{children}</div>
    </section>
  );
}

function Field({
  label,
  required,
  fullWidth,
  children,
}: {
  label?: string;
  required?: boolean;
  fullWidth?: boolean;
  children: React.ReactNode;
}) {
  return (
    <label className={`block ${fullWidth ? "sm:col-span-2" : ""}`}>
      {label && (
        <span className="block text-xs font-medium text-neutral-600 dark:text-neutral-400 mb-1">
          {label}
          {required && <span className="text-rose-500"> *</span>}
        </span>
      )}
      {children}
    </label>
  );
}

function ChipInput({
  values,
  onChange,
  placeholder,
  multiline = false,
}: {
  values: string[];
  onChange: (v: string[]) => void;
  placeholder?: string;
  multiline?: boolean;
}) {
  const [draft, setDraft] = useState("");
  function add() {
    const t = draft.trim();
    if (!t) return;
    if (values.includes(t)) {
      setDraft("");
      return;
    }
    onChange([...values, t]);
    setDraft("");
  }
  function remove(i: number) {
    onChange(values.filter((_, idx) => idx !== i));
  }
  return (
    <div className="space-y-2">
      {values.length > 0 && (
        <div className="flex flex-wrap gap-1.5">
          {values.map((v, i) => (
            <span
              key={`${v}-${i}`}
              className="inline-flex items-center gap-1 rounded-full bg-neutral-100 dark:bg-neutral-800 px-2 py-0.5 text-xs"
            >
              <span className="whitespace-pre-wrap">{v}</span>
              <button
                type="button"
                onClick={() => remove(i)}
                className="text-neutral-400 hover:text-rose-500"
                aria-label="Remove"
              >
                <X className="w-3 h-3" />
              </button>
            </span>
          ))}
        </div>
      )}
      <div className="flex gap-2">
        {multiline ? (
          <textarea
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && (e.ctrlKey || e.metaKey)) {
                e.preventDefault();
                add();
              }
            }}
            placeholder={placeholder}
            className={inputClass}
            rows={2}
          />
        ) : (
          <input
            type="text"
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault();
                add();
              }
            }}
            placeholder={placeholder}
            className={inputClass}
          />
        )}
        <button
          type="button"
          onClick={add}
          className="rounded-lg border border-neutral-300 dark:border-neutral-700 px-3 text-sm hover:bg-neutral-50 dark:hover:bg-neutral-800 inline-flex items-center gap-1"
        >
          <Plus className="w-3.5 h-3.5" /> Add
        </button>
      </div>
    </div>
  );
}

function TimelineEditor({
  notes,
  onChange,
}: {
  notes: TimelineNote[];
  onChange: (v: TimelineNote[]) => void;
}) {
  const today = new Date().toISOString().split("T")[0];
  function addNote() {
    onChange([...notes, { date: today, content: "" }]);
  }
  function update(i: number, patch: Partial<TimelineNote>) {
    onChange(notes.map((n, idx) => (idx === i ? { ...n, ...patch } : n)));
  }
  function remove(i: number) {
    onChange(notes.filter((_, idx) => idx !== i));
  }
  const sorted = notes
    .map((n, i) => ({ n, i }))
    .sort((a, b) => b.n.date.localeCompare(a.n.date));
  return (
    <div className="space-y-2">
      {sorted.map(({ n, i }) => (
        <div
          key={i}
          className="rounded-lg border border-neutral-200 dark:border-neutral-800 p-2 space-y-2"
        >
          <div className="flex items-center gap-2">
            <input
              type="date"
              value={n.date}
              onChange={(e) => update(i, { date: e.target.value })}
              className={`${inputClass} w-40 shrink-0`}
            />
            <button
              type="button"
              onClick={() => remove(i)}
              className="ml-auto text-neutral-400 hover:text-rose-500 p-2 shrink-0"
              aria-label="Remove"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
          <textarea
            value={n.content}
            onChange={(e) => update(i, { content: e.target.value })}
            placeholder="Note…"
            className={`${inputClass} w-full`}
            rows={3}
          />
        </div>
      ))}
      <button
        type="button"
        onClick={addNote}
        className="rounded-lg border border-neutral-300 dark:border-neutral-700 px-3 py-2 text-sm hover:bg-neutral-50 dark:hover:bg-neutral-800 inline-flex items-center gap-1"
      >
        <Plus className="w-3.5 h-3.5" /> Add note
      </button>
    </div>
  );
}
