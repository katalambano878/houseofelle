// Calendar helpers for the admin reports (expenses, end of day). Safe on client and server.
//
// The store runs on Africa/Accra time (UTC+0, no daylight saving). Dates are
// plain "YYYY-MM-DD" strings so they never shift with the viewer's time zone.

export const STORE_TIME_ZONE = 'Africa/Accra';

const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;

/** True for a real calendar date written as YYYY-MM-DD. */
export function isIsoDate(value: unknown): value is string {
  if (typeof value !== 'string' || !ISO_DATE.test(value)) return false;
  const [y, m, d] = value.split('-').map(Number);
  const dt = new Date(Date.UTC(y, m - 1, d));
  return dt.getUTCFullYear() === y && dt.getUTCMonth() === m - 1 && dt.getUTCDate() === d;
}

/** Today's date in Accra, as YYYY-MM-DD. */
export function todayInAccra(now: Date = new Date()): string {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: STORE_TIME_ZONE,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(now);
}

function toUtc(date: string): Date {
  const [y, m, d] = date.split('-').map(Number);
  return new Date(Date.UTC(y, m - 1, d));
}

function fromUtc(dt: Date): string {
  return dt.toISOString().slice(0, 10);
}

export function addDays(date: string, days: number): string {
  const dt = toUtc(date);
  dt.setUTCDate(dt.getUTCDate() + days);
  return fromUtc(dt);
}

/** Monday of the week that contains `date`. */
export function startOfWeek(date: string): string {
  const dt = toUtc(date);
  const offset = (dt.getUTCDay() + 6) % 7;
  dt.setUTCDate(dt.getUTCDate() - offset);
  return fromUtc(dt);
}

export function startOfMonth(date: string): string {
  return `${date.slice(0, 7)}-01`;
}

export function endOfMonth(date: string): string {
  const dt = toUtc(startOfMonth(date));
  dt.setUTCMonth(dt.getUTCMonth() + 1);
  dt.setUTCDate(0);
  return fromUtc(dt);
}

export function daysBetween(from: string, to: string): number {
  return Math.round((toUtc(to).getTime() - toUtc(from).getTime()) / 86_400_000);
}

/** "Tue 3 Nov 2026" (or a shorter form with `short`). */
export function formatDay(date: string, style: 'long' | 'short' | 'weekday' = 'long'): string {
  if (!isIsoDate(date)) return date;
  const opts: Intl.DateTimeFormatOptions =
    style === 'short'
      ? { day: 'numeric', month: 'short' }
      : style === 'weekday'
        ? { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' }
        : { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric' };
  return new Intl.DateTimeFormat('en-GB', { ...opts, timeZone: 'UTC' }).format(toUtc(date));
}

/** "Nov 2026" for a YYYY-MM key. */
export function formatMonth(monthKey: string): string {
  return new Intl.DateTimeFormat('en-GB', { month: 'short', year: 'numeric', timeZone: 'UTC' }).format(
    toUtc(`${monthKey}-01`)
  );
}

/** Clock time of a timestamp in Accra, e.g. "14:05". */
export function formatTime(iso: string | null | undefined): string {
  if (!iso) return '';
  const dt = new Date(iso);
  if (Number.isNaN(dt.getTime())) return '';
  return new Intl.DateTimeFormat('en-GB', { timeZone: STORE_TIME_ZONE, hour: '2-digit', minute: '2-digit' }).format(dt);
}

/** Date and time of a timestamp in Accra, e.g. "3 Nov 2026, 14:05". */
export function formatDateTime(iso: string | null | undefined): string {
  if (!iso) return '';
  const dt = new Date(iso);
  if (Number.isNaN(dt.getTime())) return '';
  return new Intl.DateTimeFormat('en-GB', {
    timeZone: STORE_TIME_ZONE,
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  }).format(dt);
}

export type PeriodKey = 'today' | 'week' | 'month' | 'last_month' | 'last_30' | 'year' | 'all' | 'custom';

export const PERIODS: { key: PeriodKey; label: string }[] = [
  { key: 'today', label: 'Today' },
  { key: 'week', label: 'This week' },
  { key: 'month', label: 'This month' },
  { key: 'last_month', label: 'Last month' },
  { key: 'last_30', label: 'Last 30 days' },
  { key: 'year', label: 'This year' },
  { key: 'all', label: 'All time' },
  { key: 'custom', label: 'Custom' },
];

/** Date range for a preset period. `all` returns empty strings (no limit). */
export function periodRange(key: PeriodKey, today: string = todayInAccra()): { from: string; to: string } {
  switch (key) {
    case 'today':
      return { from: today, to: today };
    case 'week':
      return { from: startOfWeek(today), to: today };
    case 'month':
      return { from: startOfMonth(today), to: today };
    case 'last_month': {
      const lastDay = addDays(startOfMonth(today), -1);
      return { from: startOfMonth(lastDay), to: lastDay };
    }
    case 'last_30':
      return { from: addDays(today, -29), to: today };
    case 'year':
      return { from: `${today.slice(0, 4)}-01-01`, to: today };
    default:
      return { from: '', to: '' };
  }
}
