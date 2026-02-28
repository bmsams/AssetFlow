/**
 * Service Catalog Repository - Data access layer for service catalog operations
 *
 * Implements database operations for:
 * - Catalog item retrieval (Requirement 6B.1)
 * - Catalog categories (Requirement 6B.2)
 * - Entitlement rules (Requirement 6B.9)
 */

import type { PaginatedResult, PaginationParams, UUID } from '@ams/types';
import { queryMany, queryOne } from '@ams/database';
import { createLogger } from '@ams/utils';

const logger = createLogger({ service: 'service-catalog-repository' });

/**
 * Catalog item status
 */
export type CatalogItemStatus = 'ACTIVE' | 'INACTIVE' | 'DISCONTINUED' | 'COMING_SOON';

/**
 * Catalog item type
 */
export type CatalogItemType = 'HARDWARE' | 'SOFTWARE' | 'SERVICE' | 'ACCESSORY' | 'BUNDLE';

/**
 * Entitlement rule type
 */
export type EntitlementRuleType = 'ROLE' | 'DEPARTMENT' | 'COST_CENTER' | 'LOCATION' | 'CUSTOM';

/**
 * Entitlement rule action
 */
export type EntitlementRuleAction = 'ALLOW' | 'DENY' | 'REQUIRE_APPROVAL';

/**
 * Catalog item entity
 */
export interface CatalogItem {
  readonly catalogItemId: UUID;
  readonly itemCode: string;
  readonly name: string;
  readonly description: string | null;
  readonly shortDescription: string | null;
  readonly itemType: CatalogItemType;
  readonly categoryId: UUID | null;
  readonly categoryName: string | null;
  readonly subcategoryId: UUID | null;
  readonly subcategoryName: string | null;
  readonly manufacturer: string | null;
  readonly model: string | null;
  readonly sku: string | null;
  readonly unitPrice: number | null;
  readonly currency: string;
  readonly imageUrl: string | null;
  readonly thumbnailUrl: string | null;
  readonly specifications: Record<string, unknown> | null;
  readonly features: string[] | null;
  readonly status: CatalogItemStatus;
  readonly isRequestable: boolean;
  readonly requiresApproval: boolean;
  readonly approvalThreshold: number | null;
  readonly leadTimeDays: number | null;
  readonly maxQuantityPerRequest: number | null;
  readonly vendorId: UUID | null;
  readonly vendorName: string | null;
  readonly stockroomId: UUID | null;
  readonly quantityAvailable: number | null;
  readonly tags: string[] | null;
  readonly sortOrder: number;
  readonly createdAt: string;
  readonly updatedAt: string;
}

/**
 * Catalog category entity
 */
export interface CatalogCategory {
  readonly categoryId: UUID;
  readonly name: string;
  readonly description: string | null;
  readonly parentCategoryId: UUID | null;
  readonly parentCategoryName: string | null;
  readonly iconUrl: string | null;
  readonly sortOrder: number;
  readonly isActive: boolean;
  readonly itemCount: number;
  readonly createdAt: string;
  readonly updatedAt: string;
}

/**
 * Entitlement rule entity
 */
export interface EntitlementRule {
  readonly ruleId: UUID;
  readonly catalogItemId: UUID | null;
  readonly categoryId: UUID | null;
  readonly ruleType: EntitlementRuleType;
  readonly ruleValue: string;
  readonly action: EntitlementRuleAction;
  readonly priority: number;
  readonly isActive: boolean;
  readonly description: string | null;
  readonly createdAt: string;
  readonly updatedAt: string;
}

/**
 * User context for entitlement checking
 */
export interface UserContext {
  readonly userId: UUID;
  readonly roles: string[];
  readonly departmentId: UUID | null;
  readonly departmentName: string | null;
  readonly costCenterId: UUID | null;
  readonly locationId: UUID | null;
}

/**
 * Catalog search filters
 */
