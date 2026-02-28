/**
 * Discovery Integration Repository - Data access layer
 *
 * Implements database operations for:
 * - Discovery record storage and retrieval
 * - Asset matching by serial_number and mac_address
 * - Asset creation from discovery data
 *
 * Requirements:
 * - 7.1: Ingest asset data from SCCM, Jamf, Tanium, and custom discovery sources
 * - 7.2: Match discovery records to existing assets by serial_number and mac_address
 */

import type { UUID } from '@ams/types';
import { queryMany, queryOne } from '@ams/database';
import { createLogger } from '@ams/utils';

import type {
  AssetMatchResult,
  DiscoveryRecord,
  DiscoveryRecordStatus,
  DiscoverySourceConfig,
  DiscoverySourceType,
} from './discovery-types';

const logger = createLogger({ service: 'discovery-repository' });

/**
 * Database row types
 */
interface DiscoveryRecordRow {
  discovery_record_id: string;
  source_type: DiscoverySourceType;
  source_id: string;
  source_name: string;
  serial_number: string | null;
  mac_address: string | null;
  hostname: string | null;
  manufacturer: string | null;
  model: string | null;
  operating_system: string | null;
  os_version: string | null;
  ip_address: string | null;
  last_seen: string;
  discovered_at: string;
  status: DiscoveryRecordStatus;
  matched_asset_id: string | null;
  created_asset_id: string | null;
  error_message: string | null;
  raw_data: string;
  created_at: string;
  updated_at: string;
}

interface HardwareAssetRow {
  asset_id: string;
  serial_number: string | null;
  mac_address: string | null;
}

interface DiscoverySourceConfigRow {
  source_id: string;
  source_type: DiscoverySourceType;
  source_name: string;
  is_active: boolean;
  auto_create_assets: boolean;
  match_by_serial_number: boolean;
  match_by_mac_address: boolean;
  sync_interval_minutes: number;
  last_sync_at: string | null;
  created_at: string;
  updated_at: string;
}

/**
 * Map database row to DiscoveryRecord entity
 */
