"use client";

import { useState, useTransition } from "react";
import {
  Area,
  AreaChart,
  CartesianGrid,
  Legend,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { CalendarPlus, ChevronDown, ChevronRight, Plus, Trash2, X } from "lucide-react";
import type { WealthHistoryRow, WealthItem } from "@/lib/wealth-server";

function fmtMoney(n: number): string {
  const sign = n < 0 ? "-" : "";
  const abs = Math.abs(n);
  if (abs >= 1_000_000) return `${sign}$${(abs / 1_000_000).toFixed(2)}M`;
  if (abs >= 1_000) return `${sign}$${(abs / 1_000).toFixed(abs >= 10_000 ? 0 : 1)}k`;
  return `${sign}$${abs.toLocaleString()}`;
}

function fmtMoneyFull(n: number): string {
  return n.toLocaleString(undefined, { style: "currency", currency: "USD", maximumFractionDigits: 0 });
}

function fmtDate(d: string): string {
  const [y, m, day] = d.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, day)).toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
    year: "numeric",
    timeZone: "UTC",
  });
}

export type Summary = {
  assets: WealthItem[];
  liabilities: WealthItem[];
  targets: WealthItem[];
  totalAssets: number;
  totalLiabilities: number;
  netWorth: number;
};

export type ItemMeta = {
  value: number;
  lastUpdated: string | null;
  series: { id: string; date: string; value: number }[];
};

const inputCls =
  "rounded-lg border border-neutral-200 dark:border-neutral-700 bg-white dark:bg-neutral-950 px-2.5 py-1.5 text-sm min-w-0";

