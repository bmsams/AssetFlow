/**
 * Reference Data module exports
 *
 * Provides reference data management operations including:
 * - Department management (Requirement 7): Hierarchical department structure
 * - Cost Center management (Requirement 8): Budget tracking and allocation
 * - Vendor management (Requirement 9): Supplier information and ratings
 * - Manufacturer management (Requirement 10): Hardware manufacturer records
 * - Model Catalog management (Requirement 11): Hardware model configurations
 */

// Re-export types from @ams/types for convenience
export type {
  // Department types
  Department,
  DepartmentDetails,
  CreateDepartmentRequest,
  UpdateDepartmentRequest,
  DepartmentListFilters,
  // Cost Center types
  CostCenterDetails,
  CreateCostCenterRequest,
  UpdateCostCenterRequest,
  CostCenterListFilters,
  // Vendor types
  VendorDetails,
  VendorType,
  VendorRating,
  CreateVendorRequest,
  UpdateVendorRequest,
  VendorListFilters,
  // Manufacturer types
  ManufacturerDetails,
  CreateManufacturerRequest,
  UpdateManufacturerRequest,
  ManufacturerListFilters,
  // Model types
  ModelDetails,
  ModelStatus,
  CreateModelRequest,
  UpdateModelRequest,
  ModelListFilters,
} from '@ams/types';

// ============================================================================
// Department exports - namespaced to avoid conflicts
// ============================================================================

// Repository functions (data access layer)
import * as departmentRepository from './department-repository';
export { departmentRepository };

// Service functions (business logic layer) - these are the primary exports
export {
  // Service functions
  createDepartment,
  getDepartment,
  getDepartmentOrThrow,
  getDepartmentByCode,
  getDepartmentsByParent,
  getAllDepartments,
  getActiveDepartments,
  updateDepartment,
  deactivateDepartment,
  deleteDepartment,
  isDepartmentCodeUnique,
  getDepartmentHierarchy,
  listDepartments,
  getRootDepartments,
  getDepartmentSubtree,
  canSetParent,
  reactivateDepartment,
  // Error types
  DepartmentNotFoundError,
  DepartmentCodeExistsError,
  DepartmentHasDependenciesError,
  ParentDepartmentNotFoundError,
  CircularReferenceError,
} from './department-service';

// ============================================================================
// Cost Center exports - namespaced to avoid conflicts
// ============================================================================

// Repository functions (data access layer)
import * as costCenterRepository from './cost-center-repository';
export { costCenterRepository };

// Service functions (business logic layer) - these are the primary exports
export {
  // Service functions
  createCostCenter,
  getCostCenterById,
  getCostCenterOrThrow,
  getCostCenterByCode,
  updateCostCenter,
  deactivateCostCenter,
  deleteCostCenter,
  listCostCenters,
  recordExpense,
  getCostCenterUtilization,
  getCostCentersByDepartment,
  getAllCostCenters,
  getActiveCostCenters,
  getCostCentersByFiscalYear,
  isCostCenterCodeUnique,
  reactivateCostCenter,
  getCostCenterBudgetSummary,
  // Error types
  CostCenterNotFoundError,
  CostCenterCodeExistsError,
  CostCenterHasDependenciesError,
  BudgetExceededError,
  CostCenterInactiveError,
} from './cost-center-service';

// ============================================================================
// Vendor exports
// ============================================================================

// Repository functions (data access layer)
import * as vendorRepository from './vendor-repository';
export { vendorRepository };

// Service functions (business logic layer) - these are the primary exports
export {
  // Service functions
  createVendor,
  getVendorById,
  getVendorOrThrow,
  getVendorByCode,
  updateVendor,
  deactivateVendor,
  deleteVendor,
  listVendors,
  searchVendors,
  updateVendorRating,
  getVendorsByType,
  getVendorsByRating,
  getVendorsForPurchasing,
  getAllVendors,
  getActiveVendors,
  getPreferredVendors,
  getApprovedVendors,
  isVendorCodeUnique,
  reactivateVendor,
  canReceivePurchaseOrders,
  getVendorSummary,
  // Error types
  VendorNotFoundError,
  VendorCodeExistsError,
  VendorHasDependenciesError,
} from './vendor-service';

// ============================================================================
// Manufacturer exports
// ============================================================================

// Repository functions (data access layer)
import * as manufacturerRepository from './manufacturer-repository';
export { manufacturerRepository };

// Service functions (business logic layer) - these are the primary exports
export {
  // Service functions
  createManufacturer,
  getManufacturerById,
  getManufacturerOrThrow,
  getManufacturerByCode,
  updateManufacturer,
  deactivateManufacturer,
  deleteManufacturer,
  listManufacturers,
  searchManufacturers,
  getAllManufacturers,
  getActiveManufacturers,
  getManufacturersWithModels,
  isManufacturerNameUnique,
  reactivateManufacturer,
  getManufacturerSummary,
  // Error types
  ManufacturerNotFoundError,
  ManufacturerCodeExistsError,
  ManufacturerNameExistsError,
  ManufacturerHasDependenciesError,
} from './manufacturer-service';

// ============================================================================
// Model exports
// ============================================================================

// Repository functions (data access layer)
import * as modelRepository from './model-repository';
export { modelRepository };

// Service functions (business logic layer) - these are the primary exports
export {
  // Service functions
  createModel,
  getModelById,
  getModelOrThrow,
  getModelBySku,
  updateModel,
  updateModelStatus,
  deprecateModel,
  markModelEndOfLife,
  reinstateModel,
  deactivateModel,
  deleteModel,
  listModels,
  searchModels,
  getAllModels,
  getActiveModels,
  getModelsByManufacturer,
  getModelsByStatus,
  getModelsByCategory,
  getModelsForAssetCreation,
  isModelSkuUnique,
  validateModelForAssetCreation,
  reactivateModel,
  getModelSummary,
  // Status transition helpers
  isValidStatusTransition,
  getValidNextStatuses,
  // Error types
  ModelNotFoundError,
  ModelSkuExistsError,
  ModelNameExistsError,
  // Note: ManufacturerNotFoundError is already exported from manufacturer-service
  ModelHasDependenciesError,
  InvalidStatusTransitionError,
  ModelEndOfLifeError,
} from './model-service';
