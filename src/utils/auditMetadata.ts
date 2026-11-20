import { loadSession } from './authStore';

export interface RowAuditMetadata {
  addedBy?: string;
  modifiedBy?: string;
  modifiedAt?: string;
}

export function getCurrentAccountEmail(fallback = 'System'): string {
  try {
    return loadSession()?.email || loadSession()?.username || fallback;
  } catch {
    return fallback;
  }
}

export function stampAddedMetadata<T extends RowAuditMetadata>(
  row: T,
  accountEmail?: string
): T {
  const actor = accountEmail || getCurrentAccountEmail();
  const now = new Date().toISOString();
  return {
    ...row,
    addedBy: row.addedBy || actor,
    modifiedBy: actor,
    modifiedAt: now,
  };
}

export function formatAuditDate(value?: string): string {
  if (!value) return '—';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleString('en-PH', {
    year: 'numeric',
    month: 'short',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  });
}
