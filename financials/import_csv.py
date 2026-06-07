"""Import credit-card statement CSVs into the expenses table.

Auto-detects card type:
  - "Posted Date,Reference Number,Payee,Address,Amount" -> Amex (charges negative)
  - "Date,Description,Amount"                            -> BofA (charges positive)

Sign normalization: all real charges stored as positive `amount`. Refunds/credits
stored as negative. Payment rows (paying off the card) are skipped — they're not
spending. Dedupe key: (date, description, amount, card).

Default tag: General Life. Override with --tag.

Usage:
    py import_csv.py "C:\\Users\\johna\\Downloads\\Previous Expenses"
    py import_csv.py path\\to\\one.csv --card Amex --tag "General Life"
"""
import argparse
import csv
import re
import sys
from datetime import datetime
from pathlib import Path

from db import get_conn, init_db


AMEX_HEADER = ("Posted Date", "Reference Number", "Payee", "Address", "Amount")
BOFA_HEADER = ("Date", "Description", "Amount")

# Payment-row patterns (skip — these aren't real expenses)
PAYMENT_PATTERNS = [
    re.compile(r"\bMOBILE PAYMENT\b", re.I),
    re.compile(r"\bONLINE PAYMENT FROM\b", re.I),
    re.compile(r"\bPAYMENT - THANK YOU\b", re.I),
    re.compile(r"\bAUTOPAY PAYMENT\b", re.I),
    re.compile(r"^PAYMENT$", re.I),
]


def is_payment(desc: str) -> bool:
    return any(p.search(desc) for p in PAYMENT_PATTERNS)


