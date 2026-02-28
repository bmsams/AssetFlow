/**
 * EAM API Service
 *
 * Provides methods for interacting with the EAM Service endpoints
 * for work orders, maintenance plans, linear assets, and parts inventory.
 *
 * Implements Task 7.1: Create EAM API client
 * Validates: Requirements 7.1, 7.2, 7.3, 7.4
 */

import { apiClient, ApiError } from './api-client';

// ============================================================================
// Types
// ============================================================================

export interface WorkOrder {
  workOrderId: string;
  assetId: string;
  assetTag: string;
  title: string;
  description: string;
  priority: 'low' | 'medium' | 'high' | 'critical';
  status:
    | 'open'
    | 'assigned'
    | 'in_progress'
    | 'on_hold'
    | 'pending_parts'
    | 'pending_approval'
    | 'completed'
    | 'cancelled'
    | 'closed';
  assignedTo?: string;
  assignedToName?: string;
  createdBy: string;
  createdAt: string;
  completedAt?: string;
  estimatedHours?: number;
  actualHours?: number;
}

export interface MaintenancePlan {
  planId: string;
  assetId: string;
  planName: string;
  description: string | null;
  maintenanceType: string;
  scheduleType: string;
  frequencyDays: number | null;
  frequencyHours: number | null;
  lastPerformedDate: string | null;
  nextDueDate: string | null;
  estimatedDurationHours: number | null;
  estimatedCost: number | null;
  leadTimeDays: number;
  isActive: boolean;
  priority: string;
  executionCount: number;
  createdAt: string;
  updatedAt: string;
}

export interface DueMaintenanceItem {
  planId: string;
  assetId: string;
  planName: string;
  nextDueDate: string;
  isOverdue: boolean;
  isCritical: boolean;
  priority: string;
}

export interface DueMaintenanceResponse {
  due: DueMaintenanceItem[];
  upcoming: DueMaintenanceItem[];
  summary: {
    totalDue: number;
    overdue: number;
    critical: number;
    upcomingCount: number;
  };
}

export interface LinearAsset {
  linearAssetId: string;
  name: string;
  description: string;
  totalLength: number;
  unit: 'meters' | 'feet' | 'kilometers' | 'miles';
  segments: LinearSegment[];
}

export interface LinearSegment {
  segmentId: string;
  startPoint: number;
  endPoint: number;
  condition: 'good' | 'fair' | 'poor' | 'critical';
  lastInspected?: string;
  notes?: string;
}

export interface PartLevel {
  partId: string;
  name: string;
  partNumber: string;
  currentQuantity: number;
  minQuantity: number;
  maxQuantity: number;
  unitCost: number;
  location: string;
  lastRestocked?: string;
}

export interface CreateWorkOrderRequest {
  assetId: string;
  buildingId?: string;
  workType?: 'preventive' | 'corrective' | 'emergency' | 'inspection' | 'calibration' | 'installation' | 'modification' | 'decommission' | 'project' | 'other';
  title: string;
  description: string;
  priority: 'low' | 'medium' | 'high' | 'critical';
  estimatedHours?: number;
}

export interface CreateMaintenancePlanRequest {
  assetId: string;
  planName: string;
  description?: string;
  maintenanceType: string;
  scheduleType: string;
  frequencyDays?: number;
  frequencyHours?: number;
  estimatedDurationHours?: number;
  estimatedCost?: number;
  priority?: string;
}

export interface UpdateMaintenancePlanRequest {
  planName?: string;
  description?: string;
  maintenanceType?: string;
  scheduleType?: string;
  frequencyDays?: number | null;
  frequencyHours?: number | null;
  isActive?: boolean;
  priority?: string;
}

export interface CreateLinearAssetRequest {
  name: string;
  description: string;
  totalLength: number;
  unit: 'meters' | 'feet' | 'kilometers' | 'miles';
}

export interface UpdateSegmentRequest {
  condition: 'good' | 'fair' | 'poor' | 'critical';
  notes?: string;
}

export interface ReservePartsRequest {
  partId: string;
  quantity: number;
  workOrderId?: string;
}

export interface ConsumePartsRequest {
  partId: string;
  quantity: number;
  workOrderId?: string;
}

