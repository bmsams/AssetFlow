/**
 * Publisher Pack module exports
 *
 * Provides vendor-specific license calculation functionality:
 * - Microsoft license calculations (per-core, per-user, O365) (Requirement 4.3)
 * - Oracle license calculations (database options, management packs) (Requirement 4.4)
 * - Adobe and Salesforce license calculations (Requirement 4.5)
 */

export * from './publisher-pack-service';
export * from './publisher-pack-repository';
