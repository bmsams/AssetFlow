/**
 * Purchase Order Service
 *
 * Business logic layer for purchase order management.
 * Handles PO lifecycle, line item operations, and total calculations.
 *
 * Requirements: 16.1-16.12
 */

import type {
  CreatePOLineRequest,
  CreatePurchaseOrderRequest,
  PaginatedResult,
  PaginationParams,
  POListFilters,
  PurchaseOrder,
  PurchaseOrderWithLines,
  UpdatePOLineRequest,
  UpdatePurchaseOrderRequest,
  UUID,
} from '@ams/types';
import * as cache from '@ams/cache';
import { CACHE_ENTITY_TYPES, entityKey } from '@ams/cache';
import { publishEvent } from '@ams/events';
import { createLogger } from '@ams/utils';

import * as accountingService from '../accounting/accounting-service';
import * as repository from './po-repository';
import {
  toGovernanceLineInput,
  validatePurchaseOrderGovernance,
} from './vendor-governance';

const logger = createLogger({ service: 'po-service' });

// ============================================================================
// Cache Keys
// ============================================================================

function poCacheKey(poId: UUID): string {
  return entityKey(CACHE_ENTITY_TYPES.PURCHASE_ORDER, poId);
}

// ============================================================================
// Status Validation
// ============================================================================

// Status type that accepts both POStatus and PurchaseOrderStatus
type AnyPOStatus = string;

const EDITABLE_STATUSES: string[] = ['DRAFT'];
const SUBMITTABLE_STATUSES: string[] = ['DRAFT', 'REJECTED'];
const APPROVABLE_STATUSES: string[] = ['PENDING_APPROVAL'];
const SENDABLE_STATUSES: string[] = ['APPROVED'];
const CANCELLABLE_STATUSES: string[] = ['DRAFT', 'PENDING_APPROVAL', 'REJECTED'];
const CLOSEABLE_STATUSES: string[] = ['SENT', 'PARTIALLY_RECEIVED', 'RECEIVED'];
const ACCOUNTING_TRANSITION_STATUSES: string[] = ['APPROVED', 'SENT', 'PARTIALLY_RECEIVED', 'RECEIVED'];

/**
 * Check if PO can be edited
 */
export function canEditPO(status: AnyPOStatus): boolean {
  return EDITABLE_STATUSES.includes(status);
}

/**
 * Check if PO can be submitted for approval
 */
export function canSubmitPO(status: AnyPOStatus): boolean {
  return SUBMITTABLE_STATUSES.includes(status);
}

/**
 * Check if PO can be approved/rejected
 */
export function canApprovePO(status: AnyPOStatus): boolean {
  return APPROVABLE_STATUSES.includes(status);
}

/**
 * Check if PO can be sent to vendor
 */
export function canSendPO(status: AnyPOStatus): boolean {
  return SENDABLE_STATUSES.includes(status);
}

/**
 * Check if PO can be cancelled
 */
export function canCancelPO(status: AnyPOStatus): boolean {
  return CANCELLABLE_STATUSES.includes(status);
}

/**
 * Check if PO can be closed
 */
export function canClosePO(status: AnyPOStatus): boolean {
  return CLOSEABLE_STATUSES.includes(status);
}

function canPostAccountingTransition(status: AnyPOStatus): boolean {
  return ACCOUNTING_TRANSITION_STATUSES.includes(status);
}


// ============================================================================
// Purchase Order Operations
// ============================================================================

/**
 * Create a new purchase order
 * Requirement 16.1: Create PO with vendor, cost center, and line items
 */
