/**
 * Stockroom Service - Business logic layer for stockroom inventory management
 *
 * Implements:
 * - Stockroom CRUD operations (Requirement 5.1-5.7)
 * - Inventory tracking across multiple stockrooms (Requirement 3.2)
 * - Stock level monitoring and threshold alerts (Requirement 3.3)
 * - Replenishment alert generation
 */

import type { PaginatedResult, PaginationParams, UUID } from '@ams/types';
import * as cache from '@ams/cache';
import {
  CACHE_ENTITY_TYPES,
  entityKey,
  stockroomKey,
  stockroomsByLocationKey,
  stockroomInvalidationPatterns,
} from '@ams/cache';
import { publishEvent } from '@ams/events';
import { createLogger } from '@ams/utils';

import type {
  CreateInventoryRequest,
  CreateStockroomRequest,
  LowStockItem,
  ProductType,
  Stockroom,
  StockroomInventoryItem,
  StockroomListFilters,
  UpdateInventoryRequest,
  UpdateStockroomRequest,
} from './stockroom-repository';
import * as repository from './stockroom-repository';

// ============================================================================
// Error Types
// ============================================================================

/**
 * Error thrown when stockroom is not found
 */
export class StockroomNotFoundError extends Error {
  constructor(stockroomId: UUID) {
    super(`Stockroom not found: ${stockroomId}`);
    this.name = 'StockroomNotFoundError';
  }
}

/**
 * Error thrown when stockroom name already exists in a location
 */
export class StockroomNameExistsError extends Error {
  constructor(locationId: UUID | null, name: string) {
    super(`Stockroom name "${name}" already exists${locationId ? ` in location ${locationId}` : ''}`);
    this.name = 'StockroomNameExistsError';
  }
}

/**
 * Error thrown when stockroom code already exists
 */
export class StockroomCodeExistsError extends Error {
  constructor(stockroomCode: string) {
    super(`Stockroom code "${stockroomCode}" already exists`);
    this.name = 'StockroomCodeExistsError';
  }
}

/**
 * Error thrown when stockroom has dependencies and cannot be deleted
 */
export class StockroomHasDependenciesError extends Error {
  readonly binLocationCount: number;
  readonly inventoryCount: number;

  constructor(stockroomId: UUID, binLocationCount: number, inventoryCount: number) {
    super(
      `Cannot delete stockroom ${stockroomId}: has ${binLocationCount} bin location(s) and ${inventoryCount} inventory item(s)`
    );
    this.name = 'StockroomHasDependenciesError';
    this.binLocationCount = binLocationCount;
    this.inventoryCount = inventoryCount;
  }
}

/**
 * Error thrown when location (building) is not found
 * Requirement 5.5: Reject creation for non-existent location
 */
export class LocationNotFoundError extends Error {
  constructor(locationId: UUID) {
    super(`Location not found: ${locationId}`);
    this.name = 'LocationNotFoundError';
  }
}

const logger = createLogger({ service: 'stockroom-service' });

/**
 * Cache key for stockroom inventory
 */
function stockroomInventoryCacheKey(stockroomId: UUID): string {
  return `stockroom:${stockroomId}:inventory`;
}

/**
 * Cache key for low stock items
 */
function lowStockCacheKey(stockroomId?: UUID): string {
  return stockroomId ? `stockroom:${stockroomId}:low-stock` : 'stockroom:all:low-stock';
}

// ============================================================================
// Cache Helpers
// ============================================================================

/**
 * Invalidate all stockroom-related cache entries
 */
async function invalidateStockroomCache(stockroomId: UUID, locationId?: UUID): Promise<void> {
  const patterns = stockroomInvalidationPatterns(stockroomId, locationId);
  for (const pattern of patterns) {
    await cache.delPattern(pattern);
  }
  // Also invalidate the specific stockroom key
  await cache.del(stockroomKey(stockroomId));
  if (locationId) {
    await cache.del(stockroomsByLocationKey(locationId));
  }
}

// ============================================================================
// Stockroom CRUD Operations
// ============================================================================

