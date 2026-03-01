/**
 * HAM API Service
 *
 * Provides methods for interacting with the HAM Service endpoints
 * for transfers, loaners, audit scans, and disposal workflows.
 *
 * Implements Task 6.1: Create HAM API client
 * Validates: Requirements 6.1, 6.2, 6.3, 6.4
 */

import { apiClient, ApiError } from './api-client';

// ============================================================================
// Types
// ============================================================================

export type TransferOrderStatus =
  | 'DRAFT'
  | 'PENDING_APPROVAL'
  | 'APPROVED'
  | 'REJECTED'
  | 'IN_TRANSIT'
  | 'PARTIALLY_RECEIVED'
  | 'RECEIVED'
  | 'COMPLETED'
  | 'CANCELLED'
  | 'ON_HOLD';

export interface TransferOrder {
  transferId: string;
  transferNumber?: string;
  assetId?: string;
  assetTag?: string;
  fromStockroomId: string;
  fromStockroomName?: string;
  toStockroomId: string;
  toStockroomName?: string;
  fromBuildingName?: string;
  toBuildingName?: string;
  status: TransferOrderStatus;
  requestedBy?: string;
  approvedBy?: string;
  requestedAt?: string;
  requestedDate?: string;
  approvedAt?: string;
  completedAt?: string;
  totalLineCount?: number;
  totalQuantity?: number;
  receivedQuantity?: number;
  notes?: string;
}

export interface LoanerRecord {
  loanId: string;
  assetId: string;
  assetTag: string;
  borrowerId: string;
  borrowerName: string;
  checkoutDate: string;
  expectedReturnDate: string;
  actualReturnDate?: string;
  status: 'CHECKED_OUT' | 'RETURNED' | 'RETURNED_LATE' | 'RETURNED_DAMAGED' | 'OVERDUE' | 'LOST' | 'CANCELLED';
  notes?: string;
}

export interface AuditScan {
  scanId: string;
  assetTag: string;
  locationId: string;
  locationName: string;
  scannedBy: string;
  scannedAt: string;
  matched: boolean;
}

export interface AuditDiscrepancy {
  discrepancyId: string;
  assetTag: string;
  expectedLocationId: string;
  expectedLocationName: string;
  actualLocationId?: string;
  actualLocationName?: string;
  type: 'missing' | 'unexpected' | 'location_mismatch';
  resolvedAt?: string;
}

export interface DisposalRequest {
  disposalId: string;
  assetId: string;
  assetTag: string;
  reason: string;
  method: 'recycle' | 'donate' | 'destroy' | 'sell';
  status: 'pending' | 'approved' | 'completed';
  initiatedBy: string;
  initiatedAt: string;
  completedAt?: string;
  certificateUrl?: string;
}

// Legacy shape; preserved for compatibility.
export interface CreateTransferRequest {
  assetId: string;
  fromStockroomId: string;
  toStockroomId: string;
  notes?: string;
}

export type TransferPriority = 'LOW' | 'NORMAL' | 'HIGH' | 'URGENT' | 'CRITICAL';

export interface CreateTransferLineRequest {
  assetId?: string;
  productId?: string;
  productType?: string;
  productDescription?: string;
  serialNumber?: string;
  assetTag?: string;
  quantity: number;
  notes?: string;
}

export interface CreateTransferOrderRequest {
  fromStockroomId: string;
  toStockroomId: string;
  priority?: TransferPriority;
  reason?: string;
  notes?: string;
  lines: CreateTransferLineRequest[];
}

export interface CompleteTransferLineReceipt {
  lineId: string;
  receivedQuantity: number;
  damagedQuantity?: number;
  conditionReceived?: 'NEW' | 'EXCELLENT' | 'GOOD' | 'FAIR' | 'POOR' | 'DAMAGED' | 'UNKNOWN';
  conditionNotes?: string;
}

export interface CompleteTransferRequest {
  receivingNotes?: string;
  lineReceipts: CompleteTransferLineReceipt[];
}

