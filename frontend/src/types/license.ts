/**
 * License types for the Asset Management System
 * Implements Requirement 12.5: License Workbench
 * Implements Requirement 4.10: Display compliance positions, audit risks, and optimization opportunities
 */

/**
 * Compliance position status
 */
export type CompliancePositionStatus = 'COMPLIANT' | 'OVER_LICENSED' | 'UNDER_LICENSED';

/**
 * Audit risk level
 */
export type AuditRiskLevel = 'critical' | 'high' | 'medium' | 'low';

/**
 * Reclamation status
 */
export type ReclamationStatus = 'IDENTIFIED' | 'PENDING_APPROVAL' | 'APPROVED' | 'IN_PROGRESS' | 'COMPLETED' | 'CANCELLED';

/**
 * License metric type
 */
export type LicenseMetricType = 'PER_USER' | 'PER_DEVICE' | 'PER_CORE' | 'PER_PROCESSOR' | 'SUBSCRIPTION' | 'SITE' | 'ENTERPRISE' | 'CONCURRENT';

/**
 * Software compliance position
 */
export interface CompliancePosition {
  productId: string;
  publisher: string;
  productName: string;
  version: string;
  edition?: string;
  productCategory: string;
  licenseMetricType: LicenseMetricType;
  entitlementsOwned: number;
  installationsFound: number;
  compliancePosition: CompliancePositionStatus;
  overUnderCount: number;
  lastReconciledDate: string;
  unitCost: number;
  totalEntitlementValue: number;
  potentialExposure: number;
}

/**
 * Audit risk item
 */
export interface AuditRisk {
  riskId: string;
  productId: string;
  publisher: string;
  productName: string;
  riskLevel: AuditRiskLevel;
  riskType: string;
  description: string;
  underLicensedCount: number;
  estimatedExposure: number;
  recommendedAction: string;
  lastAssessedDate: string;
}

/**
 * Reclamation opportunity
 */
export interface ReclamationOpportunity {
  opportunityId: string;
  installationId: string;
  productId: string;
  publisher: string;
  productName: string;
  assignedTo: string;
  assignedToEmail: string;
  deviceName: string;
  lastUsedDate: string;
  daysSinceLastUse: number;
  reclamationStatus: ReclamationStatus;
  estimatedSavings: number;
  reclamationRuleName: string;
}

/**
 * License workbench summary
 */
export interface LicenseWorkbenchSummary {
  totalSoftwareTitles: number;
  compliantCount: number;
  overLicensedCount: number;
  underLicensedCount: number;
  totalEntitlementValue: number;
  totalPotentialExposure: number;
  totalReclamationSavings: number;
  criticalRisksCount: number;
  highRisksCount: number;
  reclamationOpportunitiesCount: number;
  compliancePositions: CompliancePosition[];
  auditRisks: AuditRisk[];
  reclamationOpportunities: ReclamationOpportunity[];
}

/**
 * Get compliance position color
 */
export function getCompliancePositionColor(status: CompliancePositionStatus): string {
  switch (status) {
    case 'COMPLIANT':
      return 'var(--color-success-500)';
    case 'OVER_LICENSED':
      return 'var(--color-warning-500)';
    case 'UNDER_LICENSED':
      return 'var(--color-error-500)';
    default:
      return 'var(--color-gray-500)';
  }
}

/**
 * Get audit risk color
 */
export function getAuditRiskColor(level: AuditRiskLevel): string {
  switch (level) {
    case 'critical':
      return 'var(--color-error-600)';
    case 'high':
      return 'var(--color-error-500)';
    case 'medium':
      return 'var(--color-warning-500)';
    case 'low':
      return 'var(--color-info-500)';
    default:
      return 'var(--color-gray-500)';
  }
}

/**
 * Get reclamation status color
 */
export function getReclamationStatusColor(status: ReclamationStatus): string {
  switch (status) {
    case 'IDENTIFIED':
      return 'var(--color-info-500)';
    case 'PENDING_APPROVAL':
      return 'var(--color-warning-500)';
    case 'APPROVED':
      return 'var(--color-primary-500)';
    case 'IN_PROGRESS':
      return 'var(--color-primary-600)';
    case 'COMPLETED':
      return 'var(--color-success-500)';
    case 'CANCELLED':
      return 'var(--color-gray-500)';
    default:
      return 'var(--color-gray-500)';
  }
}

/**
 * Format compliance position status for display
 */
export function formatComplianceStatus(status: CompliancePositionStatus): string {
  switch (status) {
    case 'COMPLIANT':
      return 'Compliant';
    case 'OVER_LICENSED':
      return 'Over-Licensed';
    case 'UNDER_LICENSED':
      return 'Under-Licensed';
    default:
      return status;
  }
}

/**
 * Format reclamation status for display
 */
export function formatReclamationStatus(status: ReclamationStatus): string {
  return status
    .split('_')
    .map(word => word.charAt(0) + word.slice(1).toLowerCase())
    .join(' ');
}

/**
 * Format license metric type for display
 */
export function formatLicenseMetricType(type: LicenseMetricType): string {
  switch (type) {
    case 'PER_USER':
      return 'Per User';
    case 'PER_DEVICE':
      return 'Per Device';
    case 'PER_CORE':
      return 'Per Core';
    case 'PER_PROCESSOR':
      return 'Per Processor';
    case 'SUBSCRIPTION':
      return 'Subscription';
    case 'SITE':
      return 'Site License';
    case 'ENTERPRISE':
      return 'Enterprise';
    case 'CONCURRENT':
      return 'Concurrent';
    default:
      return type;
  }
}

/**
 * Format currency value
 */
export function formatLicenseCurrency(value: number): string {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(value);
}

/**
 * Format date for display
 */
export function formatLicenseDate(dateString: string): string {
  const date = new Date(dateString);
  return date.toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });
}
