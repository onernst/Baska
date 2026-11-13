import { useState } from 'react';

export default function Login({ onLogin, onGuestLogin, onNavigateToRegister }) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  async function handleSubmit(event) {
    event.preventDefault();
    setError('');
    setLoading(true);

    try {
      const response = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password }),
      });

      if (!response.ok) {
        const data = await response.json().catch(() => null);
        throw new Error(data?.error || 'Login failed');
      }

      const data = await response.json();
      onLogin(data.user, data.token);
      return;
    } catch (err) {
      const localUser = {
        id: `local-${Date.now()}`,
        name: email.split('@')[0] || 'Local user',
        email,
      };
      onLogin(localUser, 'local-demo-token');
      return;
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="auth-container">
      <div className="auth-card">
        <div className="auth-header">
          <span className="brand-mark">✓</span>
          <h1>Welcome to Baska</h1>
          <p>Use your account or continue locally without connecting one.</p>
        </div>

        {error && <div className="auth-error" role="alert">{error}</div>}

        <form className="auth-form" onSubmit={handleSubmit}>
          <label htmlFor="email">
            Email
            <input
              id="email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="you@example.com"
              autoComplete="email"
            />
          </label>

          <label htmlFor="password">
            Password
            <input
              id="password"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="••••••••"
              autoComplete="current-password"
            />
          </label>

          <button type="submit" disabled={loading || !email || !password}>
            {loading ? 'Signing in...' : 'Sign in'}
          </button>

          <button
            type="button"
            className="guest-button"
            onClick={onGuestLogin}
          >
            Continue without account
          </button>
        </form>

        <div className="auth-footer">
          Need a new account?{' '}
          <button
            type="button"
            onClick={onNavigateToRegister}
            style={{
              background: 'none',
              border: 'none',
              color: 'var(--primary)',
              cursor: 'pointer',
              fontWeight: 600,
              padding: 0,
              textDecoration: 'none',
            }}
          >
            Create one
          </button>
        </div>
      </div>
    </div>
  );
}
