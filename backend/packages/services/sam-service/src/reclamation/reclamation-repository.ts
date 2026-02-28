/**
 * Reclamation Repository - Data access layer for software license reclamation
 *
 * Implements database operations for:
 * - Reclamation rules management
 * - Reclamation candidate identification and tracking
 * - Usage threshold detection based on last_used_date
 *
 * Requirements: 4.6, 4.7
 */

import type { ReclamationStatus, UUID } from '@ams/types';
import { queryMany, queryOne, query } from '@ams/database';
import { createLogger, now } from '@ams/utils';

const logger = createLogger({ service: 'reclamation-repository' });

/**
 * Reclamation rule entity
 */
export interface ReclamationRule {
  readonly ruleId: UUID;
  readonly ruleName: string;
  readonly description: string | null;
  readonly softwareProductId: UUID | null;
  readonly productCategory: string | null;
  readonly publisher: string | null;
  readonly daysSinceLastUse: number;
  readonly minUsageMinutes30Day: number;
  readonly minUsageMinutes90Day: number;
  readonly priority: number;
  readonly isActive: boolean;
  readonly autoCreateCandidates: boolean;
  readonly requireApproval: boolean;
  readonly notifyUser: boolean;
  readonly notifyManager: boolean;
  readonly notificationDaysBeforeAction: number;
  readonly createdAt: string;
  readonly updatedAt: string;
}

/**
 * Reclamation candidate entity
 */
export interface ReclamationCandidate {
  readonly candidateId: UUID;
  readonly installationId: UUID;
  readonly daysSinceLastUse: number;
  readonly reclamationRuleId: UUID | null;
  readonly status: ReclamationStatus;
  readonly workflowId: UUID | null;
  readonly identifiedAt: string;
  readonly usageAtIdentification: number | null;
  readonly userNotifiedAt: string | null;
  readonly managerNotifiedAt: string | null;
  readonly notificationCount: number;
  readonly approvalRequestedAt: string | null;
  readonly approvedBy: UUID | null;
  readonly approvedAt: string | null;
  readonly rejectionReason: string | null;
  readonly actionScheduledAt: string | null;
  readonly actionCompletedAt: string | null;
  readonly actionType: string | null;
  readonly actionResult: string | null;
  readonly licenseRecovered: boolean;
  readonly licenseRecoveredAt: string | null;
  readonly entitlementId: UUID | null;
  readonly notes: string | null;
  readonly createdAt: string;
  readonly updatedAt: string;
}

/**
 * Software installation with usage details for reclamation analysis
 */
export interface InstallationUsageDetails {
  readonly installationId: UUID;
  readonly softwareProductId: UUID;
  readonly hardwareAssetId: UUID;
  readonly productName: string;
  readonly publisher: string;
  readonly productCategory: string | null;
  readonly installedDate: string | null;
  readonly lastUsedDate: string | null;
  readonly usageMinutes30Day: number;
  readonly daysSinceLastUse: number;
  readonly assignedToUserId: UUID | null;
  readonly assignedToUserEmail: string | null;
  readonly managerId: UUID | null;
  readonly status: string;
  readonly unitCost: number | null;
}

/**
 * Reclamation candidate with installation details
 */
export interface ReclamationCandidateWithDetails extends ReclamationCandidate {
  readonly installation: InstallationUsageDetails;
  readonly rule: ReclamationRule | null;
}

/**
 * Create reclamation candidate request
 */
export interface CreateReclamationCandidateRequest {
  readonly installationId: UUID;
  readonly daysSinceLastUse: number;
  readonly reclamationRuleId?: UUID;
  readonly usageAtIdentification?: number;
  readonly notes?: string;
  readonly createdBy?: UUID;
}

/**
 * Database row types
 */
interface ReclamationRuleRow {
  rule_id: string;
  rule_name: string;
  description: string | null;
  software_product_id: string | null;
  product_category: string | null;
  publisher: string | null;
  days_since_last_use: number;
  min_usage_minutes_30day: number;
  min_usage_minutes_90day: number;
  priority: number;
  is_active: boolean;
  auto_create_candidates: boolean;
  require_approval: boolean;
  notify_user: boolean;
  notify_manager: boolean;
  notification_days_before_action: number;
  created_at: string;
  updated_at: string;
}

