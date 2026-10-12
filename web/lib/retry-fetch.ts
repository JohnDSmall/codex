/**
 * Retrying fetch for the Supabase client (RUNBOOK Gotcha 12).
 *
 * Supabase's gateway intermittently drops connections ("Connection closed.",
 * 502/503/504). Reads are safe to retry. So are PostgREST PATCH / DELETE
 * (filter-scoped, set-valued) and upserts (POST with `Prefer: resolution=…`).
 *
 * A plain POST insert is NOT retried: the row may already have committed before
 * the response was lost, and a retry would create a duplicate — which is exactly
 * how Gotcha 12 was discovered. Those fail fast with a message that says so.
 */

export const RETRY_ATTEMPTS = 3;
const BASE_DELAY_MS = 300;

/** Gateway-side failures worth another try. 522/524 are Cloudflare's timeouts. */
const RETRYABLE_STATUS = new Set([502, 503, 504, 522, 524]);

export type FetchLike = (input: RequestInfo | URL, init?: RequestInit) => Promise<Response>;

function methodOf(input: RequestInfo | URL, init?: RequestInit): string {
  const m = init?.method ?? (input instanceof Request ? input.method : "GET");
  return m.toUpperCase();
}

function headerValue(input: RequestInfo | URL, init: RequestInit | undefined, name: string): string {
  const h = init?.headers ?? (input instanceof Request ? input.headers : undefined);
  if (!h) return "";
  if (h instanceof Headers) return h.get(name) ?? "";
  if (Array.isArray(h)) return h.find(([k]) => k.toLowerCase() === name.toLowerCase())?.[1] ?? "";
  const key = Object.keys(h).find((k) => k.toLowerCase() === name.toLowerCase());
  return key ? String(h[key]) : "";
}

/** True when re-sending this exact request cannot create a second row. */
export function isIdempotent(input: RequestInfo | URL, init?: RequestInit): boolean {
  const method = methodOf(input, init);
  if (method === "GET" || method === "HEAD" || method === "OPTIONS") return true;
  if (method === "PATCH" || method === "DELETE" || method === "PUT") return true;
  if (method === "POST") {
    // supabase-js upsert sends `Prefer: resolution=merge-duplicates` (or ignore-duplicates).
    return /resolution=/.test(headerValue(input, init, "Prefer"));
  }
  return false;
}

function isAbort(err: unknown): boolean {
  return err instanceof Error && err.name === "AbortError";
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

export class NonIdempotentWriteError extends Error {
  constructor(cause: unknown) {
    super(
      "The connection to Supabase dropped during a write. The row MAY have been saved — " +
        "check the list before resubmitting, or you will create a duplicate (RUNBOOK Gotcha 12).",
      { cause },
    );
    this.name = "NonIdempotentWriteError";
  }
}

/**
 * Wrap a fetch so transient gateway failures are retried with backoff.
 * `attempts` and `delayMs` are exposed for tests; production uses the defaults.
 */
export function withRetry(
  baseFetch: FetchLike,
  opts: { attempts?: number; delayMs?: number } = {},
): FetchLike {
  const attempts = opts.attempts ?? RETRY_ATTEMPTS;
  const delayMs = opts.delayMs ?? BASE_DELAY_MS;

  return async (input, init) => {
    const safe = isIdempotent(input, init);
    let lastErr: unknown;

    for (let attempt = 1; attempt <= attempts; attempt++) {
      try {
        const res = await baseFetch(input, init);
        if (!RETRYABLE_STATUS.has(res.status)) return res;
        lastErr = new Error(`Supabase gateway returned ${res.status}`);
        // A gateway error on a non-idempotent write is still ambiguous: the
        // request may have reached PostgREST. Return the response and let the
        // caller see the real status rather than silently re-inserting.
        if (!safe) return res;
      } catch (err) {
        if (isAbort(err)) throw err;
        lastErr = err;
        if (!safe) throw new NonIdempotentWriteError(err);
      }
      if (attempt < attempts) await sleep(delayMs * 3 ** (attempt - 1));
    }
    throw lastErr instanceof Error ? lastErr : new Error(String(lastErr));
  };
}
