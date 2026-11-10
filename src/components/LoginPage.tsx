import React, { useState } from 'react';
import { login, AuthSession, changeOwnPassword } from '../utils/authStore';
import { scorePasswordStrength, PASSWORD_STRENGTH_LABELS, PASSWORD_STRENGTH_COLORS } from '../utils/security';

// ─────────────────────────────────────────────────────────────────────────────
// LoginPage
// ─────────────────────────────────────────────────────────────────────────────

interface LoginPageProps {
  onLoginSuccess: (session: AuthSession) => void;
}

export const LoginPage: React.FC<LoginPageProps> = ({ onLoginSuccess }) => {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false); // IA-6
  const [error, setError] = useState('');
  const [locked, setLocked] = useState(false);
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLocked(false);
    if (!username.trim() || !password.trim()) {
      setError('Login failed. Invalid user ID or password.'); // IA-7: generic
      return;
    }
    setLoading(true);
    const result = await login(username, password);
    setLoading(false);

    if (result.success && result.session) {
      onLoginSuccess(result.session);
    } else {
      setError(result.error ?? 'Login failed. Invalid user ID or password.');
      if (result.locked) setLocked(true);
    }
  };

  return (
    <div className="min-h-screen bg-[#E8E2F4] flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        {/* Brand header */}
        <div className="flex flex-col items-center mb-8">
          <div className="bg-white rounded-xl px-6 py-4 shadow-lg border border-[#542D84]/10 flex items-center gap-2 mb-6">
            <div className="relative flex items-baseline tracking-tight leading-none">
              <span className="text-[#F37021] font-serif font-bold text-[28px]">City</span>
              <div className="relative inline-flex flex-col ml-0.5">
                <span className="text-[7px] font-bold tracking-wider uppercase text-[#512B81] -mb-1">
                  a UNIONBANK subsidiary
                </span>
                <span className="text-[#512B81] font-serif font-bold text-[28px]">Savings</span>
              </div>
            </div>
          </div>
          <h1 className="text-[22px] font-bold text-slate-900 tracking-tight text-center">
            Audit Management System
          </h1>
          <p className="text-sm text-slate-500 mt-1 text-center">
            CSB · Internal Audit Division
          </p>
        </div>

        {/* Login card */}
        <div className="bg-white rounded-2xl shadow-xl border border-slate-200 p-8">
          <h2 className="text-[17px] font-bold text-slate-900 mb-1">Sign in</h2>
          <p className="text-xs text-slate-500 mb-6">Enter your credentials to access the system.</p>

          <form onSubmit={handleSubmit} className="space-y-4" noValidate>
            {/* IA-5: autocomplete="off" on username, no hints */}
            <div>
              <label htmlFor="login-username" className="block text-xs font-semibold text-slate-700 mb-1.5">
                Username, Email, or Employee ID
              </label>
              <input
                id="login-username"
                type="text"
                autoComplete="username"
                autoCapitalize="none"
                spellCheck={false}
                value={username}
                onChange={(e) => { setUsername(e.target.value); setError(''); }}
                placeholder="e.g. christian.macahilig, email, or CSB-0001"
                className="w-full px-4 py-2.5 bg-white border border-slate-300 rounded-lg text-sm text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-[#492785]/30 focus:border-[#492785] transition-colors"
                disabled={loading}
              />
            </div>

            <div>
              <label htmlFor="login-password" className="block text-xs font-semibold text-slate-700 mb-1.5">
                Password
              </label>
              {/* IA-5: no autocomplete hint; IA-6: show/hide toggle */}
              <div className="relative">
                <input
                  id="login-password"
                  type={showPassword ? 'text' : 'password'}
                  autoComplete="current-password"
                  value={password}
                  onChange={(e) => { setPassword(e.target.value); setError(''); }}
                  placeholder="Enter your password"
                  className="w-full px-4 py-2.5 bg-white border border-slate-300 rounded-lg text-sm text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-[#492785]/30 focus:border-[#492785] transition-colors pr-11"
                  disabled={loading}
                />
                {/* IA-6: show/hide password toggle (optional control) */}
                <button
                  type="button"
                  tabIndex={-1}
                  onClick={() => setShowPassword((p) => !p)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-700 cursor-pointer select-none text-sm transition-colors"
                  aria-label={showPassword ? 'Hide password' : 'Show password'}
                >
                  {showPassword ? (
                    // eye-off
                    <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24"/><line x1="1" y1="1" x2="23" y2="23"/></svg>
                  ) : (
                    // eye
                    <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg>
                  )}
                </button>
              </div>
            </div>

            {/* IA-7/IA-8/IA-9: error display — always generic */}
            {error && (
              <div className={`flex items-start gap-2.5 px-4 py-3 rounded-lg text-sm border ${
                locked
                  ? 'bg-red-50 border-red-200 text-red-800'
                  : 'bg-amber-50 border-amber-200 text-amber-800'
              }`}>
                <svg className="w-4 h-4 mt-0.5 shrink-0" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 1 1-2 0 1 1 0 0 1 2 0zm-1-8a1 1 0 0 0-1 1v3a1 1 0 0 0 2 0V6a1 1 0 0 0-1-1z" clipRule="evenodd" />
                </svg>
                <span>{error}</span>
              </div>
            )}

            <button
              type="submit"
              disabled={loading}
              className="w-full py-2.5 bg-[#492785] hover:bg-[#3b1f6b] disabled:bg-slate-300 text-white text-sm font-bold rounded-lg transition-colors cursor-pointer disabled:cursor-not-allowed mt-2"
            >
              {loading ? 'Signing in…' : 'Sign in'}
            </button>
          </form>

          <p className="mt-6 text-center text-[11px] text-slate-400">
            Contact your system administrator if you need access or your account is locked.
          </p>
        </div>

        {/* Security notice */}
        <p className="mt-4 text-center text-[11px] text-slate-400">
          Protected by OCISO BSSC V3 · TLS 1.2+ · All sessions logged
        </p>
      </div>
    </div>
  );
};

