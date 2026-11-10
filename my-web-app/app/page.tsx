import Link from 'next/link';

export default function HomePage() {
  return (
    <div className="app-shell">
      <header className="header">
        <div className="brand">
          <span className="brand-mark">✓</span>
          <span>My Web App</span>
        </div>
        <div className="header-actions">
          <button className="secondary-btn">Profile</button>
          <button className="primary-btn">Launch</button>
        </div>
      </header>

      <div className="app-body">
        <aside className="sidebar">
          <nav>
            <Link className="nav-item active" href="/dashboard">Dashboard</Link>
            <Link className="nav-item" href="/profile">Profile</Link>
            <Link className="nav-item" href="/settings">Settings</Link>
            <Link className="nav-item" href="/payments">Payments</Link>
            <Link className="nav-item" href="/support">Support</Link>
            <Link className="nav-item" href="/login">Login</Link>
          </nav>
        </aside>

        <main className="main-content">
          <section className="page-card">
            <h1>Welcome</h1>
            <p>
              This is the home page for the app shell. Use the structure below to organize your
              frontend into a clean, maintainable layout.
            </p>

            <div className="grid">
              <div className="metric">
                <strong>12</strong>
                <span>Open tasks</span>
              </div>
              <div className="metric">
                <strong>84%</strong>
                <span>Completion rate</span>
              </div>
              <div className="metric">
                <strong>4</strong>
                <span>New updates</span>
              </div>
            </div>
          </section>
        </main>
      </div>

      <footer className="footer">© 2026 My Web App</footer>
    </div>
  );
}
