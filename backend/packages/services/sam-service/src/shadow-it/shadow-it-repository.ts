/**
 * Shadow IT Repository - Data access layer for shadow IT detection
 *
 * Implements database operations for:
 * - Known/approved SaaS applications management
 * - Shadow IT detection records
 * - Traffic log analysis results
 *
 * Requirements: 4.8, 4.9
 */

import type { UUID } from '@ams/types';
import { queryMany, queryOne } from '@ams/database';
import { createLogger, now } from '@ams/utils';

const logger = createLogger({ service: 'shadow-it-repository' });

/**
 * Application category types
 */
export type ApplicationCategory =
  | 'FILE_SHARING'
  | 'COLLABORATION'
  | 'DEVELOPMENT'
  | 'COMMUNICATION'
  | 'PRODUCTIVITY'
  | 'SOCIAL_MEDIA'
  | 'ENTERTAINMENT'
  | 'SECURITY'
  | 'ANALYTICS'
  | 'MARKETING'
  | 'FINANCE'
  | 'HR'
  | 'CRM'
  | 'OTHER';

/**
 * Risk level types
 */
export type RiskLevel = 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';

/**
 * Shadow IT detection status
 */
export type ShadowITStatus = 'DETECTED' | 'UNDER_REVIEW' | 'APPROVED' | 'BLOCKED';

/**
 * Traffic log entry from network monitoring
 */
export interface TrafficLogEntry {
  readonly timestamp: string;
  readonly userId: string;
  readonly sourceIp: string;
  readonly destinationDomain: string;
  readonly destinationUrl: string;
  readonly bytesTransferred: number;
  readonly protocol: string;
}

/**
 * Known SaaS application entity
 */
export interface KnownApplication {
  readonly applicationId: UUID;
  readonly applicationName: string;
  readonly domain: string;
  readonly domainPatterns: readonly string[];
  readonly category: ApplicationCategory;
  readonly vendor: string | null;
  readonly isApproved: boolean;
  readonly isBlocked: boolean;
  readonly riskLevel: RiskLevel;
  readonly description: string | null;
  readonly dataClassification: string | null;
  readonly complianceNotes: string | null;
  readonly createdAt: string;
  readonly updatedAt: string;
}

/**
 * Shadow IT detection record
 */
export interface ShadowITDetection {
  readonly detectionId: UUID;
  readonly applicationName: string;
  readonly applicationDomain: string;
  readonly category: ApplicationCategory;
  readonly riskLevel: RiskLevel;
  readonly usersAffected: readonly string[];
  readonly firstDetectedAt: string;
  readonly lastSeenAt: string;
  readonly totalBytesTransferred: number;
  readonly accessCount: number;
  readonly status: ShadowITStatus;
  readonly reviewedBy: UUID | null;
  readonly reviewedAt: string | null;
  readonly reviewNotes: string | null;
  readonly knownApplicationId: UUID | null;
  readonly createdAt: string;
  readonly updatedAt: string;
}

/**
 * Shadow IT alert entity
 */
export interface ShadowITAlert {
  readonly alertId: UUID;
  readonly detectionId: UUID;
  readonly applicationName: string;
  readonly applicationDomain: string;
  readonly userId: UUID;
  readonly userEmail: string | null;
  readonly riskLevel: RiskLevel;
  readonly accessCount: number;
  readonly bytesTransferred: number;
  readonly firstAccessAt: string;
  readonly lastAccessAt: string;
  readonly status: 'NEW' | 'ACKNOWLEDGED' | 'RESOLVED' | 'IGNORED';
  readonly acknowledgedBy: UUID | null;
  readonly acknowledgedAt: string | null;
  readonly resolvedBy: UUID | null;
  readonly resolvedAt: string | null;
  readonly notes: string | null;
  readonly createdAt: string;
  readonly updatedAt: string;
}

/**
 * User access record for shadow IT
 */
export interface UserAccessRecord {
  readonly userId: string;
  readonly userEmail: string | null;
  readonly accessCount: number;
  readonly bytesTransferred: number;
  readonly firstAccessAt: string;
  readonly lastAccessAt: string;
}

/**
 * Create shadow IT detection request
 */
export interface CreateShadowITDetectionRequest {
  readonly applicationName: string;
  readonly applicationDomain: string;
  readonly category: ApplicationCategory;
  readonly riskLevel: RiskLevel;
  readonly usersAffected: readonly string[];
  readonly totalBytesTransferred: number;
  readonly accessCount: number;
  readonly firstDetectedAt?: string;
}

