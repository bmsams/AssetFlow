/**
 * Vendor Service - Business logic layer for vendor management
 *
 * Implements:
 * - Vendor CRUD operations (Requirement 9.1-9.7)
 * - Rating change tracking with audit trail (Requirement 9.4)
 * - Cache management for vendor data
 * - Event publishing for vendor state changes
 * - Vendor filtering by type, rating, and purchasing eligibility
 */

import type {
  CreateVendorRequest,
  PaginatedResult,
  PaginationParams,
  UpdateVendorRequest,
  UUID,
  VendorDetails,
  VendorListFilters,
  VendorRating,
  VendorType,
} from '@ams/types';
import * as cache from '@ams/cache';
import { CACHE_ENTITY_TYPES, listKey } from '@ams/cache';
import { publishEvent } from '@ams/events';
import { createLogger } from '@ams/utils';

import * as repository from './vendor-repository';

const logger = createLogger({ service: 'vendor-service' });

// ============================================================================
// Cache Key Helpers
// ============================================================================

/**
 * Build a cache key for a vendor
 * Format: vendor:{vendor_id}
 */
function vendorKey(vendorId: UUID): string {
  return `${CACHE_ENTITY_TYPES.VENDOR}:${vendorId}`;
}

/**
 * Build a cache key for vendor by code
 * Format: vendor:code:{vendor_code}
 */
function vendorByCodeKey(vendorCode: string): string {
  return `${CACHE_ENTITY_TYPES.VENDOR}:code:${vendorCode}`;
}

/**
 * Build a cache key for vendors by type
 * Format: vendor:type:{vendor_type}
 */
function vendorsByTypeKey(vendorType: VendorType): string {
  return `${CACHE_ENTITY_TYPES.VENDOR}:type:${vendorType}`;
}

/**
 * Build a cache key for vendors by rating
 * Format: vendor:rating:{rating}
 */
function vendorsByRatingKey(rating: VendorRating): string {
  return `${CACHE_ENTITY_TYPES.VENDOR}:rating:${rating}`;
}

/**
 * Build a cache key for vendor list
 * Format: vendor:list or vendor:list:{sorted_params}
 */
function vendorListKey(params?: Record<string, unknown>): string {
  return listKey(CACHE_ENTITY_TYPES.VENDOR, params);
}

// ============================================================================
// Error Types
// ============================================================================

/**
 * Error thrown when vendor is not found
 */
export class VendorNotFoundError extends Error {
  constructor(vendorId: UUID) {
    super(`Vendor not found: ${vendorId}`);
    this.name = 'VendorNotFoundError';
  }
}

/**
 * Error thrown when vendor code already exists
 */
export class VendorCodeExistsError extends Error {
  constructor(code: string) {
    super(`Vendor code '${code}' already exists`);
    this.name = 'VendorCodeExistsError';
  }
}

/**
 * Error thrown when vendor has dependencies and cannot be deleted
 * Requirement 9.5: Prevent deletion if has purchase orders or assets
 */
export class VendorHasDependenciesError extends Error {
  readonly poCount: number;
  readonly assetCount: number;

  constructor(vendorId: UUID, poCount: number, assetCount: number) {
    super(
      `Cannot delete vendor ${vendorId}: has ${poCount} purchase order(s) and ${assetCount} asset(s)`
    );
    this.name = 'VendorHasDependenciesError';
    this.poCount = poCount;
    this.assetCount = assetCount;
  }
}

// ============================================================================
// Cache Helpers
// ============================================================================

/**
 * Build patterns for invalidating vendor-related cache entries
 */
function vendorInvalidationPatterns(vendorId: UUID, vendorCode?: string | null): string[] {
  const patterns: string[] = [
    `${CACHE_ENTITY_TYPES.VENDOR}:${vendorId}*`,
    `${CACHE_ENTITY_TYPES.VENDOR}:list*`,
    `${CACHE_ENTITY_TYPES.VENDOR}:all*`,
    `${CACHE_ENTITY_TYPES.VENDOR}:active*`,
    `${CACHE_ENTITY_TYPES.VENDOR}:type:*`,
    `${CACHE_ENTITY_TYPES.VENDOR}:rating:*`,
    `${CACHE_ENTITY_TYPES.VENDOR}:purchasing*`,
    `${CACHE_ENTITY_TYPES.VENDOR}:preferred*`,
    `${CACHE_ENTITY_TYPES.VENDOR}:approved*`,
    `search:${CACHE_ENTITY_TYPES.VENDOR}:*`,
  ];

  if (vendorCode) {
    patterns.push(`${CACHE_ENTITY_TYPES.VENDOR}:code:${vendorCode}*`);
  }

  return patterns;
}

