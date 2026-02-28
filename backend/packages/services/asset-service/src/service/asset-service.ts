/**
 * Asset Service - Business logic layer for assets
 *
 * Implements core asset management operations with:
 * - Caching for performance (Requirement 10.1, 10.2)
 * - Event publishing for audit trail (Requirement 9.2)
 * - State machine validation (Requirement 2.4)
 */

import type {
  Asset,
  AssetSearchQuery,
  AssetStatus,
  CreateAssetRequest,
  PaginatedResult,
  PaginationParams,
  UpdateAssetRequest,
  UUID,
} from '@ams/types';
import * as cache from '@ams/cache';
import { CACHE_ENTITY_TYPES, entityKey } from '@ams/cache';
import { publishAssetCreated, publishAssetDeleted, publishAssetStateChanged, publishAssetUpdated } from '@ams/events';
import { createLogger } from '@ams/utils';

import type { AuditLogEntry } from './asset-repository';
import * as repository from './asset-repository';

const logger = createLogger({ service: 'asset-service' });

/**
 * Valid state transitions map
 * Defines the asset lifecycle state machine (Requirement 2.4)
 *
 * State Flow:
 * ORDERED → RECEIVED → IN_STOCK → RESERVED/DEPLOYED/RETIRED
 *                                    ↓         ↓
 *                              IN_STOCK   IN_MAINTENANCE
 *                                    ↓         ↓
 *                                DEPLOYED ← DEPLOYED
 *                                    ↓
 *                                 RETIRED → DISPOSED (terminal)
 */
const VALID_TRANSITIONS: Record<AssetStatus, readonly AssetStatus[]> = {
  ORDERED: ['RECEIVED'],
  RECEIVED: ['IN_STOCK'],
  IN_STOCK: ['RESERVED', 'DEPLOYED', 'RETIRED'],
  RESERVED: ['IN_STOCK', 'DEPLOYED'],
  DEPLOYED: ['IN_STOCK', 'IN_MAINTENANCE', 'RETIRED'],
  IN_MAINTENANCE: ['DEPLOYED', 'RETIRED'],
  RETIRED: ['DISPOSED'],
  DISPOSED: [],
};

/**
 * Human-readable state descriptions for error messages
 */
const STATE_DESCRIPTIONS: Record<AssetStatus, string> = {
  ORDERED: 'Asset has been ordered but not yet received',
  RECEIVED: 'Asset has been received at the facility',
  IN_STOCK: 'Asset is available in stockroom inventory',
  RESERVED: 'Asset is reserved for deployment',
  DEPLOYED: 'Asset is deployed and in active use',
  IN_MAINTENANCE: 'Asset is undergoing maintenance or repair',
  RETIRED: 'Asset has been retired from service',
  DISPOSED: 'Asset has been disposed (terminal state)',
};

/**
 * Check if a state transition is valid
 */
export function isValidStateTransition(
  currentState: AssetStatus,
  newState: AssetStatus
): boolean {
  const validTransitions = VALID_TRANSITIONS[currentState];
  return validTransitions?.includes(newState) ?? false;
}

/**
 * Get valid transitions for a given state
 */
export function getValidTransitions(currentState: AssetStatus): readonly AssetStatus[] {
  return VALID_TRANSITIONS[currentState] ?? [];
}

/**
 * Get human-readable description for a state
 */
export function getStateDescription(state: AssetStatus): string {
  return STATE_DESCRIPTIONS[state] ?? 'Unknown state';
}

/**
 * Check if a state is a terminal state (no further transitions allowed)
 */
export function isTerminalState(state: AssetStatus): boolean {
  const validTransitions = VALID_TRANSITIONS[state];
  return validTransitions?.length === 0;
}

/**
 * State transition error with detailed information
 */
export class StateTransitionError extends Error {
  readonly currentState: AssetStatus;
  readonly attemptedState: AssetStatus;
  readonly validTransitions: readonly AssetStatus[];
  readonly isTerminalState: boolean;

