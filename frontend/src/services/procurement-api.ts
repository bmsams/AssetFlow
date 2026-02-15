/**
 * Procurement API Service
 *
 * Provides methods for interacting with the Procurement Management API.
 * Handles CRUD operations for purchase orders and approval workflows.
 *
 * Implements Task 17: Frontend - Procurement Pages
 */

import { apiClient, ApiError } from './api-client';
import type {
  PurchaseOrder,
  PurchaseOrderStatus,
} from '../types/procurement';

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
 * Paginated response
 */
interface PaginatedResponse<T> {
  items: T[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
}

interface RawPaginatedResponse<T> {
  items?: T[];
  total?: number;
  page?: number;
  pageSize?: number;
  totalPages?: number;
  limit?: number;
  hasMore?: boolean;
}

/**
 * Purchase order list filters
 */
export interface POListFilters {
  status?: PurchaseOrderStatus;
  vendorId?: string;
  costCenterId?: string;
  requestedBy?: string;
  fromDate?: string;
  toDate?: string;
  search?: string;
}

/**
 * Extended Purchase Order with line items for detail view
 */
export interface PurchaseOrderDetail extends PurchaseOrder {
  costCenterId: string;
  costCenterCode: string;
  requestedById: string;
  approvedById?: string;
  sentDate?: string;
  subtotal: number;
  taxAmount: number;
  shippingAmount: number;
  notes?: string;
  lines: POLine[];
  statusHistory: POStatusHistory[];
}

/**
 * Purchase order line item
 */
export interface POLine {
  lineId: string;
  poId: string;
  lineNumber: number;
  productType: 'HARDWARE_MODEL' | 'SOFTWARE_PRODUCT' | 'SERVICE' | 'OTHER';
  productId?: string;
  productDescription: string;
  sku?: string;
  quantity: number;
  unitPrice: number;
  lineTotal: number;
  quantityReceived: number;
  notes?: string;
}

/**
 * Purchase order status history entry
 */
export interface POStatusHistory {
  historyId: string;
  poId: string;
  status: PurchaseOrderStatus;
  changedBy: string;
  changedByName: string;
  changedAt: string;
  notes?: string;
}

/**
 * Create purchase order request
 */
export interface CreatePurchaseOrderRequest {
  vendorId: string;
  costCenterId: string;
  expectedDeliveryDate?: string;
  notes?: string;
  lines: CreatePOLineRequest[];
}

/**
 * Create PO line request
 */
export interface CreatePOLineRequest {
  productType: 'HARDWARE_MODEL' | 'SOFTWARE_PRODUCT' | 'SERVICE' | 'OTHER';
  productId?: string;
  productDescription: string;
  sku?: string;
  quantity: number;
  unitPrice: number;
  notes?: string;
}

/**
 * Update PO line request
 */
export interface UpdatePOLineRequest {
  quantity?: number;
  unitPrice?: number;
  notes?: string;
}

/**
 * Vendor summary for dropdown
 */
export interface VendorSummary {
  vendorId: string;
  vendorName: string;
  vendorCode?: string;
}

/**
 * Cost center summary for dropdown
 */
export interface CostCenterSummary {
  costCenterId: string;
  code: string;
  name: string;
  availableAmount: number;
}

const DEFAULT_PO_STATUS: PurchaseOrderStatus = 'DRAFT';
const VALID_PO_STATUSES: PurchaseOrderStatus[] = [
  'DRAFT',
  'PENDING_APPROVAL',
  'APPROVED',
  'REJECTED',
  'SENT',
  'PARTIALLY_RECEIVED',
  'RECEIVED',
  'CLOSED',
  'CANCELLED',
];

function toStringValue(value: unknown, fallback = ''): string {
  return typeof value === 'string' ? value : fallback;
}

function toNumberValue(value: unknown, fallback = 0): number {
  return typeof value === 'number' && Number.isFinite(value) ? value : fallback;
}

function toPOStatus(value: unknown): PurchaseOrderStatus {
  return typeof value === 'string' && VALID_PO_STATUSES.includes(value as PurchaseOrderStatus)
    ? (value as PurchaseOrderStatus)
    : DEFAULT_PO_STATUS;
}

function mapPOLine(raw: Record<string, unknown>): POLine {
  return {
    lineId: toStringValue(raw['lineId']),
    poId: toStringValue(raw['poId']),
    lineNumber: toNumberValue(raw['lineNumber'], 0),
    productType: (toStringValue(raw['productType'], 'OTHER') as POLine['productType']),
    productId: toStringValue(raw['productId']) || undefined,
    productDescription: toStringValue(raw['productDescription']),
    sku: toStringValue(raw['sku']) || undefined,
    quantity: toNumberValue(raw['quantity'], 0),
    unitPrice: toNumberValue(raw['unitPrice'], 0),
    lineTotal: toNumberValue(raw['lineTotal'], 0),
    quantityReceived: toNumberValue(raw['quantityReceived'], 0),
    notes: toStringValue(raw['notes']) || undefined,
  };
}

function mapPurchaseOrder(raw: Record<string, unknown>): PurchaseOrder {
  const lines = Array.isArray(raw['lines']) ? (raw['lines'] as Record<string, unknown>[]) : [];
  const totalCount = toNumberValue(raw['totalCount'], lines.length);
  const receivedCount = toNumberValue(
    raw['receivedCount'],
    lines.reduce((sum, line) => sum + toNumberValue(line['quantityReceived'], 0), 0)
  );

  return {
    poId: toStringValue(raw['poId']),
    poNumber: toStringValue(raw['poNumber']),
    vendorName: toStringValue(raw['vendorName']),
    vendorId: toStringValue(raw['vendorId']),
    status: toPOStatus(raw['status']),
    orderDate: toStringValue(raw['orderDate']) || toStringValue(raw['requestedDate']),
    expectedDeliveryDate: toStringValue(raw['expectedDeliveryDate']),
    totalAmount: toNumberValue(raw['totalAmount'], 0),
    lineItemCount: toNumberValue(raw['lineItemCount'], totalCount),
    requesterName: toStringValue(raw['requesterName']) || toStringValue(raw['requestedByName']),
    approverName: toStringValue(raw['approverName']) || toStringValue(raw['approvedByName']) || undefined,
    approvedDate: toStringValue(raw['approvedDate']) || undefined,
    receivedCount,
    totalCount,
  };
}

function mapStatusHistory(rawHistory: unknown): POStatusHistory[] {
  if (!Array.isArray(rawHistory)) {
    return [];
  }

  return rawHistory.map((entry, index) => {
    const record = entry as Record<string, unknown>;
    return {
      historyId: toStringValue(record['historyId']) || `history-${index}`,
      poId: toStringValue(record['poId']),
      status: toPOStatus(record['status']),
      changedBy: toStringValue(record['changedBy']),
      changedByName: toStringValue(record['changedByName']),
      changedAt: toStringValue(record['changedAt']),
      notes: toStringValue(record['notes']) || undefined,
    };
  });
}

function mapPurchaseOrderDetail(raw: Record<string, unknown>): PurchaseOrderDetail {
  const base = mapPurchaseOrder(raw);
  const linesRaw = Array.isArray(raw['lines']) ? (raw['lines'] as Record<string, unknown>[]) : [];

  return {
    ...base,
    costCenterId: toStringValue(raw['costCenterId']),
    costCenterCode: toStringValue(raw['costCenterCode']),
    requestedById: toStringValue(raw['requestedById']) || toStringValue(raw['requestedBy']),
    approvedById: toStringValue(raw['approvedById']) || toStringValue(raw['approvedBy']) || undefined,
    sentDate: toStringValue(raw['sentDate']) || undefined,
    subtotal: toNumberValue(raw['subtotal'], 0),
    taxAmount: toNumberValue(raw['taxAmount'], 0),
    shippingAmount: toNumberValue(raw['shippingAmount'], 0),
    notes: toStringValue(raw['notes']) || undefined,
    lines: linesRaw.map(mapPOLine),
    statusHistory: mapStatusHistory(raw['statusHistory']),
  };
}

function mapPurchaseOrderPage(
  raw: RawPaginatedResponse<Record<string, unknown>>,
  requestedPageSize: number
): PaginatedResponse<PurchaseOrder> {
  const page = toNumberValue(raw.page, 1);
  const total = toNumberValue(raw.total, 0);
  const pageSize = toNumberValue(raw.pageSize, toNumberValue(raw.limit, requestedPageSize));
  const totalPages = toNumberValue(raw.totalPages, Math.max(1, Math.ceil(total / Math.max(pageSize, 1))));
  const itemsRaw = Array.isArray(raw.items) ? raw.items : [];

  return {
    items: itemsRaw.map(mapPurchaseOrder),
    total,
    page,
    pageSize,
    totalPages,
  };
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
      if (key === 'pageSize') {
        searchParams.append('limit', String(value));
      } else if (key === 'sortOrder') {
        searchParams.append('order', String(value));
      } else {
        searchParams.append(key, String(value));
      }
    }
  }

  const queryString = searchParams.toString();
  return queryString ? `?${queryString}` : '';
}

