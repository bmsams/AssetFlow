/**
 * Receiving API Service
 *
 * Provides methods for interacting with the Receiving/Lifecycle API.
 * Handles receiving workflow operations including scanning, inspection, and completion.
 *
 * Implements Task 22.2: Create Frontend Receiving API Service
 * Validates: Requirement 21 - Receiving API Integration
 */

import { apiClient, ApiError } from './api-client';
import type { ReceivingStatus } from '../types/procurement';

// ============================================================================
// Types
// ============================================================================

// Re-export ReceivingStatus from procurement types for convenience
export type { ReceivingStatus } from '../types/procurement';

/**
 * Receiving condition for scanned items
 */
export type ReceivingCondition = 'NEW' | 'GOOD' | 'DAMAGED' | 'DEFECTIVE';

/**
 * Inspection result
 */
export type InspectionResult = 'PASSED' | 'FAILED';

/**
 * Receiving record
 */
export interface ReceivingRecord {
  receivingId: string;
  poId: string | null;
  poNumber: string | null;
  vendorId?: string | null;
  vendorName?: string | null;
  status: ReceivingStatus;
  receivedBy?: string;
  receivedByName?: string;
  receivedAt?: string;
  stockroomId?: string;
  stockroomName?: string;
  notes?: string;
  createdAt: string;
  updatedAt: string;
}

/**
 * Receiving line item
 */
export interface ReceivingLine {
  receivingLineId: string;
  receivingId: string;
  poLineId?: string | null;
  productDescription: string;
  productType?: string;
  expectedQuantity: number;
  receivedQuantity: number;
  pendingQuantity: number;
  inspectionRequired: boolean;
  notes?: string;
}

/**
 * Scanned asset during receiving
 */
export interface ScannedAsset {
  assetId: string;
  assetTag: string;
  serialNumber?: string;
  barcode?: string;
  condition: ReceivingCondition;
  productName?: string;
  productType?: string;
  createdAt: string;
}

/**
 * Inspection record
 */
export interface InspectionRecord {
  inspectionId: string;
  receivingLineId: string;
  assetId?: string;
  serialNumber?: string;
  status: 'PENDING' | 'PASSED' | 'FAILED';
  result?: InspectionResult;
  inspectedBy?: string;
  inspectedByName?: string;
  inspectedAt?: string;
  notes?: string;
  failureReason?: string;
  createdAt: string;
  updatedAt: string;
}

// ============================================================================
// Request Types
// ============================================================================

/**
 * Create receiving from PO request
 */
export interface CreateReceivingFromPORequest {
  poId: string;
  stockroomId?: string;
  poLineIds?: string[];
  notes?: string;
}

/**
 * Scan asset request
 */
export interface ScanAssetRequest {
  receivingLineId: string;
  serialNumber?: string;
  barcode?: string;
  condition?: ReceivingCondition;
  productName?: string;
  productType?: string;
  notes?: string;
}

/**
 * Complete receiving request
 */
export interface CompleteReceivingRequest {
  notes?: string;
}

/**
 * Cancel receiving request
 */
export interface CancelReceivingRequest {
  reason?: string;
}

/**
 * Mark for inspection request
 */
export interface MarkForInspectionRequest {
  receivingLineId: string;
  assetId?: string;
  serialNumber?: string;
  notes?: string;
}

/**
 * Record inspection result request
 */
export interface RecordInspectionResultRequest {
  result: InspectionResult;
  notes?: string;
  failureReason?: string;
}

// ============================================================================
// Response Types
// ============================================================================

/**
 * Receiving record response
 */
export interface ReceivingRecordResponse {
  receivingRecord: ReceivingRecord;
  lines: ReceivingLine[];
}

/**
 * Scan asset response
 */
export interface ScanAssetResponse {
  asset: ScannedAsset;
  receivingLine: ReceivingLine;
  receivingRecord: ReceivingRecord;
  isLineComplete: boolean;
  isReceivingComplete: boolean;
}

/**
 * Inspection record response
 */
export interface InspectionRecordResponse {
  inspectionRecord: InspectionRecord;
  receivingLine: ReceivingLine;
}

/**
 * Inspection result response
 */
export interface InspectionResultResponse {
  inspectionRecord: InspectionRecord;
  assetCreated?: ScannedAsset;
  routedToReturn: boolean;
}

// ============================================================================
// API Functions
// ============================================================================

/**
 * Create a receiving record from a purchase order
 */
