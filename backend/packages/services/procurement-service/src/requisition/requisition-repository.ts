/**
 * Requisition Repository
 *
 * Data access for procurement-owned requisition workflow and
 * requisition -> PO linkage.
 */

import type { PaginatedResult, PaginationParams, UUID } from '@ams/types';
import { queryMany, queryOne, withTransaction } from '@ams/database';
import type { QueryResultRow } from 'pg';
import { createLogger } from '@ams/utils';

const logger = createLogger({ service: 'requisition-repository' });
let vendorModelPriceCountryCodeSupported: boolean | null = null;

export type RequisitionStatus =
  | 'DRAFT'
  | 'PENDING_APPROVAL'
  | 'APPROVED'
  | 'REJECTED'
  | 'PARTIALLY_CONVERTED'
  | 'CONVERTED'
  | 'CANCELLED';

export type RequisitionLineStatus = 'DRAFT' | 'APPROVED' | 'REJECTED' | 'CONVERTED';
export type RequisitionProductType = 'HARDWARE_MODEL' | 'SOFTWARE_PRODUCT' | 'SERVICE' | 'OTHER';

export interface RequisitionLine {
  readonly reqLineId: UUID;
  readonly requisitionId: UUID;
  readonly lineNumber: number;
  readonly status: RequisitionLineStatus;
  readonly productType: RequisitionProductType;
  readonly productId: UUID | null;
  readonly productDescription: string;
  readonly sku: string | null;
  readonly quantity: number;
  readonly unitPrice: number;
  readonly lineTotal: number;
  readonly currency: string;
  readonly vendorId: UUID | null;
  readonly vendorName: string | null;
  readonly vendorModelPriceId: UUID | null;
  readonly costCenterId: UUID | null;
  readonly costCenterCode: string | null;
  readonly sourceType: string;
  readonly sourceSnapshot: Record<string, unknown>;
  readonly convertedPoId: UUID | null;
  readonly convertedPoLineId: UUID | null;
  readonly notes: string | null;
  readonly createdAt: string;
  readonly updatedAt: string;
}

export interface Requisition {
  readonly requisitionId: UUID;
  readonly requisitionNumber: string;
  readonly status: RequisitionStatus;
  readonly requestedBy: UUID | null;
  readonly requestedDate: string;
  readonly needByDate: string | null;
  readonly legalEntity: string | null;
  readonly currency: string;
  readonly costCenterId: UUID | null;
  readonly shipToBuildingId: UUID | null;
  readonly shipToAddress: string | null;
  readonly notes: string | null;
  readonly approvedBy: UUID | null;
  readonly approvedDate: string | null;
  readonly rejectedBy: UUID | null;
  readonly rejectedDate: string | null;
  readonly rejectionReason: string | null;
  readonly convertedDate: string | null;
  readonly createdAt: string;
  readonly updatedAt: string;
  readonly createdBy: UUID | null;
  readonly updatedBy: UUID | null;
}

export interface RequisitionWithLines extends Requisition {
  readonly lines: RequisitionLine[];
}

export interface RequisitionPoLink {
  readonly requisitionPoLinkId: UUID;
  readonly requisitionId: UUID;
  readonly reqLineId: UUID;
  readonly poId: UUID;
  readonly poLineId: UUID;
  readonly vendorId: UUID;
  readonly linkedAt: string;
}

export interface CreateRequisitionLineInput {
  readonly productType: RequisitionProductType;
  readonly productId?: UUID;
  readonly productDescription: string;
  readonly sku?: string;
  readonly quantity: number;
  readonly unitPrice?: number;
  readonly currency?: string;
  readonly vendorId?: UUID;
  readonly costCenterId?: UUID;
  readonly notes?: string;
}

export interface CreateRequisitionInput {
  readonly requestedBy?: UUID;
  readonly needByDate?: string;
  readonly legalEntity?: string;
  readonly currency?: string;
  readonly costCenterId?: UUID;
  readonly shipToBuildingId?: UUID;
  readonly shipToAddress?: string;
  readonly notes?: string;
  readonly createdBy?: UUID;
  readonly lines: CreateRequisitionLineInput[];
}

export interface RequisitionListFilters {
  readonly status?: RequisitionStatus;
  readonly requestedBy?: UUID;
  readonly fromDate?: string;
  readonly toDate?: string;
  readonly search?: string;
}

