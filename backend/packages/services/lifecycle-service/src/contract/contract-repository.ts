/**
 * Contract Repository - Data access layer for contract operations
 *
 * Implements database operations for:
 * - Contract creation and management (Requirement 6A.1)
 * - Contract types support (Requirement 6A.2)
 * - Contract-asset/entitlement linking (Requirement 6A.3)
 */

import type { PaginatedResult, PaginationParams, UUID } from '@ams/types';
import { queryMany, queryOne } from '@ams/database';
import { createLogger, now } from '@ams/utils';

const logger = createLogger({ service: 'contract-repository' });

/**
 * Contract types
 * Requirement 6A.2: Support contract types: Purchase, Lease, Maintenance, Support, License, Warranty
 */
export type ContractType =
  | 'PURCHASE'
  | 'LEASE'
  | 'MAINTENANCE'
  | 'SUPPORT'
  | 'LICENSE'
  | 'WARRANTY';

/**
 * Contract status
 */
export type ContractStatus =
  | 'DRAFT'
  | 'PENDING_APPROVAL'
  | 'ACTIVE'
  | 'EXPIRED'
  | 'TERMINATED'
  | 'RENEWED';

/**
 * Renewal type
 */
export type RenewalType = 'NONE' | 'MANUAL' | 'AUTO_RENEW' | 'EVERGREEN' | 'NEGOTIATED';

/**
 * Contract entity
 * Requirement 6A.1: Store contracts with vendor, type, dates, value, and terms
 */
export interface Contract {
  readonly contractId: UUID;
  readonly contractNumber: string;
  readonly contractName: string | null;
  readonly description: string | null;
  readonly vendorId: UUID;
  readonly contractType: ContractType;
  readonly startDate: string;
  readonly endDate: string;
  readonly totalValue: number | null;
  readonly status: ContractStatus;

  // Terms (Requirement 6A.1)
  readonly paymentTerms: string | null;
  readonly renewalType: RenewalType | null;
  readonly autoRenewal: boolean;
  readonly cancellationNoticeDays: number | null;
  readonly slaTerms: string | null;

  // Additional fields
  readonly currency: string;
  readonly annualValue: number | null;
  readonly remainingValue: number | null;
  readonly documentUrl: string | null;
  readonly signedDate: string | null;
  readonly effectiveDate: string | null;
  readonly terminationDate: string | null;
  readonly terminationReason: string | null;
  readonly renewalCount: number;
  readonly previousContractId: UUID | null;
  readonly parentContractId: UUID | null;
  readonly ownerId: UUID | null;
  readonly notes: string | null;
  readonly createdAt: string;
  readonly updatedAt: string;
  readonly createdBy: UUID | null;
  readonly updatedBy: UUID | null;
}

/**
 * Contract-Asset link entity
 * Requirement 6A.3: Link contracts to associated assets
 */
export interface ContractAssetLink {
  readonly linkId: UUID;
  readonly contractId: UUID;
  readonly assetId: UUID;
  readonly linkType: string;
  readonly startDate: string | null;
  readonly endDate: string | null;
  readonly notes: string | null;
  readonly createdAt: string;
}

/**
 * Contract-Entitlement link entity
 * Requirement 6A.3: Link contracts to associated entitlements
 */
export interface ContractEntitlementLink {
  readonly linkId: UUID;
  readonly contractId: UUID;
  readonly entitlementId: UUID;
  readonly linkType: string;
  readonly startDate: string | null;
  readonly endDate: string | null;
  readonly notes: string | null;
  readonly createdAt: string;
}

/**
 * Create contract input
 */
export interface CreateContractInput {
  readonly vendorId: UUID;
  readonly contractType: ContractType;
  readonly contractName?: string;
  readonly description?: string;
  readonly startDate: string;
  readonly endDate: string;
  readonly totalValue?: number;
  readonly paymentTerms?: string;
  readonly renewalType?: RenewalType;
  readonly autoRenewal?: boolean;
  readonly cancellationNoticeDays?: number;
  readonly slaTerms?: string;
  readonly currency?: string;
  readonly annualValue?: number;
  readonly documentUrl?: string;
  readonly signedDate?: string;
  readonly effectiveDate?: string;
  readonly previousContractId?: UUID;
  readonly parentContractId?: UUID;
  readonly ownerId?: UUID;
  readonly notes?: string;
  readonly createdBy?: UUID;
}

