/**
 * Purchase Order types for the Asset Management System
 *
 * This module defines extended types for purchase order management.
 * These types extend the basic PurchaseOrder in contract.ts with
 * additional fields needed for full procurement workflows.
 */
import type { UUID, ISODateString } from './common';
/**
 * Extended purchase order lifecycle status
 */
export type POStatus = 'DRAFT' | 'PENDING_APPROVAL' | 'APPROVED' | 'REJECTED' | 'SENT' | 'PARTIALLY_RECEIVED' | 'RECEIVED' | 'CLOSED' | 'CANCELLED';
/**
 * Product type for PO line items
 */
export type POProductType = 'HARDWARE_MODEL' | 'SOFTWARE_PRODUCT' | 'SERVICE' | 'OTHER';
/**
 * Purchase order entity (base type without lines)
 */
export interface PurchaseOrder {
    readonly poId: UUID;
    readonly poNumber: string;
    readonly vendorId: UUID;
    readonly vendorName: string;
    readonly costCenterId: UUID;
    readonly costCenterCode: string;
    readonly status: POStatus;
    readonly requestedBy: UUID;
    readonly requestedByName: string;
    readonly requestedDate: string;
    readonly approvedBy: UUID | null;
    readonly approvedByName: string | null;
    readonly approvedDate: string | null;
    readonly rejectedBy: UUID | null;
    readonly rejectedByName: string | null;
    readonly rejectedDate: string | null;
    readonly rejectionReason: string | null;
    readonly sentDate: string | null;
    readonly expectedDeliveryDate: string | null;
    readonly subtotal: number;
    readonly taxAmount: number;
    readonly shippingAmount: number;
    readonly totalAmount: number;
    readonly notes: string | null;
    readonly createdAt: string;
    readonly updatedAt: string;
}
/**
 * Purchase order with line items
 */
export interface PurchaseOrderWithLines extends PurchaseOrder {
    readonly lines: POLine[];
}
/**
 * Extended purchase order entity with full details for procurement workflows
 * @deprecated Use PurchaseOrderWithLines instead
 */
export interface PurchaseOrderDetails {
    readonly poId: UUID;
    readonly poNumber: string;
    readonly vendorId: UUID;
    readonly vendorName: string;
    readonly costCenterId: UUID;
    readonly costCenterCode: string;
    readonly status: POStatus;
    readonly requestedBy: UUID;
    readonly requestedByName: string;
    readonly requestedDate: ISODateString;
    readonly approvedBy: UUID | null;
    readonly approvedByName: string | null;
    readonly approvedDate: ISODateString | null;
    readonly sentDate: ISODateString | null;
    readonly expectedDeliveryDate: ISODateString | null;
    readonly subtotal: number;
    readonly taxAmount: number;
    readonly shippingAmount: number;
    readonly totalAmount: number;
    readonly lines: readonly POLine[];
    readonly notes: string | null;
    readonly createdAt: ISODateString;
    readonly updatedAt: ISODateString;
}
/**
 * Purchase order line item
 */
export interface POLine {
    readonly lineId: UUID;
    readonly poId: UUID;
    readonly lineNumber: number;
    readonly productType: POProductType;
    readonly productId: UUID | null;
    readonly productDescription: string;
    readonly sku: string | null;
    readonly quantity: number;
    readonly unitPrice: number;
    readonly lineTotal: number;
    readonly quantityReceived: number;
    readonly vendorId: UUID | null;
    readonly vendorName: string | null;
    readonly effectiveVendorId: UUID;
    readonly effectiveVendorName: string;
    readonly costCenterId: UUID | null;
    readonly costCenterCode: string | null;
    readonly effectiveCostCenterId: UUID;
    readonly effectiveCostCenterCode: string;
    readonly notes: string | null;
    readonly createdAt: string;
    readonly updatedAt: string;
}
/**
 * Request payload for creating a new purchase order
 */
