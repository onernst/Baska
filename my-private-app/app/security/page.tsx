import ProtectedLayout from '@/components/ProtectedLayout';

export default function SecurityPage() {
  return (
    <ProtectedLayout>
      <section className="page-card">
        <h1>Security</h1>
        <p>Review audit logs, credentials, access changes, and compliance controls.</p>
      </section>
    </ProtectedLayout>
  );
}
