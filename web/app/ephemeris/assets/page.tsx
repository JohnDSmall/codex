import { addAsset, deleteAsset } from "@/lib/ephemeris-actions";
import { loadAssets, loadTags } from "@/lib/ephemeris-server";
import { AddPanel, DeleteButton, Field, SubmitButton, fieldCls } from "../../components/ephemeris/RowActions";
import {
  Card,
  Empty,
  Kpi,
  TableWrap,
  TagPill,
  Td,
  Th,
  fmtMoneyFull,
} from "../../components/ephemeris/ui";

export const dynamic = "force-dynamic";

const ASSET_TYPES = ["Cash", "Brokerage", "Retirement", "Real Estate", "Crypto", "Receivable", "Other"];

export default async function AssetsPage() {
  const [rows, tags] = await Promise.all([loadAssets(), loadTags()]);
  const total = rows.reduce((s, r) => s + r.value, 0);
  const today = new Date().toISOString().slice(0, 10);

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <Kpi label="Total assets" value={fmtMoneyFull(total)} accent />
        <Kpi label="Items" value={String(rows.length)} />
      </div>

      <AddPanel title="Add asset" action={addAsset}>
        <Field label="Name" grow>
          <input type="text" name="name" required className={fieldCls + " w-full"} />
        </Field>
        <Field label="Type">
          <select name="asset_type" required className={fieldCls} defaultValue="">
            <option value="" disabled>Select…</option>
            {ASSET_TYPES.map((t) => (
              <option key={t} value={t}>{t}</option>
            ))}
          </select>
        </Field>
        <Field label="Value">
          <input type="text" inputMode="decimal" name="value" required placeholder="0.00" className={fieldCls} />
        </Field>
        <Field label="As of">
          <input type="date" name="as_of_date" required defaultValue={today} className={fieldCls} />
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
        <SubmitButton>Add asset</SubmitButton>
      </AddPanel>

      <Card title={`Assets (${rows.length})`} padded={false}>
        {rows.length === 0 ? (
          <div className="p-4">
            <Empty>
              No assets yet — the freelance seed data didn’t include any. Add one above.
            </Empty>
          </div>
        ) : (
          <TableWrap>
            <table className="w-full text-sm">
              <thead className="text-xs text-neutral-500">
                <tr className="text-left">
                  <Th>Name</Th>
                  <Th>Type</Th>
                  <Th>Tag</Th>
                  <Th>As of</Th>
                  <Th right>Value</Th>
                  <Th right>{""}</Th>
                </tr>
              </thead>
              <tbody>
                {rows.map((r) => (
                  <tr key={r.id} className="border-t border-neutral-100 dark:border-neutral-800">
                    <Td className="font-medium">{r.name}</Td>
                    <Td muted>{r.asset_type}</Td>
                    <Td><TagPill name={r.tag_name} /></Td>
                    <Td muted>{r.as_of_date}</Td>
                    <Td right className="font-medium">{fmtMoneyFull(r.value)}</Td>
                    <Td right>
                      <DeleteButton
                        label={`${r.name} (${fmtMoneyFull(r.value)})`}
                        onDelete={async () => {
                          "use server";
                          await deleteAsset(r.id);
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
