/**
 * Location hierarchy types for the Asset Management System
 *
 * This module defines types for managing physical locations:
 * Buildings → Floors → Rooms → Racks
 */

import type { UUID, ISODateString } from './common';

// ============================================================================
// Room Type
// ============================================================================

/**
 * Types of rooms that can exist within a floor
 */
export type RoomType =
  | 'OFFICE'
  | 'SERVER_ROOM'
  | 'STORAGE'
  | 'CONFERENCE'
  | 'LAB'
  | 'UTILITY'
  | 'OTHER';

// ============================================================================
// Building Interfaces
// ============================================================================

/**
 * Building entity representing a physical structure
 */
export interface Building {
  readonly buildingId: UUID;
  readonly buildingCode: string;
  readonly name: string;
  readonly addressLine1: string | null;
  readonly addressLine2: string | null;
  readonly city: string | null;
  readonly stateProvince: string | null;
  readonly postalCode: string | null;
  readonly country: string;
  readonly contactName: string | null;
  readonly contactEmail: string | null;
  readonly contactPhone: string | null;
  readonly totalFloors: number;
  readonly isActive: boolean;
  readonly createdAt: ISODateString;
  readonly updatedAt: ISODateString;
}

/**
 * Request payload for creating a new building
 */
export interface CreateBuildingRequest {
  readonly buildingCode: string;
  readonly name: string;
  readonly addressLine1?: string;
  readonly addressLine2?: string;
  readonly city?: string;
  readonly stateProvince?: string;
  readonly postalCode?: string;
  readonly country?: string;
  readonly contactName?: string;
  readonly contactEmail?: string;
  readonly contactPhone?: string;
}

/**
 * Request payload for updating an existing building
 */
export interface UpdateBuildingRequest {
  readonly name?: string;
  readonly addressLine1?: string;
  readonly addressLine2?: string;
  readonly city?: string;
  readonly stateProvince?: string;
  readonly postalCode?: string;
  readonly country?: string;
  readonly contactName?: string;
  readonly contactEmail?: string;
  readonly contactPhone?: string;
  readonly isActive?: boolean;
}

/**
 * Filters for listing buildings
 */
export interface BuildingListFilters {
  readonly isActive?: boolean;
  readonly city?: string;
  readonly stateProvince?: string;
  readonly country?: string;
  readonly search?: string;
}

// ============================================================================
// Floor Interfaces
// ============================================================================

/**
 * Floor entity representing a level within a building
 */
export interface Floor {
  readonly floorId: UUID;
  readonly buildingId: UUID;
  readonly floorNumber: number;
  readonly name: string;
  readonly description: string | null;
  readonly totalRooms: number;
  readonly isActive: boolean;
  readonly createdAt: ISODateString;
  readonly updatedAt: ISODateString;
}

/**
 * Request payload for creating a new floor
 */
export interface CreateFloorRequest {
  readonly buildingId: UUID;
  readonly floorNumber: number;
  readonly name: string;
  readonly description?: string;
}

/**
 * Request payload for updating an existing floor
 */
export interface UpdateFloorRequest {
  readonly name?: string;
  readonly description?: string;
  readonly isActive?: boolean;
}

/**
 * Filters for listing floors
 */
export interface FloorListFilters {
  readonly buildingId?: UUID;
  readonly isActive?: boolean;
}

// ============================================================================
// Room Interfaces
// ============================================================================

/**
 * Room entity representing a space within a floor
 */
export interface Room {
  readonly roomId: UUID;
  readonly floorId: UUID;
  readonly roomNumber: string;
  readonly name: string;
  readonly roomType: RoomType;
  readonly capacity: number | null;
  readonly description: string | null;
  readonly isActive: boolean;
  readonly createdAt: ISODateString;
  readonly updatedAt: ISODateString;
}

/**
 * Request payload for creating a new room
 */
export interface CreateRoomRequest {
  readonly floorId: UUID;
  readonly roomNumber: string;
  readonly name: string;
  readonly roomType: RoomType;
  readonly capacity?: number;
  readonly description?: string;
}

/**
 * Request payload for updating an existing room
 */
export interface UpdateRoomRequest {
  readonly name?: string;
  readonly roomType?: RoomType;
  readonly capacity?: number;
  readonly description?: string;
  readonly isActive?: boolean;
}

/**
 * Filters for listing rooms
 */
export interface RoomListFilters {
  readonly floorId?: UUID;
  readonly roomType?: RoomType;
  readonly isActive?: boolean;
}

// ============================================================================
// Rack Interfaces
// ============================================================================

/**
 * Rack entity representing a server rack within a room
 */
export interface Rack {
  readonly rackId: UUID;
  readonly roomId: UUID;
  readonly rackName: string;
  readonly totalUnits: number;
  readonly usedUnits: number;
  readonly availableUnits: number;
  readonly description: string | null;
  readonly isActive: boolean;
  readonly createdAt: ISODateString;
  readonly updatedAt: ISODateString;
}

/**
 * Request payload for creating a new rack
 */
export interface CreateRackRequest {
  readonly roomId: UUID;
  readonly rackName: string;
  readonly totalUnits: number;
  readonly description?: string;
}

/**
 * Request payload for updating an existing rack
 */
export interface UpdateRackRequest {
  readonly rackName?: string;
  readonly totalUnits?: number;
  readonly description?: string;
  readonly isActive?: boolean;
}

/**
 * Filters for listing racks
 */
export interface RackListFilters {
  readonly roomId?: UUID;
  readonly isActive?: boolean;
  readonly hasAvailableUnits?: boolean;
}

// ============================================================================
// Bin Location Interfaces (for Stockroom)
// ============================================================================

/**
 * Bin location entity representing a storage location within a stockroom
 */
export interface BinLocation {
  readonly binId: UUID;
  readonly stockroomId: UUID;
  readonly binCode: string;
  readonly shelfLocation: string | null;
  readonly capacity: number | null;
  readonly currentCount: number;
  readonly isActive: boolean;
  readonly createdAt: ISODateString;
  readonly updatedAt: ISODateString;
}

/**
 * Request payload for creating a new bin location
 */
export interface CreateBinLocationRequest {
  readonly stockroomId: UUID;
  readonly binCode: string;
  readonly shelfLocation?: string;
  readonly capacity?: number;
}

/**
 * Request payload for updating an existing bin location
 */
export interface UpdateBinLocationRequest {
  readonly binCode?: string;
  readonly shelfLocation?: string;
  readonly capacity?: number;
  readonly isActive?: boolean;
}

/**
 * Filters for listing bin locations
 */
export interface BinLocationListFilters {
  readonly stockroomId?: UUID;
  readonly isActive?: boolean;
  readonly hasCapacity?: boolean;
}