export async function createPurchaseOrder(
  request: CreatePurchaseOrderRequest,
  lines?: CreatePOLineRequest[]
): Promise<PurchaseOrderWithLines> {
  logger.info('Creating purchase order', {
    vendorId: request.vendorId,
    costCenterId: request.costCenterId,
    lineCount: lines?.length ?? 0,
  });

  await validatePurchaseOrderGovernance({
    vendorId: request.vendorId,
    costCenterId: request.costCenterId,
    currency: request.currency,
    lines: (lines ?? []).map(toGovernanceLineInput),
  });

  const updatedPO = await repository.createPurchaseOrderWithLines(request, lines ?? []);

  // Publish event
  await publishEvent('PURCHASE_ORDER_CREATED', {
    poId: updatedPO.poId,
    poNumber: updatedPO.poNumber,
    vendorId: updatedPO.vendorId,
    vendorName: updatedPO.vendorName,
    costCenterId: updatedPO.costCenterId,
    totalAmount: updatedPO.totalAmount,
    lineCount: updatedPO.lines.length,
  });

  logger.info('Purchase order created', {
    poId: updatedPO.poId,
    poNumber: updatedPO.poNumber,
    totalAmount: updatedPO.totalAmount,
  });

  return updatedPO;
}

/**
 * Get purchase order by ID
 * Requirement 16.9: Return complete PO details including all line items
 */
export async function getPurchaseOrder(poId: UUID): Promise<PurchaseOrderWithLines | null> {
  const cacheKey = poCacheKey(poId);

  return cache.getOrSet(
    cacheKey,
    () => repository.getPurchaseOrderWithLines(poId),
    { ttl: cache.DEFAULT_TTL.SHORT }
  );
}

/**
 * Update purchase order
 * Requirement 16.12: Reject modification of approved or sent PO
 */
export async function updatePurchaseOrder(
  poId: UUID,
  request: UpdatePurchaseOrderRequest
): Promise<PurchaseOrderWithLines> {
  logger.info('Updating purchase order', { poId });

  // Get current PO
  const currentPO = await repository.getPurchaseOrderById(poId);
  if (!currentPO) {
    throw new Error(`Purchase order not found: ${poId}`);
  }

  // Check if PO can be edited
  if (!canEditPO(currentPO.status)) {
    throw new Error(`Cannot modify purchase order in ${currentPO.status} status`);
  }

  const currentPOWithLines = await repository.getPurchaseOrderWithLines(poId);
  if (!currentPOWithLines) {
    throw new Error(`Purchase order not found: ${poId}`);
  }

  const targetVendorId = request.vendorId ?? currentPO.vendorId;
  const targetCostCenterId = request.costCenterId ?? currentPO.costCenterId;
  const targetCurrency = request.currency ?? currentPO.currency ?? 'USD';

  await validatePurchaseOrderGovernance({
    vendorId: targetVendorId,
    costCenterId: targetCostCenterId,
    currency: targetCurrency,
    lines: currentPOWithLines.lines.map((line) =>
      toGovernanceLineInput({
        productType: line.productType,
        productId: line.productId ?? undefined,
        unitPrice: line.unitPrice,
        vendorId: line.vendorId ?? undefined,
        costCenterId: line.costCenterId ?? undefined,
      })
    ),
  });

  // Update PO
  await repository.updatePurchaseOrder(poId, request);

  // Invalidate cache
  await cache.del(poCacheKey(poId));

  // Get updated PO
  const updatedPO = await repository.getPurchaseOrderWithLines(poId);
  if (!updatedPO) {
    throw new Error('Failed to retrieve updated purchase order');
  }

  logger.info('Purchase order updated', { poId, totalAmount: updatedPO.totalAmount });

  return updatedPO;
}

/**
 * List purchase orders with filters
 * Requirement 16.10: Return paginated list matching criteria
 */
export async function listPurchaseOrders(
  filters: POListFilters = {},
  pagination: PaginationParams = {}
): Promise<PaginatedResult<PurchaseOrder>> {
  return repository.listPurchaseOrders(filters, pagination);
}


// ============================================================================
// Line Item Operations
// ============================================================================

/**
 * Add line item to purchase order
 * Requirement 16.2: Create PO line records with product details
 */
