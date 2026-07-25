import { addIncome, deleteIncome } from "@/lib/ephemeris-actions";
import { INCOME_TYPES, loadIncome, loadTags, type RawSearchParams } from "@/lib/ephemeris-server";
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
  const rawTag = Array.isArray(sp.tag) ? sp.tag[0] : sp.tag;
  const activeTag = rawTag && rawTag.trim() !== "" ? rawTag : null;

  const [rows, tags] = await Promise.all([loadIncome(activeTag), loadTags()]);
  const total = rows.reduce((s, r) => s + r.amount, 0);
  const today = new Date().toISOString().slice(0, 10);

  return (
    <div className="space-y-6">
      <TagChips tags={tags} active={activeTag} basePath="/ephemeris/income" />

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
