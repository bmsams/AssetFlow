/**
 * Purchase Order Seed Data
 * Validates: Requirement 3.10 - At least 10 purchase orders with line items
 */

import type { SeedPurchaseOrder } from './types';

export const PURCHASE_ORDERS: SeedPurchaseOrder[] = [
  {
    poNumber: 'PO-2024-001',
    vendorCode: 'DELL',
    requesterEmail: 'procurement@example.com',
    status: 'RECEIVED',
    orderDate: '2024-01-15',
    expectedDeliveryDate: '2024-02-01',
    totalAmount: 45000,
    lines: [
      { lineNumber: 1, productDescription: 'Dell Latitude 5540 Laptop', productType: 'HARDWARE_MODEL', quantity: 10, unitPrice: 1500 },
      { lineNumber: 2, productDescription: 'Dell UltraSharp U2723QE Monitor', productType: 'HARDWARE_MODEL', quantity: 10, unitPrice: 800 },
      { lineNumber: 3, productDescription: 'Dell Docking Station WD19TBS', productType: 'HARDWARE_MODEL', quantity: 10, unitPrice: 350 },
      { lineNumber: 4, productDescription: 'Dell Pro Wireless Keyboard and Mouse', productType: 'HARDWARE_MODEL', quantity: 10, unitPrice: 100 },
    ],
  },
  {
    poNumber: 'PO-2024-002',
    vendorCode: 'CDW',
    requesterEmail: 'asset.manager@example.com',
    status: 'RECEIVED',
    orderDate: '2024-01-20',
    expectedDeliveryDate: '2024-02-05',
    totalAmount: 28500,
    lines: [
      { lineNumber: 1, productDescription: 'Cisco Catalyst 9200L-24P-4G Switch', productType: 'HARDWARE_MODEL', quantity: 3, unitPrice: 4500 },
      { lineNumber: 2, productDescription: 'Cisco Meraki MR46 Access Point', productType: 'HARDWARE_MODEL', quantity: 10, unitPrice: 1200 },
      { lineNumber: 3, productDescription: 'Network Cabling and Installation', productType: 'SERVICE', quantity: 1, unitPrice: 2000 },
    ],
  },
  {
    poNumber: 'PO-2024-003',
    vendorCode: 'SHI',
    requesterEmail: 'license.analyst@example.com',
    status: 'RECEIVED',
    orderDate: '2024-01-25',
    expectedDeliveryDate: '2024-02-01',
    totalAmount: 86400,
    lines: [
      { lineNumber: 1, productDescription: 'Microsoft 365 E3 (200 users, 1 year)', productType: 'SOFTWARE_PRODUCT', quantity: 200, unitPrice: 432 },
    ],
  },
  {
    poNumber: 'PO-2024-004',
    vendorCode: 'APPLE',
    requesterEmail: 'procurement@example.com',
    status: 'PARTIALLY_RECEIVED',
    orderDate: '2024-02-01',
    expectedDeliveryDate: '2024-02-15',
    totalAmount: 52000,
    lines: [
      { lineNumber: 1, productDescription: 'MacBook Pro 14" M3 Pro', productType: 'HARDWARE_MODEL', quantity: 5, unitPrice: 2499 },
      { lineNumber: 2, productDescription: 'MacBook Air 15" M3', productType: 'HARDWARE_MODEL', quantity: 10, unitPrice: 1299 },
      { lineNumber: 3, productDescription: 'iPhone 15 Pro', productType: 'HARDWARE_MODEL', quantity: 20, unitPrice: 999 },
    ],
  },
  {
    poNumber: 'PO-2024-005',
    vendorCode: 'LENOVO',
    requesterEmail: 'inventory.manager@example.com',
    status: 'SENT',
    orderDate: '2024-02-10',
    expectedDeliveryDate: '2024-03-01',
    totalAmount: 67500,
    lines: [
      { lineNumber: 1, productDescription: 'ThinkPad X1 Carbon Gen 11', productType: 'HARDWARE_MODEL', quantity: 15, unitPrice: 2500 },
      { lineNumber: 2, productDescription: 'ThinkPad T14 Gen 4', productType: 'HARDWARE_MODEL', quantity: 20, unitPrice: 1500 },
    ],
  },
  {
    poNumber: 'PO-2024-006',
    vendorCode: 'HP',
    requesterEmail: 'asset.manager@example.com',
    status: 'APPROVED',
    orderDate: '2024-02-15',
    expectedDeliveryDate: '2024-03-05',
    totalAmount: 35000,
    lines: [
      { lineNumber: 1, productDescription: 'HP EliteBook 840 G10', productType: 'HARDWARE_MODEL', quantity: 15, unitPrice: 1800 },
      { lineNumber: 2, productDescription: 'HP ProDesk 400 G9 Desktop', productType: 'HARDWARE_MODEL', quantity: 10, unitPrice: 800 },
    ],
  },
  {
    poNumber: 'PO-2024-007',
    vendorCode: 'MSFT',
    requesterEmail: 'license.analyst@example.com',
    status: 'RECEIVED',
    orderDate: '2024-02-20',
    expectedDeliveryDate: '2024-02-25',
    totalAmount: 31560,
    lines: [
      { lineNumber: 1, productDescription: 'Windows Server 2022 Standard (10 cores)', productType: 'SOFTWARE_PRODUCT', quantity: 10, unitPrice: 1069 },
      { lineNumber: 2, productDescription: 'SQL Server 2022 Standard (8 cores)', productType: 'SOFTWARE_PRODUCT', quantity: 8, unitPrice: 2495 },
    ],
  },
  {
    poNumber: 'PO-2024-008',
    vendorCode: 'CISCO',
    requesterEmail: 'asset.manager@example.com',
    status: 'PENDING_APPROVAL',
    orderDate: '2024-03-01',
    expectedDeliveryDate: '2024-03-20',
    totalAmount: 45000,
    lines: [
      { lineNumber: 1, productDescription: 'Cisco Catalyst 9200L-48P-4G Switch', productType: 'HARDWARE_MODEL', quantity: 5, unitPrice: 6500 },
      { lineNumber: 2, productDescription: 'Cisco SmartNet Support (1 year)', productType: 'SERVICE', quantity: 5, unitPrice: 1500 },
    ],
  },
  {
    poNumber: 'PO-2024-009',
    vendorCode: 'DELL',
    requesterEmail: 'procurement@example.com',
    status: 'SENT',
    orderDate: '2024-03-20',
    expectedDeliveryDate: '2024-04-10',
    totalAmount: 125000,
    lines: [
      { lineNumber: 1, productDescription: 'Dell PowerEdge R750 Server', productType: 'HARDWARE_MODEL', quantity: 2, unitPrice: 15000 },
      { lineNumber: 2, productDescription: 'Dell PowerVault ME5024 Storage', productType: 'HARDWARE_MODEL', quantity: 1, unitPrice: 25000 },
      { lineNumber: 3, productDescription: 'Dell Latitude 7440 Laptop', productType: 'HARDWARE_MODEL', quantity: 30, unitPrice: 2000 },
    ],
  },
  {
    poNumber: 'PO-2024-010',
    vendorCode: 'HP',
    requesterEmail: 'inventory.manager@example.com',
    status: 'DRAFT',
    orderDate: '2024-03-25',
    expectedDeliveryDate: '2024-04-15',
    totalAmount: 8500,
    lines: [
      { lineNumber: 1, productDescription: 'HP LaserJet Pro M404dn Printer', productType: 'HARDWARE_MODEL', quantity: 5, unitPrice: 400 },
      { lineNumber: 2, productDescription: 'HP Toner Cartridge CF258X', productType: 'OTHER', quantity: 50, unitPrice: 130 },
    ],
  },
  {
    poNumber: 'PO-2024-011',
    vendorCode: 'INSIGHT',
    requesterEmail: 'license.analyst@example.com',
    status: 'PENDING_APPROVAL',
    orderDate: '2024-03-28',
    expectedDeliveryDate: '2024-04-05',
    totalAmount: 28770,
    lines: [
      { lineNumber: 1, productDescription: 'Adobe Creative Cloud All Apps (30 users)', productType: 'SOFTWARE_PRODUCT', quantity: 30, unitPrice: 959 },
    ],
  },
  {
    poNumber: 'PO-2024-012',
    vendorCode: 'TECHSERVE',
    requesterEmail: 'asset.manager@example.com',
    status: 'RECEIVED',
    orderDate: '2024-02-15',
    expectedDeliveryDate: '2024-02-20',
    totalAmount: 15000,
    lines: [
      { lineNumber: 1, productDescription: 'IT Support Services - Q1 2024', productType: 'SERVICE', quantity: 1, unitPrice: 15000 },
    ],
  },
];
