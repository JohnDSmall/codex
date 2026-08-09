import Link from "next/link";
import { loadAllContacts } from "@/lib/contacts-server";
import {
  competencyDistribution,
  strengthDistribution,
  summarize,
  topOrganizations,
} from "@/lib/stats";
import { Dashboard } from "../../components/Dashboard";

export const dynamic = "force-dynamic";

export default async function NetworkDashboardPage() {
  const contacts = await loadAllContacts();
  const summary = summarize(contacts);
  const orgs = topOrganizations(contacts);
  const competency = competencyDistribution(contacts);
  const strength = strengthDistribution(contacts);
  return (
    <div>
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 pt-6">
        <Link
          href="/relationships"
          className="text-sm text-indigo-600 dark:text-indigo-400 hover:underline"
        >
          ← Back to Relationships
        </Link>
      </div>
      <Dashboard
        contacts={contacts}
        summary={summary}
        topOrgs={orgs}
        competency={competency}
        strength={strength}
      />
    </div>
  );
}
