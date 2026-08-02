"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { supabaseAdmin } from "./supabase-server";
import type { ProjectContact } from "./projects-server";

/* ---------------------------------------------------------------- helpers */

const str = (fd: FormData, k: string): string | null => {
  const v = fd.get(k);
  if (typeof v !== "string") return null;
  const t = v.trim();
  return t === "" ? null : t;
};

function required(fd: FormData, k: string): string {
  const v = str(fd, k);
  if (v === null) throw new Error(`${k} is required.`);
  return v;
}

function num(fd: FormData, k: string, fallback = 0): number {
  const raw = str(fd, k);
  if (raw === null) return fallback;
  // Tolerate "$1,234.56" and "12 h" from paste.
  const n = Number(raw.replace(/[$,\s]/g, ""));
  if (!Number.isFinite(n)) throw new Error(`${k} must be a number.`);
  return n;
}

const STATUSES = ["active", "inactive", "completed", "abandoned", "on_hold"];
const PRIORITIES = ["high", "medium", "low"];

function choice(fd: FormData, k: string, allowed: string[], fallback: string): string {
  const v = (str(fd, k) ?? "").toLowerCase();
  return allowed.includes(v) ? v : fallback;
}

/** "a, b , c" -> ["a","b","c"]; blank -> []. */
function list(fd: FormData, k: string): string[] {
  const raw = str(fd, k);
  if (!raw) return [];
  return raw.split(",").map((s) => s.trim()).filter(Boolean);
}

/**
 * Contacts come from repeated fields (contact_name[], contact_role[],
 * contact_email[]); a row is kept only if it has a name.
 */
function contacts(fd: FormData): ProjectContact[] {
  const names = fd.getAll("contact_name").map(String);
  const roles = fd.getAll("contact_role").map(String);
  const emails = fd.getAll("contact_email").map(String);
  const out: ProjectContact[] = [];
  for (let i = 0; i < names.length; i++) {
    const name = (names[i] ?? "").trim();
    if (!name) continue;
    out.push({
      name,
      role: (roles[i] ?? "").trim() || null,
      email: (emails[i] ?? "").trim() || null,
    });
  }
  return out;
}

function projectFields(fd: FormData) {
  return {
    name: required(fd, "name"),
    client: str(fd, "client"),
    description: str(fd, "description"),
    status: choice(fd, "status", STATUSES, "active"),
    priority: choice(fd, "priority", PRIORITIES, "medium"),
    start_date: str(fd, "start_date"),
    due_date: str(fd, "due_date"),
    estimated_hours: num(fd, "estimated_hours"),
    projected_revenue: num(fd, "projected_revenue"),
    cost: num(fd, "cost"),
    total_actions: num(fd, "total_actions"),
    completed_actions: num(fd, "completed_actions"),
    tags: list(fd, "tags"),
    contacts: contacts(fd),
    updated_at: new Date().toISOString(),
  };
}

/**
 * hours_spent / revenue / hours_remaining are intentionally NOT written here.
 * They are derived from linked eph_hours / eph_income rows at read time; the
 * stored columns survive only as the pre-link historical figures.
 */

function revalidateProject(id?: string) {
  revalidatePath("/projects");
  if (id) {
    revalidatePath(`/projects/${id}`);
    revalidatePath(`/projects/${id}/edit`);
  }
}

/* --------------------------------------------------------------- projects */

export async function createProject(formData: FormData) {
  const { data, error } = await supabaseAdmin
    .from("projects")
    .insert(projectFields(formData))
    .select("id")
    .single();
  if (error) throw new Error(error.message);
  revalidateProject();
  redirect(`/projects/${(data as { id: string }).id}`);
}

export async function updateProject(id: string, formData: FormData) {
  const { error } = await supabaseAdmin
    .from("projects")
    .update(projectFields(formData))
    .eq("id", id);
  if (error) throw new Error(error.message);
  revalidateProject(id);
  redirect(`/projects/${id}`);
}

export async function deleteProject(id: string) {
  // eph_hours / eph_income rows survive: the FK is `on delete set null`, so
  // deleting a project unlinks its history rather than destroying it.
  const { error } = await supabaseAdmin.from("projects").delete().eq("id", id);
  if (error) throw new Error(error.message);
  revalidateProject();
  revalidatePath("/ephemeris/hours");
  revalidatePath("/ephemeris/income");
  redirect("/projects");
}

/* ------------------------------------------------------------------ hours */

export async function logProjectHours(projectId: string, formData: FormData) {
  const row = {
    date: required(formData, "date"),
    hours: num(formData, "hours"),
    rate: str(formData, "rate") === null ? null : num(formData, "rate"),
    description: str(formData, "description"),
    client: str(formData, "client"),
    pay_status: str(formData, "pay_status"),
    project_id: projectId,
  };
  if (row.hours <= 0) throw new Error("Hours must be greater than zero.");
  const { error } = await supabaseAdmin.from("eph_hours").insert(row);
  if (error) throw new Error(error.message);
  revalidateProject(projectId);
  revalidatePath("/ephemeris/hours");
}

export async function deleteHourEntry(id: string, projectId: string) {
  const { error } = await supabaseAdmin.from("eph_hours").delete().eq("id", id);
  if (error) throw new Error(error.message);
  revalidateProject(projectId);
  revalidatePath("/ephemeris/hours");
}

/** Detach an hour row from the project without deleting the hours themselves. */
export async function unlinkHourEntry(id: string, projectId: string) {
  const { error } = await supabaseAdmin
    .from("eph_hours")
    .update({ project_id: null })
    .eq("id", id);
  if (error) throw new Error(error.message);
  revalidateProject(projectId);
  revalidatePath("/ephemeris/hours");
}

/* ----------------------------------------------------------------- income */

export async function addProjectIncome(projectId: string, formData: FormData) {
  const row = {
    date: required(formData, "date"),
    description: required(formData, "description"),
    amount: num(formData, "amount"),
    client: str(formData, "client"),
    income_type: str(formData, "income_type"),
    notes: str(formData, "notes"),
    project_id: projectId,
  };
  const { error } = await supabaseAdmin.from("eph_income").insert(row);
  if (error) throw new Error(error.message);
  revalidateProject(projectId);
  revalidatePath("/ephemeris/income");
}

/** Attach an existing, unattributed income row to this project. */
export async function linkIncome(incomeId: string, projectId: string) {
  const { error } = await supabaseAdmin
    .from("eph_income")
    .update({ project_id: projectId })
    .eq("id", incomeId);
  if (error) throw new Error(error.message);
  revalidateProject(projectId);
  revalidatePath("/ephemeris/income");
}

export async function unlinkIncome(incomeId: string, projectId: string) {
  const { error } = await supabaseAdmin
    .from("eph_income")
    .update({ project_id: null })
    .eq("id", incomeId);
  if (error) throw new Error(error.message);
  revalidateProject(projectId);
  revalidatePath("/ephemeris/income");
}
