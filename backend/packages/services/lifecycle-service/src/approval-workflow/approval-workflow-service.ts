/**
 * Approval Workflow Service - Business logic layer for approval workflow management
 *
 * Implements:
 * - Route requests based on configurable rules (Requirement 6B.4)
 * - Notify approvers and track approval status (Requirement 6B.5)
 * - Multi-level approvals and delegation (Requirement 6B.6)
 */

import type { PaginatedResult, PaginationParams, UUID } from '@ams/types';
import * as cache from '@ams/cache';
import { publishEvent } from '@ams/events';
import { createLogger, now } from '@ams/utils';

import type {
  ApprovalStep,
  ApprovalWorkflow,
  CreateApprovalStepInput,
  CreateApprovalWorkflowInput,
  RoutingCondition,
  RoutingRule,
} from './approval-workflow-repository';
import * as repository from './approval-workflow-repository';
import * as requestRepository from '../request/request-repository';

const logger = createLogger({ service: 'approval-workflow-service' });

/**
 * Approval workflow result with steps
 */
export interface ApprovalWorkflowResult {
  readonly workflow: ApprovalWorkflow;
  readonly steps: ApprovalStep[];
}

/**
 * Route for approval input
 */
export interface RouteForApprovalInput {
  readonly requestId: UUID;
  readonly requestType: string;
  readonly initiatedBy: UUID;
  readonly estimatedCost?: number;
  readonly requesterDepartment?: string;
  readonly itemType?: string;
  readonly priority?: string;
}

/**
 * Approve request input
 */
export interface ApproveRequestInput {
  readonly approverId: UUID;
  readonly approverName?: string;
  readonly reason?: string;
  readonly notes?: string;
}

/**
 * Reject request input
 */
export interface RejectRequestInput {
  readonly rejectedBy: UUID;
  readonly rejectionReason: string;
  readonly notes?: string;
}

/**
 * Delegate approval input
 */
export interface DelegateApprovalInput {
  readonly delegatedBy: UUID;
  readonly delegatedTo: UUID;
  readonly delegatedToName?: string;
  readonly delegatedToEmail?: string;
  readonly reason: string;
}

/**
 * Approval result
 */
export interface ApprovalResult {
  readonly workflow: ApprovalWorkflow;
  readonly step: ApprovalStep;
  readonly approved: boolean;
  readonly message: string;
  readonly nextStep?: ApprovalStep;
  readonly isComplete: boolean;
}

/**
 * Routing result
 */
export interface RoutingResult {
  readonly workflow: ApprovalWorkflow;
  readonly steps: ApprovalStep[];
  readonly matchedRules: RoutingRule[];
  readonly approverCount: number;
  readonly levelCount: number;
}

/**
 * Cache key for workflow
 */
function workflowCacheKey(workflowId: UUID): string {
  return `approval-workflow:${workflowId}`;
}

/**
 * Cache key for request workflow
 */
function requestWorkflowCacheKey(requestId: UUID): string {
  return `request:${requestId}:workflow`;
}

/**
 * Cache key for approver pending
 */
function approverPendingCacheKey(approverId: UUID): string {
  return `approver:${approverId}:pending`;
}

/**
 * Cost threshold levels for default routing
 */
const COST_THRESHOLDS = [
  { threshold: 0, levels: 1 },
  { threshold: 1000, levels: 1 },
  { threshold: 5000, levels: 2 },
  { threshold: 25000, levels: 3 },
  { threshold: 100000, levels: 4 },
];

/**
 * Evaluate a routing condition against request data
 */
function evaluateCondition(
  condition: RoutingCondition,
  requestData: RouteForApprovalInput
): boolean {
  const fieldValue = getFieldValue(condition.field, requestData);
  
  if (fieldValue === undefined || fieldValue === null) {
    return false;
  }

  switch (condition.operator) {
    case 'eq':
      return fieldValue === condition.value;
    case 'ne':
      return fieldValue !== condition.value;
    case 'gt':
      return typeof fieldValue === 'number' && fieldValue > (condition.value as number);
    case 'gte':
      return typeof fieldValue === 'number' && fieldValue >= (condition.value as number);
    case 'lt':
      return typeof fieldValue === 'number' && fieldValue < (condition.value as number);
    case 'lte':
      return typeof fieldValue === 'number' && fieldValue <= (condition.value as number);
    case 'in':
      if (Array.isArray(condition.value)) {
        return (condition.value as (string | number)[]).includes(fieldValue as string | number);
      }
      return false;
    case 'contains':
      return typeof fieldValue === 'string' && 
             typeof condition.value === 'string' && 
             fieldValue.toLowerCase().includes(condition.value.toLowerCase());
    default:
      return false;
  }
}

