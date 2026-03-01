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
  lineNumber: number;
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
  condition?: ReceivingCondition;
  productName?: string;
  productType?: string;
  status?: string;
  receivingLineId?: string;
  receivingId?: string;
  poId?: string | null;
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

const VALID_RECEIVING_STATUSES: ReceivingStatus[] = [
  'PENDING',
  'IN_PROGRESS',
  'COMPLETED',
  'CANCELLED',
];

function asRecord(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    return {};
  }
  return value as Record<string, unknown>;
}

function asArray(value: unknown): unknown[] {
  return Array.isArray(value) ? value : [];
}

function toStringValue(value: unknown, fallback = ''): string {
  return typeof value === 'string' ? value : fallback;
}

function toOptionalString(value: unknown): string | undefined {
  const parsed = toStringValue(value);
  return parsed.length > 0 ? parsed : undefined;
}

function toNumberValue(value: unknown, fallback = 0): number {
  if (typeof value === 'number' && Number.isFinite(value)) {
    return value;
  }
  if (typeof value === 'string' && value.trim().length > 0) {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : fallback;
  }
  return fallback;
}

function toReceivingStatus(value: unknown): ReceivingStatus {
  return typeof value === 'string' && VALID_RECEIVING_STATUSES.includes(value as ReceivingStatus)
    ? (value as ReceivingStatus)
    : 'PENDING';
}

function mapReceivingRecord(rawRecord: Record<string, unknown>): ReceivingRecord {
  const receivedDate =
    toOptionalString(rawRecord['receivedDate']) ?? toOptionalString(rawRecord['receivedAt']);

  return {
    receivingId: toStringValue(rawRecord['receivingId']),
    poId: toOptionalString(rawRecord['poId']) ?? null,
    poNumber: toOptionalString(rawRecord['poNumber']) ?? null,
    vendorId: toOptionalString(rawRecord['vendorId']) ?? null,
    vendorName: toOptionalString(rawRecord['vendorName']) ?? null,
    status: toReceivingStatus(rawRecord['status']),
    receivedBy: toOptionalString(rawRecord['receivedBy']),
    receivedByName: toOptionalString(rawRecord['receivedByName']),
    receivedAt: receivedDate,
    stockroomId: toOptionalString(rawRecord['stockroomId']),
    stockroomName: toOptionalString(rawRecord['stockroomName']),
    notes: toOptionalString(rawRecord['notes']),
    createdAt: toStringValue(rawRecord['createdAt']),
    updatedAt: toStringValue(rawRecord['updatedAt']),
  };
}

function mapReceivingLine(rawLine: Record<string, unknown>): ReceivingLine {
  const expectedQuantity = toNumberValue(
    rawLine['expectedQuantity'],
    toNumberValue(rawLine['quantityExpected'], 0)
  );
  const receivedQuantity = toNumberValue(
    rawLine['receivedQuantity'],
    toNumberValue(rawLine['quantityReceived'], 0)
  );
  const pendingQuantity = Math.max(
    0,
    toNumberValue(rawLine['pendingQuantity'], expectedQuantity - receivedQuantity)
  );

  return {
    receivingLineId: toStringValue(rawLine['receivingLineId']) || toStringValue(rawLine['lineId']),
    receivingId: toStringValue(rawLine['receivingId']),
    lineNumber: toNumberValue(rawLine['lineNumber'], 0),
    poLineId: toOptionalString(rawLine['poLineId']) ?? null,
    productDescription:
      toStringValue(rawLine['productDescription']) ||
      toStringValue(rawLine['productName']) ||
      'Unknown Item',
    productType: toOptionalString(rawLine['productType']),
    expectedQuantity,
    receivedQuantity,
    pendingQuantity,
    inspectionRequired: Boolean(rawLine['inspectionRequired']),
    notes: toOptionalString(rawLine['notes']),
  };
}

function mapScannedAsset(rawAsset: Record<string, unknown>): ScannedAsset {
  return {
    assetId: toStringValue(rawAsset['assetId']),
    assetTag: toStringValue(rawAsset['assetTag']),
    serialNumber: toOptionalString(rawAsset['serialNumber']),
    barcode: toOptionalString(rawAsset['barcode']),
    condition: toOptionalString(rawAsset['condition']) as ReceivingCondition | undefined,
    productName: toOptionalString(rawAsset['productName']),
    productType: toOptionalString(rawAsset['productType']),
    status: toOptionalString(rawAsset['status']),
    receivingLineId: toOptionalString(rawAsset['receivingLineId']),
    receivingId: toOptionalString(rawAsset['receivingId']),
    poId: toOptionalString(rawAsset['poId']) ?? null,
    createdAt: toStringValue(rawAsset['createdAt']),
  };
}

