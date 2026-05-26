import { eq } from "drizzle-orm";

import { clusters } from "@korepush/db";
import { AppShell } from "../../../components/app-shell";
import { db } from "../../../lib/db";

export const dynamic = "force-dynamic";

export default async function ClustersPage() {
  const [cluster] = await db.select().from(clusters).where(eq(clusters.slug, "local")).limit(1);

  return (
    <AppShell>
      <div className="page-head">
        <div>
          <h1 className="page-title">Clusters</h1>
          <p className="page-subtitle">The MVP manages the local in-cluster K3s cluster.</p>
        </div>
      </div>
      <section className="panel">
        <div className="panel-body">
          <table className="table">
            <tbody>
              <tr>
                <th>Name</th>
                <td>{cluster?.name ?? "Local K3s"}</td>
              </tr>
              <tr>
                <th>Status</th>
                <td>
                  <span className={`status ${cluster?.status ?? "registered"}`}>{cluster?.status ?? "registered"}</span>
                </td>
              </tr>
              <tr>
                <th>Registry</th>
                <td>{cluster?.defaultRegistryUrl ?? process.env.REGISTRY_URL}</td>
              </tr>
              <tr>
                <th>Ingress class</th>
                <td>{cluster?.defaultIngressClass ?? "traefik"}</td>
              </tr>
            </tbody>
          </table>
        </div>
      </section>
    </AppShell>
  );
}
