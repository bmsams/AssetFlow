/**
 * Transfer Service - Business logic layer for transfer order management
 *
 * Implements:
 * - Transfer order creation and management (Requirement 3.10)
 * - Approval workflow for transfers (Requirement 3.10)
 * - Inventory quantity updates on transfer completion (Requirement 3.10)
 */

import type { PaginatedResult, PaginationParams, UUID } from '@ams/types';
import * as cache from '@ams/cache';
import { publishEvent } from '@ams/events';
import { createLogger, now } from '@ams/utils';

import type {
  ApproveTransferRequest,
  CompleteTransferRequest,
  CreateTransferOrderRequest,
  LineReceiptRequest,
  RejectTransferRequest,
  ShipTransferRequest,
  TransferOrder,
  TransferOrderLine,
  TransferOrderStatus,
} from './transfer-repository';
import * as repository from './transfer-repository';
import * as stockroomRepository from '../stockroom/stockroom-repository';

const logger = createLogger({ service: 'transfer-service' });

/**
 * Transfer order result with lines
 */
export interface TransferOrderResult {
  readonly transfer: TransferOrder;
  readonly lines: TransferOrderLine[];
}

/**
 * Approval result
 */
export interface ApprovalResult {
  readonly transfer: TransferOrder;
  readonly approved: boolean;
  readonly message: string;
}

/**
 * Completion result
 */
export interface CompletionResult {
  readonly transfer: TransferOrder;
  readonly lines: TransferOrderLine[];
  readonly inventoryUpdated: boolean;
  readonly fromStockroomUpdated: boolean;
  readonly toStockroomUpdated: boolean;
}

/**
 * Cache key for transfer order
 */
function transferCacheKey(transferId: UUID): string {
  return `transfer:${transferId}`;
}

/**
 * Cache key for stockroom transfers
 */
function stockroomTransfersCacheKey(stockroomId: UUID): string {
  return `stockroom:${stockroomId}:transfers`;
}

/**
 * Valid status transitions
 */
const VALID_STATUS_TRANSITIONS: Record<TransferOrderStatus, TransferOrderStatus[]> = {
  DRAFT: ['PENDING_APPROVAL', 'CANCELLED'],
  PENDING_APPROVAL: ['APPROVED', 'REJECTED', 'CANCELLED', 'ON_HOLD'],
  APPROVED: ['IN_TRANSIT', 'CANCELLED', 'ON_HOLD'],
  REJECTED: [], // Terminal state
  IN_TRANSIT: ['PARTIALLY_RECEIVED', 'RECEIVED', 'CANCELLED'],
  PARTIALLY_RECEIVED: ['RECEIVED', 'COMPLETED'],
  RECEIVED: ['COMPLETED'],
  COMPLETED: [], // Terminal state
  CANCELLED: [], // Terminal state
  ON_HOLD: ['PENDING_APPROVAL', 'APPROVED', 'CANCELLED'],
};

/**
 * Validate status transition
 */
function isValidStatusTransition(
  currentStatus: TransferOrderStatus,
  newStatus: TransferOrderStatus
): boolean {
  return VALID_STATUS_TRANSITIONS[currentStatus]?.includes(newStatus) ?? false;
}

/**
 * Create a new transfer order
 * Requirement 3.10: Process asset movements between stockrooms with approval workflows
 */