# Merchant -> category rules. First match wins. Patterns are uppercase substring matches.
# Order matters: put specific rules before generic ones.
CATEGORY_RULES = [
    # Subscriptions / digital
    ("NETFLIX", "Personal - Subscriptions"),
    ("HULU", "Personal - Subscriptions"),
    ("SPOTIFY", "Personal - Subscriptions"),
    ("PEACOCK", "Personal - Subscriptions"),
    ("DISNEY PLUS", "Personal - Subscriptions"),
    ("DISNEYPLUS", "Personal - Subscriptions"),
    ("HBO", "Personal - Subscriptions"),
    ("PRIME VIDEO", "Personal - Subscriptions"),
    ("APPLE.COM/BILL", "Personal - Subscriptions"),
    ("APPLE TV", "Personal - Subscriptions"),
    ("YOUTUBE PREMIUM", "Personal - Subscriptions"),
    ("ICLOUD", "Personal - Subscriptions"),
    ("NYTIMES", "Personal - Subscriptions"),
    ("NEW YORK TIMES", "Personal - Subscriptions"),
    ("LINKEDIN PREMIUM", "F&O - Software & Apps"),
    ("CLAUDE", "F&O - Software & Apps"),
    ("ANTHROPIC", "F&O - Software & Apps"),
    ("CHATGPT", "F&O - Software & Apps"),
    ("CHAT GPT", "F&O - Software & Apps"),
    ("OPENAI", "F&O - Software & Apps"),
    ("CURSOR", "F&O - Software & Apps"),
    ("GPT ZERO", "F&O - Software & Apps"),
    ("GPTZERO", "F&O - Software & Apps"),
    ("ASKGPT", "F&O - Software & Apps"),
    ("ASK GPT", "F&O - Software & Apps"),
    ("GITHUB", "F&O - Software & Apps"),
    ("MODAL.COM", "F&O - Software & Apps"),
    ("EXPERIAN", "F&O - Software & Apps"),
    ("CRUNCHYROLL", "Personal - Subscriptions"),
    ("FIGMA", "F&O - Software & Apps"),
    ("AMAZON WEB", "F&O - Software & Apps"),
    ("AWS", "F&O - Software & Apps"),
    ("GOOGLE CLOUD", "F&O - Software & Apps"),
    ("DROPBOX", "F&O - Software & Apps"),
    ("DOCUSIGN", "F&O - Software & Apps"),
    ("TYPEFORM", "F&O - Software & Apps"),
    ("MOBBIN", "F&O - Software & Apps"),
    ("NOUN PROJECT", "F&O - Software & Apps"),
    ("EXPRESSVPN", "F&O - Software & Apps"),
    ("EXPRESS VPN", "F&O - Software & Apps"),
    ("MCAFEE", "F&O - Software & Apps"),
    ("MACAFEE", "F&O - Software & Apps"),
    ("DRIVEREASY", "F&O - Software & Apps"),
    ("ASK GPT", "F&O - Software & Apps"),
    ("CRUNCHBASE", "F&O - Software & Apps"),
    # Transportation - transit
    ("NYCT PAYGO", "T&E - Transportation"),
    ("MTA ", "T&E - Transportation"),
    ("METRO-NORTH", "T&E - Transportation"),
    ("METRO NORTH", "T&E - Transportation"),
    ("LIRR", "T&E - Transportation"),
    ("CALTRAIN", "T&E - Transportation"),
    ("AMTRAK", "T&E - Transportation"),
    ("BART", "T&E - Transportation"),
    ("PATH ", "T&E - Transportation"),
    # Transportation - rideshare/taxi
    ("UBER", "T&E - Transportation"),
    ("LYFT", "T&E - Transportation"),
    ("CURB", "T&E - Transportation"),
    ("YELLOWCAB", "T&E - Transportation"),
    # Transportation - rental
    ("AVIS", "T&E - Transportation"),
    ("HERTZ", "T&E - Transportation"),
    ("SIXT", "T&E - Transportation"),
    ("BUDGET RENT", "T&E - Transportation"),
    ("ENTERPRISE RENT", "T&E - Transportation"),
    ("ZIPCAR", "T&E - Transportation"),
    ("METROPOLIS", "T&E - Transportation"),  # parking
    # Transportation - flights
    ("DELTA AIR", "T&E - Transportation"),
    ("UNITED AIRLINES", "T&E - Transportation"),
    ("AMERICAN AIRLINES", "T&E - Transportation"),
    ("SOUTHWEST AIR", "T&E - Transportation"),
    ("JETBLUE", "T&E - Transportation"),
    ("ALASKA AIR", "T&E - Transportation"),
    ("SPIRIT AIRLINES", "T&E - Transportation"),
    ("FRONTIER AIR", "T&E - Transportation"),
    ("IN FLIGHT WIFI", "T&E - Transportation"),
    ("ETOLL", "T&E - Transportation"),
    # Transportation - gas
    ("SHELL", "T&E - Transportation"),
    ("EXXON", "T&E - Transportation"),
    ("MOBIL ", "T&E - Transportation"),
    ("CHEVRON", "T&E - Transportation"),
    ("SUNOCO", "T&E - Transportation"),
    ("SHEETZ", "T&E - Transportation"),
    ("WAWA", "T&E - Transportation"),
    ("BP ", "T&E - Transportation"),
    # Lodging
    ("HILTON", "T&E - Lodging"),
    ("MARRIOTT", "T&E - Lodging"),
    ("HYATT", "T&E - Lodging"),
    ("SHERATON", "T&E - Lodging"),
    ("AIRBNB", "T&E - Lodging"),
    ("VRBO", "T&E - Lodging"),
    ("CLIFT ROYAL", "T&E - Lodging"),
    ("COMFORT INN", "T&E - Lodging"),
    ("HOLIDAY INN", "T&E - Lodging"),
    ("WESTIN", "T&E - Lodging"),
    ("RITZ", "T&E - Lodging"),
    # Groceries (broad list - NYC/general)
    ("WHOLE FOODS", "Personal - Groceries"),
    ("TRADER JOE", "Personal - Groceries"),
    ("GOURMET GARAG", "Personal - Groceries"),
    ("MORTON WILLIAM", "Personal - Groceries"),
    ("MORTON WILLIA", "Personal - Groceries"),  # truncated in some statements
    ("AMAZON GROCERY", "Personal - Groceries"),
    ("BREEZY HILL ORCHARD", "Personal - Groceries"),
    ("KEY FOOD", "Personal - Groceries"),
    ("FAIRWAY", "Personal - Groceries"),
    ("WESTSIDE MARKET", "Personal - Groceries"),
    ("CITARELLA", "Personal - Groceries"),
    ("ZABAR", "Personal - Groceries"),
    ("D'AGOSTINO", "Personal - Groceries"),
    ("FOODTOWN", "Personal - Groceries"),
    ("INSTACART", "Personal - Groceries"),
    ("FRESH DIRECT", "Personal - Groceries"),
    ("FRESHDIRECT", "Personal - Groceries"),
    ("WEGMANS", "Personal - Groceries"),
    ("SAFEWAY", "Personal - Groceries"),
    ("KROGER", "Personal - Groceries"),
    # Convenience (loose - small purchases)
    ("7-ELEVEN", "Personal - Misc"),
    ("DUANE READE", "Personal - Health & Wellness"),
    # Pharmacy / health
    ("CVS/PHARMACY", "Personal - Health & Wellness"),
    ("CVS PHARMACY", "Personal - Health & Wellness"),
    ("WALGREENS", "Personal - Health & Wellness"),
    ("RITE AID", "Personal - Health & Wellness"),
    # Pet / vet
    ("PET STYL", "Personal - Misc"),
    ("LSVETS", "Personal - Misc"),
    ("VETERINARY", "Personal - Misc"),
    # Big box / general
    ("AMAZON.COM", "Personal - Misc"),
    ("AMZN", "Personal - Misc"),
    ("TARGET", "Personal - Misc"),
    ("COSTCO", "Personal - Misc"),
    ("WALMART", "Personal - Misc"),
    ("BEST BUY", "Personal - Misc"),
    ("HOME DEPOT", "Personal - Misc"),
    ("IKEA", "Personal - Misc"),
    ("WILLIAMS-SONO", "Personal - Misc"),
    ("CRATE AND BARREL", "Personal - Misc"),
    # Utilities
    ("STARRY", "F&O - Utilities"),
    ("CONED", "F&O - Utilities"),
    ("CON EDISON", "F&O - Utilities"),
    ("VERIZON", "F&O - Utilities"),
    ("T-MOBILE", "F&O - Utilities"),
    ("AT&T", "F&O - Utilities"),
    ("SPECTRUM", "F&O - Utilities"),
    ("XFINITY", "F&O - Utilities"),
    # Entertainment / fitness
    ("PLAYTOMIC", "Personal - Entertainment"),
    ("WESTSIDE TENNIS", "T&E - Entertainment"),
    ("EQUINOX", "Personal - Health & Wellness"),
    ("SOULCYCLE", "Personal - Health & Wellness"),
    ("PELOTON", "Personal - Subscriptions"),
    ("CLASSPASS", "Personal - Health & Wellness"),
    ("TICKETMASTER", "Personal - Entertainment"),
    ("STUBHUB", "Personal - Entertainment"),
    ("AMC ", "Personal - Entertainment"),
    ("REGAL CINEMAS", "Personal - Entertainment"),
    # Meals - delivery
    ("DOORDASH", "T&E - Meals"),
    ("DD *DOORDASH", "T&E - Meals"),
    ("GRUBHUB", "T&E - Meals"),
    ("UBEREATS", "T&E - Meals"),
    ("UBER EATS", "T&E - Meals"),
    ("SEAMLESS", "T&E - Meals"),
    ("CAVIAR", "T&E - Meals"),
    ("SHAREBITE", "T&E - Meals"),
    # Meals - restaurants (loose patterns)
    ("TST*", "T&E - Meals"),
    ("DIG INN", "T&E - Meals"),
    ("BAKESHOP", "T&E - Meals"),
    ("CAFE", "T&E - Meals"),
    ("BAKERY", "T&E - Meals"),
    ("PIZZA", "T&E - Meals"),
    ("STARBUCKS", "T&E - Meals"),
    ("DUNKIN", "T&E - Meals"),
    ("CHIPOTLE", "T&E - Meals"),
    ("SWEETGREEN", "T&E - Meals"),
    ("SHAKE SHACK", "T&E - Meals"),
    # Services
    ("FRENCH CLEANERS", "Personal - Misc"),
    ("DRY CLEAN", "Personal - Misc"),
    ("TASKRABBIT", "Personal - Misc"),
    ("PAYRANGE", "Personal - Misc"),  # laundry / vending
    ("HUDSONNEWS", "Personal - Misc"),
    ("HUDSON NEWS", "Personal - Misc"),
    ("28 UP INC", "T&E - Meals"),
    ("TAQUERIA", "T&E - Meals"),
    ("CASBAH", "T&E - Meals"),
    ("EL MITOTE", "T&E - Meals"),
    ("LIL SWEET TRE", "T&E - Meals"),
    ("CRUMBL", "T&E - Meals"),
    ("PROSPECT HILL", "T&E - Meals"),
    ("WHITE AND BLU", "T&E - Meals"),
    ("DORSET MAPLE", "T&E - Meals"),
    ("TREE HOUSE PEDIATRIC", "Personal - Health & Wellness"),
    ("NYC TAXI", "T&E - Transportation"),
    ("FOREIGN TRANSACTION FEE", "F&O - Bank Fees & Service Charges"),
    # Tennis / specific
    ("TENNIS", "Personal - Entertainment"),
]