export interface RequisitionLineSourceResolution {
  readonly vendorId: UUID | null;
  readonly vendorModelPriceId: UUID | null;
  readonly unitPrice: number | null;
  readonly currency: string | null;
  readonly countryCode: string | null;
}

interface RequisitionRow {
  requisition_id: string;
  requisition_number: string;
  status: RequisitionStatus;
  requested_by: string | null;
  requested_date: string;
  need_by_date: string | null;
  legal_entity: string | null;
  currency: string;
  cost_center_id: string | null;
  ship_to_building_id: string | null;
  ship_to_address: string | null;
  notes: string | null;
  approved_by: string | null;
  approved_date: string | null;
  rejected_by: string | null;
  rejected_date: string | null;
  rejection_reason: string | null;
  converted_date: string | null;
  created_at: string;
  updated_at: string;
  created_by: string | null;
  updated_by: string | null;
}

interface RequisitionLineRow {
  req_line_id: string;
  requisition_id: string;
  line_number: number;
  status: RequisitionLineStatus;
  product_type: RequisitionProductType;
  product_id: string | null;
  product_description: string;
  sku: string | null;
  quantity: number;
  unit_price: string;
  line_total: string;
  currency: string;
  vendor_id: string | null;
  vendor_name: string | null;
  vendor_model_price_id: string | null;
  cost_center_id: string | null;
  cost_center_code: string | null;
  source_type: string;
  source_snapshot: Record<string, unknown> | null;
  converted_po_id: string | null;
  converted_po_line_id: string | null;
  notes: string | null;
  created_at: string;
  updated_at: string;
}

interface SourceResolutionRow {
  vendor_id: string;
  vendor_model_price_id: string;
  unit_price: string;
  currency: string;
  country_code: string | null;
}

function mapRowToRequisition(row: RequisitionRow): Requisition {
  return {
    requisitionId: row.requisition_id,
    requisitionNumber: row.requisition_number,
    status: row.status,
    requestedBy: row.requested_by,
    requestedDate: row.requested_date,
    needByDate: row.need_by_date,
    legalEntity: row.legal_entity,
    currency: row.currency,
    costCenterId: row.cost_center_id,
    shipToBuildingId: row.ship_to_building_id,
    shipToAddress: row.ship_to_address,
    notes: row.notes,
    approvedBy: row.approved_by,
    approvedDate: row.approved_date,
    rejectedBy: row.rejected_by,
    rejectedDate: row.rejected_date,
    rejectionReason: row.rejection_reason,
    convertedDate: row.converted_date,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    createdBy: row.created_by,
    updatedBy: row.updated_by,
  };
}

