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

export interface TransferOrder {
  transferId: string;
  assetId: string;
  assetTag: string;
  fromStockroomId: string;
  fromStockroomName: string;
  toStockroomId: string;
  toStockroomName: string;
  status: 'pending' | 'approved' | 'in_transit' | 'completed' | 'cancelled';
  requestedBy: string;
  approvedBy?: string;
  requestedAt: string;
  approvedAt?: string;
  completedAt?: string;
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
  status: 'active' | 'overdue' | 'returned';
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

export interface CreateTransferRequest {
  assetId: string;
  fromStockroomId: string;
  toStockroomId: string;
  notes?: string;
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

// ============================================================================
// Transfer API Functions
// ============================================================================

export async function listTransfers(status?: string): Promise<TransferOrder[]> {
  const query = status ? `?status=${status}` : '';
  const response = await apiClient.get<TransferOrder[]>(`/ham/transfers${query}`);
  if (!response.success || !response.data) {
    throw new ApiError(
      response.error?.code || 'FETCH_FAILED',
      response.error?.message || 'Failed to fetch transfers',
      400,
      response.requestId
    );
  }
  return response.data;
}

export async function createTransfer(data: CreateTransferRequest): Promise<TransferOrder> {
  const response = await apiClient.post<TransferOrder>('/ham/transfers', data);
  if (!response.success || !response.data) {
    throw new ApiError(
      response.error?.code || 'CREATE_FAILED',
      response.error?.message || 'Failed to create transfer',
      400,
      response.requestId
    );
  }
  return response.data;
}

export async function approveTransfer(transferId: string): Promise<TransferOrder> {
  const response = await apiClient.post<TransferOrder>(`/ham/transfers/${transferId}/approve`);
  if (!response.success || !response.data) {
    throw new ApiError(
      response.error?.code || 'APPROVE_FAILED',
      response.error?.message || 'Failed to approve transfer',
      400,
      response.requestId
    );
  }
  return response.data;
}

export async function completeTransfer(transferId: string): Promise<TransferOrder> {
  const response = await apiClient.post<TransferOrder>(`/ham/transfers/${transferId}/complete`);
  if (!response.success || !response.data) {
    throw new ApiError(
      response.error?.code || 'COMPLETE_FAILED',
      response.error?.message || 'Failed to complete transfer',
      400,
      response.requestId
    );
  }
  return response.data;
}

// ============================================================================
// Loaner API Functions
// ============================================================================

export async function listLoaners(status?: string): Promise<LoanerRecord[]> {
  const query = status ? `?status=${status}` : '';
  const response = await apiClient.get<LoanerRecord[]>(`/ham/loaners${query}`);
  if (!response.success || !response.data) {
    throw new ApiError(
      response.error?.code || 'FETCH_FAILED',
      response.error?.message || 'Failed to fetch loaners',
      400,
      response.requestId
    );
  }
  return response.data;
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
  const response = await apiClient.get<LoanerRecord[]>('/ham/loaners/overdue');
  if (!response.success || !response.data) {
    throw new ApiError(
      response.error?.code || 'FETCH_FAILED',
      response.error?.message || 'Failed to fetch overdue loans',
      400,
      response.requestId
    );
  }
  return response.data;
}

// ============================================================================
// Audit Scan API Functions
// ============================================================================

export async function recordAuditScan(data: RecordScanRequest): Promise<AuditScan> {
  const response = await apiClient.post<AuditScan>('/ham/audit-scans', data);
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
  const response = await apiClient.get<AuditDiscrepancy[]>('/ham/audit-scans/discrepancies');
  if (!response.success || !response.data) {
    throw new ApiError(
      response.error?.code || 'FETCH_FAILED',
      response.error?.message || 'Failed to fetch audit discrepancies',
      400,
      response.requestId
    );
  }
  return response.data;
}

// ============================================================================
// Disposal API Functions
// ============================================================================

export async function listDisposals(status?: string): Promise<DisposalRequest[]> {
  const query = status ? `?status=${status}` : '';
  const response = await apiClient.get<DisposalRequest[]>(`/ham/disposals${query}`);
  if (!response.success || !response.data) {
    throw new ApiError(
      response.error?.code || 'FETCH_FAILED',
      response.error?.message || 'Failed to fetch disposal requests',
      400,
      response.requestId
    );
  }
  return response.data;
}

export async function initiateDisposal(data: InitiateDisposalRequest): Promise<DisposalRequest> {
  const response = await apiClient.post<DisposalRequest>('/ham/disposals', data);
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
  const response = await apiClient.post<DisposalRequest>(`/ham/disposals/${disposalId}/destroy`);
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
