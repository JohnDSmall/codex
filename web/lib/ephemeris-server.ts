import "server-only";
import { supabaseAdmin } from "./supabase-server";

/* ------------------------------------------------------------------ types */

export type Tag = { id: string; name: string };
export type Category = { id: string; parent: string; name: string };

export type Expense = {
  id: string;
  date: string;
  description: string;
  amount: number;
  category_id: string | null;
  tag_id: string | null;
  client: string | null;
  tax_status: string | null;
  notes: string | null;
  card: string | null;
  merchant: string | null;
  source: string | null;
  tag_name: string | null;
  cat_name: string | null;
};

export type Income = {
  id: string;
  date: string;
  description: string;
  amount: number;
  client: string | null;
  tag_id: string | null;
  notes: string | null;
  income_type: string | null;
  tag_name: string | null;
};

export type Asset = {
  id: string;
  name: string;
  asset_type: string;
  value: number;
  as_of_date: string;
  tag_id: string | null;
  notes: string | null;
  tag_name: string | null;
};

export type HoursRow = {
  id: string;
  date: string;
  hours: number;
  rate: number | null;
  pay_status: string | null;
  client: string | null;
  project: string | null;
  description: string | null;
  tag_id: string | null;
  tag_name: string | null;
};

export const INCOME_TYPES = ["Salary", "Bonus", "Reimbursement"] as const;

/* ---------------------------------------------------------------- helpers */

const num = (v: unknown): number => (v == null ? 0 : Number(v));

/** PostgREST caps a single response at 1000 rows; page until exhausted. */
async function fetchAll<T>(
  build: () => { range: (a: number, b: number) => PromiseLike<{ data: unknown; error: unknown }> },
  pageSize = 1000,
): Promise<T[]> {
  const out: T[] = [];
  for (let from = 0; ; from += pageSize) {
    const { data, error } = await build().range(from, from + pageSize - 1);
    if (error) throw error;
    const batch = (data ?? []) as T[];
    out.push(...batch);
    if (batch.length < pageSize) return out;
  }
}

/** Supabase returns embedded relations as an object (or null). */
function relName(rel: unknown): string | null {
  if (rel && typeof rel === "object" && "name" in rel) {
    const n = (rel as { name?: unknown }).name;
    return typeof n === "string" ? n : null;
  }
  return null;
}

/* ---------------------------------------------------------------- filters */

export type Filters = {
  card: string | null;
  tag: string | null;
  category: string | null;
  from_date: string | null;
  to_date: string | null;
  q: string | null;
};

function iso(d: Date): string {
  return d.toISOString().slice(0, 10);
}

/** First and last day of the previous calendar month. */
export function lastCompletedMonthRange(today = new Date()): [string, string] {
  const firstThis = new Date(Date.UTC(today.getUTCFullYear(), today.getUTCMonth(), 1));
  const lastPrev = new Date(firstThis.getTime() - 86_400_000);
  const firstPrev = new Date(Date.UTC(lastPrev.getUTCFullYear(), lastPrev.getUTCMonth(), 1));
  return [iso(firstPrev), iso(lastPrev)];
}

/** Range covering the last 3 COMPLETED calendar months. */
export function trailing3moRange(today = new Date()): [string, string] {
  const firstThis = new Date(Date.UTC(today.getUTCFullYear(), today.getUTCMonth(), 1));
  const lastPrev = new Date(firstThis.getTime() - 86_400_000);
  const threeBack = new Date(Date.UTC(today.getUTCFullYear(), today.getUTCMonth() - 3, 1));
  return [iso(threeBack), iso(lastPrev)];
}

export type RawSearchParams = Record<string, string | string[] | undefined>;

const one = (v: string | string[] | undefined): string | null => {
  const s = Array.isArray(v) ? v[0] : v;
  const t = (s ?? "").trim();
  return t === "" ? null : t;
};

/**
 * Mirrors the Flask `_filters_from_request`: when neither `from` nor `to`
 * appears in the query string at all, default to the last completed calendar
 * month. If either is present — even empty (`?from=&to=`) — honor it, so an
 * empty pair means "all time".
 */
