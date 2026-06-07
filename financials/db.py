import sqlite3
from pathlib import Path

DB_PATH = Path(__file__).parent / "financials.db"

SCHEMA = """
CREATE TABLE IF NOT EXISTS tags (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL UNIQUE
);

CREATE TABLE IF NOT EXISTS categories (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    parent TEXT NOT NULL,
    name TEXT NOT NULL UNIQUE
);

CREATE TABLE IF NOT EXISTS expenses (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    date TEXT NOT NULL,
    description TEXT NOT NULL,
    amount REAL NOT NULL,
    category_id INTEGER REFERENCES categories(id),
    tag_id INTEGER REFERENCES tags(id),
    client TEXT,
    tax_status TEXT,
    notes TEXT,
    card TEXT,
    merchant TEXT,
    source TEXT
);

CREATE TABLE IF NOT EXISTS income (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    date TEXT NOT NULL,
    description TEXT NOT NULL,
    amount REAL NOT NULL,
    client TEXT,
    tag_id INTEGER REFERENCES tags(id),
    notes TEXT
);

CREATE TABLE IF NOT EXISTS assets (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    asset_type TEXT NOT NULL,
    value REAL NOT NULL,
    as_of_date TEXT NOT NULL,
    tag_id INTEGER REFERENCES tags(id),
    notes TEXT
);

CREATE TABLE IF NOT EXISTS hours (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    date TEXT NOT NULL,
    hours REAL NOT NULL,
    rate REAL,
    pay_status TEXT,
    client TEXT,
    project TEXT,
    description TEXT,
    tag_id INTEGER REFERENCES tags(id)
);

"""

INDEXES = """
CREATE INDEX IF NOT EXISTS idx_expenses_date ON expenses(date);
CREATE INDEX IF NOT EXISTS idx_expenses_tag ON expenses(tag_id);
CREATE INDEX IF NOT EXISTS idx_expenses_card ON expenses(card);
CREATE INDEX IF NOT EXISTS idx_income_date ON income(date);
CREATE INDEX IF NOT EXISTS idx_income_tag ON income(tag_id);
"""


def _migrate(conn):
    """Add columns added after initial schema. Safe to re-run."""
    cols = {r["name"] for r in conn.execute("PRAGMA table_info(expenses)")}
    for col in ("card", "merchant", "source"):
        if col not in cols:
            conn.execute(f"ALTER TABLE expenses ADD COLUMN {col} TEXT")

DEFAULT_TAGS = [
    "General Life",
    "Freelance Consulting",
    "Halo",
    "Snorkel",
    "HAI",
]

DEFAULT_CATEGORIES = [
    ("COGS", "COGS - Labor"),
    ("COGS", "COGS - Professional Fees"),
    ("COGS", "COGS - Third Party Integrations"),
    ("COGS", "COGS - Software"),
    ("F&O", "F&O - Labor"),
    ("F&O", "F&O - Professional Fees"),
    ("F&O", "F&O - Utilities"),
    ("F&O", "F&O - Office Supplies"),
    ("F&O", "F&O - Software & Apps"),
    ("F&O", "F&O - Taxes"),
    ("F&O", "F&O - Shipping & Postage"),
    ("F&O", "F&O - Bank Fees & Service Charges"),
    ("F&O", "F&O - Merchant Account Fees"),
    ("F&O", "F&O - Uncategorized Expense"),
    ("S&M", "S&M - Labor"),
    ("S&M", "S&M - Professional Fees"),
    ("S&M", "S&M - Commissions & Fees"),
    ("S&M", "S&M - Advertising"),
    ("S&M", "S&M - Listing Fees"),
    ("S&M", "S&M - Social Media"),
    ("S&M", "S&M - Events & Conferences"),
    ("T&E", "T&E - Lodging"),
    ("T&E", "T&E - Transportation"),
    ("T&E", "T&E - Entertainment"),
    ("T&E", "T&E - Meals"),
    ("R&D", "R&D - Labor"),
    ("R&D", "R&D - Professional Services"),
    ("R&D", "R&D - Third Party Integrations"),
    ("R&D", "R&D - Software"),
    ("L&A", "L&A - Labor"),
    ("L&A", "L&A - Legal Professional Fees"),
    ("L&A", "L&A - Accounting Fees"),
    ("L&A", "L&A - Health Insurance Fees"),
    ("L&A", "L&A - Book Keeping"),
    ("L&A", "L&A - Insurance"),
    ("L&A", "L&A - Intellectual Property"),
    ("L&A", "L&A - Business Licenses"),
    ("Personal", "Personal - Housing"),
    ("Personal", "Personal - Groceries"),
    ("Personal", "Personal - Dining"),
    ("Personal", "Personal - Transportation"),
    ("Personal", "Personal - Health & Wellness"),
    ("Personal", "Personal - Entertainment"),
    ("Personal", "Personal - Subscriptions"),
    ("Personal", "Personal - Misc"),
]


def get_conn():
    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row
    conn.execute("PRAGMA foreign_keys = ON")
    return conn


def init_db():
    conn = get_conn()
    conn.executescript(SCHEMA)
    _migrate(conn)
    conn.executescript(INDEXES)

    for tag in DEFAULT_TAGS:
        conn.execute("INSERT OR IGNORE INTO tags (name) VALUES (?)", (tag,))

    for parent, name in DEFAULT_CATEGORIES:
        conn.execute(
            "INSERT OR IGNORE INTO categories (parent, name) VALUES (?, ?)",
            (parent, name),
        )

    conn.commit()
    conn.close()


if __name__ == "__main__":
    init_db()
    print(f"Initialized {DB_PATH}")