  constructor(
    currentState: AssetStatus,
    attemptedState: AssetStatus,
    validTransitions: readonly AssetStatus[]
  ) {
    const isTerminal = validTransitions.length === 0;
    let message: string;

    if (isTerminal) {
      message = `Cannot transition from ${currentState} to ${attemptedState}. ` +
        `${currentState} is a terminal state with no valid transitions. ` +
        `${getStateDescription(currentState)}.`;
    } else if (currentState === attemptedState) {
      message = `Asset is already in ${currentState} state. No transition needed.`;
    } else {
      message = `Invalid state transition from ${currentState} to ${attemptedState}. ` +
        `Valid transitions from ${currentState}: [${validTransitions.join(', ')}]. ` +
        `Current state: ${getStateDescription(currentState)}. ` +
        `Attempted state: ${getStateDescription(attemptedState)}.`;
    }

    super(message);
    this.name = 'StateTransitionError';
    this.currentState = currentState;
    this.attemptedState = attemptedState;
    this.validTransitions = validTransitions;
    this.isTerminalState = isTerminal;
  }
}

/**
 * Create a new asset
 */
export async function createAsset(
  request: CreateAssetRequest,
  userId?: UUID
): Promise<Asset> {
  logger.info('Creating asset', { assetType: request.assetType, displayName: request.displayName });

  const asset = await repository.createAsset(request, userId);

  // Publish event
  await publishAssetCreated(
    asset.assetId,
    asset.assetType,
    asset.assetTag,
    userId ?? 'system',
    asset
  );

  return asset;
}

/**
 * Get asset by ID with caching
 */
export async function getAsset(assetId: UUID): Promise<Asset | null> {
  const cacheKey = entityKey(CACHE_ENTITY_TYPES.ASSET, assetId);

  return cache.getOrSet(
    cacheKey,
    () => repository.getAssetById(assetId),
    { ttl: cache.DEFAULT_TTL.MEDIUM }
  );
}

/**
 * Get asset by tag
 */
export async function getAssetByTag(assetTag: string): Promise<Asset | null> {
  const cacheKey = cache.assetByTagKey(assetTag);

  return cache.getOrSet(
    cacheKey,
    () => repository.getAssetByTag(assetTag),
    { ttl: cache.DEFAULT_TTL.MEDIUM }
  );
}

/**
 * Update an asset
 */
export async function updateAsset(
  assetId: UUID,
  request: UpdateAssetRequest,
  userId?: UUID
): Promise<Asset | null> {
  logger.info('Updating asset', { assetId });

  // Get current asset for change tracking
  const currentAsset = await repository.getAssetById(assetId);
  if (!currentAsset) {
    return null;
  }

  const updatedAsset = await repository.updateAsset(assetId, request, userId);
  if (!updatedAsset) {
    return null;
  }

  // Invalidate cache
  await cache.invalidate(CACHE_ENTITY_TYPES.ASSET, assetId);
  if (currentAsset.assetTag) {
    await cache.del(cache.assetByTagKey(currentAsset.assetTag));
  }

  // Build changes for event
  const changes: { field: string; oldValue: unknown; newValue: unknown }[] = [];
  if (request.displayName !== undefined && request.displayName !== currentAsset.displayName) {
    changes.push({ field: 'displayName', oldValue: currentAsset.displayName, newValue: request.displayName });
  }
  if (request.description !== undefined && request.description !== currentAsset.description) {
    changes.push({ field: 'description', oldValue: currentAsset.description, newValue: request.description });
  }
  if (request.substatus !== undefined && request.substatus !== currentAsset.substatus) {
    changes.push({ field: 'substatus', oldValue: currentAsset.substatus, newValue: request.substatus });
  }
  if (request.attributes && Object.keys(request.attributes).length > 0) {
    changes.push({ field: 'attributes', oldValue: undefined, newValue: 'updated' });
  }

  // Publish event if there were changes
  if (changes.length > 0) {
    await publishAssetUpdated(assetId, currentAsset.assetType, userId ?? 'system', changes);
  }

  return updatedAsset;
}

/**
 * Delete an asset
 */
export async function deleteAsset(assetId: UUID, userId?: UUID): Promise<boolean> {
  logger.info('Deleting asset', { assetId });

  // Get asset for event
  const asset = await repository.getAssetById(assetId);
  if (!asset) {
    return false;
  }

  const deleted = await repository.deleteAsset(assetId);
  if (!deleted) {
    return false;
  }

  // Invalidate cache
  await cache.invalidate(CACHE_ENTITY_TYPES.ASSET, assetId);
  await cache.del(cache.assetByTagKey(asset.assetTag));

  // Publish event
  await publishAssetDeleted(assetId, asset.assetType, asset.assetTag, userId ?? 'system');

  return true;
}

