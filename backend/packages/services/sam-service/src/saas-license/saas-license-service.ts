/**
 * SaaS License Service - Business logic for SaaS license management
 *
 * Implements:
 * - Connect to vendor portals to sync subscription usage data (Requirement 4.11)
 * - Identify unused subscriptions for cost optimization (Requirement 4.12)
 * - Track subscription renewal dates and send advance notifications (Requirement 4.13)
 *
 * Requirements: 4.11, 4.12, 4.13
 */

import type { UUID } from '@ams/types';
import * as cache from '@ams/cache';
import { publishEvent } from '@ams/events';
import { createLogger, now } from '@ams/utils';
import { v4 as uuidv4 } from 'uuid';

import type {
  CreateSubscriptionRequest,
  CreateUsageRecordRequest,
  RenewalNotification,
  SaaSSubscription,
  SaaSUsageRecord,
  SubscriptionStatus,
  UpdateSubscriptionRequest,
  VendorName,
} from './saas-license-repository';
import * as repository from './saas-license-repository';

const logger = createLogger({ service: 'saas-license-service' });

/**
 * Cache keys
 */
function subscriptionCacheKey(subscriptionId: UUID): string {
  return `saas:subscription:${subscriptionId}`;
}

function summaryCacheKey(): string {
  return 'saas:summary';
}

function unusedSubscriptionsCacheKey(): string {
  return 'saas:unused-subscriptions';
}


/**
 * Vendor portal integration interfaces
 */
export interface VendorUsageData {
  readonly totalLicenses: number;
  readonly assignedLicenses: number;
  readonly users: readonly VendorUserData[];
}

export interface VendorUserData {
  readonly userId: string;
  readonly email: string;
  readonly lastLoginDate: string | null;
  readonly loginCount30Day: number;
  readonly isActive: boolean;
  readonly featureUsage?: Record<string, number>;
}

/**
 * Sync result from vendor portal
 */
export interface SyncSaaSUsageResult {
  readonly syncId: UUID;
  readonly subscriptionId: UUID;
  readonly vendorName: VendorName;
  readonly syncedAt: string;
  readonly totalLicenses: number;
  readonly assignedLicenses: number;
  readonly activeLicenses: number;
  readonly inactiveLicenses: number;
  readonly usersProcessed: number;
  readonly subscription: SaaSSubscription;
}

/**
 * Unused subscription with cost optimization details
 */
export interface UnusedSubscriptionDetails {
  readonly subscription: SaaSSubscription;
  readonly unusedSeats: number;
  readonly potentialMonthlySavings: number;
  readonly potentialAnnualSavings: number;
  readonly utilizationPercentage: number;
  readonly inactiveUsers: readonly SaaSUsageRecord[];
  readonly recommendation: string;
}

/**
 * Renewal notification result
 */
export interface RenewalNotificationResult {
  readonly subscriptionId: UUID;
  readonly productName: string;
  readonly vendorName: VendorName;
  readonly renewalDate: string;
  readonly daysUntilRenewal: number;
  readonly totalCost: number;
  readonly notificationType: '90_DAY' | '60_DAY' | '30_DAY';
  readonly notification: RenewalNotification;
}


/**
 * Simulated vendor portal integrations
 * In production, these would make actual API calls to vendor portals
 */
async function fetchAdobeUsageData(vendorPortalId: string): Promise<VendorUsageData> {
  // Simulated Adobe Admin Console API response
  logger.info('Fetching Adobe usage data', { vendorPortalId });
  
  // In production, this would call Adobe Admin Console API
  // https://developer.adobe.com/umapi/
  return {
    totalLicenses: 100,
    assignedLicenses: 75,
    users: [
      {
        userId: 'adobe-user-1',
        email: 'user1@company.com',
        lastLoginDate: new Date(Date.now() - 5 * 24 * 60 * 60 * 1000).toISOString(),
        loginCount30Day: 15,
        isActive: true,
        featureUsage: { 'photoshop': 10, 'illustrator': 5 },
      },
      {
        userId: 'adobe-user-2',
        email: 'user2@company.com',
        lastLoginDate: new Date(Date.now() - 45 * 24 * 60 * 60 * 1000).toISOString(),
        loginCount30Day: 0,
        isActive: false,
      },
    ],
  };
}

