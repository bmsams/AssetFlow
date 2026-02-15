/**
 * Asset API Service
 *
 * Provides methods for interacting with the Asset Management API.
 * Handles CRUD operations, state transitions, and search functionality.
 *
 * Validates: Requirements 9.1
 */

import { apiClient, ApiError } from './api-client';
import type {
  Asset,
  AssetStatus,
  AssetType,
  AnyAssetDetail,
  RelatedAsset,
  AuditEntry,
  AuditAction,
  RelationshipType,
} from '../types/asset';

/**
 * Pagination parameters
 */
interface PaginationParams {
  page?: number;
  pageSize?: number;
  sortBy?: string;
  sortOrder?: 'asc' | 'desc';
}

/**
 * Asset filter parameters
 */
interface AssetFilters {
  status?: AssetStatus;
  type?: AssetType;
  departmentId?: string;
  assignedTo?: string;
  search?: string;
}

/**
 * Paginated response
 */
interface PaginatedResponse<T> {
  items: T[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
}

export function mapPaginatedResponse<T>(raw: unknown): PaginatedResponse<T> {
  const data = (raw ?? {}) as {
    items?: unknown;
    total?: unknown;
    page?: unknown;
    limit?: unknown;
    pageSize?: unknown;
  };

  const items = Array.isArray(data.items) ? (data.items as T[]) : [];
  const total = typeof data.total === 'number' && Number.isFinite(data.total) ? data.total : 0;
  const page = typeof data.page === 'number' && Number.isFinite(data.page) ? data.page : 1;

  const rawLimit =
    typeof data.limit === 'number' && Number.isFinite(data.limit)
      ? data.limit
      : typeof data.pageSize === 'number' && Number.isFinite(data.pageSize)
        ? data.pageSize
        : items.length;

  const pageSize = Math.max(1, rawLimit || 1);
  const totalPages = Math.max(1, Math.ceil(total / pageSize));

  return { items, total, page, pageSize, totalPages };
}

/**
 * Create asset request
 */
interface CreateAssetRequest {
  assetType: AssetType;
  displayName: string;
  description?: string;
  status?: AssetStatus;
  departmentId?: string;
  attributes?: Record<string, unknown>;
}

/**
 * Update asset request
 */
interface UpdateAssetRequest {
  displayName?: string;
  description?: string;
  departmentId?: string;
  attributes?: Record<string, unknown>;
}

/**
 * State transition request
 */
interface StateTransitionRequest {
  newState: AssetStatus;
  reason?: string;
}

interface AssetAuditLogRow {
  logId: string;
  userId?: string;
  actionType: string;
  oldValues?: Record<string, unknown>;
  newValues?: Record<string, unknown>;
  timestamp: string;
}

interface RelatedAssetsResponse {
  assetId: string;
  relatedAssets: RelatedAssetRaw[];
  total: number;
}

interface RelatedAssetRaw {
  asset: Asset;
  relationship: {
    relationshipId: string;
    sourceAssetId: string;
    targetAssetId: string;
    relationType: string;
    metadata?: Record<string, unknown>;
    createdAt: string;
    createdBy?: string;
  };
  direction: 'source' | 'target';
}

/**
 * Build query string from parameters.
 * Note: Frontend uses `pageSize` for pagination, but the backend expects `limit`.
 * This function converts `pageSize` to `limit` in the query string.
 */
function buildQueryString(params: Record<string, unknown>): string {
  const searchParams = new URLSearchParams();

  for (const [key, value] of Object.entries(params)) {
    if (value !== undefined && value !== null && value !== '') {
      searchParams.append(key, String(value));
    }
  }

  const queryString = searchParams.toString();
  return queryString ? `?${queryString}` : '';
}

const VALID_RELATIONSHIP_TYPES: RelationshipType[] = [
  'PARENT_CHILD',
  'DEPENDENCY',
  'LOCATION',
  'COMPONENT',
];

function mapRelationshipType(value: string): RelationshipType {
  return VALID_RELATIONSHIP_TYPES.includes(value as RelationshipType)
    ? (value as RelationshipType)
    : 'DEPENDENCY';
}

function mapRelatedAsset(raw: RelatedAssetRaw): RelatedAsset {
  return {
    asset: raw.asset,
    direction: raw.direction,
    relationship: {
      relationshipId: raw.relationship.relationshipId,
      sourceAssetId: raw.relationship.sourceAssetId,
      targetAssetId: raw.relationship.targetAssetId,
      relationshipType: mapRelationshipType(raw.relationship.relationType),
      description: raw.relationship.metadata?.['description'] as string | undefined,
      createdAt: raw.relationship.createdAt,
      createdBy: raw.relationship.createdBy,
    },
  };
}

function mapAction(actionType: string): AuditAction {
  const upper = actionType.toUpperCase();
  if (upper === 'CREATE') return 'CREATE';
  if (upper === 'UPDATE') return 'UPDATE';
  if (upper === 'DELETE') return 'DELETE';
  if (upper === 'STATUS_CHANGE') return 'STATUS_CHANGE';
  if (upper === 'ASSIGNMENT') return 'ASSIGNMENT';
  if (upper === 'RELATIONSHIP') return 'RELATIONSHIP';
  return 'UPDATE';
}

function buildAuditDescription(row: AssetAuditLogRow): string {
  const action = mapAction(row.actionType);
  if (action === 'STATUS_CHANGE') {
    const from = row.oldValues?.['status'];
    const to = row.newValues?.['status'];
    if (from && to) {
      return `Status changed from ${String(from)} to ${String(to)}`;
    }
    return 'Status changed';
  }
  if (action === 'CREATE') return 'Asset created';
  if (action === 'DELETE') return 'Asset deleted';
  if (action === 'RELATIONSHIP') return 'Asset relationship updated';
  if (action === 'ASSIGNMENT') return 'Asset assignment updated';
  return 'Asset updated';
}

function mapAuditEntry(row: AssetAuditLogRow): AuditEntry {
  const oldStatus = row.oldValues?.['status'];
  const newStatus = row.newValues?.['status'];
  return {
    auditId: row.logId,
    assetId: '',
    action: mapAction(row.actionType),
    timestamp: row.timestamp,
    userId: row.userId ?? 'system',
    userName: row.userId ?? 'System',
    fieldName: oldStatus !== undefined || newStatus !== undefined ? 'status' : undefined,
    previousValue: oldStatus !== undefined ? String(oldStatus) : undefined,
    newValue: newStatus !== undefined ? String(newStatus) : undefined,
    description: buildAuditDescription(row),
  };
}

/**
 * Create a new asset
 */
export async function createAsset(data: CreateAssetRequest): Promise<Asset> {
  const response = await apiClient.post<Asset>('/assets', data);

  if (!response.success || !response.data) {
    throw new ApiError(
      response.error?.code || 'CREATE_FAILED',
      response.error?.message || 'Failed to create asset',
      400,
      response.requestId
    );
  }

  return response.data;
}

/**
 * Get an asset by ID
 */
export async function getAsset(assetId: string): Promise<Asset> {
  const response = await apiClient.get<Asset>(`/assets/${assetId}`);

  if (!response.success || !response.data) {
    throw new ApiError(
      response.error?.code || 'NOT_FOUND',
      response.error?.message || 'Asset not found',
      404,
      response.requestId
    );
  }

  return response.data;
}

export async function getRelatedAssets(assetId: string): Promise<RelatedAsset[]> {
  const response = await apiClient.get<RelatedAssetsResponse>(
    `/assets/${assetId}/relationships`
  );

  if (!response.success) {
    throw new ApiError(
      response.error?.code || 'RELATED_ASSETS_FAILED',
      response.error?.message || 'Failed to load related assets',
      400,
      response.requestId
    );
  }

  const payload = response.data;
  if (!payload) {
    return [];
  }

  const rawList = Array.isArray((payload as unknown as { relatedAssets?: unknown[] }).relatedAssets)
    ? ((payload as unknown as { relatedAssets: RelatedAssetRaw[] }).relatedAssets)
    : [];

  return rawList.map(mapRelatedAsset);
}

/**
 * List assets with pagination and filtering
 */
export async function listAssets(
  filters?: AssetFilters,
  pagination?: PaginationParams
): Promise<PaginatedResponse<Asset>> {
  const queryParams = {
    query: filters?.search,
    assetType: filters?.type,
    status: filters?.status,
    assignedTo: filters?.assignedTo,
    stockroomId: (filters as { stockroomId?: string } | undefined)?.stockroomId,
    page: pagination?.page ?? 1,
    limit: pagination?.pageSize ?? 20,
    sortBy: pagination?.sortBy,
    order: pagination?.sortOrder,
  };

  const queryString = buildQueryString(queryParams);
  const response = await apiClient.get<PaginatedResponse<Asset>>(`/assets${queryString}`);

  if (!response.success || !response.data) {
    throw new ApiError(
      response.error?.code || 'LIST_FAILED',
      response.error?.message || 'Failed to list assets',
      400,
      response.requestId
    );
  }

  return mapPaginatedResponse<Asset>(response.data);
}

/**
 * Update an asset
 */
export async function updateAsset(
  assetId: string,
  data: UpdateAssetRequest
): Promise<Asset> {
  const response = await apiClient.put<Asset>(`/assets/${assetId}`, data);

  if (!response.success || !response.data) {
    throw new ApiError(
      response.error?.code || 'UPDATE_FAILED',
      response.error?.message || 'Failed to update asset',
      400,
      response.requestId
    );
  }

  return response.data;
}

/**
 * Delete an asset
 */
export async function deleteAsset(assetId: string): Promise<void> {
  const response = await apiClient.delete(`/assets/${assetId}`);

  if (!response.success) {
    throw new ApiError(
      response.error?.code || 'DELETE_FAILED',
      response.error?.message || 'Failed to delete asset',
      400,
      response.requestId
    );
  }
}

/**
 * Transition asset state
 */
export async function transitionAssetState(
  assetId: string,
  data: StateTransitionRequest
): Promise<Asset> {
  const response = await apiClient.post<Asset>(
    `/assets/${assetId}/transition`,
    data
  );

  if (!response.success || !response.data) {
    throw new ApiError(
      response.error?.code || 'TRANSITION_FAILED',
      response.error?.message || 'Failed to transition asset state',
      400,
      response.requestId
    );
  }

  return response.data;
}

/**
 * Search assets
 */
export async function searchAssets(
  query: string,
  filters?: AssetFilters,
  pagination?: PaginationParams
): Promise<PaginatedResponse<Asset>> {
  const queryParams = {
    query,
    assetType: filters?.type,
    status: filters?.status,
    assignedTo: filters?.assignedTo,
    stockroomId: (filters as { stockroomId?: string } | undefined)?.stockroomId,
    page: pagination?.page ?? 1,
    limit: pagination?.pageSize ?? 20,
    sortBy: pagination?.sortBy,
    order: pagination?.sortOrder,
  };

  const queryString = buildQueryString(queryParams);
  const response = await apiClient.get<PaginatedResponse<Asset>>(`/assets/search${queryString}`);

  if (!response.success || !response.data) {
    throw new ApiError(
      response.error?.code || 'SEARCH_FAILED',
      response.error?.message || 'Failed to search assets',
      400,
      response.requestId
    );
  }

  return mapPaginatedResponse<Asset>(response.data);
}

/**
 * Get asset history/audit log
 */
export async function getAssetHistory(
  assetId: string,
  pagination?: PaginationParams
): Promise<PaginatedResponse<AuditEntry>> {
  const queryParams = {
    page: pagination?.page ?? 1,
    limit: pagination?.pageSize ?? 20,
  };

  const queryString = buildQueryString(queryParams);
  const response = await apiClient.get<PaginatedResponse<AssetAuditLogRow>>(
    `/assets/${assetId}/audit${queryString}`
  );

  if (!response.success || !response.data) {
    throw new ApiError(
      response.error?.code || 'HISTORY_FAILED',
      response.error?.message || 'Failed to get asset history',
      400,
      response.requestId
    );
  }

  const mapped = mapPaginatedResponse<AssetAuditLogRow>(response.data);
  return {
    ...mapped,
    items: (mapped.items ?? []).map(mapAuditEntry).map((entry) => ({ ...entry, assetId })),
  };
}

export async function getAssetDetail(assetId: string): Promise<AnyAssetDetail> {
  const asset = await getAsset(assetId);

  const [relatedResult, historyResult] = await Promise.allSettled([
    getRelatedAssets(assetId),
    getAssetHistory(assetId, { page: 1, pageSize: 50 }),
  ]);

  const relationships =
    relatedResult.status === 'fulfilled' ? relatedResult.value : [];
  const auditHistory =
    historyResult.status === 'fulfilled' ? historyResult.value.items : [];

  return {
    ...asset,
    relationships,
    auditHistory,
    attachments: [],
  } as AnyAssetDetail;
}

/**
 * Asset API object for convenience
 */
export const assetApi = {
  create: createAsset,
  get: getAsset,
  getDetail: getAssetDetail,
  list: listAssets,
  update: updateAsset,
  delete: deleteAsset,
  transitionState: transitionAssetState,
  getRelatedAssets,
  search: searchAssets,
  getHistory: getAssetHistory,
};

export default assetApi;
