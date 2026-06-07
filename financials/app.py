import json
from datetime import date
from collections import defaultdict
from flask import Flask, render_template, request, redirect, url_for, abort
from db import get_conn, init_db

app = Flask(__name__)


def _filters_from_request():
    """Pull standard spending filters from query string."""
    return {
        "card": request.args.get("card") or None,
        "tag": request.args.get("tag", type=int),
        "from_date": request.args.get("from") or None,
        "to_date": request.args.get("to") or None,
        "category": request.args.get("category", type=int),
    }


def _where_clause(f, table_alias="e"):
    """Build WHERE fragment and params from a filter dict."""
    clauses, params = [], []
    if f.get("card"):
        clauses.append(f"{table_alias}.card = ?")
        params.append(f["card"])
    if f.get("tag"):
        clauses.append(f"{table_alias}.tag_id = ?")
        params.append(f["tag"])
    if f.get("from_date"):
        clauses.append(f"{table_alias}.date >= ?")
        params.append(f["from_date"])
    if f.get("to_date"):
        clauses.append(f"{table_alias}.date <= ?")
        params.append(f["to_date"])
    if f.get("category"):
        clauses.append(f"{table_alias}.category_id = ?")
        params.append(f["category"])
    where = ("WHERE " + " AND ".join(clauses)) if clauses else ""
    return where, params


def _distinct_cards(conn):
    return [r["card"] for r in conn.execute(
        "SELECT DISTINCT card FROM expenses WHERE card IS NOT NULL ORDER BY card"
    )]


def _tags():
    conn = get_conn()
    rows = conn.execute("SELECT id, name FROM tags ORDER BY name").fetchall()
    conn.close()
    return rows


def _categories():
    conn = get_conn()
    rows = conn.execute("SELECT id, parent, name FROM categories ORDER BY parent, name").fetchall()
    conn.close()
    return rows


@app.template_filter("money")
def money(v):
    if v is None:
        return ""
    return f"${v:,.2f}"


@app.route("/")
def dashboard():
    conn = get_conn()

    totals_by_tag = conn.execute(
        """
        SELECT t.name AS tag,
               COALESCE((SELECT SUM(amount) FROM income WHERE tag_id=t.id), 0) AS income,
               COALESCE((SELECT SUM(amount) FROM expenses WHERE tag_id=t.id), 0) AS expenses
        FROM tags t
        ORDER BY t.name
        """
    ).fetchall()

    assets_total = conn.execute("SELECT COALESCE(SUM(value), 0) AS v FROM assets").fetchone()["v"]
    assets_by_tag = conn.execute(
        """SELECT t.name AS tag, COALESCE(SUM(a.value), 0) AS v
           FROM tags t LEFT JOIN assets a ON a.tag_id = t.id
           GROUP BY t.id ORDER BY t.name"""
    ).fetchall()

    monthly_exp = conn.execute(
        """SELECT substr(date, 1, 7) AS m, t.name AS tag, SUM(amount) AS total
           FROM expenses e LEFT JOIN tags t ON t.id = e.tag_id
           GROUP BY m, t.name ORDER BY m"""
    ).fetchall()
    monthly_inc = conn.execute(
        """SELECT substr(date, 1, 7) AS m, t.name AS tag, SUM(amount) AS total
           FROM income i LEFT JOIN tags t ON t.id = i.tag_id
           GROUP BY m, t.name ORDER BY m"""
    ).fetchall()

    months = sorted({r["m"] for r in monthly_exp} | {r["m"] for r in monthly_inc}, reverse=True)
    tag_names = [r["name"] for r in conn.execute("SELECT name FROM tags ORDER BY name")]

    grid = {m: {"income": defaultdict(float), "expenses": defaultdict(float)} for m in months}
    for r in monthly_inc:
        grid[r["m"]]["income"][r["tag"]] = r["total"] or 0
    for r in monthly_exp:
        grid[r["m"]]["expenses"][r["tag"]] = r["total"] or 0

    recent_exp = conn.execute(
        """SELECT e.*, t.name AS tag_name, c.name AS cat_name
           FROM expenses e LEFT JOIN tags t ON t.id=e.tag_id
           LEFT JOIN categories c ON c.id=e.category_id
           ORDER BY date DESC LIMIT 10"""
    ).fetchall()
    recent_inc = conn.execute(
        """SELECT i.*, t.name AS tag_name FROM income i LEFT JOIN tags t ON t.id=i.tag_id
           ORDER BY date DESC LIMIT 10"""
    ).fetchall()

    conn.close()

    return render_template(
        "dashboard.html",
        totals_by_tag=totals_by_tag,
        assets_total=assets_total,
        assets_by_tag=assets_by_tag,
        months=months,
        tag_names=tag_names,
        grid=grid,
        recent_exp=recent_exp,
        recent_inc=recent_inc,
    )