export async function addLineItem(
  poId: UUID,
  request: CreatePOLineRequest
): Promise<PurchaseOrderWithLines> {
  logger.info('Adding line item', { poId, productDescription: request.productDescription });

  // Get current PO
  const currentPO = await repository.getPurchaseOrderById(poId);
  if (!currentPO) {
    throw new Error(`Purchase order not found: ${poId}`);
  }

  // Check if PO can be edited
  if (!canEditPO(currentPO.status)) {
    throw new Error(`Cannot modify purchase order in ${currentPO.status} status`);
  }

  await validatePurchaseOrderGovernance({
    vendorId: currentPO.vendorId,
    costCenterId: currentPO.costCenterId,
    currency: currentPO.currency ?? 'USD',
    lines: [toGovernanceLineInput(request)],
  });

  // Add line
  await repository.addPOLine(poId, request);

  // Invalidate cache
  await cache.del(poCacheKey(poId));

  // Get updated PO
  const updatedPO = await repository.getPurchaseOrderWithLines(poId);
  if (!updatedPO) {
    throw new Error('Failed to retrieve updated purchase order');
  }

  // Publish event
  await publishEvent('PO_LINE_ADDED', {
    poId: updatedPO.poId,
    poNumber: updatedPO.poNumber,
    productDescription: request.productDescription,
    quantity: request.quantity,
    unitPrice: request.unitPrice,
    newTotal: updatedPO.totalAmount,
  });

  logger.info('Line item added', { poId, newTotal: updatedPO.totalAmount });

  return updatedPO;
}

/**
 * Update line item
 * Requirement 16.3: Update line and recalculate PO total
 */
export async function updateLineItem(
  poId: UUID,
  lineId: UUID,
  request: UpdatePOLineRequest
): Promise<PurchaseOrderWithLines> {
  logger.info('Updating line item', { poId, lineId });

  // Get current PO
  const currentPO = await repository.getPurchaseOrderById(poId);
  if (!currentPO) {
    throw new Error(`Purchase order not found: ${poId}`);
  }

  // Check if PO can be edited
  if (!canEditPO(currentPO.status)) {
    throw new Error(`Cannot modify purchase order in ${currentPO.status} status`);
  }

  const currentPOWithLines = await repository.getPurchaseOrderWithLines(poId);
  if (!currentPOWithLines) {
    throw new Error(`Purchase order not found: ${poId}`);
  }

  const existingLine = currentPOWithLines.lines.find((line) => line.lineId === lineId);
  if (!existingLine) {
    throw new Error(`PO line not found: ${lineId}`);
  }

  const effectiveCostCenterId =
    request.costCenterId === null
      ? currentPOWithLines.costCenterId
      : request.costCenterId ?? existingLine.costCenterId ?? currentPOWithLines.costCenterId;
  const effectiveVendorId =
    request.vendorId === null
      ? currentPOWithLines.vendorId
      : request.vendorId ?? existingLine.vendorId ?? currentPOWithLines.vendorId;

  await validatePurchaseOrderGovernance({
    vendorId: currentPOWithLines.vendorId,
    costCenterId: currentPOWithLines.costCenterId,
    currency: currentPOWithLines.currency ?? 'USD',
    lines: [
      {
        productType: existingLine.productType,
        productId: existingLine.productId ?? undefined,
        unitPrice: request.unitPrice ?? existingLine.unitPrice,
        vendorId: effectiveVendorId,
        costCenterId: effectiveCostCenterId,
      },
    ],
  });

  // Update line
  const updatedLine = await repository.updatePOLine(lineId, request);
  if (!updatedLine) {
    throw new Error(`PO line not found: ${lineId}`);
  }

  // Invalidate cache
  await cache.del(poCacheKey(poId));

  // Get updated PO
  const updatedPO = await repository.getPurchaseOrderWithLines(poId);
  if (!updatedPO) {
    throw new Error('Failed to retrieve updated purchase order');
  }

  // Publish event
  await publishEvent('PO_LINE_UPDATED', {
    poId: updatedPO.poId,
    poNumber: updatedPO.poNumber,
    lineId,
    changes: Object.keys(request),
    newTotal: updatedPO.totalAmount,
  });

  logger.info('Line item updated', { poId, lineId, newTotal: updatedPO.totalAmount });

  return updatedPO;
}

/**
 * Remove line item
 * Requirement 16.4: Delete line and recalculate PO total
 */