def categorize(description: str) -> str | None:
    """Return category name or None if no rule matches."""
    desc_upper = description.upper()
    for pattern, cat in CATEGORY_RULES:
        if pattern in desc_upper:
            return cat
    return None


# 2-letter US state codes — used only as a strict end-of-string anchor.
_US_STATES = (
    "AL|AK|AZ|AR|CA|CO|CT|DE|FL|GA|HI|ID|IL|IN|IA|KS|KY|LA|ME|MD|MA|MI|MN|MS|"
    "MO|MT|NE|NV|NH|NJ|NM|NY|NC|ND|OH|OK|OR|PA|RI|SC|SD|TN|TX|UT|VT|VA|WA|WV|"
    "WI|WY|DC|PR"
)


def normalize_merchant(description: str) -> str:
    """Return a canonical, comparable merchant string.

    Conservative: only strips things that are reliably noise at the END of
    the string — trailing state codes, phone numbers, common prefixes added
    by the card network. Does NOT try to identify city names mid-string,
    because state codes like NY and CA appear inside legitimate merchant
    names ("AplPay NYCT PAYGO NEW YORK NY") and aggressive stripping
    obliterates the actual name.
    """
    d = description.strip()

    # Strip common prefixes added by the card network or merchant aggregator.
    d = re.sub(r"^(AplPay|DD \*|TST\*|MTA\*|NVN\* TRP \*?|SQ \*|PAYPAL \*)\s*",
               "", d, flags=re.I)
    d = d.upper()

    # Trailing state code stuck to a .com/.net/.org URL: "ANTHROPIC.COMCA" -> ".COM"
    d = re.sub(rf"(\.(?:COM|NET|ORG|IO|APP)(?:/[A-Z]+)?)({_US_STATES})$", r"\1", d)

    # Trailing state code with leading whitespace (most common case).
    d = re.sub(rf"\s+({_US_STATES})$", "", d)

    # Trailing phone number(s): "877-778-1161"
    d = re.sub(r"\s+\d{3}-\d{3,4}-\d{4}\s*$", "", d)

    # Collapse whitespace and trim trailing noise punctuation.
    d = re.sub(r"\s+", " ", d).strip(" -.,*")
    return d


