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

export async function loadAllProjects(): Promise<Project[]> {
  const { data, error } = await supabaseAdmin
    .from("projects")
    .select("*")
    .order("due_date", { ascending: true, nullsFirst: false });
  if (error) throw error;
  return (data ?? []) as unknown as Project[];
}