export function filtersFromSearchParams(sp: RawSearchParams): Filters {
  const hasRange = "from" in sp || "to" in sp;
  const [defFrom, defTo] = lastCompletedMonthRange();
  return {
    card: one(sp.card),
    tag: one(sp.tag),
    category: one(sp.category),
    q: one(sp.q),
    from_date: hasRange ? one(sp.from) : defFrom,
    to_date: hasRange ? one(sp.to) : defTo,
  };
}

/** Serialize filters back to a query string, preserving "all time" intent. */
export function filtersToQuery(f: Partial<Filters>): string {
  const p = new URLSearchParams();
  if (f.card) p.set("card", f.card);
  if (f.tag) p.set("tag", f.tag);
  if (f.category) p.set("category", f.category);
  if (f.q) p.set("q", f.q);
  // Always emit both so the absent-means-default rule doesn't kick back in.
  p.set("from", f.from_date ?? "");
  p.set("to", f.to_date ?? "");
  return p.toString();
}

const EXPENSE_SELECT =
  "*, tag:eph_tags(name), category:eph_categories(name)";

type ExpenseFilterable = {
  eq: (c: string, v: string) => ExpenseFilterable;
  gte: (c: string, v: string) => ExpenseFilterable;
  lte: (c: string, v: string) => ExpenseFilterable;
  or: (f: string) => ExpenseFilterable;
};

function applyFilters<T extends ExpenseFilterable>(q: T, f: Filters): T {
  let out = q;
  if (f.card) out = out.eq("card", f.card) as T;
  if (f.tag) out = out.eq("tag_id", f.tag) as T;
  if (f.category) out = out.eq("category_id", f.category) as T;
  if (f.from_date) out = out.gte("date", f.from_date) as T;
  if (f.to_date) out = out.lte("date", f.to_date) as T;
  if (f.q) {
    // PostgREST `or` needs commas/parens escaped inside the value.
    const safe = f.q.replace(/[(),]/g, " ");
    out = out.or(`description.ilike.*${safe}*,merchant.ilike.*${safe}*`) as T;
  }
  return out;
}

/* ------------------------------------------------------------- reference */

export async function loadTags(): Promise<Tag[]> {
  const { data, error } = await supabaseAdmin.from("eph_tags").select("id, name").order("name");
  if (error) throw error;
  return (data ?? []) as Tag[];
}

export async function loadCategories(): Promise<Category[]> {
  const { data, error } = await supabaseAdmin
    .from("eph_categories")
    .select("id, parent, name")
    .order("parent")
    .order("name");
  if (error) throw error;
  return (data ?? []) as Category[];
}

export async function loadCards(): Promise<string[]> {
  const rows = await fetchAll<{ card: string | null }>(() =>
    supabaseAdmin.from("eph_expenses").select("card").not("card", "is", null),
  );
  return Array.from(new Set(rows.map((r) => r.card).filter((c): c is string => !!c))).sort();
}

/* -------------------------------------------------------------- expenses */

function toExpense(r: Record<string, unknown>): Expense {
  return {
    id: String(r.id),
    date: String(r.date),
    description: String(r.description ?? ""),
    amount: num(r.amount),
    category_id: (r.category_id as string | null) ?? null,
    tag_id: (r.tag_id as string | null) ?? null,
    client: (r.client as string | null) ?? null,
    tax_status: (r.tax_status as string | null) ?? null,
    notes: (r.notes as string | null) ?? null,
    card: (r.card as string | null) ?? null,
    merchant: (r.merchant as string | null) ?? null,
    source: (r.source as string | null) ?? null,
    tag_name: relName(r.tag),
    cat_name: relName(r.category),
  };
}

export async function loadExpenses(f: Filters): Promise<Expense[]> {
  const rows = await fetchAll<Record<string, unknown>>(() =>
    applyFilters(
      supabaseAdmin.from("eph_expenses").select(EXPENSE_SELECT).order("date", { ascending: false }) as never,
      f,
    ),
  );
  return rows.map(toExpense);
}