export interface WorkOrderListFilters {
  status?: WorkOrder['status'];
  priority?: WorkOrder['priority'];
  buildingId?: string;
  building?: string;
}

const STATUS_UI_TO_API: Record<WorkOrder['status'], string> = {
  open: 'OPEN',
  assigned: 'ASSIGNED',
  in_progress: 'IN_PROGRESS',
  on_hold: 'ON_HOLD',
  pending_parts: 'PENDING_PARTS',
  pending_approval: 'PENDING_APPROVAL',
  completed: 'COMPLETED',
  cancelled: 'CANCELLED',
  closed: 'CLOSED',
};

const STATUS_API_TO_UI: Record<string, WorkOrder['status']> = {
  OPEN: 'open',
  ASSIGNED: 'assigned',
  IN_PROGRESS: 'in_progress',
  ON_HOLD: 'on_hold',
  PENDING_PARTS: 'pending_parts',
  PENDING_APPROVAL: 'pending_approval',
  COMPLETED: 'completed',
  CANCELLED: 'cancelled',
  CLOSED: 'closed',
};

const PRIORITY_UI_TO_API: Record<WorkOrder['priority'], string> = {
  low: 'LOW',
  medium: 'MEDIUM',
  high: 'HIGH',
  critical: 'CRITICAL',
};

const PRIORITY_API_TO_UI: Record<string, WorkOrder['priority']> = {
  LOW: 'low',
  MEDIUM: 'medium',
  HIGH: 'high',
  CRITICAL: 'critical',
};

function toStringValue(value: unknown, fallback = ''): string {
  return typeof value === 'string' ? value : fallback;
}

function toNumberValue(value: unknown): number | undefined {
  return typeof value === 'number' && Number.isFinite(value) ? value : undefined;
}

function mapApiStatusToUi(value: unknown): WorkOrder['status'] {
  const key = toStringValue(value).toUpperCase();
  return STATUS_API_TO_UI[key] ?? 'open';
}

function mapApiPriorityToUi(value: unknown): WorkOrder['priority'] {
  const key = toStringValue(value).toUpperCase();
  return PRIORITY_API_TO_UI[key] ?? 'medium';
}

function mapUiStatusToApi(value?: string): string | undefined {
  if (!value) return undefined;
  return STATUS_UI_TO_API[value as WorkOrder['status']] ?? value.toUpperCase();
}

function mapUiPriorityToApi(value?: string): string | undefined {
  if (!value) return undefined;
  return PRIORITY_UI_TO_API[value as WorkOrder['priority']] ?? value.toUpperCase();
}

function mapWorkOrder(raw: Record<string, unknown>): WorkOrder {
  return {
    workOrderId: toStringValue(raw['workOrderId']),
    assetId: toStringValue(raw['assetId']),
    assetTag: toStringValue(raw['assetTag']),
    title: toStringValue(raw['title']),
    description: toStringValue(raw['description']),
    priority: mapApiPriorityToUi(raw['priority']),
    status: mapApiStatusToUi(raw['status']),
    assignedTo: toStringValue(raw['assignedTo']) || undefined,
    assignedToName: toStringValue(raw['assignedToName']) || undefined,
    createdBy: toStringValue(raw['createdBy']),
    createdAt: toStringValue(raw['createdAt']),
    completedAt: toStringValue(raw['completedAt']) || undefined,
    estimatedHours: toNumberValue(raw['estimatedHours']),
    actualHours: toNumberValue(raw['actualHours']),
  };
}

// ============================================================================
// Work Order API Functions
// ============================================================================

export async function listWorkOrders(filters: WorkOrderListFilters = {}): Promise<WorkOrder[]> {
  const params = new URLSearchParams();
  const mappedStatus = mapUiStatusToApi(filters.status);
  const mappedPriority = mapUiPriorityToApi(filters.priority);
  if (mappedStatus) params.set('status', mappedStatus);
  if (mappedPriority) params.set('priority', mappedPriority);
  if (filters.buildingId) params.set('buildingId', filters.buildingId);
  if (filters.building) params.set('building', filters.building);
  const query = params.toString() ? `?${params.toString()}` : '';
  const response = await apiClient.get<Record<string, unknown>[] | { items: Record<string, unknown>[] }>(`/eam/work-orders${query}`);
  if (!response.success || !response.data) {
    throw new ApiError(
      response.error?.code || 'FETCH_FAILED',
      response.error?.message || 'Failed to fetch work orders',
      400,
      response.requestId
    );
  }
  const data = response.data;
  const items = Array.isArray(data) ? data : data.items ?? [];
  return items.map(mapWorkOrder);
}

