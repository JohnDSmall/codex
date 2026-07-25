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

export type Snapshot = {
  id: string;
  item_id: string;
  as_of_date: string;
  value: number;
  note: string | null;
};

const num = (v: unknown): number => (v == null ? 0 : Number(v));

export async function loadAllWealth(): Promise<WealthItem[]> {
  const { data, error } = await supabaseAdmin
    .from("wealth_items")
    .select("*")
    .order("current_value", { ascending: false });
  if (error) throw error;
  return (data ?? []).map((r) => ({
    ...(r as unknown as WealthItem),
    current_value: num((r as Record<string, unknown>).current_value),
    original_value: num((r as Record<string, unknown>).original_value),
  }));
}

/** True when the error means the table hasn't been created yet. */
function isMissingTable(error: { code?: string; message?: string } | null): boolean {
  if (!error) return false;
  return (
    error.code === "PGRST205" || // PostgREST: not in schema cache
    error.code === "42P01" || // Postgres: undefined_table
    /wealth_snapshots/.test(error.message ?? "")
  );
}

/**
 * Load every snapshot. Returns `tableMissing: true` rather than throwing when
 * the migration hasn't been applied, so /wealth still renders from the legacy
 * `eoy_values` + `current_value` columns instead of hard-failing.
 */
export async function loadSnapshots(): Promise<{ snapshots: Snapshot[]; tableMissing: boolean }> {
  const out: Snapshot[] = [];
  const pageSize = 1000;
  for (let from = 0; ; from += pageSize) {
    const { data, error } = await supabaseAdmin
      .from("wealth_snapshots")
      .select("id, item_id, as_of_date, value, note")
      .order("as_of_date", { ascending: true })
      .range(from, from + pageSize - 1);

    if (error) {
      if (isMissingTable(error)) return { snapshots: [], tableMissing: true };
      throw error;
    }

    const batch = (data ?? []) as Record<string, unknown>[];
    out.push(
      ...batch.map((r) => ({
        id: String(r.id),
        item_id: String(r.item_id),
        as_of_date: String(r.as_of_date),
        value: num(r.value),
        note: (r.note as string | null) ?? null,
      })),
    );
    if (batch.length < pageSize) return { snapshots: out, tableMissing: false };
  }
}

/**
 * Legacy history path: one Dec-31 point per year from `eoy_values`. Used only
 * until the snapshots migration runs, so the chart keeps working meanwhile.
 */
export function buildHistoryFromEoy(items: WealthItem[]): WealthHistoryRow[] {
  const years = new Set<number>();
  for (const item of items) {
    for (const y of Object.keys(item.eoy_values ?? {})) {
      const yn = Number(y);
      if (Number.isFinite(yn)) years.add(yn);
    }
  }
  return Array.from(years)
    .sort((a, b) => a - b)
    .map((year) => {
      let assets = 0;
      let liabilities = 0;
      for (const item of items) {
        const v = item.eoy_values?.[String(year)];
        if (v == null) continue;
        if (item.type === "asset") assets += Number(v);
        else if (item.type === "liability") liabilities += Number(v);
      }
      return { date: `${year}-12-31`, assets, liabilities, netWorth: assets - liabilities };
    });
}

export async function loadSnapshotsForItem(itemId: string): Promise<Snapshot[]> {
  const { data, error } = await supabaseAdmin
    .from("wealth_snapshots")
    .select("id, item_id, as_of_date, value, note")
    .eq("item_id", itemId)
    .order("as_of_date", { ascending: false });
  if (error) throw error;
  return (data ?? []).map((r) => {
    const o = r as Record<string, unknown>;
    return {
      id: String(o.id),
      item_id: String(o.item_id),
      as_of_date: String(o.as_of_date),
      value: num(o.value),
      note: (o.note as string | null) ?? null,
    };
  });
}

export type WealthHistoryRow = {
  date: string;
  assets: number;
  liabilities: number;
  netWorth: number;
};

/**
 * Net worth at every date any account was updated.
 *
 * Values carry forward: on a date where only one account was re-valued, every
 * other account contributes its most recent prior snapshot rather than zero.
 * An account contributes nothing before its first snapshot (it didn't exist).
 */