export async function loadAllExpenses(): Promise<Expense[]> {
  const rows = await fetchAll<Record<string, unknown>>(() =>
    supabaseAdmin.from("eph_expenses").select(EXPENSE_SELECT).order("date", { ascending: false }) as never,
  );
  return rows.map(toExpense);
}

/* ---------------------------------------------------------------- income */

export async function loadIncome(tagId?: string | null): Promise<Income[]> {
  const rows = await fetchAll<Record<string, unknown>>(() => {
    const q = supabaseAdmin
      .from("eph_income")
      .select("*, tag:eph_tags(name)")
      .order("date", { ascending: false });
    return (tagId ? q.eq("tag_id", tagId) : q) as never;
  });
  return rows.map((r) => ({
    id: String(r.id),
    date: String(r.date),
    description: String(r.description ?? ""),
    amount: num(r.amount),
    client: (r.client as string | null) ?? null,
    tag_id: (r.tag_id as string | null) ?? null,
    notes: (r.notes as string | null) ?? null,
    income_type: (r.income_type as string | null) ?? null,
    tag_name: relName(r.tag),
  }));
}

/* ---------------------------------------------------------------- assets */

export async function loadAssets(): Promise<Asset[]> {
  const rows = await fetchAll<Record<string, unknown>>(() =>
    supabaseAdmin
      .from("eph_assets")
      .select("*, tag:eph_tags(name)")
      .order("value", { ascending: false }) as never,
  );
  return rows.map((r) => ({
    id: String(r.id),
    name: String(r.name ?? ""),
    asset_type: String(r.asset_type ?? ""),
    value: num(r.value),
    as_of_date: String(r.as_of_date),
    tag_id: (r.tag_id as string | null) ?? null,
    notes: (r.notes as string | null) ?? null,
    tag_name: relName(r.tag),
  }));
}

/* ----------------------------------------------------------------- hours */

export async function loadHours(tagId?: string | null): Promise<HoursRow[]> {
  const rows = await fetchAll<Record<string, unknown>>(() => {
    const q = supabaseAdmin
      .from("eph_hours")
      .select("*, tag:eph_tags(name)")
      .order("date", { ascending: false });
    return (tagId ? q.eq("tag_id", tagId) : q) as never;
  });
  return rows.map((r) => ({
    id: String(r.id),
    date: String(r.date),
    hours: num(r.hours),
    rate: r.rate == null ? null : num(r.rate),
    pay_status: (r.pay_status as string | null) ?? null,
    client: (r.client as string | null) ?? null,
    project: (r.project as string | null) ?? null,
    description: (r.description as string | null) ?? null,
    tag_id: (r.tag_id as string | null) ?? null,
    tag_name: relName(r.tag),
  }));
}

/* ------------------------------------------------------------- dashboard */

export type TagTotals = { tag: string; income: number; expenses: number; net: number };
export type MonthRow = { month: string; income: number; expenses: number; net: number };

export type DashboardData = {
  totalsByTag: TagTotals[];
  assetsTotal: number;
  assetsByTag: { tag: string; value: number }[];
  months: MonthRow[];
  monthlyByTag: Record<string, Record<string, { income: number; expenses: number }>>;
  tagNames: string[];
  recentExpenses: Expense[];
  recentIncome: Income[];
  totalIncome: number;
  totalExpenses: number;
};