/**
 * Get field value from request data
 */
function getFieldValue(field: string, requestData: RouteForApprovalInput): string | number | undefined {
  switch (field) {
    case 'estimatedCost':
    case 'cost':
      return requestData.estimatedCost;
    case 'requesterDepartment':
    case 'department':
      return requestData.requesterDepartment;
    case 'itemType':
    case 'type':
      return requestData.itemType;
    case 'priority':
      return requestData.priority;
    case 'requestType':
      return requestData.requestType;
    default:
      return undefined;
  }
}

/**
 * Check if a routing rule matches the request
 */
function doesRuleMatch(rule: RoutingRule, requestData: RouteForApprovalInput): boolean {
  if (!rule.isActive) {
    return false;
  }

  if (rule.conditions.length === 0) {
    return true; // No conditions means always match
  }

  // All conditions must match
  return rule.conditions.every(condition => evaluateCondition(condition, requestData));
}

/**
 * Determine approval levels based on cost
 * Requirement 6B.4: Route requests based on cost thresholds
 */
function determineApprovalLevels(estimatedCost: number | undefined): number {
  if (estimatedCost === undefined || estimatedCost === null) {
    return 1;
  }

  for (let i = COST_THRESHOLDS.length - 1; i >= 0; i--) {
    const threshold = COST_THRESHOLDS[i]!;
    if (estimatedCost >= threshold.threshold) {
      return threshold.levels;
    }
  }

  return 1;
}

/**
 * Route a request for approval
 * Requirement 6B.4: Route requests based on configurable rules (cost thresholds, item types, requester department)
 */
export async function routeForApproval(input: RouteForApprovalInput): Promise<RoutingResult> {
  logger.info('Routing request for approval', {
    requestId: input.requestId,
    requestType: input.requestType,
    estimatedCost: input.estimatedCost,
    requesterDepartment: input.requesterDepartment,
    itemType: input.itemType,
  });

  // Check if workflow already exists for this request
  const existingWorkflow = await repository.getWorkflowByRequestId(input.requestId);
  if (existingWorkflow) {
    const steps = await repository.getWorkflowSteps(existingWorkflow.workflowId);
    logger.info('Workflow already exists for request', {
      requestId: input.requestId,
      workflowId: existingWorkflow.workflowId,
    });
    return {
      workflow: existingWorkflow,
      steps,
      matchedRules: [],
      approverCount: steps.length,
      levelCount: existingWorkflow.maxLevel,
    };
  }

  // Get active routing rules
  const routingRules = await repository.getActiveRoutingRules();
  
  // Find matching rules
  const matchedRules = routingRules.filter(rule => doesRuleMatch(rule, input));
  
  logger.info('Matched routing rules', {
    requestId: input.requestId,
    matchedRuleCount: matchedRules.length,
    matchedRuleNames: matchedRules.map(r => r.ruleName),
  });

  // Build approval steps from matched rules
  const approvalSteps: CreateApprovalStepInput[] = [];
  let maxLevel = 1;

  if (matchedRules.length > 0) {
    // Use the highest priority matched rule
    const primaryRule = matchedRules[0]!;
    maxLevel = primaryRule.approvalLevels;

    // Create steps for each approver in the rule
    for (let level = 1; level <= primaryRule.approvalLevels; level++) {
      const approverIndex = level - 1;
      if (approverIndex < primaryRule.approverIds.length) {
        approvalSteps.push({
          workflowId: '', // Will be set after workflow creation
          stepLevel: level,
          approverId: primaryRule.approverIds[approverIndex]!,
          approverRole: primaryRule.approverRoles[approverIndex] ?? undefined,
        });
      }
    }
  } else {
    // Use default routing based on cost thresholds
    maxLevel = determineApprovalLevels(input.estimatedCost);
    
    // For default routing, we'll create placeholder steps
    // In a real system, these would be resolved to actual approvers based on org hierarchy
    for (let level = 1; level <= maxLevel; level++) {
      // Use the initiator as a placeholder - in production, this would be resolved
      // to the appropriate manager based on the requester's department
      approvalSteps.push({
        workflowId: '',
        stepLevel: level,
        approverId: input.initiatedBy, // Placeholder - would be resolved to actual approver
        approverRole: `Level ${level} Approver`,
      });
    }
  }

  // Create the workflow input
  const workflowInput: CreateApprovalWorkflowInput = {
    requestId: input.requestId,
    requestType: input.requestType,
    initiatedBy: input.initiatedBy,
    estimatedCost: input.estimatedCost,
    requesterDepartment: input.requesterDepartment,
    itemType: input.itemType,
    priority: input.priority,
  };

  // Create the workflow with steps
  const result = await repository.createWorkflow(workflowInput, approvalSteps);

  // Invalidate cache
  await cache.del(requestWorkflowCacheKey(input.requestId));

  // Notify first approver
  // Requirement 6B.5: Notify approvers
  if (result.steps.length > 0) {
    const firstStep = result.steps[0]!;
    await publishEvent('APPROVAL_REQUIRED', {
      workflowId: result.workflow.workflowId,
      requestId: input.requestId,
      stepId: firstStep.stepId,
      approverId: firstStep.approverId,
      approverName: firstStep.approverName,
      approverEmail: firstStep.approverEmail,
      stepLevel: firstStep.stepLevel,
      maxLevel: result.workflow.maxLevel,
      estimatedCost: input.estimatedCost,
      requesterDepartment: input.requesterDepartment,
      itemType: input.itemType,
      priority: input.priority,
    });

    // Invalidate approver's pending cache
    await cache.del(approverPendingCacheKey(firstStep.approverId));
  }

  logger.info('Request routed for approval', {
    requestId: input.requestId,
    workflowId: result.workflow.workflowId,
    stepCount: result.steps.length,
    maxLevel,
    matchedRuleCount: matchedRules.length,
  });

  return {
    workflow: result.workflow,
    steps: result.steps,
    matchedRules,
    approverCount: result.steps.length,
    levelCount: maxLevel,
  };
}

