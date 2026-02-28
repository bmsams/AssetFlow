/**
 * Disposal Service - Business logic layer for disposal workflow management
 *
 * Implements:
 * - Disposal workflow initiation and management (Requirement 3.6)
 * - Data sanitization verification (Requirement 3.6)
 * - Environmental compliance tracking (Requirement 3.6)
 * - Destruction certificate generation (Requirement 3.7)
 * - Disposal method and date recording (Requirement 3.7)
 */

import type { PaginatedResult, PaginationParams, UUID } from '@ams/types';
import * as cache from '@ams/cache';
import { publishEvent } from '@ams/events';
import { createLogger, now } from '@ams/utils';

import type {
  CreateDisposalWorkflowRequest,
  DestructionCertificate,
  DisposalTask,
  DisposalWorkflow,
  DisposalWorkflowStatus,
  RecordDestructionRequest,
  UpdateTaskRequest,
} from './disposal-repository';
import * as repository from './disposal-repository';

const logger = createLogger({ service: 'disposal-service' });

/**
 * Disposal workflow result with tasks
 */
export interface DisposalWorkflowResult {
  readonly workflow: DisposalWorkflow;
  readonly tasks: DisposalTask[];
  readonly certificate: DestructionCertificate | null;
}

/**
 * Initiate disposal result
 */
export interface InitiateDisposalResult {
  readonly workflow: DisposalWorkflow;
  readonly tasks: DisposalTask[];
}

/**
 * Record destruction result
 */
export interface RecordDestructionResult {
  readonly workflow: DisposalWorkflow;
  readonly certificate: DestructionCertificate;
  readonly assetUpdated: boolean;
}

/**
 * Validation result
 */
export interface ValidationResult {
  readonly isValid: boolean;
  readonly completedTasks: number;
  readonly totalRequiredTasks: number;
  readonly pendingTasks: DisposalTask[];
  readonly failedTasks: DisposalTask[];
}

/**
 * Cache key for workflow
 */
function workflowCacheKey(workflowId: UUID): string {
  return `disposal:workflow:${workflowId}`;
}

/**
 * Cache key for asset's active workflow
 */
function assetWorkflowCacheKey(assetId: UUID): string {
  return `disposal:asset:${assetId}:active`;
}

/**
 * Initiate a disposal workflow for an asset
 * Requirement 3.6: Enforce disposal workflows including data sanitization verification
 * Requirement 3.7: Create tasks for data sanitization and vendor pickup
 */
export async function initiateDisposal(
  request: CreateDisposalWorkflowRequest
): Promise<InitiateDisposalResult> {
  logger.info('Initiating disposal workflow', {
    assetId: request.assetId,
    initiatedBy: request.initiatedBy,
    disposalMethod: request.disposalMethod,
  });

  // Check if asset already has an active disposal workflow
  const existingWorkflow = await repository.hasActiveDisposalWorkflow(request.assetId);
  if (existingWorkflow) {
    throw new Error(`Asset ${request.assetId} already has an active disposal workflow`);
  }

  // Create the workflow
  const workflow = await repository.createWorkflow(request);

  // Create default tasks based on requirements
  const tasks = await repository.createDefaultTasks(
    workflow.workflowId,
    workflow.dataWipeRequired,
    workflow.environmentalCheckRequired
  );

  // Invalidate cache
  await cache.del(assetWorkflowCacheKey(request.assetId));

  // Publish workflow initiated event
  await publishEvent('DISPOSAL_WORKFLOW_INITIATED', {
    workflowId: workflow.workflowId,
    workflowNumber: workflow.workflowNumber,
    assetId: workflow.assetId,
    initiatedBy: workflow.initiatedBy,
    status: workflow.status,
    dataWipeRequired: workflow.dataWipeRequired,
    environmentalCheckRequired: workflow.environmentalCheckRequired,
    taskCount: tasks.length,
  });

  logger.info('Disposal workflow initiated', {
    workflowId: workflow.workflowId,
    workflowNumber: workflow.workflowNumber,
    taskCount: tasks.length,
  });

  return { workflow, tasks };
}

