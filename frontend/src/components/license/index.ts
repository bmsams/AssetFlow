/**
 * License Workbench Components
 * Implements Requirement 12.5: License Workbench
 * Implements Requirement 4.10: Display compliance positions, audit risks, and optimization opportunities
 */

export { CompliancePositionsList } from './CompliancePositionsList';
export type { CompliancePositionsListProps } from './CompliancePositionsList';

export { AuditRisksList } from './AuditRisksList';
export type { AuditRisksListProps } from './AuditRisksList';

export { ReclamationOpportunitiesList } from './ReclamationOpportunitiesList';
export type { ReclamationOpportunitiesListProps } from './ReclamationOpportunitiesList';

// Mock data exports for development
export {
  mockCompliancePositions,
  mockAuditRisks,
  mockReclamationOpportunities,
  mockLicenseWorkbenchSummary,
  simulateApiDelay,
} from './mockData';