async function fetchSalesforceUsageData(vendorPortalId: string): Promise<VendorUsageData> {
  // Simulated Salesforce API response
  logger.info('Fetching Salesforce usage data', { vendorPortalId });
  
  // In production, this would call Salesforce REST API
  // https://developer.salesforce.com/docs/atlas.en-us.api_rest.meta/api_rest/
  return {
    totalLicenses: 50,
    assignedLicenses: 40,
    users: [
      {
        userId: 'sf-user-1',
        email: 'sales1@company.com',
        lastLoginDate: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000).toISOString(),
        loginCount30Day: 25,
        isActive: true,
        featureUsage: { 'opportunities': 50, 'reports': 20 },
      },
      {
        userId: 'sf-user-2',
        email: 'sales2@company.com',
        lastLoginDate: new Date(Date.now() - 60 * 24 * 60 * 60 * 1000).toISOString(),
        loginCount30Day: 0,
        isActive: false,
      },
    ],
  };
}


/**
 * Fetch usage data from vendor portal based on vendor name
 */
async function fetchVendorUsageData(
  vendorName: VendorName,
  vendorPortalId: string
): Promise<VendorUsageData> {
  switch (vendorName) {
    case 'ADOBE':
      return fetchAdobeUsageData(vendorPortalId);
    case 'SALESFORCE':
      return fetchSalesforceUsageData(vendorPortalId);
    case 'MICROSOFT':
    case 'GOOGLE':
    case 'OTHER':
    default:
      // Generic fallback - in production would have specific integrations
      logger.warn('No specific vendor integration available', { vendorName });
      return {
        totalLicenses: 0,
        assignedLicenses: 0,
        users: [],
      };
  }
}

/**
 * Create a new SaaS subscription
 */
export async function createSubscription(
  request: CreateSubscriptionRequest
): Promise<SaaSSubscription> {
  logger.info('Creating SaaS subscription', {
    vendorName: request.vendorName,
    productName: request.productName,
  });

  const subscription = await repository.createSubscription(request);

  // Invalidate cache
  await cache.del(summaryCacheKey());
  await cache.del(unusedSubscriptionsCacheKey());

  // Publish event
  await publishEvent('SAAS_SUBSCRIPTION_CREATED', {
    subscriptionId: subscription.subscriptionId,
    vendorName: subscription.vendorName,
    productName: subscription.productName,
    totalSeats: subscription.totalSeats,
    renewalDate: subscription.renewalDate,
  });

  return subscription;
}

/**
 * Get subscription by ID
 */
export async function getSubscription(
  subscriptionId: UUID
): Promise<SaaSSubscription | null> {
  // Try cache first
  const cacheKey = subscriptionCacheKey(subscriptionId);
  const cached = await cache.get<SaaSSubscription>(cacheKey);
  if (cached) {
    return cached;
  }

  const subscription = await repository.getSubscriptionById(subscriptionId);
  
  if (subscription) {
    await cache.set(cacheKey, subscription, cache.DEFAULT_TTL.MEDIUM);
  }

  return subscription;
}


/**
 * Get all subscriptions
 */
export async function getSubscriptions(
  vendorName?: VendorName,
  status?: SubscriptionStatus | SubscriptionStatus[],
  limit = 100
): Promise<SaaSSubscription[]> {
  return repository.getSubscriptions(vendorName, status, limit);
}

/**
 * Update subscription
 */
export async function updateSubscription(
  subscriptionId: UUID,
  updates: UpdateSubscriptionRequest
): Promise<SaaSSubscription> {
  const subscription = await repository.updateSubscription(subscriptionId, updates);

  // Invalidate cache
  await cache.del(subscriptionCacheKey(subscriptionId));
  await cache.del(summaryCacheKey());
  await cache.del(unusedSubscriptionsCacheKey());

  // Publish event
  await publishEvent('SAAS_SUBSCRIPTION_UPDATED', {
    subscriptionId,
    updates: Object.keys(updates),
  });

  return subscription;
}

/**
 * Sync SaaS usage data from vendor portal
 * Requirement 4.11: Connect to vendor portals to sync subscription usage data
 *
 * @param subscriptionId - The subscription to sync
 * @returns Sync result with updated subscription and usage data
 */