/**
 * Invalidate all vendor-related cache entries
 */
async function invalidateVendorCache(vendorId: UUID, vendorCode?: string | null): Promise<void> {
  const patterns = vendorInvalidationPatterns(vendorId, vendorCode);
  for (const pattern of patterns) {
    await cache.delPattern(pattern);
  }
  // Also invalidate the specific vendor key
  await cache.del(vendorKey(vendorId));
}

// ============================================================================
// Vendor Service Functions
// ============================================================================

/**
 * Create a new vendor
 * Requirement 9.1: Create vendor with name, type, contact information, and payment terms
 *
 * @param request - Vendor creation request
 * @param userId - ID of user creating the vendor
 * @returns Created vendor
 * @throws VendorCodeExistsError if vendor code already exists
 */
export async function createVendor(
  request: CreateVendorRequest,
  userId?: UUID
): Promise<VendorDetails> {
  logger.info('Creating vendor', { vendorCode: request.vendorCode, vendorName: request.vendorName });

  // Validate vendor code uniqueness if provided
  if (request.vendorCode) {
    const codeExists = await repository.vendorCodeExists(request.vendorCode);
    if (codeExists) {
      throw new VendorCodeExistsError(request.vendorCode);
    }
  }

  // Create the vendor
  const vendor = await repository.createVendor(request, userId);

  // Invalidate list cache
  await cache.del(vendorListKey());

  // Publish event
  await publishEvent('VENDOR_CREATED', {
    vendorId: vendor.vendorId,
    vendorCode: vendor.vendorCode,
    vendorName: vendor.vendorName,
    createdBy: userId ?? '',
  });

  logger.info('Vendor created successfully', {
    vendorId: vendor.vendorId,
    vendorCode: vendor.vendorCode,
    vendorName: vendor.vendorName,
  });

  return vendor;
}

/**
 * Get vendor by ID
 * Requirement 9.2: Return complete vendor details including contacts and payment terms
 *
 * @param vendorId - Vendor ID
 * @returns Vendor or null if not found
 */
export async function getVendorById(vendorId: UUID): Promise<VendorDetails | null> {
  const cacheKeyStr = vendorKey(vendorId);

  return cache.getOrSet(
    cacheKeyStr,
    () => repository.getVendorById(vendorId),
    { ttl: cache.DEFAULT_TTL.MEDIUM }
  );
}

/**
 * Get vendor by ID, throwing if not found
 *
 * @param vendorId - Vendor ID
 * @returns Vendor
 * @throws VendorNotFoundError if vendor not found
 */
export async function getVendorOrThrow(vendorId: UUID): Promise<VendorDetails> {
  const vendor = await getVendorById(vendorId);
  if (!vendor) {
    throw new VendorNotFoundError(vendorId);
  }
  return vendor;
}

/**
 * Get vendor by code
 *
 * @param code - Vendor code
 * @returns Vendor or null if not found
 */
export async function getVendorByCode(code: string): Promise<VendorDetails | null> {
  const cacheKeyStr = vendorByCodeKey(code);

  return cache.getOrSet(
    cacheKeyStr,
    () => repository.getVendorByCode(code),
    { ttl: cache.DEFAULT_TTL.MEDIUM }
  );
}

/**
 * Update vendor details
 * Requirement 9.3: Update vendor details including contacts and payment terms
 *
 * @param vendorId - Vendor ID
 * @param request - Update request
 * @param userId - ID of user updating the vendor
 * @returns Updated vendor
 * @throws VendorNotFoundError if vendor not found
 */
