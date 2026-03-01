/**
 * Receiving Service - Business logic layer for receiving operations
 *
 * Implements:
 * - Recording receiving of assets (Requirement 6.4, 6.5)
 * - Barcode scanning for asset creation (Requirement 6.4)
 * - Linking assets to purchase orders (Requirement 6.5)
 * - Updating asset status to In_Stock (Requirement 6.5)
 * - Quality inspection workflow (Requirement 13)
 */

import type { PaginatedResult, PaginationParams, UUID } from '@ams/types';
import { publishEvent } from '@ams/events';
import { createLogger } from '@ams/utils';

import type {
  InspectionHistoryFilter,
  InspectionRecord,
  InspectionResult,
  ReceivingCondition,
  ReceivingLine,
  ReceivingRecord,
  RecordAssetScanInput,
  ScannedAsset,
} from './receiving-repository';
import * as repository from './receiving-repository';

const logger = createLogger({ service: 'receiving-service' });

/**
 * Result of recording receiving
 */
export interface RecordReceivingResult {
  readonly receivingRecord: ReceivingRecord;
  readonly lines: ReceivingLine[];
}

/**
 * Result of scanning an asset
 */
export interface ScanAssetResult {
  readonly asset: ScannedAsset;
  readonly receivingLine: ReceivingLine;
  readonly receivingRecord: ReceivingRecord;
  readonly isLineComplete: boolean;
  readonly isReceivingComplete: boolean;
}

/**
 * Input for recording receiving from a purchase order
 */
export interface RecordReceivingFromPOInput {
  readonly poId: UUID;
  readonly receivedBy: UUID;
  readonly receivedByName?: string;
  readonly stockroomId?: UUID;
  readonly notes?: string;
  readonly poLineIds?: UUID[]; // Specific lines to receive, or all if not specified
}

/**
 * Input for recording receiving without a purchase order
 */
export interface RecordReceivingManualInput {
  readonly receivedBy: UUID;
  readonly receivedByName?: string;
  readonly stockroomId?: UUID;
  readonly notes?: string;
  readonly lines: Array<{
    productName: string;
    productId?: UUID;
    productType?: string;
    quantityExpected: number;
    notes?: string;
  }>;
}

/**
 * Input for scanning an asset
 */
export interface ScanAssetInput {
  readonly receivingLineId: UUID;
  readonly serialNumber?: string;
  readonly barcode?: string;
  readonly condition?: ReceivingCondition;
  readonly productName?: string;
  readonly productType?: string;
  readonly notes?: string;
}

/**
 * Input for marking items for inspection
 * Requirement 13.1: Mark received items for quality inspection
 */
export interface MarkForInspectionInput {
  readonly receivingLineId: UUID;
  readonly assetId?: UUID;
  readonly serialNumber?: string;
  readonly notes?: string;
  readonly markedBy: UUID;
  readonly markedByName?: string;
}

/**
 * Result of marking item for inspection
 */
export interface MarkForInspectionResult {
  readonly inspectionRecord: InspectionRecord;
  readonly receivingLine: ReceivingLine;
}

/**
 * Input for recording inspection result
 * Requirement 13.2: Record inspection results (pass/fail with notes)
 */
export interface RecordInspectionResultInput {
  readonly inspectionId: UUID;
  readonly inspectedBy: UUID;
  readonly inspectedByName?: string;
  readonly result: InspectionResult;
  readonly notes?: string;
  readonly failureReason?: string;
}

/**
 * Result of recording inspection
 */
export interface RecordInspectionResultResult {
  readonly inspectionRecord: InspectionRecord;
  readonly assetCreated?: ScannedAsset;
  readonly routedToReturn: boolean;
}

/**
 * Record receiving from a purchase order
 * Requirement 6.4, 6.5: Record receiving of assets and link to purchase order
 */