/**
 * Update contract input
 */
export interface UpdateContractInput {
  readonly contractName?: string;
  readonly description?: string;
  readonly vendorId?: UUID;
  readonly contractType?: ContractType;
  readonly startDate?: string;
  readonly endDate?: string;
  readonly totalValue?: number;
  readonly status?: ContractStatus;
  readonly paymentTerms?: string;
  readonly renewalType?: RenewalType;
  readonly autoRenewal?: boolean;
  readonly cancellationNoticeDays?: number;
  readonly slaTerms?: string;
  readonly currency?: string;
  readonly annualValue?: number;
  readonly remainingValue?: number;
  readonly documentUrl?: string;
  readonly signedDate?: string;
  readonly effectiveDate?: string;
  readonly terminationDate?: string;
  readonly terminationReason?: string;
  readonly ownerId?: UUID;
  readonly notes?: string;
  readonly updatedBy?: UUID;
}

/**
 * Database row types
 */
interface ContractRow {
  contract_id: string;
  contract_number: string;
  contract_name: string | null;
  description: string | null;
  vendor_id: string;
  contract_type: ContractType;
  start_date: string;
  end_date: string;
  total_value: number | null;
  status: ContractStatus;
  payment_terms: string | null;
  renewal_type: RenewalType | null;
  auto_renewal: boolean;
  cancellation_notice_days: number | null;
  sla_terms: string | null;
  currency: string;
  annual_value: number | null;
  remaining_value: number | null;
  document_url: string | null;
  signed_date: string | null;
  effective_date: string | null;
  termination_date: string | null;
  termination_reason: string | null;
  renewal_count: number;
  previous_contract_id: string | null;
  parent_contract_id: string | null;
  owner_id: string | null;
  notes: string | null;
  created_at: string;
  updated_at: string;
  created_by: string | null;
  updated_by: string | null;
}

interface ContractAssetLinkRow {
  link_id: string;
  contract_id: string;
  asset_id: string;
  link_type: string;
  start_date: string | null;
  end_date: string | null;
  notes: string | null;
  created_at: string;
}

interface ContractEntitlementLinkRow {
  link_id: string;
  contract_id: string;
  entitlement_id: string;
  link_type: string;
  start_date: string | null;
  end_date: string | null;
  notes: string | null;
  created_at: string;
}

/**
 * Map database row to Contract entity
 */
function mapRowToContract(row: ContractRow): Contract {
  return {
    contractId: row.contract_id,
    contractNumber: row.contract_number,
    contractName: row.contract_name,
    description: row.description,
    vendorId: row.vendor_id,
    contractType: row.contract_type,
    startDate: row.start_date,
    endDate: row.end_date,
    totalValue: row.total_value,
    status: row.status,
    paymentTerms: row.payment_terms,
    renewalType: row.renewal_type,
    autoRenewal: row.auto_renewal,
    cancellationNoticeDays: row.cancellation_notice_days,
    slaTerms: row.sla_terms,
    currency: row.currency,
    annualValue: row.annual_value,
    remainingValue: row.remaining_value,
    documentUrl: row.document_url,
    signedDate: row.signed_date,
    effectiveDate: row.effective_date,
    terminationDate: row.termination_date,
    terminationReason: row.termination_reason,
    renewalCount: row.renewal_count,
    previousContractId: row.previous_contract_id,
    parentContractId: row.parent_contract_id,
    ownerId: row.owner_id,
    notes: row.notes,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    createdBy: row.created_by,
    updatedBy: row.updated_by,
  };
}

/**
 * Map database row to ContractAssetLink entity
 */
function mapRowToContractAssetLink(row: ContractAssetLinkRow): ContractAssetLink {
  return {
    linkId: row.link_id,
    contractId: row.contract_id,
    assetId: row.asset_id,
    linkType: row.link_type,
    startDate: row.start_date,
    endDate: row.end_date,
    notes: row.notes,
    createdAt: row.created_at,
  };
}

/**
 * Map database row to ContractEntitlementLink entity
 */
function mapRowToContractEntitlementLink(row: ContractEntitlementLinkRow): ContractEntitlementLink {
  return {
    linkId: row.link_id,
    contractId: row.contract_id,
    entitlementId: row.entitlement_id,
    linkType: row.link_type,
    startDate: row.start_date,
    endDate: row.end_date,
    notes: row.notes,
    createdAt: row.created_at,
  };
}

