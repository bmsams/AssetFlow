/**
 * Stockroom types for the Asset Management System
 * Implements Requirement 12.4: Stockroom Dashboard
 */

/**
 * Stockroom type
 */
export type StockroomType = 'IT' | 'WAREHOUSE' | 'DATA_CENTER' | 'FIELD' | 'REPAIR';

/**
 * Transfer order status
 */
export type TransferOrderStatus =
  | 'PENDING_APPROVAL'
  | 'APPROVED'
  | 'IN_TRANSIT'
  | 'COMPLETED'
  | 'CANCELLED';

/**
 * Replenishment alert severity
 */
export type AlertSeverity = 'critical' | 'warning' | 'info';

/**
 * Stockroom entity
 */
export interface Stockroom {
  stockroomId: string;
  name: string;
  location: string;
  stockroomType: StockroomType;
  managerName: string;
  managerId: string;
  isActive: boolean;
  totalItems: number;
  totalValue: number;
  utilizationPercentage: number;
}

/**
 * Inventory item in a stockroom
 */
export interface StockroomInventoryItem {
  productId: string;
  productName: string;
  productCategory: string;
  quantityOnHand: number;
  quantityReserved: number;
  quantityAvailable: number;
  reorderPoint: number;
  reorderQuantity: number;
  unitCost: number;
  totalValue: number;
  lastRestocked: string;
}

/**
 * Transfer order between stockrooms
 */
export interface TransferOrder {
  transferId: string;
  transferNumber: string;
  fromStockroomId: string;
  fromStockroomName: string;
  toStockroomId: string;
  toStockroomName: string;
  status: TransferOrderStatus;
  requestedBy: string;
  requestedDate: string;
  approvedBy?: string;
  approvedDate?: string;
  itemCount: number;
  totalValue: number;
  expectedDeliveryDate?: string;
  notes?: string;
}

/**
 * Replenishment alert
 */
export interface ReplenishmentAlert {
  alertId: string;
  stockroomId: string;
  stockroomName: string;
  productId: string;
  productName: string;
  productCategory: string;
  currentQuantity: number;
  reorderPoint: number;
  reorderQuantity: number;
  severity: AlertSeverity;
  daysUntilStockout: number;
  suggestedAction: string;
  createdAt: string;
}

/**
 * Stockroom dashboard summary
 */
export interface StockroomSummary {
  totalStockrooms: number;
  totalInventoryValue: number;
  totalItemCount: number;
  lowStockAlertCount: number;
  pendingTransfersCount: number;
  inTransitCount: number;
  stockrooms: Stockroom[];
  transferOrders: TransferOrder[];
  replenishmentAlerts: ReplenishmentAlert[];
}

/**
 * Get status color for transfer order status
 */
export function getTransferStatusColor(status: TransferOrderStatus): string {
  switch (status) {
    case 'PENDING_APPROVAL':
      return 'var(--color-warning-500)';
    case 'APPROVED':
      return 'var(--color-primary-500)';
    case 'IN_TRANSIT':
      return 'var(--color-info-500)';
    case 'COMPLETED':
      return 'var(--color-success-500)';
    case 'CANCELLED':
      return 'var(--color-gray-500)';
    default:
      return 'var(--color-gray-500)';
  }
}

/**
 * Get severity color for alerts
 */
export function getAlertSeverityColor(severity: AlertSeverity): string {
  switch (severity) {
    case 'critical':
      return 'var(--color-error-500)';
    case 'warning':
      return 'var(--color-warning-500)';
    case 'info':
      return 'var(--color-info-500)';
    default:
      return 'var(--color-gray-500)';
  }
}

/**
 * Get stockroom type label
 */
export function getStockroomTypeLabel(type: StockroomType): string {
  switch (type) {
    case 'IT':
      return 'IT Stockroom';
    case 'WAREHOUSE':
      return 'Warehouse';
    case 'DATA_CENTER':
      return 'Data Center';
    case 'FIELD':
      return 'Field Location';
    case 'REPAIR':
      return 'Repair Center';
    default:
      return type;
  }
}

/**
 * Format status for display
 */
export function formatTransferStatus(status: TransferOrderStatus): string {
  return status
    .split('_')
    .map(word => word.charAt(0) + word.slice(1).toLowerCase())
    .join(' ');
}

/**
 * Format currency value
 */
export function formatStockroomCurrency(value: number): string {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(value);
}
