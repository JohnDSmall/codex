"""Load wealth items from legacy DynamoDB export into Supabase.

Usage: python load_wealth.py
Env: SUPABASE_URL, SUPABASE_SERVICE_KEY
"""
from __future__ import annotations

import json
import os
import re
import sys
from datetime import datetime
from typing import Any

import requests

PATH = r"C:\Users\johna\code\codex\contacts\old_wealth.json"


def parse_date(d: Any) -> str | None:
    if not d:
        return None
    s = str(d).strip()
    # Try a few formats
    for fmt in ("%Y-%m-%d", "%m/%d/%Y", "%Y-%m-%dT%H:%M:%S.%f", "%Y-%m-%dT%H:%M:%S"):
        try:
            return datetime.strptime(s.split("+")[0].split("Z")[0], fmt).date().isoformat()
        except ValueError:
            continue
    # ISO-ish with extra precision
    try:
        return datetime.fromisoformat(s.replace("Z", "+00:00")).date().isoformat()
    except ValueError:
        return None


def infer_type(item: dict) -> str:
    al = (item.get("asset_liability") or "").lower()
    if al.startswith("l"):
        return "liability"
    if al.startswith("t"):
        return "target_asset"
    return "asset"


def coerce_num(v: Any) -> float:
    try:
        return float(v or 0)
    except (TypeError, ValueError):
        return 0.0


def to_row(item: dict) -> dict:
    eoy = {
        m.group(1): coerce_num(v)
        for k, v in item.items()
        if (m := re.fullmatch(r"eoyValue_(\d{4})", k))
    }
    return {
        "legacy_id": item.get("asset_liability") or None,
        "name": (item.get("name") or "(unnamed)").strip(),
        "type": infer_type(item),
        "category": (item.get("category") or "other").strip() or "other",
        "source": (item.get("source") or "").strip() or None,
        "current_value": coerce_num(item.get("currentValue")),
        "original_value": coerce_num(item.get("originalValue")),
        "eoy_values": eoy,
        "date_added": parse_date(item.get("dateAdded")),
        "date_updated": parse_date(item.get("dateUpdated")),
    }


def main() -> int:
    url = os.environ.get("SUPABASE_URL")
    key = os.environ.get("SUPABASE_SERVICE_KEY")
    if not url or not key:
        print("ERROR: set SUPABASE_URL and SUPABASE_SERVICE_KEY", file=sys.stderr)
        return 2

    with open(PATH, encoding="utf-8-sig") as f:
        items = json.load(f)
    rows = [to_row(i) for i in items]
    print(f"Wealth: {len(rows)} rows")

    headers = {
        "apikey": key,
        "Authorization": f"Bearer {key}",
        "Content-Type": "application/json",
        "Prefer": "resolution=merge-duplicates,return=minimal",
    }
    r = requests.post(
        f"{url.rstrip('/')}/rest/v1/wealth_items?on_conflict=legacy_id",
        headers=headers,
        json=rows,
        timeout=60,
    )
    if not r.ok:
        print(f"Upload failed {r.status_code}: {r.text[:500]}", file=sys.stderr)
        return 1
    print("Uploaded.")
    return 0


if __name__ == "__main__":
    sys.exit(main())
