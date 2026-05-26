import { eq } from "drizzle-orm";
import { notFound } from "next/navigation";

import { domains, environments, projects } from "@korepush/db";
import { AppShell } from "../../../../../components/app-shell";
import { db } from "../../../../../lib/db";

export const dynamic = "force-dynamic";

export default async function DomainsPage({ params }: { params: Promise<{ projectId: string }> }) {
  const { projectId } = await params;
  const [project] = await db.select().from(projects).where(eq(projects.id, projectId)).limit(1);
  if (!project) notFound();
  const [environment] = await db.select().from(environments).where(eq(environments.projectId, project.id)).limit(1);
  const rows = await db.select().from(domains).where(eq(domains.projectId, project.id));

  return (
    <AppShell>
      <div className="page-head">
        <div>
          <h1 className="page-title">Domains</h1>
          <p className="page-subtitle">Add a hostname, point DNS to this server, and redeploy to apply Ingress.</p>
        </div>
      </div>
      <section className="panel">
        <div className="panel-body">
          <form className="form" action={`/api/projects/${project.id}/domains`} method="post">
            <input type="hidden" name="environmentId" value={environment?.id} />
            <div className="field">
              <label htmlFor="hostname">Hostname</label>
              <input id="hostname" name="hostname" placeholder="api.example.com" required />
            </div>
            <button className="button primary" type="submit">
              Add domain
            </button>
          </form>
        </div>
      </section>
      <section className="panel" style={{ marginTop: 16 }}>
        <div className="panel-header">
          <h2 className="panel-title">Configured domains</h2>
        </div>
        <div className="panel-body">
          <table className="table">
            <thead>
              <tr>
                <th>Hostname</th>
                <th>Primary</th>
                <th>Verification</th>
                <th>TLS</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => (
                <tr key={row.id}>
                  <td>{row.hostname}</td>
                  <td>{row.isPrimary ? "Yes" : "No"}</td>
                  <td>{row.verificationStatus}</td>
                  <td>{row.tlsStatus}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </AppShell>
  );
}