/**
 * Approve a request
 * Requirement 6B.5: Track approval status
 * Requirement 6B.6: Support multi-level approvals
 */
export async function approveRequest(
  requestId: UUID,
  input: ApproveRequestInput
): Promise<ApprovalResult> {
  logger.info('Approving request', {
    requestId,
    approverId: input.approverId,
  });

  // Get the workflow for this request
  const workflow = await repository.getWorkflowByRequestId(requestId);
  if (!workflow) {
    throw new Error(`No approval workflow found for request: ${requestId}`);
  }

  // Check workflow status
  if (workflow.status !== 'IN_PROGRESS') {
    throw new Error(`Cannot approve request - workflow status is: ${workflow.status}`);
  }

  // Get the current pending step
  const currentStep = await repository.getCurrentPendingStep(workflow.workflowId);
  if (!currentStep) {
    throw new Error('No pending approval step found');
  }

  // Verify the approver is authorized
  const canApprove = await repository.canUserApproveStep(currentStep.stepId, input.approverId);
  if (!canApprove) {
    throw new Error('User is not authorized to approve this step');
  }

  const timestamp = now();

  // Update the step to approved
  const updatedStep = await repository.updateApprovalStep(currentStep.stepId, {
    status: 'APPROVED',
    decision: 'APPROVED',
    decisionDate: timestamp,
    decisionReason: input.reason,
    notes: input.notes,
  });

  if (!updatedStep) {
    throw new Error('Failed to update approval step');
  }

  // Check if there are more levels
  const allSteps = await repository.getWorkflowSteps(workflow.workflowId);
  const nextStep = allSteps.find(s => s.stepLevel > currentStep.stepLevel && s.status === 'PENDING');

  let updatedWorkflow: ApprovalWorkflow;
  let isComplete = false;

  if (nextStep) {
    // Move to next level
    updatedWorkflow = (await repository.updateWorkflowStatus(workflow.workflowId, 'IN_PROGRESS', {
      currentLevel: nextStep.stepLevel,
      currentApproverId: nextStep.approverId,
    }))!;

    // Notify next approver
    await publishEvent('APPROVAL_REQUIRED', {
      workflowId: workflow.workflowId,
      requestId,
      stepId: nextStep.stepId,
      approverId: nextStep.approverId,
      approverName: nextStep.approverName,
      approverEmail: nextStep.approverEmail,
      stepLevel: nextStep.stepLevel,
      maxLevel: workflow.maxLevel,
      previousApproverId: input.approverId,
      previousApproverName: input.approverName,
    });

    // Invalidate next approver's cache
    await cache.del(approverPendingCacheKey(nextStep.approverId));

    logger.info('Request approved at level, moving to next', {
      requestId,
      workflowId: workflow.workflowId,
      completedLevel: currentStep.stepLevel,
      nextLevel: nextStep.stepLevel,
    });
  } else {
    // All levels approved - complete the workflow
    isComplete = true;
    updatedWorkflow = (await repository.updateWorkflowStatus(workflow.workflowId, 'APPROVED', {
      completedDate: timestamp,
      completedBy: input.approverId,
      finalDecision: 'APPROVED',
      decisionReason: input.reason,
    }))!;

    // Update the request status
    await requestRepository.updateRequestStatus(requestId, 'APPROVED', {
      approvedDate: timestamp,
      approvedBy: input.approverId,
    });

    // Publish approval complete event
    await publishEvent('REQUEST_APPROVED', {
      workflowId: workflow.workflowId,
      requestId,
      approvedBy: input.approverId,
      approverName: input.approverName,
      approvedDate: timestamp,
      totalLevels: workflow.maxLevel,
    });

    logger.info('Request fully approved', {
      requestId,
      workflowId: workflow.workflowId,
      approvedBy: input.approverId,
    });
  }

  // Invalidate caches
  await cache.del(workflowCacheKey(workflow.workflowId));
  await cache.del(requestWorkflowCacheKey(requestId));
  await cache.del(approverPendingCacheKey(input.approverId));

  // Publish step approved event
  await publishEvent('APPROVAL_STEP_COMPLETED', {
    workflowId: workflow.workflowId,
    requestId,
    stepId: currentStep.stepId,
    stepLevel: currentStep.stepLevel,
    decision: 'APPROVED',
    approverId: input.approverId,
    approverName: input.approverName,
    isComplete,
  });

  return {
    workflow: updatedWorkflow,
    step: updatedStep,
    approved: true,
    message: isComplete 
      ? 'Request fully approved' 
      : `Approved at level ${currentStep.stepLevel}, pending level ${nextStep?.stepLevel}`,
    nextStep: nextStep ?? undefined,
    isComplete,
  };
}

