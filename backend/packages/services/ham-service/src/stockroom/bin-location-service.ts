/**
 * Bin Location Service - Business logic layer for bin/shelf location management within stockrooms
 *
 * Implements:
 * - Bin location CRUD operations (Requirement 6.1-6.5)
 * - Cache management for bin location data
 * - Event publishing for bin location state changes
 * - Stockroom validation for bin location creation
 */

import type {
  BinLocation,
  BinLocationListFilters,
  CreateBinLocationRequest,
  PaginatedResult,
  PaginationParams,
  UpdateBinLocationRequest,
  UUID,
} from '@ams/types';
import * as cache from '@ams/cache';
import { binLocationKey, binLocationsByStockroomKey, binLocationInvalidationPatterns } from '@ams/cache';
import { publishEvent } from '@ams/events';
import { createLogger } from '@ams/utils';

import * as repository from './bin-location-repository';

const logger = createLogger({ service: 'bin-location-service' });

// ============================================================================
// Error Types
// ============================================================================

/**
 * Error thrown when bin location is not found
 */
export class BinLocationNotFoundError extends Error {
  constructor(binId: UUID) {
    super(`Bin location not found: ${binId}`);
    this.name = 'BinLocationNotFoundError';
  }
}

/**
 * Error thrown when bin code already exists in a stockroom
 */
export class BinCodeExistsError extends Error {
  constructor(stockroomId: UUID, binCode: string) {
    super(`Bin code "${binCode}" already exists in stockroom ${stockroomId}`);
    this.name = 'BinCodeExistsError';
  }
}

/**
 * Error thrown when bin location has dependencies and cannot be deleted
 */
export class BinLocationHasDependenciesError extends Error {
  readonly inventoryCount: number;

  constructor(binId: UUID, inventoryCount: number) {
    super(`Cannot delete bin location ${binId}: has ${inventoryCount} inventory item(s)`);
    this.name = 'BinLocationHasDependenciesError';
    this.inventoryCount = inventoryCount;
  }
}

/**
 * Error thrown when stockroom is not found (for bin location creation)
 * Requirement 6.5: Reject creation for non-existent stockroom
 */
export class StockroomNotFoundError extends Error {
  constructor(stockroomId: UUID) {
    super(`Stockroom not found: ${stockroomId}`);
    this.name = 'StockroomNotFoundError';
  }
}

// ============================================================================
// Cache Helpers
// ============================================================================

/**
 * Invalidate all bin location-related cache entries
 */
async function invalidateBinLocationCache(binId: UUID, stockroomId?: UUID): Promise<void> {
  const patterns = binLocationInvalidationPatterns(binId, stockroomId);
  for (const pattern of patterns) {
    await cache.delPattern(pattern);
  }
  // Also invalidate the specific bin location key
  await cache.del(binLocationKey(binId));
  if (stockroomId) {
    await cache.del(binLocationsByStockroomKey(stockroomId));
  }
}

// ============================================================================
// Bin Location Service Functions
// ============================================================================

/**
 * Create a new bin location
 * Requirement 6.1: Create bin location with stockroom reference, code, and capacity
 * Requirement 6.5: Reject creation for non-existent stockroom
 *
 * @param request - Bin location creation request
 * @param userId - ID of user creating the bin location
 * @returns Created bin location
 * @throws StockroomNotFoundError if stockroom does not exist
 * @throws BinCodeExistsError if bin code already exists in stockroom
 */
