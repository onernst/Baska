import ProtectedLayout from '@/components/ProtectedLayout';

export default function HomePage() {
  return (
    <ProtectedLayout>
      <section className="page-card">
        <h1>Private Workspace</h1>
        <p>
          This is the home page for your private application. Use it as the secure dashboard entry
          point for administrators and staff.
        </p>

        <div className="grid">
          <div className="metric">
            <strong>128</strong>
            <span>Total users</span>
          </div>
          <div className="metric">
            <strong>42</strong>
            <span>Active sessions</span>
          </div>
          <div className="metric">
            <strong>3</strong>
            <span>Security alerts</span>
          </div>
        </div>
      </section>
    </ProtectedLayout>
  );
}
