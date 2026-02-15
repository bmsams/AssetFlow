/**
 * Stockroom API Service
 *
 * Provides methods for interacting with the HAM Service stockroom endpoints.
 * Handles stockroom inventory retrieval and updates.
 *
 * Implements Task 15.1: Create stockroom API client
 * Validates: Requirements 13.1, 13.2
 * Depends on: Task 1 (HAM routes) being complete
 */

import { apiClient, ApiError } from './api-client';

// ============================================================================
// Types
// ============================================================================

export interface InventoryItem {
  itemId: string;
  stockroomId: string;
  productId: string;
  productName: string;
  quantity: number;
  minQuantity?: number;
  maxQuantity?: number;
  binLocation?: string;
  lastUpdated: string;
}

export interface InventoryResponse {
  items: InventoryItem[];
  total: number;
  stockroomId: string;
}

export interface UpdateInventoryRequest {
  productId: string;
  quantity: number;
  binLocation?: string;
  notes?: string;
}

export interface PaginationParams {
  page?: number;
  limit?: number;
}

// ============================================================================
// API Functions
// ============================================================================

/**
 * Get stockroom inventory
 */
export async function getStockroomInventory(
  stockroomId: string,
  params?: PaginationParams
): Promise<InventoryResponse> {
  const queryParts: string[] = [];
  if (params?.page) queryParts.push(`page=${params.page}`);
  if (params?.limit) queryParts.push(`limit=${params.limit}`);

  const queryString = queryParts.length > 0 ? `?${queryParts.join('&')}` : '';
  const response = await apiClient.get<InventoryResponse>(
    `/ham/stockrooms/${stockroomId}/inventory${queryString}`
  );

  if (!response.success || !response.data) {
    throw new ApiError(
      response.error?.code || 'FETCH_FAILED',
      response.error?.message || 'Failed to fetch stockroom inventory',
      400,
      response.requestId
    );
  }

  return response.data;
}

/**
 * Update stockroom inventory
 */
export async function updateInventory(
  stockroomId: string,
  data: UpdateInventoryRequest
): Promise<void> {
  const response = await apiClient.put(
    `/ham/stockrooms/${stockroomId}/inventory`,
    data
  );

  if (!response.success) {
    throw new ApiError(
      response.error?.code || 'UPDATE_FAILED',
      response.error?.message || 'Failed to update inventory',
      400,
      response.requestId
    );
  }
}

export const stockroomApi = {
  getInventory: getStockroomInventory,
  updateInventory,
};

export default stockroomApi;
