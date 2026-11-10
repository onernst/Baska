import ProtectedLayout from '@/components/ProtectedLayout';

export default function SettingsPage() {
  return (
    <ProtectedLayout>
      <section className="page-card">
        <h1>Settings</h1>
        <p>Configure platform preferences, account controls, and operational defaults.</p>
      </section>
    </ProtectedLayout>
  );
}
