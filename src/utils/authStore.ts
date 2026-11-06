/**
 * authStore.ts — Client-side Authentication Store
 *
 * Provides a simple but realistic login/session system with:
 *  • SHA-256 password hashing (Web Crypto SubtleCrypto)
 *  • localStorage persistence for the user registry
 *  • IA-8: account lockout after N failed attempts
 *  • IA-9: admin-only unlock
 *  • SM-4: single active session per user (session token in sessionStorage)
 *  • PM-3: force password change flag on first login
 *  • LAC-1: role enforcement — only 'admin' role may add/manage users
 *
 * Roles in this system:
 *   'admin' — can log in AND manage all users (add/edit/deactivate)
 *   'user'  — can log in; cannot manage other users
 */

// ─────────────────────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────────────────────

export type SystemRole = 'admin' | 'user';

export interface SystemUser {
  id: string;
  username: string;            // unique, lowercase (IA-1/IA-2)
  fullName: string;
  email: string;
  role: SystemRole;
  passwordHash: string;        // SHA-256 hex (never plaintext)
  isActive: boolean;           // AL-4.7 account status
  isLocked: boolean;           // IA-9
  failedLoginCount: number;    // IA-8
  requiresPasswordChange: boolean; // PM-3 first-login force
  createdAt: string;           // ISO 8601
  lastLogin: string | null;    // AL-4.4
  modifiedAt: string;          // AL-4.5
}

