/**
 * Contract and Financial types
 */
import type { BaseEntity, ISODateString, UUID } from './common';
/**
 * Contract types
 */
export type ContractType = 'PURCHASE' | 'LEASE' | 'MAINTENANCE' | 'SUPPORT' | 'LICENSE' | 'WARRANTY';
/**
 * Contract status
 */
export type ContractStatus = 'DRAFT' | 'PENDING_APPROVAL' | 'ACTIVE' | 'EXPIRED' | 'TERMINATED' | 'RENEWED';
/**
 * Purchase order status
 */
export type PurchaseOrderStatus = 'DRAFT' | 'PENDING_APPROVAL' | 'APPROVED' | 'ORDERED' | 'PARTIALLY_RECEIVED' | 'RECEIVED' | 'CANCELLED';
/**
 * Renewal type
 */
export type RenewalType = 'MANUAL' | 'AUTO' | 'EVERGREEN';
/**
 * Vendor entity
 */
export interface Vendor extends BaseEntity {
    readonly vendorId: UUID;
    readonly vendorName: string;
    readonly vendorType?: string;
    readonly contactName?: string;
    readonly contactEmail?: string;
    readonly contactPhone?: string;
    readonly address?: string;
    readonly paymentTerms?: string;
    readonly isActive: boolean;
}
/**
 * Contract entity
 */
export interface Contract extends BaseEntity {
    readonly contractId: UUID;
    readonly contractNumber: string;
    readonly vendorId: UUID;
    readonly contractType: ContractType;
    readonly startDate: ISODateString;
    readonly endDate: ISODateString;
    readonly totalValue?: number;
    readonly status: ContractStatus;
    readonly paymentTerms?: string;
    readonly renewalType?: RenewalType;
    readonly autoRenewal: boolean;
    readonly cancellationNoticeDays?: number;
    readonly slaTerms?: string;
}
/**
 * Basic purchase order entity (for contract relationships)
 * For full PO management, use types from purchase-order.ts
 */
export interface BasicPurchaseOrder extends BaseEntity {
    readonly poId: UUID;
    readonly poNumber: string;
    readonly vendorId: UUID;
    readonly requesterId?: UUID;
    readonly approverId?: UUID;
    readonly status: PurchaseOrderStatus;
    readonly orderDate?: ISODateString;
    readonly expectedDeliveryDate?: ISODateString;
    readonly totalAmount?: number;
}
/**
 * Basic purchase order line item (for contract relationships)
 * For full PO line management, use types from purchase-order.ts
 */
export interface BasicPurchaseOrderLine {
    readonly lineId: UUID;
    readonly poId: UUID;
    readonly lineNumber: number;
    readonly productDescription?: string;
    readonly productId?: UUID;
    readonly quantity: number;
    readonly unitPrice: number;
    readonly totalPrice: number;
    readonly receivedQuantity: number;
}
/**
 * Cost center entity
 */
export interface CostCenter {
    readonly costCenterId: UUID;
    readonly code: string;
    readonly name: string;
    readonly departmentId?: UUID;
    readonly budgetAmount?: number;
    readonly spentAmount: number;
    readonly fiscalYear: number;
    readonly isActive: boolean;
}
/**
 * Depreciation schedule entry
 */
export interface DepreciationSchedule {
    readonly scheduleId: UUID;
    readonly assetId: UUID;
    readonly periodStart: ISODateString;
    readonly periodEnd: ISODateString;
    readonly beginningValue: number;
    readonly depreciationAmount: number;
    readonly endingValue: number;
    readonly accumulatedDepreciation: number;
    readonly createdAt: ISODateString;
}
/**
 * Lease payment
 */
export interface LeasePayment {
    readonly paymentId: UUID;
    readonly contractId: UUID;
    readonly dueDate: ISODateString;
    readonly amount: number;
    readonly status: 'PENDING' | 'PAID' | 'OVERDUE' | 'CANCELLED';
    readonly paidDate?: ISODateString;
    readonly paymentReference?: string;
}
/**
 * Contract expiration notification
 */
export interface ContractExpirationNotification {
    readonly notificationId: UUID;
    readonly contractId: UUID;
    readonly daysUntilExpiration: number;
    readonly notificationDate: ISODateString;
    readonly recipients: readonly UUID[];
    readonly sent: boolean;
    readonly sentAt?: ISODateString;
}
