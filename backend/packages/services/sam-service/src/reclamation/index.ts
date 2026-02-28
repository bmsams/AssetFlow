/**
 * Reclamation module exports
 *
 * Provides software license reclamation functionality:
 * - Identify software installations not used within configurable time periods (Requirement 4.6)
 * - Trigger uninstallation workflows and return licenses to available pool (Requirement 4.7)
 */

// Export types from @ams/types (re-exported for convenience)
export type { ReclamationStatus } from '@ams/types';

// Export types from repository
export type {
  ReclamationRule,
  ReclamationCandidate,
  ReclamationCandidateWithDetails,
  CreateReclamationCandidateRequest,
} from './reclamation-repository';

// Export repository functions (low-level data access)
export {
  getActiveRules,
  getRuleById,
  getRulesForProduct,
  findUnusedInstallations,
  createCandidate,
  getCandidateById,
  getCandidateByInstallationId,
  getCandidatesByStatus,
  getCandidatesWithDetails,
  updateCandidateStatus,
  markInstallationReclaimed,
  returnLicenseToPool,
} from './reclamation-repository';

// Export service functions (business logic)
export {
  getReclamationRules,
  getReclamationRule,
  identifyReclamationCandidates,
  initiateReclamation,
  approveReclamation,
  rejectReclamation,
  completeReclamation,
  cancelReclamation,
  getReclamationCandidate,
  getReclamationCandidates,
  getReclamationSummary,
} from './reclamation-service';

// Export service types
export type {
  ReclamationWorkflowOptions,
  IdentifyReclamationResult,
  InitiateReclamationResult,
} from './reclamation-service';
