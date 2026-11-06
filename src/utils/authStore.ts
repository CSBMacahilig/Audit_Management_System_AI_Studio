/**
 * authStore.ts — Supabase-backed Authentication Store
 *
 * Replaces the previous localStorage-only implementation.
 * All user records are persisted in the `system_users` Supabase table.
 * Sessions are still kept in sessionStorage (SM-4: tab-scoped, not synced server-side).
 */

import { supabase } from './supabaseClient';

// ─────────────────────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────────────────────

export type SystemRole = 'admin' | 'user';

export interface SystemUser {
  id: string;
  username: string;
  fullName: string;
  email: string;
  role: SystemRole;
  passwordHash: string;
  isActive: boolean;
  isLocked: boolean;
  failedLoginCount: number;
  requiresPasswordChange: boolean;
  createdAt: string;
  lastLogin: string | null;
  modifiedAt: string;
}

export interface AuthSession {
  userId: string;
  username: string;
  role: SystemRole;
  fullName: string;
  token: string;
  issuedAt: string;
  requiresPasswordChange: boolean;
}

export interface LoginResult {
  success: boolean;
  session?: AuthSession;
  error?: string;
  locked?: boolean;
  requiresPasswordChange?: boolean;
}

// ─────────────────────────────────────────────────────────────────────────────
// DB row → domain type mapper
// ─────────────────────────────────────────────────────────────────────────────

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function rowToUser(row: any): SystemUser {
  return {
    id: row.id,
    username: row.username,
    fullName: row.full_name,
    email: row.email,
    role: row.role as SystemRole,
    passwordHash: row.password_hash,
    isActive: row.is_active,
    isLocked: row.is_locked,
    failedLoginCount: row.failed_login_count,
    requiresPasswordChange: row.requires_password_change,
    createdAt: row.created_at,
    lastLogin: row.last_login,
    modifiedAt: row.modified_at,
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// Constants
// ─────────────────────────────────────────────────────────────────────────────

const SESSION_KEY = 'csb_auth_session';
const MAX_FAILED = 3;

// ─────────────────────────────────────────────────────────────────────────────
// Crypto helpers
// ─────────────────────────────────────────────────────────────────────────────

export async function hashPassword(password: string): Promise<string> {
  const encoder = new TextEncoder();
  const data = encoder.encode(password);
  const hashBuffer = await crypto.subtle.digest('SHA-256', data);
  return Array.from(new Uint8Array(hashBuffer))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
}

export function randomToken(): string {
  const bytes = new Uint8Array(32);
  crypto.getRandomValues(bytes);
  return Array.from(bytes, (b) => b.toString(16).padStart(2, '0')).join('');
}

// ─────────────────────────────────────────────────────────────────────────────
// Session (sessionStorage — tab-scoped)
// ─────────────────────────────────────────────────────────────────────────────

export function loadSession(): AuthSession | null {
  try {
    const raw = sessionStorage.getItem(SESSION_KEY);
    if (!raw) return null;
    return JSON.parse(raw) as AuthSession;
  } catch {
    return null;
  }
}

export function saveSession(session: AuthSession): void {
  sessionStorage.setItem(SESSION_KEY, JSON.stringify(session));
}

export function clearSession(): void {
  sessionStorage.removeItem(SESSION_KEY);
}

// ─────────────────────────────────────────────────────────────────────────────
// Seed: create the default admin if the table is empty
// ─────────────────────────────────────────────────────────────────────────────

export async function seedDefaultAdmin(): Promise<void> {
  const { data, error } = await supabase
    .from('system_users')
    .select('id')
    .eq('username', 'admin')
    .maybeSingle();

  if (error) {
    console.error('seedDefaultAdmin: could not query system_users:', error.message);
    return;
  }
  if (data) return; // already exists

  const hash = await hashPassword('csbadmin123');
  const now = new Date().toISOString();
  await supabase.from('system_users').insert({
    id: 'sys-admin-001',
    username: 'admin',
    full_name: 'System Administrator',
    email: 'admin@citysavings.com.ph',
    role: 'admin',
    password_hash: hash,
    is_active: true,
    is_locked: false,
    failed_login_count: 0,
    requires_password_change: false,
    created_at: now,
    last_login: null,
    modified_at: now,
  });
}

// ─────────────────────────────────────────────────────────────────────────────
// Auth actions
// ─────────────────────────────────────────────────────────────────────────────

export async function login(username: string, password: string): Promise<LoginResult> {
  const GENERIC = 'Login failed. Invalid user ID or password.';

  const { data: row, error } = await supabase
    .from('system_users')
    .select('*')
    .eq('username', username.trim().toLowerCase())
    .maybeSingle();

  if (error || !row) return { success: false, error: GENERIC };

  const user = rowToUser(row);

  if (!user.isActive) return { success: false, error: GENERIC };

  if (user.isLocked) {
    return {
      success: false,
      locked: true,
      error:
        'Your account has been locked due to multiple failed login attempts. ' +
        'Please contact your system administrator to unlock your account.',
    };
  }

  const attemptedHash = await hashPassword(password);

  if (attemptedHash !== user.passwordHash) {
    const newCount = user.failedLoginCount + 1;
    const shouldLock = newCount >= MAX_FAILED;
    await supabase
      .from('system_users')
      .update({ failed_login_count: newCount, is_locked: shouldLock, modified_at: new Date().toISOString() })
      .eq('id', user.id);

    if (shouldLock) {
      return {
        success: false,
        locked: true,
        error:
          `${GENERIC} Your account has been locked after ${MAX_FAILED} failed attempts. ` +
          'Contact an administrator to unlock.',
      };
    }
    return { success: false, error: GENERIC };
  }

  const token = randomToken();
  const now = new Date().toISOString();

  await supabase
    .from('system_users')
    .update({ failed_login_count: 0, is_locked: false, last_login: now, modified_at: now })
    .eq('id', user.id);

  clearSession();

  const session: AuthSession = {
    userId: user.id,
    username: user.username,
    role: user.role,
    fullName: user.fullName,
    token,
    issuedAt: now,
    requiresPasswordChange: user.requiresPasswordChange,
  };
  saveSession(session);

  return { success: true, session, requiresPasswordChange: user.requiresPasswordChange };
}

export function logout(): void {
  clearSession();
}

// ─────────────────────────────────────────────────────────────────────────────
// Admin-only user management
// ─────────────────────────────────────────────────────────────────────────────

export async function loadUsers(): Promise<SystemUser[]> {
  const { data, error } = await supabase.from('system_users').select('*').order('created_at');
  if (error) { console.error('loadUsers:', error.message); return []; }
  return (data ?? []).map(rowToUser);
}

export async function adminAddUser(
  session: AuthSession,
  data: { username: string; fullName: string; email: string; role: SystemRole; password: string }
): Promise<{ success: boolean; error?: string }> {
  if (session.role !== 'admin') return { success: false, error: 'Access denied. Admin role required.' };

  const { data: existing } = await supabase
    .from('system_users')
    .select('id')
    .eq('username', data.username.trim().toLowerCase())
    .maybeSingle();

  if (existing) {
    return { success: false, error: `Username "${data.username}" already exists. Each user must have a unique username.` };
  }

  if (!data.password || data.password.length < 8) {
    return { success: false, error: 'Password must be at least 8 characters.' };
  }

  const hash = await hashPassword(data.password);
  const now = new Date().toISOString();

  const { error: insertErr } = await supabase.from('system_users').insert({
    id: `usr-${Date.now()}`,
    username: data.username.trim().toLowerCase(),
    full_name: data.fullName.trim(),
    email: data.email.trim().toLowerCase(),
    role: data.role,
    password_hash: hash,
    is_active: true,
    is_locked: false,
    failed_login_count: 0,
    requires_password_change: true,
    created_at: now,
    last_login: null,
    modified_at: now,
  });

  if (insertErr) return { success: false, error: insertErr.message };
  return { success: true };
}

export async function adminUnlockUser(
  session: AuthSession,
  targetUserId: string
): Promise<{ success: boolean; error?: string }> {
  if (session.role !== 'admin') return { success: false, error: 'Access denied. Admin role required.' };
  const { error } = await supabase
    .from('system_users')
    .update({ is_locked: false, failed_login_count: 0, modified_at: new Date().toISOString() })
    .eq('id', targetUserId);
  if (error) return { success: false, error: error.message };
  return { success: true };
}

export async function adminToggleActive(
  session: AuthSession,
  targetUserId: string
): Promise<{ success: boolean; error?: string }> {
  if (session.role !== 'admin') return { success: false, error: 'Access denied. Admin role required.' };
  if (targetUserId === session.userId) return { success: false, error: 'You cannot deactivate your own account.' };

  const { data: row, error: fetchErr } = await supabase
    .from('system_users')
    .select('is_active')
    .eq('id', targetUserId)
    .single();
  if (fetchErr || !row) return { success: false, error: fetchErr?.message ?? 'User not found.' };

  const { error } = await supabase
    .from('system_users')
    .update({ is_active: !row.is_active, modified_at: new Date().toISOString() })
    .eq('id', targetUserId);
  if (error) return { success: false, error: error.message };
  return { success: true };
}

export async function adminResetPassword(
  session: AuthSession,
  targetUserId: string,
  newPassword: string
): Promise<{ success: boolean; error?: string }> {
  if (session.role !== 'admin') return { success: false, error: 'Access denied. Admin role required.' };
  if (!newPassword || newPassword.length < 8) return { success: false, error: 'New password must be at least 8 characters.' };

  const hash = await hashPassword(newPassword);
  const { error } = await supabase
    .from('system_users')
    .update({
      password_hash: hash,
      requires_password_change: true,
      is_locked: false,
      failed_login_count: 0,
      modified_at: new Date().toISOString(),
    })
    .eq('id', targetUserId);
  if (error) return { success: false, error: error.message };
  return { success: true };
}

export async function changeOwnPassword(
  session: AuthSession,
  currentPassword: string,
  newPassword: string
): Promise<{ success: boolean; error?: string }> {
  const { data: row, error: fetchErr } = await supabase
    .from('system_users')
    .select('password_hash')
    .eq('id', session.userId)
    .single();
  if (fetchErr || !row) return { success: false, error: 'User not found.' };

  const currentHash = await hashPassword(currentPassword);
  if (currentHash !== row.password_hash) return { success: false, error: 'Current password is incorrect.' };

  if (newPassword.length < 8) return { success: false, error: 'New password must be at least 8 characters.' };
  if (!/[a-zA-Z]/.test(newPassword) || !/[0-9]/.test(newPassword)) {
    return { success: false, error: 'New password must contain letters and numbers.' };
  }

  const newHash = await hashPassword(newPassword);
  if (newHash === row.password_hash) return { success: false, error: 'New password must differ from your current password.' };

  const { error } = await supabase
    .from('system_users')
    .update({ password_hash: newHash, requires_password_change: false, modified_at: new Date().toISOString() })
    .eq('id', session.userId);
  if (error) return { success: false, error: error.message };

  const updatedSession: AuthSession = { ...session, requiresPasswordChange: false };
  saveSession(updatedSession);
  return { success: true };
}
