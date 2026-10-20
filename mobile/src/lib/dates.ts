import type { DateOnly } from '@/api/types';

const pad = (n: number) => String(n).padStart(2, '0');

/** Local calendar date as "YYYY-MM-DD". */
export function toDateOnly(date: Date): DateOnly {
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}

export function fromDateOnly(value: DateOnly): Date {
  const [year, month, day] = value.split('-').map(Number);
  return new Date(year!, month! - 1, day!);
}

export const today = (): DateOnly => toDateOnly(new Date());

export const isDateOnly = (value: string) => /^\d{4}-\d{2}-\d{2}$/.test(value);
