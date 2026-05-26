import { Boxes, Gauge, Settings, Server } from "lucide-react";
import Link from "next/link";

export function AppShell({ children }: { children: React.ReactNode }) {
  return (
    <div className="app-shell">
      <aside className="sidebar">
        <div className="brand">
          <span className="brand-mark">K</span>
          <span>Korepush</span>
        </div>
        <nav className="nav" aria-label="Main navigation">
          <Link href="/dashboard">
            <Gauge size={17} />
            Dashboard
          </Link>
          <Link href="/dashboard/projects/new">
            <Boxes size={17} />
            Projects
          </Link>
          <Link href="/dashboard/clusters">
            <Server size={17} />
            Clusters
          </Link>
          <Link href="/dashboard/settings">
            <Settings size={17} />
            Settings
          </Link>
        </nav>
      </aside>
      <main className="main">{children}</main>
    </div>
  );
}