// ============================================================================
// Purchase Order API
// ============================================================================

/**
 * List purchase orders with filters and pagination
 */
export async function listPurchaseOrders(
  filters?: POListFilters,
  pagination?: PaginationParams
): Promise<PaginatedResponse<PurchaseOrder>> {
  const requestedPageSize = pagination?.pageSize ?? 20;
  const queryParams = {
    ...filters,
    page: pagination?.page ?? 1,
    pageSize: requestedPageSize,
    sortBy: pagination?.sortBy ?? 'requestedDate',
    sortOrder: pagination?.sortOrder ?? 'desc',
  };

  const queryString = buildQueryString(queryParams);
  const response = await apiClient.get<RawPaginatedResponse<Record<string, unknown>>>(
    `/procurement/purchase-orders${queryString}`
  );

  if (!response.success || !response.data) {
    throw new ApiError(
      response.error?.code || 'LIST_FAILED',
      response.error?.message || 'Failed to list purchase orders',
      400,
      response.requestId
    );
  }

  return mapPurchaseOrderPage(response.data, requestedPageSize);
}

/**
 * Get purchase order by ID with full details
 */
export async function getPurchaseOrder(poId: string): Promise<PurchaseOrderDetail> {
  const response = await apiClient.get<Record<string, unknown>>(
    `/procurement/purchase-orders/${poId}`
  );

  if (!response.success || !response.data) {
    throw new ApiError(
      response.error?.code || 'NOT_FOUND',
      response.error?.message || 'Purchase order not found',
      404,
      response.requestId
    );
  }

  return mapPurchaseOrderDetail(response.data);
}

