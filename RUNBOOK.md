# codex — Runbook

Operational runbook for the `codex` repo (personal life-organization apps).
Verified working on this machine 2026-07-25.

- **Repo:** https://github.com/JohnDSmall/codex
- **Local clone:** `C:\Users\Cameron Corse\projects\codex`

| Component | Stack | Storage | Runs? |
|---|---|---|---|
| `web/` | Next.js 16.2.6 / React 19.2.4 | Supabase (remote) | ✅ working — `.env.local` is populated |
| `ephemeris/` | Flask 3.0.3 | SQLite (local file) | ✅ working — **legacy fallback**, still owns the CSV importers |
| `contacts/` | Python loaders | writes to Supabase | ⚠️ needs env vars, not yet run |
| `supabase/` | 7 SQL migrations | — | schema definition only |

---

## ⚠️ START HERE — state as of 2026-07-25

**One action is outstanding.** Everything else is done and verified.

### 1. Apply the wealth-snapshots migration (NOT YET RUN)

`supabase/migrations/20260725160000_wealth_snapshots.sql` has **not** been applied. Until it is,
`/wealth` runs in a degraded fallback mode (yearly history, no editing) and shows an amber banner.

There is no Supabase CLI on this machine, so use the SQL editor:

```
https://supabase.com/dashboard/project/qwkdjxzgqrnbzrohaekg/sql/new
```

Paste the file's contents → **Run** → expect `Success. No rows returned.` It is idempotent.

To put it on the clipboard:

```powershell
Get-Content -Raw "C:\Users\Cameron Corse\projects\codex\supabase\migrations\20260725160000_wealth_snapshots.sql" | Set-Clipboard
```

**After running it, verify:**

```powershell
# expect the amber banner gone, buttons present, ~4 readings per account
curl.exe -s -o NUL -w "%{http_code}`n" http://127.0.0.1:3000/wealth
```
Net worth should still reconcile to **$249,100** across 6 accounts, and the chart should gain 2025
points (currently the chart stops at 2024-12-31 while `current_value` holds stranded 2025 numbers).

### 2. Nothing is committed

The entire session's work is uncommitted in the working tree — the `financials/`→`ephemeris/` rename,
the merged web app, both migrations, and this runbook. `git status` to see it. No commits, no pushes.

### 3. Rotate the Supabase service key

`web/.env.local` holds a working service-role key that was pasted into a chat transcript. Rotate it at
Project Settings → API when convenient and update the file. Project ref: `qwkdjxzgqrnbzrohaekg`.

### 4. Dev servers won't survive a session restart

Both were started as background tasks. Restart with:

```powershell
cd "C:\Users\Cameron Corse\projects\codex\web";       npm run dev              # :3000
cd "C:\Users\Cameron Corse\projects\codex\ephemeris"; .\.venv\Scripts\python.exe app.py   # :5000
```
If port 3000 is stuck held by an orphaned process, see Gotcha 7.

> **Renamed 2026-07-25:** `financials/` → `ephemeris/`, and `financials.db` → `ephemeris.db`. If you have an older clone or a backed-up DB under the old name, rename the file to `ephemeris.db` or `seed.py` will build a fresh empty one.

> **Ephemeris was merged into the web app on 2026-07-25.** The sidebar entry "Financials" is now **Ephemeris** → `/ephemeris`, a full port of all 7 Flask screens including add/delete. `/financials` 307-redirects to `/ephemeris` so old links keep working.
>
> **Live as of 2026-07-25.** Migration applied, 289 rows exported to Supabase, all 7 screens verified against the Flask originals. The Flask app remains as a fallback and still owns the CSV importers.

---

## Machine facts (this box)

| Thing | Value | Note |
|---|---|---|
| Python | 3.12.10 | invoke as **`python`** — the `py` launcher is **not installed**, so `py -m venv` fails here |
| Node / npm | v20.18.0 / 10.9.0 | required by `web/` |
| git | 2.47.0.windows.2 | |
| Shell | PowerShell 5.1 | no `&&` chaining — use `;` or `; if ($?) { ... }` |

The ephemeris READMEs were rewritten on 2026-07-25 to use `python` and the correct local paths. (They previously said `py -m venv` and hardcoded `C:\Users\johna\OneDrive\Documents\IC\financials` from a different machine.) `web/README.md` is still stock `create-next-app` boilerplate — ignore it, and read `web/AGENTS.md` instead.

**`web/AGENTS.md` is a standing instruction:** this Next.js version has breaking changes vs. common knowledge — read the relevant guide under `web/node_modules/next/dist/docs/` before writing any Next code. Those docs ship with the install and are the authoritative reference for 16.2.6.

---

## ephemeris — start the app

Cold start (first time, or after deleting `.venv`):

```powershell
cd "C:\Users\Cameron Corse\projects\codex\ephemeris"
python -m venv .venv
.\.venv\Scripts\python.exe -m pip install -r requirements.txt   # Flask 3.0.3
.\.venv\Scripts\python.exe seed.py                              # creates ephemeris.db
.\.venv\Scripts\python.exe app.py
```

Warm start (venv and DB already exist — the normal case):

```powershell
cd "C:\Users\Cameron Corse\projects\codex\ephemeris"
.\.venv\Scripts\python.exe app.py
```

Serves **http://127.0.0.1:5000** (`host=127.0.0.1, port=5000, debug=False`, set in `app.py`).
`app.py` calls `init_db()` on startup, so the schema is created if missing — but the app will be empty until `seed.py` runs.

Stop with `Ctrl+C`. Since `debug=False`, **there is no auto-reload** — restart the process after any code or template change.

Activating the venv (`.\.venv\Scripts\Activate.ps1`) is optional; calling `.\.venv\Scripts\python.exe` directly avoids PowerShell execution-policy prompts.

### Routes / smoke test

| Route | Page |
|---|---|
| `/` | Dashboard (roll-ups by life-area tag) |
| `/spending` | Spending analysis + merchant/description search |
| `/expenses` | Expense list, add, delete |
| `/income` | Income list, add, delete |
| `/assets` | Assets list, add, delete |
| `/hours` | Freelance hours list, add, delete |
| `/subscriptions` | Detected recurring merchants; confirm/reject |

Quick check that all pages render (Bash tool):

```bash
for p in / /spending /expenses /income /assets /hours /subscriptions; do
  echo "$(curl -s -o /dev/null -w '%{http_code}' "http://127.0.0.1:5000$p")  $p"
