/**
 * Service Catalog Service Unit Tests
 *
 * Tests for Service Catalog Service:
 * - Display available items with descriptions and pricing (Requirement 6B.1)
 * - Support catalog item categories (Requirement 6B.2)
 * - Enforce entitlement rules based on role/department (Requirement 6B.9)
 */

// Mock the dependencies before importing service
jest.mock('@ams/database', () => ({
  queryOne: jest.fn(),
  queryMany: jest.fn(),
}));

jest.mock('@ams/cache', () => ({
  del: jest.fn().mockResolvedValue(undefined),
  get: jest.fn().mockResolvedValue(null),
  set: jest.fn().mockResolvedValue(undefined),
}));

jest.mock('@ams/utils', () => ({
  createLogger: () => ({
    info: jest.fn(),
    error: jest.fn(),
    warn: jest.fn(),
    debug: jest.fn(),
  }),
  now: () => '2024-01-15T10:00:00.000Z',
}));

// Mock the repository
jest.mock('../service-catalog/service-catalog-repository', () => ({
  getCatalogItemById: jest.fn(),
  getCatalogItemByCode: jest.fn(),
  getCatalogItems: jest.fn(),
  searchCatalogItems: jest.fn(),
  getCatalogCategories: jest.fn(),
  getCategoryById: jest.fn(),
  getEntitlementRulesForItem: jest.fn(),
  getEntitlementRulesForCategory: jest.fn(),
  getEntitlementRulesForUser: jest.fn(),
}));

import * as serviceCatalogService from '../service-catalog/service-catalog-service';
import * as repository from '../service-catalog/service-catalog-repository';
import * as cache from '@ams/cache';

const mockRepository = repository as unknown as jest.Mocked<typeof repository>;
const mockCache = cache as unknown as jest.Mocked<typeof cache>;

