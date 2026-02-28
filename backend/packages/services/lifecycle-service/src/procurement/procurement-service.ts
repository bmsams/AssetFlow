/**
 * Procurement Service - Business logic layer for procurement operations
 *
 * Implements:
 * - Stock availability checking (Requirement 6.2)
 * - Inventory reservation (Requirement 6.2)
 * - Purchase order generation when stock insufficient (Requirement 6.2, 6.3)
 * - ERP integration for financial processing (Requirement 6.3)
 *
 * INVARIANT — Header Default vs. Line-Level Vendor/Cost Center (Requirements 5.1, 5.4):
 *   When the PO header's vendor_id or cost_center_id is updated, existing PO lines
 *   that already have an explicit (non-null) line-level vendor_id or cost_center_id
 *   MUST NOT be overwritten. The effective resolution pattern (line → header fallback)
 *   handles this naturally: lines with explicit values keep them, while lines with
 *   null values automatically inherit the new header default at query time via
 *   resolveEffectiveVendor / resolveEffectiveCostCenter.
 */

import type { UUID } from '@ams/types';
import * as cache from '@ams/cache';
import { publishEvent } from '@ams/events';
import { createLogger, now } from '@ams/utils';

import type {
  CreatePurchaseOrderInput,
  CreatePurchaseOrderLineInput,
  CreateReservationInput,
  InventoryReservation,
  PurchaseOrder,
  PurchaseOrderLine,
  StockAvailability,
} from './procurement-repository';
import * as repository from './procurement-repository';

const logger = createLogger({ service: 'procurement-service' });

/**
 * Stock check result for a single item
 */
export interface StockCheckResult {
  readonly productId: UUID;
  readonly productType: string;
  readonly quantityRequested: number;
  readonly quantityAvailable: number;
  readonly isAvailable: boolean;
  readonly shortfall: number;
  readonly stockrooms: StockAvailability[];
}

/**
 * Bulk stock check result
 */
export interface BulkStockCheckResult {
  readonly items: StockCheckResult[];
  readonly allAvailable: boolean;
  readonly totalShortfall: number;
  readonly itemsWithShortfall: number;
}

/**
 * Reserve inventory result
 */
export interface ReserveInventoryResult {
  readonly reservations: InventoryReservation[];
  readonly totalReserved: number;
  readonly fullyReserved: boolean;
  readonly shortfall: number;
}

/**
 * Procurement fulfillment result
 */
export interface ProcurementFulfillmentResult {
  readonly requestId: UUID;
  readonly fulfilledFromStock: boolean;
  readonly reservations: InventoryReservation[];
  readonly purchaseOrder: PurchaseOrder | null;
  readonly purchaseOrderLines: PurchaseOrderLine[];
  readonly itemsFulfilledFromStock: number;
  readonly itemsRequiringPurchase: number;
}

/**
 * Request line item for procurement
 */
export interface ProcurementRequestItem {
  readonly requestLineId: UUID;
  readonly productId?: UUID;
  readonly productType: string;
  readonly productName: string;
  readonly productDescription?: string;
  readonly quantity: number;
  readonly unitPrice?: number;
}

/**
 * Cache key for stock availability
 */
function stockAvailabilityCacheKey(productId: UUID, productType: string): string {
  return `stock:${productId}:${productType}`;
}

/**
 * Check stock availability for a single product
 * Requirement 6.2: Check stock availability
 */
export async function checkStock(
  productId: UUID,
  productType: string,
  quantityNeeded: number,
  stockroomId?: UUID
): Promise<StockCheckResult> {
  logger.info('Checking stock availability', { productId, productType, quantityNeeded, stockroomId });

  const stockrooms = await repository.checkStockAvailability(productId, productType, stockroomId);
  const totalAvailable = stockrooms.reduce((sum, s) => sum + s.quantityAvailable, 0);
  const isAvailable = totalAvailable >= quantityNeeded;
  const shortfall = isAvailable ? 0 : quantityNeeded - totalAvailable;

  const result: StockCheckResult = {
    productId,
    productType,
    quantityRequested: quantityNeeded,
    quantityAvailable: totalAvailable,
    isAvailable,
    shortfall,
    stockrooms,
  };

  logger.info('Stock check complete', {
    productId,
    productType,
    quantityNeeded,
    totalAvailable,
    isAvailable,
    shortfall,
  });

  return result;
}

