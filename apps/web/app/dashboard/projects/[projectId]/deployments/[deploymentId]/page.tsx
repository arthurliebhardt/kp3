import { eq } from "drizzle-orm";
import { notFound } from "next/navigation";

import { deploymentEvents, deployments, projects } from "@korepush/db";
import { AppShell } from "../../../../../../components/app-shell";
import { db } from "../../../../../../lib/db";

export const dynamic = "force-dynamic";

export default async function DeploymentDetailPage({
  params
}: {
  params: Promise<{ projectId: string; deploymentId: string }>;
}) {
  const { projectId, deploymentId } = await params;
  const [project] = await db.select().from(projects).where(eq(projects.id, projectId)).limit(1);
  const [deployment] = await db.select().from(deployments).where(eq(deployments.id, deploymentId)).limit(1);
  if (!project || !deployment) notFound();

  const events = await db.select().from(deploymentEvents).where(eq(deploymentEvents.deploymentId, deployment.id));

  return (
    <AppShell>
      <div className="page-head">
        <div>
          <h1 className="page-title">Deployment {deployment.id.slice(0, 8)}</h1>
          <p className="page-subtitle">{project.name}</p>
        </div>
        {deployment.status === "ready" ? (
          <form action={`/api/deployments/${deployment.id}/rollback`} method="post">
            <button className="button" type="submit">
              Rollback to this deployment
            </button>
          </form>
        ) : null}
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
                    <span className={`status ${deployment.status}`}>{deployment.status}</span>
                  </td>
                </tr>
                <tr>
                  <th>Source</th>
                  <td>{deployment.source}</td>
                </tr>
                <tr>
                  <th>Git ref</th>
                  <td>{deployment.gitRef}</td>
                </tr>
                <tr>
                  <th>Commit</th>
                  <td>{deployment.commitSha ?? "pending"}</td>
                </tr>
                <tr>
                  <th>Image</th>
                  <td>{deployment.imageDigest ?? deployment.imageTag ?? "pending"}</td>
                </tr>
                <tr>
                  <th>Failure</th>
                  <td>{deployment.failureReason ?? "None"}</td>
                </tr>
              </tbody>
            </table>
          </div>
        </section>

        <section className="panel">
          <div className="panel-header">
            <h2 className="panel-title">Build logs</h2>
          </div>
          <div className="panel-body">
            <pre className="code">Build log persistence is backed by deployment events in this scaffold.</pre>
          </div>
        </section>
      </div>

      <section className="panel" style={{ marginTop: 16 }}>
        <div className="panel-header">
          <h2 className="panel-title">Timeline</h2>
        </div>
        <div className="panel-body">
          <table className="table">
            <thead>
              <tr>
                <th>Time</th>
                <th>Type</th>
                <th>Message</th>
              </tr>
            </thead>
            <tbody>
              {events.map((event) => (
                <tr key={event.id}>
                  <td>{event.createdAt.toISOString()}</td>
                  <td>{event.type}</td>
                  <td>{event.message}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </AppShell>
  );
}
