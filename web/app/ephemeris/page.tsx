import Link from "next/link";
import { loadDashboard } from "@/lib/ephemeris-server";
import { CashflowChart, TagBars } from "../components/ephemeris/Charts";
import {
  Card,
  Empty,
  Kpi,
  TableWrap,
  TagPill,
  Td,
  Th,
  fmtMoneyExact,
  fmtMoneyFull,
  fmtMonth,
} from "../components/ephemeris/ui";

export const dynamic = "force-dynamic";

export default async function EphemerisOverviewPage() {
  const d = await loadDashboard();
  const net = d.totalIncome - d.totalExpenses;

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
        <Kpi label="Net (all time)" value={fmtMoneyFull(net)} accent tone={net >= 0 ? "positive" : "negative"} />
        <Kpi label="Total income" value={fmtMoneyFull(d.totalIncome)} />
        <Kpi label="Total expenses" value={fmtMoneyFull(d.totalExpenses)} />
        <Kpi label="Assets" value={fmtMoneyFull(d.assetsTotal)} />
      </div>

      <Card title="Income vs expenses by month">
        <CashflowChart data={d.months} />
      </Card>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <Card title="By life-area tag">
          <TagBars data={d.totalsByTag} />
        </Card>

        <Card title="Tag roll-up" padded={false}>
          <TableWrap>
            <table className="w-full text-sm">
              <thead className="text-xs text-neutral-500">
                <tr className="text-left">
                  <Th>Tag</Th>
                  <Th right>Income</Th>
                  <Th right>Expenses</Th>
                  <Th right>Net</Th>
                </tr>
              </thead>
              <tbody>
                {d.totalsByTag.map((t) => (
                  <tr key={t.tag} className="border-t border-neutral-100 dark:border-neutral-800">
                    <Td>{t.tag}</Td>
                    <Td right muted={t.income === 0}>{fmtMoneyFull(t.income)}</Td>
                    <Td right muted={t.expenses === 0}>{fmtMoneyFull(t.expenses)}</Td>
                    <Td
                      right
                      className={
                        t.net > 0
                          ? "text-emerald-600 dark:text-emerald-400 font-medium"
                          : t.net < 0
                            ? "text-rose-600 dark:text-rose-400 font-medium"
                            : "text-neutral-400"
                      }
                    >
                      {fmtMoneyFull(t.net)}
                    </Td>
                  </tr>
                ))}
              </tbody>
            </table>
          </TableWrap>
        </Card>
      </div>

      <Card title="Monthly breakdown" padded={false}>
        {d.months.length === 0 ? (
          <div className="p-4">
            <Empty>No transactions yet.</Empty>
          </div>
        ) : (
          <TableWrap>
            <table className="w-full text-sm">
              <thead className="text-xs text-neutral-500">
                <tr className="text-left">
                  <Th>Month</Th>
                  <Th right>Income</Th>
                  <Th right>Expenses</Th>
                  <Th right>Net</Th>
                </tr>
              </thead>
              <tbody>
                {d.months.map((m) => (
                  <tr key={m.month} className="border-t border-neutral-100 dark:border-neutral-800">
                    <Td>{fmtMonth(m.month)}</Td>
                    <Td right muted={m.income === 0}>{fmtMoneyFull(m.income)}</Td>
                    <Td right muted={m.expenses === 0}>{fmtMoneyFull(m.expenses)}</Td>
                    <Td
                      right
                      className={
                        m.net >= 0
                          ? "text-emerald-600 dark:text-emerald-400 font-medium"
                          : "text-rose-600 dark:text-rose-400 font-medium"
                      }
                    >
                      {fmtMoneyFull(m.net)}
                    </Td>
                  </tr>
                ))}
              </tbody>
            </table>
          </TableWrap>
        )}
      </Card>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <Card
          title="Recent expenses"
          padded={false}
          action={
            <Link href="/ephemeris/expenses?from=&to=" className="text-xs text-indigo-600 dark:text-indigo-400 hover:underline">
              View all
            </Link>
          }
        >
          {d.recentExpenses.length === 0 ? (
            <div className="p-4">
              <Empty>None yet.</Empty>
            </div>
          ) : (
            <TableWrap>
              <table className="w-full text-sm">
                <thead className="text-xs text-neutral-500">
                  <tr className="text-left">
                    <Th>Date</Th>
                    <Th>Description</Th>
                    <Th>Tag</Th>
                    <Th right>Amount</Th>
                  </tr>
                </thead>
                <tbody>
                  {d.recentExpenses.map((e) => (
                    <tr key={e.id} className="border-t border-neutral-100 dark:border-neutral-800">
                      <Td muted>{e.date}</Td>
                      <Td className="max-w-[16rem] truncate">{e.merchant || e.description}</Td>
                      <Td><TagPill name={e.tag_name} /></Td>
                      <Td right>{fmtMoneyExact(e.amount)}</Td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </TableWrap>
          )}
        </Card>

        <Card
          title="Recent income"
          padded={false}
          action={
            <Link href="/ephemeris/income" className="text-xs text-indigo-600 dark:text-indigo-400 hover:underline">
              View all
            </Link>
          }
        >
          {d.recentIncome.length === 0 ? (
            <div className="p-4">
              <Empty>None yet.</Empty>
            </div>
          ) : (
            <TableWrap>
              <table className="w-full text-sm">
                <thead className="text-xs text-neutral-500">
                  <tr className="text-left">
                    <Th>Date</Th>
                    <Th>Description</Th>
                    <Th>Tag</Th>
                    <Th right>Amount</Th>
                  </tr>
                </thead>
                <tbody>
                  {d.recentIncome.map((i) => (
                    <tr key={i.id} className="border-t border-neutral-100 dark:border-neutral-800">
                      <Td muted>{i.date}</Td>
                      <Td className="max-w-[16rem] truncate">{i.description}</Td>
                      <Td><TagPill name={i.tag_name} /></Td>
                      <Td right className="text-emerald-600 dark:text-emerald-400 font-medium">
                        {fmtMoneyExact(i.amount)}
                      </Td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </TableWrap>
          )}
        </Card>
      </div>
    </div>
  );
}
