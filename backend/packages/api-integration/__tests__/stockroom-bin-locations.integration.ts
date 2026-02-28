/**
 * Integration tests for Stockroom and Bin Locations API
 * Validates the end-to-end management of stockrooms with bin locations
 */
import { DbTestClient } from './setup/test-helpers';
import { setup, teardown } from './setup/integration-test-setup';
import { StockroomService } from '@ams/ham-service';
import { Stockroom, BinLocation, StockroomType } from '@ams/types';

// Test setup and teardown
beforeAll(async () => await setup());
afterAll(async () => await teardown());

describe('Stockroom with Bin Locations Integration', () => {
  // Test data
  const testStockroomCode = 'INT-STOCK-01';
  const testStockroomName = 'Integration Test Stockroom';
  let stockroomId: string;
  const binLocations: string[] = [];

  // Test the stockroom creation with bin locations
  it('should create a stockroom with bin locations', async () => {
    // Get services
    const stockroomService = new StockroomService();
    
    // 1. Create a stockroom
    const stockroomInput: Omit<Stockroom, 'stockroomId' | 'createdAt' | 'updatedAt'> = {
      code: testStockroomCode,
      name: testStockroomName,
      type: StockroomType.PRIMARY,
      description: 'Stockroom for integration tests',
      location: 'Building 1, Floor 1',
      status: 'ACTIVE',
    };
    
    const stockroom = await stockroomService.createStockroom(stockroomInput);
    stockroomId = stockroom.stockroomId;
    
    // Verify stockroom was created
    expect(stockroom).toBeDefined();
    expect(stockroom.stockroomId).toBeDefined();
    expect(stockroom.code).toBe(testStockroomCode);
    expect(stockroom.name).toBe(testStockroomName);
    expect(stockroom.type).toBe(StockroomType.PRIMARY);
    
    // 2. Create bin locations in the stockroom
    const binLocationService = stockroomService.getBinLocationService();
    
    // Create multiple bin locations
    const binTypes = ['SHELF', 'RACK', 'DRAWER', 'CABINET'];
    const zones = ['A', 'B', 'C'];
    
    for (let zone of zones) {
      for (let i = 1; i <= 3; i++) {
        const binType = binTypes[Math.floor(Math.random() * binTypes.length)];
        const binInput: Omit<BinLocation, 'binId' | 'createdAt' | 'updatedAt'> = {
          stockroomId,
          code: `${zone}${i}`,
          name: `${binType} ${zone}${i}`,
          type: binType,
          capacity: 100,
          available: 100,
          status: 'ACTIVE',
        };
        
        const bin = await binLocationService.createBinLocation(binInput);
        
        // Verify bin was created
        expect(bin).toBeDefined();
        expect(bin.binId).toBeDefined();
        expect(bin.stockroomId).toBe(stockroomId);
        expect(bin.code).toBe(`${zone}${i}`);
        expect(bin.capacity).toBe(100);
        expect(bin.available).toBe(100);
        
        binLocations.push(bin.binId);
      }
    }
    
    // Verify all bin locations were created
    expect(binLocations.length).toBe(9); // 3 zones x 3 bins each
  });

  it('should retrieve the stockroom with all bin locations', async () => {
    // Get services
    const stockroomService = new StockroomService();
    
    // Retrieve the stockroom with bin locations
    const stockroom = await stockroomService.getStockroomWithBins(stockroomId);
    
    // Verify stockroom details
    expect(stockroom).toBeDefined();
    expect(stockroom.stockroomId).toBe(stockroomId);
    expect(stockroom.code).toBe(testStockroomCode);
    expect(stockroom.name).toBe(testStockroomName);
    
    // Verify bin locations
    expect(stockroom.binLocations).toBeDefined();
    expect(stockroom.binLocations.length).toBe(binLocations.length);
    
    // Verify all expected bin locations are present
    for (const binId of binLocations) {
      const found = stockroom.binLocations.some(bin => bin.binId === binId);
      expect(found).toBe(true);
    }
    
    // Check for correct bin properties
    for (const bin of stockroom.binLocations) {
      expect(bin.stockroomId).toBe(stockroomId);
      expect(bin.status).toBe('ACTIVE');
      expect(typeof bin.code).toBe('string');
      expect(typeof bin.name).toBe('string');
    }
  });
  
  it('should search and filter bin locations', async () => {
    // Get services
    const stockroomService = new StockroomService();
    const binLocationService = stockroomService.getBinLocationService();
    
    // 1. Search for bin locations by zone
    const zoneABins = await binLocationService.searchBinLocations({
      stockroomId,
      codePattern: 'A%',
    });
    
    // Verify search results
    expect(zoneABins).toBeDefined();
    expect(zoneABins.items.length).toBe(3); // 3 bins in zone A
    expect(zoneABins.items.every(bin => bin.code.startsWith('A'))).toBe(true);
    
    // 2. Search for bin locations by type
    const shelfBins = await binLocationService.searchBinLocations({
      stockroomId,
      type: 'SHELF',
    });
    
    // Verify all returned bins are SHELF type
    expect(shelfBins.items.every(bin => bin.type === 'SHELF')).toBe(true);
  });
  
  it('should update bin location properties', async () => {
    // Get services
    const stockroomService = new StockroomService();
    const binLocationService = stockroomService.getBinLocationService();
    
    // Get first bin location ID
    const firstBinId = binLocations[0];
    
    // Retrieve bin location
    const originalBin = await binLocationService.getBinLocation(firstBinId);
    
    // Update bin location capacity and name
    const updatedProps = {
      name: `${originalBin.name} - Updated`,
      capacity: 200,
      available: 180,
    };
    
    await binLocationService.updateBinLocation(firstBinId, updatedProps);
    
    // Retrieve updated bin location
    const updatedBin = await binLocationService.getBinLocation(firstBinId);
    
    // Verify updates were applied
    expect(updatedBin.name).toBe(updatedProps.name);
    expect(updatedBin.capacity).toBe(updatedProps.capacity);
    expect(updatedBin.available).toBe(updatedProps.available);
    
    // Other properties should remain unchanged
    expect(updatedBin.stockroomId).toBe(originalBin.stockroomId);
    expect(updatedBin.code).toBe(originalBin.code);
    expect(updatedBin.status).toBe(originalBin.status);
  });
  
  it('should enforce constraints on stockroom and bin locations', async () => {
    // Get services
    const stockroomService = new StockroomService();
    const binLocationService = stockroomService.getBinLocationService();
    
    // 1. Attempt to create a bin location for non-existent stockroom
    const invalidBinInput: Omit<BinLocation, 'binId' | 'createdAt' | 'updatedAt'> = {
      stockroomId: 'non-existent-stockroom-id',
      code: 'INVALID-1',
      name: 'Invalid Bin',
      type: 'SHELF',
      capacity: 100,
      available: 100,
      status: 'ACTIVE',
    };
    
    await expect(binLocationService.createBinLocation(invalidBinInput))
      .rejects.toThrow(/stockroom.*not found/i);
    
    // 2. Attempt to create a bin with duplicate code in the same stockroom
    const duplicateBinInput: Omit<BinLocation, 'binId' | 'createdAt' | 'updatedAt'> = {
      stockroomId,
      code: 'A1', // Already exists
      name: 'Duplicate Bin',
      type: 'SHELF',
      capacity: 100,
      available: 100,
      status: 'ACTIVE',
    };
    
    await expect(binLocationService.createBinLocation(duplicateBinInput))
      .rejects.toThrow(/duplicate.*code/i);
    
    // 3. Attempt to set available capacity > total capacity
    await expect(
      binLocationService.updateBinLocation(binLocations[0], { available: 500, capacity: 100 })
    ).rejects.toThrow(/available.*exceed.*capacity/i);
  });
  
  it('should deactivate stockroom and cascade to bin locations', async () => {
    // Get services
    const stockroomService = new StockroomService();
    const binLocationService = stockroomService.getBinLocationService();
    
    // Deactivate stockroom
    await stockroomService.deactivateStockroom(stockroomId);
    
    // Verify stockroom is deactivated
    const stockroom = await stockroomService.getStockroom(stockroomId);
    expect(stockroom.status).toBe('INACTIVE');
    
    // Verify bin locations are also deactivated
    for (const binId of binLocations) {
      const bin = await binLocationService.getBinLocation(binId);
      expect(bin.status).toBe('INACTIVE');
    }
    
    // Attempt to create a new bin in deactivated stockroom should fail
    const newBinInput: Omit<BinLocation, 'binId' | 'createdAt' | 'updatedAt'> = {
      stockroomId,
      code: 'NEW-1',
      name: 'New Bin',
      type: 'SHELF',
      capacity: 100,
      available: 100,
      status: 'ACTIVE',
    };
    
    await expect(binLocationService.createBinLocation(newBinInput))
      .rejects.toThrow(/stockroom.*inactive/i);
  });
  
  // Clean up test data after tests
  afterAll(async () => {
    // Permanently delete test data
    const dbClient = DbTestClient.getInstance();
    
    // Delete bin locations
    for (const binId of binLocations) {
      await dbClient.query('DELETE FROM bin_locations WHERE bin_id = $1', [binId]);
    }
    
    // Delete stockroom
    await dbClient.query('DELETE FROM stockrooms WHERE stockroom_id = $1', [stockroomId]);
  });
});