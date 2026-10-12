// Import year-end balances from the net-worth sheet into wealth_snapshots.
// Idempotent: accounts match on wealth_items.name (created if missing), and
// snapshots upsert on (item_id, as_of_date). A re-run changes nothing.
//
//   cd web && node scripts/import-year-end-wealth.mjs [--dry-run]
//
// Input: scripts/data/year-end-wealth-2022-2025.json. Each account maps a sheet
// row to a wealth_items name; `values` is year -> balance, recorded at Dec 31.
// After the upsert, wealth_items.current_value / date_updated are re-synced to
// the newest snapshot for every touched account (same rule as
// syncCurrentValues in lib/wealth-actions.ts).
//
// Talks to PostgREST directly with fetch. See import-life-trakker-goals.mjs.

import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));
const dryRun = process.argv.includes("--dry-run");
const NOTE = "backfilled from year-end sheet (2026-10-12)";

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
  if (!res.ok) throw new Error(`${method} ${path} -> ${res.status}: ${text.slice(0, 300)}`);
  return text ? JSON.parse(text) : null;
}

const spec = JSON.parse(readFileSync(join(here, "data", "year-end-wealth-2022-2025.json"), "utf8"));
const items = await rest("GET", "wealth_items?select=id,name,current_value,date_updated&order=name");
const byName = new Map(items.map((i) => [i.name, i]));
const existing = await rest("GET", "wealth_snapshots?select=item_id,as_of_date,value&order=as_of_date");
const existingKey = new Map(existing.map((s) => [`${s.item_id}|${s.as_of_date}`, Number(s.value)]));

console.log(`${spec.accounts.length} sheet rows, ${items.length} accounts in DB${dryRun ? " (dry run)" : ""}\n`);

let created = 0;
let unchanged = 0;
let added = 0;
let changed = 0;
const touched = new Set();

for (const acct of spec.accounts) {
  let item = byName.get(acct.name);
  const years = Object.keys(acct.values).sort();
  if (!item) {
    const firstYear = years[0];
    const row = {
      name: acct.name,
      type: "asset",
      category: acct.category,
      source: acct.source,
      current_value: acct.values[firstYear],
      original_value: acct.values[firstYear],
      date_added: spec.dates[firstYear],
      date_updated: spec.dates[firstYear],
      eoy_values: {},
    };
    console.log(`NEW account  ${acct.name}  (${acct.category}, from ${row.date_added})`);
    created++;
    if (dryRun) {
      item = { id: `dry-${acct.name}`, name: acct.name };
    } else {
      [item] = await rest("POST", "wealth_items", { body: row, prefer: "return=representation" });
    }
    byName.set(acct.name, item);
  }

  const rows = [];
  for (const y of years) {
    const as_of_date = spec.dates[y];
    const value = acct.values[y];
    const prior = existingKey.get(`${item.id}|${as_of_date}`);
    if (prior === undefined) {
      console.log(`  + ${as_of_date}  ${acct.name.padEnd(40)} ${value.toLocaleString()}`);
      added++;
      rows.push({ item_id: item.id, as_of_date, value, note: NOTE });
    } else if (prior !== value) {
      console.log(`  ~ ${as_of_date}  ${acct.name.padEnd(40)} ${prior.toLocaleString()} -> ${value.toLocaleString()}  (REPLACES existing reading)`);
      changed++;
      rows.push({ item_id: item.id, as_of_date, value, note: NOTE });
    } else {
      unchanged++;
    }
  }
  if (rows.length) {
    touched.add(item.id);
    if (!dryRun) {
      await rest("POST", "wealth_snapshots", {
        body: rows,
        prefer: "resolution=merge-duplicates,return=minimal",
      });
    }
  }
}

// Mirror the newest snapshot onto wealth_items (current_value / date_updated).
if (!dryRun) {
  for (const id of touched) {
    const [latest] = await rest(
      "GET",
      `wealth_snapshots?item_id=eq.${id}&select=as_of_date,value&order=as_of_date.desc&limit=1`,
    );
    await rest("PATCH", `wealth_items?id=eq.${id}`, {
      body: { current_value: latest.value, date_updated: latest.as_of_date, updated_at: new Date().toISOString() },
      prefer: "return=minimal",
    });
  }
}

console.log(`\naccounts created: ${created}  snapshots added: ${added}  replaced: ${changed}  already matching: ${unchanged}`);
if (dryRun) console.log("dry run: nothing written");
