/**
 * Contract Service - Business logic layer for contract management
 *
 * Implements:
 * - Contract creation and management (Requirement 6A.1)
 * - Support for all contract types (Requirement 6A.2)
 * - Linking contracts to assets and entitlements (Requirement 6A.3)
 */

import type { PaginatedResult, PaginationParams, UUID } from '@ams/types';
import * as cache from '@ams/cache';
import { publishEvent } from '@ams/events';
import { createLogger, now } from '@ams/utils';

import type {
  Contract,
  ContractAssetLink,
  ContractEntitlementLink,
  ContractStatus,
  ContractType,
  CreateContractInput,
  UpdateContractInput,
} from './contract-repository';
import * as repository from './contract-repository';

const logger = createLogger({ service: 'contract-service' });

/**
 * Valid contract types
 * Requirement 6A.2: Support contract types: Purchase, Lease, Maintenance, Support, License, Warranty
 */
export const VALID_CONTRACT_TYPES: ContractType[] = [
  'PURCHASE',
  'LEASE',
  'MAINTENANCE',
  'SUPPORT',
  'LICENSE',
  'WARRANTY',
];

/**
 * Valid contract statuses
 */
export const VALID_CONTRACT_STATUSES: ContractStatus[] = [
  'DRAFT',
  'PENDING_APPROVAL',
  'ACTIVE',
  'EXPIRED',
  'TERMINATED',
  'RENEWED',
];

/**
 * Valid status transitions
 */
export const VALID_STATUS_TRANSITIONS: Record<ContractStatus, ContractStatus[]> = {
  DRAFT: ['PENDING_APPROVAL', 'ACTIVE', 'TERMINATED'],
  PENDING_APPROVAL: ['ACTIVE', 'DRAFT', 'TERMINATED'],
  ACTIVE: ['EXPIRED', 'TERMINATED', 'RENEWED'],
  EXPIRED: ['RENEWED', 'TERMINATED'],
  TERMINATED: [], // Terminal state
  RENEWED: [], // Terminal state (new contract created)
};

/**
 * Contract with linked assets and entitlements
 */
export interface ContractWithLinks {
  readonly contract: Contract;
  readonly assets: ContractAssetLink[];
  readonly entitlements: ContractEntitlementLink[];
}

/**
 * Cache key for contract
 */
function contractCacheKey(contractId: UUID): string {
  return `contract:${contractId}`;
}

/**
 * Cache key for vendor contracts
 */
function vendorContractsCacheKey(vendorId: UUID): string {
  return `vendor:${vendorId}:contracts`;
}

/**
 * Create a new contract
 * Requirement 6A.1: Store contracts with vendor, type, dates, value, and terms
 * Requirement 6A.2: Support all contract types
 */
export async function createContract(input: CreateContractInput): Promise<Contract> {
  logger.info('Creating contract', {
    vendorId: input.vendorId,
    contractType: input.contractType,
  });

  // Validate contract type
  if (!VALID_CONTRACT_TYPES.includes(input.contractType)) {
    throw new Error(`Invalid contract type: ${input.contractType}. Must be one of: ${VALID_CONTRACT_TYPES.join(', ')}`);
  }

  // Validate dates
  const startDate = new Date(input.startDate);
  const endDate = new Date(input.endDate);

  if (isNaN(startDate.getTime())) {
    throw new Error('Invalid start date format');
  }

  if (isNaN(endDate.getTime())) {
    throw new Error('Invalid end date format');
  }

  if (endDate <= startDate) {
    throw new Error('End date must be after start date');
  }

  // Validate total value if provided
  if (input.totalValue !== undefined && input.totalValue < 0) {
    throw new Error('Total value cannot be negative');
  }

  // Validate cancellation notice days if provided
  if (input.cancellationNoticeDays !== undefined && input.cancellationNoticeDays < 0) {
    throw new Error('Cancellation notice days cannot be negative');
  }

  // Create the contract
  const contract = await repository.createContract(input);

  // Invalidate vendor contracts cache
  await cache.del(vendorContractsCacheKey(input.vendorId));

  // Publish contract created event
  await publishEvent('CONTRACT_CREATED', {
    contractId: contract.contractId,
    contractNumber: contract.contractNumber,
    vendorId: contract.vendorId,
    contractType: contract.contractType,
    startDate: contract.startDate,
    endDate: contract.endDate,
    totalValue: contract.totalValue,
    status: contract.status,
  });

  logger.info('Contract created', {
    contractId: contract.contractId,
    contractNumber: contract.contractNumber,
    contractType: contract.contractType,
  });

  return contract;
}

/**
 * Update an existing contract
 */
