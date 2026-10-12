// Import the historical annual goals from the "Life Trakker" Google Sheet into
// Supabase. Idempotent: goals upsert on legacy_key, and each goal's entries are
// replaced wholesale (delete-then-insert) so a re-run never double-counts.
//
//   cd web && node scripts/import-life-trakker-goals.mjs [--dry-run]
//
// Input: scripts/data/life-trakker-goals.json, generated from the workbook's
// "Habit Tracker" tab (annual tables: targets + monthly totals) and
// "GoalRawDataInput" tab (daily log). See the `notes` on each goal for which
// source its entries came from. Requires SUPABASE_URL / SUPABASE_SERVICE_KEY
// in web/.env.local (same as the app). Run AFTER applying
// supabase/migrations/20260823120000_goals.sql.
//
// Talks to PostgREST directly with fetch — supabase-js's realtime module
// refuses to load on Node 20 without --experimental-websocket.

import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));
const dryRun = process.argv.includes("--dry-run");

// Minimal .env.local reader — no dotenv dependency in this project.
for (const line of readFileSync(join(here, "..", ".env.local"), "utf8").split(/\r?\n/)) {
  const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*?)\s*$/);
  // .env.local wins over the shell: other tooling on this machine exports a
  // SUPABASE_URL for a different project, and a mismatched URL/key pair 401s.
  if (m) process.env[m[1]] = m[2].replace(/^["']|["']$/g, "");
}
const url = process.env.SUPABASE_URL;
const key = process.env.SUPABASE_SERVICE_KEY;
if (!url || !key) throw new Error("SUPABASE_URL and SUPABASE_SERVICE_KEY must be set in web/.env.local");

async function rest(method, path, { body, prefer } = {}) {
  const res = await fetch(`${url}/rest/v1/${path}`, {
    method,
    headers: {
      apikey: key,
      Authorization: `Bearer ${key}`,
      "Content-Type": "application/json",
      ...(prefer ? { Prefer: prefer } : {}),
    },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  const text = await res.text();
  if (!res.ok) throw new Error(`${method} ${path} → ${res.status}: ${text.slice(0, 300)}`);
  return { json: text ? JSON.parse(text) : null, range: res.headers.get("content-range") };
}
const count = async (path) => Number((await rest("GET", `${path}&select=id&limit=1`, { prefer: "count=exact" })).range?.split("/")[1] ?? 0);

const { goals } = JSON.parse(readFileSync(join(here, "data", "life-trakker-goals.json"), "utf8"));
console.log(`${goals.length} goals, ${goals.reduce((s, g) => s + g.entries.length, 0)} entries${dryRun ? " (dry run)" : ""}`);

let inserted = 0;
for (const g of goals) {
  const row = {
    legacy_key: g.legacy_key,
    title: g.title,
    category: g.category,
    status: g.status,
    measure: g.measure,
    direction: g.direction,
    target: g.target,
    start_value: g.start_value,
    unit: g.unit,
    start_date: g.start_date,
    end_date: g.end_date,
    notes: g.notes,
    source: g.source,
    completed_at: g.status === "completed" ? g.end_date : null,
    updated_at: new Date().toISOString(),
  };
  const final = g.entries.reduce((s, e) => s + e.value, 0);
  console.log(`${g.legacy_key.padEnd(40)} ${String(g.entries.length).padStart(4)} entries  final ${final.toFixed(2).padStart(9)} / ${g.target}`);
  if (dryRun) continue;

  const { json } = await rest("POST", "goals?on_conflict=legacy_key&select=id", {
    body: row,
    prefer: "resolution=merge-duplicates,return=representation",
  });
  const id = json[0].id;

  await rest("DELETE", `goal_entries?goal_id=eq.${id}`);

  const rows = g.entries.map((e) => ({ goal_id: id, entry_date: e.date, value: e.value, note: e.note }));
  for (let i = 0; i < rows.length; i += 500) {
    await rest("POST", "goal_entries", { body: rows.slice(i, i + 500), prefer: "return=minimal" });
  }
  inserted += rows.length;
}

if (!dryRun) {
  console.log(
    `\ndone: ${await count("goals?source=eq.life-trakker")} life-trakker goals in DB, ` +
      `${inserted} entries written this run, ${await count("goal_entries?id=not.is.null")} entries total`,
  );
}
