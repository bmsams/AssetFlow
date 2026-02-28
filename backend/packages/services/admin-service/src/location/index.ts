/**
 * Location module exports
 *
 * Provides location hierarchy operations including:
 * - Building management (Requirement 1): Create, read, update, deactivate buildings
 * - Floor management (Requirement 2): Create, read, update, deactivate floors within buildings
 * - Room management (Requirement 3): Create, read, update, deactivate rooms within floors
 * - Rack management (Requirement 4): Create, read, update, deactivate server racks within rooms
 */

// Re-export types from @ams/types for convenience
export type {
  // Building types
  Building,
  CreateBuildingRequest,
  UpdateBuildingRequest,
  BuildingListFilters,
  // Floor types
  Floor,
  CreateFloorRequest,
  UpdateFloorRequest,
  FloorListFilters,
  // Room types
  Room,
  RoomType,
  CreateRoomRequest,
  UpdateRoomRequest,
  RoomListFilters,
  // Rack types
  Rack,
  CreateRackRequest,
  UpdateRackRequest,
  RackListFilters,
} from '@ams/types';

// Repository exports - Building, Floor, and Room CRUD operations
export {
  // Building repository functions
  buildingCodeExists,
  createBuilding,
  getBuildingById,
  getBuildingByCode,
  updateBuilding,
  deactivateBuilding,
  getBuildingDependencies,
  deleteBuilding,
  listBuildings,
  getActiveBuildings,
  // Floor repository functions
  floorNumberExistsInBuilding,
  buildingExists,
  createFloor,
  getFloorById,
  getFloorsByBuildingId,
  updateFloor,
  deactivateFloor,
  getFloorDependencies,
  deleteFloor,
  listFloors,
  getActiveFloorsByBuildingId,
  // Room repository functions
  roomNumberExistsInFloor,
  floorExists,
  createRoom,
  getRoomById,
  getRoomsByFloorId,
  updateRoom,
  deactivateRoom,
  getRoomDependencies,
  deleteRoom,
  listRooms,
  getActiveRoomsByFloorId,
  // Rack repository functions
  rackNameExistsInRoom,
  roomExists,
  createRack,
  getRackById,
  getRacksByRoomId,
  updateRack,
  deactivateRack,
  getRackDependencies,
  deleteRack,
  listRacks,
  getActiveRacksByRoomId,
  updateRackUsedUnits,
} from './location-repository';

// Building service exports
export {
  BuildingNotFoundError,
  BuildingCodeExistsError,
  BuildingHasDependenciesError,
  createBuilding as createBuildingService,
  getBuilding,
  getBuildingOrThrow,
  updateBuilding as updateBuildingService,
  deactivateBuilding as deactivateBuildingService,
  deleteBuilding as deleteBuildingService,
  listBuildings as listBuildingsService,
  isBuildingCodeUnique,
  getActiveBuildings as getActiveBuildingsService,
} from './building-service';

// Floor service exports
export {
  FloorNotFoundError,
  FloorNumberExistsError,
  FloorHasDependenciesError,
  BuildingNotFoundError as FloorBuildingNotFoundError,
  createFloor as createFloorService,
  getFloor,
  getFloorOrThrow,
  getFloorsByBuilding,
  updateFloor as updateFloorService,
  deactivateFloor as deactivateFloorService,
  deleteFloor as deleteFloorService,
  listFloors as listFloorsService,
  getActiveFloorsByBuilding,
  isFloorNumberUnique,
} from './floor-service';

// Room service exports
export {
  RoomNotFoundError,
  RoomNumberExistsError,
  RoomHasDependenciesError,
  FloorNotFoundError as RoomFloorNotFoundError,
  createRoom as createRoomService,
  getRoom,
  getRoomOrThrow,
  getRoomsByFloor,
  updateRoom as updateRoomService,
  deactivateRoom as deactivateRoomService,
  deleteRoom as deleteRoomService,
  listRooms as listRoomsService,
  getActiveRoomsByFloor,
  isRoomNumberUnique,
} from './room-service';

// Rack service exports
export {
  RackNotFoundError,
  RackNameExistsError,
  RackHasDependenciesError,
  RoomNotFoundError as RackRoomNotFoundError,
  InsufficientRackUnitsError,
  createRack as createRackService,
  getRack,
  getRackOrThrow,
  getRacksByRoom,
  updateRack as updateRackService,
  deactivateRack as deactivateRackService,
  deleteRack as deleteRackService,
  listRacks as listRacksService,
  getActiveRacksByRoom,
  isRackNameUnique,
  updateUsedUnits,
} from './rack-service';
