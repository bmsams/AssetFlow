/**
 * Model Service - Business logic layer for model catalog management
 *
 * Implements:
 * - Model CRUD operations (Requirement 11.1-11.6)
 * - Lifecycle status transitions (ACTIVE → DEPRECATED → END_OF_LIFE)
 * - Cache management for model data
 * - Event publishing for model state changes
 * - Dependency checking for assets
 */

import type {
  CreateModelRequest,
  ModelDetails,
  ModelListFilters,
  ModelStatus,
  PaginatedResult,
  PaginationParams,
  UpdateModelRequest,
  UUID,
} from '@ams/types';
import * as cache from '@ams/cache';
import { CACHE_ENTITY_TYPES, listKey } from '@ams/cache';
import { publishEvent } from '@ams/events';
import { createLogger } from '@ams/utils';

import * as repository from './model-repository';

const logger = createLogger({ service: 'model-service' });

// ============================================================================
// Valid Status Transitions
// ============================================================================

/**
 * Valid model lifecycle status transitions
 * 
 * Valid transitions:
 * - ACTIVE → DEPRECATED (model is being phased out)
 * - DEPRECATED → END_OF_LIFE (model is no longer supported)
 * - DEPRECATED → ACTIVE (model is reinstated)
 * 
 * Invalid transitions:
 * - END_OF_LIFE → any other status (terminal state)
 * - ACTIVE → END_OF_LIFE (must go through DEPRECATED first)
 */
const VALID_STATUS_TRANSITIONS: Record<ModelStatus, readonly ModelStatus[]> = {
  ACTIVE: ['DEPRECATED'],
  DEPRECATED: ['ACTIVE', 'END_OF_LIFE'],
  END_OF_LIFE: [], // Terminal state - no transitions allowed
};

/**
 * Check if a status transition is valid
 */
export function isValidStatusTransition(
  currentStatus: ModelStatus,
  newStatus: ModelStatus
): boolean {
  if (currentStatus === newStatus) {
    return true; // No change is always valid
  }
  return VALID_STATUS_TRANSITIONS[currentStatus].includes(newStatus);
}

/**
 * Get valid next statuses for a given status
 */
export function getValidNextStatuses(currentStatus: ModelStatus): readonly ModelStatus[] {
  return VALID_STATUS_TRANSITIONS[currentStatus];
}

// ============================================================================
// Cache Key Helpers
// ============================================================================

/**
 * Build a cache key for a model
 * Format: model:{model_id}
 */
function modelKey(modelId: UUID): string {
  return `${CACHE_ENTITY_TYPES.MODEL}:${modelId}`;
}

/**
 * Build a cache key for model by SKU
 * Format: model:sku:{sku}
 */
function modelBySkuKey(sku: string): string {
  return `${CACHE_ENTITY_TYPES.MODEL}:sku:${sku}`;
}

/**
 * Build a cache key for model list
 * Format: model:list or model:list:{sorted_params}
 */
function modelListKey(params?: Record<string, unknown>): string {
  return listKey(CACHE_ENTITY_TYPES.MODEL, params);
}

// ============================================================================
// Error Types
// ============================================================================

/**
 * Error thrown when model is not found
 */
export class ModelNotFoundError extends Error {
  constructor(modelId: UUID) {
    super(`Model not found: ${modelId}`);
    this.name = 'ModelNotFoundError';
  }
}

/**
 * Error thrown when model SKU already exists
 */
export class ModelSkuExistsError extends Error {
  constructor(sku: string) {
    super(`Model SKU '${sku}' already exists`);
    this.name = 'ModelSkuExistsError';
  }
}

/**
 * Error thrown when model name already exists for manufacturer
 */
export class ModelNameExistsError extends Error {
  constructor(modelName: string, manufacturerName: string) {
    super(`Model name '${modelName}' already exists for manufacturer '${manufacturerName}'`);
    this.name = 'ModelNameExistsError';
  }
}

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
 * Error thrown when model has dependencies and cannot be deleted
 */
export class ModelHasDependenciesError extends Error {
  readonly assetCount: number;

  constructor(modelId: UUID, assetCount: number) {
    super(`Cannot delete model ${modelId}: has ${assetCount} asset(s)`);
    this.name = 'ModelHasDependenciesError';
    this.assetCount = assetCount;
  }
}

