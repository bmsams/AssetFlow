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
  status: 'open' | 'assigned' | 'in_progress' | 'completed' | 'cancelled';
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
  assetTag: string;
  name: string;
  description: string;
  frequency: string;
  lastExecuted?: string;
  nextDue?: string;
  status: 'active' | 'paused' | 'completed';
  tasks: MaintenanceTask[];
}

export interface MaintenanceTask {
  taskId: string;
  description: string;
  estimatedMinutes: number;
  completed: boolean;
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
  title: string;
  description: string;
  priority: 'low' | 'medium' | 'high' | 'critical';
  estimatedHours?: number;
}

export interface CreateMaintenancePlanRequest {
  assetId: string;
  name: string;
  description: string;
  frequency: string;
  tasks: Array<{ description: string; estimatedMinutes: number }>;
}

export interface UpdateMaintenancePlanRequest {
  name?: string;
  description?: string;
  frequency?: string;
  status?: 'active' | 'paused' | 'completed';
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

// ============================================================================
// Work Order API Functions
// ============================================================================

export async function listWorkOrders(status?: string, priority?: string): Promise<WorkOrder[]> {
  const params = new URLSearchParams();
  if (status) params.set('status', status);
  if (priority) params.set('priority', priority);
  const query = params.toString() ? `?${params.toString()}` : '';
  const response = await apiClient.get<WorkOrder[]>(`/eam/work-orders${query}`);
  if (!response.success || !response.data) {
    throw new ApiError(
      response.error?.code || 'FETCH_FAILED',
      response.error?.message || 'Failed to fetch work orders',
      400,
      response.requestId
    );
  }
  return response.data;
}

export async function getWorkOrder(workOrderId: string): Promise<WorkOrder> {
  const response = await apiClient.get<WorkOrder>(`/eam/work-orders/${workOrderId}`);
  if (!response.success || !response.data) {
    throw new ApiError(
      response.error?.code || 'FETCH_FAILED',
      response.error?.message || 'Failed to fetch work order',
      400,
      response.requestId
    );
  }
  return response.data;
}

export async function createWorkOrder(data: CreateWorkOrderRequest): Promise<WorkOrder> {
  const response = await apiClient.post<WorkOrder>('/eam/work-orders', data);
  if (!response.success || !response.data) {
    throw new ApiError(
      response.error?.code || 'CREATE_FAILED',
      response.error?.message || 'Failed to create work order',
      400,
      response.requestId
    );
  }
  return response.data;
}

export async function assignWorkOrder(workOrderId: string, assignedTo: string): Promise<WorkOrder> {
  const response = await apiClient.post<WorkOrder>(`/eam/work-orders/${workOrderId}/assign`, { assignedTo });
  if (!response.success || !response.data) {
    throw new ApiError(
      response.error?.code || 'ASSIGN_FAILED',
      response.error?.message || 'Failed to assign work order',
      400,
      response.requestId
    );
  }
  return response.data;
}

export async function completeWorkOrder(workOrderId: string, actualHours?: number): Promise<WorkOrder> {
  const response = await apiClient.post<WorkOrder>(`/eam/work-orders/${workOrderId}/complete`, { actualHours });
  if (!response.success || !response.data) {
    throw new ApiError(
      response.error?.code || 'COMPLETE_FAILED',
      response.error?.message || 'Failed to complete work order',
      400,
      response.requestId
    );
  }
  return response.data;
}

// ============================================================================
// Maintenance Plan API Functions
// ============================================================================

export async function listMaintenancePlans(status?: string): Promise<MaintenancePlan[]> {
  const query = status ? `?status=${status}` : '';
  const response = await apiClient.get<MaintenancePlan[]>(`/eam/maintenance-plans${query}`);
  if (!response.success || !response.data) {
    throw new ApiError(
      response.error?.code || 'FETCH_FAILED',
      response.error?.message || 'Failed to fetch maintenance plans',
      400,
      response.requestId
    );
  }
  return response.data;
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

export async function checkDueMaintenance(): Promise<MaintenancePlan[]> {
  const response = await apiClient.get<MaintenancePlan[]>('/eam/maintenance-plans/check-due');
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
  const response = await apiClient.get<LinearAsset[]>('/eam/linear-assets');
  if (!response.success || !response.data) {
    throw new ApiError(
      response.error?.code || 'FETCH_FAILED',
      response.error?.message || 'Failed to fetch linear assets',
      400,
      response.requestId
    );
  }
  return response.data;
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
  const response = await apiClient.get<LinearSegment[]>(`/eam/linear-assets/${linearAssetId}/segments`);
  if (!response.success || !response.data) {
    throw new ApiError(
      response.error?.code || 'FETCH_FAILED',
      response.error?.message || 'Failed to fetch segments',
      400,
      response.requestId
    );
  }
  return response.data;
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
  const response = await apiClient.get<PartLevel[]>('/eam/parts/levels');
  if (!response.success || !response.data) {
    throw new ApiError(
      response.error?.code || 'FETCH_FAILED',
      response.error?.message || 'Failed to fetch part levels',
      400,
      response.requestId
    );
  }
  return response.data;
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
