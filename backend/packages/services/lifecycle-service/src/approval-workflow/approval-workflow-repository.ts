/**
 * Approval Workflow Repository - Data access layer for approval workflow operations
 *
 * Implements database operations for:
 * - Approval workflow creation and management (Requirement 6B.4)
 * - Routing rules configuration (Requirement 6B.4)
 * - Approval tracking and status (Requirement 6B.5)
 * - Multi-level approvals and delegation (Requirement 6B.6)
 */

import type { PaginatedResult, PaginationParams, UUID } from '@ams/types';
import { queryMany, queryOne, withTransaction } from '@ams/database';
import { createLogger, now } from '@ams/utils';

const logger = createLogger({ service: 'approval-workflow-repository' });

/**
 * Approval workflow status
 */
export type ApprovalWorkflowStatus =
  | 'PENDING'
  | 'IN_PROGRESS'
  | 'APPROVED'
  | 'REJECTED'
  | 'CANCELLED'
  | 'ESCALATED'
  | 'DELEGATED';

/**
 * Approval step status
 */
export type ApprovalStepStatus =
  | 'PENDING'
  | 'APPROVED'
  | 'REJECTED'
  | 'SKIPPED'
  | 'DELEGATED'
  | 'ESCALATED'
  | 'TIMED_OUT';

/**
 * Routing rule type
 */
export type RoutingRuleType =
  | 'COST_THRESHOLD'
  | 'ITEM_TYPE'
  | 'DEPARTMENT'
  | 'CATEGORY'
  | 'PRIORITY'
  | 'CUSTOM';

/**
 * Approval workflow entity
 */
export interface ApprovalWorkflow {
  readonly workflowId: UUID;
  readonly requestId: UUID;
  readonly requestType: string;
  readonly status: ApprovalWorkflowStatus;
  readonly currentLevel: number;
  readonly maxLevel: number;
  readonly currentApproverId: UUID | null;
  readonly initiatedBy: UUID;
  readonly initiatedDate: string;
  readonly completedDate: string | null;
  readonly completedBy: UUID | null;
  readonly finalDecision: 'APPROVED' | 'REJECTED' | null;
  readonly decisionReason: string | null;
  readonly estimatedCost: number | null;
  readonly requesterDepartment: string | null;
  readonly itemType: string | null;
  readonly priority: string | null;
  readonly notes: string | null;
  readonly createdAt: string;
  readonly updatedAt: string;
}

/**
 * Approval step entity
 */
export interface ApprovalStep {
  readonly stepId: UUID;
  readonly workflowId: UUID;
  readonly stepLevel: number;
  readonly approverId: UUID;
  readonly approverName: string | null;
  readonly approverEmail: string | null;
  readonly approverRole: string | null;
  readonly status: ApprovalStepStatus;
  readonly decision: 'APPROVED' | 'REJECTED' | null;
  readonly decisionDate: string | null;
  readonly decisionReason: string | null;
  readonly delegatedTo: UUID | null;
  readonly delegatedDate: string | null;
  readonly delegationReason: string | null;
  readonly dueDate: string | null;
  readonly reminderSentDate: string | null;
  readonly escalatedDate: string | null;
  readonly escalatedTo: UUID | null;
  readonly notes: string | null;
  readonly createdAt: string;
  readonly updatedAt: string;
}

/**
 * Routing rule entity
 */
export interface RoutingRule {
  readonly ruleId: UUID;
  readonly ruleName: string;
  readonly ruleType: RoutingRuleType;
  readonly priority: number;
  readonly isActive: boolean;
  readonly conditions: RoutingCondition[];
  readonly approverIds: UUID[];
  readonly approverRoles: string[];
  readonly requireAllApprovers: boolean;
  readonly approvalLevels: number;
  readonly escalationDays: number | null;
  readonly description: string | null;
  readonly createdAt: string;
  readonly updatedAt: string;
}

/**
 * Routing condition
 */
export interface RoutingCondition {
  readonly field: string;
  readonly operator: 'eq' | 'ne' | 'gt' | 'gte' | 'lt' | 'lte' | 'in' | 'contains';
  readonly value: string | number | string[] | number[];
}

