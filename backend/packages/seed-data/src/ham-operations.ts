/**
 * HAM (Hardware Asset Management) Operations Seed Data
 *
 * Seeds transfers, loaner checkouts, disposal workflows, and audit records
 * to populate HAM-specific tables for realistic demo/test data.
 */

import type {
  SeedTransferOrder,
  SeedLoanerCheckout,
  SeedDisposalWorkflow,
} from './types';

// ============================================================================
// Transfer Orders
// ============================================================================

export const TRANSFER_ORDERS: SeedTransferOrder[] = [
  {
    transferNumber: 'TRF-2025-001',
    fromStockroomCode: 'MAIN-WH',
    toStockroomCode: 'IT-CLOSET',
    status: 'COMPLETED',
    priority: 'HIGH',
    requesterEmail: 'asset.manager@example.com',
    reason: 'IT department quarterly laptop refresh - restocking IT closet',
    lines: [
      { lineNumber: 1, productDescription: 'Dell Latitude 5540 Laptop', quantity: 10, status: 'RECEIVED' },
      { lineNumber: 2, productDescription: 'Dell 27" Monitor U2723QE', quantity: 10, status: 'RECEIVED' },
      { lineNumber: 3, productDescription: 'Dell Docking Station WD22TB4', quantity: 10, status: 'RECEIVED' },
    ],
  },
  {
    transferNumber: 'TRF-2025-002',
    fromStockroomCode: 'MAIN-WH',
    toStockroomCode: 'REMOTE-1',
    status: 'IN_TRANSIT',
    priority: 'NORMAL',
    requesterEmail: 'inventory.manager@example.com',
    reason: 'Remote office expansion - new hire equipment',
    lines: [
      { lineNumber: 1, productDescription: 'HP EliteBook 840 G10 Laptop', quantity: 5, status: 'SHIPPED' },
      { lineNumber: 2, productDescription: 'HP E24d G4 Monitor', quantity: 5, status: 'SHIPPED' },
    ],
  },
  {
    transferNumber: 'TRF-2025-003',
    fromStockroomCode: 'IT-CLOSET',
    toStockroomCode: 'MAIN-WH',
    status: 'PENDING_APPROVAL',
    priority: 'LOW',
    requesterEmail: 'technician@example.com',
    reason: 'Return excess inventory from IT closet to main warehouse',
    lines: [
      { lineNumber: 1, productDescription: 'Logitech MX Master 3S Mouse', quantity: 20, status: 'PENDING' },
      { lineNumber: 2, productDescription: 'Logitech MX Keys Keyboard', quantity: 15, status: 'PENDING' },
    ],
  },
  {
    transferNumber: 'TRF-2025-004',
    fromStockroomCode: 'MAIN-WH',
    toStockroomCode: 'IT-CLOSET',
    status: 'APPROVED',
    priority: 'URGENT',
    requesterEmail: 'asset.manager@example.com',
    reason: 'Emergency replacement - failed server components',
    lines: [
      { lineNumber: 1, productDescription: 'Dell PowerEdge R750 Server', quantity: 2, status: 'PENDING' },
      { lineNumber: 2, productDescription: 'Samsung PM9A3 NVMe SSD 3.84TB', quantity: 8, status: 'PENDING' },
      { lineNumber: 3, productDescription: 'Kingston DDR5 ECC 64GB', quantity: 16, status: 'PENDING' },
    ],
  },
  {
    transferNumber: 'TRF-2025-005',
    fromStockroomCode: 'REMOTE-1',
    toStockroomCode: 'MAIN-WH',
    status: 'DRAFT',
    priority: 'NORMAL',
    requesterEmail: 'inventory.manager@example.com',
    reason: 'Consolidation of retired equipment for disposal processing',
    lines: [
      { lineNumber: 1, productDescription: 'Lenovo ThinkPad T480 (retired)', quantity: 8, status: 'PENDING' },
      { lineNumber: 2, productDescription: 'Dell OptiPlex 7070 (retired)', quantity: 4, status: 'PENDING' },
    ],
  },
];

// ============================================================================
// Loaner Checkouts
// ============================================================================

export const LOANER_CHECKOUTS: SeedLoanerCheckout[] = [
  {
    checkoutNumber: 'LNR-2025-001',
    assetDisplayName: 'Laptop Asset 001',
    checkedOutToEmail: 'engineer1@example.com',
    checkedOutByEmail: 'technician@example.com',
    dueDateOffsetDays: 14,
    conditionOut: 'EXCELLENT',
    purpose: 'Temporary replacement while primary laptop is in repair',
    departmentCode: 'IT',
    status: 'CHECKED_OUT',
    isOverdue: false,
  },
  {
    checkoutNumber: 'LNR-2025-002',
    assetDisplayName: 'Laptop Asset 002',
    checkedOutToEmail: 'engineer2@example.com',
    checkedOutByEmail: 'technician@example.com',
    dueDateOffsetDays: -5,
    conditionOut: 'GOOD',
    purpose: 'Conference presentation equipment for trade show',
    departmentCode: 'ENG',
    status: 'CHECKED_OUT',
    isOverdue: true,
  },
  {
    checkoutNumber: 'LNR-2025-003',
    assetDisplayName: 'Laptop Asset 003',
    checkedOutToEmail: 'sales.rep@example.com',
    checkedOutByEmail: 'asset.manager@example.com',
    dueDateOffsetDays: 7,
    conditionOut: 'EXCELLENT',
    purpose: 'New hire onboarding - awaiting permanent equipment',
    departmentCode: 'FIN',
    status: 'CHECKED_OUT',
    isOverdue: false,
  },
  {
    checkoutNumber: 'LNR-2025-004',
    assetDisplayName: 'Laptop Asset 004',
    checkedOutToEmail: 'marketing@example.com',
    checkedOutByEmail: 'technician@example.com',
    dueDateOffsetDays: -12,
    conditionOut: 'GOOD',
    purpose: 'Remote work equipment for field operations',
    departmentCode: 'OPS',
    status: 'CHECKED_OUT',
    isOverdue: true,
  },
  {
    checkoutNumber: 'LNR-2025-005',
    assetDisplayName: 'Laptop Asset 005',
    checkedOutToEmail: 'viewer@example.com',
    checkedOutByEmail: 'asset.manager@example.com',
    dueDateOffsetDays: 30,
    conditionOut: 'EXCELLENT',
    purpose: 'Executive travel equipment for Q1 meetings',
    departmentCode: 'HR',
    status: 'CHECKED_OUT',
    isOverdue: false,
  },
];

