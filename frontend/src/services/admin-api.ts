/**
 * Admin API Service
 *
 * Provides methods for interacting with the Admin Management API.
 * Handles CRUD operations for buildings, floors, rooms, racks,
 * departments, cost centers, vendors, manufacturers, and models.
 *
 * Implements Task 16: Frontend - Admin Pages
 */

import { apiClient, ApiError } from './api-client';
import type {
  Building,
  CreateBuildingRequest,
  UpdateBuildingRequest,
  Floor,
  CreateFloorRequest,
  UpdateFloorRequest,
  Room,
  CreateRoomRequest,
  UpdateRoomRequest,
  Rack,
  CreateRackRequest,
  UpdateRackRequest,
  Stockroom,
  CreateStockroomRequest,
  UpdateStockroomRequest,
  Department,
  CreateDepartmentRequest,
  UpdateDepartmentRequest,
  CostCenter,
  CreateCostCenterRequest,
  UpdateCostCenterRequest,
  Vendor,
  CreateVendorRequest,
  UpdateVendorRequest,
  VendorModelPrice,
  UpsertVendorModelPriceRequest,
  Manufacturer,
  CreateManufacturerRequest,
  UpdateManufacturerRequest,
  Model,
  CreateModelRequest,
  UpdateModelRequest,
  BinLocation,
  CreateBinLocationRequest,
  UpdateBinLocationRequest,
  UserDetails,
  UpdateUserRequest,
  UserListFilters,
} from '../types/admin';

/**
 * Pagination parameters
 */
interface PaginationParams {
  page?: number;
  pageSize?: number;
  sortBy?: string;
  sortOrder?: 'asc' | 'desc';
}

/**
 * Paginated response
 */
