export default function DashboardPage() {
  return (
    <main className="main-content">
      <section className="page-card">
        <h1>Dashboard</h1>
        <p>Overview of your business, activity, and recent updates.</p>
        <div className="grid">
          <div className="metric"><strong>28</strong><span>Active users</span></div>
          <div className="metric"><strong>$12.4K</strong><span>Revenue</span></div>
          <div className="metric"><strong>7</strong><span>Pending actions</span></div>
        </div>
      </section>
    </main>
  );
}