/**
 * Reject a request
 * Requirement 6B.5: Track approval status
 */
export async function rejectRequest(
  requestId: UUID,
  input: RejectRequestInput
): Promise<ApprovalResult> {
  logger.info('Rejecting request', {
    requestId,
    rejectedBy: input.rejectedBy,
    reason: input.rejectionReason,
  });

  // Get the workflow for this request
  const workflow = await repository.getWorkflowByRequestId(requestId);
  if (!workflow) {
    throw new Error(`No approval workflow found for request: ${requestId}`);
  }

  // Check workflow status
  if (workflow.status !== 'IN_PROGRESS') {
    throw new Error(`Cannot reject request - workflow status is: ${workflow.status}`);
  }

  // Get the current pending step
  const currentStep = await repository.getCurrentPendingStep(workflow.workflowId);
  if (!currentStep) {
    throw new Error('No pending approval step found');
  }

  // Verify the approver is authorized
  const canApprove = await repository.canUserApproveStep(currentStep.stepId, input.rejectedBy);
  if (!canApprove) {
    throw new Error('User is not authorized to reject this step');
  }

  const timestamp = now();

  // Update the step to rejected
  const updatedStep = await repository.updateApprovalStep(currentStep.stepId, {
    status: 'REJECTED',
    decision: 'REJECTED',
    decisionDate: timestamp,
    decisionReason: input.rejectionReason,
    notes: input.notes,
  });

  if (!updatedStep) {
    throw new Error('Failed to update approval step');
  }

  // Complete the workflow as rejected
  const updatedWorkflow = (await repository.updateWorkflowStatus(workflow.workflowId, 'REJECTED', {
    completedDate: timestamp,
    completedBy: input.rejectedBy,
    finalDecision: 'REJECTED',
    decisionReason: input.rejectionReason,
  }))!;

  // Update the request status
  await requestRepository.updateRequestStatus(requestId, 'REJECTED', {
    rejectedDate: timestamp,
    rejectedBy: input.rejectedBy,
    rejectionReason: input.rejectionReason,
  });

  // Invalidate caches
  await cache.del(workflowCacheKey(workflow.workflowId));
  await cache.del(requestWorkflowCacheKey(requestId));
  await cache.del(approverPendingCacheKey(input.rejectedBy));

  // Publish rejection events
  await publishEvent('APPROVAL_STEP_COMPLETED', {
    workflowId: workflow.workflowId,
    requestId,
    stepId: currentStep.stepId,
    stepLevel: currentStep.stepLevel,
    decision: 'REJECTED',
    approverId: input.rejectedBy,
    isComplete: true,
  });

  await publishEvent('REQUEST_REJECTED', {
    workflowId: workflow.workflowId,
    requestId,
    rejectedBy: input.rejectedBy,
    rejectedDate: timestamp,
    rejectionReason: input.rejectionReason,
    rejectedAtLevel: currentStep.stepLevel,
  });

  logger.info('Request rejected', {
    requestId,
    workflowId: workflow.workflowId,
    rejectedBy: input.rejectedBy,
    rejectedAtLevel: currentStep.stepLevel,
  });

  return {
    workflow: updatedWorkflow,
    step: updatedStep,
    approved: false,
    message: `Request rejected at level ${currentStep.stepLevel}: ${input.rejectionReason}`,
    isComplete: true,
  };
}

