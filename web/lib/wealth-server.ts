import "server-only";
import { supabaseAdmin } from "./supabase-server";

export type WealthItemType = "asset" | "liability" | "target_asset";

export type WealthItem = {
  id: string;
  legacy_id: string | null;
  name: string;
  type: WealthItemType;
  category: string;
  source: string | null;
  current_value: number;
  original_value: number;
  eoy_values: Record<string, number>;
  date_added: string | null;
  date_updated: string | null;
};

export async function loadAllWealth(): Promise<WealthItem[]> {
  const { data, error } = await supabaseAdmin
    .from("wealth_items")
    .select("*")
    .order("current_value", { ascending: false });
  if (error) throw error;
  return (data ?? []) as unknown as WealthItem[];
}

export type WealthHistoryRow = { year: number; assets: number; liabilities: number; netWorth: number };

export function buildHistory(items: WealthItem[]): WealthHistoryRow[] {
  const yearSet = new Set<number>();
  for (const item of items) {
    for (const y of Object.keys(item.eoy_values ?? {})) {
      const yn = Number(y);
      if (Number.isFinite(yn)) yearSet.add(yn);
    }
  }
  const years = Array.from(yearSet).sort((a, b) => a - b);
  return years.map((year) => {
    let assets = 0;
    let liabilities = 0;
    for (const item of items) {
      const v = item.eoy_values?.[String(year)] ?? null;
      if (v == null) continue;
      if (item.type === "asset") assets += v;
      else if (item.type === "liability") liabilities += v;
    }
    return { year, assets, liabilities, netWorth: assets - liabilities };
  });
}

export function summarizeWealth(items: WealthItem[]) {
  const assets = items.filter((i) => i.type === "asset");
  const liabilities = items.filter((i) => i.type === "liability");
  const targets = items.filter((i) => i.type === "target_asset");
  const totalAssets = assets.reduce((s, i) => s + i.current_value, 0);
  const totalLiabilities = liabilities.reduce((s, i) => s + i.current_value, 0);
  return {
    assets,
    liabilities,
    targets,
    totalAssets,
    totalLiabilities,
    netWorth: totalAssets - totalLiabilities,
  };
}
