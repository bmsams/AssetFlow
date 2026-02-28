/**
 * SaaS License module exports
 *
 * Provides SaaS license management functionality:
 * - Connect to vendor portals to sync subscription usage data (Requirement 4.11)
 * - Identify unused subscriptions for cost optimization (Requirement 4.12)
 * - Track subscription renewal dates and send advance notifications (Requirement 4.13)
 */

// Export types from repository
export type {
  VendorName,
  SubscriptionStatus,
  NotificationStatus,
  SaaSSubscription,
  SaaSUsageRecord,
  RenewalNotification,
  CreateSubscriptionRequest,
  UpdateSubscriptionRequest,
  CreateUsageRecordRequest,
} from './saas-license-repository';

// Export repository functions (low-level data access)
export {
  getSubscriptionById,
  getExpiringSubscriptions,
  updateSubscriptionStatuses,
  upsertUsageRecord,
  getUsageRecordsBySubscription,
  getInactiveUsageRecords,
  deleteUsageRecordsBySubscription,
  createRenewalNotification,
  getPendingNotifications,
  updateNotificationStatus,
} from './saas-license-repository';

// Export service functions (business logic)
export {
  createSubscription,
  getSubscription,
  getSubscriptions,
  updateSubscription,
  syncSaaSUsage,
  getUnusedSubscriptions,
  checkRenewalNotifications,
  sendPendingNotifications,
  acknowledgeNotification,
  getNotificationsBySubscription,
  getUsageRecords,
  getSubscriptionSummary,
  deleteSubscription,
} from './saas-license-service';

// Export service types
export type {
  SyncSaaSUsageResult,
  UnusedSubscriptionDetails,
  RenewalNotificationResult,
  VendorUsageData,
  VendorUserData,
} from './saas-license-service';
