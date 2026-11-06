import { AuditEngagement, IssueRegisterItem, UserProfile, WorkingNote } from '../data/auditData';

/**
 * OCISO Baseline Security Standards Checklist (BSSC) V3 – Security Utilities
 *
 * Implements all required controls from the Security Requirements Guide:
 *
 * LAC  – Logical Access Controls   (RBAC, Segregation of Duties, maker/checker)
 * IA   – Identification & Authentication (lockout, generic errors, autocomplete)
 * PM   – Password Management       (complexity, history, min/max age, expiry)
 * SM   – Session Management        (idle timeout, concurrent login prevention)
 * AL   – Audit Logging             (structured event schema, AL-4.x fields)
 * EC   – Encryption                (helpers for TLS/HSTS notes)
 *
 * OWASP Baseline additionally addressed:
 * - A01:2021 Broken Access Control  (RBAC & SoD enforcement)
 * - A03:2021 Injection / XSS        (strict input sanitisation)
 * - A04:2021 Insecure Design        (maker-checker, multi-stage approval)
 * - A08:2021 Data Integrity Failures (safe JSON parsing, file upload validation)
 */

// ─────────────────────────────────────────────────────────────────────────────
// CONSTANTS (configurable via SecurityPolicy settings)
// ─────────────────────────────────────────────────────────────────────────────

/** IA-8: Maximum consecutive failed login attempts before lockout */
export const DEFAULT_MAX_FAILED_ATTEMPTS = 3;

/** SM-1: Idle session timeout in minutes (configurable) */
export const DEFAULT_SESSION_TIMEOUT_MINUTES = 15;

/** SM-2 (optional): Absolute session timeout in hours */
export const DEFAULT_ABSOLUTE_SESSION_HOURS = 8;

/** PM-1: Minimum password length for regular accounts */
export const PW_MIN_LENGTH_REGULAR = 8;

/** PM-1: Minimum password length for privileged accounts */
export const PW_MIN_LENGTH_PRIVILEGED = 12;

/** PM-1: Maximum password length (DoS mitigation) */
export const PW_MAX_LENGTH = 64;

/** PM-5: Number of previous passwords to remember */
export const PW_HISTORY_COUNT = 6;

/** PM-6: Minimum password age in hours (1 day) */
export const PW_MIN_AGE_HOURS = 24;

/** PM-7: Maximum password age in days for systems without MFA */
export const PW_MAX_AGE_NO_MFA_DAYS = 180;

/** PM-7: Maximum password age in days for systems with MFA */
export const PW_MAX_AGE_MFA_DAYS = 365;

/** PM-8 (optional): Warn user N days before expiry */
export const PW_EXPIRY_WARN_DAYS = 15;

/** PM-4: Initial/temporary password length */
export const PW_TEMP_LENGTH = 8;

// ─────────────────────────────────────────────────────────────────────────────
// INPUT SANITISATION  (OWASP A03 – Injection / XSS)
// ─────────────────────────────────────────────────────────────────────────────

