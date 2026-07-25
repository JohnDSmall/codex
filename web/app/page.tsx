import Link from "next/link";

export default function HomePage() {
  return (
    <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 py-8 space-y-6">
      <header>
        <h1 className="text-2xl font-semibold">Dashboard</h1>
        <p className="text-sm text-neutral-500">Your life at a glance.</p>
      </header>
      <div className="rounded-xl border border-dashed border-neutral-300 dark:border-neutral-700 bg-white dark:bg-neutral-900 p-10 text-center">
        <h2 className="text-lg font-medium">Under construction</h2>
        <p className="mt-2 text-sm text-neutral-500">
          Cross-section summary coming soon. In the meantime:
        </p>
        <div className="mt-5 flex justify-center gap-3">
          <Link
            href="/relationships"
            className="inline-flex items-center gap-2 rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-500"
          >
            Open Relationships →
          </Link>
          <Link
            href="/relationships/dashboard"
            className="inline-flex items-center gap-2 rounded-lg border border-neutral-300 dark:border-neutral-700 px-4 py-2 text-sm hover:bg-neutral-50 dark:hover:bg-neutral-800"
          >
            Network analytics
          </Link>
        </div>
      </div>
    </div>
  );
}