/**
 * Create a new purchase order
 */
export async function createPurchaseOrder(
  data: CreatePurchaseOrderRequest
): Promise<PurchaseOrderDetail> {
  const response = await apiClient.post<Record<string, unknown>>(
    '/procurement/purchase-orders',
    data
  );

  if (!response.success || !response.data) {
    throw new ApiError(
      response.error?.code || 'CREATE_FAILED',
      response.error?.message || 'Failed to create purchase order',
      400,
      response.requestId
    );
  }

  return mapPurchaseOrderDetail(response.data);
}

/**
 * Add a line item to a purchase order
 */
export async function addPOLine(
  poId: string,
  line: CreatePOLineRequest
): Promise<PurchaseOrderDetail> {
  const response = await apiClient.post<Record<string, unknown>>(
    `/procurement/purchase-orders/${poId}/lines`,
    line
  );

  if (!response.success || !response.data) {
    throw new ApiError(
      response.error?.code || 'ADD_LINE_FAILED',
      response.error?.message || 'Failed to add line item',
      400,
      response.requestId
    );
  }

  return mapPurchaseOrderDetail(response.data);
}

/**
 * Update a line item
 */
export async function updatePOLine(
  poId: string,
  lineId: string,
  data: UpdatePOLineRequest
): Promise<PurchaseOrderDetail> {
  const response = await apiClient.put<Record<string, unknown>>(
    `/procurement/purchase-orders/${poId}/lines/${lineId}`,
    data
  );

  if (!response.success || !response.data) {
    throw new ApiError(
      response.error?.code || 'UPDATE_LINE_FAILED',
      response.error?.message || 'Failed to update line item',
      400,
      response.requestId
    );
  }

  return mapPurchaseOrderDetail(response.data);
}

/**
 * Remove a line item from a purchase order
 */
export async function removePOLine(
  poId: string,
  lineId: string
): Promise<PurchaseOrderDetail> {
  const response = await apiClient.delete<Record<string, unknown>>(
    `/procurement/purchase-orders/${poId}/lines/${lineId}`
  );

  if (!response.success || !response.data) {
    throw new ApiError(
      response.error?.code || 'REMOVE_LINE_FAILED',
      response.error?.message || 'Failed to remove line item',
      400,
      response.requestId
    );
  }

  return mapPurchaseOrderDetail(response.data);
}

/**
 * Submit purchase order for approval
 */
