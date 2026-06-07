import json
from datetime import date, timedelta
from collections import defaultdict
from flask import Flask, render_template, request, redirect, url_for, abort
from db import get_conn, init_db

app = Flask(__name__)

INCOME_TYPES = ["Salary", "Bonus", "Reimbursement"]


def _months_back(d: date, n: int) -> date:
    """First day of the month that is n months before d's month."""
    y, m = d.year, d.month - n
    while m <= 0:
        m += 12
        y -= 1
    return date(y, m, 1)


def _last_completed_month_range():
    """ISO dates (first, last) of the previous calendar month."""
    today = date.today()
    first_this = today.replace(day=1)
    last_prev = first_this - timedelta(days=1)
    first_prev = last_prev.replace(day=1)
    return first_prev.isoformat(), last_prev.isoformat()


def _trailing_3mo_range():
    """ISO dates (first, last) covering the last 3 COMPLETED calendar months."""
    today = date.today()
    first_this = today.replace(day=1)
    last_prev = first_this - timedelta(days=1)
    three_back = _months_back(first_this, 3)
    return three_back.isoformat(), last_prev.isoformat()


def _filters_from_request():
    """Pull standard spending filters from query string.

    If from/to are entirely absent from the query string, apply the default
    range (last completed calendar month). If either is present (even as an
    empty string), honor the user's intent — e.g. ?from=&to= means "all time".
    """
    args = request.args
    if "from" in args or "to" in args:
        from_date = args.get("from") or None
        to_date = args.get("to") or None
    else:
        from_date, to_date = _last_completed_month_range()

    return {
        "card": args.get("card") or None,
        "tag": args.get("tag", type=int),
        "from_date": from_date,
        "to_date": to_date,
        "category": args.get("category", type=int),
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


def _cv(values):
    if len(values) < 2:
        return 0.0
    mean = sum(values) / len(values)
    if mean == 0:
        return 0.0
    var = sum((v - mean) ** 2 for v in values) / len(values)
    return (var ** 0.5) / abs(mean)


def _classify_subscription(date_strs, amounts):
    """Decide whether a merchant looks like a recurring subscription/bill
    rather than a series of independent purchases.

    Subscription = amount is stable (CV ≤ 0.20) AND cadence is regular
    (gap CV ≤ 0.60). Otherwise return (None, 0).

    Returns (cadence_label, monthly_factor).
    """
    from datetime import date as _date
    dates = sorted(_date.fromisoformat(d) for d in date_strs)
    if len(dates) < 2:
        return None, 0.0
    gaps = [(dates[i + 1] - dates[i]).days for i in range(len(dates) - 1)]

    if _cv(amounts) > 0.20:
        return None, 0.0  # amount varies too much — frequent purchases, not a subscription
    if _cv(gaps) > 0.60:
        return None, 0.0  # cadence is irregular — one-off events, not a recurring bill

    sorted_gaps = sorted(gaps)
    median = sorted_gaps[len(sorted_gaps) // 2]
    if median <= 10:
        return "Weekly", 30.44 / 7
    if 11 <= median <= 20:
        return "Bi-weekly", 30.44 / 14
    if 21 <= median <= 45:
        return "Monthly", 1.0
    if 46 <= median <= 75:
        return "~6-weekly", 30.44 / median
    if 76 <= median <= 120:
        return "Quarterly", 1.0 / 3
    if 121 <= median <= 200:
        return "Semi-annual", 1.0 / 6
    if 300 <= median <= 400:
        return "Annual", 1.0 / 12
    return None, 0.0


def _is_active(cadence, last_date_iso):
    today = date.today()
    last = date.fromisoformat(last_date_iso)
    gap = (today - last).days
    thresholds = {
        "Weekly": 21,
        "Bi-weekly": 35,
        "Monthly": 50,
        "~6-weekly": 90,
        "Quarterly": 120,
        "Semi-annual": 220,
        "Annual": 420,
    }
    return gap <= thresholds.get(cadence, 90)


@app.route("/subscriptions")
def subscriptions():
    f = _filters_from_request()
    # Subscriptions inherently span the user's whole history — always use
    # all-time unless the user explicitly set a date range in the URL.
    if "from" not in request.args and "to" not in request.args:
        f["from_date"] = None
        f["to_date"] = None
    active_only = request.args.get("active", "1") != "0"
    show = request.args.get("show", "auto")  # auto | rejected | all

    conn = get_conn()
    where, params = _where_clause(f, "e")

    # User overrides: confirmed merchants always show up; rejected hide by default.
    overrides = {r["merchant"]: r["status"] for r in
                 conn.execute("SELECT merchant, status FROM merchant_subscriptions")}

    # Group: prefer normalized merchant, fall back to description. Require
    # at least 3 occurrences across at least 2 distinct months to qualify.
    rows = conn.execute(
        f"""SELECT COALESCE(NULLIF(e.merchant, ''), e.description) AS merchant,
                   COUNT(*) AS n,
                   COUNT(DISTINCT substr(e.date, 1, 7)) AS month_count,
                   MIN(e.date) AS first_date,
                   MAX(e.date) AS last_date,
                   ROUND(AVG(e.amount), 2) AS avg_amount,
                   ROUND(SUM(e.amount), 2) AS total,
                   GROUP_CONCAT(e.date) AS dates,
                   GROUP_CONCAT(e.amount) AS amounts,
                   GROUP_CONCAT(DISTINCT COALESCE(c.name, '')) AS cat_names,
                   GROUP_CONCAT(DISTINCT COALESCE(e.card, 'manual')) AS card_names
            FROM expenses e
            LEFT JOIN categories c ON c.id = e.category_id
            {where}
            GROUP BY merchant
            HAVING n >= 3 AND month_count >= 2
            ORDER BY total DESC""",
        params,
    ).fetchall()

    subs = []
    total_monthly = 0.0
    for r in rows:
        merchant = r["merchant"]
        status = overrides.get(merchant)  # 'confirmed' | 'rejected' | None
        amounts = [float(a) for a in r["amounts"].split(",")]
        cadence, factor = _classify_subscription(r["dates"].split(","), amounts)

        # Visibility rules:
        #   show='auto'     -> auto-detected + confirmed, hide rejected
        #   show='rejected' -> only rejected (for review)
        #   show='all'      -> everything we have data for
        if show == "rejected":
            if status != "rejected":
                continue
            # Force-display rejected even without cadence (estimate as monthly).
            if cadence is None:
                cadence, factor = "Variable", 0.0
        elif show == "all":
            if cadence is None and status is None:
                continue
        else:  # auto
            if status == "rejected":
                continue
            if cadence is None and status != "confirmed":
                continue
            if cadence is None:
                cadence, factor = "Variable", 0.0

        last_iso = r["last_date"]
        active = _is_active(cadence, last_iso)
        if active_only and not active and status != "confirmed":
            continue
        monthly_cost = (r["avg_amount"] or 0) * factor
        total_monthly += monthly_cost
        subs.append({
            "merchant": merchant,
            "n": r["n"],
            "cadence": cadence,
            "avg_amount": r["avg_amount"],
            "monthly_cost": monthly_cost,
            "annual_cost": monthly_cost * 12,
            "total": r["total"],
            "first_date": r["first_date"],
            "last_date": r["last_date"],
            "active": active,
            "status": status,
            "categories": r["cat_names"] or "",
            "cards": r["card_names"] or "",
        })

    subs.sort(key=lambda s: s["monthly_cost"], reverse=True)
    cards = _distinct_cards(conn)
    conn.close()

    return render_template(
        "subscriptions.html",
        subs=subs,
        total_monthly=total_monthly,
        total_annual=total_monthly * 12,
        active_only=active_only,
        show=show,
        filters=f,
        cards=cards,
        tags=_tags(),
    )


@app.route("/subscriptions/<path:merchant>/<action>", methods=["POST"])
def subscription_action(merchant, action):
    """Mark a merchant as confirmed/rejected as a subscription, or clear."""
    if action not in ("confirm", "reject", "clear"):
        abort(400)
    conn = get_conn()
    if action == "clear":
        conn.execute("DELETE FROM merchant_subscriptions WHERE merchant=?", (merchant,))
    else:
        status = "confirmed" if action == "confirm" else "rejected"
        conn.execute(
            """INSERT INTO merchant_subscriptions (merchant, status)
               VALUES (?, ?)
               ON CONFLICT(merchant) DO UPDATE SET status=excluded.status,
                                                   updated_at=CURRENT_TIMESTAMP""",
            (merchant, status),
        )
    conn.commit()
    conn.close()
    return redirect(request.referrer or url_for("subscriptions"))


@app.route("/spending")
def spending():
    f = _filters_from_request()
    conn = get_conn()
    where, params = _where_clause(f, "e")

    # KPIs (Total/Transactions/Avg-per-txn over the filtered range)
    kpi_row = conn.execute(
        f"""SELECT COUNT(*) AS n,
                   COALESCE(SUM(amount), 0) AS total,
                   COALESCE(AVG(amount), 0) AS avg,
                   COUNT(DISTINCT substr(date, 1, 7)) AS months
            FROM expenses e {where}""", params
    ).fetchone()
    kpi = dict(kpi_row)

    # Avg/Month is computed over the trailing 3 completed calendar months,
    # independent of the date filter (but still respects card/tag/category).
    m3_from, m3_to = _trailing_3mo_range()
    m3_filters = {**f, "from_date": m3_from, "to_date": m3_to}
    m3_where, m3_params = _where_clause(m3_filters, "e")
    m3 = conn.execute(
        f"""SELECT COALESCE(SUM(amount), 0) AS total,
                   COUNT(DISTINCT substr(date, 1, 7)) AS months
            FROM expenses e {m3_where}""", m3_params
    ).fetchone()
    kpi["monthly_avg"] = m3["total"] / 3 if m3["months"] else 0
    kpi["monthly_avg_window"] = f"{m3_from} to {m3_to}"

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
        income_types=INCOME_TYPES,
    )


@app.route("/income/add", methods=["POST"])
def add_income():
    f = request.form
    conn = get_conn()
    conn.execute(
        """INSERT INTO income (date, description, amount, client, tag_id, notes, income_type)
           VALUES (?, ?, ?, ?, ?, ?, ?)""",
        (
            f["date"],
            f["description"],
            float(f["amount"]),
            f.get("client") or None,
            int(f["tag_id"]),
            f.get("notes") or None,
            f.get("income_type") or None,
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