/**
 * Check stock availability for multiple items
 * Requirement 6.2: Check stock availability
 */
export async function checkBulkStock(
  items: Array<{ productId: UUID; productType: string; quantityNeeded: number }>
): Promise<BulkStockCheckResult> {
  logger.info('Checking bulk stock availability', { itemCount: items.length });

  const results: StockCheckResult[] = [];
  let allAvailable = true;
  let totalShortfall = 0;
  let itemsWithShortfall = 0;

  for (const item of items) {
    const result = await checkStock(item.productId, item.productType, item.quantityNeeded);
    results.push(result);

    if (!result.isAvailable) {
      allAvailable = false;
      totalShortfall += result.shortfall;
      itemsWithShortfall++;
    }
  }

  logger.info('Bulk stock check complete', {
    itemCount: items.length,
    allAvailable,
    totalShortfall,
    itemsWithShortfall,
  });

  return {
    items: results,
    allAvailable,
    totalShortfall,
    itemsWithShortfall,
  };
}

/**
 * Reserve inventory for a request
 * Requirement 6.2: Reserve inventory
 */
export async function reserveInventory(
  productId: UUID,
  productType: string,
  quantityNeeded: number,
  reservedBy: UUID,
  options?: {
    requestId?: UUID;
    requestLineId?: UUID;
    stockroomId?: UUID;
    expiresAt?: string;
    notes?: string;
  }
): Promise<ReserveInventoryResult> {
  logger.info('Reserving inventory', { productId, productType, quantityNeeded, reservedBy });

  // First check availability
  const stockCheck = await checkStock(productId, productType, quantityNeeded, options?.stockroomId);

  if (stockCheck.quantityAvailable === 0) {
    logger.warn('No inventory available to reserve', { productId, productType });
    return {
      reservations: [],
      totalReserved: 0,
      fullyReserved: false,
      shortfall: quantityNeeded,
    };
  }

  const reservations: InventoryReservation[] = [];
  let remainingToReserve = quantityNeeded;

  // Reserve from stockrooms with available inventory, starting with highest availability
  for (const stockroom of stockCheck.stockrooms) {
    if (remainingToReserve <= 0) break;
    if (stockroom.quantityAvailable <= 0) continue;

    const quantityToReserve = Math.min(remainingToReserve, stockroom.quantityAvailable);

    // Get inventory ID for this stockroom/product combination
    const inventoryId = await getInventoryId(stockroom.stockroomId, productId, productType);
    if (!inventoryId) {
      logger.warn('Could not find inventory ID', {
        stockroomId: stockroom.stockroomId,
        productId,
        productType,
      });
      continue;
    }

    try {
      const reservationInput: CreateReservationInput = {
        inventoryId,
        stockroomId: stockroom.stockroomId,
        productId,
        productType,
        requestId: options?.requestId,
        requestLineId: options?.requestLineId,
        quantityReserved: quantityToReserve,
        reservedBy,
        expiresAt: options?.expiresAt,
        notes: options?.notes,
      };

      const reservation = await repository.createReservation(reservationInput);
      reservations.push(reservation);
      remainingToReserve -= quantityToReserve;

      // Invalidate cache
      await cache.del(stockAvailabilityCacheKey(productId, productType));

      logger.info('Inventory reserved from stockroom', {
        reservationId: reservation.reservationId,
        stockroomId: stockroom.stockroomId,
        quantityReserved: quantityToReserve,
      });
    } catch (error) {
      logger.error('Failed to reserve from stockroom', error as Error, {
        stockroomId: stockroom.stockroomId,
        productId,
        quantityToReserve,
      });
    }
  }

  const totalReserved = quantityNeeded - remainingToReserve;
  const fullyReserved = remainingToReserve === 0;

  // Publish reservation event
  if (reservations.length > 0) {
    await publishEvent('INVENTORY_RESERVED', {
      productId,
      productType,
      quantityRequested: quantityNeeded,
      quantityReserved: totalReserved,
      fullyReserved,
      reservationIds: reservations.map((r) => r.reservationId),
      requestId: options?.requestId,
      reservedBy,
    });
  }

  logger.info('Inventory reservation complete', {
    productId,
    productType,
    quantityNeeded,
    totalReserved,
    fullyReserved,
    shortfall: remainingToReserve,
    reservationCount: reservations.length,
  });

  return {
    reservations,
    totalReserved,
    fullyReserved,
    shortfall: remainingToReserve,
  };
}

