'use client';

import { useRouter } from 'next/navigation';
import Header from './Header';
import Sidebar from './Sidebar';

export default function ProtectedLayout({ children }: { children: React.ReactNode }) {
  const router = useRouter();

  async function handleLogout() {
    await fetch('/api/logout', { method: 'POST' });
    router.replace('/login');
    router.refresh();
  }

  return (
    <div className="app-shell">
      <Header onLogout={handleLogout} />
      <div className="app-body">
        <Sidebar />
        <main className="main-content">{children}</main>
      </div>
    </div>
  );
}