/**
 * Create a new stockroom
 * Requirement 5.1: Create stockroom with location reference, name, and type
 * Requirement 5.5: Reject creation for non-existent location
 *
 * @param request - Stockroom creation request
 * @param userId - ID of user creating the stockroom
 * @returns Created stockroom
 * @throws LocationNotFoundError if location does not exist
 * @throws StockroomNameExistsError if stockroom name already exists in location
 * @throws StockroomCodeExistsError if stockroom code already exists
 */
export async function createStockroom(
  request: CreateStockroomRequest,
  userId?: UUID
): Promise<Stockroom> {
  logger.info('Creating stockroom', {
    name: request.name,
    stockroomCode: request.stockroomCode,
    stockroomType: request.stockroomType,
  });

  // Validate location exists if building is specified (Requirement 5.5)
  if (request.building) {
    const locationExists = await repository.locationExists(request.building);
    if (!locationExists) {
      throw new LocationNotFoundError(request.building);
    }
  }

  // Validate stockroom code uniqueness if provided
  if (request.stockroomCode) {
    const codeExists = await repository.stockroomCodeExists(request.stockroomCode);
    if (codeExists) {
      throw new StockroomCodeExistsError(request.stockroomCode);
    }
  }

  // Validate stockroom name uniqueness within location
  const nameExists = await repository.stockroomNameExistsInLocation(
    request.building ?? null,
    request.name
  );
  if (nameExists) {
    throw new StockroomNameExistsError(request.building ?? null, request.name);
  }

  // Create the stockroom
  const stockroom = await repository.createStockroom(request, userId);

  // Invalidate cache
  await invalidateStockroomCache(stockroom.stockroomId, request.building);

  // Publish event
  await publishEvent('STOCKROOM_CREATED', {
    stockroomId: stockroom.stockroomId,
    stockroomCode: stockroom.stockroomCode ?? '',
    name: stockroom.name,
    stockroomType: stockroom.stockroomType ?? 'OTHER',
    createdBy: userId ?? '',
  });

  logger.info('Stockroom created successfully', {
    stockroomId: stockroom.stockroomId,
    stockroomCode: stockroom.stockroomCode,
    name: stockroom.name,
  });

  return stockroom;
}

/**
 * Get stockroom by ID, throwing if not found
 *
 * @param stockroomId - Stockroom ID
 * @returns Stockroom
 * @throws StockroomNotFoundError if stockroom not found
 */
export async function getStockroomOrThrow(stockroomId: UUID): Promise<Stockroom> {
  const stockroom = await getStockroom(stockroomId);
  if (!stockroom) {
    throw new StockroomNotFoundError(stockroomId);
  }
  return stockroom;
}

/**
 * Get stockrooms by location (building)
 * Requirement 5.2: Return all stockrooms for a location ordered by name
 *
 * @param locationId - Location (building) ID
 * @returns List of stockrooms ordered by name
 */
export async function getStockroomsByLocation(locationId: UUID): Promise<Stockroom[]> {
  const cacheKeyStr = stockroomsByLocationKey(locationId);

  return cache.getOrSet(
    cacheKeyStr,
    () => repository.getStockroomsByLocation(locationId),
    { ttl: cache.DEFAULT_TTL.MEDIUM }
  );
}

/**
 * Update stockroom details
 * Requirement 5.3: Update specified fields and maintain location relationship
 *
 * @param stockroomId - Stockroom ID
 * @param request - Update request
 * @param userId - ID of user updating the stockroom
 * @returns Updated stockroom
 * @throws StockroomNotFoundError if stockroom not found
 * @throws StockroomNameExistsError if new name already exists in location
 */
