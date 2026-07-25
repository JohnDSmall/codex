import type { ReactNode } from "react";
import { LineChart } from "lucide-react";
import { EphemerisNav } from "../components/ephemeris/EphemerisNav";

export const metadata = {
  title: "Ephemeris · Codex",
  description: "Financial management — assets, income, expenses, and freelance hours by life-area.",
};

export default function EphemerisLayout({ children }: { children: ReactNode }) {
  return (
    <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 py-8 space-y-6">
      <div className="space-y-4">
        <div className="flex items-center gap-2.5">
          <LineChart className="w-5 h-5 text-indigo-500" />
          <h1 className="text-2xl font-semibold tracking-tight">Ephemeris</h1>
          <span className="text-sm text-neutral-500">financial management</span>
        </div>
        <EphemerisNav />
      </div>
      {children}
    </div>
  );
}
