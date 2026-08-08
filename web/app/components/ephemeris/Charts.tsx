"use client";

import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Legend,
  ComposedChart,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { fmtMoney, fmtMoneyFull, fmtMonth } from "./ui";

/* Shared palette — indigo/emerald/rose match WealthView and the sidebar. */
const CATEGORY_COLORS = [
  "#6366f1", "#10b981", "#f59e0b", "#f43f5e", "#8b5cf6",
  "#06b6d4", "#84cc16", "#ec4899", "#0ea5e9", "#f97316",
  "#14b8a6", "#a855f7",
];

const grid = <CartesianGrid strokeDasharray="3 3" stroke="#e5e5e5" className="dark:stroke-neutral-700" />;
const tooltipStyle = { borderRadius: 8, fontSize: 12 };

export function CategoryDonut({ data }: { data: { cat: string; total: number }[] }) {
  const top = data.slice(0, 11);
  const rest = data.slice(11);
  const slices = rest.length
    ? [...top, { cat: `Other (${rest.length})`, total: rest.reduce((s, d) => s + d.total, 0) }]
    : top;

  if (slices.length === 0) return <Empty />;

  return (
    <ResponsiveContainer width="100%" height={280}>
      <PieChart>
        <Pie
          data={slices}
          dataKey="total"
          nameKey="cat"
          innerRadius={60}
          outerRadius={100}
          paddingAngle={1}
          isAnimationActive={false}
        >
          {slices.map((_, i) => (
            <Cell key={i} fill={CATEGORY_COLORS[i % CATEGORY_COLORS.length]} />
          ))}
        </Pie>
        <Tooltip formatter={(v) => fmtMoneyFull(Number(v ?? 0))} contentStyle={tooltipStyle} />
        <Legend wrapperStyle={{ fontSize: 11 }} />
      </PieChart>
    </ResponsiveContainer>
  );
}

export function MonthlySpendBars({ data }: { data: { month: string; total: number }[] }) {
  if (data.length === 0) return <Empty />;
  const rows = data.map((d) => ({ ...d, label: fmtMonth(d.month) }));
  return (
    <ResponsiveContainer width="100%" height={280}>
      <BarChart data={rows} margin={{ left: 8, right: 8, top: 8, bottom: 8 }}>
        {grid}
        <XAxis dataKey="label" stroke="#737373" fontSize={11} />
        <YAxis stroke="#737373" tickFormatter={fmtMoney} width={70} fontSize={11} />
        <Tooltip formatter={(v) => fmtMoneyFull(Number(v ?? 0))} contentStyle={tooltipStyle} />
        <Bar dataKey="total" fill="#6366f1" name="Spend" radius={[4, 4, 0, 0]} isAnimationActive={false} />
      </BarChart>
    </ResponsiveContainer>
  );
}

/**
 * Income vs expenses per month. Net is deliberately not overlaid here — it
 * lives in its own table on the overview, where a single series is easier to
 * read than a line crossing two bar sets.
 */
export function CashflowChart({
  data,
}: {
  data: { month: string; income: number; expenses: number; net: number }[];
}) {
  if (data.length === 0) return <Empty />;
  const rows = [...data].reverse().map((d) => ({ ...d, label: fmtMonth(d.month) }));
  return (
    <ResponsiveContainer width="100%" height={300}>
      <ComposedChart data={rows} margin={{ left: 8, right: 8, top: 8, bottom: 8 }}>
        {grid}
        <XAxis dataKey="label" stroke="#737373" fontSize={11} />
        <YAxis stroke="#737373" tickFormatter={fmtMoney} width={70} fontSize={11} />
        <Tooltip formatter={(v) => fmtMoneyFull(Number(v ?? 0))} contentStyle={tooltipStyle} />
        <Legend wrapperStyle={{ fontSize: 11 }} />
        <Bar dataKey="income" fill="#10b981" name="Income" radius={[4, 4, 0, 0]} isAnimationActive={false} />
        <Bar dataKey="expenses" fill="#f43f5e" name="Expenses" radius={[4, 4, 0, 0]} isAnimationActive={false} />
      </ComposedChart>
    </ResponsiveContainer>
  );
}

/** Horizontal bars: net by life-area tag. */
export function TagBars({
  data,
}: {
  data: { tag: string; income: number; expenses: number }[];
}) {
  const rows = data.filter((d) => d.income !== 0 || d.expenses !== 0);
  if (rows.length === 0) return <Empty />;
  return (
    <ResponsiveContainer width="100%" height={Math.max(200, rows.length * 38)}>
      <BarChart data={rows} layout="vertical" margin={{ left: 8, right: 8, top: 8, bottom: 8 }}>
        {grid}
        <XAxis type="number" stroke="#737373" tickFormatter={fmtMoney} fontSize={11} />
        <YAxis type="category" dataKey="tag" stroke="#737373" width={120} fontSize={11} />
        <Tooltip formatter={(v) => fmtMoneyFull(Number(v ?? 0))} contentStyle={tooltipStyle} />
        <Legend wrapperStyle={{ fontSize: 11 }} />
        <Bar dataKey="income" fill="#10b981" name="Income" radius={[0, 4, 4, 0]} isAnimationActive={false} />
        <Bar dataKey="expenses" fill="#f43f5e" name="Expenses" radius={[0, 4, 4, 0]} isAnimationActive={false} />
      </BarChart>
    </ResponsiveContainer>
  );
}

function Empty() {
  return (
    <div className="h-[200px] grid place-items-center text-sm text-neutral-400">
      No data in this range.
    </div>
  );
}