// ============================================================================
// Disposal Workflows
// ============================================================================

export const DISPOSAL_WORKFLOWS: SeedDisposalWorkflow[] = [
  {
    workflowNumber: 'DSP-2025-001',
    assetDisplayName: 'Laptop Asset 010',
    status: 'COMPLETED',
    disposalMethod: 'RECYCLE',
    initiatedByEmail: 'asset.manager@example.com',
    dataWipeRequired: true,
    environmentalCheckRequired: true,
    notes: 'End-of-life laptop, recycled through certified e-waste vendor',
    tasks: [
      { taskType: 'DATA_WIPE', taskName: 'Perform NIST 800-88 data sanitization', description: 'Complete 3-pass overwrite of all storage media', status: 'COMPLETED', sequence: 1, isRequired: true },
      { taskType: 'ENVIRONMENTAL_CHECK', taskName: 'Environmental compliance verification', description: 'Verify disposal meets EPA R2 standards', status: 'COMPLETED', sequence: 2, isRequired: true },
      { taskType: 'ASSET_DECOMMISSION', taskName: 'Remove from asset register', description: 'Deactivate asset record and update inventory', status: 'COMPLETED', sequence: 3, isRequired: true },
      { taskType: 'PICKUP', taskName: 'Schedule vendor pickup', description: 'Coordinate with Iron Mountain for secure pickup', status: 'COMPLETED', sequence: 4, isRequired: true },
    ],
  },
  {
    workflowNumber: 'DSP-2025-002',
    assetDisplayName: 'Laptop Asset 011',
    status: 'IN_PROGRESS',
    disposalMethod: 'DONATE',
    initiatedByEmail: 'asset.manager@example.com',
    dataWipeRequired: true,
    environmentalCheckRequired: false,
    notes: 'Functional laptop being donated to local school district',
    tasks: [
      { taskType: 'DATA_WIPE', taskName: 'Perform NIST 800-88 data sanitization', description: 'Complete 3-pass overwrite of all storage media', status: 'COMPLETED', sequence: 1, isRequired: true },
      { taskType: 'ASSET_DECOMMISSION', taskName: 'Remove from asset register', description: 'Deactivate asset record and update inventory', status: 'IN_PROGRESS', sequence: 2, isRequired: true },
      { taskType: 'DOCUMENTATION', taskName: 'Prepare donation documentation', description: 'Generate tax receipt and transfer documents', status: 'PENDING', sequence: 3, isRequired: true },
    ],
  },
  {
    workflowNumber: 'DSP-2025-003',
    assetDisplayName: 'Laptop Asset 012',
    status: 'INITIATED',
    disposalMethod: 'DESTROY',
    initiatedByEmail: 'inventory.manager@example.com',
    dataWipeRequired: true,
    environmentalCheckRequired: true,
    notes: 'Classified equipment requiring physical destruction per security policy',
    tasks: [
      { taskType: 'DATA_WIPE', taskName: 'Perform NIST 800-88 Purge', description: 'Cryptographic erase followed by degaussing', status: 'PENDING', sequence: 1, isRequired: true },
      { taskType: 'SECURITY_REVIEW', taskName: 'Security classification review', description: 'Verify no classified data remnants before physical destruction', status: 'PENDING', sequence: 2, isRequired: true },
      { taskType: 'ENVIRONMENTAL_CHECK', taskName: 'Hazmat assessment', description: 'Check for hazardous materials requiring special handling', status: 'PENDING', sequence: 3, isRequired: true },
      { taskType: 'DESTRUCTION', taskName: 'Physical destruction', description: 'Shred hard drives and physically destroy components', status: 'PENDING', sequence: 4, isRequired: true },
      { taskType: 'CERTIFICATE', taskName: 'Generate destruction certificate', description: 'Create certified destruction record with serial numbers', status: 'PENDING', sequence: 5, isRequired: true },
    ],
  },
  {
    workflowNumber: 'DSP-2025-004',
    assetDisplayName: 'Laptop Asset 013',
    status: 'PENDING_APPROVAL',
    disposalMethod: 'SELL',
    initiatedByEmail: 'asset.manager@example.com',
    dataWipeRequired: true,
    environmentalCheckRequired: false,
    notes: 'Bulk sale of 2-year-old laptops to refurbishment company',
    tasks: [
      { taskType: 'APPROVAL', taskName: 'Management approval for sale', description: 'Obtain CFO approval for asset disposal via sale', status: 'PENDING', sequence: 1, isRequired: true },
      { taskType: 'DATA_WIPE', taskName: 'Perform data sanitization', description: 'NIST 800-88 clear on all devices', status: 'PENDING', sequence: 2, isRequired: true },
      { taskType: 'VALUATION', taskName: 'Asset valuation', description: 'Determine fair market value for sale', status: 'PENDING', sequence: 3, isRequired: true },
    ],
  },
];