@app.route("/spending")
def spending():
    f = _filters_from_request()
    conn = get_conn()
    where, params = _where_clause(f, "e")

    # KPIs
    kpi = conn.execute(
        f"SELECT COUNT(*) AS n, COALESCE(SUM(amount), 0) AS total, "
        f"COALESCE(AVG(amount), 0) AS avg FROM expenses e {where}", params
    ).fetchone()

    # Per-card breakdown (respects all filters except card itself for the card list)
    card_where, card_params = _where_clause({**f, "card": None}, "e")
    by_card = conn.execute(
        f"""SELECT e.card AS card, COUNT(*) AS n, SUM(amount) AS total
            FROM expenses e {card_where}
            GROUP BY e.card ORDER BY total DESC""", card_params
    ).fetchall()

    # Category breakdown (chart 1)
    by_cat = conn.execute(
        f"""SELECT COALESCE(c.name, 'Uncategorized') AS cat, SUM(e.amount) AS total
            FROM expenses e LEFT JOIN categories c ON c.id=e.category_id
            {where}
            GROUP BY cat ORDER BY total DESC""", params
    ).fetchall()

    # Monthly timeline (chart 2)
    by_month = conn.execute(
        f"""SELECT substr(e.date, 1, 7) AS m, SUM(e.amount) AS total
            FROM expenses e {where}
            GROUP BY m ORDER BY m""", params
    ).fetchall()

    # Top merchants
    top_merchants = conn.execute(
        f"""SELECT COALESCE(e.merchant, e.description) AS merchant,
                   COUNT(*) AS n, SUM(e.amount) AS total
            FROM expenses e {where}
            GROUP BY merchant ORDER BY total DESC LIMIT 15""", params
    ).fetchall()

    # Itemized list (paginated)
    rows = conn.execute(
        f"""SELECT e.*, t.name AS tag_name, c.name AS cat_name
            FROM expenses e LEFT JOIN tags t ON t.id=e.tag_id
            LEFT JOIN categories c ON c.id=e.category_id
            {where}
            ORDER BY e.date DESC LIMIT 200""", params
    ).fetchall()

    cards = _distinct_cards(conn)
    conn.close()

    category_chart = {
        "labels": [r["cat"] for r in by_cat],
        "data": [round(r["total"], 2) for r in by_cat],
    }
    month_chart = {
        "labels": [r["m"] for r in by_month],
        "data": [round(r["total"], 2) for r in by_month],
    }

    return render_template(
        "spending.html",
        filters=f,
        kpi=kpi,
        by_card=by_card,
        by_cat=by_cat,
        top_merchants=top_merchants,
        rows=rows,
        cards=cards,
        tags=_tags(),
        category_chart_json=json.dumps(category_chart),
        month_chart_json=json.dumps(month_chart),
    )


@app.route("/expenses")
def expenses():
    f = _filters_from_request()
    conn = get_conn()
    where, params = _where_clause(f, "e")
    q = f"""SELECT e.*, t.name AS tag_name, c.name AS cat_name
            FROM expenses e LEFT JOIN tags t ON t.id=e.tag_id
            LEFT JOIN categories c ON c.id=e.category_id
            {where}
            ORDER BY date DESC LIMIT 500"""
    rows = conn.execute(q, params).fetchall()
    total = sum(r["amount"] for r in rows)
    cards = _distinct_cards(conn)
    conn.close()
    return render_template(
        "expenses.html",
        rows=rows,
        total=total,
        tags=_tags(),
        categories=_categories(),
        cards=cards,
        filters=f,
        today=date.today().isoformat(),
    )


@app.route("/expenses/add", methods=["POST"])
def add_expense():
    f = request.form
    conn = get_conn()
    conn.execute(
        """INSERT INTO expenses (date, description, amount, category_id, tag_id, client, tax_status, notes)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?)""",
        (
            f["date"],
            f["description"],
            float(f["amount"]),
            int(f["category_id"]) if f.get("category_id") else None,
            int(f["tag_id"]),
            f.get("client") or None,
            f.get("tax_status") or None,
            f.get("notes") or None,
        ),
    )
    conn.commit()
    conn.close()
    return redirect(url_for("expenses"))


@app.route("/expenses/<int:eid>/delete", methods=["POST"])
def delete_expense(eid):
    conn = get_conn()
    conn.execute("DELETE FROM expenses WHERE id = ?", (eid,))
    conn.commit()
    conn.close()
    return redirect(request.referrer or url_for("expenses"))


