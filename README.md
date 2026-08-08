# codex

Personal life organization apps.

## Projects

- **[web/](web/)** — the Codex app itself. Next.js 16 + Supabase. Four areas under one sidebar:
  - **Relationships** — ~1,186 contacts with strength tiers, reminders, and company logos
  - **Projects** — client work with an hour log and revenue attribution
  - **Wealth** — accounts tracked as dated snapshots, not point-in-time values
  - **Ephemeris** — financial management (expenses, income, assets, hours, subscriptions)
- **[ephemeris/](ephemeris/)** — the original standalone Flask + SQLite financial app, since merged
  into `web/` at `/ephemeris`. Its data was exported to Supabase on 2026-07-25, so this is now a
  **legacy fallback** — but it still owns the CSV importers, which only write to SQLite.
- **[contacts/](contacts/)** — one-off Python loaders that push legacy contact/company/wealth exports
  into Supabase.
- **[supabase/](supabase/)** — SQL migrations defining the remote schema. There is no local Supabase
  stack; migrations are applied by hand.

## Running

The web app needs Node and a populated `web/.env.local`:

```powershell
cd web
npm install
npm run dev        # http://localhost:3000
```

The Python sub-apps are each self-contained, with their own venv:

```powershell
cd <project>
python -m venv .venv
.\.venv\Scripts\python.exe -m pip install -r requirements.txt
```

On this machine, invoke Python as `python` — the `py` launcher is not installed.

## Read this first

**[RUNBOOK.md](RUNBOOK.md)** — how to start each app, the credentials, the migration status, the
smoke tests, and the gotchas that have actually cost time. It is kept current; start there rather
than inferring behaviour from the code.

Before writing any Next.js code, also read **[web/AGENTS.md](web/AGENTS.md)** — this version has
breaking changes versus common knowledge, and the authoritative docs ship inside
`web/node_modules/next/dist/docs/`.
