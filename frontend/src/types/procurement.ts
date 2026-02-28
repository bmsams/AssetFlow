/**
 * Procurement types for the Asset Management System
 * Implements Requirement 12.3: Procurement Workspace
 */

/**
 * Asset request status (procurement workflow)
 */
export type AssetRequestStatus = 
  | 'PENDING_APPROVAL'
  | 'APPROVED'
  | 'REJECTED'
  | 'FULFILLED'
  | 'CANCELLED';

/**
 * Purchase order status
 * Aligned with backend @ams/types/purchase-order.ts POStatus
 */
export type PurchaseOrderStatus =
  | 'DRAFT'
  | 'PENDING_APPROVAL'
  | 'APPROVED'
  | 'REJECTED'
  | 'SENT'
  | 'ACKNOWLEDGED'
  | 'PARTIALLY_RECEIVED'
  | 'RECEIVED'
  | 'CLOSED'
  | 'INVOICED'
  | 'PAID'
  | 'ON_HOLD'
  | 'CANCELLED';

/**
 * Receiving item status
 */
export type ReceivingStatus =
  | 'PENDING'
  | 'IN_PROGRESS'
  | 'COMPLETED'
  | 'CANCELLED'
  | 'ISSUE_REPORTED';

/**
 * Priority levels
 */
export type Priority = 'LOW' | 'MEDIUM' | 'HIGH' | 'URGENT';

/**
 * Asset request from service catalog
 */
export interface AssetRequest {
  requestId: string;
  requestNumber: string;
  requesterName: string;
  requesterEmail: string;
  requesterDepartment: string;
  itemName: string;
  itemCategory: string;
  quantity: number;
  unitPrice: number;
  totalPrice: number;
  justification: string;
  status: AssetRequestStatus;
  priority: Priority;
  requestedDate: string;
  approverName?: string;
  approvedDate?: string;
  deliveryLocation: string;
}

/**
 * Purchase order
 */
export interface PurchaseOrder {
  poId: string;
  poNumber: string;
  vendorName: string;
  vendorId: string;
  status: PurchaseOrderStatus;
  orderDate: string;
  expectedDeliveryDate: string;
  totalAmount: number;
  lineItemCount: number;
  requesterName: string;
  approverName?: string;
  approvedDate?: string;
  receivedCount: number;
  totalCount: number;
}

/**
 * Receiving queue item
 */
export interface ReceivingItem {
  receivingId: string;
  poNumber: string;
  poId: string;
  vendorName: string;
  itemDescription: string;
  expectedQuantity: number;
  receivedQuantity: number;
  status: ReceivingStatus;
  expectedDate: string;
  trackingNumber?: string;
  stockroomName: string;
  stockroomId: string;
  notes?: string;
}

/**
 * Procurement workspace summary
 */
export interface ProcurementSummary {
  pendingRequestsCount: number;
  pendingRequestsValue: number;
  openPurchaseOrdersCount: number;
  openPurchaseOrdersValue: number;
  awaitingReceivingCount: number;
  overdueDeliveriesCount: number;
  pendingRequests: AssetRequest[];
  purchaseOrders: PurchaseOrder[];
  receivingQueue: ReceivingItem[];
}

/**
 * Get status color for request status
 */
export function getRequestStatusColor(status: AssetRequestStatus): string {
  switch (status) {
    case 'PENDING_APPROVAL':
      return 'var(--color-warning-500)';
    case 'APPROVED':
      return 'var(--color-success-500)';
    case 'REJECTED':
      return 'var(--color-error-500)';
    case 'FULFILLED':
      return 'var(--color-primary-500)';
    case 'CANCELLED':
      return 'var(--color-gray-500)';
    default:
      return 'var(--color-gray-500)';
  }
}

/**
 * Get status color for purchase order status
 */
export function getPurchaseOrderStatusColor(status: PurchaseOrderStatus): string {
  switch (status) {
    case 'DRAFT':
      return 'var(--color-gray-500)';
    case 'PENDING_APPROVAL':
      return 'var(--color-warning-500)';
    case 'APPROVED':
      return 'var(--color-primary-500)';
    case 'REJECTED':
      return 'var(--color-error-500)';
    case 'SENT':
      return 'var(--color-info-500)';
    case 'ACKNOWLEDGED':
      return 'var(--color-info-500)';
    case 'PARTIALLY_RECEIVED':
      return 'var(--color-warning-500)';
    case 'RECEIVED':
      return 'var(--color-success-500)';
    case 'CLOSED':
      return 'var(--color-success-500)';
    case 'INVOICED':
      return 'var(--color-primary-500)';
    case 'PAID':
      return 'var(--color-success-500)';
    case 'ON_HOLD':
      return 'var(--color-warning-500)';
    case 'CANCELLED':
      return 'var(--color-error-500)';
    default:
      return 'var(--color-gray-500)';
  }
}

/**
 * Get status color for receiving status
 */
export function getReceivingStatusColor(status: ReceivingStatus): string {
  switch (status) {
    case 'PENDING':
      return 'var(--color-warning-500)';
    case 'IN_PROGRESS':
      return 'var(--color-primary-500)';
    case 'COMPLETED':
      return 'var(--color-success-500)';
    case 'CANCELLED':
      return 'var(--color-gray-500)';
    case 'ISSUE_REPORTED':
      return 'var(--color-error-500)';
    default:
      return 'var(--color-gray-500)';
  }
}

/**
 * Get priority color
 */
export function getPriorityColor(priority: Priority): string {
  switch (priority) {
    case 'URGENT':
      return 'var(--color-error-500)';
    case 'HIGH':
      return 'var(--color-warning-500)';
    case 'MEDIUM':
      return 'var(--color-primary-500)';
    case 'LOW':
      return 'var(--color-gray-500)';
    default:
      return 'var(--color-gray-500)';
  }
}

// Note: formatStatus is now available from '@/utils/formatters'
// Re-export for backward compatibility
export { formatStatus } from '../utils/formatters';