export async function updateVendor(
  vendorId: UUID,
  request: UpdateVendorRequest,
  userId?: UUID
): Promise<VendorDetails> {
  logger.info('Updating vendor', { vendorId, updates: Object.keys(request) });

  // Verify vendor exists
  const existing = await repository.getVendorById(vendorId);
  if (!existing) {
    throw new VendorNotFoundError(vendorId);
  }

  // Update the vendor
  const updated = await repository.updateVendor(vendorId, request, userId);
  if (!updated) {
    throw new VendorNotFoundError(vendorId);
  }

  // Invalidate cache
  await invalidateVendorCache(vendorId, existing.vendorCode);

  // Build changes array for event
  const changes: { field: string; oldValue: unknown; newValue: unknown }[] = [];
  if (request.vendorName !== undefined && request.vendorName !== existing.vendorName) {
    changes.push({ field: 'vendorName', oldValue: existing.vendorName, newValue: request.vendorName });
  }
  if (request.vendorType !== undefined && request.vendorType !== existing.vendorType) {
    changes.push({ field: 'vendorType', oldValue: existing.vendorType, newValue: request.vendorType });
  }
  if (request.contactName !== undefined && request.contactName !== existing.contactName) {
    changes.push({ field: 'contactName', oldValue: existing.contactName, newValue: request.contactName });
  }
  if (request.contactEmail !== undefined && request.contactEmail !== existing.contactEmail) {
    changes.push({ field: 'contactEmail', oldValue: existing.contactEmail, newValue: request.contactEmail });
  }
  if (request.contactPhone !== undefined && request.contactPhone !== existing.contactPhone) {
    changes.push({ field: 'contactPhone', oldValue: existing.contactPhone, newValue: request.contactPhone });
  }
  if (request.paymentTerms !== undefined && request.paymentTerms !== existing.paymentTerms) {
    changes.push({ field: 'paymentTerms', oldValue: existing.paymentTerms, newValue: request.paymentTerms });
  }
  if (request.isActive !== undefined && request.isActive !== existing.isActive) {
    changes.push({ field: 'isActive', oldValue: existing.isActive, newValue: request.isActive });
  }

  // Publish event if there are changes
  if (changes.length > 0) {
    await publishEvent('VENDOR_UPDATED', {
      vendorId: updated.vendorId,
      vendorName: updated.vendorName,
      changes,
      updatedBy: userId ?? '',
    });
  }

  logger.info('Vendor updated successfully', { vendorId });

  return updated;
}

/**
 * Deactivate a vendor
 * Requirement 9.5: Mark vendor as inactive and prevent new purchase orders
 *
 * @param vendorId - Vendor ID
 * @param userId - ID of user deactivating the vendor
 * @returns Deactivated vendor
 * @throws VendorNotFoundError if vendor not found
 */
export async function deactivateVendor(
  vendorId: UUID,
  userId?: UUID
): Promise<VendorDetails> {
  logger.info('Deactivating vendor', { vendorId });

  // Verify vendor exists
  const existing = await repository.getVendorById(vendorId);
  if (!existing) {
    throw new VendorNotFoundError(vendorId);
  }

  // Check for dependencies before deactivation (warning only)
  const dependencies = await repository.getVendorDependencies(vendorId);
  if (dependencies.poCount > 0 || dependencies.assetCount > 0) {
    logger.warn('Deactivating vendor with dependencies', {
      vendorId,
      poCount: dependencies.poCount,
      assetCount: dependencies.assetCount,
    });
  }

  // Deactivate the vendor
  const deactivated = await repository.deactivateVendor(vendorId, userId);
  if (!deactivated) {
    throw new VendorNotFoundError(vendorId);
  }

  // Invalidate cache
  await invalidateVendorCache(vendorId, existing.vendorCode);

  // Publish event
  await publishEvent('VENDOR_DEACTIVATED', {
    vendorId: deactivated.vendorId,
    vendorName: deactivated.vendorName,
    deactivatedBy: userId ?? '',
  });

  logger.info('Vendor deactivated successfully', { vendorId });

  return deactivated;
}

/**
 * Delete a vendor
 * Requirement 9.5: Reject deletion if has purchase orders or assets
 *
 * @param vendorId - Vendor ID
 * @returns true if deleted
 * @throws VendorNotFoundError if vendor not found
 * @throws VendorHasDependenciesError if vendor has purchase orders or assets
 */
export async function deleteVendor(vendorId: UUID): Promise<boolean> {
  logger.info('Deleting vendor', { vendorId });

  // Verify vendor exists
  const existing = await repository.getVendorById(vendorId);
  if (!existing) {
    throw new VendorNotFoundError(vendorId);
  }

  // Check for dependencies
  const dependencies = await repository.getVendorDependencies(vendorId);
  if (dependencies.poCount > 0 || dependencies.assetCount > 0) {
    throw new VendorHasDependenciesError(
      vendorId,
      dependencies.poCount,
      dependencies.assetCount
    );
  }

  // Delete the vendor
  const deleted = await repository.deleteVendor(vendorId);

  if (deleted) {
    // Invalidate cache
    await invalidateVendorCache(vendorId, existing.vendorCode);

    logger.info('Vendor deleted successfully', { vendorId });
  }

  return deleted;
}

/**
 * List vendors with pagination and filters
 * Requirement 9.6: Return paginated list with type and rating filters
 *
 * @param filters - Filter criteria
 * @param pagination - Pagination parameters
 * @returns Paginated list of vendors
 */
