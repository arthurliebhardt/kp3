import { eq } from "drizzle-orm";
import { notFound } from "next/navigation";

import { projects } from "@korepush/db";
import { AppShell } from "../../../../../components/app-shell";
import { db } from "../../../../../lib/db";

export const dynamic = "force-dynamic";

export default async function ProjectSettingsPage({ params }: { params: Promise<{ projectId: string }> }) {
  const { projectId } = await params;
  const [project] = await db.select().from(projects).where(eq(projects.id, projectId)).limit(1);
  if (!project) notFound();

  return (
    <AppShell>
      <div className="page-head">
        <div>
          <h1 className="page-title">Project settings</h1>
          <p className="page-subtitle">Repository, Dockerfile, build context, port, and deletion controls.</p>
        </div>
      </div>
      <section className="panel">
        <div className="panel-body">
          <form className="form" action={`/api/projects/${project.id}`} method="post">
            <div className="field">
              <label htmlFor="name">Project name</label>
              <input id="name" name="name" defaultValue={project.name} required />
            </div>
            <div className="field">
              <label htmlFor="repoUrl">Repository URL</label>
              <input id="repoUrl" name="repoUrl" defaultValue={project.gitRepoUrl} required />
            </div>
            <div className="grid two">
              <div className="field">
                <label htmlFor="dockerfilePath">Dockerfile path</label>
                <input id="dockerfilePath" name="dockerfilePath" defaultValue={project.dockerfilePath} required />
              </div>
              <div className="field">
                <label htmlFor="buildContext">Build context</label>
                <input id="buildContext" name="buildContext" defaultValue={project.buildContext} required />
              </div>
            </div>
            <button className="button primary" type="submit">
              Save settings
            </button>
          </form>
        </div>
      </section>
    </AppShell>
  );
}