export function WealthView({
  summary,
  history,
  meta,
  change,
  today,
  pendingMigration = false,
  recordBalances,
  addWealthItem,
  deleteWealthItem,
  deleteSnapshot,
}: {
  summary: Summary;
  history: WealthHistoryRow[];
  meta: Record<string, ItemMeta>;
  change: { delta: number; pct: number; from: string } | null;
  today: string;
  pendingMigration?: boolean;
  recordBalances: (fd: FormData) => Promise<void>;
  addWealthItem: (fd: FormData) => Promise<void>;
  deleteWealthItem: (id: string) => Promise<void>;
  deleteSnapshot: (id: string, itemId: string) => Promise<void>;
}) {
  const [mode, setMode] = useState<"none" | "update" | "add">("none");
  const allItems = [...summary.assets, ...summary.liabilities, ...summary.targets];

  return (
    <>
      {pendingMigration && (
        <div className="rounded-xl border border-amber-300 dark:border-amber-500/40 bg-amber-50 dark:bg-amber-500/10 p-4 text-sm">
          <p className="font-medium text-amber-900 dark:text-amber-200">
            Dated updates aren’t enabled yet
          </p>
          <p className="mt-1 text-amber-800 dark:text-amber-300/90">
            The <code className="font-mono text-xs">wealth_snapshots</code> table doesn’t exist, so
            this page is showing the old yearly <code className="font-mono text-xs">eoy_values</code>{" "}
            history and balances can’t be edited. Run{" "}
            <code className="font-mono text-xs">
              supabase/migrations/20260725160000_wealth_snapshots.sql
            </code>{" "}
            to turn it on — your existing history is backfilled automatically.
          </p>
        </div>
      )}

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
        <Kpi label="Net worth" value={summary.netWorth} accent />
        <Kpi label="Total assets" value={summary.totalAssets} />
        <Kpi label="Total liabilities" value={summary.totalLiabilities} />
        <div className="rounded-xl border border-neutral-200 dark:border-neutral-800 bg-white dark:bg-neutral-900 p-4">
          <div className="text-xs uppercase tracking-wider text-neutral-500">Change (90d)</div>
          {change ? (
            <>
              <div
                className={`mt-1 text-3xl font-semibold tabular-nums ${
                  change.delta >= 0
                    ? "text-emerald-600 dark:text-emerald-400"
                    : "text-rose-600 dark:text-rose-400"
                }`}
              >
                {change.delta >= 0 ? "+" : ""}
                {fmtMoneyFull(change.delta)}
              </div>
              <div className="mt-1 text-xs text-neutral-400">
                {change.pct >= 0 ? "+" : ""}
                {change.pct.toFixed(1)}% since {fmtDate(change.from)}
              </div>
            </>
          ) : (
            <div className="mt-1 text-sm text-neutral-400">
              Not enough history yet — record a second dated update.
            </div>
          )}
        </div>
      </div>

      {!pendingMigration && (
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            onClick={() => setMode(mode === "update" ? "none" : "update")}
            className="inline-flex items-center gap-1.5 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white px-3 py-1.5 text-sm font-medium"
          >
            <CalendarPlus className="w-3.5 h-3.5" />
            Update balances
          </button>
          <button
            type="button"
            onClick={() => setMode(mode === "add" ? "none" : "add")}
            className="inline-flex items-center gap-1.5 rounded-lg border border-neutral-200 dark:border-neutral-700 px-3 py-1.5 text-sm text-neutral-600 dark:text-neutral-300 hover:bg-neutral-100 dark:hover:bg-neutral-800"
          >
            <Plus className="w-3.5 h-3.5" />
            Add account
          </button>
        </div>
      )}

      {mode === "update" && (
        <UpdatePanel
          items={allItems}
          meta={meta}
          today={today}
          onClose={() => setMode("none")}
          action={recordBalances}
        />
      )}
      {mode === "add" && (
        <AddPanel today={today} onClose={() => setMode("none")} action={addWealthItem} />
      )}

      {history.length > 0 && (
        <div className="rounded-xl border border-neutral-200 dark:border-neutral-800 bg-white dark:bg-neutral-900 p-4">
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-sm font-medium text-neutral-700 dark:text-neutral-300">
              Net worth over time
            </h2>
            <span className="text-xs text-neutral-400">
              {history.length} dated point{history.length === 1 ? "" : "s"}
            </span>
          </div>
          <ResponsiveContainer width="100%" height={300}>
            <AreaChart data={history} margin={{ left: 8, right: 8, top: 8, bottom: 8 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#e5e5e5" className="dark:stroke-neutral-700" />
              <XAxis dataKey="date" stroke="#737373" fontSize={11} tickFormatter={fmtDate} minTickGap={24} />
              <YAxis stroke="#737373" tickFormatter={fmtMoney} width={70} fontSize={11} />
              <Tooltip
                formatter={(v) => fmtMoneyFull(Number(v ?? 0))}
                labelFormatter={(l) => fmtDate(String(l))}
                contentStyle={{ borderRadius: 8, fontSize: 12 }}
              />
              <Legend wrapperStyle={{ fontSize: 11 }} />
              <Area type="monotone" dataKey="assets" stroke="#10b981" fill="#10b98133" name="Assets" isAnimationActive={false} />
              <Area type="monotone" dataKey="liabilities" stroke="#f43f5e" fill="#f43f5e33" name="Liabilities" isAnimationActive={false} />
              <Line type="monotone" dataKey="netWorth" stroke="#6366f1" strokeWidth={2} dot name="Net worth" isAnimationActive={false} />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <ItemTable
          title="Assets"
          items={summary.assets}
          meta={meta}
          accent="text-emerald-600 dark:text-emerald-400"
          onDeleteItem={deleteWealthItem}
          onDeleteSnapshot={deleteSnapshot}
        />
        <ItemTable
          title="Liabilities"
          items={summary.liabilities}
          meta={meta}
          accent="text-rose-600 dark:text-rose-400"
          onDeleteItem={deleteWealthItem}
          onDeleteSnapshot={deleteSnapshot}
        />
      </div>

      {summary.targets.length > 0 && (
        <ItemTable
          title="Target assets"
          items={summary.targets}
          meta={meta}
          accent="text-indigo-600 dark:text-indigo-400"
          onDeleteItem={deleteWealthItem}
          onDeleteSnapshot={deleteSnapshot}
        />
      )}
    </>
  );
}

function UpdatePanel({
  items,
  meta,
  today,
  onClose,
  action,
}: {
  items: WealthItem[];
  meta: Record<string, ItemMeta>;
  today: string;
  onClose: () => void;
  action: (fd: FormData) => Promise<void>;
}) {
  const [error, setError] = useState<string | null>(null);

  return (
    <div className="rounded-xl border border-indigo-200 dark:border-indigo-500/30 bg-indigo-50/30 dark:bg-indigo-500/5 p-4 space-y-3">
      <div className="flex items-center justify-between">
        <h2 className="text-sm font-medium">Record balances</h2>
        <button type="button" onClick={onClose} aria-label="Close" className="rounded-md p-1 text-neutral-400 hover:text-neutral-700 dark:hover:text-neutral-200">
          <X className="w-4 h-4" />
        </button>
      </div>
      <p className="text-xs text-neutral-500">
        Pick one date, then fill in only the accounts that changed. Blanks are skipped. Re-submitting
        the same date replaces that day’s reading rather than adding a duplicate.
      </p>
      <form
        action={async (fd) => {
          setError(null);
          try {
            await action(fd);
            onClose();
          } catch (e) {
            setError(e instanceof Error ? e.message : "Could not save.");
          }
        }}
        className="space-y-3"
      >
        <div className="flex flex-wrap items-end gap-2">
          <label className="flex flex-col gap-1">
            <span className="text-xs text-neutral-500">As of</span>
            <input type="date" name="as_of_date" required defaultValue={today} className={inputCls} />
          </label>
          <label className="flex flex-col gap-1 flex-1 min-w-[12rem]">
            <span className="text-xs text-neutral-500">Note (optional)</span>
            <input type="text" name="note" placeholder="e.g. quarterly review" className={inputCls + " w-full"} />
          </label>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2">
          {items.map((i) => {
            const m = meta[i.id];
            return (
              <label key={i.id} className="flex flex-col gap-1">
                <span className="text-xs text-neutral-600 dark:text-neutral-300 truncate" title={i.name}>
                  {i.name}
                </span>
                <input
                  type="text"
                  inputMode="decimal"
                  name={`value:${i.id}`}
                  placeholder={m ? fmtMoneyFull(m.value) : "—"}
                  className={inputCls + " w-full"}
                />
                <span className="text-[10px] text-neutral-400">
                  {m?.lastUpdated ? `last ${fmtDate(m.lastUpdated)}` : "no history"}
                </span>
              </label>
            );
          })}
        </div>

        <button
          type="submit"
          className="rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white px-3 py-1.5 text-sm font-medium"
        >
          Save balances
        </button>
        {error ? <p className="text-xs text-rose-600">{error}</p> : null}
      </form>
    </div>
  );
}

function AddPanel({
  today,
  onClose,
  action,
}: {
  today: string;
  onClose: () => void;
  action: (fd: FormData) => Promise<void>;
}) {
  const [error, setError] = useState<string | null>(null);
  return (
    <div className="rounded-xl border border-neutral-200 dark:border-neutral-800 bg-white dark:bg-neutral-900 p-4 space-y-3">
      <div className="flex items-center justify-between">
        <h2 className="text-sm font-medium">Add account</h2>
        <button type="button" onClick={onClose} aria-label="Close" className="rounded-md p-1 text-neutral-400 hover:text-neutral-700 dark:hover:text-neutral-200">
          <X className="w-4 h-4" />
        </button>
      </div>
      <form
        action={async (fd) => {
          setError(null);
          try {
            await action(fd);
            onClose();
          } catch (e) {
            setError(e instanceof Error ? e.message : "Could not save.");
          }
        }}
        className="flex flex-wrap items-end gap-2"
      >
        <label className="flex flex-col gap-1 flex-1 min-w-[12rem]">
          <span className="text-xs text-neutral-500">Name</span>
          <input type="text" name="name" required className={inputCls + " w-full"} />
        </label>
        <label className="flex flex-col gap-1">
          <span className="text-xs text-neutral-500">Type</span>
          <select name="type" className={inputCls} defaultValue="asset">
            <option value="asset">Asset</option>
            <option value="liability">Liability</option>
            <option value="target_asset">Target asset</option>
          </select>
        </label>
        <label className="flex flex-col gap-1">
          <span className="text-xs text-neutral-500">Category</span>
          <input type="text" name="category" placeholder="other" className={inputCls} />
        </label>
        <label className="flex flex-col gap-1">
          <span className="text-xs text-neutral-500">Source</span>
          <input type="text" name="source" className={inputCls} />
        </label>
        <label className="flex flex-col gap-1">
          <span className="text-xs text-neutral-500">Opening balance</span>
          <input type="text" inputMode="decimal" name="value" required placeholder="0" className={inputCls} />
        </label>
        <label className="flex flex-col gap-1">
          <span className="text-xs text-neutral-500">As of</span>
          <input type="date" name="as_of_date" required defaultValue={today} className={inputCls} />
        </label>
        <button
          type="submit"
          className="rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white px-3 py-1.5 text-sm font-medium"
        >
          Add account
        </button>
        {error ? <p className="text-xs text-rose-600 w-full">{error}</p> : null}
      </form>
    </div>
  );
}

function Kpi({ label, value, accent = false }: { label: string; value: number; accent?: boolean }) {
  return (
    <div
      className={`rounded-xl border ${
        accent
          ? "border-indigo-200 dark:border-indigo-500/30 bg-indigo-50/40 dark:bg-indigo-500/5"
          : "border-neutral-200 dark:border-neutral-800 bg-white dark:bg-neutral-900"
      } p-4`}
    >
      <div className="text-xs uppercase tracking-wider text-neutral-500">{label}</div>
      <div className={`mt-1 text-3xl font-semibold tabular-nums ${accent ? "text-indigo-700 dark:text-indigo-300" : ""}`}>
        {fmtMoneyFull(value)}
      </div>
    </div>
  );
}

function ItemTable({
  title,
  items,
  meta,
  accent,
  onDeleteItem,
  onDeleteSnapshot,
}: {
  title: string;
  items: WealthItem[];
  meta: Record<string, ItemMeta>;
  accent: string;
  onDeleteItem: (id: string) => Promise<void>;
  onDeleteSnapshot: (id: string, itemId: string) => Promise<void>;
}) {
  const [open, setOpen] = useState<string | null>(null);

  if (items.length === 0) {
    return (
      <div className="rounded-xl border border-neutral-200 dark:border-neutral-800 bg-white dark:bg-neutral-900 p-4">
        <h2 className="text-sm font-medium text-neutral-700 dark:text-neutral-300 mb-2">{title}</h2>
        <p className="text-sm text-neutral-400">None.</p>
      </div>
    );
  }

  return (
    <div className="rounded-xl border border-neutral-200 dark:border-neutral-800 bg-white dark:bg-neutral-900 overflow-hidden">
      <div className="px-4 py-3 border-b border-neutral-200 dark:border-neutral-800">
        <h2 className="text-sm font-medium text-neutral-700 dark:text-neutral-300">{title}</h2>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="text-xs text-neutral-500">
            <tr className="text-left">
              <th className="px-4 py-2 font-medium">Name</th>
              <th className="px-4 py-2 font-medium">Category</th>
              <th className="px-4 py-2 font-medium">Last updated</th>
              <th className="px-4 py-2 font-medium">Trend</th>
              <th className="px-4 py-2 font-medium text-right">Value</th>
              <th className="px-4 py-2 font-medium text-right"></th>
            </tr>
          </thead>
          <tbody>
            {items.map((i) => {
              const m = meta[i.id];
              const isOpen = open === i.id;
              return (
                <FragmentRow
                  key={i.id}
                  item={i}
                  m={m}
                  accent={accent}
                  isOpen={isOpen}
                  toggle={() => setOpen(isOpen ? null : i.id)}
                  onDeleteItem={onDeleteItem}
                  onDeleteSnapshot={onDeleteSnapshot}
                />
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function FragmentRow({
  item,
  m,
  accent,
  isOpen,
  toggle,
  onDeleteItem,
  onDeleteSnapshot,
}: {
  item: WealthItem;
  m: ItemMeta | undefined;
  accent: string;
  isOpen: boolean;
  toggle: () => void;
  onDeleteItem: (id: string) => Promise<void>;
  onDeleteSnapshot: (id: string, itemId: string) => Promise<void>;
}) {
  const [pending, start] = useTransition();
  const series = m?.series ?? [];

  return (
    <>
      <tr className="border-t border-neutral-100 dark:border-neutral-800">
        <td className="px-4 py-2">
          <button
            type="button"
            onClick={toggle}
            className="inline-flex items-center gap-1 font-medium hover:text-indigo-600 dark:hover:text-indigo-400"
            aria-expanded={isOpen}
          >
            {isOpen ? <ChevronDown className="w-3.5 h-3.5" /> : <ChevronRight className="w-3.5 h-3.5" />}
            {item.name}
          </button>
        </td>
        <td className="px-4 py-2 text-neutral-500 capitalize">{item.category}</td>
        <td className="px-4 py-2 text-neutral-500 whitespace-nowrap">
          {m?.lastUpdated ? fmtDate(m.lastUpdated) : "—"}
        </td>
        <td className="px-4 py-2">
          {series.length > 1 ? (
            <div className="h-8 w-24">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={series}>
                  <Line
                    type="monotone"
                    dataKey="value"
                    stroke="#6366f1"
                    strokeWidth={1.5}
                    dot={false}
                    isAnimationActive={false}
                  />
                </LineChart>
              </ResponsiveContainer>
            </div>
          ) : (
            <span className="text-xs text-neutral-400">—</span>
          )}
        </td>
        <td className={`px-4 py-2 text-right tabular-nums font-medium ${accent}`}>
          {fmtMoneyFull(m?.value ?? item.current_value)}
        </td>
        <td className="px-4 py-2 text-right">
          <button
            type="button"
            disabled={pending}
            aria-label={`Delete ${item.name}`}
            title={`Delete ${item.name} and all its history`}
            onClick={() => {
              if (!window.confirm(`Delete ${item.name} and its entire history? This cannot be undone.`)) return;
              start(async () => {
                await onDeleteItem(item.id);
              });
            }}
            className="rounded-md p-1.5 text-neutral-400 hover:text-rose-600 dark:hover:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-500/10 disabled:opacity-40"
          >
            <Trash2 className="w-3.5 h-3.5" />
          </button>
        </td>
      </tr>
      {isOpen && (
        <tr className="border-t border-neutral-100 dark:border-neutral-800 bg-neutral-50/60 dark:bg-neutral-950/40">
          <td colSpan={6} className="px-4 py-3">
            {series.length === 0 ? (
              <p className="text-xs text-neutral-400">No dated readings yet.</p>
            ) : (
              <div className="space-y-1">
                <div className="text-xs text-neutral-500 mb-1">History (newest first)</div>
                {[...series].reverse().map((p, idx, arr) => {
                  const prev = arr[idx + 1];
                  const delta = prev ? p.value - prev.value : null;
                  return (
                    <div key={p.date} className="flex items-center gap-3 text-xs">
                      <span className="text-neutral-500 w-28 shrink-0">{fmtDate(p.date)}</span>
                      <span className="tabular-nums font-medium w-24 text-right">{fmtMoneyFull(p.value)}</span>
                      <span
                        className={`tabular-nums w-24 text-right ${
                          delta == null
                            ? "text-neutral-400"
                            : delta >= 0
                              ? "text-emerald-600 dark:text-emerald-400"
                              : "text-rose-600 dark:text-rose-400"
                        }`}
                      >
                        {delta == null ? "—" : `${delta >= 0 ? "+" : ""}${fmtMoneyFull(delta)}`}
                      </span>
                      <DeleteSnapshotButton
                        onDelete={() => onDeleteSnapshot(idFor(m, p.date), item.id)}
                        label={`${item.name} on ${fmtDate(p.date)}`}
                      />
                    </div>
                  );
                })}
              </div>
            )}
          </td>
        </tr>
      )}
    </>
  );
}

function idFor(m: ItemMeta | undefined, date: string): string {
  return m?.series.find((s) => s.date === date)?.id ?? "";
}

function DeleteSnapshotButton({ onDelete, label }: { onDelete: () => Promise<void>; label: string }) {
  const [pending, start] = useTransition();
  return (
    <button
      type="button"
      disabled={pending}
      aria-label={`Delete reading for ${label}`}
      title="Delete this reading"
      onClick={() => {
        if (!window.confirm(`Delete the reading for ${label}?`)) return;
        start(async () => {
          await onDelete();
        });
      }}
      className="rounded p-1 text-neutral-300 hover:text-rose-600 dark:hover:text-rose-400 disabled:opacity-40"
    >
      <Trash2 className="w-3 h-3" />
    </button>
  );
}
