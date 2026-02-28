/**
 * Model Service Unit Tests
 *
 * Tests for the Model Service business logic layer.
 * Requirements:
 * - Requirement 11.1: Create model with manufacturer, model name, and specifications
 * - Requirement 11.2: Return complete model details including specifications and asset count
 * - Requirement 11.3: Update model specifications or lifecycle status
 * - Requirement 11.4: Mark model as end-of-life and prevent new asset creation
 * - Requirement 11.5: Return paginated list with optional manufacturer and status filters
 * - Requirement 11.6: Return matching models using partial text matching
 */

// Mock the dependencies before importing service
jest.mock('../reference-data/model-repository');
jest.mock('@ams/cache', () => ({
  ...jest.requireActual('@ams/cache'),
  getOrSet: jest.fn(),
  del: jest.fn(),
  delPattern: jest.fn(),
  CACHE_ENTITY_TYPES: {
    MODEL: 'model',
  },
  listKey: jest.fn(),
  DEFAULT_TTL: {
    SHORT: 60,
    MEDIUM: 300,
    LONG: 3600,
  },
}));
jest.mock('@ams/events');
jest.mock('@ams/utils', () => ({
  createLogger: () => ({
    info: jest.fn(),
    error: jest.fn(),
    warn: jest.fn(),
    debug: jest.fn(),
  }),
  now: () => '2024-01-15T10:00:00.000Z',
}));

import type { CreateModelRequest, UpdateModelRequest, ModelDetails, ModelStatus } from '@ams/types';
import * as cache from '@ams/cache';
import { publishEvent } from '@ams/events';
import * as repository from '../reference-data/model-repository';
import {
  createModel,
  getModelById,
  getModelOrThrow,
  updateModel,
  updateModelStatus,
  deprecateModel,
  markModelEndOfLife,
  reinstateModel,
  deactivateModel,
  deleteModel,
  listModels,
  searchModels,
  getModelsForAssetCreation,
  isModelSkuUnique,
  validateModelForAssetCreation,
  reactivateModel,
  getModelSummary,
  isValidStatusTransition,
  getValidNextStatuses,
  ModelNotFoundError,
  ModelSkuExistsError,
  ModelHasDependenciesError,
  InvalidStatusTransitionError,
  ModelEndOfLifeError,
} from '../reference-data/model-service';

// Use jest.mocked for proper typing
const mockRepository = jest.mocked(repository);
const mockCache = jest.mocked(cache);
const mockPublishEvent = jest.mocked(publishEvent);

// ============================================================================
// Test Data
// ============================================================================

const mockModel: ModelDetails = {
  modelId: '111e4567-e89b-12d3-a456-426614174000',
  manufacturerId: '222e4567-e89b-12d3-a456-426614174000',
  manufacturerName: 'Dell Technologies',
  modelName: 'PowerEdge R750',
  modelNumber: 'R750',
  sku: 'DELL-R750-001',
  category: 'Server',
  specifications: { cpu: 'Intel Xeon', ram: '128GB' },
  status: 'ACTIVE',
  assetCount: 5,
  isActive: true,
  createdAt: '2024-01-15T10:00:00.000Z',
  updatedAt: '2024-01-15T10:00:00.000Z',
};

const mockDeprecatedModel: ModelDetails = {
  ...mockModel,
  modelId: '333e4567-e89b-12d3-a456-426614174000',
  modelName: 'PowerEdge R740',
  status: 'DEPRECATED',
};

const mockEndOfLifeModel: ModelDetails = {
  ...mockModel,
  modelId: '444e4567-e89b-12d3-a456-426614174000',
  modelName: 'PowerEdge R730',
  status: 'END_OF_LIFE',
};

const mockInactiveModel: ModelDetails = {
  ...mockModel,
  modelId: '555e4567-e89b-12d3-a456-426614174000',
  modelName: 'Inactive Model',
  isActive: false,
};

const validCreateRequest: CreateModelRequest = {
  manufacturerId: '222e4567-e89b-12d3-a456-426614174000',
  modelName: 'PowerEdge R750',
  modelNumber: 'R750',
  sku: 'DELL-R750-001',
  category: 'Server',
  specifications: { cpu: 'Intel Xeon', ram: '128GB' },
};

const mockPublishResult = {
  eventId: 'evt-123',
  eventType: 'MODEL_CREATED' as const,
  timestamp: '2024-01-15T10:00:00.000Z',
  messageId: 'msg-123',
};

