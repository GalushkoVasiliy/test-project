import type { DateOnly } from '@/api/types';

const currency = new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 });
const dateFormat = new Intl.DateTimeFormat('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
const dateTimeFormat = new Intl.DateTimeFormat('en-US', {
  month: 'short',
  day: 'numeric',
  year: 'numeric',
  hour: 'numeric',
  minute: '2-digit',
});

export const formatRent = (amount: number) => `${currency.format(amount)}/mo`;

/** "2026-10-20" → "Oct 20, 2026" (interpreted as a calendar date, not shifted by time zone). */
export function formatDate(value: DateOnly | null | undefined): string {
  if (!value) return '—';
  const [year, month, day] = value.split('-').map(Number);
  return dateFormat.format(new Date(year!, month! - 1, day!));
}

export function formatDateTime(value: string | null | undefined): string {
  return value ? dateTimeFormat.format(new Date(value)) : '—';
}

export function bedroomsLabel(bedrooms: number): string {
  if (bedrooms === 0) return 'No bedroom';
  return `${bedrooms} bed${bedrooms === 1 ? '' : 's'}`;
}
