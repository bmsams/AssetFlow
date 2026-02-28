/**
 * Service Catalog module exports
 *
 * Provides service catalog operations including:
 * - Display available items with descriptions and pricing (Requirement 6B.1)
 * - Support catalog item categories (Requirement 6B.2)
 * - Enforce entitlement rules based on role/department (Requirement 6B.9)
 */

// Export types from repository
export type {
  CatalogItemStatus,
  CatalogItemType,
  EntitlementRuleType,
  EntitlementRuleAction,
  CatalogItem,
  CatalogCategory,
  EntitlementRule,
  UserContext,
  CatalogSearchFilters,
} from './service-catalog-repository';

// Export repository functions (low-level data access)
export {
  getCatalogItemById,
  searchCatalogItems,
  getEntitlementRulesForItem,
  getEntitlementRulesForCategory,
  getEntitlementRulesForUser,
} from './service-catalog-repository';

// Export service functions (business logic) - these wrap repository functions
export {
  checkEntitlement,
  getCatalogItems,
  searchCatalog,
  getCatalogItem,
  getCatalogItemByCode,
  getCatalogCategories,
  getCategoryById,
  browseCatalog,
  getFeaturedItems,
  getItemsByType,
  validateItemRequest,
} from './service-catalog-service';

// Export service types
export type {
  CatalogItemWithEntitlement,
  CatalogBrowseResult,
  CatalogSearchResult,
} from './service-catalog-service';
