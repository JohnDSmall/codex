import { addHours, deleteHours } from "@/lib/ephemeris-actions";
import { loadHours, loadTags, type RawSearchParams } from "@/lib/ephemeris-server";
import { AddPanel, DeleteButton, Field, SubmitButton, fieldCls } from "../../components/ephemeris/RowActions";
import { TagChips } from "../../components/ephemeris/TagChips";
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

const PAY_STATUSES = ["Paid", "Unpaid", "Invoiced"];

export default async function HoursPage({
  searchParams,
}: {
  searchParams: Promise<RawSearchParams>;
}) {
  const sp = await searchParams;
  const rawTag = Array.isArray(sp.tag) ? sp.tag[0] : sp.tag;
  const activeTag = rawTag && rawTag.trim() !== "" ? rawTag : null;

  const [rows, tags] = await Promise.all([loadHours(activeTag), loadTags()]);
  const totalHours = rows.reduce((s, r) => s + r.hours, 0);
  const totalValue = rows.reduce((s, r) => s + r.hours * (r.rate ?? 0), 0);
  const unpaidValue = rows
    .filter((r) => (r.pay_status ?? "").toLowerCase() !== "paid")
    .reduce((s, r) => s + r.hours * (r.rate ?? 0), 0);
  const today = new Date().toISOString().slice(0, 10);

  return (
    <div className="space-y-6">
      <TagChips tags={tags} active={activeTag} basePath="/ephemeris/hours" />

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <Kpi label="Total hours" value={totalHours.toLocaleString(undefined, { maximumFractionDigits: 2 })} accent />
        <Kpi label="Billable value" value={fmtMoneyFull(totalValue)} />
        <Kpi label="Not yet paid" value={fmtMoneyFull(unpaidValue)} tone={unpaidValue > 0 ? "negative" : undefined} />
      </div>

      <AddPanel title="Log hours" action={addHours}>
        <Field label="Date">
          <input type="date" name="date" required defaultValue={today} className={fieldCls} />
        </Field>
        <Field label="Hours">
          <input type="text" inputMode="decimal" name="hours" required placeholder="0.0" className={fieldCls} />
        </Field>
        <Field label="Rate">
          <input type="text" inputMode="decimal" name="rate" placeholder="optional" className={fieldCls} />
        </Field>
        <Field label="Status">
          <select name="pay_status" className={fieldCls} defaultValue="">
            <option value="">—</option>
            {PAY_STATUSES.map((s) => (
              <option key={s} value={s}>{s}</option>
            ))}
          </select>
        </Field>
        <Field label="Client">
          <input type="text" name="client" className={fieldCls} />
        </Field>
        <Field label="Project">
          <input type="text" name="project" className={fieldCls} />
        </Field>
        <Field label="Tag">
          <select name="tag_id" required className={fieldCls} defaultValue="">
            <option value="" disabled>Select…</option>
            {tags.map((t) => (
              <option key={t.id} value={t.id}>{t.name}</option>
            ))}
          </select>
        </Field>
        <Field label="Description" grow>
          <input type="text" name="description" className={fieldCls + " w-full"} />
        </Field>
        <SubmitButton>Log hours</SubmitButton>
      </AddPanel>

      <Card title={`Hours (${rows.length})`} padded={false}>
        {rows.length === 0 ? (
          <div className="p-4"><Empty>No hours logged.</Empty></div>
        ) : (
          <TableWrap>
            <table className="w-full text-sm">
              <thead className="text-xs text-neutral-500">
                <tr className="text-left">
                  <Th>Date</Th>
                  <Th>Client</Th>
                  <Th>Project</Th>
                  <Th>Description</Th>
                  <Th>Tag</Th>
                  <Th>Status</Th>
                  <Th right>Hours</Th>
                  <Th right>Rate</Th>
                  <Th right>Value</Th>
                  <Th right>{""}</Th>
                </tr>
              </thead>
              <tbody>
                {rows.map((r) => (
                  <tr key={r.id} className="border-t border-neutral-100 dark:border-neutral-800">
                    <Td muted>{r.date}</Td>
                    <Td>{r.client ?? ""}</Td>
                    <Td muted>{r.project ?? ""}</Td>
                    <Td className="max-w-[16rem] truncate" muted>{r.description ?? ""}</Td>
                    <Td><TagPill name={r.tag_name} /></Td>
                    <Td muted>{r.pay_status ?? ""}</Td>
                    <Td right>{r.hours}</Td>
                    <Td right muted>{r.rate == null ? "—" : fmtMoneyFull(r.rate)}</Td>
                    <Td right className="font-medium">{fmtMoneyFull(r.hours * (r.rate ?? 0))}</Td>
                    <Td right>
                      <DeleteButton
                        label={`${r.hours}h on ${r.date}`}
                        onDelete={async () => {
                          "use server";
                          await deleteHours(r.id);
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