export interface CatalogSearchFilters {
  readonly query?: string;
  readonly categoryId?: UUID;
  readonly itemType?: CatalogItemType;
  readonly status?: CatalogItemStatus;
  readonly minPrice?: number;
  readonly maxPrice?: number;
  readonly manufacturer?: string;
  readonly tags?: string[];
  readonly isRequestable?: boolean;
  readonly inStock?: boolean;
}

/**
 * Database row types
 */
interface CatalogItemRow {
  catalog_item_id: string;
  item_code: string;
  name: string;
  description: string | null;
  short_description: string | null;
  item_type: CatalogItemType;
  category_id: string | null;
  category_name: string | null;
  subcategory_id: string | null;
  subcategory_name: string | null;
  manufacturer: string | null;
  model: string | null;
  sku: string | null;
  unit_price: number | null;
  currency: string;
  image_url: string | null;
  thumbnail_url: string | null;
  specifications: string | null;
  features: string[] | null;
  status: CatalogItemStatus;
  is_requestable: boolean;
  requires_approval: boolean;
  approval_threshold: number | null;
  lead_time_days: number | null;
  max_quantity_per_request: number | null;
  vendor_id: string | null;
  vendor_name: string | null;
  stockroom_id: string | null;
  quantity_available: number | null;
  tags: string[] | null;
  sort_order: number;
  created_at: string;
  updated_at: string;
}

interface CatalogCategoryRow {
  category_id: string;
  name: string;
  description: string | null;
  parent_category_id: string | null;
  parent_category_name: string | null;
  icon_url: string | null;
  sort_order: number;
  is_active: boolean;
  item_count: number;
  created_at: string;
  updated_at: string;
}

interface EntitlementRuleRow {
  rule_id: string;
  catalog_item_id: string | null;
  category_id: string | null;
  rule_type: EntitlementRuleType;
  rule_value: string;
  action: EntitlementRuleAction;
  priority: number;
  is_active: boolean;
  description: string | null;
  created_at: string;
  updated_at: string;
}

/**
 * Map database row to CatalogItem entity
 */