export async function recordReceivingFromPO(
  input: RecordReceivingFromPOInput
): Promise<RecordReceivingResult> {
  logger.info('Recording receiving from PO', {
    poId: input.poId,
    receivedBy: input.receivedBy,
    stockroomId: input.stockroomId,
  });

  // Validate PO exists and get its lines
  const { queryMany, queryOne } = await import('@ams/database');
  
  const poRow = await queryOne<{ po_id: string; status: string; po_number: string }>(
    'SELECT po_id, status, po_number FROM purchase_orders WHERE po_id = $1',
    [input.poId]
  );

  if (!poRow) {
    throw new Error(`Purchase order not found: ${input.poId}`);
  }

  // Check PO is in a receivable status
  const receivableStatuses = ['APPROVED', 'SENT', 'PARTIALLY_RECEIVED'];
  if (!receivableStatuses.includes(poRow.status)) {
    throw new Error(`Purchase order cannot be received in status: ${poRow.status}`);
  }

  // Get PO lines to receive
  let poLineQuery = `
    SELECT line_id, quantity, received_quantity as received_quantity
    FROM purchase_order_lines
    WHERE po_id = $1
      AND received_quantity < quantity
  `;
  const poLineParams: (string | string[])[] = [input.poId];

  if (input.poLineIds && input.poLineIds.length > 0) {
    poLineQuery += ' AND line_id = ANY($2)';
    poLineParams.push(input.poLineIds);
  }

  const poLines = await queryMany<{ line_id: string; quantity: number; received_quantity: number }>(
    poLineQuery,
    poLineParams
  );

  if (poLines.length === 0) {
    throw new Error('No receivable lines found for this purchase order');
  }

  const activeReceivingRecord = (await repository.getReceivingRecordsByPO(input.poId)).find(
    (record) => record.status === 'PENDING' || record.status === 'IN_PROGRESS'
  );

  if (activeReceivingRecord) {
    const existingLines = await repository.getReceivingLines(activeReceivingRecord.receivingId);
    const existingPOLineIds = new Set(
      existingLines
        .map((line) => line.poLineId)
        .filter((poLineId): poLineId is UUID => typeof poLineId === 'string' && poLineId.length > 0)
    );

    let createdLineCount = 0;
    for (const poLine of poLines) {
      const remainingQuantity = poLine.quantity - poLine.received_quantity;
      if (remainingQuantity <= 0 || existingPOLineIds.has(poLine.line_id)) {
        continue;
      }

      try {
        await repository.createReceivingLineFromPO(activeReceivingRecord.receivingId, poLine.line_id);
        createdLineCount += 1;
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        if (message.includes('no remaining quantity to receive')) {
          continue;
        }
        throw error;
      }
    }

    const lines =
      createdLineCount > 0
        ? await repository.getReceivingLines(activeReceivingRecord.receivingId)
        : existingLines;

    if (lines.length === 0) {
      throw new Error('No receivable lines found for this purchase order');
    }

    const updatedRecord =
      (await repository.getReceivingRecordById(activeReceivingRecord.receivingId)) ??
      activeReceivingRecord;

    logger.info('Reusing active receiving record for PO', {
      receivingId: updatedRecord.receivingId,
      poId: input.poId,
      existingLineCount: existingLines.length,
      createdLineCount,
      totalLineCount: lines.length,
    });

    return {
      receivingRecord: updatedRecord,
      lines,
    };
  }

  // Create receiving record
  const receivingRecord = await repository.createReceivingRecord({
    poId: input.poId,
    receivedBy: input.receivedBy,
    receivedByName: input.receivedByName,
    stockroomId: input.stockroomId,
    notes: input.notes,
  });

  // Create receiving lines from PO lines
  const lines: ReceivingLine[] = [];
  for (const poLine of poLines) {
    const remainingQuantity = poLine.quantity - poLine.received_quantity;
    if (remainingQuantity <= 0) {
      continue;
    }

    try {
      const line = await repository.createReceivingLineFromPO(
        receivingRecord.receivingId,
        poLine.line_id
      );
      lines.push(line);
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      if (!message.includes('no remaining quantity to receive')) {
        throw error;
      }
    }
  }

  if (lines.length === 0) {
    await repository.updateReceivingRecordStatus(receivingRecord.receivingId, 'CANCELLED');
    throw new Error('No receivable lines found for this purchase order');
  }

  // Publish event
  await publishEvent('RECEIVING_STARTED', {
    receivingId: receivingRecord.receivingId,
    poId: input.poId,
    poNumber: poRow.po_number,
    receivedBy: input.receivedBy,
    stockroomId: input.stockroomId,
    lineCount: lines.length,
    totalQuantityExpected: lines.reduce((sum, l) => sum + l.quantityExpected, 0),
  });

  logger.info('Receiving record created from PO', {
    receivingId: receivingRecord.receivingId,
    poId: input.poId,
    lineCount: lines.length,
  });

  // Refresh receiving record to get updated totals
  const updatedRecord = await repository.getReceivingRecordById(receivingRecord.receivingId);

  return {
    receivingRecord: updatedRecord ?? receivingRecord,
    lines,
  };
}