/**
 * Error thrown when an invalid status transition is attempted
 */
export class InvalidStatusTransitionError extends Error {
  readonly currentStatus: ModelStatus;
  readonly requestedStatus: ModelStatus;
  readonly validTransitions: readonly ModelStatus[];

  constructor(currentStatus: ModelStatus, requestedStatus: ModelStatus) {
    const validTransitions = VALID_STATUS_TRANSITIONS[currentStatus];
    const validStr = validTransitions.length > 0 
      ? validTransitions.join(', ') 
      : 'none (terminal state)';
    super(
      `Invalid status transition from ${currentStatus} to ${requestedStatus}. ` +
      `Valid transitions: ${validStr}`
    );
    this.name = 'InvalidStatusTransitionError';
    this.currentStatus = currentStatus;
    this.requestedStatus = requestedStatus;
    this.validTransitions = validTransitions;
  }
}

/**
 * Error thrown when trying to create assets with an end-of-life model
 */
export class ModelEndOfLifeError extends Error {
  constructor(modelId: UUID, modelName: string) {
    super(`Cannot create assets with end-of-life model: ${modelName} (${modelId})`);
    this.name = 'ModelEndOfLifeError';
  }
}

// ============================================================================
// Cache Helpers
// ============================================================================

/**
 * Build patterns for invalidating model-related cache entries
 */
function modelInvalidationPatterns(modelId: UUID): string[] {
  return [
    `${CACHE_ENTITY_TYPES.MODEL}:${modelId}*`,
    `${CACHE_ENTITY_TYPES.MODEL}:list*`,
    `${CACHE_ENTITY_TYPES.MODEL}:all*`,
    `${CACHE_ENTITY_TYPES.MODEL}:active*`,
    `${CACHE_ENTITY_TYPES.MODEL}:manufacturer:*`,
    `${CACHE_ENTITY_TYPES.MODEL}:status:*`,
    `${CACHE_ENTITY_TYPES.MODEL}:category:*`,
    `${CACHE_ENTITY_TYPES.MODEL}:for-asset-creation*`,
    `search:${CACHE_ENTITY_TYPES.MODEL}:*`,
  ];
}

/**
 * Invalidate all model-related cache entries
 */
async function invalidateModelCache(modelId: UUID): Promise<void> {
  const patterns = modelInvalidationPatterns(modelId);
  for (const pattern of patterns) {
    await cache.delPattern(pattern);
  }
  // Also invalidate the specific model key
  await cache.del(modelKey(modelId));
}

// ============================================================================
// Model Service Functions
// ============================================================================

/**
 * Create a new model
 * Requirement 11.1: Create model with manufacturer, model name, and specifications
 *
 * @param request - Model creation request
 * @param userId - ID of user creating the model
 * @returns Created model
 * @throws ModelSkuExistsError if model SKU already exists
 * @throws ModelNameExistsError if model name already exists for manufacturer
 */
export async function createModel(
  request: CreateModelRequest,
  userId?: UUID
): Promise<ModelDetails> {
  logger.info('Creating model', { modelName: request.modelName, manufacturerId: request.manufacturerId });

  // Validate SKU uniqueness if provided
  if (request.sku) {
    const skuExists = await repository.modelSkuExists(request.sku);
    if (skuExists) {
      throw new ModelSkuExistsError(request.sku);
    }
  }

  // Validate model name uniqueness for manufacturer
  const nameExists = await repository.modelNameExistsForManufacturer(
    request.modelName,
    request.manufacturerId
  );
  if (nameExists) {
    throw new ModelNameExistsError(request.modelName, request.manufacturerId);
  }

  // Create the model
  const model = await repository.createModel(request, userId);

  // Invalidate list cache
  await cache.del(modelListKey());

  // Publish event
  await publishEvent('MODEL_CREATED', {
    modelId: model.modelId,
    modelName: model.modelName,
    manufacturerId: model.manufacturerId,
    createdBy: userId ?? '',
  });

  logger.info('Model created successfully', {
    modelId: model.modelId,
    modelName: model.modelName,
  });

  return model;
}

/**
 * Get model by ID
 * Requirement 11.2: Return complete model details including specifications and asset count
 *
 * @param modelId - Model ID
 * @returns Model or null if not found
 */
