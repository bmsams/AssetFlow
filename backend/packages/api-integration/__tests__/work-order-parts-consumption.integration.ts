/**
 * Integration tests for Work Order with Parts Consumption
 * Validates the end-to-end workflow of creating a work order, consuming parts, and tracking inventory
 */
import { DbTestClient } from './setup/test-helpers';
import { setup, teardown } from './setup/integration-test-setup';
import { WorkOrderService } from '@ams/eam-service';
import { InventoryService, StockroomService } from '@ams/ham-service';
import { AssetService } from '@ams/lifecycle-service';
import { 
  WorkOrder, 
  WorkOrderStatus, 
  WorkOrderPriority, 
  WorkOrderPart,
  InventoryTransaction,
  TransactionType,
  Stockroom,
  StockroomType,
  BinLocation,
  HardwareAssetDetails,
  AssetType 
} from '@ams/types';

// Test setup and teardown
beforeAll(async () => await setup());
afterAll(async () => await teardown());

describe('Work Order with Parts Consumption Integration', () => {
  // Test data
  const testWorkOrderNumber = 'WO-PARTS-001';
  const testStockroomCode = 'SR-PARTS-001';
  let workOrderId: string;
  let stockroomId: string;
  let assetId: string;
  let binLocationIds: string[] = [];
  let partInventoryIds: string[] = [];
  let workOrderPartIds: string[] = [];
  let transactionIds: string[] = [];
  
  it('should create a stockroom with parts inventory', async () => {
    // Get stockroom service
    const stockroomService = new StockroomService();
    
    // 1. Create a stockroom
    const stockroomInput = {
      code: testStockroomCode,
      name: 'Parts Test Stockroom',
      type: StockroomType.MAINTENANCE,
      description: 'Stockroom for work order parts testing',
      location: 'Building 1, Floor 1',
      status: 'ACTIVE',
    };
    
    const stockroom = await stockroomService.createStockroom(stockroomInput);
    stockroomId = stockroom.stockroomId;
    
    // Verify stockroom was created
    expect(stockroom).toBeDefined();
    expect(stockroom.stockroomId).toBeDefined();
    expect(stockroom.code).toBe(testStockroomCode);
    expect(stockroom.type).toBe(StockroomType.MAINTENANCE);
    
    // 2. Create bin locations
    const binLocationService = stockroomService.getBinLocationService();
    
    const binTypes = ['SHELF', 'DRAWER'];
    const bins = [
      { code: 'BIN-A1', type: 'SHELF', capacity: 50 },
      { code: 'BIN-B2', type: 'DRAWER', capacity: 30 }
    ];
    
    for (const bin of bins) {
      const binLocationInput = {
        stockroomId,
        code: bin.code,
        name: `${bin.type} ${bin.code}`,
        type: bin.type,
        capacity: bin.capacity,
        available: bin.capacity,
        status: 'ACTIVE',
      };
      
      const binLocation = await binLocationService.createBinLocation(binLocationInput);
      binLocationIds.push(binLocation.binId);
      
      // Verify bin location was created
      expect(binLocation).toBeDefined();
      expect(binLocation.binId).toBeDefined();
      expect(binLocation.stockroomId).toBe(stockroomId);
    }
    
    // 3. Create inventory items in the stockroom
    const inventoryService = new InventoryService();
    
    const parts = [
      { 
        partNumber: 'PART-001', 
        name: 'Network Card', 
        description: 'Gigabit Ethernet Network Card',
        unitCost: 75.00,
        quantity: 10,
        binLocationId: binLocationIds[0]
      },
      { 
        partNumber: 'PART-002', 
        name: 'Power Supply', 
        description: '550W Power Supply',
        unitCost: 120.00,
        quantity: 5,
        binLocationId: binLocationIds[1]
      }
    ];
    
    for (const part of parts) {
      const inventoryItem = await inventoryService.createInventoryItem({
        stockroomId,
        binLocationId: part.binLocationId,
        partNumber: part.partNumber,
        name: part.name,
        description: part.description,
        category: 'REPLACEMENT_PART',
        status: 'ACTIVE',
        unitCost: part.unitCost,
        quantity: part.quantity,
        minimumQuantity: 2,
        reorderQuantity: 5
      });
      
      partInventoryIds.push(inventoryItem.inventoryId);
      
      // Verify inventory item was created with correct quantity
      expect(inventoryItem).toBeDefined();
      expect(inventoryItem.inventoryId).toBeDefined();
      expect(inventoryItem.partNumber).toBe(part.partNumber);
      expect(inventoryItem.quantity).toBe(part.quantity);
    }
  });
  
  it('should create an asset for maintenance', async () => {
    // Get asset service
    const assetService = new AssetService();
    
    // Create a server asset that needs maintenance
    const assetDetails: HardwareAssetDetails = {
      name: 'Maintenance Test Server',
      description: 'Server for testing work order maintenance',
      serialNumber: 'SRV-TEST-001',
      status: 'IN_USE',
      lifecycleState: 'DEPLOYED',
      assetTagNumber: 'WO-ASSET-001',
      location: 'Building 1, Floor 1, Room 101',
      assignedTo: 'Department 1',
      purchaseDate: new Date(Date.now() - 365 * 24 * 60 * 60 * 1000).toISOString(), // 1 year ago
      purchasePrice: 5000.00,
      warrantyExpirationDate: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000).toISOString(), // 1 year from now
      notes: 'Asset for work order testing',
      modelId: null,
      manufacturerId: null,
      ipAddress: '192.168.1.100',
      macAddress: '00:11:22:33:44:55',
    };
    
    const asset = await assetService.createHardwareAsset(assetDetails);
    assetId = asset.assetId;
    
    // Verify asset was created
    expect(asset).toBeDefined();
    expect(asset.assetId).toBeDefined();
    expect(asset.assetType).toBe(AssetType.HARDWARE);
    expect(asset.serialNumber).toBe('SRV-TEST-001');
    expect(asset.status).toBe('IN_USE');
  });
  
  it('should create a work order with parts requirements', async () => {
    // Get work order service
    const workOrderService = new WorkOrderService();
    const inventoryService = new InventoryService();
    
    // 1. Get inventory items for reference
    const inventoryItems = await Promise.all(
      partInventoryIds.map(id => inventoryService.getInventoryItem(id))
    );
    
    // 2. Create work order
    const workOrderInput = {
      workOrderNumber: testWorkOrderNumber,
      title: 'Server Maintenance',
      description: 'Routine maintenance and parts replacement',
      priority: WorkOrderPriority.MEDIUM,
      status: WorkOrderStatus.OPEN,
      assetId,
      assignedTo: 'technician1',
      location: 'Building 1, Floor 1, Room 101',
      scheduledStartDate: new Date().toISOString(),
      scheduledEndDate: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(), // 1 day from now
      estimatedHours: 2,
      actualHours: 0,
      notes: 'Replace network card and check power supply',
    };
    
    const workOrder = await workOrderService.createWorkOrder(workOrderInput);
    workOrderId = workOrder.workOrderId;
    
    // Verify work order was created
    expect(workOrder).toBeDefined();
    expect(workOrder.workOrderId).toBeDefined();
    expect(workOrder.workOrderNumber).toBe(testWorkOrderNumber);
    expect(workOrder.status).toBe(WorkOrderStatus.OPEN);
    expect(workOrder.assetId).toBe(assetId);
    
    // 3. Add parts requirements to work order
    const partRequirements = [
      {
        inventoryId: inventoryItems[0].inventoryId, // Network card
        partNumber: inventoryItems[0].partNumber,
        description: inventoryItems[0].description,
        quantityRequired: 1,
        stockroomId,
        binLocationId: binLocationIds[0],
        unitCost: inventoryItems[0].unitCost
      },
      {
        inventoryId: inventoryItems[1].inventoryId, // Power supply
        partNumber: inventoryItems[1].partNumber,
        description: inventoryItems[1].description,
        quantityRequired: 1,
        stockroomId,
        binLocationId: binLocationIds[1],
        unitCost: inventoryItems[1].unitCost
      }
    ];
    
    for (const part of partRequirements) {
      const workOrderPart = await workOrderService.addPartToWorkOrder(
        workOrderId,
        part
      );
      
      workOrderPartIds.push(workOrderPart.workOrderPartId);
      
      // Verify part was added to work order
      expect(workOrderPart).toBeDefined();
      expect(workOrderPart.workOrderPartId).toBeDefined();
      expect(workOrderPart.workOrderId).toBe(workOrderId);
      expect(workOrderPart.inventoryId).toBe(part.inventoryId);
      expect(workOrderPart.quantityRequired).toBe(part.quantityRequired);
    }
    
    // Verify work order has parts
    const workOrderWithParts = await workOrderService.getWorkOrder(workOrderId);
    expect(workOrderWithParts.parts).toBeDefined();
    expect(workOrderWithParts.parts.length).toBe(2);
  });
  
  it('should assign the work order to a technician', async () => {
    // Get work order service
    const workOrderService = new WorkOrderService();
    
    // Assign work order
    await workOrderService.assignWorkOrder(workOrderId, 'technician1', 'Assigning to technician for parts replacement');
    
    // Start work
    await workOrderService.startWorkOrder(workOrderId);
    
    // Verify work order status is updated
    const workOrder = await workOrderService.getWorkOrder(workOrderId);
    expect(workOrder.status).toBe(WorkOrderStatus.IN_PROGRESS);
    expect(workOrder.assignedTo).toBe('technician1');
  });
  
  it('should consume parts from inventory for the work order', async () => {
    // Get services
    const workOrderService = new WorkOrderService();
    const inventoryService = new InventoryService();
    
    // Get initial inventory levels
    const initialInventoryLevels = await Promise.all(
      partInventoryIds.map(id => inventoryService.getInventoryItem(id))
    );
    
    // Consume parts for work order
    for (let i = 0; i < workOrderPartIds.length; i++) {
      const workOrderPartId = workOrderPartIds[i];
      const inventoryId = partInventoryIds[i];
      const quantityRequired = 1;
      
      // Record parts consumption
      const transaction = await workOrderService.consumePartForWorkOrder(
        workOrderId,
        workOrderPartId,
        {
          inventoryId,
          quantity: quantityRequired,
          consumedBy: 'technician1',
          consumptionDate: new Date().toISOString(),
          notes: `Used for work order ${testWorkOrderNumber}`
        }
      );
      
      transactionIds.push(transaction.transactionId);
      
      // Verify transaction was created
      expect(transaction).toBeDefined();
      expect(transaction.transactionId).toBeDefined();
      expect(transaction.inventoryId).toBe(inventoryId);
      expect(transaction.quantity).toBe(quantityRequired);
      expect(transaction.type).toBe(TransactionType.CONSUMPTION);
      expect(transaction.referenceId).toBe(workOrderId);
    }
    
    // Verify inventory levels are updated
    for (let i = 0; i < partInventoryIds.length; i++) {
      const inventoryId = partInventoryIds[i];
      const updatedItem = await inventoryService.getInventoryItem(inventoryId);
      const initialQuantity = initialInventoryLevels[i].quantity;
      
      // Verify quantity was reduced by 1
      expect(updatedItem.quantity).toBe(initialQuantity - 1);
    }
  });
  
  it('should complete the work order and provide labor details', async () => {
    // Get work order service
    const workOrderService = new WorkOrderService();
    
    // Add labor details
    await workOrderService.addLaborToWorkOrder(workOrderId, {
      technicianId: 'technician1',
      startTime: new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString(), // 2 hours ago
      endTime: new Date().toISOString(),
      hours: 2,
      notes: 'Replaced network card and performed diagnostics on power supply'
    });
    
    // Complete work order
    await workOrderService.completeWorkOrder(
      workOrderId,
      {
        completionNotes: 'Successfully replaced network card and verified power supply operation',
        completedBy: 'technician1',
        actualHours: 2
      }
    );
    
    // Verify work order status is updated
    const completedWorkOrder = await workOrderService.getWorkOrder(workOrderId);
    expect(completedWorkOrder.status).toBe(WorkOrderStatus.COMPLETED);
    expect(completedWorkOrder.actualHours).toBe(2);
  });
  
  it('should verify asset maintenance history is updated', async () => {
    // Get services
    const assetService = new AssetService();
    const workOrderService = new WorkOrderService();
    
    // Get maintenance history for asset
    const maintenanceHistory = await assetService.getMaintenanceHistory(assetId);
    
    // Verify maintenance history includes the work order
    expect(maintenanceHistory).toBeDefined();
    expect(maintenanceHistory.length).toBeGreaterThan(0);
    
    const historyEntry = maintenanceHistory.find(h => h.referenceId === workOrderId);
    expect(historyEntry).toBeDefined();
    expect(historyEntry.referenceType).toBe('WORK_ORDER');
    expect(historyEntry.description).toContain('Server Maintenance');
    
    // Verify parts consumed are recorded properly
    const workOrderDetails = await workOrderService.getWorkOrderWithDetails(workOrderId);
    expect(workOrderDetails.partsConsumed).toBeDefined();
    expect(workOrderDetails.partsConsumed.length).toBe(2);
    
    // Verify labor records
    expect(workOrderDetails.labor).toBeDefined();
    expect(workOrderDetails.labor.length).toBe(1);
    expect(workOrderDetails.labor[0].technicianId).toBe('technician1');
    expect(workOrderDetails.labor[0].hours).toBe(2);
  });
  
  it('should generate a parts consumption report', async () => {
    // Get services
    const workOrderService = new WorkOrderService();
    
    // Generate parts consumption report
    const report = await workOrderService.generatePartsConsumptionReport({
      startDate: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString(), // 7 days ago
      endDate: new Date().toISOString(),
    });
    
    // Verify report includes consumed parts
    expect(report).toBeDefined();
    expect(report.items.length).toBeGreaterThan(0);
    
    // Look for our specific work order parts
    const workOrderItems = report.items.filter(item => item.workOrderId === workOrderId);
    expect(workOrderItems.length).toBe(2); // The two parts we consumed
    
    // Verify total costs
    expect(report.totalCost).toBeGreaterThan(0);
    const expectedTotalCost = 75.00 + 120.00; // Network card + Power supply
    expect(report.totalCost).toBeCloseTo(expectedTotalCost, 2);
  });
  
  // Clean up test data after tests
  afterAll(async () => {
    // Permanently delete test data
    const dbClient = DbTestClient.getInstance();
    
    // Delete work order related data
    for (const transactionId of transactionIds) {
      await dbClient.query('DELETE FROM inventory_transactions WHERE transaction_id = $1', [transactionId]);
    }
    
    for (const partId of workOrderPartIds) {
      await dbClient.query('DELETE FROM work_order_parts WHERE work_order_part_id = $1', [partId]);
    }
    
    await dbClient.query('DELETE FROM work_order_labor WHERE work_order_id = $1', [workOrderId]);
    await dbClient.query('DELETE FROM work_orders WHERE work_order_id = $1', [workOrderId]);
    
    // Delete asset and maintenance history
    await dbClient.query('DELETE FROM asset_maintenance_history WHERE asset_id = $1', [assetId]);
    await dbClient.query('DELETE FROM hardware_assets WHERE asset_id = $1', [assetId]);
    await dbClient.query('DELETE FROM assets WHERE asset_id = $1', [assetId]);
    
    // Delete inventory
    for (const inventoryId of partInventoryIds) {
      await dbClient.query('DELETE FROM inventory WHERE inventory_id = $1', [inventoryId]);
    }
    
    // Delete bin locations
    for (const binId of binLocationIds) {
      await dbClient.query('DELETE FROM bin_locations WHERE bin_id = $1', [binId]);
    }
    
    // Delete stockroom
    await dbClient.query('DELETE FROM stockrooms WHERE stockroom_id = $1', [stockroomId]);
  });
});