/**
 * Record receiving manually (without a purchase order)
 * Requirement 6.4: Support receiving without PO for walk-in deliveries
 */
export async function recordReceivingManual(
  input: RecordReceivingManualInput
): Promise<RecordReceivingResult> {
  logger.info('Recording manual receiving', {
    receivedBy: input.receivedBy,
    stockroomId: input.stockroomId,
    lineCount: input.lines.length,
  });

  // Validate input
  if (!input.lines || input.lines.length === 0) {
    throw new Error('At least one line is required for receiving');
  }

  for (let i = 0; i < input.lines.length; i++) {
    const line = input.lines[i]!;
    if (!line.productName || line.productName.trim().length === 0) {
      throw new Error(`Line ${i + 1}: Product name is required`);
    }
    if (line.quantityExpected <= 0) {
      throw new Error(`Line ${i + 1}: Quantity expected must be greater than 0`);
    }
  }

  // Create receiving record
  const receivingRecord = await repository.createReceivingRecord({
    receivedBy: input.receivedBy,
    receivedByName: input.receivedByName,
    stockroomId: input.stockroomId,
    notes: input.notes,
  });

  // Create receiving lines
  const lines: ReceivingLine[] = [];
  for (const lineInput of input.lines) {
    const line = await repository.createReceivingLine({
      receivingId: receivingRecord.receivingId,
      productId: lineInput.productId,
      productType: lineInput.productType,
      productName: lineInput.productName,
      quantityExpected: lineInput.quantityExpected,
      notes: lineInput.notes,
    });
    lines.push(line);
  }

  // Publish event
  await publishEvent('RECEIVING_STARTED', {
    receivingId: receivingRecord.receivingId,
    poId: null,
    receivedBy: input.receivedBy,
    stockroomId: input.stockroomId,
    lineCount: lines.length,
    totalQuantityExpected: lines.reduce((sum, l) => sum + l.quantityExpected, 0),
  });

  logger.info('Manual receiving record created', {
    receivingId: receivingRecord.receivingId,
    lineCount: lines.length,
  });

  // Refresh receiving record to get updated totals
  const updatedRecord = await repository.getReceivingRecordById(receivingRecord.receivingId);

  return {
    receivingRecord: updatedRecord ?? receivingRecord,
    lines,
  };
}

/**
 * Scan asset and create asset record
 * Requirement 6.4: Support barcode scanning to create asset records automatically
 * Requirement 6.5: Update status to In_Stock and associate with purchase order
 */
