/**
 * Manufacturer Service - Business logic layer for manufacturer management
 *
 * Implements:
 * - Manufacturer CRUD operations (Requirement 10.1-10.5)
 * - Cache management for manufacturer data
 * - Event publishing for manufacturer state changes
 * - Dependency checking for models and assets
 */

import type {
  CreateManufacturerRequest,
  ManufacturerDetails,
  ManufacturerListFilters,
  PaginatedResult,
  PaginationParams,
  UpdateManufacturerRequest,
  UUID,
} from '@ams/types';
import * as cache from '@ams/cache';
import { CACHE_ENTITY_TYPES, listKey } from '@ams/cache';
import { publishEvent } from '@ams/events';
import { createLogger } from '@ams/utils';

import * as repository from './manufacturer-repository';

const logger = createLogger({ service: 'manufacturer-service' });

// ============================================================================
// Cache Key Helpers
// ============================================================================

/**
 * Build a cache key for a manufacturer
 * Format: manufacturer:{manufacturer_id}
 */
function manufacturerKey(manufacturerId: UUID): string {
  return `${CACHE_ENTITY_TYPES.MANUFACTURER}:${manufacturerId}`;
}

/**
 * Build a cache key for manufacturer by code
 * Format: manufacturer:code:{code}
 */
function manufacturerByCodeKey(code: string): string {
  return `${CACHE_ENTITY_TYPES.MANUFACTURER}:code:${code}`;
}

/**
 * Build a cache key for manufacturer list
 * Format: manufacturer:list or manufacturer:list:{sorted_params}
 */
function manufacturerListKey(params?: Record<string, unknown>): string {
  return listKey(CACHE_ENTITY_TYPES.MANUFACTURER, params);
}

// ============================================================================
// Error Types
// ============================================================================

/**
 * Error thrown when manufacturer is not found
 */
export class ManufacturerNotFoundError extends Error {
  constructor(manufacturerId: UUID) {
    super(`Manufacturer not found: ${manufacturerId}`);
    this.name = 'ManufacturerNotFoundError';
  }
}

/**
 * Error thrown when manufacturer code already exists
 */
export class ManufacturerCodeExistsError extends Error {
  constructor(code: string) {
    super(`Manufacturer code '${code}' already exists`);
    this.name = 'ManufacturerCodeExistsError';
  }
}

/**
 * Error thrown when manufacturer name already exists
 */
export class ManufacturerNameExistsError extends Error {
  constructor(name: string) {
    super(`Manufacturer name '${name}' already exists`);
    this.name = 'ManufacturerNameExistsError';
  }
}

/**
 * Error thrown when manufacturer has dependencies and cannot be deleted
 * Requirement 10.5: Prevent deletion if has associated models
 */
export class ManufacturerHasDependenciesError extends Error {
  readonly modelCount: number;
  readonly assetCount: number;

  constructor(manufacturerId: UUID, modelCount: number, assetCount: number) {
    super(
      `Cannot delete manufacturer ${manufacturerId}: has ${modelCount} model(s) and ${assetCount} asset(s)`
    );
    this.name = 'ManufacturerHasDependenciesError';
    this.modelCount = modelCount;
    this.assetCount = assetCount;
  }
}

// ============================================================================
// Cache Helpers
// ============================================================================

/**
 * Build patterns for invalidating manufacturer-related cache entries
 */
function manufacturerInvalidationPatterns(manufacturerId: UUID): string[] {
  return [
    `${CACHE_ENTITY_TYPES.MANUFACTURER}:${manufacturerId}*`,
    `${CACHE_ENTITY_TYPES.MANUFACTURER}:list*`,
    `${CACHE_ENTITY_TYPES.MANUFACTURER}:all*`,
    `${CACHE_ENTITY_TYPES.MANUFACTURER}:active*`,
    `${CACHE_ENTITY_TYPES.MANUFACTURER}:with-models*`,
    `search:${CACHE_ENTITY_TYPES.MANUFACTURER}:*`,
  ];
}

/**
 * Invalidate all manufacturer-related cache entries
 */
async function invalidateManufacturerCache(manufacturerId: UUID): Promise<void> {
  const patterns = manufacturerInvalidationPatterns(manufacturerId);
  for (const pattern of patterns) {
    await cache.delPattern(pattern);
  }
  // Also invalidate the specific manufacturer key
  await cache.del(manufacturerKey(manufacturerId));
}

// ============================================================================
// Manufacturer Service Functions
// ============================================================================