export async function syncSaaSUsage(
  subscriptionId: UUID
): Promise<SyncSaaSUsageResult> {
  const syncId = uuidv4();
  const syncedAt = now();

  logger.info('Starting SaaS usage sync', { syncId, subscriptionId });

  // Get subscription
  const subscription = await repository.getSubscriptionById(subscriptionId);
  if (!subscription) {
    throw new Error(`Subscription not found: ${subscriptionId}`);
  }

  if (!subscription.vendorPortalId) {
    throw new Error(`Subscription ${subscriptionId} has no vendor portal ID configured`);
  }

  // Fetch usage data from vendor portal
  const vendorData = await fetchVendorUsageData(
    subscription.vendorName,
    subscription.vendorPortalId
  );

  // Process user usage records
  let activeCount = 0;
  let inactiveCount = 0;

  for (const user of vendorData.users) {
    const usageRequest: CreateUsageRecordRequest = {
      subscriptionId,
      userId: user.userId,
      userEmail: user.email,
      lastActiveDate: user.lastLoginDate ?? undefined,
      loginCount30Day: user.loginCount30Day,
      featureUsage: user.featureUsage,
      isActive: user.isActive,
    };

    await repository.upsertUsageRecord(usageRequest);

    if (user.isActive) {
      activeCount++;
    } else {
      inactiveCount++;
    }
  }


  // Update subscription with synced data
  const updatedSubscription = await repository.updateSubscription(subscriptionId, {
    totalSeats: vendorData.totalLicenses,
    usedSeats: vendorData.assignedLicenses,
    lastSyncedAt: syncedAt,
  });

  // Invalidate cache
  await cache.del(subscriptionCacheKey(subscriptionId));
  await cache.del(summaryCacheKey());
  await cache.del(unusedSubscriptionsCacheKey());

  // Publish sync completed event
  await publishEvent('SAAS_USAGE_SYNCED', {
    syncId,
    subscriptionId,
    vendorName: subscription.vendorName,
    productName: subscription.productName,
    totalLicenses: vendorData.totalLicenses,
    assignedLicenses: vendorData.assignedLicenses,
    activeLicenses: activeCount,
    inactiveLicenses: inactiveCount,
    syncedAt,
  });

  logger.info('SaaS usage sync completed', {
    syncId,
    subscriptionId,
    usersProcessed: vendorData.users.length,
    activeCount,
    inactiveCount,
  });

  return {
    syncId,
    subscriptionId,
    vendorName: subscription.vendorName,
    syncedAt,
    totalLicenses: vendorData.totalLicenses,
    assignedLicenses: vendorData.assignedLicenses,
    activeLicenses: activeCount,
    inactiveLicenses: inactiveCount,
    usersProcessed: vendorData.users.length,
    subscription: updatedSubscription,
  };
}

/**
 * Get unused subscriptions with cost optimization details
 * Requirement 4.12: Identify unused subscriptions for cost optimization
 *
 * @param minUnusedSeats - Minimum number of unused seats to consider
 * @param inactiveDays - Days of inactivity to consider a user inactive
 * @returns List of unused subscriptions with optimization recommendations
 */