export async function loadDashboard(): Promise<DashboardData> {
  const [tags, expenses, income, assets] = await Promise.all([
    loadTags(),
    loadAllExpenses(),
    loadIncome(),
    loadAssets(),
  ]);

  const tagNames = tags.map((t) => t.name);
  const blank = () => ({ income: 0, expenses: 0 });

  const byTag = new Map<string, { income: number; expenses: number }>();
  for (const n of tagNames) byTag.set(n, blank());
  const bucket = (name: string | null) => {
    const key = name ?? "Untagged";
    if (!byTag.has(key)) byTag.set(key, blank());
    return byTag.get(key)!;
  };
  for (const e of expenses) bucket(e.tag_name).expenses += e.amount;
  for (const i of income) bucket(i.tag_name).income += i.amount;

  const totalsByTag: TagTotals[] = Array.from(byTag.entries())
    .map(([tag, v]) => ({ tag, income: v.income, expenses: v.expenses, net: v.income - v.expenses }))
    .sort((a, b) => a.tag.localeCompare(b.tag));

  const assetsByTagMap = new Map<string, number>();
  for (const n of tagNames) assetsByTagMap.set(n, 0);
  for (const a of assets) {
    const key = a.tag_name ?? "Untagged";
    assetsByTagMap.set(key, (assetsByTagMap.get(key) ?? 0) + a.value);
  }

  const monthSet = new Set<string>();
  const monthlyByTag: Record<string, Record<string, { income: number; expenses: number }>> = {};
  const touch = (m: string, tag: string) => {
    monthSet.add(m);
    monthlyByTag[m] ??= {};
    monthlyByTag[m][tag] ??= { income: 0, expenses: 0 };
    return monthlyByTag[m][tag];
  };
  for (const e of expenses) touch(e.date.slice(0, 7), e.tag_name ?? "Untagged").expenses += e.amount;
  for (const i of income) touch(i.date.slice(0, 7), i.tag_name ?? "Untagged").income += i.amount;

  const months: MonthRow[] = Array.from(monthSet)
    .sort()
    .reverse()
    .map((m) => {
      let inc = 0;
      let exp = 0;
      for (const v of Object.values(monthlyByTag[m] ?? {})) {
        inc += v.income;
        exp += v.expenses;
      }
      return { month: m, income: inc, expenses: exp, net: inc - exp };
    });

  return {
    totalsByTag,
    assetsTotal: assets.reduce((s, a) => s + a.value, 0),
    assetsByTag: Array.from(assetsByTagMap.entries())
      .map(([tag, value]) => ({ tag, value }))
      .sort((a, b) => a.tag.localeCompare(b.tag)),
    months,
    monthlyByTag,
    tagNames,
    recentExpenses: expenses.slice(0, 10),
    recentIncome: income.slice(0, 10),
    totalIncome: income.reduce((s, i) => s + i.amount, 0),
    totalExpenses: expenses.reduce((s, e) => s + e.amount, 0),
  };
}

/* -------------------------------------------------------------- spending */

export type SpendingData = {
  kpi: {
    n: number;
    total: number;
    avg: number;
    months: number;
    monthlyAvg: number;
    monthlyAvgWindow: string;
  };
  byCard: { card: string; n: number; total: number }[];
  byCategory: { cat: string; total: number }[];
  byMonth: { month: string; total: number }[];
  topMerchants: { merchant: string; n: number; total: number }[];
  rows: Expense[];
};

