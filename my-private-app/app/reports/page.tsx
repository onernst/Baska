import ProtectedLayout from '@/components/ProtectedLayout';

export default function ReportsPage() {
  return (
    <ProtectedLayout>
      <section className="page-card">
        <h1>Reports</h1>
        <p>Access summaries, analytics, and operational reporting snapshots.</p>
      </section>
    </ProtectedLayout>
  );
}