interface ReclamationCandidateRow {
  candidate_id: string;
  installation_id: string;
  days_since_last_use: number;
  reclamation_rule_id: string | null;
  status: ReclamationStatus;
  workflow_id: string | null;
  identified_at: string;
  usage_at_identification: number | null;
  user_notified_at: string | null;
  manager_notified_at: string | null;
  notification_count: number;
  approval_requested_at: string | null;
  approved_by: string | null;
  approved_at: string | null;
  rejection_reason: string | null;
  action_scheduled_at: string | null;
  action_completed_at: string | null;
  action_type: string | null;
  action_result: string | null;
  license_recovered: boolean;
  license_recovered_at: string | null;
  entitlement_id: string | null;
  notes: string | null;
  created_at: string;
  updated_at: string;
}

interface InstallationUsageRow {
  installation_id: string;
  software_product_id: string;
  hardware_asset_id: string;
  product_name: string;
  publisher: string;
  product_category: string | null;
  installed_date: string | null;
  last_used_date: string | null;
  usage_minutes_30day: number;
  days_since_last_use: number;
  assigned_to_user_id: string | null;
  assigned_to_user_email: string | null;
  manager_id: string | null;
  status: string;
  unit_cost: string | null;
}

/**
 * Map database row to ReclamationRule entity
 */