export async function getUnusedSubscriptions(
  minUnusedSeats = 1,
  inactiveDays = 30
): Promise<UnusedSubscriptionDetails[]> {
  logger.info('Getting unused subscriptions', { minUnusedSeats, inactiveDays });

  // Try cache first
  const cacheKey = unusedSubscriptionsCacheKey();
  const cached = await cache.get<UnusedSubscriptionDetails[]>(cacheKey);
  if (cached) {
    return cached;
  }

  // Get subscriptions with unused seats
  const subscriptions = await repository.getUnusedSubscriptions(minUnusedSeats);

  const results: UnusedSubscriptionDetails[] = [];

  for (const subscription of subscriptions) {
    // Get inactive users for this subscription
    const inactiveUsers = await repository.getInactiveUsageRecords(
      subscription.subscriptionId,
      inactiveDays
    );

    const utilizationPercentage =
      subscription.totalSeats > 0
        ? Math.round((subscription.usedSeats / subscription.totalSeats) * 100)
        : 0;

    const potentialMonthlySavings = subscription.unusedSeats * subscription.costPerSeat;
    const potentialAnnualSavings = potentialMonthlySavings * 12;


    // Generate recommendation based on utilization
    let recommendation: string;
    if (utilizationPercentage < 25) {
      recommendation = 'CRITICAL: Very low utilization. Consider cancelling or significantly downsizing this subscription.';
    } else if (utilizationPercentage < 50) {
      recommendation = 'HIGH: Low utilization. Review user assignments and consider reducing seat count at renewal.';
    } else if (utilizationPercentage < 75) {
      recommendation = 'MEDIUM: Moderate utilization. Monitor usage and consider minor seat reduction.';
    } else {
      recommendation = 'LOW: Good utilization. Minor optimization opportunity with unused seats.';
    }

    results.push({
      subscription,
      unusedSeats: subscription.unusedSeats,
      potentialMonthlySavings,
      potentialAnnualSavings,
      utilizationPercentage,
      inactiveUsers,
      recommendation,
    });
  }

  // Sort by potential savings (highest first)
  results.sort((a, b) => b.potentialAnnualSavings - a.potentialAnnualSavings);

  // Cache the results
  await cache.set(cacheKey, results, cache.DEFAULT_TTL.SHORT);

  // Publish event if significant savings found
  const totalPotentialSavings = results.reduce(
    (sum, r) => sum + r.potentialAnnualSavings,
    0
  );

  if (totalPotentialSavings > 0) {
    await publishEvent('SAAS_OPTIMIZATION_OPPORTUNITIES_FOUND', {
      subscriptionsWithUnusedSeats: results.length,
      totalUnusedSeats: results.reduce((sum, r) => sum + r.unusedSeats, 0),
      totalPotentialAnnualSavings: totalPotentialSavings,
    });
  }

  logger.info('Unused subscriptions analysis completed', {
    subscriptionsFound: results.length,
    totalPotentialSavings,
  });

  return results;
}


/**
 * Calculate days until renewal
 */
function calculateDaysUntilRenewal(renewalDate: string): number {
  const renewal = new Date(renewalDate);
  const today = new Date();
  const diffTime = renewal.getTime() - today.getTime();
  return Math.ceil(diffTime / (1000 * 60 * 60 * 24));
}

/**
 * Determine notification type based on days until renewal
 */
function getNotificationType(
  daysUntilRenewal: number
): '90_DAY' | '60_DAY' | '30_DAY' | null {
  if (daysUntilRenewal <= 30 && daysUntilRenewal > 0) {
    return '30_DAY';
  } else if (daysUntilRenewal <= 60 && daysUntilRenewal > 30) {
    return '60_DAY';
  } else if (daysUntilRenewal <= 90 && daysUntilRenewal > 60) {
    return '90_DAY';
  }
  return null;
}

/**
 * Check and generate renewal notifications
 * Requirement 4.13: Track subscription renewal dates and send advance notifications
 *
 * @returns List of notifications generated
 */
export async function checkRenewalNotifications(): Promise<RenewalNotificationResult[]> {
  logger.info('Checking for renewal notifications');

  // Update subscription statuses first
  await repository.updateSubscriptionStatuses();

  // Get subscriptions expiring within 90 days
  const expiringSubscriptions = await repository.getExpiringSubscriptions(90);

  const results: RenewalNotificationResult[] = [];

  for (const subscription of expiringSubscriptions) {
    const daysUntilRenewal = calculateDaysUntilRenewal(subscription.renewalDate);
    const notificationType = getNotificationType(daysUntilRenewal);

    if (!notificationType) {
      continue;
    }

    // Create notification if not already exists
    const notification = await repository.createRenewalNotification(
      subscription.subscriptionId,
      daysUntilRenewal,
      notificationType
    );

    // Only include if notification is pending (new)
    if (notification.status === 'PENDING') {
      results.push({
        subscriptionId: subscription.subscriptionId,
        productName: subscription.productName,
        vendorName: subscription.vendorName,
        renewalDate: subscription.renewalDate,
        daysUntilRenewal,
        totalCost: subscription.totalCost,
        notificationType,
        notification,
      });

      // Publish notification event
      await publishEvent('SAAS_RENEWAL_NOTIFICATION_CREATED', {
        subscriptionId: subscription.subscriptionId,
        productName: subscription.productName,
        vendorName: subscription.vendorName,
        renewalDate: subscription.renewalDate,
        daysUntilRenewal,
        totalCost: subscription.totalCost,
        notificationType,
      });
    }
  }

  logger.info('Renewal notification check completed', {
    subscriptionsChecked: expiringSubscriptions.length,
    notificationsGenerated: results.length,
  });

  return results;
}


/**
 * Send pending renewal notifications
 * Requirement 4.13: Send advance notifications
 */