/**
 * Record destruction details and generate certificate
 * Requirement 3.7: Record disposal method, date, and destruction certificates
 */
export async function recordDestruction(
  workflowId: UUID,
  request: RecordDestructionRequest,
  recordedBy: UUID
): Promise<RecordDestructionResult> {
  logger.info('Recording destruction', {
    workflowId,
    destructionMethod: request.destructionMethod,
    destructionDate: request.destructionDate,
  });

  // Get the workflow
  const workflow = await repository.getWorkflowById(workflowId);
  if (!workflow) {
    throw new Error(`Disposal workflow not found: ${workflowId}`);
  }

  // Validate workflow is in a state that allows recording destruction
  const validStates: DisposalWorkflowStatus[] = [
    'INITIATED',
    'DATA_WIPE_PENDING',
    'DATA_WIPE_COMPLETE',
    'ENVIRONMENTAL_CHECK_PENDING',
    'ENVIRONMENTAL_CHECK_COMPLETE',
    'PICKUP_SCHEDULED',
  ];

  if (!validStates.includes(workflow.status)) {
    throw new Error(`Cannot record destruction for workflow in status: ${workflow.status}`);
  }

  // Create destruction certificate
  const certificate = await repository.createDestructionCertificate(
    workflowId,
    workflow.assetId,
    request,
    recordedBy
  );

  // Update workflow to completed
  const timestamp = now();
  const updatedWorkflow = await repository.updateWorkflowStatus(
    workflowId,
    'COMPLETED',
    {
      completedAt: timestamp,
      completedBy: recordedBy,
      destructionCertificateId: certificate.certificateId,
      disposalMethod: request.destructionMethod,
    }
  );

  if (!updatedWorkflow) {
    throw new Error(`Failed to update workflow status: ${workflowId}`);
  }

  // Mark all remaining tasks as completed
  const tasks = await repository.getTasksByWorkflowId(workflowId);
  for (const task of tasks) {
    if (task.status !== 'COMPLETED') {
      await repository.updateTask(task.taskId, {
        status: 'COMPLETED',
        completedBy: recordedBy,
        completionNotes: 'Auto-completed on destruction recording',
      });
    }
  }

  // Invalidate caches
  await cache.del(workflowCacheKey(workflowId));
  await cache.del(assetWorkflowCacheKey(workflow.assetId));

  // Publish destruction recorded event
  await publishEvent('DISPOSAL_DESTRUCTION_RECORDED', {
    workflowId: updatedWorkflow.workflowId,
    workflowNumber: updatedWorkflow.workflowNumber,
    assetId: updatedWorkflow.assetId,
    certificateId: certificate.certificateId,
    certificateNumber: certificate.certificateNumber,
    destructionMethod: request.destructionMethod,
    destructionDate: request.destructionDate,
    recordedBy,
  });

  logger.info('Destruction recorded', {
    workflowId: updatedWorkflow.workflowId,
    certificateId: certificate.certificateId,
    certificateNumber: certificate.certificateNumber,
  });

  return {
    workflow: updatedWorkflow,
    certificate,
    assetUpdated: true,
  };
}

/**
 * List all disposal workflows with optional status filter
 */
export async function listDisposals(
  pagination: PaginationParams = {},
  statusFilter?: DisposalWorkflowStatus
): Promise<PaginatedResult<DisposalWorkflow>> {
  return repository.getWorkflows(pagination, statusFilter ? { status: statusFilter } : undefined);
}

/**
 * Get disposal workflow with all details
 */
export async function getDisposalWorkflow(workflowId: UUID): Promise<DisposalWorkflowResult | null> {
  const workflow = await repository.getWorkflowById(workflowId);
  if (!workflow) {
    return null;
  }

  const tasks = await repository.getTasksByWorkflowId(workflowId);
  const certificate = workflow.destructionCertificateId
    ? await repository.getCertificateById(workflow.destructionCertificateId)
    : null;

  return { workflow, tasks, certificate };
}

/**
 * Get active disposal workflow for an asset
 */
