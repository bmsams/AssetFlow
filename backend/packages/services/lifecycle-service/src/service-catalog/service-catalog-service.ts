/**
 * Service Catalog Service - Business logic layer for service catalog operations
 *
 * Implements:
 * - Display available items with descriptions and pricing (Requirement 6B.1)
 * - Support catalog item categories (Requirement 6B.2)
 * - Enforce entitlement rules based on role/department (Requirement 6B.9)
 */

import type { PaginatedResult, PaginationParams, UUID } from '@ams/types';
import * as cache from '@ams/cache';
import { createLogger } from '@ams/utils';

import type {
  CatalogCategory,
  CatalogItem,
  CatalogItemStatus,
  CatalogItemType,
  CatalogSearchFilters,
  EntitlementRule,
  EntitlementRuleAction,
  UserContext,
} from './service-catalog-repository';
import * as repository from './service-catalog-repository';

const logger = createLogger({ service: 'service-catalog-service' });

/**
 * Cache TTL constants (in seconds)
 */
const CACHE_TTL = {
  CATALOG_ITEM: 300, // 5 minutes
  CATEGORIES: 600, // 10 minutes
  ENTITLEMENT_RULES: 300, // 5 minutes
};

/**
 * Catalog item with entitlement information
 */
export interface CatalogItemWithEntitlement extends CatalogItem {
  readonly isEntitled: boolean;
  readonly entitlementAction: EntitlementRuleAction | null;
  readonly entitlementReason: string | null;
}

/**
 * Catalog browse result
 */
export interface CatalogBrowseResult {
  readonly items: readonly CatalogItemWithEntitlement[];
  readonly categories: readonly CatalogCategory[];
  readonly total: number;
  readonly page: number;
  readonly limit: number;
  readonly hasMore: boolean;
}

/**
 * Catalog search result
 */
export interface CatalogSearchResult {
  readonly items: CatalogItemWithEntitlement[];
  readonly total: number;
  readonly page: number;
  readonly limit: number;
  readonly hasMore: boolean;
  readonly query: string;
  readonly suggestions: string[];
}

/**
 * Cache key generators
 */
function catalogItemCacheKey(catalogItemId: UUID): string {
  return `catalog:item:${catalogItemId}`;
}

function categoriesCacheKey(parentId?: UUID | null): string {
  return `catalog:categories:${parentId ?? 'all'}`;
}

/**
 * Check if a user is entitled to request a catalog item
 * Requirement 6B.9: Enforce entitlement rules based on role/department
 */
export async function checkEntitlement(
  catalogItem: CatalogItem,
  userContext: UserContext
): Promise<{
  isEntitled: boolean;
  action: EntitlementRuleAction | null;
  reason: string | null;
}> {
  // Get entitlement rules for the item
  const itemRules = await repository.getEntitlementRulesForItem(catalogItem.catalogItemId);
  
  // Get entitlement rules for the category if applicable
  let categoryRules: EntitlementRule[] = [];
  if (catalogItem.categoryId) {
    categoryRules = await repository.getEntitlementRulesForCategory(catalogItem.categoryId);
  }

  // Combine and sort rules by priority
  const allRules = [...itemRules, ...categoryRules].sort((a, b) => a.priority - b.priority);

  // If no rules exist, item is entitled by default
  if (allRules.length === 0) {
    return { isEntitled: true, action: 'ALLOW', reason: null };
  }

  // Evaluate rules in priority order
  for (const rule of allRules) {
    const matches = evaluateRule(rule, userContext);
    
    if (matches) {
      switch (rule.action) {
        case 'DENY':
          return {
            isEntitled: false,
            action: 'DENY',
            reason: rule.description ?? `Access denied by ${rule.ruleType.toLowerCase()} rule`,
          };
        case 'ALLOW':
          return {
            isEntitled: true,
            action: 'ALLOW',
            reason: null,
          };
        case 'REQUIRE_APPROVAL':
          return {
            isEntitled: true,
            action: 'REQUIRE_APPROVAL',
            reason: rule.description ?? `Requires approval based on ${rule.ruleType.toLowerCase()} rule`,
          };
      }
    }
  }

  // Default: allow if no matching rules
  return { isEntitled: true, action: 'ALLOW', reason: null };
}

/**
 * Evaluate if a rule matches the user context
 */
function evaluateRule(rule: EntitlementRule, userContext: UserContext): boolean {
  switch (rule.ruleType) {
    case 'ROLE':
      return userContext.roles.some(
        (role) => role.toLowerCase() === rule.ruleValue.toLowerCase()
      );
    
    case 'DEPARTMENT':
      if (userContext.departmentId === rule.ruleValue) {
        return true;
      }
      if (userContext.departmentName?.toLowerCase() === rule.ruleValue.toLowerCase()) {
        return true;
      }
      return false;
    
    case 'COST_CENTER':
      return userContext.costCenterId === rule.ruleValue;
    
    case 'LOCATION':
      return userContext.locationId === rule.ruleValue;
    
    case 'CUSTOM':
      // Custom rules would need additional logic based on rule_value format
      // For now, return false (no match)
      return false;
    
    default:
      return false;
  }
}

