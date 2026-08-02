import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { loadClientSuggestions } from "@/lib/projects-server";
import { createProject } from "@/lib/projects-actions";
import { ProjectForm } from "../../components/ProjectForm";

export const dynamic = "force-dynamic";

export default async function NewProjectPage() {
  const clients = await loadClientSuggestions();
  return (
    <div className="mx-auto max-w-3xl px-4 sm:px-6 lg:px-8 py-8 space-y-6">
      <Link
        href="/projects"
        className="inline-flex items-center gap-1.5 text-sm text-neutral-500 hover:text-neutral-800 dark:hover:text-neutral-200"
      >
        <ArrowLeft className="w-4 h-4" /> All projects
      </Link>
      <h1 className="text-2xl font-semibold">New project</h1>
      <ProjectForm
        clients={clients}
        action={createProject}
        submitLabel="Create project"
        cancelHref="/projects"
      />
    </div>
  );
}
