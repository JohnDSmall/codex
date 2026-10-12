import { createClient } from "@supabase/supabase-js";
import { withRetry } from "./retry-fetch";

const url = process.env.SUPABASE_URL;
const key = process.env.SUPABASE_SERVICE_KEY;

if (!url || !key) {
  throw new Error("SUPABASE_URL and SUPABASE_SERVICE_KEY must be set in .env.local");
}

export const supabaseAdmin = createClient(url, key, {
  auth: { persistSession: false, autoRefreshToken: false },
  // Retries transient gateway drops on reads/updates/deletes/upserts only —
  // plain inserts are never retried. See lib/retry-fetch.ts and RUNBOOK Gotcha 12.
  global: { fetch: withRetry(fetch) },
});