/**
 * Enrich catalog item with entitlement information
 */
async function enrichWithEntitlement(
  item: CatalogItem,
  userContext: UserContext
): Promise<CatalogItemWithEntitlement> {
  const entitlement = await checkEntitlement(item, userContext);
  
  return {
    ...item,
    isEntitled: entitlement.isEntitled,
    entitlementAction: entitlement.action,
    entitlementReason: entitlement.reason,
  };
}

/**
 * Get catalog items with entitlement checking
 * Requirement 6B.1: Display available items with descriptions and pricing
 * Requirement 6B.9: Enforce entitlement rules based on role/department
 */
export async function getCatalogItems(
  userContext: UserContext,
  filters: CatalogSearchFilters = {},
  pagination: PaginationParams = {}
): Promise<PaginatedResult<CatalogItemWithEntitlement>> {
  logger.info('Getting catalog items', {
    userId: userContext.userId,
    filters: Object.keys(filters),
    page: pagination.page,
    limit: pagination.limit,
  });

  // Get items from repository
  const result = await repository.getCatalogItems(filters, pagination);

  // Enrich items with entitlement information
  const enrichedItems = await Promise.all(
    result.items.map((item) => enrichWithEntitlement(item, userContext))
  );

  return {
    items: enrichedItems,
    total: result.total,
    page: result.page,
    limit: result.limit,
    hasMore: result.hasMore,
  };
}

/**
 * Search catalog items with entitlement checking
 * Requirement 6B.2: Support catalog search functionality
 * Requirement 6B.9: Enforce entitlement rules based on role/department
 */
export async function searchCatalog(
  query: string,
  userContext: UserContext,
  filters: CatalogSearchFilters = {},
  pagination: PaginationParams = {}
): Promise<CatalogSearchResult> {
  logger.info('Searching catalog', {
    query,
    userId: userContext.userId,
    filters: Object.keys(filters),
    page: pagination.page,
    limit: pagination.limit,
  });

  // Validate query
  const trimmedQuery = query?.trim() ?? '';
  if (trimmedQuery.length === 0) {
    // Return empty result for empty query
    return {
      items: [],
      total: 0,
      page: pagination.page ?? 1,
      limit: pagination.limit ?? 50,
      hasMore: false,
      query: '',
      suggestions: [],
    };
  }

  // Search items from repository
  const result = await repository.searchCatalogItems(trimmedQuery, filters, pagination);

  // Enrich items with entitlement information
  const enrichedItems = await Promise.all(
    result.items.map((item) => enrichWithEntitlement(item, userContext))
  );

  // Generate search suggestions (simplified - in production would use more sophisticated logic)
  const suggestions = generateSearchSuggestions(trimmedQuery, enrichedItems);

  return {
    items: enrichedItems,
    total: result.total,
    page: result.page,
    limit: result.limit,
    hasMore: result.hasMore,
    query: trimmedQuery,
    suggestions,
  };
}

/**
 * Generate search suggestions based on results
 */
function generateSearchSuggestions(
  query: string,
  items: CatalogItemWithEntitlement[]
): string[] {
  const suggestions: Set<string> = new Set();
  const queryLower = query.toLowerCase();

  for (const item of items) {
    // Add manufacturer suggestions
    if (item.manufacturer && item.manufacturer.toLowerCase().includes(queryLower)) {
      suggestions.add(item.manufacturer);
    }

    // Add category suggestions
    if (item.categoryName && item.categoryName.toLowerCase().includes(queryLower)) {
      suggestions.add(item.categoryName);
    }

    // Add tag suggestions
    if (item.tags) {
      for (const tag of item.tags) {
        if (tag.toLowerCase().includes(queryLower)) {
          suggestions.add(tag);
        }
      }
    }

    // Limit suggestions
    if (suggestions.size >= 5) {
      break;
    }
  }

  return Array.from(suggestions).slice(0, 5);
}

/**
 * Get catalog item by ID with entitlement checking
 * Requirement 6B.1: Display available items with descriptions and pricing
 */
export async function getCatalogItem(
  catalogItemId: UUID,
  userContext: UserContext
): Promise<CatalogItemWithEntitlement | null> {
  logger.info('Getting catalog item', {
    catalogItemId,
    userId: userContext.userId,
  });

  // Try cache first
  const cacheKey = catalogItemCacheKey(catalogItemId);
  const cached = await cache.get<CatalogItem>(cacheKey);
  
  let item: CatalogItem | null;
  if (cached) {
    item = cached;
  } else {
    item = await repository.getCatalogItemById(catalogItemId);
    if (item) {
      await cache.set(cacheKey, item, CACHE_TTL.CATALOG_ITEM);
    }
  }

  if (!item) {
    return null;
  }

  // Enrich with entitlement information
  return enrichWithEntitlement(item, userContext);
}

/**
 * Get catalog item by item code with entitlement checking
 */
export async function getCatalogItemByCode(
  itemCode: string,
  userContext: UserContext
): Promise<CatalogItemWithEntitlement | null> {
  logger.info('Getting catalog item by code', {
    itemCode,
    userId: userContext.userId,
  });

  const item = await repository.getCatalogItemByCode(itemCode);
  if (!item) {
    return null;
  }

  // Enrich with entitlement information
  return enrichWithEntitlement(item, userContext);
}