function mapRowToDiscoveryRecord(row: DiscoveryRecordRow): DiscoveryRecord {
  return {
    discoveryRecordId: row.discovery_record_id,
    sourceType: row.source_type,
    sourceId: row.source_id,
    sourceName: row.source_name,
    serialNumber: row.serial_number ?? undefined,
    macAddress: row.mac_address ?? undefined,
    hostname: row.hostname ?? undefined,
    manufacturer: row.manufacturer ?? undefined,
    model: row.model ?? undefined,
    operatingSystem: row.operating_system ?? undefined,
    osVersion: row.os_version ?? undefined,
    ipAddress: row.ip_address ?? undefined,
    lastSeen: row.last_seen,
    discoveredAt: row.discovered_at,
    status: row.status,
    matchedAssetId: row.matched_asset_id ?? undefined,
    createdAssetId: row.created_asset_id ?? undefined,
    errorMessage: row.error_message ?? undefined,
    rawData: JSON.parse(row.raw_data),
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

/**
 * Map database row to DiscoverySourceConfig entity
 */
function mapRowToSourceConfig(row: DiscoverySourceConfigRow): DiscoverySourceConfig {
  return {
    sourceId: row.source_id,
    sourceType: row.source_type,
    sourceName: row.source_name,
    isActive: row.is_active,
    autoCreateAssets: row.auto_create_assets,
    matchBySerialNumber: row.match_by_serial_number,
    matchByMacAddress: row.match_by_mac_address,
    syncIntervalMinutes: row.sync_interval_minutes,
    lastSyncAt: row.last_sync_at ?? undefined,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

/**
 * Normalize MAC address for consistent matching
 * Converts to uppercase and removes separators
 */
export function normalizeMacAddress(macAddress: string): string {
  return macAddress
    .toUpperCase()
    .replace(/[:\-\.]/g, '')
    .trim();
}

/**
 * Normalize serial number for consistent matching
 * Converts to uppercase and trims whitespace
 */
export function normalizeSerialNumber(serialNumber: string): string {
  return serialNumber.toUpperCase().trim();
}

/**
 * Find existing asset by serial number
 * Requirement 7.2: Match discovery records to existing assets by serial_number
 */
export async function findAssetBySerialNumber(
  serialNumber: string
): Promise<AssetMatchResult> {
  const normalizedSerial = normalizeSerialNumber(serialNumber);
  
  logger.debug('Finding asset by serial number', { serialNumber: normalizedSerial });

  const result = await queryOne<HardwareAssetRow>(
    `SELECT asset_id, serial_number, mac_address
     FROM hardware_assets
     WHERE UPPER(TRIM(serial_number)) = $1`,
    [normalizedSerial]
  );

  if (result) {
    logger.info('Asset matched by serial number', {
      assetId: result.asset_id,
      serialNumber: normalizedSerial,
    });
    return {
      matched: true,
      assetId: result.asset_id,
      matchType: 'SERIAL_NUMBER',
      confidence: 100,
    };
  }

  return {
    matched: false,
    confidence: 0,
  };
}

/**
 * Find existing asset by MAC address
 * Requirement 7.2: Match discovery records to existing assets by mac_address
 */
export async function findAssetByMacAddress(
  macAddress: string
): Promise<AssetMatchResult> {
  const normalizedMac = normalizeMacAddress(macAddress);
  
  logger.debug('Finding asset by MAC address', { macAddress: normalizedMac });

  // Search for MAC address with various formats
  const result = await queryOne<HardwareAssetRow>(
    `SELECT asset_id, serial_number, mac_address
     FROM hardware_assets
     WHERE UPPER(REPLACE(REPLACE(REPLACE(mac_address, ':', ''), '-', ''), '.', '')) = $1`,
    [normalizedMac]
  );

  if (result) {
    logger.info('Asset matched by MAC address', {
      assetId: result.asset_id,
      macAddress: normalizedMac,
    });
    return {
      matched: true,
      assetId: result.asset_id,
      matchType: 'MAC_ADDRESS',
      confidence: 95, // Slightly lower confidence than serial number
    };
  }

  return {
    matched: false,
    confidence: 0,
  };
}

/**
 * Match discovery record to existing asset
 * Tries serial number first, then MAC address
 * Requirement 7.2: Match discovery records to existing assets
 */
export async function matchDiscoveryRecordToAsset(
  serialNumber?: string,
  macAddress?: string
): Promise<AssetMatchResult> {
  // Try serial number first (higher confidence)
  if (serialNumber) {
    const serialMatch = await findAssetBySerialNumber(serialNumber);
    if (serialMatch.matched) {
      return serialMatch;
    }
  }

  // Try MAC address if serial number didn't match
  if (macAddress) {
    const macMatch = await findAssetByMacAddress(macAddress);
    if (macMatch.matched) {
      return macMatch;
    }
  }

  return {
    matched: false,
    confidence: 0,
  };
}

/**
 * Create a new discovery record
 */
export async function createDiscoveryRecord(
  record: Omit<DiscoveryRecord, 'discoveryRecordId' | 'createdAt' | 'updatedAt'>
): Promise<DiscoveryRecord> {
  logger.info('Creating discovery record', {
    sourceType: record.sourceType,
    sourceId: record.sourceId,
    serialNumber: record.serialNumber,
    macAddress: record.macAddress,
  });

  const result = await queryOne<DiscoveryRecordRow>(
    `INSERT INTO discovery_records (
      source_type, source_id, source_name, serial_number, mac_address,
      hostname, manufacturer, model, operating_system, os_version,
      ip_address, last_seen, discovered_at, status, matched_asset_id,
      created_asset_id, error_message, raw_data
    ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18)
    RETURNING *`,
    [
      record.sourceType,
      record.sourceId,
      record.sourceName,
      record.serialNumber ?? null,
      record.macAddress ?? null,
      record.hostname ?? null,
      record.manufacturer ?? null,
      record.model ?? null,
      record.operatingSystem ?? null,
      record.osVersion ?? null,
      record.ipAddress ?? null,
      record.lastSeen,
      record.discoveredAt,
      record.status,
      record.matchedAssetId ?? null,
      record.createdAssetId ?? null,
      record.errorMessage ?? null,
      JSON.stringify(record.rawData),
    ]
  );

  if (!result) {
    throw new Error('Failed to create discovery record');
  }

  return mapRowToDiscoveryRecord(result);
}

/**
 * Update discovery record status
 */
export async function updateDiscoveryRecordStatus(
  discoveryRecordId: UUID,
  status: DiscoveryRecordStatus,
  matchedAssetId?: UUID,
  createdAssetId?: UUID,
  errorMessage?: string
): Promise<DiscoveryRecord | null> {
  logger.info('Updating discovery record status', {
    discoveryRecordId,
    status,
    matchedAssetId,
    createdAssetId,
  });

  const result = await queryOne<DiscoveryRecordRow>(
    `UPDATE discovery_records
     SET status = $2,
         matched_asset_id = COALESCE($3, matched_asset_id),
         created_asset_id = COALESCE($4, created_asset_id),
         error_message = $5,
         updated_at = NOW()
     WHERE discovery_record_id = $1
     RETURNING *`,
    [discoveryRecordId, status, matchedAssetId ?? null, createdAssetId ?? null, errorMessage ?? null]
  );

  return result ? mapRowToDiscoveryRecord(result) : null;
}

/**
 * Get discovery record by ID
 */
export async function getDiscoveryRecordById(
  discoveryRecordId: UUID
): Promise<DiscoveryRecord | null> {
  const result = await queryOne<DiscoveryRecordRow>(
    `SELECT * FROM discovery_records WHERE discovery_record_id = $1`,
    [discoveryRecordId]
  );

  return result ? mapRowToDiscoveryRecord(result) : null;
}

/**
 * Get discovery records by source
 */
export async function getDiscoveryRecordsBySource(
  sourceType: DiscoverySourceType,
  sourceName: string,
  limit = 100
): Promise<DiscoveryRecord[]> {
  const rows = await queryMany<DiscoveryRecordRow>(
    `SELECT * FROM discovery_records
     WHERE source_type = $1 AND source_name = $2
     ORDER BY discovered_at DESC
     LIMIT $3`,
    [sourceType, sourceName, limit]
  );

  return rows.map(mapRowToDiscoveryRecord);
}

/**
 * Find existing discovery record by source ID
 */
export async function findDiscoveryRecordBySourceId(
  sourceType: DiscoverySourceType,
  sourceId: string
): Promise<DiscoveryRecord | null> {
  const result = await queryOne<DiscoveryRecordRow>(
    `SELECT * FROM discovery_records
     WHERE source_type = $1 AND source_id = $2`,
    [sourceType, sourceId]
  );

  return result ? mapRowToDiscoveryRecord(result) : null;
}

/**
 * Create a new hardware asset from discovery data
 * Requirement 7.2: Create new assets for unmatched discovery records
 */
export async function createHardwareAssetFromDiscovery(
  serialNumber?: string,
  macAddress?: string,
  hostname?: string,
  _manufacturer?: string,
  _model?: string,
  operatingSystem?: string,
  ipAddress?: string,
  manufacturerId?: UUID,
  modelId?: UUID
): Promise<UUID> {
  logger.info('Creating hardware asset from discovery', {
    serialNumber,
    macAddress,
    hostname,
  });

  // First create the base asset record
  const assetResult = await queryOne<{ asset_id: string }>(
    `INSERT INTO assets (
      asset_type, display_name, status, created_at, updated_at
    ) VALUES ('HARDWARE', $1, 'DISCOVERED', NOW(), NOW())
    RETURNING asset_id`,
    [hostname ?? serialNumber ?? 'Unknown Device']
  );

  if (!assetResult) {
    throw new Error('Failed to create base asset record');
  }

  const assetId = assetResult.asset_id;

  // Create the hardware asset record
  await queryOne(
    `INSERT INTO hardware_assets (
      asset_id, serial_number, mac_address, manufacturer_id, model_id,
      operating_system, ip_address, last_discovered_at
    ) VALUES ($1, $2, $3, $4, $5, $6, $7, NOW())`,
    [
      assetId,
      serialNumber ?? null,
      macAddress ?? null,
      manufacturerId ?? null,
      modelId ?? null,
      operatingSystem ?? null,
      ipAddress ?? null,
    ]
  );

  logger.info('Hardware asset created from discovery', { assetId });

  return assetId;
}

/**
 * Update hardware asset with discovery data
 */
export async function updateHardwareAssetFromDiscovery(
  assetId: UUID,
  operatingSystem?: string,
  ipAddress?: string,
  lastSeen?: string
): Promise<void> {
  logger.info('Updating hardware asset from discovery', { assetId });

  await queryOne(
    `UPDATE hardware_assets
     SET operating_system = COALESCE($2, operating_system),
         ip_address = COALESCE($3, ip_address),
         last_discovered_at = COALESCE($4, last_discovered_at),
         updated_at = NOW()
     WHERE asset_id = $1`,
    [assetId, operatingSystem ?? null, ipAddress ?? null, lastSeen ?? null]
  );
}

/**
 * Get discovery source configuration
 */
export async function getDiscoverySourceConfig(
  sourceType: DiscoverySourceType,
  sourceName: string
): Promise<DiscoverySourceConfig | null> {
  const result = await queryOne<DiscoverySourceConfigRow>(
    `SELECT * FROM discovery_source_configs
     WHERE source_type = $1 AND source_name = $2`,
    [sourceType, sourceName]
  );

  return result ? mapRowToSourceConfig(result) : null;
}

/**
 * Update last sync timestamp for discovery source
 */
export async function updateDiscoverySourceLastSync(
  sourceType: DiscoverySourceType,
  sourceName: string
): Promise<void> {
  await queryOne(
    `UPDATE discovery_source_configs
     SET last_sync_at = NOW(), updated_at = NOW()
     WHERE source_type = $1 AND source_name = $2`,
    [sourceType, sourceName]
  );
}

/**
 * Get pending discovery records for processing
 */
export async function getPendingDiscoveryRecords(
  limit = 100
): Promise<DiscoveryRecord[]> {
  const rows = await queryMany<DiscoveryRecordRow>(
    `SELECT * FROM discovery_records
     WHERE status = 'PENDING'
     ORDER BY discovered_at ASC
     LIMIT $1`,
    [limit]
  );

  return rows.map(mapRowToDiscoveryRecord);
}

/**
 * Get discovery statistics for a source
 */
export async function getDiscoveryStatistics(
  sourceType: DiscoverySourceType,
  sourceName: string
): Promise<{
  total: number;
  matched: number;
  created: number;
  failed: number;
  pending: number;
}> {
  const result = await queryOne<{
    total: string;
    matched: string;
    created: string;
    failed: string;
    pending: string;
  }>(
    `SELECT
       COUNT(*) as total,
       COUNT(*) FILTER (WHERE status = 'MATCHED') as matched,
       COUNT(*) FILTER (WHERE status = 'CREATED') as created,
       COUNT(*) FILTER (WHERE status = 'FAILED') as failed,
       COUNT(*) FILTER (WHERE status = 'PENDING') as pending
     FROM discovery_records
     WHERE source_type = $1 AND source_name = $2`,
    [sourceType, sourceName]
  );

  return {
    total: parseInt(result?.total ?? '0', 10),
    matched: parseInt(result?.matched ?? '0', 10),
    created: parseInt(result?.created ?? '0', 10),
    failed: parseInt(result?.failed ?? '0', 10),
    pending: parseInt(result?.pending ?? '0', 10),
  };
}