export async function updateContract(
  contractId: UUID,
  input: UpdateContractInput
): Promise<Contract> {
  logger.info('Updating contract', { contractId });

  // Get existing contract
  const existingContract = await repository.getContractById(contractId);
  if (!existingContract) {
    throw new Error(`Contract not found: ${contractId}`);
  }

  // Validate contract type if provided
  if (input.contractType && !VALID_CONTRACT_TYPES.includes(input.contractType)) {
    throw new Error(`Invalid contract type: ${input.contractType}. Must be one of: ${VALID_CONTRACT_TYPES.join(', ')}`);
  }

  // Validate status transition if status is being changed
  if (input.status && input.status !== existingContract.status) {
    const allowedTransitions = VALID_STATUS_TRANSITIONS[existingContract.status];
    if (!allowedTransitions.includes(input.status)) {
      throw new Error(
        `Invalid status transition from ${existingContract.status} to ${input.status}. ` +
        `Allowed transitions: ${allowedTransitions.join(', ') || 'none'}`
      );
    }
  }

  // Validate dates if provided
  const startDate = input.startDate ? new Date(input.startDate) : new Date(existingContract.startDate);
  const endDate = input.endDate ? new Date(input.endDate) : new Date(existingContract.endDate);

  if (input.startDate && isNaN(startDate.getTime())) {
    throw new Error('Invalid start date format');
  }

  if (input.endDate && isNaN(endDate.getTime())) {
    throw new Error('Invalid end date format');
  }

  if (endDate <= startDate) {
    throw new Error('End date must be after start date');
  }

  // Validate total value if provided
  if (input.totalValue !== undefined && input.totalValue < 0) {
    throw new Error('Total value cannot be negative');
  }

  // Update the contract
  const updatedContract = await repository.updateContract(contractId, input);
  if (!updatedContract) {
    throw new Error(`Failed to update contract: ${contractId}`);
  }

  // Invalidate caches
  await cache.del(contractCacheKey(contractId));
  await cache.del(vendorContractsCacheKey(existingContract.vendorId));
  if (input.vendorId && input.vendorId !== existingContract.vendorId) {
    await cache.del(vendorContractsCacheKey(input.vendorId));
  }

  // Publish contract updated event
  await publishEvent('CONTRACT_UPDATED', {
    contractId: updatedContract.contractId,
    contractNumber: updatedContract.contractNumber,
    vendorId: updatedContract.vendorId,
    contractType: updatedContract.contractType,
    status: updatedContract.status,
    previousStatus: existingContract.status,
    changes: Object.keys(input),
  });

  logger.info('Contract updated', {
    contractId: updatedContract.contractId,
    status: updatedContract.status,
  });

  return updatedContract;
}

/**
 * Get contract by ID
 */
export async function getContract(contractId: UUID): Promise<Contract | null> {
  return repository.getContractById(contractId);
}

/**
 * Get contract by ID with linked assets and entitlements
 */
export async function getContractWithLinks(contractId: UUID): Promise<ContractWithLinks | null> {
  const contract = await repository.getContractById(contractId);
  if (!contract) {
    return null;
  }

  const [assets, entitlements] = await Promise.all([
    repository.getContractAssets(contractId),
    repository.getContractEntitlements(contractId),
  ]);

  return {
    contract,
    assets,
    entitlements,
  };
}

/**
 * Get contract by contract number
 */
export async function getContractByNumber(contractNumber: string): Promise<Contract | null> {
  return repository.getContractByNumber(contractNumber);
}

/**
 * Get contracts by vendor
 * Requirement 6A.1: Store contracts with vendor
 */
export async function getContractsByVendor(
  vendorId: UUID,
  pagination: PaginationParams = {},
  statusFilter?: ContractStatus[],
  typeFilter?: ContractType[]
): Promise<PaginatedResult<Contract>> {
  logger.info('Getting contracts by vendor', {
    vendorId,
    statusFilter,
    typeFilter,
  });

  return repository.getContractsByVendor(vendorId, pagination, statusFilter, typeFilter);
}

/**
 * Get all contracts with optional filters
 */
export async function getContracts(
  pagination: PaginationParams = {},
  statusFilter?: ContractStatus[],
  typeFilter?: ContractType[]
): Promise<PaginatedResult<Contract>> {
  return repository.getContracts(pagination, statusFilter, typeFilter);
}

/**
 * Link contract to asset
 * Requirement 6A.3: Link contracts to associated assets
 */
export async function linkContractToAsset(
  contractId: UUID,
  assetId: UUID,
  linkType: string = 'COVERED',
  startDate?: string,
  endDate?: string,
  notes?: string
): Promise<ContractAssetLink> {
  logger.info('Linking contract to asset', {
    contractId,
    assetId,
    linkType,
  });

  // Verify contract exists
  const contract = await repository.getContractById(contractId);
  if (!contract) {
    throw new Error(`Contract not found: ${contractId}`);
  }

  const link = await repository.linkContractToAsset(
    contractId,
    assetId,
    linkType,
    startDate,
    endDate,
    notes
  );

  // Invalidate contract cache
  await cache.del(contractCacheKey(contractId));

  // Publish event
  await publishEvent('CONTRACT_ASSET_LINKED', {
    contractId,
    contractNumber: contract.contractNumber,
    assetId,
    linkType,
  });

  return link;
}