export async function updateStockroom(
  stockroomId: UUID,
  request: UpdateStockroomRequest,
  userId?: UUID
): Promise<Stockroom> {
  logger.info('Updating stockroom', { stockroomId, updates: Object.keys(request) });

  // Verify stockroom exists
  const existing = await repository.getStockroomById(stockroomId);
  if (!existing) {
    throw new StockroomNotFoundError(stockroomId);
  }

  // Validate name uniqueness if name is being changed
  if (request.name && request.name !== existing.name) {
    const locationId = request.building ?? existing.building;
    const nameExists = await repository.stockroomNameExistsInLocation(
      locationId ?? null,
      request.name,
      stockroomId
    );
    if (nameExists) {
      throw new StockroomNameExistsError(locationId ?? null, request.name);
    }
  }

  // Update the stockroom
  const updated = await repository.updateStockroom(stockroomId, request, userId);
  if (!updated) {
    throw new StockroomNotFoundError(stockroomId);
  }

  // Invalidate cache
  await invalidateStockroomCache(stockroomId, existing.building ?? undefined);
  if (request.building && request.building !== existing.building) {
    await invalidateStockroomCache(stockroomId, request.building);
  }

  // Publish event
  await publishEvent('STOCKROOM_UPDATED', {
    stockroomId: updated.stockroomId,
    stockroomCode: updated.stockroomCode ?? '',
    changes: Object.keys(request).map(field => ({
      field,
      oldValue: (existing as unknown as Record<string, unknown>)[field],
      newValue: (request as unknown as Record<string, unknown>)[field],
    })),
    updatedBy: userId ?? '',
  });

  logger.info('Stockroom updated successfully', { stockroomId });

  return updated;
}

/**
 * Deactivate a stockroom
 * Requirement 5.4: Mark stockroom as inactive and prevent new inventory assignments
 *
 * @param stockroomId - Stockroom ID
 * @param userId - ID of user deactivating the stockroom
 * @returns Deactivated stockroom
 * @throws StockroomNotFoundError if stockroom not found
 */
export async function deactivateStockroom(stockroomId: UUID, userId?: UUID): Promise<Stockroom> {
  logger.info('Deactivating stockroom', { stockroomId });

  // Verify stockroom exists
  const existing = await repository.getStockroomById(stockroomId);
  if (!existing) {
    throw new StockroomNotFoundError(stockroomId);
  }

  // Deactivate the stockroom
  const deactivated = await repository.deactivateStockroom(stockroomId, userId);
  if (!deactivated) {
    throw new StockroomNotFoundError(stockroomId);
  }

  // Invalidate cache
  await invalidateStockroomCache(stockroomId, existing.building ?? undefined);

  // Publish event
  await publishEvent('STOCKROOM_DEACTIVATED', {
    stockroomId: deactivated.stockroomId,
    stockroomCode: deactivated.stockroomCode ?? '',
    deactivatedBy: userId ?? '',
  });

  logger.info('Stockroom deactivated successfully', { stockroomId });

  return deactivated;
}

/**
 * Reactivate a stockroom
 * Requirement 5.5: Mark stockroom as active and allow inventory operations
 *
 * @param stockroomId - Stockroom ID
 * @param userId - ID of user reactivating the stockroom
 * @returns Reactivated stockroom
 * @throws StockroomNotFoundError if stockroom not found
 */
export async function reactivateStockroom(stockroomId: UUID, userId?: UUID): Promise<Stockroom> {
  logger.info('Reactivating stockroom', { stockroomId });

  // Verify stockroom exists
  const existing = await repository.getStockroomById(stockroomId);
  if (!existing) {
    throw new StockroomNotFoundError(stockroomId);
  }

  // Reactivate the stockroom
  const reactivated = await repository.reactivateStockroom(stockroomId, userId);
  if (!reactivated) {
    throw new StockroomNotFoundError(stockroomId);
  }

  // Invalidate cache
  await invalidateStockroomCache(stockroomId, existing.building ?? undefined);

  // Publish event (using STOCKROOM_UPDATED since there's no specific reactivate event)
  await publishEvent('STOCKROOM_UPDATED', {
    stockroomId: reactivated.stockroomId,
    stockroomCode: reactivated.stockroomCode ?? '',
    changes: [{ field: 'isActive', oldValue: false, newValue: true }],
    updatedBy: userId ?? '',
  });

  logger.info('Stockroom reactivated successfully', { stockroomId });

  return reactivated;
}