export async function removeLineItem(
  poId: UUID,
  lineId: UUID
): Promise<PurchaseOrderWithLines> {
  logger.info('Removing line item', { poId, lineId });

  // Get current PO
  const currentPO = await repository.getPurchaseOrderById(poId);
  if (!currentPO) {
    throw new Error(`Purchase order not found: ${poId}`);
  }

  // Check if PO can be edited
  if (!canEditPO(currentPO.status)) {
    throw new Error(`Cannot modify purchase order in ${currentPO.status} status`);
  }

  // Remove line
  const removed = await repository.removePOLine(lineId);
  if (!removed) {
    throw new Error(`PO line not found: ${lineId}`);
  }

  // Invalidate cache
  await cache.del(poCacheKey(poId));

  // Get updated PO
  const updatedPO = await repository.getPurchaseOrderWithLines(poId);
  if (!updatedPO) {
    throw new Error('Failed to retrieve updated purchase order');
  }

  // Publish event
  await publishEvent('PO_LINE_REMOVED', {
    poId: updatedPO.poId,
    poNumber: updatedPO.poNumber,
    lineId,
    newTotal: updatedPO.totalAmount,
  });

  logger.info('Line item removed', { poId, lineId, newTotal: updatedPO.totalAmount });

  return updatedPO;
}


// ============================================================================
// Workflow Operations
// ============================================================================

/**
 * Submit purchase order for approval
 * Requirement 16.5: Change status to PENDING_APPROVAL and notify approvers
 */
export async function submitForApproval(poId: UUID): Promise<PurchaseOrderWithLines> {
  logger.info('Submitting PO for approval', { poId });

  // Get current PO
  const currentPO = await repository.getPurchaseOrderWithLines(poId);
  if (!currentPO) {
    throw new Error(`Purchase order not found: ${poId}`);
  }

  // Check if PO can be submitted
  if (!canSubmitPO(currentPO.status)) {
    throw new Error(`Cannot submit purchase order in ${currentPO.status} status`);
  }

  // Validate PO has lines
  if (currentPO.lines.length === 0) {
    throw new Error('Cannot submit purchase order with no line items');
  }

  await validatePurchaseOrderGovernance({
    vendorId: currentPO.vendorId,
    costCenterId: currentPO.costCenterId,
    currency: currentPO.currency ?? 'USD',
    lines: currentPO.lines.map((line) =>
      toGovernanceLineInput({
        productType: line.productType,
        productId: line.productId ?? undefined,
        unitPrice: line.unitPrice,
        vendorId: line.vendorId ?? undefined,
        costCenterId: line.costCenterId ?? undefined,
      })
    ),
  });

  // Update status
  await repository.updatePOStatus(poId, 'PENDING_APPROVAL');

  // Invalidate cache
  await cache.del(poCacheKey(poId));

  // Get updated PO
  const updatedPO = await repository.getPurchaseOrderWithLines(poId);
  if (!updatedPO) {
    throw new Error('Failed to retrieve updated purchase order');
  }

  // Publish event
  await publishEvent('PURCHASE_ORDER_SUBMITTED', {
    poId: updatedPO.poId,
    poNumber: updatedPO.poNumber,
    vendorName: updatedPO.vendorName,
    totalAmount: updatedPO.totalAmount,
    requestedBy: updatedPO.requestedBy,
    requestedByName: updatedPO.requestedByName,
  });

  logger.info('PO submitted for approval', { poId, totalAmount: updatedPO.totalAmount });

  return updatedPO;
}

/**
 * Approve purchase order
 * Requirement 16.6: Change status to APPROVED and record approval details
 */
