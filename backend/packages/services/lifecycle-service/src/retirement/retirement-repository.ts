/**
 * Retirement Repository - Data access layer for retirement operations
 *
 * Implements database operations for:
 * - Initiating retirement workflows (Requirement 6.8)
 * - Completing disposal with destruction certificates (Requirement 6.9)
 * - Tracking retirement tasks and status
 */

import type { PaginatedResult, PaginationParams, UUID } from '@ams/types';
import { queryMany, queryOne, withTransaction } from '@ams/database';
import { createLogger, now } from '@ams/utils';

const logger = createLogger({ service: 'retirement-repository' });

/**
 * Retirement workflow status
 */
export type RetirementStatus =
  | 'INITIATED'
  | 'PENDING_APPROVAL'
  | 'APPROVED'
  | 'DATA_WIPE_PENDING'
  | 'DATA_WIPE_COMPLETE'
  | 'DISPOSAL_PENDING'
  | 'DISPOSAL_COMPLETE'
  | 'COMPLETED'
  | 'CANCELLED';

/**
 * Disposal method types
 */
export type DisposalMethod =
  | 'RECYCLED'
  | 'DONATED'
  | 'SOLD'
  | 'DESTROYED'
  | 'RETURNED_TO_VENDOR'
  | 'TRADE_IN';

/**
 * Retirement task types
 */
export type RetirementTaskType =
  | 'APPROVAL'
  | 'DATA_SANITIZATION'
  | 'BACKUP_VERIFICATION'
  | 'LICENSE_RECOVERY'
  | 'ASSET_DECOMMISSION'
  | 'VENDOR_PICKUP'
  | 'DESTRUCTION_VERIFICATION'
  | 'CERTIFICATE_GENERATION';

/**
 * Retirement task status
 */
export type RetirementTaskStatus =
  | 'PENDING'
  | 'IN_PROGRESS'
  | 'COMPLETED'
  | 'SKIPPED'
  | 'FAILED';

/**
 * Asset status for retirement
 */
export type AssetStatus =
  | 'ORDERED'
  | 'RECEIVED'
  | 'IN_STOCK'
  | 'RESERVED'
  | 'DEPLOYED'
  | 'IN_MAINTENANCE'
  | 'RETIRED'
  | 'DISPOSED';

/**
 * Retirement workflow entity
 */
export interface RetirementWorkflow {
  readonly workflowId: UUID;
  readonly workflowNumber: string;
  readonly assetId: UUID;
  readonly assetTag: string | null;
  readonly assetName: string | null;
  readonly status: RetirementStatus;
  readonly retirementReason: string | null;
  readonly disposalMethod: DisposalMethod | null;
  readonly initiatedBy: UUID;
  readonly initiatedAt: string;
  readonly approvedBy: UUID | null;
  readonly approvedAt: string | null;
  readonly dataWipeRequired: boolean;
  readonly dataWipeCompletedAt: string | null;
  readonly dataWipeVerifiedBy: UUID | null;
  readonly disposalCompletedAt: string | null;
  readonly disposalCompletedBy: UUID | null;
  readonly destructionCertificateId: UUID | null;
  readonly notes: string | null;
  readonly createdAt: string;
  readonly updatedAt: string;
}

/**
 * Retirement task entity
 */
export interface RetirementTask {
  readonly taskId: UUID;
  readonly workflowId: UUID;
  readonly taskType: RetirementTaskType;
  readonly taskName: string;
  readonly description: string | null;
  readonly status: RetirementTaskStatus;
  readonly assignedTo: UUID | null;
  readonly dueDate: string | null;
  readonly completedAt: string | null;
  readonly completedBy: UUID | null;
  readonly completionNotes: string | null;
  readonly sequence: number;
  readonly isRequired: boolean;
  readonly createdAt: string;
  readonly updatedAt: string;
}

/**
 * Destruction certificate entity
 */
export interface DestructionCertificate {
  readonly certificateId: UUID;
  readonly certificateNumber: string;
  readonly assetId: UUID;
  readonly workflowId: UUID;
  readonly vendorId: UUID | null;
  readonly vendorName: string | null;
  readonly destructionDate: string;
  readonly destructionMethod: DisposalMethod;
  readonly serialNumber: string | null;
  readonly assetTag: string | null;
  readonly documentUrl: string | null;
  readonly verifiedBy: UUID | null;
  readonly verifiedAt: string | null;
  readonly notes: string | null;
  readonly createdAt: string;
  readonly createdBy: UUID;
}

