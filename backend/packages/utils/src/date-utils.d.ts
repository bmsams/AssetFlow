/**
 * Date and time utilities
 */
import type { ISODateString } from '@ams/types';
/**
 * Get current ISO date string
 */
export declare function now(): ISODateString;
/**
 * Parse ISO date string to Date object
 */
export declare function parseDate(dateString: ISODateString): Date;
/**
 * Format Date to ISO string
 */
export declare function toISOString(date: Date): ISODateString;
/**
 * Add days to a date
 */
export declare function addDays(date: Date, days: number): Date;
/**
 * Add months to a date
 */
export declare function addMonths(date: Date, months: number): Date;
/**
 * Add hours to a date
 */
export declare function addHours(date: Date, hours: number): Date;
/**
 * Calculate difference in days between two dates
 */
export declare function daysBetween(date1: Date, date2: Date): number;
/**
 * Calculate difference in hours between two dates
 */
export declare function hoursBetween(date1: Date, date2: Date): number;
/**
 * Check if a date is in the past
 */
export declare function isPast(date: Date): boolean;
/**
 * Check if a date is in the future
 */
export declare function isFuture(date: Date): boolean;
/**
 * Check if a date is today
 */
export declare function isToday(date: Date): boolean;
/**
 * Get start of day (midnight)
 */
export declare function startOfDay(date: Date): Date;
/**
 * Get end of day (23:59:59.999)
 */
export declare function endOfDay(date: Date): Date;
/**
 * Check if date is within a range
 */
export declare function isWithinRange(date: Date, start: Date, end: Date): boolean;
/**
 * Format date for display (YYYY-MM-DD)
 */
export declare function formatDate(date: Date): string;
/**
 * Format date and time for display (YYYY-MM-DD HH:mm:ss)
 */
export declare function formatDateTime(date: Date): string;
/**
 * Calculate days until a future date
 */
export declare function daysUntil(futureDate: Date): number;
/**
 * Calculate days since a past date
 */
export declare function daysSince(pastDate: Date): number;
/**
 * Check if a date is overdue (past the due date)
 */
export declare function isOverdue(dueDate: Date): boolean;
/**
 * Get notification thresholds for contract expiration
 */
export declare function getExpirationNotificationDays(): readonly number[];
/**
 * Check if a contract should trigger an expiration notification
 */
export declare function shouldNotifyExpiration(expirationDate: Date, notificationDays: readonly number[]): number | null;
