import { buildHistory, loadAllWealth, summarizeWealth } from "@/lib/wealth-server";
import { WealthView } from "../components/WealthView";

export const dynamic = "force-dynamic";

export default async function WealthPage() {
  const items = await loadAllWealth();
  const summary = summarizeWealth(items);
  const history = buildHistory(items);
  return (
    <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 py-8 space-y-6">
      <header>
        <h1 className="text-2xl font-semibold">Wealth</h1>
        <p className="text-sm text-neutral-500">
          {items.length} item{items.length === 1 ? "" : "s"} · assets, liabilities, net worth over time
        </p>
      </header>
      <WealthView summary={summary} history={history} />
    </div>
  );
}
