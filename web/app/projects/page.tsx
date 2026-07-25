import { loadAllProjects } from "@/lib/projects-server";
import { ProjectsList } from "../components/ProjectsList";

export const dynamic = "force-dynamic";

export default async function ProjectsPage() {
  const projects = await loadAllProjects();
  return (
    <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 py-8 space-y-6">
      <header>
        <h1 className="text-2xl font-semibold">Projects</h1>
        <p className="text-sm text-neutral-500">{projects.length} projects · client work, status, revenue</p>
      </header>
      <ProjectsList projects={projects} />
    </div>
  );
}
