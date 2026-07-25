import {
  filtersFromSearchParams,
  loadCards,
  loadCategories,
  loadSpending,
  loadTags,
  type RawSearchParams,
} from "@/lib/ephemeris-server";
import { CategoryDonut, MonthlySpendBars } from "../../components/ephemeris/Charts";
import { Filters, RangeLabel } from "../../components/ephemeris/Filters";
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
} from "../../components/ephemeris/ui";

export const dynamic = "force-dynamic";

export default async function SpendingPage({
  searchParams,
}: {
  // Next 16: searchParams is a Promise and must be awaited.
  searchParams: Promise<RawSearchParams>;
}) {
  const sp = await searchParams;
  const filters = filtersFromSearchParams(sp);

  const [data, tags, cards, categories] = await Promise.all([
    loadSpending(filters),
    loadTags(),
    loadCards(),
    loadCategories(),
  ]);

  return (
    <div className="space-y-6">
      <Filters
        basePath="/ephemeris/spending"
        filters={filters}
        tags={tags}
        cards={cards}
        categories={categories}
        showCategory
      />

      <p className="text-sm text-neutral-500">
        {data.kpi.n} transaction{data.kpi.n === 1 ? "" : "s"} · <RangeLabel filters={filters} />
      </p>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
        <Kpi label="Total" value={fmtMoneyFull(data.kpi.total)} accent />
        <Kpi label="Transactions" value={String(data.kpi.n)} />
        <Kpi label="Avg / transaction" value={fmtMoneyFull(data.kpi.avg)} />
        <Kpi
          label="Avg / month"
          value={fmtMoneyFull(data.kpi.monthlyAvg)}
          hint={`trailing 3 months · ${data.kpi.monthlyAvgWindow}`}
        />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <Card title="By category">
          <CategoryDonut data={data.byCategory} />
        </Card>
        <Card title="By month">
          <MonthlySpendBars data={data.byMonth} />
        </Card>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <Card title="By card" padded={false}>
          {data.byCard.length === 0 ? (
            <div className="p-4"><Empty>No data in this range.</Empty></div>
          ) : (
            <TableWrap>
              <table className="w-full text-sm">
                <thead className="text-xs text-neutral-500">
                  <tr className="text-left">
                    <Th>Card</Th>
                    <Th right>Txns</Th>
                    <Th right>Total</Th>
                  </tr>
                </thead>
                <tbody>
                  {data.byCard.map((c) => (
                    <tr key={c.card} className="border-t border-neutral-100 dark:border-neutral-800">
                      <Td>{c.card}</Td>
                      <Td right muted>{c.n}</Td>
                      <Td right className="font-medium">{fmtMoneyFull(c.total)}</Td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </TableWrap>
          )}
        </Card>

        <Card title="Top merchants" padded={false}>
          {data.topMerchants.length === 0 ? (
            <div className="p-4"><Empty>No data in this range.</Empty></div>
          ) : (
            <TableWrap>
              <table className="w-full text-sm">
                <thead className="text-xs text-neutral-500">
                  <tr className="text-left">
                    <Th>Merchant</Th>
                    <Th right>Txns</Th>
                    <Th right>Total</Th>
                  </tr>
                </thead>
                <tbody>
                  {data.topMerchants.map((m) => (
                    <tr key={m.merchant} className="border-t border-neutral-100 dark:border-neutral-800">
                      <Td className="max-w-[18rem] truncate">{m.merchant}</Td>
                      <Td right muted>{m.n}</Td>
                      <Td right className="font-medium">{fmtMoneyFull(m.total)}</Td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </TableWrap>
          )}
        </Card>
      </div>

      <Card
        title={`Transactions${data.rows.length >= 200 ? " (first 200)" : ""}`}
        padded={false}
      >
        {data.rows.length === 0 ? (
          <div className="p-4"><Empty>No transactions match these filters.</Empty></div>
        ) : (
          <TableWrap>
            <table className="w-full text-sm">
              <thead className="text-xs text-neutral-500">
                <tr className="text-left">
                  <Th>Date</Th>
                  <Th>Merchant / description</Th>
                  <Th>Category</Th>
                  <Th>Tag</Th>
                  <Th>Card</Th>
                  <Th right>Amount</Th>
                </tr>
              </thead>
              <tbody>
                {data.rows.map((r) => (
                  <tr key={r.id} className="border-t border-neutral-100 dark:border-neutral-800">
                    <Td muted>{r.date}</Td>
                    <Td className="max-w-[20rem] truncate">{r.merchant || r.description}</Td>
                    <Td muted>{r.cat_name ?? "Uncategorized"}</Td>
                    <Td><TagPill name={r.tag_name} /></Td>
                    <Td muted>{r.card ?? "manual"}</Td>
                    <Td right className="font-medium">{fmtMoneyExact(r.amount)}</Td>
                  </tr>
                ))}
              </tbody>
            </table>
          </TableWrap>
        )}
      </Card>
    </div>
  );
}
