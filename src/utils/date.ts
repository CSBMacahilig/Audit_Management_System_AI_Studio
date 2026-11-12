const ISO_DATE_PATTERN = /^(\d{4})-(\d{2})-(\d{2})$/;
const FULL_TEXT_DATE_PATTERN = /^(\d{1,2})\s+([a-z]+)\s+(\d{4})$/i;
const MONTHS = [
  'jan', 'feb', 'mar', 'apr', 'may', 'jun',
  'jul', 'aug', 'sep', 'oct', 'nov', 'dec',
];

export function toDateInputValue(value?: string | null): string {
  const trimmed = value?.trim() ?? '';
  if (!trimmed) return '';

  const isoMatch = trimmed.match(ISO_DATE_PATTERN);
  if (isoMatch) {
    const [, year, month, day] = isoMatch;
    const date = new Date(Number(year), Number(month) - 1, Number(day));
    if (
      date.getFullYear() === Number(year) &&
      date.getMonth() === Number(month) - 1 &&
      date.getDate() === Number(day)
    ) {
      return trimmed;
    }
    return '';
  }

  const textMatch = trimmed.match(FULL_TEXT_DATE_PATTERN);
  if (!textMatch) return '';
  const [, dayText, monthText, yearText] = textMatch;
  const monthIndex = MONTHS.indexOf(monthText.slice(0, 3).toLowerCase());
  if (monthIndex < 0) return '';
  const dayNumber = Number(dayText);
  const yearNumber = Number(yearText);
  const date = new Date(yearNumber, monthIndex, dayNumber);
  if (
    date.getFullYear() !== yearNumber ||
    date.getMonth() !== monthIndex ||
    date.getDate() !== dayNumber
  ) {
    return '';
  }

  const year = String(yearNumber);
  const month = String(monthIndex + 1).padStart(2, '0');
  const day = String(dayNumber).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

export function formatDateForDisplay(value?: string | null): string {
  const dateInputValue = toDateInputValue(value);
  if (!dateInputValue) return value?.trim() ?? '';
  const [year, month, day] = dateInputValue.split('-').map(Number);
  return new Date(year, month - 1, day).toLocaleDateString('en-GB', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  });
}