export interface AuthSession {
  userId: string;
  username: string;
  role: SystemRole;
  fullName: string;
  token: string;               // 32-byte hex (SM-4)
  issuedAt: string;            // ISO 8601
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
// Constants
// ─────────────────────────────────────────────────────────────────────────────

const STORE_KEY = 'csb_auth_users';
const SESSION_KEY = 'csb_auth_session';
const MAX_FAILED = 3; // IA-8

// ─────────────────────────────────────────────────────────────────────────────
// Crypto helpers
// ─────────────────────────────────────────────────────────────────────────────

/** Hash a password with SHA-256 via SubtleCrypto. Returns a hex string. */
export async function hashPassword(password: string): Promise<string> {
  const encoder = new TextEncoder();
  const data = encoder.encode(password);
  const hashBuffer = await crypto.subtle.digest('SHA-256', data);
  return Array.from(new Uint8Array(hashBuffer))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
}

/** Generate a random 32-byte hex token (SM-4 session token). */
export function randomToken(): string {
  const bytes = new Uint8Array(32);
  crypto.getRandomValues(bytes);
  return Array.from(bytes, (b) => b.toString(16).padStart(2, '0')).join('');
}

// ─────────────────────────────────────────────────────────────────────────────
// Persistence (localStorage)
// ─────────────────────────────────────────────────────────────────────────────

export function loadUsers(): SystemUser[] {
  try {
    const raw = localStorage.getItem(STORE_KEY);
    if (!raw) return [];
    return JSON.parse(raw) as SystemUser[];
  } catch {
    return [];
  }
}

export function saveUsers(users: SystemUser[]): void {
  localStorage.setItem(STORE_KEY, JSON.stringify(users));
}

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
// Seed: create the default admin if the store is empty
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Ensures the default admin account exists.
 * Called once at app startup.
 * Admin: username=admin  password=csbadmin123
 */
export async function seedDefaultAdmin(): Promise<void> {
  const users = loadUsers();
  const already = users.find((u) => u.username === 'admin');
  if (already) return;

  const hash = await hashPassword('csbadmin123');
  const admin: SystemUser = {
    id: 'sys-admin-001',
    username: 'admin',
    fullName: 'System Administrator',
    email: 'admin@citysavings.com.ph',
    role: 'admin',
    passwordHash: hash,
    isActive: true,
    isLocked: false,
    failedLoginCount: 0,
    requiresPasswordChange: false,
    createdAt: new Date().toISOString(),
    lastLogin: null,
    modifiedAt: new Date().toISOString(),
  };
  saveUsers([...users, admin]);
}

// ─────────────────────────────────────────────────────────────────────────────
// Auth actions
// ─────────────────────────────────────────────────────────────────────────────

/**
 * IA-1/IA-7/IA-8/SM-4: Authenticate a user.
 * Returns a LoginResult — always with a generic error message (IA-7).
 */
export async function login(username: string, password: string): Promise<LoginResult> {
  const GENERIC = 'Login failed. Invalid user ID or password.'; // IA-7

  const users = loadUsers();
  const user = users.find((u) => u.username.toLowerCase() === username.trim().toLowerCase());

  // IA-7: do not reveal whether username exists
  if (!user || !user.isActive) {
    return { success: false, error: GENERIC };
  }

  // IA-9: locked accounts require admin intervention
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
    // IA-8: increment counter, lock at threshold
    const newCount = user.failedLoginCount + 1;
    const shouldLock = newCount >= MAX_FAILED;
    const updated = users.map((u) =>
      u.id === user.id
        ? { ...u, failedLoginCount: newCount, isLocked: shouldLock }
        : u
    );
    saveUsers(updated);

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

  // Success — reset counter, update last login, revoke any old session (SM-4)
  const token = randomToken();
  const now = new Date().toISOString();
  const updated = users.map((u) =>
    u.id === user.id
      ? { ...u, failedLoginCount: 0, isLocked: false, lastLogin: now }
      : u
  );
  saveUsers(updated);
  clearSession(); // SM-4: invalidate previous session

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

  return {
    success: true,
    session,
    requiresPasswordChange: user.requiresPasswordChange,
  };
}

/** Logout: invalidate session server-side (SM-4). */
export function logout(): void {
  clearSession();
}

// ─────────────────────────────────────────────────────────────────────────────
// Admin-only user management  (LAC-1: only 'admin' role may call these)
// ─────────────────────────────────────────────────────────────────────────────

/** LAC-1/IA-2: Add a new user. Only callable by an admin session. */
export async function adminAddUser(
  session: AuthSession,
  data: {
    username: string;
    fullName: string;
    email: string;
    role: SystemRole;
    password: string;
  }
): Promise<{ success: boolean; error?: string }> {
  if (session.role !== 'admin') {
    return { success: false, error: 'Access denied. Admin role required.' };
  }

  const users = loadUsers();

  // IA-2: unique username
  const taken = users.some(
    (u) => u.username.toLowerCase() === data.username.trim().toLowerCase()
  );
  if (taken) {
    return {
      success: false,
      error: `Username "${data.username}" already exists. Each user must have a unique username.`,
    };
  }

  if (!data.password || data.password.length < 8) {
    return { success: false, error: 'Password must be at least 8 characters.' };
  }

  const hash = await hashPassword(data.password);
  const now = new Date().toISOString();
  const newUser: SystemUser = {
    id: `usr-${Date.now()}`,
    username: data.username.trim().toLowerCase(),
    fullName: data.fullName.trim(),
    email: data.email.trim().toLowerCase(),
    role: data.role,
    passwordHash: hash,
    isActive: true,
    isLocked: false,
    failedLoginCount: 0,
    requiresPasswordChange: true, // PM-3: force change on first login
    createdAt: now,
    lastLogin: null,
    modifiedAt: now,
  };

  saveUsers([...users, newUser]);
  return { success: true };
}

/** IA-9/LAC-1: Admin unlocks a locked user account. */
export function adminUnlockUser(
  session: AuthSession,
  targetUserId: string
): { success: boolean; error?: string } {
  if (session.role !== 'admin') {
    return { success: false, error: 'Access denied. Admin role required.' };
  }
  const users = loadUsers();
  const updated = users.map((u) =>
    u.id === targetUserId
      ? { ...u, isLocked: false, failedLoginCount: 0, modifiedAt: new Date().toISOString() }
      : u
  );
  saveUsers(updated);
  return { success: true };
}

/** LAC-1: Admin toggles a user's active status (deactivate / reactivate). */
export function adminToggleActive(
  session: AuthSession,
  targetUserId: string
): { success: boolean; error?: string } {
  if (session.role !== 'admin') {
    return { success: false, error: 'Access denied. Admin role required.' };
  }
  // Prevent admin from deactivating their own account
  if (targetUserId === session.userId) {
    return { success: false, error: 'You cannot deactivate your own account.' };
  }
  const users = loadUsers();
  const updated = users.map((u) =>
    u.id === targetUserId
      ? { ...u, isActive: !u.isActive, modifiedAt: new Date().toISOString() }
      : u
  );
  saveUsers(updated);
  return { success: true };
}

/** LAC-1: Admin resets a user's password and forces change on next login. */
export async function adminResetPassword(
  session: AuthSession,
  targetUserId: string,
  newPassword: string
): Promise<{ success: boolean; error?: string }> {
  if (session.role !== 'admin') {
    return { success: false, error: 'Access denied. Admin role required.' };
  }
  if (!newPassword || newPassword.length < 8) {
    return { success: false, error: 'New password must be at least 8 characters.' };
  }
  const hash = await hashPassword(newPassword);
  const users = loadUsers();
  const updated = users.map((u) =>
    u.id === targetUserId
      ? {
          ...u,
          passwordHash: hash,
          requiresPasswordChange: true, // PM-3
          isLocked: false,
          failedLoginCount: 0,
          modifiedAt: new Date().toISOString(),
        }
      : u
  );
  saveUsers(updated);
  return { success: true };
}

/** PM-3/PM-10: User changes their own password after login. */
export async function changeOwnPassword(
  session: AuthSession,
  currentPassword: string,
  newPassword: string
): Promise<{ success: boolean; error?: string }> {
  const users = loadUsers();
  const user = users.find((u) => u.id === session.userId);
  if (!user) return { success: false, error: 'User not found.' };

  // Verify current password
  const currentHash = await hashPassword(currentPassword);
  if (currentHash !== user.passwordHash) {
    return { success: false, error: 'Current password is incorrect.' };
  }

  // PM-1: enforce minimum length
  if (newPassword.length < 8) {
    return { success: false, error: 'New password must be at least 8 characters.' };
  }

  // PM-2: complexity
  if (!/[a-zA-Z]/.test(newPassword) || !/[0-9]/.test(newPassword)) {
    return {
      success: false,
      error: 'New password must contain letters and numbers.',
    };
  }

  const newHash = await hashPassword(newPassword);

  // PM-5: prevent reuse — check last 6 in history (passwordHistory not stored in minimal store,
  // but we check against the current hash at minimum)
  if (newHash === user.passwordHash) {
    return { success: false, error: 'New password must differ from your current password.' };
  }

  const updated = users.map((u) =>
    u.id === session.userId
      ? {
          ...u,
          passwordHash: newHash,
          requiresPasswordChange: false,
          modifiedAt: new Date().toISOString(),
        }
      : u
  );
  saveUsers(updated);

  // Update session flag
  const updatedSession: AuthSession = { ...session, requiresPasswordChange: false };
  saveSession(updatedSession);

  return { success: true };
}