export async function createTransfer(
  request: CreateTransferOrderRequest
): Promise<TransferOrderResult> {
  logger.info('Creating transfer order', {
    fromStockroomId: request.fromStockroomId,
    toStockroomId: request.toStockroomId,
    requestedBy: request.requestedBy,
    lineCount: request.lines.length,
  });

  // Validate stockrooms exist
  const fromStockroom = await stockroomRepository.getStockroomById(request.fromStockroomId);
  if (!fromStockroom) {
    throw new Error(`Source stockroom not found: ${request.fromStockroomId}`);
  }

  const toStockroom = await stockroomRepository.getStockroomById(request.toStockroomId);
  if (!toStockroom) {
    throw new Error(`Destination stockroom not found: ${request.toStockroomId}`);
  }

  // Validate stockrooms are different
  if (request.fromStockroomId === request.toStockroomId) {
    throw new Error('Source and destination stockrooms must be different');
  }

  // Validate at least one line item
  if (!request.lines || request.lines.length === 0) {
    throw new Error('Transfer order must have at least one line item');
  }

  // Validate each line has either assetId or productId
  for (let i = 0; i < request.lines.length; i++) {
    const line = request.lines[i]!;
    if (!line.assetId && !line.productId) {
      throw new Error(`Line ${i + 1} must have either assetId or productId`);
    }
    if (line.quantity <= 0) {
      throw new Error(`Line ${i + 1} quantity must be greater than 0`);
    }
  }

  // Create the transfer order
  const result = await repository.createTransfer(request);

  // Invalidate cache
  await cache.del(stockroomTransfersCacheKey(request.fromStockroomId));
  await cache.del(stockroomTransfersCacheKey(request.toStockroomId));

  // Publish transfer created event
  await publishEvent('TRANSFER_ORDER_CREATED', {
    transferId: result.transfer.transferId,
    transferNumber: result.transfer.transferNumber,
    fromStockroomId: result.transfer.fromStockroomId,
    fromStockroomName: fromStockroom.name,
    toStockroomId: result.transfer.toStockroomId,
    toStockroomName: toStockroom.name,
    requestedBy: result.transfer.requestedBy,
    status: result.transfer.status,
    priority: result.transfer.priority,
    totalQuantity: result.transfer.totalQuantity,
    lineCount: result.lines.length,
  });

  logger.info('Transfer order created', {
    transferId: result.transfer.transferId,
    transferNumber: result.transfer.transferNumber,
  });

  return result;
}

/**
 * Approve a transfer order
 * Requirement 3.10: Approval workflows for transfers
 */
export async function approveTransfer(
  transferId: UUID,
  request: ApproveTransferRequest
): Promise<ApprovalResult> {
  logger.info('Approving transfer order', { transferId, approvedBy: request.approvedBy });

  // Get the transfer order
  const transfer = await repository.getTransferById(transferId);
  if (!transfer) {
    throw new Error(`Transfer order not found: ${transferId}`);
  }

  // Validate status transition
  if (!isValidStatusTransition(transfer.status, 'APPROVED')) {
    throw new Error(`Cannot approve transfer in status: ${transfer.status}`);
  }

  const timestamp = now();

  // Update transfer status to approved
  const updatedTransfer = await repository.updateTransferStatus(transferId, 'APPROVED', {
    approvedBy: request.approvedBy,
    approvedDate: timestamp,
    updatedBy: request.approvedBy,
    notes: request.notes,
  });

  if (!updatedTransfer) {
    throw new Error(`Failed to approve transfer: ${transferId}`);
  }

  // Invalidate cache
  await cache.del(transferCacheKey(transferId));
  await cache.del(stockroomTransfersCacheKey(transfer.fromStockroomId));
  await cache.del(stockroomTransfersCacheKey(transfer.toStockroomId));

  // Publish approval event
  await publishEvent('TRANSFER_ORDER_APPROVED', {
    transferId: updatedTransfer.transferId,
    transferNumber: updatedTransfer.transferNumber,
    fromStockroomId: updatedTransfer.fromStockroomId,
    toStockroomId: updatedTransfer.toStockroomId,
    approvedBy: request.approvedBy,
    approvedDate: timestamp,
  });

  logger.info('Transfer order approved', {
    transferId: updatedTransfer.transferId,
    transferNumber: updatedTransfer.transferNumber,
    approvedBy: request.approvedBy,
  });

  return {
    transfer: updatedTransfer,
    approved: true,
    message: 'Transfer order approved successfully',
  };
}

/**
 * Reject a transfer order
 */
