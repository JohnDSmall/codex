# codex — Runbook

Operational runbook for the `codex` repo (personal life-organization apps).
Verified working on this machine 2026-07-25, re-verified 2026-08-01 and **2026-08-08** (all 21 web
routes 200, figures below re-read from the running app and from PostgREST).

Recent structural changes: company-logo resolution is now database-driven
([company logos](#company-logos)), and projects are fully editable with a derived hour/revenue log
([projects](#projects--edit-create-and-the-hoursrevenue-link)).

- **Repo:** https://github.com/JohnDSmall/codex
- **Local clone:** `C:\Users\Cameron Corse\projects\codex`

| Component | Stack | Storage | Runs? |
|---|---|---|---|
| `web/` | Next.js 16.2.6 / React 19.2.4 | Supabase (remote) | ✅ working — `.env.local` is populated |
| `ephemeris/` | Flask 3.0.3 | SQLite (local file) | ✅ working — **legacy fallback**, still owns the CSV importers |
| `contacts/` | Python loaders | writes to Supabase | ⚠️ needs env vars, not yet run |
| `supabase/` | 9 SQL migrations | — | schema definition only, all applied |

### Live figures (2026-08-08)

All figures are **Supabase**, which is the live data. The SQLite counts under
[Data](#data) are the frozen Flask seed and are much smaller — don't mix them up.

| | |
|---|---|
| Contacts | ~1,186 |
| Companies | 180, of which **122** resolve a logo |
| Projects | 14 · 65.5 h logged · $133,046 revenue linked |
| Income | **145 rows, $348,847.18** · 2022-04-04 → 2026-07-31 |
| Expenses | **652 rows, $265,276.45** |
| Net worth | $296,800 across 6 accounts, 30 dated readings |

---

## ⚠️ START HERE — state as of 2026-08-08

**One action is outstanding:** rotate the Supabase key. The push is done, and all nine migrations
are now applied.

### 1. Push to GitHub — ✅ DONE

`main` is in sync with `origin/main` at `08829e5` ("Runbook: wealth-snapshots applied, and
clipboard/push caveats"). All four commits of the 2026-07-25 session are pushed. Working tree is clean
apart from one untracked file, `PRD-orrery.md`.

*Previously blocked by:* Git Credential Manager holding a stale GitHub credential (`remote: Invalid
username or token`), with `gh` **not installed** on this machine. If a push fails that way again, run it
from an interactive terminal — GCM can't prompt from a non-interactive shell — and if that still fails,
clear the credential at Windows **Credential Manager → Windows Credentials → `git:https://github.com`**
→ Remove, then push again and sign in fresh.

Note that `RUNBOOK.md` names the Supabase project ref and dashboard URL, and this is a public repo. No
keys, but it does identify the project. Scrub to `<project-ref>` if that matters.

### 2. Rotate the Supabase service key

`web/.env.local` holds a working service-role key that was pasted into a chat transcript. Rotate it at
Project Settings → API when convenient and update the file. Project ref: `qwkdjxzgqrnbzrohaekg`.

### 3. Dev servers won't survive a session restart — or an agent turn

Restart with:

```powershell
cd "C:\Users\Cameron Corse\projects\codex\web";       npm run dev              # :3000
cd "C:\Users\Cameron Corse\projects\codex\ephemeris"; .\.venv\Scripts\python.exe app.py   # :5000
```
If port 3000 is stuck held by an orphaned process, see Gotcha 7.

**A dev server started as an agent background task is reaped when that turn
ends** — observed four times on 2026-08-02/03, every time with a clean log (`✓ Ready`, all requests
200, no crash). An earlier guess that `npm run build` was killing it is **wrong**; the fourth death
followed no build at all. An agent can still start one and verify against it inside a single turn,
which is how the route checks in this runbook were made. **If you want a server that stays up while
you click around, start it yourself in your own terminal.**

> **Renamed 2026-07-25:** `financials/` → `ephemeris/`, and `financials.db` → `ephemeris.db`. If you have an older clone or a backed-up DB under the old name, rename the file to `ephemeris.db` or `seed.py` will build a fresh empty one.

> **Ephemeris was merged into the web app on 2026-07-25.** The sidebar entry "Financials" is now **Ephemeris** → `/ephemeris`, a full port of all 7 Flask screens including add/delete. `/financials` 307-redirects to `/ephemeris` so old links keep working.
>
> **Live as of 2026-07-25.** Migration applied, 289 rows exported to Supabase, all 7 screens verified against the Flask originals. The Flask app remains as a fallback and still owns the CSV importers.

> **Wealth snapshots applied 2026-07-25.** `/wealth` is out of fallback mode (`pendingMigration:
> false`), write buttons present. A full set of balances was then recorded on **2026-07-25**, which is
> the current state — see [wealth — dated history](#wealth--dated-history) for the live figures.
>
> **Expect a trough in the chart around Oct–Nov 2025 — it is a measurement artifact, not a loss.** BA
> Savings was re-valued down on 2025-10-20 (103,428 → 11,800) but Schwab was not re-valued up until
> 2025-11-13 (47,800 → 155,300). The money appears to leave one account 24 days before arriving in the
> other, so net worth dips to $134,348 and recovers. Carry-forward is behaving correctly; the gap is in
> when the readings were taken. Adding a Schwab snapshot at the real transfer date would close it.

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

> **Two datasets, don't confuse them.** The counts in this section describe the **SQLite** file behind
> the Flask app, which has been frozen since the 2026-07-25 export. The live data is in **Supabase**
> and is now much larger — see [live figures](#live-figures-2026-08-08). A figure like "161 expenses"
> below is the seed, not the current book.

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

There are two generations, and they write to **different databases**:

| Importer | Language | Writes to | Use for |
|---|---|---|---|
| `import_csv.py` | Python | **SQLite** | legacy card statements (frozen) |
| `import_checking.py` | Python | **SQLite** | legacy checking deposits (frozen) |
| [`import_bofa_income.js`](#income--structured-import-from-bofa-statements) | Node | **Supabase** | income, clean non-overlapping window |
| [`reconcile_income.js`](#reconciling-against-full-history-statements) | Node | **Supabase** | income, overlapping statements |
| [`import_bofa_expenses.js`](#expenses--imported-from-the-bank-not-the-cards) | Node | **Supabase** | expenses |

**Use the Node ones.** The Python pair write to `ephemeris.db`, which nothing reads any more — the web
app is backed by Supabase. They are kept because they hold `CATEGORY_RULES` and
`normalize_merchant()`, which `import_bofa_expenses.js` parses at runtime, and because re-running the
SQLite path would need a fresh export to reach the live app.

The Node importers need no venv (they read `web/.env.local` for credentials), all dry-run by default,
are idempotent, and report anything they cannot classify rather than guessing.

### Legacy Python importers

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

## income — structured import from BofA statements

Added 2026-08-08. **All income comes from the two Bank of America accounts** (checking and savings);
nothing else is an income source. Each row carries a Type and a Company.

| Field | Column | Values |
|---|---|---|
| Type | `eph_income.income_type` | `Contract` · `Salary` · `Bonus` · `Expense Reimbursement` · `Misc`. Null = not yet categorized. Enforced by a CHECK. |
| Company | `eph_income.company_id` | FK to `companies.company_id`. Null where no company applies (interest, tax refunds). |
| Description | `eph_income.description` | Generated by the importer, e.g. *"Salary payment from Handshake AI for the first half of March 2026"*. |

Company is a **foreign key, not a second text enum** — the same companies are already named in
`companies` and carry the logos, so a parallel spelling would reinstate exactly the drift the
2026-08-08 standardization removed. `7 Shot Tennis` and `Backcountry Academics` were created then,
because an FK cannot point at rows that don't exist.

### Running it

```powershell
cd "C:\Users\Cameron Corse\projects\codex\ephemeris"
node import_bofa_income.js <checking.csv> <savings.csv>            # dry run, writes nothing
node import_bofa_income.js <checking.csv> <savings.csv> --apply
```

Node, not Python — it writes to Supabase, not SQLite, so it does not belong with the Flask importers
below and needs no venv. It reads `web/.env.local` for credentials.

**Always dry-run first.** It prints every row with its assigned Type, Company and generated
description, plus anything it could not classify. Unrecognised rows are reported and skipped, never
guessed. Re-running is safe: a row is skipped when `eph_income` already holds the same
date + amount + `source_account`.

### Classification rules

| Bank memo | Type | Company |
|---|---|---|
| `Handshake-OSV DES:PAYROLL###` | Salary | Handshake AI |
| `Handshake DES:…` (anything else) | Expense Reimbursement | Handshake AI |
| `APA TREAS 310 MISC PAY` | Misc | — |
| `BKOFAMERICA MOBILE … DEPOSIT` | Misc | — |
| `Interest Earned` | Misc | — |
| `Preferred Rewards … Rebate` | Misc | — |

Salary is semi-monthly (15th and month-end); the "first/second half of \<month\>" wording is
**inferred from the pay date**, since the memo states no period. If payroll pays in arrears the
wording is half a period ahead.

Some salary runs sit well above the run rate — 2026-03-13 `$8,130.26`, 2026-05-15 `$7,122.31`,
2026-06-15 `$7,178.63` against a `$5,459`–`$5,502` norm. These are **deliberately left as Salary**:
bonuses are paid inside the semi-monthly band, so `Bonus` is reserved for a separate payment.

### Internal transfers are excluded

`Online Banking transfer from/to SAV|CHK` moves money between the two accounts and appears as a
credit in the receiving statement. Counting it would have added a spurious **$63,300** to 2026
income. The importer drops it.

### Reconciliation (2026-08-08)

Imported 44 rows, `$129,029.03`, against the statements' own summary lines:

| Account | Bank "Total credits" | − transfers | Imported |
|---|---:|---:|---:|
| Checking | $96,347.98 | $63,300.00 | **$33,047.98** ✓ |
| Savings | $95,981.05 | $0.00 | **$95,981.05** ✓ |

*(Figures as of this first import — superseded below once the full-history statements were
reconciled.)* `eph_income` stood at **100 rows**: 56 pre-2026 (`$149,196.00`) and 44 in 2026. The 2026 statements do
not overlap the historical rows — those end 2025-07-28 — so the import was purely additive and the 52
project links on the old rows are untouched.

### Reconciling against full-history statements

`import_bofa_income.js` assumes a clean, non-overlapping window. For statements that overlap rows you
already have, use **`reconcile_income.js`** instead:

```powershell
node reconcile_income.js <checking.csv> <savings.csv>            # report only
node reconcile_income.js <checking.csv> <savings.csv> --apply    # insert the gaps
```

It matches each statement credit against `eph_income` on **date + amount** — not
`source_account`, because legacy rows have none, and including it would make every historical row
look like a gap and duplicate it. Output is three buckets: `MATCHED` (skipped), `GAP` (imported), and
`DB-ONLY` (recorded but absent from the statements — reported, never touched).

Beyond internal transfers it also drops **account-verification micro-deposits**: `Yardi Penny Test`,
`ACCTVERIFY`, `Transfer PEOPLE CENTER`, and `DES:BVC` — four rows totalling $0.21 that are not income.

Run 2026-08-08 over `Checking_All.csv` + `Savings_All.csv` (2025-02-10 → 2026-08-07): 51 matched,
**42 gaps imported ($66,722.15)**, 5 unrecognised, 6 DB-only. A second pass then imported the 3
deposits you attributed by hand ($3,900.00), leaving 2 unrecognised — both known duplicates. Re-running
now reports 0 gaps.

`eph_income` stands at **145 rows, $348,847.18**, 2022-04-04 → 2026-07-31, every row tagged.

| Added | Rows | Amount |
|---|---:|---:|
| Salary / Snorkel | 13 | $57,401.85 |
| Expense Reimbursement / Snorkel | 9 | $1,967.62 |
| Expense Reimbursement / Halo | 6 | $1,100.66 |
| Salary / Handshake AI | 1 | $5,504.21 |
| Misc | 13 | $747.81 |

**Snorkel pays on two rails**, exactly like Handshake: `SNORKEL AI DES:PAYROLL` is the semi-monthly
run (base $3,971.21), and `Snorkel AI Inc DES:<code>` is the reimbursement rail. Halo paid by **Zelle**,
and the memo states which it is — `for Payment for…` → Contract, `for Expense reimbursement…` →
Expense Reimbursement.

**2025-10-15 Snorkel `$10,423.01`** is 2.6× the base and almost certainly carries a bonus, but it
arrived as one payroll deposit and the split is not in the bank data. Left as Salary under the
standing rule (a bonus inside the semi-monthly band stays Salary).

### Deposits attributed by hand

Cheque and branch deposits carry no counterparty, so there is nothing to pattern-match on and the
importer never guesses. Ones you have identified live in `ATTRIBUTED_DEPOSITS` in
`reconcile_income.js`, keyed on `date|amount`, so a re-run reproduces them instead of dropping them
back into `UNRECOGNISED`:

| Date | Amount | Attribution |
|---|---:|---|
| 2025-08-14 | $2,750.00 | Expense Reimbursement (branch deposit, 2077 Broadway NY) — no company assigned |
| 2025-12-29 | $1,000.00 | Misc — gift |
| 2025-11-03 | $150.00 | Misc — gift |

Add to that map rather than patching rows by hand; a row inserted outside the importer will reappear
as a gap on the next run.

**Two further mobile deposits are near-certain duplicates** of rows already recorded, offset by a day
or two — the delay between the payment date and depositing the cheque. They are deliberately **not**
in `ATTRIBUTED_DEPOSITS`:

| Recorded | Bank |
|---|---|
| 2025-03-15 $867.00 *February Payment* [7 Shot Tennis] | 2025-03-17 $867.00 mobile deposit |
| 2025-04-29 $867.00 *March Payment* [7 Shot Tennis] [7 Shot Tennis] | 2025-04-30 $867.00 mobile deposit |

They were **not** imported (they fall in `UNRECOGNISED`, not `GAP`), so nothing double-counted — but
it means date+amount matching alone will not catch cheque-lag duplicates. Check `DB-ONLY` against
`UNRECOGNISED` before importing anything by hand.

The other four `DB-ONLY` rows — Backcountry Academics $300, $450, $225, $250 — **were paid by Venmo**
and will never appear in a BofA export. They are correct as recorded; expect them to show up as
`DB-ONLY` on every future reconciliation run, and leave them alone.

## expenses — imported from the bank, not the cards

Added 2026-08-08. `import_bofa_expenses.js`:

```powershell
node import_bofa_expenses.js --bank <chk.csv> <sav.csv> `
     --amex <dir> --card <dir> [--apply]
```

### The model, and why

**An expense is money that actually left the bank.** Card *payments* are therefore the expense, dated
when paid; card line items are **not** imported as rows. The Amex is shared with a partner, so its
line items overstate what was personally spent — the payment is the only figure that is truly his.

Card statements are still read, but **only to derive category proportions**: a payment is split across
categories in the same ratio as that card's charges in the preceding calendar month, using a
largest-remainder split so the parts sum exactly to the payment. Where no statement covers that
month the payment stays **uncategorized** rather than guessed.

Categorization rules are parsed out of `CATEGORY_RULES` in `import_csv.py` at runtime — one source of
truth, rather than a second copy that drifts.

### What is excluded, and the $90,000 lesson

| Excluded | Rows | Amount |
|---|---:|---:|
| Internal CHK↔SAV transfers | 10 | $63,300.00 |
| Transfers to investments | 3 | $105,000.00 |

**BofA labels a brokerage transfer `Online Banking transfer to BRK ####`, with no broker name in the
memo.** Matching only on broker names (SCHWAB, FIDELITY, …) missed two rows worth **$90,000** and
inflated Apr/May 2025 spend by 3–5×. The tell was a monthly total that looked absurd, not an error —
nothing failed. **Always eyeball the monthly series after an import; a wrong number is silent.**

### Result (2026-08-08)

491 rows, **$242,885.74**, reconciling exactly: $411,185.74 of debits − $63,300 internal −
$105,000 investment. Of that, 383 rows totalling **$117,972.10** are card-payment allocations, which
sum precisely to the card payments seen in the bank.

`eph_expenses` now holds **652 rows, $265,276.45** — the 491 imported plus the 161 legacy
spreadsheet rows. Everything is tagged `Personal`; 22 rows ($12,237.75) are uncategorized, all of
them card payments from before the card statements begin.

### Coverage limits

- **BofA card 7061 statements start 2025-07-28**, but the card was being paid from Feb 2025. Those
  five months of payments are imported at full value but uncategorized — the itemization does not
  exist and cannot be exported.
- Amex statements run 2024-12-27 → 2026-07-18.
- Everything imported is tagged `Personal`, including business-looking categories such as
  `F&O - Software & Apps`. These are personal accounts; re-tag if you want them split by life area.

---

### Overview period filter and income KPIs

Added 2026-08-08.

**`/ephemeris` takes `?range=`** — `ytd` (default) · `3m` · `6m` · `12m` · `18m` · `24m` · `all`.
The KPIs, chart and both monthly tables all honour it; **assets do not**, since a balance is a
point-in-time figure, not a flow. Ranges count *month buckets*, not 30-day windows: `3m` on
2026-08-08 starts 2026-06-01 and shows three bars (Jun, Jul, partial Aug).

**Net is no longer overlaid on the income-vs-expenses chart.** It has its own *Net by month* table
beside the income/expenses table, on the same period. The chart is bars only.

**`/ephemeris/income` carries two whole-book KPIs** that deliberately ignore the tag/type/company
filters, because they measure the book rather than the current view:

| KPI | Definition |
|---|---|
| Year to date | Income dated on or after 1 Jan of the current year |
| Lagging avg monthly income | Mean income over the last **3 complete** months |

"Complete" excludes the current month, which is partial for most of its life and would otherwise drag
the average down every month. The KPI's hint names the exact months averaged, so the figure is always
checkable — e.g. on 2026-08-08 it reads `mean of 2026-05, 2026-06, 2026-07` = $16,724.

The two filtered KPIs beside them (*Total income (filtered)*, *Rows (filtered)*) do follow the
filters. The labels are the only thing distinguishing them; keep them.

### Tags: the rollup gotcha

**An imported row with no `tag_id` silently lands in "Untagged" on the dashboard.** The first import
left all 44 rows untagged, so `$129,029.03` — more than the entire pre-2026 history — sat in a bucket
nobody looks at, and the rollup looked broken. `loadDashboard()` is not at fault; it buckets null to
`"Untagged"` by design. **Always set `tag_id` when importing.**

This then happened a *second* time: `reconcile_income.js` was written without the tagging logic and
put another $66,722.15 in "Untagged". Both importers now assign a tag from `TAG_FOR_COMPANY`, and
`reconcile_income.js` **aborts** rather than inserting if a required tag row is missing. Writing the
gotcha down was not enough — the guard is in the code.

Tags now applied: Handshake rows → `Handshake AI`, the company-less Misc rows (interest, tax refunds)
→ `Personal`.

**`Handshake` and `HAI` were merged into one `Handshake AI` tag** on 2026-08-08 (both were unused by
any row, so nothing needed re-pointing). `DEFAULT_TAGS` in `ephemeris/db.py` was updated to match —
otherwise `seed.py` recreates the old names on the next run.

### The tag does NOT identify the company

Worth stating plainly, because it is the obvious wrong assumption: for 45 of the 56 pre-2026 rows the
tag is `Freelance Consulting`, a generic bucket covering four different clients. Only `Halo` maps 1:1.
**`client` is what identifies the company**, and it is what the backfill used.

| `client` | → `company_id` | Type | Rows | Amount |
|---|---|---|---:|---:|
| Powered By Halo | `Halo` | *pending* | 11 | $108,000.00 |
| 7 Shot Tennis | `7 Shot Tennis` | Contract | 34 | $33,371.00 |
| Backcountry Academics | `Backcountry Academics` | Contract | 9 | $5,475.00 |
| XX-Ali-Walton | — | — | 1 | $1,350.00 |
| Ukraine Global Scholars | — | — | 1 | $1,000.00 |

The last two match none of the five companies and were left null rather than guessed.

### UI

`/ephemeris/income` shows **Type** and **Company** columns, with filter rows for each that combine
with the tag filter. All are plain `GET` links, so they work without JS and stack:
`?type=Contract&company=7%20Shot%20Tennis`. `?company=none` selects rows with no company.
`INCOME_TYPES` in `lib/ephemeris-server.ts` must match the CHECK constraint — Postgres, not the form,
is what rejects a bad value.

**Still outstanding:** the 11 Halo rows have `company_id` set but no Type — exported to
`~/Documents/codex-halo-income-to-categorize.csv` for you to fill in the `income_type_FILL_ME`
column. Categorizing anything further back needs 2022–2025 BofA statements; the credit-card CSVs
won't help, since income only comes from the two BofA accounts.

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

### Route status (re-verified 2026-08-08)

All **21** routes below verified **200**, except `/financials` which correctly **307**s to
`/ephemeris`. Without `.env.local`, every Supabase-backed route 500s at import time instead.

The dynamic routes need a real id, so the snippet fetches one first — an earlier version of this
smoke test only covered static paths and so never exercised `/projects/[id]` or
`/relationships/[id]`, the two places most likely to break.

```bash
cd "C:\Users\Cameron Corse\projects\codex\web"
KEY=$(grep '^SUPABASE_SERVICE_KEY=' .env.local | cut -d= -f2- | tr -d '"'\''\r')
URL=$(grep '^SUPABASE_URL=' .env.local | cut -d= -f2- | tr -d '"'\''\r')
CID=$(curl -s "$URL/rest/v1/contacts?select=id&limit=1" -H "apikey: $KEY" -H "Authorization: Bearer $KEY" | grep -o '"id":"[^"]*"' | cut -d'"' -f4)
PID=$(curl -s "$URL/rest/v1/projects?select=id&limit=1" -H "apikey: $KEY" -H "Authorization: Bearer $KEY" | grep -o '"id":"[^"]*"' | cut -d'"' -f4)

for p in / /financials /goals /planner \
         /ephemeris /ephemeris/spending /ephemeris/subscriptions /ephemeris/expenses \
         /ephemeris/income /ephemeris/assets /ephemeris/hours \
         /projects /projects/new "/projects/$PID" "/projects/$PID/edit" \
         /wealth /relationships /relationships/dashboard /relationships/new \
         "/relationships/$CID" "/relationships/$CID/edit"; do
  echo "$(curl -s -o /dev/null -w '%{http_code}' "http://127.0.0.1:3000$p")  $p"
done
```

**A 200 is not proof the page is right.** It says the route rendered, not that it rendered data —
`/ephemeris/expenses` returns 200 with zero rows by default (Gotcha 1), and a logo or a project total
can be silently absent behind a perfectly healthy 200. Check the figure you changed.

Supabase-touching modules: `lib/supabase-server.ts`, `lib/actions.ts`, `lib/contacts-server.ts`,
`lib/company-logos-server.ts`, `lib/projects-server.ts`, `lib/projects-actions.ts`,
`lib/ephemeris-server.ts`, `lib/ephemeris-actions.ts`, `lib/wealth-server.ts`,
`lib/wealth-actions.ts`.

---

## projects — edit, create, and the hours/revenue link

Built 2026-08-02. `/projects` was a read-only card grid; it now has full CRUD plus a per-project hour
log and revenue attribution.

| Route | What |
|---|---|
| `/projects` | Card grid, filters, header totals, **New project** |
| `/projects/[id]` | Detail: KPIs, hour log, linked revenue, edit/delete |
| `/projects/[id]/edit` | Full edit form |
| `/projects/new` | Create |

| File | Role |
|---|---|
| `lib/projects-server.ts` | `loadProjectsWithTotals`, `loadProjectDetail`, `loadProjectById`, `loadClientSuggestions` |
| `lib/projects-actions.ts` | Server Actions: project CRUD, `logProjectHours`, `linkIncome`/`unlinkIncome`, `addProjectIncome` |
| `app/components/ProjectForm.tsx` | Create + edit form (shared) |
| `app/components/ProjectHoursPanel.tsx` | Hour log table, add, unlink, delete |
| `app/components/ProjectIncomePanel.tsx` | Linked revenue, "link existing" picker, record income |

### Hours and revenue are DERIVED — do not write them

`projects.hours_spent`, `projects.revenue` and `projects.hours_remaining` are **no longer written by
the app and no longer displayed.** Every hours/revenue figure is summed at read time from rows whose
`project_id` points at the project:

- **Hours** → `eph_hours.project_id`
- **Revenue** → `eph_income.project_id`

Both columns are nullable — attribution is optional, and an unlinked row is still a valid row. The FK
is `on delete set null`, so **deleting a project unlinks its history rather than destroying it.**

The stored columns still hold the pre-link manual figures. They are surfaced only as a muted
"recorded before linking existed" line on a project whose log is empty, so no number silently
disappeared. Editing them is deliberately not possible — fix the underlying hour/income rows instead.

`estimated_hours`, `projected_revenue`, `cost` and the action counters remain manual: they are
targets, not actuals.

### Degradation

`loadProjectsWithTotals` treats a missing `project_id` column (`42703` / `PGRST204`) as "no links
yet": totals read zero, an amber banner names the migration, and the logging controls hide. `/projects`
never 500s on a pending migration — same rule as `/wealth`.

### The backfill and what it left alone

Migration `20260802120000_project_links.sql` linked **103 of 128 rows** by one mechanical rule:
candidates matched on client (via an explicit alias list — `"7 Shot Tennis"`→`"7Shot Tennis"`,
`"Powered By Halo"`→`"Halo"`), narrowed to the single project whose `[start_date, due_date]` window
contains the row's date. No amount matching, no fuzzy names. Guarded by `project_id is null`, so it is
re-runnable and never overwrites a manual link.

Deliberately left unlinked (25 rows) — assign them in the UI:

| Rows | Why |
|---|---|
| 9 h "ND Tennis Alumni" | closest project is client "Notre Dame Alumni" — a guess, not a match |
| 16 h "Real Time Strategist", 6.5 h "Drop The List", 1 h "UTR" | no project exists for these |
| 2 h Backcountry 2026 | outside every Backcountry project's window |
| $13,000 Halo | outside both Halo projects' windows |
| $1,000 Ukraine Global Scholars, $1,350 XX-Ali-Walton, $800 Backcountry | no client match / two overlapping windows |

**Where derived totals differ from the old stored numbers, the derived figure is the one backed by
rows.** The clearest case: the rule moved **$2,500 of 7Shot revenue** from *Analytics Platform MVP*
(now $7,500, was $10,000) to *Platform Ops 2023-2024* (now $20,669, was $18,169) — a payment dated
just after the MVP project's `due_date` of 2022-09-30. If that payment really belonged to the MVP,
relink it on the project page; the date windows are what decided it.

Verified 2026-08-02: linked 65.5 h + unlinked 42.0 h = 107.5 h total, and linked $133,046 + unlinked
$16,150 = $149,196 total — both reconcile against the raw tables, with no orphaned `project_id`.

---

## Company logos

Reworked 2026-08-02. **`companies.logo_path` in Supabase is the source of truth** for which image a
company uses. `lib/company-logos.ts` used to hardcode a name→filename map; it no longer names a single
file.

| File | Role |
|---|---|
| `lib/company-logos.ts` | `NAME_ALIASES` (spelling variants), `buildCompanyLogoMap()`, `logoForCompany()`. Pure and synchronous — safe to import from Client Components. |
| `lib/company-logos-server.ts` | `loadCompanyLogoMap()` — reads `companies` from Supabase. |

### Why the map is passed as a prop

`RelationshipsList` is a Client Component, so `logoForCompany()` runs in the browser and **cannot be
async**. The map is therefore loaded in the Server Component and passed down:

```
app/relationships/page.tsx        (server) ─┐
app/relationships/[id]/page.tsx   (server) ─┴─> loadCompanyLogoMap()
  └─> RelationshipsList (client) ─> RelationshipCard ─> CompanyLogo
```

Keep `company-logos.ts` free of `server-only` imports or it will break the client bundle. The full
map (~114 entries, a few KB) is serialized into the client payload on `/relationships` — fine at this
size, but it is the reason to add a `logo_path IS NOT NULL` filter if `companies` ever grows large.

`loadCompanyLogoMap()` **never throws** — on a Supabase error it logs and returns `{}`, so pages
render the `Building2` placeholder instead of 500ing. Same principle as `/wealth` degrading when
`wealth_snapshots` is missing.

### NAME_ALIASES

Maps a spelling variant to a **canonical company name**, not to a file — e.g. `mvw` → `Marriott
Vacation Worldwide`. The lookup indexes both `company_id` and `display_name`, so an alias is only
needed when contact data spells a company differently than its `companies` row. Add one when a
contact's `organization` / `primary_company` / `company_tags` value doesn't match.

### Adding a logo

1. Drop the file in `web/public/company_logos/`.
2. Set `logo_path` on that company row to `/company_logos/<file>` — extension must match the file on
   disk exactly.
3. Add a `NAME_ALIASES` entry only if contact data uses a different spelling.

No code change is needed for step 1–2. **The extension really does matter:** eight rows had `.jpeg`
recorded for files that are actually `.jfif` or `.jpg` (Audacious Ventures, Circle, Citadel, DC
Advisory, DelMorgan, Halo, IDEA Center, Salt AI) — corrected 2026-08-02. Four of those were invisible
before the rework because the old hardcoded map carried the right filename.

### Coverage as of 2026-08-08

**122 of 180** companies resolve a logo (84 before the rework, 114 after it, +8 added 2026-08-08).
The other 58 have no image at all — exported to `~/Documents/codex-companies-missing-logos.csv`
(company, sector, sub-sector, contact reference count). Regenerate that file after adding logos.

Added 2026-08-08 from `~/Downloads/logos`: Battery Ventures, Capital Group, Doblin, Oppenheimer,
Ruttenberg Gordon Investments, Technifibre / Lacoste, University of Massachusetts, Handshake AI.
Source files were named `*_logo.ext`; the `_logo` suffix is dropped on copy to match the existing
naming.

**Handshake AI had no `companies` row at all** — a name can be all over `contacts` and still be absent
from the reference table, in which case no logo can ever attach to it. Inserted with `sector: "AI"`,
matching Anthropic / Reflection AI / Snorkel; `sub_sector` left null rather than guessed. Check for a
row before assuming a missing logo is just a missing file.

Two assignments are worth eyeballing: the DB gives `gt.png` to **Greenburg Traurig** and `chs.png` to
**Chathan Road Capital**, while the old hardcoded map gave those same files to Grant Thornton and CHS.
One of each pair is wrong. Also, `Avande` is the canonical `company_id` for what is really **Avanade**
— aliased around rather than renamed, since it's a primary key.

### Company-name standardization

`companies.company_id` is a text primary key that *is* the company name on most rows (`display_name`
is often null and the app falls back to the id). Renaming a company therefore means updating the PK,
and separately updating every contact that stores the old string in `organization`,
`primary_company` or `company_tags` — those are free text, not foreign keys, so nothing cascades.

Done 2026-08-08:

| Change | Touched |
|---|---|
| `Oppenheimer & Co Inc` → `Oppenheimer` | 1 `companies` row (PK), 1 contact |
| `Handshake` → `Handshake AI` | 4 contacts (1 `primary_company`, 3 `company_tags`) |

**Scan for name usage with a paged query.** PostgREST caps a response at 1000 rows and there are
~1,186 contacts, so an unpaged `select` silently misses the tail — that mistake initially reported
only one Handshake contact instead of five. `selectAll()` in `lib/contacts-server.ts` shows the
pattern.

When rewriting `company_tags`, dedupe: a contact can already carry the target name, and a blind
replace leaves it twice.

**Ephemeris tags are a separate namespace and were deliberately not touched.** `eph_tags` (and
`DEFAULT_TAGS` in `ephemeris/db.py`) still carry **`Handshake`** and **`HAI`** as life-area buckets on
expenses/income/hours. Those are financial tags, not company references, and renaming one would
re-tag historical rows. If you want them aligned with the company naming, that is a separate,
deliberate change — rename in `eph_tags`, and in `DEFAULT_TAGS` so `seed.py` doesn't recreate the old
name.

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

### Current state (read from the running app, 2026-08-01)

Header: `6 accounts · 30 dated readings · latest 2026-07-25`. Net worth **$296,800**, total liabilities
**$0** (there are no liability rows and no targets). Change card: **+$47,700 / +19.1% since Nov 28,
2025**.

| Account | Category | Value @ 2026-07-25 |
|---|---|---|
| Charles Schwab Investment Portfolio | investment | $251,000 |
| Fidelity 401k | investment | $27,000 |
| BA Checking | cash | $15,800 |
| BA Savings | cash | $3,000 |
| Vanguard 401k | investment | $0 |
| I-Bond | investment | $0 |

Vanguard 401k and I-Bond were both taken to **$0** on 2026-07-25 (from 46,000 and 11,500). Their
history is intact — they still contribute to every earlier point in the chart.

Net worth at each of the 8 dated points, with carry-forward applied:

| Date | Net worth | What moved |
|---|---|---|
| 2022-12-31 | $147,944 | eoy backfill |
| 2023-12-31 | $180,568 | eoy backfill |
| 2024-12-31 | $222,250 | eoy backfill |
| 2025-10-20 | $134,348 | BA Savings ↓, Vanguard, I-Bond — start of the trough |
| 2025-11-01 | $132,100 | BA Checking → 15,000 |
| 2025-11-13 | $239,600 | Schwab → 155,300 — trough closes |
| 2025-11-28 | $249,100 | Fidelity → 9,500 |
| 2026-07-25 | $296,800 | all 6 accounts re-valued |

Re-verified 2026-08-01: every account has exactly 5 readings (30 total), each account's newest snapshot
equals its `current_value`, the six current values sum to $296,800, and all 8 history points reconcile
under carry-forward.

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

Expect roughly **4 readings per account** immediately after. (Each account now has 5 — the backfill's 4
plus the 2026-07-25 update.)

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

Nine migrations in `supabase/migrations/`. There is no local Supabase stack and no `config.toml`, and
**no CLI installed on this machine** — apply them by pasting into the SQL editor at
`https://supabase.com/dashboard/project/qwkdjxzgqrnbzrohaekg/sql/new`.

| Migration | Applied? |
|---|---|
| `20260525102330_create_contacts.sql` | ✅ |
| `20260525124020_relationship_fields.sql` | ✅ |
| `20260525132435_relationship_extras.sql` | ✅ |
| `20260525150000_companies_projects_wealth.sql` | ✅ |
| `20260624000000_relationship_sqs_flags.sql` | ✅ applied 2026-08-02 — see below |
| `20260725120000_ephemeris_financials.sql` | ✅ applied 2026-07-25 |
| `20260725160000_wealth_snapshots.sql` | ✅ applied 2026-07-25 |
| `20260802120000_project_links.sql` | ✅ applied 2026-08-02 — DDL via SQL editor, backfill via REST |
| `20260808120000_income_type_company.sql` | ✅ applied 2026-08-08 |

DDL cannot go through the REST API, so these always need the SQL editor (or the CLI, if installed later).
All of them are written to be idempotent.

**The SQS-flags row carried a ✅ for over a month without having been run.** Caught 2026-08-02 —
`contacts.sqs`, `.fundraising`, `.consulting` and `.hiring` all returned `42703: column … does not
exist` — and applied the same day via the SQL editor. All four columns now exist and are null on
every row; nothing in `web/` reads them yet.

The lesson is that this table is a claim, not evidence. Check a migration by selecting one of its
columns before trusting the tick:

```bash
curl -s "$SUPABASE_URL/rest/v1/contacts?select=sqs&limit=1" \
  -H "apikey: $KEY" -H "Authorization: Bearer $KEY"   # 42703 = not applied
```

**Getting a migration onto the clipboard:** run this yourself in an interactive terminal —

```powershell
Get-Content -Raw "supabase\migrations\<file>.sql" | Set-Clipboard
```

`Set-Clipboard` run by an agent in a background session writes to *that* session's clipboard, not your
desktop's. It reports success and you paste something else entirely. Either run the line yourself or
open the file and copy it by hand.

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
│   │   ├── projects/           list + [id] detail + [id]/edit + new
│   │   ├── relationships/      list + dashboard + [id] + [id]/edit + new
│   │   └── components/
│   │       ├── ephemeris/          ui, Charts, Filters, nav, row actions
│   │       ├── ProjectForm.tsx     shared by /projects/new and /edit
│   │       ├── ProjectHoursPanel.tsx    hour log: add, unlink, delete
│   │       ├── ProjectIncomePanel.tsx   revenue: link existing, record new
│   │       └── ProjectCard.tsx / ProjectsList.tsx / DeleteProjectButton.tsx
│   ├── lib/            server-side data access (*-server.ts hit Supabase)
│   │   ├── company-logos.ts        aliases + pure lookup (client-safe)
│   │   ├── company-logos-server.ts loads companies.logo_path
│   │   ├── projects-server.ts     projects + derived hour/revenue totals
│   │   ├── projects-actions.ts    Server Actions: CRUD, log hours, link income
│   │   ├── ephemeris-server.ts   queries, filters, subscription detection,
│   │   │                         dashboard ranges, income KPIs
│   │   ├── ephemeris-actions.ts  Server Actions: add/delete + sub overrides
│   │   ├── wealth-server.ts      snapshots, carry-forward history, summaries
│   │   └── wealth-actions.ts     Server Actions: record balances, add/delete
│   ├── public/company_logos/   123 org logos (tracked in git — public repo)
│   ├── node_modules/   gitignored
│   ├── .env.local.example      committed template
│   └── .env.local      gitignored — YOU MUST CREATE THIS
├── PRD-orrery.md       orrery PRD draft (committed 2026-08-02)
├── contacts/           one-off Python loaders → Supabase
├── supabase/migrations/  9 SQL migrations
└── ephemeris/
    │   ── Node importers → SUPABASE (current) ──
    ├── import_bofa_income.js       income, clean window
    ├── reconcile_income.js         income, overlapping statements + gap report
    ├── import_bofa_expenses.js     expenses; cards used only for category ratios
    │   ── Python → SQLITE (frozen; still holds the shared CATEGORY_RULES) ──
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

There are **no tests** and **no lint/CI config** in this repo. Verification is therefore manual, and
the bar that has actually caught things is: `npx tsc --noEmit` + `npm run lint` + `npm run build`
clean, the route smoke test above, **and a check of the specific number or element you changed** —
read back from the running app or straight from PostgREST. Every real bug this repo has surfaced
(wrong logo paths, a false migration tick, the unpaged 1000-row query) passed a 200.

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

## Change log — 2026-08-08 session

1. **Added 8 company logos** from `~/Downloads/logos` (Battery Ventures, Capital Group, Doblin,
   Oppenheimer, Ruttenberg Gordon, Technifibre / Lacoste, UMass, Handshake AI). Coverage
   **114 → 122** of 180.
2. **Standardized two company names** across the live data: `Oppenheimer & Co Inc` → `Oppenheimer`,
   `Handshake` → `Handshake AI`. See
   [company-name standardization](#company-name-standardization).
3. **Created the missing `Handshake AI` company row** — the name was on five contacts but absent from
   `companies`, so no logo could attach.
4. **Restructured income.** Added Type (`income_type`, CHECK-constrained) and Company (`company_id`,
   FK to `companies`) to `eph_income`; imported the 2026 BofA statements; then reconciled against
   full-history statements and imported the gaps. **145 rows, $348,847.18**, every row tagged.
   See [income](#income--structured-import-from-bofa-statements).
5. **Imported expenses from the bank** — cash-out model, card statements used only for category
   proportions. **491 rows, $242,885.74**; `eph_expenses` now 652 rows, $265,276.45.
   See [expenses](#expenses--imported-from-the-bank-not-the-cards).
6. **Overview period filter** (`?range=`, YTD default), net split into its own table, and two income
   KPIs (YTD, lagging 3-complete-month average).
7. **Merged the `Handshake` and `HAI` tags** into `Handshake AI`, and updated `DEFAULT_TAGS`.
8. **Refreshed this runbook**: route smoke test now covers all 21 routes including the dynamic ones,
   layout tree updated, live figures added at the top.

### Three mistakes worth carrying forward

1. **Unpaged PostgREST query** reported 1 Handshake contact when there were 5. Responses cap at 1000
   rows; contacts is ~1,186. **Always page.**
2. **Imported rows with a null `tag_id`** — twice, the second time *after* documenting the gotcha.
   $129k then $67k silently landed in the dashboard's "Untagged" bucket. The fix that worked was
   moving the guard into code, not prose: the importers now assign a tag and abort if one is missing.
3. **$90,000 of brokerage transfers counted as spend**, because BofA writes them as
   `Online Banking transfer to BRK ####` with no broker name. Nothing errored; the only symptom was a
   monthly total that looked wrong. **Eyeball the monthly series after every import.**

The common thread: none of these threw an error, and every one of them passed a route returning 200.
Check the number you changed.

---

## Change log — 2026-08-02 session

1. **Company logos are now database-driven.** Deleted the hardcoded filename map in
   `lib/company-logos.ts`; `companies.logo_path` is the source of truth. What remains is
   `NAME_ALIASES` (spelling variants → canonical company name) plus a pure lookup. Added
   `lib/company-logos-server.ts`. Threaded the map through `relationships/page.tsx` →
   `RelationshipsList` → `RelationshipCard`, and into `relationships/[id]/page.tsx`.
   Coverage **84 → 114** of 179 companies.
2. **Corrected 8 `logo_path` extensions** in Supabase (`.jpeg` recorded for files that are `.jfif` /
   `.jpg`). Four were latent — they only became visible once the DB started driving rendering.
3. **Exported the 65 companies with no logo** to `~/Documents/codex-companies-missing-logos.csv`.
4. **Found the migration table wrong and fixed the underlying gap:**
   `20260624000000_relationship_sqs_flags.sql` was marked applied but had never been run. Applied it
   via the SQL editor and verified all four columns exist. That closed the last gap among the seven
   migrations then in the repo; `20260802120000_project_links.sql` (item 5) made it eight.

5. **Projects became editable** (`/projects/[id]`, `/edit`, `/new`) with a per-project hour log and
   revenue attribution. Added `project_id` to `eph_hours` and `eph_income`
   (`20260802120000_project_links.sql`), backfilled 103 of 128 rows, and made hours/revenue derived
   rather than stored. See [projects](#projects--edit-create-and-the-hoursrevenue-link).

Verified: `tsc --noEmit` clean, `npm run lint` clean, `npm run build` succeeds, routes 200, and an
old-vs-new resolution diff across all 319 company names in the data — **0 lost, 0 changed, 36
gained.** That diff is the check that matters; a route returning 200 says nothing about whether a
logo rendered. For projects: totals reconcile against the raw tables (65.5 + 42.0 = 107.5 h;
$133,046 + $16,150 = $149,196), no orphaned `project_id`.

**Not yet exercised against live data:** create / edit / delete project, log hours, link income. They
typecheck, build, and their read paths render, but no write was performed — that would have put test
rows in the live database.

---

## Change log — 2026-07-25 session

Everything below is **committed and pushed** — `main` == `origin/main` == `08829e5` (confirmed
2026-08-01).

1. **Cloned** the repo to `~/projects/codex`; got the Flask app running and wrote this runbook.
2. **Renamed** `financials/` → `ephemeris/` (via `git mv`, history preserved) and `financials.db` →
   `ephemeris.db`. Rewrote both READMEs, UI branding, and `db.py:4`.
3. **Pulled** 3 upstream commits (183 files): the Next.js `web/` app, `contacts/` loaders, `supabase/`
   migrations. Clean fast-forward — upstream never touched `financials/`.
4. **Merged ephemeris into the web app**: 7 screens under `/ephemeris` with full add/delete, sidebar
   entry renamed Financials → Ephemeris, `/financials` → 307 redirect. New Supabase `eph_*` tables +
   `export_to_supabase.py`. Migration applied, 289 rows exported, all totals verified against Flask.
5. **Rebuilt `/wealth`** for dated history: `wealth_snapshots` table, backfill, carry-forward chart,
   update/add UI, per-account history. Migration **applied** 2026-07-25; balances recorded the same day.

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
