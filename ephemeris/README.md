# ephemeris

Personal web app to track assets, income, expenses, and freelance hours — all bucketed by life-area tag.

An *ephemeris* is an astronomical table giving the position of a body at a series of dates. This one does the same for money.

Part of [codex](../). See [RUNBOOK.md](../RUNBOOK.md) for full operational detail.

> **This app has been merged into the Next.js web app** at [`web/app/ephemeris`](../web/app/ephemeris) → `/ephemeris`, backed by Supabase.
>
> The migration was applied and 289 rows were exported on 2026-07-25, so **Supabase is now the source
> of record** and this Flask app is a legacy fallback / historical snapshot.
>
> It still owns the **CSV importers**, which write only to SQLite. If you import here, re-run
> `export_to_supabase.py` afterwards or the web app will not see the new rows.

## Tags

`General Life` *(legacy — pre-Personal)* · `Personal` *(credit cards default here)* · `Freelance Consulting` *(legacy — pre-source-split)* · `Halo` · `Snorkel` · `HAI` · `Handshake` · `7 Shot Tennis` · `Other`

Source of truth is `DEFAULT_TAGS` in `db.py`.

## First-time setup

```powershell
cd "C:\Users\Cameron Corse\projects\codex\ephemeris"
python -m venv .venv
.\.venv\Scripts\python.exe -m pip install -r requirements.txt
.\.venv\Scripts\python.exe seed.py     # creates ephemeris.db and imports freelance spreadsheet rows
.\.venv\Scripts\python.exe app.py      # serves http://127.0.0.1:5000
```

`seed.py` is idempotent — it skips rows already present, so re-running is safe.

Note: use `python`, not `py` — the Windows `py` launcher is not installed on this machine.

## Gotcha

`/expenses` and `/spending` default to the **last completed calendar month**, so they look empty right after seeding. Use `?from=&to=` for all time:

```
http://127.0.0.1:5000/expenses?from=&to=
```

## What's inside

- `app.py` — Flask routes and dashboard logic
- `db.py` — SQLite schema, default tags, default categories
- `seed.py` — hard-coded freelance spreadsheet rows (expenses, income, hours)
- `import_csv.py` — credit-card CSV importer + merchant normalization
- `import_checking.py` — BofA checking CSV importer (deposits → income)
- `migrate_*.py` — one-off idempotent migrations
- `export_to_supabase.py` — one-off export of this SQLite DB into the Supabase `eph_*` tables
- `templates/` — Jinja templates
- `static/style.css`

## Data model

- `tags` — the life-area buckets
- `categories` — COGS / F&O / S&M / T&E / R&D / L&A subcategories (from the spreadsheet) plus Personal-* categories
- `expenses` — date, description, amount, category, **tag**, client, tax_status, notes
- `income` — date, description, amount, client, **tag**
- `assets` — name, type, value, as_of_date, **tag**
- `hours` — date, hours, rate, status, client, project, description, **tag**

Every transactional row has a tag, so the dashboard can roll up by life-area.

Database lives at `ephemeris.db` — gitignored, treated as user data, regenerate via `seed.py`.