export async function submitForApproval(poId: string): Promise<PurchaseOrderDetail> {
  const response = await apiClient.post<Record<string, unknown>>(
    `/procurement/purchase-orders/${poId}/submit`
  );

  if (!response.success || !response.data) {
    throw new ApiError(
      response.error?.code || 'SUBMIT_FAILED',
      response.error?.message || 'Failed to submit for approval',
      400,
      response.requestId
    );
  }

  return mapPurchaseOrderDetail(response.data);
}

/**
 * Approve a purchase order
 */
export async function approvePurchaseOrder(
  poId: string,
  notes?: string
): Promise<PurchaseOrderDetail> {
  const response = await apiClient.post<Record<string, unknown>>(
    `/procurement/purchase-orders/${poId}/approve`,
    { approvalNotes: notes }
  );

  if (!response.success || !response.data) {
    throw new ApiError(
      response.error?.code || 'APPROVE_FAILED',
      response.error?.message || 'Failed to approve purchase order',
      400,
      response.requestId
    );
  }

  return mapPurchaseOrderDetail(response.data);
}

/**
 * Reject a purchase order
 */
export async function rejectPurchaseOrder(
  poId: string,
  reason: string
): Promise<PurchaseOrderDetail> {
  const response = await apiClient.post<Record<string, unknown>>(
    `/procurement/purchase-orders/${poId}/reject`,
    { rejectionReason: reason }
  );

  if (!response.success || !response.data) {
    throw new ApiError(
      response.error?.code || 'REJECT_FAILED',
      response.error?.message || 'Failed to reject purchase order',
      400,
      response.requestId
    );
  }

  return mapPurchaseOrderDetail(response.data);
}

/**
 * Send approved purchase order to vendor
 */
export async function sendToVendor(poId: string): Promise<PurchaseOrderDetail> {
  const response = await apiClient.post<Record<string, unknown>>(
    `/procurement/purchase-orders/${poId}/send`
  );

  if (!response.success || !response.data) {
    throw new ApiError(
      response.error?.code || 'SEND_FAILED',
      response.error?.message || 'Failed to send to vendor',
      400,
      response.requestId
    );
  }

  return mapPurchaseOrderDetail(response.data);
}

/**
 * Cancel a purchase order
 */
export async function cancelPurchaseOrder(
  poId: string,
  reason?: string
): Promise<PurchaseOrderDetail> {
  const response = await apiClient.post<Record<string, unknown>>(
    `/procurement/purchase-orders/${poId}/cancel`,
    { cancellationReason: reason }
  );

  if (!response.success || !response.data) {
    throw new ApiError(
      response.error?.code || 'CANCEL_FAILED',
      response.error?.message || 'Failed to cancel purchase order',
      400,
      response.requestId
    );
  }

  return mapPurchaseOrderDetail(response.data);
}

/**
 * Get vendors for dropdown
 */
export async function getVendorsForDropdown(): Promise<VendorSummary[]> {
  const response = await apiClient.get<{ items: VendorSummary[] }>(
    '/admin/vendors?isActive=true&limit=100'
  );

  if (!response.success || !response.data) {
    throw new ApiError(
      response.error?.code || 'LIST_FAILED',
      response.error?.message || 'Failed to list vendors',
      400,
      response.requestId
    );
  }

  return response.data.items;
}

/**
 * Get cost centers for dropdown
 */
export async function getCostCentersForDropdown(): Promise<CostCenterSummary[]> {
  const response = await apiClient.get<{ items: CostCenterSummary[] }>(
    '/admin/cost-centers?isActive=true&limit=100'
  );

  if (!response.success || !response.data) {
    throw new ApiError(
      response.error?.code || 'LIST_FAILED',
      response.error?.message || 'Failed to list cost centers',
      400,
      response.requestId
    );
  }

  return response.data.items;
}

// ============================================================================
// Export Procurement API
// ============================================================================

export const procurementApi = {
  purchaseOrders: {
    list: listPurchaseOrders,
    get: getPurchaseOrder,
    create: createPurchaseOrder,
    addLine: addPOLine,
    updateLine: updatePOLine,
    removeLine: removePOLine,
    submitForApproval,
    approve: approvePurchaseOrder,
    reject: rejectPurchaseOrder,
    sendToVendor,
    cancel: cancelPurchaseOrder,
  },
  vendors: {
    getForDropdown: getVendorsForDropdown,
  },
  costCenters: {
    getForDropdown: getCostCentersForDropdown,
  },
};

export default procurementApi;