export async function getModelById(modelId: UUID): Promise<ModelDetails | null> {
  const cacheKeyStr = modelKey(modelId);

  return cache.getOrSet(
    cacheKeyStr,
    () => repository.getModelById(modelId),
    { ttl: cache.DEFAULT_TTL.MEDIUM }
  );
}

/**
 * Get model by ID, throwing if not found
 *
 * @param modelId - Model ID
 * @returns Model
 * @throws ModelNotFoundError if model not found
 */
export async function getModelOrThrow(modelId: UUID): Promise<ModelDetails> {
  const model = await getModelById(modelId);
  if (!model) {
    throw new ModelNotFoundError(modelId);
  }
  return model;
}

/**
 * Get model by SKU
 *
 * @param sku - Model SKU
 * @returns Model or null if not found
 */
export async function getModelBySku(sku: string): Promise<ModelDetails | null> {
  const cacheKeyStr = modelBySkuKey(sku);

  return cache.getOrSet(
    cacheKeyStr,
    () => repository.getModelBySku(sku),
    { ttl: cache.DEFAULT_TTL.MEDIUM }
  );
}

/**
 * Update model details
 * Requirement 11.3: Update model specifications or lifecycle status
 *
 * @param modelId - Model ID
 * @param request - Update request
 * @param userId - ID of user updating the model
 * @returns Updated model
 * @throws ModelNotFoundError if model not found
 * @throws ModelSkuExistsError if new SKU already exists
 * @throws InvalidStatusTransitionError if status transition is invalid
 */
export async function updateModel(
  modelId: UUID,
  request: UpdateModelRequest,
  userId?: UUID
): Promise<ModelDetails> {
  logger.info('Updating model', { modelId, updates: Object.keys(request) });

  // Verify model exists
  const existing = await repository.getModelById(modelId);
  if (!existing) {
    throw new ModelNotFoundError(modelId);
  }

  // Validate SKU uniqueness if SKU is being changed
  if (request.sku !== undefined && request.sku !== existing.sku) {
    const skuExists = await repository.modelSkuExists(request.sku, modelId);
    if (skuExists) {
      throw new ModelSkuExistsError(request.sku);
    }
  }

  // Validate status transition if status is being changed
  if (request.status !== undefined && request.status !== existing.status) {
    if (!isValidStatusTransition(existing.status, request.status)) {
      throw new InvalidStatusTransitionError(existing.status, request.status);
    }
  }

  // Update the model
  const updated = await repository.updateModel(modelId, request, userId);
  if (!updated) {
    throw new ModelNotFoundError(modelId);
  }

  // Invalidate cache
  await invalidateModelCache(modelId);

  // Build changes array for event
  const changes: { field: string; oldValue: unknown; newValue: unknown }[] = [];
  if (request.modelName !== undefined && request.modelName !== existing.modelName) {
    changes.push({ field: 'modelName', oldValue: existing.modelName, newValue: request.modelName });
  }
  if (request.modelNumber !== undefined && request.modelNumber !== existing.modelNumber) {
    changes.push({ field: 'modelNumber', oldValue: existing.modelNumber, newValue: request.modelNumber });
  }
  if (request.sku !== undefined && request.sku !== existing.sku) {
    changes.push({ field: 'sku', oldValue: existing.sku, newValue: request.sku });
  }
  if (request.category !== undefined && request.category !== existing.category) {
    changes.push({ field: 'category', oldValue: existing.category, newValue: request.category });
  }
  if (request.status !== undefined && request.status !== existing.status) {
    changes.push({ field: 'status', oldValue: existing.status, newValue: request.status });
  }
  if (request.isActive !== undefined && request.isActive !== existing.isActive) {
    changes.push({ field: 'isActive', oldValue: existing.isActive, newValue: request.isActive });
  }

  // Publish event if there are changes
  if (changes.length > 0) {
    await publishEvent('MODEL_UPDATED', {
      modelId: updated.modelId,
      modelName: updated.modelName,
      changes,
      updatedBy: userId ?? '',
    });
  }

  logger.info('Model updated successfully', { modelId });

  return updated;
}

/**
 * Update model lifecycle status
 * Validates the transition and publishes appropriate events
 *
 * @param modelId - Model ID
 * @param newStatus - New status
 * @param userId - ID of user updating the status
 * @returns Updated model
 * @throws ModelNotFoundError if model not found
 * @throws InvalidStatusTransitionError if status transition is invalid
 */
