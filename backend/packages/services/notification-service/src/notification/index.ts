/**
 * Notification module exports
 */

// Types
export * from './notification-types';

// Template engine
export * from './template-engine';

// Channel handlers
export * from './channel-handlers';

// Repository functions (low-level data access)
export {
  getNotificationById,
  markNotificationAsRead,
  markAllNotificationsAsRead,
  getTemplateById,
  getNotificationStatistics,
} from './notification-repository';

// Service functions (business logic) - these wrap repository functions
export {
  sendNotification,
  getNotifications,
  getUnreadNotifications,
  createTemplate,
  updateTemplate,
  deleteTemplate,
} from './notification-service';