export interface CheckoutLoanerRequest {
  assetId: string;
  borrowerId: string;
  expectedReturnDate: string;
  notes?: string;
}

export interface RecordScanRequest {
  assetTag: string;
  locationId: string;
}

export interface InitiateDisposalRequest {
  assetId: string;
  reason: string;
  method: 'recycle' | 'donate' | 'destroy' | 'sell';
}

function toTransferStatus(value: string | undefined): TransferOrderStatus {
  const status = (value ?? '').trim().toUpperCase();
  switch (status) {
    case 'DRAFT':
      return 'DRAFT';
    case 'PENDING':
    case 'PENDING_APPROVAL':
      return 'PENDING_APPROVAL';
    case 'APPROVED':
      return 'APPROVED';
    case 'REJECTED':
      return 'REJECTED';
    case 'IN_TRANSIT':
      return 'IN_TRANSIT';
    case 'PARTIALLY_RECEIVED':
      return 'PARTIALLY_RECEIVED';
    case 'RECEIVED':
      return 'RECEIVED';
    case 'COMPLETED':
      return 'COMPLETED';
    case 'CANCELLED':
      return 'CANCELLED';
    case 'ON_HOLD':
      return 'ON_HOLD';
    default:
      return 'PENDING_APPROVAL';
  }
}

function mapTransferOrder(raw: Record<string, unknown>): TransferOrder {
  const fromStockroomName =
    (typeof raw['fromStockroomName'] === 'string' ? raw['fromStockroomName'] : undefined) ??
    (typeof raw['fromStockroom'] === 'string' ? raw['fromStockroom'] : undefined);
  const toStockroomName =
    (typeof raw['toStockroomName'] === 'string' ? raw['toStockroomName'] : undefined) ??
    (typeof raw['toStockroom'] === 'string' ? raw['toStockroom'] : undefined);

  return {
    transferId: String(raw['transferId'] ?? ''),
    transferNumber: typeof raw['transferNumber'] === 'string' ? raw['transferNumber'] : undefined,
    assetId: typeof raw['assetId'] === 'string' ? raw['assetId'] : undefined,
    assetTag: typeof raw['assetTag'] === 'string' ? raw['assetTag'] : undefined,
    fromStockroomId: String(raw['fromStockroomId'] ?? ''),
    fromStockroomName,
    toStockroomId: String(raw['toStockroomId'] ?? ''),
    toStockroomName,
    fromBuildingName: typeof raw['fromBuildingName'] === 'string' ? raw['fromBuildingName'] : undefined,
    toBuildingName: typeof raw['toBuildingName'] === 'string' ? raw['toBuildingName'] : undefined,
    status: toTransferStatus(typeof raw['status'] === 'string' ? raw['status'] : undefined),
    requestedBy: typeof raw['requestedBy'] === 'string' ? raw['requestedBy'] : undefined,
    approvedBy: typeof raw['approvedBy'] === 'string' ? raw['approvedBy'] : undefined,
    requestedAt: typeof raw['requestedAt'] === 'string' ? raw['requestedAt'] : undefined,
    requestedDate: typeof raw['requestedDate'] === 'string' ? raw['requestedDate'] : undefined,
    approvedAt: typeof raw['approvedAt'] === 'string' ? raw['approvedAt'] : undefined,
    completedAt: typeof raw['completedAt'] === 'string' ? raw['completedAt'] : undefined,
    totalLineCount: typeof raw['totalLineCount'] === 'number' ? raw['totalLineCount'] : undefined,
    totalQuantity: typeof raw['totalQuantity'] === 'number' ? raw['totalQuantity'] : undefined,
    receivedQuantity: typeof raw['receivedQuantity'] === 'number' ? raw['receivedQuantity'] : undefined,
    notes: typeof raw['notes'] === 'string' ? raw['notes'] : undefined,
  };
}

// ============================================================================
// Transfer API Functions
// ============================================================================

