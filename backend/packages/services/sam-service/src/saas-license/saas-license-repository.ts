/**
 * SaaS License Repository - Data access layer for SaaS license management
 *
 * Implements database operations for:
 * - SaaS subscription management
 * - Usage tracking and sync records
 * - Renewal notification tracking
 *
 * Requirements: 4.11, 4.12, 4.13
 */

import type { UUID } from '@ams/types';
import { queryMany, queryOne } from '@ams/database';
import { createLogger, now } from '@ams/utils';

const logger = createLogger({ service: 'saas-license-repository' });

/**
 * Subscription type
 */
export type SubscriptionType = 'ANNUAL' | 'MONTHLY' | 'MULTI_YEAR';

/**
 * Subscription status
 */
export type SubscriptionStatus = 'ACTIVE' | 'EXPIRING_SOON' | 'EXPIRED' | 'CANCELLED';

/**
 * Vendor name type for supported integrations
 */
export type VendorName = 'ADOBE' | 'SALESFORCE' | 'MICROSOFT' | 'GOOGLE' | 'OTHER';

/**
 * Notification status
 */
export type NotificationStatus = 'PENDING' | 'SENT' | 'ACKNOWLEDGED' | 'DISMISSED';

/**
 * SaaS subscription entity
 */
export interface SaaSSubscription {
  readonly subscriptionId: UUID;
  readonly vendorName: VendorName;
  readonly productName: string;
  readonly subscriptionType: SubscriptionType;
  readonly totalSeats: number;
  readonly usedSeats: number;
  readonly unusedSeats: number;
  readonly costPerSeat: number;
  readonly totalCost: number;
  readonly startDate: string;
  readonly renewalDate: string;
  readonly status: SubscriptionStatus;
  readonly vendorPortalId: string | null;
  readonly vendorContractId: string | null;
  readonly lastSyncedAt: string | null;
  readonly createdAt: string;
  readonly updatedAt: string;
}

/**
 * SaaS usage record entity
 */
export interface SaaSUsageRecord {
  readonly usageId: UUID;
  readonly subscriptionId: UUID;
  readonly userId: string;
  readonly userEmail: string | null;
  readonly lastActiveDate: string | null;
  readonly loginCount30Day: number;
  readonly featureUsage: Record<string, number>;
  readonly isActive: boolean;
  readonly createdAt: string;
  readonly updatedAt: string;
}

/**
 * Renewal notification entity
 */
export interface RenewalNotification {
  readonly notificationId: UUID;
  readonly subscriptionId: UUID;
  readonly daysBeforeRenewal: number;
  readonly notificationType: '90_DAY' | '60_DAY' | '30_DAY';
  readonly status: NotificationStatus;
  readonly sentAt: string | null;
  readonly acknowledgedBy: UUID | null;
  readonly acknowledgedAt: string | null;
  readonly createdAt: string;
  readonly updatedAt: string;
}

/**
 * Vendor sync configuration
 */
export interface VendorSyncConfig {
  readonly configId: UUID;
  readonly vendorName: VendorName;
  readonly apiEndpoint: string;
  readonly authType: 'OAUTH2' | 'API_KEY' | 'BASIC';
  readonly isActive: boolean;
  readonly lastSyncAt: string | null;
  readonly syncFrequencyHours: number;
  readonly createdAt: string;
  readonly updatedAt: string;
}

/**
 * Create subscription request
 */
export interface CreateSubscriptionRequest {
  readonly vendorName: VendorName;
  readonly productName: string;
  readonly subscriptionType: SubscriptionType;
  readonly totalSeats: number;
  readonly costPerSeat: number;
  readonly startDate: string;
  readonly renewalDate: string;
  readonly vendorPortalId?: string;
  readonly vendorContractId?: string;
}


/**
 * Update subscription request
 */
export interface UpdateSubscriptionRequest {
  readonly totalSeats?: number;
  readonly usedSeats?: number;
  readonly costPerSeat?: number;
  readonly renewalDate?: string;
  readonly status?: SubscriptionStatus;
  readonly lastSyncedAt?: string;
}

