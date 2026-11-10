export default function Header() {
  return (
    <header className="header">
      <div className="brand">
        <span className="brand-mark">✓</span>
        <span>My Web App</span>
      </div>

      <div className="header-actions">
        <button className="secondary-btn">Profile</button>
        <button className="primary-btn">Launch</button>
      </div>
    </header>
  );
}