export async function updateModelStatus(
  modelId: UUID,
  newStatus: ModelStatus,
  userId?: UUID
): Promise<ModelDetails> {
  logger.info('Updating model status', { modelId, newStatus });

  // Verify model exists
  const existing = await repository.getModelById(modelId);
  if (!existing) {
    throw new ModelNotFoundError(modelId);
  }

  // Validate status transition
  if (!isValidStatusTransition(existing.status, newStatus)) {
    throw new InvalidStatusTransitionError(existing.status, newStatus);
  }

  // If no change, return existing
  if (existing.status === newStatus) {
    return existing;
  }

  // Update the status
  const updated = await repository.updateModelStatus(modelId, newStatus, userId);
  if (!updated) {
    throw new ModelNotFoundError(modelId);
  }

  // Invalidate cache
  await invalidateModelCache(modelId);

  // Publish appropriate event based on new status
  if (newStatus === 'END_OF_LIFE') {
    await publishEvent('MODEL_END_OF_LIFE', {
      modelId: updated.modelId,
      modelName: updated.modelName,
      previousStatus: existing.status,
      updatedBy: userId ?? '',
    });
  } else {
    await publishEvent('MODEL_UPDATED', {
      modelId: updated.modelId,
      modelName: updated.modelName,
      changes: [{ field: 'status', oldValue: existing.status, newValue: newStatus }],
      updatedBy: userId ?? '',
    });
  }

  logger.info('Model status updated successfully', { modelId, oldStatus: existing.status, newStatus });

  return updated;
}

/**
 * Deprecate a model
 * Convenience method for transitioning to DEPRECATED status
 *
 * @param modelId - Model ID
 * @param userId - ID of user deprecating the model
 * @returns Updated model
 * @throws ModelNotFoundError if model not found
 * @throws InvalidStatusTransitionError if model is not ACTIVE
 */
export async function deprecateModel(
  modelId: UUID,
  userId?: UUID
): Promise<ModelDetails> {
  return updateModelStatus(modelId, 'DEPRECATED', userId);
}

/**
 * Mark a model as end-of-life
 * Requirement 11.4: Mark model as end-of-life and prevent new asset creation
 *
 * @param modelId - Model ID
 * @param userId - ID of user marking the model as end-of-life
 * @returns Updated model
 * @throws ModelNotFoundError if model not found
 * @throws InvalidStatusTransitionError if model is not DEPRECATED
 */
export async function markModelEndOfLife(
  modelId: UUID,
  userId?: UUID
): Promise<ModelDetails> {
  return updateModelStatus(modelId, 'END_OF_LIFE', userId);
}

/**
 * Reinstate a deprecated model to active
 *
 * @param modelId - Model ID
 * @param userId - ID of user reinstating the model
 * @returns Updated model
 * @throws ModelNotFoundError if model not found
 * @throws InvalidStatusTransitionError if model is not DEPRECATED
 */
export async function reinstateModel(
  modelId: UUID,
  userId?: UUID
): Promise<ModelDetails> {
  return updateModelStatus(modelId, 'ACTIVE', userId);
}

/**
 * Deactivate a model
 *
 * @param modelId - Model ID
 * @param userId - ID of user deactivating the model
 * @returns Deactivated model
 * @throws ModelNotFoundError if model not found
 */
export async function deactivateModel(
  modelId: UUID,
  userId?: UUID
): Promise<ModelDetails> {
  logger.info('Deactivating model', { modelId });

  // Verify model exists
  const existing = await repository.getModelById(modelId);
  if (!existing) {
    throw new ModelNotFoundError(modelId);
  }

  // Check for dependencies before deactivation (warning only)
  const dependencies = await repository.getModelDependencies(modelId);
  if (dependencies.assetCount > 0) {
    logger.warn('Deactivating model with dependencies', {
      modelId,
      assetCount: dependencies.assetCount,
    });
  }

  // Deactivate the model
  const deactivated = await repository.deactivateModel(modelId, userId);
  if (!deactivated) {
    throw new ModelNotFoundError(modelId);
  }

  // Invalidate cache
  await invalidateModelCache(modelId);

  // Publish event
  await publishEvent('MODEL_UPDATED', {
    modelId: deactivated.modelId,
    modelName: deactivated.modelName,
    changes: [{ field: 'isActive', oldValue: true, newValue: false }],
    updatedBy: userId ?? '',
  });

  logger.info('Model deactivated successfully', { modelId });

  return deactivated;
}