export async function getActiveWorkflowForAsset(assetId: UUID): Promise<DisposalWorkflowResult | null> {
  const workflow = await repository.getActiveWorkflowForAsset(assetId);
  if (!workflow) {
    return null;
  }

  const tasks = await repository.getTasksByWorkflowId(workflow.workflowId);
  const certificate = workflow.destructionCertificateId
    ? await repository.getCertificateById(workflow.destructionCertificateId)
    : null;

  return { workflow, tasks, certificate };
}

/**
 * Validate disposal requirements are complete
 * Requirement 3.6: Enforce disposal workflows including data sanitization verification
 */
export async function validateDisposalRequirements(workflowId: UUID): Promise<ValidationResult> {
  logger.info('Validating disposal requirements', { workflowId });

  const workflow = await repository.getWorkflowById(workflowId);
  if (!workflow) {
    throw new Error(`Disposal workflow not found: ${workflowId}`);
  }

  const tasks = await repository.getTasksByWorkflowId(workflowId);
  
  const requiredTasks = tasks.filter(t => t.isRequired);
  const completedTasks = requiredTasks.filter(t => t.status === 'COMPLETED');
  const pendingTasks = tasks.filter(t => t.status === 'PENDING' || t.status === 'IN_PROGRESS');
  const failedTasks = tasks.filter(t => t.status === 'FAILED');

  const isValid = completedTasks.length === requiredTasks.length && failedTasks.length === 0;

  logger.info('Disposal requirements validated', {
    workflowId,
    isValid,
    completedTasks: completedTasks.length,
    totalRequiredTasks: requiredTasks.length,
    pendingTasks: pendingTasks.length,
    failedTasks: failedTasks.length,
  });

  return {
    isValid,
    completedTasks: completedTasks.length,
    totalRequiredTasks: requiredTasks.length,
    pendingTasks,
    failedTasks,
  };
}

/**
 * Complete data wipe verification
 * Requirement 3.6: Data sanitization verification
 */
export async function completeDataWipe(
  workflowId: UUID,
  verifiedBy: UUID,
  notes?: string
): Promise<DisposalWorkflow> {
  logger.info('Completing data wipe', { workflowId, verifiedBy });

  const workflow = await repository.getWorkflowById(workflowId);
  if (!workflow) {
    throw new Error(`Disposal workflow not found: ${workflowId}`);
  }

  if (workflow.status !== 'DATA_WIPE_PENDING') {
    throw new Error(`Cannot complete data wipe for workflow in status: ${workflow.status}`);
  }

  const timestamp = now();
  
  // Determine next status
  const nextStatus: DisposalWorkflowStatus = workflow.environmentalCheckRequired
    ? 'ENVIRONMENTAL_CHECK_PENDING'
    : 'DATA_WIPE_COMPLETE';

  const updatedWorkflow = await repository.updateWorkflowStatus(
    workflowId,
    nextStatus,
    {
      dataWipeCompletedAt: timestamp,
      dataWipeVerifiedBy: verifiedBy,
    }
  );

  if (!updatedWorkflow) {
    throw new Error(`Failed to update workflow: ${workflowId}`);
  }

  // Update the data sanitization task
  const tasks = await repository.getTasksByWorkflowId(workflowId);
  const dataWipeTask = tasks.find(t => t.taskType === 'DATA_SANITIZATION');
  if (dataWipeTask) {
    await repository.updateTask(dataWipeTask.taskId, {
      status: 'COMPLETED',
      completedBy: verifiedBy,
      completionNotes: notes,
    });
  }

  // Invalidate cache
  await cache.del(workflowCacheKey(workflowId));

  // Publish event
  await publishEvent('DISPOSAL_DATA_WIPE_COMPLETED', {
    workflowId: updatedWorkflow.workflowId,
    workflowNumber: updatedWorkflow.workflowNumber,
    assetId: updatedWorkflow.assetId,
    verifiedBy,
    completedAt: timestamp,
  });

  logger.info('Data wipe completed', {
    workflowId: updatedWorkflow.workflowId,
    nextStatus,
  });

  return updatedWorkflow;
}

/**
 * Complete environmental compliance check
 * Requirement 3.6: Environmental compliance verification
 */