/**
 * Create approval workflow input
 */
export interface CreateApprovalWorkflowInput {
  readonly requestId: UUID;
  readonly requestType: string;
  readonly initiatedBy: UUID;
  readonly estimatedCost?: number;
  readonly requesterDepartment?: string;
  readonly itemType?: string;
  readonly priority?: string;
  readonly notes?: string;
}

/**
 * Create approval step input
 */
export interface CreateApprovalStepInput {
  readonly workflowId: UUID;
  readonly stepLevel: number;
  readonly approverId: UUID;
  readonly approverName?: string;
  readonly approverEmail?: string;
  readonly approverRole?: string;
  readonly dueDate?: string;
}

/**
 * Database row types
 */
interface ApprovalWorkflowRow {
  workflow_id: string;
  request_id: string;
  request_type: string;
  status: ApprovalWorkflowStatus;
  current_level: number;
  max_level: number;
  current_approver_id: string | null;
  initiated_by: string;
  initiated_date: string;
  completed_date: string | null;
  completed_by: string | null;
  final_decision: 'APPROVED' | 'REJECTED' | null;
  decision_reason: string | null;
  estimated_cost: number | null;
  requester_department: string | null;
  item_type: string | null;
  priority: string | null;
  notes: string | null;
  created_at: string;
  updated_at: string;
}

interface ApprovalStepRow {
  step_id: string;
  workflow_id: string;
  step_level: number;
  approver_id: string;
  approver_name: string | null;
  approver_email: string | null;
  approver_role: string | null;
  status: ApprovalStepStatus;
  decision: 'APPROVED' | 'REJECTED' | null;
  decision_date: string | null;
  decision_reason: string | null;
  delegated_to: string | null;
  delegated_date: string | null;
  delegation_reason: string | null;
  due_date: string | null;
  reminder_sent_date: string | null;
  escalated_date: string | null;
  escalated_to: string | null;
  notes: string | null;
  created_at: string;
  updated_at: string;
}

interface RoutingRuleRow {
  rule_id: string;
  rule_name: string;
  rule_type: RoutingRuleType;
  priority: number;
  is_active: boolean;
  conditions: string; // JSON string
  approver_ids: string[]; // PostgreSQL array
  approver_roles: string[]; // PostgreSQL array
  require_all_approvers: boolean;
  approval_levels: number;
  escalation_days: number | null;
  description: string | null;
  created_at: string;
  updated_at: string;
}

/**
 * Map database row to ApprovalWorkflow entity
 */