/**
 * Get catalog categories
 * Requirement 6B.2: Support catalog item categories
 */
export async function getCatalogCategories(
  parentCategoryId?: UUID | null
): Promise<CatalogCategory[]> {
  logger.info('Getting catalog categories', { parentCategoryId });

  // Try cache first
  const cacheKey = categoriesCacheKey(parentCategoryId);
  const cached = await cache.get<CatalogCategory[]>(cacheKey);
  
  if (cached) {
    return cached;
  }

  const categories = await repository.getCatalogCategories(parentCategoryId);
  await cache.set(cacheKey, categories, CACHE_TTL.CATEGORIES);

  return categories;
}

/**
 * Get category by ID
 */
export async function getCategoryById(categoryId: UUID): Promise<CatalogCategory | null> {
  return repository.getCategoryById(categoryId);
}

/**
 * Browse catalog with categories and items
 * Requirement 6B.1: Display available items with descriptions and pricing
 * Requirement 6B.2: Support catalog item categories
 */
export async function browseCatalog(
  userContext: UserContext,
  categoryId?: UUID,
  pagination: PaginationParams = {}
): Promise<CatalogBrowseResult> {
  logger.info('Browsing catalog', {
    userId: userContext.userId,
    categoryId,
    page: pagination.page,
    limit: pagination.limit,
  });

  // Get categories (subcategories if categoryId provided, top-level otherwise)
  const categories = await getCatalogCategories(categoryId ?? null);

  // Get items for the category (or all items if no category)
  const filters: CatalogSearchFilters = categoryId ? { categoryId } : {};
  const itemsResult = await getCatalogItems(userContext, filters, pagination);

  return {
    items: itemsResult.items,
    categories,
    total: itemsResult.total,
    page: itemsResult.page,
    limit: itemsResult.limit,
    hasMore: itemsResult.hasMore,
  };
}

/**
 * Get featured/popular catalog items
 */
export async function getFeaturedItems(
  userContext: UserContext,
  limit: number = 10
): Promise<CatalogItemWithEntitlement[]> {
  logger.info('Getting featured items', {
    userId: userContext.userId,
    limit,
  });

  // Get active, requestable items sorted by sort_order
  const result = await repository.getCatalogItems(
    { status: 'ACTIVE' as CatalogItemStatus, isRequestable: true },
    { page: 1, limit }
  );

  // Enrich with entitlement information
  return Promise.all(
    result.items.map((item) => enrichWithEntitlement(item, userContext))
  );
}

/**
 * Get items by type
 */
export async function getItemsByType(
  itemType: CatalogItemType,
  userContext: UserContext,
  pagination: PaginationParams = {}
): Promise<PaginatedResult<CatalogItemWithEntitlement>> {
  return getCatalogItems(userContext, { itemType }, pagination);
}

/**
 * Validate if user can request a specific item
 * Requirement 6B.9: Enforce entitlement rules based on role/department
 */
export async function validateItemRequest(
  catalogItemId: UUID,
  quantity: number,
  userContext: UserContext
): Promise<{
  isValid: boolean;
  errors: string[];
  requiresApproval: boolean;
}> {
  const errors: string[] = [];
  let requiresApproval = false;

  // Get the catalog item
  const item = await repository.getCatalogItemById(catalogItemId);
  if (!item) {
    return {
      isValid: false,
      errors: ['Catalog item not found'],
      requiresApproval: false,
    };
  }

  // Check if item is active and requestable
  if (item.status !== 'ACTIVE') {
    errors.push(`Item is not available (status: ${item.status})`);
  }

  if (!item.isRequestable) {
    errors.push('Item is not requestable');
  }

  // Check quantity limits
  if (quantity <= 0) {
    errors.push('Quantity must be greater than 0');
  }

  if (item.maxQuantityPerRequest && quantity > item.maxQuantityPerRequest) {
    errors.push(`Quantity exceeds maximum allowed (${item.maxQuantityPerRequest})`);
  }

  // Check entitlement
  const entitlement = await checkEntitlement(item, userContext);
  if (!entitlement.isEntitled) {
    errors.push(entitlement.reason ?? 'You are not entitled to request this item');
  }

  if (entitlement.action === 'REQUIRE_APPROVAL') {
    requiresApproval = true;
  }

  // Check if item requires approval based on price threshold
  if (item.requiresApproval) {
    requiresApproval = true;
  }

  if (item.approvalThreshold && item.unitPrice) {
    const totalPrice = item.unitPrice * quantity;
    if (totalPrice >= item.approvalThreshold) {
      requiresApproval = true;
    }
  }

  return {
    isValid: errors.length === 0,
    errors,
    requiresApproval,
  };
}

// Re-export types
export type {
  CatalogCategory,
  CatalogItem,
  CatalogItemStatus,
  CatalogItemType,
  CatalogSearchFilters,
  EntitlementRule,
  EntitlementRuleAction,
  EntitlementRuleType,
  UserContext,
} from './service-catalog-repository';