# Back-compat alias.
clean_merchant = normalize_merchant


def detect_card(header: tuple) -> str | None:
    h = tuple(c.strip() for c in header)
    if h == AMEX_HEADER:
        return "Amex"
    if h == BOFA_HEADER:
        return "BofA"
    return None


def parse_iso_date(s: str) -> str:
    return datetime.strptime(s.strip(), "%m/%d/%Y").date().isoformat()


def import_file(path: Path, conn, tag_id: int, cat_ids: dict, default_card: str | None = None):
    inserted, skipped_pay, skipped_dup, no_cat = 0, 0, 0, 0
    with open(path, newline="", encoding="utf-8-sig") as f:
        reader = csv.reader(f)
        try:
            header = next(reader)
        except StopIteration:
            return inserted, skipped_pay, skipped_dup, no_cat

        card = default_card or detect_card(tuple(header))
        if not card:
            print(f"  [skip] {path.name}: unknown header {header}", file=sys.stderr)
            return inserted, skipped_pay, skipped_dup, no_cat

        for row in reader:
            if not row or all(not c.strip() for c in row):
                continue
            try:
                if card == "Amex":
                    date_s, _ref, payee, _addr, amt_s = row[:5]
                    desc = payee.strip().strip('"')
                    raw_amt = float(amt_s)
                    # Amex: negative = charge; positive = payment/refund
                    if is_payment(desc):
                        skipped_pay += 1
                        continue
                    amount = -raw_amt  # flip so charge becomes positive
                else:  # BofA
                    date_s, desc, amt_s = row[:3]
                    desc = desc.strip().strip('"')
                    raw_amt = float(amt_s.replace(",", ""))
                    # BofA: positive = charge; negative = payment/refund
                    if is_payment(desc):
                        skipped_pay += 1
                        continue
                    amount = raw_amt
            except (ValueError, IndexError):
                continue

            iso_date = parse_iso_date(date_s)
            merchant = clean_merchant(desc)

            existing = conn.execute(
                "SELECT id FROM expenses WHERE date=? AND description=? AND amount=? AND card=?",
                (iso_date, desc, amount, card),
            ).fetchone()
            if existing:
                skipped_dup += 1
                continue

            cat_name = categorize(desc)
            if not cat_name:
                no_cat += 1
                cat_name = "F&O - Uncategorized Expense"

            conn.execute(
                """INSERT INTO expenses (date, description, amount, category_id, tag_id,
                                         card, merchant, source)
                   VALUES (?, ?, ?, ?, ?, ?, ?, ?)""",
                (iso_date, desc, amount, cat_ids.get(cat_name), tag_id,
                 card, merchant, f"csv:{path.name}"),
            )
            inserted += 1
    return inserted, skipped_pay, skipped_dup, no_cat


