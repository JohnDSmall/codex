"""Merge curated relationship data from the legacy AWS Lambda export into Supabase contacts.

For each old relationship, find a matching contact by normalized full_name and
update its curation fields (strength, dates, notes, reminders, tags, etc.).
If no match, insert a new contact row with just the relationship overlay.

Usage:
    python merge_old_relationships.py [path_to_json] [--dry-run]

Env:
    SUPABASE_URL, SUPABASE_SERVICE_KEY
"""
from __future__ import annotations

import argparse
import json
import os
import re
import sys
from collections import defaultdict
from typing import Any, Optional

import requests

DEFAULT_JSON = r"C:\Users\johna\code\codex\contacts\old_relationships.json"


def normalize_name(s: str) -> str:
    if not s:
        return ""
    s = s.lower().strip()
    s = re.sub(r"^[^a-z]+", "", s)  # strip leading punctuation like "? "
    s = re.sub(r"[^a-z\s'-]", " ", s)
    s = re.sub(r"\s+", " ", s).strip()
    return s


def map_strength(raw: Optional[str]) -> str:
    if not raw:
        return "none"
    v = raw.lower().strip()
    if v in ("strong", "medium", "weak", "loose", "none"):
        return v
    return "none"


def map_priority(raw: Optional[str]) -> str:
    if not raw:
        return "low"
    v = raw.lower().strip()
    if v in ("high", "medium", "low"):
        return v
    return "low"


def map_frequency(raw: Optional[str]) -> Optional[str]:
    if not raw:
        return None
    v = raw.lower().strip()
    if v in ("weekly", "monthly", "quarterly", "biannually", "yearly"):
        return v
    return None


def map_follow_up(raw: Any) -> bool:
    if isinstance(raw, bool):
        return raw
    if isinstance(raw, str):
        return raw.upper() == "Y"
    return False


def relationship_to_row(rel: dict) -> dict:
    notes = rel.get("notes") or []
    timeline_notes = []
    for n in notes:
        date = n.get("note_date") or n.get("date")
        content = n.get("note") or n.get("content")
        if content:
            timeline_notes.append({"date": date or "1970-01-01", "content": content})

    contact_info = rel.get("contact") or {}
    linkedin = contact_info.get("linkedin")
    if linkedin == "placeholder":
        linkedin = None

    return {
        "full_name": (rel.get("full_name") or "").strip() or None,
        "primary_company": rel.get("current_organization") or None,
        "company_tags": rel.get("company_tags") or [],
        "connection_tags": rel.get("connection_tags") or [],
        "interest_tags": rel.get("interest_tags") or [],
        "university_tags": rel.get("university_tags") or [],
        "connection_source": rel.get("connection_source") or None,
        "looking_for": (rel.get("looking_for") or "").strip() or None,
        "strength_tier": map_strength(rel.get("strength")),
        "priority": map_priority(rel.get("priority")),
        "follow_up_fl": map_follow_up(rel.get("follow_up_fl")),
        "target_contact_date": rel.get("target_contact_date") or None,
        "last_contact_date": rel.get("last_connection_date") or None,
        "contact_frequency": map_frequency(rel.get("target_contact_frequency")),
        "timeline_notes": timeline_notes,
        "reminders": rel.get("reminders") or [],
        "tracked": True,  # Anything in the old curated list counts as tracked.
        "linkedin": linkedin,
        "added_date": rel.get("add_date") or None,
        "legacy_user_id": rel.get("user_id") or None,
    }


def supabase_request(method: str, path: str, url: str, key: str, **kw) -> requests.Response:
    headers = kw.pop("headers", {})
    headers = {
        "apikey": key,
        "Authorization": f"Bearer {key}",
        "Content-Type": "application/json",
        **headers,
    }
    return requests.request(method, f"{url.rstrip('/')}{path}", headers=headers, timeout=60, **kw)