function mapRowToRequisitionLine(row: RequisitionLineRow): RequisitionLine {
  return {
    reqLineId: row.req_line_id,
    requisitionId: row.requisition_id,
    lineNumber: row.line_number,
    status: row.status,
    productType: row.product_type,
    productId: row.product_id,
    productDescription: row.product_description,
    sku: row.sku,
    quantity: row.quantity,
    unitPrice: parseFloat(row.unit_price),
    lineTotal: parseFloat(row.line_total),
    currency: row.currency,
    vendorId: row.vendor_id,
    vendorName: row.vendor_name,
    vendorModelPriceId: row.vendor_model_price_id,
    costCenterId: row.cost_center_id,
    costCenterCode: row.cost_center_code,
    sourceType: row.source_type,
    sourceSnapshot: row.source_snapshot ?? {},
    convertedPoId: row.converted_po_id,
    convertedPoLineId: row.converted_po_line_id,
    notes: row.notes,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function calculateLineTotal(quantity: number, unitPrice: number): number {
  return Math.round(quantity * unitPrice * 100) / 100;
}

async function generateRequisitionNumber(
  queryOneTx: <T extends QueryResultRow = QueryResultRow>(
    sql: string,
    values?: unknown[]
  ) => Promise<T | null>
): Promise<string> {
  const result = await queryOneTx<{ requisitionNumber: string }>(
    `SELECT generate_requisition_number() as "requisitionNumber"`
  );

  if (!result?.requisitionNumber) {
    throw new Error('Failed to generate requisition number');
  }

  return result.requisitionNumber;
}

async function hasVendorModelPriceCountryCode(
  queryOneTx: <T extends QueryResultRow = QueryResultRow>(
    sql: string,
    values?: unknown[]
  ) => Promise<T | null>
): Promise<boolean> {
  // Re-check until supported=true so warm runtimes pick up live migrations.
  if (vendorModelPriceCountryCodeSupported === true) {
    return vendorModelPriceCountryCodeSupported;
  }

  const row = await queryOneTx<{ count: string }>(
    `SELECT COUNT(*)::text as count
     FROM information_schema.columns
     WHERE table_schema = 'public'
       AND table_name = 'vendor_model_prices'
       AND column_name = 'country_code'`
  );

  vendorModelPriceCountryCodeSupported = Number(row?.count ?? '0') > 0;
  return vendorModelPriceCountryCodeSupported;
}

async function resolveBestSource(
  modelId: UUID,
  preferredVendorId: UUID | undefined,
  countryCode: string,
  queryOneTx: <T extends QueryResultRow = QueryResultRow>(
    sql: string,
    values?: unknown[]
  ) => Promise<T | null>
): Promise<RequisitionLineSourceResolution | null> {
  const countryCodeSupported = await hasVendorModelPriceCountryCode(queryOneTx);

  let sql: string;
  const params: unknown[] = [modelId];

  if (countryCodeSupported) {
    sql = `
      SELECT
        vmp.vendor_id,
        vmp.vendor_model_price_id,
        vmp.unit_price::text as unit_price,
        vmp.currency,
        vmp.country_code
      FROM vendor_model_prices vmp
      JOIN vendors v ON v.vendor_id = vmp.vendor_id
      WHERE vmp.model_id = $1
        AND vmp.is_active = TRUE
        AND v.is_active = TRUE
        AND vmp.country_code IN ($2, 'GLOBAL')
    `;
    params.push(countryCode);
  } else {
    sql = `
      SELECT
        vmp.vendor_id,
        vmp.vendor_model_price_id,
        vmp.unit_price::text as unit_price,
        vmp.currency,
        'GLOBAL'::varchar as country_code
      FROM vendor_model_prices vmp
      JOIN vendors v ON v.vendor_id = vmp.vendor_id
      WHERE vmp.model_id = $1
        AND vmp.is_active = TRUE
        AND v.is_active = TRUE
    `;
  }

  if (preferredVendorId) {
    params.push(preferredVendorId);
    sql += ` AND vmp.vendor_id = $${params.length}`;
  }

  sql += countryCodeSupported
    ? ` ORDER BY CASE WHEN vmp.country_code = $2 THEN 0 ELSE 1 END, vmp.unit_price ASC LIMIT 1`
    : ` ORDER BY vmp.unit_price ASC LIMIT 1`;

  const row = await queryOneTx<SourceResolutionRow>(sql, params);
  if (!row) {
    return null;
  }

  return {
    vendorId: row.vendor_id,
    vendorModelPriceId: row.vendor_model_price_id,
    unitPrice: parseFloat(row.unit_price),
    currency: row.currency,
    countryCode: row.country_code ?? 'GLOBAL',
  };
}

async function resolveShipToCountryCode(
  shipToBuildingId: string | null,
  queryOneTx: <T extends QueryResultRow = QueryResultRow>(
    sql: string,
    values?: unknown[]
  ) => Promise<T | null>
): Promise<string> {
  if (!shipToBuildingId) {
    return 'GLOBAL';
  }

  const row = await queryOneTx<{ country: string | null }>(
    `SELECT UPPER(TRIM(country)) as country
     FROM buildings
     WHERE building_id = $1`,
    [shipToBuildingId]
  );

  if (!row?.country) {
    return 'GLOBAL';
  }

  return row.country.length > 0 ? row.country : 'GLOBAL';
}

export async function createRequisition(input: CreateRequisitionInput): Promise<RequisitionWithLines> {
  return withTransaction(async (ctx) => {
    const requisitionNumber = await generateRequisitionNumber(ctx.queryOne);

    const header = await ctx.queryOne<RequisitionRow>(
      `INSERT INTO requisition_headers (
         requisition_number,
         status,
         requested_by,
         need_by_date,
         legal_entity,
         currency,
         cost_center_id,
         ship_to_building_id,
         ship_to_address,
         notes,
         created_by,
         updated_by
       ) VALUES (
         $1, 'DRAFT', $2, $3, $4, $5, $6, $7, $8, $9, $10, $10
       )
       RETURNING *`,
      [
        requisitionNumber,
        input.requestedBy ?? null,
        input.needByDate ?? null,
        input.legalEntity ?? null,
        (input.currency ?? 'USD').toUpperCase(),
        input.costCenterId ?? null,
        input.shipToBuildingId ?? null,
        input.shipToAddress ?? null,
        input.notes ?? null,
        input.createdBy ?? null,
      ]
    );

    if (!header) {
      throw new Error('Failed to create requisition');
    }

    const lines: RequisitionLine[] = [];
    const shipToCountryCode = await resolveShipToCountryCode(header.ship_to_building_id, ctx.queryOne);
    for (let i = 0; i < input.lines.length; i++) {
      const line = input.lines[i]!;
      const lineNumber = i + 1;

      const source =
        line.productType === 'HARDWARE_MODEL' && line.productId
          ? await resolveBestSource(line.productId, line.vendorId, shipToCountryCode, ctx.queryOne)
          : null;

      const resolvedVendorId = line.vendorId ?? source?.vendorId ?? null;
      const resolvedUnitPrice = line.unitPrice ?? source?.unitPrice ?? 0;
      const resolvedCurrency = (line.currency ?? source?.currency ?? header.currency).toUpperCase();
      const resolvedCostCenterId = line.costCenterId ?? header.cost_center_id ?? null;
      const lineTotal = calculateLineTotal(line.quantity, resolvedUnitPrice);
      const sourceType =
        source ? 'VENDOR_MODEL_PRICE' : line.vendorId ? 'MANUAL_VENDOR' : 'MANUAL';
      const sourceSnapshot = source
        ? {
            resolvedFrom: 'vendor_model_prices',
            vendorModelPriceId: source.vendorModelPriceId,
            vendorId: source.vendorId,
            countryCode: source.countryCode,
          }
        : {};

      const insertedLine = await ctx.queryOne<RequisitionLineRow>(
        `INSERT INTO requisition_lines (
           requisition_id,
           line_number,
           status,
           product_type,
           product_id,
           product_description,
           sku,
           quantity,
           unit_price,
           line_total,
           currency,
           vendor_id,
           vendor_model_price_id,
           cost_center_id,
           source_type,
           source_snapshot,
           notes,
           created_by,
           updated_by
         ) VALUES (
           $1, $2, 'DRAFT', $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15::jsonb, $16, $17, $17
         )
         RETURNING
           req_line_id,
           requisition_id,
           line_number,
           status,
           product_type,
           product_id,
           product_description,
           sku,
           quantity,
           unit_price::text,
           line_total::text,
           currency,
           vendor_id,
           (SELECT vendor_name FROM vendors WHERE vendor_id = $11) as vendor_name,
           vendor_model_price_id,
           cost_center_id,
           (SELECT code FROM cost_centers WHERE cost_center_id = $13) as cost_center_code,
           source_type,
           source_snapshot,
           converted_po_id,
           converted_po_line_id,
           notes,
           created_at::text,
           updated_at::text`,
        [
          header.requisition_id,
          lineNumber,
          line.productType,
          line.productId ?? null,
          line.productDescription,
          line.sku ?? null,
          line.quantity,
          resolvedUnitPrice,
          lineTotal,
          resolvedCurrency,
          resolvedVendorId,
          source?.vendorModelPriceId ?? null,
          resolvedCostCenterId,
          sourceType,
          JSON.stringify(sourceSnapshot),
          line.notes ?? null,
          input.createdBy ?? null,
        ]
      );

      if (!insertedLine) {
        throw new Error(`Failed to create requisition line ${lineNumber}`);
      }

      if (source?.vendorId) {
        await ctx.queryOne(
          `INSERT INTO requisition_line_sources (
             req_line_id,
             source_rank,
             vendor_id,
             model_id,
             vendor_model_price_id,
             unit_price,
             currency,
             is_selected,
             is_active
           ) VALUES ($1, 1, $2, $3, $4, $5, $6, TRUE, TRUE)`,
          [
            insertedLine.req_line_id,
            source.vendorId,
            line.productId ?? null,
            source.vendorModelPriceId,
            source.unitPrice,
            resolvedCurrency,
          ]
        );
      }

      if (resolvedCostCenterId) {
        await ctx.queryOne(
          `INSERT INTO requisition_distributions (
             req_line_id,
             cost_center_id,
             percent_allocation,
             amount,
             currency,
             created_by,
             updated_by
           ) VALUES ($1, $2, 100.00, $3, $4, $5, $5)`,
          [
            insertedLine.req_line_id,
            resolvedCostCenterId,
            lineTotal,
            resolvedCurrency,
            input.createdBy ?? null,
          ]
        );
      }

      lines.push(mapRowToRequisitionLine(insertedLine));
    }

    logger.info('Requisition created', {
      requisitionId: header.requisition_id,
      requisitionNumber: header.requisition_number,
      lineCount: lines.length,
    });

    return {
      ...mapRowToRequisition(header),
      lines,
    };
  });
}

export async function getRequisitionById(requisitionId: UUID): Promise<Requisition | null> {
  const row = await queryOne<RequisitionRow>(
    `SELECT * FROM requisition_headers WHERE requisition_id = $1`,
    [requisitionId]
  );

  return row ? mapRowToRequisition(row) : null;
}

export async function getRequisitionLines(requisitionId: UUID): Promise<RequisitionLine[]> {
  const rows = await queryMany<RequisitionLineRow>(
    `SELECT
       rl.req_line_id,
       rl.requisition_id,
       rl.line_number,
       rl.status,
       rl.product_type,
       rl.product_id,
       rl.product_description,
       rl.sku,
       rl.quantity,
       rl.unit_price::text,
       rl.line_total::text,
       rl.currency,
       rl.vendor_id,
       v.vendor_name,
       rl.vendor_model_price_id,
       rl.cost_center_id,
       cc.code as cost_center_code,
       rl.source_type,
       rl.source_snapshot,
       rl.converted_po_id,
       rl.converted_po_line_id,
       rl.notes,
       rl.created_at::text,
       rl.updated_at::text
     FROM requisition_lines rl
     LEFT JOIN vendors v ON rl.vendor_id = v.vendor_id
     LEFT JOIN cost_centers cc ON rl.cost_center_id = cc.cost_center_id
     WHERE rl.requisition_id = $1
     ORDER BY rl.line_number ASC`,
    [requisitionId]
  );

  return rows.map(mapRowToRequisitionLine);
}

export async function getRequisitionWithLines(requisitionId: UUID): Promise<RequisitionWithLines | null> {
  const header = await getRequisitionById(requisitionId);
  if (!header) {
    return null;
  }

  const lines = await getRequisitionLines(requisitionId);
  return { ...header, lines };
}

export async function listRequisitions(
  filters: RequisitionListFilters = {},
  pagination: PaginationParams = {}
): Promise<PaginatedResult<Requisition>> {
  const { page = 1, limit = 50 } = pagination;
  const offset = (page - 1) * limit;

  const conditions: string[] = [];
  const values: unknown[] = [];
  let paramIndex = 1;

  if (filters.status) {
    conditions.push(`rh.status = $${paramIndex++}`);
    values.push(filters.status);
  }

  if (filters.requestedBy) {
    conditions.push(`rh.requested_by = $${paramIndex++}`);
    values.push(filters.requestedBy);
  }

  if (filters.fromDate) {
    conditions.push(`rh.requested_date >= $${paramIndex++}`);
    values.push(filters.fromDate);
  }

  if (filters.toDate) {
    conditions.push(`rh.requested_date <= $${paramIndex++}`);
    values.push(filters.toDate);
  }

  if (filters.search) {
    conditions.push(`(rh.requisition_number ILIKE $${paramIndex})`);
    values.push(`%${filters.search}%`);
    paramIndex++;
  }

  const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';

  const countResult = await queryOne<{ count: string }>(
    `SELECT COUNT(*) as count
     FROM requisition_headers rh
     ${whereClause}`,
    values
  );
  const total = parseInt(countResult?.count ?? '0', 10);

  const items = await queryMany<RequisitionRow>(
    `SELECT *
     FROM requisition_headers rh
     ${whereClause}
     ORDER BY rh.created_at DESC
     LIMIT $${paramIndex++} OFFSET $${paramIndex}`,
    [...values, limit, offset]
  );

  return {
    items: items.map(mapRowToRequisition),
    total,
    page,
    limit,
    hasMore: offset + items.length < total,
  };
}

export async function updateRequisitionStatus(
  requisitionId: UUID,
  status: RequisitionStatus,
  options: {
    approvedBy?: UUID;
    approvedDate?: string;
    rejectedBy?: UUID;
    rejectedDate?: string;
    rejectionReason?: string;
    convertedDate?: string;
    updatedBy?: UUID;
  } = {}
): Promise<Requisition | null> {
  const row = await queryOne<RequisitionRow>(
    `UPDATE requisition_headers
     SET status = $2,
         approved_by = COALESCE($3, approved_by),
         approved_date = COALESCE($4, approved_date),
         rejected_by = COALESCE($5, rejected_by),
         rejected_date = COALESCE($6, rejected_date),
         rejection_reason = COALESCE($7, rejection_reason),
         converted_date = COALESCE($8, converted_date),
         updated_by = COALESCE($9, updated_by),
         updated_at = NOW()
     WHERE requisition_id = $1
     RETURNING *`,
    [
      requisitionId,
      status,
      options.approvedBy ?? null,
      options.approvedDate ?? null,
      options.rejectedBy ?? null,
      options.rejectedDate ?? null,
      options.rejectionReason ?? null,
      options.convertedDate ?? null,
      options.updatedBy ?? null,
    ]
  );

  return row ? mapRowToRequisition(row) : null;
}

export async function updateRequisitionLineStatus(
  reqLineId: UUID,
  status: RequisitionLineStatus,
  convertedPoId?: UUID,
  convertedPoLineId?: UUID
): Promise<void> {
  await queryOne(
    `UPDATE requisition_lines
     SET status = $2,
         converted_po_id = COALESCE($3, converted_po_id),
         converted_po_line_id = COALESCE($4, converted_po_line_id),
         updated_at = NOW()
     WHERE req_line_id = $1`,
    [reqLineId, status, convertedPoId ?? null, convertedPoLineId ?? null]
  );
}

export async function createRequisitionApprovalRecord(
  requisitionId: UUID,
  approverId: UUID,
  status: 'APPROVED' | 'REJECTED',
  decisionNotes?: string
): Promise<void> {
  await queryOne(
    `INSERT INTO requisition_approvals (
       requisition_id,
       approval_level,
       approver_id,
       status,
       decision_notes,
       decided_at
     ) VALUES (
       $1, 1, $2, $3, $4, NOW()
     )`,
    [requisitionId, approverId, status, decisionNotes ?? null]
  );
}

export async function createRequisitionPoLinks(
  links: Array<{
    requisitionId: UUID;
    reqLineId: UUID;
    poId: UUID;
    poLineId: UUID;
    vendorId: UUID;
    createdBy?: UUID;
  }>
): Promise<void> {
  if (links.length === 0) {
    return;
  }

  await withTransaction(async (ctx) => {
    for (const link of links) {
      await ctx.queryOne(
        `INSERT INTO requisition_po_links (
           requisition_id,
           req_line_id,
           po_id,
           po_line_id,
           vendor_id,
           created_by
         ) VALUES ($1, $2, $3, $4, $5, $6)`,
        [
          link.requisitionId,
          link.reqLineId,
          link.poId,
          link.poLineId,
          link.vendorId,
          link.createdBy ?? null,
        ]
      );

      await ctx.queryOne(
        `UPDATE requisition_lines
         SET status = 'CONVERTED',
             converted_po_id = $2,
             converted_po_line_id = $3,
             updated_at = NOW()
         WHERE req_line_id = $1`,
        [link.reqLineId, link.poId, link.poLineId]
      );
    }
  });
}

export async function getRequisitionPoLinks(requisitionId: UUID): Promise<RequisitionPoLink[]> {
  return queryMany<RequisitionPoLink>(
    `SELECT
       requisition_po_link_id as "requisitionPoLinkId",
       requisition_id as "requisitionId",
       req_line_id as "reqLineId",
       po_id as "poId",
       po_line_id as "poLineId",
       vendor_id as "vendorId",
       linked_at::text as "linkedAt"
     FROM requisition_po_links
     WHERE requisition_id = $1
     ORDER BY linked_at ASC`,
    [requisitionId]
  );
}