/**
 * Helper to get inventory ID for a stockroom/product combination
 */
async function getInventoryId(
  stockroomId: UUID,
  productId: UUID,
  productType: string
): Promise<UUID | null> {
  // This would query the stockroom_inventory table
  // For now, we'll use a direct query
  const { queryOne } = await import('@ams/database');
  const result = await queryOne<{ inventory_id: string }>(
    `SELECT inventory_id FROM stockroom_inventory 
     WHERE stockroom_id = $1 AND product_id = $2 AND product_type = $3`,
    [stockroomId, productId, productType]
  );
  return result?.inventory_id ?? null;
}

/**
 * Create purchase order for items not available in stock
 * Requirement 6.2, 6.3: Generate purchase orders when stock insufficient
 */
export async function createPurchaseOrder(
  input: CreatePurchaseOrderInput,
  userId: UUID
): Promise<{ purchaseOrder: PurchaseOrder; lines: PurchaseOrderLine[] }> {
  logger.info('Creating purchase order', {
    requesterId: input.requesterId,
    lineCount: input.lines.length,
    sourceRequestId: input.sourceRequestId,
  });

  // Validate input
  if (!input.lines || input.lines.length === 0) {
    throw new Error('Purchase order must have at least one line');
  }

  for (let i = 0; i < input.lines.length; i++) {
    const line = input.lines[i]!;
    if (!line.productName || line.productName.trim().length === 0) {
      throw new Error(`Line ${i + 1}: Product name is required`);
    }
    if (line.quantity <= 0) {
      throw new Error(`Line ${i + 1}: Quantity must be greater than 0`);
    }
    if (line.unitPrice < 0) {
      throw new Error(`Line ${i + 1}: Unit price cannot be negative`);
    }
  }

  const result = await repository.createPurchaseOrder(input);

  // Publish purchase order created event
  await publishEvent('PURCHASE_ORDER_CREATED', {
    poId: result.purchaseOrder.poId,
    poNumber: result.purchaseOrder.poNumber,
    requesterId: result.purchaseOrder.requesterId,
    vendorId: result.purchaseOrder.vendorId,
    vendorName: result.purchaseOrder.vendorName,
    status: result.purchaseOrder.status,
    totalAmount: result.purchaseOrder.totalAmount,
    lineCount: result.lines.length,
    sourceRequestId: result.purchaseOrder.sourceRequestId,
    createdBy: userId,
  });

  logger.info('Purchase order created', {
    poId: result.purchaseOrder.poId,
    poNumber: result.purchaseOrder.poNumber,
    totalAmount: result.purchaseOrder.totalAmount,
    lineCount: result.lines.length,
  });

  return result;
}

/**
 * Process procurement for an approved request
 * Requirement 6.2: Check stock availability and either reserve inventory or generate purchase order
 */
