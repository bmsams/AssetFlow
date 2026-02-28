/**
 * Retirement Service - Business logic layer for retirement operations
 *
 * Implements:
 * - Initiating retirement workflows (Requirement 6.8)
 * - Creating disposal workflows with required tasks (Requirement 6.8)
 * - Completing disposal with destruction certificates (Requirement 6.9)
 * - Updating asset status to Disposed (Requirement 6.9)
 */

import type { UUID } from '@ams/types';
import * as cache from '@ams/cache';
import { publishEvent } from '@ams/events';
import { createLogger, now } from '@ams/utils';

import type {
  CompleteDisposalRequest,
  CreateRetirementWorkflowRequest,
  DestructionCertificate,
  RetirementStatus,
  RetirementTask,
  RetirementWorkflow,
  UpdateTaskRequest,
} from './retirement-repository';
import * as repository from './retirement-repository';

const logger = createLogger({ service: 'retirement-service' });

/**
 * Retirement workflow result with tasks
 */
export interface RetirementWorkflowResult {
  readonly workflow: RetirementWorkflow;
  readonly tasks: RetirementTask[];
  readonly certificate: DestructionCertificate | null;
}

/**
 * Initiate retirement result
 */
export interface InitiateRetirementResult {
  readonly workflow: RetirementWorkflow;
  readonly tasks: RetirementTask[];
}

/**
 * Complete disposal result
 */
export interface CompleteDisposalResult {
  readonly workflow: RetirementWorkflow;
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
  readonly pendingTasks: RetirementTask[];
  readonly failedTasks: RetirementTask[];
}

/**
 * Cache key for workflow
 */
function workflowCacheKey(workflowId: UUID): string {
  return `retirement:workflow:${workflowId}`;
}

/**
 * Cache key for asset's active workflow
 */
function assetWorkflowCacheKey(assetId: UUID): string {
  return `retirement:asset:${assetId}:active`;
}

/**
 * Initiate a retirement workflow for an asset
 * Requirement 6.8: When an asset is marked for retirement, initiate disposal workflow with required tasks
 */
export async function initiateRetirement(
  request: CreateRetirementWorkflowRequest
): Promise<InitiateRetirementResult> {
  logger.info('Initiating retirement workflow', {
    assetId: request.assetId,
    initiatedBy: request.initiatedBy,
    disposalMethod: request.disposalMethod,
  });

  // Check if asset already has an active retirement workflow
  const existingWorkflow = await repository.hasActiveRetirementWorkflow(request.assetId);
  if (existingWorkflow) {
    throw new Error(`Asset ${request.assetId} already has an active retirement workflow`);
  }

  // Create the workflow
  const workflow = await repository.createWorkflow(request);

  // Create default tasks based on requirements
  const tasks = await repository.createDefaultTasks(
    workflow.workflowId,
    workflow.dataWipeRequired
  );

  // Invalidate cache
  await cache.del(assetWorkflowCacheKey(request.assetId));

  // Publish workflow initiated event
  await publishEvent('RETIREMENT_WORKFLOW_INITIATED', {
    workflowId: workflow.workflowId,
    workflowNumber: workflow.workflowNumber,
    assetId: workflow.assetId,
    assetTag: workflow.assetTag,
    initiatedBy: workflow.initiatedBy,
    status: workflow.status,
    dataWipeRequired: workflow.dataWipeRequired,
    retirementReason: workflow.retirementReason,
    taskCount: tasks.length,
  });

  logger.info('Retirement workflow initiated', {
    workflowId: workflow.workflowId,
    workflowNumber: workflow.workflowNumber,
    taskCount: tasks.length,
  });

  return { workflow, tasks };
}

/**
 * Complete disposal and generate destruction certificate
 * Requirement 6.9: Attach destruction certificates and update asset status to Disposed
 */