describe('Model Service', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockCache.listKey.mockImplementation((type: string, params?: Record<string, unknown>) =>
      params ? `${type}:list:${JSON.stringify(params)}` : `${type}:list`
    );
  });

  // ============================================================================
  // Status Transition Validation Tests
  // ============================================================================

  describe('isValidStatusTransition', () => {
    it('should allow ACTIVE → DEPRECATED', () => {
      expect(isValidStatusTransition('ACTIVE', 'DEPRECATED')).toBe(true);
    });

    it('should allow DEPRECATED → END_OF_LIFE', () => {
      expect(isValidStatusTransition('DEPRECATED', 'END_OF_LIFE')).toBe(true);
    });

    it('should allow DEPRECATED → ACTIVE (reinstatement)', () => {
      expect(isValidStatusTransition('DEPRECATED', 'ACTIVE')).toBe(true);
    });

    it('should NOT allow ACTIVE → END_OF_LIFE (must go through DEPRECATED)', () => {
      expect(isValidStatusTransition('ACTIVE', 'END_OF_LIFE')).toBe(false);
    });

    it('should NOT allow END_OF_LIFE → ACTIVE (terminal state)', () => {
      expect(isValidStatusTransition('END_OF_LIFE', 'ACTIVE')).toBe(false);
    });

    it('should NOT allow END_OF_LIFE → DEPRECATED (terminal state)', () => {
      expect(isValidStatusTransition('END_OF_LIFE', 'DEPRECATED')).toBe(false);
    });

    it('should allow same status (no change)', () => {
      expect(isValidStatusTransition('ACTIVE', 'ACTIVE')).toBe(true);
      expect(isValidStatusTransition('DEPRECATED', 'DEPRECATED')).toBe(true);
      expect(isValidStatusTransition('END_OF_LIFE', 'END_OF_LIFE')).toBe(true);
    });
  });

  describe('getValidNextStatuses', () => {
    it('should return [DEPRECATED] for ACTIVE', () => {
      expect(getValidNextStatuses('ACTIVE')).toEqual(['DEPRECATED']);
    });

    it('should return [ACTIVE, END_OF_LIFE] for DEPRECATED', () => {
      expect(getValidNextStatuses('DEPRECATED')).toEqual(['ACTIVE', 'END_OF_LIFE']);
    });

    it('should return empty array for END_OF_LIFE (terminal state)', () => {
      expect(getValidNextStatuses('END_OF_LIFE')).toEqual([]);
    });
  });

  // ============================================================================
  // createModel Tests (Requirement 11.1)
  // ============================================================================

  describe('createModel', () => {
    it('should create model and publish event (Requirement 11.1)', async () => {
      mockRepository.modelSkuExists.mockResolvedValue(false);
      mockRepository.modelNameExistsForManufacturer.mockResolvedValue(false);
      mockRepository.createModel.mockResolvedValue(mockModel);
      mockCache.del.mockResolvedValue(true);
      mockPublishEvent.mockResolvedValue(mockPublishResult);

      const result = await createModel(validCreateRequest);

      expect(result).toEqual(mockModel);
      expect(mockRepository.modelNameExistsForManufacturer).toHaveBeenCalledWith(
        'PowerEdge R750',
        '222e4567-e89b-12d3-a456-426614174000'
      );
      expect(mockRepository.createModel).toHaveBeenCalledWith(validCreateRequest, undefined);
    });

    it('should create model with userId', async () => {
      const userId = '999e4567-e89b-12d3-a456-426614174999';
      mockRepository.modelSkuExists.mockResolvedValue(false);
      mockRepository.modelNameExistsForManufacturer.mockResolvedValue(false);
      mockRepository.createModel.mockResolvedValue(mockModel);
      mockCache.del.mockResolvedValue(true);
      mockPublishEvent.mockResolvedValue(mockPublishResult);

      await createModel(validCreateRequest, userId);

      expect(mockRepository.createModel).toHaveBeenCalledWith(validCreateRequest, userId);
    });

    it('should throw ModelSkuExistsError for duplicate SKU', async () => {
      mockRepository.modelSkuExists.mockResolvedValue(true);

      await expect(createModel(validCreateRequest)).rejects.toThrow(ModelSkuExistsError);
      expect(mockRepository.createModel).not.toHaveBeenCalled();
    });

    it('should throw ModelNameExistsError for duplicate name within manufacturer', async () => {
      mockRepository.modelSkuExists.mockResolvedValue(false);
      mockRepository.modelNameExistsForManufacturer.mockResolvedValue(true);

      await expect(createModel(validCreateRequest)).rejects.toThrow(
        "Model name 'PowerEdge R750' already exists for manufacturer"
      );
      expect(mockRepository.createModel).not.toHaveBeenCalled();
    });

    it('should invalidate cache after creation', async () => {
      mockRepository.modelSkuExists.mockResolvedValue(false);
      mockRepository.modelNameExistsForManufacturer.mockResolvedValue(false);
      mockRepository.createModel.mockResolvedValue(mockModel);
      mockCache.del.mockResolvedValue(true);
      mockPublishEvent.mockResolvedValue(mockPublishResult);

      await createModel(validCreateRequest);

      expect(mockCache.del).toHaveBeenCalledWith('model:list');
    });

    it('should publish MODEL_CREATED event after creation', async () => {
      const userId = 'user-123';
      mockRepository.modelSkuExists.mockResolvedValue(false);
      mockRepository.modelNameExistsForManufacturer.mockResolvedValue(false);
      mockRepository.createModel.mockResolvedValue(mockModel);
      mockCache.del.mockResolvedValue(true);
      mockPublishEvent.mockResolvedValue(mockPublishResult);

      await createModel(validCreateRequest, userId);

      expect(mockPublishEvent).toHaveBeenCalledWith('MODEL_CREATED', {
        modelId: mockModel.modelId,
        modelName: mockModel.modelName,
        manufacturerId: mockModel.manufacturerId,
        createdBy: userId,
      });
    });
  });

  // ============================================================================
  // getModelById Tests (Requirement 11.2)
  // ============================================================================

  describe('getModelById', () => {
    it('should return model from cache when available', async () => {
      mockCache.getOrSet.mockResolvedValue(mockModel);

      const result = await getModelById(mockModel.modelId);

      expect(result).toEqual(mockModel);
      expect(mockCache.getOrSet).toHaveBeenCalledWith(
        `model:${mockModel.modelId}`,
        expect.any(Function),
        { ttl: cache.DEFAULT_TTL.MEDIUM }
      );
    });

    it('should fetch from repository on cache miss', async () => {
      mockCache.getOrSet.mockImplementation(async (_key, fetchFn) => fetchFn());
      mockRepository.getModelById.mockResolvedValue(mockModel);

      const result = await getModelById(mockModel.modelId);

      expect(result).toEqual(mockModel);
      expect(mockRepository.getModelById).toHaveBeenCalledWith(mockModel.modelId);
    });

    it('should return null for non-existent model', async () => {
      mockCache.getOrSet.mockImplementation(async (_key, fetchFn) => fetchFn());
      mockRepository.getModelById.mockResolvedValue(null);

      const result = await getModelById('nonexistent-id');

      expect(result).toBeNull();
    });
  });

  // ============================================================================
  // getModelOrThrow Tests
  // ============================================================================

  describe('getModelOrThrow', () => {
    it('should return model when found', async () => {
      mockCache.getOrSet.mockResolvedValue(mockModel);

      const result = await getModelOrThrow(mockModel.modelId);

      expect(result).toEqual(mockModel);
    });

    it('should throw ModelNotFoundError when model not found', async () => {
      mockCache.getOrSet.mockResolvedValue(null);

      await expect(getModelOrThrow('nonexistent-id')).rejects.toThrow(ModelNotFoundError);
      await expect(getModelOrThrow('nonexistent-id')).rejects.toThrow(
        'Model not found: nonexistent-id'
      );
    });
  });

  // ============================================================================
  // updateModel Tests (Requirement 11.3)
  // ============================================================================

  describe('updateModel', () => {
    const updateRequest: UpdateModelRequest = {
      modelName: 'PowerEdge R750xs',
      sku: 'DELL-R750XS-001',
    };

    const updatedModel: ModelDetails = {
      ...mockModel,
      modelName: 'PowerEdge R750xs',
      sku: 'DELL-R750XS-001',
      updatedAt: '2024-01-15T12:00:00.000Z',
    };

    it('should update model and invalidate cache (Requirement 11.3)', async () => {
      mockRepository.getModelById.mockResolvedValue(mockModel);
      mockRepository.modelSkuExists.mockResolvedValue(false);
      mockRepository.updateModel.mockResolvedValue(updatedModel);
      mockCache.delPattern.mockResolvedValue(1);
      mockCache.del.mockResolvedValue(true);
      mockPublishEvent.mockResolvedValue(mockPublishResult);

      const result = await updateModel(mockModel.modelId, updateRequest);

      expect(result).toEqual(updatedModel);
      expect(mockRepository.getModelById).toHaveBeenCalledWith(mockModel.modelId);
      expect(mockRepository.updateModel).toHaveBeenCalledWith(
        mockModel.modelId,
        updateRequest,
        undefined
      );
    });

    it('should throw ModelNotFoundError for non-existent model', async () => {
      mockRepository.getModelById.mockResolvedValue(null);

      await expect(updateModel('nonexistent-id', updateRequest)).rejects.toThrow(ModelNotFoundError);
      expect(mockRepository.updateModel).not.toHaveBeenCalled();
    });

    it('should throw ModelSkuExistsError when new SKU already exists', async () => {
      mockRepository.getModelById.mockResolvedValue(mockModel);
      mockRepository.modelSkuExists.mockResolvedValue(true);

      await expect(updateModel(mockModel.modelId, { sku: 'EXISTING-SKU' })).rejects.toThrow(ModelSkuExistsError);
      expect(mockRepository.updateModel).not.toHaveBeenCalled();
    });

    it('should throw InvalidStatusTransitionError for invalid status change', async () => {
      mockRepository.getModelById.mockResolvedValue(mockModel);

      await expect(updateModel(mockModel.modelId, { status: 'END_OF_LIFE' })).rejects.toThrow(InvalidStatusTransitionError);
      expect(mockRepository.updateModel).not.toHaveBeenCalled();
    });

    it('should allow valid status transition in update', async () => {
      mockRepository.getModelById.mockResolvedValue(mockModel);
      mockRepository.updateModel.mockResolvedValue({ ...mockModel, status: 'DEPRECATED' });
      mockCache.delPattern.mockResolvedValue(1);
      mockCache.del.mockResolvedValue(true);
      mockPublishEvent.mockResolvedValue(mockPublishResult);

      const result = await updateModel(mockModel.modelId, { status: 'DEPRECATED' });

      expect(result.status).toBe('DEPRECATED');
    });

    it('should publish MODEL_UPDATED event with changes', async () => {
      const userId = 'user-123';
      mockRepository.getModelById.mockResolvedValue(mockModel);
      mockRepository.modelSkuExists.mockResolvedValue(false);
      mockRepository.updateModel.mockResolvedValue(updatedModel);
      mockCache.delPattern.mockResolvedValue(1);
      mockCache.del.mockResolvedValue(true);
      mockPublishEvent.mockResolvedValue(mockPublishResult);

      await updateModel(mockModel.modelId, updateRequest, userId);

      expect(mockPublishEvent).toHaveBeenCalledWith('MODEL_UPDATED', expect.objectContaining({
        modelId: updatedModel.modelId,
        modelName: updatedModel.modelName,
        updatedBy: userId,
      }));
    });
  });

  // ============================================================================
  // updateModelStatus Tests (Lifecycle Transitions)
  // ============================================================================

  describe('updateModelStatus', () => {
    it('should update status from ACTIVE to DEPRECATED', async () => {
      mockRepository.getModelById.mockResolvedValue(mockModel);
      mockRepository.updateModelStatus.mockResolvedValue({ ...mockModel, status: 'DEPRECATED' });
      mockCache.delPattern.mockResolvedValue(1);
      mockCache.del.mockResolvedValue(true);
      mockPublishEvent.mockResolvedValue(mockPublishResult);

      const result = await updateModelStatus(mockModel.modelId, 'DEPRECATED');

      expect(result.status).toBe('DEPRECATED');
      expect(mockRepository.updateModelStatus).toHaveBeenCalledWith(mockModel.modelId, 'DEPRECATED', undefined);
    });

    it('should update status from DEPRECATED to END_OF_LIFE', async () => {
      mockRepository.getModelById.mockResolvedValue(mockDeprecatedModel);
      mockRepository.updateModelStatus.mockResolvedValue({ ...mockDeprecatedModel, status: 'END_OF_LIFE' });
      mockCache.delPattern.mockResolvedValue(1);
      mockCache.del.mockResolvedValue(true);
      mockPublishEvent.mockResolvedValue(mockPublishResult);

      const result = await updateModelStatus(mockDeprecatedModel.modelId, 'END_OF_LIFE');

      expect(result.status).toBe('END_OF_LIFE');
    });

    it('should update status from DEPRECATED to ACTIVE (reinstatement)', async () => {
      mockRepository.getModelById.mockResolvedValue(mockDeprecatedModel);
      mockRepository.updateModelStatus.mockResolvedValue({ ...mockDeprecatedModel, status: 'ACTIVE' });
      mockCache.delPattern.mockResolvedValue(1);
      mockCache.del.mockResolvedValue(true);
      mockPublishEvent.mockResolvedValue(mockPublishResult);

      const result = await updateModelStatus(mockDeprecatedModel.modelId, 'ACTIVE');

      expect(result.status).toBe('ACTIVE');
    });

    it('should throw InvalidStatusTransitionError for ACTIVE → END_OF_LIFE', async () => {
      mockRepository.getModelById.mockResolvedValue(mockModel);

      await expect(updateModelStatus(mockModel.modelId, 'END_OF_LIFE')).rejects.toThrow(InvalidStatusTransitionError);
      await expect(updateModelStatus(mockModel.modelId, 'END_OF_LIFE')).rejects.toThrow(
        /Invalid status transition from ACTIVE to END_OF_LIFE/
      );
    });

    it('should throw InvalidStatusTransitionError for END_OF_LIFE → any status', async () => {
      mockRepository.getModelById.mockResolvedValue(mockEndOfLifeModel);

      await expect(updateModelStatus(mockEndOfLifeModel.modelId, 'ACTIVE')).rejects.toThrow(InvalidStatusTransitionError);
      await expect(updateModelStatus(mockEndOfLifeModel.modelId, 'DEPRECATED')).rejects.toThrow(InvalidStatusTransitionError);
    });

    it('should publish MODEL_END_OF_LIFE event when transitioning to END_OF_LIFE', async () => {
      const userId = 'user-123';
      mockRepository.getModelById.mockResolvedValue(mockDeprecatedModel);
      mockRepository.updateModelStatus.mockResolvedValue({ ...mockDeprecatedModel, status: 'END_OF_LIFE' });
      mockCache.delPattern.mockResolvedValue(1);
      mockCache.del.mockResolvedValue(true);
      mockPublishEvent.mockResolvedValue(mockPublishResult);

      await updateModelStatus(mockDeprecatedModel.modelId, 'END_OF_LIFE', userId);

      expect(mockPublishEvent).toHaveBeenCalledWith('MODEL_END_OF_LIFE', {
        modelId: mockDeprecatedModel.modelId,
        modelName: mockDeprecatedModel.modelName,
        previousStatus: 'DEPRECATED',
        updatedBy: userId,
      });
    });

    it('should return existing model when status is unchanged', async () => {
      mockRepository.getModelById.mockResolvedValue(mockModel);

      const result = await updateModelStatus(mockModel.modelId, 'ACTIVE');

      expect(result).toEqual(mockModel);
      expect(mockRepository.updateModelStatus).not.toHaveBeenCalled();
    });
  });

  // ============================================================================
  // deprecateModel Tests
  // ============================================================================

  describe('deprecateModel', () => {
    it('should deprecate an active model', async () => {
      mockRepository.getModelById.mockResolvedValue(mockModel);
      mockRepository.updateModelStatus.mockResolvedValue({ ...mockModel, status: 'DEPRECATED' });
      mockCache.delPattern.mockResolvedValue(1);
      mockCache.del.mockResolvedValue(true);
      mockPublishEvent.mockResolvedValue(mockPublishResult);

      const result = await deprecateModel(mockModel.modelId);

      expect(result.status).toBe('DEPRECATED');
    });

    it('should throw InvalidStatusTransitionError for non-active model', async () => {
      mockRepository.getModelById.mockResolvedValue(mockEndOfLifeModel);

      await expect(deprecateModel(mockEndOfLifeModel.modelId)).rejects.toThrow(InvalidStatusTransitionError);
    });
  });

  // ============================================================================
  // markModelEndOfLife Tests (Requirement 11.4)
  // ============================================================================

  describe('markModelEndOfLife', () => {
    it('should mark deprecated model as end-of-life (Requirement 11.4)', async () => {
      mockRepository.getModelById.mockResolvedValue(mockDeprecatedModel);
      mockRepository.updateModelStatus.mockResolvedValue({ ...mockDeprecatedModel, status: 'END_OF_LIFE' });
      mockCache.delPattern.mockResolvedValue(1);
      mockCache.del.mockResolvedValue(true);
      mockPublishEvent.mockResolvedValue(mockPublishResult);

      const result = await markModelEndOfLife(mockDeprecatedModel.modelId);

      expect(result.status).toBe('END_OF_LIFE');
    });

    it('should throw InvalidStatusTransitionError for active model', async () => {
      mockRepository.getModelById.mockResolvedValue(mockModel);

      await expect(markModelEndOfLife(mockModel.modelId)).rejects.toThrow(InvalidStatusTransitionError);
    });
  });

  // ============================================================================
  // reinstateModel Tests
  // ============================================================================

  describe('reinstateModel', () => {
    it('should reinstate a deprecated model to active', async () => {
      mockRepository.getModelById.mockResolvedValue(mockDeprecatedModel);
      mockRepository.updateModelStatus.mockResolvedValue({ ...mockDeprecatedModel, status: 'ACTIVE' });
      mockCache.delPattern.mockResolvedValue(1);
      mockCache.del.mockResolvedValue(true);
      mockPublishEvent.mockResolvedValue(mockPublishResult);

      const result = await reinstateModel(mockDeprecatedModel.modelId);

      expect(result.status).toBe('ACTIVE');
    });

    it('should throw InvalidStatusTransitionError for end-of-life model', async () => {
      mockRepository.getModelById.mockResolvedValue(mockEndOfLifeModel);

      await expect(reinstateModel(mockEndOfLifeModel.modelId)).rejects.toThrow(InvalidStatusTransitionError);
    });
  });

  // ============================================================================
  // deactivateModel Tests
  // ============================================================================

  describe('deactivateModel', () => {
    const deactivatedModel: ModelDetails = {
      ...mockModel,
      isActive: false,
      updatedAt: '2024-01-15T12:00:00.000Z',
    };

    it('should deactivate model successfully', async () => {
      mockRepository.getModelById.mockResolvedValue(mockModel);
      mockRepository.getModelDependencies.mockResolvedValue({ assetCount: 0 });
      mockRepository.deactivateModel.mockResolvedValue(deactivatedModel);
      mockCache.delPattern.mockResolvedValue(1);
      mockCache.del.mockResolvedValue(true);
      mockPublishEvent.mockResolvedValue(mockPublishResult);

      const result = await deactivateModel(mockModel.modelId);

      expect(result).toEqual(deactivatedModel);
      expect(result.isActive).toBe(false);
    });

    it('should throw ModelNotFoundError when model does not exist', async () => {
      mockRepository.getModelById.mockResolvedValue(null);

      await expect(deactivateModel('nonexistent-id')).rejects.toThrow(ModelNotFoundError);
    });

    it('should still deactivate model with dependencies (warning only)', async () => {
      mockRepository.getModelById.mockResolvedValue(mockModel);
      mockRepository.getModelDependencies.mockResolvedValue({ assetCount: 5 });
      mockRepository.deactivateModel.mockResolvedValue(deactivatedModel);
      mockCache.delPattern.mockResolvedValue(1);
      mockCache.del.mockResolvedValue(true);
      mockPublishEvent.mockResolvedValue(mockPublishResult);

      const result = await deactivateModel(mockModel.modelId);

      expect(result.isActive).toBe(false);
    });
  });

  // ============================================================================
  // deleteModel Tests
  // ============================================================================

  describe('deleteModel', () => {
    it('should delete model when no dependencies', async () => {
      mockRepository.getModelById.mockResolvedValue(mockModel);
      mockRepository.getModelDependencies.mockResolvedValue({ assetCount: 0 });
      mockRepository.deleteModel.mockResolvedValue(true);
      mockCache.delPattern.mockResolvedValue(1);
      mockCache.del.mockResolvedValue(true);

      const result = await deleteModel(mockModel.modelId);

      expect(result).toBe(true);
      expect(mockRepository.deleteModel).toHaveBeenCalledWith(mockModel.modelId);
    });

    it('should throw ModelNotFoundError when model does not exist', async () => {
      mockRepository.getModelById.mockResolvedValue(null);

      await expect(deleteModel('nonexistent-id')).rejects.toThrow(ModelNotFoundError);
      expect(mockRepository.deleteModel).not.toHaveBeenCalled();
    });

    it('should throw ModelHasDependenciesError when has assets', async () => {
      mockRepository.getModelById.mockResolvedValue(mockModel);
      mockRepository.getModelDependencies.mockResolvedValue({ assetCount: 5 });

      await expect(deleteModel(mockModel.modelId)).rejects.toThrow(ModelHasDependenciesError);
      await expect(deleteModel(mockModel.modelId)).rejects.toThrow(/has 5 asset\(s\)/);
      expect(mockRepository.deleteModel).not.toHaveBeenCalled();
    });

    it('should invalidate cache after deletion', async () => {
      mockRepository.getModelById.mockResolvedValue(mockModel);
      mockRepository.getModelDependencies.mockResolvedValue({ assetCount: 0 });
      mockRepository.deleteModel.mockResolvedValue(true);
      mockCache.delPattern.mockResolvedValue(1);
      mockCache.del.mockResolvedValue(true);

      await deleteModel(mockModel.modelId);

      expect(mockCache.delPattern).toHaveBeenCalled();
    });
  });

  // ============================================================================
  // listModels Tests (Requirement 11.5)
  // ============================================================================

  describe('listModels', () => {
    const paginatedResult = {
      items: [mockModel, mockDeprecatedModel],
      total: 2,
      page: 1,
      limit: 20,
      hasMore: false,
    };

    it('should return paginated results (Requirement 11.5)', async () => {
      mockCache.getOrSet.mockResolvedValue(paginatedResult);

      const result = await listModels();

      expect(result).toEqual(paginatedResult);
      expect(result.items).toHaveLength(2);
    });

    it('should use cache for default pagination without filters', async () => {
      mockCache.getOrSet.mockResolvedValue(paginatedResult);

      await listModels({}, { page: 1, limit: 20 });

      expect(mockCache.getOrSet).toHaveBeenCalledWith(
        'model:list',
        expect.any(Function),
        { ttl: cache.DEFAULT_TTL.SHORT }
      );
    });

    it('should bypass cache when filters are applied', async () => {
      mockRepository.listModels.mockResolvedValue(paginatedResult);

      await listModels({ status: 'ACTIVE' });

      expect(mockRepository.listModels).toHaveBeenCalled();
      expect(mockCache.getOrSet).not.toHaveBeenCalled();
    });

    it('should bypass cache for non-default pagination', async () => {
      mockRepository.listModels.mockResolvedValue({ ...paginatedResult, page: 2 });

      await listModels({}, { page: 2, limit: 20 });

      expect(mockRepository.listModels).toHaveBeenCalled();
      expect(mockCache.getOrSet).not.toHaveBeenCalled();
    });

    it('should apply manufacturer filter correctly', async () => {
      const filters = { manufacturerId: '222e4567-e89b-12d3-a456-426614174000' };
      mockRepository.listModels.mockResolvedValue(paginatedResult);

      await listModels(filters);

      expect(mockRepository.listModels).toHaveBeenCalledWith(filters, {});
    });

    it('should apply status filter correctly', async () => {
      const filters = { status: 'DEPRECATED' as ModelStatus };
      mockRepository.listModels.mockResolvedValue(paginatedResult);

      await listModels(filters);

      expect(mockRepository.listModels).toHaveBeenCalledWith(filters, {});
    });
  });

  // ============================================================================
  // searchModels Tests (Requirement 11.6)
  // ============================================================================

  describe('searchModels', () => {
    const searchResults: ModelDetails[] = [mockModel, mockDeprecatedModel];

    it('should return matching models (Requirement 11.6)', async () => {
      mockCache.getOrSet.mockResolvedValue(searchResults);

      const result = await searchModels('PowerEdge');

      expect(result).toEqual(searchResults);
      expect(result).toHaveLength(2);
    });

    it('should use cache for search results', async () => {
      mockCache.getOrSet.mockResolvedValue(searchResults);

      await searchModels('PowerEdge');

      expect(mockCache.getOrSet).toHaveBeenCalledWith(
        'search:model:poweredge',
        expect.any(Function),
        { ttl: cache.DEFAULT_TTL.SHORT }
      );
    });

    it('should fetch from repository on cache miss', async () => {
      mockCache.getOrSet.mockImplementation(async (_key, fetchFn) => fetchFn());
      mockRepository.searchModels.mockResolvedValue(searchResults);

      const result = await searchModels('PowerEdge');

      expect(result).toEqual(searchResults);
      expect(mockRepository.searchModels).toHaveBeenCalledWith('PowerEdge');
    });

    it('should return empty array when no matches', async () => {
      mockCache.getOrSet.mockResolvedValue([]);

      const result = await searchModels('NonExistent');

      expect(result).toEqual([]);
      expect(result).toHaveLength(0);
    });
  });

  // ============================================================================
  // validateModelForAssetCreation Tests (Requirement 11.4)
  // ============================================================================

  describe('validateModelForAssetCreation', () => {
    it('should pass validation for active model', async () => {
      mockCache.getOrSet.mockResolvedValue(mockModel);

      await expect(validateModelForAssetCreation(mockModel.modelId)).resolves.not.toThrow();
    });

    it('should throw ModelNotFoundError for non-existent model', async () => {
      mockCache.getOrSet.mockResolvedValue(null);

      await expect(validateModelForAssetCreation('nonexistent-id')).rejects.toThrow(ModelNotFoundError);
    });

    it('should throw ModelEndOfLifeError for end-of-life model (Requirement 11.4)', async () => {
      mockCache.getOrSet.mockResolvedValue(mockEndOfLifeModel);

      await expect(validateModelForAssetCreation(mockEndOfLifeModel.modelId)).rejects.toThrow(ModelEndOfLifeError);
    });

    it('should throw ModelEndOfLifeError for inactive model', async () => {
      mockCache.getOrSet.mockResolvedValue(mockInactiveModel);

      await expect(validateModelForAssetCreation(mockInactiveModel.modelId)).rejects.toThrow(ModelEndOfLifeError);
    });
  });

  // ============================================================================
  // getModelSummary Tests
  // ============================================================================

  describe('getModelSummary', () => {
    it('should return model summary with dependency counts', async () => {
      mockCache.getOrSet.mockResolvedValue(mockModel);
      mockRepository.getModelDependencies.mockResolvedValue({ assetCount: 5 });

      const result = await getModelSummary(mockModel.modelId);

      expect(result).not.toBeNull();
      expect(result?.model).toEqual(mockModel);
      expect(result?.assetCount).toBe(5);
      expect(result?.canDelete).toBe(false);
      expect(result?.validNextStatuses).toEqual(['DEPRECATED']);
    });

    it('should return canDelete true when no dependencies', async () => {
      mockCache.getOrSet.mockResolvedValue(mockModel);
      mockRepository.getModelDependencies.mockResolvedValue({ assetCount: 0 });

      const result = await getModelSummary(mockModel.modelId);

      expect(result?.canDelete).toBe(true);
    });

    it('should return null for non-existent model', async () => {
      mockCache.getOrSet.mockResolvedValue(null);

      const result = await getModelSummary('nonexistent-id');

      expect(result).toBeNull();
    });

    it('should return empty validNextStatuses for end-of-life model', async () => {
      mockCache.getOrSet.mockResolvedValue(mockEndOfLifeModel);
      mockRepository.getModelDependencies.mockResolvedValue({ assetCount: 0 });

      const result = await getModelSummary(mockEndOfLifeModel.modelId);

      expect(result?.validNextStatuses).toEqual([]);
    });
  });

  // ============================================================================
  // Additional Helper Function Tests
  // ============================================================================

  describe('isModelSkuUnique', () => {
    it('should return true when SKU does not exist', async () => {
      mockRepository.modelSkuExists.mockResolvedValue(false);

      const result = await isModelSkuUnique('NEW-SKU');

      expect(result).toBe(true);
    });

    it('should return false when SKU exists', async () => {
      mockRepository.modelSkuExists.mockResolvedValue(true);

      const result = await isModelSkuUnique('EXISTING-SKU');

      expect(result).toBe(false);
    });

    it('should exclude specified model ID when checking', async () => {
      mockRepository.modelSkuExists.mockResolvedValue(false);

      await isModelSkuUnique('SKU', mockModel.modelId);

      expect(mockRepository.modelSkuExists).toHaveBeenCalledWith('SKU', mockModel.modelId);
    });
  });

  describe('getModelsForAssetCreation', () => {
    it('should return only active non-end-of-life models', async () => {
      const availableModels = [mockModel];
      mockCache.getOrSet.mockResolvedValue(availableModels);

      const result = await getModelsForAssetCreation();

      expect(result).toEqual(availableModels);
      expect(mockCache.getOrSet).toHaveBeenCalledWith(
        'model:for-asset-creation',
        expect.any(Function),
        { ttl: cache.DEFAULT_TTL.MEDIUM }
      );
    });
  });

  describe('reactivateModel', () => {
    it('should reactivate an inactive model', async () => {
      mockRepository.getModelById.mockResolvedValue(mockInactiveModel);
      mockRepository.updateModel.mockResolvedValue({ ...mockInactiveModel, isActive: true });
      mockCache.delPattern.mockResolvedValue(1);
      mockCache.del.mockResolvedValue(true);
      mockPublishEvent.mockResolvedValue(mockPublishResult);

      const result = await reactivateModel(mockInactiveModel.modelId);

      expect(result.isActive).toBe(true);
    });

    it('should throw ModelNotFoundError for non-existent model', async () => {
      mockRepository.getModelById.mockResolvedValue(null);

      await expect(reactivateModel('nonexistent-id')).rejects.toThrow(ModelNotFoundError);
    });
  });
});

