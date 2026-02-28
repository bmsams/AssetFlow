/**
 * Discovery Integration Module
 *
 * Handles ingestion from discovery sources (SCCM, Jamf, Tanium)
 * and matching/creation of assets.
 *
 * Requirements:
 * - 7.1: Ingest asset data from SCCM, Jamf, Tanium, and custom discovery sources
 * - 7.2: Match discovery records to existing assets by serial_number and mac_address
 */

export * from './discovery-types';
export * from './discovery-service';