export async function loadSpending(f: Filters): Promise<SpendingData> {
  const rows = await loadExpenses(f);

  // Avg/month uses the trailing 3 COMPLETED months, independent of the date
  // filter but still honoring card/tag/category/q (matches the Flask app).
  const [m3From, m3To] = trailing3moRange();
  const m3Rows = await loadExpenses({ ...f, from_date: m3From, to_date: m3To });
  const m3Months = new Set(m3Rows.map((r) => r.date.slice(0, 7))).size;
  const m3Total = m3Rows.reduce((s, r) => s + r.amount, 0);

  const total = rows.reduce((s, r) => s + r.amount, 0);

  const cardMap = new Map<string, { n: number; total: number }>();
  // The per-card breakdown ignores the card filter so every card stays visible.
  const cardRows = f.card ? await loadExpenses({ ...f, card: null }) : rows;
  for (const r of cardRows) {
    const key = r.card ?? "manual";
    const cur = cardMap.get(key) ?? { n: 0, total: 0 };
    cur.n += 1;
    cur.total += r.amount;
    cardMap.set(key, cur);
  }

  const catMap = new Map<string, number>();
  for (const r of rows) {
    const key = r.cat_name ?? "Uncategorized";
    catMap.set(key, (catMap.get(key) ?? 0) + r.amount);
  }

  const monthMap = new Map<string, number>();
  for (const r of rows) {
    const key = r.date.slice(0, 7);
    monthMap.set(key, (monthMap.get(key) ?? 0) + r.amount);
  }

  const merchMap = new Map<string, { n: number; total: number }>();
  for (const r of rows) {
    const key = r.merchant || r.description;
    const cur = merchMap.get(key) ?? { n: 0, total: 0 };
    cur.n += 1;
    cur.total += r.amount;
    merchMap.set(key, cur);
  }

  return {
    kpi: {
      n: rows.length,
      total,
      avg: rows.length ? total / rows.length : 0,
      months: new Set(rows.map((r) => r.date.slice(0, 7))).size,
      monthlyAvg: m3Months ? m3Total / 3 : 0,
      monthlyAvgWindow: `${m3From} to ${m3To}`,
    },
    byCard: Array.from(cardMap.entries())
      .map(([card, v]) => ({ card, ...v }))
      .sort((a, b) => b.total - a.total),
    byCategory: Array.from(catMap.entries())
      .map(([cat, total]) => ({ cat, total }))
      .sort((a, b) => b.total - a.total),
    byMonth: Array.from(monthMap.entries())
      .map(([month, total]) => ({ month, total }))
      .sort((a, b) => a.month.localeCompare(b.month)),
    topMerchants: Array.from(merchMap.entries())
      .map(([merchant, v]) => ({ merchant, ...v }))
      .sort((a, b) => b.total - a.total)
      .slice(0, 15),
    rows: rows.slice(0, 200),
  };
}

/* --------------------------------------------------------- subscriptions */

function cv(values: number[]): number {
  if (values.length < 2) return 0;
  const mean = values.reduce((s, v) => s + v, 0) / values.length;
  if (mean === 0) return 0;
  const varr = values.reduce((s, v) => s + (v - mean) ** 2, 0) / values.length;
  return Math.sqrt(varr) / Math.abs(mean);
}

/**
 * Port of the Flask `_classify_subscription`. A merchant is a subscription
 * when the amount is stable (CV <= 0.20) AND the cadence is regular
 * (gap CV <= 0.60). Returns null when it looks like ordinary purchases.
 */
export function classifySubscription(
  dateStrs: string[],
  amounts: number[],
): { cadence: string; factor: number } | null {
  const dates = dateStrs.map((d) => Date.parse(d)).sort((a, b) => a - b);
  if (dates.length < 2) return null;

  const gaps: number[] = [];
  for (let i = 0; i < dates.length - 1; i++) {
    gaps.push(Math.round((dates[i + 1] - dates[i]) / 86_400_000));
  }

  if (cv(amounts) > 0.2) return null; // amount varies too much
  if (cv(gaps) > 0.6) return null; // cadence too irregular

  const sorted = [...gaps].sort((a, b) => a - b);
  const median = sorted[Math.floor(sorted.length / 2)];

  if (median <= 10) return { cadence: "Weekly", factor: 30.44 / 7 };
  if (median >= 11 && median <= 20) return { cadence: "Bi-weekly", factor: 30.44 / 14 };
  if (median >= 21 && median <= 45) return { cadence: "Monthly", factor: 1 };
  if (median >= 46 && median <= 75) return { cadence: "~6-weekly", factor: 30.44 / median };
  if (median >= 76 && median <= 120) return { cadence: "Quarterly", factor: 1 / 3 };
  if (median >= 121 && median <= 200) return { cadence: "Semi-annual", factor: 1 / 6 };
  if (median >= 300 && median <= 400) return { cadence: "Annual", factor: 1 / 12 };
  return null;
}

const ACTIVE_THRESHOLDS: Record<string, number> = {
  Weekly: 21,
  "Bi-weekly": 35,
  Monthly: 50,
  "~6-weekly": 90,
  Quarterly: 120,
  "Semi-annual": 220,
  Annual: 420,
};