export async function completeEnvironmentalCheck(
  workflowId: UUID,
  verifiedBy: UUID,
  notes?: string
): Promise<DisposalWorkflow> {
  logger.info('Completing environmental check', { workflowId, verifiedBy });

  const workflow = await repository.getWorkflowById(workflowId);
  if (!workflow) {
    throw new Error(`Disposal workflow not found: ${workflowId}`);
  }

  const validStates: DisposalWorkflowStatus[] = [
    'ENVIRONMENTAL_CHECK_PENDING',
    'DATA_WIPE_COMPLETE',
  ];

  if (!validStates.includes(workflow.status)) {
    throw new Error(`Cannot complete environmental check for workflow in status: ${workflow.status}`);
  }

  const timestamp = now();

  const updatedWorkflow = await repository.updateWorkflowStatus(
    workflowId,
    'ENVIRONMENTAL_CHECK_COMPLETE',
    {
      environmentalCheckCompletedAt: timestamp,
      environmentalCheckVerifiedBy: verifiedBy,
    }
  );

  if (!updatedWorkflow) {
    throw new Error(`Failed to update workflow: ${workflowId}`);
  }

  // Update the environmental compliance task
  const tasks = await repository.getTasksByWorkflowId(workflowId);
  const envTask = tasks.find(t => t.taskType === 'ENVIRONMENTAL_COMPLIANCE');
  if (envTask) {
    await repository.updateTask(envTask.taskId, {
      status: 'COMPLETED',
      completedBy: verifiedBy,
      completionNotes: notes,
    });
  }

  // Invalidate cache
  await cache.del(workflowCacheKey(workflowId));

  // Publish event
  await publishEvent('DISPOSAL_ENVIRONMENTAL_CHECK_COMPLETED', {
    workflowId: updatedWorkflow.workflowId,
    workflowNumber: updatedWorkflow.workflowNumber,
    assetId: updatedWorkflow.assetId,
    verifiedBy,
    completedAt: timestamp,
  });

  logger.info('Environmental check completed', {
    workflowId: updatedWorkflow.workflowId,
  });

  return updatedWorkflow;
}

/**
 * Schedule vendor pickup
 * Requirement 3.7: Create tasks for vendor pickup
 */
export async function schedulePickup(
  workflowId: UUID,
  pickupDate: string,
  vendorId: UUID,
  scheduledBy: UUID,
  notes?: string
): Promise<DisposalWorkflow> {
  logger.info('Scheduling pickup', { workflowId, pickupDate, vendorId });

  const workflow = await repository.getWorkflowById(workflowId);
  if (!workflow) {
    throw new Error(`Disposal workflow not found: ${workflowId}`);
  }

  const validStates: DisposalWorkflowStatus[] = [
    'DATA_WIPE_COMPLETE',
    'ENVIRONMENTAL_CHECK_COMPLETE',
    'INITIATED',
  ];

  if (!validStates.includes(workflow.status)) {
    throw new Error(`Cannot schedule pickup for workflow in status: ${workflow.status}`);
  }

  const updatedWorkflow = await repository.updateWorkflowStatus(
    workflowId,
    'PICKUP_SCHEDULED',
    {
      pickupScheduledAt: pickupDate,
      pickupVendorId: vendorId,
    }
  );

  if (!updatedWorkflow) {
    throw new Error(`Failed to update workflow: ${workflowId}`);
  }

  // Update the vendor pickup task
  const tasks = await repository.getTasksByWorkflowId(workflowId);
  const pickupTask = tasks.find(t => t.taskType === 'VENDOR_PICKUP');
  if (pickupTask) {
    await repository.updateTask(pickupTask.taskId, {
      status: 'COMPLETED',
      completedBy: scheduledBy,
      completionNotes: notes ?? `Pickup scheduled for ${pickupDate}`,
    });
  }

  // Invalidate cache
  await cache.del(workflowCacheKey(workflowId));

  // Publish event
  await publishEvent('DISPOSAL_PICKUP_SCHEDULED', {
    workflowId: updatedWorkflow.workflowId,
    workflowNumber: updatedWorkflow.workflowNumber,
    assetId: updatedWorkflow.assetId,
    pickupDate,
    vendorId,
    scheduledBy,
  });

  logger.info('Pickup scheduled', {
    workflowId: updatedWorkflow.workflowId,
    pickupDate,
  });

  return updatedWorkflow;
}

