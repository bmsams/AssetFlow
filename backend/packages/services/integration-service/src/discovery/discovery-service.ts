/**
 * Discovery Integration Service - Business logic layer
 *
 * Implements:
 * - Ingest discovery data from SCCM, Jamf, Tanium (Requirement 7.1)
 * - Match discovery records to existing assets (Requirement 7.2)
 * - Create new assets for unmatched discovery records (Requirement 7.2)
 */

import type { UUID } from '@ams/types';
import * as cache from '@ams/cache';
import { CACHE_ENTITY_TYPES } from '@ams/cache';
import { publishEvent } from '@ams/events';
import { createLogger } from '@ams/utils';

import type {
  DiscoveryRecord,
  DiscoveryRecordResult,
  DiscoveryRecordStatus,
  DiscoverySourceType,
  IngestionError,
  IngestionResult,
  JamfComputer,
  JamfMobileDevice,
  JamfPayload,
  SCCMPayload,
  TaniumPayload,
} from './discovery-types';
import * as repository from './discovery-repository';

const logger = createLogger({ service: 'discovery-service' });

/**
 * Process a single discovery record - match or create asset
 * Requirement 7.2: Match discovery records to existing assets or create new records
 */
async function processDiscoveryRecord(
  sourceType: DiscoverySourceType,
  sourceId: string,
  sourceName: string,
  serialNumber: string | undefined,
  macAddress: string | undefined,
  hostname: string | undefined,
  manufacturer: string | undefined,
  model: string | undefined,
  operatingSystem: string | undefined,
  osVersion: string | undefined,
  ipAddress: string | undefined,
  lastSeen: string,
  rawData: Record<string, unknown>,
  autoCreateAssets: boolean
): Promise<DiscoveryRecordResult> {
  try {
    // Check if we already have this discovery record
    const existingRecord = await repository.findDiscoveryRecordBySourceId(sourceType, sourceId);
    
    if (existingRecord && existingRecord.status !== 'PENDING') {
      // Update existing record with new data
      await repository.updateDiscoveryRecordStatus(
        existingRecord.discoveryRecordId,
        existingRecord.status,
        existingRecord.matchedAssetId,
        existingRecord.createdAssetId
      );
      
      // If already matched/created, update the asset with latest discovery data
      const assetId = existingRecord.matchedAssetId ?? existingRecord.createdAssetId;
      if (assetId) {
        await repository.updateHardwareAssetFromDiscovery(
          assetId,
          operatingSystem,
          ipAddress,
          lastSeen
        );
      }

      return {
        sourceId,
        serialNumber,
        macAddress,
        hostname,
        status: existingRecord.status,
        assetId,
        matchType: existingRecord.matchedAssetId ? 'SERIAL_NUMBER' : undefined,
      };
    }

    // Try to match to existing asset
    const matchResult = await repository.matchDiscoveryRecordToAsset(serialNumber, macAddress);

    let status: DiscoveryRecordStatus;
    let assetId: UUID | undefined;
    let matchType: 'SERIAL_NUMBER' | 'MAC_ADDRESS' | 'HOSTNAME' | undefined;

    if (matchResult.matched && matchResult.assetId) {
      // Asset found - update it with discovery data
      status = 'MATCHED';
      assetId = matchResult.assetId;
      matchType = matchResult.matchType;

      await repository.updateHardwareAssetFromDiscovery(
        assetId,
        operatingSystem,
        ipAddress,
        lastSeen
      );

      logger.info('Discovery record matched to existing asset', {
        sourceId,
        assetId,
        matchType,
        confidence: matchResult.confidence,
      });
    } else if (autoCreateAssets) {
      // No match found - create new asset
      assetId = await repository.createHardwareAssetFromDiscovery(
        serialNumber,
        macAddress,
        hostname,
        manufacturer,
        model,
        operatingSystem,
        ipAddress
      );
      status = 'CREATED';

      logger.info('New asset created from discovery record', {
        sourceId,
        assetId,
        serialNumber,
        macAddress,
      });
    } else {
      // No match and auto-create disabled
      status = 'PENDING';
      logger.info('Discovery record pending - no match and auto-create disabled', {
        sourceId,
        serialNumber,
        macAddress,
      });
    }

    // Create or update discovery record
    if (existingRecord) {
      await repository.updateDiscoveryRecordStatus(
        existingRecord.discoveryRecordId,
        status,
        matchResult.matched ? assetId : undefined,
        !matchResult.matched && status === 'CREATED' ? assetId : undefined
      );
    } else {
      await repository.createDiscoveryRecord({
        sourceType,
        sourceId,
        sourceName,
        serialNumber,
        macAddress,
        hostname,
        manufacturer,
        model,
        operatingSystem,
        osVersion,
        ipAddress,
        lastSeen,
        discoveredAt: new Date().toISOString(),
        status,
        matchedAssetId: matchResult.matched ? assetId : undefined,
        createdAssetId: !matchResult.matched && status === 'CREATED' ? assetId : undefined,
        rawData,
      });
    }

    return {
      sourceId,
      serialNumber,
      macAddress,
      hostname,
      status,
      assetId,
      matchType,
    };
  } catch (error) {
    const err = error as Error;
    logger.error('Failed to process discovery record', err, {
      sourceId,
      serialNumber,
      macAddress,
    });

    // Record the failure
    try {
      await repository.createDiscoveryRecord({
        sourceType,
        sourceId,
        sourceName,
        serialNumber,
        macAddress,
        hostname,
        manufacturer,
        model,
        operatingSystem,
        osVersion,
        ipAddress,
        lastSeen,
        discoveredAt: new Date().toISOString(),
        status: 'FAILED',
        errorMessage: err.message,
        rawData,
      });
    } catch (recordError) {
      logger.error('Failed to record discovery failure', recordError as Error);
    }

    return {
      sourceId,
      serialNumber,
      macAddress,
      hostname,
      status: 'FAILED',
      errorMessage: err.message,
    };
  }
}

