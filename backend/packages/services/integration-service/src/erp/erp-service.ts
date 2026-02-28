/**
 * ERP Integration Service - Business logic layer
 *
 * Implements:
 * - Sync purchase orders from ERP systems (Requirement 7.3)
 * - Sync cost centers from ERP systems (Requirement 7.4)
 * - Bidirectional data synchronization
 * - SAP, Oracle, Workday connector orchestration
 */

import * as cache from '@ams/cache';
import { CACHE_ENTITY_TYPES } from '@ams/cache';
import { publishEvent } from '@ams/events';
import { createLogger } from '@ams/utils';

import type {
  CostCenterSyncResult,
  ERPCostCenter,
  ERPPurchaseOrder,
  ERPRecordSyncResult,
  ERPSyncError,
  ERPSystemType,
  PurchaseOrderSyncResult,
  SyncCostCentersRequest,
  SyncPurchaseOrdersRequest,
} from './erp-types';
import * as repository from './erp-repository';
import { createSAPConnector } from './connectors/sap-connector';
import { createOracleConnector } from './connectors/oracle-connector';
import { createWorkdayConnector } from './connectors/workday-connector';

const logger = createLogger({ service: 'erp-service' });

/**
 * Get the appropriate ERP connector based on system type
 */
function getConnector(erpSystem: ERPSystemType) {
  switch (erpSystem) {
    case 'SAP':
      return createSAPConnector();
    case 'ORACLE':
      return createOracleConnector();
    case 'WORKDAY':
      return createWorkdayConnector();
    default:
      throw new Error(`Unsupported ERP system: ${erpSystem}`);
  }
}

/**
 * Process a single purchase order from ERP
 */
async function processPurchaseOrder(
  purchaseOrder: ERPPurchaseOrder
): Promise<ERPRecordSyncResult> {
  try {
    const result = await repository.upsertERPPurchaseOrder(purchaseOrder);
    
    return {
      erpRecordId: purchaseOrder.erpPurchaseOrderId,
      localRecordId: result.localPoId,
      operation: result.created ? 'CREATED' : 'UPDATED',
    };
  } catch (error) {
    const err = error as Error;
    logger.error('Failed to process purchase order', err, {
      erpPurchaseOrderId: purchaseOrder.erpPurchaseOrderId,
      poNumber: purchaseOrder.poNumber,
    });
    
    return {
      erpRecordId: purchaseOrder.erpPurchaseOrderId,
      operation: 'FAILED',
      errorMessage: err.message,
    };
  }
}

/**
 * Process a single cost center from ERP
 */
async function processCostCenter(
  costCenter: ERPCostCenter,
  createLocalRecords: boolean
): Promise<ERPRecordSyncResult> {
  try {
    const result = await repository.upsertERPCostCenter(costCenter);
    
    // Optionally create/update local cost center record
    let localRecordId = result.localCostCenterId;
    if (createLocalRecords && !localRecordId) {
      localRecordId = await repository.upsertLocalCostCenter(costCenter);
    }
    
    return {
      erpRecordId: costCenter.erpCostCenterId,
      localRecordId,
      operation: result.created ? 'CREATED' : 'UPDATED',
    };
  } catch (error) {
    const err = error as Error;
    logger.error('Failed to process cost center', err, {
      erpCostCenterId: costCenter.erpCostCenterId,
      costCenterCode: costCenter.costCenterCode,
    });
    
    return {
      erpRecordId: costCenter.erpCostCenterId,
      operation: 'FAILED',
      errorMessage: err.message,
    };
  }
}

/**
 * Sync purchase orders from ERP system
 * Requirement 7.3: Sync purchase orders from ERP systems (SAP, Oracle, Workday)
 */