/**
 * Delete a stockroom
 * Requirement 5.7: Reject deletion if stockroom has inventory
 *
 * @param stockroomId - Stockroom ID
 * @returns true if deleted
 * @throws StockroomNotFoundError if stockroom not found
 * @throws StockroomHasDependenciesError if stockroom has bin locations or inventory
 */
export async function deleteStockroom(stockroomId: UUID): Promise<boolean> {
  logger.info('Deleting stockroom', { stockroomId });

  // Verify stockroom exists
  const existing = await repository.getStockroomById(stockroomId);
  if (!existing) {
    throw new StockroomNotFoundError(stockroomId);
  }

  // Check for dependencies
  const dependencies = await repository.getStockroomDependencies(stockroomId);
  if (dependencies.binLocationCount > 0 || dependencies.inventoryCount > 0) {
    throw new StockroomHasDependenciesError(
      stockroomId,
      dependencies.binLocationCount,
      dependencies.inventoryCount
    );
  }

  // Delete the stockroom
  const deleted = await repository.deleteStockroom(stockroomId);

  if (deleted) {
    // Invalidate cache
    await invalidateStockroomCache(stockroomId, existing.building ?? undefined);

    logger.info('Stockroom deleted successfully', { stockroomId });
  }

  return deleted;
}

/**
 * List stockrooms with pagination and filters
 * Requirement 5.6: Return paginated list of stockrooms matching criteria
 *
 * @param filters - Filter criteria
 * @param pagination - Pagination parameters
 * @returns Paginated list of stockrooms
 */
export async function listStockrooms(
  filters: StockroomListFilters = {},
  pagination: PaginationParams = {}
): Promise<PaginatedResult<Stockroom>> {
  logger.debug('Listing stockrooms', { filters, pagination });

  return repository.listStockrooms(filters, pagination);
}

/**
 * Validate stockroom name uniqueness within a location
 * Used for form validation before submission
 *
 * @param locationId - Location (building) ID or null for global check
 * @param name - Stockroom name to validate
 * @param excludeStockroomId - Stockroom ID to exclude (for updates)
 * @returns true if stockroom name is unique within the location
 */
export async function isStockroomNameUnique(
  locationId: UUID | null,
  name: string,
  excludeStockroomId?: UUID
): Promise<boolean> {
  const exists = await repository.stockroomNameExistsInLocation(
    locationId,
    name,
    excludeStockroomId
  );
  return !exists;
}

/**
 * Get stockroom by code
 *
 * @param stockroomCode - Stockroom code
 * @returns Stockroom or null if not found
 */
export async function getStockroomByCode(stockroomCode: string): Promise<Stockroom | null> {
  return repository.getStockroomByCode(stockroomCode);
}

// ============================================================================
// Replenishment Alert Types and Helpers
// ============================================================================

/**
 * Replenishment alert
 */
export interface ReplenishmentAlert {
  readonly alertId: string;
  readonly alertType: 'LOW_STOCK' | 'OUT_OF_STOCK' | 'CRITICAL';
  readonly stockroomId: UUID;
  readonly stockroomName: string;
  readonly inventoryId: UUID;
  readonly productId: UUID | null;
  readonly productType: ProductType;
  readonly productSku: string | null;
  readonly productDescription: string | null;
  readonly currentQuantity: number;
  readonly reorderPoint: number;
  readonly reorderQuantity: number | null;
  readonly shortfall: number;
  readonly priority: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
  readonly createdAt: string;
}

/**
 * Inventory update result
 */
export interface InventoryUpdateResult {
  readonly item: StockroomInventoryItem;
  readonly alerts: readonly ReplenishmentAlert[];
}

/**
 * Determine alert type based on stock levels
 */
function determineAlertType(
  quantityOnHand: number,
  reorderPoint: number
): 'LOW_STOCK' | 'OUT_OF_STOCK' | 'CRITICAL' {
  if (quantityOnHand === 0) {
    return 'OUT_OF_STOCK';
  }
  // Critical if below 25% of reorder point
  if (quantityOnHand < reorderPoint * 0.25) {
    return 'CRITICAL';
  }
  return 'LOW_STOCK';
}

