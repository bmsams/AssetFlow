/**
 * Notification Preferences module exports
 *
 * Requirements:
 * - 17.2: Allow users to configure notification preferences per event type
 * - 17.9: Implement notification batching to prevent alert fatigue
 */

// Types
export * from './preferences-types';

// Repository functions (low-level data access)
export {
  getPreferences,
  createDefaultPreferences,
  queueNotificationForBatch,
  clearBatchedNotifications,
} from './preferences-repository';

// Service functions (business logic) - these wrap repository functions
export {
  getUserPreferences,
  updatePreferences,
  resetPreferences,
  shouldSendNotification,
  queueForBatch,
  processPendingBatches,
  getPendingBatchedNotifications,
  createBatchFromPending,
} from './preferences-service';