@app.route("/income")
def income():
    tag_filter = request.args.get("tag", type=int)
    conn = get_conn()
    q = """SELECT i.*, t.name AS tag_name FROM income i LEFT JOIN tags t ON t.id=i.tag_id"""
    params = []
    if tag_filter:
        q += " WHERE i.tag_id = ?"
        params.append(tag_filter)
    q += " ORDER BY date DESC LIMIT 500"
    rows = conn.execute(q, params).fetchall()
    total = sum(r["amount"] for r in rows)
    conn.close()
    return render_template(
        "income.html",
        rows=rows,
        total=total,
        tags=_tags(),
        active_tag=tag_filter,
        today=date.today().isoformat(),
    )


@app.route("/income/add", methods=["POST"])
def add_income():
    f = request.form
    conn = get_conn()
    conn.execute(
        "INSERT INTO income (date, description, amount, client, tag_id, notes) VALUES (?, ?, ?, ?, ?, ?)",
        (
            f["date"],
            f["description"],
            float(f["amount"]),
            f.get("client") or None,
            int(f["tag_id"]),
            f.get("notes") or None,
        ),
    )
    conn.commit()
    conn.close()
    return redirect(url_for("income"))


@app.route("/income/<int:iid>/delete", methods=["POST"])
def delete_income(iid):
    conn = get_conn()
    conn.execute("DELETE FROM income WHERE id = ?", (iid,))
    conn.commit()
    conn.close()
    return redirect(request.referrer or url_for("income"))


@app.route("/assets")
def assets():
    conn = get_conn()
    rows = conn.execute(
        """SELECT a.*, t.name AS tag_name FROM assets a LEFT JOIN tags t ON t.id=a.tag_id
           ORDER BY value DESC"""
    ).fetchall()
    total = sum(r["value"] for r in rows)
    conn.close()
    return render_template(
        "assets.html",
        rows=rows,
        total=total,
        tags=_tags(),
        today=date.today().isoformat(),
    )


@app.route("/assets/add", methods=["POST"])
def add_asset():
    f = request.form
    conn = get_conn()
    conn.execute(
        """INSERT INTO assets (name, asset_type, value, as_of_date, tag_id, notes)
           VALUES (?, ?, ?, ?, ?, ?)""",
        (
            f["name"],
            f["asset_type"],
            float(f["value"]),
            f["as_of_date"],
            int(f["tag_id"]),
            f.get("notes") or None,
        ),
    )
    conn.commit()
    conn.close()
    return redirect(url_for("assets"))


@app.route("/assets/<int:aid>/delete", methods=["POST"])
def delete_asset(aid):
    conn = get_conn()
    conn.execute("DELETE FROM assets WHERE id = ?", (aid,))
    conn.commit()
    conn.close()
    return redirect(url_for("assets"))


@app.route("/hours")
def hours():
    tag_filter = request.args.get("tag", type=int)
    conn = get_conn()
    q = """SELECT h.*, t.name AS tag_name FROM hours h LEFT JOIN tags t ON t.id=h.tag_id"""
    params = []
    if tag_filter:
        q += " WHERE h.tag_id = ?"
        params.append(tag_filter)
    q += " ORDER BY date DESC LIMIT 500"
    rows = conn.execute(q, params).fetchall()
    total_hours = sum(r["hours"] for r in rows)
    total_value = sum((r["hours"] or 0) * (r["rate"] or 0) for r in rows)
    conn.close()
    return render_template(
        "hours.html",
        rows=rows,
        total_hours=total_hours,
        total_value=total_value,
        tags=_tags(),
        active_tag=tag_filter,
        today=date.today().isoformat(),
    )


@app.route("/hours/add", methods=["POST"])
def add_hours():
    f = request.form
    conn = get_conn()
    conn.execute(
        """INSERT INTO hours (date, hours, rate, pay_status, client, project, description, tag_id)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?)""",
        (
            f["date"],
            float(f["hours"]),
            float(f["rate"]) if f.get("rate") else None,
            f.get("pay_status") or None,
            f.get("client") or None,
            f.get("project") or None,
            f.get("description") or None,
            int(f["tag_id"]),
        ),
    )
    conn.commit()
    conn.close()
    return redirect(url_for("hours"))


@app.route("/hours/<int:hid>/delete", methods=["POST"])
def delete_hours(hid):
    conn = get_conn()
    conn.execute("DELETE FROM hours WHERE id = ?", (hid,))
    conn.commit()
    conn.close()
    return redirect(url_for("hours"))


if __name__ == "__main__":
    init_db()
    app.run(host="127.0.0.1", port=5000, debug=False)
