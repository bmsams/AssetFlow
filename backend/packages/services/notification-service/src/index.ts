/**
 * @ams/notification-service - Notification Service
 *
 * Provides multi-channel notification delivery with template support.
 *
 * Requirements:
 * - 17.1: Support notification channels: email, in-app, SMS, and push notifications
 * - 17.2: Allow users to configure notification preferences per event type
 * - 17.3: Contract expiration notifications at 90, 60, 30 days
 * - 17.4: Loaner overdue escalating reminders
 * - 17.5: Stock level alerts when inventory falls below threshold
 * - 17.6: Compliance alerts for license violations
 * - 17.7: Support notification templates with variable substitution
 * - 17.8: Track notification delivery status and read receipts
 * - 17.9: Implement notification batching to prevent alert fatigue
 *
 * Features:
 * - Multi-channel delivery (email via SES, SMS via SNS, push, in-app)
 * - Template engine with variable substitution
 * - Delivery tracking and retry logic
 * - Read receipts and notification history for audit
 * - Notification statistics and reporting
 * - User notification preferences per event type and channel
 * - Notification batching with configurable frequency
 * - Quiet hours support
 * - Scheduled notification triggers (contracts, loaners, stock, compliance)
 * - Exponential backoff retry for failed deliveries
 */

// Export notification module
export * from './notification';

// Export preferences module
export * from './preferences';

// Export triggers module
export * from './triggers';

// Export tracking module
export * from './tracking';