/**
 * Generate a unique contract number
 */
function generateContractNumber(): string {
  const timestamp = Date.now().toString(36).toUpperCase();
  const random = Math.random().toString(36).substring(2, 6).toUpperCase();
  return `CON-${timestamp}-${random}`;
}

/**
 * Get contract by ID
 */
export async function getContractById(contractId: UUID): Promise<Contract | null> {
  const result = await queryOne<ContractRow>(
    'SELECT * FROM contracts WHERE contract_id = $1',
    [contractId]
  );

  return result ? mapRowToContract(result) : null;
}

/**
 * Get contract by contract number
 */
export async function getContractByNumber(contractNumber: string): Promise<Contract | null> {
  const result = await queryOne<ContractRow>(
    'SELECT * FROM contracts WHERE contract_number = $1',
    [contractNumber]
  );

  return result ? mapRowToContract(result) : null;
}

/**
 * Create a new contract
 * Requirement 6A.1: Store contracts with vendor, type, dates, value, and terms
 * Requirement 6A.2: Support all contract types
 */
export async function createContract(input: CreateContractInput): Promise<Contract> {
  const timestamp = now();
  const contractNumber = generateContractNumber();

  const result = await queryOne<ContractRow>(
    `INSERT INTO contracts (
      contract_number, contract_name, description, vendor_id, contract_type,
      start_date, end_date, total_value, status,
      payment_terms, renewal_type, auto_renewal, cancellation_notice_days, sla_terms,
      currency, annual_value, document_url, signed_date, effective_date,
      previous_contract_id, parent_contract_id, owner_id, notes,
      created_at, updated_at, created_by
    ) VALUES (
      $1, $2, $3, $4, $5,
      $6, $7, $8, 'DRAFT',
      $9, $10, $11, $12, $13,
      $14, $15, $16, $17, $18,
      $19, $20, $21, $22,
      $23, $23, $24
    )
    RETURNING *`,
    [
      contractNumber,
      input.contractName ?? null,
      input.description ?? null,
      input.vendorId,
      input.contractType,
      input.startDate,
      input.endDate,
      input.totalValue ?? null,
      input.paymentTerms ?? null,
      input.renewalType ?? null,
      input.autoRenewal ?? false,
      input.cancellationNoticeDays ?? null,
      input.slaTerms ?? null,
      input.currency ?? 'USD',
      input.annualValue ?? null,
      input.documentUrl ?? null,
      input.signedDate ?? null,
      input.effectiveDate ?? null,
      input.previousContractId ?? null,
      input.parentContractId ?? null,
      input.ownerId ?? null,
      input.notes ?? null,
      timestamp,
      input.createdBy ?? null,
    ]
  );

  if (!result) {
    throw new Error('Failed to create contract');
  }

  logger.info('Contract created', {
    contractId: result.contract_id,
    contractNumber,
    vendorId: input.vendorId,
    contractType: input.contractType,
  });

  return mapRowToContract(result);
}

/**
 * Update a contract
 */