export async function syncPurchaseOrders(
  request: SyncPurchaseOrdersRequest
): Promise<PurchaseOrderSyncResult> {
  const startTime = Date.now();
  const direction = request.direction ?? 'INBOUND';
  
  logger.info('Starting purchase order sync', {
    erpSystem: request.erpSystem,
    direction,
    fromDate: request.fromDate,
    toDate: request.toDate,
  });

  // Create audit log entry
  const auditLogId = await repository.createERPSyncAuditLog(
    request.erpSystem,
    'PURCHASE_ORDER_SYNC',
    direction
  );

  const records: ERPRecordSyncResult[] = [];
  const errors: ERPSyncError[] = [];
  let createdCount = 0;
  let updatedCount = 0;
  let skippedCount = 0;
  let failedCount = 0;

  try {
    const connector = getConnector(request.erpSystem);

    // Test connection first
    const isConnected = await connector.testConnection();
    if (!isConnected) {
      throw new Error(`Failed to connect to ${request.erpSystem} system`);
    }

    // Fetch purchase orders from ERP
    const purchaseOrders = await connector.fetchPurchaseOrders(request);
    
    logger.info('Fetched purchase orders from ERP', {
      erpSystem: request.erpSystem,
      count: purchaseOrders.length,
    });

    // Process each purchase order
    for (const po of purchaseOrders) {
      const result = await processPurchaseOrder(po);
      records.push(result);

      switch (result.operation) {
        case 'CREATED':
          createdCount++;
          break;
        case 'UPDATED':
          updatedCount++;
          break;
        case 'SKIPPED':
          skippedCount++;
          break;
        case 'FAILED':
          failedCount++;
          if (result.errorMessage) {
            errors.push({
              erpRecordId: result.erpRecordId,
              errorCode: 'PROCESSING_ERROR',
              errorMessage: result.errorMessage,
              timestamp: new Date().toISOString(),
              retryable: true,
            });
          }
          break;
      }
    }

    // Update connection last sync timestamp
    if (request.connectionId) {
      await repository.updateERPConnectionLastSync(request.connectionId);
    }

    // Update audit log with success
    const status = failedCount > 0 ? (failedCount === purchaseOrders.length ? 'FAILED' : 'PARTIAL') : 'COMPLETED';
    await repository.updateERPSyncAuditLog(
      auditLogId,
      status,
      purchaseOrders.length,
      createdCount + updatedCount,
      failedCount
    );

    const processingTimeMs = Date.now() - startTime;

    logger.info('Purchase order sync completed', {
      erpSystem: request.erpSystem,
      totalRecords: purchaseOrders.length,
      createdCount,
      updatedCount,
      failedCount,
      processingTimeMs,
    });

    const poSyncResult: PurchaseOrderSyncResult = {
      erpSystem: request.erpSystem,
      syncTimestamp: new Date().toISOString(),
      direction,
      totalRecords: purchaseOrders.length,
      createdCount,
      updatedCount,
      skippedCount,
      failedCount,
      records,
      errors,
      processingTimeMs,
    };

    // Publish ERP sync event
    await publishEvent('ERP_DATA_SYNCED', {
      erpSystem: request.erpSystem,
      syncType: 'PURCHASE_ORDERS',
      totalRecords: purchaseOrders.length,
      createdCount,
      updatedCount,
    });

    // Invalidate ERP sync cache
    await cache.deletePattern(`ams:${CACHE_ENTITY_TYPES.ERP_SYNC}:*`);

    return poSyncResult;
  } catch (error) {
    const err = error as Error;
    logger.error('Purchase order sync failed', err, {
      erpSystem: request.erpSystem,
    });

    // Update audit log with failure
    await repository.updateERPSyncAuditLog(
      auditLogId,
      'FAILED',
      0,
      0,
      0,
      err.message
    );

    throw error;
  }
}

/**
 * Sync cost centers from ERP system
 * Requirement 7.4: Sync cost centers from ERP systems
 */