/**
 * Create shadow IT alert request
 */
export interface CreateShadowITAlertRequest {
  readonly detectionId: UUID;
  readonly applicationName: string;
  readonly applicationDomain: string;
  readonly userId: UUID;
  readonly userEmail?: string;
  readonly riskLevel: RiskLevel;
  readonly accessCount: number;
  readonly bytesTransferred: number;
  readonly firstAccessAt: string;
  readonly lastAccessAt: string;
}

/**
 * Database row types
 */
interface KnownApplicationRow {
  application_id: string;
  application_name: string;
  domain: string;
  domain_patterns: string[];
  category: ApplicationCategory;
  vendor: string | null;
  is_approved: boolean;
  is_blocked: boolean;
  risk_level: RiskLevel;
  description: string | null;
  data_classification: string | null;
  compliance_notes: string | null;
  created_at: string;
  updated_at: string;
}

interface ShadowITDetectionRow {
  detection_id: string;
  application_name: string;
  application_domain: string;
  category: ApplicationCategory;
  risk_level: RiskLevel;
  users_affected: string[];
  first_detected_at: string;
  last_seen_at: string;
  total_bytes_transferred: string;
  access_count: number;
  status: ShadowITStatus;
  reviewed_by: string | null;
  reviewed_at: string | null;
  review_notes: string | null;
  known_application_id: string | null;
  created_at: string;
  updated_at: string;
}

interface ShadowITAlertRow {
  alert_id: string;
  detection_id: string;
  application_name: string;
  application_domain: string;
  user_id: string;
  user_email: string | null;
  risk_level: RiskLevel;
  access_count: number;
  bytes_transferred: string;
  first_access_at: string;
  last_access_at: string;
  status: 'NEW' | 'ACKNOWLEDGED' | 'RESOLVED' | 'IGNORED';
  acknowledged_by: string | null;
  acknowledged_at: string | null;
  resolved_by: string | null;
  resolved_at: string | null;
  notes: string | null;
  created_at: string;
  updated_at: string;
}

/**
 * Map database row to KnownApplication entity
 */