export async function listTransfers(status?: string): Promise<TransferOrder[]> {
  const normalizedStatus = status && status.trim().length > 0
    ? toTransferStatus(status)
    : undefined;
  const query = normalizedStatus ? `?status=${encodeURIComponent(normalizedStatus)}` : '';

  const response = await apiClient.get<Record<string, unknown>[] | { items: Record<string, unknown>[] }>(
    `/ham/transfers${query}`
  );

  if (!response.success || !response.data) {
    throw new ApiError(
      response.error?.code || 'FETCH_FAILED',
      response.error?.message || 'Failed to fetch transfers',
      400,
      response.requestId
    );
  }

  const data = response.data;
  const items = Array.isArray(data) ? data : data.items ?? [];
  return items.map(mapTransferOrder);
}

export async function createTransfer(
  data: CreateTransferOrderRequest | CreateTransferRequest
): Promise<TransferOrder> {
  const payload: CreateTransferOrderRequest = 'lines' in data
    ? data
    : {
      fromStockroomId: data.fromStockroomId,
      toStockroomId: data.toStockroomId,
      notes: data.notes,
      lines: [
        {
          assetId: data.assetId,
          quantity: 1,
          notes: data.notes,
        },
      ],
    };

  const response = await apiClient.post<Record<string, unknown>>('/ham/transfers', payload);
  if (!response.success || !response.data) {
    throw new ApiError(
      response.error?.code || 'CREATE_FAILED',
      response.error?.message || 'Failed to create transfer',
      400,
      response.requestId
    );
  }

  const dataPayload = response.data as Record<string, unknown>;
  const transfer = (dataPayload['transfer'] as Record<string, unknown> | undefined) ?? dataPayload;
  if (!transfer || typeof transfer['transferId'] !== 'string') {
    throw new ApiError('CREATE_FAILED', 'Transfer response missing transfer payload', 400, response.requestId);
  }

  return mapTransferOrder(transfer);
}

export async function approveTransfer(transferId: string): Promise<TransferOrder> {
  const response = await apiClient.post<Record<string, unknown>>(`/ham/transfers/${transferId}/approve`);
  if (!response.success || !response.data) {
    throw new ApiError(
      response.error?.code || 'APPROVE_FAILED',
      response.error?.message || 'Failed to approve transfer',
      400,
      response.requestId
    );
  }

  const dataPayload = response.data as Record<string, unknown>;
  const transfer = (dataPayload['transfer'] as Record<string, unknown> | undefined) ?? dataPayload;
  if (!transfer || typeof transfer['transferId'] !== 'string') {
    throw new ApiError('APPROVE_FAILED', 'Approval response missing transfer payload', 400, response.requestId);
  }

  return mapTransferOrder(transfer);
}

export async function completeTransfer(
  transferId: string,
  data: CompleteTransferRequest = { lineReceipts: [] }
): Promise<TransferOrder> {
  const response = await apiClient.post<Record<string, unknown>>(`/ham/transfers/${transferId}/complete`, data);
  if (!response.success || !response.data) {
    throw new ApiError(
      response.error?.code || 'COMPLETE_FAILED',
      response.error?.message || 'Failed to complete transfer',
      400,
      response.requestId
    );
  }

  const dataPayload = response.data as Record<string, unknown>;
  const transfer = (dataPayload['transfer'] as Record<string, unknown> | undefined) ?? dataPayload;
  if (!transfer || typeof transfer['transferId'] !== 'string') {
    throw new ApiError('COMPLETE_FAILED', 'Complete response missing transfer payload', 400, response.requestId);
  }

  return mapTransferOrder(transfer);
}

// ============================================================================
// Loaner API Functions
// ============================================================================

export async function listLoaners(status?: string): Promise<LoanerRecord[]> {
  const query = status ? `?status=${status}` : '';
  const response = await apiClient.get<LoanerRecord[] | { items: LoanerRecord[] }>(`/ham/loaners${query}`);
  if (!response.success || !response.data) {
    throw new ApiError(
      response.error?.code || 'FETCH_FAILED',
      response.error?.message || 'Failed to fetch loaners',
      400,
      response.requestId
    );
  }
  const data = response.data;
  return Array.isArray(data) ? data : data.items ?? [];
}

