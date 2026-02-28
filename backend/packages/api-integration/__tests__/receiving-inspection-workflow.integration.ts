/**
 * Integration tests for Receiving with Inspection Workflow
 * Validates the end-to-end inspection process for received items
 */
import { DbTestClient } from './setup/test-helpers';
import { setup, teardown } from './setup/integration-test-setup';
import { POService } from '@ams/procurement-service';
import { VendorService } from '@ams/admin-service';
import { ReceivingService } from '@ams/lifecycle-service';
import { AssetService } from '@ams/lifecycle-service';
import { 
  PurchaseOrder, 
  POLine, 
  POStatus, 
  ReceivingStatus, 
  InspectionStatus,
  InspectionResult,
  AssetType 
} from '@ams/types';

// Test setup and teardown
beforeAll(async () => await setup());
afterAll(async () => await teardown());

describe('Receiving with Inspection Workflow Integration', () => {
  // Test data
  const testVendorName = 'Inspection Test Vendor';
  let vendorId: string;
  let purchaseOrderId: string;
  let receivingId: string;
  let poLines: POLine[] = [];
  let receivingItemIds: string[] = [];
  let assetIds: string[] = [];
  
  it('should create a vendor, purchase order, and send it to vendor', async () => {
    // Get services
    const vendorService = new VendorService();
    const poService = new POService();
    
    // 1. Create a vendor
    const vendor = await vendorService.createVendor({
      name: testVendorName,
      vendorCode: 'INSP-VEN-001',
      contactName: 'Vendor Contact',
      email: 'vendor@inspection.com',
      phone: '555-555-5555',
      address1: '123 Vendor St',
      city: 'Test City',
      state: 'TS',
      postalCode: '12345',
      country: 'Test Country',
      status: 'ACTIVE',
      rating: 3,
      accountNumber: 'INSP-ACCT-001',
      paymentTerms: 'NET-30',
      notes: 'Vendor for inspection workflow testing',
    });
    
    vendorId = vendor.vendorId;
    
    // 2. Create a purchase order
    const poInput: Omit<PurchaseOrder, 'purchaseOrderId' | 'createdAt' | 'updatedAt' | 'total' | 'subtotal' | 'status'> = {
      poNumber: 'PO-INSP-001',
      vendorId,
      issueDate: new Date().toISOString(),
      expectedDeliveryDate: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(), // 7 days from now
      shippingAddress: '123 Receiving St, Test City, TS 12345',
      billingAddress: '123 Billing St, Test City, TS 12345',
      requestorName: 'Inspection Tester',
      departmentId: null,
      costCenterId: null,
      taxRate: 7.5,
      taxAmount: 0, // Will be calculated by service
      shippingAmount: 50.00,
      notes: 'PO for inspection workflow testing',
      lines: [],
    };
    
    // 3. Add PO lines for items that require inspection
    const poLineInputs: Omit<POLine, 'lineId' | 'createdAt' | 'updatedAt'>[] = [
      {
        purchaseOrderId: '', // Will be assigned after PO creation
        lineNumber: 1,
        description: 'Critical Network Switch',
        quantity: 2,
        unitPrice: 2000.00,
        unitOfMeasure: 'EA',
        deliveryDate: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(),
        modelId: null,
        productNumber: 'CNET-001',
        assetType: AssetType.HARDWARE,
        notes: 'Critical network equipment requiring inspection',
        receivedQuantity: 0,
        partNumber: 'PART-CNET-001',
      },
      {
        purchaseOrderId: '', // Will be assigned after PO creation
        lineNumber: 2,
        description: 'Security Appliance',
        quantity: 1,
        unitPrice: 3500.00,
        unitOfMeasure: 'EA',
        deliveryDate: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(),
        modelId: null,
        productNumber: 'SEC-001',
        assetType: AssetType.HARDWARE,
        notes: 'Security device requiring inspection',
        receivedQuantity: 0,
        partNumber: 'PART-SEC-001',
      }
    ];
    
    // 4. Create PO with lines
    const po = await poService.createPurchaseOrder(poInput, poLineInputs);
    purchaseOrderId = po.purchaseOrderId;
    poLines = po.lines;
    
    // 5. Submit, approve, and send PO to vendor
    await poService.submitPurchaseOrder(purchaseOrderId);
    await poService.approvePurchaseOrder(purchaseOrderId, 'test-approver', 'Approved for testing');
    await poService.sendPurchaseOrder(purchaseOrderId);
    
    // Verify PO was created and sent successfully
    const sentPo = await poService.getPurchaseOrder(purchaseOrderId);
    expect(sentPo.status).toBe(POStatus.SENT);
    expect(sentPo.lines.length).toBe(2);
  });
  
  it('should create a receiving record and flag items for inspection', async () => {
    // Get receiving service
    const receivingService = new ReceivingService();
    
    // 1. Create a receiving record
    const receivingInput = {
      purchaseOrderId,
      receivedDate: new Date().toISOString(),
      receivedBy: 'Inspection Tester',
      notes: 'Receiving record for inspection testing',
      packageCount: 3,
      trackingNumber: 'INSP-TRK-001',
      carrierName: 'Test Carrier',
    };
    
    const receiving = await receivingService.createReceiving(receivingInput);
    receivingId = receiving.receivingId;
    
    // 2. Process receiving for each line, marking for inspection
    for (const poLine of poLines) {
      // Receive all items for the line
      const receivingItems = await receivingService.receiveItems(
        receivingId,
        poLine.lineId,
        poLine.quantity,
        'Items received, flagged for inspection'
      );
      
      // Store the receiving item IDs
      receivingItemIds = receivingItemIds.concat(receivingItems.map(item => item.receivingItemId));
      
      // Store the asset IDs
      assetIds = assetIds.concat(receivingItems.map(item => item.assetId));
      
      // Mark all received items for inspection
      for (const item of receivingItems) {
        await receivingService.markForInspection(
          item.receivingItemId,
          'Requires quality inspection before deployment'
        );
      }
    }
    
    // Verify receiving items were created and marked for inspection
    for (const itemId of receivingItemIds) {
      const item = await receivingService.getReceivingItem(itemId);
      expect(item.inspectionStatus).toBe(InspectionStatus.PENDING);
    }
    
    // Verify receiving is still in OPEN status (not completed until inspection is done)
    const updatedReceiving = await receivingService.getReceiving(receivingId);
    expect(updatedReceiving.status).toBe(ReceivingStatus.OPEN);
  });
  
  it('should perform inspections on the received items with mixed results', async () => {
    // Get services
    const receivingService = new ReceivingService();
    const assetService = new AssetService();
    
    // 1. Pass inspection for the first item
    const item1 = await receivingService.getReceivingItem(receivingItemIds[0]);
    await receivingService.recordInspectionResult(
      item1.receivingItemId,
      {
        result: InspectionResult.PASS,
        inspectedBy: 'Quality Inspector',
        inspectionDate: new Date().toISOString(),
        notes: 'Item passed all inspection criteria',
        checklistCompleted: true,
        defects: [],
      }
    );
    
    // 2. Fail inspection for the second item (first network switch)
    const item2 = await receivingService.getReceivingItem(receivingItemIds[1]);
    await receivingService.recordInspectionResult(
      item2.receivingItemId,
      {
        result: InspectionResult.FAIL,
        inspectedBy: 'Quality Inspector',
        inspectionDate: new Date().toISOString(),
        notes: 'Item failed inspection: port 3 is non-functional',
        checklistCompleted: true,
        defects: ['Port 3 non-functional', 'Visible scratches on case'],
      }
    );
    
    // 3. Pass inspection for the third item (security appliance)
    const item3 = await receivingService.getReceivingItem(receivingItemIds[2]);
    await receivingService.recordInspectionResult(
      item3.receivingItemId,
      {
        result: InspectionResult.PASS,
        inspectedBy: 'Security Specialist',
        inspectionDate: new Date().toISOString(),
        notes: 'Security device passed all tests, firmware updated to latest version',
        checklistCompleted: true,
        defects: [],
      }
    );
    
    // 4. Verify inspection status is updated for each item
    const updatedItem1 = await receivingService.getReceivingItem(receivingItemIds[0]);
    expect(updatedItem1.inspectionStatus).toBe(InspectionStatus.PASS);
    
    const updatedItem2 = await receivingService.getReceivingItem(receivingItemIds[1]);
    expect(updatedItem2.inspectionStatus).toBe(InspectionStatus.FAIL);
    
    const updatedItem3 = await receivingService.getReceivingItem(receivingItemIds[2]);
    expect(updatedItem3.inspectionStatus).toBe(InspectionStatus.PASS);
  });
  
  it('should update the failed item and re-inspect', async () => {
    // Get receiving service
    const receivingService = new ReceivingService();
    
    // 1. Get the failed item (second network switch)
    const failedItemId = receivingItemIds[1];
    const failedItem = await receivingService.getReceivingItem(failedItemId);
    
    // 2. Record rework action on the failed item
    await receivingService.recordRework(
      failedItemId,
      {
        reworkAction: 'Replaced faulty network port module',
        reworkedBy: 'Technician',
        reworkDate: new Date().toISOString(),
        notes: 'Replaced module, all ports now functioning',
      }
    );
    
    // 3. Re-inspect the item after rework
    await receivingService.recordInspectionResult(
      failedItemId,
      {
        result: InspectionResult.PASS,
        inspectedBy: 'Quality Inspector',
        inspectionDate: new Date().toISOString(),
        notes: 'Item passed re-inspection after rework',
        checklistCompleted: true,
        defects: [],
      }
    );
    
    // 4. Verify the item now passes inspection
    const updatedItem = await receivingService.getReceivingItem(failedItemId);
    expect(updatedItem.inspectionStatus).toBe(InspectionStatus.PASS);
    
    // 5. Verify the item has rework history
    const reworkHistory = await receivingService.getReworkHistory(failedItemId);
    expect(reworkHistory).toBeDefined();
    expect(reworkHistory.length).toBe(1);
    expect(reworkHistory[0].reworkAction).toBe('Replaced faulty network port module');
  });
  
  it('should complete the receiving process after all inspections pass', async () => {
    // Get receiving service
    const receivingService = new ReceivingService();
    
    // 1. Verify all items now pass inspection
    for (const itemId of receivingItemIds) {
      const item = await receivingService.getReceivingItem(itemId);
      expect(item.inspectionStatus).toBe(InspectionStatus.PASS);
    }
    
    // 2. Complete the receiving process
    await receivingService.completeReceiving(receivingId);
    
    // 3. Verify receiving status is updated
    const updatedReceiving = await receivingService.getReceiving(receivingId);
    expect(updatedReceiving.status).toBe(ReceivingStatus.COMPLETED);
    
    // 4. Verify assets have inspection history
    const assetService = new AssetService();
    for (const assetId of assetIds) {
      const inspectionHistory = await assetService.getInspectionHistory(assetId);
      expect(inspectionHistory).toBeDefined();
      expect(inspectionHistory.length).toBeGreaterThan(0);
    }
  });
  
  it('should verify assets are available for deployment after inspection', async () => {
    // Get asset service
    const assetService = new AssetService();
    
    // Verify all assets are in correct status
    for (const assetId of assetIds) {
      const asset = await assetService.getAsset(assetId);
      expect(asset.status).toBe('IN_STOCK');
      expect(asset.lifecycleState).toBe('RECEIVED');
    }
    
    // Verify assets that failed inspection and were reworked have a note about it
    const failedAssetId = assetIds[1]; // The asset from the failed network switch
    const assetNotes = await assetService.getAssetNotes(failedAssetId);
    
    // Verify notes contain information about the failed inspection and rework
    const reworkNote = assetNotes.find(note => note.content.includes('rework'));
    expect(reworkNote).toBeDefined();
  });
  
  // Clean up test data after tests
  afterAll(async () => {
    // Permanently delete test data
    const dbClient = DbTestClient.getInstance();
    
    // Delete assets
    for (const assetId of assetIds) {
      await dbClient.query('DELETE FROM hardware_assets WHERE asset_id = $1', [assetId]);
      await dbClient.query('DELETE FROM asset_inspection_history WHERE asset_id = $1', [assetId]);
      await dbClient.query('DELETE FROM asset_notes WHERE asset_id = $1', [assetId]);
      await dbClient.query('DELETE FROM assets WHERE asset_id = $1', [assetId]);
    }
    
    // Delete receiving records
    for (const itemId of receivingItemIds) {
      await dbClient.query('DELETE FROM receiving_item_rework WHERE receiving_item_id = $1', [itemId]);
      await dbClient.query('DELETE FROM receiving_item_inspection WHERE receiving_item_id = $1', [itemId]);
    }
    await dbClient.query('DELETE FROM receiving_items WHERE receiving_id = $1', [receivingId]);
    await dbClient.query('DELETE FROM receiving WHERE receiving_id = $1', [receivingId]);
    
    // Delete purchase order
    await dbClient.query('DELETE FROM purchase_order_lines WHERE purchase_order_id = $1', [purchaseOrderId]);
    await dbClient.query('DELETE FROM purchase_orders WHERE purchase_order_id = $1', [purchaseOrderId]);
    
    // Delete vendor
    await dbClient.query('DELETE FROM vendors WHERE vendor_id = $1', [vendorId]);
  });
});