export async function approvePurchaseOrder(
  poId: UUID,
  approvedBy: UUID,
  approvalNotes?: string
): Promise<PurchaseOrderWithLines> {
  logger.info('Approving purchase order', { poId, approvedBy });

  // Get current PO
  const currentPO = await repository.getPurchaseOrderById(poId);
  if (!currentPO) {
    throw new Error(`Purchase order not found: ${poId}`);
  }

  // Check if PO can be approved
  if (!canApprovePO(currentPO.status)) {
    throw new Error(`Cannot approve purchase order in ${currentPO.status} status`);
  }

  const budgetValidation = await accountingService.validateBudgetForPO(poId);
  if (!budgetValidation.isValid) {
    throw new Error(accountingService.formatBudgetValidationFailure(budgetValidation));
  }

  // Approve PO
  await repository.approvePurchaseOrder(poId, approvedBy, approvalNotes);
  await accountingService.postEncumbranceForApprovedPO(poId, approvedBy);

  // Invalidate cache
  await cache.del(poCacheKey(poId));

  // Get updated PO
  const updatedPO = await repository.getPurchaseOrderWithLines(poId);
  if (!updatedPO) {
    throw new Error('Failed to retrieve updated purchase order');
  }

  // Publish event
  await publishEvent('PURCHASE_ORDER_APPROVED', {
    poId: updatedPO.poId,
    poNumber: updatedPO.poNumber,
    vendorName: updatedPO.vendorName,
    totalAmount: updatedPO.totalAmount,
    approvedBy,
    approvedByName: updatedPO.approvedByName,
  });

  logger.info('PO approved', { poId, approvedBy });

  return updatedPO;
}

/**
 * Reject purchase order
 * Requirement 16.7: Change status to REJECTED and record rejection reason
 */
export async function rejectPurchaseOrder(
  poId: UUID,
  rejectedBy: UUID,
  rejectionReason: string
): Promise<PurchaseOrderWithLines> {
  logger.info('Rejecting purchase order', { poId, rejectedBy });

  // Get current PO
  const currentPO = await repository.getPurchaseOrderById(poId);
  if (!currentPO) {
    throw new Error(`Purchase order not found: ${poId}`);
  }

  // Check if PO can be rejected
  if (!canApprovePO(currentPO.status)) {
    throw new Error(`Cannot reject purchase order in ${currentPO.status} status`);
  }

  // Reject PO
  await repository.rejectPurchaseOrder(poId, rejectedBy, rejectionReason);

  // Invalidate cache
  await cache.del(poCacheKey(poId));

  // Get updated PO
  const updatedPO = await repository.getPurchaseOrderWithLines(poId);
  if (!updatedPO) {
    throw new Error('Failed to retrieve updated purchase order');
  }

  // Publish event
  await publishEvent('PO_REJECTED', {
    poId: updatedPO.poId,
    poNumber: updatedPO.poNumber,
    vendorName: updatedPO.vendorName,
    totalAmount: updatedPO.totalAmount,
    rejectedBy,
    rejectedByName: updatedPO.rejectedByName,
    rejectionReason,
  });

  logger.info('PO rejected', { poId, rejectedBy, rejectionReason });

  return updatedPO;
}

/**
 * Send purchase order to vendor
 * Requirement 16.8: Change status to SENT and record sent date
 */
export async function sendToVendor(poId: UUID): Promise<PurchaseOrderWithLines> {
  logger.info('Sending PO to vendor', { poId });

  // Get current PO
  const currentPO = await repository.getPurchaseOrderById(poId);
  if (!currentPO) {
    throw new Error(`Purchase order not found: ${poId}`);
  }

  // Check if PO can be sent
  if (!canSendPO(currentPO.status)) {
    throw new Error(`Cannot send purchase order in ${currentPO.status} status`);
  }

  // Update status
  await repository.updatePOStatus(poId, 'SENT');

  // Invalidate cache
  await cache.del(poCacheKey(poId));

  // Get updated PO
  const updatedPO = await repository.getPurchaseOrderWithLines(poId);
  if (!updatedPO) {
    throw new Error('Failed to retrieve updated purchase order');
  }

  // Publish event
  await publishEvent('PO_SENT', {
    poId: updatedPO.poId,
    poNumber: updatedPO.poNumber,
    vendorId: updatedPO.vendorId,
    vendorName: updatedPO.vendorName,
    totalAmount: updatedPO.totalAmount,
    sentDate: updatedPO.sentDate,
  });

  logger.info('PO sent to vendor', { poId, vendorName: updatedPO.vendorName });

  return updatedPO;
}

/**
 * Cancel purchase order
 * Requirement 16.13: Cancel PO if not yet sent to vendor
 */
