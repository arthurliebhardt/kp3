import { desc, eq, isNull } from "drizzle-orm";
import Link from "next/link";

import { AppShell } from "../../components/app-shell";
import { db } from "../../lib/db";
import { deployments, domains, projects } from "@korepush/db";

export const dynamic = "force-dynamic";

export default async function DashboardPage() {
  const projectRows = await db
    .select({
      id: projects.id,
      name: projects.name,
      slug: projects.slug,
      repo: projects.gitRepoUrl
    })
    .from(projects)
    .where(isNull(projects.deletedAt))
    .orderBy(desc(projects.createdAt))
    .limit(20);

  const latestDeployments = await db.select().from(deployments).orderBy(desc(deployments.createdAt)).limit(20);
  const domainRows = await db.select().from(domains).where(eq(domains.isPrimary, true));

  return (
    <AppShell>
      <div className="page-head">
        <div>
          <h1 className="page-title">Dashboard</h1>
          <p className="page-subtitle">Projects, latest deployment state, and quick deploy actions.</p>
        </div>
        <Link className="button primary" href="/dashboard/projects/new">
          New project
        </Link>
      </div>

      <section className="panel">
        <div className="panel-header">
          <h2 className="panel-title">Projects</h2>
        </div>
        <div className="panel-body">
          {projectRows.length === 0 ? (
            <p className="page-subtitle">Create your first project.</p>
          ) : (
            <table className="table">
              <thead>
                <tr>
                  <th>Name</th>
                  <th>Repository</th>
                  <th>Status</th>
                  <th>Domain</th>
                  <th />
                </tr>
              </thead>
              <tbody>
                {projectRows.map((project) => {
                  const latest = latestDeployments.find((deployment) => deployment.projectId === project.id);
                  const primaryDomain = domainRows.find((domain) => domain.projectId === project.id);
                  return (
                    <tr key={project.id}>
                      <td>
                        <Link href={`/dashboard/projects/${project.id}`}>{project.name}</Link>
                      </td>
                      <td>{project.repo}</td>
                      <td>
                        <span className={`status ${latest?.status ?? "queued"}`}>{latest?.status ?? "not deployed"}</span>
                      </td>
                      <td>{primaryDomain?.hostname ?? "No domain"}</td>
                      <td>
                        <Link className="button" href={`/dashboard/projects/${project.id}`}>
                          Open
                        </Link>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </div>
      </section>
    </AppShell>
  );
}
