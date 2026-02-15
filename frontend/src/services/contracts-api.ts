/**
 * Contracts API Service
 *
 * Provides methods for interacting with the Lifecycle Service contract endpoints.
 * Handles contract CRUD operations.
 *
 * Implements Task 6.2: Create contracts API client
 * Validates: Requirement 5.2
 */

import { apiClient, ApiError } from './api-client';

// ============================================================================
// Types
// ============================================================================

export interface Contract {
  contractId: string;
  vendorId: string;
  vendorName?: string;
  contractNumber: string;
  contractType: string;
  status: string;
  startDate: string;
  endDate: string;
  totalValue: number;
  description?: string;
  terms?: string;
  createdAt: string;
  updatedAt: string;
}

export interface CreateContractRequest {
  vendorId: string;
  contractNumber: string;
  contractType: string;
  startDate: string;
  endDate: string;
  totalValue: number;
  description?: string;
  terms?: string;
}

export interface UpdateContractRequest {
  contractType?: string;
  status?: string;
  startDate?: string;
  endDate?: string;
  totalValue?: number;
  description?: string;
  terms?: string;
}

export interface ContractsResponse {
  contracts: Contract[];
  total: number;
}

// ============================================================================
// API Functions
// ============================================================================

/**
 * Get contracts, optionally filtered by vendor
 */
export async function getContracts(
  vendorId?: string
): Promise<ContractsResponse> {
  const queryString = vendorId ? `?vendorId=${encodeURIComponent(vendorId)}` : '';
  const response = await apiClient.get<ContractsResponse>(
    `/lifecycle/contracts${queryString}`
  );

  if (!response.success || !response.data) {
    throw new ApiError(
      response.error?.code || 'FETCH_FAILED',
      response.error?.message || 'Failed to fetch contracts',
      400,
      response.requestId
    );
  }

  return response.data;
}

/**
 * Create a new contract
 */
export async function createContract(
  data: CreateContractRequest
): Promise<Contract> {
  const response = await apiClient.post<Contract>(
    '/lifecycle/contracts',
    data
  );

  if (!response.success || !response.data) {
    throw new ApiError(
      response.error?.code || 'CREATE_FAILED',
      response.error?.message || 'Failed to create contract',
      400,
      response.requestId
    );
  }

  return response.data;
}

/**
 * Update an existing contract
 */
export async function updateContract(
  contractId: string,
  data: UpdateContractRequest
): Promise<Contract> {
  const response = await apiClient.put<Contract>(
    `/lifecycle/contracts/${contractId}`,
    data
  );

  if (!response.success || !response.data) {
    throw new ApiError(
      response.error?.code || 'UPDATE_FAILED',
      response.error?.message || 'Failed to update contract',
      400,
      response.requestId
    );
  }

  return response.data;
}

export const contractsApi = {
  getAll: getContracts,
  create: createContract,
  update: updateContract,
};

export default contractsApi;