export async function completeDisposal(
  workflowId: UUID,
  request: CompleteDisposalRequest,
  completedBy: UUID
): Promise<CompleteDisposalResult> {
  logger.info('Completing disposal', {
    workflowId,
    destructionMethod: request.destructionMethod,
    destructionDate: request.destructionDate,
  });

  // Get the workflow
  const workflow = await repository.getWorkflowById(workflowId);
  if (!workflow) {
    throw new Error(`Retirement workflow not found: ${workflowId}`);
  }

  // Validate workflow is in a state that allows completing disposal
  const validStates: RetirementStatus[] = [
    'INITIATED',
    'APPROVED',
    'DATA_WIPE_PENDING',
    'DATA_WIPE_COMPLETE',
    'DISPOSAL_PENDING',
  ];

  if (!validStates.includes(workflow.status)) {
    throw new Error(`Cannot complete disposal for workflow in status: ${workflow.status}`);
  }

  // Create destruction certificate (this also updates asset status to DISPOSED)
  const certificate = await repository.createDestructionCertificate(
    workflowId,
    workflow.assetId,
    request,
    completedBy
  );

  // Update workflow to completed
  const timestamp = now();
  const updatedWorkflow = await repository.updateWorkflowStatus(
    workflowId,
    'COMPLETED',
    {
      disposalCompletedAt: timestamp,
      disposalCompletedBy: completedBy,
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
        completedBy,
        completionNotes: 'Auto-completed on disposal completion',
      });
    }
  }

  // Invalidate caches
  await cache.del(workflowCacheKey(workflowId));
  await cache.del(assetWorkflowCacheKey(workflow.assetId));

  // Publish disposal completed event
  await publishEvent('DISPOSAL_COMPLETED', {
    workflowId: updatedWorkflow.workflowId,
    workflowNumber: updatedWorkflow.workflowNumber,
    assetId: updatedWorkflow.assetId,
    assetTag: updatedWorkflow.assetTag,
    certificateId: certificate.certificateId,
    certificateNumber: certificate.certificateNumber,
    destructionMethod: request.destructionMethod,
    destructionDate: request.destructionDate,
    completedBy,
  });

  logger.info('Disposal completed', {
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
 * Get retirement workflow with all details
 */
export async function getRetirementWorkflow(workflowId: UUID): Promise<RetirementWorkflowResult | null> {
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
 * Get active retirement workflow for an asset
 */
export async function getActiveWorkflowForAsset(assetId: UUID): Promise<RetirementWorkflowResult | null> {
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
 * Validate retirement requirements are complete
 */
export async function validateRetirementRequirements(workflowId: UUID): Promise<ValidationResult> {
  logger.info('Validating retirement requirements', { workflowId });

  const workflow = await repository.getWorkflowById(workflowId);
  if (!workflow) {
    throw new Error(`Retirement workflow not found: ${workflowId}`);
  }

  const tasks = await repository.getTasksByWorkflowId(workflowId);
  
  const requiredTasks = tasks.filter(t => t.isRequired);
  const completedTasks = requiredTasks.filter(t => t.status === 'COMPLETED');
  const pendingTasks = tasks.filter(t => t.status === 'PENDING' || t.status === 'IN_PROGRESS');
  const failedTasks = tasks.filter(t => t.status === 'FAILED');

  const isValid = completedTasks.length === requiredTasks.length && failedTasks.length === 0;

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
 */
export async function completeDataWipe(
  workflowId: UUID,
  verifiedBy: UUID,
  notes?: string
): Promise<RetirementWorkflow> {
  logger.info('Completing data wipe', { workflowId, verifiedBy });

  const workflow = await repository.getWorkflowById(workflowId);
  if (!workflow) {
    throw new Error(`Retirement workflow not found: ${workflowId}`);
  }

  if (workflow.status !== 'DATA_WIPE_PENDING') {
    throw new Error(`Cannot complete data wipe for workflow in status: ${workflow.status}`);
  }

  const timestamp = now();

  const updatedWorkflow = await repository.updateWorkflowStatus(
    workflowId,
    'DATA_WIPE_COMPLETE',
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
  await publishEvent('RETIREMENT_DATA_WIPE_COMPLETED', {
    workflowId: updatedWorkflow.workflowId,
    workflowNumber: updatedWorkflow.workflowNumber,
    assetId: updatedWorkflow.assetId,
    verifiedBy,
    completedAt: timestamp,
  });

  logger.info('Data wipe completed', { workflowId: updatedWorkflow.workflowId });

  return updatedWorkflow;
}

/**
 * Update a retirement task
 */
export async function updateTask(
  taskId: UUID,
  request: UpdateTaskRequest
): Promise<RetirementTask> {
  logger.info('Updating retirement task', { taskId, status: request.status });

  const task = await repository.getTaskById(taskId);
  if (!task) {
    throw new Error(`Retirement task not found: ${taskId}`);
  }

  const updatedTask = await repository.updateTask(taskId, request);
  if (!updatedTask) {
    throw new Error(`Failed to update task: ${taskId}`);
  }

  // Invalidate workflow cache
  await cache.del(workflowCacheKey(task.workflowId));

  // Publish event
  await publishEvent('RETIREMENT_TASK_UPDATED', {
    taskId: updatedTask.taskId,
    workflowId: updatedTask.workflowId,
    taskType: updatedTask.taskType,
    status: updatedTask.status,
    completedBy: request.completedBy,
  });

  logger.info('Retirement task updated', {
    taskId: updatedTask.taskId,
    status: updatedTask.status,
  });

  return updatedTask;
}

/**
 * Cancel a retirement workflow
 */
export async function cancelWorkflow(
  workflowId: UUID,
  cancelledBy: UUID,
  reason?: string
): Promise<RetirementWorkflow> {
  logger.info('Cancelling retirement workflow', { workflowId, cancelledBy });

  const workflow = await repository.getWorkflowById(workflowId);
  if (!workflow) {
    throw new Error(`Retirement workflow not found: ${workflowId}`);
  }

  if (workflow.status === 'COMPLETED' || workflow.status === 'CANCELLED') {
    throw new Error(`Cannot cancel workflow in status: ${workflow.status}`);
  }

  const updatedWorkflow = await repository.updateWorkflowStatus(
    workflowId,
    'CANCELLED'
  );

  if (!updatedWorkflow) {
    throw new Error(`Failed to cancel workflow: ${workflowId}`);
  }

  // Invalidate caches
  await cache.del(workflowCacheKey(workflowId));
  await cache.del(assetWorkflowCacheKey(workflow.assetId));

  // Publish event
  await publishEvent('RETIREMENT_WORKFLOW_CANCELLED', {
    workflowId: updatedWorkflow.workflowId,
    workflowNumber: updatedWorkflow.workflowNumber,
    assetId: updatedWorkflow.assetId,
    cancelledBy,
    reason,
  });

  logger.info('Retirement workflow cancelled', {
    workflowId: updatedWorkflow.workflowId,
  });

  return updatedWorkflow;
}

/**
 * Get workflow by ID
 */
export async function getWorkflow(workflowId: UUID): Promise<RetirementWorkflow | null> {
  return repository.getWorkflowById(workflowId);
}

/**
 * Get workflow by number
 */
export async function getWorkflowByNumber(workflowNumber: string): Promise<RetirementWorkflow | null> {
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
 * Check if asset has active retirement workflow
 */
export async function hasActiveWorkflow(assetId: UUID): Promise<boolean> {
  return repository.hasActiveRetirementWorkflow(assetId);
}

// Re-export types
export type {
  CompleteDisposalRequest,
  CreateRetirementWorkflowRequest,
  DestructionCertificate,
  DisposalMethod,
  RetirementStatus,
  RetirementTask,
  RetirementTaskStatus,
  RetirementTaskType,
  RetirementWorkflow,
  UpdateTaskRequest,
} from './retirement-repository';
