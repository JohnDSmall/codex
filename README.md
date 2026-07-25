# codex

Personal life organization apps.

## Projects

- **[web/](web/)** — the Codex app itself. Next.js + Supabase. Relationships, projects, wealth, and **Ephemeris** (financial management) under one sidebar.
- **[ephemeris/](ephemeris/)** — the original standalone Flask + SQLite financial app, now merged into `web/` at `/ephemeris`. Kept as the data source of record until the Supabase export is run, and still home to the CSV importers.
- **[contacts/](contacts/)** — one-off Python loaders that push legacy contact/company/wealth exports into Supabase.
- **[supabase/](supabase/)** — SQL migrations defining the remote schema.

## Running a project

Each subdirectory is a self-contained app — see its own README for setup. The pattern is:

```powershell
cd <project>
python -m venv .venv
.\.venv\Scripts\python.exe -m pip install -r requirements.txt
```

See [RUNBOOK.md](RUNBOOK.md) for operational detail and known gotchas.
