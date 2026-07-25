import Link from "next/link";
import { Plus } from "lucide-react";
import { loadAllContacts } from "@/lib/contacts-server";
import { RelationshipsList } from "../components/RelationshipsList";

export const dynamic = "force-dynamic";

export default async function RelationshipsPage() {
  const contacts = await loadAllContacts();
  return (
    <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 py-8 space-y-6">
      <header className="flex items-end justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-2xl font-semibold">Relationships</h1>
          <p className="text-sm text-neutral-500">
            {contacts.length.toLocaleString()} people in your network
          </p>
        </div>
        <div className="flex items-center gap-3">
          <Link
            href="/relationships/dashboard"
            className="text-sm text-indigo-600 dark:text-indigo-400 hover:underline"
          >
            View network analytics →
          </Link>
          <Link
            href="/relationships/new"
            className="inline-flex items-center gap-1.5 rounded-lg bg-indigo-600 hover:bg-indigo-500 px-3 py-2 text-sm font-medium text-white"
          >
            <Plus className="w-4 h-4" /> Add relationship
          </Link>
        </div>
      </header>

      <RelationshipsList contacts={contacts} />
    </div>
  );
}
