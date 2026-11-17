'use client';
import { useState, useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/context/AuthContext';

function EyeIcon({ open }) {
  if (open) return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <path d="M2 12s3-7 10-7 10 7 10 7-3 7-10 7S2 12 2 12z" />
      <circle cx="12" cy="12" r="3" />
    </svg>
  );
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94" />
      <path d="M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19" />
      <line x1="1" y1="1" x2="23" y2="23" />
      <path d="M14.12 14.12a3 3 0 1 1-4.24-4.24" />
    </svg>
  );
}

function Spinner() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" style={{ animation: 'spin 0.7s linear infinite' }}>
      <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="2.5" opacity="0.25" />
      <path d="M12 2a10 10 0 0 1 10 10" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" />
      <style>{`@keyframes spin { to { transform: rotate(360deg) } }`}</style>
    </svg>
  );
}

const STATUS_MESSAGES = [
  'Verifying credentials…',
  'Authenticating…',
  'Loading dashboard…',
];

export default function LoginPage() {
  const { login } = useAuth();
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [statusIdx, setStatusIdx] = useState(0);
  const [success, setSuccess] = useState(false);
  const [shake, setShake] = useState(false);
  const emailRef = useRef(null);
  const passwordRef = useRef(null);

  // Cycle status messages while loading
  useEffect(() => {
    if (!loading) { setStatusIdx(0); return; }
    const timer = setInterval(() => setStatusIdx(i => Math.min(i + 1, STATUS_MESSAGES.length - 1)), 1200);
    return () => clearInterval(timer);
  }, [loading]);

  // Shake error animation
  useEffect(() => {
    if (error) { setShake(true); const t = setTimeout(() => setShake(false), 500); return () => clearTimeout(t); }
  }, [error]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!email.trim()) { emailRef.current?.focus(); return; }
    if (!password) { passwordRef.current?.focus(); return; }
    setError('');
    setLoading(true);
    setSuccess(false);
    try {
      const user = await login(email, password);
      setSuccess(true);
      setStatusIdx(2);
      // Brief pause so user sees success state
      setTimeout(() => {
        if (user.role === 'ADMIN') router.replace('/admin/dashboard');
        else router.replace('/team/dashboard');
      }, 600);
    } catch (err) {
      setError(err.message || 'Invalid email or password.');
      setLoading(false);
    }
  };

  const fillCredentials = (em, pw) => {
    setEmail(em);
    setPassword(pw);
    setError('');
    setShowPassword(false);
  };

  const inputStyle = (focused) => ({
    width: '100%', fontFamily: 'inherit', fontSize: 14,
    padding: '10px 12px', border: '1px solid var(--line)',
    borderRadius: 3, background: 'var(--white)', color: 'var(--ink)',
    outline: 'none', transition: 'border-color 0.15s',
  });

  return (
    <div style={{
      minHeight: '100vh', background: 'var(--paper)',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      fontFamily: "'IBM Plex Sans', sans-serif"
    }}>
      <div style={{ width: '100%', maxWidth: 380 }}>
        {/* Brand */}
        <div style={{ textAlign: 'center', marginBottom: 36 }}>
          <div style={{
            fontFamily: "'Source Serif 4', serif", fontSize: 32, fontWeight: 700,
            color: 'var(--teal-deep)', letterSpacing: '-0.02em',
          }}>HAMS</div>
          <div style={{ fontSize: 12.5, color: 'var(--ink-soft)', marginTop: 4, letterSpacing: '0.04em' }}>
            Hospital Audit Management System
          </div>
        </div>

        {/* Login panel */}
        <div className="panel" style={{
          marginBottom: 0, padding: '28px 28px 24px',
          animation: shake ? 'shake 0.4s ease' : 'none',
        }}>
          <style>{`
            @keyframes shake { 0%,100%{transform:translateX(0)} 20%,60%{transform:translateX(-6px)} 40%,80%{transform:translateX(6px)} }
            @keyframes fadeSlideIn { from{opacity:0;transform:translateY(6px)} to{opacity:1;transform:translateY(0)} }
            @keyframes pulse { 0%,100%{opacity:1} 50%{opacity:0.5} }
            .login-input:focus { border-color: var(--teal) !important; }
          `}</style>

          <h2 style={{ marginBottom: 4 }}>Sign in</h2>
          <p className="sub" style={{ marginBottom: 20 }}>Enter your credentials to access the system.</p>

          {error && (
            <div style={{
              background: '#fdf0ef', border: '1px solid #e8c5c2',
              borderRadius: 3, padding: '10px 14px', marginBottom: 16,
              fontSize: 13, color: 'var(--rose)', display: 'flex', alignItems: 'center', gap: 8,
              animation: 'fadeSlideIn 0.25s ease',
            }}>
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="var(--rose)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <circle cx="12" cy="12" r="10" /><line x1="12" y1="8" x2="12" y2="12" /><line x1="12" y1="16" x2="12.01" y2="16" />
              </svg>
              {error}
            </div>
          )}

          <form onSubmit={handleSubmit}>
            <div className="field">
              <label htmlFor="email" style={{ fontSize: 12.5, fontWeight: 500, color: 'var(--ink-soft)', marginBottom: 5, display: 'block' }}>
                Email address
              </label>
              <input ref={emailRef} type="text" id="email" value={email}
                className="login-input"
                onChange={e => { setEmail(e.target.value); setError(''); }}
                placeholder="admin@hams.gov.in" required autoFocus
                disabled={loading && !error}
                autoComplete="email"
                style={inputStyle()}
              />
            </div>
            <div className="field" style={{ marginBottom: 22 }}>
              <label htmlFor="password" style={{ fontSize: 12.5, fontWeight: 500, color: 'var(--ink-soft)', marginBottom: 5, display: 'block' }}>
                Password
              </label>
              <div style={{ position: 'relative' }}>
                <input ref={passwordRef} type={showPassword ? 'text' : 'password'} id="password" value={password}
                  className="login-input"
                  onChange={e => { setPassword(e.target.value); setError(''); }}
                  placeholder="••••••••" required
                  disabled={loading && !error}
                  autoComplete="current-password"
                  style={{ ...inputStyle(), paddingRight: 40 }}
                />
                <button type="button" tabIndex={-1}
                  onClick={() => setShowPassword(v => !v)}
                  style={{
                    position: 'absolute', right: 1, top: 1, bottom: 1, width: 38,
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    background: 'transparent', border: 'none', cursor: 'pointer',
                    color: showPassword ? 'var(--teal)' : 'var(--ink-soft)',
                    transition: 'color 0.15s', borderRadius: '0 3px 3px 0',
                  }}
                  aria-label={showPassword ? 'Hide password' : 'Show password'}
                >
                  <EyeIcon open={showPassword} />
                </button>
              </div>
            </div>

            <button type="submit" className="btn btn-primary" disabled={loading}
              style={{
                width: '100%', justifyContent: 'center', gap: 8,
                height: 42, position: 'relative',
                background: success ? '#1a7a5e' : undefined,
                transition: 'background 0.3s',
              }}>
              {loading ? (
                <span style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  {success ? (
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                      <polyline points="20 6 9 17 4 12" />
                    </svg>
                  ) : (
                    <Spinner />
                  )}
                  <span style={{ animation: success ? 'none' : 'pulse 1.5s ease infinite' }}>
                    {STATUS_MESSAGES[statusIdx]}
                  </span>
                </span>
              ) : 'Sign in'}
            </button>
          </form>

          {/* Keyboard hint */}
          <div style={{ textAlign: 'center', marginTop: 14, fontSize: 11, color: 'var(--ink-soft)', opacity: 0.6 }}>
            Press <kbd style={{ padding: '1px 5px', border: '1px solid var(--line)', borderRadius: 2, fontSize: 10, fontFamily: 'inherit', background: 'var(--paper)' }}>Enter</kbd> to sign in
          </div>
        </div>

        {/* Quick login (dev mode) */}
        <div style={{ marginTop: 24 }}>
          <div style={{ fontSize: 11, color: 'var(--ink-soft)', textTransform: 'uppercase', letterSpacing: '0.06em', fontWeight: 600, marginBottom: 8, textAlign: 'center' }}>
            Quick login (dev)
          </div>
          <div style={{ display: 'flex', gap: 6, marginBottom: 8 }}>
            <button type="button" onClick={() => fillCredentials('admin@hams.gov.in', 'Admin@1234')}
              style={{ flex: 1, padding: '8px 0', fontSize: 12.5, fontWeight: 600, fontFamily: 'inherit', background: 'var(--teal-deep)', color: '#fff', border: 'none', borderRadius: 3, cursor: 'pointer', transition: 'opacity 0.1s' }}
              onMouseEnter={e => e.currentTarget.style.opacity = '0.88'}
              onMouseLeave={e => e.currentTarget.style.opacity = '1'}
            >
              Admin
            </button>
            <button type="button" onClick={() => fillCredentials('t01@hams.gov.in', 'Team@1234')}
              style={{ flex: 1, padding: '8px 0', fontSize: 12.5, fontWeight: 600, fontFamily: 'inherit', background: 'var(--white)', color: 'var(--teal-deep)', border: '1px solid var(--line)', borderRadius: 3, cursor: 'pointer', transition: 'opacity 0.1s' }}
              onMouseEnter={e => e.currentTarget.style.opacity = '0.88'}
              onMouseLeave={e => e.currentTarget.style.opacity = '1'}
            >
              T-01 Lead
            </button>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: 4 }}>
            {Array.from({ length: 19 }, (_, i) => i + 2).map(n => {
              const num = String(n).padStart(2, '0');
              return (
                <button key={n} type="button"
                  onClick={() => fillCredentials(`t${num}@hams.gov.in`, 'Team@1234')}
                  style={{ padding: '5px 0', fontSize: 11, fontFamily: 'inherit', background: 'var(--white)', color: 'var(--ink-soft)', border: '1px solid var(--line-soft)', borderRadius: 2, cursor: 'pointer', transition: 'color 0.1s, border-color 0.1s' }}
                  onMouseEnter={e => { e.currentTarget.style.color = 'var(--teal-deep)'; e.currentTarget.style.borderColor = 'var(--teal)'; }}
                  onMouseLeave={e => { e.currentTarget.style.color = 'var(--ink-soft)'; e.currentTarget.style.borderColor = 'var(--line-soft)'; }}
                >
                  T-{num}
                </button>
              );
            })}
          </div>
        </div>

        <p style={{ textAlign: 'center', fontSize: 11.5, color: 'var(--ink-soft)', marginTop: 20, opacity: 0.7 }}>
          Bihar Health Audit Programme · Government of Bihar
        </p>
      </div>
    </div>
  );
}