export async function rejectTransfer(
  transferId: UUID,
  request: RejectTransferRequest
): Promise<ApprovalResult> {
  logger.info('Rejecting transfer order', { transferId, rejectedBy: request.rejectedBy });

  // Get the transfer order
  const transfer = await repository.getTransferById(transferId);
  if (!transfer) {
    throw new Error(`Transfer order not found: ${transferId}`);
  }

  // Validate status transition
  if (!isValidStatusTransition(transfer.status, 'REJECTED')) {
    throw new Error(`Cannot reject transfer in status: ${transfer.status}`);
  }

  const timestamp = now();

  // Update transfer status to rejected
  const updatedTransfer = await repository.updateTransferStatus(transferId, 'REJECTED', {
    approvedBy: request.rejectedBy,
    approvedDate: timestamp,
    rejectionReason: request.rejectionReason,
    updatedBy: request.rejectedBy,
  });

  if (!updatedTransfer) {
    throw new Error(`Failed to reject transfer: ${transferId}`);
  }

  // Invalidate cache
  await cache.del(transferCacheKey(transferId));
  await cache.del(stockroomTransfersCacheKey(transfer.fromStockroomId));
  await cache.del(stockroomTransfersCacheKey(transfer.toStockroomId));

  // Publish rejection event
  await publishEvent('TRANSFER_ORDER_REJECTED', {
    transferId: updatedTransfer.transferId,
    transferNumber: updatedTransfer.transferNumber,
    fromStockroomId: updatedTransfer.fromStockroomId,
    toStockroomId: updatedTransfer.toStockroomId,
    rejectedBy: request.rejectedBy,
    rejectionReason: request.rejectionReason,
  });

  logger.info('Transfer order rejected', {
    transferId: updatedTransfer.transferId,
    transferNumber: updatedTransfer.transferNumber,
    rejectedBy: request.rejectedBy,
    reason: request.rejectionReason,
  });

  return {
    transfer: updatedTransfer,
    approved: false,
    message: `Transfer order rejected: ${request.rejectionReason}`,
  };
}

/**
 * Ship a transfer order
 */
export async function shipTransfer(
  transferId: UUID,
  request: ShipTransferRequest
): Promise<TransferOrderResult> {
  logger.info('Shipping transfer order', { transferId, shippedBy: request.shippedBy });

  // Get the transfer order
  const transfer = await repository.getTransferById(transferId);
  if (!transfer) {
    throw new Error(`Transfer order not found: ${transferId}`);
  }

  // Validate status transition
  if (!isValidStatusTransition(transfer.status, 'IN_TRANSIT')) {
    throw new Error(`Cannot ship transfer in status: ${transfer.status}`);
  }

  const timestamp = now();

  // Get transfer lines
  const lines = await repository.getTransferLines(transferId);

  // Update all lines to shipped
  for (const line of lines) {
    await repository.updateTransferLine(line.lineId, {
      shippedQuantity: line.quantity,
      shippedDate: timestamp,
      status: 'SHIPPED',
    });
  }

  // Calculate total shipped quantity
  const totalShippedQuantity = lines.reduce((sum, line) => sum + line.quantity, 0);

  // Update transfer status to in transit
  const updatedTransfer = await repository.updateTransferStatus(transferId, 'IN_TRANSIT', {
    shippedBy: request.shippedBy,
    shippedDate: timestamp,
    shippingMethod: request.shippingMethod,
    trackingNumber: request.trackingNumber,
    carrier: request.carrier,
    shippedQuantity: totalShippedQuantity,
    updatedBy: request.shippedBy,
    notes: request.notes,
  });

  if (!updatedTransfer) {
    throw new Error(`Failed to ship transfer: ${transferId}`);
  }

  // Get updated lines
  const updatedLines = await repository.getTransferLines(transferId);

  // Invalidate cache
  await cache.del(transferCacheKey(transferId));
  await cache.del(stockroomTransfersCacheKey(transfer.fromStockroomId));
  await cache.del(stockroomTransfersCacheKey(transfer.toStockroomId));

  // Publish shipped event
  await publishEvent('TRANSFER_ORDER_SHIPPED', {
    transferId: updatedTransfer.transferId,
    transferNumber: updatedTransfer.transferNumber,
    fromStockroomId: updatedTransfer.fromStockroomId,
    toStockroomId: updatedTransfer.toStockroomId,
    shippedBy: request.shippedBy,
    shippedDate: timestamp,
    trackingNumber: request.trackingNumber,
    carrier: request.carrier,
  });

  logger.info('Transfer order shipped', {
    transferId: updatedTransfer.transferId,
    transferNumber: updatedTransfer.transferNumber,
    shippedBy: request.shippedBy,
  });

  return { transfer: updatedTransfer, lines: updatedLines };
}

