/**
 * Date and time utilities
 */

import type { ISODateString } from '@ams/types';

/**
 * Get current ISO date string
 */
export function now(): ISODateString {
  return new Date().toISOString();
}

/**
 * Parse ISO date string to Date object
 */
export function parseDate(dateString: ISODateString): Date {
  return new Date(dateString);
}

/**
 * Format Date to ISO string
 */
export function toISOString(date: Date): ISODateString {
  return date.toISOString();
}

/**
 * Add days to a date
 */
export function addDays(date: Date, days: number): Date {
  const result = new Date(date);
  result.setDate(result.getDate() + days);
  return result;
}

/**
 * Add months to a date
 */
export function addMonths(date: Date, months: number): Date {
  const result = new Date(date);
  result.setMonth(result.getMonth() + months);
  return result;
}

/**
 * Add hours to a date
 */
export function addHours(date: Date, hours: number): Date {
  const result = new Date(date);
  result.setTime(result.getTime() + hours * 60 * 60 * 1000);
  return result;
}

/**
 * Calculate difference in days between two dates
 */
export function daysBetween(date1: Date, date2: Date): number {
  const msPerDay = 24 * 60 * 60 * 1000;
  const diff = Math.abs(date2.getTime() - date1.getTime());
  return Math.floor(diff / msPerDay);
}

/**
 * Calculate difference in hours between two dates
 */
export function hoursBetween(date1: Date, date2: Date): number {
  const msPerHour = 60 * 60 * 1000;
  const diff = Math.abs(date2.getTime() - date1.getTime());
  return Math.floor(diff / msPerHour);
}

/**
 * Check if a date is in the past
 */
export function isPast(date: Date): boolean {
  return date.getTime() < Date.now();
}

/**
 * Check if a date is in the future
 */
export function isFuture(date: Date): boolean {
  return date.getTime() > Date.now();
}

/**
 * Check if a date is today
 */
export function isToday(date: Date): boolean {
  const today = new Date();
  return (
    date.getDate() === today.getDate() &&
    date.getMonth() === today.getMonth() &&
    date.getFullYear() === today.getFullYear()
  );
}

/**
 * Get start of day (midnight)
 */
export function startOfDay(date: Date): Date {
  const result = new Date(date);
  result.setHours(0, 0, 0, 0);
  return result;
}

/**
 * Get end of day (23:59:59.999)
 */
export function endOfDay(date: Date): Date {
  const result = new Date(date);
  result.setHours(23, 59, 59, 999);
  return result;
}

/**
 * Check if date is within a range
 */
export function isWithinRange(date: Date, start: Date, end: Date): boolean {
  const time = date.getTime();
  return time >= start.getTime() && time <= end.getTime();
}

/**
 * Format date for display (YYYY-MM-DD)
 */
export function formatDate(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

/**
 * Format date and time for display (YYYY-MM-DD HH:mm:ss)
 */
export function formatDateTime(date: Date): string {
  const dateStr = formatDate(date);
  const hours = String(date.getHours()).padStart(2, '0');
  const minutes = String(date.getMinutes()).padStart(2, '0');
  const seconds = String(date.getSeconds()).padStart(2, '0');
  return `${dateStr} ${hours}:${minutes}:${seconds}`;
}

/**
 * Calculate days until a future date
 */
export function daysUntil(futureDate: Date): number {
  const now = new Date();
  if (futureDate.getTime() <= now.getTime()) {
    return 0;
  }
  return daysBetween(now, futureDate);
}

/**
 * Calculate days since a past date
 */
export function daysSince(pastDate: Date): number {
  const now = new Date();
  if (pastDate.getTime() >= now.getTime()) {
    return 0;
  }
  return daysBetween(pastDate, now);
}

/**
 * Check if a date is overdue (past the due date)
 */
export function isOverdue(dueDate: Date): boolean {
  return isPast(dueDate);
}

/**
 * Get notification thresholds for contract expiration
 */
export function getExpirationNotificationDays(): readonly number[] {
  return [90, 60, 30, 14, 7, 1] as const;
}

/**
 * Check if a contract should trigger an expiration notification
 */
export function shouldNotifyExpiration(
  expirationDate: Date,
  notificationDays: readonly number[]
): number | null {
  const daysRemaining = daysUntil(expirationDate);

  for (const threshold of notificationDays) {
    if (daysRemaining === threshold) {
      return threshold;
    }
  }

  return null;
}
