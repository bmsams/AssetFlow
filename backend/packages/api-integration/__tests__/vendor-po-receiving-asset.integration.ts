/**
 * Integration tests for Vendor → PO → Receiving → Asset workflow
 * Validates the end-to-end process from vendor selection to asset creation
 */
import { DbTestClient } from './setup/test-helpers';
import { setup, teardown } from './setup/integration-test-setup';
import { VendorService } from '@ams/admin-service';
import { POService } from '@ams/procurement-service';
import { ApprovalService } from '@ams/procurement-service';
import { ReceivingService } from '@ams/lifecycle-service';
import { AssetService } from '@ams/lifecycle-service';
import { 
  Vendor, 
  PurchaseOrder, 
  POLine, 
  POStatus, 
  ReceivingStatus, 
  AssetType,
  HardwareAsset 
} from '@ams/types';

// Test setup and teardown
beforeAll(async () => await setup());
afterAll(async () => await teardown());

describe('Vendor → PO → Receiving → Asset Workflow Integration', () => {
  // Test data
  const testVendorName = 'Integration Test Vendor';
  let vendorId: string;
  let purchaseOrderId: string;
  let receivingId: string;
  let assetIds: string[] = [];
  
  // Test the complete workflow
  it('should create a vendor and verify its properties', async () => {
    // Get vendor service
    const vendorService = new VendorService();
    
    // Create a vendor
    const vendorInput = {
      name: testVendorName,
      vendorCode: 'INT-VEN-001',
      contactName: 'John Smith',
      email: 'john.smith@testvendor.com',
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
      notes: 'Vendor for integration testing',
    };
    
    const vendor = await vendorService.createVendor(vendorInput);
    vendorId = vendor.vendorId;
    
    // Verify vendor was created with correct properties
    expect(vendor).toBeDefined();
    expect(vendor.vendorId).toBeDefined();
    expect(vendor.name).toBe(testVendorName);
    expect(vendor.vendorCode).toBe('INT-VEN-001');
    expect(vendor.rating).toBe(4);
  });
  
  it('should create a purchase order for the vendor', async () => {
    // Get PO service
    const poService = new POService();
    
    // 1. Create a purchase order
    const poInput: Omit<PurchaseOrder, 'purchaseOrderId' | 'createdAt' | 'updatedAt' | 'total' | 'subtotal' | 'status'> = {
      poNumber: 'PO-INT-001',
      vendorId,
      issueDate: new Date().toISOString(),
      expectedDeliveryDate: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(), // 7 days from now
      shippingAddress: '123 Receiving St, Test City, TS 12345',
      billingAddress: '123 Billing St, Test City, TS 12345',
      requestorName: 'Integration Tester',
      departmentId: null, // Not required for this test
      costCenterId: null, // Not required for this test
      taxRate: 7.5,
      taxAmount: 0, // Will be calculated by service
      shippingAmount: 25.00,
      notes: 'Integration test purchase order',
      lines: [],
    };
    
    // 2. Add PO lines
    const poLines: Omit<POLine, 'lineId' | 'createdAt' | 'updatedAt'>[] = [
      {
        purchaseOrderId: '', // Will be assigned after PO creation
        lineNumber: 1,
        description: 'Test Server',
        quantity: 2,
        unitPrice: 1500.00,
        unitOfMeasure: 'EA',
        deliveryDate: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(),
        modelId: null,
        productNumber: 'SVR-001',
        assetType: AssetType.HARDWARE,
        notes: 'Integration test server',
        receivedQuantity: 0,
        partNumber: 'PART-001',
      },
      {
        purchaseOrderId: '', // Will be assigned after PO creation
        lineNumber: 2,
        description: 'Test Network Switch',
        quantity: 1,
        unitPrice: 750.00,
        unitOfMeasure: 'EA',
        deliveryDate: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(),
        modelId: null,
        productNumber: 'NSW-001',
        assetType: AssetType.HARDWARE,
        notes: 'Integration test network switch',
        receivedQuantity: 0,
        partNumber: 'PART-002',
      }
    ];
    
    // 3. Create PO with lines
    const po = await poService.createPurchaseOrder(poInput, poLines);
    purchaseOrderId = po.purchaseOrderId;
    
    // Verify PO was created with correct properties
    expect(po).toBeDefined();
    expect(po.purchaseOrderId).toBeDefined();
    expect(po.poNumber).toBe('PO-INT-001');
    expect(po.vendorId).toBe(vendorId);
    expect(po.status).toBe(POStatus.DRAFT);
    
    // Verify PO has correct line items
    expect(po.lines).toBeDefined();
    expect(po.lines.length).toBe(2);
    expect(po.lines[0].description).toBe('Test Server');
    expect(po.lines[0].quantity).toBe(2);
    expect(po.lines[1].description).toBe('Test Network Switch');
    expect(po.lines[1].quantity).toBe(1);
    
    // Verify PO totals were calculated correctly
    const expectedSubtotal = (2 * 1500.00) + (1 * 750.00); // 3750.00
    const expectedTaxAmount = expectedSubtotal * 0.075; // 281.25
    const expectedTotal = expectedSubtotal + expectedTaxAmount + 25.00; // 4056.25
    
    expect(po.subtotal).toBeCloseTo(expectedSubtotal, 2);
    expect(po.taxAmount).toBeCloseTo(expectedTaxAmount, 2);
    expect(po.total).toBeCloseTo(expectedTotal, 2);
  });
  
  it('should submit and approve the purchase order', async () => {
    // Get services
    const poService = new POService();
    const approvalService = new ApprovalService();
    
    // 1. Submit PO for approval
    await poService.submitPurchaseOrder(purchaseOrderId);
    
    // Verify PO status is updated
    let po = await poService.getPurchaseOrder(purchaseOrderId);
    expect(po.status).toBe(POStatus.PENDING_APPROVAL);
    
    // 2. Approve the PO
    await approvalService.approvePurchaseOrder(purchaseOrderId, 'test-approver', 'Integration test approval');
    
    // Verify PO status is updated
    po = await poService.getPurchaseOrder(purchaseOrderId);
    expect(po.status).toBe(POStatus.APPROVED);
    
    // 3. Send PO to vendor
    await poService.sendPurchaseOrder(purchaseOrderId);
    
    // Verify PO status is updated
    po = await poService.getPurchaseOrder(purchaseOrderId);
    expect(po.status).toBe(POStatus.SENT);
  });
  
  it('should create a receiving record for the purchase order', async () => {
    // Get services
    const receivingService = new ReceivingService();
    
    // Create a receiving record for the PO
    const receivingInput = {
      purchaseOrderId,
      receivedDate: new Date().toISOString(),
      receivedBy: 'Integration Tester',
      notes: 'Integration test receiving',
      packageCount: 2,
      trackingNumber: 'TRK-INT-001',
      carrierName: 'Test Carrier',
    };
    
    const receiving = await receivingService.createReceiving(receivingInput);
    receivingId = receiving.receivingId;
    
    // Verify receiving record was created
    expect(receiving).toBeDefined();
    expect(receiving.receivingId).toBeDefined();
    expect(receiving.purchaseOrderId).toBe(purchaseOrderId);
    expect(receiving.status).toBe(ReceivingStatus.OPEN);
  });
  
  it('should receive items for the purchase order and create assets', async () => {
    // Get services
    const receivingService = new ReceivingService();
    const poService = new POService();
    
    // Get PO details to access line IDs
    const po = await poService.getPurchaseOrder(purchaseOrderId);
    const lineIds = po.lines.map(line => line.lineId);
    
    // Process receiving for each line
    for (let i = 0; i < lineIds.length; i++) {
      const lineId = lineIds[i];
      const poLine = po.lines[i];
      const quantity = poLine.quantity;
      
      // Create receiving items
      const receivingItems = await receivingService.receiveItems(
        receivingId,
        lineId,
        quantity,
        'Integration test receiving'
      );
      
      // Verify receiving items were created
      expect(receivingItems).toBeDefined();
      expect(receivingItems.length).toBe(quantity);
      
      // Store created asset IDs
      assetIds = assetIds.concat(receivingItems.map(item => item.assetId));
    }
    
    // Verify all assets were created
    expect(assetIds.length).toBe(3); // 2 servers + 1 switch
    
    // Complete the receiving process
    await receivingService.completeReceiving(receivingId);
    
    // Verify receiving status is updated
    const receiving = await receivingService.getReceiving(receivingId);
    expect(receiving.status).toBe(ReceivingStatus.COMPLETED);
  });
  
  it('should verify the created assets have correct properties', async () => {
    // Get service
    const assetService = new AssetService();
    
    // Check each asset
    for (const assetId of assetIds) {
      const asset = await assetService.getAsset(assetId) as HardwareAsset;
      
      // Verify asset was created
      expect(asset).toBeDefined();
      expect(asset.assetId).toBe(assetId);
      expect(asset.assetType).toBe(AssetType.HARDWARE);
      
      // Verify asset has purchase information
      expect(asset.purchaseOrderId).toBe(purchaseOrderId);
      expect(asset.vendorId).toBe(vendorId);
      
      // Verify asset state is correct for a newly received asset
      expect(asset.status).toBe('IN_STOCK');
      expect(asset.lifecycleState).toBe('RECEIVED');
    }
    
    // Verify asset count by type
    const assetsByType = await assetService.countAssetsByType();
    expect(assetsByType.find(item => item.assetType === AssetType.HARDWARE).count).toBeGreaterThanOrEqual(3);
  });
  
  // Clean up test data after tests
  afterAll(async () => {
    // Permanently delete test data
    const dbClient = DbTestClient.getInstance();
    
    // Delete in reverse order of dependencies
    // Delete assets
    for (const assetId of assetIds) {
      await dbClient.query('DELETE FROM hardware_assets WHERE asset_id = $1', [assetId]);
      await dbClient.query('DELETE FROM assets WHERE asset_id = $1', [assetId]);
    }
    
    // Delete receiving records
    await dbClient.query('DELETE FROM receiving_items WHERE receiving_id = $1', [receivingId]);
    await dbClient.query('DELETE FROM receiving WHERE receiving_id = $1', [receivingId]);
    
    // Delete purchase order
    await dbClient.query('DELETE FROM purchase_order_lines WHERE purchase_order_id = $1', [purchaseOrderId]);
    await dbClient.query('DELETE FROM purchase_order_approvals WHERE purchase_order_id = $1', [purchaseOrderId]);
    await dbClient.query('DELETE FROM purchase_orders WHERE purchase_order_id = $1', [purchaseOrderId]);
    
    // Delete vendor
    await dbClient.query('DELETE FROM vendors WHERE vendor_id = $1', [vendorId]);
  });
});