/**
 * Create a new manufacturer
 * Requirement 10.1: Create manufacturer with name and optional website
 *
 * @param request - Manufacturer creation request
 * @param userId - ID of user creating the manufacturer
 * @returns Created manufacturer
 * @throws ManufacturerNameExistsError if manufacturer name already exists
 */
export async function createManufacturer(
  request: CreateManufacturerRequest,
  userId?: UUID
): Promise<ManufacturerDetails> {
  logger.info('Creating manufacturer', { name: request.name });

  // Validate manufacturer name uniqueness
  const nameExists = await repository.manufacturerNameExists(request.name);
  if (nameExists) {
    throw new ManufacturerNameExistsError(request.name);
  }

  // Create the manufacturer
  const manufacturer = await repository.createManufacturer(request, userId);

  // Invalidate list cache
  await cache.del(manufacturerListKey());

  // Publish event
  await publishEvent('MANUFACTURER_CREATED', {
    manufacturerId: manufacturer.manufacturerId,
    name: manufacturer.name,
    createdBy: userId ?? '',
  });

  logger.info('Manufacturer created successfully', {
    manufacturerId: manufacturer.manufacturerId,
    name: manufacturer.name,
  });

  return manufacturer;
}

/**
 * Get manufacturer by ID
 * Requirement 10.2: Return manufacturer details including associated model count
 *
 * @param manufacturerId - Manufacturer ID
 * @returns Manufacturer or null if not found
 */
export async function getManufacturerById(manufacturerId: UUID): Promise<ManufacturerDetails | null> {
  const cacheKeyStr = manufacturerKey(manufacturerId);

  return cache.getOrSet(
    cacheKeyStr,
    () => repository.getManufacturerById(manufacturerId),
    { ttl: cache.DEFAULT_TTL.MEDIUM }
  );
}

/**
 * Get manufacturer by ID, throwing if not found
 *
 * @param manufacturerId - Manufacturer ID
 * @returns Manufacturer
 * @throws ManufacturerNotFoundError if manufacturer not found
 */
export async function getManufacturerOrThrow(manufacturerId: UUID): Promise<ManufacturerDetails> {
  const manufacturer = await getManufacturerById(manufacturerId);
  if (!manufacturer) {
    throw new ManufacturerNotFoundError(manufacturerId);
  }
  return manufacturer;
}

/**
 * Get manufacturer by code
 *
 * @param code - Manufacturer code
 * @returns Manufacturer or null if not found
 */
export async function getManufacturerByCode(code: string): Promise<ManufacturerDetails | null> {
  const cacheKeyStr = manufacturerByCodeKey(code);

  return cache.getOrSet(
    cacheKeyStr,
    () => repository.getManufacturerByCode(code),
    { ttl: cache.DEFAULT_TTL.MEDIUM }
  );
}

/**
 * Update manufacturer details
 * Requirement 10.3: Update manufacturer details
 *
 * @param manufacturerId - Manufacturer ID
 * @param request - Update request
 * @param userId - ID of user updating the manufacturer
 * @returns Updated manufacturer
 * @throws ManufacturerNotFoundError if manufacturer not found
 * @throws ManufacturerNameExistsError if new name already exists
 */
export async function updateManufacturer(
  manufacturerId: UUID,
  request: UpdateManufacturerRequest,
  userId?: UUID
): Promise<ManufacturerDetails> {
  logger.info('Updating manufacturer', { manufacturerId, updates: Object.keys(request) });

  // Verify manufacturer exists
  const existing = await repository.getManufacturerById(manufacturerId);
  if (!existing) {
    throw new ManufacturerNotFoundError(manufacturerId);
  }

  // Validate name uniqueness if name is being changed
  if (request.name !== undefined && request.name !== existing.name) {
    const nameExists = await repository.manufacturerNameExists(request.name, manufacturerId);
    if (nameExists) {
      throw new ManufacturerNameExistsError(request.name);
    }
  }

  // Update the manufacturer
  const updated = await repository.updateManufacturer(manufacturerId, request, userId);
  if (!updated) {
    throw new ManufacturerNotFoundError(manufacturerId);
  }

  // Invalidate cache
  await invalidateManufacturerCache(manufacturerId);

  // Build changes array for event
  const changes: { field: string; oldValue: unknown; newValue: unknown }[] = [];
  if (request.name !== undefined && request.name !== existing.name) {
    changes.push({ field: 'name', oldValue: existing.name, newValue: request.name });
  }
  if (request.website !== undefined && request.website !== existing.website) {
    changes.push({ field: 'website', oldValue: existing.website, newValue: request.website });
  }
  if (request.isActive !== undefined && request.isActive !== existing.isActive) {
    changes.push({ field: 'isActive', oldValue: existing.isActive, newValue: request.isActive });
  }

  // Publish event if there are changes
  if (changes.length > 0) {
    await publishEvent('MANUFACTURER_UPDATED', {
      manufacturerId: updated.manufacturerId,
      name: updated.name,
      changes,
      updatedBy: userId ?? '',
    });
  }

  logger.info('Manufacturer updated successfully', { manufacturerId });

  return updated;
}

