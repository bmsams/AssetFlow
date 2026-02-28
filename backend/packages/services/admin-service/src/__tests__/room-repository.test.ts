/**
 * Room Repository Unit Tests
 *
 * Tests for the Room Repository data access layer.
 * Requirements:
 * - Requirement 3.1: Create room with floor reference, room number, name, and type
 * - Requirement 3.2: Return all rooms for a floor ordered by room number
 * - Requirement 3.3: Update specified fields and maintain floor relationship
 * - Requirement 3.4: Mark room as inactive and prevent new rack/asset assignments
 * - Requirement 3.5: Reject creation for non-existent floor
 */

// Mock the dependencies before importing repository
jest.mock('@ams/database', () => ({
  query: jest.fn(),
  queryOne: jest.fn(),
  queryMany: jest.fn(),
}));

jest.mock('@ams/utils', () => ({
  createLogger: () => ({
    info: jest.fn(),
    error: jest.fn(),
    warn: jest.fn(),
    debug: jest.fn(),
  }),
  now: () => '2024-01-15T10:00:00.000Z',
}));

import { query, queryOne, queryMany } from '@ams/database';
import type {
  CreateRoomRequest,
  UpdateRoomRequest,
} from '@ams/types';

// Import repository functions after mocks are set up
import * as locationRepository from '../location/location-repository';

// Use jest.mocked for proper typing
const mockQuery = jest.mocked(query);
const mockQueryOne = jest.mocked(queryOne);
const mockQueryMany = jest.mocked(queryMany);

