import {
  addWealthItem,
  deleteSnapshot,
  deleteWealthItem,
  recordBalances,
} from "@/lib/wealth-actions";
import {
  buildHistory,
  buildHistoryFromEoy,
  changeOverWindow,
  loadAllWealth,
  loadSnapshots,
  seriesByItem,
  summarizeWealth,
} from "@/lib/wealth-server";
import { WealthView, type ItemMeta } from "../components/WealthView";

export const dynamic = "force-dynamic";

export default async function WealthPage() {
  const [items, { snapshots, tableMissing }] = await Promise.all([
    loadAllWealth(),
    loadSnapshots(),
  ]);

  const summary = summarizeWealth(items, snapshots);
  // Until the snapshots migration runs, fall back to the yearly eoy_values chart.
  const history = tableMissing ? buildHistoryFromEoy(items) : buildHistory(items, snapshots);
  const series = seriesByItem(snapshots);
  const change = changeOverWindow(history, 90);

  const meta: Record<string, ItemMeta> = {};
  for (const i of items) {
    meta[i.id] = {
      value: summary.values.get(i.id) ?? i.current_value,
      lastUpdated: summary.dates.get(i.id) ?? i.date_updated,
      series: series.get(i.id) ?? [],
    };
  }

  const latest = history.length ? history[history.length - 1].date : null;

  return (
    <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 py-8 space-y-6">
      <header>
        <h1 className="text-2xl font-semibold">Wealth</h1>
        <p className="text-sm text-neutral-500">
          {items.length} account{items.length === 1 ? "" : "s"}
          {tableMissing ? (
            <> · yearly history only</>
          ) : (
            <>
              {" "}
              · {snapshots.length} dated reading{snapshots.length === 1 ? "" : "s"}
              {latest ? ` · latest ${latest}` : ""}
            </>
          )}
        </p>
      </header>
      <WealthView
        pendingMigration={tableMissing}
        summary={{
          assets: summary.assets,
          liabilities: summary.liabilities,
          targets: summary.targets,
          totalAssets: summary.totalAssets,
          totalLiabilities: summary.totalLiabilities,
          netWorth: summary.netWorth,
        }}
        history={history}
        meta={meta}
        change={change}
        today={new Date().toISOString().slice(0, 10)}
        recordBalances={recordBalances}
        addWealthItem={addWealthItem}
        deleteWealthItem={deleteWealthItem}
        deleteSnapshot={deleteSnapshot}
      />
    </div>
  );
}