export async function listVendors(
  filters: VendorListFilters = {},
  pagination: PaginationParams = {}
): Promise<PaginatedResult<VendorDetails>> {
  logger.debug('Listing vendors', { filters, pagination });

  // For simple list queries without filters, use cache
  const hasFilters = Object.keys(filters).length > 0;
  const isFirstPage = (pagination.page ?? 1) === 1;
  const isDefaultLimit = (pagination.limit ?? 20) === 20;

  if (!hasFilters && isFirstPage && isDefaultLimit) {
    const cacheKeyStr = vendorListKey();
    return cache.getOrSet(
      cacheKeyStr,
      () => repository.listVendors(filters, pagination),
      { ttl: cache.DEFAULT_TTL.SHORT }
    );
  }

  return repository.listVendors(filters, pagination);
}

/**
 * Search vendors by name, code, or contact information
 * Requirement 9.7: Return matching vendors using partial text matching
 *
 * @param searchTerm - Search term
 * @returns List of matching vendors
 */
export async function searchVendors(searchTerm: string): Promise<VendorDetails[]> {
  logger.debug('Searching vendors', { searchTerm });

  const cacheKeyStr = `search:${CACHE_ENTITY_TYPES.VENDOR}:${searchTerm.toLowerCase()}`;

  return cache.getOrSet(
    cacheKeyStr,
    () => repository.searchVendors(searchTerm),
    { ttl: cache.DEFAULT_TTL.SHORT }
  );
}

/**
 * Update vendor rating
 * Requirement 9.4: Update rating and log the change in audit history
 *
 * @param vendorId - Vendor ID
 * @param newRating - New rating value
 * @param userId - ID of user changing the rating
 * @returns Updated vendor
 * @throws VendorNotFoundError if vendor not found
 */
export async function updateVendorRating(
  vendorId: UUID,
  newRating: VendorRating,
  userId?: UUID
): Promise<VendorDetails> {
  logger.info('Updating vendor rating', { vendorId, newRating });

  // Update rating and get previous value for audit
  const result = await repository.updateVendorRating(vendorId, newRating, userId);
  if (!result) {
    throw new VendorNotFoundError(vendorId);
  }

  const { vendor, previousRating } = result;

  // Invalidate cache
  await invalidateVendorCache(vendorId, vendor.vendorCode);

  // Publish rating change event for audit trail
  await publishEvent('VENDOR_RATING_CHANGED', {
    vendorId: vendor.vendorId,
    vendorName: vendor.vendorName,
    previousRating,
    newRating,
    changedBy: userId ?? '',
  });

  logger.info('Vendor rating updated successfully', {
    vendorId,
    previousRating,
    newRating,
  });

  return vendor;
}

/**
 * Get vendors by type
 * Requirement 9.6: Filter vendors by type
 *
 * @param vendorType - Vendor type
 * @returns List of vendors of the specified type
 */
export async function getVendorsByType(vendorType: VendorType): Promise<VendorDetails[]> {
  const cacheKeyStr = vendorsByTypeKey(vendorType);

  return cache.getOrSet(
    cacheKeyStr,
    () => repository.getVendorsByType(vendorType),
    { ttl: cache.DEFAULT_TTL.MEDIUM }
  );
}

/**
 * Get vendors by rating
 * Requirement 9.6: Filter vendors by rating
 *
 * @param rating - Vendor rating
 * @returns List of vendors with the specified rating
 */
export async function getVendorsByRating(rating: VendorRating): Promise<VendorDetails[]> {
  const cacheKeyStr = vendorsByRatingKey(rating);

  return cache.getOrSet(
    cacheKeyStr,
    () => repository.getVendorsByRating(rating),
    { ttl: cache.DEFAULT_TTL.MEDIUM }
  );
}

/**
 * Get vendors eligible for purchase orders
 * Excludes SUSPENDED and BLACKLISTED vendors
 *
 * @returns List of vendors eligible for purchasing
 */
export async function getVendorsForPurchasing(): Promise<VendorDetails[]> {
  const cacheKeyStr = `${CACHE_ENTITY_TYPES.VENDOR}:purchasing`;

  return cache.getOrSet(
    cacheKeyStr,
    () => repository.getVendorsForPurchasing(),
    { ttl: cache.DEFAULT_TTL.MEDIUM }
  );
}

/**
 * Get all vendors
 *
 * @returns List of all vendors
 */
export async function getAllVendors(): Promise<VendorDetails[]> {
  const cacheKeyStr = `${CACHE_ENTITY_TYPES.VENDOR}:all`;

  return cache.getOrSet(
    cacheKeyStr,
    () => repository.getAllVendors(),
    { ttl: cache.DEFAULT_TTL.MEDIUM }
  );
}

