"use strict";
/**
 * Date and time utilities
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.now = now;
exports.parseDate = parseDate;
exports.toISOString = toISOString;
exports.addDays = addDays;
exports.addMonths = addMonths;
exports.addHours = addHours;
exports.daysBetween = daysBetween;
exports.hoursBetween = hoursBetween;
exports.isPast = isPast;
exports.isFuture = isFuture;
exports.isToday = isToday;
exports.startOfDay = startOfDay;
exports.endOfDay = endOfDay;
exports.isWithinRange = isWithinRange;
exports.formatDate = formatDate;
exports.formatDateTime = formatDateTime;
exports.daysUntil = daysUntil;
exports.daysSince = daysSince;
exports.isOverdue = isOverdue;
exports.getExpirationNotificationDays = getExpirationNotificationDays;
exports.shouldNotifyExpiration = shouldNotifyExpiration;
/**
 * Get current ISO date string
 */
function now() {
    return new Date().toISOString();
}
/**
 * Parse ISO date string to Date object
 */
function parseDate(dateString) {
    return new Date(dateString);
}
/**
 * Format Date to ISO string
 */
function toISOString(date) {
    return date.toISOString();
}
/**
 * Add days to a date
 */
function addDays(date, days) {
    const result = new Date(date);
    result.setDate(result.getDate() + days);
    return result;
}
/**
 * Add months to a date
 */
function addMonths(date, months) {
    const result = new Date(date);
    result.setMonth(result.getMonth() + months);
    return result;
}
/**
 * Add hours to a date
 */
function addHours(date, hours) {
    const result = new Date(date);
    result.setTime(result.getTime() + hours * 60 * 60 * 1000);
    return result;
}
/**
 * Calculate difference in days between two dates
 */
function daysBetween(date1, date2) {
    const msPerDay = 24 * 60 * 60 * 1000;
    const diff = Math.abs(date2.getTime() - date1.getTime());
    return Math.floor(diff / msPerDay);
}
/**
 * Calculate difference in hours between two dates
 */
function hoursBetween(date1, date2) {
    const msPerHour = 60 * 60 * 1000;
    const diff = Math.abs(date2.getTime() - date1.getTime());
    return Math.floor(diff / msPerHour);
}
/**
 * Check if a date is in the past
 */
function isPast(date) {
    return date.getTime() < Date.now();
}
/**
 * Check if a date is in the future
 */
function isFuture(date) {
    return date.getTime() > Date.now();
}
/**
 * Check if a date is today
 */
function isToday(date) {
    const today = new Date();
    return (date.getDate() === today.getDate() &&
        date.getMonth() === today.getMonth() &&
        date.getFullYear() === today.getFullYear());
}
/**
 * Get start of day (midnight)
 */
function startOfDay(date) {
    const result = new Date(date);
    result.setHours(0, 0, 0, 0);
    return result;
}
/**
 * Get end of day (23:59:59.999)
 */
function endOfDay(date) {
    const result = new Date(date);
    result.setHours(23, 59, 59, 999);
    return result;
}
/**
 * Check if date is within a range
 */
function isWithinRange(date, start, end) {
    const time = date.getTime();
    return time >= start.getTime() && time <= end.getTime();
}
/**
 * Format date for display (YYYY-MM-DD)
 */
function formatDate(date) {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
}
/**
 * Format date and time for display (YYYY-MM-DD HH:mm:ss)
 */
function formatDateTime(date) {
    const dateStr = formatDate(date);
    const hours = String(date.getHours()).padStart(2, '0');
    const minutes = String(date.getMinutes()).padStart(2, '0');
    const seconds = String(date.getSeconds()).padStart(2, '0');
    return `${dateStr} ${hours}:${minutes}:${seconds}`;
}
/**
 * Calculate days until a future date
 */
function daysUntil(futureDate) {
    const now = new Date();
    if (futureDate.getTime() <= now.getTime()) {
        return 0;
    }
    return daysBetween(now, futureDate);
}
/**
 * Calculate days since a past date
 */
function daysSince(pastDate) {
    const now = new Date();
    if (pastDate.getTime() >= now.getTime()) {
        return 0;
    }
    return daysBetween(pastDate, now);
}
/**
 * Check if a date is overdue (past the due date)
 */
function isOverdue(dueDate) {
    return isPast(dueDate);
}
/**
 * Get notification thresholds for contract expiration
 */
function getExpirationNotificationDays() {
    return [90, 60, 30, 14, 7, 1];
}
/**
 * Check if a contract should trigger an expiration notification
 */
function shouldNotifyExpiration(expirationDate, notificationDays) {
    const daysRemaining = daysUntil(expirationDate);
    for (const threshold of notificationDays) {
        if (daysRemaining === threshold) {
            return threshold;
        }
    }
    return null;
}
//# sourceMappingURL=date-utils.js.map