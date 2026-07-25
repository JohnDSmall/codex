import { HardHat } from "lucide-react";

export function UnderConstruction({ title, blurb }: { title: string; blurb?: string }) {
  return (
    <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 py-8 space-y-6">
      <header>
        <h1 className="text-2xl font-semibold">{title}</h1>
        {blurb && <p className="text-sm text-neutral-500">{blurb}</p>}
      </header>
      <div className="rounded-xl border border-dashed border-neutral-300 dark:border-neutral-700 bg-white dark:bg-neutral-900 p-12 text-center">
        <HardHat className="w-10 h-10 mx-auto text-neutral-400" />
        <h2 className="mt-4 text-lg font-medium">Under construction</h2>
        <p className="mt-1 text-sm text-neutral-500">This section is on the roadmap.</p>
      </div>
    </div>
  );
}
