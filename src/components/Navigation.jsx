import { useState } from 'react';

export default function Navigation({ currentView, onViewChange, onLogout }) {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  const navItems = [
    { id: 'list', label: 'List', icon: '📋' },
    { id: 'stores', label: 'Stores', icon: '🏪' },
    { id: 'summary', label: 'Summary', icon: '📊' },
  ];

  return (
    <nav className="navigation" aria-label="Main navigation">
      <div className="nav-container">
        <div className="nav-brand">
          <span className="brand-mark">✓</span>
          <span className="brand-name">Baska</span>
        </div>

        <button
          className="mobile-menu-toggle"
          aria-label="Toggle menu"
          aria-expanded={mobileMenuOpen}
          onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
        >
          <span></span>
          <span></span>
          <span></span>
        </button>

        <ul className={`nav-links ${mobileMenuOpen ? 'open' : ''}`}>
          {navItems.map((item) => (
            <li key={item.id}>
              <button
                type="button"
                className={`nav-link ${currentView === item.id ? 'active' : ''}`}
                aria-current={currentView === item.id ? 'page' : undefined}
                onClick={() => {
                  onViewChange(item.id);
                  setMobileMenuOpen(false);
                }}
              >
                <span className="nav-icon" aria-hidden="true">{item.icon}</span>
                <span>{item.label}</span>
              </button>
            </li>
          ))}
          {onLogout && (
            <li>
              <button
                type="button"
                className="nav-link nav-link-logout"
                onClick={() => {
                  onLogout();
                  setMobileMenuOpen(false);
                }}
              >
                <span className="nav-icon" aria-hidden="true">🚪</span>
                <span>Logout</span>
              </button>
            </li>
          )}
        </ul>
      </div>
    </nav>
  );
}