export async function cancelPurchaseOrder(
  poId: UUID,
  cancelledBy: UUID,
  cancellationReason?: string
): Promise<PurchaseOrderWithLines> {
  logger.info('Cancelling purchase order', { poId, cancelledBy });

  // Get current PO
  const currentPO = await repository.getPurchaseOrderById(poId);
  if (!currentPO) {
    throw new Error(`Purchase order not found: ${poId}`);
  }

  // Check if PO can be cancelled
  if (!canCancelPO(currentPO.status)) {
    throw new Error(`Cannot cancel purchase order in ${currentPO.status} status`);
  }

  // Update status to CANCELLED
  await repository.updatePOStatus(poId, 'CANCELLED');

  // Invalidate cache
  await cache.del(poCacheKey(poId));

  // Get updated PO
  const updatedPO = await repository.getPurchaseOrderWithLines(poId);
  if (!updatedPO) {
    throw new Error('Failed to retrieve updated purchase order');
  }

  // Publish event
  await publishEvent('PO_CANCELLED', {
    poId: updatedPO.poId,
    poNumber: updatedPO.poNumber,
    vendorName: updatedPO.vendorName,
    totalAmount: updatedPO.totalAmount,
    cancelledBy,
    cancellationReason,
  });

  logger.info('PO cancelled', { poId, cancelledBy, cancellationReason });

  return updatedPO;
}

export async function postReceiptAccounting(
  poId: UUID,
  receiptId: UUID,
  receiptNumber?: string,
  postedBy?: UUID
) {
  logger.info('Posting receipt accounting for purchase order', {
    poId,
    receiptId,
  });

  const currentPO = await repository.getPurchaseOrderById(poId);
  if (!currentPO) {
    throw new Error(`Purchase order not found: ${poId}`);
  }

  if (!canPostAccountingTransition(currentPO.status)) {
    throw new Error(
      `Cannot post receipt accounting for purchase order in ${currentPO.status} status`
    );
  }

  return accountingService.postReceiptAccrualForPO(poId, receiptId, receiptNumber, postedBy);
}

export async function postInvoiceAccounting(
  poId: UUID,
  invoiceId: UUID,
  invoiceNumber?: string,
  postedBy?: UUID
) {
  logger.info('Posting invoice accounting for purchase order', {
    poId,
    invoiceId,
  });

  const currentPO = await repository.getPurchaseOrderById(poId);
  if (!currentPO) {
    throw new Error(`Purchase order not found: ${poId}`);
  }

  if (!canPostAccountingTransition(currentPO.status)) {
    throw new Error(
      `Cannot post invoice accounting for purchase order in ${currentPO.status} status`
    );
  }

  return accountingService.postInvoiceLiabilityForPO(poId, invoiceId, invoiceNumber, postedBy);
}

export async function getCloseGuard(poId: UUID): Promise<{ canClose: boolean; reasons: string[] }> {
  const currentPO = await repository.getPurchaseOrderById(poId);
  if (!currentPO) {
    throw new Error(`Purchase order not found: ${poId}`);
  }

  return accountingService.getPOCloseGuard(poId);
}

export async function closePurchaseOrder(
  poId: UUID,
  closedBy: UUID,
  closeNotes?: string
): Promise<PurchaseOrderWithLines> {
  logger.info('Closing purchase order', { poId, closedBy });

  const currentPO = await repository.getPurchaseOrderById(poId);
  if (!currentPO) {
    throw new Error(`Purchase order not found: ${poId}`);
  }

  if (!canClosePO(currentPO.status)) {
    throw new Error(`Cannot close purchase order in ${currentPO.status} status`);
  }

  const closeGuard = await accountingService.getPOCloseGuard(poId);
  if (!closeGuard.canClose) {
    throw new Error(`Cannot close purchase order: ${closeGuard.reasons.join('; ')}`);
  }

  await repository.closePurchaseOrder(poId, closedBy, closeNotes);
  await cache.del(poCacheKey(poId));

  const updatedPO = await repository.getPurchaseOrderWithLines(poId);
  if (!updatedPO) {
    throw new Error('Failed to retrieve closed purchase order');
  }

  logger.info('PO closed', { poId, closedBy });
  return updatedPO;
}

// Re-export calculation functions
export { calculateLineTotal, calculatePOTotals } from './po-repository';
