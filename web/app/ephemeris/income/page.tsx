import Link from "next/link";
import { addIncome, deleteIncome } from "@/lib/ephemeris-actions";
import {
  INCOME_TYPES,
  loadIncome,
  loadIncomeCompanyOptions,
  loadTags,
  type RawSearchParams,
} from "@/lib/ephemeris-server";
import { TagChips } from "../../components/ephemeris/TagChips";
import { AddPanel, DeleteButton, Field, SubmitButton, fieldCls } from "../../components/ephemeris/RowActions";
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

export default async function IncomePage({
  searchParams,
}: {
  searchParams: Promise<RawSearchParams>;
}) {
  const sp = await searchParams;
  const one = (v: string | string[] | undefined) => {
    const s = Array.isArray(v) ? v[0] : v;
    return s && s.trim() !== "" ? s : null;
  };
  const activeTag = one(sp.tag);
  const activeType = one(sp.type);
  const activeCompany = one(sp.company);

  const [rows, tags, companies] = await Promise.all([
    loadIncome(activeTag, { type: activeType, company: activeCompany }),
    loadTags(),
    loadIncomeCompanyOptions(),
  ]);
  const total = rows.reduce((s, r) => s + r.amount, 0);
  const today = new Date().toISOString().slice(0, 10);

  // Plain GET links, so filtering works without JS and combines with the others.
  const withParam = (key: string, value: string | null) => {
    const p = new URLSearchParams();
    if (activeTag) p.set("tag", activeTag);
    if (activeType) p.set("type", activeType);
    if (activeCompany) p.set("company", activeCompany);
    if (value === null) p.delete(key);
    else p.set(key, value);
    const qs = p.toString();
    return qs ? `/ephemeris/income?${qs}` : "/ephemeris/income";
  };
  const chip = (on: boolean) =>
    "rounded-md px-2.5 py-1 text-xs transition-colors " +
    (on
      ? "bg-indigo-50 dark:bg-indigo-500/10 text-indigo-700 dark:text-indigo-300 font-medium"
      : "text-neutral-500 hover:bg-neutral-100 dark:hover:bg-neutral-800");

  return (
    <div className="space-y-6">
      <TagChips tags={tags} active={activeTag} basePath="/ephemeris/income" />

      <div className="flex flex-wrap items-center gap-1.5">
        <span className="text-xs text-neutral-400">Type:</span>
        <Link href={withParam("type", null)} className={chip(!activeType)}>All</Link>
        {INCOME_TYPES.map((t) => (
          <Link key={t} href={withParam("type", t)} className={chip(activeType === t)}>{t}</Link>
        ))}
      </div>

      <div className="flex flex-wrap items-center gap-1.5">
        <span className="text-xs text-neutral-400">Company:</span>
        <Link href={withParam("company", null)} className={chip(!activeCompany)}>All</Link>
        {companies.map((c) => (
          <Link key={c} href={withParam("company", c)} className={chip(activeCompany === c)}>{c}</Link>
        ))}
        <Link href={withParam("company", "none")} className={chip(activeCompany === "none")}>
          (no company)
        </Link>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <Kpi label="Total income" value={fmtMoneyFull(total)} accent tone="positive" />
        <Kpi label="Rows" value={String(rows.length)} />
      </div>

      <AddPanel title="Add income" action={addIncome}>
        <Field label="Date">
          <input type="date" name="date" required defaultValue={today} className={fieldCls} />
        </Field>
        <Field label="Description" grow>
          <input type="text" name="description" required className={fieldCls + " w-full"} />
        </Field>
        <Field label="Amount">
          <input type="text" inputMode="decimal" name="amount" required placeholder="0.00" className={fieldCls} />
        </Field>
        <Field label="Type">
          <select name="income_type" className={fieldCls} defaultValue="">
            <option value="">—</option>
            {INCOME_TYPES.map((t) => (
              <option key={t} value={t}>{t}</option>
            ))}
          </select>
        </Field>
        <Field label="Company">
          <select name="company_id" className={fieldCls} defaultValue="">
            <option value="">—</option>
            {companies.map((c) => (
              <option key={c} value={c}>{c}</option>
            ))}
          </select>
        </Field>
        <Field label="Client">
          <input type="text" name="client" className={fieldCls} />
        </Field>
        <Field label="Tag">
          <select name="tag_id" required className={fieldCls} defaultValue="">
            <option value="" disabled>Select…</option>
            {tags.map((t) => (
              <option key={t.id} value={t.id}>{t.name}</option>
            ))}
          </select>
        </Field>
        <Field label="Notes" grow>
          <input type="text" name="notes" className={fieldCls + " w-full"} />
        </Field>
        <SubmitButton>Add income</SubmitButton>
      </AddPanel>

      <Card title={`Income (${rows.length})`} padded={false}>
        {rows.length === 0 ? (
          <div className="p-4"><Empty>No income rows.</Empty></div>
        ) : (
          <TableWrap>
            <table className="w-full text-sm">
              <thead className="text-xs text-neutral-500">
                <tr className="text-left">
                  <Th>Date</Th>
                  <Th>Description</Th>
                  <Th>Type</Th>
                  <Th>Company</Th>
                  <Th>Client</Th>
                  <Th>Tag</Th>
                  <Th right>Amount</Th>
                  <Th right>{""}</Th>
                </tr>
              </thead>
              <tbody>
                {rows.map((r) => (
                  <tr key={r.id} className="border-t border-neutral-100 dark:border-neutral-800">
                    <Td muted>{r.date}</Td>
                    <Td className="max-w-[20rem] truncate">{r.description}</Td>
                    <Td muted>{r.income_type ?? ""}</Td>
                    <Td muted>{r.company_id ?? ""}</Td>
                    <Td muted>{r.client ?? ""}</Td>
                    <Td><TagPill name={r.tag_name} /></Td>
                    <Td right className="font-medium text-emerald-600 dark:text-emerald-400">
                      {fmtMoneyExact(r.amount)}
                    </Td>
                    <Td right>
                      <DeleteButton
                        label={`${r.description} (${fmtMoneyExact(r.amount)})`}
                        onDelete={async () => {
                          "use server";
                          await deleteIncome(r.id);
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