export async function updateContract(
  contractId: UUID,
  input: UpdateContractInput
): Promise<Contract | null> {
  const timestamp = now();

  const result = await queryOne<ContractRow>(
    `UPDATE contracts SET
      contract_name = COALESCE($1, contract_name),
      description = COALESCE($2, description),
      vendor_id = COALESCE($3, vendor_id),
      contract_type = COALESCE($4, contract_type),
      start_date = COALESCE($5, start_date),
      end_date = COALESCE($6, end_date),
      total_value = COALESCE($7, total_value),
      status = COALESCE($8, status),
      payment_terms = COALESCE($9, payment_terms),
      renewal_type = COALESCE($10, renewal_type),
      auto_renewal = COALESCE($11, auto_renewal),
      cancellation_notice_days = COALESCE($12, cancellation_notice_days),
      sla_terms = COALESCE($13, sla_terms),
      currency = COALESCE($14, currency),
      annual_value = COALESCE($15, annual_value),
      remaining_value = COALESCE($16, remaining_value),
      document_url = COALESCE($17, document_url),
      signed_date = COALESCE($18, signed_date),
      effective_date = COALESCE($19, effective_date),
      termination_date = COALESCE($20, termination_date),
      termination_reason = COALESCE($21, termination_reason),
      owner_id = COALESCE($22, owner_id),
      notes = COALESCE($23, notes),
      updated_at = $24,
      updated_by = COALESCE($25, updated_by)
    WHERE contract_id = $26
    RETURNING *`,
    [
      input.contractName ?? null,
      input.description ?? null,
      input.vendorId ?? null,
      input.contractType ?? null,
      input.startDate ?? null,
      input.endDate ?? null,
      input.totalValue ?? null,
      input.status ?? null,
      input.paymentTerms ?? null,
      input.renewalType ?? null,
      input.autoRenewal ?? null,
      input.cancellationNoticeDays ?? null,
      input.slaTerms ?? null,
      input.currency ?? null,
      input.annualValue ?? null,
      input.remainingValue ?? null,
      input.documentUrl ?? null,
      input.signedDate ?? null,
      input.effectiveDate ?? null,
      input.terminationDate ?? null,
      input.terminationReason ?? null,
      input.ownerId ?? null,
      input.notes ?? null,
      timestamp,
      input.updatedBy ?? null,
      contractId,
    ]
  );

  if (result) {
    logger.info('Contract updated', {
      contractId,
      status: result.status,
    });
  }

  return result ? mapRowToContract(result) : null;
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
  const { page = 1, limit = 50 } = pagination;
  const offset = (page - 1) * limit;

  let whereClause = 'WHERE vendor_id = $1';
  const params: (string | number)[] = [vendorId];
  let paramIndex = 2;

  if (statusFilter && statusFilter.length > 0) {
    const statusPlaceholders = statusFilter.map(() => `$${paramIndex++}`).join(', ');
    whereClause += ` AND status IN (${statusPlaceholders})`;
    params.push(...statusFilter);
  }

  if (typeFilter && typeFilter.length > 0) {
    const typePlaceholders = typeFilter.map(() => `$${paramIndex++}`).join(', ');
    whereClause += ` AND contract_type IN (${typePlaceholders})`;
    params.push(...typeFilter);
  }

  const countResult = await queryOne<{ count: string }>(
    `SELECT COUNT(*) as count FROM contracts ${whereClause}`,
    params
  );
  const total = parseInt(countResult?.count ?? '0', 10);

  const rows = await queryMany<ContractRow>(
    `SELECT * FROM contracts ${whereClause}
     ORDER BY end_date ASC, created_at DESC
     LIMIT $${paramIndex++} OFFSET $${paramIndex}`,
    [...params, limit, offset]
  );

  return {
    items: rows.map(mapRowToContract),
    total,
    page,
    limit,
    hasMore: offset + rows.length < total,
  };
}

/**
 * Get all contracts with optional filters
 */
export async function getContracts(
  pagination: PaginationParams = {},
  statusFilter?: ContractStatus[],
  typeFilter?: ContractType[]
): Promise<PaginatedResult<Contract>> {
  const { page = 1, limit = 50 } = pagination;
  const offset = (page - 1) * limit;

  let whereClause = 'WHERE 1=1';
  const params: (string | number)[] = [];
  let paramIndex = 1;

  if (statusFilter && statusFilter.length > 0) {
    const statusPlaceholders = statusFilter.map(() => `$${paramIndex++}`).join(', ');
    whereClause += ` AND status IN (${statusPlaceholders})`;
    params.push(...statusFilter);
  }

  if (typeFilter && typeFilter.length > 0) {
    const typePlaceholders = typeFilter.map(() => `$${paramIndex++}`).join(', ');
    whereClause += ` AND contract_type IN (${typePlaceholders})`;
    params.push(...typeFilter);
  }

  const countResult = await queryOne<{ count: string }>(
    `SELECT COUNT(*) as count FROM contracts ${whereClause}`,
    params
  );
  const total = parseInt(countResult?.count ?? '0', 10);

  const rows = await queryMany<ContractRow>(
    `SELECT * FROM contracts ${whereClause}
     ORDER BY end_date ASC, created_at DESC
     LIMIT $${paramIndex++} OFFSET $${paramIndex}`,
    [...params, limit, offset]
  );

  return {
    items: rows.map(mapRowToContract),
    total,
    page,
    limit,
    hasMore: offset + rows.length < total,
  };
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
  const timestamp = now();

  const result = await queryOne<ContractAssetLinkRow>(
    `INSERT INTO contract_assets (
      contract_id, asset_id, link_type, start_date, end_date, notes, created_at
    ) VALUES ($1, $2, $3, $4, $5, $6, $7)
    ON CONFLICT (contract_id, asset_id) DO UPDATE SET
      link_type = EXCLUDED.link_type,
      start_date = EXCLUDED.start_date,
      end_date = EXCLUDED.end_date,
      notes = EXCLUDED.notes
    RETURNING *`,
    [contractId, assetId, linkType, startDate ?? null, endDate ?? null, notes ?? null, timestamp]
  );

  if (!result) {
    throw new Error('Failed to link contract to asset');
  }

  logger.info('Contract linked to asset', {
    contractId,
    assetId,
    linkType,
  });

  return mapRowToContractAssetLink(result);
}

