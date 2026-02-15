/**
 * Mock data for the Stockroom Dashboard
 * Used for development and testing
 * Implements Requirement 12.4: Stockroom Dashboard
 */

import type {
  Stockroom,
  TransferOrder,
  ReplenishmentAlert,
  StockroomSummary,
} from '../../types/stockroom';

/**
 * Mock stockrooms
 */
export const mockStockrooms: Stockroom[] = [
  {
    stockroomId: 'stockroom-001',
    name: 'Main IT Stockroom',
    location: 'Building A, Floor 1',
    stockroomType: 'IT',
    managerName: 'John Smith',
    managerId: 'user-001',
    isActive: true,
    totalItems: 1247,
    totalValue: 2450000,
    utilizationPercentage: 78,
  },
  {
    stockroomId: 'stockroom-002',
    name: 'Data Center Receiving',
    location: 'Data Center, Dock B',
    stockroomType: 'DATA_CENTER',
    managerName: 'Sarah Johnson',
    managerId: 'user-002',
    isActive: true,
    totalItems: 523,
    totalValue: 1850000,
    utilizationPercentage: 65,
  },
  {
    stockroomId: 'stockroom-003',
    name: 'Network Equipment Room',
    location: 'Building B, Floor 2',
    stockroomType: 'IT',
    managerName: 'Mike Chen',
    managerId: 'user-003',
    isActive: true,
    totalItems: 312,
    totalValue: 890000,
    utilizationPercentage: 45,
  },
  {
    stockroomId: 'stockroom-004',
    name: 'Field Operations Depot',
    location: 'Warehouse C',
    stockroomType: 'FIELD',
    managerName: 'Emily Davis',
    managerId: 'user-004',
    isActive: true,
    totalItems: 856,
    totalValue: 1120000,
    utilizationPercentage: 82,
  },
  {
    stockroomId: 'stockroom-005',
    name: 'Repair Center',
    location: 'Building D, Basement',
    stockroomType: 'REPAIR',
    managerName: 'Alex Turner',
    managerId: 'user-005',
    isActive: true,
    totalItems: 189,
    totalValue: 340000,
    utilizationPercentage: 35,
  },
];

/**
 * Mock transfer orders
 */
export const mockTransferOrders: TransferOrder[] = [
  {
    transferId: 'transfer-001',
    transferNumber: 'TRF-2025-0001',
    fromStockroomId: 'stockroom-001',
    fromStockroomName: 'Main IT Stockroom',
    toStockroomId: 'stockroom-003',
    toStockroomName: 'Network Equipment Room',
    status: 'IN_TRANSIT',
    requestedBy: 'Mike Chen',
    requestedDate: '2025-01-24T10:30:00Z',
    approvedBy: 'John Smith',
    approvedDate: '2025-01-24T14:00:00Z',
    itemCount: 15,
    totalValue: 45000,
    expectedDeliveryDate: '2025-01-28T00:00:00Z',
    notes: 'Network upgrade equipment for Building B',
  },
  {
    transferId: 'transfer-002',
    transferNumber: 'TRF-2025-0002',
    fromStockroomId: 'stockroom-002',
    fromStockroomName: 'Data Center Receiving',
    toStockroomId: 'stockroom-001',
    toStockroomName: 'Main IT Stockroom',
    status: 'PENDING_APPROVAL',
    requestedBy: 'Sarah Johnson',
    requestedDate: '2025-01-26T09:15:00Z',
    itemCount: 8,
    totalValue: 28500,
    notes: 'Excess inventory redistribution',
  },
  {
    transferId: 'transfer-003',
    transferNumber: 'TRF-2025-0003',
    fromStockroomId: 'stockroom-001',
    fromStockroomName: 'Main IT Stockroom',
    toStockroomId: 'stockroom-004',
    toStockroomName: 'Field Operations Depot',
    status: 'APPROVED',
    requestedBy: 'Emily Davis',
    requestedDate: '2025-01-25T11:00:00Z',
    approvedBy: 'John Smith',
    approvedDate: '2025-01-26T08:30:00Z',
    itemCount: 25,
    totalValue: 67000,
    expectedDeliveryDate: '2025-01-30T00:00:00Z',
    notes: 'Field technician equipment refresh',
  },
  {
    transferId: 'transfer-004',
    transferNumber: 'TRF-2025-0004',
    fromStockroomId: 'stockroom-005',
    fromStockroomName: 'Repair Center',
    toStockroomId: 'stockroom-001',
    toStockroomName: 'Main IT Stockroom',
    status: 'COMPLETED',
    requestedBy: 'Alex Turner',
    requestedDate: '2025-01-20T14:30:00Z',
    approvedBy: 'John Smith',
    approvedDate: '2025-01-20T16:00:00Z',
    itemCount: 12,
    totalValue: 18500,
    notes: 'Refurbished equipment return to stock',
  },
  {
    transferId: 'transfer-005',
    transferNumber: 'TRF-2025-0005',
    fromStockroomId: 'stockroom-003',
    fromStockroomName: 'Network Equipment Room',
    toStockroomId: 'stockroom-002',
    toStockroomName: 'Data Center Receiving',
    status: 'IN_TRANSIT',
    requestedBy: 'Sarah Johnson',
    requestedDate: '2025-01-23T08:45:00Z',
    approvedBy: 'Mike Chen',
    approvedDate: '2025-01-23T10:00:00Z',
    itemCount: 6,
    totalValue: 125000,
    expectedDeliveryDate: '2025-01-27T00:00:00Z',
    notes: 'Data center expansion equipment',
  },
];

