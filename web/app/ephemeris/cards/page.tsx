import Link from "next/link";
import {
  loadCardNames,
  loadCardTransactions,
  type RawSearchParams,
} from "@/lib/ephemeris-server";
import {
  Card,
  Empty,
  Kpi,
  TableWrap,
  Td,
  Th,
  fieldCls,
  fmtMoneyExact,
  fmtMoneyFull,
  fmtMonth,
} from "../../components/ephemeris/ui";

export const dynamic = "force-dynamic";

export default async function CardTransactionsPage({
  searchParams,
}: {
  searchParams: Promise<RawSearchParams>;
}) {
  const sp = await searchParams;
  const one = (v: string | string[] | undefined) => {
    const s = Array.isArray(v) ? v[0] : v;
    return s && s.trim() !== "" ? s : null;
  };
  const card = one(sp.card);
  const month = one(sp.month);
  const q = one(sp.q);
  const hidePartner = one(sp.partner) === "hide";

  const [{ rows: allRows, tableMissing }, cards] = await Promise.all([
    loadCardTransactions({ card, month, q }),
    loadCardNames(),
  ]);
  const partnerCount = allRows.filter((r) => r.is_partner).length;
  const rows = hidePartner ? allRows.filter((r) => !r.is_partner) : allRows;

  const total = rows.reduce((s, r) => s + r.amount, 0);
  const months = [...new Set(rows.map((r) => r.date.slice(0, 7)))].sort().reverse();

  const href = (patch: Record<string, string | null>) => {
    const p = new URLSearchParams();
    const base: Record<string, string | null> = { card, month, q, partner: hidePartner ? "hide" : null, ...patch };
    for (const [k, v] of Object.entries(base)) if (v) p.set(k, v);
    const s = p.toString();
    return s ? `/ephemeris/cards?${s}` : "/ephemeris/cards";
  };
  const chip = (on: boolean) =>
    "rounded-md px-2.5 py-1 text-xs transition-colors " +
    (on
      ? "bg-indigo-50 dark:bg-indigo-500/10 text-indigo-700 dark:text-indigo-300 font-medium"
      : "text-neutral-500 hover:bg-neutral-100 dark:hover:bg-neutral-800");

  const byMerchant = new Map<string, { n: number; total: number }>();
  for (const r of rows) {
    const k = r.merchant || r.description;
    const e = byMerchant.get(k) ?? { n: 0, total: 0 };
    e.n++; e.total += r.amount;
    byMerchant.set(k, e);
  }
  const top = [...byMerchant.entries()]
    .map(([merchant, v]) => ({ merchant, ...v }))
    .sort((a, b) => b.total - a.total)
    .slice(0, 15);

  return (
    <div className="space-y-6">
      <div className="rounded-xl border border-neutral-200 dark:border-neutral-800 bg-white dark:bg-neutral-900 px-4 py-3 text-sm text-neutral-600 dark:text-neutral-400">
        <strong className="font-medium text-neutral-800 dark:text-neutral-200">
          Card charges are reference data, not expenses.
        </strong>{" "}
        Expenses are the cash that left your bank — the card payments. These are what the card was
        used for, so a payment can be broken down. They are never counted in any total.
        {card === "Amex" && (
          <> The Amex is shared, so some of these charges are your partner&apos;s.</>
        )}
      </div>

      {tableMissing ? (
        <div className="rounded-xl border border-amber-300 dark:border-amber-500/40 bg-amber-50 dark:bg-amber-500/10 px-4 py-3 text-sm text-amber-800 dark:text-amber-200">
          <strong className="font-medium">Migration pending.</strong> Apply{" "}
          <code className="text-xs">supabase/migrations/20260808140000_card_transactions.sql</code>,
          then run <code className="text-xs">import_card_transactions.js</code>.
        </div>
      ) : (
        <>
          <div className="flex flex-wrap items-center gap-1.5">
            <span className="text-xs text-neutral-400">Card:</span>
            <Link href={href({ card: null })} className={chip(!card)}>All</Link>
            {cards.map((c) => (
              <Link key={c} href={href({ card: c })} className={chip(card === c)}>{c}</Link>
            ))}
          </div>

          {months.length > 1 && (
            <div className="flex flex-wrap items-center gap-1.5">
              <span className="text-xs text-neutral-400">Month:</span>
              <Link href={href({ month: null })} className={chip(!month)}>All</Link>
              {months.slice(0, 18).map((m) => (
                <Link key={m} href={href({ month: m })} className={chip(month === m)}>{fmtMonth(m)}</Link>
              ))}
            </div>
          )}

          {partnerCount > 0 && (
            <div className="flex flex-wrap items-center gap-1.5">
              <span className="text-xs text-neutral-400">Partner charges ({partnerCount}):</span>
              <Link href={href({ partner: null })} className={chip(!hidePartner)}>Show</Link>
              <Link href={href({ partner: "hide" })} className={chip(hidePartner)}>Hide</Link>
            </div>
          )}

          <form action="/ephemeris/cards" className="flex flex-wrap items-end gap-2">
            {card ? <input type="hidden" name="card" value={card} /> : null}
            {month ? <input type="hidden" name="month" value={month} /> : null}
            <input
              type="search"
              name="q"
              defaultValue={q ?? ""}
              placeholder="Search merchant or description…"
              className={`${fieldCls} min-w-[18rem]`}
            />
            <button
              type="submit"
              className="rounded-lg border border-neutral-300 dark:border-neutral-700 px-3 py-1.5 text-sm hover:bg-neutral-100 dark:hover:bg-neutral-800"
            >
              Search
            </button>
            {q ? (
              <Link href={href({ q: null })} className="text-xs text-neutral-500 hover:underline">
                clear
              </Link>
            ) : null}
          </form>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <Kpi label="Charges shown" value={String(rows.length)} />
            <Kpi label="Total" value={fmtMoneyFull(total)} accent />
            <Kpi label="Distinct merchants" value={String(byMerchant.size)} />
          </div>

          {rows.length > 0 && (
            <Card title="Top merchants" padded={false}>
              <TableWrap>
                <table className="w-full text-sm">
                  <thead className="text-xs text-neutral-500">
                    <tr className="text-left">
                      <Th>Merchant</Th>
                      <Th right>Charges</Th>
                      <Th right>Total</Th>
                    </tr>
                  </thead>
                  <tbody>
                    {top.map((m) => (
                      <tr key={m.merchant} className="border-t border-neutral-100 dark:border-neutral-800">
                        <Td className="max-w-[22rem] truncate">{m.merchant}</Td>
                        <Td right muted>{m.n}</Td>
                        <Td right className="font-medium">{fmtMoneyExact(m.total)}</Td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </TableWrap>
            </Card>
          )}

          <Card title={`Charges (${rows.length})`} padded={false}>
            {rows.length === 0 ? (
              <div className="p-4"><Empty>No card charges match these filters.</Empty></div>
            ) : (
              <TableWrap>
                <table className="w-full text-sm">
                  <thead className="text-xs text-neutral-500">
                    <tr className="text-left">
                      <Th>Date</Th>
                      <Th>Card</Th>
                      <Th>Merchant</Th>
                      <Th>Category</Th>
                      <Th right>Amount</Th>
                    </tr>
                  </thead>
                  <tbody>
                    {rows.map((r) => (
                      <tr key={r.id} className="border-t border-neutral-100 dark:border-neutral-800">
                        <Td muted>{r.date}</Td>
                        <Td muted>{r.card}</Td>
                        <Td className="max-w-[22rem] truncate">
                          {/* full memo on hover: the merchant is a cleaned-up form of it */}
                          <span title={r.description}>{r.merchant || r.description}</span>
                          {r.is_partner && (
                            <span className="ml-2 rounded px-1.5 py-0.5 text-[10px] uppercase tracking-wide bg-pink-50 dark:bg-pink-500/10 text-pink-700 dark:text-pink-300">
                              partner
                            </span>
                          )}
                        </Td>
                        <Td muted>{r.category_name ?? ""}</Td>
                        <Td right className="font-medium">{fmtMoneyExact(r.amount)}</Td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </TableWrap>
            )}
          </Card>
        </>
      )}
    </div>
  );
}
