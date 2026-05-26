import { AppShell } from "../../../../components/app-shell";

export default function NewProjectPage() {
  return (
    <AppShell>
      <div className="page-head">
        <div>
          <h1 className="page-title">New project</h1>
          <p className="page-subtitle">Public GitHub repositories can auto-detect Dockerfile, build context, branch, and port.</p>
        </div>
      </div>
      <section className="panel">
        <div className="panel-body">
          <form className="form" action="/api/projects" method="post">
            <div className="field">
              <label htmlFor="name">Project name</label>
              <input id="name" name="name" required />
            </div>
            <div className="field">
              <label htmlFor="repoUrl">Repository URL</label>
              <input id="repoUrl" name="repoUrl" placeholder="https://github.com/acme/api" required />
            </div>
            <div className="grid two">
              <div className="field">
                <label htmlFor="defaultBranch">Default branch</label>
                <input id="defaultBranch" name="defaultBranch" placeholder="Auto-detect" />
              </div>
              <div className="field">
                <label htmlFor="port">Container port</label>
                <input id="port" name="port" type="number" placeholder="Auto-detect from EXPOSE" min={1} max={65535} />
              </div>
            </div>
            <div className="grid two">
              <div className="field">
                <label htmlFor="dockerfilePath">Dockerfile path</label>
                <input id="dockerfilePath" name="dockerfilePath" placeholder="Auto-detect" />
              </div>
              <div className="field">
                <label htmlFor="buildContext">Build context</label>
                <input id="buildContext" name="buildContext" placeholder="Auto-detect" />
              </div>
            </div>
            <button className="button primary" type="submit">
              Create project
            </button>
          </form>
        </div>
      </section>
    </AppShell>
  );
}