/**
 * Determine alert priority based on shortfall percentage
 */
function determineAlertPriority(
  quantityOnHand: number,
  reorderPoint: number
): 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL' {
  if (quantityOnHand === 0) {
    return 'CRITICAL';
  }
  const percentageOfReorderPoint = (quantityOnHand / reorderPoint) * 100;
  if (percentageOfReorderPoint < 25) {
    return 'CRITICAL';
  }
  if (percentageOfReorderPoint < 50) {
    return 'HIGH';
  }
  if (percentageOfReorderPoint < 75) {
    return 'MEDIUM';
  }
  return 'LOW';
}

/**
 * Generate a unique alert ID
 */
function generateAlertId(): string {
  return `ALERT-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`;
}

/**
 * Create replenishment alert from low stock item
 */
function createReplenishmentAlert(item: LowStockItem): ReplenishmentAlert {
  return {
    alertId: generateAlertId(),
    alertType: determineAlertType(item.quantityOnHand, item.reorderPoint),
    stockroomId: item.stockroomId,
    stockroomName: item.stockroomName,
    inventoryId: item.inventoryId,
    productId: item.productId,
    productType: item.productType,
    productSku: item.productSku,
    productDescription: item.productDescription,
    currentQuantity: item.quantityOnHand,
    reorderPoint: item.reorderPoint,
    reorderQuantity: item.reorderQuantity,
    shortfall: item.shortfall,
    priority: determineAlertPriority(item.quantityOnHand, item.reorderPoint),
    createdAt: new Date().toISOString(),
  };
}

/**
 * Get stockroom by ID
 */
export async function getStockroom(stockroomId: UUID): Promise<Stockroom | null> {
  const cacheKey = entityKey(CACHE_ENTITY_TYPES.STOCKROOM, stockroomId);

  return cache.getOrSet(
    cacheKey,
    () => repository.getStockroomById(stockroomId),
    { ttl: cache.DEFAULT_TTL.MEDIUM }
  );
}

/**
 * Get all active stockrooms
 */
export async function getActiveStockrooms(): Promise<Stockroom[]> {
  const cacheKey = 'stockrooms:active';

  return cache.getOrSet(
    cacheKey,
    () => repository.getActiveStockrooms(),
    { ttl: cache.DEFAULT_TTL.SHORT }
  );
}

/**
 * Get stockroom inventory with pagination
 * Requirement 3.2: Track inventory quantities, locations, and stock levels
 */
export async function getStockroomInventory(
  stockroomId: UUID,
  pagination: PaginationParams = {},
  includeInactive = false
): Promise<PaginatedResult<StockroomInventoryItem>> {
  logger.info('Getting stockroom inventory', { stockroomId, pagination, includeInactive });

  // Verify stockroom exists
  const stockroom = await repository.getStockroomById(stockroomId);
  if (!stockroom) {
    throw new Error(`Stockroom not found: ${stockroomId}`);
  }

  return repository.getStockroomInventory(stockroomId, pagination, includeInactive);
}

/**
 * Get inventory item by ID
 */
export async function getInventoryItem(inventoryId: UUID): Promise<StockroomInventoryItem | null> {
  return repository.getInventoryItemById(inventoryId);
}

/**
 * Create inventory item
 */