export async function sendPendingNotifications(): Promise<RenewalNotification[]> {
  logger.info('Sending pending renewal notifications');

  const pendingNotifications = await repository.getPendingNotifications();
  const sentNotifications: RenewalNotification[] = [];

  for (const notification of pendingNotifications) {
    // Get subscription details
    const subscription = await repository.getSubscriptionById(
      notification.subscriptionId
    );

    if (!subscription) {
      logger.warn('Subscription not found for notification', {
        notificationId: notification.notificationId,
        subscriptionId: notification.subscriptionId,
      });
      continue;
    }

    // In production, this would send actual notifications via email/SMS/etc.
    // For now, we just mark as sent and publish an event
    const updatedNotification = await repository.updateNotificationStatus(
      notification.notificationId,
      'SENT'
    );

    sentNotifications.push(updatedNotification);

    // Publish notification sent event
    await publishEvent('SAAS_RENEWAL_NOTIFICATION_SENT', {
      notificationId: notification.notificationId,
      subscriptionId: subscription.subscriptionId,
      productName: subscription.productName,
      vendorName: subscription.vendorName,
      renewalDate: subscription.renewalDate,
      notificationType: notification.notificationType,
    });

    logger.info('Renewal notification sent', {
      notificationId: notification.notificationId,
      subscriptionId: subscription.subscriptionId,
      notificationType: notification.notificationType,
    });
  }

  return sentNotifications;
}

/**
 * Acknowledge a renewal notification
 */
export async function acknowledgeNotification(
  notificationId: UUID,
  acknowledgedBy: UUID
): Promise<RenewalNotification> {
  logger.info('Acknowledging renewal notification', {
    notificationId,
    acknowledgedBy,
  });

  const notification = await repository.updateNotificationStatus(
    notificationId,
    'ACKNOWLEDGED',
    acknowledgedBy
  );

  await publishEvent('SAAS_RENEWAL_NOTIFICATION_ACKNOWLEDGED', {
    notificationId,
    acknowledgedBy,
  });

  return notification;
}

/**
 * Get notifications for a subscription
 */
export async function getNotificationsBySubscription(
  subscriptionId: UUID
): Promise<RenewalNotification[]> {
  return repository.getNotificationsBySubscription(subscriptionId);
}


/**
 * Get usage records for a subscription
 */
export async function getUsageRecords(
  subscriptionId: UUID
): Promise<SaaSUsageRecord[]> {
  return repository.getUsageRecordsBySubscription(subscriptionId);
}

/**
 * Get subscription summary statistics
 */
export async function getSubscriptionSummary(): Promise<{
  totalSubscriptions: number;
  totalSeats: number;
  usedSeats: number;
  unusedSeats: number;
  totalMonthlyCost: number;
  potentialSavings: number;
  byVendor: Record<string, { count: number; seats: number; cost: number }>;
  byStatus: Record<string, number>;
}> {
  // Try cache first
  const cacheKey = summaryCacheKey();
  const cached = await cache.get<{
    totalSubscriptions: number;
    totalSeats: number;
    usedSeats: number;
    unusedSeats: number;
    totalMonthlyCost: number;
    potentialSavings: number;
    byVendor: Record<string, { count: number; seats: number; cost: number }>;
    byStatus: Record<string, number>;
  }>(cacheKey);

  if (cached) {
    return cached;
  }

  const summary = await repository.getSubscriptionSummary();

  // Cache the result
  await cache.set(cacheKey, summary, cache.DEFAULT_TTL.SHORT);

  return summary;
}

/**
 * Delete subscription
 */
export async function deleteSubscription(subscriptionId: UUID): Promise<void> {
  await repository.deleteSubscription(subscriptionId);

  // Invalidate cache
  await cache.del(subscriptionCacheKey(subscriptionId));
  await cache.del(summaryCacheKey());
  await cache.del(unusedSubscriptionsCacheKey());

  // Publish event
  await publishEvent('SAAS_SUBSCRIPTION_DELETED', { subscriptionId });
}

// Re-export types
export type {
  CreateSubscriptionRequest,
  CreateUsageRecordRequest,
  NotificationStatus,
  RenewalNotification,
  SaaSSubscription,
  SaaSUsageRecord,
  SubscriptionStatus,
  SubscriptionType,
  UpdateSubscriptionRequest,
  VendorName,
} from './saas-license-repository';