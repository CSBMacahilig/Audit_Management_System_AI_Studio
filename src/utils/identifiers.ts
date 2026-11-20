export type IdentifierPrefix =
  | 'AU'
  | 'AE'
  | 'IA'
  | 'AD'
  | 'IS'
  | 'WP'
  | 'FN'
  | 'AF'
  | 'AL'
  | 'PBC';

export function formatIdentifier(
  prefix: IdentifierPrefix,
  sequence: number,
  width = 4
): string {
  const safeSequence = Number.isInteger(sequence) && sequence > 0 ? sequence : 1;
  return `${prefix}-${String(safeSequence).padStart(width, '0')}`;
}

export function formatYearIdentifier(
  prefix: IdentifierPrefix,
  year: number,
  sequence: number
): string {
  const safeYear = Number.isInteger(year) ? year : new Date().getUTCFullYear();
  return `${prefix}-${safeYear}-${String(sequence).padStart(3, '0')}`;
}

export function nextIdentifierSequence(records: Array<{ id?: string; code?: string; ref?: string }>, prefix: IdentifierPrefix): number {
  const pattern = new RegExp(`^${prefix}-`, 'i');
  const numbers = records
    .flatMap((record) => [record.id, record.code, record.ref])
    .filter((value): value is string => Boolean(value))
    .filter((value) => pattern.test(value))
    .map((value) => {
      const matches = value.match(/(\d+)/g);
      return matches ? Number(matches[matches.length - 1]) : 0;
    });
  return Math.max(0, ...numbers) + 1;
}

export function normalizeLegacyIdentifier(
  value: string | undefined,
  prefix: IdentifierPrefix,
  fallbackSequence: number
): string {
  if (!value) return formatIdentifier(prefix, fallbackSequence);
  if (value.startsWith(`${prefix}-`)) return value;
  const lastNumber = value.match(/(\d+)/g)?.at(-1);
  return formatIdentifier(prefix, lastNumber ? Number(lastNumber) : fallbackSequence);
}

export function normalizeYearIdentifier(
  value: string | undefined,
  prefix: 'AE',
  year: number,
  fallbackSequence: number
): string {
  if (!value) return formatYearIdentifier(prefix, year, fallbackSequence);
  if (/^AE-\d{4}-\d{3}$/.test(value)) return value;
  const numbers = value.match(/(\d+)/g);
  if (!numbers) return formatYearIdentifier(prefix, year, fallbackSequence);
  const sequence = numbers.length > 1 ? Number(numbers[numbers.length - 1]) : fallbackSequence;
  return formatYearIdentifier(prefix, year, sequence);
}