/**
 * Create retirement workflow request
 */
export interface CreateRetirementWorkflowRequest {
  readonly assetId: UUID;
  readonly initiatedBy: UUID;
  readonly retirementReason?: string;
  readonly disposalMethod?: DisposalMethod;
  readonly dataWipeRequired?: boolean;
  readonly notes?: string;
}

/**
 * Complete disposal request
 */
export interface CompleteDisposalRequest {
  readonly vendorId?: UUID;
  readonly vendorName?: string;
  readonly destructionDate: string;
  readonly destructionMethod: DisposalMethod;
  readonly serialNumber?: string;
  readonly assetTag?: string;
  readonly documentUrl?: string;
  readonly verifiedBy: UUID;
  readonly notes?: string;
}

/**
 * Update task request
 */
export interface UpdateTaskRequest {
  readonly status: RetirementTaskStatus;
  readonly completedBy?: UUID;
  readonly completionNotes?: string;
}

/**
 * Database row types
 */
interface RetirementWorkflowRow {
  workflow_id: string;
  workflow_number: string;
  asset_id: string;
  asset_tag: string | null;
  asset_name: string | null;
  status: RetirementStatus;
  retirement_reason: string | null;
  disposal_method: DisposalMethod | null;
  initiated_by: string;
  initiated_at: string;
  approved_by: string | null;
  approved_at: string | null;
  data_wipe_required: boolean;
  data_wipe_completed_at: string | null;
  data_wipe_verified_by: string | null;
  disposal_completed_at: string | null;
  disposal_completed_by: string | null;
  destruction_certificate_id: string | null;
  notes: string | null;
  created_at: string;
  updated_at: string;
}

interface RetirementTaskRow {
  task_id: string;
  workflow_id: string;
  task_type: RetirementTaskType;
  task_name: string;
  description: string | null;
  status: RetirementTaskStatus;
  assigned_to: string | null;
  due_date: string | null;
  completed_at: string | null;
  completed_by: string | null;
  completion_notes: string | null;
  sequence: number;
  is_required: boolean;
  created_at: string;
  updated_at: string;
}

interface DestructionCertificateRow {
  certificate_id: string;
  certificate_number: string;
  asset_id: string;
  workflow_id: string;
  vendor_id: string | null;
  vendor_name: string | null;
  destruction_date: string;
  destruction_method: DisposalMethod;
  serial_number: string | null;
  asset_tag: string | null;
  document_url: string | null;
  verified_by: string | null;
  verified_at: string | null;
  notes: string | null;
  created_at: string;
  created_by: string;
}

interface AssetRow {
  asset_id: string;
  asset_tag: string;
  display_name: string | null;
  status: AssetStatus;
}

/**
 * Map database row to RetirementWorkflow entity
 */