export async function createReceivingFromPO(
  data: CreateReceivingFromPORequest
): Promise<ReceivingRecordResponse> {
  const response = await apiClient.post<ReceivingRecordResponse>(
    '/lifecycle/receiving/from-po',
    data
  );

  if (!response.success || !response.data) {
    throw new ApiError(
      response.error?.code || 'CREATE_FAILED',
      response.error?.message || 'Failed to create receiving record',
      400,
      response.requestId
    );
  }

  return response.data;
}

/**
 * Get a receiving record by ID
 */
export async function getReceivingRecord(
  receivingId: string
): Promise<ReceivingRecordResponse> {
  const response = await apiClient.get<ReceivingRecordResponse>(
    `/lifecycle/receiving/${receivingId}`
  );

  if (!response.success || !response.data) {
    throw new ApiError(
      response.error?.code || 'NOT_FOUND',
      response.error?.message || 'Receiving record not found',
      404,
      response.requestId
    );
  }

  return response.data;
}

/**
 * Scan an asset during receiving
 */
export async function scanAsset(
  receivingId: string,
  data: ScanAssetRequest
): Promise<ScanAssetResponse> {
  const response = await apiClient.post<ScanAssetResponse>(
    `/lifecycle/receiving/${receivingId}/scan`,
    data
  );

  if (!response.success || !response.data) {
    throw new ApiError(
      response.error?.code || 'SCAN_FAILED',
      response.error?.message || 'Failed to scan asset',
      400,
      response.requestId
    );
  }

  return response.data;
}

/**
 * Complete a receiving record
 */
export async function completeReceiving(
  receivingId: string,
  data?: CompleteReceivingRequest
): Promise<ReceivingRecordResponse> {
  const response = await apiClient.post<ReceivingRecordResponse>(
    `/lifecycle/receiving/${receivingId}/complete`,
    data || {}
  );

  if (!response.success || !response.data) {
    throw new ApiError(
      response.error?.code || 'COMPLETE_FAILED',
      response.error?.message || 'Failed to complete receiving',
      400,
      response.requestId
    );
  }

  return response.data;
}

/**
 * Cancel a receiving record
 */
export async function cancelReceiving(
  receivingId: string,
  data?: CancelReceivingRequest
): Promise<ReceivingRecordResponse> {
  const response = await apiClient.post<ReceivingRecordResponse>(
    `/lifecycle/receiving/${receivingId}/cancel`,
    data || {}
  );

  if (!response.success || !response.data) {
    throw new ApiError(
      response.error?.code || 'CANCEL_FAILED',
      response.error?.message || 'Failed to cancel receiving',
      400,
      response.requestId
    );
  }

  return response.data;
}

/**
 * Get an inspection record by ID
 */
export async function getInspection(
  inspectionId: string
): Promise<InspectionRecordResponse> {
  const response = await apiClient.get<InspectionRecordResponse>(
    `/lifecycle/inspection/${inspectionId}`
  );

  if (!response.success || !response.data) {
    throw new ApiError(
      response.error?.code || 'NOT_FOUND',
      response.error?.message || 'Inspection record not found',
      404,
      response.requestId
    );
  }

  return response.data;
}

/**
 * Mark an item for inspection
 */
export async function markForInspection(
  data: MarkForInspectionRequest
): Promise<InspectionRecordResponse> {
  const response = await apiClient.post<InspectionRecordResponse>(
    '/lifecycle/inspection',
    data
  );

  if (!response.success || !response.data) {
    throw new ApiError(
      response.error?.code || 'INSPECTION_FAILED',
      response.error?.message || 'Failed to mark for inspection',
      400,
      response.requestId
    );
  }

  return response.data;
}

/**
 * Record inspection result
 */
export async function recordInspectionResult(
  inspectionId: string,
  data: RecordInspectionResultRequest
): Promise<InspectionResultResponse> {
  const response = await apiClient.post<InspectionResultResponse>(
    `/lifecycle/inspection/${inspectionId}/result`,
    data
  );

  if (!response.success || !response.data) {
    throw new ApiError(
      response.error?.code || 'RESULT_FAILED',
      response.error?.message || 'Failed to record inspection result',
      400,
      response.requestId
    );
  }

  return response.data;
}

// ============================================================================
// Export Receiving API
// ============================================================================

export const receivingApi = {
  createFromPO: createReceivingFromPO,
  get: getReceivingRecord,
  scanAsset,
  complete: completeReceiving,
  cancel: cancelReceiving,
  inspection: {
    get: getInspection,
    markForInspection,
    recordResult: recordInspectionResult,
  },
};

export default receivingApi;