def recategorize(conn, cat_ids):
    """Re-run category rules over rows currently flagged Uncategorized.
    Useful after adding new merchant patterns."""
    uncat_id = cat_ids.get("F&O - Uncategorized Expense")
    rows = conn.execute(
        "SELECT id, description FROM expenses WHERE category_id=?", (uncat_id,)
    ).fetchall()
    updated = 0
    for r in rows:
        new_cat = categorize(r["description"])
        if new_cat and cat_ids.get(new_cat) and cat_ids[new_cat] != uncat_id:
            conn.execute("UPDATE expenses SET category_id=? WHERE id=?",
                         (cat_ids[new_cat], r["id"]))
            updated += 1
    return updated


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("path", nargs="?", help="CSV file or directory of CSVs (omit with --recategorize-only)")
    ap.add_argument("--card", choices=["Amex", "BofA"], help="Force card type")
    ap.add_argument("--tag", default="Personal", help="Tag name to apply")
    ap.add_argument("--recategorize-only", action="store_true",
                    help="Skip import; just re-run category rules on existing uncategorized rows")
    args = ap.parse_args()

    init_db()
    conn = get_conn()
    tag_row = conn.execute("SELECT id FROM tags WHERE name=?", (args.tag,)).fetchone()
    if not tag_row:
        print(f"Tag not found: {args.tag}", file=sys.stderr)
        sys.exit(1)
    tag_id = tag_row["id"]
    cat_ids = {r["name"]: r["id"] for r in conn.execute("SELECT id, name FROM categories")}

    if args.recategorize_only:
        n = recategorize(conn, cat_ids)
        conn.commit()
        conn.close()
        print(f"Recategorized {n} rows")
        return

    if not args.path:
        ap.error("path is required unless --recategorize-only is set")

    p = Path(args.path)
    files = sorted(p.glob("*.csv")) if p.is_dir() else [p]

    totals = [0, 0, 0, 0]
    for f in files:
        ins, sp, sd, nc = import_file(f, conn, tag_id, cat_ids, args.card)
        print(f"  {f.name}: +{ins} inserted, {sp} payments skipped, {sd} dupes, {nc} uncategorized")
        totals[0] += ins; totals[1] += sp; totals[2] += sd; totals[3] += nc

    recat = recategorize(conn, cat_ids)
    conn.commit()
    conn.close()
    print(f"\nTotal: +{totals[0]} inserted, {totals[1]} payments skipped, "
          f"{totals[2]} dupes, {totals[3]} uncategorized")
    if recat:
        print(f"Also recategorized {recat} previously-uncategorized rows")


if __name__ == "__main__":
    main()
