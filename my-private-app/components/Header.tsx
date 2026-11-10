type HeaderProps = {
  onLogout?: () => void;
};

export default function Header({ onLogout }: HeaderProps) {
  return (
    <header className="header">
      <div className="brand">
        <span className="brand-mark">✓</span>
        <span>My Private App</span>
      </div>

      <div className="header-actions">
        <button className="secondary-btn" type="button">Profile</button>
        {onLogout ? (
          <button className="primary-btn" type="button" onClick={onLogout}>
            Log out
          </button>
        ) : (
          <button className="primary-btn" type="button">Secure Access</button>
        )}
      </div>
    </header>
  );
}
