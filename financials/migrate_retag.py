"""One-off migration to re-tag existing data after taxonomy changes.

Idempotent: only touches rows that still match the OLD assignment, so
re-running on already-migrated data is a no-op.

Mapping:
  1. Credit-card expense rows tagged "General Life"  -> "Personal"
  2. Income rows from client "7 Shot Tennis" tagged "Freelance Consulting"
     -> "7 Shot Tennis"
  3. Income rows from other freelance clients (Backcountry, Ukraine, etc.)
     still tagged "Freelance Consulting" -> "Other"

"Freelance Consulting" stays in the tag list for any expenses the user
manually wants to mark as freelance/business in nature.
"""
from db import get_conn, init_db


def tid(conn, name):
    r = conn.execute("SELECT id FROM tags WHERE name=?", (name,)).fetchone()
    if not r:
        raise SystemExit(f"Tag missing: {name} (run init_db() first)")
    return r["id"]


def main():
    init_db()
    conn = get_conn()

    general_life = tid(conn, "General Life")
    personal = tid(conn, "Personal")
    freelance = tid(conn, "Freelance Consulting")
    seven_shot = tid(conn, "7 Shot Tennis")
    other = tid(conn, "Other")
    halo = tid(conn, "Halo")

    n1 = conn.execute(
        "UPDATE expenses SET tag_id=? WHERE tag_id=? AND card IS NOT NULL",
        (personal, general_life),
    ).rowcount
    print(f"  Expenses (cards): General Life -> Personal  ... {n1} rows")

    n2 = conn.execute(
        "UPDATE income SET tag_id=? WHERE tag_id=? AND client='7 Shot Tennis'",
        (seven_shot, freelance),
    ).rowcount
    print(f"  Income (7 Shot Tennis): Freelance Consulting -> 7 Shot Tennis  ... {n2} rows")

    n3 = conn.execute(
        """UPDATE income SET tag_id=?
           WHERE tag_id=?
             AND (client IS NULL OR client NOT IN ('Powered By Halo', '7 Shot Tennis'))""",
        (other, freelance),
    ).rowcount
    print(f"  Income (Backcountry/Ukraine/XX-Ali): Freelance Consulting -> Other  ... {n3} rows")

    conn.commit()
    conn.close()
    print(f"\nTotal retagged: {n1 + n2 + n3}")


if __name__ == "__main__":
    main()
