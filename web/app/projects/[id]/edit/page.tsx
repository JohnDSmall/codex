import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { loadClientSuggestions, loadProjectById } from "@/lib/projects-server";
import { updateProject } from "@/lib/projects-actions";
import { ProjectForm } from "../../../components/ProjectForm";

export const dynamic = "force-dynamic";

export default async function EditProjectPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const [project, clients] = await Promise.all([
    loadProjectById(id),
    loadClientSuggestions(),
  ]);
  if (!project) notFound();

  return (
    <div className="mx-auto max-w-3xl px-4 sm:px-6 lg:px-8 py-8 space-y-6">
      <Link
        href={`/projects/${id}`}
        className="inline-flex items-center gap-1.5 text-sm text-neutral-500 hover:text-neutral-800 dark:hover:text-neutral-200"
      >
        <ArrowLeft className="w-4 h-4" /> Back to {project.name}
      </Link>
      <h1 className="text-2xl font-semibold">Edit project</h1>
      <ProjectForm
        project={project}
        clients={clients}
        action={updateProject.bind(null, id)}
        submitLabel="Save changes"
        cancelHref={`/projects/${id}`}
      />
    </div>
  );
}
