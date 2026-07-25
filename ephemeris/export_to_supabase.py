"""One-off export: local SQLite (ephemeris.db) -> Supabase (eph_* tables).

Lives here rather than in contacts/ because it reads the local SQLite file as
its source; contacts/ holds loaders for the legacy AWS/iCloud exports.

Usage:
    python export_to_supabase.py [--dry-run] [--db PATH]

Env:
    SUPABASE_URL, SUPABASE_SERVICE_KEY

Idempotent: every row carries `legacy_id` (the old SQLite integer PK) and is
upserted on that column, so re-running syncs rather than duplicates. Tags and
categories are upserted on `name`, which is UNIQUE in both schemas.

Run the migration first:
    supabase/migrations/20260725120000_ephemeris_financials.sql
"""
from __future__ import annotations

import argparse
import json
import os
import sqlite3
import sys
import urllib.error
import urllib.request
from pathlib import Path

DEFAULT_DB = Path(__file__).parent / "ephemeris.db"


def env(name: str) -> str:
    v = os.environ.get(name)
    if not v:
        sys.exit(f"error: {name} is not set. Export SUPABASE_URL and SUPABASE_SERVICE_KEY first.")
    return v.rstrip("/") if name == "SUPABASE_URL" else v


def rest(url: str, key: str, table: str, rows: list[dict], on_conflict: str) -> list[dict]:
    """Upsert rows and return the stored representation (so we can map ids)."""
    if not rows:
        return []
    endpoint = f"{url}/rest/v1/{table}?on_conflict={on_conflict}"
    req = urllib.request.Request(
        endpoint,
        data=json.dumps(rows).encode(),
        method="POST",
        headers={
            "apikey": key,
            "Authorization": f"Bearer {key}",
            "Content-Type": "application/json",
            "Prefer": "resolution=merge-duplicates,return=representation",
        },
    )
    try:
        with urllib.request.urlopen(req) as resp:
            return json.loads(resp.read() or "[]")
    except urllib.error.HTTPError as e:
        body = e.read().decode(errors="replace")
        sys.exit(f"error: {table} upsert failed ({e.code}): {body}")


def chunked(rows: list[dict], n: int = 500):
    for i in range(0, len(rows), n):
        yield rows[i : i + n]


def push(url: str, key: str, table: str, rows: list[dict], on_conflict: str, dry: bool) -> list[dict]:
    if dry:
        print(f"  {table}: would upsert {len(rows)}")
        return []
    out: list[dict] = []
    for batch in chunked(rows):
        out.extend(rest(url, key, table, batch, on_conflict))
    print(f"  {table}: upserted {len(rows)}")
    return out


def main() -> None:
    ap = argparse.ArgumentParser()
    ap.add_argument("--dry-run", action="store_true", help="print counts, write nothing")
    ap.add_argument("--db", default=str(DEFAULT_DB), help=f"SQLite path (default: {DEFAULT_DB.name})")
    args = ap.parse_args()

    db_path = Path(args.db)
    if not db_path.exists():
        sys.exit(f"error: {db_path} not found. Run seed.py first.")

    url = env("SUPABASE_URL") if not args.dry_run else os.environ.get("SUPABASE_URL", "")
    key = env("SUPABASE_SERVICE_KEY") if not args.dry_run else os.environ.get("SUPABASE_SERVICE_KEY", "")

    conn = sqlite3.connect(db_path)
    conn.row_factory = sqlite3.Row

    def rows(sql: str) -> list[sqlite3.Row]:
        return conn.execute(sql).fetchall()

    print(f"Reading {db_path.name}")

    # --- reference tables first, so we can map legacy int ids -> uuids -------
    tags = [{"legacy_id": r["id"], "name": r["name"]} for r in rows("SELECT id, name FROM tags")]
    cats = [
        {"legacy_id": r["id"], "parent": r["parent"], "name": r["name"]}
        for r in rows("SELECT id, parent, name FROM categories")
    ]

    stored_tags = push(url, key, "eph_tags", tags, "name", args.dry_run)
    stored_cats = push(url, key, "eph_categories", cats, "name", args.dry_run)

    tag_uuid = {t["legacy_id"]: t["id"] for t in stored_tags if t.get("legacy_id") is not None}
    cat_uuid = {c["legacy_id"]: c["id"] for c in stored_cats if c.get("legacy_id") is not None}

    def tref(v):
        return tag_uuid.get(v) if v is not None else None

    def cref(v):
        return cat_uuid.get(v) if v is not None else None

    # --- transactional tables ------------------------------------------------
    expenses = [
        {
            "legacy_id": r["id"],
            "date": r["date"],
            "description": r["description"],
            "amount": r["amount"],
            "category_id": cref(r["category_id"]),
            "tag_id": tref(r["tag_id"]),
            "client": r["client"],
            "tax_status": r["tax_status"],
            "notes": r["notes"],
            "card": r["card"],
            "merchant": r["merchant"],
            "source": r["source"],
        }
        for r in rows("SELECT * FROM expenses")
    ]

    income = [
        {
            "legacy_id": r["id"],
            "date": r["date"],
            "description": r["description"],
            "amount": r["amount"],
            "client": r["client"],
            "tag_id": tref(r["tag_id"]),
            "notes": r["notes"],
            "income_type": r["income_type"] if "income_type" in r.keys() else None,
            "source_account": r["source_account"] if "source_account" in r.keys() else None,
            "source_file": r["source_file"] if "source_file" in r.keys() else None,
        }
        for r in rows("SELECT * FROM income")
    ]

    assets = [
        {
            "legacy_id": r["id"],
            "name": r["name"],
            "asset_type": r["asset_type"],
            "value": r["value"],
            "as_of_date": r["as_of_date"],
            "tag_id": tref(r["tag_id"]),
            "notes": r["notes"],
        }
        for r in rows("SELECT * FROM assets")
    ]

    hours = [
        {
            "legacy_id": r["id"],
            "date": r["date"],
            "hours": r["hours"],
            "rate": r["rate"],
            "pay_status": r["pay_status"],
            "client": r["client"],
            "project": r["project"],
            "description": r["description"],
            "tag_id": tref(r["tag_id"]),
        }
        for r in rows("SELECT * FROM hours")
    ]

    subs = [
        {"merchant": r["merchant"], "status": r["status"], "notes": r["notes"]}
        for r in rows("SELECT * FROM merchant_subscriptions")
    ]

    push(url, key, "eph_expenses", expenses, "legacy_id", args.dry_run)
    push(url, key, "eph_income", income, "legacy_id", args.dry_run)
    push(url, key, "eph_assets", assets, "legacy_id", args.dry_run)
    push(url, key, "eph_hours", hours, "legacy_id", args.dry_run)
    push(url, key, "eph_merchant_subscriptions", subs, "merchant", args.dry_run)

    conn.close()

    total = len(expenses) + len(income) + len(assets) + len(hours)
    verb = "Would export" if args.dry_run else "Exported"
    print(
        f"\n{verb} {total} transactional rows "
        f"({len(expenses)} expenses, {len(income)} income, {len(assets)} assets, {len(hours)} hours) "
        f"plus {len(tags)} tags, {len(cats)} categories, {len(subs)} subscription overrides."
    )
    if args.dry_run:
        print("Dry run - nothing was written.")


if __name__ == "__main__":
    main()