/**
 * Complete a transfer order (receive items and update inventory)
 * Requirement 3.10: Update inventory quantities on transfer completion
 */
export async function completeTransfer(
  transferId: UUID,
  request: CompleteTransferRequest
): Promise<CompletionResult> {
  logger.info('Completing transfer order', { transferId, receivedBy: request.receivedBy });

  // Get the transfer order
  const transfer = await repository.getTransferById(transferId);
  if (!transfer) {
    throw new Error(`Transfer order not found: ${transferId}`);
  }

  // Validate status allows completion
  const validStatuses: TransferOrderStatus[] = ['IN_TRANSIT', 'PARTIALLY_RECEIVED'];
  if (!validStatuses.includes(transfer.status)) {
    throw new Error(`Cannot complete transfer in status: ${transfer.status}`);
  }

  const timestamp = now();

  // Get current lines
  const currentLines = await repository.getTransferLines(transferId);

  // Create a map of line receipts for easy lookup
  const receiptMap = new Map<UUID, LineReceiptRequest>();
  for (const receipt of request.lineReceipts) {
    receiptMap.set(receipt.lineId, receipt);
  }

  // Validate no over-receipts (Task 6.1 — Requirement 5.5)
  for (const line of currentLines) {
    const receipt = receiptMap.get(line.lineId);
    if (receipt && receipt.receivedQuantity > line.shippedQuantity) {
      throw new Error(
        `OVER_RECEIPT: Received quantity (${receipt.receivedQuantity}) exceeds shipped quantity (${line.shippedQuantity}) for line ${line.lineId}`
      );
    }
  }

  // Update each line with receipt information
  let totalReceivedQuantity = 0;
  let allLinesReceived = true;

  for (const line of currentLines) {
    const receipt = receiptMap.get(line.lineId);
    if (receipt) {
      const receivedQty = receipt.receivedQuantity;
      const damagedQty = receipt.damagedQuantity ?? 0;

      await repository.updateTransferLine(line.lineId, {
        receivedQuantity: receivedQty,
        damagedQuantity: damagedQty,
        receivedDate: timestamp,
        status: receivedQty >= line.quantity ? 'RECEIVED' : 'PARTIALLY_RECEIVED',
        conditionReceived: receipt.conditionReceived,
        conditionNotes: receipt.conditionNotes,
      });

      // Audit log entry for line receipt (Task 6.2 — Requirement 5.4)
      logger.info('Transfer line received', {
        transferId,
        lineId: line.lineId,
        lineNumber: line.lineNumber,
        receivedBy: request.receivedBy,
        receivedQuantity: receivedQty,
        damagedQuantity: damagedQty,
        shippedQuantity: line.shippedQuantity,
        conditionReceived: receipt.conditionReceived ?? null,
        conditionNotes: receipt.conditionNotes ?? null,
        timestamp,
      });

      await publishEvent('TRANSFER_LINE_RECEIVED', {
        transferId,
        lineId: line.lineId,
        lineNumber: line.lineNumber,
        receivedBy: request.receivedBy,
        receivedQuantity: receivedQty,
        damagedQuantity: damagedQty,
        conditionReceived: receipt.conditionReceived ?? null,
        conditionNotes: receipt.conditionNotes ?? null,
        timestamp,
      });

      totalReceivedQuantity += receivedQty;

      if (receivedQty < line.quantity) {
        allLinesReceived = false;
      }
    } else {
      // Line not in receipt, check if already received
      if (line.receivedQuantity < line.quantity) {
        allLinesReceived = false;
      }
      totalReceivedQuantity += line.receivedQuantity;
    }
  }

  // Determine final status
  const finalStatus: TransferOrderStatus = allLinesReceived ? 'COMPLETED' : 'PARTIALLY_RECEIVED';

  // Update transfer status
  const updatedTransfer = await repository.updateTransferStatus(transferId, finalStatus, {
    receivedBy: request.receivedBy,
    receivedDate: timestamp,
    receivingNotes: request.receivingNotes,
    receivedQuantity: totalReceivedQuantity,
    completedDate: allLinesReceived ? timestamp : undefined,
    updatedBy: request.receivedBy,
  });

  if (!updatedTransfer) {
    throw new Error(`Failed to complete transfer: ${transferId}`);
  }

  // Update inventory quantities if transfer is completed
  let fromStockroomUpdated = false;
  let toStockroomUpdated = false;

  if (allLinesReceived) {
    // Update inventory for each line
    for (const line of currentLines) {
      const receipt = receiptMap.get(line.lineId);
      const receivedQty = receipt?.receivedQuantity ?? line.receivedQuantity;
      const damagedQty = receipt?.damagedQuantity ?? line.damagedQuantity;
      const goodQuantity = receivedQty - damagedQty;

      if (line.productId && line.productType) {
        // Decrease inventory at source stockroom
        const fromInventory = await stockroomRepository.getInventoryByProduct(
          transfer.fromStockroomId,
          line.productId,
          line.productType as stockroomRepository.ProductType
        );

        if (fromInventory) {
          await stockroomRepository.adjustInventoryQuantity(
            fromInventory.inventoryId,
            -line.quantity,
            'issued'
          );
          fromStockroomUpdated = true;
        }

        // Increase inventory at destination stockroom
        const toInventory = await stockroomRepository.getInventoryByProduct(
          transfer.toStockroomId,
          line.productId,
          line.productType as stockroomRepository.ProductType
        );

        if (toInventory) {
          await stockroomRepository.adjustInventoryQuantity(
            toInventory.inventoryId,
            goodQuantity,
            'received'
          );
          toStockroomUpdated = true;
        } else {
          // Create new inventory record at destination
          await stockroomRepository.createInventoryItem({
            stockroomId: transfer.toStockroomId,
            productId: line.productId,
            productType: line.productType as stockroomRepository.ProductType,
            productDescription: line.productDescription ?? undefined,
            quantityOnHand: goodQuantity,
          });
          toStockroomUpdated = true;
        }
      }
    }
  }

  // Get updated lines
  const updatedLines = await repository.getTransferLines(transferId);

  // Invalidate cache
  await cache.del(transferCacheKey(transferId));
  await cache.del(stockroomTransfersCacheKey(transfer.fromStockroomId));
  await cache.del(stockroomTransfersCacheKey(transfer.toStockroomId));

  // Publish completion event (includes building context — Task 6.3)
  await publishEvent('TRANSFER_ORDER_COMPLETED', {
    transferId: updatedTransfer.transferId,
    transferNumber: updatedTransfer.transferNumber,
    fromStockroomId: updatedTransfer.fromStockroomId,
    toStockroomId: updatedTransfer.toStockroomId,
    fromBuildingName: transfer.fromBuildingName ?? null,
    toBuildingName: transfer.toBuildingName ?? null,
    receivedBy: request.receivedBy,
    receivedDate: timestamp,
    status: finalStatus,
    totalReceivedQuantity,
    inventoryUpdated: fromStockroomUpdated || toStockroomUpdated,
  });

  logger.info('Transfer order completed', {
    transferId: updatedTransfer.transferId,
    transferNumber: updatedTransfer.transferNumber,
    status: finalStatus,
    totalReceivedQuantity,
    fromStockroomUpdated,
    toStockroomUpdated,
  });

  return {
    transfer: updatedTransfer,
    lines: updatedLines,
    inventoryUpdated: fromStockroomUpdated || toStockroomUpdated,
    fromStockroomUpdated,
    toStockroomUpdated,
  };
}

