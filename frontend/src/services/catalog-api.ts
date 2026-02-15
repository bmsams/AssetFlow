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
  const response = await apiClient.get<CatalogItemsResponse>(
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

  return response.data;
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

  const response = await apiClient.get<CatalogItemsResponse>(
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

  return response.data;
}

export const catalogApi = {
  getItems: getCatalogItems,
  search: searchCatalog,
};

export default catalogApi;
