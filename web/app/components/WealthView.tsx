"use client";

import {
  Area,
  AreaChart,
  CartesianGrid,
  Legend,
  Line,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
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

type Summary = {
  assets: WealthItem[];
  liabilities: WealthItem[];
  targets: WealthItem[];
  totalAssets: number;
  totalLiabilities: number;
  netWorth: number;
};

export function WealthView({ summary, history }: { summary: Summary; history: WealthHistoryRow[] }) {
  return (
    <>
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <Kpi label="Net worth" value={summary.netWorth} accent />
        <Kpi label="Total assets" value={summary.totalAssets} />
        <Kpi label="Total liabilities" value={summary.totalLiabilities} />
      </div>

      {history.length > 0 && (
        <div className="rounded-xl border border-neutral-200 dark:border-neutral-800 bg-white dark:bg-neutral-900 p-4">
          <h2 className="text-sm font-medium text-neutral-700 dark:text-neutral-300 mb-3">Net worth over time</h2>
          <ResponsiveContainer width="100%" height={280}>
            <AreaChart data={history} margin={{ left: 8, right: 8, top: 8, bottom: 8 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#e5e5e5" className="dark:stroke-neutral-700" />
              <XAxis dataKey="year" stroke="#737373" />
              <YAxis stroke="#737373" tickFormatter={fmtMoney} width={70} />
              <Tooltip
                formatter={(v) => fmtMoneyFull(Number(v ?? 0))}
                contentStyle={{ borderRadius: 8, fontSize: 12 }}
              />
              <Legend />
              <Area type="monotone" dataKey="assets" stroke="#10b981" fill="#10b98133" name="Assets" isAnimationActive={false} />
              <Area type="monotone" dataKey="liabilities" stroke="#f43f5e" fill="#f43f5e33" name="Liabilities" isAnimationActive={false} />
              <Line type="monotone" dataKey="netWorth" stroke="#6366f1" strokeWidth={2} dot name="Net worth" isAnimationActive={false} />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <ItemTable title="Assets" items={summary.assets} accent="text-emerald-600 dark:text-emerald-400" />
        <ItemTable title="Liabilities" items={summary.liabilities} accent="text-rose-600 dark:text-rose-400" />
      </div>

      {summary.targets.length > 0 && (
        <ItemTable title="Target assets" items={summary.targets} accent="text-indigo-600 dark:text-indigo-400" />
      )}
    </>
  );
}

function Kpi({ label, value, accent = false }: { label: string; value: number; accent?: boolean }) {
  return (
    <div className={`rounded-xl border ${accent ? "border-indigo-200 dark:border-indigo-500/30 bg-indigo-50/40 dark:bg-indigo-500/5" : "border-neutral-200 dark:border-neutral-800 bg-white dark:bg-neutral-900"} p-4`}>
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
  accent,
}: {
  title: string;
  items: WealthItem[];
  accent: string;
}) {
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
      <table className="w-full text-sm">
        <thead className="text-xs text-neutral-500">
          <tr className="text-left">
            <th className="px-4 py-2 font-medium">Name</th>
            <th className="px-4 py-2 font-medium">Source</th>
            <th className="px-4 py-2 font-medium">Category</th>
            <th className="px-4 py-2 font-medium text-right">Value</th>
          </tr>
        </thead>
        <tbody>
          {items.map((i) => (
            <tr key={i.id} className="border-t border-neutral-100 dark:border-neutral-800">
              <td className="px-4 py-2 font-medium">{i.name}</td>
              <td className="px-4 py-2 text-neutral-500">{i.source ?? ""}</td>
              <td className="px-4 py-2 text-neutral-500 capitalize">{i.category}</td>
              <td className={`px-4 py-2 text-right tabular-nums font-medium ${accent}`}>{fmtMoneyFull(i.current_value)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
