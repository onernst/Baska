import Link from 'next/link';

export default function Navigation() {
  return (
    <nav aria-label="Main navigation" className="header-actions">
      <Link href="/dashboard" className="nav-button">Dashboard</Link>
      <Link href="/profile" className="nav-button">Profile</Link>
      <Link href="/settings" className="nav-button">Settings</Link>
    </nav>
  );
}