/**
 * Delete a model
 *
 * @param modelId - Model ID
 * @returns true if deleted
 * @throws ModelNotFoundError if model not found
 * @throws ModelHasDependenciesError if model has assets
 */
export async function deleteModel(modelId: UUID): Promise<boolean> {
  logger.info('Deleting model', { modelId });

  // Verify model exists
  const existing = await repository.getModelById(modelId);
  if (!existing) {
    throw new ModelNotFoundError(modelId);
  }

  // Check for dependencies
  const dependencies = await repository.getModelDependencies(modelId);
  if (dependencies.assetCount > 0) {
    throw new ModelHasDependenciesError(modelId, dependencies.assetCount);
  }

  // Delete the model
  const deleted = await repository.deleteModel(modelId);

  if (deleted) {
    // Invalidate cache
    await invalidateModelCache(modelId);

    logger.info('Model deleted successfully', { modelId });
  }

  return deleted;
}

/**
 * List models with pagination and filters
 * Requirement 11.5: Return paginated list with optional manufacturer and status filters
 *
 * @param filters - Filter criteria
 * @param pagination - Pagination parameters
 * @returns Paginated list of models
 */
export async function listModels(
  filters: ModelListFilters = {},
  pagination: PaginationParams = {}
): Promise<PaginatedResult<ModelDetails>> {
  logger.debug('Listing models', { filters, pagination });

  // For simple list queries without filters, use cache
  const hasFilters = Object.keys(filters).length > 0;
  const isFirstPage = (pagination.page ?? 1) === 1;
  const isDefaultLimit = (pagination.limit ?? 20) === 20;

  if (!hasFilters && isFirstPage && isDefaultLimit) {
    const cacheKeyStr = modelListKey();
    return cache.getOrSet(
      cacheKeyStr,
      () => repository.listModels(filters, pagination),
      { ttl: cache.DEFAULT_TTL.SHORT }
    );
  }

  return repository.listModels(filters, pagination);
}

/**
 * Search models by name, model number, or SKU
 * Requirement 11.6: Return matching models using partial text matching
 *
 * @param searchTerm - Search term
 * @returns List of matching models
 */
export async function searchModels(searchTerm: string): Promise<ModelDetails[]> {
  logger.debug('Searching models', { searchTerm });

  const cacheKeyStr = `search:${CACHE_ENTITY_TYPES.MODEL}:${searchTerm.toLowerCase()}`;

  return cache.getOrSet(
    cacheKeyStr,
    () => repository.searchModels(searchTerm),
    { ttl: cache.DEFAULT_TTL.SHORT }
  );
}

/**
 * Get all models
 *
 * @returns List of all models
 */
export async function getAllModels(): Promise<ModelDetails[]> {
  const cacheKeyStr = `${CACHE_ENTITY_TYPES.MODEL}:all`;

  return cache.getOrSet(
    cacheKeyStr,
    () => repository.getAllModels(),
    { ttl: cache.DEFAULT_TTL.MEDIUM }
  );
}

/**
 * Get active models only
 *
 * @returns List of active models
 */
export async function getActiveModels(): Promise<ModelDetails[]> {
  const cacheKeyStr = `${CACHE_ENTITY_TYPES.MODEL}:active`;

  return cache.getOrSet(
    cacheKeyStr,
    () => repository.getActiveModels(),
    { ttl: cache.DEFAULT_TTL.MEDIUM }
  );
}

/**
 * Get models by manufacturer
 *
 * @param manufacturerId - Manufacturer ID
 * @returns List of models for the manufacturer
 */
export async function getModelsByManufacturer(manufacturerId: UUID): Promise<ModelDetails[]> {
  const cacheKeyStr = `${CACHE_ENTITY_TYPES.MODEL}:manufacturer:${manufacturerId}`;

  return cache.getOrSet(
    cacheKeyStr,
    () => repository.getModelsByManufacturer(manufacturerId),
    { ttl: cache.DEFAULT_TTL.MEDIUM }
  );
}

/**
 * Get models by status
 *
 * @param status - Model status
 * @returns List of models with the specified status
 */