def fetch_existing_contacts(url: str, key: str) -> list[dict]:
    """Return all existing contacts (id, full_name, first_name, last_name) for matching."""
    rows: list[dict] = []
    page_size = 1000
    offset = 0
    while True:
        r = supabase_request(
            "GET",
            f"/rest/v1/contacts?select=id,full_name,first_name,last_name&limit={page_size}&offset={offset}",
            url, key,
        )
        r.raise_for_status()
        chunk = r.json()
        rows.extend(chunk)
        if len(chunk) < page_size:
            break
        offset += page_size
    return rows


def build_match_index(contacts: list[dict]) -> dict[str, str]:
    """Map normalized name → contact id. Last writer wins on collisions."""
    idx: dict[str, str] = {}
    for c in contacts:
        candidates = []
        if c.get("full_name"):
            candidates.append(c["full_name"])
        fn, ln = c.get("first_name"), c.get("last_name")
        if fn or ln:
            candidates.append(" ".join(filter(None, [fn, ln])))
        for cand in candidates:
            key = normalize_name(cand)
            if key:
                idx[key] = c["id"]
    return idx


def update_contact(contact_id: str, payload: dict, url: str, key: str) -> None:
    # Don't push full_name on update — preserve the iCloud name unless it's empty.
    body = {k: v for k, v in payload.items() if k != "full_name"}
    r = supabase_request(
        "PATCH",
        f"/rest/v1/contacts?id=eq.{contact_id}",
        url, key,
        json=body,
        headers={"Prefer": "return=minimal"},
    )
    if not r.ok:
        raise RuntimeError(f"Update {contact_id} failed {r.status_code}: {r.text[:300]}")


def insert_contact(payload: dict, url: str, key: str) -> None:
    r = supabase_request(
        "POST",
        "/rest/v1/contacts",
        url, key,
        json=[payload],
        headers={"Prefer": "return=minimal"},
    )
    if not r.ok:
        raise RuntimeError(f"Insert failed {r.status_code}: {r.text[:300]}")


def main() -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument("json_path", nargs="?", default=DEFAULT_JSON)
    ap.add_argument("--dry-run", action="store_true")
    args = ap.parse_args()

    url = os.environ.get("SUPABASE_URL")
    key = os.environ.get("SUPABASE_SERVICE_KEY")
    if not args.dry_run and (not url or not key):
        print("ERROR: set SUPABASE_URL and SUPABASE_SERVICE_KEY (or use --dry-run).", file=sys.stderr)
        return 2

    with open(args.json_path, encoding="utf-8-sig") as f:
        data = json.load(f)
    rels = data["body"]["relationships"]
    print(f"Loaded {len(rels)} legacy relationships.")

    if args.dry_run:
        # Show how mapping looks for first few
        for r in rels[:5]:
            row = relationship_to_row(r)
            print(json.dumps(row, indent=2, default=str)[:500], "\n---")
        return 0

    existing = fetch_existing_contacts(url, key)
    print(f"Loaded {len(existing)} existing contacts from Supabase.")
    idx = build_match_index(existing)

    matched = 0
    inserted = 0
    skipped = 0
    name_collisions = defaultdict(int)

    for rel in rels:
        row = relationship_to_row(rel)
        name = row["full_name"]
        if not name:
            skipped += 1
            print(f"  ! skip (no name): {rel.get('user_id')}", file=sys.stderr)
            continue
        key_norm = normalize_name(name)
        contact_id = idx.get(key_norm)
        if contact_id:
            update_contact(contact_id, row, url, key)
            matched += 1
            name_collisions[key_norm] += 1
        else:
            insert_contact(row, url, key)
            inserted += 1
        if (matched + inserted) % 50 == 0:
            print(f"  progress: {matched} matched, {inserted} inserted")

    print()
    print(f"Done. matched={matched}, inserted={inserted}, skipped={skipped}")
    dupe_writes = sum(c - 1 for c in name_collisions.values() if c > 1)
    if dupe_writes:
        print(f"  (note: {dupe_writes} updates were second writes to the same contact id — duplicate names in legacy data)")
    return 0


if __name__ == "__main__":
    sys.exit(main())
