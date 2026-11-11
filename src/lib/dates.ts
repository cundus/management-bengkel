import { APP_TIMEZONE } from "./constants";

const DATE_FORMATTER = new Intl.DateTimeFormat("en-CA", {
  timeZone: APP_TIMEZONE,
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
});

export function todayISO(now: Date = new Date()): string {
  return DATE_FORMATTER.format(now);
}

export function nowISO(): string {
  return new Date().toISOString();
}

export function parseDateOnly(isoDate: string): Date {
  return new Date(`${isoDate}T00:00:00.000Z`);
}

export function dateOnlyToISO(date: Date): string {
  return date.toISOString().slice(0, 10);
}

export function dateTimeToISO(date: Date): string {
  return date.toISOString();
}

export function addDaysISO(isoDate: string, days: number): string {
  const date = new Date(`${isoDate}T12:00:00Z`);
  date.setUTCDate(date.getUTCDate() + days);
  return date.toISOString().slice(0, 10);
}

export function startOfMonthISO(isoDate: string): string {
  return `${isoDate.slice(0, 7)}-01`;
}

export function endOfMonthISO(isoDate: string): string {
  const [year, month] = isoDate.split("-").map(Number);
  const date = new Date(Date.UTC(year, month, 0, 12));
  return date.toISOString().slice(0, 10);
}

export function currentMonthISO(): string {
  return todayISO().slice(0, 7);
}

export function isValidMonth(month: string | undefined | null): month is string {
  return !!month && /^\d{4}-(0[1-9]|1[0-2])$/.test(month);
}

export function monthLabel(month: string): string {
  const [year, m] = month.split("-").map(Number);
  return new Intl.DateTimeFormat("id-ID", {
    month: "long",
    year: "numeric",
    timeZone: "UTC",
  }).format(new Date(Date.UTC(year, m - 1, 1)));
}

export function formatDateID(isoDate: string | null | undefined): string {
  if (!isoDate) return "—";
  const date = new Date(`${isoDate.slice(0, 10)}T12:00:00Z`);
  return new Intl.DateTimeFormat("id-ID", {
    day: "numeric",
    month: "short",
    year: "numeric",
    timeZone: "UTC",
  }).format(date);
}

export function formatDateTimeID(isoDateTime: string | null | undefined): string {
  if (!isoDateTime) return "—";
  return new Intl.DateTimeFormat("id-ID", {
    day: "numeric",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    timeZone: APP_TIMEZONE,
  }).format(new Date(isoDateTime));
}

export function formatDayShort(isoDate: string): string {
  return new Intl.DateTimeFormat("id-ID", {
    weekday: "short",
    day: "numeric",
    timeZone: "UTC",
  }).format(new Date(`${isoDate}T12:00:00Z`));
}

export function formatTimeID(isoDateTime: string): string {
  return new Intl.DateTimeFormat("id-ID", {
    hour: "2-digit",
    minute: "2-digit",
    timeZone: APP_TIMEZONE,
  }).format(new Date(isoDateTime));
}

export function isValidISODate(value: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const date = new Date(`${value}T12:00:00Z`);
  return !Number.isNaN(date.getTime()) && date.toISOString().slice(0, 10) === value;
}

export function daysBetween(fromISO: string, toISO: string): number {
  const from = new Date(`${fromISO}T12:00:00Z`).getTime();
  const to = new Date(`${toISO}T12:00:00Z`).getTime();
  return Math.round((to - from) / 86_400_000);
}

export function dueLabel(dueDate: string | null, today = todayISO()): {
  label: string;
  tone: "safe" | "soon" | "overdue" | "none";
  days: number | null;
} {
  if (!dueDate) return { label: "Tanpa jatuh tempo", tone: "none", days: null };
  const days = daysBetween(today, dueDate);
  if (days < 0) return { label: `Lewat ${Math.abs(days)} hari`, tone: "overdue", days };
  if (days === 0) return { label: "Jatuh tempo hari ini", tone: "soon", days };
  if (days <= 3) return { label: `${days} hari lagi`, tone: "soon", days };
  return { label: formatDateID(dueDate), tone: "safe", days };
}

export function relativeDayLabel(isoDate: string, today = todayISO()): string {
  if (isoDate === today) return "Hari ini";
  if (isoDate === addDaysISO(today, -1)) return "Kemarin";
  return formatDateID(isoDate);
}

export function monthRange(month: string): { start: string; end: string } {
  return { start: `${month}-01`, end: endOfMonthISO(`${month}-01`) };
}

export function lastNDates(n: number, today = todayISO()): string[] {
  return Array.from({ length: n }, (_, index) => addDaysISO(today, index - (n - 1)));
}

export const MAX_REPORT_RANGE_DAYS = 366;

export type ReportPeriod =
  | { mode: "bulanan"; month: string; start: string; end: string }
  | { mode: "harian"; month: string; start: string; end: string };

/**
 * Tentukan periode laporan dari query string. `from`/`to` (YYYY-MM-DD) yang valid
 * menghasilkan laporan interval harian; selain itu jatuh ke laporan bulanan.
 * Urutan tanggal yang terbalik ditukar dan rentang dibatasi MAX_REPORT_RANGE_DAYS.
 */
export function resolveReportPeriod(params: {
  month?: string | null;
  from?: string | null;
  to?: string | null;
}): ReportPeriod {
  const from = params.from && isValidISODate(params.from) ? params.from : null;
  const to = params.to && isValidISODate(params.to) ? params.to : null;
  if (from || to) {
    let start = from ?? to!;
    let end = to ?? from!;
    if (start > end) [start, end] = [end, start];
    if (daysBetween(start, end) >= MAX_REPORT_RANGE_DAYS) {
      start = addDaysISO(end, -(MAX_REPORT_RANGE_DAYS - 1));
    }
    return { mode: "harian", month: start.slice(0, 7), start, end };
  }
  const month = isValidMonth(params.month) ? params.month : currentMonthISO();
  return { mode: "bulanan", month, ...monthRange(month) };
}

export function rangeLabel(start: string, end: string): string {
  return start === end ? formatDateID(start) : `${formatDateID(start)} – ${formatDateID(end)}`;
}
