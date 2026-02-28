/**
 * Bin Location Service
 *
 * Business logic for bin location management.
 *
 * Requirements: 6.1-6.4 - Bin Location CRUD operations
 */

import type {
  BinLocation,
  BinLocationListFilters,
  CreateBinLocationRequest,
  UpdateBinLocationRequest,
  UUID,
} from '@ams/types';
import { createLogger } from '@ams/utils';

import * as binLocationRepository from './bin-location-repository';

const logger = createLogger({ service: 'bin-location-service' });

// ============================================================================
// Error Classes
// ============================================================================

export class BinLocationNotFoundError extends Error {
  constructor(binId: string) {
    super(`Bin location not found: ${binId}`);
    this.name = 'BinLocationNotFoundError';
  }
}

export class BinCodeExistsError extends Error {
  constructor(stockroomId: string, binCode: string) {
    super(`Bin code '${binCode}' already exists in stockroom ${stockroomId}`);
    this.name = 'BinCodeExistsError';
  }
}

// ============================================================================
// Service Functions
// ============================================================================

interface PaginationParams {
  page: number;
  limit: number;
}

interface PaginatedResult<T> {
  items: T[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

/**
 * Create a new bin location
 */
export async function createBinLocation(
  request: CreateBinLocationRequest,
  createdBy?: UUID
): Promise<BinLocation> {
  logger.info('Creating bin location', { stockroomId: request.stockroomId, binCode: request.binCode });

  // Check for unique bin code within stockroom
  const isUnique = await binLocationRepository.isBinCodeUnique(request.stockroomId, request.binCode);
  if (!isUnique) {
    throw new BinCodeExistsError(request.stockroomId, request.binCode);
  }

  const binLocation = await binLocationRepository.createBinLocation(request, createdBy);

  logger.info('Bin location created', { binId: binLocation.binId });
  return binLocation;
}

/**
 * Get bin location by ID
 */
export async function getBinLocation(binId: UUID): Promise<BinLocation | null> {
  return binLocationRepository.getBinLocationById(binId);
}

/**
 * Update bin location
 */
export async function updateBinLocation(
  binId: UUID,
  request: UpdateBinLocationRequest,
  updatedBy?: UUID
): Promise<BinLocation> {
  const existing = await binLocationRepository.getBinLocationById(binId);
  if (!existing) {
    throw new BinLocationNotFoundError(binId);
  }

  // Check for unique bin code if being changed
  if (request.binCode && request.binCode !== existing.binCode) {
    const isUnique = await binLocationRepository.isBinCodeUnique(
      existing.stockroomId,
      request.binCode,
      binId
    );
    if (!isUnique) {
      throw new BinCodeExistsError(existing.stockroomId, request.binCode);
    }
  }

  const updated = await binLocationRepository.updateBinLocation(binId, request, updatedBy);
  if (!updated) {
    throw new BinLocationNotFoundError(binId);
  }

  logger.info('Bin location updated', { binId });
  return updated;
}

/**
 * Deactivate bin location (soft delete)
 */
export async function deactivateBinLocation(
  binId: UUID,
  updatedBy?: UUID
): Promise<BinLocation> {
  const existing = await binLocationRepository.getBinLocationById(binId);
  if (!existing) {
    throw new BinLocationNotFoundError(binId);
  }

  const deactivated = await binLocationRepository.deactivateBinLocation(binId, updatedBy);
  if (!deactivated) {
    throw new BinLocationNotFoundError(binId);
  }

  logger.info('Bin location deactivated', { binId });
  return deactivated;
}

/**
 * List bin locations with filters and pagination
 */
export async function listBinLocations(
  filters: BinLocationListFilters,
  pagination: PaginationParams
): Promise<PaginatedResult<BinLocation>> {
  return binLocationRepository.listBinLocations(filters, pagination);
}

/**
 * Get bin locations by stockroom
 */
export async function getBinLocationsByStockroom(stockroomId: UUID): Promise<BinLocation[]> {
  return binLocationRepository.getBinLocationsByStockroom(stockroomId);
}

/**
 * Check if bin code is unique within stockroom
 */
export async function isBinCodeUnique(
  stockroomId: UUID,
  binCode: string,
  excludeBinId?: UUID
): Promise<boolean> {
  return binLocationRepository.isBinCodeUnique(stockroomId, binCode, excludeBinId);
}
