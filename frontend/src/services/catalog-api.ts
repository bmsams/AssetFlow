/**
 * Catalog API Service
 *
 * Provides methods for interacting with the Lifecycle Service catalog endpoints.
 * Handles catalog item retrieval and search operations.
 *
 * Implements Task 4.2: Create catalog API client
 * Validates: Requirement 3.2
 */

import { apiClient, ApiError } from './api-client';

// ============================================================================
// Types
// ============================================================================

export interface CatalogItem {
  itemId: string;
  name: string;
  description: string;
  category: string;
  price: number;
  availability: string;
  imageUrl?: string;
  specifications?: Record<string, string>;
}

export interface CatalogSearchParams {
  query?: string;
  category?: string;
  page?: number;
  limit?: number;
}

export interface CatalogItemsResponse {
  items: CatalogItem[];
  total: number;
}

/** Backend catalog item shape (from service-catalog-repository) */
interface BackendCatalogItem {
  catalogItemId: string;
  itemCode: string;
  name: string;
  description: string | null;
  shortDescription: string | null;
  itemType: string;
  categoryId: string | null;
  categoryName: string | null;
  manufacturer: string | null;
  model: string | null;
  unitPrice: number | null;
  imageUrl: string | null;
  thumbnailUrl: string | null;
  specifications: Record<string, string> | null;
  features: string[] | null;
  status: string;
  isRequestable: boolean;
  leadTimeDays: number | null;
  quantityAvailable: number | null;
  tags: string[] | null;
  sortOrder: number;
}

/** Map backend item to frontend CatalogItem shape */
function mapBackendItem(item: BackendCatalogItem): CatalogItem & Record<string, unknown> {
  // Map quantityAvailable to availability status
  let availability = 'IN_STOCK';
  const qty = item.quantityAvailable;
  if (qty !== null && qty !== undefined) {
    if (qty <= 0) availability = 'OUT_OF_STOCK';
    else if (qty <= 5) availability = 'LOW_STOCK';
  }

  return {
    itemId: item.catalogItemId,
    name: item.name,
    description: item.description ?? item.shortDescription ?? '',
    category: item.categoryName ?? item.itemType ?? 'ACCESSORIES',
    manufacturer: item.manufacturer ?? '',
    model: item.model ?? '',
    imageUrl: item.imageUrl ?? item.thumbnailUrl ?? undefined,
    price: Number(item.unitPrice) || 0,
    availability,
    stockQuantity: Number(item.quantityAvailable) || 999,
    leadTimeDays: Number(item.leadTimeDays) || 0,
    specifications: item.specifications ?? {},
    tags: item.tags ?? [],
    isPopular: false,
    isFeatured: false,
  };
}

// ============================================================================
// API Functions
// ============================================================================

/**
 * Get catalog items
 */
export async function getCatalogItems(
  params?: CatalogSearchParams
): Promise<CatalogItemsResponse> {
  const queryParts: string[] = [];
  if (params?.category) queryParts.push(`category=${encodeURIComponent(params.category)}`);
  if (params?.page) queryParts.push(`page=${params.page}`);
  if (params?.limit) queryParts.push(`limit=${params.limit}`);

  const queryString = queryParts.length > 0 ? `?${queryParts.join('&')}` : '';
  const response = await apiClient.get<{ items: BackendCatalogItem[]; total: number }>(
    `/lifecycle/catalog/items${queryString}`
  );

  if (!response.success || !response.data) {
    throw new ApiError(
      response.error?.code || 'FETCH_FAILED',
      response.error?.message || 'Failed to fetch catalog items',
      400,
      response.requestId
    );
  }

  return {
    items: (response.data.items ?? []).map(mapBackendItem),
    total: response.data.total ?? 0,
  };
}

/**
 * Search catalog items
 */
export async function searchCatalog(
  query: string,
  params?: Omit<CatalogSearchParams, 'query'>
): Promise<CatalogItemsResponse> {
  const queryParts: string[] = [`query=${encodeURIComponent(query)}`];
  if (params?.category) queryParts.push(`category=${encodeURIComponent(params.category)}`);
  if (params?.page) queryParts.push(`page=${params.page}`);
  if (params?.limit) queryParts.push(`limit=${params.limit}`);

  const response = await apiClient.get<{ items: BackendCatalogItem[]; total: number }>(
    `/lifecycle/catalog/search?${queryParts.join('&')}`
  );

  if (!response.success || !response.data) {
    throw new ApiError(
      response.error?.code || 'SEARCH_FAILED',
      response.error?.message || 'Failed to search catalog',
      400,
      response.requestId
    );
  }

  return {
    items: (response.data.items ?? []).map(mapBackendItem),
    total: response.data.total ?? 0,
  };
}

export const catalogApi = {
  getItems: getCatalogItems,
  search: searchCatalog,
};

export default catalogApi;