function mapInspectionRecord(rawRecord: Record<string, unknown>): InspectionRecord {
  return {
    inspectionId: toStringValue(rawRecord['inspectionId']),
    receivingLineId: toStringValue(rawRecord['receivingLineId']),
    assetId: toOptionalString(rawRecord['assetId']),
    serialNumber: toOptionalString(rawRecord['serialNumber']),
    status: toStringValue(rawRecord['status'], 'PENDING') as InspectionRecord['status'],
    result: toOptionalString(rawRecord['result']) as InspectionResult | undefined,
    inspectedBy: toOptionalString(rawRecord['inspectedBy']),
    inspectedByName: toOptionalString(rawRecord['inspectedByName']),
    inspectedAt: toOptionalString(rawRecord['inspectedAt']),
    notes: toOptionalString(rawRecord['notes']),
    failureReason: toOptionalString(rawRecord['failureReason']),
    createdAt: toStringValue(rawRecord['createdAt']),
    updatedAt: toStringValue(rawRecord['updatedAt']),
  };
}

function mapReceivingRecordResponse(raw: Record<string, unknown>): ReceivingRecordResponse {
  const rawReceivingRecord = asRecord(raw['receivingRecord']);
  const rawLines = asArray(raw['lines']);

  return {
    receivingRecord: mapReceivingRecord(rawReceivingRecord),
    lines: rawLines.map((line) => mapReceivingLine(asRecord(line))),
  };
}

function mapScanAssetResponse(raw: Record<string, unknown>): ScanAssetResponse {
  const receivingLine = mapReceivingLine(asRecord(raw['receivingLine']));

  return {
    asset: mapScannedAsset(asRecord(raw['asset'])),
    receivingLine,
    receivingRecord: mapReceivingRecord(asRecord(raw['receivingRecord'])),
    isLineComplete:
      typeof raw['isLineComplete'] === 'boolean'
        ? (raw['isLineComplete'] as boolean)
        : receivingLine.receivedQuantity >= receivingLine.expectedQuantity,
    isReceivingComplete: Boolean(raw['isReceivingComplete']),
  };
}

function mapInspectionRecordResponse(raw: Record<string, unknown>): InspectionRecordResponse {
  return {
    inspectionRecord: mapInspectionRecord(asRecord(raw['inspectionRecord'])),
    receivingLine: mapReceivingLine(asRecord(raw['receivingLine'])),
  };
}

function mapInspectionResultResponse(raw: Record<string, unknown>): InspectionResultResponse {
  const rawAssetCreated = asRecord(raw['assetCreated']);
  const hasAssetCreated = toStringValue(rawAssetCreated['assetId']).length > 0;

  return {
    inspectionRecord: mapInspectionRecord(asRecord(raw['inspectionRecord'])),
    assetCreated: hasAssetCreated ? mapScannedAsset(rawAssetCreated) : undefined,
    routedToReturn: Boolean(raw['routedToReturn']),
  };
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
  const response = await apiClient.post<Record<string, unknown>>(
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

  return mapReceivingRecordResponse(response.data);
}

/**
 * Get a receiving record by ID
 */
export async function getReceivingRecord(
  receivingId: string
): Promise<ReceivingRecordResponse> {
  const response = await apiClient.get<Record<string, unknown>>(
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

  return mapReceivingRecordResponse(response.data);
}

/**
 * Scan an asset during receiving
 */
export async function scanAsset(
  receivingId: string,
  data: ScanAssetRequest
): Promise<ScanAssetResponse> {
  const response = await apiClient.post<Record<string, unknown>>(
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

  return mapScanAssetResponse(response.data);
}

/**
 * Complete a receiving record
 */
export async function completeReceiving(
  receivingId: string,
  data?: CompleteReceivingRequest
): Promise<ReceivingRecordResponse> {
  const response = await apiClient.post<Record<string, unknown>>(
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

  return mapReceivingRecordResponse(response.data);
}

/**
 * Cancel a receiving record
 */
export async function cancelReceiving(
  receivingId: string,
  data?: CancelReceivingRequest
): Promise<ReceivingRecordResponse> {
  const response = await apiClient.post<Record<string, unknown>>(
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

  return mapReceivingRecordResponse(response.data);
}

/**
 * Get an inspection record by ID
 */
export async function getInspection(
  inspectionId: string
): Promise<InspectionRecordResponse> {
  const response = await apiClient.get<Record<string, unknown>>(
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

  return mapInspectionRecordResponse(response.data);
}

/**
 * Mark an item for inspection
 */
export async function markForInspection(
  data: MarkForInspectionRequest
): Promise<InspectionRecordResponse> {
  const response = await apiClient.post<Record<string, unknown>>(
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

  return mapInspectionRecordResponse(response.data);
}

/**
 * Record inspection result
 */
export async function recordInspectionResult(
  inspectionId: string,
  data: RecordInspectionResultRequest
): Promise<InspectionResultResponse> {
  const response = await apiClient.post<Record<string, unknown>>(
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

  return mapInspectionResultResponse(response.data);
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
