/**
 * @ams/lifecycle-service - Lifecycle Workflow Service
 *
 * Provides lifecycle workflow operations including:
 * - Request Service (Requirement 6.1, 6B.3, 6B.8)
 * - Approval Workflow Service (Requirement 6B.4, 6B.5, 6B.6)
 * - Procurement Service (Requirement 6.2, 6.3)
 * - Receiving Service (Requirement 6.4, 6.5)
 * - Deployment Service (Requirement 6.6, 6.7)
 * - Retirement Service (Requirement 6.8, 6.9)
 * - Contract Service (Requirement 6A.1, 6A.2, 6A.3)
 * - Service Catalog (Requirement 6B.1, 6B.2, 6B.9)
 */

// Export request module with namespace to avoid conflicts
export * as request from './request';

// Export approval workflow module with namespace
export * as approvalWorkflow from './approval-workflow';

// Export procurement module with namespace
export * as procurement from './procurement';

// Export receiving module with namespace
export * as receiving from './receiving';

// Export deployment module with namespace
export * as deployment from './deployment';

// Export retirement module with namespace
export * as retirement from './retirement';

// Export contract module with namespace
export * as contract from './contract';

// Export service catalog module with namespace
export * as serviceCatalog from './service-catalog';
