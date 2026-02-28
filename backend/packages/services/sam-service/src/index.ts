/**
 * @ams/sam-service - Software Asset Management Service
 *
 * Provides software-specific asset management operations including:
 * - Reconciliation Engine for license compliance (Requirements 4.1, 4.2)
 * - Publisher Pack Service for vendor-specific calculations (Requirements 4.3, 4.4, 4.5)
 * - Reclamation Service for unused software (Requirements 4.6, 4.7)
 * - Shadow IT Detection (Requirements 4.8, 4.9)
 * - SaaS License Management (Requirements 4.11, 4.12, 4.13)
 * - Compliance Reporting (Requirement 4.14)
 */

// Export modules with namespaces to avoid conflicts
export * as reconciliation from './reconciliation';
export * as publisherPack from './publisher-pack';
export * as reclamation from './reclamation';
export * as shadowIt from './shadow-it';
export * as saasLicense from './saas-license';
export * as complianceReport from './compliance-report';
