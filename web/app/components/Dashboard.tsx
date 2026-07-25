"use client";

import { useState } from "react";
import type { Contact } from "@/lib/types";
import type { AreaCodeCount, OrgCount, Summary } from "@/lib/stats";
import { StatsCards } from "./StatsCards";
import { TopOrgsChart } from "./TopOrgsChart";
import { AreaCodeChart } from "./AreaCodeChart";
import { ContactsTable } from "./ContactsTable";
import { ContactDetail } from "./ContactDetail";

export function Dashboard({
  contacts,
  summary,
  topOrgs,
  topAreaCodes,
}: {
  contacts: Contact[];
  summary: Summary;
  topOrgs: OrgCount[];
  topAreaCodes: AreaCodeCount[];
}) {
  const [selected, setSelected] = useState<Contact | null>(null);

  return (
    <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 py-8 space-y-6">
      <header className="flex items-baseline justify-between">
        <div>
          <h1 className="text-2xl font-semibold">Contacts</h1>
          <p className="text-sm text-neutral-500">From iCloud · {summary.total.toLocaleString()} entries</p>
        </div>
      </header>

      <StatsCards s={summary} />

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <Panel title="Top organizations">
          <TopOrgsChart data={topOrgs} />
        </Panel>
        <Panel title="Top area codes">
          <AreaCodeChart data={topAreaCodes} />
        </Panel>
      </div>

      <ContactsTable contacts={contacts} onSelect={setSelected} />

      {selected && <ContactDetail contact={selected} onClose={() => setSelected(null)} />}
    </div>
  );
}

function Panel({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="rounded-xl border border-neutral-200 dark:border-neutral-800 bg-white dark:bg-neutral-900 p-4">
      <h2 className="text-sm font-medium text-neutral-700 dark:text-neutral-300 mb-3">{title}</h2>
      {children}
    </div>
  );
}
