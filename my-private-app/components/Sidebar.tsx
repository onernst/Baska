import Link from 'next/link';

const links = [
  { href: '/', label: 'Home' },
  { href: '/dashboard', label: 'Dashboard' },
  { href: '/profile', label: 'Profile' },
  { href: '/users', label: 'Users' },
  { href: '/settings', label: 'Settings' },
  { href: '/reports', label: 'Reports' },
  { href: '/security', label: 'Security' },
  { href: '/login', label: 'Login' },
];

export default function Sidebar() {
  return (
    <aside className="sidebar">
      <nav>
        {links.map((link) => (
          <Link key={link.href} href={link.href} className="nav-item">
            {link.label}
          </Link>
        ))}
      </nav>
    </aside>
  );
}