describe('Service Catalog Service', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  const mockUserContext = {
    userId: '123e4567-e89b-12d3-a456-426614174000',
    roles: ['EMPLOYEE', 'IT_STAFF'],
    departmentId: 'dept-001',
    departmentName: 'Information Technology',
    costCenterId: 'cc-001',
    locationId: 'loc-001',
  };

  const mockCatalogItem = {
    catalogItemId: '123e4567-e89b-12d3-a456-426614174001',
    itemCode: 'LAPTOP-001',
    name: 'MacBook Pro 16"',
    description: 'High-performance laptop for developers',
    shortDescription: 'MacBook Pro 16-inch',
    itemType: 'HARDWARE' as const,
    categoryId: 'cat-001',
    categoryName: 'Laptops',
    subcategoryId: null,
    subcategoryName: null,
    manufacturer: 'Apple',
    model: 'MacBook Pro 16-inch M3 Max',
    sku: 'MBP16-M3MAX',
    unitPrice: 3499.00,
    currency: 'USD',
    imageUrl: 'https://example.com/images/mbp16.jpg',
    thumbnailUrl: 'https://example.com/images/mbp16-thumb.jpg',
    specifications: { cpu: 'M3 Max', memory: '36GB', storage: '1TB SSD' },
    features: ['M3 Max chip', '36GB unified memory', '1TB SSD'],
    status: 'ACTIVE' as const,
    isRequestable: true,
    requiresApproval: true,
    approvalThreshold: 2000,
    leadTimeDays: 5,
    maxQuantityPerRequest: 2,
    vendorId: 'vendor-001',
    vendorName: 'Apple Inc.',
    stockroomId: 'stock-001',
    quantityAvailable: 10,
    tags: ['laptop', 'apple', 'developer'],
    sortOrder: 1,
    createdAt: '2024-01-01T00:00:00.000Z',
    updatedAt: '2024-01-15T00:00:00.000Z',
  };

  const mockCategory = {
    categoryId: 'cat-001',
    name: 'Laptops',
    description: 'Portable computers',
    parentCategoryId: null,
    parentCategoryName: null,
    iconUrl: 'https://example.com/icons/laptop.svg',
    sortOrder: 1,
    isActive: true,
    itemCount: 15,
    createdAt: '2024-01-01T00:00:00.000Z',
    updatedAt: '2024-01-15T00:00:00.000Z',
  };

  describe('getCatalogItems', () => {
    it('should return catalog items with entitlement information', async () => {
      mockRepository.getCatalogItems.mockResolvedValue({
        items: [mockCatalogItem],
        total: 1,
        page: 1,
        limit: 50,
        hasMore: false,
      });
      mockRepository.getEntitlementRulesForItem.mockResolvedValue([]);
      mockRepository.getEntitlementRulesForCategory.mockResolvedValue([]);

      const result = await serviceCatalogService.getCatalogItems(mockUserContext);

      expect(result.items.length).toBe(1);
      expect(result.items[0]!.catalogItemId).toBe(mockCatalogItem.catalogItemId);
      expect(result.items[0]!.isEntitled).toBe(true);
      expect(result.total).toBe(1);
    });

    it('should apply filters correctly', async () => {
      mockRepository.getCatalogItems.mockResolvedValue({
        items: [],
        total: 0,
        page: 1,
        limit: 50,
        hasMore: false,
      });

      const filters = {
        categoryId: 'cat-001',
        itemType: 'HARDWARE' as const,
        minPrice: 1000,
        maxPrice: 5000,
      };

      await serviceCatalogService.getCatalogItems(mockUserContext, filters);

      expect(mockRepository.getCatalogItems).toHaveBeenCalledWith(filters, { page: undefined, limit: undefined });
    });

    it('should apply pagination correctly', async () => {
      mockRepository.getCatalogItems.mockResolvedValue({
        items: [],
        total: 100,
        page: 2,
        limit: 25,
        hasMore: true,
      });

      const result = await serviceCatalogService.getCatalogItems(
        mockUserContext,
        {},
        { page: 2, limit: 25 }
      );

      expect(result.page).toBe(2);
      expect(result.limit).toBe(25);
      expect(result.hasMore).toBe(true);
    });
  });

  describe('searchCatalog', () => {
    it('should search catalog items with query', async () => {
      mockRepository.searchCatalogItems.mockResolvedValue({
        items: [mockCatalogItem],
        total: 1,
        page: 1,
        limit: 50,
        hasMore: false,
      });
      mockRepository.getEntitlementRulesForItem.mockResolvedValue([]);
      mockRepository.getEntitlementRulesForCategory.mockResolvedValue([]);

      const result = await serviceCatalogService.searchCatalog('MacBook', mockUserContext);

      expect(result.items.length).toBe(1);
      expect(result.query).toBe('MacBook');
      expect(result.total).toBe(1);
    });

    it('should return empty result for empty query', async () => {
      const result = await serviceCatalogService.searchCatalog('', mockUserContext);

      expect(result.items.length).toBe(0);
      expect(result.total).toBe(0);
      expect(result.query).toBe('');
    });

    it('should return empty result for whitespace-only query', async () => {
      const result = await serviceCatalogService.searchCatalog('   ', mockUserContext);

      expect(result.items.length).toBe(0);
      expect(result.total).toBe(0);
    });

    it('should include search suggestions', async () => {
      mockRepository.searchCatalogItems.mockResolvedValue({
        items: [mockCatalogItem],
        total: 1,
        page: 1,
        limit: 50,
        hasMore: false,
      });
      mockRepository.getEntitlementRulesForItem.mockResolvedValue([]);
      mockRepository.getEntitlementRulesForCategory.mockResolvedValue([]);

      const result = await serviceCatalogService.searchCatalog('apple', mockUserContext);

      expect(result.suggestions).toBeDefined();
      expect(Array.isArray(result.suggestions)).toBe(true);
    });
  });

  describe('getCatalogItem', () => {
    it('should return catalog item with entitlement information', async () => {
      mockCache.get.mockResolvedValue(null);
      mockRepository.getCatalogItemById.mockResolvedValue(mockCatalogItem);
      mockRepository.getEntitlementRulesForItem.mockResolvedValue([]);
      mockRepository.getEntitlementRulesForCategory.mockResolvedValue([]);

      const result = await serviceCatalogService.getCatalogItem(
        mockCatalogItem.catalogItemId,
        mockUserContext
      );

      expect(result).not.toBeNull();
      expect(result?.catalogItemId).toBe(mockCatalogItem.catalogItemId);
      expect(result?.isEntitled).toBe(true);
    });

    it('should return null when item not found', async () => {
      mockCache.get.mockResolvedValue(null);
      mockRepository.getCatalogItemById.mockResolvedValue(null);

      const result = await serviceCatalogService.getCatalogItem('non-existent-id', mockUserContext);

      expect(result).toBeNull();
    });

    it('should use cached item when available', async () => {
      mockCache.get.mockResolvedValue(mockCatalogItem);
      mockRepository.getEntitlementRulesForItem.mockResolvedValue([]);
      mockRepository.getEntitlementRulesForCategory.mockResolvedValue([]);

      const result = await serviceCatalogService.getCatalogItem(
        mockCatalogItem.catalogItemId,
        mockUserContext
      );

      expect(result).not.toBeNull();
      expect(mockRepository.getCatalogItemById).not.toHaveBeenCalled();
    });
  });

  describe('getCatalogCategories', () => {
    it('should return all categories', async () => {
      mockCache.get.mockResolvedValue(null);
      mockRepository.getCatalogCategories.mockResolvedValue([mockCategory]);

      const result = await serviceCatalogService.getCatalogCategories();

      expect(result.length).toBe(1);
      expect(result[0]!.categoryId).toBe(mockCategory.categoryId);
    });

    it('should return top-level categories when parentCategoryId is null', async () => {
      mockCache.get.mockResolvedValue(null);
      mockRepository.getCatalogCategories.mockResolvedValue([mockCategory]);

      await serviceCatalogService.getCatalogCategories(null);

      expect(mockRepository.getCatalogCategories).toHaveBeenCalledWith(null);
    });

    it('should return subcategories when parentCategoryId is provided', async () => {
      mockCache.get.mockResolvedValue(null);
      mockRepository.getCatalogCategories.mockResolvedValue([]);

      await serviceCatalogService.getCatalogCategories('parent-cat-001');

      expect(mockRepository.getCatalogCategories).toHaveBeenCalledWith('parent-cat-001');
    });

    it('should use cached categories when available', async () => {
      mockCache.get.mockResolvedValue([mockCategory]);

      const result = await serviceCatalogService.getCatalogCategories();

      expect(result.length).toBe(1);
      expect(mockRepository.getCatalogCategories).not.toHaveBeenCalled();
    });
  });

  describe('checkEntitlement', () => {
    it('should allow access when no rules exist', async () => {
      mockRepository.getEntitlementRulesForItem.mockResolvedValue([]);
      mockRepository.getEntitlementRulesForCategory.mockResolvedValue([]);

      const result = await serviceCatalogService.checkEntitlement(mockCatalogItem as any, mockUserContext);

      expect(result.isEntitled).toBe(true);
      expect(result.action).toBe('ALLOW');
    });

    it('should deny access when DENY rule matches', async () => {
      const denyRule = {
        ruleId: 'rule-001',
        catalogItemId: mockCatalogItem.catalogItemId,
        categoryId: null,
        ruleType: 'ROLE' as const,
        ruleValue: 'EMPLOYEE',
        action: 'DENY' as const,
        priority: 1,
        isActive: true,
        description: 'Employees cannot request this item',
        createdAt: '2024-01-01T00:00:00.000Z',
        updatedAt: '2024-01-15T00:00:00.000Z',
      };

      mockRepository.getEntitlementRulesForItem.mockResolvedValue([denyRule]);
      mockRepository.getEntitlementRulesForCategory.mockResolvedValue([]);

      const result = await serviceCatalogService.checkEntitlement(mockCatalogItem as any, mockUserContext);

      expect(result.isEntitled).toBe(false);
      expect(result.action).toBe('DENY');
      expect(result.reason).toBe('Employees cannot request this item');
    });

    it('should require approval when REQUIRE_APPROVAL rule matches', async () => {
      const approvalRule = {
        ruleId: 'rule-002',
        catalogItemId: mockCatalogItem.catalogItemId,
        categoryId: null,
        ruleType: 'DEPARTMENT' as const,
        ruleValue: 'Information Technology',
        action: 'REQUIRE_APPROVAL' as const,
        priority: 1,
        isActive: true,
        description: 'IT department requires manager approval',
        createdAt: '2024-01-01T00:00:00.000Z',
        updatedAt: '2024-01-15T00:00:00.000Z',
      };

      mockRepository.getEntitlementRulesForItem.mockResolvedValue([approvalRule]);
      mockRepository.getEntitlementRulesForCategory.mockResolvedValue([]);

      const result = await serviceCatalogService.checkEntitlement(mockCatalogItem as any, mockUserContext);

      expect(result.isEntitled).toBe(true);
      expect(result.action).toBe('REQUIRE_APPROVAL');
      expect(result.reason).toBe('IT department requires manager approval');
    });

    it('should allow access when ALLOW rule matches', async () => {
      const allowRule = {
        ruleId: 'rule-003',
        catalogItemId: mockCatalogItem.catalogItemId,
        categoryId: null,
        ruleType: 'ROLE' as const,
        ruleValue: 'IT_STAFF',
        action: 'ALLOW' as const,
        priority: 1,
        isActive: true,
        description: null,
        createdAt: '2024-01-01T00:00:00.000Z',
        updatedAt: '2024-01-15T00:00:00.000Z',
      };

      mockRepository.getEntitlementRulesForItem.mockResolvedValue([allowRule]);
      mockRepository.getEntitlementRulesForCategory.mockResolvedValue([]);

      const result = await serviceCatalogService.checkEntitlement(mockCatalogItem as any, mockUserContext);

      expect(result.isEntitled).toBe(true);
      expect(result.action).toBe('ALLOW');
    });

    it('should evaluate rules in priority order', async () => {
      const denyRule = {
        ruleId: 'rule-001',
        catalogItemId: mockCatalogItem.catalogItemId,
        categoryId: null,
        ruleType: 'ROLE' as const,
        ruleValue: 'EMPLOYEE',
        action: 'DENY' as const,
        priority: 2,
        isActive: true,
        description: 'Employees cannot request',
        createdAt: '2024-01-01T00:00:00.000Z',
        updatedAt: '2024-01-15T00:00:00.000Z',
      };

      const allowRule = {
        ruleId: 'rule-002',
        catalogItemId: mockCatalogItem.catalogItemId,
        categoryId: null,
        ruleType: 'ROLE' as const,
        ruleValue: 'IT_STAFF',
        action: 'ALLOW' as const,
        priority: 1,
        isActive: true,
        description: null,
        createdAt: '2024-01-01T00:00:00.000Z',
        updatedAt: '2024-01-15T00:00:00.000Z',
      };

      mockRepository.getEntitlementRulesForItem.mockResolvedValue([denyRule, allowRule]);
      mockRepository.getEntitlementRulesForCategory.mockResolvedValue([]);

      const result = await serviceCatalogService.checkEntitlement(mockCatalogItem as any, mockUserContext);

      expect(result.isEntitled).toBe(true);
      expect(result.action).toBe('ALLOW');
    });
  });

  describe('validateItemRequest', () => {
    it('should validate a valid request', async () => {
      mockRepository.getCatalogItemById.mockResolvedValue(mockCatalogItem);
      mockRepository.getEntitlementRulesForItem.mockResolvedValue([]);
      mockRepository.getEntitlementRulesForCategory.mockResolvedValue([]);

      const result = await serviceCatalogService.validateItemRequest(
        mockCatalogItem.catalogItemId,
        1,
        mockUserContext
      );

      expect(result.isValid).toBe(true);
      expect(result.errors.length).toBe(0);
      expect(result.requiresApproval).toBe(true);
    });

    it('should return error when item not found', async () => {
      mockRepository.getCatalogItemById.mockResolvedValue(null);

      const result = await serviceCatalogService.validateItemRequest(
        'non-existent-id',
        1,
        mockUserContext
      );

      expect(result.isValid).toBe(false);
      expect(result.errors).toContain('Catalog item not found');
    });

    it('should return error when item is not active', async () => {
      const inactiveItem = { ...mockCatalogItem, status: 'INACTIVE' as const };
      mockRepository.getCatalogItemById.mockResolvedValue(inactiveItem);
      mockRepository.getEntitlementRulesForItem.mockResolvedValue([]);
      mockRepository.getEntitlementRulesForCategory.mockResolvedValue([]);

      const result = await serviceCatalogService.validateItemRequest(
        inactiveItem.catalogItemId,
        1,
        mockUserContext
      );

      expect(result.isValid).toBe(false);
      expect(result.errors.some((e) => e.includes('not available'))).toBe(true);
    });

    it('should return error when item is not requestable', async () => {
      const nonRequestableItem = { ...mockCatalogItem, isRequestable: false };
      mockRepository.getCatalogItemById.mockResolvedValue(nonRequestableItem);
      mockRepository.getEntitlementRulesForItem.mockResolvedValue([]);
      mockRepository.getEntitlementRulesForCategory.mockResolvedValue([]);

      const result = await serviceCatalogService.validateItemRequest(
        nonRequestableItem.catalogItemId,
        1,
        mockUserContext
      );

      expect(result.isValid).toBe(false);
      expect(result.errors).toContain('Item is not requestable');
    });

    it('should return error when quantity exceeds maximum', async () => {
      mockRepository.getCatalogItemById.mockResolvedValue(mockCatalogItem);
      mockRepository.getEntitlementRulesForItem.mockResolvedValue([]);
      mockRepository.getEntitlementRulesForCategory.mockResolvedValue([]);

      const result = await serviceCatalogService.validateItemRequest(
        mockCatalogItem.catalogItemId,
        5,
        mockUserContext
      );

      expect(result.isValid).toBe(false);
      expect(result.errors.some((e) => e.includes('exceeds maximum'))).toBe(true);
    });

    it('should return error when quantity is zero', async () => {
      mockRepository.getCatalogItemById.mockResolvedValue(mockCatalogItem);
      mockRepository.getEntitlementRulesForItem.mockResolvedValue([]);
      mockRepository.getEntitlementRulesForCategory.mockResolvedValue([]);

      const result = await serviceCatalogService.validateItemRequest(
        mockCatalogItem.catalogItemId,
        0,
        mockUserContext
      );

      expect(result.isValid).toBe(false);
      expect(result.errors).toContain('Quantity must be greater than 0');
    });

    it('should return error when user is not entitled', async () => {
      const denyRule = {
        ruleId: 'rule-001',
        catalogItemId: mockCatalogItem.catalogItemId,
        categoryId: null,
        ruleType: 'ROLE' as const,
        ruleValue: 'EMPLOYEE',
        action: 'DENY' as const,
        priority: 1,
        isActive: true,
        description: 'Not allowed for employees',
        createdAt: '2024-01-01T00:00:00.000Z',
        updatedAt: '2024-01-15T00:00:00.000Z',
      };

      mockRepository.getCatalogItemById.mockResolvedValue(mockCatalogItem);
      mockRepository.getEntitlementRulesForItem.mockResolvedValue([denyRule]);
      mockRepository.getEntitlementRulesForCategory.mockResolvedValue([]);

      const result = await serviceCatalogService.validateItemRequest(
        mockCatalogItem.catalogItemId,
        1,
        mockUserContext
      );

      expect(result.isValid).toBe(false);
      expect(result.errors.some((e) => e.includes('Not allowed'))).toBe(true);
    });

    it('should set requiresApproval when price exceeds threshold', async () => {
      const itemWithThreshold = {
        ...mockCatalogItem,
        requiresApproval: false,
        approvalThreshold: 1000,
        unitPrice: 3499,
      };
      mockRepository.getCatalogItemById.mockResolvedValue(itemWithThreshold);
      mockRepository.getEntitlementRulesForItem.mockResolvedValue([]);
      mockRepository.getEntitlementRulesForCategory.mockResolvedValue([]);

      const result = await serviceCatalogService.validateItemRequest(
        itemWithThreshold.catalogItemId,
        1,
        mockUserContext
      );

      expect(result.isValid).toBe(true);
      expect(result.requiresApproval).toBe(true);
    });
  });

  describe('browseCatalog', () => {
    it('should return items and categories', async () => {
      mockCache.get.mockResolvedValue(null);
      mockRepository.getCatalogCategories.mockResolvedValue([mockCategory]);
      mockRepository.getCatalogItems.mockResolvedValue({
        items: [mockCatalogItem],
        total: 1,
        page: 1,
        limit: 50,
        hasMore: false,
      });
      mockRepository.getEntitlementRulesForItem.mockResolvedValue([]);
      mockRepository.getEntitlementRulesForCategory.mockResolvedValue([]);

      const result = await serviceCatalogService.browseCatalog(mockUserContext);

      expect(result.items.length).toBe(1);
      expect(result.categories.length).toBe(1);
      expect(result.total).toBe(1);
    });

    it('should filter by category when categoryId provided', async () => {
      mockCache.get.mockResolvedValue(null);
      mockRepository.getCatalogCategories.mockResolvedValue([]);
      mockRepository.getCatalogItems.mockResolvedValue({
        items: [],
        total: 0,
        page: 1,
        limit: 50,
        hasMore: false,
      });

      await serviceCatalogService.browseCatalog(mockUserContext, 'cat-001');

      expect(mockRepository.getCatalogItems).toHaveBeenCalledWith(
        { categoryId: 'cat-001' },
        expect.any(Object)
      );
    });
  });

  describe('getFeaturedItems', () => {
    it('should return featured items', async () => {
      mockRepository.getCatalogItems.mockResolvedValue({
        items: [mockCatalogItem],
        total: 1,
        page: 1,
        limit: 10,
        hasMore: false,
      });
      mockRepository.getEntitlementRulesForItem.mockResolvedValue([]);
      mockRepository.getEntitlementRulesForCategory.mockResolvedValue([]);

      const result = await serviceCatalogService.getFeaturedItems(mockUserContext);

      expect(result.length).toBe(1);
      expect(result[0]!.isEntitled).toBe(true);
    });

    it('should respect limit parameter', async () => {
      mockRepository.getCatalogItems.mockResolvedValue({
        items: [],
        total: 0,
        page: 1,
        limit: 5,
        hasMore: false,
      });

      await serviceCatalogService.getFeaturedItems(mockUserContext, 5);

      expect(mockRepository.getCatalogItems).toHaveBeenCalledWith(
        expect.any(Object),
        { page: 1, limit: 5 }
      );
    });
  });
});