/**
 * Ingest SCCM (Microsoft System Center Configuration Manager) data
 * Requirement 7.1: Ingest asset data from SCCM
 */
export async function ingestSCCMData(data: SCCMPayload): Promise<IngestionResult> {
  const startTime = Date.now();
  const sourceName = data.collectionName ?? 'SCCM';
  
  logger.info('Starting SCCM data ingestion', {
    deviceCount: data.devices.length,
    collectionId: data.collectionId,
    collectionName: data.collectionName,
  });

  // Get source configuration
  const sourceConfig = await repository.getDiscoverySourceConfig('SCCM', sourceName);
  const autoCreateAssets = sourceConfig?.autoCreateAssets ?? true;

  const records: DiscoveryRecordResult[] = [];
  const errors: IngestionError[] = [];
  let matchedCount = 0;
  let createdCount = 0;
  let failedCount = 0;
  let ignoredCount = 0;

  for (const device of data.devices) {
    // Skip devices without identifiable information
    if (!device.serialNumber && (!device.macAddresses || device.macAddresses.length === 0)) {
      ignoredCount++;
      records.push({
        sourceId: device.resourceId,
        hostname: device.name,
        status: 'IGNORED',
        errorMessage: 'No serial number or MAC address available',
      });
      continue;
    }

    const result = await processDiscoveryRecord(
      'SCCM',
      device.resourceId,
      sourceName,
      device.serialNumber,
      device.macAddresses?.[0],
      device.name,
      device.manufacturer,
      device.model,
      device.operatingSystem,
      device.operatingSystemVersion,
      device.ipAddresses?.[0],
      device.lastActiveTime ?? data.syncTimestamp,
      device as unknown as Record<string, unknown>,
      autoCreateAssets
    );

    records.push(result);

    switch (result.status) {
      case 'MATCHED':
        matchedCount++;
        break;
      case 'CREATED':
        createdCount++;
        break;
      case 'FAILED':
        failedCount++;
        if (result.errorMessage) {
          errors.push({
            sourceId: device.resourceId,
            errorCode: 'PROCESSING_ERROR',
            errorMessage: result.errorMessage,
            timestamp: new Date().toISOString(),
          });
        }
        break;
    }
  }

  // Update last sync timestamp
  if (sourceConfig) {
    await repository.updateDiscoverySourceLastSync('SCCM', sourceName);
  }

  const processingTimeMs = Date.now() - startTime;

  logger.info('SCCM data ingestion completed', {
    totalRecords: data.devices.length,
    matchedCount,
    createdCount,
    failedCount,
    ignoredCount,
    processingTimeMs,
  });

  const result: IngestionResult = {
    sourceType: 'SCCM',
    sourceName,
    syncTimestamp: data.syncTimestamp,
    totalRecords: data.devices.length,
    matchedCount,
    createdCount,
    failedCount,
    ignoredCount,
    records,
    errors,
    processingTimeMs,
  };

  // Publish discovery ingestion event
  await publishEvent('DISCOVERY_DATA_INGESTED', {
    sourceType: 'SCCM',
    sourceName,
    totalRecords: data.devices.length,
    matchedCount,
    createdCount,
  });

  // Invalidate discovery cache
  await cache.deletePattern(`ams:${CACHE_ENTITY_TYPES.DISCOVERY}:*`);

  return result;
}

