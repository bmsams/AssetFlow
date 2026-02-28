/**
 * Admin Service Handlers
 *
 * Lambda handlers for administrative operations
 */

// Building handlers
export {
  handler,
  createBuildingHandler,
  getBuildingHandler,
  updateBuildingHandler,
  deactivateBuildingHandler,
  listBuildingsHandler,
  checkBuildingCodeHandler,
  getActiveBuildingsHandler,
} from './building-handlers';

// Floor handlers
export {
  createFloorHandler,
  getFloorHandler,
  updateFloorHandler,
  deactivateFloorHandler,
  listFloorsHandler,
  getFloorsByBuildingHandler,
  checkFloorNumberHandler,
  getActiveFloorsHandler,
} from './floor-handlers';

// Room handlers
export {
  createRoomHandler,
  getRoomHandler,
  updateRoomHandler,
  deactivateRoomHandler,
  listRoomsHandler,
  getRoomsByFloorHandler,
  checkRoomNumberHandler,
  getActiveRoomsHandler,
} from './room-handlers';

// Rack handlers
export {
  createRackHandler,
  getRackHandler,
  updateRackHandler,
  deactivateRackHandler,
  listRacksHandler,
  getRacksByRoomHandler,
  checkRackNameHandler,
  getActiveRacksHandler,
  updateRackUsedUnitsHandler,
} from './rack-handlers';

// Department handlers
export {
  createDepartmentHandler,
  getDepartmentHandler,
  getDepartmentsByParentHandler,
  updateDepartmentHandler,
  deactivateDepartmentHandler,
  deleteDepartmentHandler,
  listDepartmentsHandler,
  checkDepartmentCodeHandler,
  getDepartmentHierarchyHandler,
  getRootDepartmentsHandler,
  getActiveDepartmentsHandler,
} from './department-handlers';

// Cost Center handlers
export {
  createCostCenterHandler,
  getCostCenterHandler,
  updateCostCenterHandler,
  deleteCostCenterHandler,
  listCostCentersHandler,
  recordExpenseHandler,
  getCostCenterUtilizationHandler,
  getCostCentersByDepartmentHandler,
} from './cost-center-handlers';

// Vendor handlers
export {
  createVendorHandler,
  getVendorHandler,
  updateVendorHandler,
  deleteVendorHandler,
  listVendorsHandler,
  searchVendorsHandler,
  updateVendorRatingHandler,
  getVendorsByTypeHandler,
  getVendorsByRatingHandler,
  getVendorsForPurchasingHandler,
} from './vendor-handlers';

// Manufacturer handlers
export {
  createManufacturerHandler,
  getManufacturerHandler,
  updateManufacturerHandler,
  deleteManufacturerHandler,
  listManufacturersHandler,
  searchManufacturersHandler,
  getActiveManufacturersHandler,
  getManufacturersWithModelsHandler,
} from './manufacturer-handlers';

// Model handlers
export {
  createModelHandler,
  getModelHandler,
  updateModelHandler,
  deleteModelHandler,
  listModelsHandler,
  searchModelsHandler,
  updateModelStatusHandler,
  deprecateModelHandler,
  markModelEndOfLifeHandler,
  getActiveModelsHandler,
  getModelsByManufacturerHandler,
  getModelsForAssetCreationHandler,
} from './model-handlers';

// User Admin handlers
export {
  listUsersHandler,
  getUserHandler,
  updateUserHandler,
  deactivateUserHandler,
  reactivateUserHandler,
  getUserRolesHandler,
  assignRoleHandler,
  removeRoleHandler,
  getAllRolesHandler,
  searchUsersHandler,
} from './user-admin-handlers';

// Stockroom handlers
export {
  handler as stockroomHandler,
  createStockroomHandler,
  getStockroomHandler,
  updateStockroomHandler,
  deactivateStockroomHandler,
  listStockroomsHandler,
  getActiveStockroomsHandler,
} from './stockroom-handlers';

// Bin Location handlers
export {
  handler as binLocationHandler,
  createBinLocationHandler,
  getBinLocationHandler,
  updateBinLocationHandler,
  deactivateBinLocationHandler,
  listBinLocationsHandler,
  getBinLocationsByStockroomHandler,
} from './bin-location-handlers';