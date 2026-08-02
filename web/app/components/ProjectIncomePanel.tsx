"use client";

import { useMemo, useState, useTransition } from "react";
import { Link2, Link2Off } from "lucide-react";
import type { IncomeEntry } from "@/lib/projects-server";
import { addProjectIncome, linkIncome, unlinkIncome } from "@/lib/projects-actions";
import { AddPanel, Field, SubmitButton, fieldCls } from "./ephemeris/RowActions";

const money = (n: number) =>
  n.toLocaleString(undefined, { style: "currency", currency: "USD", maximumFractionDigits: 2 });

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

function IconAction({
  onRun,
  title,
  tone,
  children,
}: {
  onRun: () => Promise<void>;
  title: string;
  tone: "link" | "unlink";
  children: React.ReactNode;
}) {
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const cls =
    tone === "link"
      ? "hover:text-indigo-600 dark:hover:text-indigo-400 hover:bg-indigo-50 dark:hover:bg-indigo-500/10"
      : "hover:text-amber-600 dark:hover:text-amber-400 hover:bg-amber-50 dark:hover:bg-amber-500/10";
  return (
    <>
      <button
        type="button"
        disabled={pending}
        title={title}
        aria-label={title}
        onClick={() =>
          start(async () => {
            try {
              await onRun();
            } catch (e) {
              setError(e instanceof Error ? e.message : "Failed.");
            }
          })
        }
        className={`rounded-md p-1.5 text-neutral-400 transition-colors disabled:opacity-40 ${cls}`}
      >
        {children}
      </button>
      {error ? <span className="text-xs text-rose-600">{error}</span> : null}
    </>
  );
}

