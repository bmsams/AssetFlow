/**
 * Mock data for the Procurement Workspace
 * Used for development and testing
 * Implements Requirement 12.3: Procurement Workspace
 */

import type {
  AssetRequest,
  PurchaseOrder,
  ReceivingItem,
  ProcurementSummary,
} from '../../types/procurement';

/**
 * Mock pending asset requests
 */
export const mockPendingRequests: AssetRequest[] = [
  {
    requestId: 'req-001',
    requestNumber: 'REQ-2025-0001',
    requesterName: 'John Smith',
    requesterEmail: 'john.smith@company.com',
    requesterDepartment: 'Engineering',
    itemName: 'MacBook Pro 16" M3 Max',
    itemCategory: 'Laptop',
    quantity: 1,
    unitPrice: 3499,
    totalPrice: 3499,
    justification: 'New hire equipment for senior developer position',
    status: 'PENDING_APPROVAL',
    priority: 'HIGH',
    requestedDate: '2025-01-25T10:30:00Z',
    deliveryLocation: 'Building A, Floor 3',
  },
  {
    requestId: 'req-002',
    requestNumber: 'REQ-2025-0002',
    requesterName: 'Sarah Johnson',
    requesterEmail: 'sarah.johnson@company.com',
    requesterDepartment: 'Marketing',
    itemName: 'Dell UltraSharp 32" Monitor',
    itemCategory: 'Monitor',
    quantity: 2,
    unitPrice: 899,
    totalPrice: 1798,
    justification: 'Dual monitor setup for design work',
    status: 'PENDING_APPROVAL',
    priority: 'MEDIUM',
    requestedDate: '2025-01-24T14:15:00Z',
    deliveryLocation: 'Building B, Floor 2',
  },
  {
    requestId: 'req-003',
    requestNumber: 'REQ-2025-0003',
    requesterName: 'Mike Chen',
    requesterEmail: 'mike.chen@company.com',
    requesterDepartment: 'IT Operations',
    itemName: 'Cisco Catalyst 9300 Switch',
    itemCategory: 'Network Equipment',
    quantity: 4,
    unitPrice: 4500,
    totalPrice: 18000,
    justification: 'Network infrastructure upgrade for new data center wing',
    status: 'PENDING_APPROVAL',
    priority: 'URGENT',
    requestedDate: '2025-01-26T09:00:00Z',
    deliveryLocation: 'Data Center, Rack A12',
  },
  {
    requestId: 'req-004',
    requestNumber: 'REQ-2025-0004',
    requesterName: 'Emily Davis',
    requesterEmail: 'emily.davis@company.com',
    requesterDepartment: 'Finance',
    itemName: 'HP LaserJet Pro MFP',
    itemCategory: 'Printer',
    quantity: 1,
    unitPrice: 549,
    totalPrice: 549,
    justification: 'Replacement for broken printer in finance department',
    status: 'PENDING_APPROVAL',
    priority: 'LOW',
    requestedDate: '2025-01-23T16:45:00Z',
    deliveryLocation: 'Building A, Floor 1',
  },
  {
    requestId: 'req-005',
    requestNumber: 'REQ-2025-0005',
    requesterName: 'Alex Turner',
    requesterEmail: 'alex.turner@company.com',
    requesterDepartment: 'Research',
    itemName: 'NVIDIA RTX 4090 GPU',
    itemCategory: 'Hardware Component',
    quantity: 2,
    unitPrice: 1599,
    totalPrice: 3198,
    justification: 'ML model training workstation upgrade',
    status: 'PENDING_APPROVAL',
    priority: 'HIGH',
    requestedDate: '2025-01-25T11:20:00Z',
    deliveryLocation: 'Research Lab, Room 204',
  },
];

/**
 * Mock purchase orders
 */
export const mockPurchaseOrders: PurchaseOrder[] = [
  {
    poId: 'po-001',
    poNumber: 'PO-2025-0001',
    vendorName: 'Dell Technologies',
    vendorId: 'vendor-001',
    status: 'SENT',
    orderDate: '2025-01-20T00:00:00Z',
    expectedDeliveryDate: '2025-02-01T00:00:00Z',
    totalAmount: 45000,
    lineItemCount: 15,
    requesterName: 'IT Procurement',
    approverName: 'Jane Wilson',
    approvedDate: '2025-01-19T00:00:00Z',
    receivedCount: 0,
    totalCount: 15,
  },
  {
    poId: 'po-002',
    poNumber: 'PO-2025-0002',
    vendorName: 'CDW Corporation',
    vendorId: 'vendor-002',
    status: 'PARTIALLY_RECEIVED',
    orderDate: '2025-01-15T00:00:00Z',
    expectedDeliveryDate: '2025-01-28T00:00:00Z',
    totalAmount: 28500,
    lineItemCount: 8,
    requesterName: 'IT Procurement',
    approverName: 'Jane Wilson',
    approvedDate: '2025-01-14T00:00:00Z',
    receivedCount: 5,
    totalCount: 8,
  },
  {
    poId: 'po-003',
    poNumber: 'PO-2025-0003',
    vendorName: 'Insight Enterprises',
    vendorId: 'vendor-003',
    status: 'PENDING_APPROVAL',
    orderDate: '2025-01-26T00:00:00Z',
    expectedDeliveryDate: '2025-02-10T00:00:00Z',
    totalAmount: 72000,
    lineItemCount: 4,
    requesterName: 'Network Team',
    receivedCount: 0,
    totalCount: 4,
  },
  {
    poId: 'po-004',
    poNumber: 'PO-2025-0004',
    vendorName: 'Apple Inc.',
    vendorId: 'vendor-004',
    status: 'APPROVED',
    orderDate: '2025-01-25T00:00:00Z',
    expectedDeliveryDate: '2025-02-05T00:00:00Z',
    totalAmount: 35000,
    lineItemCount: 10,
    requesterName: 'HR Department',
    approverName: 'Jane Wilson',
    approvedDate: '2025-01-25T00:00:00Z',
    receivedCount: 0,
    totalCount: 10,
  },
  {
    poId: 'po-005',
    poNumber: 'PO-2025-0005',
    vendorName: 'HP Inc.',
    vendorId: 'vendor-005',
    status: 'SENT',
    orderDate: '2025-01-22T00:00:00Z',
    expectedDeliveryDate: '2025-01-30T00:00:00Z',
    totalAmount: 15800,
    lineItemCount: 12,
    requesterName: 'Facilities',
    approverName: 'Jane Wilson',
    approvedDate: '2025-01-21T00:00:00Z',
    receivedCount: 0,
    totalCount: 12,
  },
];

