"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { Plus, X } from "lucide-react";
import type { Project, ProjectContact } from "@/lib/projects-server";

const STATUSES = [
  { value: "active", label: "Active" },
  { value: "on_hold", label: "On hold" },
  { value: "completed", label: "Completed" },
  { value: "inactive", label: "Inactive" },
  { value: "abandoned", label: "Abandoned" },
];

const PRIORITIES = [
  { value: "high", label: "High" },
  { value: "medium", label: "Medium" },
  { value: "low", label: "Low" },
];

const field =
  "w-full rounded-lg border border-neutral-300 dark:border-neutral-700 bg-white dark:bg-neutral-950 px-3 py-2 text-sm outline-none focus:border-indigo-500";

function Row({
  label,
  hint,
  children,
}: {
  label: string;
  hint?: string;
  children: React.ReactNode;
}) {
  return (
    <label className="block space-y-1">
      <span className="text-xs font-medium text-neutral-600 dark:text-neutral-400">{label}</span>
      {children}
      {hint ? <span className="block text-[11px] text-neutral-500">{hint}</span> : null}
    </label>
  );
}

export function ProjectForm({
  project,
  clients,
  action,
  submitLabel,
  cancelHref,
}: {
  project?: Project | null;
  clients: string[];
  action: (formData: FormData) => Promise<void>;
  submitLabel: string;
  cancelHref: string;
}) {
  // Only the repeating contact rows need state; everything else is uncontrolled.
  const [contacts, setContacts] = useState<ProjectContact[]>(
    project?.contacts?.length ? project.contacts : [],
  );
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();

  function submit(fd: FormData) {
    setError(null);
    start(async () => {
      try {
        await action(fd);
      } catch (e) {
        // A redirect from the action surfaces here as a thrown control-flow
        // signal; Next re-throws it, so only real failures reach this branch.
        setError(e instanceof Error ? e.message : "Could not save this project.");
      }
    });
  }

  return (
    <form action={submit} className="space-y-6">
      <section className="rounded-xl border border-neutral-200 dark:border-neutral-800 bg-white dark:bg-neutral-900 p-4 space-y-4">
        <h2 className="text-sm font-semibold">Basics</h2>
        <Row label="Name">
          <input name="name" required defaultValue={project?.name ?? ""} className={field} />
        </Row>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <Row label="Client">
            <input
              name="client"
              list="project-clients"
              defaultValue={project?.client ?? ""}
              className={field}
            />
            <datalist id="project-clients">
              {clients.map((c) => (
                <option key={c} value={c} />
              ))}
            </datalist>
          </Row>
          <Row label="Tags" hint="Comma separated">
            <input
              name="tags"
              defaultValue={(project?.tags ?? []).join(", ")}
              className={field}
              placeholder="Web Development, MVP"
            />
          </Row>
        </div>
        <Row label="Description">
          <textarea
            name="description"
            rows={3}
            defaultValue={project?.description ?? ""}
            className={field}
          />
        </Row>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
          <Row label="Status">
            <select name="status" defaultValue={project?.status ?? "active"} className={field}>
              {STATUSES.map((s) => (
                <option key={s.value} value={s.value}>{s.label}</option>
              ))}
            </select>
          </Row>
          <Row label="Priority">
            <select
              name="priority"
              defaultValue={(project?.priority ?? "medium").toLowerCase()}
              className={field}
            >
              {PRIORITIES.map((p) => (
                <option key={p.value} value={p.value}>{p.label}</option>
              ))}
            </select>
          </Row>
          <Row label="Start date">
            <input type="date" name="start_date" defaultValue={project?.start_date ?? ""} className={field} />
          </Row>
          <Row label="Due date">
            <input type="date" name="due_date" defaultValue={project?.due_date ?? ""} className={field} />
          </Row>
        </div>
      </section>

      <section className="rounded-xl border border-neutral-200 dark:border-neutral-800 bg-white dark:bg-neutral-900 p-4 space-y-4">
        <div>
          <h2 className="text-sm font-semibold">Targets</h2>
          <p className="text-[11px] text-neutral-500 mt-0.5">
            Hours worked and revenue collected are not set here — they are summed from the hour log
            and the income rows linked to this project.
          </p>
        </div>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
          <Row label="Estimated hours">
            <input
              name="estimated_hours"
              inputMode="decimal"
              defaultValue={project?.estimated_hours ?? 0}
              className={field}
            />
          </Row>
          <Row label="Projected revenue">
            <input
              name="projected_revenue"
              inputMode="decimal"
              defaultValue={project?.projected_revenue ?? 0}
              className={field}
            />
          </Row>
          <Row label="Cost">
            <input name="cost" inputMode="decimal" defaultValue={project?.cost ?? 0} className={field} />
          </Row>
          <div className="grid grid-cols-2 gap-2">
            <Row label="Actions done">
              <input
                name="completed_actions"
                inputMode="numeric"
                defaultValue={project?.completed_actions ?? 0}
                className={field}
              />
            </Row>
            <Row label="Total">
              <input
                name="total_actions"
                inputMode="numeric"
                defaultValue={project?.total_actions ?? 0}
                className={field}
              />
            </Row>
          </div>
        </div>
      </section>

      <section className="rounded-xl border border-neutral-200 dark:border-neutral-800 bg-white dark:bg-neutral-900 p-4 space-y-3">
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-semibold">Contacts</h2>
          <button
            type="button"
            onClick={() => setContacts((c) => [...c, { name: "", role: "", email: "" }])}
            className="inline-flex items-center gap-1.5 rounded-lg border border-neutral-200 dark:border-neutral-700 px-2.5 py-1 text-xs hover:bg-neutral-100 dark:hover:bg-neutral-800"
          >
            <Plus className="w-3.5 h-3.5" /> Add contact
          </button>
        </div>
        {contacts.length === 0 ? (
          <p className="text-xs text-neutral-500">No contacts on this project.</p>
        ) : (
          <div className="space-y-2">
            {contacts.map((c, i) => (
              <div key={i} className="flex flex-wrap items-center gap-2">
                <input
                  name="contact_name"
                  defaultValue={c.name}
                  placeholder="Name"
                  className={`${field} flex-1 min-w-[10rem]`}
                />
                <input
                  name="contact_role"
                  defaultValue={c.role ?? ""}
                  placeholder="Role"
                  className={`${field} flex-1 min-w-[8rem]`}
                />
                <input
                  name="contact_email"
                  type="email"
                  defaultValue={c.email ?? ""}
                  placeholder="Email"
                  className={`${field} flex-1 min-w-[12rem]`}
                />
                <button
                  type="button"
                  aria-label="Remove contact"
                  onClick={() => setContacts((list) => list.filter((_, j) => j !== i))}
                  className="rounded-md p-1.5 text-neutral-400 hover:text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-500/10"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            ))}
          </div>
        )}
        <p className="text-[11px] text-neutral-500">A row with no name is dropped on save.</p>
      </section>

      {error ? (
        <p className="rounded-lg bg-rose-50 dark:bg-rose-500/10 px-3 py-2 text-sm text-rose-700 dark:text-rose-300">
          {error}
        </p>
      ) : null}

      <div className="flex items-center gap-3">
        <button
          type="submit"
          disabled={pending}
          className="rounded-lg bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 px-4 py-2 text-sm font-medium text-white"
        >
          {pending ? "Saving…" : submitLabel}
        </button>
        <Link
          href={cancelHref}
          className="rounded-lg border border-neutral-300 dark:border-neutral-700 px-4 py-2 text-sm hover:bg-neutral-100 dark:hover:bg-neutral-800"
        >
          Cancel
        </Link>
      </div>
    </form>
  );
}