export async function processProcurement(
  requestId: UUID,
  items: ProcurementRequestItem[],
  requesterId: UUID,
  options?: {
    vendorId?: UUID;
    vendorName?: string;
    shippingAddress?: string;
    expectedDeliveryDate?: string;
  }
): Promise<ProcurementFulfillmentResult> {
  logger.info('Processing procurement for request', {
    requestId,
    itemCount: items.length,
    requesterId,
  });

  const reservations: InventoryReservation[] = [];
  const itemsForPurchase: CreatePurchaseOrderLineInput[] = [];
  let itemsFulfilledFromStock = 0;
  let itemsRequiringPurchase = 0;

  // Process each item
  for (const item of items) {
    if (!item.productId) {
      // No product ID means we can't check stock, need to purchase
      itemsForPurchase.push({
        productId: item.productId,
        productType: item.productType,
        productName: item.productName,
        productDescription: item.productDescription,
        quantity: item.quantity,
        unitPrice: item.unitPrice ?? 0,
        requestLineId: item.requestLineId,
      });
      itemsRequiringPurchase++;
      continue;
    }

    // Try to reserve from stock
    const reserveResult = await reserveInventory(
      item.productId,
      item.productType,
      item.quantity,
      requesterId,
      {
        requestId,
        requestLineId: item.requestLineId,
        notes: `Reserved for request ${requestId}`,
      }
    );

    reservations.push(...reserveResult.reservations);

    if (reserveResult.fullyReserved) {
      itemsFulfilledFromStock++;
    } else if (reserveResult.shortfall > 0) {
      // Need to purchase the shortfall
      itemsForPurchase.push({
        productId: item.productId,
        productType: item.productType,
        productName: item.productName,
        productDescription: item.productDescription,
        quantity: reserveResult.shortfall,
        unitPrice: item.unitPrice ?? 0,
        requestLineId: item.requestLineId,
        notes: `Shortfall for request ${requestId}`,
      });
      itemsRequiringPurchase++;
    }
  }

  // Create purchase order if needed
  let purchaseOrder: PurchaseOrder | null = null;
  let purchaseOrderLines: PurchaseOrderLine[] = [];

  if (itemsForPurchase.length > 0) {
    const poInput: CreatePurchaseOrderInput = {
      vendorId: options?.vendorId,
      vendorName: options?.vendorName,
      requesterId,
      shippingAddress: options?.shippingAddress,
      expectedDeliveryDate: options?.expectedDeliveryDate,
      sourceRequestId: requestId,
      lines: itemsForPurchase,
      notes: `Auto-generated for request ${requestId}`,
    };

    const poResult = await createPurchaseOrder(poInput, requesterId);
    purchaseOrder = poResult.purchaseOrder;
    purchaseOrderLines = poResult.lines;
  }

  const fulfilledFromStock = itemsRequiringPurchase === 0;

  // Publish procurement processed event
  await publishEvent('PROCUREMENT_PROCESSED', {
    requestId,
    fulfilledFromStock,
    reservationCount: reservations.length,
    purchaseOrderId: purchaseOrder?.poId,
    purchaseOrderNumber: purchaseOrder?.poNumber,
    itemsFulfilledFromStock,
    itemsRequiringPurchase,
  });

  logger.info('Procurement processing complete', {
    requestId,
    fulfilledFromStock,
    reservationCount: reservations.length,
    purchaseOrderCreated: !!purchaseOrder,
    itemsFulfilledFromStock,
    itemsRequiringPurchase,
  });

  return {
    requestId,
    fulfilledFromStock,
    reservations,
    purchaseOrder,
    purchaseOrderLines,
    itemsFulfilledFromStock,
    itemsRequiringPurchase,
  };
}

/**
 * Get purchase order by ID with lines
 */
export async function getPurchaseOrder(
  poId: UUID
): Promise<{ purchaseOrder: PurchaseOrder; lines: PurchaseOrderLine[] } | null> {
  const purchaseOrder = await repository.getPurchaseOrderById(poId);
  if (!purchaseOrder) {
    return null;
  }

  const lines = await repository.getPurchaseOrderLines(poId);
  return { purchaseOrder, lines };
}

/**
 * Get purchase order by PO number
 */
export async function getPurchaseOrderByNumber(
  poNumber: string
): Promise<{ purchaseOrder: PurchaseOrder; lines: PurchaseOrderLine[] } | null> {
  const purchaseOrder = await repository.getPurchaseOrderByNumber(poNumber);
  if (!purchaseOrder) {
    return null;
  }

  const lines = await repository.getPurchaseOrderLines(purchaseOrder.poId);
  return { purchaseOrder, lines };
}

/**
 * Submit purchase order for approval
 */
export async function submitPurchaseOrder(
  poId: UUID,
  submittedBy: UUID
): Promise<PurchaseOrder> {
  logger.info('Submitting purchase order for approval', { poId, submittedBy });

  const purchaseOrder = await repository.getPurchaseOrderById(poId);
  if (!purchaseOrder) {
    throw new Error(`Purchase order not found: ${poId}`);
  }

  if (purchaseOrder.status !== 'DRAFT') {
    throw new Error(`Cannot submit purchase order in status: ${purchaseOrder.status}`);
  }

  // Validate that every line has an effective vendor before submitting
  const lines = await repository.getPurchaseOrderLines(poId);
  for (const line of lines) {
    if (!line.effectiveVendorId) {
      throw new Error(`Cannot submit: line ${line.lineNumber} has no vendor assigned`);
    }
  }

  const updatedPO = await repository.updatePurchaseOrderStatus(poId, 'PENDING_APPROVAL', {
    updatedBy: submittedBy,
  });

  if (!updatedPO) {
    throw new Error(`Failed to submit purchase order: ${poId}`);
  }

  // Publish event
  await publishEvent('PURCHASE_ORDER_SUBMITTED', {
    poId: updatedPO.poId,
    poNumber: updatedPO.poNumber,
    status: updatedPO.status,
    totalAmount: updatedPO.totalAmount,
    submittedBy,
  });

  logger.info('Purchase order submitted', {
    poId: updatedPO.poId,
    poNumber: updatedPO.poNumber,
    status: updatedPO.status,
  });

  return updatedPO;
}

