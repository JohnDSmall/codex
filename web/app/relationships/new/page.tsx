import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { createContactAndRedirect } from "@/lib/actions";
import { RelationshipForm } from "../../components/RelationshipForm";

export default function NewRelationshipPage() {
  return (
    <div className="mx-auto max-w-4xl px-4 sm:px-6 lg:px-8 py-6 space-y-6">
      <Link
        href="/relationships"
        className="inline-flex items-center gap-1.5 text-sm text-indigo-600 dark:text-indigo-400 hover:underline"
      >
        <ArrowLeft className="w-4 h-4" /> Back to Relationships
      </Link>
      <header>
        <h1 className="text-2xl font-semibold">New relationship</h1>
        <p className="text-sm text-neutral-500">Add a person to your network.</p>
      </header>
      <RelationshipForm
        mode="create"
        onSubmit={async (input) => {
          "use server";
          await createContactAndRedirect(input);
        }}
        cancelHref="/relationships"
      />
    </div>
  );
}
