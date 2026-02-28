/**
 * Integration tests for Purchase Order Approval Workflow
 * Validates the end-to-end approval process: submit → approve → send
 */
import { DbTestClient } from './setup/test-helpers';
import { setup, teardown } from './setup/integration-test-setup';
import { POService, ApprovalService } from '@ams/procurement-service';
import { VendorService } from '@ams/admin-service';
import { UserAdminService } from '@ams/admin-service';
import { 
  PurchaseOrder, 
  POLine, 
  POStatus,
  ApprovalStatus,
  AssetType,
  UserRole 
} from '@ams/types';

// Test setup and teardown
beforeAll(async () => await setup());
afterAll(async () => await teardown());

describe('Purchase Order Approval Workflow Integration', () => {
  // Test data
  const testVendorName = 'Approval Test Vendor';
  let vendorId: string;
  let approver1Id: string;
  let approver2Id: string;
  let purchaseOrderId: string;
  let approvalIds: string[] = [];
  
  it('should create test users with approver roles', async () => {
    // Get user admin service
    const userAdminService = new UserAdminService();
    
    // Create first approver (manager level)
    const approver1 = await userAdminService.createUser({
      username: 'approver1@test.com',
      email: 'approver1@test.com',
      firstName: 'Manager',
      lastName: 'Approver',
      departmentId: null,
      status: 'ACTIVE',
      roles: [UserRole.USER, UserRole.MANAGER],
    });
    
    approver1Id = approver1.userId;
    
    // Create second approver (director level)
    const approver2 = await userAdminService.createUser({
      username: 'approver2@test.com',
      email: 'approver2@test.com',
      firstName: 'Director',
      lastName: 'Approver',
      departmentId: null,
      status: 'ACTIVE',
      roles: [UserRole.USER, UserRole.MANAGER, UserRole.DIRECTOR],
    });
    
    approver2Id = approver2.userId;
    
    // Verify users were created with correct roles
    expect(approver1.roles).toContain(UserRole.MANAGER);
    expect(approver2.roles).toContain(UserRole.DIRECTOR);
  });
  
  it('should create a vendor for testing', async () => {
    // Get vendor service
    const vendorService = new VendorService();
    
    // Create a vendor
    const vendor = await vendorService.createVendor({
      name: testVendorName,
      vendorCode: 'APPROVAL-VEN-001',
      contactName: 'Vendor Contact',
      email: 'vendor@example.com',
      phone: '555-123-4567',
      address1: '123 Vendor St',
      city: 'Test City',
      state: 'TS',
      postalCode: '12345',
      country: 'Test Country',
      status: 'ACTIVE',
      rating: 4,
      accountNumber: 'ACCT-001',
      paymentTerms: 'NET-30',
      notes: 'Vendor for approval workflow testing',
    });
    
    vendorId = vendor.vendorId;
    
    // Verify vendor was created
    expect(vendor).toBeDefined();
    expect(vendor.vendorId).toBeDefined();
    expect(vendor.name).toBe(testVendorName);
  });
  
  it('should create a purchase order that requires multi-level approval', async () => {
    // Get PO service
    const poService = new POService();
    
    // 1. Create a purchase order with a high total to trigger multi-level approval
    const poInput: Omit<PurchaseOrder, 'purchaseOrderId' | 'createdAt' | 'updatedAt' | 'total' | 'subtotal' | 'status'> = {
      poNumber: 'PO-APPROVAL-001',
      vendorId,
      issueDate: new Date().toISOString(),
      expectedDeliveryDate: new Date(Date.now() + 14 * 24 * 60 * 60 * 1000).toISOString(), // 14 days from now
      shippingAddress: '123 Shipping St, Test City, TS 12345',
      billingAddress: '123 Billing St, Test City, TS 12345',
      requestorName: 'Approval Tester',
      departmentId: null,
      costCenterId: null,
      taxRate: 8.25,
      taxAmount: 0, // Will be calculated by service
      shippingAmount: 100.00,
      notes: 'High-value PO for testing approval workflow',
      lines: [],
    };
    
    // 2. Add expensive line items to trigger multi-level approval
    const poLines: Omit<POLine, 'lineId' | 'createdAt' | 'updatedAt'>[] = [
      {
        purchaseOrderId: '', // Will be assigned after PO creation
        lineNumber: 1,
        description: 'Enterprise Server',
        quantity: 3,
        unitPrice: 8000.00, // High-value item
        unitOfMeasure: 'EA',
        deliveryDate: new Date(Date.now() + 14 * 24 * 60 * 60 * 1000).toISOString(),
        modelId: null,
        productNumber: 'SERVER-001',
        assetType: AssetType.HARDWARE,
        notes: 'High-end server for testing approval thresholds',
        receivedQuantity: 0,
        partNumber: 'HW-SERVER-001',
      },
      {
        purchaseOrderId: '', // Will be assigned after PO creation
        lineNumber: 2,
        description: 'Enterprise Storage Array',
        quantity: 1,
        unitPrice: 15000.00, // Very high-value item
        unitOfMeasure: 'EA',
        deliveryDate: new Date(Date.now() + 14 * 24 * 60 * 60 * 1000).toISOString(),
        modelId: null,
        productNumber: 'STORAGE-001',
        assetType: AssetType.HARDWARE,
        notes: 'Storage array for testing approval thresholds',
        receivedQuantity: 0,
        partNumber: 'HW-STORAGE-001',
      }
    ];
    
    // 3. Create PO with lines
    const po = await poService.createPurchaseOrder(poInput, poLines);
    purchaseOrderId = po.purchaseOrderId;
    
    // Verify PO was created with correct status
    expect(po).toBeDefined();
    expect(po.purchaseOrderId).toBeDefined();
    expect(po.poNumber).toBe('PO-APPROVAL-001');
    expect(po.vendorId).toBe(vendorId);
    expect(po.status).toBe(POStatus.DRAFT);
    
    // Verify PO has high total value that should trigger multi-level approval
    // 3 servers @ $8,000 = $24,000
    // 1 storage array @ $15,000 = $15,000
    // Subtotal = $39,000
    // Tax @ 8.25% = $3,217.50
    // Shipping = $100
    // Total = $42,317.50
    expect(po.subtotal).toBeGreaterThan(35000); // High value
    expect(po.total).toBeGreaterThan(40000); // High value with tax and shipping
  });
  
  it('should submit the PO for approval and verify approval routing', async () => {
    // Get services
    const poService = new POService();
    const approvalService = new ApprovalService();
    
    // 1. Submit PO for approval
    await poService.submitPurchaseOrder(purchaseOrderId);
    
    // Verify PO status is updated
    const po = await poService.getPurchaseOrder(purchaseOrderId);
    expect(po.status).toBe(POStatus.PENDING_APPROVAL);
    
    // 2. Get approval requests
    const approvals = await approvalService.getApprovalsByPurchaseOrder(purchaseOrderId);
    
    // Save approval IDs for later use
    approvalIds = approvals.map(a => a.approvalId);
    
    // Verify approvals were created
    expect(approvals).toBeDefined();
    expect(approvals.length).toBeGreaterThanOrEqual(2); // Should have at least 2 levels of approval
    
    // Verify first approval is in PENDING status
    const firstApproval = approvals.find(a => a.approvalLevel === 1);
    expect(firstApproval).toBeDefined();
    expect(firstApproval.status).toBe(ApprovalStatus.PENDING);
    
    // Verify second approval is in WAITING status (waiting for level 1 to approve first)
    const secondApproval = approvals.find(a => a.approvalLevel === 2);
    expect(secondApproval).toBeDefined();
    expect(secondApproval.status).toBe(ApprovalStatus.WAITING);
  });
  
  it('should process the first level approval', async () => {
    // Get services
    const approvalService = new ApprovalService();
    const poService = new POService();
    
    // Get approvals
    const approvals = await approvalService.getApprovalsByPurchaseOrder(purchaseOrderId);
    const firstApproval = approvals.find(a => a.approvalLevel === 1);
    
    // 1. Approve the first level
    await approvalService.approveLevel(
      purchaseOrderId,
      firstApproval.approvalId,
      approver1Id,
      'Approved by manager level'
    );
    
    // 2. Verify first approval is now APPROVED
    const updatedFirstApproval = await approvalService.getApproval(firstApproval.approvalId);
    expect(updatedFirstApproval.status).toBe(ApprovalStatus.APPROVED);
    expect(updatedFirstApproval.approvedBy).toBe(approver1Id);
    expect(updatedFirstApproval.comments).toBe('Approved by manager level');
    
    // 3. Verify second approval is now PENDING
    const updatedApprovals = await approvalService.getApprovalsByPurchaseOrder(purchaseOrderId);
    const secondApproval = updatedApprovals.find(a => a.approvalLevel === 2);
    expect(secondApproval.status).toBe(ApprovalStatus.PENDING);
    
    // 4. Verify PO is still in PENDING_APPROVAL status
    const po = await poService.getPurchaseOrder(purchaseOrderId);
    expect(po.status).toBe(POStatus.PENDING_APPROVAL);
  });
  
  it('should process the second level approval', async () => {
    // Get services
    const approvalService = new ApprovalService();
    const poService = new POService();
    
    // Get approvals
    const approvals = await approvalService.getApprovalsByPurchaseOrder(purchaseOrderId);
    const secondApproval = approvals.find(a => a.approvalLevel === 2);
    
    // 1. Approve the second level
    await approvalService.approveLevel(
      purchaseOrderId,
      secondApproval.approvalId,
      approver2Id,
      'Approved by director level'
    );
    
    // 2. Verify second approval is now APPROVED
    const updatedSecondApproval = await approvalService.getApproval(secondApproval.approvalId);
    expect(updatedSecondApproval.status).toBe(ApprovalStatus.APPROVED);
    expect(updatedSecondApproval.approvedBy).toBe(approver2Id);
    expect(updatedSecondApproval.comments).toBe('Approved by director level');
    
    // 3. Verify PO is now APPROVED status
    const po = await poService.getPurchaseOrder(purchaseOrderId);
    expect(po.status).toBe(POStatus.APPROVED);
  });
  
  it('should send the approved PO to vendor', async () => {
    // Get services
    const poService = new POService();
    
    // Send PO to vendor
    await poService.sendPurchaseOrder(purchaseOrderId);
    
    // Verify PO is now in SENT status
    const po = await poService.getPurchaseOrder(purchaseOrderId);
    expect(po.status).toBe(POStatus.SENT);
  });
  
  it('should verify approval history is tracked correctly', async () => {
    // Get services
    const approvalService = new ApprovalService();
    
    // Get approval history
    const approvalHistory = await approvalService.getApprovalHistory(purchaseOrderId);
    
    // Verify history has correct entries
    expect(approvalHistory).toBeDefined();
    expect(approvalHistory.length).toBeGreaterThanOrEqual(4); // submit + level 1 approval + level 2 approval + sent
    
    // Verify history contains expected status transitions
    const statusSequence = approvalHistory.map(h => h.status);
    expect(statusSequence).toContain(POStatus.DRAFT);
    expect(statusSequence).toContain(POStatus.PENDING_APPROVAL);
    expect(statusSequence).toContain(POStatus.APPROVED);
    expect(statusSequence).toContain(POStatus.SENT);
    
    // Verify timestamps are in chronological order
    for (let i = 1; i < approvalHistory.length; i++) {
      const prevTimestamp = new Date(approvalHistory[i-1].timestamp).getTime();
      const currTimestamp = new Date(approvalHistory[i].timestamp).getTime();
      expect(currTimestamp).toBeGreaterThanOrEqual(prevTimestamp);
    }
  });
  
  // Clean up test data after tests
  afterAll(async () => {
    // Permanently delete test data
    const dbClient = DbTestClient.getInstance();
    
    // Delete PO approvals and history
    for (const approvalId of approvalIds) {
      await dbClient.query('DELETE FROM purchase_order_approvals WHERE approval_id = $1', [approvalId]);
    }
    await dbClient.query('DELETE FROM purchase_order_history WHERE purchase_order_id = $1', [purchaseOrderId]);
    
    // Delete purchase order
    await dbClient.query('DELETE FROM purchase_order_lines WHERE purchase_order_id = $1', [purchaseOrderId]);
    await dbClient.query('DELETE FROM purchase_orders WHERE purchase_order_id = $1', [purchaseOrderId]);
    
    // Delete vendor
    await dbClient.query('DELETE FROM vendors WHERE vendor_id = $1', [vendorId]);
    
    // Delete test users
    await dbClient.query('DELETE FROM users WHERE user_id = $1', [approver1Id]);
    await dbClient.query('DELETE FROM users WHERE user_id = $1', [approver2Id]);
  });
});