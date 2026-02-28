/**
 * Reclamation Service - Business logic for software license reclamation
 *
 * Implements:
 * - Identify software installations not used within configurable time periods (Requirement 4.6)
 * - Trigger uninstallation workflows and return licenses to available pool (Requirement 4.7)
 *
 * Requirements: 4.6, 4.7
 */

import type { ReclamationStatus, UUID } from '@ams/types';
import * as cache from '@ams/cache';
import { publishEvent } from '@ams/events';
import { createLogger, now } from '@ams/utils';
import { v4 as uuidv4 } from 'uuid';

import type {
  ReclamationCandidate,
  ReclamationCandidateWithDetails,
  ReclamationRule,
} from './reclamation-repository';
import * as repository from './reclamation-repository';

const logger = createLogger({ service: 'reclamation-service' });

/**
 * Cache keys
 */
function reclamationCandidatesCacheKey(): string {
  return 'reclamation:candidates:list';
}

function reclamationSummaryCacheKey(): string {
  return 'reclamation:summary';
}

/**
 * Result of identifying reclamation candidates
 */
export interface IdentifyReclamationResult {
  readonly runId: UUID;
  readonly startedAt: string;
  readonly completedAt: string;
  readonly rulesApplied: number;
  readonly installationsScanned: number;
  readonly candidatesIdentified: number;
  readonly candidates: readonly ReclamationCandidate[];
  readonly potentialSavings: number;
}

/**
 * Result of initiating reclamation
 */
export interface InitiateReclamationResult {
  readonly candidateId: UUID;
  readonly installationId: UUID;
  readonly workflowId: UUID;
  readonly status: ReclamationStatus;
  readonly requiresApproval: boolean;
  readonly userNotified: boolean;
  readonly managerNotified: boolean;
  readonly scheduledActionDate: string | null;
}

/**
 * Reclamation workflow options
 */
export interface ReclamationWorkflowOptions {
  readonly skipNotification?: boolean;
  readonly skipApproval?: boolean;
  readonly actionType?: 'UNINSTALL' | 'DISABLE' | 'REVOKE_LICENSE' | 'REASSIGN';
  readonly scheduledDate?: string;
  readonly notes?: string;
  readonly initiatedBy?: UUID;
}

/**
 * Get all active reclamation rules
 */
export async function getReclamationRules(): Promise<ReclamationRule[]> {
  logger.info('Getting active reclamation rules');
  return repository.getActiveRules();
}

/**
 * Get reclamation rule by ID
 */
export async function getReclamationRule(ruleId: UUID): Promise<ReclamationRule | null> {
  logger.info('Getting reclamation rule', { ruleId });
  return repository.getRuleById(ruleId);
}

/**
 * Identify reclamation candidates based on configured rules
 * Requirement 4.6: Identify software installations not used within configurable time periods
 *
 * @param rules - Optional specific rules to apply (defaults to all active rules)
 * @param productId - Optional filter by specific product
 * @returns Identification result with candidates
 */
