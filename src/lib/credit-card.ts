/**
 * Pure date math for the credit-card bill tracker. No DB / server deps so it
 * can be shared by the API, the cron, and the client UI.
 *
 * Cards store only day-of-month integers (bill day, due day). These helpers
 * resolve those into concrete dates relative to "today", clamping the day to
 * the target month's length (so a due-day of 31 lands on the 28th in February).
 *
 * Alerts fire a fixed number of days before the due date.
 */

/** Days-before-due on which a WhatsApp reminder is sent. */
export const ALERT_LEAD_DAYS = [7, 1] as const;

/** Strip the time component — comparisons are date-only. */
export function startOfDay(d: Date): Date {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate());
}

/** Clamp a day-of-month to the actual length of (year, monthIndex0). */
export function clampDay(year: number, monthIndex0: number, day: number): number {
  const lastDay = new Date(year, monthIndex0 + 1, 0).getDate();
  return Math.min(Math.max(day, 1), lastDay);
}

/** "YYYY-MM" key for the month containing `d`. */
export function ymKey(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  return `${y}-${m}`;
}

/**
 * The YYYY-MM of the statement the operator should currently be paying.
 * On/after the bill day → this month's statement; before it → last month's.
 */
export function currentCycleKey(today: Date, billDayOfMonth: number): string {
  const t = startOfDay(today);
  const billDay = clampDay(t.getFullYear(), t.getMonth(), billDayOfMonth);
  if (t.getDate() >= billDay) return ymKey(t);
  // Before the bill day → the live statement is last month's.
  return ymKey(new Date(t.getFullYear(), t.getMonth() - 1, 1));
}

/** The next occurrence of `dueDayOfMonth` on or after today. */
export function nextDueDate(today: Date, dueDayOfMonth: number): Date {
  const t = startOfDay(today);
  const thisMonthDay = clampDay(t.getFullYear(), t.getMonth(), dueDayOfMonth);
  const candidate = new Date(t.getFullYear(), t.getMonth(), thisMonthDay);
  if (candidate.getTime() >= t.getTime()) return candidate;
  // Already past this month's due day → roll to next month.
  const nextDay = clampDay(t.getFullYear(), t.getMonth() + 1, dueDayOfMonth);
  return new Date(t.getFullYear(), t.getMonth() + 1, nextDay);
}

/** Whole days from today until the next due date (0 = due today). */
export function daysUntilDue(today: Date, dueDayOfMonth: number): number {
  const t = startOfDay(today);
  const due = nextDueDate(today, dueDayOfMonth);
  return Math.round((due.getTime() - t.getTime()) / 86_400_000);
}

/** Ordinal suffix for a day-of-month, e.g. 1 → "1st", 22 → "22nd". */
export function ordinal(n: number): string {
  const s = ["th", "st", "nd", "rd"];
  const v = n % 100;
  return n + (s[(v - 20) % 10] || s[v] || s[0]);
}