export async function createInventoryItem(
  request: CreateInventoryRequest
): Promise<InventoryUpdateResult> {
  logger.info('Creating inventory item', { stockroomId: request.stockroomId, productType: request.productType });

  // Verify stockroom exists
  const stockroom = await repository.getStockroomById(request.stockroomId);
  if (!stockroom) {
    throw new Error(`Stockroom not found: ${request.stockroomId}`);
  }

  const item = await repository.createInventoryItem(request);

  // Invalidate cache
  await cache.del(stockroomInventoryCacheKey(request.stockroomId));
  await cache.del(lowStockCacheKey(request.stockroomId));
  await cache.del(lowStockCacheKey());

  // Check if item is below reorder point and generate alert
  const alerts: ReplenishmentAlert[] = [];
  if (item.reorderPoint !== null && item.quantityOnHand <= item.reorderPoint) {
    const alert = createReplenishmentAlert({
      inventoryId: item.inventoryId,
      stockroomId: item.stockroomId,
      stockroomName: stockroom.name,
      productId: item.productId,
      productType: item.productType,
      productSku: item.productSku,
      productDescription: item.productDescription,
      quantityOnHand: item.quantityOnHand,
      quantityAvailable: item.quantityAvailable,
      reorderPoint: item.reorderPoint,
      reorderQuantity: item.reorderQuantity,
      shortfall: item.reorderPoint - item.quantityOnHand,
    });
    alerts.push(alert);

    // Publish alert event
    await publishReplenishmentAlert(alert);
  }

  // Publish inventory created event
  await publishEvent('INVENTORY_CREATED', {
    inventoryId: item.inventoryId,
    stockroomId: item.stockroomId,
    productType: item.productType,
    quantityOnHand: item.quantityOnHand,
  });

  return { item, alerts };
}

/**
 * Update inventory item
 * Requirement 3.2: Track inventory quantities
 */
export async function updateInventory(
  inventoryId: UUID,
  request: UpdateInventoryRequest,
  userId?: UUID
): Promise<InventoryUpdateResult> {
  logger.info('Updating inventory', { inventoryId, request });

  // Get current item
  const currentItem = await repository.getInventoryItemById(inventoryId);
  if (!currentItem) {
    throw new Error(`Inventory item not found: ${inventoryId}`);
  }

  // Get stockroom for alert generation
  const stockroom = await repository.getStockroomById(currentItem.stockroomId);
  if (!stockroom) {
    throw new Error(`Stockroom not found: ${currentItem.stockroomId}`);
  }

  const updatedItem = await repository.updateInventoryItem(inventoryId, request);
  if (!updatedItem) {
    throw new Error(`Failed to update inventory item: ${inventoryId}`);
  }

  // Invalidate cache
  await cache.del(stockroomInventoryCacheKey(currentItem.stockroomId));
  await cache.del(lowStockCacheKey(currentItem.stockroomId));
  await cache.del(lowStockCacheKey());

  // Check for stock level alerts
  const alerts: ReplenishmentAlert[] = [];
  const effectiveReorderPoint = request.reorderPoint ?? currentItem.reorderPoint;

  if (effectiveReorderPoint !== null && updatedItem.quantityOnHand <= effectiveReorderPoint) {
    // Only generate alert if quantity changed or reorder point changed
    const quantityChanged = request.quantityOnHand !== undefined && 
                           request.quantityOnHand !== currentItem.quantityOnHand;
    const reorderPointChanged = request.reorderPoint !== undefined && 
                                request.reorderPoint !== currentItem.reorderPoint;
    const wasAboveThreshold = currentItem.reorderPoint === null || 
                              currentItem.quantityOnHand > currentItem.reorderPoint;

    if (quantityChanged || reorderPointChanged || wasAboveThreshold) {
      const alert = createReplenishmentAlert({
        inventoryId: updatedItem.inventoryId,
        stockroomId: updatedItem.stockroomId,
        stockroomName: stockroom.name,
        productId: updatedItem.productId,
        productType: updatedItem.productType,
        productSku: updatedItem.productSku,
        productDescription: updatedItem.productDescription,
        quantityOnHand: updatedItem.quantityOnHand,
        quantityAvailable: updatedItem.quantityAvailable,
        reorderPoint: effectiveReorderPoint,
        reorderQuantity: updatedItem.reorderQuantity,
        shortfall: effectiveReorderPoint - updatedItem.quantityOnHand,
      });
      alerts.push(alert);

      // Publish alert event
      await publishReplenishmentAlert(alert);
    }
  }

  // Publish inventory updated event
  await publishEvent('INVENTORY_UPDATED', {
    inventoryId: updatedItem.inventoryId,
    stockroomId: updatedItem.stockroomId,
    previousQuantity: currentItem.quantityOnHand,
    newQuantity: updatedItem.quantityOnHand,
    updatedBy: userId,
  });

  return { item: updatedItem, alerts };
}