/**
 * Mock replenishment alerts
 */
export const mockReplenishmentAlerts: ReplenishmentAlert[] = [
  {
    alertId: 'alert-001',
    stockroomId: 'stockroom-001',
    stockroomName: 'Main IT Stockroom',
    productId: 'product-001',
    productName: 'Dell Latitude 5540 Laptop',
    productCategory: 'Laptop',
    currentQuantity: 3,
    reorderPoint: 10,
    reorderQuantity: 25,
    severity: 'critical',
    daysUntilStockout: 2,
    suggestedAction: 'Create purchase order immediately',
    createdAt: '2025-01-26T08:00:00Z',
  },
  {
    alertId: 'alert-002',
    stockroomId: 'stockroom-001',
    stockroomName: 'Main IT Stockroom',
    productId: 'product-002',
    productName: 'HP LaserJet Pro MFP',
    productCategory: 'Printer',
    currentQuantity: 5,
    reorderPoint: 8,
    reorderQuantity: 15,
    severity: 'warning',
    daysUntilStockout: 7,
    suggestedAction: 'Review and create purchase order',
    createdAt: '2025-01-25T14:30:00Z',
  },
  {
    alertId: 'alert-003',
    stockroomId: 'stockroom-003',
    stockroomName: 'Network Equipment Room',
    productId: 'product-003',
    productName: 'Cisco Catalyst 9300 Switch',
    productCategory: 'Network Equipment',
    currentQuantity: 2,
    reorderPoint: 5,
    reorderQuantity: 10,
    severity: 'critical',
    daysUntilStockout: 3,
    suggestedAction: 'Create purchase order immediately',
    createdAt: '2025-01-26T06:00:00Z',
  },
  {
    alertId: 'alert-004',
    stockroomId: 'stockroom-004',
    stockroomName: 'Field Operations Depot',
    productId: 'product-004',
    productName: 'USB-C Docking Station',
    productCategory: 'Accessory',
    currentQuantity: 12,
    reorderPoint: 15,
    reorderQuantity: 30,
    severity: 'warning',
    daysUntilStockout: 10,
    suggestedAction: 'Review and create purchase order',
    createdAt: '2025-01-24T11:00:00Z',
  },
  {
    alertId: 'alert-005',
    stockroomId: 'stockroom-002',
    stockroomName: 'Data Center Receiving',
    productId: 'product-005',
    productName: 'Dell PowerEdge R750 Server',
    productCategory: 'Server',
    currentQuantity: 4,
    reorderPoint: 6,
    reorderQuantity: 8,
    severity: 'info',
    daysUntilStockout: 21,
    suggestedAction: 'Monitor stock levels',
    createdAt: '2025-01-23T09:15:00Z',
  },
  {
    alertId: 'alert-006',
    stockroomId: 'stockroom-001',
    stockroomName: 'Main IT Stockroom',
    productId: 'product-006',
    productName: 'Logitech MX Master 3 Mouse',
    productCategory: 'Accessory',
    currentQuantity: 8,
    reorderPoint: 20,
    reorderQuantity: 50,
    severity: 'warning',
    daysUntilStockout: 5,
    suggestedAction: 'Review and create purchase order',
    createdAt: '2025-01-25T16:45:00Z',
  },
];

/**
 * Complete mock stockroom summary
 */
export const mockStockroomSummary: StockroomSummary = {
  totalStockrooms: mockStockrooms.length,
  totalInventoryValue: mockStockrooms.reduce((sum, s) => sum + s.totalValue, 0),
  totalItemCount: mockStockrooms.reduce((sum, s) => sum + s.totalItems, 0),
  lowStockAlertCount: mockReplenishmentAlerts.filter(
    a => a.severity === 'critical' || a.severity === 'warning'
  ).length,
  pendingTransfersCount: mockTransferOrders.filter(
    t => t.status === 'PENDING_APPROVAL'
  ).length,
  inTransitCount: mockTransferOrders.filter(
    t => t.status === 'IN_TRANSIT'
  ).length,
  stockrooms: mockStockrooms,
  transferOrders: mockTransferOrders,
  replenishmentAlerts: mockReplenishmentAlerts,
};

/**
 * Helper to simulate API loading delay
 */
export function simulateApiDelay<T>(data: T, delayMs = 1000): Promise<T> {
  return new Promise((resolve) => {
    setTimeout(() => resolve(data), delayMs);
  });
}