export async function createBinLocation(
  request: CreateBinLocationRequest,
  userId?: UUID
): Promise<BinLocation> {
  logger.info('Creating bin location', {
    stockroomId: request.stockroomId,
    binCode: request.binCode,
    capacity: request.capacity,
  });

  // Validate stockroom exists (Requirement 6.5)
  const stockroomExists = await repository.stockroomExists(request.stockroomId);
  if (!stockroomExists) {
    throw new StockroomNotFoundError(request.stockroomId);
  }

  // Validate bin code uniqueness within stockroom
  const binCodeExists = await repository.binCodeExistsInStockroom(
    request.stockroomId,
    request.binCode
  );
  if (binCodeExists) {
    throw new BinCodeExistsError(request.stockroomId, request.binCode);
  }

  // Create the bin location
  const binLocation = await repository.createBinLocation(request, userId);

  // Invalidate stockroom bin locations cache
  await cache.del(binLocationsByStockroomKey(request.stockroomId));

  // Publish event
  await publishEvent('BIN_LOCATION_CREATED', {
    binId: binLocation.binId,
    stockroomId: binLocation.stockroomId,
    binCode: binLocation.binCode,
    createdBy: userId ?? '',
  });

  logger.info('Bin location created successfully', {
    binId: binLocation.binId,
    stockroomId: binLocation.stockroomId,
    binCode: binLocation.binCode,
  });

  return binLocation;
}

/**
 * Get bin location by ID
 *
 * @param binId - Bin location ID
 * @returns Bin location or null if not found
 */
export async function getBinLocation(binId: UUID): Promise<BinLocation | null> {
  const cacheKeyStr = binLocationKey(binId);

  return cache.getOrSet(
    cacheKeyStr,
    () => repository.getBinLocationById(binId),
    { ttl: cache.DEFAULT_TTL.MEDIUM }
  );
}

/**
 * Get bin location by ID, throwing if not found
 *
 * @param binId - Bin location ID
 * @returns Bin location
 * @throws BinLocationNotFoundError if bin location not found
 */
export async function getBinLocationOrThrow(binId: UUID): Promise<BinLocation> {
  const binLocation = await getBinLocation(binId);
  if (!binLocation) {
    throw new BinLocationNotFoundError(binId);
  }
  return binLocation;
}

/**
 * Get all bin locations for a stockroom ordered by code
 * Requirement 6.2: Return all bin locations for a stockroom ordered by code
 *
 * @param stockroomId - Stockroom ID
 * @returns List of bin locations ordered by code
 */
export async function getBinLocationsByStockroom(stockroomId: UUID): Promise<BinLocation[]> {
  const cacheKeyStr = binLocationsByStockroomKey(stockroomId);

  return cache.getOrSet(
    cacheKeyStr,
    () => repository.getBinLocationsByStockroom(stockroomId),
    { ttl: cache.DEFAULT_TTL.MEDIUM }
  );
}

/**
 * Update bin location details
 * Requirement 6.3: Update specified fields and maintain stockroom relationship
 *
 * @param binId - Bin location ID
 * @param request - Update request
 * @param userId - ID of user updating the bin location
 * @returns Updated bin location
 * @throws BinLocationNotFoundError if bin location not found
 * @throws BinCodeExistsError if new bin code already exists in stockroom
 */
export async function updateBinLocation(
  binId: UUID,
  request: UpdateBinLocationRequest,
  userId?: UUID
): Promise<BinLocation> {
  logger.info('Updating bin location', { binId, updates: Object.keys(request) });

  // Verify bin location exists and get stockroom ID for cache invalidation
  const existing = await repository.getBinLocationById(binId);
  if (!existing) {
    throw new BinLocationNotFoundError(binId);
  }

  // Validate bin code uniqueness if bin code is being changed
  if (request.binCode && request.binCode !== existing.binCode) {
    const binCodeExists = await repository.binCodeExistsInStockroom(
      existing.stockroomId,
      request.binCode,
      binId
    );
    if (binCodeExists) {
      throw new BinCodeExistsError(existing.stockroomId, request.binCode);
    }
  }

  // Update the bin location
  const updated = await repository.updateBinLocation(binId, request, userId);
  if (!updated) {
    throw new BinLocationNotFoundError(binId);
  }

  // Invalidate cache
  await invalidateBinLocationCache(binId, existing.stockroomId);

  // Publish event
  await publishEvent('BIN_LOCATION_UPDATED', {
    binId: updated.binId,
    stockroomId: updated.stockroomId,
    changes: Object.keys(request).map(field => ({
      field,
      oldValue: (existing as unknown as Record<string, unknown>)[field],
      newValue: (request as unknown as Record<string, unknown>)[field],
    })),
    updatedBy: userId ?? '',
  });

  logger.info('Bin location updated successfully', { binId });

  return updated;
}

