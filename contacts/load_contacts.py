"""Parse an iCloud vCard export and upsert into the Supabase `contacts` table.

Usage:
    python load_contacts.py path/to/contacts.vcf

Env vars required:
    SUPABASE_URL          e.g. https://qwkdjxzgqrnbzrohaekg.supabase.co
    SUPABASE_SERVICE_KEY  service-role JWT
"""
from __future__ import annotations

import argparse
import json
import os
import sys
from datetime import date
from typing import Any

import requests
import vobject
from dateutil import parser as dateparser

BATCH_SIZE = 100

# Canonical column set — every row sent to PostgREST must have all of these keys
# (PostgREST PGRST102 requires uniform shape across a batch).
COLUMNS = [
    "uid", "full_name", "first_name", "last_name", "middle_name", "prefix", "suffix",
    "nickname", "organization", "job_title", "department",
    "phones", "emails", "addresses", "urls", "social", "related",
    "birthday", "anniversary", "notes", "categories", "raw_vcard",
]


def _normalize(row: dict) -> dict:
    out = {k: row.get(k) for k in COLUMNS}
    for k in ("phones", "emails", "addresses", "urls", "social", "related"):
        if out[k] is None:
            out[k] = []
    if out["categories"] is None:
        out["categories"] = []
    return out


def _val(prop) -> str | None:
    if prop is None:
        return None
    v = getattr(prop, "value", prop)
    if v is None:
        return None
    s = str(v).strip()
    return s or None


def _label(prop) -> str:
    # vCard TYPE param: HOME, WORK, CELL, IPHONE, etc.
    params = getattr(prop, "params", {}) or {}
    types = params.get("TYPE") or params.get("type") or []
    if isinstance(types, str):
        types = [types]
    types = [t for t in types if t and t.lower() != "pref"]
    return ",".join(types).lower() if types else "other"


def _parse_date(s: str | None) -> str | None:
    if not s:
        return None
    try:
        # vCard may use YYYYMMDD, YYYY-MM-DD, or --MMDD (no year)
        s = s.strip()
        if s.startswith("--") and len(s) == 6:
            # Year-less date: store with sentinel year 1900
            return f"1900-{s[2:4]}-{s[4:6]}"
        return dateparser.parse(s).date().isoformat()
    except Exception:
        return None


def _addr_components(addr) -> dict:
    # vCard ADR: PO Box; Extended; Street; Locality; Region; Postal; Country
    parts = (addr.value if hasattr(addr, "value") else addr)
    return {
        "po_box": _val(parts.box),
        "extended": _val(parts.extended),
        "street": _val(parts.street),
        "city": _val(parts.city),
        "region": _val(parts.region),
        "postal": _val(parts.code),
        "country": _val(parts.country),
    }