export function buildHistory(items: WealthItem[], snapshots: Snapshot[]): WealthHistoryRow[] {
  if (snapshots.length === 0) return [];

  const typeOf = new Map(items.map((i) => [i.id, i.type]));

  // item -> its snapshots, ascending by date
  const byItem = new Map<string, Snapshot[]>();
  for (const s of snapshots) {
    const list = byItem.get(s.item_id);
    if (list) list.push(s);
    else byItem.set(s.item_id, [s]);
  }
  for (const list of byItem.values()) {
    list.sort((a, b) => a.as_of_date.localeCompare(b.as_of_date));
  }

  const dates = Array.from(new Set(snapshots.map((s) => s.as_of_date))).sort();

  // Walk dates forward, advancing a per-item cursor — O(dates + snapshots).
  const cursor = new Map<string, number>();
  const carried = new Map<string, number>();

  return dates.map((date) => {
    for (const [itemId, list] of byItem) {
      let i = cursor.get(itemId) ?? 0;
      while (i < list.length && list[i].as_of_date <= date) {
        carried.set(itemId, list[i].value);
        i++;
      }
      cursor.set(itemId, i);
    }

    let assets = 0;
    let liabilities = 0;
    for (const [itemId, value] of carried) {
      const t = typeOf.get(itemId);
      if (t === "asset") assets += value;
      else if (t === "liability") liabilities += value;
    }
    return { date, assets, liabilities, netWorth: assets - liabilities };
  });
}

/** Latest snapshot value per item, falling back to the stored current_value. */
export function latestValues(items: WealthItem[], snapshots: Snapshot[]): Map<string, number> {
  const latest = new Map<string, { date: string; value: number }>();
  for (const s of snapshots) {
    const cur = latest.get(s.item_id);
    if (!cur || s.as_of_date >= cur.date) {
      latest.set(s.item_id, { date: s.as_of_date, value: s.value });
    }
  }
  const out = new Map<string, number>();
  for (const i of items) out.set(i.id, latest.get(i.id)?.value ?? i.current_value);
  return out;
}

/** Most recent snapshot date per item (null if the item has none). */
export function latestDates(snapshots: Snapshot[]): Map<string, string> {
  const out = new Map<string, string>();
  for (const s of snapshots) {
    const cur = out.get(s.item_id);
    if (!cur || s.as_of_date > cur) out.set(s.item_id, s.as_of_date);
  }
  return out;
}

export type SeriesPoint = { id: string; date: string; value: number };

/** Per-item series for sparklines and the history list, ascending by date. */
export function seriesByItem(snapshots: Snapshot[]): Map<string, SeriesPoint[]> {
  const out = new Map<string, SeriesPoint[]>();
  for (const s of snapshots) {
    const point: SeriesPoint = { id: s.id, date: s.as_of_date, value: s.value };
    const list = out.get(s.item_id);
    if (list) list.push(point);
    else out.set(s.item_id, [point]);
  }
  for (const list of out.values()) list.sort((a, b) => a.date.localeCompare(b.date));
  return out;
}

export type WealthSummary = {
  assets: WealthItem[];
  liabilities: WealthItem[];
  targets: WealthItem[];
  totalAssets: number;
  totalLiabilities: number;
  netWorth: number;
  values: Map<string, number>;
  dates: Map<string, string>;
};

export function summarizeWealth(items: WealthItem[], snapshots: Snapshot[]): WealthSummary {
  const values = latestValues(items, snapshots);
  const dates = latestDates(snapshots);
  const val = (i: WealthItem) => values.get(i.id) ?? i.current_value;

  const assets = items.filter((i) => i.type === "asset").sort((a, b) => val(b) - val(a));
  const liabilities = items.filter((i) => i.type === "liability").sort((a, b) => val(b) - val(a));
  const targets = items.filter((i) => i.type === "target_asset").sort((a, b) => val(b) - val(a));

  const totalAssets = assets.reduce((s, i) => s + val(i), 0);
  const totalLiabilities = liabilities.reduce((s, i) => s + val(i), 0);

  return {
    assets,
    liabilities,
    targets,
    totalAssets,
    totalLiabilities,
    netWorth: totalAssets - totalLiabilities,
    values,
    dates,
  };
}

/** Change over the trailing `days` window, for a headline delta. */
export function changeOverWindow(
  history: WealthHistoryRow[],
  days: number,
  today = new Date(),
): { delta: number; pct: number; from: string } | null {
  if (history.length < 2) return null;
  const cutoff = new Date(today.getTime() - days * 86_400_000).toISOString().slice(0, 10);
  const prior = [...history].reverse().find((h) => h.date <= cutoff) ?? history[0];
  const current = history[history.length - 1];
  if (prior.date === current.date) return null;
  const delta = current.netWorth - prior.netWorth;
  const pct = prior.netWorth === 0 ? 0 : (delta / Math.abs(prior.netWorth)) * 100;
  return { delta, pct, from: prior.date };
}