/**
 * Transition asset state
 *
 * Implements the asset lifecycle state machine (Requirement 2.4)
 * Publishes state change events to SNS (Requirement 9.2)
 *
 * @param assetId - The ID of the asset to transition
 * @param newState - The target state
 * @param userId - The user performing the transition
 * @param reason - Optional reason for the transition
 * @returns The updated asset
 * @throws StateTransitionError if the transition is invalid
 * @throws Error if the asset is not found or update fails
 */
export async function transitionState(
  assetId: UUID,
  newState: AssetStatus,
  userId?: UUID,
  reason?: string
): Promise<Asset> {
  logger.info('Transitioning asset state', { assetId, newState, userId, reason });

  // Get current asset
  const currentAsset = await repository.getAssetById(assetId);
  if (!currentAsset) {
    logger.warn('Asset not found for state transition', { assetId });
    throw new Error(`Asset not found: ${assetId}`);
  }

  const currentState = currentAsset.status;
  const validTransitions = getValidTransitions(currentState);

  // Check if already in target state
  if (currentState === newState) {
    logger.info('Asset already in target state', { assetId, currentState, newState });
    return currentAsset;
  }

  // Validate state transition
  if (!isValidStateTransition(currentState, newState)) {
    logger.warn('Invalid state transition attempted', {
      assetId,
      currentState,
      attemptedState: newState,
      validTransitions,
    });
    throw new StateTransitionError(currentState, newState, validTransitions);
  }

  // Update status in database
  const updatedAsset = await repository.updateAssetStatus(assetId, newState, userId);
  if (!updatedAsset) {
    logger.error('Failed to update asset status in database', new Error('Update returned null'), { assetId, newState });
    throw new Error('Failed to update asset status');
  }

  // Invalidate cache
  await cache.invalidate(CACHE_ENTITY_TYPES.ASSET, assetId);
  await cache.del(cache.assetByTagKey(currentAsset.assetTag));

  // Publish state change event to SNS (Requirement 9.2)
  await publishAssetStateChanged(
    assetId,
    currentAsset.assetType,
    currentState,
    newState,
    userId ?? 'system',
    reason
  );

  logger.info('Asset state transitioned successfully', {
    assetId,
    previousState: currentState,
    newState,
    userId,
    reason,
  });

  return updatedAsset;
}

/**
 * List assets with pagination and filtering
 */
export async function listAssets(
  searchQuery: AssetSearchQuery = {},
  pagination: PaginationParams = {}
): Promise<PaginatedResult<Asset>> {
  logger.info('Listing assets', { searchQuery, pagination });
  return repository.listAssets(searchQuery, pagination);
}

/**
 * Search assets by query string
 */
export async function searchAssets(
  query: string,
  pagination: PaginationParams = {}
): Promise<PaginatedResult<Asset>> {
  return listAssets({ query }, pagination);
}

/**
 * Get assets by stockroom
 */
export async function getAssetsByStockroom(stockroomId: UUID): Promise<Asset[]> {
  const cacheKey = cache.assetsByStockroomKey(stockroomId);

  return cache.getOrSet(
    cacheKey,
    () => repository.getAssetsByStockroom(stockroomId),
    { ttl: cache.DEFAULT_TTL.SHORT }
  );
}

/**
 * Bulk create assets
 */
export async function bulkCreateAssets(
  requests: readonly CreateAssetRequest[],
  userId?: UUID
): Promise<Asset[]> {
  logger.info('Bulk creating assets', { count: requests.length });

  const assets = await repository.bulkCreateAssets(requests, userId);

  // Publish events for each asset
  for (const asset of assets) {
    await publishAssetCreated(
      asset.assetId,
      asset.assetType,
      asset.assetTag,
      userId ?? 'system',
      asset
    );
  }

  return assets;
}

/**
 * Get audit log for an asset
 *
 * Retrieves the complete audit history for a specific asset (Requirement 2.5, 2.7)
 */
export async function getAssetAuditLog(
  assetId: UUID,
  pagination: PaginationParams = {}
): Promise<PaginatedResult<AuditLogEntry>> {
  logger.info('Getting audit log for asset', { assetId });
  return repository.getAssetAuditLog(assetId, pagination);
}

// Re-export AuditLogEntry type for consumers
export type { AuditLogEntry } from './asset-repository';