def vcard_to_row(card) -> dict[str, Any]:
    row: dict[str, Any] = {
        "uid": _val(card.contents.get("uid", [None])[0]),
        "full_name": _val(card.contents.get("fn", [None])[0]),
        "phones": [],
        "emails": [],
        "addresses": [],
        "urls": [],
        "social": [],
        "related": [],
        "categories": [],
    }

    n = card.contents.get("n", [None])[0]
    if n is not None:
        nv = n.value
        row["last_name"] = _val(nv.family)
        row["first_name"] = _val(nv.given)
        row["middle_name"] = _val(nv.additional)
        row["prefix"] = _val(nv.prefix)
        row["suffix"] = _val(nv.suffix)

    row["nickname"] = _val(card.contents.get("nickname", [None])[0])
    row["organization"] = None
    org = card.contents.get("org", [None])[0]
    if org is not None:
        ov = org.value if hasattr(org, "value") else None
        if isinstance(ov, list):
            row["organization"] = ov[0] if ov else None
            row["department"] = ov[1] if len(ov) > 1 else None
        else:
            row["organization"] = _val(org)
    row["job_title"] = _val(card.contents.get("title", [None])[0])

    for tel in card.contents.get("tel", []):
        v = _val(tel)
        if v:
            row["phones"].append({"label": _label(tel), "value": v})
    for email in card.contents.get("email", []):
        v = _val(email)
        if v:
            row["emails"].append({"label": _label(email), "value": v})
    for url in card.contents.get("url", []):
        v = _val(url)
        if v:
            row["urls"].append({"label": _label(url), "value": v})
    for adr in card.contents.get("adr", []):
        comp = _addr_components(adr)
        if any(comp.values()):
            comp["label"] = _label(adr)
            row["addresses"].append(comp)
    for impp in card.contents.get("impp", []):
        v = _val(impp)
        if v:
            row["social"].append({"service": _label(impp), "value": v})
    for rel in card.contents.get("related", []):
        v = _val(rel)
        if v:
            row["related"].append({"label": _label(rel), "value": v})

    bday = card.contents.get("bday", [None])[0]
    row["birthday"] = _parse_date(_val(bday))
    anniv = card.contents.get("anniversary", [None])[0]
    row["anniversary"] = _parse_date(_val(anniv))

    notes = card.contents.get("note", [])
    if notes:
        row["notes"] = "\n\n".join(filter(None, (_val(n) for n in notes)))

    cats = card.contents.get("categories", [])
    for c in cats:
        v = c.value if hasattr(c, "value") else c
        if isinstance(v, list):
            row["categories"].extend([s.strip() for s in v if s and s.strip()])
        elif v:
            row["categories"].append(str(v).strip())

    # Preserve the original serialized vCard for re-parsing later.
    row["raw_vcard"] = card.serialize()

    return _normalize(row)


def upsert_batch(rows: list[dict], url: str, key: str) -> None:
    endpoint = f"{url.rstrip('/')}/rest/v1/contacts"
    headers = {
        "apikey": key,
        "Authorization": f"Bearer {key}",
        "Content-Type": "application/json",
        "Prefer": "resolution=merge-duplicates,return=minimal",
    }
    # Upsert on uid (must be unique). Rows without uid get inserted as new.
    with_uid = [r for r in rows if r.get("uid")]
    without_uid = [r for r in rows if not r.get("uid")]

    if with_uid:
        r = requests.post(f"{endpoint}?on_conflict=uid", headers=headers, json=with_uid, timeout=60)
        if not r.ok:
            print(f"  ! POST (with_uid) {r.status_code}: {r.text[:1000]}", file=sys.stderr)
            print(f"  ! first row keys: {sorted(with_uid[0].keys())}", file=sys.stderr)
            r.raise_for_status()
    if without_uid:
        headers2 = {**headers, "Prefer": "return=minimal"}
        r = requests.post(endpoint, headers=headers2, json=without_uid, timeout=60)
        if not r.ok:
            print(f"  ! POST (no_uid) {r.status_code}: {r.text[:1000]}", file=sys.stderr)
            r.raise_for_status()


def main() -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument("vcf_path")
    ap.add_argument("--dry-run", action="store_true", help="Parse only, do not upload.")
    args = ap.parse_args()

    url = os.environ.get("SUPABASE_URL")
    key = os.environ.get("SUPABASE_SERVICE_KEY")
    if not args.dry_run and (not url or not key):
        print("ERROR: set SUPABASE_URL and SUPABASE_SERVICE_KEY env vars (or use --dry-run).", file=sys.stderr)
        return 2

    with open(args.vcf_path, encoding="utf-8") as f:
        text = f.read()

    rows: list[dict] = []
    skipped = 0
    for card in vobject.readComponents(text):
        try:
            rows.append(vcard_to_row(card))
        except Exception as e:
            skipped += 1
            fn = None
            try:
                fn = _val(card.contents.get("fn", [None])[0])
            except Exception:
                pass
            print(f"  ! skipped (fn={fn!r}): {e}", file=sys.stderr)

    print(f"Parsed {len(rows)} contacts ({skipped} skipped).")
    if args.dry_run:
        print(json.dumps(rows[:3], indent=2, default=str))
        return 0

    for i in range(0, len(rows), BATCH_SIZE):
        chunk = rows[i:i + BATCH_SIZE]
        upsert_batch(chunk, url, key)
        print(f"  uploaded {i + len(chunk)}/{len(rows)}")

    print("Done.")
    return 0


if __name__ == "__main__":
    sys.exit(main())