export async function getWorkOrder(workOrderId: string): Promise<WorkOrder> {
  const response = await apiClient.get<Record<string, unknown>>(`/eam/work-orders/${workOrderId}`);
  if (!response.success || !response.data) {
    throw new ApiError(
      response.error?.code || 'FETCH_FAILED',
      response.error?.message || 'Failed to fetch work order',
      400,
      response.requestId
    );
  }
  return mapWorkOrder(response.data);
}

export async function createWorkOrder(data: CreateWorkOrderRequest): Promise<WorkOrder> {
  const workType = (data.workType ?? 'corrective').toUpperCase();
  const payload = {
    ...data,
    workType,
    priority: mapUiPriorityToApi(data.priority),
  };
  const response = await apiClient.post<Record<string, unknown>>('/eam/work-orders', payload);
  if (!response.success || !response.data) {
    throw new ApiError(
      response.error?.code || 'CREATE_FAILED',
      response.error?.message || 'Failed to create work order',
      400,
      response.requestId
    );
  }
  return mapWorkOrder(response.data);
}

export async function assignWorkOrder(workOrderId: string, assignedTo: string): Promise<WorkOrder> {
  const response = await apiClient.post<Record<string, unknown>>(`/eam/work-orders/${workOrderId}/assign`, { assignedTo });
  if (!response.success || !response.data) {
    throw new ApiError(
      response.error?.code || 'ASSIGN_FAILED',
      response.error?.message || 'Failed to assign work order',
      400,
      response.requestId
    );
  }
  return mapWorkOrder(response.data);
}

export async function completeWorkOrder(workOrderId: string, actualHours?: number): Promise<WorkOrder> {
  const response = await apiClient.post<Record<string, unknown>>(`/eam/work-orders/${workOrderId}/complete`, { actualHours });
  if (!response.success || !response.data) {
    throw new ApiError(
      response.error?.code || 'COMPLETE_FAILED',
      response.error?.message || 'Failed to complete work order',
      400,
      response.requestId
    );
  }
  return mapWorkOrder(response.data);
}

// ============================================================================
// Maintenance Plan API Functions
// ============================================================================

export async function listMaintenancePlans(status?: string): Promise<MaintenancePlan[]> {
  const query = status ? `?status=${status}` : '';
  const response = await apiClient.get<MaintenancePlan[] | { items: MaintenancePlan[] }>(`/eam/maintenance-plans${query}`);
  if (!response.success || !response.data) {
    throw new ApiError(
      response.error?.code || 'FETCH_FAILED',
      response.error?.message || 'Failed to fetch maintenance plans',
      400,
      response.requestId
    );
  }
  const data = response.data;
  return Array.isArray(data) ? data : data.items ?? [];
}

export async function getMaintenancePlan(planId: string): Promise<MaintenancePlan> {
  const response = await apiClient.get<MaintenancePlan>(`/eam/maintenance-plans/${planId}`);
  if (!response.success || !response.data) {
    throw new ApiError(
      response.error?.code || 'FETCH_FAILED',
      response.error?.message || 'Failed to fetch maintenance plan',
      400,
      response.requestId
    );
  }
  return response.data;
}

export async function createMaintenancePlan(data: CreateMaintenancePlanRequest): Promise<MaintenancePlan> {
  const response = await apiClient.post<MaintenancePlan>('/eam/maintenance-plans', data);
  if (!response.success || !response.data) {
    throw new ApiError(
      response.error?.code || 'CREATE_FAILED',
      response.error?.message || 'Failed to create maintenance plan',
      400,
      response.requestId
    );
  }
  return response.data;
}

export async function updateMaintenancePlan(planId: string, data: UpdateMaintenancePlanRequest): Promise<MaintenancePlan> {
  const response = await apiClient.put<MaintenancePlan>(`/eam/maintenance-plans/${planId}`, data);
  if (!response.success || !response.data) {
    throw new ApiError(
      response.error?.code || 'UPDATE_FAILED',
      response.error?.message || 'Failed to update maintenance plan',
      400,
      response.requestId
    );
  }
  return response.data;
}