/**
 * Cancel a transfer order
 */
export async function cancelTransfer(
  transferId: UUID,
  cancelledBy: UUID,
  reason?: string
): Promise<TransferOrder> {
  logger.info('Cancelling transfer order', { transferId, cancelledBy });

  // Get the transfer order
  const transfer = await repository.getTransferById(transferId);
  if (!transfer) {
    throw new Error(`Transfer order not found: ${transferId}`);
  }

  // Validate status allows cancellation
  if (!isValidStatusTransition(transfer.status, 'CANCELLED')) {
    throw new Error(`Cannot cancel transfer in status: ${transfer.status}`);
  }

  const timestamp = now();

  // Update transfer status to cancelled
  const updatedTransfer = await repository.updateTransferStatus(transferId, 'CANCELLED', {
    cancelledDate: timestamp,
    cancellationReason: reason,
    updatedBy: cancelledBy,
  });

  if (!updatedTransfer) {
    throw new Error(`Failed to cancel transfer: ${transferId}`);
  }

  // Update all lines to cancelled
  const lines = await repository.getTransferLines(transferId);
  for (const line of lines) {
    if (line.status !== 'RECEIVED' && line.status !== 'CANCELLED') {
      await repository.updateTransferLine(line.lineId, {
        status: 'CANCELLED',
      });
    }
  }

  // Invalidate cache
  await cache.del(transferCacheKey(transferId));
  await cache.del(stockroomTransfersCacheKey(transfer.fromStockroomId));
  await cache.del(stockroomTransfersCacheKey(transfer.toStockroomId));

  // Publish cancellation event
  await publishEvent('TRANSFER_ORDER_CANCELLED', {
    transferId: updatedTransfer.transferId,
    transferNumber: updatedTransfer.transferNumber,
    fromStockroomId: updatedTransfer.fromStockroomId,
    toStockroomId: updatedTransfer.toStockroomId,
    cancelledBy,
    cancellationReason: reason,
  });

  logger.info('Transfer order cancelled', {
    transferId: updatedTransfer.transferId,
    transferNumber: updatedTransfer.transferNumber,
    cancelledBy,
    reason,
  });

  return updatedTransfer;
}