export async function checkoutLoaner(data: CheckoutLoanerRequest): Promise<LoanerRecord> {
  const response = await apiClient.post<LoanerRecord>('/ham/loaners/checkout', data);
  if (!response.success || !response.data) {
    throw new ApiError(
      response.error?.code || 'CHECKOUT_FAILED',
      response.error?.message || 'Failed to checkout loaner',
      400,
      response.requestId
    );
  }
  return response.data;
}

export async function returnLoaner(loanId: string): Promise<LoanerRecord> {
  const response = await apiClient.post<LoanerRecord>(`/ham/loaners/${loanId}/return`);
  if (!response.success || !response.data) {
    throw new ApiError(
      response.error?.code || 'RETURN_FAILED',
      response.error?.message || 'Failed to return loaner',
      400,
      response.requestId
    );
  }
  return response.data;
}

export async function getOverdueLoans(): Promise<LoanerRecord[]> {
  const response = await apiClient.get<LoanerRecord[] | { items: LoanerRecord[] }>('/ham/loaners/overdue');
  if (!response.success || !response.data) {
    throw new ApiError(
      response.error?.code || 'FETCH_FAILED',
      response.error?.message || 'Failed to fetch overdue loans',
      400,
      response.requestId
    );
  }
  const data = response.data;
  return Array.isArray(data) ? data : data.items ?? [];
}

// ============================================================================
// Audit Scan API Functions
// ============================================================================

export async function recordAuditScan(data: RecordScanRequest): Promise<AuditScan> {
  const response = await apiClient.post<AuditScan>('/ham/audits/scan', data);
  if (!response.success || !response.data) {
    throw new ApiError(
      response.error?.code || 'SCAN_FAILED',
      response.error?.message || 'Failed to record audit scan',
      400,
      response.requestId
    );
  }
  return response.data;
}

export async function getAuditDiscrepancies(): Promise<AuditDiscrepancy[]> {
  const response = await apiClient.get<AuditDiscrepancy[] | { items: AuditDiscrepancy[] }>('/ham/audits/discrepancies');
  if (!response.success || !response.data) {
    throw new ApiError(
      response.error?.code || 'FETCH_FAILED',
      response.error?.message || 'Failed to fetch audit discrepancies',
      400,
      response.requestId
    );
  }
  const data = response.data;
  return Array.isArray(data) ? data : data.items ?? [];
}

// ============================================================================
// Disposal API Functions
// ============================================================================

export async function listDisposals(status?: string): Promise<DisposalRequest[]> {
  const query = status ? `?status=${status}` : '';
  const response = await apiClient.get<DisposalRequest[] | { items: DisposalRequest[] }>(`/ham/disposal${query}`);
  if (!response.success || !response.data) {
    throw new ApiError(
      response.error?.code || 'FETCH_FAILED',
      response.error?.message || 'Failed to fetch disposal requests',
      400,
      response.requestId
    );
  }
  const data = response.data;
  return Array.isArray(data) ? data : data.items ?? [];
}

export async function initiateDisposal(data: InitiateDisposalRequest): Promise<DisposalRequest> {
  const response = await apiClient.post<DisposalRequest>('/ham/disposal', data);
  if (!response.success || !response.data) {
    throw new ApiError(
      response.error?.code || 'CREATE_FAILED',
      response.error?.message || 'Failed to initiate disposal',
      400,
      response.requestId
    );
  }
  return response.data;
}

export async function recordDestruction(disposalId: string): Promise<DisposalRequest> {
  const response = await apiClient.post<DisposalRequest>(`/ham/disposal/${disposalId}/destruction`);
  if (!response.success || !response.data) {
    throw new ApiError(
      response.error?.code || 'DESTROY_FAILED',
      response.error?.message || 'Failed to record destruction',
      400,
      response.requestId
    );
  }
  return response.data;
}
