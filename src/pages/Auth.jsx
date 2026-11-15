import { useState } from 'react';
import { signIn, signUp } from '../api';

export default function Auth({ joining }) {
  const [mode, setMode] = useState('signin');
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [loading, setLoading] = useState(false);

  const isSignUp = mode === 'signup';

  async function handleSubmit(event) {
    event.preventDefault();
    setError('');
    setNotice('');
    setLoading(true);
    try {
      if (isSignUp) {
        const session = await signUp({ name: name.trim(), email: email.trim(), password });
        if (!session) {
          setNotice(
            'Your account was created, but it needs email confirmation before you can sign in. ' +
              'Ask the app owner to turn off "Confirm email" in Supabase, then sign in.',
          );
          setMode('signin');
        }
      } else {
        await signIn({ email: email.trim(), password });
      }
    } catch (err) {
      setError(friendly(err.message));
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="auth-container">
      <div className="auth-card">
        <div className="auth-header">
          <span className="brand-mark">✓</span>
          <h1>{isSignUp ? 'Create your account' : 'Welcome to Baska'}</h1>
          <p>
            {joining
              ? 'Someone shared a list with you. Sign in or create an account to open it.'
              : 'Shared shopping lists that stay in sync.'}
          </p>
        </div>

        {error && <div className="auth-error" role="alert">{error}</div>}
        {notice && <div className="auth-notice" role="status">{notice}</div>}

        <form className="auth-form" onSubmit={handleSubmit}>
          {isSignUp && (
            <label htmlFor="name">
              Your name
              <input
                id="name"
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="How others will see you"
                required
                autoComplete="name"
              />
            </label>
          )}

          <label htmlFor="email">
            Email
            <input
              id="email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="you@example.com"
              required
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
              placeholder="At least 6 characters"
              required
              minLength={6}
              autoComplete={isSignUp ? 'new-password' : 'current-password'}
            />
          </label>

          <button type="submit" disabled={loading}>
            {loading ? 'One moment…' : isSignUp ? 'Create account' : 'Sign in'}
          </button>
        </form>

        <div className="auth-footer">
          {isSignUp ? 'Already have an account?' : 'New to Baska?'}{' '}
          <button
            type="button"
            className="link-btn"
            onClick={() => {
              setMode(isSignUp ? 'signin' : 'signup');
              setError('');
            }}
          >
            {isSignUp ? 'Sign in' : 'Create an account'}
          </button>
        </div>
      </div>
    </div>
  );
}

function friendly(message = '') {
  if (/invalid login credentials/i.test(message)) return 'That email and password don’t match.';
  if (/email not confirmed/i.test(message))
    return 'This account still needs email confirmation. Ask the app owner to turn off “Confirm email” in Supabase.';
  if (/already registered/i.test(message)) return 'That email already has an account. Try signing in.';
  return message || 'Something went wrong. Please try again.';
}