export async function getModelsByStatus(status: ModelStatus): Promise<ModelDetails[]> {
  const cacheKeyStr = `${CACHE_ENTITY_TYPES.MODEL}:status:${status}`;

  return cache.getOrSet(
    cacheKeyStr,
    () => repository.getModelsByStatus(status),
    { ttl: cache.DEFAULT_TTL.MEDIUM }
  );
}

/**
 * Get models by category
 *
 * @param category - Model category
 * @returns List of models in the specified category
 */
export async function getModelsByCategory(category: string): Promise<ModelDetails[]> {
  const cacheKeyStr = `${CACHE_ENTITY_TYPES.MODEL}:category:${category}`;

  return cache.getOrSet(
    cacheKeyStr,
    () => repository.getModelsByCategory(category),
    { ttl: cache.DEFAULT_TTL.MEDIUM }
  );
}

/**
 * Get models available for asset creation
 * Returns only active models that are not end-of-life
 * Requirement 11.4: Prevent new asset creation with end-of-life models
 *
 * @returns List of models available for asset creation
 */
export async function getModelsForAssetCreation(): Promise<ModelDetails[]> {
  const cacheKeyStr = `${CACHE_ENTITY_TYPES.MODEL}:for-asset-creation`;

  return cache.getOrSet(
    cacheKeyStr,
    () => repository.getModelsForAssetCreation(),
    { ttl: cache.DEFAULT_TTL.MEDIUM }
  );
}

/**
 * Validate model SKU uniqueness
 * Used for form validation before submission
 *
 * @param sku - Model SKU to validate
 * @param excludeId - Model ID to exclude (for updates)
 * @returns true if SKU is unique
 */
export async function isModelSkuUnique(
  sku: string,
  excludeId?: UUID
): Promise<boolean> {
  const exists = await repository.modelSkuExists(sku, excludeId);
  return !exists;
}

/**
 * Validate model can be used for asset creation
 * Requirement 11.4: Prevent new asset creation with end-of-life models
 *
 * @param modelId - Model ID
 * @throws ModelNotFoundError if model not found
 * @throws ModelEndOfLifeError if model is end-of-life
 */
export async function validateModelForAssetCreation(modelId: UUID): Promise<void> {
  const model = await getModelById(modelId);
  if (!model) {
    throw new ModelNotFoundError(modelId);
  }

  if (model.status === 'END_OF_LIFE') {
    throw new ModelEndOfLifeError(modelId, model.modelName);
  }

  if (!model.isActive) {
    throw new ModelEndOfLifeError(modelId, model.modelName);
  }
}

/**
 * Reactivate a model
 *
 * @param modelId - Model ID
 * @param userId - ID of user reactivating the model
 * @returns Reactivated model
 * @throws ModelNotFoundError if model not found
 */
export async function reactivateModel(
  modelId: UUID,
  userId?: UUID
): Promise<ModelDetails> {
  logger.info('Reactivating model', { modelId });

  // Verify model exists
  const existing = await repository.getModelById(modelId);
  if (!existing) {
    throw new ModelNotFoundError(modelId);
  }

  // Reactivate the model
  const reactivated = await repository.updateModel(
    modelId,
    { isActive: true },
    userId
  );
  if (!reactivated) {
    throw new ModelNotFoundError(modelId);
  }

  // Invalidate cache
  await invalidateModelCache(modelId);

  // Publish event
  await publishEvent('MODEL_UPDATED', {
    modelId: reactivated.modelId,
    modelName: reactivated.modelName,
    changes: [{ field: 'isActive', oldValue: false, newValue: true }],
    updatedBy: userId ?? '',
  });

  logger.info('Model reactivated successfully', { modelId });

  return reactivated;
}

/**
 * Get model summary with dependency counts
 *
 * @param modelId - Model ID
 * @returns Model summary or null if not found
 */
export async function getModelSummary(modelId: UUID): Promise<{
  model: ModelDetails;
  assetCount: number;
  canDelete: boolean;
  validNextStatuses: readonly ModelStatus[];
} | null> {
  const model = await getModelById(modelId);
  if (!model) {
    return null;
  }

  const dependencies = await repository.getModelDependencies(modelId);

  return {
    model,
    assetCount: dependencies.assetCount,
    canDelete: dependencies.assetCount === 0,
    validNextStatuses: getValidNextStatuses(model.status),
  };
}

