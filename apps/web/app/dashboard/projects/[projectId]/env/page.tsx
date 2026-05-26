import { eq } from "drizzle-orm";
import { notFound } from "next/navigation";

import { envVars, environments, projects } from "@korepush/db";
import { AppShell } from "../../../../../components/app-shell";
import { db } from "../../../../../lib/db";

export const dynamic = "force-dynamic";

export default async function EnvVarsPage({ params }: { params: Promise<{ projectId: string }> }) {
  const { projectId } = await params;
  const [project] = await db.select().from(projects).where(eq(projects.id, projectId)).limit(1);
  if (!project) notFound();
  const [environment] = await db.select().from(environments).where(eq(environments.projectId, project.id)).limit(1);
  const rows = environment ? await db.select().from(envVars).where(eq(envVars.environmentId, environment.id)) : [];

  return (
    <AppShell>
      <div className="page-head">
        <div>
          <h1 className="page-title">Environment variables</h1>
          <p className="page-subtitle">Values are encrypted at rest and masked after creation.</p>
        </div>
      </div>
      <section className="panel">
        <div className="panel-body">
          <form className="form" action={`/api/projects/${project.id}/environments/${environment?.id}/env-vars`} method="post">
            <div className="grid two">
              <div className="field">
                <label htmlFor="key">Key</label>
                <input id="key" name="key" required />
              </div>
              <div className="field">
                <label htmlFor="value">Value</label>
                <input id="value" name="value" type="password" required />
              </div>
            </div>
            <button className="button primary" type="submit">
              Add variable
            </button>
          </form>
        </div>
      </section>
      <section className="panel" style={{ marginTop: 16 }}>
        <div className="panel-header">
          <h2 className="panel-title">Variables</h2>
        </div>
        <div className="panel-body">
          <table className="table">
            <thead>
              <tr>
                <th>Key</th>
                <th>Value</th>
                <th>Updated</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => (
                <tr key={row.id}>
                  <td>{row.key}</td>
                  <td>Masked</td>
                  <td>{row.updatedAt.toISOString()}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </AppShell>
  );
}