/**
 * Delegate an approval to another user
 * Requirement 6B.6: Support delegation
 */
export async function delegateApproval(
  requestId: UUID,
  input: DelegateApprovalInput
): Promise<ApprovalResult> {
  logger.info('Delegating approval', {
    requestId,
    delegatedBy: input.delegatedBy,
    delegatedTo: input.delegatedTo,
  });

  // Get the workflow for this request
  const workflow = await repository.getWorkflowByRequestId(requestId);
  if (!workflow) {
    throw new Error(`No approval workflow found for request: ${requestId}`);
  }

  // Check workflow status
  if (workflow.status !== 'IN_PROGRESS') {
    throw new Error(`Cannot delegate - workflow status is: ${workflow.status}`);
  }

  // Get the current pending step
  const currentStep = await repository.getCurrentPendingStep(workflow.workflowId);
  if (!currentStep) {
    throw new Error('No pending approval step found');
  }

  // Verify the delegator is the current approver
  if (currentStep.approverId !== input.delegatedBy && currentStep.delegatedTo !== input.delegatedBy) {
    throw new Error('User is not authorized to delegate this approval');
  }

  const timestamp = now();

  // Update the step with delegation
  const updatedStep = await repository.updateApprovalStep(currentStep.stepId, {
    status: 'DELEGATED',
    delegatedTo: input.delegatedTo,
    delegatedDate: timestamp,
    delegationReason: input.reason,
  });

  if (!updatedStep) {
    throw new Error('Failed to delegate approval');
  }

  // Update workflow with new approver
  const updatedWorkflow = (await repository.updateWorkflowStatus(workflow.workflowId, 'DELEGATED', {
    currentApproverId: input.delegatedTo,
  }))!;

  // Invalidate caches
  await cache.del(workflowCacheKey(workflow.workflowId));
  await cache.del(requestWorkflowCacheKey(requestId));
  await cache.del(approverPendingCacheKey(input.delegatedBy));
  await cache.del(approverPendingCacheKey(input.delegatedTo));

  // Notify the delegate
  await publishEvent('APPROVAL_DELEGATED', {
    workflowId: workflow.workflowId,
    requestId,
    stepId: currentStep.stepId,
    delegatedBy: input.delegatedBy,
    delegatedTo: input.delegatedTo,
    delegatedToName: input.delegatedToName,
    delegatedToEmail: input.delegatedToEmail,
    delegationReason: input.reason,
    stepLevel: currentStep.stepLevel,
  });

  logger.info('Approval delegated', {
    requestId,
    workflowId: workflow.workflowId,
    delegatedBy: input.delegatedBy,
    delegatedTo: input.delegatedTo,
  });

  return {
    workflow: updatedWorkflow,
    step: updatedStep,
    approved: false,
    message: `Approval delegated to ${input.delegatedToName ?? input.delegatedTo}`,
    isComplete: false,
  };
}

/**
 * Get approval workflow for a request
 */
export async function getWorkflowForRequest(requestId: UUID): Promise<ApprovalWorkflowResult | null> {
  const workflow = await repository.getWorkflowByRequestId(requestId);
  if (!workflow) {
    return null;
  }

  const steps = await repository.getWorkflowSteps(workflow.workflowId);
  return { workflow, steps };
}

/**
 * Get pending approvals for an approver
 * Requirement 6B.5: Track approval status
 */
export async function getPendingApprovalsForApprover(
  approverId: UUID,
  pagination: PaginationParams = {}
): Promise<PaginatedResult<ApprovalWorkflow>> {
  return repository.getPendingApprovalsForApprover(approverId, pagination);
}

/**
 * Get workflow by ID
 */
export async function getWorkflow(workflowId: UUID): Promise<ApprovalWorkflowResult | null> {
  const workflow = await repository.getWorkflowById(workflowId);
  if (!workflow) {
    return null;
  }

  const steps = await repository.getWorkflowSteps(workflowId);
  return { workflow, steps };
}

// Re-export types
export type {
  ApprovalStep,
  ApprovalStepStatus,
  ApprovalWorkflow,
  ApprovalWorkflowStatus,
  CreateApprovalStepInput,
  CreateApprovalWorkflowInput,
  RoutingCondition,
  RoutingRule,
  RoutingRuleType,
} from './approval-workflow-repository';

