/**
 * Disposal Repository - Data access layer for disposal workflow operations
 *
 * Implements database operations for:
 * - Disposal workflow tracking (Requirement 3.6)
 * - Destruction certificate management (Requirement 3.7)
 * - Disposal task tracking
 */

import type { PaginatedResult, PaginationParams, UUID } from '@ams/types';
import { queryMany, queryOne } from '@ams/database';
import { createLogger, now } from '@ams/utils';

const logger = createLogger({ service: 'disposal-repository' });

/**
 * Disposal workflow status
 */
export type DisposalWorkflowStatus =
  | 'INITIATED'
  | 'DATA_WIPE_PENDING'
  | 'DATA_WIPE_COMPLETE'
  | 'ENVIRONMENTAL_CHECK_PENDING'
  | 'ENVIRONMENTAL_CHECK_COMPLETE'
  | 'PICKUP_SCHEDULED'
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
 * Disposal task types
 */
export type DisposalTaskType =
  | 'DATA_SANITIZATION'
  | 'ENVIRONMENTAL_COMPLIANCE'
  | 'VENDOR_PICKUP'
  | 'DESTRUCTION_VERIFICATION'
  | 'CERTIFICATE_GENERATION'
  | 'ASSET_DECOMMISSION';

/**
 * Disposal task status
 */
export type DisposalTaskStatus =
  | 'PENDING'
  | 'IN_PROGRESS'
  | 'COMPLETED'
  | 'SKIPPED'
  | 'FAILED';

/**
 * Disposal workflow entity
 */
export interface DisposalWorkflow {
  readonly workflowId: UUID;
  readonly workflowNumber: string;
  readonly assetId: UUID;
  readonly status: DisposalWorkflowStatus;
  readonly disposalMethod: DisposalMethod | null;
  readonly initiatedBy: UUID;
  readonly initiatedAt: string;
  readonly dataWipeRequired: boolean;
  readonly dataWipeCompletedAt: string | null;
  readonly dataWipeVerifiedBy: UUID | null;
  readonly environmentalCheckRequired: boolean;
  readonly environmentalCheckCompletedAt: string | null;
  readonly environmentalCheckVerifiedBy: UUID | null;
  readonly pickupScheduledAt: string | null;
  readonly pickupVendorId: UUID | null;
  readonly completedAt: string | null;
  readonly completedBy: UUID | null;
  readonly destructionCertificateId: UUID | null;
  readonly notes: string | null;
  readonly createdAt: string;
  readonly updatedAt: string;
}

/**
 * Disposal task entity
 */
