/**
 * Integration tests for Maintenance Plan → Work Order Generation
 * Validates the automated generation of work orders from maintenance plans
 */
import { DbTestClient } from './setup/test-helpers';
import { setup, teardown } from './setup/integration-test-setup';
import { MaintenancePlanService } from '@ams/eam-service';
import { WorkOrderService } from '@ams/eam-service';
import { AssetService } from '@ams/lifecycle-service';
import { 
  MaintenancePlan,
  MaintenanceScheduleType,
  MaintenanceFrequencyUnit,
  HardwareAssetDetails,
  WorkOrderStatus,
  WorkOrderPriority,
  AssetType 
} from '@ams/types';

// Test setup and teardown
beforeAll(async () => await setup());
afterAll(async () => await teardown());

describe('Maintenance Plan to Work Order Generation Integration', () => {
  // Test data
  const testPlanName = 'Integration Test Maintenance Plan';
  let assetId: string;
  let maintenancePlanId: string;
  let generatedWorkOrderIds: string[] = [];
  
  it('should create a hardware asset for maintenance planning', async () => {
    // Get asset service
    const assetService = new AssetService();
    
    // Create a hardware asset
    const assetDetails: HardwareAssetDetails = {
      name: 'Maintenance Plan Test Server',
      description: 'Server for testing maintenance plan work order generation',
      serialNumber: 'MPTEST-SN-001',
      status: 'IN_USE',
      lifecycleState: 'DEPLOYED',
      assetTagNumber: 'MP-ASSET-001',
      location: 'Building 1, Floor 1, Room 101',
      assignedTo: 'Department 1',
      purchaseDate: new Date(Date.now() - 365 * 24 * 60 * 60 * 1000).toISOString(), // 1 year ago
      purchasePrice: 6000.00,
      warrantyExpirationDate: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000).toISOString(), // 1 year from now
      notes: 'Asset for maintenance plan testing',
      modelId: null,
      manufacturerId: null,
      ipAddress: '192.168.1.101',
      macAddress: 'AA:BB:CC:DD:EE:FF',
    };
    
    const asset = await assetService.createHardwareAsset(assetDetails);
    assetId = asset.assetId;
    
    // Verify asset was created
    expect(asset).toBeDefined();
    expect(asset.assetId).toBeDefined();
    expect(asset.assetType).toBe(AssetType.HARDWARE);
    expect(asset.serialNumber).toBe('MPTEST-SN-001');
    expect(asset.status).toBe('IN_USE');
  });
  
  it('should create a maintenance plan for the asset', async () => {
    // Get maintenance plan service
    const maintenancePlanService = new MaintenancePlanService();
    
    // Get current date for use in plan
    const today = new Date();
    const startDate = new Date(today);
    startDate.setDate(startDate.getDate() - 30); // 30 days ago
    
    // Create a maintenance plan for monthly server maintenance
    const planInput = {
      name: testPlanName,
      description: 'Monthly server health check and maintenance',
      assetId,
      scheduleType: MaintenanceScheduleType.FIXED,
      frequency: 1,
      frequencyUnit: MaintenanceFrequencyUnit.MONTH,
      startDate: startDate.toISOString(),
      priority: WorkOrderPriority.MEDIUM,
      estimatedHours: 2,
      assignToTeam: 'IT Support',
      active: true,
      procedureDescription: `
        1. Check system logs for errors
        2. Verify cooling system operation
        3. Clean air filters
        4. Update firmware if available
        5. Run diagnostic tests
        6. Document results
      `,
      notes: 'Generate work orders on the same day each month',
    };
    
    const plan = await maintenancePlanService.createMaintenancePlan(planInput);
    maintenancePlanId = plan.maintenancePlanId;
    
    // Verify plan was created
    expect(plan).toBeDefined();
    expect(plan.maintenancePlanId).toBeDefined();
    expect(plan.name).toBe(testPlanName);
    expect(plan.assetId).toBe(assetId);
    expect(plan.active).toBe(true);
    expect(plan.frequency).toBe(1);
    expect(plan.frequencyUnit).toBe(MaintenanceFrequencyUnit.MONTH);
  });
  
  it('should calculate next due dates correctly', async () => {
    // Get maintenance plan service
    const maintenancePlanService = new MaintenancePlanService();
    
    // Get the plan with its schedule
    const plan = await maintenancePlanService.getMaintenancePlanWithSchedule(maintenancePlanId);
    
    // Verify plan has a schedule
    expect(plan.schedule).toBeDefined();
    expect(plan.schedule.length).toBeGreaterThan(0);
    
    // Verify the due dates follow the monthly pattern
    let previousDate: Date | null = null;
    
    for (const scheduleItem of plan.schedule) {
      const dueDate = new Date(scheduleItem.dueDate);
      
      if (previousDate) {
        const diffInDays = Math.round((dueDate.getTime() - previousDate.getTime()) / (24 * 60 * 60 * 1000));
        
        // Expect roughly 30 days difference (allowing for month variations)
        expect(diffInDays).toBeGreaterThanOrEqual(28);
        expect(diffInDays).toBeLessThanOrEqual(31);
      }
      
      previousDate = dueDate;
    }
  });
  
  it('should generate work orders from the maintenance plan', async () => {
    // Get services
    const maintenancePlanService = new MaintenancePlanService();
    const workOrderService = new WorkOrderService();
    
    // Process due maintenance plans to generate work orders
    // For our test, we'll check for any due maintenance today and in the past 60 days
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - 60);
    
    const endDate = new Date();
    endDate.setDate(endDate.getDate() + 1); // Include today
    
    // Generate work orders for due maintenance
    const generatedWorkOrders = await maintenancePlanService.generateWorkOrdersForDueMaintenance({
      startDate: startDate.toISOString(),
      endDate: endDate.toISOString()
    });
    
    // Store the generated work order IDs
    generatedWorkOrderIds = generatedWorkOrders.map(wo => wo.workOrderId);
    
    // Verify work orders were generated
    expect(generatedWorkOrders).toBeDefined();
    expect(generatedWorkOrders.length).toBeGreaterThan(0);
    
    // Verify the work orders have the right properties from the plan
    for (const workOrder of generatedWorkOrders) {
      expect(workOrder.assetId).toBe(assetId);
      expect(workOrder.title).toContain(testPlanName);
      expect(workOrder.priority).toBe(WorkOrderPriority.MEDIUM);
      expect(workOrder.status).toBe(WorkOrderStatus.OPEN);
      expect(workOrder.estimatedHours).toBe(2);
      expect(workOrder.assignedTo).toBe('IT Support');
    }
    
    // Verify maintenance schedule was updated to mark the generation
    const updatedPlan = await maintenancePlanService.getMaintenancePlanWithSchedule(maintenancePlanId);
    
    // Find the schedule items that should have had work orders generated
    const schedulesWithWorkOrders = updatedPlan.schedule.filter(
      s => new Date(s.dueDate) <= endDate && new Date(s.dueDate) >= startDate
    );
    
    // Verify they all have workOrderId and generatedDate set
    for (const scheduleItem of schedulesWithWorkOrders) {
      expect(scheduleItem.workOrderId).toBeDefined();
      expect(scheduleItem.generatedDate).toBeDefined();
      
      // Verify the work order ID is in our list of generated IDs
      expect(generatedWorkOrderIds).toContain(scheduleItem.workOrderId);
    }
  });
  
  it('should check that work order details match the maintenance plan', async () => {
    // Get work order service
    const workOrderService = new WorkOrderService();
    
    // Check the first generated work order
    const workOrderId = generatedWorkOrderIds[0];
    const workOrder = await workOrderService.getWorkOrder(workOrderId);
    
    // Verify work order has details from the maintenance plan
    expect(workOrder).toBeDefined();
    expect(workOrder.assetId).toBe(assetId);
    expect(workOrder.title).toContain(testPlanName);
    expect(workOrder.description).toContain('Monthly server health check');
    expect(workOrder.priority).toBe(WorkOrderPriority.MEDIUM);
    expect(workOrder.status).toBe(WorkOrderStatus.OPEN);
    expect(workOrder.estimatedHours).toBe(2);
    
    // Verify work order has the procedure steps in the notes
    expect(workOrder.notes).toContain('Check system logs');
    expect(workOrder.notes).toContain('Clean air filters');
    expect(workOrder.notes).toContain('Run diagnostic tests');
  });
  
  it('should complete a generated work order', async () => {
    // Get work order service
    const workOrderService = new WorkOrderService();
    
    // Get the first work order to complete
    const workOrderId = generatedWorkOrderIds[0];
    
    // Assign and start the work order
    await workOrderService.assignWorkOrder(workOrderId, 'technician2', 'Assigned for maintenance');
    await workOrderService.startWorkOrder(workOrderId);
    
    // Add labor details
    await workOrderService.addLaborToWorkOrder(workOrderId, {
      technicianId: 'technician2',
      startTime: new Date(Date.now() - 1.5 * 60 * 60 * 1000).toISOString(), // 1.5 hours ago
      endTime: new Date().toISOString(),
      hours: 1.5,
      notes: 'Completed all maintenance steps, system is running well'
    });
    
    // Complete the work order
    await workOrderService.completeWorkOrder(
      workOrderId,
      {
        completionNotes: 'All maintenance steps completed. Updated firmware to version 2.3.4',
        completedBy: 'technician2',
        actualHours: 1.5
      }
    );
    
    // Verify work order was completed
    const completedWorkOrder = await workOrderService.getWorkOrder(workOrderId);
    expect(completedWorkOrder.status).toBe(WorkOrderStatus.COMPLETED);
    expect(completedWorkOrder.actualHours).toBe(1.5);
  });
  
  it('should verify maintenance history is updated for the asset', async () => {
    // Get asset service
    const assetService = new AssetService();
    
    // Get maintenance history
    const maintenanceHistory = await assetService.getMaintenanceHistory(assetId);
    
    // Verify maintenance history includes the work order we completed
    expect(maintenanceHistory).toBeDefined();
    expect(maintenanceHistory.length).toBeGreaterThan(0);
    
    // Find the history entry for our completed work order
    const completedWorkOrderId = generatedWorkOrderIds[0];
    const historyEntry = maintenanceHistory.find(h => h.referenceId === completedWorkOrderId);
    
    // Verify history entry details
    expect(historyEntry).toBeDefined();
    expect(historyEntry.referenceType).toBe('WORK_ORDER');
    expect(historyEntry.description).toContain(testPlanName);
    expect(historyEntry.maintenanceType).toBe('PREVENTIVE');
    expect(historyEntry.completedBy).toBe('technician2');
  });
  
  it('should generate the next set of due work orders automatically', async () => {
    // Get maintenance plan service
    const maintenancePlanService = new MaintenancePlanService();
    
    // First, modify the plan to make next maintenance due soon
    const plan = await maintenancePlanService.getMaintenancePlan(maintenancePlanId);
    
    // Move the start date up so next maintenance is due today
    const today = new Date();
    const adjustedStartDate = new Date(today);
    adjustedStartDate.setDate(adjustedStartDate.getDate() - 30); // Exactly one month ago
    
    // Update the plan
    await maintenancePlanService.updateMaintenancePlan(
      maintenancePlanId, 
      { 
        startDate: adjustedStartDate.toISOString() 
      }
    );
    
    // Now generate work orders for due maintenance today
    const newWorkOrders = await maintenancePlanService.generateWorkOrdersForDueMaintenance({
      startDate: today.toISOString(),
      endDate: today.toISOString()
    });
    
    // Verify new work orders were generated
    expect(newWorkOrders).toBeDefined();
    expect(newWorkOrders.length).toBeGreaterThan(0);
    
    // Add new work order IDs to our list
    generatedWorkOrderIds = generatedWorkOrderIds.concat(
      newWorkOrders.map(wo => wo.workOrderId)
    );
    
    // Verify the maintenance plan schedule was updated
    const updatedPlan = await maintenancePlanService.getMaintenancePlanWithSchedule(maintenancePlanId);
    const todayScheduleItems = updatedPlan.schedule.filter(
      s => new Date(s.dueDate).toDateString() === today.toDateString()
    );
    
    // Should have a schedule item for today with a work order
    expect(todayScheduleItems.length).toBeGreaterThan(0);
    expect(todayScheduleItems[0].workOrderId).toBeDefined();
    expect(todayScheduleItems[0].generatedDate).toBeDefined();
  });
  
  // Clean up test data after tests
  afterAll(async () => {
    // Permanently delete test data
    const dbClient = DbTestClient.getInstance();
    
    // Delete work orders
    for (const workOrderId of generatedWorkOrderIds) {
      await dbClient.query('DELETE FROM work_order_labor WHERE work_order_id = $1', [workOrderId]);
      await dbClient.query('DELETE FROM work_orders WHERE work_order_id = $1', [workOrderId]);
    }
    
    // Delete maintenance plan schedule and plan
    await dbClient.query('DELETE FROM maintenance_schedule WHERE maintenance_plan_id = $1', [maintenancePlanId]);
    await dbClient.query('DELETE FROM maintenance_plans WHERE maintenance_plan_id = $1', [maintenancePlanId]);
    
    // Delete asset maintenance history and asset
    await dbClient.query('DELETE FROM asset_maintenance_history WHERE asset_id = $1', [assetId]);
    await dbClient.query('DELETE FROM hardware_assets WHERE asset_id = $1', [assetId]);
    await dbClient.query('DELETE FROM assets WHERE asset_id = $1', [assetId]);
  });
});