/**
 * Process a Jamf computer record
 */
function processJamfComputer(computer: JamfComputer): {
  sourceId: string;
  serialNumber?: string;
  macAddress?: string;
  hostname?: string;
  manufacturer?: string;
  model?: string;
  operatingSystem?: string;
  osVersion?: string;
  ipAddress?: string;
  lastSeen: string;
  rawData: Record<string, unknown>;
} {
  return {
    sourceId: `computer-${computer.id}`,
    serialNumber: computer.serialNumber,
    macAddress: computer.macAddress ?? computer.altMacAddress,
    hostname: computer.name,
    manufacturer: computer.make ?? 'Apple',
    model: computer.model,
    operatingSystem: computer.osName,
    osVersion: computer.osVersion,
    ipAddress: computer.ipAddress ?? computer.lastReportedIp,
    lastSeen: computer.lastContactTime ?? new Date().toISOString(),
    rawData: computer as unknown as Record<string, unknown>,
  };
}

/**
 * Process a Jamf mobile device record
 */
function processJamfMobileDevice(device: JamfMobileDevice): {
  sourceId: string;
  serialNumber?: string;
  macAddress?: string;
  hostname?: string;
  manufacturer?: string;
  model?: string;
  operatingSystem?: string;
  osVersion?: string;
  ipAddress?: string;
  lastSeen: string;
  rawData: Record<string, unknown>;
} {
  return {
    sourceId: `mobile-${device.id}`,
    serialNumber: device.serialNumber,
    macAddress: device.wifiMacAddress ?? device.bluetoothMacAddress,
    hostname: device.name,
    manufacturer: 'Apple',
    model: device.modelDisplay ?? device.model,
    operatingSystem: device.osType,
    osVersion: device.osVersion,
    ipAddress: device.ipAddress,
    lastSeen: device.lastInventoryUpdate ?? new Date().toISOString(),
    rawData: device as unknown as Record<string, unknown>,
  };
}

/**
 * Ingest Jamf (Apple device management) data
 * Requirement 7.1: Ingest asset data from Jamf
 */
