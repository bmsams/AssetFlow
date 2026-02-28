/**
 * Parts Inventory Service - Business logic layer for spare parts management
 *
 * Implements:
 * - Spare parts inventory management (Requirement 5.4)
 * - Part reservation for work orders (Requirement 5.5)
 * - Stock level monitoring and replenishment alerts
 */

import type { PaginatedResult, PaginationParams, UUID } from '@ams/types';
import * as cache from '@ams/cache';
import { CACHE_ENTITY_TYPES, entityKey } from '@ams/cache';
import { publishEvent } from '@ams/events';
import { createLogger } from '@ams/utils';

import type {
  PartCategory,
  PartReplenishmentAlert,
  PartRequirement,
  PartReservation,
  SparePart,
  WorkOrderPart,
} from './parts-inventory-repository';
import * as repository from './parts-inventory-repository';

const logger = createLogger({ service: 'parts-inventory-service' });

/**
 * Cache key for spare part
 */
function sparePartCacheKey(partId: UUID): string {
  return entityKey(CACHE_ENTITY_TYPES.SPARE_PART, partId);
}

/**
 * Cache key for work order parts
 */
function workOrderPartsCacheKey(workOrderId: UUID): string {
  return `work-order:${workOrderId}:parts`;
}

// ============================================================================
// SPARE PARTS OPERATIONS
// Requirement 5.4: THE Parts_Inventory_Service SHALL manage spare parts inventory
// ============================================================================

/**
 * Get spare part by ID
 */
export async function getSparePart(partId: UUID): Promise<SparePart | null> {
  const cacheKey = sparePartCacheKey(partId);

  return cache.getOrSet(
    cacheKey,
    () => repository.getSparePartById(partId),
    { ttl: cache.DEFAULT_TTL.MEDIUM }
  );
}

/**
 * Get spare part by part number
 */
export async function getSparePartByNumber(partNumber: string): Promise<SparePart | null> {
  return repository.getSparePartByNumber(partNumber);
}

/**
 * Get all spare parts with pagination
 */
export async function getSpareParts(
  pagination: PaginationParams = {},
  activeOnly = true
): Promise<PaginatedResult<SparePart>> {
  return repository.getSpareParts(pagination, activeOnly);
}

/**
 * Get spare parts by category
 */
export async function getSparePartsByCategory(
  category: PartCategory,
  pagination: PaginationParams = {}
): Promise<PaginatedResult<SparePart>> {
  return repository.getSparePartsByCategory(category, pagination);
}


// ============================================================================
// PART RESERVATION OPERATIONS
// Requirement 5.5: WHEN a work order requires parts, THE Parts_Inventory_Service
// SHALL reserve parts and update availability
// ============================================================================

/**
 * Reserve parts for a work order
 * Requirement 5.5: Reserve parts and update availability
 */
export async function reserveParts(
  workOrderId: UUID,
  parts: readonly PartRequirement[]
): Promise<PartReservation> {
  logger.info('Reserving parts for work order', {
    workOrderId,
    partCount: parts.length,
    parts: parts.map(p => ({ partId: p.partId, quantity: p.quantityRequired })),
  });

  // Validate parts exist and are active
  for (const part of parts) {
    const sparePart = await repository.getSparePartById(part.partId);
    if (!sparePart) {
      throw new Error(`Part not found: ${part.partId}`);
    }
    if (!sparePart.isActive) {
      throw new Error(`Part is not active: ${sparePart.partNumber}`);
    }
    if (part.quantityRequired <= 0) {
      throw new Error(`Invalid quantity for part ${sparePart.partNumber}: ${part.quantityRequired}`);
    }
  }

  // Reserve parts
  const reservation = await repository.reservePartsForWorkOrder(workOrderId, parts);

  // Invalidate caches
  await cache.del(workOrderPartsCacheKey(workOrderId));
  for (const part of parts) {
    await cache.del(sparePartCacheKey(part.partId));
  }

  // Publish event
  await publishEvent('PARTS_RESERVED', {
    workOrderId,
    reservationId: reservation.reservationId,
    parts: reservation.parts,
    allPartsReserved: reservation.allPartsReserved,
    reservedAt: reservation.reservedAt,
  });

  // Check if any parts are now below reorder point and publish alerts
  const alerts = await checkPartLevels();
  if (alerts.length > 0) {
    await publishEvent('PARTS_REPLENISHMENT_NEEDED', {
      alertCount: alerts.length,
      criticalCount: alerts.filter(a => a.isCritical).length,
      alerts: alerts.slice(0, 10), // Include first 10 alerts in event
    });
  }

  logger.info('Parts reserved successfully', {
    workOrderId,
    reservationId: reservation.reservationId,
    allPartsReserved: reservation.allPartsReserved,
    partsReserved: reservation.parts.length,
  });

  return reservation;
}

