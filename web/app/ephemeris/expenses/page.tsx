import { addExpense, deleteExpense } from "@/lib/ephemeris-actions";
import {
  filtersFromSearchParams,
  loadCards,
  loadCategories,
  loadExpenses,
  loadTags,
  type RawSearchParams,
} from "@/lib/ephemeris-server";
import { Filters, RangeLabel } from "../../components/ephemeris/Filters";
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

const TAX_STATUSES = ["Deductible", "Non-deductible", "Partial"];

export default async function ExpensesPage({
  searchParams,
}: {
  searchParams: Promise<RawSearchParams>;
}) {
  const sp = await searchParams;
  const filters = filtersFromSearchParams(sp);

  const [rows, tags, cards, categories] = await Promise.all([
    loadExpenses(filters),
    loadTags(),
    loadCards(),
    loadCategories(),
  ]);

  const total = rows.reduce((s, r) => s + r.amount, 0);
  const today = new Date().toISOString().slice(0, 10);

  return (
    <div className="space-y-6">
      <Filters
        basePath="/ephemeris/expenses"
        filters={filters}
        tags={tags}
        cards={cards}
        categories={categories}
        showCategory
      />

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <Kpi label="Total" value={fmtMoneyFull(total)} accent />
        <Kpi label="Rows" value={String(rows.length)} hint={<RangeLabel filters={filters} />} />
      </div>

      <AddPanel title="Add expense" action={addExpense}>
        <Field label="Date">
          <input type="date" name="date" required defaultValue={today} className={fieldCls} />
        </Field>
        <Field label="Description" grow>
          <input type="text" name="description" required className={fieldCls + " w-full"} />
        </Field>
        <Field label="Amount">
          <input type="text" inputMode="decimal" name="amount" required placeholder="0.00" className={fieldCls} />
        </Field>
        <Field label="Tag">
          <select name="tag_id" required className={fieldCls} defaultValue="">
            <option value="" disabled>Select…</option>
            {tags.map((t) => (
              <option key={t.id} value={t.id}>{t.name}</option>
            ))}
          </select>
        </Field>
        <Field label="Category">
          <select name="category_id" className={fieldCls} defaultValue="">
            <option value="">None</option>
            {categories.map((c) => (
              <option key={c.id} value={c.id}>{c.parent} · {c.name}</option>
            ))}
          </select>
        </Field>
        <Field label="Client">
          <input type="text" name="client" className={fieldCls} />
        </Field>
        <Field label="Tax status">
          <select name="tax_status" className={fieldCls} defaultValue="">
            <option value="">—</option>
            {TAX_STATUSES.map((s) => (
              <option key={s} value={s}>{s}</option>
            ))}
          </select>
        </Field>
        <Field label="Notes" grow>
          <input type="text" name="notes" className={fieldCls + " w-full"} />
        </Field>
        <SubmitButton>Add expense</SubmitButton>
      </AddPanel>

      <Card title={`Expenses (${rows.length})`} padded={false}>
        {rows.length === 0 ? (
          <div className="p-4">
            <Empty>
              No expenses match these filters. The default range is last month — try “All time”.
            </Empty>
          </div>
        ) : (
          <TableWrap>
            <table className="w-full text-sm">
              <thead className="text-xs text-neutral-500">
                <tr className="text-left">
                  <Th>Date</Th>
                  <Th>Merchant / description</Th>
                  <Th>Category</Th>
                  <Th>Tag</Th>
                  <Th>Client</Th>
                  <Th>Card</Th>
                  <Th right>Amount</Th>
                  <Th right>{""}</Th>
                </tr>
              </thead>
              <tbody>
                {rows.map((r) => (
                  <tr key={r.id} className="border-t border-neutral-100 dark:border-neutral-800">
                    <Td muted>{r.date}</Td>
                    <Td className="max-w-[20rem] truncate" >{r.merchant || r.description}</Td>
                    <Td muted>{r.cat_name ?? "Uncategorized"}</Td>
                    <Td><TagPill name={r.tag_name} /></Td>
                    <Td muted>{r.client ?? ""}</Td>
                    <Td muted>{r.card ?? "manual"}</Td>
                    <Td right className="font-medium">{fmtMoneyExact(r.amount)}</Td>
                    <Td right>
                      <DeleteButton
                        label={`${r.merchant || r.description} (${fmtMoneyExact(r.amount)})`}
                        onDelete={async () => {
                          "use server";
                          await deleteExpense(r.id);
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