export async function syncCostCenters(
  request: SyncCostCentersRequest
): Promise<CostCenterSyncResult> {
  const startTime = Date.now();
  const direction = request.direction ?? 'INBOUND';
  
  logger.info('Starting cost center sync', {
    erpSystem: request.erpSystem,
    direction,
    companyCode: request.companyCode,
    includeInactive: request.includeInactive,
  });

  // Create audit log entry
  const auditLogId = await repository.createERPSyncAuditLog(
    request.erpSystem,
    'COST_CENTER_SYNC',
    direction
  );

  const records: ERPRecordSyncResult[] = [];
  const errors: ERPSyncError[] = [];
  let createdCount = 0;
  let updatedCount = 0;
  let skippedCount = 0;
  let failedCount = 0;

  try {
    const connector = getConnector(request.erpSystem);

    // Test connection first
    const isConnected = await connector.testConnection();
    if (!isConnected) {
      throw new Error(`Failed to connect to ${request.erpSystem} system`);
    }

    // Fetch cost centers from ERP
    const costCenters = await connector.fetchCostCenters(request);
    
    logger.info('Fetched cost centers from ERP', {
      erpSystem: request.erpSystem,
      count: costCenters.length,
    });

    // Process each cost center
    for (const cc of costCenters) {
      const result = await processCostCenter(cc, true);
      records.push(result);

      switch (result.operation) {
        case 'CREATED':
          createdCount++;
          break;
        case 'UPDATED':
          updatedCount++;
          break;
        case 'SKIPPED':
          skippedCount++;
          break;
        case 'FAILED':
          failedCount++;
          if (result.errorMessage) {
            errors.push({
              erpRecordId: result.erpRecordId,
              errorCode: 'PROCESSING_ERROR',
              errorMessage: result.errorMessage,
              timestamp: new Date().toISOString(),
              retryable: true,
            });
          }
          break;
      }
    }

    // Update connection last sync timestamp
    if (request.connectionId) {
      await repository.updateERPConnectionLastSync(request.connectionId);
    }

    // Update audit log with success
    const status = failedCount > 0 ? (failedCount === costCenters.length ? 'FAILED' : 'PARTIAL') : 'COMPLETED';
    await repository.updateERPSyncAuditLog(
      auditLogId,
      status,
      costCenters.length,
      createdCount + updatedCount,
      failedCount
    );

    const processingTimeMs = Date.now() - startTime;

    logger.info('Cost center sync completed', {
      erpSystem: request.erpSystem,
      totalRecords: costCenters.length,
      createdCount,
      updatedCount,
      failedCount,
      processingTimeMs,
    });

    const ccSyncResult: CostCenterSyncResult = {
      erpSystem: request.erpSystem,
      syncTimestamp: new Date().toISOString(),
      direction,
      totalRecords: costCenters.length,
      createdCount,
      updatedCount,
      skippedCount,
      failedCount,
      records,
      errors,
      processingTimeMs,
    };

    // Publish ERP sync event
    await publishEvent('ERP_DATA_SYNCED', {
      erpSystem: request.erpSystem,
      syncType: 'COST_CENTERS',
      totalRecords: costCenters.length,
      createdCount,
      updatedCount,
    });

    // Invalidate ERP sync cache
    await cache.deletePattern(`ams:${CACHE_ENTITY_TYPES.ERP_SYNC}:*`);

    return ccSyncResult;
  } catch (error) {
    const err = error as Error;
    logger.error('Cost center sync failed', err, {
      erpSystem: request.erpSystem,
    });

    // Update audit log with failure
    await repository.updateERPSyncAuditLog(
      auditLogId,
      'FAILED',
      0,
      0,
      0,
      err.message
    );

    throw error;
  }
}

/**
 * Get ERP purchase orders by system
 */
export async function getERPPurchaseOrders(
  erpSystem: ERPSystemType,
  limit = 100
): Promise<ERPPurchaseOrder[]> {
  return repository.getERPPurchaseOrdersBySystem(erpSystem, limit);
}

/**
 * Get ERP cost centers by system
 */
export async function getERPCostCenters(
  erpSystem: ERPSystemType,
  includeInactive = false,
  limit = 500
): Promise<ERPCostCenter[]> {
  return repository.getERPCostCentersBySystem(erpSystem, includeInactive, limit);
}

/**
 * Get ERP sync audit logs
 */
export async function getERPSyncAuditLogs(
  erpSystem?: ERPSystemType,
  limit = 50
) {
  return repository.getERPSyncAuditLogs(erpSystem, undefined, limit);
}

/**
 * Get ERP connection configuration
 */
export async function getERPConnectionConfig(erpSystem: ERPSystemType) {
  return repository.getERPConnectionConfig(erpSystem);
}

/**
 * Test ERP connection
 */
export async function testERPConnection(erpSystem: ERPSystemType): Promise<boolean> {
  try {
    const connector = getConnector(erpSystem);
    return await connector.testConnection();
  } catch (error) {
    logger.error('ERP connection test failed', error as Error, { erpSystem });
    return false;
  }
}
