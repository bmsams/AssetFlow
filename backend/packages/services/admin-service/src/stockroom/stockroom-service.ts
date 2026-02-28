/**
 * Stockroom Service
 *
 * Business logic for stockroom management.
 *
 * Requirements: 5.1-5.6 - Stockroom CRUD operations
 */

import type {
  CreateStockroomRequest,
  PaginatedResult,
  PaginationParams,
  Stockroom,
  StockroomListFilters,
  UpdateStockroomRequest,
  UUID,
} from '@ams/types';
import * as cache from '@ams/cache';
import { CACHE_ENTITY_TYPES, entityKey } from '@ams/cache';
import { publishEvent } from '@ams/events';
import { createLogger } from '@ams/utils';

import * as stockroomRepository from './stockroom-repository';

const logger = createLogger({ service: 'stockroom-service' });

// ============================================================================
// Error Classes
// ============================================================================

export class StockroomNotFoundError extends Error {
  constructor(stockroomId: string) {
    super(`Stockroom not found: ${stockroomId}`);
    this.name = 'StockroomNotFoundError';
  }
}

export class StockroomHasDependenciesError extends Error {
  public readonly assetCount: number;
  public readonly inventoryCount: number;

  constructor(stockroomId: string, assetCount: number, inventoryCount: number) {
    super(
      `Cannot delete stockroom ${stockroomId}: has ${assetCount} assets and ${inventoryCount} inventory records`
    );
    this.name = 'StockroomHasDependenciesError';
    this.assetCount = assetCount;
    this.inventoryCount = inventoryCount;
  }
}

// ============================================================================
// Cache Helpers
// ============================================================================

const STOCKROOM_CACHE_TTL = 300; // 5 minutes

function stockroomCacheKey(stockroomId: UUID): string {
  return entityKey(CACHE_ENTITY_TYPES.STOCKROOM, stockroomId);
}

function activeStockroomsCacheKey(): string {
  return 'stockrooms:active';
}

async function invalidateStockroomCache(stockroomId: UUID): Promise<void> {
  await cache.del(stockroomCacheKey(stockroomId));
  await cache.del(activeStockroomsCacheKey());
}

// ============================================================================
// Service Functions
// ============================================================================

/**
 * Create a new stockroom
 */
export async function createStockroom(
  request: CreateStockroomRequest,
  createdBy?: UUID
): Promise<Stockroom> {
  logger.info('Creating stockroom', { name: request.name, type: request.stockroomType });

  const stockroom = await stockroomRepository.createStockroom(request, createdBy);

  // Invalidate cache
  await cache.del(activeStockroomsCacheKey());

  // Publish event (payload matches StockroomCreatedEvent in @ams/types/events.ts)
  await publishEvent('STOCKROOM_CREATED', {
    stockroomId: stockroom.stockroomId,
    stockroomCode: '',
    name: stockroom.name,
    stockroomType: stockroom.stockroomType ?? 'STANDARD',
    createdBy: createdBy ?? '',
  });

  logger.info('Stockroom created', { stockroomId: stockroom.stockroomId });
  return stockroom;
}

/**
 * Get stockroom by ID
 */
export async function getStockroom(stockroomId: UUID): Promise<Stockroom | null> {
  return cache.getOrSet(
    stockroomCacheKey(stockroomId),
    () => stockroomRepository.getStockroomById(stockroomId),
    { ttl: STOCKROOM_CACHE_TTL }
  );
}

/**
 * Update stockroom
 */
export async function updateStockroom(
  stockroomId: UUID,
  request: UpdateStockroomRequest,
  updatedBy?: UUID
): Promise<Stockroom> {
  const existing = await stockroomRepository.getStockroomById(stockroomId);
  if (!existing) {
    throw new StockroomNotFoundError(stockroomId);
  }

  const updated = await stockroomRepository.updateStockroom(stockroomId, request, updatedBy);
  if (!updated) {
    throw new StockroomNotFoundError(stockroomId);
  }

  // Invalidate cache
  await invalidateStockroomCache(stockroomId);

  // Publish event (payload matches StockroomUpdatedEvent in @ams/types/events.ts)
  await publishEvent('STOCKROOM_UPDATED', {
    stockroomId: updated.stockroomId,
    stockroomCode: '',
    changes: Object.keys(request).map((field) => ({
      field,
      oldValue: (existing as unknown as Record<string, unknown>)[field],
      newValue: (request as unknown as Record<string, unknown>)[field],
    })),
    updatedBy: updatedBy ?? '',
  });

  logger.info('Stockroom updated', { stockroomId });
  return updated;
}

/**
 * Deactivate stockroom (soft delete)
 */
export async function deactivateStockroom(
  stockroomId: UUID,
  updatedBy?: UUID
): Promise<Stockroom> {
  const existing = await stockroomRepository.getStockroomById(stockroomId);
  if (!existing) {
    throw new StockroomNotFoundError(stockroomId);
  }

  // Check for dependencies
  const deps = await stockroomRepository.getStockroomDependencies(stockroomId);
  if (deps.assetCount > 0 || deps.inventoryCount > 0) {
    throw new StockroomHasDependenciesError(stockroomId, deps.assetCount, deps.inventoryCount);
  }

  const deactivated = await stockroomRepository.deactivateStockroom(stockroomId, updatedBy);
  if (!deactivated) {
    throw new StockroomNotFoundError(stockroomId);
  }

  // Invalidate cache
  await invalidateStockroomCache(stockroomId);

  // Publish event (payload matches StockroomDeactivatedEvent in @ams/types/events.ts)
  await publishEvent('STOCKROOM_DEACTIVATED', {
    stockroomId: deactivated.stockroomId,
    stockroomCode: '',
    deactivatedBy: updatedBy ?? '',
  });

  logger.info('Stockroom deactivated', { stockroomId });
  return deactivated;
}

/**
 * List stockrooms with filters and pagination
 */
export async function listStockrooms(
  filters: StockroomListFilters,
  pagination: PaginationParams
): Promise<PaginatedResult<Stockroom>> {
  const page = pagination.page ?? 1;
  const limit = pagination.limit ?? 20;
  
  const result = await stockroomRepository.listStockrooms(filters, { page, limit });
  
  // Transform to match @ams/types PaginatedResult interface
  return {
    items: result.items,
    total: result.total,
    page: result.page,
    limit: result.limit,
    hasMore: (result.page * result.limit) < result.total,
  };
}

/**
 * Get active stockrooms (for dropdowns)
 */
export async function getActiveStockrooms(): Promise<Stockroom[]> {
  return cache.getOrSet(
    activeStockroomsCacheKey(),
    () => stockroomRepository.getActiveStockrooms(),
    { ttl: STOCKROOM_CACHE_TTL }
  );
}
