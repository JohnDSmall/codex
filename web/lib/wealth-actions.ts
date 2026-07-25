"use server";

import { revalidatePath } from "next/cache";
import { supabaseAdmin } from "./supabase-server";

const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;

function parseMoney(raw: string): number {
  const n = Number(raw.replace(/[$,\s]/g, ""));
  if (!Number.isFinite(n)) throw new Error(`"${raw}" is not a number.`);
  return n;
}

/**
 * Record balances for one date across any number of accounts.
 *
 * Form shape: `as_of_date`, optional `note`, and `value:<itemId>` per account.
 * Blank values are skipped, so you only fill in what actually changed.
 *
 * Re-submitting the same date overwrites that date's snapshot rather than
 * creating a duplicate (unique on item_id + as_of_date).
 */
export async function recordBalances(formData: FormData) {
  const asOf = String(formData.get("as_of_date") ?? "").trim();
  if (!ISO_DATE.test(asOf)) throw new Error("A valid date is required.");

  const note = String(formData.get("note") ?? "").trim() || null;

  const rows: { item_id: string; as_of_date: string; value: number; note: string | null }[] = [];
  for (const [key, raw] of formData.entries()) {
    if (!key.startsWith("value:")) continue;
    const text = String(raw).trim();
    if (text === "") continue;
    rows.push({
      item_id: key.slice("value:".length),
      as_of_date: asOf,
      value: parseMoney(text),
      note,
    });
  }

  if (rows.length === 0) throw new Error("Enter at least one balance.");

  const { error } = await supabaseAdmin
    .from("wealth_snapshots")
    .upsert(rows, { onConflict: "item_id,as_of_date" });
  if (error) throw new Error(error.message);

  await syncCurrentValues(rows.map((r) => r.item_id));
  revalidatePath("/wealth");
}

/** Delete a single dated reading. */
export async function deleteSnapshot(id: string, itemId: string) {
  const { error } = await supabaseAdmin.from("wealth_snapshots").delete().eq("id", id);
  if (error) throw new Error(error.message);
  await syncCurrentValues([itemId]);
  revalidatePath("/wealth");
}

/** Create a new account, seeded with its opening balance. */
export async function addWealthItem(formData: FormData) {
  const name = String(formData.get("name") ?? "").trim();
  if (!name) throw new Error("Name is required.");

  const type = String(formData.get("type") ?? "asset");
  if (!["asset", "liability", "target_asset"].includes(type)) {
    throw new Error("Invalid type.");
  }

  const asOf = String(formData.get("as_of_date") ?? "").trim();
  if (!ISO_DATE.test(asOf)) throw new Error("A valid date is required.");

  const value = parseMoney(String(formData.get("value") ?? "0"));
  const category = String(formData.get("category") ?? "").trim() || "other";
  const source = String(formData.get("source") ?? "").trim() || null;

  const { data, error } = await supabaseAdmin
    .from("wealth_items")
    .insert({
      name,
      type,
      category,
      source,
      current_value: value,
      original_value: value,
      date_added: asOf,
      date_updated: asOf,
      eoy_values: {},
    })
    .select("id")
    .single();
  if (error) throw new Error(error.message);

  const { error: snapErr } = await supabaseAdmin.from("wealth_snapshots").insert({
    item_id: (data as { id: string }).id,
    as_of_date: asOf,
    value,
    note: "opening balance",
  });
  if (snapErr) throw new Error(snapErr.message);

  revalidatePath("/wealth");
}

export async function deleteWealthItem(id: string) {
  // Snapshots cascade via the FK.
  const { error } = await supabaseAdmin.from("wealth_items").delete().eq("id", id);
  if (error) throw new Error(error.message);
  revalidatePath("/wealth");
}

/**
 * Mirror each item's newest snapshot back onto wealth_items.current_value /
 * date_updated, so anything reading the table directly stays correct.
 */
async function syncCurrentValues(itemIds: string[]) {
  const unique = Array.from(new Set(itemIds));
  for (const itemId of unique) {
    const { data, error } = await supabaseAdmin
      .from("wealth_snapshots")
      .select("as_of_date, value")
      .eq("item_id", itemId)
      .order("as_of_date", { ascending: false })
      .limit(1);
    if (error) throw new Error(error.message);

    const latest = (data ?? [])[0] as { as_of_date: string; value: number } | undefined;
    const patch = latest
      ? { current_value: latest.value, date_updated: latest.as_of_date }
      : { date_updated: null };

    const { error: upErr } = await supabaseAdmin
      .from("wealth_items")
      .update({ ...patch, updated_at: new Date().toISOString() })
      .eq("id", itemId);
    if (upErr) throw new Error(upErr.message);
  }
}