done
```

All seven returned `200` on the last verified run.

A `200` only proves the page rendered, not that it has rows — `/expenses` and `/spending` are date-filtered by default (see Gotcha 1). To check data actually landed:

```bash
curl -s 'http://127.0.0.1:5000/expenses?from=&to=' | grep -c '<tr'   # 162 = 161 rows + header
curl -s http://127.0.0.1:5000/income | grep -c '<tr'                 # 57  = 56 rows + header
curl -s http://127.0.0.1:5000/hours  | grep -c '<tr'                 # 73  = 72 rows + header
```

---

## Data

- **DB file:** `ephemeris/ephemeris.db` (SQLite). **Gitignored** — treated as user data, never committed.
- **Seed:** `python seed.py` loads hard-coded freelance-spreadsheet rows. **Idempotent** — skips rows already present, safe to re-run. Last run inserted `161 expenses, 56 income, 72 hours`.
- **Reset from scratch:** stop the app, delete `ephemeris.db`, re-run `seed.py`. This destroys any manually-entered or imported rows, which are *not* in `seed.py`.

### Schema

`tags` · `categories` · `expenses` · `income` · `assets` · `hours`.
Every transactional row carries a `tag_id` so the dashboard can roll up by life-area.

Actual tag list is `DEFAULT_TAGS` in `db.py:94` — broader than the READMEs claim, and includes two legacy buckets:

`General Life` *(legacy, pre-Personal)* · `Personal` *(credit cards default here)* · `Freelance Consulting` *(legacy, pre-source-split)* · `Halo` · `Snorkel` · `HAI` · `Handshake` · `7 Shot Tennis` · `Other`

Categories: COGS / F&O / S&M / T&E / R&D / L&A subcategories plus `Personal-*` — see `DEFAULT_CATEGORIES` in `db.py`.

---

## Importers

Run from `ephemeris/` with the venv python. Both accept a single CSV **or a directory of CSVs**, and skip duplicates.

**Credit-card statements** (`import_csv.py`):

```powershell
.\.venv\Scripts\python.exe import_csv.py <file-or-dir> [--card Amex|BofA] [--tag Personal] [--recategorize-only]
```
- `--card` forces the statement format; otherwise auto-detected.
- `--tag` defaults to `Personal`.
- `--recategorize-only` takes no path — it re-runs categorization rules over existing uncategorized rows.
- Skips card payments (they're transfers, not expenses).

**BofA checking** (`import_checking.py`):

```powershell
.\.venv\Scripts\python.exe import_checking.py <file-or-dir> [--account "BofA Checking"]
```
- Imports **deposits as income only**; withdrawals and internal transfers are skipped.

---

## Migrations

One-off, idempotent, safe to re-run. Run from `ephemeris/`:

```powershell
.\.venv\Scripts\python.exe migrate_retag.py                 # re-tag rows after taxonomy changes
.\.venv\Scripts\python.exe migrate_normalize_merchants.py   # rebuild merchant column via current normalize_merchant() rules
```

Run `migrate_normalize_merchants.py` after any change to `normalize_merchant()` in `import_csv.py`, or `/subscriptions` will group merchants by stale names.

---

## web — Next.js app (relationships, projects, wealth)

Next.js **16.2.6**, React **19.2.4**, Tailwind 4, Supabase for data. Runs on **http://localhost:3000**.

```powershell
cd "C:\Users\Cameron Corse\projects\codex\web"
npm install        # already done on this machine
npm run dev
```

Other scripts: `npm run build`, `npm run start`, `npm run lint`.

Unlike ephemeris, **this app auto-reloads** — no restart needed after edits.

### Credentials

**`web/.env.local` is already populated and working** (as of 2026-07-25). Project ref `qwkdjxzgqrnbzrohaekg`.

`lib/supabase-server.ts` throws at *import* time if either var is missing, so every data-backed route
500s without them:

```
SUPABASE_URL and SUPABASE_SERVICE_KEY must be set in .env.local
```

To recreate the file, copy the committed template (`.env.local` itself is gitignored — never commit it):

```powershell
Copy-Item .env.local.example .env.local
```

```
SUPABASE_URL=https://qwkdjxzgqrnbzrohaekg.supabase.co
SUPABASE_SERVICE_KEY=<service-role / secret key>
```

Two gotchas that cost time:

1. **`SUPABASE_URL` must be the bare project URL** — no `/rest/v1/` suffix. Both `supabase-js` and
   `export_to_supabase.py` append that path themselves; including it yields `/rest/v1/rest/v1/…` and 404s.
2. Take the **service-role / secret** key (newer dashboards label it *API Keys → Secret keys*,
   `sb_secret_…`; older ones *service_role*, a `eyJ…` JWT). Not `anon` / `publishable` — the app needs to
   bypass RLS, since every table has RLS on with no policies.

It bypasses row-level security, so treat it as a full-access secret. It's server-only here (no
`NEXT_PUBLIC_` prefix, imported only by `lib/*-server.ts`), so it never reaches the browser. Keep it that
way — never move it into a `NEXT_PUBLIC_` var or import it from a client component.

**The current key was pasted into a chat transcript — rotate it** at Project Settings → API and update
`.env.local`.

Quick check that a key works:

```bash
curl -s -o /dev/null -w "%{http_code}\n" \
  "https://qwkdjxzgqrnbzrohaekg.supabase.co/rest/v1/contacts?select=id&limit=1" \
  -H "apikey: $KEY" -H "Authorization: Bearer $KEY"     # 200 = good, 401 = bad key
```

### Route status (verified 2026-07-25, no credentials present)

All routes verified **200** with credentials in place (2026-07-25), except `/financials` which correctly **307**s to `/ephemeris`. Without `.env.local`, every Supabase-backed route 500s at import time instead.

Also present: `/relationships/new`, `/relationships/[id]`, `/relationships/[id]/edit` — all Supabase-backed.

```bash
for p in / /financials /goals /planner /ephemeris /ephemeris/spending /ephemeris/subscriptions \
         /ephemeris/expenses /ephemeris/income /ephemeris/assets /ephemeris/hours \
         /projects /wealth /relationships /relationships/dashboard; do
  echo "$(curl -s -o /dev/null -w '%{http_code}' "http://127.0.0.1:3000$p")  $p"
done
```

Supabase-touching modules: `lib/supabase-server.ts`, `lib/actions.ts`, `lib/contacts-server.ts`, `lib/projects-server.ts`, `lib/wealth-server.ts`.

---

## Ephemeris in the web app

Sidebar → **Ephemeris** (`/ephemeris`). A shared sub-layout renders the title and a tab bar; all seven screens live under it and reuse the same card / KPI / table styling as `/wealth`, so money formats identically app-wide.

| Tab | Route | Flask equivalent |
|---|---|---|
| Overview | `/ephemeris` | `/` dashboard |
| Spending | `/ephemeris/spending` | `/spending` |
| Subscriptions | `/ephemeris/subscriptions` | `/subscriptions` |
| Expenses | `/ephemeris/expenses` | `/expenses` |
| Income | `/ephemeris/income` | `/income` |
| Assets | `/ephemeris/assets` | `/assets` |
| Hours | `/ephemeris/hours` | `/hours` |

**Behavior carried over faithfully:**

- The **last-completed-calendar-month default** and the `?from=&to=` "all time" escape hatch (`filtersFromSearchParams`). Filter bars are plain GET forms, so they always emit both keys and work without JS.
- **Avg/month on Spending** still uses the trailing 3 *completed* months independent of the date filter, while honoring card/tag/category.
- **Subscription detection** is a direct port: amount CV ≤ 0.20, gap CV ≤ 0.60, ≥3 charges across ≥2 months, the same cadence buckets and active-window thresholds, and the same `auto` / `rejected` / `all` visibility rules.
- **Subscriptions defaults to all-time** rather than last month, matching the Flask special case.

**Deliberate improvements over the Flask original:**

- Deletes now ask for confirmation. The Flask app hard-deleted on click with no undo.
- Quick-range preset links (Last month / Last 3 months / YTD / All time) so "the page looks empty" is one click to fix rather than a documented gotcha.
- Add forms are collapsed behind an "Add …" button instead of always-on, and surface server-side validation errors inline.

**Not ported:** the CSV importers (`import_csv.py`, `import_checking.py`) and the merchant-normalization migration remain Python CLIs writing to SQLite.

### A Flask bug the port does not reproduce

`ephemeris/app.py:285` groups subscriptions with `GROUP BY merchant`. That name is **ambiguous** — `expenses` has a literal `merchant` column *and* the SELECT aliases `COALESCE(NULLIF(e.merchant,''), e.description) AS merchant`. SQLite binds it to the raw column, so every row whose `merchant` is NULL collapses into one group.

All 161 seeded rows have `merchant` NULL (only the CSV importers populate it), so the Flask subscriptions page reports **1** bogus merchant instead of 10, and 0 subscriptions after cadence detection. Verified:

```
GROUP BY merchant  (binds to the raw column) ->  1 row
GROUP BY 1         (binds to the expression) -> 10 rows
```

The web port groups in TypeScript on `merchant || description`, which is the intended behavior — hence `/ephemeris/subscriptions?active=0` shows **7** detected subscriptions (6 Monthly + 1 Quarterly) where Flask shows none. Cross-checked against Flask's own `_classify_subscription()` called directly: it also returns those same 7, confirming the detector agrees and only the SQL grouping was wrong.

The Flask fix would be `GROUP BY 1`. Left unapplied — the app is being retired and this is a read-only view — but worth doing if you keep using it.

---

## Ephemeris migration (SQLite → Supabase)

Three steps, in order. Steps 2 and 3 need your Supabase credentials.

**1. Apply the schema.** Run `supabase/migrations/20260725120000_ephemeris_financials.sql` against the project — via `supabase db push`, or paste it into the Supabase SQL editor. It creates seven `eph_*` tables with RLS enabled and no policies (service-role only, same as `contacts` / `wealth_items`).

**2. Export the existing rows.**

```powershell
cd "C:\Users\Cameron Corse\projects\codex\ephemeris"
$env:SUPABASE_URL = "https://<project-ref>.supabase.co"
$env:SUPABASE_SERVICE_KEY = "<service-role key>"
.\.venv\Scripts\python.exe export_to_supabase.py --dry-run   # preview, writes nothing
.\.venv\Scripts\python.exe export_to_supabase.py
```

Verified dry-run output against the live SQLite file: **9 tags, 45 categories, 161 expenses, 56 income, 0 assets, 72 hours, 0 subscription overrides.**

Idempotent — every row carries `legacy_id` (the old SQLite integer PK) and upserts on it, so re-running syncs rather than duplicates. Tags and categories upsert on `name`.

**3. Point the web app at Supabase.**

```powershell
cd "C:\Users\Cameron Corse\projects\codex\web"
Copy-Item .env.local.example .env.local   # then fill in both values
npm run dev
```

### Why the tables are prefixed `eph_`

`assets`, `income`, and `categories` are generic enough to collide with future top-level codex tables, and an unprefixed `assets` would read ambiguously next to the existing `wealth_items`. Easy to rename now, painful later — say the word if you'd rather they were bare.

### Table map

| SQLite (Flask) | Supabase |
|---|---|
| `tags` | `eph_tags` |
| `categories` | `eph_categories` |
| `expenses` | `eph_expenses` |
| `income` | `eph_income` |
| `assets` | `eph_assets` |
| `hours` | `eph_hours` |
| `merchant_subscriptions` | `eph_merchant_subscriptions` |

Integer PKs become `uuid`; the old integer survives as `legacy_id`. Filter query params (`?tag=…`, `?category=…`) therefore carry uuids in the web app where the Flask app used integers.

### Retiring the Flask app

Don't delete `ephemeris/` until step 2 has run and you've confirmed the numbers match in `/ephemeris`. After that the Flask app and `ephemeris.db` become a historical snapshot — the CSV importers (`import_csv.py`, `import_checking.py`) still write only to SQLite, so **either keep using them and re-running the export, or port them next.**

---

## wealth — dated history

`/wealth` tracks accounts over time. **Every update is dated** — that's the whole point of the design,
and the reason the original schema wasn't sufficient.

### Why it was rebuilt

`wealth_items` stores history as `eoy_values`, a jsonb map of `year -> value`: one snapshot per calendar
year. Plus a single `current_value` that gets overwritten on each update and one `date_updated` stamp.
That cannot express "Schwab was worth X on 2026-03-15", and every update destroyed the prior reading.

It was also already drifting: `current_value` was dated Nov 2025 while `eoy_values` stopped at 2024, so
those 2025 figures appeared nowhere in the chart.

### The model

`wealth_snapshots` — one row per `(item_id, as_of_date)`, unique on that pair — is the unit of record.

- `wealth_items.current_value` / `date_updated` are kept as a **denormalized mirror** of each item's
  newest snapshot (see `syncCurrentValues` in `lib/wealth-actions.ts`), so `contacts/load_wealth.py` and
  anything reading the table directly still works.
- `eoy_values` is no longer written. It survives as legacy data and as the fallback history source.

### Backfill

The migration converts existing state into dated readings, `on conflict do nothing` so it's re-runnable:

1. Each `eoy_values` entry → a Dec-31 snapshot for that year.
2. Each `current_value` → a snapshot at its `date_updated` (runs second, so a same-date collision keeps
   the eoy row).

Expect roughly **4 readings per account** immediately after.

### Carry-forward — the subtle bit

`buildHistory()` in `lib/wealth-server.ts` computes net worth at every date any account moved. Values
**carry forward**: on a date where only one account was re-valued, every other account contributes its
most recent prior snapshot rather than zero. Without this, net worth would appear to collapse on every
partial update. An account contributes nothing before its first snapshot (it didn't exist yet).

### UI

- **Update balances** — pick one date, fill in only the accounts that changed, blanks are skipped.
  Optional note. Re-submitting the same date **replaces** that day's reading (upsert on the unique key)
  rather than duplicating.
- **Add account** — creates a `wealth_items` row plus an opening-balance snapshot.
- Each row expands to its full dated history with per-reading deltas, and shows a sparkline.
- Deleting an account cascades to its snapshots (FK `on delete cascade`). Individual readings can be
  deleted too. Both confirm first.

### Graceful degradation

If `wealth_snapshots` is missing, `loadSnapshots()` detects `PGRST205` / `42P01` and returns
`tableMissing: true` instead of throwing. The page then renders from `eoy_values` + `current_value`,
hides the write buttons, and shows an amber banner. **A pending migration must never 500 the page** —
that regression happened once during this session and this is the fix.

---

## supabase — schema

Seven migrations in `supabase/migrations/`. There is no local Supabase stack and no `config.toml`, and
**no CLI installed on this machine** — apply them by pasting into the SQL editor at
`https://supabase.com/dashboard/project/qwkdjxzgqrnbzrohaekg/sql/new`.

| Migration | Applied? |
|---|---|
| `20260525102330_create_contacts.sql` | ✅ |
| `20260525124020_relationship_fields.sql` | ✅ |
| `20260525132435_relationship_extras.sql` | ✅ |
| `20260525150000_companies_projects_wealth.sql` | ✅ |
| `20260624000000_relationship_sqs_flags.sql` | ✅ |
| `20260725120000_ephemeris_financials.sql` | ✅ applied 2026-07-25 |
| `20260725160000_wealth_snapshots.sql` | ❌ **NOT YET APPLIED** |

DDL cannot go through the REST API, so these always need the SQL editor (or the CLI, if installed later).
All of them are written to be idempotent.

---

## contacts — one-off Supabase loaders

Python scripts that migrate legacy data (iCloud vCard export, old AWS Lambda / DynamoDB JSON dumps) into Supabase. Separate venv from ephemeris.

```powershell
cd "C:\Users\Cameron Corse\projects\codex\contacts"
python -m venv .venv
.\.venv\Scripts\python.exe -m pip install -r requirements.txt   # vobject, requests, python-dateutil
```

All four need `SUPABASE_URL` and `SUPABASE_SERVICE_KEY` in the environment:

```powershell
$env:SUPABASE_URL = "https://<project-ref>.supabase.co"
$env:SUPABASE_SERVICE_KEY = "<service-role key>"
```

| Script | Does |
|---|---|
| `load_contacts.py` | parse iCloud vCard export → upsert `contacts` |
| `merge_old_relationships.py` | merge legacy relationship curation onto contacts by normalized name; inserts if no match |
| `load_companies_projects.py` | legacy Lambda JSON → companies + projects |
| `load_wealth.py` | legacy DynamoDB export → wealth items |

Each takes `--help`. These **write to the live remote database** — they are not local-only like ephemeris's seed. Check `--help` for any dry-run flag before running one against real data.

---

## Layout

```
codex/
├── README.md
├── RUNBOOK.md          <- this file
├── web/                Next.js 16 app — ephemeris, relationships, projects, wealth (Supabase)
│   ├── AGENTS.md       READ THIS before writing Next code
│   ├── app/
│   │   ├── ephemeris/          the merged financial app (layout + 7 pages)
│   │   ├── financials/         redirect stub -> /ephemeris
│   │   └── components/ephemeris/   ui, Charts, Filters, nav, row actions
│   ├── lib/            server-side data access (*-server.ts hit Supabase)
│   │   ├── ephemeris-server.ts   queries, filters, subscription detection
│   │   ├── ephemeris-actions.ts  Server Actions: add/delete + sub overrides
│   │   ├── wealth-server.ts      snapshots, carry-forward history, summaries
│   │   └── wealth-actions.ts     Server Actions: record balances, add/delete
│   ├── public/company_logos/   ~160 org logos
│   ├── node_modules/   gitignored
│   ├── .env.local.example      committed template
│   └── .env.local      gitignored — YOU MUST CREATE THIS
├── contacts/           one-off Python loaders → Supabase
├── supabase/migrations/  5 SQL migrations
└── ephemeris/
    ├── app.py                  Flask routes + dashboard logic (~697 lines)
    ├── db.py                   schema, DB_PATH, default tags/categories
    ├── seed.py                 hard-coded spreadsheet seed data
    ├── import_csv.py           credit-card CSV importer + merchant normalization
    ├── import_checking.py      BofA checking CSV importer
    ├── migrate_retag.py
    ├── migrate_normalize_merchants.py
    ├── requirements.txt         Flask==3.0.3
    ├── templates/              base, dashboard, expenses, income, assets, hours, spending, subscriptions
    ├── static/style.css
    ├── .venv/                  gitignored
    └── ephemeris.db           gitignored
```

There are **no tests** and **no lint/CI config** in this repo. Verification = the route smoke test above.

---

## Gotchas

1. **`/expenses` and `/spending` look empty on a fresh seed — this is not a bug.**
   When `from`/`to` are absent from the query string, `_filters_from_request()` (`app.py:39`) defaults to the **last completed calendar month**. The seeded rows are older than that, so the pages render with zero rows.
   Pass **`?from=&to=`** for all-time — empty-but-present params are read as "no bound":

   ```
   http://127.0.0.1:5000/expenses?from=&to=
   ```
   Verified: default → 0 rows; `?from=&to=` → all 161 seeded expenses.
   `/subscriptions` already overrides this to all-time on its own (`app.py:255`). `/income` and `/hours` are unfiltered and show everything (56 and 72 rows).

2. **Dashboard shows `Assets — $0.00` after seeding.** Expected — `seed.py` loads expenses, income, and hours only. Add assets via `/assets`.

3. **Turbopack picks the wrong workspace root.** A stray `package-lock.json` sits in `C:\Users\Cameron Corse\` (the home dir, outside the repo), so `npm run dev` warns:
   > We detected multiple lockfiles and selected the directory of `C:\Users\Cameron Corse\package-lock.json` as the root directory.

   Harmless so far, but it can cause odd module resolution. Fix by deleting the stray home-dir lockfile (if nothing needs it) or setting `turbopack.root` in `web/next.config.ts` — currently that config is empty.

4. **The two apps are unrelated and use different ports.** ephemeris = Flask on **5000**, SQLite, local-only, no auto-reload. web = Next on **3000**, Supabase, remote data, auto-reloads. They can run at the same time.

5. **`py` doesn't exist on this machine.** Use `python`. Every README command needs this swap.
6. **ephemeris has no auto-reload** (`debug=False`) — restart after edits. (`web/` does auto-reload.)
7. **Port conflicts.** Find the holder with `Get-NetTCPConnection -LocalPort 5000 | Select-Object OwningProcess`, then `Stop-Process -Id <pid>`. Port 5000 is hardcoded in `ephemeris/app.py`; Next takes 3000 or the next free port.
8. **`ephemeris.db` is gitignored** — a fresh clone has no data until `seed.py` runs, and your data never leaves this machine via git. Back it up by copying the file.
9. **Deletes are immediate.** Every ephemeris `/…/delete` route hard-deletes on POST with no confirmation and no undo (no `confirm()` in any template).
10. **`seed.py` is not a full backup.** Rows added through the UI or the importers are lost on a DB reset.
11. **`contacts/` loaders write to the live remote Supabase DB** — unlike `seed.py`, a mistake there is not confined to this machine.

---

## Change log — 2026-07-25 session

Everything below is **uncommitted** in the working tree.

1. **Cloned** the repo to `~/projects/codex`; got the Flask app running and wrote this runbook.
2. **Renamed** `financials/` → `ephemeris/` (via `git mv`, history preserved) and `financials.db` →
   `ephemeris.db`. Rewrote both READMEs, UI branding, and `db.py:4`.
3. **Pulled** 3 upstream commits (183 files): the Next.js `web/` app, `contacts/` loaders, `supabase/`
   migrations. Clean fast-forward — upstream never touched `financials/`.
4. **Merged ephemeris into the web app**: 7 screens under `/ephemeris` with full add/delete, sidebar
   entry renamed Financials → Ephemeris, `/financials` → 307 redirect. New Supabase `eph_*` tables +
   `export_to_supabase.py`. Migration applied, 289 rows exported, all totals verified against Flask.
5. **Rebuilt `/wealth`** for dated history: `wealth_snapshots` table, backfill, carry-forward chart,
   update/add UI, per-account history. **Migration still pending.**

### Verification standards used

`tsc --noEmit` and `npm run lint` clean, `npm run build` succeeds, then every route smoke-tested for a
200 and — where data exists — figures cross-checked against the Flask app or direct SQL. A 200 alone was
never treated as proof; `/expenses` returns 200 with zero rows by default.

---

## Adding a new app to codex

Per the repo README, each subdirectory is self-contained with its own README and its own venv. The pattern (adjusted for this machine):

```powershell
cd <project>
python -m venv .venv
.\.venv\Scripts\python.exe -m pip install -r requirements.txt
```