export async function scanAsset(input: ScanAssetInput): Promise<ScanAssetResult> {
  logger.info('Scanning asset', {
    receivingLineId: input.receivingLineId,
    serialNumber: input.serialNumber,
    barcode: input.barcode,
  });

  // Validate input - need either serial number or barcode
  if (!input.serialNumber && !input.barcode) {
    // Allow scanning without serial/barcode for items that don't have them
    logger.info('Scanning asset without serial number or barcode');
  }

  // Record the scan and create the asset
  const scanInput: RecordAssetScanInput = {
    receivingLineId: input.receivingLineId,
    serialNumber: input.serialNumber,
    barcode: input.barcode,
    condition: input.condition,
    productName: input.productName,
    productType: input.productType,
    notes: input.notes,
  };

  const asset = await repository.recordAssetScan(scanInput);

  // Get updated receiving line and record
  const receivingLine = await repository.getReceivingLineById(input.receivingLineId);
  if (!receivingLine) {
    throw new Error(`Receiving line not found after scan: ${input.receivingLineId}`);
  }

  const receivingRecord = await repository.getReceivingRecordById(receivingLine.receivingId);
  if (!receivingRecord) {
    throw new Error(`Receiving record not found: ${receivingLine.receivingId}`);
  }

  const isLineComplete = receivingLine.quantityReceived >= receivingLine.quantityExpected;
  const isReceivingComplete = receivingRecord.status === 'COMPLETED';

  // Publish asset created event
  await publishEvent('ASSET_CREATED', {
    assetId: asset.assetId,
    assetTag: asset.assetTag,
    serialNumber: asset.serialNumber,
    productName: asset.productName,
    status: asset.status,
    receivingId: asset.receivingId,
    receivingLineId: asset.receivingLineId,
    poId: asset.poId,
    createdVia: 'RECEIVING_SCAN',
  });

  // Publish receiving progress event
  await publishEvent('RECEIVING_PROGRESS', {
    receivingId: receivingRecord.receivingId,
    poId: receivingRecord.poId,
    totalQuantityExpected: receivingRecord.totalQuantityExpected,
    totalQuantityReceived: receivingRecord.totalQuantityReceived,
    status: receivingRecord.status,
    isComplete: isReceivingComplete,
    latestAssetId: asset.assetId,
    latestAssetTag: asset.assetTag,
  });

  // If receiving is complete, publish completion event
  if (isReceivingComplete) {
    await publishEvent('RECEIVING_COMPLETED', {
      receivingId: receivingRecord.receivingId,
      poId: receivingRecord.poId,
      poNumber: receivingRecord.poNumber,
      totalQuantityReceived: receivingRecord.totalQuantityReceived,
      stockroomId: receivingRecord.stockroomId,
      receivedBy: receivingRecord.receivedBy,
    });

    logger.info('Receiving completed', {
      receivingId: receivingRecord.receivingId,
      totalQuantityReceived: receivingRecord.totalQuantityReceived,
    });
  }

  logger.info('Asset scanned successfully', {
    assetId: asset.assetId,
    assetTag: asset.assetTag,
    receivingLineId: input.receivingLineId,
    isLineComplete,
    isReceivingComplete,
  });

  return {
    asset,
    receivingLine,
    receivingRecord,
    isLineComplete,
    isReceivingComplete,
  };
}

/**
 * Get receiving record by ID with lines
 */
export async function getReceivingRecord(
  receivingId: UUID
): Promise<RecordReceivingResult | null> {
  const receivingRecord = await repository.getReceivingRecordById(receivingId);
  if (!receivingRecord) {
    return null;
  }

  const lines = await repository.getReceivingLines(receivingId);
  return { receivingRecord, lines };
}

/**
 * Get receiving line by ID
 */
export async function getReceivingLine(
  receivingLineId: UUID
): Promise<ReceivingLine | null> {
  return repository.getReceivingLineById(receivingLineId);
}

/**
 * Get receiving records for a purchase order
 */
export async function getReceivingRecordsByPO(poId: UUID): Promise<ReceivingRecord[]> {
  return repository.getReceivingRecordsByPO(poId);
}