function mapRowToApprovalWorkflow(row: ApprovalWorkflowRow): ApprovalWorkflow {
  return {
    workflowId: row.workflow_id,
    requestId: row.request_id,
    requestType: row.request_type,
    status: row.status,
    currentLevel: row.current_level,
    maxLevel: row.max_level,
    currentApproverId: row.current_approver_id,
    initiatedBy: row.initiated_by,
    initiatedDate: row.initiated_date,
    completedDate: row.completed_date,
    completedBy: row.completed_by,
    finalDecision: row.final_decision,
    decisionReason: row.decision_reason,
    estimatedCost: row.estimated_cost,
    requesterDepartment: row.requester_department,
    itemType: row.item_type,
    priority: row.priority,
    notes: row.notes,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

/**
 * Map database row to ApprovalStep entity
 */
function mapRowToApprovalStep(row: ApprovalStepRow): ApprovalStep {
  return {
    stepId: row.step_id,
    workflowId: row.workflow_id,
    stepLevel: row.step_level,
    approverId: row.approver_id,
    approverName: row.approver_name,
    approverEmail: row.approver_email,
    approverRole: row.approver_role,
    status: row.status,
    decision: row.decision,
    decisionDate: row.decision_date,
    decisionReason: row.decision_reason,
    delegatedTo: row.delegated_to,
    delegatedDate: row.delegated_date,
    delegationReason: row.delegation_reason,
    dueDate: row.due_date,
    reminderSentDate: row.reminder_sent_date,
    escalatedDate: row.escalated_date,
    escalatedTo: row.escalated_to,
    notes: row.notes,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

/**
 * Map database row to RoutingRule entity
 */
function mapRowToRoutingRule(row: RoutingRuleRow): RoutingRule {
  let conditions: RoutingCondition[] = [];
  try {
    conditions = JSON.parse(row.conditions) as RoutingCondition[];
  } catch {
    conditions = [];
  }

  return {
    ruleId: row.rule_id,
    ruleName: row.rule_name,
    ruleType: row.rule_type,
    priority: row.priority,
    isActive: row.is_active,
    conditions,
    approverIds: row.approver_ids ?? [],
    approverRoles: row.approver_roles ?? [],
    requireAllApprovers: row.require_all_approvers,
    approvalLevels: row.approval_levels,
    escalationDays: row.escalation_days,
    description: row.description,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

/**
 * Get approval workflow by ID
 */
export async function getWorkflowById(workflowId: UUID): Promise<ApprovalWorkflow | null> {
  const result = await queryOne<ApprovalWorkflowRow>(
    'SELECT * FROM approval_workflows WHERE workflow_id = $1',
    [workflowId]
  );

  return result ? mapRowToApprovalWorkflow(result) : null;
}

/**
 * Get approval workflow by request ID
 */
export async function getWorkflowByRequestId(requestId: UUID): Promise<ApprovalWorkflow | null> {
  const result = await queryOne<ApprovalWorkflowRow>(
    'SELECT * FROM approval_workflows WHERE request_id = $1',
    [requestId]
  );

  return result ? mapRowToApprovalWorkflow(result) : null;
}

/**
 * Get approval steps for a workflow
 */
export async function getWorkflowSteps(workflowId: UUID): Promise<ApprovalStep[]> {
  const rows = await queryMany<ApprovalStepRow>(
    'SELECT * FROM approval_steps WHERE workflow_id = $1 ORDER BY step_level ASC',
    [workflowId]
  );

  return rows.map(mapRowToApprovalStep);
}

/**
 * Get approval step by ID
 */
export async function getStepById(stepId: UUID): Promise<ApprovalStep | null> {
  const result = await queryOne<ApprovalStepRow>(
    'SELECT * FROM approval_steps WHERE step_id = $1',
    [stepId]
  );

  return result ? mapRowToApprovalStep(result) : null;
}

/**
 * Get current pending step for a workflow
 */
export async function getCurrentPendingStep(workflowId: UUID): Promise<ApprovalStep | null> {
  const result = await queryOne<ApprovalStepRow>(
    `SELECT * FROM approval_steps 
     WHERE workflow_id = $1 AND status = 'PENDING'
     ORDER BY step_level ASC
     LIMIT 1`,
    [workflowId]
  );

  return result ? mapRowToApprovalStep(result) : null;
}

/**
 * Get active routing rules
 */
export async function getActiveRoutingRules(): Promise<RoutingRule[]> {
  const rows = await queryMany<RoutingRuleRow>(
    'SELECT * FROM approval_routing_rules WHERE is_active = true ORDER BY priority ASC'
  );

  return rows.map(mapRowToRoutingRule);
}

/**
 * Get routing rule by ID
 */
export async function getRoutingRuleById(ruleId: UUID): Promise<RoutingRule | null> {
  const result = await queryOne<RoutingRuleRow>(
    'SELECT * FROM approval_routing_rules WHERE rule_id = $1',
    [ruleId]
  );

  return result ? mapRowToRoutingRule(result) : null;
}

/**
 * Create a new approval workflow with steps
 * Requirement 6B.4: Route requests based on configurable rules
 */
export async function createWorkflow(
  input: CreateApprovalWorkflowInput,
  steps: CreateApprovalStepInput[]
): Promise<{ workflow: ApprovalWorkflow; steps: ApprovalStep[] }> {
  return withTransaction(async (ctx) => {
    const timestamp = now();
    const maxLevel = steps.length > 0 ? Math.max(...steps.map(s => s.stepLevel)) : 1;
    const firstApproverId = steps.length > 0 ? steps[0]!.approverId : null;

    // Create workflow
    const workflowResult = await ctx.queryOne<ApprovalWorkflowRow>(
      `INSERT INTO approval_workflows (
        request_id, request_type, status, current_level, max_level,
        current_approver_id, initiated_by, initiated_date,
        estimated_cost, requester_department, item_type, priority, notes,
        created_at, updated_at
      ) VALUES ($1, $2, 'IN_PROGRESS', 1, $3, $4, $5, $6, $7, $8, $9, $10, $11, $6, $6)
      RETURNING *`,
      [
        input.requestId,
        input.requestType,
        maxLevel,
        firstApproverId,
        input.initiatedBy,
        timestamp,
        input.estimatedCost ?? null,
        input.requesterDepartment ?? null,
        input.itemType ?? null,
        input.priority ?? null,
        input.notes ?? null,
      ]
    );

    if (!workflowResult) {
      throw new Error('Failed to create approval workflow');
    }

    const workflow = mapRowToApprovalWorkflow(workflowResult);

    // Create approval steps
    const createdSteps: ApprovalStep[] = [];
    for (const stepInput of steps) {
      const stepResult = await ctx.queryOne<ApprovalStepRow>(
        `INSERT INTO approval_steps (
          workflow_id, step_level, approver_id, approver_name, approver_email,
          approver_role, status, due_date, created_at, updated_at
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $9)
        RETURNING *`,
        [
          workflow.workflowId,
          stepInput.stepLevel,
          stepInput.approverId,
          stepInput.approverName ?? null,
          stepInput.approverEmail ?? null,
          stepInput.approverRole ?? null,
          stepInput.stepLevel === 1 ? 'PENDING' : 'PENDING',
          stepInput.dueDate ?? null,
          timestamp,
        ]
      );

      if (stepResult) {
        createdSteps.push(mapRowToApprovalStep(stepResult));
      }
    }

    logger.info('Approval workflow created', {
      workflowId: workflow.workflowId,
      requestId: input.requestId,
      stepCount: createdSteps.length,
      maxLevel,
    });

    return { workflow, steps: createdSteps };
  });
}

/**
 * Update approval workflow status
 */
export async function updateWorkflowStatus(
  workflowId: UUID,
  status: ApprovalWorkflowStatus,
  additionalFields?: Partial<{
    currentLevel: number;
    currentApproverId: UUID | null;
    completedDate: string;
    completedBy: UUID;
    finalDecision: 'APPROVED' | 'REJECTED';
    decisionReason: string;
    notes: string;
  }>
): Promise<ApprovalWorkflow | null> {
  const timestamp = now();

  const result = await queryOne<ApprovalWorkflowRow>(
    `UPDATE approval_workflows SET
      status = $1,
      current_level = COALESCE($2, current_level),
      current_approver_id = COALESCE($3, current_approver_id),
      completed_date = COALESCE($4, completed_date),
      completed_by = COALESCE($5, completed_by),
      final_decision = COALESCE($6, final_decision),
      decision_reason = COALESCE($7, decision_reason),
      notes = COALESCE($8, notes),
      updated_at = $9
     WHERE workflow_id = $10
     RETURNING *`,
    [
      status,
      additionalFields?.currentLevel ?? null,
      additionalFields?.currentApproverId ?? null,
      additionalFields?.completedDate ?? null,
      additionalFields?.completedBy ?? null,
      additionalFields?.finalDecision ?? null,
      additionalFields?.decisionReason ?? null,
      additionalFields?.notes ?? null,
      timestamp,
      workflowId,
    ]
  );

  if (result) {
    logger.info('Approval workflow status updated', {
      workflowId,
      status,
    });
  }

  return result ? mapRowToApprovalWorkflow(result) : null;
}

/**
 * Update approval step
 */
export async function updateApprovalStep(
  stepId: UUID,
  updates: Partial<{
    status: ApprovalStepStatus;
    decision: 'APPROVED' | 'REJECTED';
    decisionDate: string;
    decisionReason: string;
    delegatedTo: UUID;
    delegatedDate: string;
    delegationReason: string;
    reminderSentDate: string;
    escalatedDate: string;
    escalatedTo: UUID;
    notes: string;
  }>
): Promise<ApprovalStep | null> {
  const timestamp = now();

  const result = await queryOne<ApprovalStepRow>(
    `UPDATE approval_steps SET
      status = COALESCE($1, status),
      decision = COALESCE($2, decision),
      decision_date = COALESCE($3, decision_date),
      decision_reason = COALESCE($4, decision_reason),
      delegated_to = COALESCE($5, delegated_to),
      delegated_date = COALESCE($6, delegated_date),
      delegation_reason = COALESCE($7, delegation_reason),
      reminder_sent_date = COALESCE($8, reminder_sent_date),
      escalated_date = COALESCE($9, escalated_date),
      escalated_to = COALESCE($10, escalated_to),
      notes = COALESCE($11, notes),
      updated_at = $12
     WHERE step_id = $13
     RETURNING *`,
    [
      updates.status ?? null,
      updates.decision ?? null,
      updates.decisionDate ?? null,
      updates.decisionReason ?? null,
      updates.delegatedTo ?? null,
      updates.delegatedDate ?? null,
      updates.delegationReason ?? null,
      updates.reminderSentDate ?? null,
      updates.escalatedDate ?? null,
      updates.escalatedTo ?? null,
      updates.notes ?? null,
      timestamp,
      stepId,
    ]
  );

  return result ? mapRowToApprovalStep(result) : null;
}

/**
 * Get pending approvals for an approver
 * Requirement 6B.5: Track approval status
 */
export async function getPendingApprovalsForApprover(
  approverId: UUID,
  pagination: PaginationParams = {}
): Promise<PaginatedResult<ApprovalWorkflow>> {
  const { page = 1, limit = 50 } = pagination;
  const offset = (page - 1) * limit;

  const countResult = await queryOne<{ count: string }>(
    `SELECT COUNT(DISTINCT w.workflow_id) as count
     FROM approval_workflows w
     JOIN approval_steps s ON w.workflow_id = s.workflow_id
     WHERE s.approver_id = $1 
       AND s.status = 'PENDING'
       AND w.status = 'IN_PROGRESS'`,
    [approverId]
  );
  const total = parseInt(countResult?.count ?? '0', 10);

  const rows = await queryMany<ApprovalWorkflowRow>(
    `SELECT DISTINCT w.*
     FROM approval_workflows w
     JOIN approval_steps s ON w.workflow_id = s.workflow_id
     WHERE s.approver_id = $1 
       AND s.status = 'PENDING'
       AND w.status = 'IN_PROGRESS'
     ORDER BY w.initiated_date ASC
     LIMIT $2 OFFSET $3`,
    [approverId, limit, offset]
  );

  return {
    items: rows.map(mapRowToApprovalWorkflow),
    total,
    page,
    limit,
    hasMore: offset + rows.length < total,
  };
}

/**
 * Get workflows by status
 */
export async function getWorkflowsByStatus(
  status: ApprovalWorkflowStatus,
  pagination: PaginationParams = {}
): Promise<PaginatedResult<ApprovalWorkflow>> {
  const { page = 1, limit = 50 } = pagination;
  const offset = (page - 1) * limit;

  const countResult = await queryOne<{ count: string }>(
    'SELECT COUNT(*) as count FROM approval_workflows WHERE status = $1',
    [status]
  );
  const total = parseInt(countResult?.count ?? '0', 10);

  const rows = await queryMany<ApprovalWorkflowRow>(
    `SELECT * FROM approval_workflows 
     WHERE status = $1
     ORDER BY initiated_date ASC
     LIMIT $2 OFFSET $3`,
    [status, limit, offset]
  );

  return {
    items: rows.map(mapRowToApprovalWorkflow),
    total,
    page,
    limit,
    hasMore: offset + rows.length < total,
  };
}

/**
 * Check if user can approve a step (is the assigned approver or delegate)
 */
export async function canUserApproveStep(stepId: UUID, userId: UUID): Promise<boolean> {
  const result = await queryOne<{ can_approve: boolean }>(
    `SELECT EXISTS(
      SELECT 1 FROM approval_steps 
      WHERE step_id = $1 
        AND (approver_id = $2 OR delegated_to = $2)
        AND status = 'PENDING'
    ) as can_approve`,
    [stepId, userId]
  );

  return result?.can_approve ?? false;
}