/**
 * Get transfer order with lines
 */
export async function getTransfer(transferId: UUID): Promise<TransferOrderResult | null> {
  const transfer = await repository.getTransferById(transferId);
  if (!transfer) {
    return null;
  }

  const lines = await repository.getTransferLines(transferId);
  return { transfer, lines };
}

/**
 * Get transfer order by number
 */
export async function getTransferByNumber(transferNumber: string): Promise<TransferOrderResult | null> {
  const transfer = await repository.getTransferByNumber(transferNumber);
  if (!transfer) {
    return null;
  }

  const lines = await repository.getTransferLines(transfer.transferId);
  return { transfer, lines };
}

/**
 * List all transfers with optional status filter
 */
export async function listTransfers(
  pagination: PaginationParams = {},
  statusFilter?: TransferOrderStatus[]
): Promise<PaginatedResult<TransferOrder>> {
  return repository.listTransfers(pagination, statusFilter);
}

/**
 * Get transfers for a stockroom
 */
export async function getStockroomTransfers(
  stockroomId: UUID,
  direction: 'from' | 'to' | 'both' = 'both',
  pagination: PaginationParams = {},
  statusFilter?: TransferOrderStatus[],
  buildingFilter?: { fromBuildingId?: UUID; toBuildingId?: UUID }
): Promise<PaginatedResult<TransferOrder>> {
  return repository.getTransfersByStockroom(stockroomId, direction, pagination, statusFilter, buildingFilter);
}

/**
 * Get pending approval transfers
 */
export async function getPendingApprovals(
  pagination: PaginationParams = {}
): Promise<PaginatedResult<TransferOrder>> {
  return repository.getPendingApprovalTransfers(pagination);
}

// Re-export types
export type {
  ApproveTransferRequest,
  AssetCondition,
  CompleteTransferRequest,
  CreateTransferLineRequest,
  CreateTransferOrderRequest,
  LineReceiptRequest,
  RejectTransferRequest,
  ShipTransferRequest,
  TransferLineStatus,
  TransferOrder,
  TransferOrderLine,
  TransferOrderStatus,
  TransferPriority,
} from './transfer-repository';

