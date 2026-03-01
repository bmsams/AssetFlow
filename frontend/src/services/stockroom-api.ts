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
  inventoryId: string;
  stockroomId: string;
  productId?: string;
  productType?: string;
  productSku?: string;
  productDescription?: string;
  quantityOnHand: number;
  quantityAvailable: number;
  reorderPoint?: number;
  reorderQuantity?: number;
  binLocation?: string;
  updatedAt?: string;
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
  const response = await apiClient.get<{
    items?: unknown[];
    total?: number;
    stockroomId?: string;
  }>(
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

  const raw = response.data;
  const rawItems = Array.isArray(raw.items) ? raw.items : [];
  const items: InventoryItem[] = rawItems.map((entry) => {
    const item = entry as Record<string, unknown>;
    const quantityOnHand =
      typeof item['quantityOnHand'] === 'number'
        ? item['quantityOnHand']
        : typeof item['quantity'] === 'number'
          ? item['quantity']
          : 0;
    const quantityAvailable =
      typeof item['quantityAvailable'] === 'number'
        ? item['quantityAvailable']
        : quantityOnHand;

    return {
      inventoryId: String(item['inventoryId'] ?? item['itemId'] ?? ''),
      stockroomId: String(item['stockroomId'] ?? stockroomId),
      productId: typeof item['productId'] === 'string' ? item['productId'] : undefined,
      productType: typeof item['productType'] === 'string' ? item['productType'] : undefined,
      productSku: typeof item['productSku'] === 'string' ? item['productSku'] : undefined,
      productDescription:
        (typeof item['productDescription'] === 'string' ? item['productDescription'] : undefined) ??
        (typeof item['productName'] === 'string' ? item['productName'] : undefined),
      quantityOnHand,
      quantityAvailable,
      reorderPoint: typeof item['reorderPoint'] === 'number' ? item['reorderPoint'] : undefined,
      reorderQuantity: typeof item['reorderQuantity'] === 'number' ? item['reorderQuantity'] : undefined,
      binLocation: typeof item['binLocation'] === 'string' ? item['binLocation'] : undefined,
      updatedAt:
        (typeof item['updatedAt'] === 'string' ? item['updatedAt'] : undefined) ??
        (typeof item['lastUpdated'] === 'string' ? item['lastUpdated'] : undefined),
    };
  });

  return {
    items,
    total: typeof raw.total === 'number' ? raw.total : items.length,
    stockroomId: typeof raw.stockroomId === 'string' ? raw.stockroomId : stockroomId,
  };
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
