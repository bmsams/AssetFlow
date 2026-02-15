/**
 * Lifecycle API Service
 *
 * Provides methods for interacting with the Lifecycle Service endpoints
 * for deployment, retirement, and disposal operations.
 *
 * Implements Task 14.2: Create lifecycle API client
 * Validates: Requirements 12.1, 12.2
 */

import { apiClient, ApiError } from './api-client';

// ============================================================================
// Types
// ============================================================================

export interface DeployAssetRequest {
  assetId: string;
  assignedTo?: string;
  location?: string;
  notes?: string;
}

export interface DeploymentResponse {
  assetId: string;
  status: string;
  deployedAt: string;
  assignedTo?: string;
}

export interface RetirementRequest {
  assetId: string;
  reason: string;
  notes?: string;
}

export interface RetirementResponse {
  assetId: string;
  status: string;
  retiredAt: string;
  reason: string;
}

export interface DisposalResponse {
  assetId: string;
  status: string;
  disposedAt: string;
}

// ============================================================================
// API Functions
// ============================================================================

/**
 * Deploy an asset
 */
export async function deployAsset(data: DeployAssetRequest): Promise<DeploymentResponse> {
  const response = await apiClient.post<DeploymentResponse>('/lifecycle/deploy', data);

  if (!response.success || !response.data) {
    throw new ApiError(
      response.error?.code || 'DEPLOY_FAILED',
      response.error?.message || 'Failed to deploy asset',
      400,
      response.requestId
    );
  }

  return response.data;
}

/**
 * Initiate retirement for an asset
 */
export async function initiateRetirement(data: RetirementRequest): Promise<RetirementResponse> {
  const response = await apiClient.post<RetirementResponse>('/lifecycle/retirement', data);

  if (!response.success || !response.data) {
    throw new ApiError(
      response.error?.code || 'RETIREMENT_FAILED',
      response.error?.message || 'Failed to initiate retirement',
      400,
      response.requestId
    );
  }

  return response.data;
}

/**
 * Complete disposal for an asset
 */
export async function completeDisposal(assetId: string): Promise<DisposalResponse> {
  const response = await apiClient.post<DisposalResponse>(
    `/lifecycle/disposal/${assetId}/complete`
  );

  if (!response.success || !response.data) {
    throw new ApiError(
      response.error?.code || 'DISPOSAL_FAILED',
      response.error?.message || 'Failed to complete disposal',
      400,
      response.requestId
    );
  }

  return response.data;
}

export const lifecycleApi = {
  deploy: deployAsset,
  retire: initiateRetirement,
  dispose: completeDisposal,
};

export default lifecycleApi;
