"use client";

import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import type { AreaCodeCount } from "@/lib/stats";

export function AreaCodeChart({ data }: { data: AreaCodeCount[] }) {
  if (data.length === 0) {
    return <div className="text-sm text-neutral-500">No phone numbers with parseable area codes.</div>;
  }
  return (
    <ResponsiveContainer width="100%" height={260}>
      <BarChart data={data} margin={{ left: 8, right: 8, top: 8, bottom: 8 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="#e5e5e5" className="dark:stroke-neutral-700" />
        <XAxis dataKey="code" stroke="#737373" tick={{ fontSize: 12 }} />
        <YAxis allowDecimals={false} stroke="#737373" />
        <Tooltip
          cursor={{ fill: "rgba(0,0,0,0.04)" }}
          contentStyle={{ borderRadius: 8, fontSize: 12 }}
        />
        <Bar dataKey="count" fill="#10b981" radius={[4, 4, 0, 0]} isAnimationActive={false} />
      </BarChart>
    </ResponsiveContainer>
  );
}