export async function checkDueMaintenance(): Promise<DueMaintenanceResponse> {
  const response = await apiClient.get<DueMaintenanceResponse>('/eam/maintenance-plans/check-due');
  if (!response.success || !response.data) {
    throw new ApiError(
      response.error?.code || 'FETCH_FAILED',
      response.error?.message || 'Failed to check due maintenance',
      400,
      response.requestId
    );
  }
  return response.data;
}


// ============================================================================
// Linear Asset API Functions
// ============================================================================

export async function listLinearAssets(): Promise<LinearAsset[]> {
  const response = await apiClient.get<LinearAsset[] | { items: LinearAsset[] }>('/eam/linear-assets');
  if (!response.success || !response.data) {
    throw new ApiError(
      response.error?.code || 'FETCH_FAILED',
      response.error?.message || 'Failed to fetch linear assets',
      400,
      response.requestId
    );
  }
  const data = response.data;
  return Array.isArray(data) ? data : data.items ?? [];
}

export async function getLinearAsset(linearAssetId: string): Promise<LinearAsset> {
  const response = await apiClient.get<LinearAsset>(`/eam/linear-assets/${linearAssetId}`);
  if (!response.success || !response.data) {
    throw new ApiError(
      response.error?.code || 'FETCH_FAILED',
      response.error?.message || 'Failed to fetch linear asset',
      400,
      response.requestId
    );
  }
  return response.data;
}

export async function createLinearAsset(data: CreateLinearAssetRequest): Promise<LinearAsset> {
  const response = await apiClient.post<LinearAsset>('/eam/linear-assets', data);
  if (!response.success || !response.data) {
    throw new ApiError(
      response.error?.code || 'CREATE_FAILED',
      response.error?.message || 'Failed to create linear asset',
      400,
      response.requestId
    );
  }
  return response.data;
}

export async function listSegments(linearAssetId: string): Promise<LinearSegment[]> {
  const response = await apiClient.get<LinearSegment[] | { items: LinearSegment[] }>(`/eam/linear-assets/${linearAssetId}/segments`);
  if (!response.success || !response.data) {
    throw new ApiError(
      response.error?.code || 'FETCH_FAILED',
      response.error?.message || 'Failed to fetch segments',
      400,
      response.requestId
    );
  }
  const data = response.data;
  return Array.isArray(data) ? data : data.items ?? [];
}

export async function updateSegment(linearAssetId: string, segmentId: string, data: UpdateSegmentRequest): Promise<LinearSegment> {
  const response = await apiClient.put<LinearSegment>(`/eam/linear-assets/${linearAssetId}/segments/${segmentId}`, data);
  if (!response.success || !response.data) {
    throw new ApiError(
      response.error?.code || 'UPDATE_FAILED',
      response.error?.message || 'Failed to update segment',
      400,
      response.requestId
    );
  }
  return response.data;
}

// ============================================================================
// Parts Inventory API Functions
// ============================================================================

export async function checkPartLevels(): Promise<PartLevel[]> {
  const response = await apiClient.get<PartLevel[] | { items: PartLevel[] }>('/eam/parts/levels');
  if (!response.success || !response.data) {
    throw new ApiError(
      response.error?.code || 'FETCH_FAILED',
      response.error?.message || 'Failed to fetch part levels',
      400,
      response.requestId
    );
  }
  const data = response.data;
  return Array.isArray(data) ? data : data.items ?? [];
}

export async function reserveParts(data: ReservePartsRequest): Promise<PartLevel> {
  const response = await apiClient.post<PartLevel>('/eam/parts/reserve', data);
  if (!response.success || !response.data) {
    throw new ApiError(
      response.error?.code || 'RESERVE_FAILED',
      response.error?.message || 'Failed to reserve parts',
      400,
      response.requestId
    );
  }
  return response.data;
}

export async function consumeParts(data: ConsumePartsRequest): Promise<PartLevel> {
  const response = await apiClient.post<PartLevel>('/eam/parts/consume', data);
  if (!response.success || !response.data) {
    throw new ApiError(
      response.error?.code || 'CONSUME_FAILED',
      response.error?.message || 'Failed to consume parts',
      400,
      response.requestId
    );
  }
  return response.data;
}
