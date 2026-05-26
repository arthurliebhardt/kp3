export default function SetupPage() {
  return (
    <main className="main" style={{ maxWidth: 760, margin: "0 auto" }}>
      <div className="page-head">
        <div>
          <h1 className="page-title">First-run setup</h1>
          <p className="page-subtitle">Create the first Owner account. Registration closes automatically after setup.</p>
        </div>
      </div>
      <section className="panel">
        <div className="panel-body">
          <form className="form" action="/api/setup/complete" method="post">
            <div className="field">
              <label htmlFor="email">Email</label>
              <input id="email" name="email" type="email" autoComplete="email" required />
            </div>
            <div className="field">
              <label htmlFor="password">Password</label>
              <input id="password" name="password" type="password" autoComplete="new-password" required />
            </div>
            <div className="field">
              <label htmlFor="confirmPassword">Confirm password</label>
              <input id="confirmPassword" name="confirmPassword" type="password" autoComplete="new-password" required />
            </div>
            <button className="button primary" type="submit">
              Create Owner account
            </button>
          </form>
        </div>
      </section>
    </main>
  );
}
