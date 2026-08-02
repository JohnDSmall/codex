import "server-only";
import { supabaseAdmin } from "./supabase-server";

export type ProjectContact = { name: string; email?: string | null; role?: string | null };
export type ProjectLineItem = { item?: string; date?: string; amount?: number };

export type Project = {
  id: string;
  legacy_id: string | null;
  name: string;
  client: string | null;
  description: string | null;
  status: "active" | "inactive" | "completed" | "abandoned" | "on_hold";
  priority: string;
  start_date: string | null;
  due_date: string | null;
  estimated_hours: number;
  hours_spent: number;
  hours_remaining: number;
  total_actions: number;
  completed_actions: number;
  revenue: number;
  projected_revenue: number;
  cost: number;
  costs: ProjectLineItem[];
  revenues: ProjectLineItem[];
  contacts: ProjectContact[];
  tags: string[];
  created_at: string;
  updated_at: string;
};

/** Hours and revenue are derived from linked rows, never from the stored columns. */
export type ProjectTotals = {
  hoursLogged: number;
  hourEntries: number;
  revenueLinked: number;
  incomeEntries: number;
};

export type ProjectWithTotals = Project & { totals: ProjectTotals };

export type HourEntry = {
  id: string;
  date: string;
  hours: number;
  rate: number | null;
  pay_status: string | null;
  client: string | null;
  project: string | null;
  description: string | null;
  project_id: string | null;
};

export type IncomeEntry = {
  id: string;
  date: string;
  description: string;
  amount: number;
  client: string | null;
  income_type: string | null;
  notes: string | null;
  project_id: string | null;
};

const PROJECT_COLUMNS = "*";
const HOUR_COLUMNS = "id,date,hours,rate,pay_status,client,project,description,project_id";
const INCOME_COLUMNS = "id,date,description,amount,client,income_type,notes,project_id";

const EMPTY_TOTALS: ProjectTotals = {
  hoursLogged: 0,
  hourEntries: 0,
  revenueLinked: 0,
  incomeEntries: 0,
};

/**
 * `project_id` arrives in migration 20260802120000. Until that is applied,
 * PostgREST answers 42703 / PGRST204. Treat that as "no links yet" rather than
 * an error, so /projects keeps rendering — same rule as /wealth with a pending
 * wealth_snapshots.
 */
function isMissingColumn(error: { code?: string; message?: string } | null): boolean {
  if (!error) return false;
  return (
    error.code === "42703" ||
    error.code === "PGRST204" ||
    /project_id/.test(error.message ?? "")
  );
}

async function loadLinkedRows(): Promise<{
  hours: HourEntry[];
  income: IncomeEntry[];
  linksMissing: boolean;
}> {
  const [h, i] = await Promise.all([
    supabaseAdmin.from("eph_hours").select(HOUR_COLUMNS).order("date", { ascending: false }),
    supabaseAdmin.from("eph_income").select(INCOME_COLUMNS).order("date", { ascending: false }),
  ]);
  if (isMissingColumn(h.error) || isMissingColumn(i.error)) {
    return { hours: [], income: [], linksMissing: true };
  }
  if (h.error) throw h.error;
  if (i.error) throw i.error;
  return {
    hours: (h.data ?? []) as unknown as HourEntry[],
    income: (i.data ?? []) as unknown as IncomeEntry[],
    linksMissing: false,
  };
}

function totalsFor(
  projectId: string,
  hours: HourEntry[],
  income: IncomeEntry[],
): ProjectTotals {
  const hs = hours.filter((r) => r.project_id === projectId);
  const inc = income.filter((r) => r.project_id === projectId);
  return {
    hoursLogged: hs.reduce((s, r) => s + Number(r.hours || 0), 0),
    hourEntries: hs.length,
    revenueLinked: inc.reduce((s, r) => s + Number(r.amount || 0), 0),
    incomeEntries: inc.length,
  };
}

export async function loadProjectsWithTotals(): Promise<{
  projects: ProjectWithTotals[];
  linksMissing: boolean;
}> {
  const { data, error } = await supabaseAdmin
    .from("projects")
    .select(PROJECT_COLUMNS)
    .order("due_date", { ascending: true, nullsFirst: false });
  if (error) throw error;
  const projects = (data ?? []) as unknown as Project[];
  const { hours, income, linksMissing } = await loadLinkedRows();
  return {
    projects: projects.map((p) => ({
      ...p,
      totals: linksMissing ? EMPTY_TOTALS : totalsFor(p.id, hours, income),
    })),
    linksMissing,
  };
}

export async function loadProjectById(id: string): Promise<Project | null> {
  const { data, error } = await supabaseAdmin
    .from("projects")
    .select(PROJECT_COLUMNS)
    .eq("id", id)
    .single();
  if (error) {
    if (error.code === "PGRST116") return null;
    throw error;
  }
  return data as unknown as Project;
}

export type ProjectDetail = {
  project: Project;
  totals: ProjectTotals;
  hours: HourEntry[];
  income: IncomeEntry[];
  /** Income not yet attributed to any project — the "link existing" picker. */
  unlinkedIncome: IncomeEntry[];
  linksMissing: boolean;
};

export async function loadProjectDetail(id: string): Promise<ProjectDetail | null> {
  const project = await loadProjectById(id);
  if (!project) return null;
  const { hours, income, linksMissing } = await loadLinkedRows();
  return {
    project,
    totals: linksMissing ? EMPTY_TOTALS : totalsFor(id, hours, income),
    hours: hours.filter((r) => r.project_id === id),
    income: income.filter((r) => r.project_id === id),
    unlinkedIncome: income.filter((r) => !r.project_id),
    linksMissing,
  };
}

/** Distinct client names already in use, for the datalist on the project form. */
export async function loadClientSuggestions(): Promise<string[]> {
  const { data, error } = await supabaseAdmin.from("projects").select("client");
  if (error) return [];
  const set = new Set<string>();
  for (const r of (data ?? []) as { client: string | null }[]) {
    if (r.client) set.add(r.client);
  }
  return [...set].sort((a, b) => a.localeCompare(b));
}
