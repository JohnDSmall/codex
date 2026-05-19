# codex

Personal life organization apps.

## Projects

- **[financials/](financials/)** — Flask web app to track assets, income, expenses, and freelance hours. Every transaction is tagged by life-area (General Life, Freelance Consulting, Halo, Snorkel, HAI) for rolled-up dashboards. SQLite backed; seeded from an existing freelance spreadsheet.

## Running a project

Each subdirectory is a self-contained app — see its own README for setup. The pattern is:

```powershell
cd <project>
py -m venv .venv
.\.venv\Scripts\Activate.ps1
pip install -r requirements.txt
```