const DANGEROUS_PROTOCOLS = /^(javascript|data|vbscript|file):/i;
const CONTROL_CHARS_REGEX = /[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g;
const HTML_TAG_REGEX = /<\/?[a-z][^>]*>/gi;

/** Sanitises single-line text inputs against XSS, HTML injection, and control characters. */
export function sanitizeText(input: string, maxLength = 250): string {
  if (typeof input !== 'string') return '';
  const cleaned = input
    .replace(CONTROL_CHARS_REGEX, '')
    .replace(HTML_TAG_REGEX, '')
    .replace(/[<>]/g, '')
    .trim();

  if (DANGEROUS_PROTOCOLS.test(cleaned)) return '';
  return cleaned.slice(0, maxLength);
}

/** Sanitises multi-line text inputs while preserving safe line breaks. */
export function sanitizeMultiline(input: string, maxLength = 2000): string {
  if (typeof input !== 'string') return '';
  const cleaned = input
    .replace(CONTROL_CHARS_REGEX, '')
    .replace(HTML_TAG_REGEX, '')
    .replace(/[<>]/g, '')
    .trim();

  if (DANGEROUS_PROTOCOLS.test(cleaned)) return '';
  return cleaned.slice(0, maxLength);
}

/** Validates and clamps numeric inputs. */
export function clampNumber(value: unknown, min: number, max: number, fallback: number): number {
  const num = Number(value);
  if (!Number.isFinite(num)) return fallback;
  return Math.min(max, Math.max(min, Math.round(num)));
}

/** Validates email format against a safe RFC-compliant pattern. */
export function sanitizeEmail(email: string): string {
  const cleaned = sanitizeText(email, 120).toLowerCase();
  const emailRegex = /^[a-z0-9._%+-]+@[a-z0-9.-]+\.[a-z]{2,}$/;
  return emailRegex.test(cleaned) ? cleaned : '';
}

// ─────────────────────────────────────────────────────────────────────────────
// PM – PASSWORD MANAGEMENT
// ─────────────────────────────────────────────────────────────────────────────

/**
 * PM-1 / PM-2: Validate password strength.
 * Returns an object with `valid` flag and specific `violations` list.
 * @param password - the candidate password
 * @param isPrivileged - true for admin/privileged accounts (12-char minimum)
 */
export function validatePasswordStrength(
  password: string,
  isPrivileged = false
): { valid: boolean; violations: string[] } {
  const violations: string[] = [];
  const minLen = isPrivileged ? PW_MIN_LENGTH_PRIVILEGED : PW_MIN_LENGTH_REGULAR;

  if (password.length < minLen) {
    violations.push(
      `Minimum length is ${minLen} characters${isPrivileged ? ' (privileged account)' : ''}.`
    );
  }
  if (password.length > PW_MAX_LENGTH) {
    violations.push(`Maximum length is ${PW_MAX_LENGTH} characters.`);
  }
  if (!/[a-zA-Z]/.test(password)) {
    violations.push('Must contain at least one alphabetic character.');
  }
  if (!/[0-9]/.test(password)) {
    violations.push('Must contain at least one numeric character.');
  }
  if (!/[^a-zA-Z0-9]/.test(password)) {
    violations.push('Must contain at least one special character (e.g. !@#$%^&*).');
  }

  return { valid: violations.length === 0, violations };
}

/**
 * PM-5: Check whether a new password matches any of the last N stored hashes.
 * In this front-end context, hashes are simulated as plain-text history entries.
 * A real implementation must compare bcrypt/Argon2id hashes server-side.
 */
export function isPasswordReused(newPassword: string, history: string[]): boolean {
  return history.slice(0, PW_HISTORY_COUNT).includes(newPassword);
}

/**
 * PM-6: Enforce minimum password age (1 day = 24 hours).
 * Returns true when the user is allowed to change their password.
 */
export function canChangePassword(lastChangedIso: string | null): boolean {
  if (!lastChangedIso) return true;
  const lastChanged = new Date(lastChangedIso).getTime();
  const nowMs = Date.now();
  const elapsedHours = (nowMs - lastChanged) / (1000 * 60 * 60);
  return elapsedHours >= PW_MIN_AGE_HOURS;
}

/**
 * PM-7 / PM-9: Determine the password expiry state for a given user.
 * Returns `expired`, `warningSoon`, `ok`, or `notSet`.
 */
export function getPasswordExpiryState(
  lastChangedIso: string | null,
  hasMfa: boolean
): 'expired' | 'warningSoon' | 'ok' | 'notSet' {
  if (!lastChangedIso) return 'notSet';
  const lastChanged = new Date(lastChangedIso).getTime();
  const maxDays = hasMfa ? PW_MAX_AGE_MFA_DAYS : PW_MAX_AGE_NO_MFA_DAYS;
  const expiryMs = lastChanged + maxDays * 24 * 60 * 60 * 1000;
  const nowMs = Date.now();
  const daysRemaining = (expiryMs - nowMs) / (1000 * 60 * 60 * 24);

  if (daysRemaining <= 0) return 'expired';
  if (daysRemaining <= PW_EXPIRY_WARN_DAYS) return 'warningSoon';
  return 'ok';
}

/**
 * PM-4: Generate a cryptographically safe temporary password (alphanumeric, min 6 chars).
 * Uses Web Crypto API (crypto.getRandomValues) as the CSPRNG source.
 */
export function generateTemporaryPassword(length = PW_TEMP_LENGTH): string {
  const charset = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz23456789!@#$%';
  const randomValues = new Uint32Array(length);
  crypto.getRandomValues(randomValues);
  return Array.from(randomValues, (v) => charset[v % charset.length]).join('');
}

/**
 * PM-13 (optional): Score password strength 0–4 using a simplified zxcvbn-style heuristic.
 * Returns: 0 = Very weak, 1 = Weak, 2 = Fair, 3 = Strong, 4 = Very strong.
 */
export function scorePasswordStrength(password: string): number {
  if (!password) return 0;
  let score = 0;
  if (password.length >= 8) score++;
  if (password.length >= 12) score++;
  if (/[A-Z]/.test(password) && /[a-z]/.test(password)) score++;
  if (/[0-9]/.test(password)) score++;
  if (/[^a-zA-Z0-9]/.test(password)) score++;
  // Penalise very common patterns
  if (/^(password|123456|qwerty|abc)/i.test(password)) score = Math.max(0, score - 2);
  return Math.min(4, score);
}

export const PASSWORD_STRENGTH_LABELS = ['Very weak', 'Weak', 'Fair', 'Strong', 'Very strong'];
export const PASSWORD_STRENGTH_COLORS = [
  'bg-red-500',
  'bg-orange-500',
  'bg-yellow-500',
  'bg-green-500',
  'bg-emerald-600',
];

// ─────────────────────────────────────────────────────────────────────────────
// IA – IDENTIFICATION & AUTHENTICATION
// ─────────────────────────────────────────────────────────────────────────────

/**
 * IA-7: Return a generic, non-revealing authentication error message.
 * Must never indicate whether the username or password was wrong.
 */
export function genericAuthError(): string {
  return 'Login failed. Invalid user ID or password.';
}

/**
 * IA-2: Check whether a username already exists (case-insensitive).
 */
export function isUsernameTaken(username: string, existingUsernames: string[]): boolean {
  const normalized = username.trim().toLowerCase();
  return existingUsernames.some((u) => u.trim().toLowerCase() === normalized);
}

/**
 * IA-8: Increment failed-login counter and determine if the account should be locked.
 * Returns the new counter value and a `shouldLock` flag.
 * @param currentFailedCount - current server-side failed attempts counter
 * @param maxAllowed - configurable threshold (default: 3)
 */
export function processFailedLogin(
  currentFailedCount: number,
  maxAllowed = DEFAULT_MAX_FAILED_ATTEMPTS
): { newCount: number; shouldLock: boolean } {
  const newCount = currentFailedCount + 1;
  return { newCount, shouldLock: newCount >= maxAllowed };
}

/**
 * IA-8/IA-9: Unlock a user account (admin-only operation).
 * Returns the reset state object.
 */
export function unlockAccount(): { failedLoginCount: number; isLocked: boolean } {
  return { failedLoginCount: 0, isLocked: false };
}

// ─────────────────────────────────────────────────────────────────────────────
// SM – SESSION MANAGEMENT
// ─────────────────────────────────────────────────────────────────────────────

/**
 * SM-1: Determine whether the session has exceeded the idle timeout.
 * @param lastActivityIso - ISO timestamp of last user activity
 * @param timeoutMinutes - configurable idle timeout (default 15 min)
 */
export function isSessionIdleExpired(
  lastActivityIso: string,
  timeoutMinutes = DEFAULT_SESSION_TIMEOUT_MINUTES
): boolean {
  const last = new Date(lastActivityIso).getTime();
  const elapsed = (Date.now() - last) / (1000 * 60);
  return elapsed >= timeoutMinutes;
}

/**
 * SM-2 (optional): Determine whether the session has exceeded the absolute lifetime.
 * @param sessionStartIso - ISO timestamp when session was created
 * @param maxHours - configurable absolute limit (default 8 h)
 */
export function isSessionAbsoluteExpired(
  sessionStartIso: string,
  maxHours = DEFAULT_ABSOLUTE_SESSION_HOURS
): boolean {
  const start = new Date(sessionStartIso).getTime();
  const elapsed = (Date.now() - start) / (1000 * 60 * 60);
  return elapsed >= maxHours;
}

/**
 * SM-4: Generate a unique session token string.
 * Uses Web Crypto CSPRNG to produce a 32-byte hex token.
 * In a server-side implementation this must be stored server-side and validated per request.
 */
export function generateSessionToken(): string {
  const bytes = new Uint8Array(32);
  crypto.getRandomValues(bytes);
  return Array.from(bytes, (b) => b.toString(16).padStart(2, '0')).join('');
}

// ─────────────────────────────────────────────────────────────────────────────
// LAC – LOGICAL ACCESS CONTROLS  (RBAC & Segregation of Duties)
// ─────────────────────────────────────────────────────────────────────────────

/**
 * LAC-1/LAC-2: RBAC + SoD check for Working Note Supervisory Review.
 * - The preparer (author) of a working note cannot approve their own note (maker ≠ checker).
 * - Head review requires `canApproveHead` or `canApproveCAE`.
 * - Independent review requires `canApproveIndependent` or `canApproveCAE`.
 */
export function checkWorkingNoteReviewPermission(
  user: UserProfile,
  note: WorkingNote,
  engagement: AuditEngagement,
  accessActive: boolean
): { allowed: boolean; reason?: string } {
  if (!accessActive) return { allowed: true };

  // LAC-2/LAC-3: Maker ≠ Checker — author cannot self-approve (unless CAE override)
  if (user.name === note.author && !user.canApproveCAE) {
    return {
      allowed: false,
      reason: `Segregation of Duties (SoD): ${user.name} authored ${note.ref} and cannot self-approve it. A different reviewer must sign off. (LAC-2)`,
    };
  }
  if (note.status === 'For head review' && !user.canApproveHead && !user.canApproveCAE) {
    return {
      allowed: false,
      reason: `Head review sign-off requires the Head Reviewer (${engagement.headReviewer}) or Chief Audit Executive role. (LAC-1)`,
    };
  }
  if (
    note.status === 'For independent review' &&
    !user.canApproveIndependent &&
    !user.canApproveCAE
  ) {
    return {
      allowed: false,
      reason: 'Independent review sign-off requires an Independent Reviewer or Audit Manager role. (LAC-1)',
    };
  }
  return { allowed: true };
}

// ─────────────────────────────────────────────────────────────────────────────
// AL – AUDIT LOGGING  (structured event schema, AL-4.x fields)
// ─────────────────────────────────────────────────────────────────────────────

/** AL-4.x Required fields for a user account audit log entry. */
export interface UserAccountAuditEntry {
  /** AL-4.1 */ username: string;
  /** AL-4.2 */ fullName: string;
  /** AL-4.3 */ employeeNumber: string;
  /** AL-4.4 */ lastLoginDate: string; // ISO 8601
  /** AL-4.5 */ accountModifiedAt: string; // ISO 8601
  /** AL-4.6 */ changeDetail: string; // e.g. 'password changed', 'role changed from X to Y'
  /** AL-4.7 */ accountStatus: 'Active' | 'Inactive' | 'Deactivated';
  // Additional required fields for every log entry (AL-1, AL-2)
  eventType:
    | 'login_success'
    | 'login_failed'
    | 'logout'
    | 'password_change'
    | 'account_locked'
    | 'account_unlocked'
    | 'role_change'
    | 'account_created'
    | 'account_deactivated'
    | 'data_export'
    | 'critical_transaction';
  timestamp: string; // ISO 8601 UTC
  sourceIp: string; // '::client' in browser context
  sessionId: string;
}

/**
 * AL-1: Build a structured audit log entry.
 * Structured as JSON to support SIEM ingestion (AL-2) and MSOC forwarding (AL-3).
 * Never includes passwords, full card numbers, or raw session tokens.
 */
export function buildAuditLogEntry(
  params: Omit<UserAccountAuditEntry, 'timestamp' | 'sourceIp'>
): UserAccountAuditEntry {
  return {
    ...params,
    timestamp: new Date().toISOString(),
    sourceIp: '::client', // Resolved to actual IP server-side
  };
}

/**
 * AL-1: Format a log entry as a structured JSON string for SIEM forwarding.
 * Keys follow CEF/JSON structured log conventions.
 * Sensitive fields (passwords, tokens) must never be logged.
 */
export function serializeAuditEntry(entry: UserAccountAuditEntry): string {
  return JSON.stringify(entry);
}

// ─────────────────────────────────────────────────────────────────────────────
// LAC-3: USER ACCESS LIST EXPORT  (CSV format for UAM reviews)
// ─────────────────────────────────────────────────────────────────────────────

export interface AccessListRow {
  username: string;
  fullName: string;
  email: string;
  employeeNumber: string;
  roles: string[];
  scope: string;
  accountStatus: string;
  dateGranted: string;
  lastModified: string;
  lastLogin: string;
}

/**
 * LAC-3: Generate a CSV string from the user access list.
 * Includes: username, full name, assigned role(s), date granted, last modified.
 * Required evidence for UAM reviews.
 */
export function exportAccessListCsv(rows: AccessListRow[]): string {
  const header = [
    'Username',
    'Full Name',
    'Email',
    'Employee No.',
    'Assigned Roles',
    'Access Scope',
    'Account Status',
    'Date Granted',
    'Last Modified',
    'Last Login',
  ].join(',');

  const csvRows = rows.map((r) => {
    const escape = (v: string) => `"${v.replace(/"/g, '""')}"`;
    return [
      escape(r.username),
      escape(r.fullName),
      escape(r.email),
      escape(r.employeeNumber),
      escape(r.roles.join('; ')),
      escape(r.scope),
      escape(r.accountStatus),
      escape(r.dateGranted),
      escape(r.lastModified),
      escape(r.lastLogin),
    ].join(',');
  });

  return [header, ...csvRows].join('\n');
}

/**
 * Trigger a browser file download for a CSV string.
 */
export function downloadCsv(content: string, filename: string): void {
  const blob = new Blob([content], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  link.click();
  URL.revokeObjectURL(url);
}

// ─────────────────────────────────────────────────────────────────────────────
// FILE UPLOAD VALIDATION  (OWASP A08 – Data Integrity Failures)
// ─────────────────────────────────────────────────────────────────────────────

const ALLOWED_FILE_EXTENSIONS = ['.pdf', '.docx', '.xlsx', '.csv', '.png', '.jpg', '.txt'];

/**
 * OWASP A08: Prevents path traversal, null-byte injection, and unapproved executable extensions.
 */
export function validateFileUpload(
  fileName: string,
  fileSizeKB = 120
): { valid: boolean; sanitizedName: string; error?: string } {
  const raw = sanitizeText(fileName, 140);
  if (!raw) {
    return { valid: false, sanitizedName: '', error: 'File name is required.' };
  }
  if (raw.includes('..') || raw.includes('/') || raw.includes('\\')) {
    return {
      valid: false,
      sanitizedName: '',
      error: 'Path traversal characters are not permitted in file names.',
    };
  }
  const safeName = raw.replace(/[^a-zA-Z0-9._-]/g, '_');
  const lower = safeName.toLowerCase();
  const hasAllowedExt = ALLOWED_FILE_EXTENSIONS.some((ext) => lower.endsWith(ext));
  if (!hasAllowedExt) {
    return {
      valid: false,
      sanitizedName: safeName,
      error: `Allowed file types: ${ALLOWED_FILE_EXTENSIONS.join(', ')}`,
    };
  }
  if (fileSizeKB <= 0 || fileSizeKB > 25600) {
    return {
      valid: false,
      sanitizedName: safeName,
      error: 'File size must be between 1 KB and 25 MB.',
    };
  }
  return { valid: true, sanitizedName: safeName };
}

// ─────────────────────────────────────────────────────────────────────────────
// SAFE JSON DESERIALISATION  (OWASP A08 – Prototype Pollution prevention)
// ─────────────────────────────────────────────────────────────────────────────

/**
 * OWASP A08: Safe JSON deserialisation – prevents prototype pollution on backup restore.
 */
export function safeParseBackupJson(rawJson: string): {
  valid: boolean;
  data?: {
    engagements?: AuditEngagement[];
    issues?: IssueRegisterItem[];
  };
  error?: string;
} {
  try {
    if (rawJson.length > 5_000_000) {
      return { valid: false, error: 'Backup payload exceeds 5 MB safety limit.' };
    }
    const parsed = JSON.parse(rawJson, (key, value) => {
      if (key === '__proto__' || key === 'constructor' || key === 'prototype') {
        return undefined;
      }
      return value;
    });

    if (!parsed || typeof parsed !== 'object') {
      return { valid: false, error: 'Invalid JSON backup object structure.' };
    }
    if (parsed.engagements && !Array.isArray(parsed.engagements)) {
      return { valid: false, error: 'Invalid engagements array in backup.' };
    }
    return { valid: true, data: parsed };
  } catch {
    return { valid: false, error: 'Malformed JSON file. Could not parse backup snapshot.' };
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// EC – ENCRYPTION  (documentation helpers for TLS / HSTS evidence)
// ─────────────────────────────────────────────────────────────────────────────

/**
 * EC-2: Return the required HSTS response header value (max-age ≥ 1 year, per BSSC).
 * Configure this on the web server / CDN layer.
 */
export const REQUIRED_HSTS_HEADER =
  'Strict-Transport-Security: max-age=31536000; includeSubDomains; preload';

/**
 * EC-2: Required minimum TLS version.
 * TLS 1.0 and 1.1 must be disabled; only TLS 1.2 and 1.3 are permitted.
 */
export const MINIMUM_TLS_VERSION = 'TLS 1.2';

// ─────────────────────────────────────────────────────────────────────────────
// SECURITY POLICY CONFIGURATION  (admin-configurable)
// ─────────────────────────────────────────────────────────────────────────────

/** Holds the current runtime security policy (admin-configurable). */
export interface SecurityPolicy {
  /** IA-8 */ maxFailedLoginAttempts: number;
  /** SM-1 */ sessionTimeoutMinutes: number;
  /** SM-2 */ absoluteSessionHours: number;
  /** PM-1 */ passwordMinLengthRegular: number;
  /** PM-1 */ passwordMinLengthPrivileged: number;
  /** PM-5 */ passwordHistoryCount: number;
  /** PM-6 */ passwordMinAgeDays: number;
  /** PM-7 */ passwordMaxAgeDaysNoMfa: number;
  /** PM-7 */ passwordMaxAgeDaysMfa: number;
  /** PM-8 */ passwordExpiryWarnDays: number;
  /** IA-4 */ mfaEnabled: boolean;
  /** EC-2 */ tlsEnforced: boolean;
  /** AL-1 */ auditLoggingEnabled: boolean;
}

/** Default security policy matching BSSC V3 required controls. */
export const DEFAULT_SECURITY_POLICY: SecurityPolicy = {
  maxFailedLoginAttempts: DEFAULT_MAX_FAILED_ATTEMPTS,
  sessionTimeoutMinutes: DEFAULT_SESSION_TIMEOUT_MINUTES,
  absoluteSessionHours: DEFAULT_ABSOLUTE_SESSION_HOURS,
  passwordMinLengthRegular: PW_MIN_LENGTH_REGULAR,
  passwordMinLengthPrivileged: PW_MIN_LENGTH_PRIVILEGED,
  passwordHistoryCount: PW_HISTORY_COUNT,
  passwordMinAgeDays: 1,
  passwordMaxAgeDaysNoMfa: PW_MAX_AGE_NO_MFA_DAYS,
  passwordMaxAgeDaysMfa: PW_MAX_AGE_MFA_DAYS,
  passwordExpiryWarnDays: PW_EXPIRY_WARN_DAYS,
  mfaEnabled: true,
  tlsEnforced: true,
  auditLoggingEnabled: true,
};