describe('Location Repository - Room CRUD', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  // ============================================================================
  // Room Number Uniqueness Tests
  // ============================================================================

  describe('roomNumberExistsInFloor', () => {
    const floorId = '456e4567-e89b-12d3-a456-426614174000';

    it('should return true when room number exists in floor', async () => {
      mockQueryOne.mockResolvedValue({ exists: true });

      const result = await locationRepository.roomNumberExistsInFloor(floorId, 'R101');

      expect(result).toBe(true);
      expect(mockQueryOne).toHaveBeenCalledWith(
        expect.stringContaining('SELECT EXISTS'),
        [floorId, 'R101']
      );
    });

    it('should return false when room number does not exist in floor', async () => {
      mockQueryOne.mockResolvedValue({ exists: false });

      const result = await locationRepository.roomNumberExistsInFloor(floorId, 'R999');

      expect(result).toBe(false);
    });

    it('should exclude specific room ID when checking for duplicates', async () => {
      const excludeRoomId = '789e4567-e89b-12d3-a456-426614174000';
      mockQueryOne.mockResolvedValue({ exists: false });

      await locationRepository.roomNumberExistsInFloor(floorId, 'R101', excludeRoomId);

      expect(mockQueryOne).toHaveBeenCalledWith(
        expect.stringContaining('room_id != $3'),
        [floorId, 'R101', excludeRoomId]
      );
    });

    it('should return false when query returns null', async () => {
      mockQueryOne.mockResolvedValue(null);

      const result = await locationRepository.roomNumberExistsInFloor(floorId, 'R101');

      expect(result).toBe(false);
    });
  });


  // ============================================================================
  // Floor Exists Tests (Requirement 3.5)
  // ============================================================================

  describe('floorExists', () => {
    it('should return true when floor exists', async () => {
      mockQueryOne.mockResolvedValue({ exists: true });

      const result = await locationRepository.floorExists('456e4567-e89b-12d3-a456-426614174000');

      expect(result).toBe(true);
      expect(mockQueryOne).toHaveBeenCalledWith(
        expect.stringContaining('SELECT EXISTS'),
        ['456e4567-e89b-12d3-a456-426614174000']
      );
    });

    it('should return false when floor does not exist', async () => {
      mockQueryOne.mockResolvedValue({ exists: false });

      const result = await locationRepository.floorExists('nonexistent-id');

      expect(result).toBe(false);
    });

    it('should return false when query returns null', async () => {
      mockQueryOne.mockResolvedValue(null);

      const result = await locationRepository.floorExists('456e4567-e89b-12d3-a456-426614174000');

      expect(result).toBe(false);
    });
  });


  // ============================================================================
  // Create Room Tests (Requirement 3.1)
  // ============================================================================

  describe('createRoom', () => {
    const validRequest: CreateRoomRequest = {
      floorId: '456e4567-e89b-12d3-a456-426614174000',
      roomNumber: 'R101',
      name: 'Conference Room A',
      roomType: 'CONFERENCE',
      capacity: 20,
      description: 'Main conference room',
    };

    const mockRoomRow = {
      room_id: '789e4567-e89b-12d3-a456-426614174000',
      floor_id: '456e4567-e89b-12d3-a456-426614174000',
      room_number: 'R101',
      name: 'Conference Room A',
      room_type: 'CONFERENCE',
      capacity: 20,
      description: 'Main conference room',
      is_active: true,
      created_at: '2024-01-15T10:00:00.000Z',
      updated_at: '2024-01-15T10:00:00.000Z',
      created_by: null,
      updated_by: null,
    };

    it('should create a room with all fields', async () => {
      mockQueryOne.mockResolvedValue(mockRoomRow);

      const result = await locationRepository.createRoom(validRequest);

      expect(result).toEqual({
        roomId: '789e4567-e89b-12d3-a456-426614174000',
        floorId: '456e4567-e89b-12d3-a456-426614174000',
        roomNumber: 'R101',
        name: 'Conference Room A',
        roomType: 'CONFERENCE',
        capacity: 20,
        description: 'Main conference room',
        isActive: true,
        createdAt: '2024-01-15T10:00:00.000Z',
        updatedAt: '2024-01-15T10:00:00.000Z',
      });
    });

    it('should create a room with minimal required fields', async () => {
      const minimalRequest: CreateRoomRequest = {
        floorId: '456e4567-e89b-12d3-a456-426614174000',
        roomNumber: 'R102',
        name: 'Storage Room',
        roomType: 'STORAGE',
      };

      const minimalRow = {
        ...mockRoomRow,
        room_id: '889e4567-e89b-12d3-a456-426614174001',
        room_number: 'R102',
        name: 'Storage Room',
        room_type: 'STORAGE',
        capacity: null,
        description: null,
      };

      mockQueryOne.mockResolvedValue(minimalRow);

      const result = await locationRepository.createRoom(minimalRequest);

      expect(result.roomNumber).toBe('R102');
      expect(result.name).toBe('Storage Room');
      expect(result.roomType).toBe('STORAGE');
      expect(result.capacity).toBeNull();
      expect(result.description).toBeNull();
    });

    it('should set userId as created_by when provided', async () => {
      const userId = '999e4567-e89b-12d3-a456-426614174999';
      mockQueryOne.mockResolvedValue(mockRoomRow);

      await locationRepository.createRoom(validRequest, userId);

      expect(mockQueryOne).toHaveBeenCalledWith(
        expect.stringContaining('INSERT INTO rooms'),
        expect.arrayContaining([userId])
      );
    });

    it('should throw error when database insert fails', async () => {
      mockQueryOne.mockResolvedValue(null);

      await expect(locationRepository.createRoom(validRequest)).rejects.toThrow(
        'Failed to create room'
      );
    });

    it('should create rooms with different room types', async () => {
      const roomTypes = ['OFFICE', 'SERVER_ROOM', 'STORAGE', 'CONFERENCE', 'LAB', 'UTILITY', 'OTHER'];
      
      for (const roomType of roomTypes) {
        const request: CreateRoomRequest = {
          floorId: '456e4567-e89b-12d3-a456-426614174000',
          roomNumber: `R-${roomType}`,
          name: `${roomType} Room`,
          roomType: roomType as CreateRoomRequest['roomType'],
        };

        mockQueryOne.mockResolvedValue({
          ...mockRoomRow,
          room_number: `R-${roomType}`,
          name: `${roomType} Room`,
          room_type: roomType,
        });

        const result = await locationRepository.createRoom(request);
        expect(result.roomType).toBe(roomType);
      }
    });
  });


  // ============================================================================
  // Get Room By ID Tests
  // ============================================================================

  describe('getRoomById', () => {
    const mockRoomRowWithRacks = {
      room_id: '789e4567-e89b-12d3-a456-426614174000',
      floor_id: '456e4567-e89b-12d3-a456-426614174000',
      room_number: 'R101',
      name: 'Server Room',
      room_type: 'SERVER_ROOM',
      capacity: 10,
      description: 'Main server room',
      is_active: true,
      created_at: '2024-01-15T10:00:00.000Z',
      updated_at: '2024-01-15T10:00:00.000Z',
      created_by: null,
      updated_by: null,
      total_racks: '5',
    };

    it('should return room with rack count', async () => {
      mockQueryOne.mockResolvedValue(mockRoomRowWithRacks);

      const result = await locationRepository.getRoomById(
        '789e4567-e89b-12d3-a456-426614174000'
      );

      expect(result).not.toBeNull();
      expect(result?.roomId).toBe('789e4567-e89b-12d3-a456-426614174000');
      expect(result?.roomType).toBe('SERVER_ROOM');
      expect(mockQueryOne).toHaveBeenCalledWith(
        expect.stringContaining('SELECT r.*'),
        ['789e4567-e89b-12d3-a456-426614174000']
      );
    });

    it('should return null when room not found', async () => {
      mockQueryOne.mockResolvedValue(null);

      const result = await locationRepository.getRoomById('nonexistent-id');

      expect(result).toBeNull();
    });

    it('should include rack count subquery', async () => {
      mockQueryOne.mockResolvedValue(mockRoomRowWithRacks);

      await locationRepository.getRoomById('789e4567-e89b-12d3-a456-426614174000');

      expect(mockQueryOne).toHaveBeenCalledWith(
        expect.stringContaining('COUNT(*) FROM racks'),
        expect.any(Array)
      );
    });

    it('should handle room with zero racks', async () => {
      mockQueryOne.mockResolvedValue({
        ...mockRoomRowWithRacks,
        total_racks: '0',
      });

      const result = await locationRepository.getRoomById(
        '789e4567-e89b-12d3-a456-426614174000'
      );

      expect(result).not.toBeNull();
    });
  });


  // ============================================================================
  // Get Rooms By Floor ID Tests (Requirement 3.2)
  // ============================================================================

  describe('getRoomsByFloorId', () => {
    const floorId = '456e4567-e89b-12d3-a456-426614174000';
    const mockRoomRows = [
      {
        room_id: '789e4567-e89b-12d3-a456-426614174001',
        floor_id: floorId,
        room_number: 'R101',
        name: 'Conference Room A',
        room_type: 'CONFERENCE',
        capacity: 20,
        description: 'Main conference room',
        is_active: true,
        created_at: '2024-01-15T10:00:00.000Z',
        updated_at: '2024-01-15T10:00:00.000Z',
        created_by: null,
        updated_by: null,
        total_racks: '0',
      },
      {
        room_id: '789e4567-e89b-12d3-a456-426614174002',
        floor_id: floorId,
        room_number: 'R102',
        name: 'Server Room',
        room_type: 'SERVER_ROOM',
        capacity: 10,
        description: 'Data center',
        is_active: true,
        created_at: '2024-01-15T10:00:00.000Z',
        updated_at: '2024-01-15T10:00:00.000Z',
        created_by: null,
        updated_by: null,
        total_racks: '5',
      },
    ];

    it('should return rooms for a floor ordered by room number', async () => {
      mockQueryMany.mockResolvedValue(mockRoomRows);

      const result = await locationRepository.getRoomsByFloorId(floorId);

      expect(result).toHaveLength(2);
      expect(result[0]!.roomNumber).toBe('R101');
      expect(result[1]!.roomNumber).toBe('R102');
    });

    it('should filter by floor_id', async () => {
      mockQueryMany.mockResolvedValue(mockRoomRows);

      await locationRepository.getRoomsByFloorId(floorId);

      expect(mockQueryMany).toHaveBeenCalledWith(
        expect.stringContaining('WHERE r.floor_id = $1'),
        [floorId]
      );
    });

    it('should order by room_number ascending', async () => {
      mockQueryMany.mockResolvedValue(mockRoomRows);

      await locationRepository.getRoomsByFloorId(floorId);

      expect(mockQueryMany).toHaveBeenCalledWith(
        expect.stringContaining('ORDER BY r.room_number ASC'),
        expect.any(Array)
      );
    });

    it('should return empty array when floor has no rooms', async () => {
      mockQueryMany.mockResolvedValue([]);

      const result = await locationRepository.getRoomsByFloorId(floorId);

      expect(result).toHaveLength(0);
    });
  });


  // ============================================================================
  // Update Room Tests (Requirement 3.3)
  // ============================================================================

  describe('updateRoom', () => {
    const roomId = '789e4567-e89b-12d3-a456-426614174000';

    const mockUpdatedRow = {
      room_id: roomId,
      floor_id: '456e4567-e89b-12d3-a456-426614174000',
      room_number: 'R101',
      name: 'Updated Room Name',
      room_type: 'LAB',
      capacity: 30,
      description: 'Updated description',
      is_active: true,
      created_at: '2024-01-15T10:00:00.000Z',
      updated_at: '2024-01-15T12:00:00.000Z',
      created_by: null,
      updated_by: null,
    };

    it('should update room name', async () => {
      const updateRequest: UpdateRoomRequest = {
        name: 'Updated Room Name',
      };

      mockQueryOne
        .mockResolvedValueOnce(mockUpdatedRow)
        .mockResolvedValueOnce({ count: '3' });

      const result = await locationRepository.updateRoom(roomId, updateRequest);

      expect(result).not.toBeNull();
      expect(result?.name).toBe('Updated Room Name');
      expect(mockQueryOne).toHaveBeenCalledWith(
        expect.stringContaining('UPDATE rooms SET'),
        expect.arrayContaining(['Updated Room Name'])
      );
    });

    it('should update multiple fields at once', async () => {
      const updateRequest: UpdateRoomRequest = {
        name: 'Updated Room Name',
        roomType: 'LAB',
        capacity: 30,
        description: 'Updated description',
      };

      mockQueryOne
        .mockResolvedValueOnce(mockUpdatedRow)
        .mockResolvedValueOnce({ count: '3' });

      const result = await locationRepository.updateRoom(roomId, updateRequest);

      expect(result).not.toBeNull();
      expect(mockQueryOne).toHaveBeenCalledWith(
        expect.stringContaining('UPDATE rooms SET'),
        expect.arrayContaining(['Updated Room Name', 'LAB', 30, 'Updated description'])
      );
    });

    it('should return existing room when no updates provided', async () => {
      const emptyUpdate: UpdateRoomRequest = {};

      mockQueryOne.mockResolvedValue({
        ...mockUpdatedRow,
        total_racks: '3',
      });

      const result = await locationRepository.updateRoom(roomId, emptyUpdate);

      expect(result).not.toBeNull();
      expect(mockQueryOne).toHaveBeenCalledWith(
        expect.stringContaining('SELECT r.*'),
        [roomId]
      );
    });

    it('should return null when room not found', async () => {
      const updateRequest: UpdateRoomRequest = {
        name: 'New Name',
      };

      mockQueryOne.mockResolvedValue(null);

      const result = await locationRepository.updateRoom(roomId, updateRequest);

      expect(result).toBeNull();
    });

    it('should set userId as updated_by when provided', async () => {
      const userId = '999e4567-e89b-12d3-a456-426614174999';
      const updateRequest: UpdateRoomRequest = {
        name: 'Updated Name',
      };

      mockQueryOne
        .mockResolvedValueOnce(mockUpdatedRow)
        .mockResolvedValueOnce({ count: '0' });

      await locationRepository.updateRoom(roomId, updateRequest, userId);

      expect(mockQueryOne).toHaveBeenCalledWith(
        expect.stringContaining('UPDATE rooms SET'),
        expect.arrayContaining([userId])
      );
    });

    it('should update isActive status', async () => {
      const updateRequest: UpdateRoomRequest = {
        isActive: false,
      };

      mockQueryOne
        .mockResolvedValueOnce({ ...mockUpdatedRow, is_active: false })
        .mockResolvedValueOnce({ count: '0' });

      const result = await locationRepository.updateRoom(roomId, updateRequest);

      expect(result?.isActive).toBe(false);
    });
  });


  // ============================================================================
  // Deactivate Room Tests (Requirement 3.4)
  // ============================================================================

  describe('deactivateRoom', () => {
    const roomId = '789e4567-e89b-12d3-a456-426614174000';

    it('should deactivate a room', async () => {
      const mockDeactivatedRow = {
        room_id: roomId,
        floor_id: '456e4567-e89b-12d3-a456-426614174000',
        room_number: 'R101',
        name: 'Conference Room',
        room_type: 'CONFERENCE',
        capacity: 20,
        description: null,
        is_active: false,
        created_at: '2024-01-15T10:00:00.000Z',
        updated_at: '2024-01-15T12:00:00.000Z',
        created_by: null,
        updated_by: null,
      };

      mockQueryOne
        .mockResolvedValueOnce(mockDeactivatedRow)
        .mockResolvedValueOnce({ count: '0' });

      const result = await locationRepository.deactivateRoom(roomId);

      expect(result).not.toBeNull();
      expect(result?.isActive).toBe(false);
    });

    it('should pass userId to updateRoom', async () => {
      const userId = '999e4567-e89b-12d3-a456-426614174999';

      mockQueryOne
        .mockResolvedValueOnce({
          room_id: roomId,
          floor_id: '456e4567-e89b-12d3-a456-426614174000',
          room_number: 'R101',
          name: 'Test',
          room_type: 'OFFICE',
          capacity: null,
          description: null,
          is_active: false,
          created_at: '2024-01-15T10:00:00.000Z',
          updated_at: '2024-01-15T12:00:00.000Z',
          created_by: null,
          updated_by: userId,
        })
        .mockResolvedValueOnce({ count: '0' });

      await locationRepository.deactivateRoom(roomId, userId);

      expect(mockQueryOne).toHaveBeenCalledWith(
        expect.stringContaining('UPDATE rooms SET'),
        expect.arrayContaining([userId])
      );
    });

    it('should return null when room not found', async () => {
      mockQueryOne.mockResolvedValue(null);

      const result = await locationRepository.deactivateRoom('nonexistent-id');

      expect(result).toBeNull();
    });
  });


  // ============================================================================
  // Get Room Dependencies Tests
  // ============================================================================

  describe('getRoomDependencies', () => {
    const roomId = '789e4567-e89b-12d3-a456-426614174000';

    it('should return rack and asset counts', async () => {
      mockQueryOne
        .mockResolvedValueOnce({ count: '5' })  // rack count
        .mockResolvedValueOnce({ count: '25' }); // asset count

      const result = await locationRepository.getRoomDependencies(roomId);

      expect(result.rackCount).toBe(5);
      expect(result.assetCount).toBe(25);
    });

    it('should return zero counts when no dependencies', async () => {
      mockQueryOne
        .mockResolvedValueOnce({ count: '0' })
        .mockResolvedValueOnce({ count: '0' });

      const result = await locationRepository.getRoomDependencies(roomId);

      expect(result.rackCount).toBe(0);
      expect(result.assetCount).toBe(0);
    });

    it('should handle null query results', async () => {
      mockQueryOne
        .mockResolvedValueOnce(null)
        .mockResolvedValueOnce(null);

      const result = await locationRepository.getRoomDependencies(roomId);

      expect(result.rackCount).toBe(0);
      expect(result.assetCount).toBe(0);
    });

    it('should query racks table for rack count', async () => {
      mockQueryOne
        .mockResolvedValueOnce({ count: '3' })
        .mockResolvedValueOnce({ count: '0' });

      await locationRepository.getRoomDependencies(roomId);

      expect(mockQueryOne).toHaveBeenCalledWith(
        expect.stringContaining('FROM racks WHERE room_id'),
        [roomId]
      );
    });

    it('should query hardware_assets for asset count', async () => {
      mockQueryOne
        .mockResolvedValueOnce({ count: '0' })
        .mockResolvedValueOnce({ count: '10' });

      await locationRepository.getRoomDependencies(roomId);

      expect(mockQueryOne).toHaveBeenCalledWith(
        expect.stringContaining('hardware_assets'),
        [roomId]
      );
    });
  });


  // ============================================================================
  // Delete Room Tests
  // ============================================================================

  describe('deleteRoom', () => {
    const roomId = '789e4567-e89b-12d3-a456-426614174000';

    it('should delete room and return true', async () => {
      mockQuery.mockResolvedValue({
        rows: [],
        rowCount: 1,
        command: 'DELETE',
        oid: 0,
        fields: [],
      });

      const result = await locationRepository.deleteRoom(roomId);

      expect(result).toBe(true);
      expect(mockQuery).toHaveBeenCalledWith(
        expect.stringContaining('DELETE FROM rooms WHERE room_id'),
        [roomId]
      );
    });

    it('should return false when room not found', async () => {
      mockQuery.mockResolvedValue({
        rows: [],
        rowCount: 0,
        command: 'DELETE',
        oid: 0,
        fields: [],
      });

      const result = await locationRepository.deleteRoom('nonexistent-id');

      expect(result).toBe(false);
    });

    it('should return false when rowCount is null', async () => {
      mockQuery.mockResolvedValue({
        rows: [],
        rowCount: null,
        command: 'DELETE',
        oid: 0,
        fields: [],
      });

      const result = await locationRepository.deleteRoom(roomId);

      expect(result).toBe(false);
    });
  });


  // ============================================================================
  // List Rooms Tests
  // ============================================================================

  describe('listRooms', () => {
    const floorId = '456e4567-e89b-12d3-a456-426614174000';
    const mockRoomRows = [
      {
        room_id: '789e4567-e89b-12d3-a456-426614174001',
        floor_id: floorId,
        room_number: 'R101',
        name: 'Conference Room A',
        room_type: 'CONFERENCE',
        capacity: 20,
        description: 'Main conference room',
        is_active: true,
        created_at: '2024-01-15T10:00:00.000Z',
        updated_at: '2024-01-15T10:00:00.000Z',
        created_by: null,
        updated_by: null,
        total_racks: '0',
      },
      {
        room_id: '789e4567-e89b-12d3-a456-426614174002',
        floor_id: floorId,
        room_number: 'R102',
        name: 'Server Room',
        room_type: 'SERVER_ROOM',
        capacity: 10,
        description: 'Data center',
        is_active: true,
        created_at: '2024-01-15T10:00:00.000Z',
        updated_at: '2024-01-15T10:00:00.000Z',
        created_by: null,
        updated_by: null,
        total_racks: '5',
      },
    ];

    it('should return paginated list of rooms', async () => {
      mockQueryOne.mockResolvedValue({ count: '2' });
      mockQueryMany.mockResolvedValue(mockRoomRows);

      const result = await locationRepository.listRooms();

      expect(result.items).toHaveLength(2);
      expect(result.total).toBe(2);
      expect(result.page).toBe(1);
      expect(result.limit).toBe(20);
      expect(result.hasMore).toBe(false);
    });

    it('should apply pagination parameters', async () => {
      mockQueryOne.mockResolvedValue({ count: '50' });
      mockQueryMany.mockResolvedValue(mockRoomRows);

      const result = await locationRepository.listRooms({}, { page: 2, limit: 10 });

      expect(result.page).toBe(2);
      expect(result.limit).toBe(10);
      expect(result.hasMore).toBe(true);
      expect(mockQueryMany).toHaveBeenCalledWith(
        expect.stringContaining('LIMIT'),
        expect.arrayContaining([10, 10]) // limit and offset
      );
    });

    it('should filter by floorId', async () => {
      mockQueryOne.mockResolvedValue({ count: '2' });
      mockQueryMany.mockResolvedValue(mockRoomRows);

      await locationRepository.listRooms({ floorId });

      expect(mockQueryOne).toHaveBeenCalledWith(
        expect.stringContaining('floor_id'),
        expect.arrayContaining([floorId])
      );
    });

    it('should filter by roomType', async () => {
      mockQueryOne.mockResolvedValue({ count: '1' });
      mockQueryMany.mockResolvedValue([mockRoomRows[0]!]);

      await locationRepository.listRooms({ roomType: 'CONFERENCE' });

      expect(mockQueryOne).toHaveBeenCalledWith(
        expect.stringContaining('room_type'),
        expect.arrayContaining(['CONFERENCE'])
      );
    });

    it('should filter by isActive status', async () => {
      mockQueryOne.mockResolvedValue({ count: '1' });
      mockQueryMany.mockResolvedValue([mockRoomRows[0]!]);

      await locationRepository.listRooms({ isActive: true });

      expect(mockQueryOne).toHaveBeenCalledWith(
        expect.stringContaining('is_active'),
        expect.arrayContaining([true])
      );
    });

    it('should combine multiple filters', async () => {
      mockQueryOne.mockResolvedValue({ count: '1' });
      mockQueryMany.mockResolvedValue([mockRoomRows[0]!]);

      await locationRepository.listRooms({
        floorId,
        roomType: 'CONFERENCE',
        isActive: true,
      });

      expect(mockQueryOne).toHaveBeenCalledWith(
        expect.stringContaining('AND'),
        expect.arrayContaining([floorId, 'CONFERENCE', true])
      );
    });

    it('should return empty list when no rooms match', async () => {
      mockQueryOne.mockResolvedValue({ count: '0' });
      mockQueryMany.mockResolvedValue([]);

      const result = await locationRepository.listRooms({ floorId: 'nonexistent' });

      expect(result.items).toHaveLength(0);
      expect(result.total).toBe(0);
      expect(result.hasMore).toBe(false);
    });

    it('should order results by room_number ascending', async () => {
      mockQueryOne.mockResolvedValue({ count: '2' });
      mockQueryMany.mockResolvedValue(mockRoomRows);

      await locationRepository.listRooms();

      expect(mockQueryMany).toHaveBeenCalledWith(
        expect.stringContaining('ORDER BY r.room_number ASC'),
        expect.any(Array)
      );
    });

    it('should handle null count result', async () => {
      mockQueryOne.mockResolvedValue(null);
      mockQueryMany.mockResolvedValue([]);

      const result = await locationRepository.listRooms();

      expect(result.total).toBe(0);
    });
  });


  // ============================================================================
  // Get Active Rooms By Floor ID Tests
  // ============================================================================

  describe('getActiveRoomsByFloorId', () => {
    const floorId = '456e4567-e89b-12d3-a456-426614174000';
    const mockActiveRoomRows = [
      {
        room_id: '789e4567-e89b-12d3-a456-426614174001',
        floor_id: floorId,
        room_number: 'R101',
        name: 'Conference Room A',
        room_type: 'CONFERENCE',
        capacity: 20,
        description: 'Main conference room',
        is_active: true,
        created_at: '2024-01-15T10:00:00.000Z',
        updated_at: '2024-01-15T10:00:00.000Z',
        created_by: null,
        updated_by: null,
        total_racks: '0',
      },
      {
        room_id: '789e4567-e89b-12d3-a456-426614174002',
        floor_id: floorId,
        room_number: 'R102',
        name: 'Server Room',
        room_type: 'SERVER_ROOM',
        capacity: 10,
        description: 'Data center',
        is_active: true,
        created_at: '2024-01-15T10:00:00.000Z',
        updated_at: '2024-01-15T10:00:00.000Z',
        created_by: null,
        updated_by: null,
        total_racks: '5',
      },
    ];

    it('should return all active rooms for a floor', async () => {
      mockQueryMany.mockResolvedValue(mockActiveRoomRows);

      const result = await locationRepository.getActiveRoomsByFloorId(floorId);

      expect(result).toHaveLength(2);
      expect(result[0]!.isActive).toBe(true);
      expect(result[1]!.isActive).toBe(true);
    });

    it('should filter by floor_id and is_active = TRUE', async () => {
      mockQueryMany.mockResolvedValue(mockActiveRoomRows);

      await locationRepository.getActiveRoomsByFloorId(floorId);

      expect(mockQueryMany).toHaveBeenCalledWith(
        expect.stringContaining('WHERE r.floor_id = $1 AND r.is_active = TRUE'),
        [floorId]
      );
    });

    it('should order by room_number ascending', async () => {
      mockQueryMany.mockResolvedValue(mockActiveRoomRows);

      await locationRepository.getActiveRoomsByFloorId(floorId);

      expect(mockQueryMany).toHaveBeenCalledWith(
        expect.stringContaining('ORDER BY r.room_number ASC'),
        expect.any(Array)
      );
    });

    it('should return empty array when no active rooms', async () => {
      mockQueryMany.mockResolvedValue([]);

      const result = await locationRepository.getActiveRoomsByFloorId(floorId);

      expect(result).toHaveLength(0);
    });
  });
});