/**
 * Update a disposal task
 */
export async function updateTask(
  taskId: UUID,
  request: UpdateTaskRequest
): Promise<DisposalTask> {
  logger.info('Updating disposal task', { taskId, status: request.status });

  const task = await repository.getTaskById(taskId);
  if (!task) {
    throw new Error(`Disposal task not found: ${taskId}`);
  }

  const updatedTask = await repository.updateTask(taskId, request);
  if (!updatedTask) {
    throw new Error(`Failed to update task: ${taskId}`);
  }

  // Invalidate workflow cache
  await cache.del(workflowCacheKey(task.workflowId));

  // Publish event
  await publishEvent('DISPOSAL_TASK_UPDATED', {
    taskId: updatedTask.taskId,
    workflowId: updatedTask.workflowId,
    taskType: updatedTask.taskType,
    status: updatedTask.status,
    completedBy: request.completedBy,
  });

  logger.info('Disposal task updated', {
    taskId: updatedTask.taskId,
    status: updatedTask.status,
  });

  return updatedTask;
}

/**
 * Cancel a disposal workflow
 */
export async function cancelWorkflow(
  workflowId: UUID,
  cancelledBy: UUID,
  reason?: string
): Promise<DisposalWorkflow> {
  logger.info('Cancelling disposal workflow', { workflowId, cancelledBy });

  const workflow = await repository.getWorkflowById(workflowId);
  if (!workflow) {
    throw new Error(`Disposal workflow not found: ${workflowId}`);
  }

  if (workflow.status === 'COMPLETED' || workflow.status === 'CANCELLED') {
    throw new Error(`Cannot cancel workflow in status: ${workflow.status}`);
  }

  const updatedWorkflow = await repository.updateWorkflowStatus(
    workflowId,
    'CANCELLED',
    {
      completedAt: now(),
      completedBy: cancelledBy,
    }
  );

  if (!updatedWorkflow) {
    throw new Error(`Failed to cancel workflow: ${workflowId}`);
  }

  // Invalidate caches
  await cache.del(workflowCacheKey(workflowId));
  await cache.del(assetWorkflowCacheKey(workflow.assetId));

  // Publish event
  await publishEvent('DISPOSAL_WORKFLOW_CANCELLED', {
    workflowId: updatedWorkflow.workflowId,
    workflowNumber: updatedWorkflow.workflowNumber,
    assetId: updatedWorkflow.assetId,
    cancelledBy,
    reason,
  });

  logger.info('Disposal workflow cancelled', {
    workflowId: updatedWorkflow.workflowId,
  });

  return updatedWorkflow;
}

/**
 * Get workflow by ID
 */
export async function getWorkflow(workflowId: UUID): Promise<DisposalWorkflow | null> {
  return repository.getWorkflowById(workflowId);
}

/**
 * Get workflow by number
 */
export async function getWorkflowByNumber(workflowNumber: string): Promise<DisposalWorkflow | null> {
  return repository.getWorkflowByNumber(workflowNumber);
}

/**
 * Get destruction certificate by ID
 */
export async function getCertificate(certificateId: UUID): Promise<DestructionCertificate | null> {
  return repository.getCertificateById(certificateId);
}

/**
 * Get destruction certificate by asset ID
 */
export async function getCertificateByAssetId(assetId: UUID): Promise<DestructionCertificate | null> {
  return repository.getCertificateByAssetId(assetId);
}

/**
 * Check if asset has active disposal workflow
 */
export async function hasActiveWorkflow(assetId: UUID): Promise<boolean> {
  return repository.hasActiveDisposalWorkflow(assetId);
}

// Re-export types
export type {
  CreateDisposalWorkflowRequest,
  DestructionCertificate,
  DisposalMethod,
  DisposalTask,
  DisposalTaskStatus,
  DisposalTaskType,
  DisposalWorkflow,
  DisposalWorkflowStatus,
  RecordDestructionRequest,
  UpdateTaskRequest,
} from './disposal-repository';