export async function identifyReclamationCandidates(
  rules?: ReclamationRule[],
  productId?: UUID
): Promise<IdentifyReclamationResult> {
  const runId = uuidv4();
  const startedAt = now();

  logger.info('Starting reclamation candidate identification', { runId, productId });

  // Get rules to apply
  const rulesToApply = rules ?? (await repository.getActiveRules());

  if (rulesToApply.length === 0) {
    logger.info('No active reclamation rules found', { runId });
    return {
      runId,
      startedAt,
      completedAt: now(),
      rulesApplied: 0,
      installationsScanned: 0,
      candidatesIdentified: 0,
      candidates: [],
      potentialSavings: 0,
    };
  }

  const allCandidates: ReclamationCandidate[] = [];
  const processedInstallations = new Set<string>();
  let totalInstallationsScanned = 0;
  let totalPotentialSavings = 0;

  // Apply each rule
  for (const rule of rulesToApply) {
    // Skip rules that don't match the product filter
    if (productId && rule.softwareProductId && rule.softwareProductId !== productId) {
      continue;
    }

    logger.debug('Applying reclamation rule', {
      runId,
      ruleId: rule.ruleId,
      ruleName: rule.ruleName,
      thresholdDays: rule.daysSinceLastUse,
    });

    // Find unused installations matching this rule
    const unusedInstallations = await repository.findUnusedInstallations(
      rule.daysSinceLastUse,
      rule.minUsageMinutes30Day,
      productId ?? rule.softwareProductId ?? undefined,
      rule.publisher ?? undefined,
      rule.productCategory ?? undefined
    );

    totalInstallationsScanned += unusedInstallations.length;

    // Create candidates for each unused installation
    for (const installation of unusedInstallations) {
      // Skip if already processed by a higher priority rule
      if (processedInstallations.has(installation.installationId)) {
        continue;
      }

      processedInstallations.add(installation.installationId);

      // Only create candidate if rule allows auto-creation
      if (rule.autoCreateCandidates) {
        try {
          const candidate = await repository.createCandidate({
            installationId: installation.installationId,
            daysSinceLastUse: installation.daysSinceLastUse,
            reclamationRuleId: rule.ruleId,
            usageAtIdentification: installation.usageMinutes30Day,
            notes: `Identified by rule: ${rule.ruleName}`,
          });

          allCandidates.push(candidate);

          // Calculate potential savings
          if (installation.unitCost) {
            totalPotentialSavings += installation.unitCost;
          }

          // Publish event for each candidate identified
          await publishEvent('RECLAMATION_CANDIDATE_IDENTIFIED', {
            candidateId: candidate.candidateId,
            installationId: installation.installationId,
            productName: installation.productName,
            publisher: installation.publisher,
            daysSinceLastUse: installation.daysSinceLastUse,
            ruleId: rule.ruleId,
            ruleName: rule.ruleName,
            assignedToUserId: installation.assignedToUserId,
            potentialSavings: installation.unitCost,
          });
        } catch (error) {
          logger.error('Failed to create reclamation candidate', error as Error, {
            runId,
            installationId: installation.installationId,
            ruleId: rule.ruleId,
          });
        }
      }
    }
  }

  const completedAt = now();

  // Invalidate cache
  await cache.del(reclamationCandidatesCacheKey());
  await cache.del(reclamationSummaryCacheKey());

  // Publish run completed event
  await publishEvent('RECLAMATION_IDENTIFICATION_COMPLETED', {
    runId,
    startedAt,
    completedAt,
    rulesApplied: rulesToApply.length,
    installationsScanned: totalInstallationsScanned,
    candidatesIdentified: allCandidates.length,
    potentialSavings: totalPotentialSavings,
  });

  logger.info('Reclamation candidate identification completed', {
    runId,
    rulesApplied: rulesToApply.length,
    installationsScanned: totalInstallationsScanned,
    candidatesIdentified: allCandidates.length,
    potentialSavings: totalPotentialSavings,
  });

  return {
    runId,
    startedAt,
    completedAt,
    rulesApplied: rulesToApply.length,
    installationsScanned: totalInstallationsScanned,
    candidatesIdentified: allCandidates.length,
    candidates: allCandidates,
    potentialSavings: totalPotentialSavings,
  };
}

/**
 * Initiate reclamation workflow for a candidate
 * Requirement 4.7: Trigger uninstallation workflows and return licenses to available pool
 *
 * @param candidateId - Reclamation candidate ID
 * @param options - Workflow options
 * @returns Initiation result
 */
