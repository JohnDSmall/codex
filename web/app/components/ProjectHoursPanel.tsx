"use client";

import { useState, useTransition } from "react";
import { Link2Off } from "lucide-react";
import type { HourEntry } from "@/lib/projects-server";
import { deleteHourEntry, logProjectHours, unlinkHourEntry } from "@/lib/projects-actions";
import { AddPanel, DeleteButton, Field, SubmitButton, fieldCls } from "./ephemeris/RowActions";

function fmtDate(d: string): string {
  try {
    return new Date(d + "T00:00:00").toLocaleDateString(undefined, {
      month: "short",
      day: "numeric",
      year: "numeric",
    });
  } catch {
    return d;
  }
}

function UnlinkButton({ id, projectId }: { id: string; projectId: string }) {
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);
  return (
    <>
      <button
        type="button"
        disabled={pending}
        title="Unlink from this project (keeps the hours)"
        aria-label="Unlink from this project"
        onClick={() =>
          start(async () => {
            try {
              await unlinkHourEntry(id, projectId);
            } catch (e) {
              setError(e instanceof Error ? e.message : "Unlink failed.");
            }
          })
        }
        className="rounded-md p-1.5 text-neutral-400 hover:text-amber-600 dark:hover:text-amber-400 hover:bg-amber-50 dark:hover:bg-amber-500/10 transition-colors disabled:opacity-40"
      >
        <Link2Off className="w-3.5 h-3.5" />
      </button>
      {error ? <span className="text-xs text-rose-600">{error}</span> : null}
    </>
  );
}

export function ProjectHoursPanel({
  projectId,
  client,
  entries,
  disabled,
}: {
  projectId: string;
  client: string | null;
  entries: HourEntry[];
  disabled: boolean;
}) {
  const total = entries.reduce((s, r) => s + Number(r.hours || 0), 0);

  return (
    <section className="space-y-3">
      <div className="flex items-end justify-between gap-3 flex-wrap">
        <div>
          <h2 className="text-sm font-semibold">Hour log</h2>
          <p className="text-xs text-neutral-500">
            {entries.length} {entries.length === 1 ? "entry" : "entries"} ·{" "}
            <span className="tabular-nums font-medium">{total.toFixed(1)}</span> hours
          </p>
        </div>
        {!disabled && (
          <AddPanel title="Log hours" action={logProjectHours.bind(null, projectId)}>
            <Field label="Date">
              <input
                type="date"
                name="date"
                required
                defaultValue={new Date().toISOString().slice(0, 10)}
                className={fieldCls}
              />
            </Field>
            <Field label="Hours">
              <input name="hours" inputMode="decimal" required placeholder="1.5" className={fieldCls} />
            </Field>
            <Field label="Rate">
              <input name="rate" inputMode="decimal" placeholder="optional" className={fieldCls} />
            </Field>
            <Field label="Description" grow>
              <input name="description" className={fieldCls} />
            </Field>
            <input type="hidden" name="client" value={client ?? ""} />
            <SubmitButton>Add entry</SubmitButton>
          </AddPanel>
        )}
      </div>

      {entries.length === 0 ? (
        <div className="rounded-xl border border-neutral-200 dark:border-neutral-800 bg-white dark:bg-neutral-900 p-6 text-center text-sm text-neutral-500">
          No hours logged against this project yet.
        </div>
      ) : (
        <div className="overflow-x-auto rounded-xl border border-neutral-200 dark:border-neutral-800 bg-white dark:bg-neutral-900">
          <table className="w-full text-sm">
            <thead className="text-xs text-neutral-500 border-b border-neutral-200 dark:border-neutral-800">
              <tr>
                <th className="text-left font-medium px-3 py-2">Date</th>
                <th className="text-right font-medium px-3 py-2">Hours</th>
                <th className="text-right font-medium px-3 py-2">Rate</th>
                <th className="text-left font-medium px-3 py-2">Description</th>
                <th className="px-3 py-2" />
              </tr>
            </thead>
            <tbody>
              {entries.map((e) => (
                <tr key={e.id} className="border-b border-neutral-100 dark:border-neutral-800/60 last:border-0">
                  <td className="px-3 py-2 whitespace-nowrap">{fmtDate(e.date)}</td>
                  <td className="px-3 py-2 text-right tabular-nums">{Number(e.hours).toFixed(1)}</td>
                  <td className="px-3 py-2 text-right tabular-nums text-neutral-500">
                    {e.rate ? `$${Number(e.rate).toFixed(0)}` : "—"}
                  </td>
                  <td className="px-3 py-2 text-neutral-600 dark:text-neutral-400">
                    {e.description || <span className="text-neutral-400">—</span>}
                  </td>
                  <td className="px-3 py-2">
                    <div className="flex items-center justify-end gap-0.5">
                      <UnlinkButton id={e.id} projectId={projectId} />
                      <DeleteButton
                        label={`${e.hours}h on ${e.date}`}
                        onDelete={deleteHourEntry.bind(null, e.id, projectId)}
                      />
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}