/**
 * Consume reserved parts (mark as used when work is completed)
 */
export async function consumeParts(
  workOrderId: UUID,
  partsUsed?: readonly { partId: UUID; quantityUsed: number }[]
): Promise<WorkOrderPart[]> {
  logger.info('Consuming parts for work order', {
    workOrderId,
    specificParts: partsUsed?.length ?? 'all reserved',
  });

  const consumedParts = await repository.consumePartsForWorkOrder(workOrderId, partsUsed);

  // Invalidate caches
  await cache.del(workOrderPartsCacheKey(workOrderId));
  for (const part of consumedParts) {
    await cache.del(sparePartCacheKey(part.partId));
  }

  // Publish event
  await publishEvent('PARTS_CONSUMED', {
    workOrderId,
    partsConsumed: consumedParts.map(p => ({
      partId: p.partId,
      quantityUsed: p.quantityUsed,
      totalCost: p.totalCost,
    })),
  });

  // Check if any parts are now below reorder point
  const alerts = await checkPartLevels();
  if (alerts.length > 0) {
    await publishEvent('PARTS_REPLENISHMENT_NEEDED', {
      alertCount: alerts.length,
      criticalCount: alerts.filter(a => a.isCritical).length,
      alerts: alerts.slice(0, 10),
    });
  }

  logger.info('Parts consumed successfully', {
    workOrderId,
    partsConsumed: consumedParts.length,
  });

  return consumedParts;
}

/**
 * Cancel part reservation for a work order
 */
export async function cancelReservation(
  workOrderId: UUID,
  partId?: UUID
): Promise<void> {
  logger.info('Cancelling part reservation', {
    workOrderId,
    partId: partId ?? 'all',
  });

  // Get current reservations before cancelling
  const currentParts = await repository.getWorkOrderParts(workOrderId);

  await repository.cancelPartReservation(workOrderId, partId);

  // Invalidate caches
  await cache.del(workOrderPartsCacheKey(workOrderId));
  for (const part of currentParts) {
    await cache.del(sparePartCacheKey(part.partId));
  }

  // Publish event
  await publishEvent('PARTS_RESERVATION_CANCELLED', {
    workOrderId,
    partId: partId ?? null,
    cancelledAll: !partId,
  });

  logger.info('Part reservation cancelled', {
    workOrderId,
    partId: partId ?? 'all',
  });
}

// ============================================================================
// STOCK LEVEL OPERATIONS
// ============================================================================

/**
 * Check part stock levels and generate replenishment alerts
 * Requirement 5.4: Manage spare parts inventory separate from main assets
 */
export async function checkPartLevels(): Promise<PartReplenishmentAlert[]> {
  logger.info('Checking part stock levels');

  const alerts = await repository.checkPartLevels();

  if (alerts.length > 0) {
    logger.warn('Parts below reorder point detected', {
      alertCount: alerts.length,
      criticalCount: alerts.filter(a => a.isCritical).length,
    });
  } else {
    logger.info('All parts above reorder point');
  }

  return alerts;
}