export async function ingestJamfData(data: JamfPayload): Promise<IngestionResult> {
  const startTime = Date.now();
  const sourceName = 'Jamf';
  
  const totalDevices = (data.computers?.length ?? 0) + (data.mobileDevices?.length ?? 0);
  
  logger.info('Starting Jamf data ingestion', {
    computerCount: data.computers?.length ?? 0,
    mobileDeviceCount: data.mobileDevices?.length ?? 0,
    totalDevices,
  });

  // Get source configuration
  const sourceConfig = await repository.getDiscoverySourceConfig('JAMF', sourceName);
  const autoCreateAssets = sourceConfig?.autoCreateAssets ?? true;

  const records: DiscoveryRecordResult[] = [];
  const errors: IngestionError[] = [];
  let matchedCount = 0;
  let createdCount = 0;
  let failedCount = 0;
  let ignoredCount = 0;

  // Process computers (macOS devices)
  if (data.computers) {
    for (const computer of data.computers) {
      const processed = processJamfComputer(computer);

      // Skip devices without identifiable information
      if (!processed.serialNumber && !processed.macAddress) {
        ignoredCount++;
        records.push({
          sourceId: processed.sourceId,
          hostname: processed.hostname,
          status: 'IGNORED',
          errorMessage: 'No serial number or MAC address available',
        });
        continue;
      }

      const result = await processDiscoveryRecord(
        'JAMF',
        processed.sourceId,
        sourceName,
        processed.serialNumber,
        processed.macAddress,
        processed.hostname,
        processed.manufacturer,
        processed.model,
        processed.operatingSystem,
        processed.osVersion,
        processed.ipAddress,
        processed.lastSeen,
        processed.rawData,
        autoCreateAssets
      );

      records.push(result);

      switch (result.status) {
        case 'MATCHED':
          matchedCount++;
          break;
        case 'CREATED':
          createdCount++;
          break;
        case 'FAILED':
          failedCount++;
          if (result.errorMessage) {
            errors.push({
              sourceId: processed.sourceId,
              errorCode: 'PROCESSING_ERROR',
              errorMessage: result.errorMessage,
              timestamp: new Date().toISOString(),
            });
          }
          break;
      }
    }
  }

  // Process mobile devices (iOS/iPadOS)
  if (data.mobileDevices) {
    for (const device of data.mobileDevices) {
      const processed = processJamfMobileDevice(device);

      // Skip devices without identifiable information
      if (!processed.serialNumber && !processed.macAddress) {
        ignoredCount++;
        records.push({
          sourceId: processed.sourceId,
          hostname: processed.hostname,
          status: 'IGNORED',
          errorMessage: 'No serial number or MAC address available',
        });
        continue;
      }

      const result = await processDiscoveryRecord(
        'JAMF',
        processed.sourceId,
        sourceName,
        processed.serialNumber,
        processed.macAddress,
        processed.hostname,
        processed.manufacturer,
        processed.model,
        processed.operatingSystem,
        processed.osVersion,
        processed.ipAddress,
        processed.lastSeen,
        processed.rawData,
        autoCreateAssets
      );

      records.push(result);

      switch (result.status) {
        case 'MATCHED':
          matchedCount++;
          break;
        case 'CREATED':
          createdCount++;
          break;
        case 'FAILED':
          failedCount++;
          if (result.errorMessage) {
            errors.push({
              sourceId: processed.sourceId,
              errorCode: 'PROCESSING_ERROR',
              errorMessage: result.errorMessage,
              timestamp: new Date().toISOString(),
            });
          }
          break;
      }
    }
  }

  // Update last sync timestamp
  if (sourceConfig) {
    await repository.updateDiscoverySourceLastSync('JAMF', sourceName);
  }

  const processingTimeMs = Date.now() - startTime;

  logger.info('Jamf data ingestion completed', {
    totalRecords: totalDevices,
    matchedCount,
    createdCount,
    failedCount,
    ignoredCount,
    processingTimeMs,
  });

  const jamfResult: IngestionResult = {
    sourceType: 'JAMF',
    sourceName,
    syncTimestamp: data.syncTimestamp,
    totalRecords: totalDevices,
    matchedCount,
    createdCount,
    failedCount,
    ignoredCount,
    records,
    errors,
    processingTimeMs,
  };

  // Publish discovery ingestion event
  await publishEvent('DISCOVERY_DATA_INGESTED', {
    sourceType: 'JAMF',
    sourceName,
    totalRecords: totalDevices,
    matchedCount,
    createdCount,
  });

  // Invalidate discovery cache
  await cache.deletePattern(`ams:${CACHE_ENTITY_TYPES.DISCOVERY}:*`);

  return jamfResult;
}

/**
 * Ingest Tanium (endpoint management) data
 * Requirement 7.1: Ingest asset data from Tanium
 */