/**
 * Create usage record request
 */
export interface CreateUsageRecordRequest {
  readonly subscriptionId: UUID;
  readonly userId: string;
  readonly userEmail?: string;
  readonly lastActiveDate?: string;
  readonly loginCount30Day: number;
  readonly featureUsage?: Record<string, number>;
  readonly isActive: boolean;
}

/**
 * Database row types
 */
interface SubscriptionRow {
  subscription_id: string;
  vendor_name: VendorName;
  product_name: string;
  subscription_type: SubscriptionType;
  total_seats: number;
  used_seats: number;
  unused_seats: number;
  cost_per_seat: string;
  total_cost: string;
  start_date: string;
  renewal_date: string;
  status: SubscriptionStatus;
  vendor_portal_id: string | null;
  vendor_contract_id: string | null;
  last_synced_at: string | null;
  created_at: string;
  updated_at: string;
}

interface UsageRecordRow {
  usage_id: string;
  subscription_id: string;
  user_id: string;
  user_email: string | null;
  last_active_date: string | null;
  login_count_30day: number;
  feature_usage: Record<string, number> | null;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

interface NotificationRow {
  notification_id: string;
  subscription_id: string;
  days_before_renewal: number;
  notification_type: '90_DAY' | '60_DAY' | '30_DAY';
  status: NotificationStatus;
  sent_at: string | null;
  acknowledged_by: string | null;
  acknowledged_at: string | null;
  created_at: string;
  updated_at: string;
}


/**
 * Map database row to SaaSSubscription entity
 */
function mapRowToSubscription(row: SubscriptionRow): SaaSSubscription {
  return {
    subscriptionId: row.subscription_id,
    vendorName: row.vendor_name,
    productName: row.product_name,
    subscriptionType: row.subscription_type,
    totalSeats: row.total_seats,
    usedSeats: row.used_seats,
    unusedSeats: row.unused_seats,
    costPerSeat: parseFloat(row.cost_per_seat) || 0,
    totalCost: parseFloat(row.total_cost) || 0,
    startDate: row.start_date,
    renewalDate: row.renewal_date,
    status: row.status,
    vendorPortalId: row.vendor_portal_id,
    vendorContractId: row.vendor_contract_id,
    lastSyncedAt: row.last_synced_at,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

/**
 * Map database row to SaaSUsageRecord entity
 */
function mapRowToUsageRecord(row: UsageRecordRow): SaaSUsageRecord {
  return {
    usageId: row.usage_id,
    subscriptionId: row.subscription_id,
    userId: row.user_id,
    userEmail: row.user_email,
    lastActiveDate: row.last_active_date,
    loginCount30Day: row.login_count_30day,
    featureUsage: row.feature_usage ?? {},
    isActive: row.is_active,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

/**
 * Map database row to RenewalNotification entity
 */
function mapRowToNotification(row: NotificationRow): RenewalNotification {
  return {
    notificationId: row.notification_id,
    subscriptionId: row.subscription_id,
    daysBeforeRenewal: row.days_before_renewal,
    notificationType: row.notification_type,
    status: row.status,
    sentAt: row.sent_at,
    acknowledgedBy: row.acknowledged_by,
    acknowledgedAt: row.acknowledged_at,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}


/**
 * Create a new SaaS subscription
 * Requirement 4.11: Connect to vendor portals to sync subscription usage data
 */
export async function createSubscription(
  request: CreateSubscriptionRequest
): Promise<SaaSSubscription> {
  const timestamp = now();
  const totalCost = request.totalSeats * request.costPerSeat;

  const row = await queryOne<SubscriptionRow>(
    `INSERT INTO saas_subscriptions (
      vendor_name, product_name, subscription_type, total_seats,
      used_seats, unused_seats, cost_per_seat, total_cost,
      start_date, renewal_date, status, vendor_portal_id,
      vendor_contract_id, created_at, updated_at
    ) VALUES ($1, $2, $3, $4, 0, $4, $5, $6, $7, $8, 'ACTIVE', $9, $10, $11, $11)
    RETURNING *`,
    [
      request.vendorName,
      request.productName,
      request.subscriptionType,
      request.totalSeats,
      request.costPerSeat,
      totalCost,
      request.startDate,
      request.renewalDate,
      request.vendorPortalId ?? null,
      request.vendorContractId ?? null,
      timestamp,
    ]
  );

  if (!row) {
    throw new Error('Failed to create SaaS subscription');
  }

  logger.info('SaaS subscription created', {
    subscriptionId: row.subscription_id,
    vendorName: request.vendorName,
    productName: request.productName,
  });

  return mapRowToSubscription(row);
}

/**
 * Get subscription by ID
 */
export async function getSubscriptionById(
  subscriptionId: UUID
): Promise<SaaSSubscription | null> {
  const row = await queryOne<SubscriptionRow>(
    'SELECT * FROM saas_subscriptions WHERE subscription_id = $1',
    [subscriptionId]
  );

  return row ? mapRowToSubscription(row) : null;
}


/**
 * Get all subscriptions
 */
export async function getSubscriptions(
  vendorName?: VendorName,
  status?: SubscriptionStatus | SubscriptionStatus[],
  limit = 100
): Promise<SaaSSubscription[]> {
  let sql = 'SELECT * FROM saas_subscriptions WHERE 1=1';
  const params: unknown[] = [];
  let paramIndex = 1;

  if (vendorName) {
    sql += ` AND vendor_name = $${paramIndex++}`;
    params.push(vendorName);
  }

  if (status) {
    const statuses = Array.isArray(status) ? status : [status];
    sql += ` AND status = ANY($${paramIndex++})`;
    params.push(statuses);
  }

  sql += ` ORDER BY renewal_date ASC LIMIT ${limit}`;

  const rows = await queryMany<SubscriptionRow>(sql, params);
  return rows.map(mapRowToSubscription);
}

/**
 * Get subscriptions expiring soon (within specified days)
 * Requirement 4.13: Track subscription renewal dates
 */
export async function getExpiringSubscriptions(
  daysUntilExpiration: number
): Promise<SaaSSubscription[]> {
  const rows = await queryMany<SubscriptionRow>(
    `SELECT * FROM saas_subscriptions 
     WHERE status = 'ACTIVE'
       AND renewal_date <= CURRENT_DATE + INTERVAL '1 day' * $1
       AND renewal_date > CURRENT_DATE
     ORDER BY renewal_date ASC`,
    [daysUntilExpiration]
  );

  return rows.map(mapRowToSubscription);
}

/**
 * Get unused subscriptions (subscriptions with unused seats)
 * Requirement 4.12: Identify unused subscriptions for cost optimization
 */
export async function getUnusedSubscriptions(
  minUnusedSeats = 1,
  limit = 100
): Promise<SaaSSubscription[]> {
  const rows = await queryMany<SubscriptionRow>(
    `SELECT * FROM saas_subscriptions 
     WHERE status = 'ACTIVE'
       AND unused_seats >= $1
     ORDER BY (unused_seats * cost_per_seat) DESC
     LIMIT ${limit}`,
    [minUnusedSeats]
  );

  return rows.map(mapRowToSubscription);
}


/**
 * Update subscription
 */
export async function updateSubscription(
  subscriptionId: UUID,
  updates: UpdateSubscriptionRequest
): Promise<SaaSSubscription> {
  const timestamp = now();
  const setClauses: string[] = ['updated_at = $2'];
  const params: unknown[] = [subscriptionId, timestamp];
  let paramIndex = 3;

  if (updates.totalSeats !== undefined) {
    setClauses.push(`total_seats = $${paramIndex++}`);
    params.push(updates.totalSeats);
  }

  if (updates.usedSeats !== undefined) {
    setClauses.push(`used_seats = $${paramIndex++}`);
    params.push(updates.usedSeats);
    // Recalculate unused seats
    setClauses.push(`unused_seats = total_seats - $${paramIndex - 1}`);
  }

  if (updates.costPerSeat !== undefined) {
    setClauses.push(`cost_per_seat = $${paramIndex++}`);
    params.push(updates.costPerSeat);
    // Recalculate total cost
    setClauses.push(`total_cost = total_seats * $${paramIndex - 1}`);
  }

  if (updates.renewalDate !== undefined) {
    setClauses.push(`renewal_date = $${paramIndex++}`);
    params.push(updates.renewalDate);
  }

  if (updates.status !== undefined) {
    setClauses.push(`status = $${paramIndex++}`);
    params.push(updates.status);
  }

  if (updates.lastSyncedAt !== undefined) {
    setClauses.push(`last_synced_at = $${paramIndex++}`);
    params.push(updates.lastSyncedAt);
  }

  const row = await queryOne<SubscriptionRow>(
    `UPDATE saas_subscriptions 
     SET ${setClauses.join(', ')}
     WHERE subscription_id = $1
     RETURNING *`,
    params
  );

  if (!row) {
    throw new Error(`SaaS subscription not found: ${subscriptionId}`);
  }

  logger.info('SaaS subscription updated', {
    subscriptionId,
    updates: Object.keys(updates),
  });

  return mapRowToSubscription(row);
}


/**
 * Update subscription status based on renewal date
 */
export async function updateSubscriptionStatuses(): Promise<number> {
  // Mark subscriptions as EXPIRING_SOON if within 30 days
  const expiringSoon = await queryOne<{ count: string }>(
    `UPDATE saas_subscriptions 
     SET status = 'EXPIRING_SOON', updated_at = $1
     WHERE status = 'ACTIVE'
       AND renewal_date <= CURRENT_DATE + INTERVAL '30 days'
       AND renewal_date > CURRENT_DATE
     RETURNING COUNT(*) as count`,
    [now()]
  );

  // Mark subscriptions as EXPIRED if past renewal date
  const expired = await queryOne<{ count: string }>(
    `UPDATE saas_subscriptions 
     SET status = 'EXPIRED', updated_at = $1
     WHERE status IN ('ACTIVE', 'EXPIRING_SOON')
       AND renewal_date < CURRENT_DATE
     RETURNING COUNT(*) as count`,
    [now()]
  );

  const totalUpdated =
    parseInt(expiringSoon?.count ?? '0', 10) + parseInt(expired?.count ?? '0', 10);

  if (totalUpdated > 0) {
    logger.info('Subscription statuses updated', {
      expiringSoon: expiringSoon?.count ?? 0,
      expired: expired?.count ?? 0,
    });
  }

  return totalUpdated;
}

/**
 * Create or update usage record
 * Requirement 4.11: Sync subscription usage data
 */
export async function upsertUsageRecord(
  request: CreateUsageRecordRequest
): Promise<SaaSUsageRecord> {
  const timestamp = now();

  // Check if record exists for this subscription/user
  const existing = await queryOne<UsageRecordRow>(
    `SELECT * FROM saas_usage_records 
     WHERE subscription_id = $1 AND user_id = $2`,
    [request.subscriptionId, request.userId]
  );

  if (existing) {
    // Update existing record
    const row = await queryOne<UsageRecordRow>(
      `UPDATE saas_usage_records 
       SET user_email = COALESCE($3, user_email),
           last_active_date = COALESCE($4, last_active_date),
           login_count_30day = $5,
           feature_usage = COALESCE($6, feature_usage),
           is_active = $7,
           updated_at = $8
       WHERE usage_id = $1
       RETURNING *`,
      [
        existing.usage_id,
        request.subscriptionId,
        request.userEmail ?? null,
        request.lastActiveDate ?? null,
        request.loginCount30Day,
        request.featureUsage ?? null,
        request.isActive,
        timestamp,
      ]
    );

    if (!row) {
      throw new Error('Failed to update usage record');
    }

    return mapRowToUsageRecord(row);
  }


  // Create new record
  const row = await queryOne<UsageRecordRow>(
    `INSERT INTO saas_usage_records (
      subscription_id, user_id, user_email, last_active_date,
      login_count_30day, feature_usage, is_active, created_at, updated_at
    ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $8)
    RETURNING *`,
    [
      request.subscriptionId,
      request.userId,
      request.userEmail ?? null,
      request.lastActiveDate ?? null,
      request.loginCount30Day,
      request.featureUsage ?? {},
      request.isActive,
      timestamp,
    ]
  );

  if (!row) {
    throw new Error('Failed to create usage record');
  }

  logger.info('Usage record created', {
    usageId: row.usage_id,
    subscriptionId: request.subscriptionId,
    userId: request.userId,
  });

  return mapRowToUsageRecord(row);
}

/**
 * Get usage records for a subscription
 */
export async function getUsageRecordsBySubscription(
  subscriptionId: UUID
): Promise<SaaSUsageRecord[]> {
  const rows = await queryMany<UsageRecordRow>(
    `SELECT * FROM saas_usage_records 
     WHERE subscription_id = $1
     ORDER BY last_active_date DESC NULLS LAST`,
    [subscriptionId]
  );

  return rows.map(mapRowToUsageRecord);
}

/**
 * Get inactive usage records (users who haven't logged in recently)
 * Requirement 4.12: Identify unused subscriptions
 */
export async function getInactiveUsageRecords(
  subscriptionId: UUID,
  inactiveDays = 30
): Promise<SaaSUsageRecord[]> {
  const rows = await queryMany<UsageRecordRow>(
    `SELECT * FROM saas_usage_records 
     WHERE subscription_id = $1
       AND (
         last_active_date IS NULL 
         OR last_active_date < CURRENT_DATE - INTERVAL '1 day' * $2
         OR is_active = FALSE
       )
     ORDER BY last_active_date ASC NULLS FIRST`,
    [subscriptionId, inactiveDays]
  );

  return rows.map(mapRowToUsageRecord);
}


/**
 * Delete usage records for a subscription
 */
export async function deleteUsageRecordsBySubscription(
  subscriptionId: UUID
): Promise<number> {
  const result = await queryOne<{ count: string }>(
    `DELETE FROM saas_usage_records 
     WHERE subscription_id = $1
     RETURNING COUNT(*) as count`,
    [subscriptionId]
  );

  return parseInt(result?.count ?? '0', 10);
}

/**
 * Create renewal notification
 * Requirement 4.13: Send advance notifications
 */
export async function createRenewalNotification(
  subscriptionId: UUID,
  daysBeforeRenewal: number,
  notificationType: '90_DAY' | '60_DAY' | '30_DAY'
): Promise<RenewalNotification> {
  const timestamp = now();

  // Check if notification already exists
  const existing = await queryOne<NotificationRow>(
    `SELECT * FROM renewal_notifications 
     WHERE subscription_id = $1 AND notification_type = $2`,
    [subscriptionId, notificationType]
  );

  if (existing) {
    return mapRowToNotification(existing);
  }

  const row = await queryOne<NotificationRow>(
    `INSERT INTO renewal_notifications (
      subscription_id, days_before_renewal, notification_type,
      status, created_at, updated_at
    ) VALUES ($1, $2, $3, 'PENDING', $4, $4)
    RETURNING *`,
    [subscriptionId, daysBeforeRenewal, notificationType, timestamp]
  );

  if (!row) {
    throw new Error('Failed to create renewal notification');
  }

  logger.info('Renewal notification created', {
    notificationId: row.notification_id,
    subscriptionId,
    notificationType,
  });

  return mapRowToNotification(row);
}

/**
 * Get pending renewal notifications
 */
export async function getPendingNotifications(): Promise<RenewalNotification[]> {
  const rows = await queryMany<NotificationRow>(
    `SELECT * FROM renewal_notifications 
     WHERE status = 'PENDING'
     ORDER BY days_before_renewal ASC`
  );

  return rows.map(mapRowToNotification);
}


/**
 * Update notification status
 */
export async function updateNotificationStatus(
  notificationId: UUID,
  status: NotificationStatus,
  acknowledgedBy?: UUID
): Promise<RenewalNotification> {
  const timestamp = now();

  const row = await queryOne<NotificationRow>(
    `UPDATE renewal_notifications 
     SET status = $2,
         sent_at = CASE WHEN $2 = 'SENT' THEN $4 ELSE sent_at END,
         acknowledged_by = COALESCE($3, acknowledged_by),
         acknowledged_at = CASE WHEN $3 IS NOT NULL THEN $4 ELSE acknowledged_at END,
         updated_at = $4
     WHERE notification_id = $1
     RETURNING *`,
    [notificationId, status, acknowledgedBy ?? null, timestamp]
  );

  if (!row) {
    throw new Error(`Renewal notification not found: ${notificationId}`);
  }

  return mapRowToNotification(row);
}

/**
 * Get notifications by subscription
 */
export async function getNotificationsBySubscription(
  subscriptionId: UUID
): Promise<RenewalNotification[]> {
  const rows = await queryMany<NotificationRow>(
    `SELECT * FROM renewal_notifications 
     WHERE subscription_id = $1
     ORDER BY days_before_renewal DESC`,
    [subscriptionId]
  );

  return rows.map(mapRowToNotification);
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
  const summary = await queryOne<{
    total_subscriptions: string;
    total_seats: string;
    used_seats: string;
    unused_seats: string;
    total_cost: string;
  }>(
    `SELECT 
       COUNT(*) as total_subscriptions,
       COALESCE(SUM(total_seats), 0) as total_seats,
       COALESCE(SUM(used_seats), 0) as used_seats,
       COALESCE(SUM(unused_seats), 0) as unused_seats,
       COALESCE(SUM(total_cost), 0) as total_cost
     FROM saas_subscriptions
     WHERE status IN ('ACTIVE', 'EXPIRING_SOON')`
  );

  const byVendorRows = await queryMany<{
    vendor_name: string;
    count: string;
    seats: string;
    cost: string;
  }>(
    `SELECT 
       vendor_name,
       COUNT(*) as count,
       COALESCE(SUM(total_seats), 0) as seats,
       COALESCE(SUM(total_cost), 0) as cost
     FROM saas_subscriptions
     WHERE status IN ('ACTIVE', 'EXPIRING_SOON')
     GROUP BY vendor_name`
  );

  const byStatusRows = await queryMany<{ status: string; count: string }>(
    `SELECT status, COUNT(*) as count 
     FROM saas_subscriptions 
     GROUP BY status`
  );


  const unusedSeats = parseInt(summary?.unused_seats ?? '0', 10);
  const avgCostPerSeat =
    parseInt(summary?.total_seats ?? '0', 10) > 0
      ? parseFloat(summary?.total_cost ?? '0') / parseInt(summary?.total_seats ?? '1', 10)
      : 0;

  const byVendor: Record<string, { count: number; seats: number; cost: number }> = {};
  for (const row of byVendorRows) {
    byVendor[row.vendor_name] = {
      count: parseInt(row.count, 10),
      seats: parseInt(row.seats, 10),
      cost: parseFloat(row.cost),
    };
  }

  const byStatus: Record<string, number> = {};
  for (const row of byStatusRows) {
    byStatus[row.status] = parseInt(row.count, 10);
  }

  return {
    totalSubscriptions: parseInt(summary?.total_subscriptions ?? '0', 10),
    totalSeats: parseInt(summary?.total_seats ?? '0', 10),
    usedSeats: parseInt(summary?.used_seats ?? '0', 10),
    unusedSeats,
    totalMonthlyCost: parseFloat(summary?.total_cost ?? '0'),
    potentialSavings: unusedSeats * avgCostPerSeat,
    byVendor,
    byStatus,
  };
}

/**
 * Delete subscription
 */
export async function deleteSubscription(subscriptionId: UUID): Promise<void> {
  // Delete related records first
  await deleteUsageRecordsBySubscription(subscriptionId);

  await queryOne(
    'DELETE FROM renewal_notifications WHERE subscription_id = $1',
    [subscriptionId]
  );

  const result = await queryOne<{ subscription_id: string }>(
    'DELETE FROM saas_subscriptions WHERE subscription_id = $1 RETURNING subscription_id',
    [subscriptionId]
  );

  if (!result) {
    throw new Error(`SaaS subscription not found: ${subscriptionId}`);
  }

  logger.info('SaaS subscription deleted', { subscriptionId });
}