/**
 * Deactivate a bin location
 * Requirement 6.4: Mark bin location as inactive and prevent new inventory assignments
 *
 * @param binId - Bin location ID
 * @param userId - ID of user deactivating the bin location
 * @returns Deactivated bin location
 * @throws BinLocationNotFoundError if bin location not found
 */
export async function deactivateBinLocation(binId: UUID, userId?: UUID): Promise<BinLocation> {
  logger.info('Deactivating bin location', { binId });

  // Verify bin location exists and get stockroom ID for cache invalidation
  const existing = await repository.getBinLocationById(binId);
  if (!existing) {
    throw new BinLocationNotFoundError(binId);
  }

  // Deactivate the bin location
  const deactivated = await repository.deactivateBinLocation(binId, userId);
  if (!deactivated) {
    throw new BinLocationNotFoundError(binId);
  }

  // Invalidate cache
  await invalidateBinLocationCache(binId, existing.stockroomId);

  // Publish event
  await publishEvent('BIN_LOCATION_UPDATED', {
    binId: deactivated.binId,
    stockroomId: deactivated.stockroomId,
    changes: [{ field: 'isActive', oldValue: true, newValue: false }],
    updatedBy: userId ?? '',
  });

  logger.info('Bin location deactivated successfully', { binId });

  return deactivated;
}

/**
 * Delete a bin location
 * Requirement 6.5: Reject deletion if bin location has items
 *
 * @param binId - Bin location ID
 * @returns true if deleted
 * @throws BinLocationNotFoundError if bin location not found
 * @throws BinLocationHasDependenciesError if bin location has inventory items
 */
export async function deleteBinLocation(binId: UUID): Promise<boolean> {
  logger.info('Deleting bin location', { binId });

  // Verify bin location exists and get stockroom ID for cache invalidation
  const existing = await repository.getBinLocationById(binId);
  if (!existing) {
    throw new BinLocationNotFoundError(binId);
  }

  // Check for dependencies
  const dependencies = await repository.getBinLocationDependencies(binId);
  if (dependencies.inventoryCount > 0) {
    throw new BinLocationHasDependenciesError(binId, dependencies.inventoryCount);
  }

  // Delete the bin location
  const deleted = await repository.deleteBinLocation(binId);

  if (deleted) {
    // Invalidate cache
    await invalidateBinLocationCache(binId, existing.stockroomId);

    logger.info('Bin location deleted successfully', { binId });
  }

  return deleted;
}

/**
 * List bin locations with pagination and filters
 *
 * @param filters - Filter criteria
 * @param pagination - Pagination parameters
 * @returns Paginated list of bin locations
 */
export async function listBinLocations(
  filters: BinLocationListFilters = {},
  pagination: PaginationParams = {}
): Promise<PaginatedResult<BinLocation>> {
  logger.debug('Listing bin locations', { filters, pagination });

  return repository.listBinLocations(filters, pagination);
}

/**
 * Validate bin code uniqueness within a stockroom
 * Used for form validation before submission
 *
 * @param stockroomId - Stockroom ID
 * @param binCode - Bin code to validate
 * @param excludeId - Bin location ID to exclude (for updates)
 * @returns true if bin code is unique within the stockroom
 */
export async function isBinCodeUnique(
  stockroomId: UUID,
  binCode: string,
  excludeId?: UUID
): Promise<boolean> {
  const exists = await repository.binCodeExistsInStockroom(
    stockroomId,
    binCode,
    excludeId
  );
  return !exists;
}

/**
 * Get bin location by stockroom and bin code
 *
 * @param stockroomId - Stockroom ID
 * @param binCode - Bin code
 * @returns Bin location or null if not found
 */
export async function getBinLocationByCode(
  stockroomId: UUID,
  binCode: string
): Promise<BinLocation | null> {
  return repository.getBinLocationByCode(stockroomId, binCode);
}

