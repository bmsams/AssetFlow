/**
 * Integration tests for Model Catalog → Asset Creation
 * Validates the workflow from creating a model in the catalog to creating assets based on it
 */
import { DbTestClient } from './setup/test-helpers';
import { setup, teardown } from './setup/integration-test-setup';
import { ManufacturerService, ModelService } from '@ams/admin-service';
import { AssetService } from '@ams/lifecycle-service';
import { Manufacturer, Model, AssetType, HardwareAssetDetails, HardwareAsset } from '@ams/types';

// Test setup and teardown
beforeAll(async () => await setup());
afterAll(async () => await teardown());

describe('Model Catalog to Asset Creation Workflow Integration', () => {
  // Test data
  const testManufacturerName = 'Integration Test Manufacturer';
  let manufacturerId: string;
  let modelId: string;
  let assetIds: string[] = [];
  
  it('should create a manufacturer and verify its properties', async () => {
    // Get manufacturer service
    const manufacturerService = new ManufacturerService();
    
    // Create a manufacturer
    const manufacturerInput = {
      name: testManufacturerName,
      code: 'INT-MFR-001',
      contactName: 'Jane Smith',
      email: 'jane.smith@testmanufacturer.com',
      phone: '555-987-6543',
      website: 'https://testmanufacturer.com',
      status: 'ACTIVE',
    };
    
    const manufacturer = await manufacturerService.createManufacturer(manufacturerInput);
    manufacturerId = manufacturer.manufacturerId;
    
    // Verify manufacturer was created
    expect(manufacturer).toBeDefined();
    expect(manufacturer.manufacturerId).toBeDefined();
    expect(manufacturer.name).toBe(testManufacturerName);
    expect(manufacturer.code).toBe('INT-MFR-001');
    expect(manufacturer.status).toBe('ACTIVE');
  });
  
  it('should create a model in the catalog and verify its properties', async () => {
    // Get model service
    const modelService = new ModelService();
    
    // Create a model
    const modelInput = {
      manufacturerId,
      name: 'Integration Test Server Model',
      modelNumber: 'SRV-TEST-001',
      productType: 'SERVER',
      assetType: AssetType.HARDWARE,
      specifications: JSON.stringify({
        cpu: '8-core 3.2GHz',
        memory: '64GB DDR4',
        storage: '2TB SSD',
        networkInterfaces: 4
      }),
      lifeExpectancyMonths: 60, // 5 years
      eolDate: new Date(Date.now() + 5 * 365 * 24 * 60 * 60 * 1000).toISOString(), // 5 years from now
      status: 'ACTIVE',
      imageUrl: 'https://example.com/server-image.jpg',
      notes: 'Integration test server model',
    };
    
    const model = await modelService.createModel(modelInput);
    modelId = model.modelId;
    
    // Verify model was created
    expect(model).toBeDefined();
    expect(model.modelId).toBeDefined();
    expect(model.manufacturerId).toBe(manufacturerId);
    expect(model.name).toBe('Integration Test Server Model');
    expect(model.modelNumber).toBe('SRV-TEST-001');
    expect(model.assetType).toBe(AssetType.HARDWARE);
    expect(model.status).toBe('ACTIVE');
  });
  
  it('should create a hardware asset from the model and verify its properties', async () => {
    // Get asset service
    const assetService = new AssetService();
    const modelService = new ModelService();
    
    // Get model details
    const model = await modelService.getModel(modelId);
    
    // Create an asset based on the model
    const assetDetails: HardwareAssetDetails = {
      name: 'Integration Test Server 001',
      description: 'Asset created from model catalog in integration test',
      serialNumber: 'TEST-SN-001',
      status: 'IN_STOCK',
      lifecycleState: 'RECEIVED',
      assetTagNumber: 'ASSET-001',
      location: null,
      assignedTo: null,
      purchaseDate: new Date().toISOString(),
      purchasePrice: 2500.00,
      warrantyExpirationDate: new Date(Date.now() + 3 * 365 * 24 * 60 * 60 * 1000).toISOString(), // 3 years from now
      notes: 'Created during integration test',
      modelId: model.modelId,
      manufacturerId: model.manufacturerId,
      ipAddress: '192.168.1.10',
      macAddress: '00:1B:44:11:3A:B7',
    };
    
    const asset = await assetService.createHardwareAsset(assetDetails);
    assetIds.push(asset.assetId);
    
    // Verify asset was created
    expect(asset).toBeDefined();
    expect(asset.assetId).toBeDefined();
    expect(asset.assetType).toBe(AssetType.HARDWARE);
    expect(asset.serialNumber).toBe('TEST-SN-001');
    expect(asset.assetTagNumber).toBe('ASSET-001');
    expect(asset.modelId).toBe(modelId);
    expect(asset.manufacturerId).toBe(manufacturerId);
  });
  
  it('should create multiple assets from the same model', async () => {
    // Get asset service
    const assetService = new AssetService();
    
    // Create multiple assets based on the model
    for (let i = 2; i <= 4; i++) {
      const assetDetails: HardwareAssetDetails = {
        name: `Integration Test Server 00${i}`,
        description: `Asset ${i} created from model catalog in integration test`,
        serialNumber: `TEST-SN-00${i}`,
        status: 'IN_STOCK',
        lifecycleState: 'RECEIVED',
        assetTagNumber: `ASSET-00${i}`,
        location: null,
        assignedTo: null,
        purchaseDate: new Date().toISOString(),
        purchasePrice: 2500.00,
        warrantyExpirationDate: new Date(Date.now() + 3 * 365 * 24 * 60 * 60 * 1000).toISOString(),
        notes: 'Created during integration test',
        modelId,
        manufacturerId,
        ipAddress: `192.168.1.1${i}`,
        macAddress: `00:1B:44:11:3A:B${i}`,
      };
      
      const asset = await assetService.createHardwareAsset(assetDetails);
      assetIds.push(asset.assetId);
      
      // Verify asset was created with the correct model
      expect(asset).toBeDefined();
      expect(asset.assetId).toBeDefined();
      expect(asset.modelId).toBe(modelId);
      expect(asset.manufacturerId).toBe(manufacturerId);
    }
    
    // Verify asset count
    expect(assetIds.length).toBe(4); // 1 from previous test + 3 from this test
  });
  
  it('should retrieve assets by model ID', async () => {
    // Get asset service
    const assetService = new AssetService();
    
    // Retrieve assets by model ID
    const assets = await assetService.getAssetsByModel(modelId);
    
    // Verify all assets were retrieved
    expect(assets).toBeDefined();
    expect(assets.length).toBe(assetIds.length);
    
    // Verify assets have correct model ID
    for (const asset of assets) {
      expect(asset.modelId).toBe(modelId);
    }
  });
  
  it('should update the model and verify the change affects reporting', async () => {
    // Get services
    const modelService = new ModelService();
    const assetService = new AssetService();
    
    // Update the model lifecycle status
    await modelService.updateModel(modelId, {
      status: 'DEPRECATED',
      notes: 'Model deprecated in integration test'
    });
    
    // Get updated model
    const updatedModel = await modelService.getModel(modelId);
    
    // Verify model was updated
    expect(updatedModel.status).toBe('DEPRECATED');
    
    // Get assets using a deprecated model
    const report = await assetService.getDeprecatedModelAssetReport();
    
    // Verify report contains our assets
    const modelAssets = report.find(item => item.modelId === modelId);
    expect(modelAssets).toBeDefined();
    expect(modelAssets.assetCount).toBeGreaterThanOrEqual(assetIds.length);
    expect(modelAssets.modelName).toBe('Integration Test Server Model');
    expect(modelAssets.status).toBe('DEPRECATED');
  });
  
  // Clean up test data after tests
  afterAll(async () => {
    // Permanently delete test data
    const dbClient = DbTestClient.getInstance();
    
    // Delete assets
    for (const assetId of assetIds) {
      await dbClient.query('DELETE FROM hardware_assets WHERE asset_id = $1', [assetId]);
      await dbClient.query('DELETE FROM assets WHERE asset_id = $1', [assetId]);
    }
    
    // Delete model
    await dbClient.query('DELETE FROM models WHERE model_id = $1', [modelId]);
    
    // Delete manufacturer
    await dbClient.query('DELETE FROM manufacturers WHERE manufacturer_id = $1', [manufacturerId]);
  });
});