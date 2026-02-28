/**
 * Reconciliation module exports
 *
 * Provides software license reconciliation functionality:
 * - Compare entitlements owned vs installations discovered (Requirement 4.1)
 * - Calculate compliance position (Requirement 4.2)
 */

// Export types from repository
export type {
  SoftwareProduct,
  Entitlement,
  SoftwareInstallation,
  ReconciliationResult,
  EntitlementSummary,
  InstallationSummary,
} from './reconciliation-repository';

// Export repository functions (low-level data access)
export {
  getProductById,
  getActiveProducts,
  getEntitlementsByProduct,
  getEntitlementSummary,
  getInstallationsByProduct,
  getInstallationSummary,
  getLatestReconciliationResult,
  getReconciliationResults,
  saveReconciliationResult,
  getProductsWithComplianceIssues,
} from './reconciliation-repository';

// Export service functions (business logic)
export {
  calculateComplianceStatus,
  calculateOverUnderCount,
  calculateCompliancePercentage,
  getEntitlements,
  getInstallations,
  runReconciliation,
  runReconciliationForAllProducts,
  getCompliancePosition,
  getCompliancePositions,
  getComplianceIssues,
  getProductsNeedingReconciliation,
} from './reconciliation-service';

// Export service types
export type {
  CompliancePositionDetails,
  ReconciliationRunResult,
} from './reconciliation-service';