function mapRowToKnownApplication(row: KnownApplicationRow): KnownApplication {
  return {
    applicationId: row.application_id,
    applicationName: row.application_name,
    domain: row.domain,
    domainPatterns: row.domain_patterns ?? [],
    category: row.category,
    vendor: row.vendor,
    isApproved: row.is_approved,
    isBlocked: row.is_blocked,
    riskLevel: row.risk_level,
    description: row.description,
    dataClassification: row.data_classification,
    complianceNotes: row.compliance_notes,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

/**
 * Map database row to ShadowITDetection entity
 */
function mapRowToDetection(row: ShadowITDetectionRow): ShadowITDetection {
  return {
    detectionId: row.detection_id,
    applicationName: row.application_name,
    applicationDomain: row.application_domain,
    category: row.category,
    riskLevel: row.risk_level,
    usersAffected: row.users_affected ?? [],
    firstDetectedAt: row.first_detected_at,
    lastSeenAt: row.last_seen_at,
    totalBytesTransferred: parseInt(row.total_bytes_transferred, 10) || 0,
    accessCount: row.access_count,
    status: row.status,
    reviewedBy: row.reviewed_by,
    reviewedAt: row.reviewed_at,
    reviewNotes: row.review_notes,
    knownApplicationId: row.known_application_id,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

/**
 * Map database row to ShadowITAlert entity
 */
function mapRowToAlert(row: ShadowITAlertRow): ShadowITAlert {
  return {
    alertId: row.alert_id,
    detectionId: row.detection_id,
    applicationName: row.application_name,
    applicationDomain: row.application_domain,
    userId: row.user_id,
    userEmail: row.user_email,
    riskLevel: row.risk_level,
    accessCount: row.access_count,
    bytesTransferred: parseInt(row.bytes_transferred, 10) || 0,
    firstAccessAt: row.first_access_at,
    lastAccessAt: row.last_access_at,
    status: row.status,
    acknowledgedBy: row.acknowledged_by,
    acknowledgedAt: row.acknowledged_at,
    resolvedBy: row.resolved_by,
    resolvedAt: row.resolved_at,
    notes: row.notes,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

/**
 * Get all known/approved applications
 */
export async function getKnownApplications(): Promise<KnownApplication[]> {
  const rows = await queryMany<KnownApplicationRow>(
    `SELECT * FROM known_applications 
     ORDER BY application_name ASC`
  );

  return rows.map(mapRowToKnownApplication);
}

/**
 * Get approved applications only
 */
export async function getApprovedApplications(): Promise<KnownApplication[]> {
  const rows = await queryMany<KnownApplicationRow>(
    `SELECT * FROM known_applications 
     WHERE is_approved = TRUE AND is_blocked = FALSE
     ORDER BY application_name ASC`
  );

  return rows.map(mapRowToKnownApplication);
}

/**
 * Get blocked applications
 */
export async function getBlockedApplications(): Promise<KnownApplication[]> {
  const rows = await queryMany<KnownApplicationRow>(
    `SELECT * FROM known_applications 
     WHERE is_blocked = TRUE
     ORDER BY application_name ASC`
  );

  return rows.map(mapRowToKnownApplication);
}

/**
 * Find known application by domain
 */
export async function findApplicationByDomain(domain: string): Promise<KnownApplication | null> {
  // First try exact match
  let result = await queryOne<KnownApplicationRow>(
    `SELECT * FROM known_applications 
     WHERE LOWER(domain) = LOWER($1)`,
    [domain]
  );

  if (result) {
    return mapRowToKnownApplication(result);
  }

  // Try pattern matching
  result = await queryOne<KnownApplicationRow>(
    `SELECT * FROM known_applications 
     WHERE EXISTS (
       SELECT 1 FROM unnest(domain_patterns) AS pattern 
       WHERE LOWER($1) LIKE LOWER(pattern)
     )`,
    [domain]
  );

  return result ? mapRowToKnownApplication(result) : null;
}

/**
 * Create or update shadow IT detection
 * Requirement 4.8: Analyze network traffic logs to identify unauthorized SaaS application usage
 */
export async function upsertDetection(
  request: CreateShadowITDetectionRequest
): Promise<ShadowITDetection> {
  const timestamp = now();

  // Check if detection already exists for this domain
  const existing = await queryOne<ShadowITDetectionRow>(
    `SELECT * FROM shadow_it_detections 
     WHERE LOWER(application_domain) = LOWER($1)
       AND status NOT IN ('APPROVED', 'BLOCKED')`,
    [request.applicationDomain]
  );

  if (existing) {
    // Update existing detection
    const updatedUsers = Array.from(
      new Set([...existing.users_affected, ...request.usersAffected])
    );

    const row = await queryOne<ShadowITDetectionRow>(
      `UPDATE shadow_it_detections 
       SET users_affected = $2,
           last_seen_at = $3,
           total_bytes_transferred = total_bytes_transferred + $4,
           access_count = access_count + $5,
           updated_at = $3
       WHERE detection_id = $1
       RETURNING *`,
      [
        existing.detection_id,
        updatedUsers,
        timestamp,
        request.totalBytesTransferred,
        request.accessCount,
      ]
    );

    if (!row) {
      throw new Error('Failed to update shadow IT detection');
    }

    logger.info('Shadow IT detection updated', {
      detectionId: row.detection_id,
      domain: request.applicationDomain,
      usersAffected: updatedUsers.length,
    });

    return mapRowToDetection(row);
  }

  // Create new detection
  const row = await queryOne<ShadowITDetectionRow>(
    `INSERT INTO shadow_it_detections (
      application_name, application_domain, category, risk_level,
      users_affected, first_detected_at, last_seen_at,
      total_bytes_transferred, access_count, created_at, updated_at
    ) VALUES ($1, $2, $3, $4, $5, $6, $6, $7, $8, $6, $6)
    RETURNING *`,
    [
      request.applicationName,
      request.applicationDomain,
      request.category,
      request.riskLevel,
      request.usersAffected,
      request.firstDetectedAt ?? timestamp,
      request.totalBytesTransferred,
      request.accessCount,
    ]
  );

  if (!row) {
    throw new Error('Failed to create shadow IT detection');
  }

  logger.info('Shadow IT detection created', {
    detectionId: row.detection_id,
    domain: request.applicationDomain,
    category: request.category,
    riskLevel: request.riskLevel,
  });

  return mapRowToDetection(row);
}

/**
 * Get shadow IT detection by ID
 */
export async function getDetectionById(detectionId: UUID): Promise<ShadowITDetection | null> {
  const result = await queryOne<ShadowITDetectionRow>(
    'SELECT * FROM shadow_it_detections WHERE detection_id = $1',
    [detectionId]
  );

  return result ? mapRowToDetection(result) : null;
}

/**
 * Get shadow IT detection by domain
 */
export async function getDetectionByDomain(domain: string): Promise<ShadowITDetection | null> {
  const result = await queryOne<ShadowITDetectionRow>(
    `SELECT * FROM shadow_it_detections 
     WHERE LOWER(application_domain) = LOWER($1)
     ORDER BY last_seen_at DESC
     LIMIT 1`,
    [domain]
  );

  return result ? mapRowToDetection(result) : null;
}

/**
 * Get all shadow IT detections
 */
export async function getDetections(
  status?: ShadowITStatus | ShadowITStatus[],
  limit = 100
): Promise<ShadowITDetection[]> {
  let sql = 'SELECT * FROM shadow_it_detections';
  const params: unknown[] = [];

  if (status) {
    const statuses = Array.isArray(status) ? status : [status];
    sql += ' WHERE status = ANY($1)';
    params.push(statuses);
  }

  sql += ` ORDER BY last_seen_at DESC LIMIT ${limit}`;

  const rows = await queryMany<ShadowITDetectionRow>(sql, params);
  return rows.map(mapRowToDetection);
}

/**
 * Update detection status
 */
export async function updateDetectionStatus(
  detectionId: UUID,
  status: ShadowITStatus,
  reviewedBy?: UUID,
  reviewNotes?: string,
  knownApplicationId?: UUID
): Promise<ShadowITDetection> {
  const timestamp = now();

  const row = await queryOne<ShadowITDetectionRow>(
    `UPDATE shadow_it_detections 
     SET status = $2,
         reviewed_by = COALESCE($3, reviewed_by),
         reviewed_at = CASE WHEN $3 IS NOT NULL THEN $5 ELSE reviewed_at END,
         review_notes = COALESCE($4, review_notes),
         known_application_id = COALESCE($6, known_application_id),
         updated_at = $5
     WHERE detection_id = $1
     RETURNING *`,
    [detectionId, status, reviewedBy ?? null, reviewNotes ?? null, timestamp, knownApplicationId ?? null]
  );

  if (!row) {
    throw new Error(`Shadow IT detection not found: ${detectionId}`);
  }

  logger.info('Shadow IT detection status updated', {
    detectionId,
    status,
    reviewedBy,
  });

  return mapRowToDetection(row);
}

/**
 * Create shadow IT alert
 * Requirement 4.9: Create alerts with application details and user information
 */
export async function createAlert(request: CreateShadowITAlertRequest): Promise<ShadowITAlert> {
  const timestamp = now();

  const row = await queryOne<ShadowITAlertRow>(
    `INSERT INTO shadow_it_alerts (
      detection_id, application_name, application_domain,
      user_id, user_email, risk_level, access_count, bytes_transferred,
      first_access_at, last_access_at, created_at, updated_at
    ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $11)
    RETURNING *`,
    [
      request.detectionId,
      request.applicationName,
      request.applicationDomain,
      request.userId,
      request.userEmail ?? null,
      request.riskLevel,
      request.accessCount,
      request.bytesTransferred,
      request.firstAccessAt,
      request.lastAccessAt,
      timestamp,
    ]
  );

  if (!row) {
    throw new Error('Failed to create shadow IT alert');
  }

  logger.info('Shadow IT alert created', {
    alertId: row.alert_id,
    detectionId: request.detectionId,
    userId: request.userId,
    applicationDomain: request.applicationDomain,
  });

  return mapRowToAlert(row);
}

/**
 * Get alert by ID
 */
export async function getAlertById(alertId: UUID): Promise<ShadowITAlert | null> {
  const result = await queryOne<ShadowITAlertRow>(
    'SELECT * FROM shadow_it_alerts WHERE alert_id = $1',
    [alertId]
  );

  return result ? mapRowToAlert(result) : null;
}

/**
 * Get alerts by detection ID
 */
export async function getAlertsByDetectionId(detectionId: UUID): Promise<ShadowITAlert[]> {
  const rows = await queryMany<ShadowITAlertRow>(
    `SELECT * FROM shadow_it_alerts 
     WHERE detection_id = $1
     ORDER BY created_at DESC`,
    [detectionId]
  );

  return rows.map(mapRowToAlert);
}

/**
 * Get alerts by user ID
 */
export async function getAlertsByUserId(userId: UUID): Promise<ShadowITAlert[]> {
  const rows = await queryMany<ShadowITAlertRow>(
    `SELECT * FROM shadow_it_alerts 
     WHERE user_id = $1
     ORDER BY created_at DESC`,
    [userId]
  );

  return rows.map(mapRowToAlert);
}

/**
 * Get alerts by status
 */
export async function getAlertsByStatus(
  status: ShadowITAlert['status'] | ShadowITAlert['status'][],
  limit = 100
): Promise<ShadowITAlert[]> {
  const statuses = Array.isArray(status) ? status : [status];

  const rows = await queryMany<ShadowITAlertRow>(
    `SELECT * FROM shadow_it_alerts 
     WHERE status = ANY($1)
     ORDER BY created_at DESC
     LIMIT ${limit}`,
    [statuses]
  );

  return rows.map(mapRowToAlert);
}

/**
 * Update alert status
 */
export async function updateAlertStatus(
  alertId: UUID,
  status: ShadowITAlert['status'],
  updatedBy?: UUID,
  notes?: string
): Promise<ShadowITAlert> {
  const timestamp = now();

  let updateFields = 'status = $2, updated_at = $4';
  const params: unknown[] = [alertId, status, updatedBy ?? null, timestamp];

  if (status === 'ACKNOWLEDGED' && updatedBy) {
    updateFields += ', acknowledged_by = $3, acknowledged_at = $4';
  } else if (status === 'RESOLVED' && updatedBy) {
    updateFields += ', resolved_by = $3, resolved_at = $4';
  }

  if (notes) {
    updateFields += `, notes = $${params.length + 1}`;
    params.push(notes);
  }

  const row = await queryOne<ShadowITAlertRow>(
    `UPDATE shadow_it_alerts 
     SET ${updateFields}
     WHERE alert_id = $1
     RETURNING *`,
    params
  );

  if (!row) {
    throw new Error(`Shadow IT alert not found: ${alertId}`);
  }

  logger.info('Shadow IT alert status updated', {
    alertId,
    status,
    updatedBy,
  });

  return mapRowToAlert(row);
}

/**
 * Get shadow IT summary statistics
 */
export async function getShadowITSummary(): Promise<{
  totalDetections: number;
  byStatus: Record<string, number>;
  byRiskLevel: Record<string, number>;
  byCategory: Record<string, number>;
  totalUsersAffected: number;
  totalAlerts: number;
  newAlerts: number;
}> {
  const statusCounts = await queryMany<{ status: string; count: string }>(
    `SELECT status, COUNT(*) as count 
     FROM shadow_it_detections 
     GROUP BY status`
  );

  const riskCounts = await queryMany<{ risk_level: string; count: string }>(
    `SELECT risk_level, COUNT(*) as count 
     FROM shadow_it_detections 
     GROUP BY risk_level`
  );

  const categoryCounts = await queryMany<{ category: string; count: string }>(
    `SELECT category, COUNT(*) as count 
     FROM shadow_it_detections 
     GROUP BY category`
  );

  const userCount = await queryOne<{ total_users: string }>(
    `SELECT COUNT(DISTINCT unnest(users_affected)) as total_users 
     FROM shadow_it_detections`
  );

  const alertCounts = await queryOne<{ total: string; new_alerts: string }>(
    `SELECT 
       COUNT(*) as total,
       COUNT(*) FILTER (WHERE status = 'NEW') as new_alerts
     FROM shadow_it_alerts`
  );

  const byStatus: Record<string, number> = {};
  let totalDetections = 0;
  for (const row of statusCounts) {
    byStatus[row.status] = parseInt(row.count, 10);
    totalDetections += parseInt(row.count, 10);
  }

  const byRiskLevel: Record<string, number> = {};
  for (const row of riskCounts) {
    byRiskLevel[row.risk_level] = parseInt(row.count, 10);
  }

  const byCategory: Record<string, number> = {};
  for (const row of categoryCounts) {
    byCategory[row.category] = parseInt(row.count, 10);
  }

  return {
    totalDetections,
    byStatus,
    byRiskLevel,
    byCategory,
    totalUsersAffected: userCount ? parseInt(userCount.total_users, 10) : 0,
    totalAlerts: alertCounts ? parseInt(alertCounts.total, 10) : 0,
    newAlerts: alertCounts ? parseInt(alertCounts.new_alerts, 10) : 0,
  };
}

/**
 * Check if user has existing alert for detection
 */
export async function hasExistingAlert(
  detectionId: UUID,
  userId: UUID
): Promise<boolean> {
  const result = await queryOne<{ exists: boolean }>(
    `SELECT EXISTS(
       SELECT 1 FROM shadow_it_alerts 
       WHERE detection_id = $1 AND user_id = $2
         AND status NOT IN ('RESOLVED', 'IGNORED')
     ) as exists`,
    [detectionId, userId]
  );

  return result?.exists ?? false;
}