/**
 * Unlink contract from asset
 */
export async function unlinkContractFromAsset(
  contractId: UUID,
  assetId: UUID
): Promise<boolean> {
  logger.info('Unlinking contract from asset', {
    contractId,
    assetId,
  });

  const result = await repository.unlinkContractFromAsset(contractId, assetId);

  if (result) {
    // Invalidate contract cache
    await cache.del(contractCacheKey(contractId));

    // Publish event
    await publishEvent('CONTRACT_ASSET_UNLINKED', {
      contractId,
      assetId,
    });
  }

  return result;
}

/**
 * Get assets linked to a contract
 */
export async function getContractAssets(contractId: UUID): Promise<ContractAssetLink[]> {
  return repository.getContractAssets(contractId);
}

/**
 * Link contract to entitlement
 * Requirement 6A.3: Link contracts to associated entitlements
 */
export async function linkContractToEntitlement(
  contractId: UUID,
  entitlementId: UUID,
  linkType: string = 'LICENSE',
  startDate?: string,
  endDate?: string,
  notes?: string
): Promise<ContractEntitlementLink> {
  logger.info('Linking contract to entitlement', {
    contractId,
    entitlementId,
    linkType,
  });

  // Verify contract exists
  const contract = await repository.getContractById(contractId);
  if (!contract) {
    throw new Error(`Contract not found: ${contractId}`);
  }

  const link = await repository.linkContractToEntitlement(
    contractId,
    entitlementId,
    linkType,
    startDate,
    endDate,
    notes
  );

  // Invalidate contract cache
  await cache.del(contractCacheKey(contractId));

  // Publish event
  await publishEvent('CONTRACT_ENTITLEMENT_LINKED', {
    contractId,
    contractNumber: contract.contractNumber,
    entitlementId,
    linkType,
  });

  return link;
}

/**
 * Unlink contract from entitlement
 */
export async function unlinkContractFromEntitlement(
  contractId: UUID,
  entitlementId: UUID
): Promise<boolean> {
  logger.info('Unlinking contract from entitlement', {
    contractId,
    entitlementId,
  });

  const result = await repository.unlinkContractFromEntitlement(contractId, entitlementId);

  if (result) {
    // Invalidate contract cache
    await cache.del(contractCacheKey(contractId));

    // Publish event
    await publishEvent('CONTRACT_ENTITLEMENT_UNLINKED', {
      contractId,
      entitlementId,
    });
  }

  return result;
}

/**
 * Get entitlements linked to a contract
 */
export async function getContractEntitlements(contractId: UUID): Promise<ContractEntitlementLink[]> {
  return repository.getContractEntitlements(contractId);
}

/**
 * Activate a contract
 */
export async function activateContract(
  contractId: UUID,
  updatedBy?: UUID
): Promise<Contract> {
  logger.info('Activating contract', { contractId });

  const contract = await repository.getContractById(contractId);
  if (!contract) {
    throw new Error(`Contract not found: ${contractId}`);
  }

  if (contract.status === 'ACTIVE') {
    return contract;
  }

  const allowedStatuses: ContractStatus[] = ['DRAFT', 'PENDING_APPROVAL'];
  if (!allowedStatuses.includes(contract.status)) {
    throw new Error(`Cannot activate contract in status: ${contract.status}`);
  }

  return updateContract(contractId, {
    status: 'ACTIVE',
    effectiveDate: now(),
    updatedBy,
  });
}

/**
 * Terminate a contract
 */
export async function terminateContract(
  contractId: UUID,
  reason: string,
  updatedBy?: UUID
): Promise<Contract> {
  logger.info('Terminating contract', { contractId, reason });

  const contract = await repository.getContractById(contractId);
  if (!contract) {
    throw new Error(`Contract not found: ${contractId}`);
  }

  if (contract.status === 'TERMINATED') {
    return contract;
  }

  const terminalStatuses: ContractStatus[] = ['TERMINATED', 'RENEWED'];
  if (terminalStatuses.includes(contract.status)) {
    throw new Error(`Cannot terminate contract in status: ${contract.status}`);
  }

  return updateContract(contractId, {
    status: 'TERMINATED',
    terminationDate: now(),
    terminationReason: reason,
    updatedBy,
  });
}

/**
 * Get contracts expiring within a specified number of days
 */
export async function getExpiringContracts(
  daysUntilExpiration: number
): Promise<Contract[]> {
  logger.info('Getting expiring contracts', { daysUntilExpiration });

  return repository.getExpiringContracts(daysUntilExpiration);
}

// Re-export types
export type {
  Contract,
  ContractAssetLink,
  ContractEntitlementLink,
  ContractStatus,
  ContractType,
  CreateContractInput,
  RenewalType,
  UpdateContractInput,
} from './contract-repository';