/**
 * Adjust inventory quantity (receive or issue)
 */
export async function adjustInventoryQuantity(
  inventoryId: UUID,
  adjustment: number,
  adjustmentType: 'received' | 'issued' | 'adjustment',
  userId?: UUID
): Promise<InventoryUpdateResult> {
  logger.info('Adjusting inventory quantity', { inventoryId, adjustment, adjustmentType });

  // Get current item for alert generation
  const currentItem = await repository.getInventoryItemById(inventoryId);
  if (!currentItem) {
    throw new Error(`Inventory item not found: ${inventoryId}`);
  }

  const stockroom = await repository.getStockroomById(currentItem.stockroomId);
  if (!stockroom) {
    throw new Error(`Stockroom not found: ${currentItem.stockroomId}`);
  }

  const updatedItem = await repository.adjustInventoryQuantity(inventoryId, adjustment, adjustmentType);
  if (!updatedItem) {
    throw new Error(`Failed to adjust inventory: ${inventoryId}`);
  }

  // Invalidate cache
  await cache.del(stockroomInventoryCacheKey(currentItem.stockroomId));
  await cache.del(lowStockCacheKey(currentItem.stockroomId));
  await cache.del(lowStockCacheKey());

  // Check for stock level alerts after adjustment
  const alerts: ReplenishmentAlert[] = [];
  if (updatedItem.reorderPoint !== null && updatedItem.quantityOnHand <= updatedItem.reorderPoint) {
    // Only alert if we crossed the threshold (was above, now below)
    const wasAboveThreshold = currentItem.quantityOnHand > (currentItem.reorderPoint ?? 0);
    const isNowBelowThreshold = updatedItem.quantityOnHand <= updatedItem.reorderPoint;

    if (wasAboveThreshold && isNowBelowThreshold) {
      const alert = createReplenishmentAlert({
        inventoryId: updatedItem.inventoryId,
        stockroomId: updatedItem.stockroomId,
        stockroomName: stockroom.name,
        productId: updatedItem.productId,
        productType: updatedItem.productType,
        productSku: updatedItem.productSku,
        productDescription: updatedItem.productDescription,
        quantityOnHand: updatedItem.quantityOnHand,
        quantityAvailable: updatedItem.quantityAvailable,
        reorderPoint: updatedItem.reorderPoint,
        reorderQuantity: updatedItem.reorderQuantity,
        shortfall: updatedItem.reorderPoint - updatedItem.quantityOnHand,
      });
      alerts.push(alert);

      // Publish alert event
      await publishReplenishmentAlert(alert);
    }
  }

  // Publish adjustment event
  await publishEvent('INVENTORY_ADJUSTED', {
    inventoryId: updatedItem.inventoryId,
    stockroomId: updatedItem.stockroomId,
    adjustmentType,
    adjustment,
    previousQuantity: currentItem.quantityOnHand,
    newQuantity: updatedItem.quantityOnHand,
    adjustedBy: userId,
  });

  return { item: updatedItem, alerts };
}

/**
 * Reserve inventory for an order or request
 */
export async function reserveInventory(
  inventoryId: UUID,
  quantity: number,
  userId?: UUID
): Promise<StockroomInventoryItem> {
  logger.info('Reserving inventory', { inventoryId, quantity });

  const item = await repository.reserveInventory(inventoryId, quantity);
  if (!item) {
    throw new Error(`Inventory item not found: ${inventoryId}`);
  }

  // Invalidate cache
  await cache.del(stockroomInventoryCacheKey(item.stockroomId));

  // Publish reservation event
  await publishEvent('INVENTORY_RESERVED', {
    inventoryId: item.inventoryId,
    stockroomId: item.stockroomId,
    quantityReserved: quantity,
    totalReserved: item.quantityReserved,
    reservedBy: userId,
  });

  return item;
}

/**
 * Release reserved inventory
 */
