/**
 * Template Service Unit Tests
 *
 * Tests for Template Service:
 * - Template CRUD operations (Requirement 16.10)
 * - Template sharing (Requirement 16.10)
 * - Report access logging (Requirement 16.9)
 */

// Mock dependencies before importing service
jest.mock('@ams/database', () => ({
  queryOne: jest.fn(),
  queryMany: jest.fn(),
  withTransaction: jest.fn((fn) => fn({
    queryOne: jest.fn(),
    queryMany: jest.fn(),
  })),
}));

jest.mock('@ams/cache', () => ({
  del: jest.fn().mockResolvedValue(undefined),
  get: jest.fn().mockResolvedValue(null),
  set: jest.fn().mockResolvedValue(undefined),
}));

jest.mock('@ams/events', () => ({
  publishEvent: jest.fn().mockResolvedValue(undefined),
}));

jest.mock('@ams/utils', () => ({
  createLogger: () => ({
    info: jest.fn(),
    error: jest.fn(),
    warn: jest.fn(),
    debug: jest.fn(),
  }),
  now: () => '2024-01-15T10:00:00.000Z',
  validateUUID: jest.fn().mockReturnValue(null),
}));

// Mock repositories
jest.mock('../report/report-repository');
jest.mock('../template/template-repository');

import * as templateService from '../template/template-service';
import * as templateRepository from '../template/template-repository';
import * as reportRepository from '../report/report-repository';
import type {
  CreateTemplateRequest,
  ReportTemplate,
} from '../report/report-types';

const mockTemplateRepository = templateRepository as jest.Mocked<typeof templateRepository>;
const mockReportRepository = reportRepository as jest.Mocked<typeof reportRepository>;

