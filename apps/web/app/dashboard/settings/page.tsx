import { AppShell } from "../../../components/app-shell";

export const dynamic = "force-dynamic";

export default function SettingsPage() {
  return (
    <AppShell>
      <div className="page-head">
        <div>
          <h1 className="page-title">Settings</h1>
          <p className="page-subtitle">Platform settings are stored in Postgres and seeded by the installer.</p>
        </div>
      </div>
      <section className="panel">
        <div className="panel-body">
          <table className="table">
            <tbody>
              <tr>
                <th>Base domain</th>
                <td>{process.env.PLATFORM_BASE_DOMAIN ?? "localhost"}</td>
              </tr>
              <tr>
                <th>Namespace</th>
                <td>{process.env.PLATFORM_NAMESPACE ?? "yourpaas-system"}</td>
              </tr>
            </tbody>
          </table>
        </div>
      </section>
    </AppShell>
  );
}
