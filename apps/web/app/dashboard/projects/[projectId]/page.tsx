import { desc, eq } from "drizzle-orm";
import Link from "next/link";
import { notFound } from "next/navigation";

import { deployments, domains, environments, projects } from "@korepush/db";
import { AppShell } from "../../../../components/app-shell";
import { db } from "../../../../lib/db";

export const dynamic = "force-dynamic";

export default async function ProjectPage({ params }: { params: Promise<{ projectId: string }> }) {
  const { projectId } = await params;
  const [project] = await db.select().from(projects).where(eq(projects.id, projectId)).limit(1);
  if (!project) notFound();

  const [environment] = await db.select().from(environments).where(eq(environments.projectId, project.id)).limit(1);
  const [latest] = await db.select().from(deployments).where(eq(deployments.projectId, project.id)).orderBy(desc(deployments.createdAt)).limit(1);
  const domainRows = await db.select().from(domains).where(eq(domains.projectId, project.id));

  return (
    <AppShell>
      <div className="page-head">
        <div>
          <h1 className="page-title">{project.name}</h1>
          <p className="page-subtitle">{project.gitRepoUrl}</p>
        </div>
        <form action={`/api/projects/${project.id}/deployments`} method="post">
          <input type="hidden" name="environmentId" value={environment?.id} />
          <input type="hidden" name="gitRef" value={project.gitDefaultBranch} />
          <button className="button primary" type="submit">
            Deploy
          </button>
        </form>
      </div>

      <div className="grid two">
        <section className="panel">
          <div className="panel-header">
            <h2 className="panel-title">Overview</h2>
          </div>
          <div className="panel-body">
            <table className="table">
              <tbody>
                <tr>
                  <th>Status</th>
                  <td>
                    <span className={`status ${latest?.status ?? "queued"}`}>{latest?.status ?? "not deployed"}</span>
                  </td>
                </tr>
                <tr>
                  <th>Branch</th>
                  <td>{project.gitDefaultBranch}</td>
                </tr>
                <tr>
                  <th>Dockerfile</th>
                  <td>{project.dockerfilePath}</td>
                </tr>
                <tr>
                  <th>Context</th>
                  <td>{project.buildContext}</td>
                </tr>
                <tr>
                  <th>Port</th>
                  <td>{project.port}</td>
                </tr>
              </tbody>
            </table>
          </div>
        </section>

        <section className="panel">
          <div className="panel-header">
            <h2 className="panel-title">Actions</h2>
          </div>
          <div className="panel-body grid">
            <Link className="button" href={`/dashboard/projects/${project.id}/env`}>
              Environment variables
            </Link>
            <Link className="button" href={`/dashboard/projects/${project.id}/domains`}>
              Domains
            </Link>
            <Link className="button" href={`/dashboard/projects/${project.id}/settings`}>
              Settings
            </Link>
          </div>
        </section>
      </div>

      <section className="panel" style={{ marginTop: 16 }}>
        <div className="panel-header">
          <h2 className="panel-title">Deployments</h2>
        </div>
        <div className="panel-body">
          <table className="table">
            <thead>
              <tr>
                <th>ID</th>
                <th>Status</th>
                <th>Source</th>
                <th>Commit</th>
                <th>Image</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {[latest].filter(Boolean).map((deployment) => (
                <tr key={deployment.id}>
                  <td>{deployment.id.slice(0, 8)}</td>
                  <td>
                    <span className={`status ${deployment.status}`}>{deployment.status}</span>
                  </td>
                  <td>{deployment.source}</td>
                  <td>{deployment.commitSha?.slice(0, 8) ?? "pending"}</td>
                  <td>{deployment.imageDigest ?? deployment.imageTag ?? "pending"}</td>
                  <td>
                    <Link className="button" href={`/dashboard/projects/${project.id}/deployments/${deployment.id}`}>
                      Details
                    </Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <section className="panel" style={{ marginTop: 16 }}>
        <div className="panel-header">
          <h2 className="panel-title">Domains</h2>
        </div>
        <div className="panel-body">
          {domainRows.length ? domainRows.map((domain) => <p key={domain.id}>{domain.hostname}</p>) : <p className="page-subtitle">No domains configured.</p>}
        </div>
      </section>
    </AppShell>
  );
}
