import ProtectedLayout from '@/components/ProtectedLayout';

export default function DashboardPage() {
  return (
    <ProtectedLayout>
      <section className="page-card">
        <h1>Dashboard</h1>
        <p>Overview of the organization, activity, and operational health.</p>
        <div className="grid">
          <div className="metric">
            <strong>96%</strong>
            <span>Operational health</span>
          </div>
          <div className="metric">
            <strong>27</strong>
            <span>Pending approvals</span>
          </div>
          <div className="metric">
            <strong>14</strong>
            <span>New reports</span>
          </div>
        </div>
      </section>
    </ProtectedLayout>
  );
}
