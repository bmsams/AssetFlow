/**
 * Stockroom and Inventory types
 */
import type { BaseEntity, ISODateString, UUID } from './common';
/**
 * Stockroom type
 */
export type StockroomType = 'STANDARD' | 'LOANER' | 'REPAIR' | 'DISPOSAL' | 'QUARANTINE' | 'MAIN' | 'SATELLITE' | 'VIRTUAL' | 'RECEIVING' | 'SPARE_PARTS' | 'OTHER';
/**
 * Transfer order status
 */
export type TransferOrderStatus = 'DRAFT' | 'PENDING_APPROVAL' | 'APPROVED' | 'IN_TRANSIT' | 'RECEIVED' | 'CANCELLED';
/**
 * Audit type
 */
export type AuditType = 'BLIND' | 'SCHEDULED' | 'SPOT_CHECK';
/**
 * Audit status
 */
export type AuditStatus = 'IN_PROGRESS' | 'COMPLETED' | 'CANCELLED';
/**
 * Scan match status
 */
export type ScanMatchStatus = 'MATCHED' | 'NOT_FOUND' | 'UNEXPECTED';
/**
 * Stockroom entity
 */
export interface Stockroom extends BaseEntity {
    readonly stockroomId: UUID;
    readonly name: string;
    readonly location?: string;
    readonly stockroomType: StockroomType;
    readonly managerId?: UUID;
    readonly isActive: boolean;
}
/**
 * Stockroom inventory record
 */
export interface StockroomInventory {
    readonly inventoryId: UUID;
    readonly stockroomId: UUID;
    readonly productId: UUID;
    readonly quantityOnHand: number;
    readonly quantityReserved: number;
    readonly quantityAvailable: number;
    readonly reorderPoint: number;
    readonly reorderQuantity: number;
    readonly updatedAt: ISODateString;
}
/**
 * Transfer order
 */
export interface TransferOrder extends BaseEntity {
    readonly transferId: UUID;
    readonly transferNumber: string;
    readonly fromStockroomId: UUID;
    readonly toStockroomId: UUID;
    readonly status: TransferOrderStatus;
    readonly requestedBy?: UUID;
    readonly requestedDate: ISODateString;
    readonly approvedBy?: UUID;
    readonly approvedDate?: ISODateString;
}
/**
 * Transfer order line item
 */
export interface TransferOrderLine {
    readonly lineId: UUID;
    readonly transferId: UUID;
    readonly assetId?: UUID;
    readonly productId?: UUID;
    readonly quantity: number;
    readonly shippedDate?: ISODateString;
    readonly receivedDate?: ISODateString;
}
/**
 * Stockroom rule for auto-replenishment
 */
export interface StockroomRule {
    readonly ruleId: UUID;
    readonly stockroomId: UUID;
    readonly productId: UUID;
    readonly minQuantity: number;
    readonly maxQuantity?: number;
    readonly autoReplenish: boolean;
    readonly replenishVendorId?: UUID;
    readonly isActive: boolean;
}
/**
 * Audit record
 */
export interface AuditRecord extends BaseEntity {
    readonly auditId: UUID;
    readonly stockroomId: UUID;
    readonly auditType: AuditType;
    readonly auditorId?: UUID;
    readonly startDate: ISODateString;
    readonly endDate?: ISODateString;
    readonly status: AuditStatus;
    readonly discrepancyCount: number;
}
/**
 * Audit scan record
 */
export interface AuditScan {
    readonly scanId: UUID;
    readonly auditId: UUID;
    readonly assetId?: UUID;
    readonly scannedTag: string;
    readonly scanTime: ISODateString;
    readonly matchStatus: ScanMatchStatus;
}
/**
 * Audit result with discrepancies
 */
export interface AuditResult {
    readonly auditId: UUID;
    readonly totalExpected: number;
    readonly totalScanned: number;
    readonly matched: number;
    readonly notFound: number;
    readonly unexpected: number;
    readonly discrepancyRate: number;
}
/**
 * Audit discrepancy
 */
export interface AuditDiscrepancy {
    readonly discrepancyId: UUID;
    readonly auditId: UUID;
    readonly assetId?: UUID;
    readonly assetTag: string;
    readonly discrepancyType: 'MISSING' | 'UNEXPECTED' | 'LOCATION_MISMATCH';
    readonly expectedLocation?: string;
    readonly actualLocation?: string;
    readonly notes?: string;
}
/**
 * Replenishment alert
 */
export interface ReplenishmentAlert {
    readonly alertId: UUID;
    readonly stockroomId: UUID;
    readonly productId: UUID;
    readonly currentQuantity: number;
    readonly reorderPoint: number;
    readonly suggestedQuantity: number;
    readonly createdAt: ISODateString;
    readonly status: 'NEW' | 'ACKNOWLEDGED' | 'PO_CREATED' | 'RESOLVED';
}
/**
 * Receiving record
 */
export interface ReceivingRecord {
    readonly receivingId: UUID;
    readonly poId: UUID;
    readonly receivedBy: UUID;
    readonly receivedDate: ISODateString;
    readonly stockroomId: UUID;
    readonly notes?: string;
}
/**
 * Receiving line item
 */
export interface ReceivingLine {
    readonly lineId: UUID;
    readonly receivingId: UUID;
    readonly poLineId: UUID;
    readonly quantityReceived: number;
    readonly condition: 'NEW' | 'GOOD' | 'DAMAGED' | 'DEFECTIVE';
    readonly assetIdsCreated: readonly UUID[];
    readonly serialNumbersScanned: readonly string[];
}
/**
 * Transfer result
 */
export interface TransferResult {
    readonly transferId: UUID;
    readonly status: TransferOrderStatus;
    readonly completedLines: number;
    readonly totalLines: number;
    readonly completedAt?: ISODateString;
}
