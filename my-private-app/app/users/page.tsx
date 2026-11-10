import ProtectedLayout from '@/components/ProtectedLayout';

export default function UsersPage() {
  return (
    <ProtectedLayout>
      <section className="page-card">
        <h1>Users</h1>
        <p>Review accounts, assignments, status, and access permissions.</p>
      </section>
    </ProtectedLayout>
  );
}