export function isActive(cadence: string, lastDateIso: string, today = new Date()): boolean {
  const gap = Math.round((today.getTime() - Date.parse(lastDateIso)) / 86_400_000);
  return gap <= (ACTIVE_THRESHOLDS[cadence] ?? 90);
}

export type Subscription = {
  merchant: string;
  n: number;
  cadence: string;
  avgAmount: number;
  monthlyCost: number;
  annualCost: number;
  total: number;
  firstDate: string;
  lastDate: string;
  active: boolean;
  status: "confirmed" | "rejected" | null;
  categories: string;
  cards: string;
};

export type SubscriptionShow = "auto" | "rejected" | "all";

export async function loadSubscriptions(
  f: Filters,
  opts: { activeOnly: boolean; show: SubscriptionShow },
): Promise<{ subs: Subscription[]; totalMonthly: number; totalAnnual: number }> {
  const [rows, overrideRows] = await Promise.all([
    loadExpenses(f),
    supabaseAdmin.from("eph_merchant_subscriptions").select("merchant, status"),
  ]);
  if (overrideRows.error) throw overrideRows.error;

  const overrides = new Map<string, "confirmed" | "rejected">();
  for (const o of (overrideRows.data ?? []) as { merchant: string; status: string }[]) {
    overrides.set(o.merchant, o.status as "confirmed" | "rejected");
  }

  // Group by normalized merchant, falling back to description.
  const groups = new Map<string, Expense[]>();
  for (const r of rows) {
    const key = r.merchant || r.description;
    const g = groups.get(key);
    if (g) g.push(r);
    else groups.set(key, [r]);
  }

  const subs: Subscription[] = [];
  let totalMonthly = 0;

  for (const [merchant, items] of groups) {
    const monthCount = new Set(items.map((i) => i.date.slice(0, 7))).size;
    // Same qualifying bar as the Flask HAVING clause.
    if (items.length < 3 || monthCount < 2) continue;

    const status = overrides.get(merchant) ?? null;
    const amounts = items.map((i) => i.amount);
    const classified = classifySubscription(
      items.map((i) => i.date),
      amounts,
    );

    let cadence = classified?.cadence ?? null;
    let factor = classified?.factor ?? 0;

    if (opts.show === "rejected") {
      if (status !== "rejected") continue;
      if (cadence === null) {
        cadence = "Variable";
        factor = 0;
      }
    } else if (opts.show === "all") {
      if (cadence === null && status === null) continue;
      if (cadence === null) {
        cadence = "Variable";
        factor = 0;
      }
    } else {
      if (status === "rejected") continue;
      if (cadence === null && status !== "confirmed") continue;
      if (cadence === null) {
        cadence = "Variable";
        factor = 0;
      }
    }

    const dates = items.map((i) => i.date).sort();
    const firstDate = dates[0];
    const lastDate = dates[dates.length - 1];
    const active = isActive(cadence, lastDate);
    if (opts.activeOnly && !active && status !== "confirmed") continue;

    const avgAmount = amounts.reduce((s, a) => s + a, 0) / amounts.length;
    const monthlyCost = avgAmount * factor;
    totalMonthly += monthlyCost;

    subs.push({
      merchant,
      n: items.length,
      cadence,
      avgAmount: Math.round(avgAmount * 100) / 100,
      monthlyCost,
      annualCost: monthlyCost * 12,
      total: Math.round(items.reduce((s, i) => s + i.amount, 0) * 100) / 100,
      firstDate,
      lastDate,
      active,
      status,
      categories: Array.from(new Set(items.map((i) => i.cat_name).filter(Boolean))).join(", "),
      cards: Array.from(new Set(items.map((i) => i.card ?? "manual"))).join(", "),
    });
  }

  subs.sort((a, b) => b.monthlyCost - a.monthlyCost);
  return { subs, totalMonthly, totalAnnual: totalMonthly * 12 };
}