function mapRowToCatalogItem(row: CatalogItemRow): CatalogItem {
  return {
    catalogItemId: row.catalog_item_id,
    itemCode: row.item_code,
    name: row.name,
    description: row.description,
    shortDescription: row.short_description,
    itemType: row.item_type,
    categoryId: row.category_id,
    categoryName: row.category_name,
    subcategoryId: row.subcategory_id,
    subcategoryName: row.subcategory_name,
    manufacturer: row.manufacturer,
    model: row.model,
    sku: row.sku,
    unitPrice: row.unit_price,
    currency: row.currency,
    imageUrl: row.image_url,
    thumbnailUrl: row.thumbnail_url,
    specifications: row.specifications
      ? (typeof row.specifications === 'string' ? JSON.parse(row.specifications) : row.specifications)
      : null,
    features: row.features,
    status: row.status,
    isRequestable: row.is_requestable,
    requiresApproval: row.requires_approval,
    approvalThreshold: row.approval_threshold,
    leadTimeDays: row.lead_time_days,
    maxQuantityPerRequest: row.max_quantity_per_request,
    vendorId: row.vendor_id,
    vendorName: row.vendor_name,
    stockroomId: row.stockroom_id,
    quantityAvailable: row.quantity_available,
    tags: row.tags,
    sortOrder: row.sort_order,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

/**
 * Map database row to CatalogCategory entity
 */
function mapRowToCatalogCategory(row: CatalogCategoryRow): CatalogCategory {
  return {
    categoryId: row.category_id,
    name: row.name,
    description: row.description,
    parentCategoryId: row.parent_category_id,
    parentCategoryName: row.parent_category_name,
    iconUrl: row.icon_url,
    sortOrder: row.sort_order,
    isActive: row.is_active,
    itemCount: row.item_count,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

/**
 * Map database row to EntitlementRule entity
 */
function mapRowToEntitlementRule(row: EntitlementRuleRow): EntitlementRule {
  return {
    ruleId: row.rule_id,
    catalogItemId: row.catalog_item_id,
    categoryId: row.category_id,
    ruleType: row.rule_type,
    ruleValue: row.rule_value,
    action: row.action,
    priority: row.priority,
    isActive: row.is_active,
    description: row.description,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

/**
 * Get catalog item by ID
 * Requirement 6B.1: Display available items with descriptions and pricing
 */
export async function getCatalogItemById(catalogItemId: UUID): Promise<CatalogItem | null> {
  const result = await queryOne<CatalogItemRow>(
    `SELECT ci.*, 
            c.name as category_name,
            sc.name as subcategory_name,
            v.vendor_name,
            si.quantity_available
     FROM catalog_items ci
     LEFT JOIN catalog_categories c ON ci.category_id = c.category_id
     LEFT JOIN catalog_categories sc ON ci.subcategory_id = sc.category_id
     LEFT JOIN vendors v ON ci.vendor_id = v.vendor_id
     LEFT JOIN stockroom_inventory si ON ci.stockroom_id = si.stockroom_id AND ci.catalog_item_id = si.product_id
     WHERE ci.catalog_item_id = $1`,
    [catalogItemId]
  );

  return result ? mapRowToCatalogItem(result) : null;
}

/**
 * Get catalog item by item code
 */
export async function getCatalogItemByCode(itemCode: string): Promise<CatalogItem | null> {
  const result = await queryOne<CatalogItemRow>(
    `SELECT ci.*, 
            c.name as category_name,
            sc.name as subcategory_name,
            v.vendor_name,
            si.quantity_available
     FROM catalog_items ci
     LEFT JOIN catalog_categories c ON ci.category_id = c.category_id
     LEFT JOIN catalog_categories sc ON ci.subcategory_id = sc.category_id
     LEFT JOIN vendors v ON ci.vendor_id = v.vendor_id
     LEFT JOIN stockroom_inventory si ON ci.stockroom_id = si.stockroom_id AND ci.catalog_item_id = si.product_id
     WHERE ci.item_code = $1`,
    [itemCode]
  );

  return result ? mapRowToCatalogItem(result) : null;
}

/**
 * Get catalog items with filtering and pagination
 * Requirement 6B.1: Display available items with descriptions and pricing
 * Requirement 6B.2: Support catalog item categories
 */
export async function getCatalogItems(
  filters: CatalogSearchFilters = {},
  pagination: PaginationParams = {}
): Promise<PaginatedResult<CatalogItem>> {
  const { page = 1, limit = 50 } = pagination;
  const offset = (page - 1) * limit;

  const conditions: string[] = [];
  const params: (string | number | boolean | string[])[] = [];
  let paramIndex = 1;

  // Build WHERE conditions based on filters
  if (filters.categoryId) {
    conditions.push(`(ci.category_id = $${paramIndex} OR ci.subcategory_id = $${paramIndex})`);
    params.push(filters.categoryId);
    paramIndex++;
  }

  if (filters.itemType) {
    conditions.push(`ci.item_type = $${paramIndex}`);
    params.push(filters.itemType);
    paramIndex++;
  }

  if (filters.status) {
    conditions.push(`ci.status = $${paramIndex}`);
    params.push(filters.status);
    paramIndex++;
  } else {
    // Default to active items only
    conditions.push(`ci.status = 'ACTIVE'`);
  }

  if (filters.minPrice !== undefined) {
    conditions.push(`ci.unit_price >= $${paramIndex}`);
    params.push(filters.minPrice);
    paramIndex++;
  }

  if (filters.maxPrice !== undefined) {
    conditions.push(`ci.unit_price <= $${paramIndex}`);
    params.push(filters.maxPrice);
    paramIndex++;
  }

  if (filters.manufacturer) {
    conditions.push(`LOWER(ci.manufacturer) = LOWER($${paramIndex})`);
    params.push(filters.manufacturer);
    paramIndex++;
  }

  if (filters.isRequestable !== undefined) {
    conditions.push(`ci.is_requestable = $${paramIndex}`);
    params.push(filters.isRequestable);
    paramIndex++;
  }

  if (filters.inStock) {
    conditions.push(`(si.quantity_available IS NULL OR si.quantity_available > 0)`);
  }

  if (filters.tags && filters.tags.length > 0) {
    conditions.push(`ci.tags && $${paramIndex}`);
    params.push(filters.tags);
    paramIndex++;
  }

  const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';

  // Count total items
  const countResult = await queryOne<{ count: string }>(
    `SELECT COUNT(*) as count 
     FROM catalog_items ci
     LEFT JOIN stockroom_inventory si ON ci.stockroom_id = si.stockroom_id AND ci.catalog_item_id = si.product_id
     ${whereClause}`,
    params
  );
  const total = parseInt(countResult?.count ?? '0', 10);

  // Get paginated items
  const rows = await queryMany<CatalogItemRow>(
    `SELECT ci.*, 
            c.name as category_name,
            sc.name as subcategory_name,
            v.vendor_name,
            si.quantity_available
     FROM catalog_items ci
     LEFT JOIN catalog_categories c ON ci.category_id = c.category_id
     LEFT JOIN catalog_categories sc ON ci.subcategory_id = sc.category_id
     LEFT JOIN vendors v ON ci.vendor_id = v.vendor_id
     LEFT JOIN stockroom_inventory si ON ci.stockroom_id = si.stockroom_id AND ci.catalog_item_id = si.product_id
     ${whereClause}
     ORDER BY ci.sort_order ASC, ci.name ASC
     LIMIT $${paramIndex} OFFSET $${paramIndex + 1}`,
    [...params, limit, offset]
  );

  logger.debug('Catalog items retrieved', {
    total,
    page,
    limit,
    filterCount: Object.keys(filters).length,
  });

  return {
    items: rows.map(mapRowToCatalogItem),
    total,
    page,
    limit,
    hasMore: offset + rows.length < total,
  };
}

/**
 * Search catalog items with text search
 * Requirement 6B.2: Support catalog search functionality
 */
export async function searchCatalogItems(
  query: string,
  filters: CatalogSearchFilters = {},
  pagination: PaginationParams = {}
): Promise<PaginatedResult<CatalogItem>> {
  const { page = 1, limit = 50 } = pagination;
  const offset = (page - 1) * limit;

  const conditions: string[] = [];
  const params: (string | number | boolean | string[])[] = [];
  let paramIndex = 1;

  // Text search condition
  if (query && query.trim().length > 0) {
    const searchTerm = `%${query.trim().toLowerCase()}%`;
    conditions.push(`(
      LOWER(ci.name) LIKE $${paramIndex} OR
      LOWER(ci.description) LIKE $${paramIndex} OR
      LOWER(ci.short_description) LIKE $${paramIndex} OR
      LOWER(ci.manufacturer) LIKE $${paramIndex} OR
      LOWER(ci.model) LIKE $${paramIndex} OR
      LOWER(ci.item_code) LIKE $${paramIndex} OR
      LOWER(ci.sku) LIKE $${paramIndex} OR
      ci.tags::text ILIKE $${paramIndex}
    )`);
    params.push(searchTerm);
    paramIndex++;
  }

  // Apply additional filters
  if (filters.categoryId) {
    conditions.push(`(ci.category_id = $${paramIndex} OR ci.subcategory_id = $${paramIndex})`);
    params.push(filters.categoryId);
    paramIndex++;
  }

  if (filters.itemType) {
    conditions.push(`ci.item_type = $${paramIndex}`);
    params.push(filters.itemType);
    paramIndex++;
  }

  if (filters.status) {
    conditions.push(`ci.status = $${paramIndex}`);
    params.push(filters.status);
    paramIndex++;
  } else {
    conditions.push(`ci.status = 'ACTIVE'`);
  }

  if (filters.minPrice !== undefined) {
    conditions.push(`ci.unit_price >= $${paramIndex}`);
    params.push(filters.minPrice);
    paramIndex++;
  }

  if (filters.maxPrice !== undefined) {
    conditions.push(`ci.unit_price <= $${paramIndex}`);
    params.push(filters.maxPrice);
    paramIndex++;
  }

  if (filters.isRequestable !== undefined) {
    conditions.push(`ci.is_requestable = $${paramIndex}`);
    params.push(filters.isRequestable);
    paramIndex++;
  }

  const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';

  // Count total items
  const countResult = await queryOne<{ count: string }>(
    `SELECT COUNT(*) as count 
     FROM catalog_items ci
     ${whereClause}`,
    params
  );
  const total = parseInt(countResult?.count ?? '0', 10);

  // Get paginated items with relevance scoring
  const rows = await queryMany<CatalogItemRow>(
    `SELECT ci.*, 
            c.name as category_name,
            sc.name as subcategory_name,
            v.vendor_name,
            si.quantity_available
     FROM catalog_items ci
     LEFT JOIN catalog_categories c ON ci.category_id = c.category_id
     LEFT JOIN catalog_categories sc ON ci.subcategory_id = sc.category_id
     LEFT JOIN vendors v ON ci.vendor_id = v.vendor_id
     LEFT JOIN stockroom_inventory si ON ci.stockroom_id = si.stockroom_id AND ci.catalog_item_id = si.product_id
     ${whereClause}
     ORDER BY 
       CASE WHEN LOWER(ci.name) LIKE $1 THEN 0 ELSE 1 END,
       ci.sort_order ASC, 
       ci.name ASC
     LIMIT $${paramIndex} OFFSET $${paramIndex + 1}`,
    [...params, limit, offset]
  );

  logger.debug('Catalog search completed', {
    query,
    total,
    page,
    limit,
  });

  return {
    items: rows.map(mapRowToCatalogItem),
    total,
    page,
    limit,
    hasMore: offset + rows.length < total,
  };
}

/**
 * Get all catalog categories
 * Requirement 6B.2: Support catalog item categories
 */
export async function getCatalogCategories(
  parentCategoryId?: UUID | null
): Promise<CatalogCategory[]> {
  let query: string;
  let params: (string | null)[];

  if (parentCategoryId === undefined) {
    // Get all categories
    query = `
      SELECT c.*, 
             pc.name as parent_category_name,
             COUNT(ci.catalog_item_id) as item_count
      FROM catalog_categories c
      LEFT JOIN catalog_categories pc ON c.parent_category_id = pc.category_id
      LEFT JOIN catalog_items ci ON ci.category_id = c.category_id AND ci.status = 'ACTIVE'
      WHERE c.is_active = true
      GROUP BY c.category_id, pc.name
      ORDER BY c.sort_order ASC, c.name ASC
    `;
    params = [];
  } else if (parentCategoryId === null) {
    // Get top-level categories only
    query = `
      SELECT c.*, 
             NULL as parent_category_name,
             COUNT(ci.catalog_item_id) as item_count
      FROM catalog_categories c
      LEFT JOIN catalog_items ci ON ci.category_id = c.category_id AND ci.status = 'ACTIVE'
      WHERE c.parent_category_id IS NULL AND c.is_active = true
      GROUP BY c.category_id
      ORDER BY c.sort_order ASC, c.name ASC
    `;
    params = [];
  } else {
    // Get subcategories of a specific parent
    query = `
      SELECT c.*, 
             pc.name as parent_category_name,
             COUNT(ci.catalog_item_id) as item_count
      FROM catalog_categories c
      LEFT JOIN catalog_categories pc ON c.parent_category_id = pc.category_id
      LEFT JOIN catalog_items ci ON ci.category_id = c.category_id AND ci.status = 'ACTIVE'
      WHERE c.parent_category_id = $1 AND c.is_active = true
      GROUP BY c.category_id, pc.name
      ORDER BY c.sort_order ASC, c.name ASC
    `;
    params = [parentCategoryId];
  }

  const rows = await queryMany<CatalogCategoryRow>(query, params);
  return rows.map(mapRowToCatalogCategory);
}

/**
 * Get category by ID
 */
export async function getCategoryById(categoryId: UUID): Promise<CatalogCategory | null> {
  const result = await queryOne<CatalogCategoryRow>(
    `SELECT c.*, 
            pc.name as parent_category_name,
            COUNT(ci.catalog_item_id) as item_count
     FROM catalog_categories c
     LEFT JOIN catalog_categories pc ON c.parent_category_id = pc.category_id
     LEFT JOIN catalog_items ci ON ci.category_id = c.category_id AND ci.status = 'ACTIVE'
     WHERE c.category_id = $1
     GROUP BY c.category_id, pc.name`,
    [categoryId]
  );

  return result ? mapRowToCatalogCategory(result) : null;
}

/**
 * Get entitlement rules for a catalog item
 * Requirement 6B.9: Enforce entitlement rules based on role/department
 */
export async function getEntitlementRulesForItem(catalogItemId: UUID): Promise<EntitlementRule[]> {
  const rows = await queryMany<EntitlementRuleRow>(
    `SELECT * FROM catalog_entitlement_rules
     WHERE (catalog_item_id = $1 OR catalog_item_id IS NULL)
     AND is_active = true
     ORDER BY priority ASC`,
    [catalogItemId]
  );

  return rows.map(mapRowToEntitlementRule);
}

/**
 * Get entitlement rules for a category
 * Requirement 6B.9: Enforce entitlement rules based on role/department
 */
export async function getEntitlementRulesForCategory(categoryId: UUID): Promise<EntitlementRule[]> {
  const rows = await queryMany<EntitlementRuleRow>(
    `SELECT * FROM catalog_entitlement_rules
     WHERE (category_id = $1 OR category_id IS NULL)
     AND is_active = true
     ORDER BY priority ASC`,
    [categoryId]
  );

  return rows.map(mapRowToEntitlementRule);
}

/**
 * Get all entitlement rules applicable to a user
 * Requirement 6B.9: Enforce entitlement rules based on role/department
 */
export async function getEntitlementRulesForUser(
  userContext: UserContext
): Promise<EntitlementRule[]> {
  const conditions: string[] = ['is_active = true'];
  const params: string[] = [];
  let paramIndex = 1;

  // Build conditions for user context
  const ruleConditions: string[] = [];

  // Role-based rules
  if (userContext.roles.length > 0) {
    ruleConditions.push(`(rule_type = 'ROLE' AND rule_value = ANY($${paramIndex}))`);
    params.push(userContext.roles as unknown as string);
    paramIndex++;
  }

  // Department-based rules
  if (userContext.departmentId) {
    ruleConditions.push(`(rule_type = 'DEPARTMENT' AND rule_value = $${paramIndex})`);
    params.push(userContext.departmentId);
    paramIndex++;
  }

  if (userContext.departmentName) {
    ruleConditions.push(`(rule_type = 'DEPARTMENT' AND LOWER(rule_value) = LOWER($${paramIndex}))`);
    params.push(userContext.departmentName);
    paramIndex++;
  }

  // Cost center-based rules
  if (userContext.costCenterId) {
    ruleConditions.push(`(rule_type = 'COST_CENTER' AND rule_value = $${paramIndex})`);
    params.push(userContext.costCenterId);
    paramIndex++;
  }

  // Location-based rules
  if (userContext.locationId) {
    ruleConditions.push(`(rule_type = 'LOCATION' AND rule_value = $${paramIndex})`);
    params.push(userContext.locationId);
    paramIndex++;
  }

  if (ruleConditions.length > 0) {
    conditions.push(`(${ruleConditions.join(' OR ')})`);
  }

  const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';

  const rows = await queryMany<EntitlementRuleRow>(
    `SELECT * FROM catalog_entitlement_rules
     ${whereClause}
     ORDER BY priority ASC`,
    params
  );

  return rows.map(mapRowToEntitlementRule);
}