/**
 * Get parts that need replenishment
 */
export async function getPartsNeedingReplenishment(): Promise<SparePart[]> {
  return repository.getPartsBelowReorderPoint();
}

/**
 * Get critical parts with low stock
 */
export async function getCriticalPartsLowStock(): Promise<SparePart[]> {
  return repository.getCriticalPartsLowStock();
}

/**
 * Update part quantity (for adjustments, cycle counts, etc.)
 */
export async function adjustPartQuantity(
  partId: UUID,
  quantityChange: number,
  reason: string
): Promise<SparePart> {
  logger.info('Adjusting part quantity', {
    partId,
    quantityChange,
    reason,
  });

  const updatedPart = await repository.updatePartQuantity(partId, quantityChange, reason);
  if (!updatedPart) {
    throw new Error(`Part not found: ${partId}`);
  }

  // Invalidate cache
  await cache.del(sparePartCacheKey(partId));

  // Publish event
  await publishEvent('PART_QUANTITY_ADJUSTED', {
    partId,
    partNumber: updatedPart.partNumber,
    quantityChange,
    newQuantityOnHand: updatedPart.quantityOnHand,
    newQuantityAvailable: updatedPart.quantityAvailable,
    reason,
  });

  // Check if part is now below reorder point
  if (updatedPart.quantityAvailable <= updatedPart.reorderPoint) {
    await publishEvent('PART_BELOW_REORDER_POINT', {
      partId,
      partNumber: updatedPart.partNumber,
      currentQuantity: updatedPart.quantityAvailable,
      reorderPoint: updatedPart.reorderPoint,
      isCritical: updatedPart.isCritical,
    });
  }

  return updatedPart;
}

/**
 * Record part receipt (when parts are received from vendor)
 */
export async function receivePartStock(
  partId: UUID,
  quantityReceived: number,
  purchasePrice?: number
): Promise<SparePart> {
  logger.info('Recording part receipt', {
    partId,
    quantityReceived,
    purchasePrice,
  });

  if (quantityReceived <= 0) {
    throw new Error('Quantity received must be positive');
  }

  const updatedPart = await repository.recordPartReceipt(partId, quantityReceived, purchasePrice);
  if (!updatedPart) {
    throw new Error(`Part not found: ${partId}`);
  }

  // Invalidate cache
  await cache.del(sparePartCacheKey(partId));

  // Publish event
  await publishEvent('PART_STOCK_RECEIVED', {
    partId,
    partNumber: updatedPart.partNumber,
    quantityReceived,
    newQuantityOnHand: updatedPart.quantityOnHand,
    purchasePrice,
  });

  return updatedPart;
}

// ============================================================================
// WORK ORDER PARTS QUERIES
// ============================================================================

/**
 * Get parts for a work order
 */
export async function getWorkOrderParts(workOrderId: UUID): Promise<WorkOrderPart[]> {
  const cacheKey = workOrderPartsCacheKey(workOrderId);

  return cache.getOrSet(
    cacheKey,
    () => repository.getWorkOrderParts(workOrderId),
    { ttl: cache.DEFAULT_TTL.SHORT }
  );
}

/**
 * Get part usage history
 */
export async function getPartUsageHistory(
  partId: UUID,
  pagination: PaginationParams = {}
): Promise<PaginatedResult<WorkOrderPart>> {
  return repository.getPartUsageHistory(partId, pagination);
}

/**
 * Get parts with pending reservations
 */
export async function getPartsWithPendingReservations(): Promise<WorkOrderPart[]> {
  return repository.getPartsWithPendingReservations();
}

// Re-export types
export type {
  ABCClassification,
  PartCategory,
  PartReplenishmentAlert,
  PartRequirement,
  PartReservation,
  ReservationStatus,
  SparePart,
  UnitOfMeasure,
  WorkOrderPart,
} from './parts-inventory-repository';