/**
 * Approve purchase order
 */
export async function approvePurchaseOrder(
  poId: UUID,
  approverId: UUID,
  approverName?: string
): Promise<PurchaseOrder> {
  logger.info('Approving purchase order', { poId, approverId });

  const purchaseOrder = await repository.getPurchaseOrderById(poId);
  if (!purchaseOrder) {
    throw new Error(`Purchase order not found: ${poId}`);
  }

  if (purchaseOrder.status !== 'PENDING_APPROVAL') {
    throw new Error(`Cannot approve purchase order in status: ${purchaseOrder.status}`);
  }

  const timestamp = now();
  const updatedPO = await repository.updatePurchaseOrderStatus(poId, 'APPROVED', {
    approverId,
    approverName,
    orderDate: timestamp,
    updatedBy: approverId,
  });

  if (!updatedPO) {
    throw new Error(`Failed to approve purchase order: ${poId}`);
  }

  // Publish event
  await publishEvent('PURCHASE_ORDER_APPROVED', {
    poId: updatedPO.poId,
    poNumber: updatedPO.poNumber,
    status: updatedPO.status,
    totalAmount: updatedPO.totalAmount,
    approverId,
    approverName,
    orderDate: timestamp,
  });

  logger.info('Purchase order approved', {
    poId: updatedPO.poId,
    poNumber: updatedPO.poNumber,
    status: updatedPO.status,
    approverId,
  });

  return updatedPO;
}

/**
 * Release reservation
 */
export async function releaseReservation(reservationId: UUID): Promise<InventoryReservation> {
  logger.info('Releasing reservation', { reservationId });

  const reservation = await repository.releaseReservation(reservationId);
  if (!reservation) {
    throw new Error(`Reservation not found: ${reservationId}`);
  }

  // Invalidate cache
  if (reservation.productId) {
    await cache.del(stockAvailabilityCacheKey(reservation.productId, reservation.productType));
  }

  // Publish event
  await publishEvent('RESERVATION_RELEASED', {
    reservationId: reservation.reservationId,
    inventoryId: reservation.inventoryId,
    productId: reservation.productId,
    productType: reservation.productType,
    quantityReleased: reservation.quantityReserved,
  });

  logger.info('Reservation released', {
    reservationId: reservation.reservationId,
    quantityReleased: reservation.quantityReserved,
  });

  return reservation;
}

/**
 * Fulfill reservation (convert to actual inventory reduction)
 */
export async function fulfillReservation(reservationId: UUID): Promise<InventoryReservation> {
  logger.info('Fulfilling reservation', { reservationId });

  const reservation = await repository.fulfillReservation(reservationId);
  if (!reservation) {
    throw new Error(`Reservation not found: ${reservationId}`);
  }

  // Invalidate cache
  if (reservation.productId) {
    await cache.del(stockAvailabilityCacheKey(reservation.productId, reservation.productType));
  }

  // Publish event
  await publishEvent('RESERVATION_FULFILLED', {
    reservationId: reservation.reservationId,
    inventoryId: reservation.inventoryId,
    productId: reservation.productId,
    productType: reservation.productType,
    quantityFulfilled: reservation.quantityReserved,
  });

  logger.info('Reservation fulfilled', {
    reservationId: reservation.reservationId,
    quantityFulfilled: reservation.quantityReserved,
  });

  return reservation;
}

/**
 * Get reservations for a request
 */
export async function getReservationsByRequest(requestId: UUID): Promise<InventoryReservation[]> {
  return repository.getReservationsByRequest(requestId);
}

/**
 * Get purchase orders for a request
 */
export async function getPurchaseOrdersByRequest(requestId: UUID): Promise<PurchaseOrder[]> {
  return repository.getPurchaseOrdersByRequest(requestId);
}

// Re-export types
export type {
  CreatePurchaseOrderInput,
  CreatePurchaseOrderLineInput,
  CreateReservationInput,
  InventoryReservation,
  PurchaseOrder,
  PurchaseOrderLine,
  PurchaseOrderLineStatus,
  PurchaseOrderStatus,
  StockAvailability,
} from './procurement-repository';
