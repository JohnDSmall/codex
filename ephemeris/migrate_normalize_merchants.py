"""Re-normalize the merchant column on every expense row using the
updated normalize_merchant() rules. Safe to re-run.
"""
from db import get_conn
from import_csv import normalize_merchant


def main():
    conn = get_conn()
    rows = conn.execute("SELECT id, description, merchant FROM expenses").fetchall()
    changed = 0
    for r in rows:
        new_m = normalize_merchant(r["description"]) if r["description"] else None
        if new_m != r["merchant"]:
            conn.execute("UPDATE expenses SET merchant=? WHERE id=?", (new_m, r["id"]))
            changed += 1
    conn.commit()
    conn.close()
    print(f"Updated merchant column on {changed} of {len(rows)} expense rows")


if __name__ == "__main__":
    main()