interface PaginatedResponse<T> {
  items: T[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
}

export function mapPaginatedResponse<T>(raw: unknown): PaginatedResponse<T> {
  const data = (raw ?? {}) as {
    items?: unknown;
    total?: unknown;
    page?: unknown;
    limit?: unknown;
    pageSize?: unknown;
  };

  const items = Array.isArray(data.items) ? (data.items as T[]) : [];
  const total = typeof data.total === 'number' && Number.isFinite(data.total) ? data.total : 0;
  const page = typeof data.page === 'number' && Number.isFinite(data.page) ? data.page : 1;

  const rawLimit =
    typeof data.limit === 'number' && Number.isFinite(data.limit)
      ? data.limit
      : typeof data.pageSize === 'number' && Number.isFinite(data.pageSize)
        ? data.pageSize
        : items.length;

  const pageSize = Math.max(1, rawLimit || 1);
  const totalPages = Math.max(1, Math.ceil(total / pageSize));

  return { items, total, page, pageSize, totalPages };
}

/**
 * Build query string from parameters.
 * Note: Frontend uses `pageSize` for pagination, but the backend expects `limit`.
 * This function converts `pageSize` to `limit` in the query string.
 */
function buildQueryString(params: Record<string, unknown>): string {
  const searchParams = new URLSearchParams();

  for (const [key, value] of Object.entries(params)) {
    if (value !== undefined && value !== null && value !== '') {
      if (key === 'pageSize') {
        searchParams.append('limit', String(value));
      } else if (key === 'sortOrder') {
        searchParams.append('order', String(value));
      } else {
        searchParams.append(key, String(value));
      }
    }
  }

  const queryString = searchParams.toString();
  return queryString ? `?${queryString}` : '';
}

// ============================================================================
// Building API
// ============================================================================

export async function listBuildings(
  filters?: { isActive?: boolean; search?: string },
  pagination?: PaginationParams
): Promise<PaginatedResponse<Building>> {
  const queryParams = {
    ...filters,
    page: pagination?.page ?? 1,
    pageSize: pagination?.pageSize ?? 20,
    sortBy: pagination?.sortBy,
    sortOrder: pagination?.sortOrder,
  };

  const queryString = buildQueryString(queryParams);
  const response = await apiClient.get<PaginatedResponse<Building>>(`/admin/buildings${queryString}`);

  if (!response.success || !response.data) {
    throw new ApiError(
      response.error?.code || 'LIST_FAILED',
      response.error?.message || 'Failed to list buildings',
      400,
      response.requestId
    );
  }

  return mapPaginatedResponse<Building>(response.data);
}

export async function getBuilding(buildingId: string): Promise<Building> {
  const response = await apiClient.get<Building>(`/admin/buildings/${buildingId}`);

  if (!response.success || !response.data) {
    throw new ApiError(
      response.error?.code || 'NOT_FOUND',
      response.error?.message || 'Building not found',
      404,
      response.requestId
    );
  }

  return response.data;
}

export async function createBuilding(data: CreateBuildingRequest): Promise<Building> {
  const response = await apiClient.post<Building>('/admin/buildings', data);

  if (!response.success || !response.data) {
    throw new ApiError(
      response.error?.code || 'CREATE_FAILED',
      response.error?.message || 'Failed to create building',
      400,
      response.requestId
    );
  }

  return response.data;
}

export async function updateBuilding(buildingId: string, data: UpdateBuildingRequest): Promise<Building> {
  const response = await apiClient.put<Building>(`/admin/buildings/${buildingId}`, data);

  if (!response.success || !response.data) {
    throw new ApiError(
      response.error?.code || 'UPDATE_FAILED',
      response.error?.message || 'Failed to update building',
      400,
      response.requestId
    );
  }

  return response.data;
}

export async function deactivateBuilding(buildingId: string): Promise<void> {
  const response = await apiClient.post(`/admin/buildings/${buildingId}/deactivate`);

  if (!response.success) {
    throw new ApiError(
      response.error?.code || 'DEACTIVATE_FAILED',
      response.error?.message || 'Failed to deactivate building',
      400,
      response.requestId
    );
  }
}

// ============================================================================
// Floor API
// ============================================================================

export async function listFloors(
  buildingId?: string,
  filters?: { isActive?: boolean },
  pagination?: PaginationParams
): Promise<PaginatedResponse<Floor>> {
  const queryParams = {
    buildingId,
    ...filters,
    page: pagination?.page ?? 1,
    pageSize: pagination?.pageSize ?? 50,
    sortBy: pagination?.sortBy ?? 'floorNumber',
    sortOrder: pagination?.sortOrder ?? 'asc',
  };

  const queryString = buildQueryString(queryParams);
  const response = await apiClient.get<PaginatedResponse<Floor>>(`/admin/floors${queryString}`);

  if (!response.success || !response.data) {
    throw new ApiError(
      response.error?.code || 'LIST_FAILED',
      response.error?.message || 'Failed to list floors',
      400,
      response.requestId
    );
  }

  return mapPaginatedResponse<Floor>(response.data);
}

export async function getFloor(floorId: string): Promise<Floor> {
  const response = await apiClient.get<Floor>(`/admin/floors/${floorId}`);

  if (!response.success || !response.data) {
    throw new ApiError(
      response.error?.code || 'NOT_FOUND',
      response.error?.message || 'Floor not found',
      404,
      response.requestId
    );
  }

  return response.data;
}

export async function createFloor(data: CreateFloorRequest): Promise<Floor> {
  const response = await apiClient.post<Floor>('/admin/floors', data);

  if (!response.success || !response.data) {
    throw new ApiError(
      response.error?.code || 'CREATE_FAILED',
      response.error?.message || 'Failed to create floor',
      400,
      response.requestId
    );
  }

  return response.data;
}

export async function updateFloor(floorId: string, data: UpdateFloorRequest): Promise<Floor> {
  const response = await apiClient.put<Floor>(`/admin/floors/${floorId}`, data);

  if (!response.success || !response.data) {
    throw new ApiError(
      response.error?.code || 'UPDATE_FAILED',
      response.error?.message || 'Failed to update floor',
      400,
      response.requestId
    );
  }

  return response.data;
}

export async function deactivateFloor(floorId: string): Promise<void> {
  const response = await apiClient.post(`/admin/floors/${floorId}/deactivate`);

  if (!response.success) {
    throw new ApiError(
      response.error?.code || 'DEACTIVATE_FAILED',
      response.error?.message || 'Failed to deactivate floor',
      400,
      response.requestId
    );
  }
}

// ============================================================================
// Room API
// ============================================================================

export async function listRooms(
  floorId?: string,
  filters?: { isActive?: boolean; roomType?: string },
  pagination?: PaginationParams
): Promise<PaginatedResponse<Room>> {
  const queryParams = {
    floorId,
    ...filters,
    page: pagination?.page ?? 1,
    pageSize: pagination?.pageSize ?? 50,
    sortBy: pagination?.sortBy ?? 'roomNumber',
    sortOrder: pagination?.sortOrder ?? 'asc',
  };

  const queryString = buildQueryString(queryParams);
  const response = await apiClient.get<PaginatedResponse<Room>>(`/admin/rooms${queryString}`);

  if (!response.success || !response.data) {
    throw new ApiError(
      response.error?.code || 'LIST_FAILED',
      response.error?.message || 'Failed to list rooms',
      400,
      response.requestId
    );
  }

  return mapPaginatedResponse<Room>(response.data);
}

export async function getRoom(roomId: string): Promise<Room> {
  const response = await apiClient.get<Room>(`/admin/rooms/${roomId}`);

  if (!response.success || !response.data) {
    throw new ApiError(
      response.error?.code || 'NOT_FOUND',
      response.error?.message || 'Room not found',
      404,
      response.requestId
    );
  }

  return response.data;
}

export async function createRoom(data: CreateRoomRequest): Promise<Room> {
  const response = await apiClient.post<Room>('/admin/rooms', data);

  if (!response.success || !response.data) {
    throw new ApiError(
      response.error?.code || 'CREATE_FAILED',
      response.error?.message || 'Failed to create room',
      400,
      response.requestId
    );
  }

  return response.data;
}

export async function updateRoom(roomId: string, data: UpdateRoomRequest): Promise<Room> {
  const response = await apiClient.put<Room>(`/admin/rooms/${roomId}`, data);

  if (!response.success || !response.data) {
    throw new ApiError(
      response.error?.code || 'UPDATE_FAILED',
      response.error?.message || 'Failed to update room',
      400,
      response.requestId
    );
  }

  return response.data;
}

export async function deactivateRoom(roomId: string): Promise<void> {
  const response = await apiClient.post(`/admin/rooms/${roomId}/deactivate`);

  if (!response.success) {
    throw new ApiError(
      response.error?.code || 'DEACTIVATE_FAILED',
      response.error?.message || 'Failed to deactivate room',
      400,
      response.requestId
    );
  }
}

// ============================================================================
// Rack API
// ============================================================================

export async function listRacks(
  roomId?: string,
  filters?: { isActive?: boolean },
  pagination?: PaginationParams
): Promise<PaginatedResponse<Rack>> {
  const queryParams = {
    roomId,
    ...filters,
    page: pagination?.page ?? 1,
    pageSize: pagination?.pageSize ?? 50,
    sortBy: pagination?.sortBy ?? 'rackName',
    sortOrder: pagination?.sortOrder ?? 'asc',
  };

  const queryString = buildQueryString(queryParams);
  const response = await apiClient.get<PaginatedResponse<Rack>>(`/admin/racks${queryString}`);

  if (!response.success || !response.data) {
    throw new ApiError(
      response.error?.code || 'LIST_FAILED',
      response.error?.message || 'Failed to list racks',
      400,
      response.requestId
    );
  }

  return mapPaginatedResponse<Rack>(response.data);
}

export async function getRack(rackId: string): Promise<Rack> {
  const response = await apiClient.get<Rack>(`/admin/racks/${rackId}`);

  if (!response.success || !response.data) {
    throw new ApiError(
      response.error?.code || 'NOT_FOUND',
      response.error?.message || 'Rack not found',
      404,
      response.requestId
    );
  }

  return response.data;
}

export async function createRack(data: CreateRackRequest): Promise<Rack> {
  const response = await apiClient.post<Rack>('/admin/racks', data);

  if (!response.success || !response.data) {
    throw new ApiError(
      response.error?.code || 'CREATE_FAILED',
      response.error?.message || 'Failed to create rack',
      400,
      response.requestId
    );
  }

  return response.data;
}

export async function updateRack(rackId: string, data: UpdateRackRequest): Promise<Rack> {
  const response = await apiClient.put<Rack>(`/admin/racks/${rackId}`, data);

  if (!response.success || !response.data) {
    throw new ApiError(
      response.error?.code || 'UPDATE_FAILED',
      response.error?.message || 'Failed to update rack',
      400,
      response.requestId
    );
  }

  return response.data;
}

export async function deactivateRack(rackId: string): Promise<void> {
  const response = await apiClient.post(`/admin/racks/${rackId}/deactivate`);

  if (!response.success) {
    throw new ApiError(
      response.error?.code || 'DEACTIVATE_FAILED',
      response.error?.message || 'Failed to deactivate rack',
      400,
      response.requestId
    );
  }
}

// ============================================================================
// Stockroom API
// ============================================================================

export async function listStockrooms(
  filters?: { isActive?: boolean; stockroomType?: string; search?: string },
  pagination?: PaginationParams
): Promise<PaginatedResponse<Stockroom>> {
  const queryParams = {
    ...filters,
    page: pagination?.page ?? 1,
    pageSize: pagination?.pageSize ?? 50,
    sortBy: pagination?.sortBy ?? 'name',
    sortOrder: pagination?.sortOrder ?? 'asc',
  };

  const queryString = buildQueryString(queryParams);
  const response = await apiClient.get<PaginatedResponse<Stockroom>>(`/admin/stockrooms${queryString}`);

  if (!response.success || !response.data) {
    throw new ApiError(
      response.error?.code || 'LIST_FAILED',
      response.error?.message || 'Failed to list stockrooms',
      400,
      response.requestId
    );
  }

  return mapPaginatedResponse<Stockroom>(response.data);
}

export async function getStockroom(stockroomId: string): Promise<Stockroom> {
  const response = await apiClient.get<Stockroom>(`/admin/stockrooms/${stockroomId}`);

  if (!response.success || !response.data) {
    throw new ApiError(
      response.error?.code || 'NOT_FOUND',
      response.error?.message || 'Stockroom not found',
      404,
      response.requestId
    );
  }

  return response.data;
}

export async function createStockroom(data: CreateStockroomRequest): Promise<Stockroom> {
  const response = await apiClient.post<Stockroom>('/admin/stockrooms', data);

  if (!response.success || !response.data) {
    throw new ApiError(
      response.error?.code || 'CREATE_FAILED',
      response.error?.message || 'Failed to create stockroom',
      400,
      response.requestId
    );
  }

  return response.data;
}

export async function updateStockroom(stockroomId: string, data: UpdateStockroomRequest): Promise<Stockroom> {
  const response = await apiClient.put<Stockroom>(`/admin/stockrooms/${stockroomId}`, data);

  if (!response.success || !response.data) {
    throw new ApiError(
      response.error?.code || 'UPDATE_FAILED',
      response.error?.message || 'Failed to update stockroom',
      400,
      response.requestId
    );
  }

  return response.data;
}

export async function deactivateStockroom(stockroomId: string): Promise<void> {
  const response = await apiClient.post(`/admin/stockrooms/${stockroomId}/deactivate`);

  if (!response.success) {
    throw new ApiError(
      response.error?.code || 'DEACTIVATE_FAILED',
      response.error?.message || 'Failed to deactivate stockroom',
      400,
      response.requestId
    );
  }
}

// ============================================================================
// Department API
// ============================================================================

export async function listDepartments(
  filters?: { isActive?: boolean; parentDepartmentId?: string; search?: string },
  pagination?: PaginationParams
): Promise<PaginatedResponse<Department>> {
  const queryParams = {
    ...filters,
    page: pagination?.page ?? 1,
    pageSize: pagination?.pageSize ?? 50,
    sortBy: pagination?.sortBy ?? 'name',
    sortOrder: pagination?.sortOrder ?? 'asc',
  };

  const queryString = buildQueryString(queryParams);
  const response = await apiClient.get<PaginatedResponse<Department>>(`/admin/departments${queryString}`);

  if (!response.success || !response.data) {
    throw new ApiError(
      response.error?.code || 'LIST_FAILED',
      response.error?.message || 'Failed to list departments',
      400,
      response.requestId
    );
  }

  return mapPaginatedResponse<Department>(response.data);
}

export async function getDepartment(departmentId: string): Promise<Department> {
  const response = await apiClient.get<Department>(`/admin/departments/${departmentId}`);

  if (!response.success || !response.data) {
    throw new ApiError(
      response.error?.code || 'NOT_FOUND',
      response.error?.message || 'Department not found',
      404,
      response.requestId
    );
  }

  return response.data;
}

export async function createDepartment(data: CreateDepartmentRequest): Promise<Department> {
  const response = await apiClient.post<Department>('/admin/departments', data);

  if (!response.success || !response.data) {
    throw new ApiError(
      response.error?.code || 'CREATE_FAILED',
      response.error?.message || 'Failed to create department',
      400,
      response.requestId
    );
  }

  return response.data;
}

export async function updateDepartment(departmentId: string, data: UpdateDepartmentRequest): Promise<Department> {
  const response = await apiClient.put<Department>(`/admin/departments/${departmentId}`, data);

  if (!response.success || !response.data) {
    throw new ApiError(
      response.error?.code || 'UPDATE_FAILED',
      response.error?.message || 'Failed to update department',
      400,
      response.requestId
    );
  }

  return response.data;
}

export async function deactivateDepartment(departmentId: string): Promise<void> {
  const response = await apiClient.post(`/admin/departments/${departmentId}/deactivate`);

  if (!response.success) {
    throw new ApiError(
      response.error?.code || 'DEACTIVATE_FAILED',
      response.error?.message || 'Failed to deactivate department',
      400,
      response.requestId
    );
  }
}

// ============================================================================
// Cost Center API
// ============================================================================

export async function listCostCenters(
  filters?: { isActive?: boolean; departmentId?: string; fiscalYear?: number },
  pagination?: PaginationParams
): Promise<PaginatedResponse<CostCenter>> {
  const queryParams = {
    ...filters,
    page: pagination?.page ?? 1,
    pageSize: pagination?.pageSize ?? 50,
    sortBy: pagination?.sortBy ?? 'code',
    sortOrder: pagination?.sortOrder ?? 'asc',
  };

  const queryString = buildQueryString(queryParams);
  const response = await apiClient.get<PaginatedResponse<CostCenter>>(`/admin/cost-centers${queryString}`);

  if (!response.success || !response.data) {
    throw new ApiError(
      response.error?.code || 'LIST_FAILED',
      response.error?.message || 'Failed to list cost centers',
      400,
      response.requestId
    );
  }

  return mapPaginatedResponse<CostCenter>(response.data);
}

export async function getCostCenter(costCenterId: string): Promise<CostCenter> {
  const response = await apiClient.get<CostCenter>(`/admin/cost-centers/${costCenterId}`);

  if (!response.success || !response.data) {
    throw new ApiError(
      response.error?.code || 'NOT_FOUND',
      response.error?.message || 'Cost center not found',
      404,
      response.requestId
    );
  }

  return response.data;
}

export async function createCostCenter(data: CreateCostCenterRequest): Promise<CostCenter> {
  const response = await apiClient.post<CostCenter>('/admin/cost-centers', data);

  if (!response.success || !response.data) {
    throw new ApiError(
      response.error?.code || 'CREATE_FAILED',
      response.error?.message || 'Failed to create cost center',
      400,
      response.requestId
    );
  }

  return response.data;
}

export async function updateCostCenter(costCenterId: string, data: UpdateCostCenterRequest): Promise<CostCenter> {
  const response = await apiClient.put<CostCenter>(`/admin/cost-centers/${costCenterId}`, data);

  if (!response.success || !response.data) {
    throw new ApiError(
      response.error?.code || 'UPDATE_FAILED',
      response.error?.message || 'Failed to update cost center',
      400,
      response.requestId
    );
  }

  return response.data;
}

export async function deactivateCostCenter(costCenterId: string): Promise<void> {
  const response = await apiClient.post(`/admin/cost-centers/${costCenterId}/deactivate`);

  if (!response.success) {
    throw new ApiError(
      response.error?.code || 'DEACTIVATE_FAILED',
      response.error?.message || 'Failed to deactivate cost center',
      400,
      response.requestId
    );
  }
}

// ============================================================================
// Vendor API
// ============================================================================

export async function listVendors(
  filters?: { isActive?: boolean; vendorType?: string; rating?: string; search?: string },
  pagination?: PaginationParams
): Promise<PaginatedResponse<Vendor>> {
  const queryParams = {
    ...filters,
    page: pagination?.page ?? 1,
    pageSize: pagination?.pageSize ?? 20,
    sortBy: pagination?.sortBy ?? 'vendorName',
    sortOrder: pagination?.sortOrder ?? 'asc',
  };

  const queryString = buildQueryString(queryParams);
  const response = await apiClient.get<PaginatedResponse<Vendor>>(`/admin/vendors${queryString}`);

  if (!response.success || !response.data) {
    throw new ApiError(
      response.error?.code || 'LIST_FAILED',
      response.error?.message || 'Failed to list vendors',
      400,
      response.requestId
    );
  }

  return mapPaginatedResponse<Vendor>(response.data);
}

export async function getVendor(vendorId: string): Promise<Vendor> {
  const response = await apiClient.get<Vendor>(`/admin/vendors/${vendorId}`);

  if (!response.success || !response.data) {
    throw new ApiError(
      response.error?.code || 'NOT_FOUND',
      response.error?.message || 'Vendor not found',
      404,
      response.requestId
    );
  }

  return response.data;
}

export async function createVendor(data: CreateVendorRequest): Promise<Vendor> {
  const response = await apiClient.post<Vendor>('/admin/vendors', data);

  if (!response.success || !response.data) {
    throw new ApiError(
      response.error?.code || 'CREATE_FAILED',
      response.error?.message || 'Failed to create vendor',
      400,
      response.requestId
    );
  }

  return response.data;
}

export async function updateVendor(vendorId: string, data: UpdateVendorRequest): Promise<Vendor> {
  const response = await apiClient.put<Vendor>(`/admin/vendors/${vendorId}`, data);

  if (!response.success || !response.data) {
    throw new ApiError(
      response.error?.code || 'UPDATE_FAILED',
      response.error?.message || 'Failed to update vendor',
      400,
      response.requestId
    );
  }

  return response.data;
}

export async function deactivateVendor(vendorId: string): Promise<void> {
  const response = await apiClient.post(`/admin/vendors/${vendorId}/deactivate`);

  if (!response.success) {
    throw new ApiError(
      response.error?.code || 'DEACTIVATE_FAILED',
      response.error?.message || 'Failed to deactivate vendor',
      400,
      response.requestId
    );
  }
}

// ---------------------------------------------------------------------------
// Vendor ↔ Model Prices
// ---------------------------------------------------------------------------

interface VendorModelPricesResponse {
  items: VendorModelPrice[];
  total: number;
}

export async function listVendorModelPrices(
  vendorId: string,
  filters?: { isActive?: boolean; modelId?: string }
): Promise<VendorModelPricesResponse> {
  const queryString = buildQueryString({ ...filters });
  const response = await apiClient.get<VendorModelPricesResponse>(
    `/admin/vendors/${vendorId}/model-prices${queryString}`
  );

  if (!response.success || !response.data) {
    throw new ApiError(
      response.error?.code || 'LIST_FAILED',
      response.error?.message || 'Failed to list vendor model prices',
      400,
      response.requestId
    );
  }

  return response.data;
}

export async function upsertVendorModelPrice(
  vendorId: string,
  modelId: string,
  data: UpsertVendorModelPriceRequest
): Promise<VendorModelPrice> {
  const response = await apiClient.put<VendorModelPrice>(
    `/admin/vendors/${vendorId}/model-prices/${modelId}`,
    data
  );

  if (!response.success || !response.data) {
    throw new ApiError(
      response.error?.code || 'UPSERT_FAILED',
      response.error?.message || 'Failed to upsert vendor model price',
      400,
      response.requestId
    );
  }

  return response.data;
}

export async function deactivateVendorModelPrice(
  vendorId: string,
  modelId: string
): Promise<void> {
  const response = await apiClient.delete(
    `/admin/vendors/${vendorId}/model-prices/${modelId}`
  );

  if (!response.success) {
    throw new ApiError(
      response.error?.code || 'DEACTIVATE_FAILED',
      response.error?.message || 'Failed to deactivate vendor model price',
      400,
      response.requestId
    );
  }
}

// ============================================================================
// Manufacturer API
// ============================================================================

export async function listManufacturers(
  filters?: { isActive?: boolean; search?: string },
  pagination?: PaginationParams
): Promise<PaginatedResponse<Manufacturer>> {
  const queryParams = {
    ...filters,
    page: pagination?.page ?? 1,
    pageSize: pagination?.pageSize ?? 20,
    sortBy: pagination?.sortBy ?? 'name',
    sortOrder: pagination?.sortOrder ?? 'asc',
  };

  const queryString = buildQueryString(queryParams);
  const response = await apiClient.get<PaginatedResponse<Manufacturer>>(`/admin/manufacturers${queryString}`);

  if (!response.success || !response.data) {
    throw new ApiError(
      response.error?.code || 'LIST_FAILED',
      response.error?.message || 'Failed to list manufacturers',
      400,
      response.requestId
    );
  }

  return mapPaginatedResponse<Manufacturer>(response.data);
}

export async function getManufacturer(manufacturerId: string): Promise<Manufacturer> {
  const response = await apiClient.get<Manufacturer>(`/admin/manufacturers/${manufacturerId}`);

  if (!response.success || !response.data) {
    throw new ApiError(
      response.error?.code || 'NOT_FOUND',
      response.error?.message || 'Manufacturer not found',
      404,
      response.requestId
    );
  }

  return response.data;
}

export async function createManufacturer(data: CreateManufacturerRequest): Promise<Manufacturer> {
  const response = await apiClient.post<Manufacturer>('/admin/manufacturers', data);

  if (!response.success || !response.data) {
    throw new ApiError(
      response.error?.code || 'CREATE_FAILED',
      response.error?.message || 'Failed to create manufacturer',
      400,
      response.requestId
    );
  }

  return response.data;
}

export async function updateManufacturer(manufacturerId: string, data: UpdateManufacturerRequest): Promise<Manufacturer> {
  const response = await apiClient.put<Manufacturer>(`/admin/manufacturers/${manufacturerId}`, data);

  if (!response.success || !response.data) {
    throw new ApiError(
      response.error?.code || 'UPDATE_FAILED',
      response.error?.message || 'Failed to update manufacturer',
      400,
      response.requestId
    );
  }

  return response.data;
}

export async function deactivateManufacturer(manufacturerId: string): Promise<void> {
  const response = await apiClient.post(`/admin/manufacturers/${manufacturerId}/deactivate`);

  if (!response.success) {
    throw new ApiError(
      response.error?.code || 'DEACTIVATE_FAILED',
      response.error?.message || 'Failed to deactivate manufacturer',
      400,
      response.requestId
    );
  }
}

// ============================================================================
// Model API
// ============================================================================

export async function listModels(
  filters?: { isActive?: boolean; manufacturerId?: string; status?: string; category?: string; search?: string },
  pagination?: PaginationParams
): Promise<PaginatedResponse<Model>> {
  const queryParams = {
    ...filters,
    page: pagination?.page ?? 1,
    pageSize: pagination?.pageSize ?? 20,
    sortBy: pagination?.sortBy ?? 'modelName',
    sortOrder: pagination?.sortOrder ?? 'asc',
  };

  const queryString = buildQueryString(queryParams);
  const response = await apiClient.get<PaginatedResponse<Model>>(`/admin/models${queryString}`);

  if (!response.success || !response.data) {
    throw new ApiError(
      response.error?.code || 'LIST_FAILED',
      response.error?.message || 'Failed to list models',
      400,
      response.requestId
    );
  }

  return mapPaginatedResponse<Model>(response.data);
}

export async function getModel(modelId: string): Promise<Model> {
  const response = await apiClient.get<Model>(`/admin/models/${modelId}`);

  if (!response.success || !response.data) {
    throw new ApiError(
      response.error?.code || 'NOT_FOUND',
      response.error?.message || 'Model not found',
      404,
      response.requestId
    );
  }

  return response.data;
}

export async function createModel(data: CreateModelRequest): Promise<Model> {
  const response = await apiClient.post<Model>('/admin/models', data);

  if (!response.success || !response.data) {
    throw new ApiError(
      response.error?.code || 'CREATE_FAILED',
      response.error?.message || 'Failed to create model',
      400,
      response.requestId
    );
  }

  return response.data;
}

export async function updateModel(modelId: string, data: UpdateModelRequest): Promise<Model> {
  const response = await apiClient.put<Model>(`/admin/models/${modelId}`, data);

  if (!response.success || !response.data) {
    throw new ApiError(
      response.error?.code || 'UPDATE_FAILED',
      response.error?.message || 'Failed to update model',
      400,
      response.requestId
    );
  }

  return response.data;
}

export async function deactivateModel(modelId: string): Promise<void> {
  const response = await apiClient.post(`/admin/models/${modelId}/deactivate`);

  if (!response.success) {
    throw new ApiError(
      response.error?.code || 'DEACTIVATE_FAILED',
      response.error?.message || 'Failed to deactivate model',
      400,
      response.requestId
    );
  }
}

// ============================================================================
// Bin Location API
// ============================================================================

export async function listBinLocations(
  stockroomId?: string,
  filters?: { isActive?: boolean },
  pagination?: PaginationParams
): Promise<PaginatedResponse<BinLocation>> {
  const queryParams = {
    stockroomId,
    ...filters,
    page: pagination?.page ?? 1,
    pageSize: pagination?.pageSize ?? 50,
    sortBy: pagination?.sortBy ?? 'binCode',
    sortOrder: pagination?.sortOrder ?? 'asc',
  };

  const queryString = buildQueryString(queryParams);
  const response = await apiClient.get<PaginatedResponse<BinLocation>>(`/admin/bin-locations${queryString}`);

  if (!response.success || !response.data) {
    throw new ApiError(
      response.error?.code || 'LIST_FAILED',
      response.error?.message || 'Failed to list bin locations',
      400,
      response.requestId
    );
  }

  return mapPaginatedResponse<BinLocation>(response.data);
}

export async function getBinLocation(binId: string): Promise<BinLocation> {
  const response = await apiClient.get<BinLocation>(`/admin/bin-locations/${binId}`);

  if (!response.success || !response.data) {
    throw new ApiError(
      response.error?.code || 'NOT_FOUND',
      response.error?.message || 'Bin location not found',
      404,
      response.requestId
    );
  }

  return response.data;
}

export async function createBinLocation(data: CreateBinLocationRequest): Promise<BinLocation> {
  const response = await apiClient.post<BinLocation>('/admin/bin-locations', data);

  if (!response.success || !response.data) {
    throw new ApiError(
      response.error?.code || 'CREATE_FAILED',
      response.error?.message || 'Failed to create bin location',
      400,
      response.requestId
    );
  }

  return response.data;
}

export async function updateBinLocation(binId: string, data: UpdateBinLocationRequest): Promise<BinLocation> {
  const response = await apiClient.put<BinLocation>(`/admin/bin-locations/${binId}`, data);

  if (!response.success || !response.data) {
    throw new ApiError(
      response.error?.code || 'UPDATE_FAILED',
      response.error?.message || 'Failed to update bin location',
      400,
      response.requestId
    );
  }

  return response.data;
}

export async function deactivateBinLocation(binId: string): Promise<void> {
  const response = await apiClient.post(`/admin/bin-locations/${binId}/deactivate`);

  if (!response.success) {
    throw new ApiError(
      response.error?.code || 'DEACTIVATE_FAILED',
      response.error?.message || 'Failed to deactivate bin location',
      400,
      response.requestId
    );
  }
}

// ============================================================================
// User Admin API
// ============================================================================

export async function listUsers(
  filters?: UserListFilters,
  pagination?: PaginationParams
): Promise<PaginatedResponse<UserDetails>> {
  const queryParams = {
    ...filters,
    page: pagination?.page ?? 1,
    pageSize: pagination?.pageSize ?? 20,
    sortBy: pagination?.sortBy ?? 'email',
    sortOrder: pagination?.sortOrder ?? 'asc',
  };

  const queryString = buildQueryString(queryParams);
  const response = await apiClient.get<PaginatedResponse<UserDetails>>(`/admin/users${queryString}`);

  if (!response.success || !response.data) {
    throw new ApiError(
      response.error?.code || 'LIST_FAILED',
      response.error?.message || 'Failed to list users',
      400,
      response.requestId
    );
  }

  return mapPaginatedResponse<UserDetails>(response.data);
}

export async function getUser(userId: string): Promise<UserDetails> {
  const response = await apiClient.get<UserDetails>(`/admin/users/${userId}`);

  if (!response.success || !response.data) {
    throw new ApiError(
      response.error?.code || 'NOT_FOUND',
      response.error?.message || 'User not found',
      404,
      response.requestId
    );
  }

  return response.data;
}

export async function updateUser(userId: string, data: UpdateUserRequest): Promise<UserDetails> {
  const response = await apiClient.put<UserDetails>(`/admin/users/${userId}`, data);

  if (!response.success || !response.data) {
    throw new ApiError(
      response.error?.code || 'UPDATE_FAILED',
      response.error?.message || 'Failed to update user',
      400,
      response.requestId
    );
  }

  return response.data;
}

export async function deactivateUser(userId: string): Promise<void> {
  const response = await apiClient.post(`/admin/users/${userId}/deactivate`);

  if (!response.success) {
    throw new ApiError(
      response.error?.code || 'DEACTIVATE_FAILED',
      response.error?.message || 'Failed to deactivate user',
      400,
      response.requestId
    );
  }
}

export async function reactivateUser(userId: string): Promise<void> {
  const response = await apiClient.post(`/admin/users/${userId}/reactivate`);

  if (!response.success) {
    throw new ApiError(
      response.error?.code || 'REACTIVATE_FAILED',
      response.error?.message || 'Failed to reactivate user',
      400,
      response.requestId
    );
  }
}

export async function assignUserRole(userId: string, roleId: string): Promise<void> {
  const response = await apiClient.post(`/admin/users/${userId}/roles`, { roleId });

  if (!response.success) {
    throw new ApiError(
      response.error?.code || 'ASSIGN_ROLE_FAILED',
      response.error?.message || 'Failed to assign role',
      400,
      response.requestId
    );
  }
}

export async function removeUserRole(userId: string, roleId: string): Promise<void> {
  const response = await apiClient.delete(`/admin/users/${userId}/roles/${roleId}`);

  if (!response.success) {
    throw new ApiError(
      response.error?.code || 'REMOVE_ROLE_FAILED',
      response.error?.message || 'Failed to remove role',
      400,
      response.requestId
    );
  }
}

// ============================================================================
// Export Admin API
// ============================================================================

export const adminApi = {
  buildings: {
    list: listBuildings,
    get: getBuilding,
    create: createBuilding,
    update: updateBuilding,
    deactivate: deactivateBuilding,
  },
  floors: {
    list: listFloors,
    get: getFloor,
    create: createFloor,
    update: updateFloor,
    deactivate: deactivateFloor,
  },
  rooms: {
    list: listRooms,
    get: getRoom,
    create: createRoom,
    update: updateRoom,
    deactivate: deactivateRoom,
  },
  racks: {
    list: listRacks,
    get: getRack,
    create: createRack,
    update: updateRack,
    deactivate: deactivateRack,
  },
  stockrooms: {
    list: listStockrooms,
    get: getStockroom,
    create: createStockroom,
    update: updateStockroom,
    deactivate: deactivateStockroom,
  },
  departments: {
    list: listDepartments,
    get: getDepartment,
    create: createDepartment,
    update: updateDepartment,
    deactivate: deactivateDepartment,
  },
  costCenters: {
    list: listCostCenters,
    get: getCostCenter,
    create: createCostCenter,
    update: updateCostCenter,
    deactivate: deactivateCostCenter,
  },
  vendors: {
    list: listVendors,
    get: getVendor,
    create: createVendor,
    update: updateVendor,
    deactivate: deactivateVendor,
  },
  vendorModelPrices: {
    list: listVendorModelPrices,
    upsert: upsertVendorModelPrice,
    deactivate: deactivateVendorModelPrice,
  },
  manufacturers: {
    list: listManufacturers,
    get: getManufacturer,
    create: createManufacturer,
    update: updateManufacturer,
    deactivate: deactivateManufacturer,
  },
  models: {
    list: listModels,
    get: getModel,
    create: createModel,
    update: updateModel,
    deactivate: deactivateModel,
  },
  binLocations: {
    list: listBinLocations,
    get: getBinLocation,
    create: createBinLocation,
    update: updateBinLocation,
    deactivate: deactivateBinLocation,
  },
  users: {
    list: listUsers,
    get: getUser,
    update: updateUser,
    deactivate: deactivateUser,
    reactivate: reactivateUser,
    assignRole: assignUserRole,
    removeRole: removeUserRole,
  },
};

export default adminApi;
