import ProtectedLayout from '@/components/ProtectedLayout';

export default function ProfilePage() {
  return (
    <ProtectedLayout>
      <section className="page-card">
        <h1>Profile</h1>
        <p>Manage personal information, access settings, and account details.</p>
      </section>
    </ProtectedLayout>
  );
}