/**
 * Get assets created from a receiving record
 */
export async function getAssetsFromReceiving(receivingId: UUID): Promise<ScannedAsset[]> {
  return repository.getAssetsFromReceiving(receivingId);
}

/**
 * Cancel a receiving record
 */
export async function cancelReceiving(
  receivingId: UUID,
  cancelledBy: UUID,
  reason?: string
): Promise<ReceivingRecord> {
  logger.info('Cancelling receiving', { receivingId, cancelledBy, reason });

  const receivingRecord = await repository.getReceivingRecordById(receivingId);
  if (!receivingRecord) {
    throw new Error(`Receiving record not found: ${receivingId}`);
  }

  if (receivingRecord.status === 'COMPLETED') {
    throw new Error('Cannot cancel a completed receiving record');
  }

  if (receivingRecord.status === 'CANCELLED') {
    throw new Error('Receiving record is already cancelled');
  }

  // Check if any assets have been created
  if (receivingRecord.totalQuantityReceived > 0) {
    throw new Error(
      `Cannot cancel receiving with ${receivingRecord.totalQuantityReceived} assets already received. ` +
      'Please handle the received assets separately.'
    );
  }

  const updatedRecord = await repository.updateReceivingRecordStatus(receivingId, 'CANCELLED');
  if (!updatedRecord) {
    throw new Error(`Failed to cancel receiving record: ${receivingId}`);
  }

  // Publish event
  await publishEvent('RECEIVING_CANCELLED', {
    receivingId,
    poId: receivingRecord.poId,
    cancelledBy,
    reason,
  });

  logger.info('Receiving cancelled', { receivingId, cancelledBy });

  return updatedRecord;
}

/**
 * Complete a receiving record manually
 */
export async function completeReceiving(
  receivingId: UUID,
  completedBy: UUID,
  notes?: string
): Promise<ReceivingRecord> {
  logger.info('Completing receiving', { receivingId, completedBy });

  const receivingRecord = await repository.getReceivingRecordById(receivingId);
  if (!receivingRecord) {
    throw new Error(`Receiving record not found: ${receivingId}`);
  }

  if (receivingRecord.status === 'COMPLETED') {
    return receivingRecord; // Already complete
  }

  if (receivingRecord.status === 'CANCELLED') {
    throw new Error('Cannot complete a cancelled receiving record');
  }

  const updatedRecord = await repository.updateReceivingRecordStatus(receivingId, 'COMPLETED');
  if (!updatedRecord) {
    throw new Error(`Failed to complete receiving record: ${receivingId}`);
  }

  // Publish event
  await publishEvent('RECEIVING_COMPLETED', {
    receivingId,
    poId: receivingRecord.poId,
    poNumber: receivingRecord.poNumber,
    totalQuantityReceived: receivingRecord.totalQuantityReceived,
    stockroomId: receivingRecord.stockroomId,
    receivedBy: receivingRecord.receivedBy,
    completedBy,
    notes,
    manualCompletion: true,
  });

  logger.info('Receiving completed manually', {
    receivingId,
    totalQuantityReceived: receivingRecord.totalQuantityReceived,
    completedBy,
  });

  return updatedRecord;
}

/**
 * Mark a received item for quality inspection
 * Requirement 13.1: Mark received items for quality inspection
 * Requirement 13.5: Create inspection records and hold asset creation until inspection passes
 */