describe('Template Service', () => {
  const userId = '123e4567-e89b-12d3-a456-426614174000';
  const otherUserId = '987fcdeb-51a2-3b4c-d5e6-789012345678';


  const validCreateRequest: CreateTemplateRequest = {
    name: 'Hardware Inventory Template',
    description: 'Template for hardware asset inventory reports',
    definition: {
      dataSource: 'HARDWARE_ASSETS',
      columns: [
        { columnId: 'col-1', fieldName: 'asset_tag', displayName: 'Asset Tag', dataType: 'STRING' },
        { columnId: 'col-2', fieldName: 'manufacturer', displayName: 'Manufacturer', dataType: 'STRING' },
      ],
    },
    defaultFormat: 'CSV',
    visibility: 'PRIVATE',
    tags: ['hardware', 'inventory'],
  };

  const mockTemplate: ReportTemplate = {
    templateId: 'template-123',
    name: 'Hardware Inventory Template',
    description: 'Template for hardware asset inventory reports',
    definition: validCreateRequest.definition,
    defaultFormat: 'CSV',
    createdBy: userId,
    createdAt: '2024-01-15T10:00:00.000Z',
    updatedAt: '2024-01-15T10:00:00.000Z',
    visibility: 'PRIVATE',
    tags: ['hardware', 'inventory'],
    usageCount: 0,
  };

  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('createTemplate', () => {
    beforeEach(() => {
      mockTemplateRepository.createTemplate.mockResolvedValue(mockTemplate);
      mockReportRepository.logReportAccess.mockResolvedValue({
        logId: 'log-1',
        reportId: 'template-123',
        reportType: 'ASSET_INVENTORY',
        accessedBy: userId,
        accessedAt: '2024-01-15T10:00:00.000Z',
        action: 'GENERATED',
        format: 'CSV',
      });
    });

    it('should create a new template successfully', async () => {
      const result = await templateService.createTemplate(validCreateRequest, userId);

      expect(result.name).toBe(validCreateRequest.name);
      expect(result.createdBy).toBe(userId);
      expect(result.visibility).toBe('PRIVATE');
      expect(mockTemplateRepository.createTemplate).toHaveBeenCalled();
      expect(mockReportRepository.logReportAccess).toHaveBeenCalled();
    });

    it('should throw error when name is missing', async () => {
      const request = { ...validCreateRequest, name: '' };

      await expect(templateService.createTemplate(request, userId)).rejects.toThrow(
        'Template name is required'
      );
    });

    it('should throw error when name is too long', async () => {
      const request = { ...validCreateRequest, name: 'a'.repeat(256) };

      await expect(templateService.createTemplate(request, userId)).rejects.toThrow(
        'Template name must be 255 characters or less'
      );
    });

    it('should throw error when description is too long', async () => {
      const request = { ...validCreateRequest, description: 'a'.repeat(1001) };

      await expect(templateService.createTemplate(request, userId)).rejects.toThrow(
        'Template description must be 1000 characters or less'
      );
    });

    it('should throw error when definition is missing', async () => {
      const request = { ...validCreateRequest, definition: undefined as any };

      await expect(templateService.createTemplate(request, userId)).rejects.toThrow(
        'Template definition is required'
      );
    });

    it('should throw error when too many tags', async () => {
      const request = { 
        ...validCreateRequest, 
        tags: Array(11).fill('tag') 
      };

      await expect(templateService.createTemplate(request, userId)).rejects.toThrow(
        'Maximum 10 tags allowed'
      );
    });

    it('should default visibility to PRIVATE', async () => {
      const request = { ...validCreateRequest, visibility: undefined };

      await templateService.createTemplate(request, userId);

      expect(mockTemplateRepository.createTemplate).toHaveBeenCalledWith(
        expect.objectContaining({ visibility: 'PRIVATE' })
      );
    });

    it('should default format to CSV', async () => {
      const request = { ...validCreateRequest, defaultFormat: undefined };

      await templateService.createTemplate(request, userId);

      expect(mockTemplateRepository.createTemplate).toHaveBeenCalledWith(
        expect.objectContaining({ defaultFormat: 'CSV' })
      );
    });
  });

  describe('getTemplate', () => {
    it('should return template when user is owner', async () => {
      mockTemplateRepository.getTemplateById.mockResolvedValue(mockTemplate);

      const result = await templateService.getTemplate('template-123', userId);

      expect(result).toEqual(mockTemplate);
    });

    it('should return null when template not found', async () => {
      mockTemplateRepository.getTemplateById.mockResolvedValue(null);

      const result = await templateService.getTemplate('nonexistent', userId);

      expect(result).toBeNull();
    });

    it('should return template when visibility is PUBLIC', async () => {
      const publicTemplate = { ...mockTemplate, visibility: 'PUBLIC' as const };
      mockTemplateRepository.getTemplateById.mockResolvedValue(publicTemplate);

      const result = await templateService.getTemplate('template-123', otherUserId);

      expect(result).toEqual(publicTemplate);
    });

    it('should return template when user is in sharedWith list', async () => {
      const sharedTemplate = { 
        ...mockTemplate, 
        visibility: 'SHARED' as const,
        sharedWith: [otherUserId] 
      };
      mockTemplateRepository.getTemplateById.mockResolvedValue(sharedTemplate);

      const result = await templateService.getTemplate('template-123', otherUserId);

      expect(result).toEqual(sharedTemplate);
    });

    it('should return null when user has no access to private template', async () => {
      mockTemplateRepository.getTemplateById.mockResolvedValue(mockTemplate);

      const result = await templateService.getTemplate('template-123', otherUserId);

      expect(result).toBeNull();
    });
  });

  describe('updateTemplate', () => {
    beforeEach(() => {
      mockTemplateRepository.getTemplateById.mockResolvedValue(mockTemplate);
      mockTemplateRepository.updateTemplate.mockImplementation(async (t) => t);
    });

    it('should update template successfully', async () => {
      const result = await templateService.updateTemplate(
        'template-123',
        { name: 'Updated Name' },
        userId
      );

      expect(result.name).toBe('Updated Name');
      expect(mockTemplateRepository.updateTemplate).toHaveBeenCalled();
    });

    it('should throw error when template not found', async () => {
      mockTemplateRepository.getTemplateById.mockResolvedValue(null);

      await expect(
        templateService.updateTemplate('nonexistent', { name: 'New Name' }, userId)
      ).rejects.toThrow('Template not found');
    });

    it('should throw error when user is not owner', async () => {
      await expect(
        templateService.updateTemplate('template-123', { name: 'New Name' }, otherUserId)
      ).rejects.toThrow('Only the template owner can update it');
    });

    it('should update visibility', async () => {
      const result = await templateService.updateTemplate(
        'template-123',
        { visibility: 'PUBLIC' },
        userId
      );

      expect(result.visibility).toBe('PUBLIC');
    });
  });

  describe('deleteTemplate', () => {
    beforeEach(() => {
      mockTemplateRepository.getTemplateById.mockResolvedValue(mockTemplate);
      mockTemplateRepository.deleteTemplate.mockResolvedValue(undefined);
    });

    it('should delete template successfully', async () => {
      await templateService.deleteTemplate('template-123', userId);

      expect(mockTemplateRepository.deleteTemplate).toHaveBeenCalledWith('template-123');
    });

    it('should throw error when template not found', async () => {
      mockTemplateRepository.getTemplateById.mockResolvedValue(null);

      await expect(
        templateService.deleteTemplate('nonexistent', userId)
      ).rejects.toThrow('Template not found');
    });

    it('should throw error when user is not owner', async () => {
      await expect(
        templateService.deleteTemplate('template-123', otherUserId)
      ).rejects.toThrow('Only the template owner can delete it');
    });
  });

  describe('shareTemplate', () => {
    beforeEach(() => {
      mockTemplateRepository.getTemplateById.mockResolvedValue(mockTemplate);
      mockTemplateRepository.updateTemplate.mockImplementation(async (t) => t);
    });

    it('should share template with users', async () => {
      const result = await templateService.shareTemplate(
        'template-123',
        [otherUserId],
        userId
      );

      expect(result.sharedWith).toContain(otherUserId);
      expect(result.visibility).toBe('SHARED');
    });

    it('should throw error when template not found', async () => {
      mockTemplateRepository.getTemplateById.mockResolvedValue(null);

      await expect(
        templateService.shareTemplate('nonexistent', [otherUserId], userId)
      ).rejects.toThrow('Template not found');
    });

    it('should throw error when user is not owner', async () => {
      await expect(
        templateService.shareTemplate('template-123', [otherUserId], otherUserId)
      ).rejects.toThrow('Only the template owner can share it');
    });

    it('should merge with existing shared users', async () => {
      const existingShared = { 
        ...mockTemplate, 
        sharedWith: ['user-1'],
        visibility: 'SHARED' as const
      };
      mockTemplateRepository.getTemplateById.mockResolvedValue(existingShared);

      const result = await templateService.shareTemplate(
        'template-123',
        [otherUserId],
        userId
      );

      expect(result.sharedWith).toContain('user-1');
      expect(result.sharedWith).toContain(otherUserId);
    });
  });

  describe('unshareTemplate', () => {
    const sharedTemplate = {
      ...mockTemplate,
      visibility: 'SHARED' as const,
      sharedWith: [otherUserId, 'user-2'],
    };

    beforeEach(() => {
      mockTemplateRepository.getTemplateById.mockResolvedValue(sharedTemplate);
      mockTemplateRepository.updateTemplate.mockImplementation(async (t) => t);
    });

    it('should unshare template from users', async () => {
      const result = await templateService.unshareTemplate(
        'template-123',
        [otherUserId],
        userId
      );

      expect(result.sharedWith).not.toContain(otherUserId);
      expect(result.sharedWith).toContain('user-2');
    });

    it('should set visibility to PRIVATE when no users remain', async () => {
      const singleShared = { ...sharedTemplate, sharedWith: [otherUserId] };
      mockTemplateRepository.getTemplateById.mockResolvedValue(singleShared);

      const result = await templateService.unshareTemplate(
        'template-123',
        [otherUserId],
        userId
      );

      expect(result.sharedWith).toHaveLength(0);
      expect(result.visibility).toBe('PRIVATE');
    });
  });

  describe('makeTemplatePublic', () => {
    beforeEach(() => {
      mockTemplateRepository.getTemplateById.mockResolvedValue(mockTemplate);
      mockTemplateRepository.updateTemplate.mockImplementation(async (t) => t);
    });

    it('should make template public', async () => {
      const result = await templateService.makeTemplatePublic('template-123', userId);

      expect(result.visibility).toBe('PUBLIC');
    });

    it('should throw error when user is not owner', async () => {
      await expect(
        templateService.makeTemplatePublic('template-123', otherUserId)
      ).rejects.toThrow('Only the template owner can make it public');
    });
  });

  describe('makeTemplatePrivate', () => {
    const publicTemplate = { ...mockTemplate, visibility: 'PUBLIC' as const };

    beforeEach(() => {
      mockTemplateRepository.getTemplateById.mockResolvedValue(publicTemplate);
      mockTemplateRepository.updateTemplate.mockImplementation(async (t) => t);
    });

    it('should make template private', async () => {
      const result = await templateService.makeTemplatePrivate('template-123', userId);

      expect(result.visibility).toBe('PRIVATE');
      expect(result.sharedWith).toHaveLength(0);
    });

    it('should throw error when user is not owner', async () => {
      await expect(
        templateService.makeTemplatePrivate('template-123', otherUserId)
      ).rejects.toThrow('Only the template owner can make it private');
    });
  });

  describe('listTemplates', () => {
    beforeEach(() => {
      mockTemplateRepository.listTemplates.mockResolvedValue({
        templates: [mockTemplate],
        total: 1,
        page: 1,
        limit: 20,
      });
    });

    it('should list templates for user', async () => {
      const result = await templateService.listTemplates({}, userId);

      expect(result.templates).toHaveLength(1);
      expect(result.total).toBe(1);
    });

    it('should pass query parameters to repository', async () => {
      await templateService.listTemplates(
        { visibility: 'PUBLIC', page: 2, limit: 10 },
        userId
      );

      expect(mockTemplateRepository.listTemplates).toHaveBeenCalledWith(
        expect.objectContaining({ visibility: 'PUBLIC', page: 2, limit: 10 }),
        userId
      );
    });
  });

  describe('recordTemplateUsage', () => {
    beforeEach(() => {
      mockTemplateRepository.incrementUsageCount.mockResolvedValue(undefined);
      mockReportRepository.logReportAccess.mockResolvedValue({
        logId: 'log-1',
        reportId: 'template-123',
        reportType: 'ASSET_INVENTORY',
        accessedBy: userId,
        accessedAt: '2024-01-15T10:00:00.000Z',
        action: 'VIEWED',
        format: 'CSV',
      });
    });

    it('should record template usage', async () => {
      await templateService.recordTemplateUsage('template-123', userId);

      expect(mockTemplateRepository.incrementUsageCount).toHaveBeenCalledWith('template-123');
      expect(mockReportRepository.logReportAccess).toHaveBeenCalled();
    });
  });
});
