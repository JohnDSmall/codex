"""Load companies and projects from legacy AWS Lambda JSON dumps into Supabase.

Usage:
    python load_companies_projects.py [--dry-run]

Env: SUPABASE_URL, SUPABASE_SERVICE_KEY
"""
from __future__ import annotations

import argparse
import json
import os
import sys
from typing import Any

import requests

COMPANIES_PATH = r"C:\Users\johna\code\codex\contacts\old_companies.json"
PROJECTS_PATH = r"C:\Users\johna\code\codex\contacts\old_projects.json"


def _request(method: str, path: str, url: str, key: str, **kw) -> requests.Response:
    headers = kw.pop("headers", {})
    headers = {
        "apikey": key,
        "Authorization": f"Bearer {key}",
        "Content-Type": "application/json",
        **headers,
    }
    return requests.request(method, f"{url.rstrip('/')}{path}", headers=headers, timeout=60, **kw)


def upsert(table: str, rows: list[dict], on_conflict: str, url: str, key: str) -> None:
    if not rows:
        return
    headers = {"Prefer": "resolution=merge-duplicates,return=minimal"}
    r = _request("POST", f"/rest/v1/{table}?on_conflict={on_conflict}", url, key, json=rows, headers=headers)
    if not r.ok:
        raise RuntimeError(f"{table} upsert failed {r.status_code}: {r.text[:500]}")


def load_companies(url: str, key: str, dry: bool) -> None:
    with open(COMPANIES_PATH, encoding="utf-8-sig") as f:
        data = json.load(f)
    body = data["body"]
    if isinstance(body, str):
        body = json.loads(body)
    companies = body["companies"]

    rows: list[dict] = []
    for c in companies:
        cid = (c.get("company_id") or "").strip()
        if not cid:
            continue
        rows.append({
            "company_id": cid,
            "display_name": (c.get("display_name") or "").strip() or None,
            "sector": (c.get("sector") or "").strip() or None,
            "sub_sector": (c.get("sub_sector") or "").strip() or None,
            "logo_path": (c.get("logo_path") or "").strip() or None,
        })
    print(f"Companies: {len(rows)} rows")

    if dry:
        print(json.dumps(rows[:3], indent=2))
        return

    for i in range(0, len(rows), 100):
        upsert("companies", rows[i:i + 100], "company_id", url, key)
    print(f"Companies: uploaded {len(rows)}")


def _coerce_int(v: Any) -> int:
    try:
        return int(float(v or 0))
    except (TypeError, ValueError):
        return 0


def _coerce_num(v: Any) -> float:
    try:
        return float(v or 0)
    except (TypeError, ValueError):
        return 0.0


def _status_value(s: Any) -> str:
    if not s:
        return "active"
    s = str(s).lower().strip().replace(" ", "_")
    if s in ("active", "inactive", "completed", "abandoned", "on_hold"):
        return s
    return "active"


def load_projects(url: str, key: str, dry: bool) -> None:
    with open(PROJECTS_PATH, encoding="utf-8-sig") as f:
        data = json.load(f)
    projects = data["body"]["projects"]

    rows: list[dict] = []
    for p in projects:
        rows.append({
            "legacy_id": str(p.get("project_id")) if p.get("project_id") is not None else None,
            "name": (p.get("name") or "").strip() or "(unnamed)",
            "client": (p.get("client") or "").strip() or None,
            "description": p.get("description") or None,
            "status": _status_value(p.get("status")),
            "priority": (p.get("priority") or "medium"),
            "start_date": p.get("start_date") or None,
            "due_date": p.get("due_date") or None,
            "estimated_hours": _coerce_num(p.get("estimated_hours")),
            "hours_spent": _coerce_num(p.get("hours_spent")),
            "hours_remaining": _coerce_num(p.get("hours_remaining")),
            "total_actions": _coerce_int(p.get("total_actions")),
            "completed_actions": _coerce_int(p.get("completed_actions")),
            "revenue": _coerce_num(p.get("revenue")),
            "projected_revenue": _coerce_num(p.get("projected_revenue")),
            "cost": _coerce_num(p.get("cost")),
            "costs": p.get("costs") or [],
            "revenues": p.get("revenues") or [],
            "contacts": p.get("contacts") or [],
            "tags": p.get("tags") or [],
        })
    print(f"Projects: {len(rows)} rows")

    if dry:
        print(json.dumps(rows[:2], indent=2, default=str))
        return

    rows_with_lid = [r for r in rows if r["legacy_id"]]
    rows_without_lid = [r for r in rows if not r["legacy_id"]]
    for chunk in (rows_with_lid, rows_without_lid):
        if not chunk:
            continue
        if chunk is rows_with_lid:
            upsert("projects", chunk, "legacy_id", url, key)
        else:
            # No legacy_id → plain insert.
            r = _request(
                "POST", "/rest/v1/projects", url, key,
                json=chunk,
                headers={"Prefer": "return=minimal"},
            )
            r.raise_for_status()
    print(f"Projects: uploaded {len(rows)}")


def main() -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument("--dry-run", action="store_true")
    args = ap.parse_args()

    url = os.environ.get("SUPABASE_URL")
    key = os.environ.get("SUPABASE_SERVICE_KEY")
    if not args.dry_run and (not url or not key):
        print("ERROR: set SUPABASE_URL and SUPABASE_SERVICE_KEY (or use --dry-run).", file=sys.stderr)
        return 2

    load_companies(url, key, args.dry_run)
    load_projects(url, key, args.dry_run)
    return 0


if __name__ == "__main__":
    sys.exit(main())