export async function releaseReservation(
  inventoryId: UUID,
  quantity: number,
  userId?: UUID
): Promise<StockroomInventoryItem> {
  logger.info('Releasing inventory reservation', { inventoryId, quantity });

  const item = await repository.releaseReservation(inventoryId, quantity);
  if (!item) {
    throw new Error(`Inventory item not found: ${inventoryId}`);
  }

  // Invalidate cache
  await cache.del(stockroomInventoryCacheKey(item.stockroomId));

  // Publish release event
  await publishEvent('INVENTORY_RESERVATION_RELEASED', {
    inventoryId: item.inventoryId,
    stockroomId: item.stockroomId,
    quantityReleased: quantity,
    totalReserved: item.quantityReserved,
    releasedBy: userId,
  });

  return item;
}

/**
 * Check stock levels and generate replenishment alerts
 * Requirement 3.3: Generate replenishment alerts when stock falls below threshold
 */
export async function checkStockLevels(stockroomId?: UUID): Promise<ReplenishmentAlert[]> {
  logger.info('Checking stock levels', { stockroomId });

  const lowStockItems = await repository.getItemsBelowReorderPoint(stockroomId);

  const alerts = lowStockItems.map(createReplenishmentAlert);

  logger.info('Stock level check complete', {
    stockroomId,
    lowStockCount: alerts.length,
    criticalCount: alerts.filter(a => a.priority === 'CRITICAL').length,
    highCount: alerts.filter(a => a.priority === 'HIGH').length,
  });

  return alerts;
}

/**
 * Generate and publish replenishment alerts for all low stock items
 * Requirement 3.3: Generate replenishment alerts or purchase requests
 */
export async function generateReplenishmentAlerts(stockroomId?: UUID): Promise<ReplenishmentAlert[]> {
  logger.info('Generating replenishment alerts', { stockroomId });

  const alerts = await checkStockLevels(stockroomId);

  // Publish each alert
  for (const alert of alerts) {
    await publishReplenishmentAlert(alert);
  }

  logger.info('Replenishment alerts generated', {
    stockroomId,
    alertCount: alerts.length,
  });

  return alerts;
}

/**
 * Publish a replenishment alert event
 */
async function publishReplenishmentAlert(alert: ReplenishmentAlert): Promise<void> {
  await publishEvent('REPLENISHMENT_ALERT', {
    alertId: alert.alertId,
    alertType: alert.alertType,
    priority: alert.priority,
    stockroomId: alert.stockroomId,
    stockroomName: alert.stockroomName,
    inventoryId: alert.inventoryId,
    productId: alert.productId,
    productType: alert.productType,
    productSku: alert.productSku,
    productDescription: alert.productDescription,
    currentQuantity: alert.currentQuantity,
    reorderPoint: alert.reorderPoint,
    reorderQuantity: alert.reorderQuantity,
    shortfall: alert.shortfall,
  });

  logger.info('Replenishment alert published', {
    alertId: alert.alertId,
    alertType: alert.alertType,
    priority: alert.priority,
    stockroomId: alert.stockroomId,
    inventoryId: alert.inventoryId,
  });
}

/**
 * Get stockroom inventory summary
 */
export async function getStockroomSummary(stockroomId: UUID): Promise<{
  stockroom: Stockroom;
  summary: {
    totalItems: number;
    totalQuantity: number;
    totalValue: number;
    lowStockCount: number;
    outOfStockCount: number;
  };
}> {
  const stockroom = await repository.getStockroomById(stockroomId);
  if (!stockroom) {
    throw new Error(`Stockroom not found: ${stockroomId}`);
  }

  const summary = await repository.getStockroomSummary(stockroomId);

  return { stockroom, summary };
}

// Re-export types
export type {
  CreateInventoryRequest,
  CreateStockroomRequest,
  LowStockItem,
  ProductType,
  Stockroom,
  StockroomInventoryItem,
  StockroomListFilters,
  UpdateInventoryRequest,
  UpdateStockroomRequest,
} from './stockroom-repository';

export type { StockroomType } from '@ams/types';
