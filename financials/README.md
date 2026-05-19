# financials

Personal web app to track assets, income, expenses, and freelance hours — all bucketed by life-area tag.

## Tags
- **General Life** — non-business everyday expenses
- **Freelance Consulting** — generic freelance work (7 Shot Tennis, Backcountry Academics, etc.)
- **Halo** — Powered By Halo work
- **Snorkel**
- **HAI**

## First-time setup

```powershell
cd "C:\Users\johna\OneDrive\Documents\IC\financials"
py -m venv .venv
.\.venv\Scripts\Activate.ps1
pip install -r requirements.txt
python seed.py     # creates financials.db and imports freelance spreadsheet rows
python app.py      # serves http://127.0.0.1:5000
```

`seed.py` is idempotent — it skips rows already present, so re-running is safe.

## What's inside

- `app.py` — Flask routes and dashboard logic
- `db.py` — SQLite schema, default tags, default categories
- `seed.py` — hard-coded freelance spreadsheet rows (expenses, income, hours)
- `templates/` — Jinja templates
- `static/style.css`

## Data model

- `tags` — the five life-area buckets
- `categories` — COGS / F&O / S&M / T&E / R&D / L&A subcategories (from the spreadsheet) plus Personal-* categories
- `expenses` — date, description, amount, category, **tag**, client, tax_status, notes
- `income` — date, description, amount, client, **tag**
- `assets` — name, type, value, as_of_date, **tag**
- `hours` — date, hours, rate, status, client, project, description, **tag**

Every transactional row has a tag, so the dashboard can roll up by life-area.