export interface CreatePurchaseOrderRequest {
    readonly vendorId: UUID;
    readonly costCenterId: UUID;
    readonly expectedDeliveryDate?: string;
    readonly notes?: string;
    readonly lines?: readonly CreatePOLineRequest[];
    readonly createdBy?: UUID;
}
/**
 * Request payload for updating a purchase order
 */
export interface UpdatePurchaseOrderRequest {
    readonly vendorId?: UUID;
    readonly costCenterId?: UUID;
    readonly expectedDeliveryDate?: string | null;
    readonly taxAmount?: number;
    readonly shippingAmount?: number;
    readonly notes?: string | null;
    readonly updatedBy?: UUID;
}
/**
 * Request payload for creating a PO line item
 */
export interface CreatePOLineRequest {
    readonly productType: POProductType;
    readonly productId?: UUID;
    readonly productDescription: string;
    readonly sku?: string;
    readonly quantity: number;
    readonly unitPrice: number;
    readonly vendorId?: UUID;
    readonly costCenterId?: UUID;
    readonly notes?: string;
}
/**
 * Request payload for updating a PO line item
 */
export interface UpdatePOLineRequest {
    readonly quantity?: number;
    readonly unitPrice?: number;
    readonly vendorId?: UUID | null;
    readonly costCenterId?: UUID | null;
    readonly notes?: string | null;
}
/**
 * Request payload for adding a line to an existing PO
 */
export interface AddPOLineRequest {
    readonly poId: UUID;
    readonly line: CreatePOLineRequest;
}
/**
 * Request payload for submitting a PO for approval
 */
export interface SubmitForApprovalRequest {
    readonly poId: UUID;
}
/**
 * Request payload for approving a PO
 */
export interface ApprovePORequest {
    readonly poId: UUID;
    readonly approvalNotes?: string;
}
/**
 * Request payload for rejecting a PO
 */
export interface RejectPORequest {
    readonly poId: UUID;
    readonly rejectionReason: string;
}
/**
 * Request payload for sending a PO to vendor
 */
export interface SendPORequest {
    readonly poId: UUID;
    readonly sentDate?: string;
}
/**
 * Filters for listing purchase orders
 */
export interface POListFilters {
    readonly status?: POStatus;
    readonly vendorId?: UUID;
    readonly costCenterId?: UUID;
    readonly requestedBy?: UUID;
    readonly fromDate?: string;
    readonly toDate?: string;
    readonly search?: string;
}
/**
 * Approval threshold configuration
 */
export interface ApprovalThreshold {
    readonly thresholdId: UUID;
    readonly minAmount: number;
    readonly maxAmount: number | null;
    readonly approverRoleId: UUID;
    readonly approverRoleName: string;
    readonly requiresMultipleApprovers: boolean;
    readonly isActive: boolean;
}
/**
 * Approval delegation record
 */
export interface ApprovalDelegation {
    readonly delegationId: UUID;
    readonly delegatorId: UUID;
    readonly delegatorName: string;
    readonly delegateId: UUID;
    readonly delegateName: string;
    readonly startDate: ISODateString;
    readonly endDate: ISODateString;
    readonly isActive: boolean;
}
/**
 * Pending approval item
 */
export interface PendingApproval {
    readonly poId: UUID;
    readonly poNumber: string;
    readonly vendorName: string;
    readonly totalAmount: number;
    readonly requestedBy: string;
    readonly requestedDate: ISODateString;
    readonly daysWaiting: number;
}
/**
 * Request payload for creating an approval delegation
 */
export interface CreateDelegationRequest {
    readonly delegateId: UUID;
    readonly startDate: string;
    readonly endDate: string;
}
/**
 * Approval history record
 */
export interface ApprovalHistoryRecord {
    readonly historyId: UUID;
    readonly poId: UUID;
    readonly action: 'SUBMITTED' | 'APPROVED' | 'REJECTED' | 'DELEGATED';
    readonly performedBy: UUID;
    readonly performedByName: string;
    readonly performedAt: ISODateString;
    readonly notes: string | null;
}