/**
 * Deactivate a manufacturer
 *
 * @param manufacturerId - Manufacturer ID
 * @param userId - ID of user deactivating the manufacturer
 * @returns Deactivated manufacturer
 * @throws ManufacturerNotFoundError if manufacturer not found
 */
export async function deactivateManufacturer(
  manufacturerId: UUID,
  userId?: UUID
): Promise<ManufacturerDetails> {
  logger.info('Deactivating manufacturer', { manufacturerId });

  // Verify manufacturer exists
  const existing = await repository.getManufacturerById(manufacturerId);
  if (!existing) {
    throw new ManufacturerNotFoundError(manufacturerId);
  }

  // Check for dependencies before deactivation (warning only)
  const dependencies = await repository.getManufacturerDependencies(manufacturerId);
  if (dependencies.modelCount > 0 || dependencies.assetCount > 0) {
    logger.warn('Deactivating manufacturer with dependencies', {
      manufacturerId,
      modelCount: dependencies.modelCount,
      assetCount: dependencies.assetCount,
    });
  }

  // Deactivate the manufacturer
  const deactivated = await repository.deactivateManufacturer(manufacturerId, userId);
  if (!deactivated) {
    throw new ManufacturerNotFoundError(manufacturerId);
  }

  // Invalidate cache
  await invalidateManufacturerCache(manufacturerId);

  // Publish event
  await publishEvent('MANUFACTURER_UPDATED', {
    manufacturerId: deactivated.manufacturerId,
    name: deactivated.name,
    changes: [{ field: 'isActive', oldValue: true, newValue: false }],
    updatedBy: userId ?? '',
  });

  logger.info('Manufacturer deactivated successfully', { manufacturerId });

  return deactivated;
}

/**
 * Delete a manufacturer
 * Requirement 10.5: Reject deletion if has associated models
 *
 * @param manufacturerId - Manufacturer ID
 * @returns true if deleted
 * @throws ManufacturerNotFoundError if manufacturer not found
 * @throws ManufacturerHasDependenciesError if manufacturer has models or assets
 */
export async function deleteManufacturer(manufacturerId: UUID): Promise<boolean> {
  logger.info('Deleting manufacturer', { manufacturerId });

  // Verify manufacturer exists
  const existing = await repository.getManufacturerById(manufacturerId);
  if (!existing) {
    throw new ManufacturerNotFoundError(manufacturerId);
  }

  // Check for dependencies
  const dependencies = await repository.getManufacturerDependencies(manufacturerId);
  if (dependencies.modelCount > 0 || dependencies.assetCount > 0) {
    throw new ManufacturerHasDependenciesError(
      manufacturerId,
      dependencies.modelCount,
      dependencies.assetCount
    );
  }

  // Delete the manufacturer
  const deleted = await repository.deleteManufacturer(manufacturerId);

  if (deleted) {
    // Invalidate cache
    await invalidateManufacturerCache(manufacturerId);

    logger.info('Manufacturer deleted successfully', { manufacturerId });
  }

  return deleted;
}

/**
 * List manufacturers with pagination and filters
 * Requirement 10.4: Return paginated list with optional search filter
 *
 * @param filters - Filter criteria
 * @param pagination - Pagination parameters
 * @returns Paginated list of manufacturers
 */
export async function listManufacturers(
  filters: ManufacturerListFilters = {},
  pagination: PaginationParams = {}
): Promise<PaginatedResult<ManufacturerDetails>> {
  logger.debug('Listing manufacturers', { filters, pagination });

  // For simple list queries without filters, use cache
  const hasFilters = Object.keys(filters).length > 0;
  const isFirstPage = (pagination.page ?? 1) === 1;
  const isDefaultLimit = (pagination.limit ?? 20) === 20;

  if (!hasFilters && isFirstPage && isDefaultLimit) {
    const cacheKeyStr = manufacturerListKey();
    return cache.getOrSet(
      cacheKeyStr,
      () => repository.listManufacturers(filters, pagination),
      { ttl: cache.DEFAULT_TTL.SHORT }
    );
  }

  return repository.listManufacturers(filters, pagination);
}

/**
 * Search manufacturers by name or code
 * Requirement 10.4: Return matching manufacturers using partial text matching
 *
 * @param searchTerm - Search term
 * @returns List of matching manufacturers
 */
