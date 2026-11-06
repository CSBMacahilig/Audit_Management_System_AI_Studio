import { AuditEngagement, IssueRegisterItem, UserProfile, WorkingNote } from '../data/auditData';

/**
 * OWASP Baseline Security Utilities
 * - A01:2021 Broken Access Control (RBAC & Segregation of Duties enforcement)
 * - A03:2021 Injection / Cross-Site Scripting (Strict input sanitization & allowlisting)
 * - A04:2021 Insecure Design (Maker-checker & multi-stage approval guardrails)
 * - A08:2021 Software & Data Integrity Failures (File upload validation & safe JSON parsing)
 */

const DANGEROUS_PROTOCOLS = /^(javascript|data|vbscript|file):/i;
const CONTROL_CHARS_REGEX = /[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g;
const HTML_TAG_REGEX = /<\/?[a-z][^>]*>/gi;

/**
 * Sanitizes single-line text inputs against XSS, HTML injection, and control characters.
 */
export function sanitizeText(input: string, maxLength = 250): string {
  if (typeof input !== 'string') return '';
  const cleaned = input
    .replace(CONTROL_CHARS_REGEX, '')
    .replace(HTML_TAG_REGEX, '')
    .replace(/[<>]/g, '')
    .trim();

  if (DANGEROUS_PROTOCOLS.test(cleaned)) {
    return '';
  }
  return cleaned.slice(0, maxLength);
}

/**
 * Sanitizes multi-line text inputs (such as testing procedures, audit conclusions, and findings)
 * while preserving safe line breaks.
 */
export function sanitizeMultiline(input: string, maxLength = 2000): string {
  if (typeof input !== 'string') return '';
  const cleaned = input
    .replace(CONTROL_CHARS_REGEX, '')
    .replace(HTML_TAG_REGEX, '')
    .replace(/[<>]/g, '')
    .trim();

  if (DANGEROUS_PROTOCOLS.test(cleaned)) {
    return '';
  }
  return cleaned.slice(0, maxLength);
}

/**
 * Validates and clamps numeric inputs (e.g., Likelihood 1-5, Impact 1-5, Cycle months 1-60).
 */
export function clampNumber(value: unknown, min: number, max: number, fallback: number): number {
  const num = Number(value);
  if (!Number.isFinite(num)) return fallback;
  return Math.min(max, Math.max(min, Math.round(num)));
}

/**
 * Validates email format against a safe RFC-compliant pattern.
 */
export function sanitizeEmail(email: string): string {
  const cleaned = sanitizeText(email, 120).toLowerCase();
  const emailRegex = /^[a-z0-9._%+-]+@[a-z0-9.-]+\.[a-z]{2,}$/;
  return emailRegex.test(cleaned) ? cleaned : '';
}

const ALLOWED_FILE_EXTENSIONS = ['.pdf', '.docx', '.xlsx', '.csv', '.png', '.jpg', '.txt'];

/**
 * OWASP A08 File Upload Validation:
 * Prevents path traversal, null-byte injection, and unapproved executable extensions.
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

/**
 * OWASP A01 Segregation of Duties (SoD) & RBAC check for Working Note Supervisory Review:
 * - In Enforced Access mode, the preparer (author) of a working note cannot approve their own note.
 * - Head review requires `canApproveHead` or `canApproveCAE`.
 * - Independent review requires `canApproveIndependent` or `canApproveCAE`.
 */
export function checkWorkingNoteReviewPermission(
  user: UserProfile,
  note: WorkingNote,
  engagement: AuditEngagement,
  accessActive: boolean
): { allowed: boolean; reason?: string } {
  if (!accessActive) {
    return { allowed: true };
  }
  if (user.name === note.author && !user.canApproveCAE) {
    return {
      allowed: false,
      reason: `Segregation of Duties (SoD): ${user.name} authored ${note.ref} and cannot self-approve it.`,
    };
  }
  if (note.status === 'For head review' && !user.canApproveHead && !user.canApproveCAE) {
    return {
      allowed: false,
      reason: `Head review sign-off requires Head Reviewer (${engagement.headReviewer}) or CAE role.`,
    };
  }
  if (
    note.status === 'For independent review' &&
    !user.canApproveIndependent &&
    !user.canApproveCAE
  ) {
    return {
      allowed: false,
      reason: 'Independent review sign-off requires an Independent Reviewer or Audit Manager role.',
    };
  }
  return { allowed: true };
}

/**
 * OWASP A08 Safe JSON Deserialization (prevents prototype pollution on backup restore).
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