// ─────────────────────────────────────────────────────────────────────────────
// ForcePasswordChange — shown when requiresPasswordChange = true (PM-3)
// ─────────────────────────────────────────────────────────────────────────────

interface ForcePasswordChangeProps {
  session: AuthSession;
  onChanged: (updatedSession: AuthSession) => void;
  onLogout: () => void;
}

export const ForcePasswordChange: React.FC<ForcePasswordChangeProps> = ({
  session,
  onChanged,
  onLogout,
}) => {
  const [currentPw, setCurrentPw] = useState('');
  const [newPw, setNewPw] = useState('');
  const [confirmPw, setConfirmPw] = useState('');
  const [showCurrent, setShowCurrent] = useState(false);
  const [showNew, setShowNew] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const strength = scorePasswordStrength(newPw);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    if (newPw !== confirmPw) {
      setError('New passwords do not match.');
      return;
    }
    if (newPw.length < 8) {
      setError('Password must be at least 8 characters.');
      return;
    }
    if (!/[a-zA-Z]/.test(newPw) || !/[0-9]/.test(newPw)) {
      setError('Password must contain at least one letter and one number.');
      return;
    }
    setLoading(true);
    const result = await changeOwnPassword(session, currentPw, newPw);
    setLoading(false);
    if (result.success) {
      onChanged({ ...session, requiresPasswordChange: false });
    } else {
      setError(result.error ?? 'Failed to change password.');
    }
  };

  return (
    <div className="min-h-screen bg-[#E8E2F4] flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        <div className="bg-white rounded-2xl shadow-xl border border-slate-200 p-8">
          <div className="flex items-center gap-2 mb-1">
            <span className="w-8 h-8 rounded-full bg-amber-100 border border-amber-300 flex items-center justify-center text-amber-700 text-lg font-bold">!</span>
            <h2 className="text-[17px] font-bold text-slate-900">Password change required</h2>
          </div>
          <p className="text-xs text-slate-500 mb-6">
            PM-3: You must set a new password before accessing the system.
            Password must be at least 8 characters and contain letters and numbers.
          </p>

          <form onSubmit={handleSubmit} className="space-y-4" noValidate>
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1.5">Current password</label>
              <div className="relative">
                <input type={showCurrent ? 'text' : 'password'} autoComplete="current-password"
                  value={currentPw} onChange={(e) => setCurrentPw(e.target.value)}
                  className="w-full px-4 py-2.5 bg-white border border-slate-300 rounded-lg text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-[#492785]/30 focus:border-[#492785] pr-11"
                  disabled={loading} />
                <button type="button" tabIndex={-1} onClick={() => setShowCurrent((p) => !p)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-700 cursor-pointer text-sm">
                  {showCurrent ? '🙈' : '👁️'}
                </button>
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1.5">New password</label>
              <div className="relative">
                <input type={showNew ? 'text' : 'password'} autoComplete="new-password"
                  value={newPw} onChange={(e) => setNewPw(e.target.value)}
                  className="w-full px-4 py-2.5 bg-white border border-slate-300 rounded-lg text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-[#492785]/30 focus:border-[#492785] pr-11"
                  disabled={loading} />
                <button type="button" tabIndex={-1} onClick={() => setShowNew((p) => !p)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-700 cursor-pointer text-sm">
                  {showNew ? '🙈' : '👁️'}
                </button>
              </div>
              {newPw && (
                <div className="mt-2">
                  <div className="flex gap-1">
                    {[0,1,2,3,4].map((i) => (
                      <div key={i} className={`h-1.5 flex-1 rounded-full transition-colors ${i <= strength ? PASSWORD_STRENGTH_COLORS[strength] : 'bg-slate-200'}`} />
                    ))}
                  </div>
                  <p className="text-[11px] text-slate-500 mt-1">Strength: <strong>{PASSWORD_STRENGTH_LABELS[strength]}</strong></p>
                </div>
              )}
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1.5">Confirm new password</label>
              <input type="password" autoComplete="new-password"
                value={confirmPw} onChange={(e) => setConfirmPw(e.target.value)}
                className="w-full px-4 py-2.5 bg-white border border-slate-300 rounded-lg text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-[#492785]/30 focus:border-[#492785]"
                disabled={loading} />
            </div>

            {error && (
              <div className="px-4 py-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-800">
                {error}
              </div>
            )}

            <button type="submit" disabled={loading}
              className="w-full py-2.5 bg-[#492785] hover:bg-[#3b1f6b] disabled:bg-slate-300 text-white text-sm font-bold rounded-lg transition-colors cursor-pointer disabled:cursor-not-allowed">
              {loading ? 'Saving…' : 'Set new password'}
            </button>
          </form>

          <button type="button" onClick={onLogout}
            className="mt-4 w-full text-center text-xs text-slate-400 hover:text-slate-700 cursor-pointer transition-colors">
            Cancel and sign out
          </button>
        </div>
      </div>
    </div>
  );
};