export async function searchManufacturers(searchTerm: string): Promise<ManufacturerDetails[]> {
  logger.debug('Searching manufacturers', { searchTerm });

  const cacheKeyStr = `search:${CACHE_ENTITY_TYPES.MANUFACTURER}:${searchTerm.toLowerCase()}`;

  return cache.getOrSet(
    cacheKeyStr,
    () => repository.searchManufacturers(searchTerm),
    { ttl: cache.DEFAULT_TTL.SHORT }
  );
}

/**
 * Get all manufacturers
 *
 * @returns List of all manufacturers
 */
export async function getAllManufacturers(): Promise<ManufacturerDetails[]> {
  const cacheKeyStr = `${CACHE_ENTITY_TYPES.MANUFACTURER}:all`;

  return cache.getOrSet(
    cacheKeyStr,
    () => repository.getAllManufacturers(),
    { ttl: cache.DEFAULT_TTL.MEDIUM }
  );
}

/**
 * Get active manufacturers only
 *
 * @returns List of active manufacturers
 */
export async function getActiveManufacturers(): Promise<ManufacturerDetails[]> {
  const cacheKeyStr = `${CACHE_ENTITY_TYPES.MANUFACTURER}:active`;

  return cache.getOrSet(
    cacheKeyStr,
    () => repository.getActiveManufacturers(),
    { ttl: cache.DEFAULT_TTL.MEDIUM }
  );
}

/**
 * Get manufacturers with models
 * Returns only manufacturers that have at least one model
 *
 * @returns List of manufacturers with models
 */
export async function getManufacturersWithModels(): Promise<ManufacturerDetails[]> {
  const cacheKeyStr = `${CACHE_ENTITY_TYPES.MANUFACTURER}:with-models`;

  return cache.getOrSet(
    cacheKeyStr,
    () => repository.getManufacturersWithModels(),
    { ttl: cache.DEFAULT_TTL.MEDIUM }
  );
}

/**
 * Validate manufacturer name uniqueness
 * Used for form validation before submission
 *
 * @param name - Manufacturer name to validate
 * @param excludeId - Manufacturer ID to exclude (for updates)
 * @returns true if name is unique
 */
export async function isManufacturerNameUnique(
  name: string,
  excludeId?: UUID
): Promise<boolean> {
  const exists = await repository.manufacturerNameExists(name, excludeId);
  return !exists;
}

/**
 * Reactivate a manufacturer
 *
 * @param manufacturerId - Manufacturer ID
 * @param userId - ID of user reactivating the manufacturer
 * @returns Reactivated manufacturer
 * @throws ManufacturerNotFoundError if manufacturer not found
 */
export async function reactivateManufacturer(
  manufacturerId: UUID,
  userId?: UUID
): Promise<ManufacturerDetails> {
  logger.info('Reactivating manufacturer', { manufacturerId });

  // Verify manufacturer exists
  const existing = await repository.getManufacturerById(manufacturerId);
  if (!existing) {
    throw new ManufacturerNotFoundError(manufacturerId);
  }

  // Reactivate the manufacturer
  const reactivated = await repository.updateManufacturer(
    manufacturerId,
    { isActive: true },
    userId
  );
  if (!reactivated) {
    throw new ManufacturerNotFoundError(manufacturerId);
  }

  // Invalidate cache
  await invalidateManufacturerCache(manufacturerId);

  // Publish event
  await publishEvent('MANUFACTURER_UPDATED', {
    manufacturerId: reactivated.manufacturerId,
    name: reactivated.name,
    changes: [{ field: 'isActive', oldValue: false, newValue: true }],
    updatedBy: userId ?? '',
  });

  logger.info('Manufacturer reactivated successfully', { manufacturerId });

  return reactivated;
}

/**
 * Get manufacturer summary with dependency counts
 *
 * @param manufacturerId - Manufacturer ID
 * @returns Manufacturer summary or null if not found
 */
export async function getManufacturerSummary(manufacturerId: UUID): Promise<{
  manufacturer: ManufacturerDetails;
  modelCount: number;
  assetCount: number;
  canDelete: boolean;
} | null> {
  const manufacturer = await getManufacturerById(manufacturerId);
  if (!manufacturer) {
    return null;
  }

  const dependencies = await repository.getManufacturerDependencies(manufacturerId);

  return {
    manufacturer,
    modelCount: dependencies.modelCount,
    assetCount: dependencies.assetCount,
    canDelete: dependencies.modelCount === 0 && dependencies.assetCount === 0,
  };
}

