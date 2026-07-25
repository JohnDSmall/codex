import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { loadContactById } from "@/lib/contacts-server";
import { updateContactAndRedirect } from "@/lib/actions";
import { displayName } from "@/lib/relationship";
import { RelationshipForm } from "../../../components/RelationshipForm";

export const dynamic = "force-dynamic";

export default async function EditRelationshipPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const contact = await loadContactById(id);
  if (!contact) notFound();

  return (
    <div className="mx-auto max-w-4xl px-4 sm:px-6 lg:px-8 py-6 space-y-6">
      <Link
        href={`/relationships/${id}`}
        className="inline-flex items-center gap-1.5 text-sm text-indigo-600 dark:text-indigo-400 hover:underline"
      >
        <ArrowLeft className="w-4 h-4" /> Back to {displayName(contact)}
      </Link>
      <header>
        <h1 className="text-2xl font-semibold">Edit {displayName(contact)}</h1>
        <p className="text-sm text-neutral-500">Update strength, follow-up dates, reminders, tags, and more.</p>
      </header>
      <RelationshipForm
        mode="edit"
        contact={contact}
        onSubmit={async (input) => {
          "use server";
          await updateContactAndRedirect(id, input);
        }}
        cancelHref={`/relationships/${id}`}
      />
    </div>
  );
}
