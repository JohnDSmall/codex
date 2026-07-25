"use client";

import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import type { OrgCount } from "@/lib/stats";

export function TopOrgsChart({ data }: { data: OrgCount[] }) {
  if (data.length === 0) {
    return <div className="text-sm text-neutral-500">No organizations.</div>;
  }
  return (
    <ResponsiveContainer width="100%" height={Math.max(220, data.length * 28)}>
      <BarChart data={data} layout="vertical" margin={{ left: 16, right: 16, top: 8, bottom: 8 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="#e5e5e5" className="dark:stroke-neutral-700" />
        <XAxis type="number" allowDecimals={false} stroke="#737373" />
        <YAxis
          type="category"
          dataKey="name"
          width={140}
          stroke="#737373"
          tick={{ fontSize: 12 }}
        />
        <Tooltip
          cursor={{ fill: "rgba(0,0,0,0.04)" }}
          contentStyle={{ borderRadius: 8, fontSize: 12 }}
        />
        <Bar dataKey="count" fill="#6366f1" radius={[0, 4, 4, 0]} isAnimationActive={false} />
      </BarChart>
    </ResponsiveContainer>
  );
}