/**
 * Get all active bin locations for a stockroom (for dropdowns/selectors)
 *
 * @param stockroomId - Stockroom ID
 * @returns List of active bin locations
 */
export async function getActiveBinLocationsByStockroom(stockroomId: UUID): Promise<BinLocation[]> {
  const cacheKeyStr = `${binLocationsByStockroomKey(stockroomId)}:active`;

  return cache.getOrSet(
    cacheKeyStr,
    () => repository.getActiveBinLocationsByStockroom(stockroomId),
    { ttl: cache.DEFAULT_TTL.MEDIUM }
  );
}

/**
 * Get bin locations that are at or over capacity
 * Used for capacity alerts
 *
 * @param stockroomId - Optional stockroom ID to filter by
 * @returns List of bin locations at capacity
 */
export async function getBinLocationsAtCapacity(stockroomId?: UUID): Promise<BinLocation[]> {
  return repository.getBinLocationsAtCapacity(stockroomId);
}

/**
 * Get bin locations with available capacity
 * Used for finding bins that can accept more inventory
 *
 * @param stockroomId - Stockroom ID
 * @returns List of bin locations with available capacity
 */
export async function getBinLocationsWithAvailableCapacity(
  stockroomId: UUID
): Promise<BinLocation[]> {
  return repository.getBinLocationsWithAvailableCapacity(stockroomId);
}

/**
 * Get bin location utilization summary for a stockroom
 *
 * @param stockroomId - Stockroom ID
 * @returns Utilization summary
 */
export async function getBinLocationUtilizationSummary(stockroomId: UUID): Promise<{
  totalBins: number;
  activeBins: number;
  binsWithCapacity: number;
  binsAtCapacity: number;
  totalCapacity: number;
  totalCurrentCount: number;
  utilizationPercentage: number;
}> {
  return repository.getBinLocationUtilizationSummary(stockroomId);
}

/**
 * Update bin location current count
 * Used when inventory is added or removed from a bin
 *
 * @param binId - Bin location ID
 * @param newCount - New count value
 * @returns Updated bin location
 * @throws BinLocationNotFoundError if bin location not found
 */
export async function updateBinLocationCount(
  binId: UUID,
  newCount: number
): Promise<BinLocation> {
  logger.info('Updating bin location count', { binId, newCount });

  const updated = await repository.updateBinLocationCount(binId, newCount);
  if (!updated) {
    throw new BinLocationNotFoundError(binId);
  }

  // Invalidate cache
  await invalidateBinLocationCache(binId, updated.stockroomId);

  return updated;
}

/**
 * Increment bin location current count
 * Used when inventory is added to a bin
 *
 * @param binId - Bin location ID
 * @param amount - Amount to increment (default: 1)
 * @returns Updated bin location
 * @throws BinLocationNotFoundError if bin location not found
 */
export async function incrementBinLocationCount(
  binId: UUID,
  amount: number = 1
): Promise<BinLocation> {
  logger.info('Incrementing bin location count', { binId, amount });

  const updated = await repository.incrementBinLocationCount(binId, amount);
  if (!updated) {
    throw new BinLocationNotFoundError(binId);
  }

  // Invalidate cache
  await invalidateBinLocationCache(binId, updated.stockroomId);

  return updated;
}

/**
 * Decrement bin location current count
 * Used when inventory is removed from a bin
 *
 * @param binId - Bin location ID
 * @param amount - Amount to decrement (default: 1)
 * @returns Updated bin location
 * @throws BinLocationNotFoundError if bin location not found
 */
export async function decrementBinLocationCount(
  binId: UUID,
  amount: number = 1
): Promise<BinLocation> {
  logger.info('Decrementing bin location count', { binId, amount });

  const updated = await repository.decrementBinLocationCount(binId, amount);
  if (!updated) {
    throw new BinLocationNotFoundError(binId);
  }

  // Invalidate cache
  await invalidateBinLocationCache(binId, updated.stockroomId);

  return updated;
}