/**
 * Unlink contract from asset
 */
export async function unlinkContractFromAsset(
  contractId: UUID,
  assetId: UUID
): Promise<boolean> {
  const result = await queryOne<{ link_id: string }>(
    'DELETE FROM contract_assets WHERE contract_id = $1 AND asset_id = $2 RETURNING link_id',
    [contractId, assetId]
  );

  if (result) {
    logger.info('Contract unlinked from asset', {
      contractId,
      assetId,
    });
  }

  return !!result;
}

/**
 * Get assets linked to a contract
 */
export async function getContractAssets(contractId: UUID): Promise<ContractAssetLink[]> {
  const rows = await queryMany<ContractAssetLinkRow>(
    'SELECT * FROM contract_assets WHERE contract_id = $1 ORDER BY created_at ASC',
    [contractId]
  );

  return rows.map(mapRowToContractAssetLink);
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
  const timestamp = now();

  const result = await queryOne<ContractEntitlementLinkRow>(
    `INSERT INTO contract_entitlements (
      contract_id, entitlement_id, link_type, start_date, end_date, notes, created_at
    ) VALUES ($1, $2, $3, $4, $5, $6, $7)
    ON CONFLICT (contract_id, entitlement_id) DO UPDATE SET
      link_type = EXCLUDED.link_type,
      start_date = EXCLUDED.start_date,
      end_date = EXCLUDED.end_date,
      notes = EXCLUDED.notes
    RETURNING *`,
    [contractId, entitlementId, linkType, startDate ?? null, endDate ?? null, notes ?? null, timestamp]
  );

  if (!result) {
    throw new Error('Failed to link contract to entitlement');
  }

  logger.info('Contract linked to entitlement', {
    contractId,
    entitlementId,
    linkType,
  });

  return mapRowToContractEntitlementLink(result);
}

/**
 * Unlink contract from entitlement
 */
export async function unlinkContractFromEntitlement(
  contractId: UUID,
  entitlementId: UUID
): Promise<boolean> {
  const result = await queryOne<{ link_id: string }>(
    'DELETE FROM contract_entitlements WHERE contract_id = $1 AND entitlement_id = $2 RETURNING link_id',
    [contractId, entitlementId]
  );

  if (result) {
    logger.info('Contract unlinked from entitlement', {
      contractId,
      entitlementId,
    });
  }

  return !!result;
}

/**
 * Get entitlements linked to a contract
 */
export async function getContractEntitlements(contractId: UUID): Promise<ContractEntitlementLink[]> {
  const rows = await queryMany<ContractEntitlementLinkRow>(
    'SELECT * FROM contract_entitlements WHERE contract_id = $1 ORDER BY created_at ASC',
    [contractId]
  );

  return rows.map(mapRowToContractEntitlementLink);
}

/**
 * Get contracts expiring within a date range
 */
export async function getExpiringContracts(
  daysUntilExpiration: number,
  statusFilter: ContractStatus[] = ['ACTIVE']
): Promise<Contract[]> {
  const rows = await queryMany<ContractRow>(
    `SELECT * FROM contracts 
     WHERE status = ANY($1::text[])
     AND end_date <= CURRENT_DATE + INTERVAL '1 day' * $2
     AND end_date >= CURRENT_DATE
     ORDER BY end_date ASC`,
    [statusFilter, daysUntilExpiration]
  );

  return rows.map(mapRowToContract);
}

