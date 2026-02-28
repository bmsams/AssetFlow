/**
 * SAM API Service
 *
 * Provides methods for interacting with the SAM (Software Asset Management) Service.
 * Handles compliance, reclamation, and reconciliation data retrieval.
 *
 * Implements Task 5.1: Create SAM API client
 * Validates: Requirement 4.2
 */

import { apiClient, ApiError } from './api-client';
import type {
  CompliancePosition,
  ReclamationOpportunity,
  LicenseWorkbenchSummary,
} from '../types/license';

// ============================================================================
// Types
// ============================================================================

export interface ReconciliationSummary {
  totalProducts: number;
  reconciled: number;
  unreconciled: number;
  lastReconciliationDate?: string;
}

// SAM Action Result Types

export interface ReconciliationResult {
  reconciled: number;
  unreconciled: number;
  newDiscrepancies: number;
  completedAt: string;
}

export interface ReclamationResult {
  initiated: number;
  estimatedSavings: number;
  completedAt: string;
}

export interface ShadowItReport {
  detectedApplications: number;
  riskLevel: 'low' | 'medium' | 'high';
  topApplications: Array<{ name: string; users: number; risk: string }>;
  generatedAt: string;
}

export interface ComplianceReport {
  reportId: string;
  totalTitles: number;
  compliant: number;
  nonCompliant: number;
  generatedAt: string;
  downloadUrl?: string;
}

export interface SyncResult {
  synced: number;
  errors: number;
  lastSyncAt: string;
}

export interface RulesResult {
  applied: number;
  updated: number;
  errors: number;
}

export interface UnusedSubscription {
  subscriptionId: string;
  productName: string;
  lastUsed?: string;
  monthlyCost: number;
  assignedTo: string;
}

// ============================================================================
// API Functions
// ============================================================================

/**
 * Get compliance positions for all software titles
 */
export async function getCompliancePositions(): Promise<CompliancePosition[]> {
  const response = await apiClient.get<CompliancePosition[] | { items: CompliancePosition[] }>(
    '/reconciliation/compliance'
  );

  if (!response.success || !response.data) {
    throw new ApiError(
      response.error?.code || 'FETCH_FAILED',
      response.error?.message || 'Failed to fetch compliance positions',
      400,
      response.requestId
    );
  }

  const data = response.data;
  return Array.isArray(data) ? data : data.items ?? [];
}

/**
 * Get reclamation candidates/opportunities
 */
export async function getReclamationCandidates(): Promise<ReclamationOpportunity[]> {
  const response = await apiClient.get<ReclamationOpportunity[] | { items: ReclamationOpportunity[] }>(
    '/reclamation/candidates'
  );

  if (!response.success || !response.data) {
    throw new ApiError(
      response.error?.code || 'FETCH_FAILED',
      response.error?.message || 'Failed to fetch reclamation candidates',
      400,
      response.requestId
    );
  }

  const data = response.data;
  return Array.isArray(data) ? data : data.items ?? [];
}

/**
 * Get reconciliation summary
 */
export async function getReconciliationSummary(): Promise<ReconciliationSummary> {
  const response = await apiClient.get<ReconciliationSummary>(
    '/reconciliation/summary'
  );

  if (!response.success || !response.data) {
    throw new ApiError(
      response.error?.code || 'FETCH_FAILED',
      response.error?.message || 'Failed to fetch reconciliation summary',
      400,
      response.requestId
    );
  }

  return response.data;
}

/**
 * Map backend CompliancePositionDetails (nested product object) to frontend CompliancePosition (flat)
 */
function mapBackendPosition(pos: Record<string, unknown>): CompliancePosition {
  const product = (pos.product ?? {}) as Record<string, unknown>;
  const entitlementDetails = (pos.entitlementDetails ?? {}) as Record<string, unknown>;
  const metricTypes = (entitlementDetails.metricTypes ?? []) as string[];
  return {
    productId: (pos.productId ?? '') as string,
    publisher: (product.publisher ?? 'Unknown') as string,
    productName: (product.productName ?? 'Unknown Product') as string,
    version: (product.version ?? '') as string,
    edition: (product.edition ?? undefined) as string | undefined,
    productCategory: (product.productCategory ?? '') as string,
    licenseMetricType: (metricTypes[0] ?? 'PER_USER') as CompliancePosition['licenseMetricType'],
    entitlementsOwned: Number(pos.entitlementsOwned ?? 0),
    installationsFound: Number(pos.installationsFound ?? 0),
    compliancePosition: (pos.compliancePosition ?? 'COMPLIANT') as CompliancePosition['compliancePosition'],
    overUnderCount: Number(pos.overUnderCount ?? 0),
    lastReconciledDate: (pos.lastReconciledAt ?? pos.lastReconciledDate ?? '') as string,
    unitCost: 0,
    totalEntitlementValue: 0,
    potentialExposure: 0,
  };
}