export async function markForInspection(
  input: MarkForInspectionInput
): Promise<MarkForInspectionResult> {
  logger.info('Marking item for inspection', {
    receivingLineId: input.receivingLineId,
    assetId: input.assetId,
    serialNumber: input.serialNumber,
    markedBy: input.markedBy,
  });

  // Verify receiving line exists
  const receivingLine = await repository.getReceivingLineById(input.receivingLineId);
  if (!receivingLine) {
    throw new Error(`Receiving line not found: ${input.receivingLineId}`);
  }

  // Create inspection record
  const inspectionRecord = await repository.createInspectionRecord({
    receivingLineId: input.receivingLineId,
    assetId: input.assetId,
    serialNumber: input.serialNumber,
    notes: input.notes,
  });

  // Publish event
  await publishEvent('INSPECTION_REQUIRED', {
    inspectionId: inspectionRecord.inspectionId,
    receivingLineId: input.receivingLineId,
    receivingId: receivingLine.receivingId,
    assetId: input.assetId,
    serialNumber: input.serialNumber,
    markedBy: input.markedBy,
    markedByName: input.markedByName,
  });

  logger.info('Item marked for inspection', {
    inspectionId: inspectionRecord.inspectionId,
    receivingLineId: input.receivingLineId,
  });

  return {
    inspectionRecord,
    receivingLine,
  };
}

/**
 * Record inspection result
 * Requirement 13.2: Record inspection results (pass/fail with notes)
 * Requirement 13.3: Route failed inspections to return workflow
 */
export async function recordInspectionResult(
  input: RecordInspectionResultInput
): Promise<RecordInspectionResultResult> {
  logger.info('Recording inspection result', {
    inspectionId: input.inspectionId,
    result: input.result,
    inspectedBy: input.inspectedBy,
  });

  // Get current inspection record
  const currentInspection = await repository.getInspectionRecordById(input.inspectionId);
  if (!currentInspection) {
    throw new Error(`Inspection record not found: ${input.inspectionId}`);
  }

  // Validate inspection is in a state that can be completed
  if (currentInspection.inspectionStatus === 'PASSED' || currentInspection.inspectionStatus === 'FAILED') {
    throw new Error(`Inspection already completed with result: ${currentInspection.result}`);
  }

  // Record the result
  const inspectionRecord = await repository.recordInspectionResult({
    inspectionId: input.inspectionId,
    inspectedBy: input.inspectedBy,
    inspectedByName: input.inspectedByName,
    result: input.result,
    notes: input.notes,
    failureReason: input.failureReason,
  });

  let assetCreated: ScannedAsset | undefined;
  let routedToReturn = false;

  // Get receiving line for context
  const receivingLine = await repository.getReceivingLineById(inspectionRecord.receivingLineId);
  if (!receivingLine) {
    throw new Error(`Receiving line not found: ${inspectionRecord.receivingLineId}`);
  }

  if (input.result === 'PASSED') {
    // If inspection passed and no asset exists yet, create the asset
    if (!inspectionRecord.assetId) {
      logger.info('Inspection passed, creating asset', {
        inspectionId: input.inspectionId,
        serialNumber: inspectionRecord.serialNumber,
      });

      // Create asset via scan
      assetCreated = await repository.recordAssetScan({
        receivingLineId: inspectionRecord.receivingLineId,
        serialNumber: inspectionRecord.serialNumber ?? undefined,
        condition: 'NEW',
        notes: `Created after passing inspection ${inspectionRecord.inspectionId}`,
      });

      logger.info('Asset created after inspection passed', {
        assetId: assetCreated.assetId,
        assetTag: assetCreated.assetTag,
        inspectionId: input.inspectionId,
      });
    }

    // Publish inspection passed event
    await publishEvent('INSPECTION_PASSED', {
      inspectionId: inspectionRecord.inspectionId,
      receivingLineId: inspectionRecord.receivingLineId,
      receivingId: receivingLine.receivingId,
      assetId: assetCreated?.assetId ?? inspectionRecord.assetId,
      serialNumber: inspectionRecord.serialNumber,
      inspectedBy: input.inspectedBy,
      inspectedByName: input.inspectedByName,
    });
  } else {
    // Inspection failed - route to return workflow
    routedToReturn = true;

    // Publish inspection failed event
    await publishEvent('INSPECTION_FAILED', {
      inspectionId: inspectionRecord.inspectionId,
      receivingLineId: inspectionRecord.receivingLineId,
      receivingId: receivingLine.receivingId,
      assetId: inspectionRecord.assetId,
      serialNumber: inspectionRecord.serialNumber,
      inspectedBy: input.inspectedBy,
      inspectedByName: input.inspectedByName,
      failureReason: input.failureReason,
      routedToReturn: true,
    });

    logger.info('Inspection failed, routing to return workflow', {
      inspectionId: input.inspectionId,
      failureReason: input.failureReason,
    });
  }

  logger.info('Inspection result recorded', {
    inspectionId: input.inspectionId,
    result: input.result,
    assetCreated: assetCreated?.assetId,
    routedToReturn,
  });

  return {
    inspectionRecord,
    assetCreated,
    routedToReturn,
  };
}

