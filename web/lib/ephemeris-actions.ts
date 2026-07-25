"use server";

import { revalidatePath } from "next/cache";
import { supabaseAdmin } from "./supabase-server";

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

function money(fd: FormData, k: string, { optional = false } = {}): number | null {
  const raw = str(fd, k);
  if (raw === null) {
    if (optional) return null;
    throw new Error(`${k} is required.`);
  }
  // Tolerate "$1,234.56" from paste.
  const n = Number(raw.replace(/[$,\s]/g, ""));
  if (!Number.isFinite(n)) throw new Error(`${k} must be a number.`);
  return n;
}

/** Revalidate every ephemeris view a mutation could affect. */
function revalidateEphemeris(...extra: string[]) {
  revalidatePath("/ephemeris");
  revalidatePath("/ephemeris/spending");
  revalidatePath("/ephemeris/subscriptions");
  for (const p of extra) revalidatePath(p);
}

/* -------------------------------------------------------------- expenses */

export async function addExpense(formData: FormData) {
  const row = {
    date: required(formData, "date"),
    description: required(formData, "description"),
    amount: money(formData, "amount"),
    category_id: str(formData, "category_id"),
    tag_id: str(formData, "tag_id"),
    client: str(formData, "client"),
    tax_status: str(formData, "tax_status"),
    notes: str(formData, "notes"),
  };
  const { error } = await supabaseAdmin.from("eph_expenses").insert(row);
  if (error) throw new Error(error.message);
  revalidateEphemeris("/ephemeris/expenses");
}

export async function deleteExpense(id: string) {
  const { error } = await supabaseAdmin.from("eph_expenses").delete().eq("id", id);
  if (error) throw new Error(error.message);
  revalidateEphemeris("/ephemeris/expenses");
}

/* ---------------------------------------------------------------- income */

export async function addIncome(formData: FormData) {
  const row = {
    date: required(formData, "date"),
    description: required(formData, "description"),
    amount: money(formData, "amount"),
    client: str(formData, "client"),
    tag_id: str(formData, "tag_id"),
    notes: str(formData, "notes"),
    income_type: str(formData, "income_type"),
  };
  const { error } = await supabaseAdmin.from("eph_income").insert(row);
  if (error) throw new Error(error.message);
  revalidateEphemeris("/ephemeris/income");
}

export async function deleteIncome(id: string) {
  const { error } = await supabaseAdmin.from("eph_income").delete().eq("id", id);
  if (error) throw new Error(error.message);
  revalidateEphemeris("/ephemeris/income");
}

/* ---------------------------------------------------------------- assets */

export async function addAsset(formData: FormData) {
  const row = {
    name: required(formData, "name"),
    asset_type: required(formData, "asset_type"),
    value: money(formData, "value"),
    as_of_date: required(formData, "as_of_date"),
    tag_id: str(formData, "tag_id"),
    notes: str(formData, "notes"),
  };
  const { error } = await supabaseAdmin.from("eph_assets").insert(row);
  if (error) throw new Error(error.message);
  revalidateEphemeris("/ephemeris/assets");
}

export async function deleteAsset(id: string) {
  const { error } = await supabaseAdmin.from("eph_assets").delete().eq("id", id);
  if (error) throw new Error(error.message);
  revalidateEphemeris("/ephemeris/assets");
}

/* ----------------------------------------------------------------- hours */

export async function addHours(formData: FormData) {
  const row = {
    date: required(formData, "date"),
    hours: money(formData, "hours"),
    rate: money(formData, "rate", { optional: true }),
    pay_status: str(formData, "pay_status"),
    client: str(formData, "client"),
    project: str(formData, "project"),
    description: str(formData, "description"),
    tag_id: str(formData, "tag_id"),
  };
  const { error } = await supabaseAdmin.from("eph_hours").insert(row);
  if (error) throw new Error(error.message);
  revalidateEphemeris("/ephemeris/hours");
}

export async function deleteHours(id: string) {
  const { error } = await supabaseAdmin.from("eph_hours").delete().eq("id", id);
  if (error) throw new Error(error.message);
  revalidateEphemeris("/ephemeris/hours");
}

/* --------------------------------------------------------- subscriptions */

export async function setSubscriptionStatus(
  merchant: string,
  action: "confirm" | "reject" | "clear",
) {
  if (action === "clear") {
    const { error } = await supabaseAdmin
      .from("eph_merchant_subscriptions")
      .delete()
      .eq("merchant", merchant);
    if (error) throw new Error(error.message);
  } else {
    const status = action === "confirm" ? "confirmed" : "rejected";
    const { error } = await supabaseAdmin
      .from("eph_merchant_subscriptions")
      .upsert(
        { merchant, status, updated_at: new Date().toISOString() },
        { onConflict: "merchant" },
      );
    if (error) throw new Error(error.message);
  }
  revalidatePath("/ephemeris/subscriptions");
}