export function ProjectIncomePanel({
  projectId,
  client,
  entries,
  unlinked,
  disabled,
}: {
  projectId: string;
  client: string | null;
  entries: IncomeEntry[];
  unlinked: IncomeEntry[];
  disabled: boolean;
}) {
  const total = entries.reduce((s, r) => s + Number(r.amount || 0), 0);
  const [query, setQuery] = useState("");
  const [picking, setPicking] = useState(false);

  // Surface the same client first — that is nearly always the row you want.
  const candidates = useMemo(() => {
    const q = query.toLowerCase().trim();
    const scored = unlinked.filter(
      (r) =>
        !q ||
        [r.description, r.client, r.notes].filter(Boolean).join(" ").toLowerCase().includes(q),
    );
    const sameClient = (r: IncomeEntry) =>
      client && r.client && r.client.toLowerCase().includes(client.toLowerCase().slice(0, 6));
    return [...scored].sort((a, b) => {
      const d = Number(!!sameClient(b)) - Number(!!sameClient(a));
      return d !== 0 ? d : b.date.localeCompare(a.date);
    });
  }, [unlinked, query, client]);

  return (
    <section className="space-y-3">
      <div className="flex items-end justify-between gap-3 flex-wrap">
        <div>
          <h2 className="text-sm font-semibold">Revenue collected</h2>
          <p className="text-xs text-neutral-500">
            {entries.length} linked income {entries.length === 1 ? "row" : "rows"} ·{" "}
            <span className="tabular-nums font-medium">{money(total)}</span>
          </p>
        </div>
        {!disabled && (
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setPicking((v) => !v)}
              className="inline-flex items-center gap-1.5 rounded-lg border border-neutral-200 dark:border-neutral-700 px-3 py-1.5 text-sm text-neutral-600 dark:text-neutral-300 hover:bg-neutral-100 dark:hover:bg-neutral-800"
            >
              <Link2 className="w-3.5 h-3.5" />
              Link existing
            </button>
            <AddPanel title="Record income" action={addProjectIncome.bind(null, projectId)}>
              <Field label="Date">
                <input
                  type="date"
                  name="date"
                  required
                  defaultValue={new Date().toISOString().slice(0, 10)}
                  className={fieldCls}
                />
              </Field>
              <Field label="Amount">
                <input name="amount" inputMode="decimal" required placeholder="1500" className={fieldCls} />
              </Field>
              <Field label="Description" grow>
                <input name="description" required className={fieldCls} />
              </Field>
              <input type="hidden" name="client" value={client ?? ""} />
              <SubmitButton>Add income</SubmitButton>
            </AddPanel>
          </div>
        )}
      </div>

      {picking && !disabled && (
        <div className="rounded-xl border border-neutral-200 dark:border-neutral-800 bg-white dark:bg-neutral-900 p-4 space-y-3">
          <div className="flex items-center justify-between gap-3">
            <h3 className="text-sm font-medium">
              Unattributed income ({unlinked.length})
            </h3>
            <input
              type="search"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search description or client…"
              className={`${fieldCls} min-w-[16rem]`}
            />
          </div>
          {candidates.length === 0 ? (
            <p className="text-xs text-neutral-500">
              {unlinked.length === 0
                ? "Every income row is already attributed to a project."
                : "No unattributed income matches that search."}
            </p>
          ) : (
            <ul className="max-h-72 overflow-y-auto divide-y divide-neutral-100 dark:divide-neutral-800">
              {candidates.slice(0, 60).map((r) => (
                <li key={r.id} className="flex items-center gap-3 py-2 text-sm">
                  <span className="w-24 shrink-0 text-neutral-500 tabular-nums">{fmtDate(r.date)}</span>
                  <span className="w-24 shrink-0 text-right tabular-nums font-medium">
                    {money(Number(r.amount))}
                  </span>
                  <span className="flex-1 min-w-0 truncate">
                    {r.description}
                    {r.client ? <span className="text-neutral-500"> · {r.client}</span> : null}
                  </span>
                  <IconAction
                    tone="link"
                    title={`Link ${r.description} to this project`}
                    onRun={() => linkIncome(r.id, projectId)}
                  >
                    <Link2 className="w-3.5 h-3.5" />
                  </IconAction>
                </li>
              ))}
            </ul>
          )}
          {candidates.length > 60 && (
            <p className="text-[11px] text-neutral-500">
              Showing the first 60 of {candidates.length} — narrow the search to see the rest.
            </p>
          )}
        </div>
      )}

      {entries.length === 0 ? (
        <div className="rounded-xl border border-neutral-200 dark:border-neutral-800 bg-white dark:bg-neutral-900 p-6 text-center text-sm text-neutral-500">
          No revenue linked to this project yet.
        </div>
      ) : (
        <div className="overflow-x-auto rounded-xl border border-neutral-200 dark:border-neutral-800 bg-white dark:bg-neutral-900">
          <table className="w-full text-sm">
            <thead className="text-xs text-neutral-500 border-b border-neutral-200 dark:border-neutral-800">
              <tr>
                <th className="text-left font-medium px-3 py-2">Date</th>
                <th className="text-right font-medium px-3 py-2">Amount</th>
                <th className="text-left font-medium px-3 py-2">Description</th>
                <th className="text-left font-medium px-3 py-2">Client</th>
                <th className="px-3 py-2" />
              </tr>
            </thead>
            <tbody>
              {entries.map((e) => (
                <tr key={e.id} className="border-b border-neutral-100 dark:border-neutral-800/60 last:border-0">
                  <td className="px-3 py-2 whitespace-nowrap">{fmtDate(e.date)}</td>
                  <td className="px-3 py-2 text-right tabular-nums font-medium">
                    {money(Number(e.amount))}
                  </td>
                  <td className="px-3 py-2 text-neutral-600 dark:text-neutral-400">{e.description}</td>
                  <td className="px-3 py-2 text-neutral-500">{e.client || "—"}</td>
                  <td className="px-3 py-2 text-right">
                    <IconAction
                      tone="unlink"
                      title="Unlink from this project (keeps the income row)"
                      onRun={() => unlinkIncome(e.id, projectId)}
                    >
                      <Link2Off className="w-3.5 h-3.5" />
                    </IconAction>
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