/**
 * Get active vendors only
 *
 * @returns List of active vendors
 */
export async function getActiveVendors(): Promise<VendorDetails[]> {
  const cacheKeyStr = `${CACHE_ENTITY_TYPES.VENDOR}:active`;

  return cache.getOrSet(
    cacheKeyStr,
    () => repository.getActiveVendors(),
    { ttl: cache.DEFAULT_TTL.MEDIUM }
  );
}

/**
 * Get preferred vendors (vendors with PREFERRED rating)
 *
 * @returns List of preferred vendors
 */
export async function getPreferredVendors(): Promise<VendorDetails[]> {
  const cacheKeyStr = `${CACHE_ENTITY_TYPES.VENDOR}:preferred`;

  return cache.getOrSet(
    cacheKeyStr,
    () => repository.getPreferredVendors(),
    { ttl: cache.DEFAULT_TTL.MEDIUM }
  );
}

/**
 * Get approved vendors (vendors with PREFERRED or APPROVED rating)
 *
 * @returns List of approved vendors
 */
export async function getApprovedVendors(): Promise<VendorDetails[]> {
  const cacheKeyStr = `${CACHE_ENTITY_TYPES.VENDOR}:approved`;

  return cache.getOrSet(
    cacheKeyStr,
    () => repository.getApprovedVendors(),
    { ttl: cache.DEFAULT_TTL.MEDIUM }
  );
}

/**
 * Validate vendor code uniqueness
 * Used for form validation before submission
 *
 * @param code - Vendor code to validate
 * @param excludeId - Vendor ID to exclude (for updates)
 * @returns true if code is unique
 */
export async function isVendorCodeUnique(
  code: string,
  excludeId?: UUID
): Promise<boolean> {
  const exists = await repository.vendorCodeExists(code, excludeId);
  return !exists;
}

/**
 * Reactivate a vendor
 *
 * @param vendorId - Vendor ID
 * @param userId - ID of user reactivating the vendor
 * @returns Reactivated vendor
 * @throws VendorNotFoundError if vendor not found
 */
export async function reactivateVendor(
  vendorId: UUID,
  userId?: UUID
): Promise<VendorDetails> {
  logger.info('Reactivating vendor', { vendorId });

  // Verify vendor exists
  const existing = await repository.getVendorById(vendorId);
  if (!existing) {
    throw new VendorNotFoundError(vendorId);
  }

  // Reactivate the vendor
  const reactivated = await repository.updateVendor(
    vendorId,
    { isActive: true },
    userId
  );
  if (!reactivated) {
    throw new VendorNotFoundError(vendorId);
  }

  // Invalidate cache
  await invalidateVendorCache(vendorId, existing.vendorCode);

  // Publish event
  await publishEvent('VENDOR_UPDATED', {
    vendorId: reactivated.vendorId,
    vendorName: reactivated.vendorName,
    changes: [{ field: 'isActive', oldValue: false, newValue: true }],
    updatedBy: userId ?? '',
  });

  logger.info('Vendor reactivated successfully', { vendorId });

  return reactivated;
}

/**
 * Check if vendor can receive purchase orders
 * Vendors with SUSPENDED or BLACKLISTED rating cannot receive POs
 *
 * @param vendorId - Vendor ID
 * @returns true if vendor can receive purchase orders
 */
export async function canReceivePurchaseOrders(vendorId: UUID): Promise<boolean> {
  const vendor = await getVendorById(vendorId);
  if (!vendor) {
    return false;
  }

  if (!vendor.isActive) {
    return false;
  }

  // SUSPENDED and BLACKLISTED vendors cannot receive POs
  if (vendor.rating === 'SUSPENDED' || vendor.rating === 'BLACKLISTED') {
    return false;
  }

  return true;
}

/**
 * Get vendor summary with dependency counts
 *
 * @param vendorId - Vendor ID
 * @returns Vendor summary or null if not found
 */
export async function getVendorSummary(vendorId: UUID): Promise<{
  vendor: VendorDetails;
  poCount: number;
  assetCount: number;
  canDelete: boolean;
  canReceivePOs: boolean;
} | null> {
  const vendor = await getVendorById(vendorId);
  if (!vendor) {
    return null;
  }

  const dependencies = await repository.getVendorDependencies(vendorId);
  const canReceivePOs = await canReceivePurchaseOrders(vendorId);

  return {
    vendor,
    poCount: dependencies.poCount,
    assetCount: dependencies.assetCount,
    canDelete: dependencies.poCount === 0 && dependencies.assetCount === 0,
    canReceivePOs,
  };
}
