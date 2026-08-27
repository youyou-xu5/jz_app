import { format, startOfMonth, endOfMonth, parseISO } from "date-fns";

/**
 * Timezone-aware date utilities.
 * Default timezone: Asia/Bangkok (UTC+7)
 */

export function getDefaultTimezone(): string {
  return "Asia/Bangkok";
}

/**
 * Get current date in the user's timezone as YYYY-MM-DD.
 * Avoids UTC boundary issues.
 */
export function getCurrentDate(timezone: string = getDefaultTimezone()): string {
  const now = new Date();
  const tzDate = new Date(
    now.toLocaleString("en-US", { timeZone: timezone })
  );
  return format(tzDate, "yyyy-MM-dd");
}

/**
 * Format a date string for display.
 */
export function formatDate(
  dateStr: string,
  pattern: string = "M月d日"
): string {
  try {
    const date = typeof dateStr === "string" ? parseISO(dateStr) : new Date(dateStr);
    return format(date, pattern);
  } catch {
    return dateStr;
  }
}

/**
 * Format a datetime string for display.
 */
export function formatDateTime(
  dateStr: string,
  pattern: string = "yyyy-MM-dd HH:mm"
): string {
  try {
    const date = typeof dateStr === "string" ? parseISO(dateStr) : new Date(dateStr);
    return format(date, pattern);
  } catch {
    return dateStr;
  }
}

/**
 * Get the start and end of a month for a given year-month.
 */
export function getMonthRange(year: number, month: number): { start: string; end: string } {
  const date = new Date(year, month - 1, 1);
  return {
    start: format(startOfMonth(date), "yyyy-MM-dd"),
    end: format(endOfMonth(date), "yyyy-MM-dd"),
  };
}

/**
 * Get current year and month.
 */
export function getCurrentYearMonth(
  timezone: string = getDefaultTimezone()
): { year: number; month: number } {
  const now = new Date();
  const tzDate = new Date(now.toLocaleString("en-US", { timeZone: timezone }));
  return {
    year: tzDate.getFullYear(),
    month: tzDate.getMonth() + 1,
  };
}

/**
 * Generate a UUID v4. Uses crypto.randomUUID if available.
 */
export function generateUUID(): string {
  if (typeof crypto !== "undefined" && crypto.randomUUID) {
    return crypto.randomUUID();
  }
  // Fallback
  return "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    const v = c === "x" ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}