function mapRowToRetirementWorkflow(row: RetirementWorkflowRow): RetirementWorkflow {
  return {
    workflowId: row.workflow_id,
    workflowNumber: row.workflow_number,
    assetId: row.asset_id,
    assetTag: row.asset_tag,
    assetName: row.asset_name,
    status: row.status,
    retirementReason: row.retirement_reason,
    disposalMethod: row.disposal_method,
    initiatedBy: row.initiated_by,
    initiatedAt: row.initiated_at,
    approvedBy: row.approved_by,
    approvedAt: row.approved_at,
    dataWipeRequired: row.data_wipe_required,
    dataWipeCompletedAt: row.data_wipe_completed_at,
    dataWipeVerifiedBy: row.data_wipe_verified_by,
    disposalCompletedAt: row.disposal_completed_at,
    disposalCompletedBy: row.disposal_completed_by,
    destructionCertificateId: row.destruction_certificate_id,
    notes: row.notes,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

/**
 * Map database row to RetirementTask entity
 */
function mapRowToRetirementTask(row: RetirementTaskRow): RetirementTask {
  return {
    taskId: row.task_id,
    workflowId: row.workflow_id,
    taskType: row.task_type,
    taskName: row.task_name,
    description: row.description,
    status: row.status,
    assignedTo: row.assigned_to,
    dueDate: row.due_date,
    completedAt: row.completed_at,
    completedBy: row.completed_by,
    completionNotes: row.completion_notes,
    sequence: row.sequence,
    isRequired: row.is_required,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

/**
 * Map database row to DestructionCertificate entity
 */
function mapRowToDestructionCertificate(row: DestructionCertificateRow): DestructionCertificate {
  return {
    certificateId: row.certificate_id,
    certificateNumber: row.certificate_number,
    assetId: row.asset_id,
    workflowId: row.workflow_id,
    vendorId: row.vendor_id,
    vendorName: row.vendor_name,
    destructionDate: row.destruction_date,
    destructionMethod: row.destruction_method,
    serialNumber: row.serial_number,
    assetTag: row.asset_tag,
    documentUrl: row.document_url,
    verifiedBy: row.verified_by,
    verifiedAt: row.verified_at,
    notes: row.notes,
    createdAt: row.created_at,
    createdBy: row.created_by,
  };
}

/**
 * Generate a unique workflow number
 */
function generateWorkflowNumber(): string {
  const timestamp = Date.now().toString(36).toUpperCase();
  const random = Math.random().toString(36).substring(2, 6).toUpperCase();
  return `RET-${timestamp}-${random}`;
}

/**
 * Generate a unique certificate number
 */
function generateCertificateNumber(): string {
  const timestamp = Date.now().toString(36).toUpperCase();
  const random = Math.random().toString(36).substring(2, 6).toUpperCase();
  return `CERT-${timestamp}-${random}`;
}

/**
 * Get asset by ID
 */
export async function getAssetById(assetId: UUID): Promise<AssetRow | null> {
  const result = await queryOne<AssetRow>(
    'SELECT asset_id, asset_tag, display_name, status FROM assets WHERE asset_id = $1',
    [assetId]
  );
  return result;
}

/**
 * Get retirement workflow by ID
 */
export async function getWorkflowById(workflowId: UUID): Promise<RetirementWorkflow | null> {
  const result = await queryOne<RetirementWorkflowRow>(
    'SELECT * FROM retirement_workflows WHERE workflow_id = $1',
    [workflowId]
  );
  return result ? mapRowToRetirementWorkflow(result) : null;
}

/**
 * Get retirement workflow by workflow number
 */
export async function getWorkflowByNumber(workflowNumber: string): Promise<RetirementWorkflow | null> {
  const result = await queryOne<RetirementWorkflowRow>(
    'SELECT * FROM retirement_workflows WHERE workflow_number = $1',
    [workflowNumber]
  );
  return result ? mapRowToRetirementWorkflow(result) : null;
}

/**
 * Get active retirement workflow for an asset
 */
export async function getActiveWorkflowForAsset(assetId: UUID): Promise<RetirementWorkflow | null> {
  const result = await queryOne<RetirementWorkflowRow>(
    `SELECT * FROM retirement_workflows 
     WHERE asset_id = $1 AND status NOT IN ('COMPLETED', 'CANCELLED')
     ORDER BY initiated_at DESC
     LIMIT 1`,
    [assetId]
  );
  return result ? mapRowToRetirementWorkflow(result) : null;
}

/**
 * Check if asset has an active retirement workflow
 */
export async function hasActiveRetirementWorkflow(assetId: UUID): Promise<boolean> {
  const result = await queryOne<{ count: string }>(
    `SELECT COUNT(*) as count FROM retirement_workflows 
     WHERE asset_id = $1 AND status NOT IN ('COMPLETED', 'CANCELLED')`,
    [assetId]
  );
  return parseInt(result?.count ?? '0', 10) > 0;
}

/**
 * Create a new retirement workflow
 * Requirement 6.8: Initiate disposal workflow with required tasks
 */
export async function createWorkflow(
  request: CreateRetirementWorkflowRequest
): Promise<RetirementWorkflow> {
  return withTransaction(async (ctx) => {
    const timestamp = now();
    const workflowNumber = generateWorkflowNumber();

    // Get asset details
    const asset = await ctx.queryOne<AssetRow>(
      'SELECT asset_id, asset_tag, display_name, status FROM assets WHERE asset_id = $1 FOR UPDATE',
      [request.assetId]
    );

    if (!asset) {
      throw new Error(`Asset not found: ${request.assetId}`);
    }

    // Validate asset is in a retirable status
    const retirableStatuses: AssetStatus[] = ['DEPLOYED', 'IN_STOCK', 'IN_MAINTENANCE'];
    if (!retirableStatuses.includes(asset.status)) {
      throw new Error(
        `Asset cannot be retired from status: ${asset.status}. ` +
        `Must be one of: ${retirableStatuses.join(', ')}`
      );
    }

    // Determine initial status based on requirements
    const dataWipeRequired = request.dataWipeRequired ?? true;
    let initialStatus: RetirementStatus = 'INITIATED';
    if (dataWipeRequired) {
      initialStatus = 'DATA_WIPE_PENDING';
    }

    const result = await ctx.queryOne<RetirementWorkflowRow>(
      `INSERT INTO retirement_workflows (
        workflow_number, asset_id, asset_tag, asset_name, status,
        retirement_reason, disposal_method, initiated_by, initiated_at,
        data_wipe_required, notes, created_at, updated_at
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $9, $9)
      RETURNING *`,
      [
        workflowNumber,
        request.assetId,
        asset.asset_tag,
        asset.display_name,
        initialStatus,
        request.retirementReason ?? null,
        request.disposalMethod ?? null,
        request.initiatedBy,
        timestamp,
        dataWipeRequired,
        request.notes ?? null,
      ]
    );

    if (!result) {
      throw new Error('Failed to create retirement workflow');
    }

    // Update asset status to RETIRED
    await ctx.queryOne(
      `UPDATE assets SET 
        status = 'RETIRED',
        updated_at = $1
       WHERE asset_id = $2`,
      [timestamp, request.assetId]
    );

    // Update hardware_assets with retirement date if applicable
    await ctx.queryOne(
      `UPDATE hardware_assets SET
        retirement_date = $1
       WHERE asset_id = $2`,
      [timestamp, request.assetId]
    );

    // Create audit log entry
    await ctx.queryOne(
      `INSERT INTO audit_log (
        user_id, action_type, resource_type, resource_id, new_values
      ) VALUES ($1, 'STATUS_CHANGE', 'ASSET', $2, $3::jsonb)`,
      [
        request.initiatedBy,
        request.assetId,
        JSON.stringify({
          previousStatus: asset.status,
          newStatus: 'RETIRED',
          workflowId: result.workflow_id,
          workflowNumber,
          retirementReason: request.retirementReason,
        }),
      ]
    );

    logger.info('Retirement workflow created', {
      workflowId: result.workflow_id,
      workflowNumber,
      assetId: request.assetId,
      status: initialStatus,
    });

    return mapRowToRetirementWorkflow(result);
  });
}

/**
 * Create default retirement tasks for a workflow
 * Requirement 6.8: Create disposal workflow with required tasks
 */
export async function createDefaultTasks(
  workflowId: UUID,
  dataWipeRequired: boolean
): Promise<RetirementTask[]> {
  const timestamp = now();
  const tasks: RetirementTask[] = [];
  let sequence = 1;

  // Data sanitization task
  if (dataWipeRequired) {
    const result = await queryOne<RetirementTaskRow>(
      `INSERT INTO retirement_tasks (
        workflow_id, task_type, task_name, description, status,
        sequence, is_required, created_at, updated_at
      ) VALUES ($1, $2, $3, $4, 'PENDING', $5, TRUE, $6, $6)
      RETURNING *`,
      [
        workflowId,
        'DATA_SANITIZATION',
        'Data Sanitization',
        'Perform secure data wipe and verify all data has been removed from the asset',
        sequence++,
        timestamp,
      ]
    );
    if (result) {
      tasks.push(mapRowToRetirementTask(result));
    }
  }

  // Backup verification task
  const backupResult = await queryOne<RetirementTaskRow>(
    `INSERT INTO retirement_tasks (
      workflow_id, task_type, task_name, description, status,
      sequence, is_required, created_at, updated_at
    ) VALUES ($1, $2, $3, $4, 'PENDING', $5, FALSE, $6, $6)
    RETURNING *`,
    [
      workflowId,
      'BACKUP_VERIFICATION',
      'Verify Backups',
      'Verify all important data has been backed up before disposal',
      sequence++,
      timestamp,
    ]
  );
  if (backupResult) {
    tasks.push(mapRowToRetirementTask(backupResult));
  }

  // License recovery task
  const licenseResult = await queryOne<RetirementTaskRow>(
    `INSERT INTO retirement_tasks (
      workflow_id, task_type, task_name, description, status,
      sequence, is_required, created_at, updated_at
    ) VALUES ($1, $2, $3, $4, 'PENDING', $5, FALSE, $6, $6)
    RETURNING *`,
    [
      workflowId,
      'LICENSE_RECOVERY',
      'Recover Software Licenses',
      'Uninstall licensed software and return licenses to the available pool',
      sequence++,
      timestamp,
    ]
  );
  if (licenseResult) {
    tasks.push(mapRowToRetirementTask(licenseResult));
  }

  // Asset decommission task
  const decommissionResult = await queryOne<RetirementTaskRow>(
    `INSERT INTO retirement_tasks (
      workflow_id, task_type, task_name, description, status,
      sequence, is_required, created_at, updated_at
    ) VALUES ($1, $2, $3, $4, 'PENDING', $5, TRUE, $6, $6)
    RETURNING *`,
    [
      workflowId,
      'ASSET_DECOMMISSION',
      'Decommission Asset',
      'Remove asset from active inventory and update CMDB relationships',
      sequence++,
      timestamp,
    ]
  );
  if (decommissionResult) {
    tasks.push(mapRowToRetirementTask(decommissionResult));
  }

  // Vendor pickup task
  const pickupResult = await queryOne<RetirementTaskRow>(
    `INSERT INTO retirement_tasks (
      workflow_id, task_type, task_name, description, status,
      sequence, is_required, created_at, updated_at
    ) VALUES ($1, $2, $3, $4, 'PENDING', $5, TRUE, $6, $6)
    RETURNING *`,
    [
      workflowId,
      'VENDOR_PICKUP',
      'Schedule Vendor Pickup',
      'Schedule pickup with disposal vendor and confirm pickup date',
      sequence++,
      timestamp,
    ]
  );
  if (pickupResult) {
    tasks.push(mapRowToRetirementTask(pickupResult));
  }

  // Destruction verification task
  const verificationResult = await queryOne<RetirementTaskRow>(
    `INSERT INTO retirement_tasks (
      workflow_id, task_type, task_name, description, status,
      sequence, is_required, created_at, updated_at
    ) VALUES ($1, $2, $3, $4, 'PENDING', $5, TRUE, $6, $6)
    RETURNING *`,
    [
      workflowId,
      'DESTRUCTION_VERIFICATION',
      'Verify Destruction',
      'Verify asset has been properly destroyed and obtain destruction certificate',
      sequence++,
      timestamp,
    ]
  );
  if (verificationResult) {
    tasks.push(mapRowToRetirementTask(verificationResult));
  }

  // Certificate generation task
  const certResult = await queryOne<RetirementTaskRow>(
    `INSERT INTO retirement_tasks (
      workflow_id, task_type, task_name, description, status,
      sequence, is_required, created_at, updated_at
    ) VALUES ($1, $2, $3, $4, 'PENDING', $5, TRUE, $6, $6)
    RETURNING *`,
    [
      workflowId,
      'CERTIFICATE_GENERATION',
      'Generate Destruction Certificate',
      'Generate and store destruction certificate for compliance records',
      sequence++,
      timestamp,
    ]
  );
  if (certResult) {
    tasks.push(mapRowToRetirementTask(certResult));
  }

  logger.info('Retirement tasks created', {
    workflowId,
    taskCount: tasks.length,
  });

  return tasks;
}

/**
 * Get tasks for a workflow
 */
export async function getTasksByWorkflowId(workflowId: UUID): Promise<RetirementTask[]> {
  const rows = await queryMany<RetirementTaskRow>(
    'SELECT * FROM retirement_tasks WHERE workflow_id = $1 ORDER BY sequence ASC',
    [workflowId]
  );
  return rows.map(mapRowToRetirementTask);
}

/**
 * Get task by ID
 */
export async function getTaskById(taskId: UUID): Promise<RetirementTask | null> {
  const result = await queryOne<RetirementTaskRow>(
    'SELECT * FROM retirement_tasks WHERE task_id = $1',
    [taskId]
  );
  return result ? mapRowToRetirementTask(result) : null;
}

/**
 * Update a retirement task
 */
export async function updateTask(
  taskId: UUID,
  request: UpdateTaskRequest
): Promise<RetirementTask | null> {
  const timestamp = now();

  const result = await queryOne<RetirementTaskRow>(
    `UPDATE retirement_tasks SET
      status = $1,
      completed_at = CASE WHEN $1 = 'COMPLETED' THEN $2 ELSE completed_at END,
      completed_by = CASE WHEN $1 = 'COMPLETED' THEN $3 ELSE completed_by END,
      completion_notes = COALESCE($4, completion_notes),
      updated_at = $2
     WHERE task_id = $5
     RETURNING *`,
    [
      request.status,
      timestamp,
      request.completedBy ?? null,
      request.completionNotes ?? null,
      taskId,
    ]
  );

  if (result) {
    logger.info('Retirement task updated', {
      taskId,
      status: request.status,
    });
  }

  return result ? mapRowToRetirementTask(result) : null;
}

/**
 * Update workflow status
 */
export async function updateWorkflowStatus(
  workflowId: UUID,
  status: RetirementStatus,
  additionalFields?: Partial<{
    approvedBy: UUID;
    approvedAt: string;
    dataWipeCompletedAt: string;
    dataWipeVerifiedBy: UUID;
    disposalCompletedAt: string;
    disposalCompletedBy: UUID;
    destructionCertificateId: UUID;
    disposalMethod: DisposalMethod;
  }>
): Promise<RetirementWorkflow | null> {
  const timestamp = now();

  const result = await queryOne<RetirementWorkflowRow>(
    `UPDATE retirement_workflows SET
      status = $1,
      approved_by = COALESCE($2, approved_by),
      approved_at = COALESCE($3, approved_at),
      data_wipe_completed_at = COALESCE($4, data_wipe_completed_at),
      data_wipe_verified_by = COALESCE($5, data_wipe_verified_by),
      disposal_completed_at = COALESCE($6, disposal_completed_at),
      disposal_completed_by = COALESCE($7, disposal_completed_by),
      destruction_certificate_id = COALESCE($8, destruction_certificate_id),
      disposal_method = COALESCE($9, disposal_method),
      updated_at = $10
     WHERE workflow_id = $11
     RETURNING *`,
    [
      status,
      additionalFields?.approvedBy ?? null,
      additionalFields?.approvedAt ?? null,
      additionalFields?.dataWipeCompletedAt ?? null,
      additionalFields?.dataWipeVerifiedBy ?? null,
      additionalFields?.disposalCompletedAt ?? null,
      additionalFields?.disposalCompletedBy ?? null,
      additionalFields?.destructionCertificateId ?? null,
      additionalFields?.disposalMethod ?? null,
      timestamp,
      workflowId,
    ]
  );

  if (result) {
    logger.info('Retirement workflow status updated', {
      workflowId,
      status,
    });
  }

  return result ? mapRowToRetirementWorkflow(result) : null;
}

/**
 * Create a destruction certificate
 * Requirement 6.9: Attach destruction certificates and update asset status to Disposed
 */
export async function createDestructionCertificate(
  workflowId: UUID,
  assetId: UUID,
  request: CompleteDisposalRequest,
  createdBy: UUID
): Promise<DestructionCertificate> {
  return withTransaction(async (ctx) => {
    const timestamp = now();
    const certificateNumber = generateCertificateNumber();

    const result = await ctx.queryOne<DestructionCertificateRow>(
      `INSERT INTO destruction_certificates (
        certificate_number, asset_id, workflow_id, vendor_id, vendor_name,
        destruction_date, destruction_method, serial_number, asset_tag,
        document_url, verified_by, verified_at, notes, created_at, created_by
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $12, $14)
      RETURNING *`,
      [
        certificateNumber,
        assetId,
        workflowId,
        request.vendorId ?? null,
        request.vendorName ?? null,
        request.destructionDate,
        request.destructionMethod,
        request.serialNumber ?? null,
        request.assetTag ?? null,
        request.documentUrl ?? null,
        request.verifiedBy,
        timestamp,
        request.notes ?? null,
        createdBy,
      ]
    );

    if (!result) {
      throw new Error('Failed to create destruction certificate');
    }

    // Update asset status to DISPOSED
    await ctx.queryOne(
      `UPDATE assets SET 
        status = 'DISPOSED',
        updated_at = $1
       WHERE asset_id = $2`,
      [timestamp, assetId]
    );

    // Update hardware_assets with disposal info
    await ctx.queryOne(
      `UPDATE hardware_assets SET
        disposal_date = $1,
        disposal_method = $2,
        destruction_certificate_id = $3
       WHERE asset_id = $4`,
      [request.destructionDate, request.destructionMethod, result.certificate_id, assetId]
    );

    // Create audit log entry
    await ctx.queryOne(
      `INSERT INTO audit_log (
        user_id, action_type, resource_type, resource_id, new_values
      ) VALUES ($1, 'STATUS_CHANGE', 'ASSET', $2, $3::jsonb)`,
      [
        createdBy,
        assetId,
        JSON.stringify({
          previousStatus: 'RETIRED',
          newStatus: 'DISPOSED',
          certificateId: result.certificate_id,
          certificateNumber,
          destructionMethod: request.destructionMethod,
          destructionDate: request.destructionDate,
        }),
      ]
    );

    logger.info('Destruction certificate created', {
      certificateId: result.certificate_id,
      certificateNumber,
      assetId,
      workflowId,
    });

    return mapRowToDestructionCertificate(result);
  });
}

/**
 * Get destruction certificate by ID
 */
export async function getCertificateById(certificateId: UUID): Promise<DestructionCertificate | null> {
  const result = await queryOne<DestructionCertificateRow>(
    'SELECT * FROM destruction_certificates WHERE certificate_id = $1',
    [certificateId]
  );
  return result ? mapRowToDestructionCertificate(result) : null;
}

/**
 * Get destruction certificate by asset ID
 */
export async function getCertificateByAssetId(assetId: UUID): Promise<DestructionCertificate | null> {
  const result = await queryOne<DestructionCertificateRow>(
    'SELECT * FROM destruction_certificates WHERE asset_id = $1 ORDER BY created_at DESC LIMIT 1',
    [assetId]
  );
  return result ? mapRowToDestructionCertificate(result) : null;
}

/**
 * Get all retirement workflows with pagination
 */
export async function getWorkflows(
  pagination: PaginationParams = {},
  filters?: {
    status?: RetirementStatus;
    assetId?: UUID;
  }
): Promise<PaginatedResult<RetirementWorkflow>> {
  const { page = 1, limit = 50 } = pagination;
  const offset = (page - 1) * limit;

  let whereClause = 'WHERE 1=1';
  const params: (string | number)[] = [];
  let paramIndex = 1;

  if (filters?.status) {
    whereClause += ` AND status = $${paramIndex++}`;
    params.push(filters.status);
  }

  if (filters?.assetId) {
    whereClause += ` AND asset_id = $${paramIndex++}`;
    params.push(filters.assetId);
  }

  const countResult = await queryOne<{ count: string }>(
    `SELECT COUNT(*) as count FROM retirement_workflows ${whereClause}`,
    params
  );
  const total = parseInt(countResult?.count ?? '0', 10);

  const rows = await queryMany<RetirementWorkflowRow>(
    `SELECT * FROM retirement_workflows ${whereClause}
     ORDER BY initiated_at DESC
     LIMIT $${paramIndex++} OFFSET $${paramIndex}`,
    [...params, limit, offset]
  );

  return {
    items: rows.map(mapRowToRetirementWorkflow),
    total,
    page,
    limit,
    hasMore: offset + rows.length < total,
  };
}

/**
 * Check if all required tasks are complete
 */
export async function areAllRequiredTasksComplete(workflowId: UUID): Promise<boolean> {
  const result = await queryOne<{ incomplete_count: string }>(
    `SELECT COUNT(*) as incomplete_count FROM retirement_tasks 
     WHERE workflow_id = $1 AND is_required = TRUE AND status != 'COMPLETED'`,
    [workflowId]
  );
  return parseInt(result?.incomplete_count ?? '0', 10) === 0;
}

/**
 * Get pending tasks count for a workflow
 */
export async function getPendingTasksCount(workflowId: UUID): Promise<number> {
  const result = await queryOne<{ count: string }>(
    `SELECT COUNT(*) as count FROM retirement_tasks 
     WHERE workflow_id = $1 AND status IN ('PENDING', 'IN_PROGRESS')`,
    [workflowId]
  );
  return parseInt(result?.count ?? '0', 10);
}
