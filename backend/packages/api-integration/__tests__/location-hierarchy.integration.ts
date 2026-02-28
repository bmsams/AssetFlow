/**
 * Integration tests for Location Hierarchy API
 * Validates the end-to-end flow: building → floor → room → rack
 */
import { DbTestClient } from './setup/test-helpers';
import { setup, teardown } from './setup/integration-test-setup';
import { BuildingService } from '@ams/admin-service';
import { Building, Floor, Room, Rack } from '@ams/types';

// Test setup and teardown
beforeAll(async () => await setup());
afterAll(async () => await teardown());

describe('Location Hierarchy API Integration', () => {
  // Test data
  const testBuildingCode = 'INT-BLDG-01';
  const testBuildingName = 'Integration Test Building';
  let buildingId: string;
  let floorId: string;
  let roomId: string;
  let rackId: string;

  // Test the complete hierarchy creation flow
  it('should create a complete location hierarchy: building → floor → room → rack', async () => {
    // Get services
    const buildingService = new BuildingService();
    
    // 1. Create a building
    const buildingInput: Omit<Building, 'buildingId' | 'createdAt' | 'updatedAt'> = {
      code: testBuildingCode,
      name: testBuildingName,
      address1: '123 Integration Test St',
      city: 'Test City',
      state: 'TS',
      postalCode: '12345',
      country: 'Test Country',
      status: 'ACTIVE',
    };
    
    const building = await buildingService.createBuilding(buildingInput);
    buildingId = building.buildingId;
    
    // Verify building was created
    expect(building).toBeDefined();
    expect(building.buildingId).toBeDefined();
    expect(building.code).toBe(testBuildingCode);
    expect(building.name).toBe(testBuildingName);
    
    // 2. Create a floor in the building
    const floorInput: Omit<Floor, 'floorId' | 'createdAt' | 'updatedAt'> = {
      buildingId,
      number: '1',
      name: 'First Floor',
      status: 'ACTIVE',
    };
    
    const floorService = buildingService.getFloorService();
    const floor = await floorService.createFloor(floorInput);
    floorId = floor.floorId;
    
    // Verify floor was created
    expect(floor).toBeDefined();
    expect(floor.floorId).toBeDefined();
    expect(floor.buildingId).toBe(buildingId);
    expect(floor.name).toBe('First Floor');
    
    // 3. Create a room on the floor
    const roomInput: Omit<Room, 'roomId' | 'createdAt' | 'updatedAt'> = {
      floorId,
      number: '101',
      name: 'Server Room',
      type: 'SERVER_ROOM',
      status: 'ACTIVE',
    };
    
    const roomService = floorService.getRoomService();
    const room = await roomService.createRoom(roomInput);
    roomId = room.roomId;
    
    // Verify room was created
    expect(room).toBeDefined();
    expect(room.roomId).toBeDefined();
    expect(room.floorId).toBe(floorId);
    expect(room.name).toBe('Server Room');
    expect(room.type).toBe('SERVER_ROOM');
    
    // 4. Create a rack in the room
    const rackInput: Omit<Rack, 'rackId' | 'createdAt' | 'updatedAt'> = {
      roomId,
      name: 'Test Rack 1',
      location: 'Row 1, Position 1',
      model: 'Test Rack Model',
      totalUnits: 42,
      usedUnits: 0,
      status: 'ACTIVE',
    };
    
    const rackService = roomService.getRackService();
    const rack = await rackService.createRack(rackInput);
    rackId = rack.rackId;
    
    // Verify rack was created
    expect(rack).toBeDefined();
    expect(rack.rackId).toBeDefined();
    expect(rack.roomId).toBe(roomId);
    expect(rack.name).toBe('Test Rack 1');
    expect(rack.totalUnits).toBe(42);
    expect(rack.usedUnits).toBe(0);
    expect(rack.availableUnits).toBe(42); // Derived property
  });
  
  it('should retrieve the complete location hierarchy', async () => {
    // Get the building service
    const buildingService = new BuildingService();
    
    // Retrieve the building with its complete hierarchy
    const building = await buildingService.getBuildingWithHierarchy(buildingId);
    
    // Verify building details
    expect(building).toBeDefined();
    expect(building.buildingId).toBe(buildingId);
    expect(building.code).toBe(testBuildingCode);
    
    // Verify floors
    expect(building.floors).toBeDefined();
    expect(building.floors.length).toBeGreaterThan(0);
    const floor = building.floors.find(f => f.floorId === floorId);
    expect(floor).toBeDefined();
    
    // Verify rooms
    expect(floor.rooms).toBeDefined();
    expect(floor.rooms.length).toBeGreaterThan(0);
    const room = floor.rooms.find(r => r.roomId === roomId);
    expect(room).toBeDefined();
    expect(room.name).toBe('Server Room');
    
    // Verify racks
    expect(room.racks).toBeDefined();
    expect(room.racks.length).toBeGreaterThan(0);
    const rack = room.racks.find(r => r.rackId === rackId);
    expect(rack).toBeDefined();
    expect(rack.name).toBe('Test Rack 1');
    expect(rack.totalUnits).toBe(42);
  });
  
  it('should enforce constraints in the location hierarchy', async () => {
    // Get the building service
    const buildingService = new BuildingService();
    
    // Attempt to create a building with duplicate code (should fail)
    const duplicateBuildingInput: Omit<Building, 'buildingId' | 'createdAt' | 'updatedAt'> = {
      code: testBuildingCode, // Same code as existing building
      name: 'Duplicate Building',
      address1: '456 Duplicate St',
      city: 'Test City',
      state: 'TS',
      postalCode: '12345',
      country: 'Test Country',
      status: 'ACTIVE',
    };
    
    await expect(buildingService.createBuilding(duplicateBuildingInput))
      .rejects.toThrow(/duplicate.*code/i);
    
    // Attempt to create a floor for non-existent building (should fail)
    const invalidFloorInput: Omit<Floor, 'floorId' | 'createdAt' | 'updatedAt'> = {
      buildingId: 'non-existent-building-id',
      number: '2',
      name: 'Invalid Floor',
      status: 'ACTIVE',
    };
    
    const floorService = buildingService.getFloorService();
    await expect(floorService.createFloor(invalidFloorInput))
      .rejects.toThrow(/building.*not found/i);
    
    // Verify cascade deletion - Delete building should delete floors, rooms, and racks
    await buildingService.deactivateBuilding(buildingId);
    
    // Verify building is deactivated
    const deactivatedBuilding = await buildingService.getBuilding(buildingId);
    expect(deactivatedBuilding.status).toBe('INACTIVE');
    
    // Attempt to create a floor in deactivated building (should fail)
    const floorInDeactivatedBuildingInput: Omit<Floor, 'floorId' | 'createdAt' | 'updatedAt'> = {
      buildingId,
      number: '3',
      name: 'Floor in Deactivated Building',
      status: 'ACTIVE',
    };
    
    await expect(floorService.createFloor(floorInDeactivatedBuildingInput))
      .rejects.toThrow(/building.*inactive/i);
  });
  
  // Clean up test data after tests
  afterAll(async () => {
    // Permanently delete test data
    const dbClient = DbTestClient.getInstance();
    await dbClient.query('DELETE FROM racks WHERE rack_id = $1', [rackId]);
    await dbClient.query('DELETE FROM rooms WHERE room_id = $1', [roomId]);
    await dbClient.query('DELETE FROM floors WHERE floor_id = $1', [floorId]);
    await dbClient.query('DELETE FROM buildings WHERE building_id = $1', [buildingId]);
  });
});