export interface DisposalTask {
  readonly taskId: UUID;
  readonly workflowId: UUID;
  readonly taskType: DisposalTaskType;
  readonly taskName: string;
  readonly description: string | null;
  readonly status: DisposalTaskStatus;
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
 * Create disposal workflow request
 */
export interface CreateDisposalWorkflowRequest {
  readonly assetId: UUID;
  readonly initiatedBy: UUID;
  readonly disposalMethod?: DisposalMethod;
  readonly dataWipeRequired?: boolean;
  readonly environmentalCheckRequired?: boolean;
  readonly notes?: string;
}

/**
 * Record destruction request
 */
export interface RecordDestructionRequest {
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
  readonly status: DisposalTaskStatus;
  readonly completedBy?: UUID;
  readonly completionNotes?: string;
}

/**
 * Database row types
 */
interface DisposalWorkflowRow {
  workflow_id: string;
  workflow_number: string;
  asset_id: string;
  status: DisposalWorkflowStatus;
  disposal_method: DisposalMethod | null;
  initiated_by: string;
  initiated_at: string;
  data_wipe_required: boolean;
  data_wipe_completed_at: string | null;
  data_wipe_verified_by: string | null;
  environmental_check_required: boolean;
  environmental_check_completed_at: string | null;
  environmental_check_verified_by: string | null;
  pickup_scheduled_at: string | null;
  pickup_vendor_id: string | null;
  completed_at: string | null;
  completed_by: string | null;
  destruction_certificate_id: string | null;
  notes: string | null;
  created_at: string;
  updated_at: string;
}

interface DisposalTaskRow {
  task_id: string;
  workflow_id: string;
  task_type: DisposalTaskType;
  task_name: string;
  description: string | null;
  status: DisposalTaskStatus;
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

/**
 * Map database row to DisposalWorkflow entity
 */
function mapRowToDisposalWorkflow(row: DisposalWorkflowRow): DisposalWorkflow {
  return {
    workflowId: row.workflow_id,
    workflowNumber: row.workflow_number,
    assetId: row.asset_id,
    status: row.status,
    disposalMethod: row.disposal_method,
    initiatedBy: row.initiated_by,
    initiatedAt: row.initiated_at,
    dataWipeRequired: row.data_wipe_required,
    dataWipeCompletedAt: row.data_wipe_completed_at,
    dataWipeVerifiedBy: row.data_wipe_verified_by,
    environmentalCheckRequired: row.environmental_check_required,
    environmentalCheckCompletedAt: row.environmental_check_completed_at,
    environmentalCheckVerifiedBy: row.environmental_check_verified_by,
    pickupScheduledAt: row.pickup_scheduled_at,
    pickupVendorId: row.pickup_vendor_id,
    completedAt: row.completed_at,
    completedBy: row.completed_by,
    destructionCertificateId: row.destruction_certificate_id,
    notes: row.notes,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

/**
 * Map database row to DisposalTask entity
 */
function mapRowToDisposalTask(row: DisposalTaskRow): DisposalTask {
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
  return `DSP-${timestamp}-${random}`;
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
 * Get disposal workflow by ID
 */
export async function getWorkflowById(workflowId: UUID): Promise<DisposalWorkflow | null> {
  const result = await queryOne<DisposalWorkflowRow>(
    'SELECT * FROM disposal_workflows WHERE workflow_id = $1',
    [workflowId]
  );

  return result ? mapRowToDisposalWorkflow(result) : null;
}

/**
 * Get disposal workflow by workflow number
 */
export async function getWorkflowByNumber(workflowNumber: string): Promise<DisposalWorkflow | null> {
  const result = await queryOne<DisposalWorkflowRow>(
    'SELECT * FROM disposal_workflows WHERE workflow_number = $1',
    [workflowNumber]
  );

  return result ? mapRowToDisposalWorkflow(result) : null;
}

/**
 * Get active disposal workflow for an asset
 */
export async function getActiveWorkflowForAsset(assetId: UUID): Promise<DisposalWorkflow | null> {
  const result = await queryOne<DisposalWorkflowRow>(
    `SELECT * FROM disposal_workflows 
     WHERE asset_id = $1 AND status NOT IN ('COMPLETED', 'CANCELLED')
     ORDER BY initiated_at DESC
     LIMIT 1`,
    [assetId]
  );

  return result ? mapRowToDisposalWorkflow(result) : null;
}

/**
 * Check if asset has an active disposal workflow
 */
export async function hasActiveDisposalWorkflow(assetId: UUID): Promise<boolean> {
  const result = await queryOne<{ count: string }>(
    `SELECT COUNT(*) as count FROM disposal_workflows 
     WHERE asset_id = $1 AND status NOT IN ('COMPLETED', 'CANCELLED')`,
    [assetId]
  );

  return parseInt(result?.count ?? '0', 10) > 0;
}

/**
 * Create a new disposal workflow
 * Requirement 3.6: Enforce disposal workflows
 */
export async function createWorkflow(
  request: CreateDisposalWorkflowRequest
): Promise<DisposalWorkflow> {
  const timestamp = now();
  const workflowNumber = generateWorkflowNumber();

  // Determine initial status based on requirements
  const dataWipeRequired = request.dataWipeRequired ?? true;
  const environmentalCheckRequired = request.environmentalCheckRequired ?? true;
  
  let initialStatus: DisposalWorkflowStatus = 'INITIATED';
  if (dataWipeRequired) {
    initialStatus = 'DATA_WIPE_PENDING';
  } else if (environmentalCheckRequired) {
    initialStatus = 'ENVIRONMENTAL_CHECK_PENDING';
  }

  const result = await queryOne<DisposalWorkflowRow>(
    `INSERT INTO disposal_workflows (
      workflow_number, asset_id, status, disposal_method,
      initiated_by, initiated_at, data_wipe_required,
      environmental_check_required, notes, created_at, updated_at
    ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $6, $6)
    RETURNING *`,
    [
      workflowNumber,
      request.assetId,
      initialStatus,
      request.disposalMethod ?? null,
      request.initiatedBy,
      timestamp,
      dataWipeRequired,
      environmentalCheckRequired,
      request.notes ?? null,
    ]
  );

  if (!result) {
    throw new Error('Failed to create disposal workflow');
  }

  logger.info('Disposal workflow created', {
    workflowId: result.workflow_id,
    workflowNumber,
    assetId: request.assetId,
    status: initialStatus,
  });

  return mapRowToDisposalWorkflow(result);
}

/**
 * Create default disposal tasks for a workflow
 * Requirement 3.6: Create tasks for data sanitization and vendor pickup
 */
export async function createDefaultTasks(
  workflowId: UUID,
  dataWipeRequired: boolean,
  environmentalCheckRequired: boolean
): Promise<DisposalTask[]> {
  const timestamp = now();
  const tasks: DisposalTask[] = [];
  let sequence = 1;

  // Data sanitization task
  if (dataWipeRequired) {
    const result = await queryOne<DisposalTaskRow>(
      `INSERT INTO disposal_tasks (
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
      tasks.push(mapRowToDisposalTask(result));
    }
  }

  // Environmental compliance task
  if (environmentalCheckRequired) {
    const result = await queryOne<DisposalTaskRow>(
      `INSERT INTO disposal_tasks (
        workflow_id, task_type, task_name, description, status,
        sequence, is_required, created_at, updated_at
      ) VALUES ($1, $2, $3, $4, 'PENDING', $5, TRUE, $6, $6)
      RETURNING *`,
      [
        workflowId,
        'ENVIRONMENTAL_COMPLIANCE',
        'Environmental Compliance Check',
        'Verify disposal method meets environmental regulations and compliance requirements',
        sequence++,
        timestamp,
      ]
    );
    if (result) {
      tasks.push(mapRowToDisposalTask(result));
    }
  }

  // Vendor pickup task
  const pickupResult = await queryOne<DisposalTaskRow>(
    `INSERT INTO disposal_tasks (
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
    tasks.push(mapRowToDisposalTask(pickupResult));
  }

  // Destruction verification task
  const verificationResult = await queryOne<DisposalTaskRow>(
    `INSERT INTO disposal_tasks (
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
    tasks.push(mapRowToDisposalTask(verificationResult));
  }

  // Certificate generation task
  const certResult = await queryOne<DisposalTaskRow>(
    `INSERT INTO disposal_tasks (
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
    tasks.push(mapRowToDisposalTask(certResult));
  }

  logger.info('Disposal tasks created', {
    workflowId,
    taskCount: tasks.length,
  });

  return tasks;
}

/**
 * Get tasks for a workflow
 */
export async function getTasksByWorkflowId(workflowId: UUID): Promise<DisposalTask[]> {
  const rows = await queryMany<DisposalTaskRow>(
    'SELECT * FROM disposal_tasks WHERE workflow_id = $1 ORDER BY sequence ASC',
    [workflowId]
  );

  return rows.map(mapRowToDisposalTask);
}

/**
 * Get task by ID
 */
export async function getTaskById(taskId: UUID): Promise<DisposalTask | null> {
  const result = await queryOne<DisposalTaskRow>(
    'SELECT * FROM disposal_tasks WHERE task_id = $1',
    [taskId]
  );

  return result ? mapRowToDisposalTask(result) : null;
}

/**
 * Update a disposal task
 */
export async function updateTask(
  taskId: UUID,
  request: UpdateTaskRequest
): Promise<DisposalTask | null> {
  const timestamp = now();

  const result = await queryOne<DisposalTaskRow>(
    `UPDATE disposal_tasks SET
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
    logger.info('Disposal task updated', {
      taskId,
      status: request.status,
    });
  }

  return result ? mapRowToDisposalTask(result) : null;
}

/**
 * Update workflow status
 */
export async function updateWorkflowStatus(
  workflowId: UUID,
  status: DisposalWorkflowStatus,
  additionalFields?: Partial<{
    dataWipeCompletedAt: string;
    dataWipeVerifiedBy: UUID;
    environmentalCheckCompletedAt: string;
    environmentalCheckVerifiedBy: UUID;
    pickupScheduledAt: string;
    pickupVendorId: UUID;
    completedAt: string;
    completedBy: UUID;
    destructionCertificateId: UUID;
    disposalMethod: DisposalMethod;
  }>
): Promise<DisposalWorkflow | null> {
  const timestamp = now();

  const result = await queryOne<DisposalWorkflowRow>(
    `UPDATE disposal_workflows SET
      status = $1,
      data_wipe_completed_at = COALESCE($2, data_wipe_completed_at),
      data_wipe_verified_by = COALESCE($3, data_wipe_verified_by),
      environmental_check_completed_at = COALESCE($4, environmental_check_completed_at),
      environmental_check_verified_by = COALESCE($5, environmental_check_verified_by),
      pickup_scheduled_at = COALESCE($6, pickup_scheduled_at),
      pickup_vendor_id = COALESCE($7, pickup_vendor_id),
      completed_at = COALESCE($8, completed_at),
      completed_by = COALESCE($9, completed_by),
      destruction_certificate_id = COALESCE($10, destruction_certificate_id),
      disposal_method = COALESCE($11, disposal_method),
      updated_at = $12
     WHERE workflow_id = $13
     RETURNING *`,
    [
      status,
      additionalFields?.dataWipeCompletedAt ?? null,
      additionalFields?.dataWipeVerifiedBy ?? null,
      additionalFields?.environmentalCheckCompletedAt ?? null,
      additionalFields?.environmentalCheckVerifiedBy ?? null,
      additionalFields?.pickupScheduledAt ?? null,
      additionalFields?.pickupVendorId ?? null,
      additionalFields?.completedAt ?? null,
      additionalFields?.completedBy ?? null,
      additionalFields?.destructionCertificateId ?? null,
      additionalFields?.disposalMethod ?? null,
      timestamp,
      workflowId,
    ]
  );

  if (result) {
    logger.info('Disposal workflow status updated', {
      workflowId,
      status,
    });
  }

  return result ? mapRowToDisposalWorkflow(result) : null;
}

/**
 * Create a destruction certificate
 * Requirement 3.7: Record destruction certificates
 */
export async function createDestructionCertificate(
  workflowId: UUID,
  assetId: UUID,
  request: RecordDestructionRequest,
  createdBy: UUID
): Promise<DestructionCertificate> {
  const timestamp = now();
  const certificateNumber = generateCertificateNumber();

  const result = await queryOne<DestructionCertificateRow>(
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

  logger.info('Destruction certificate created', {
    certificateId: result.certificate_id,
    certificateNumber,
    assetId,
    workflowId,
  });

  return mapRowToDestructionCertificate(result);
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
 * Get all disposal workflows with pagination
 */
export async function getWorkflows(
  pagination: PaginationParams = {},
  filters?: {
    status?: DisposalWorkflowStatus;
    assetId?: UUID;
  }
): Promise<PaginatedResult<DisposalWorkflow>> {
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
    `SELECT COUNT(*) as count FROM disposal_workflows ${whereClause}`,
    params
  );
  const total = parseInt(countResult?.count ?? '0', 10);

  const rows = await queryMany<DisposalWorkflowRow>(
    `SELECT * FROM disposal_workflows ${whereClause}
     ORDER BY initiated_at DESC
     LIMIT $${paramIndex++} OFFSET $${paramIndex}`,
    [...params, limit, offset]
  );

  return {
    items: rows.map(mapRowToDisposalWorkflow),
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
    `SELECT COUNT(*) as incomplete_count FROM disposal_tasks 
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
    `SELECT COUNT(*) as count FROM disposal_tasks 
     WHERE workflow_id = $1 AND status IN ('PENDING', 'IN_PROGRESS')`,
    [workflowId]
  );

  return parseInt(result?.count ?? '0', 10);
}

