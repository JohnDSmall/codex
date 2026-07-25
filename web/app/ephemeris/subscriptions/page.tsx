import Link from "next/link";
import { setSubscriptionStatus } from "@/lib/ephemeris-actions";
import {
  filtersFromSearchParams,
  loadCards,
  loadSubscriptions,
  loadTags,
  type RawSearchParams,
  type SubscriptionShow,
} from "@/lib/ephemeris-server";
import { Filters } from "../../components/ephemeris/Filters";
import { SubscriptionActions } from "../../components/ephemeris/SubscriptionActions";
import {
  Card,
  Empty,
  Kpi,
  TableWrap,
  Td,
  Th,
  fmtMoneyExact,
  fmtMoneyFull,
} from "../../components/ephemeris/ui";

export const dynamic = "force-dynamic";

export default async function SubscriptionsPage({
  searchParams,
}: {
  searchParams: Promise<RawSearchParams>;
}) {
  const sp = await searchParams;

  // Subscriptions span the whole history, so unlike the other screens the
  // default here is all-time rather than last-completed-month.
  const base = filtersFromSearchParams(sp);
  const hasRange = "from" in sp || "to" in sp;
  const filters = hasRange ? base : { ...base, from_date: null, to_date: null };

  const rawShow = Array.isArray(sp.show) ? sp.show[0] : sp.show;
  const show: SubscriptionShow =
    rawShow === "rejected" || rawShow === "all" ? rawShow : "auto";
  const activeOnly = (Array.isArray(sp.active) ? sp.active[0] : sp.active) !== "0";

  const [{ subs, totalMonthly, totalAnnual }, tags, cards] = await Promise.all([
    loadSubscriptions(filters, { activeOnly, show }),
    loadTags(),
    loadCards(),
  ]);

  const q = (over: Record<string, string>) => {
    const p = new URLSearchParams();
    p.set("show", over.show ?? show);
    p.set("active", over.active ?? (activeOnly ? "1" : "0"));
    if (hasRange) {
      p.set("from", filters.from_date ?? "");
      p.set("to", filters.to_date ?? "");
    }
    if (filters.tag) p.set("tag", filters.tag);
    if (filters.card) p.set("card", filters.card);
    return `/ephemeris/subscriptions?${p.toString()}`;
  };

  const toggleCls = (on: boolean) =>
    "rounded-md px-2.5 py-1 text-xs transition-colors " +
    (on
      ? "bg-indigo-50 dark:bg-indigo-500/10 text-indigo-700 dark:text-indigo-300 font-medium"
      : "text-neutral-500 hover:bg-neutral-100 dark:hover:bg-neutral-800");

  return (
    <div className="space-y-6">
      <Filters
        basePath="/ephemeris/subscriptions"
        filters={filters}
        tags={tags}
        cards={cards}
        showSearch={false}
        extraHidden={{ show, active: activeOnly ? "1" : "0" }}
      />

      <div className="flex flex-wrap items-center gap-4">
        <div className="flex flex-wrap items-center gap-1.5">
          <span className="text-xs text-neutral-400">Show:</span>
          <Link href={q({ show: "auto" })} className={toggleCls(show === "auto")}>Detected</Link>
          <Link href={q({ show: "rejected" })} className={toggleCls(show === "rejected")}>Rejected</Link>
          <Link href={q({ show: "all" })} className={toggleCls(show === "all")}>All</Link>
        </div>
        <div className="flex flex-wrap items-center gap-1.5">
          <span className="text-xs text-neutral-400">Status:</span>
          <Link href={q({ active: "1" })} className={toggleCls(activeOnly)}>Active only</Link>
          <Link href={q({ active: "0" })} className={toggleCls(!activeOnly)}>Include inactive</Link>
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <Kpi label="Monthly cost" value={fmtMoneyFull(totalMonthly)} accent />
        <Kpi label="Annual cost" value={fmtMoneyFull(totalAnnual)} />
        <Kpi label="Subscriptions" value={String(subs.length)} />
      </div>

      <Card title="Recurring merchants" padded={false}>
        {subs.length === 0 ? (
          <div className="p-4">
            <Empty>
              Nothing detected. A merchant needs at least 3 charges across 2+ months, a stable
              amount, and a regular cadence to qualify.
            </Empty>
          </div>
        ) : (
          <TableWrap>
            <table className="w-full text-sm">
              <thead className="text-xs text-neutral-500">
                <tr className="text-left">
                  <Th>Merchant</Th>
                  <Th>Cadence</Th>
                  <Th right>Charges</Th>
                  <Th right>Avg</Th>
                  <Th right>Monthly</Th>
                  <Th right>Annual</Th>
                  <Th>Last seen</Th>
                  <Th>State</Th>
                  <Th right>{""}</Th>
                </tr>
              </thead>
              <tbody>
                {subs.map((s) => (
                  <tr key={s.merchant} className="border-t border-neutral-100 dark:border-neutral-800">
                    <Td className="max-w-[16rem] truncate font-medium">{s.merchant}</Td>
                    <Td muted>{s.cadence}</Td>
                    <Td right muted>{s.n}</Td>
                    <Td right>{fmtMoneyExact(s.avgAmount)}</Td>
                    <Td right className="font-medium">{fmtMoneyExact(s.monthlyCost)}</Td>
                    <Td right muted>{fmtMoneyFull(s.annualCost)}</Td>
                    <Td muted>{s.lastDate}</Td>
                    <Td>
                      <div className="flex flex-wrap items-center gap-1">
                        <span
                          className={
                            "inline-flex items-center rounded-md px-2 py-0.5 text-xs whitespace-nowrap " +
                            (s.active
                              ? "bg-emerald-50 dark:bg-emerald-500/10 text-emerald-700 dark:text-emerald-400"
                              : "bg-neutral-100 dark:bg-neutral-800 text-neutral-500")
                          }
                        >
                          {s.active ? "active" : "inactive"}
                        </span>
                        {s.status && (
                          <span
                            className={
                              "inline-flex items-center rounded-md px-2 py-0.5 text-xs whitespace-nowrap " +
                              (s.status === "confirmed"
                                ? "bg-indigo-50 dark:bg-indigo-500/10 text-indigo-700 dark:text-indigo-300"
                                : "bg-rose-50 dark:bg-rose-500/10 text-rose-700 dark:text-rose-400")
                            }
                          >
                            {s.status}
                          </span>
                        )}
                      </div>
                    </Td>
                    <Td right>
                      <SubscriptionActions
                        merchant={s.merchant}
                        status={s.status}
                        onSet={async (action) => {
                          "use server";
                          await setSubscriptionStatus(s.merchant, action);
                        }}
                      />
                    </Td>
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