/**
 * Get full license workbench summary (aggregated data)
 */
export async function getLicenseWorkbenchSummary(): Promise<LicenseWorkbenchSummary> {
  const response = await apiClient.get<LicenseWorkbenchSummary>(
    '/sam/workbench/summary'
  );

  if (!response.success || !response.data) {
    throw new ApiError(
      response.error?.code || 'FETCH_FAILED',
      response.error?.message || 'Failed to fetch license workbench summary',
      400,
      response.requestId
    );
  }

  const data = response.data;
  // Map backend nested positions to frontend flat structure
  if (data.compliancePositions && data.compliancePositions.length > 0) {
    data.compliancePositions = data.compliancePositions.map(
      (p) => mapBackendPosition(p as unknown as Record<string, unknown>)
    );
  }
  return data;
}

// ============================================================================
// SAM Action Functions
// ============================================================================

/**
 * Run license reconciliation
 */
export async function runReconciliation(): Promise<ReconciliationResult> {
  const response = await apiClient.post<ReconciliationResult>(
    '/reconciliation/run'
  );

  if (!response.success || !response.data) {
    throw new ApiError(
      response.error?.code || 'ACTION_FAILED',
      response.error?.message || 'Failed to run reconciliation',
      400,
      response.requestId
    );
  }

  return response.data;
}

/**
 * Initiate license reclamation
 */
export async function initiateReclamation(): Promise<ReclamationResult> {
  const response = await apiClient.post<ReclamationResult>(
    '/reclamation/initiate'
  );

  if (!response.success || !response.data) {
    throw new ApiError(
      response.error?.code || 'ACTION_FAILED',
      response.error?.message || 'Failed to initiate reclamation',
      400,
      response.requestId
    );
  }

  return response.data;
}

/**
 * Analyze shadow IT
 */
export async function analyzeShadowIt(): Promise<ShadowItReport> {
  const response = await apiClient.post<ShadowItReport>(
    '/shadow-it/analyze'
  );

  if (!response.success || !response.data) {
    throw new ApiError(
      response.error?.code || 'ACTION_FAILED',
      response.error?.message || 'Failed to analyze shadow IT',
      400,
      response.requestId
    );
  }

  return response.data;
}

/**
 * Generate compliance report
 */
export async function generateComplianceReport(): Promise<ComplianceReport> {
  const response = await apiClient.post<ComplianceReport>(
    '/reconciliation/compliance-report'
  );

  if (!response.success || !response.data) {
    throw new ApiError(
      response.error?.code || 'ACTION_FAILED',
      response.error?.message || 'Failed to generate compliance report',
      400,
      response.requestId
    );
  }

  return response.data;
}

/**
 * Sync SaaS usage data
 */
export async function syncSaasUsage(): Promise<SyncResult> {
  const response = await apiClient.post<SyncResult>(
    '/saas/sync-usage'
  );

  if (!response.success || !response.data) {
    throw new ApiError(
      response.error?.code || 'ACTION_FAILED',
      response.error?.message || 'Failed to sync SaaS usage',
      400,
      response.requestId
    );
  }

  return response.data;
}

/**
 * Apply publisher normalization rules
 */
export async function applyPublisherRules(): Promise<RulesResult> {
  const response = await apiClient.post<RulesResult>(
    '/publisher-packs/apply'
  );

  if (!response.success || !response.data) {
    throw new ApiError(
      response.error?.code || 'ACTION_FAILED',
      response.error?.message || 'Failed to apply publisher rules',
      400,
      response.requestId
    );
  }

  return response.data;
}

/**
 * Get unused subscriptions
 */
export async function getUnusedSubscriptions(): Promise<UnusedSubscription[]> {
  const response = await apiClient.get<UnusedSubscription[] | { items: UnusedSubscription[] }>(
    '/reclamation/unused-subscriptions'
  );

  if (!response.success || !response.data) {
    throw new ApiError(
      response.error?.code || 'FETCH_FAILED',
      response.error?.message || 'Failed to fetch unused subscriptions',
      400,
      response.requestId
    );
  }

  const data = response.data;
  return Array.isArray(data) ? data : data.items ?? [];
}

export const samApi = {
  getCompliancePositions,
  getReclamationCandidates,
  getReconciliationSummary,
  getLicenseWorkbenchSummary,
  runReconciliation,
  initiateReclamation,
  analyzeShadowIt,
  generateComplianceReport,
  syncSaasUsage,
  applyPublisherRules,
  getUnusedSubscriptions,
};

export default samApi;
