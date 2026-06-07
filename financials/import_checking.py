"""Import BofA checking-account CSV statements into the income table.

BofA's checking download is usually one of:
  - "Date,Description,Amount,Running Bal."
  - "Date,Description,Amount"
  - (or with a multi-row preamble of account info before the header)

Positive amount = deposit (income for us). Negative amount = withdrawal
(we skip; that's a payment going out, not income).

Auto-classifies income_type from the description:
  - PAYROLL / DIRECT DEP / SALARY / ADP        -> Salary
  - BONUS                                      -> Bonus
  - REIMBURSE / EXPENSE REPORT                 -> Reimbursement

Auto-assigns a source tag if the description names one (HALO, SNORKEL,
HANDSHAKE, 7 SHOT TENNIS); otherwise tags as "Other".

Skips internal transfers (TFR TO/FROM, ZELLE TO YOUR OWN ACCOUNTS,
TRANSFER FROM SAV/CHK, etc.) — those aren't income.

Dedupes on (date, description, amount, source_account).

Usage:
    py import_checking.py path\\to\\stmt.csv
    py import_checking.py path\\to\\folder\\
    py import_checking.py path\\to\\stmt.csv --account "BofA Checking"
"""
import argparse
import csv
import re
import sys
from datetime import datetime
from pathlib import Path

from db import get_conn, init_db


# Source-detection patterns (description substring -> tag name).
# First match wins.
SOURCE_RULES = [
    ("HALO", "Halo"),
    ("POWERED BY HALO", "Halo"),
    ("SNORKEL", "Snorkel"),
    ("HANDSHAKE", "Handshake"),
    ("7 SHOT", "7 Shot Tennis"),
    ("7SHOT", "7 Shot Tennis"),
    ("SEVEN SHOT", "7 Shot Tennis"),
]

TYPE_RULES = [
    (re.compile(r"\b(PAYROLL|DIRECT DEP|SALARY|ADP|GUSTO)\b", re.I), "Salary"),
    (re.compile(r"\bBONUS\b", re.I), "Bonus"),
    (re.compile(r"\bREIMBURS", re.I), "Reimbursement"),
    (re.compile(r"\b(EXPENSE REPORT|EXP REPORT)\b", re.I), "Reimbursement"),
]

# Description patterns to SKIP entirely (transfers in/out of own accounts).
SKIP_PATTERNS = [
    re.compile(r"\bTFR\b", re.I),
    re.compile(r"\bTRANSFER (FROM|TO) (SAV|CHK|CHECKING|SAVINGS)\b", re.I),
    re.compile(r"\bONLINE TRANSFER\b", re.I),
    re.compile(r"\bZELLE TRANSFER\b", re.I),
    re.compile(r"\bATM DEPOSIT\b", re.I),  # ambiguous — could be either; user can re-add manually
]


def classify_type(desc: str) -> str | None:
    for pat, t in TYPE_RULES:
        if pat.search(desc):
            return t
    return None


def classify_source(desc: str) -> str:
    upper = desc.upper()
    for pat, tag in SOURCE_RULES:
        if pat in upper:
            return tag
    return "Other"


def should_skip(desc: str) -> bool:
    return any(p.search(desc) for p in SKIP_PATTERNS)


def parse_date(s: str) -> str:
    return datetime.strptime(s.strip(), "%m/%d/%Y").date().isoformat()


def find_header_row(reader):
    """BofA checking CSVs often have a preamble; find the actual header row."""
    for row in reader:
        cleaned = [c.strip().lower() for c in row]
        if "date" in cleaned and "amount" in cleaned and "description" in cleaned:
            return row
    return None


def import_file(path: Path, conn, tag_ids: dict, account: str):
    with open(path, newline="", encoding="utf-8-sig") as f:
        reader = csv.reader(f)
        header = find_header_row(reader)
        if not header:
            print(f"  [skip] {path.name}: no Date/Description/Amount header found")
            return 0, 0, 0, 0

        idx = {c.strip().lower(): i for i, c in enumerate(header)}
        date_i = idx["date"]
        desc_i = idx["description"]
        amt_i = idx["amount"]

        inserted, skipped_withdraw, skipped_transfer, skipped_dup = 0, 0, 0, 0
        for row in reader:
            if not row or len(row) <= max(date_i, desc_i, amt_i):
                continue
            try:
                date_s = row[date_i]
                desc = row[desc_i].strip().strip('"')
                amt_s = row[amt_i].replace(",", "").replace("$", "")
                if not date_s or not amt_s:
                    continue
                iso = parse_date(date_s)
                amount = float(amt_s)
            except (ValueError, IndexError):
                continue

            if amount <= 0:
                skipped_withdraw += 1
                continue
            if should_skip(desc):
                skipped_transfer += 1
                continue

            existing = conn.execute(
                """SELECT id FROM income
                   WHERE date=? AND description=? AND amount=? AND source_account=?""",
                (iso, desc, amount, account),
            ).fetchone()
            if existing:
                skipped_dup += 1
                continue

            income_type = classify_type(desc)
            source_tag = classify_source(desc)
            tag_id = tag_ids.get(source_tag, tag_ids["Other"])

            conn.execute(
                """INSERT INTO income (date, description, amount, client, tag_id,
                                       income_type, source_account, source_file)
                   VALUES (?, ?, ?, ?, ?, ?, ?, ?)""",
                (iso, desc, amount, None, tag_id, income_type, account, f"csv:{path.name}"),
            )
            inserted += 1
        return inserted, skipped_withdraw, skipped_transfer, skipped_dup


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("path", help="CSV file or directory of BofA checking CSVs")
    ap.add_argument("--account", default="BofA Checking",
                    help='Label stored in source_account (default "BofA Checking")')
    args = ap.parse_args()

    init_db()
    conn = get_conn()
    tag_ids = {r["name"]: r["id"] for r in conn.execute("SELECT id, name FROM tags")}
    for required in ("Other", "Halo", "Snorkel", "Handshake", "7 Shot Tennis"):
        if required not in tag_ids:
            print(f"Missing tag: {required}. Run db.py first.", file=sys.stderr)
            sys.exit(1)

    p = Path(args.path)
    files = sorted(p.glob("*.csv")) if p.is_dir() else [p]

    totals = [0, 0, 0, 0]
    for f in files:
        ins, sw, st, sd = import_file(f, conn, tag_ids, args.account)
        print(f"  {f.name}: +{ins} income, {sw} withdrawals skipped, "
              f"{st} transfers skipped, {sd} dupes")
        for i, v in enumerate((ins, sw, st, sd)):
            totals[i] += v

    conn.commit()
    conn.close()
    print(f"\nTotal: +{totals[0]} income, {totals[1]} withdrawals skipped, "
          f"{totals[2]} transfers skipped, {totals[3]} dupes")


if __name__ == "__main__":
    main()