export async function initiateReclamation(
  candidateId: UUID,
  options: ReclamationWorkflowOptions = {}
): Promise<InitiateReclamationResult> {
  logger.info('Initiating reclamation workflow', { candidateId, options });

  // Get candidate
  const candidate = await repository.getCandidateById(candidateId);
  if (!candidate) {
    throw new Error(`Reclamation candidate not found: ${candidateId}`);
  }

  // Validate current status allows initiation
  const validStatuses: ReclamationStatus[] = ['IDENTIFIED', 'PENDING_APPROVAL', 'APPROVED'];
  if (!validStatuses.includes(candidate.status)) {
    throw new Error(
      `Cannot initiate reclamation for candidate in status: ${candidate.status}. ` +
        `Valid statuses: ${validStatuses.join(', ')}`
    );
  }

  // Get rule for approval requirements
  const rule = candidate.reclamationRuleId
    ? await repository.getRuleById(candidate.reclamationRuleId)
    : null;

  const requiresApproval = !options.skipApproval && (rule?.requireApproval ?? true);
  const shouldNotifyUser = !options.skipNotification && (rule?.notifyUser ?? true);
  const shouldNotifyManager = !options.skipNotification && (rule?.notifyManager ?? true);

  // Generate workflow ID
  const workflowId = uuidv4();
  const timestamp = now();

  // Determine initial status based on requirements
  let newStatus: ReclamationStatus;
  if (requiresApproval && candidate.status !== 'APPROVED') {
    newStatus = 'PENDING_APPROVAL';
  } else {
    newStatus = 'IN_PROGRESS';
  }

  // Calculate scheduled action date
  const notificationDays = rule?.notificationDaysBeforeAction ?? 14;
  const scheduledActionDate = options.scheduledDate ?? calculateScheduledDate(notificationDays);

  // Update candidate with workflow information
  const updatedCandidate = await repository.updateCandidateStatus(candidateId, newStatus, {
    workflowId,
    userNotifiedAt: shouldNotifyUser ? timestamp : undefined,
    managerNotifiedAt: shouldNotifyManager ? timestamp : undefined,
    approvalRequestedAt: requiresApproval ? timestamp : undefined,
    actionScheduledAt: scheduledActionDate,
    actionType: options.actionType ?? 'UNINSTALL',
    notes: options.notes,
  });

  // Invalidate cache
  await cache.del(reclamationCandidatesCacheKey());
  await cache.del(reclamationSummaryCacheKey());

  // Publish workflow initiated event
  await publishEvent('RECLAMATION_WORKFLOW_INITIATED', {
    candidateId,
    installationId: candidate.installationId,
    workflowId,
    status: newStatus,
    requiresApproval,
    userNotified: shouldNotifyUser,
    managerNotified: shouldNotifyManager,
    scheduledActionDate,
    actionType: options.actionType ?? 'UNINSTALL',
    initiatedBy: options.initiatedBy,
  });

  // If notifications are enabled, publish notification events
  if (shouldNotifyUser) {
    await publishEvent('RECLAMATION_USER_NOTIFICATION', {
      candidateId,
      installationId: candidate.installationId,
      workflowId,
      notificationType: 'RECLAMATION_PENDING',
      scheduledActionDate,
    });
  }

  if (shouldNotifyManager) {
    await publishEvent('RECLAMATION_MANAGER_NOTIFICATION', {
      candidateId,
      installationId: candidate.installationId,
      workflowId,
      notificationType: 'RECLAMATION_PENDING',
      scheduledActionDate,
    });
  }

  logger.info('Reclamation workflow initiated', {
    candidateId,
    workflowId,
    status: newStatus,
    requiresApproval,
    scheduledActionDate,
  });

  return {
    candidateId,
    installationId: updatedCandidate.installationId,
    workflowId,
    status: newStatus,
    requiresApproval,
    userNotified: shouldNotifyUser,
    managerNotified: shouldNotifyManager,
    scheduledActionDate,
  };
}

/**
 * Approve reclamation candidate
 */
export async function approveReclamation(
  candidateId: UUID,
  approvedBy: UUID,
  notes?: string
): Promise<ReclamationCandidate> {
  logger.info('Approving reclamation', { candidateId, approvedBy });

  const candidate = await repository.getCandidateById(candidateId);
  if (!candidate) {
    throw new Error(`Reclamation candidate not found: ${candidateId}`);
  }

  if (candidate.status !== 'PENDING_APPROVAL') {
    throw new Error(`Cannot approve candidate in status: ${candidate.status}`);
  }

  const timestamp = now();
  const updatedCandidate = await repository.updateCandidateStatus(candidateId, 'APPROVED', {
    approvedBy,
    approvedAt: timestamp,
    notes: notes ?? candidate.notes ?? undefined,
  });

  await cache.del(reclamationCandidatesCacheKey());
  await cache.del(reclamationSummaryCacheKey());

  await publishEvent('RECLAMATION_APPROVED', {
    candidateId,
    installationId: candidate.installationId,
    workflowId: candidate.workflowId,
    approvedBy,
    approvedAt: timestamp,
  });

  logger.info('Reclamation approved', { candidateId, approvedBy });

  return updatedCandidate;
}

/**
 * Reject reclamation candidate
 */
export async function rejectReclamation(
  candidateId: UUID,
  rejectedBy: UUID,
  reason: string
): Promise<ReclamationCandidate> {
  logger.info('Rejecting reclamation', { candidateId, rejectedBy, reason });

  const candidate = await repository.getCandidateById(candidateId);
  if (!candidate) {
    throw new Error(`Reclamation candidate not found: ${candidateId}`);
  }

  if (!['PENDING_APPROVAL', 'IDENTIFIED'].includes(candidate.status)) {
    throw new Error(`Cannot reject candidate in status: ${candidate.status}`);
  }

  const updatedCandidate = await repository.updateCandidateStatus(candidateId, 'REJECTED', {
    rejectionReason: reason,
    notes: `Rejected by ${rejectedBy}: ${reason}`,
  });

  await cache.del(reclamationCandidatesCacheKey());
  await cache.del(reclamationSummaryCacheKey());

  await publishEvent('RECLAMATION_REJECTED', {
    candidateId,
    installationId: candidate.installationId,
    workflowId: candidate.workflowId,
    rejectedBy,
    reason,
  });

  logger.info('Reclamation rejected', { candidateId, rejectedBy, reason });

  return updatedCandidate;
}