/**
 * Get inspection record by ID
 */
export async function getInspectionRecord(inspectionId: UUID): Promise<InspectionRecord | null> {
  return repository.getInspectionRecordById(inspectionId);
}

/**
 * Get inspection records for a receiving line
 */
export async function getInspectionsByReceivingLine(
  receivingLineId: UUID
): Promise<InspectionRecord[]> {
  return repository.getInspectionRecordsByReceivingLine(receivingLineId);
}

/**
 * Get inspection records for a receiving record
 */
export async function getInspectionsByReceiving(receivingId: UUID): Promise<InspectionRecord[]> {
  return repository.getInspectionRecordsByReceiving(receivingId);
}

/**
 * Get inspection history for an asset
 * Requirement 13.4: Track inspection history per asset
 */
export async function getInspectionHistoryByAsset(assetId: UUID): Promise<InspectionRecord[]> {
  return repository.getInspectionHistoryByAsset(assetId);
}

/**
 * Get inspection records with filters
 * Requirement 13.4: Track inspection history per asset
 */
export async function getInspectionRecords(
  filter: InspectionHistoryFilter,
  pagination?: PaginationParams
): Promise<PaginatedResult<InspectionRecord>> {
  return repository.getInspectionRecords(filter, pagination);
}

/**
 * Get pending inspections count for a receiving record
 */
export async function getPendingInspectionsCount(receivingId: UUID): Promise<number> {
  return repository.getPendingInspectionsCount(receivingId);
}

/**
 * Get failed inspections for a receiving record
 */
export async function getFailedInspections(receivingId: UUID): Promise<InspectionRecord[]> {
  return repository.getFailedInspections(receivingId);
}

/**
 * Route a failed inspection to return workflow
 * Requirement 13.3: Route failed inspections to return workflow
 */
export async function routeInspectionToReturn(
  inspectionId: UUID,
  returnOrderId: UUID,
  routedBy: UUID
): Promise<InspectionRecord> {
  logger.info('Routing inspection to return', {
    inspectionId,
    returnOrderId,
    routedBy,
  });

  const inspectionRecord = await repository.routeInspectionToReturn(inspectionId, returnOrderId);

  // Publish event
  await publishEvent('INSPECTION_ROUTED_TO_RETURN', {
    inspectionId,
    returnOrderId,
    routedBy,
    assetId: inspectionRecord.assetId,
    serialNumber: inspectionRecord.serialNumber,
    failureReason: inspectionRecord.failureReason,
  });

  logger.info('Inspection routed to return', {
    inspectionId,
    returnOrderId,
  });

  return inspectionRecord;
}

// Re-export types
export type {
  CreateInspectionRecordInput,
  CreateReceivingLineInput,
  CreateReceivingRecordInput,
  InspectionHistoryFilter,
  InspectionRecord,
  InspectionResult,
  InspectionStatus,
  ReceivingCondition,
  ReceivingLine,
  ReceivingRecord,
  ReceivingStatus,
  RecordAssetScanInput,
  ScannedAsset,
} from './receiving-repository';
