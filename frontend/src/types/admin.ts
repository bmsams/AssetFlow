/**
 * Admin types for the Asset Management System
 * Implements Task 16: Frontend - Admin Pages
 */

// ============================================================================
// Location Hierarchy Types
// ============================================================================

/**
 * Building entity
 */
export interface Building {
  buildingId: string;
  buildingCode: string;
  name: string;
  addressLine1: string | null;
  addressLine2: string | null;
  city: string | null;
  stateProvince: string | null;
  postalCode: string | null;
  country: string;
  contactName: string | null;
  contactEmail: string | null;
  contactPhone: string | null;
  totalFloors: number;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

/**
 * Create building request
 */
export interface CreateBuildingRequest {
  buildingCode: string;
  name: string;
  addressLine1?: string;
  addressLine2?: string;
  city?: string;
  stateProvince?: string;
  postalCode?: string;
  country?: string;
  contactName?: string;
  contactEmail?: string;
  contactPhone?: string;
}

/**
 * Update building request
 */
export interface UpdateBuildingRequest {
  name?: string;
  addressLine1?: string;
  addressLine2?: string;
  city?: string;
  stateProvince?: string;
  postalCode?: string;
  country?: string;
  contactName?: string;
  contactEmail?: string;
  contactPhone?: string;
  isActive?: boolean;
}

/**
 * Floor entity
 */
export interface Floor {
  floorId: string;
  buildingId: string;
  floorNumber: number;
  name: string;
  description: string | null;
  totalRooms: number;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

/**
 * Create floor request
 */
export interface CreateFloorRequest {
  buildingId: string;
  floorNumber: number;
  name: string;
  description?: string;
}

/**
 * Update floor request
 */
export interface UpdateFloorRequest {
  name?: string;
  description?: string;
  isActive?: boolean;
}

/**
 * Room type
 */
export type RoomType = 'OFFICE' | 'SERVER_ROOM' | 'STORAGE' | 'CONFERENCE' | 'LAB' | 'UTILITY' | 'OTHER';

/**
 * Room entity
 */
export interface Room {
  roomId: string;
  floorId: string;
  roomNumber: string;
  name: string;
  roomType: RoomType;
  capacity: number | null;
  description: string | null;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

/**
 * Create room request
 */
export interface CreateRoomRequest {
  floorId: string;
  roomNumber: string;
  name: string;
  roomType: RoomType;
  capacity?: number;
  description?: string;
}

/**
 * Update room request
 */
export interface UpdateRoomRequest {
  name?: string;
  roomType?: RoomType;
  capacity?: number;
  description?: string;
  isActive?: boolean;
}

/**
 * Rack entity
 */
export interface Rack {
  rackId: string;
  roomId: string;
  rackName: string;
  totalUnits: number;
  usedUnits: number;
  availableUnits: number;
  description: string | null;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

/**
 * Create rack request
 */
export interface CreateRackRequest {
  roomId: string;
  rackName: string;
  totalUnits: number;
  description?: string;
}

/**
 * Update rack request
 */
export interface UpdateRackRequest {
  rackName?: string;
  totalUnits?: number;
  description?: string;
  isActive?: boolean;
}

// ============================================================================
// Reference Data Types
// ============================================================================

/**
 * Department entity
 */
export interface Department {
  departmentId: string;
  code: string;
  name: string;
  parentDepartmentId: string | null;
  parentDepartmentName?: string | null;
  isActive: boolean;
  childDepartments?: Department[];
  createdAt: string;
  updatedAt: string;
}

/**
 * Create department request
 */
export interface CreateDepartmentRequest {
  code: string;
  name: string;
  parentDepartmentId?: string;
}

/**
 * Update department request
 */
export interface UpdateDepartmentRequest {
  name?: string;
  parentDepartmentId?: string;
  isActive?: boolean;
}

/**
 * Cost center entity
 */
export interface CostCenter {
  costCenterId: string;
  code: string;
  name: string;
  departmentId: string | null;
  departmentName?: string | null;
  budgetAmount: number;
  spentAmount: number;
  availableAmount: number;
  fiscalYear: number;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

/**
 * Create cost center request
 */
export interface CreateCostCenterRequest {
  code: string;
  name: string;
  departmentId?: string;
  budgetAmount: number;
  fiscalYear: number;
}

/**
 * Update cost center request
 */
export interface UpdateCostCenterRequest {
  name?: string;
  departmentId?: string;
  budgetAmount?: number;
  isActive?: boolean;
}

/**
 * Vendor type
 */
export type VendorType = 'MANUFACTURER' | 'RESELLER' | 'DISTRIBUTOR' | 'SERVICE_PROVIDER' | 'CONSULTANT' | 'CONTRACTOR' | 'LESSOR' | 'OTHER';

/**
 * Vendor rating
 */
export type VendorRating = 'PREFERRED' | 'APPROVED' | 'CONDITIONAL' | 'PROBATION' | 'SUSPENDED' | 'BLACKLISTED';

/**
 * Vendor entity
 */
export interface Vendor {
  vendorId: string;
  vendorCode: string | null;
  vendorName: string;
  vendorType: VendorType | null;
  contactName: string | null;
  contactEmail: string | null;
  contactPhone: string | null;
  address: string | null;
  paymentTerms: string | null;
  rating: VendorRating | null;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

/**
 * Create vendor request
 */
export interface CreateVendorRequest {
  vendorCode?: string;
  vendorName: string;
  vendorType?: VendorType;
  contactName?: string;
  contactEmail?: string;
  contactPhone?: string;
  addressLine1?: string;
  addressLine2?: string;
  city?: string;
  stateProvince?: string;
  postalCode?: string;
  country?: string;
  paymentTerms?: string;
}

/**
 * Update vendor request
 */
export interface UpdateVendorRequest {
  vendorName?: string;
  vendorType?: VendorType;
  contactName?: string;
  contactEmail?: string;
  contactPhone?: string;
  addressLine1?: string;
  addressLine2?: string;
  city?: string;
  stateProvince?: string;
  postalCode?: string;
  country?: string;
  paymentTerms?: string;
  rating?: VendorRating;
  isActive?: boolean;
}

/**
 * Vendor-specific pricing for a hardware model (catalog item).
 */
export interface VendorModelPrice {
  vendorId: string;
  modelId: string;
  countryCode: string;
  manufacturerName: string;
  modelName: string;
  sku: string | null;
  unitPrice: number;
  currency: string;
  vendorSku: string | null;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface UpsertVendorModelPriceRequest {
  unitPrice: number;
  currency?: string;
  countryCode?: string;
  vendorSku?: string;
  isActive?: boolean;
}

/**
 * Manufacturer entity
 */
export interface Manufacturer {
  manufacturerId: string;
  name: string;
  website: string | null;
  modelCount: number;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

/**
 * Create manufacturer request
 */
export interface CreateManufacturerRequest {
  name: string;
  website?: string;
}

/**
 * Update manufacturer request
 */
export interface UpdateManufacturerRequest {
  name?: string;
  website?: string;
  isActive?: boolean;
}

/**
 * Model status
 */
export type ModelStatus = 'ACTIVE' | 'DEPRECATED' | 'END_OF_LIFE';

/**
 * Model entity (Product Catalog)
 */
export interface Model {
  modelId: string;
  manufacturerId: string;
  manufacturerName: string;
  modelName: string;
  modelNumber: string | null;
  sku: string | null;
  category: string | null;
  specifications: Record<string, unknown> | null;
  status: ModelStatus;
  assetCount: number;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

/**
 * Create model request
 */
export interface CreateModelRequest {
  manufacturerId: string;
  modelName: string;
  modelNumber?: string;
  sku?: string;
  category?: string;
  specifications?: Record<string, unknown>;
}

/**
 * Update model request
 */
export interface UpdateModelRequest {
  modelName?: string;
  modelNumber?: string;
  sku?: string;
  category?: string;
  specifications?: Record<string, unknown>;
  status?: ModelStatus;
  isActive?: boolean;
}

// ============================================================================
// Stockroom Admin Types
// ============================================================================

/**
 * Stockroom type
 * Aligned with backend @ams/types/stockroom.ts StockroomType
 */
export type StockroomType = 'STANDARD' | 'LOANER' | 'REPAIR' | 'DISPOSAL' | 'QUARANTINE' | 'MAIN' | 'SATELLITE' | 'VIRTUAL' | 'RECEIVING' | 'SPARE_PARTS' | 'OTHER';

/**
 * Stockroom entity for admin
 */
export interface Stockroom {
  stockroomId: string;
  stockroomCode: string;
  name: string;
  description?: string;
  stockroomType: StockroomType;
  roomId: string | null;
  roomName: string | null;
  managerId: string | null;
  managerName: string | null;
  totalItems: number;
  totalValue: number;
  binCount: number;
  totalBins?: number;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

/**
 * Create stockroom request
 */
export interface CreateStockroomRequest {
  stockroomCode: string;
  name: string;
  description?: string;
  stockroomType: StockroomType;
  roomId?: string;
  managerId?: string;
}

/**
 * Update stockroom request
 */
export interface UpdateStockroomRequest {
  name?: string;
  description?: string;
  stockroomType?: StockroomType;
  roomId?: string;
  managerId?: string;
  isActive?: boolean;
}

/**
 * Get stockroom type label
 * Aligned with backend @ams/types/stockroom.ts StockroomType
 */
export function getStockroomTypeLabel(type: StockroomType): string {
  const labels: Record<StockroomType, string> = {
    STANDARD: 'Standard',
    LOANER: 'Loaner',
    REPAIR: 'Repair Center',
    DISPOSAL: 'Disposal',
    QUARANTINE: 'Quarantine',
    MAIN: 'Main',
    SATELLITE: 'Satellite',
    VIRTUAL: 'Virtual',
    RECEIVING: 'Receiving',
    SPARE_PARTS: 'Spare Parts',
    OTHER: 'Other',
  };
  return labels[type] || type;
}

// ============================================================================
// Bin Location Types
// ============================================================================

/**
 * Bin location entity
 */
export interface BinLocation {
  binId: string;
  stockroomId: string;
  stockroomName?: string;
  binCode: string;
  description?: string;
  aisle?: string;
  shelf?: string;
  position?: string;
  shelfLocation: string | null;
  capacity: number | null;
  maxQuantity?: number;
  currentCount: number;
  currentQuantity?: number;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

/**
 * Create bin location request
 */
export interface CreateBinLocationRequest {
  stockroomId: string;
  binCode: string;
  description?: string;
  aisle?: string;
  shelf?: string;
  position?: string;
  shelfLocation?: string;
  capacity?: number;
  maxQuantity?: number;
}

/**
 * Update bin location request
 */
export interface UpdateBinLocationRequest {
  binCode?: string;
  description?: string;
  shelfLocation?: string;
  capacity?: number;
  maxQuantity?: number;
  isActive?: boolean;
}

// ============================================================================
// User Admin Types
// ============================================================================

/**
 * User details
 */
export interface UserDetails {
  userId: string;
  cognitoSub: string;
  email: string;
  firstName: string | null;
  lastName: string | null;
  departmentId: string | null;
  departmentName: string | null;
  managerId: string | null;
  managerName: string | null;
  roles: string[];
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

/**
 * Update user request
 */
export interface UpdateUserRequest {
  firstName?: string;
  lastName?: string;
  departmentId?: string;
  managerId?: string;
}

/**
 * User list filters
 */
export interface UserListFilters {
  departmentId?: string;
  managerId?: string;
  isActive?: boolean;
  search?: string;
}

// ============================================================================
// Helper Functions
// ============================================================================

/**
 * Get room type label
 */
export function getRoomTypeLabel(type: RoomType): string {
  const labels: Record<RoomType, string> = {
    OFFICE: 'Office',
    SERVER_ROOM: 'Server Room',
    STORAGE: 'Storage',
    CONFERENCE: 'Conference Room',
    LAB: 'Laboratory',
    UTILITY: 'Utility',
    OTHER: 'Other',
  };
  return labels[type] || type;
}

/**
 * Get vendor type label
 */
export function getVendorTypeLabel(type: VendorType): string {
  const labels: Record<VendorType, string> = {
    MANUFACTURER: 'Manufacturer',
    RESELLER: 'Reseller',
    DISTRIBUTOR: 'Distributor',
    SERVICE_PROVIDER: 'Service Provider',
    CONSULTANT: 'Consultant',
    CONTRACTOR: 'Contractor',
    LESSOR: 'Lessor',
    OTHER: 'Other',
  };
  return labels[type] || type;
}

/**
 * Get vendor rating label and color
 */
export function getVendorRatingInfo(rating: VendorRating | null): { label: string; color: string } {
  if (!rating) return { label: 'Not Rated', color: 'var(--color-gray-500)' };

  const info: Record<VendorRating, { label: string; color: string }> = {
    PREFERRED: { label: 'Preferred', color: 'var(--color-success-500)' },
    APPROVED: { label: 'Approved', color: 'var(--color-primary-500)' },
    CONDITIONAL: { label: 'Conditional', color: 'var(--color-warning-500)' },
    PROBATION: { label: 'Probation', color: 'var(--color-warning-600)' },
    SUSPENDED: { label: 'Suspended', color: 'var(--color-error-500)' },
    BLACKLISTED: { label: 'Blacklisted', color: 'var(--color-error-700)' },
  };
  return info[rating] || { label: rating, color: 'var(--color-gray-500)' };
}

/**
 * Get vendor rating badge colors for StatusBadge component
 * Returns background and text colors using CSS variables for dark mode support
 */
export function getVendorRatingBadgeColors(rating: VendorRating | null): { 
  label: string; 
  background: string; 
  text: string;
} {
  if (!rating) return { 
    label: 'Not Rated', 
    background: 'var(--color-gray-100)', 
    text: 'var(--color-gray-600)' 
  };

  const info: Record<VendorRating, { label: string; background: string; text: string }> = {
    PREFERRED: { label: 'Preferred', background: 'var(--color-success-100)', text: 'var(--color-success-700)' },
    APPROVED: { label: 'Approved', background: 'var(--color-primary-100)', text: 'var(--color-primary-700)' },
    CONDITIONAL: { label: 'Conditional', background: 'var(--color-warning-100)', text: 'var(--color-warning-700)' },
    PROBATION: { label: 'Probation', background: 'var(--color-warning-100)', text: 'var(--color-warning-800)' },
    SUSPENDED: { label: 'Suspended', background: 'var(--color-error-100)', text: 'var(--color-error-700)' },
    BLACKLISTED: { label: 'Blacklisted', background: 'var(--color-error-100)', text: 'var(--color-error-800)' },
  };
  return info[rating] || { label: rating, background: 'var(--color-gray-100)', text: 'var(--color-gray-600)' };
}

/**
 * Get model status label and color
 */
export function getModelStatusInfo(status: ModelStatus): { label: string; color: string } {
  const info: Record<ModelStatus, { label: string; color: string }> = {
    ACTIVE: { label: 'Active', color: 'var(--color-success-500)' },
    DEPRECATED: { label: 'Deprecated', color: 'var(--color-warning-500)' },
    END_OF_LIFE: { label: 'End of Life', color: 'var(--color-error-500)' },
  };
  return info[status] || { label: status, color: 'var(--color-gray-500)' };
}

/**
 * Format address from building
 */
export function formatBuildingAddress(building: Building): string {
  const parts: string[] = [];
  if (building.addressLine1) parts.push(building.addressLine1);
  if (building.addressLine2) parts.push(building.addressLine2);

  const cityStateParts: string[] = [];
  if (building.city) cityStateParts.push(building.city);
  if (building.stateProvince) cityStateParts.push(building.stateProvince);
  if (building.postalCode) cityStateParts.push(building.postalCode);
  if (cityStateParts.length > 0) parts.push(cityStateParts.join(', '));

  if (building.country && building.country !== 'USA') parts.push(building.country);

  return parts.join(', ') || 'No address';
}

/**
 * Calculate rack utilization percentage
 */
export function getRackUtilization(rack: Rack): number {
  if (rack.totalUnits === 0) return 0;
  return Math.round((rack.usedUnits / rack.totalUnits) * 100);
}

/**
 * Get cost center utilization percentage
 */
export function getCostCenterUtilization(costCenter: CostCenter): number {
  if (costCenter.budgetAmount === 0) return 0;
  return Math.round((costCenter.spentAmount / costCenter.budgetAmount) * 100);
}

/**
 * Format currency
 */
export function formatCurrency(value: number): string {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(value);
}