export async function ingestTaniumData(data: TaniumPayload): Promise<IngestionResult> {
  const startTime = Date.now();
  const sourceName = 'Tanium';
  
  logger.info('Starting Tanium data ingestion', {
    endpointCount: data.endpoints.length,
    questionId: data.questionId,
  });

  // Get source configuration
  const sourceConfig = await repository.getDiscoverySourceConfig('TANIUM', sourceName);
  const autoCreateAssets = sourceConfig?.autoCreateAssets ?? true;

  const records: DiscoveryRecordResult[] = [];
  const errors: IngestionError[] = [];
  let matchedCount = 0;
  let createdCount = 0;
  let failedCount = 0;
  let ignoredCount = 0;

  for (const endpoint of data.endpoints) {
    // Skip endpoints without identifiable information
    if (!endpoint.serialNumber && (!endpoint.macAddresses || endpoint.macAddresses.length === 0)) {
      ignoredCount++;
      records.push({
        sourceId: endpoint.computerID,
        hostname: endpoint.computerName,
        status: 'IGNORED',
        errorMessage: 'No serial number or MAC address available',
      });
      continue;
    }

    const result = await processDiscoveryRecord(
      'TANIUM',
      endpoint.computerID,
      sourceName,
      endpoint.serialNumber,
      endpoint.macAddresses?.[0],
      endpoint.computerName,
      endpoint.manufacturer,
      endpoint.model,
      endpoint.operatingSystem,
      endpoint.osGeneration,
      endpoint.ipAddresses?.[0],
      endpoint.lastSeenDate ?? data.syncTimestamp,
      endpoint as unknown as Record<string, unknown>,
      autoCreateAssets
    );

    records.push(result);

    switch (result.status) {
      case 'MATCHED':
        matchedCount++;
        break;
      case 'CREATED':
        createdCount++;
        break;
      case 'FAILED':
        failedCount++;
        if (result.errorMessage) {
          errors.push({
            sourceId: endpoint.computerID,
            errorCode: 'PROCESSING_ERROR',
            errorMessage: result.errorMessage,
            timestamp: new Date().toISOString(),
          });
        }
        break;
    }
  }

  // Update last sync timestamp
  if (sourceConfig) {
    await repository.updateDiscoverySourceLastSync('TANIUM', sourceName);
  }

  const processingTimeMs = Date.now() - startTime;

  logger.info('Tanium data ingestion completed', {
    totalRecords: data.endpoints.length,
    matchedCount,
    createdCount,
    failedCount,
    ignoredCount,
    processingTimeMs,
  });

  const taniumResult: IngestionResult = {
    sourceType: 'TANIUM',
    sourceName,
    syncTimestamp: data.syncTimestamp,
    totalRecords: data.endpoints.length,
    matchedCount,
    createdCount,
    failedCount,
    ignoredCount,
    records,
    errors,
    processingTimeMs,
  };

  // Publish discovery ingestion event
  await publishEvent('DISCOVERY_DATA_INGESTED', {
    sourceType: 'TANIUM',
    sourceName,
    totalRecords: data.endpoints.length,
    matchedCount,
    createdCount,
  });

  // Invalidate discovery cache
  await cache.deletePattern(`ams:${CACHE_ENTITY_TYPES.DISCOVERY}:*`);

  return taniumResult;
}

/**
 * Match a discovery record to an existing asset
 * Requirement 7.2: Match discovery records to existing assets
 */
export async function matchToExistingAsset(
  serialNumber?: string,
  macAddress?: string
): Promise<{ matched: boolean; assetId?: UUID; matchType?: 'SERIAL_NUMBER' | 'MAC_ADDRESS' }> {
  return repository.matchDiscoveryRecordToAsset(serialNumber, macAddress);
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
  return repository.getDiscoveryStatistics(sourceType, sourceName);
}

/**
 * Get discovery records by source
 */
export async function getDiscoveryRecords(
  sourceType: DiscoverySourceType,
  sourceName: string,
  limit = 100
): Promise<DiscoveryRecord[]> {
  return repository.getDiscoveryRecordsBySource(sourceType, sourceName, limit);
}