/**
 * Complete reclamation and return license to pool
 * Requirement 4.7: Return licenses to the available pool
 */
export async function completeReclamation(
  candidateId: UUID,
  result: {
    actionResult: string;
    licenseRecovered: boolean;
    entitlementId?: UUID;
  }
): Promise<ReclamationCandidate> {
  logger.info('Completing reclamation', { candidateId, result });

  const candidate = await repository.getCandidateById(candidateId);
  if (!candidate) {
    throw new Error(`Reclamation candidate not found: ${candidateId}`);
  }

  if (!['APPROVED', 'IN_PROGRESS'].includes(candidate.status)) {
    throw new Error(`Cannot complete candidate in status: ${candidate.status}`);
  }

  const timestamp = now();

  // Update candidate status
  const updatedCandidate = await repository.updateCandidateStatus(candidateId, 'COMPLETED', {
    actionCompletedAt: timestamp,
    actionResult: result.actionResult,
    licenseRecovered: result.licenseRecovered,
    licenseRecoveredAt: result.licenseRecovered ? timestamp : undefined,
    entitlementId: result.entitlementId,
  });

  // Mark installation as reclaimed
  await repository.markInstallationReclaimed(candidate.installationId);

  // Return license to pool if recovered
  if (result.licenseRecovered && result.entitlementId) {
    await repository.returnLicenseToPool(result.entitlementId);
  }

  await cache.del(reclamationCandidatesCacheKey());
  await cache.del(reclamationSummaryCacheKey());

  await publishEvent('RECLAMATION_COMPLETED', {
    candidateId,
    installationId: candidate.installationId,
    workflowId: candidate.workflowId,
    actionResult: result.actionResult,
    licenseRecovered: result.licenseRecovered,
    entitlementId: result.entitlementId,
    completedAt: timestamp,
  });

  logger.info('Reclamation completed', {
    candidateId,
    licenseRecovered: result.licenseRecovered,
  });

  return updatedCandidate;
}

/**
 * Cancel reclamation
 */
export async function cancelReclamation(
  candidateId: UUID,
  reason: string
): Promise<ReclamationCandidate> {
  logger.info('Cancelling reclamation', { candidateId, reason });

  const candidate = await repository.getCandidateById(candidateId);
  if (!candidate) {
    throw new Error(`Reclamation candidate not found: ${candidateId}`);
  }

  const nonCancellableStatuses: ReclamationStatus[] = ['COMPLETED', 'CANCELLED'];
  if (nonCancellableStatuses.includes(candidate.status)) {
    throw new Error(`Cannot cancel candidate in status: ${candidate.status}`);
  }

  const updatedCandidate = await repository.updateCandidateStatus(candidateId, 'CANCELLED', {
    notes: `Cancelled: ${reason}`,
  });

  await cache.del(reclamationCandidatesCacheKey());
  await cache.del(reclamationSummaryCacheKey());

  await publishEvent('RECLAMATION_CANCELLED', {
    candidateId,
    installationId: candidate.installationId,
    workflowId: candidate.workflowId,
    reason,
  });

  logger.info('Reclamation cancelled', { candidateId, reason });

  return updatedCandidate;
}

/**
 * Get reclamation candidate by ID
 */
export async function getReclamationCandidate(
  candidateId: UUID
): Promise<ReclamationCandidate | null> {
  return repository.getCandidateById(candidateId);
}

/**
 * Get reclamation candidates with details
 */
export async function getReclamationCandidates(
  status?: ReclamationStatus | ReclamationStatus[],
  limit = 100
): Promise<ReclamationCandidateWithDetails[]> {
  return repository.getCandidatesWithDetails(status, limit);
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
  // Try cache first
  const cacheKey = reclamationSummaryCacheKey();
  const cached = await cache.get<{
    totalCandidates: number;
    byStatus: Record<string, number>;
    potentialSavings: number;
    licensesRecovered: number;
  }>(cacheKey);

  if (cached) {
    return cached;
  }

  const summary = await repository.getReclamationSummary();

  // Cache the result
  await cache.set(cacheKey, summary, cache.DEFAULT_TTL.SHORT);

  return summary;
}

/**
 * Calculate scheduled action date based on notification days
 */
function calculateScheduledDate(notificationDays: number): string {
  const date = new Date();
  date.setDate(date.getDate() + notificationDays);
  return date.toISOString();
}

// Re-export types
export type {
  CreateReclamationCandidateRequest,
  InstallationUsageDetails,
  ReclamationCandidate,
  ReclamationCandidateWithDetails,
  ReclamationRule,
} from './reclamation-repository';