/**
 * Mock receiving queue items
 */
export const mockReceivingQueue: ReceivingItem[] = [
  {
    receivingId: 'recv-001',
    poNumber: 'PO-2025-0002',
    poId: 'po-002',
    vendorName: 'CDW Corporation',
    itemDescription: 'Dell Latitude 5540 Laptops (3 units)',
    expectedQuantity: 3,
    receivedQuantity: 0,
    status: 'PENDING',
    expectedDate: '2025-01-28T00:00:00Z',
    trackingNumber: '1Z999AA10123456784',
    stockroomName: 'Main IT Stockroom',
    stockroomId: 'stockroom-001',
  },
  {
    receivingId: 'recv-002',
    poNumber: 'PO-2025-0001',
    poId: 'po-001',
    vendorName: 'Dell Technologies',
    itemDescription: 'Dell PowerEdge R750 Server',
    expectedQuantity: 2,
    receivedQuantity: 0,
    status: 'PENDING',
    expectedDate: '2025-02-01T00:00:00Z',
    trackingNumber: '1Z999AA10123456785',
    stockroomName: 'Data Center Receiving',
    stockroomId: 'stockroom-002',
  },
  {
    receivingId: 'recv-003',
    poNumber: 'PO-2025-0005',
    poId: 'po-005',
    vendorName: 'HP Inc.',
    itemDescription: 'HP LaserJet Enterprise Printers (6 units)',
    expectedQuantity: 6,
    receivedQuantity: 2,
    status: 'IN_PROGRESS',
    expectedDate: '2025-01-30T00:00:00Z',
    trackingNumber: '1Z999AA10123456786',
    stockroomName: 'Main IT Stockroom',
    stockroomId: 'stockroom-001',
    notes: 'Partial shipment received, awaiting remaining units',
  },
  {
    receivingId: 'recv-004',
    poNumber: 'PO-2025-0002',
    poId: 'po-002',
    vendorName: 'CDW Corporation',
    itemDescription: 'Cisco Meraki Access Points (5 units)',
    expectedQuantity: 5,
    receivedQuantity: 5,
    status: 'COMPLETED',
    expectedDate: '2025-01-25T00:00:00Z',
    stockroomName: 'Network Equipment Room',
    stockroomId: 'stockroom-003',
  },
  {
    receivingId: 'recv-005',
    poNumber: 'PO-2025-0001',
    poId: 'po-001',
    vendorName: 'Dell Technologies',
    itemDescription: 'Dell UltraSharp Monitors (10 units)',
    expectedQuantity: 10,
    receivedQuantity: 0,
    status: 'ISSUE_REPORTED',
    expectedDate: '2025-01-27T00:00:00Z',
    trackingNumber: '1Z999AA10123456787',
    stockroomName: 'Main IT Stockroom',
    stockroomId: 'stockroom-001',
    notes: 'Shipment delayed due to weather conditions',
  },
];

/**
 * Complete mock procurement summary
 */
export const mockProcurementSummary: ProcurementSummary = {
  pendingRequestsCount: mockPendingRequests.length,
  pendingRequestsValue: mockPendingRequests.reduce((sum, req) => sum + req.totalPrice, 0),
  openPurchaseOrdersCount: mockPurchaseOrders.filter(
    po => !['RECEIVED', 'CANCELLED'].includes(po.status)
  ).length,
  openPurchaseOrdersValue: mockPurchaseOrders
    .filter(po => !['RECEIVED', 'CANCELLED'].includes(po.status))
    .reduce((sum, po) => sum + po.totalAmount, 0),
  awaitingReceivingCount: mockReceivingQueue.filter(
    item => item.status === 'PENDING' || item.status === 'IN_PROGRESS'
  ).length,
  overdueDeliveriesCount: mockReceivingQueue.filter(
    item => 
      (item.status === 'PENDING' || item.status === 'IN_PROGRESS') &&
      new Date(item.expectedDate) < new Date()
  ).length,
  pendingRequests: mockPendingRequests,
  purchaseOrders: mockPurchaseOrders,
  receivingQueue: mockReceivingQueue,
};

/**
 * Helper to simulate API loading delay
 */
export function simulateApiDelay<T>(data: T, delayMs = 1000): Promise<T> {
  return new Promise((resolve) => {
    setTimeout(() => resolve(data), delayMs);
  });
}