function mapRowToRule(row: ReclamationRuleRow): ReclamationRule {
  return {
    ruleId: row.rule_id,
    ruleName: row.rule_name,
    description: row.description,
    softwareProductId: row.software_product_id,
    productCategory: row.product_category,
    publisher: row.publisher,
    daysSinceLastUse: row.days_since_last_use,
    minUsageMinutes30Day: row.min_usage_minutes_30day,
    minUsageMinutes90Day: row.min_usage_minutes_90day,
    priority: row.priority,
    isActive: row.is_active,
    autoCreateCandidates: row.auto_create_candidates,
    requireApproval: row.require_approval,
    notifyUser: row.notify_user,
    notifyManager: row.notify_manager,
    notificationDaysBeforeAction: row.notification_days_before_action,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

/**
 * Map database row to ReclamationCandidate entity
 */
function mapRowToCandidate(row: ReclamationCandidateRow): ReclamationCandidate {
  return {
    candidateId: row.candidate_id,
    installationId: row.installation_id,
    daysSinceLastUse: row.days_since_last_use,
    reclamationRuleId: row.reclamation_rule_id,
    status: row.status,
    workflowId: row.workflow_id,
    identifiedAt: row.identified_at,
    usageAtIdentification: row.usage_at_identification,
    userNotifiedAt: row.user_notified_at,
    managerNotifiedAt: row.manager_notified_at,
    notificationCount: row.notification_count,
    approvalRequestedAt: row.approval_requested_at,
    approvedBy: row.approved_by,
    approvedAt: row.approved_at,
    rejectionReason: row.rejection_reason,
    actionScheduledAt: row.action_scheduled_at,
    actionCompletedAt: row.action_completed_at,
    actionType: row.action_type,
    actionResult: row.action_result,
    licenseRecovered: row.license_recovered,
    licenseRecoveredAt: row.license_recovered_at,
    entitlementId: row.entitlement_id,
    notes: row.notes,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

/**
 * Map database row to InstallationUsageDetails entity
 */
function mapRowToInstallationUsage(row: InstallationUsageRow): InstallationUsageDetails {
  return {
    installationId: row.installation_id,
    softwareProductId: row.software_product_id,
    hardwareAssetId: row.hardware_asset_id,
    productName: row.product_name,
    publisher: row.publisher,
    productCategory: row.product_category,
    installedDate: row.installed_date,
    lastUsedDate: row.last_used_date,
    usageMinutes30Day: row.usage_minutes_30day,
    daysSinceLastUse: row.days_since_last_use,
    assignedToUserId: row.assigned_to_user_id,
    assignedToUserEmail: row.assigned_to_user_email,
    managerId: row.manager_id,
    status: row.status,
    unitCost: row.unit_cost ? parseFloat(row.unit_cost) : null,
  };
}

/**
 * Get all active reclamation rules
 */
export async function getActiveRules(): Promise<ReclamationRule[]> {
  const rows = await queryMany<ReclamationRuleRow>(
    `SELECT * FROM reclamation_rules 
     WHERE is_active = TRUE 
     ORDER BY priority ASC, rule_name ASC`
  );

  return rows.map(mapRowToRule);
}

/**
 * Get reclamation rule by ID
 */
export async function getRuleById(ruleId: UUID): Promise<ReclamationRule | null> {
  const result = await queryOne<ReclamationRuleRow>(
    'SELECT * FROM reclamation_rules WHERE rule_id = $1',
    [ruleId]
  );

  return result ? mapRowToRule(result) : null;
}

/**
 * Get rules applicable to a specific product
 */
export async function getRulesForProduct(productId: UUID): Promise<ReclamationRule[]> {
  const rows = await queryMany<ReclamationRuleRow>(
    `SELECT rr.* FROM reclamation_rules rr
     LEFT JOIN software_products sp ON sp.product_id = $1
     WHERE rr.is_active = TRUE
       AND (
         rr.software_product_id = $1
         OR (rr.software_product_id IS NULL AND rr.product_category = sp.product_category)
         OR (rr.software_product_id IS NULL AND rr.publisher = sp.publisher)
         OR (rr.software_product_id IS NULL AND rr.product_category IS NULL AND rr.publisher IS NULL)
       )
     ORDER BY rr.priority ASC`,
    [productId]
  );

  return rows.map(mapRowToRule);
}

/**
 * Find installations that match reclamation criteria
 * Requirement 4.6: Identify software installations not used within configurable time periods
 */
export async function findUnusedInstallations(
  thresholdDays: number,
  minUsageMinutes30Day = 0,
  productId?: UUID,
  publisher?: string,
  productCategory?: string
): Promise<InstallationUsageDetails[]> {
  let sql = `
    SELECT 
      si.installation_id,
      si.software_product_id,
      si.hardware_asset_id,
      sp.product_name,
      sp.publisher,
      sp.product_category,
      si.installed_date,
      si.last_used_date,
      COALESCE(si.usage_minutes_30day, 0) as usage_minutes_30day,
      COALESCE(
        EXTRACT(DAY FROM (NOW() - si.last_used_date))::INTEGER,
        EXTRACT(DAY FROM (NOW() - si.installed_date))::INTEGER,
        9999
      ) as days_since_last_use,
      ha.assigned_to_user_id,
      u.email as assigned_to_user_email,
      u.manager_id,
      si.status,
      e.unit_cost
    FROM software_installations si
    JOIN software_products sp ON si.software_product_id = sp.product_id
    JOIN hardware_assets ha ON si.hardware_asset_id = ha.asset_id
    JOIN assets a ON ha.asset_id = a.asset_id
    LEFT JOIN users u ON ha.assigned_to_user_id = u.user_id
    LEFT JOIN entitlements e ON si.entitlement_id = e.entitlement_id
    WHERE si.status = 'ACTIVE'
      AND a.status = 'DEPLOYED'
      AND sp.is_active = TRUE
      AND (
        si.last_used_date IS NULL 
        OR si.last_used_date < NOW() - INTERVAL '1 day' * $1
      )
      AND COALESCE(si.usage_minutes_30day, 0) <= $2
      AND NOT EXISTS (
        SELECT 1 FROM reclamation_candidates rc 
        WHERE rc.installation_id = si.installation_id 
          AND rc.status NOT IN ('COMPLETED', 'CANCELLED', 'REJECTED')
      )
  `;

  const params: unknown[] = [thresholdDays, minUsageMinutes30Day];
  let paramIndex = 3;

  if (productId) {
    sql += ` AND si.software_product_id = $${paramIndex}`;
    params.push(productId);
    paramIndex++;
  }

  if (publisher) {
    sql += ` AND UPPER(sp.publisher) = UPPER($${paramIndex})`;
    params.push(publisher);
    paramIndex++;
  }

  if (productCategory) {
    sql += ` AND sp.product_category = $${paramIndex}`;
    params.push(productCategory);
  }

  sql += ' ORDER BY days_since_last_use DESC, sp.publisher, sp.product_name';

  const rows = await queryMany<InstallationUsageRow>(sql, params);
  return rows.map(mapRowToInstallationUsage);
}

/**
 * Create a reclamation candidate
 * Requirement 4.6: Track identified unused software
 */
export async function createCandidate(
  request: CreateReclamationCandidateRequest
): Promise<ReclamationCandidate> {
  const timestamp = now();

  const row = await queryOne<ReclamationCandidateRow>(
    `INSERT INTO reclamation_candidates (
      installation_id, days_since_last_use, reclamation_rule_id,
      usage_at_identification, notes, created_by, identified_at, created_at
    ) VALUES ($1, $2, $3, $4, $5, $6, $7, $7)
    RETURNING *`,
    [
      request.installationId,
      request.daysSinceLastUse,
      request.reclamationRuleId ?? null,
      request.usageAtIdentification ?? null,
      request.notes ?? null,
      request.createdBy ?? null,
      timestamp,
    ]
  );

  if (!row) {
    throw new Error('Failed to create reclamation candidate');
  }

  logger.info('Reclamation candidate created', {
    candidateId: row.candidate_id,
    installationId: request.installationId,
    daysSinceLastUse: request.daysSinceLastUse,
  });

  return mapRowToCandidate(row);
}

/**
 * Get reclamation candidate by ID
 */
export async function getCandidateById(candidateId: UUID): Promise<ReclamationCandidate | null> {
  const result = await queryOne<ReclamationCandidateRow>(
    'SELECT * FROM reclamation_candidates WHERE candidate_id = $1',
    [candidateId]
  );

  return result ? mapRowToCandidate(result) : null;
}

/**
 * Get reclamation candidate by installation ID
 */
export async function getCandidateByInstallationId(
  installationId: UUID
): Promise<ReclamationCandidate | null> {
  const result = await queryOne<ReclamationCandidateRow>(
    `SELECT * FROM reclamation_candidates 
     WHERE installation_id = $1 
       AND status NOT IN ('COMPLETED', 'CANCELLED', 'REJECTED')
     ORDER BY identified_at DESC
     LIMIT 1`,
    [installationId]
  );

  return result ? mapRowToCandidate(result) : null;
}

/**
 * Get candidates by status
 */
export async function getCandidatesByStatus(
  status: ReclamationStatus | ReclamationStatus[]
): Promise<ReclamationCandidate[]> {
  const statuses = Array.isArray(status) ? status : [status];

  const rows = await queryMany<ReclamationCandidateRow>(
    `SELECT * FROM reclamation_candidates 
     WHERE status = ANY($1)
     ORDER BY identified_at DESC`,
    [statuses]
  );

  return rows.map(mapRowToCandidate);
}

/**
 * Get candidates with full details
 */
export async function getCandidatesWithDetails(
  status?: ReclamationStatus | ReclamationStatus[],
  limit = 100
): Promise<ReclamationCandidateWithDetails[]> {
  let sql = `
    SELECT 
      rc.*,
      si.software_product_id,
      si.hardware_asset_id,
      sp.product_name,
      sp.publisher,
      sp.product_category,
      si.installed_date,
      si.last_used_date,
      COALESCE(si.usage_minutes_30day, 0) as usage_minutes_30day,
      COALESCE(
        EXTRACT(DAY FROM (NOW() - si.last_used_date))::INTEGER,
        EXTRACT(DAY FROM (NOW() - si.installed_date))::INTEGER,
        9999
      ) as current_days_since_last_use,
      ha.assigned_to_user_id,
      u.email as assigned_to_user_email,
      u.manager_id,
      si.status as installation_status,
      e.unit_cost,
      rr.rule_name,
      rr.description as rule_description,
      rr.days_since_last_use as rule_threshold_days,
      rr.require_approval as rule_require_approval
    FROM reclamation_candidates rc
    JOIN software_installations si ON rc.installation_id = si.installation_id
    JOIN software_products sp ON si.software_product_id = sp.product_id
    JOIN hardware_assets ha ON si.hardware_asset_id = ha.asset_id
    LEFT JOIN users u ON ha.assigned_to_user_id = u.user_id
    LEFT JOIN entitlements e ON si.entitlement_id = e.entitlement_id
    LEFT JOIN reclamation_rules rr ON rc.reclamation_rule_id = rr.rule_id
  `;

  const params: unknown[] = [];

  if (status) {
    const statuses = Array.isArray(status) ? status : [status];
    sql += ' WHERE rc.status = ANY($1)';
    params.push(statuses);
  }

  sql += ` ORDER BY rc.identified_at DESC LIMIT ${limit}`;

  interface CandidateWithDetailsRow extends ReclamationCandidateRow {
    software_product_id: string;
    hardware_asset_id: string;
    product_name: string;
    publisher: string;
    product_category: string | null;
    installed_date: string | null;
    last_used_date: string | null;
    usage_minutes_30day: number;
    current_days_since_last_use: number;
    assigned_to_user_id: string | null;
    assigned_to_user_email: string | null;
    manager_id: string | null;
    installation_status: string;
    unit_cost: string | null;
    rule_name: string | null;
    rule_description: string | null;
    rule_threshold_days: number | null;
    rule_require_approval: boolean | null;
  }

  const rows = await queryMany<CandidateWithDetailsRow>(sql, params);

  return rows.map((row) => ({
    ...mapRowToCandidate(row),
    installation: {
      installationId: row.installation_id,
      softwareProductId: row.software_product_id,
      hardwareAssetId: row.hardware_asset_id,
      productName: row.product_name,
      publisher: row.publisher,
      productCategory: row.product_category,
      installedDate: row.installed_date,
      lastUsedDate: row.last_used_date,
      usageMinutes30Day: row.usage_minutes_30day,
      daysSinceLastUse: row.current_days_since_last_use,
      assignedToUserId: row.assigned_to_user_id,
      assignedToUserEmail: row.assigned_to_user_email,
      managerId: row.manager_id,
      status: row.installation_status,
      unitCost: row.unit_cost ? parseFloat(row.unit_cost) : null,
    },
    rule: row.rule_name
      ? {
          ruleId: row.reclamation_rule_id!,
          ruleName: row.rule_name,
          description: row.rule_description,
          softwareProductId: null,
          productCategory: null,
          publisher: null,
          daysSinceLastUse: row.rule_threshold_days!,
          minUsageMinutes30Day: 0,
          minUsageMinutes90Day: 0,
          priority: 0,
          isActive: true,
          autoCreateCandidates: true,
          requireApproval: row.rule_require_approval ?? true,
          notifyUser: true,
          notifyManager: true,
          notificationDaysBeforeAction: 14,
          createdAt: '',
          updatedAt: '',
        }
      : null,
  }));
}

/**
 * Update candidate status
 * Requirement 4.7: Track reclamation workflow status
 */
export async function updateCandidateStatus(
  candidateId: UUID,
  status: ReclamationStatus,
  additionalFields?: Partial<{
    workflowId: UUID;
    userNotifiedAt: string;
    managerNotifiedAt: string;
    approvalRequestedAt: string;
    approvedBy: UUID;
    approvedAt: string;
    rejectionReason: string;
    actionScheduledAt: string;
    actionCompletedAt: string;
    actionType: string;
    actionResult: string;
    licenseRecovered: boolean;
    licenseRecoveredAt: string;
    entitlementId: UUID;
    notes: string;
  }>
): Promise<ReclamationCandidate> {
  const updates: string[] = ['status = $2', 'updated_at = NOW()'];
  const params: unknown[] = [candidateId, status];
  let paramIndex = 3;

  if (additionalFields) {
    if (additionalFields.workflowId !== undefined) {
      updates.push(`workflow_id = $${paramIndex}`);
      params.push(additionalFields.workflowId);
      paramIndex++;
    }
    if (additionalFields.userNotifiedAt !== undefined) {
      updates.push(`user_notified_at = $${paramIndex}`);
      updates.push('notification_count = notification_count + 1');
      params.push(additionalFields.userNotifiedAt);
      paramIndex++;
    }
    if (additionalFields.managerNotifiedAt !== undefined) {
      updates.push(`manager_notified_at = $${paramIndex}`);
      params.push(additionalFields.managerNotifiedAt);
      paramIndex++;
    }
    if (additionalFields.approvalRequestedAt !== undefined) {
      updates.push(`approval_requested_at = $${paramIndex}`);
      params.push(additionalFields.approvalRequestedAt);
      paramIndex++;
    }
    if (additionalFields.approvedBy !== undefined) {
      updates.push(`approved_by = $${paramIndex}`);
      params.push(additionalFields.approvedBy);
      paramIndex++;
    }
    if (additionalFields.approvedAt !== undefined) {
      updates.push(`approved_at = $${paramIndex}`);
      params.push(additionalFields.approvedAt);
      paramIndex++;
    }
    if (additionalFields.rejectionReason !== undefined) {
      updates.push(`rejection_reason = $${paramIndex}`);
      params.push(additionalFields.rejectionReason);
      paramIndex++;
    }
    if (additionalFields.actionScheduledAt !== undefined) {
      updates.push(`action_scheduled_at = $${paramIndex}`);
      params.push(additionalFields.actionScheduledAt);
      paramIndex++;
    }
    if (additionalFields.actionCompletedAt !== undefined) {
      updates.push(`action_completed_at = $${paramIndex}`);
      params.push(additionalFields.actionCompletedAt);
      paramIndex++;
    }
    if (additionalFields.actionType !== undefined) {
      updates.push(`action_type = $${paramIndex}`);
      params.push(additionalFields.actionType);
      paramIndex++;
    }
    if (additionalFields.actionResult !== undefined) {
      updates.push(`action_result = $${paramIndex}`);
      params.push(additionalFields.actionResult);
      paramIndex++;
    }
    if (additionalFields.licenseRecovered !== undefined) {
      updates.push(`license_recovered = $${paramIndex}`);
      params.push(additionalFields.licenseRecovered);
      paramIndex++;
    }
    if (additionalFields.licenseRecoveredAt !== undefined) {
      updates.push(`license_recovered_at = $${paramIndex}`);
      params.push(additionalFields.licenseRecoveredAt);
      paramIndex++;
    }
    if (additionalFields.entitlementId !== undefined) {
      updates.push(`entitlement_id = $${paramIndex}`);
      params.push(additionalFields.entitlementId);
      paramIndex++;
    }
    if (additionalFields.notes !== undefined) {
      updates.push(`notes = $${paramIndex}`);
      params.push(additionalFields.notes);
    }
  }

  const row = await queryOne<ReclamationCandidateRow>(
    `UPDATE reclamation_candidates 
     SET ${updates.join(', ')}
     WHERE candidate_id = $1
     RETURNING *`,
    params
  );

  if (!row) {
    throw new Error(`Reclamation candidate not found: ${candidateId}`);
  }

  logger.info('Reclamation candidate status updated', {
    candidateId,
    status,
  });

  return mapRowToCandidate(row);
}

/**
 * Get reclamation summary statistics
 */
export async function getReclamationSummary(): Promise<{
  totalCandidates: number;
  byStatus: Record<string, number>;
  potentialSavings: number;
  licensesRecovered: number;
}> {
  const statusCounts = await queryMany<{ status: string; count: string }>(
    `SELECT status, COUNT(*) as count 
     FROM reclamation_candidates 
     GROUP BY status`
  );

  const savingsResult = await queryOne<{ potential_savings: string; licenses_recovered: string }>(
    `SELECT 
      COALESCE(SUM(CASE WHEN rc.status NOT IN ('COMPLETED', 'CANCELLED', 'REJECTED') 
                       THEN e.unit_cost ELSE 0 END), 0) as potential_savings,
      COUNT(*) FILTER (WHERE rc.license_recovered = TRUE) as licenses_recovered
     FROM reclamation_candidates rc
     LEFT JOIN software_installations si ON rc.installation_id = si.installation_id
     LEFT JOIN entitlements e ON si.entitlement_id = e.entitlement_id`
  );

  const byStatus: Record<string, number> = {};
  let totalCandidates = 0;

  for (const row of statusCounts) {
    byStatus[row.status] = parseInt(row.count, 10);
    totalCandidates += parseInt(row.count, 10);
  }

  return {
    totalCandidates,
    byStatus,
    potentialSavings: savingsResult ? parseFloat(savingsResult.potential_savings) : 0,
    licensesRecovered: savingsResult ? parseInt(savingsResult.licenses_recovered, 10) : 0,
  };
}

/**
 * Update installation status after reclamation
 */
export async function markInstallationReclaimed(installationId: UUID): Promise<void> {
  await query(
    `UPDATE software_installations 
     SET status = 'RECLAIMED', updated_at = NOW()
     WHERE installation_id = $1`,
    [installationId]
  );

  logger.info('Installation marked as reclaimed', { installationId });
}

/**
 * Return license to available pool
 * Requirement 4.7: Return licenses to the available pool
 */
export async function returnLicenseToPool(
  entitlementId: UUID,
  quantity = 1
): Promise<void> {
  await query(
    `UPDATE entitlements 
     SET quantity_available = quantity_available + $2, updated_at = NOW()
     WHERE entitlement_id = $1`,
    [entitlementId, quantity]
  );

  logger.info('License returned to pool', { entitlementId, quantity });
}
