/**
 * Procurement Accounting Repository
 *
 * Data access routines for WS8 accounting postings:
 * - requisition pre-encumbrance
 * - requisition->PO distribution propagation
 * - PO encumbrance + subledger posting
 */

import type { UUID } from '@ams/types';
import { queryMany, queryOne, withTransaction } from '@ams/database';
import type { QueryResultRow } from 'pg';
import { createLogger } from '@ams/utils';

const logger = createLogger({ service: 'accounting-repository' });

interface RequisitionDistributionRow extends QueryResultRow {
  requisition_distribution_id: string;
  req_line_id: string;
  cost_center_id: string;
  department_id: string | null;
  percent_allocation: string;
  amount: string;
  currency: string;
  requested_date: string;
}

interface POFallbackDistributionRow extends QueryResultRow {
  po_line_id: string;
  amount: string;
  currency: string;
  cost_center_id: string | null;
  department_id: string | null;
  gl_account: string | null;
}

interface PODistributionPostingRow extends QueryResultRow {
  po_distribution_id: string;
  po_line_id: string;
  cost_center_id: string;
  department_id: string | null;
  gl_account: string | null;
  amount: string;
  currency: string;
}

interface ExistingIdRow extends QueryResultRow {
  id: string;
}

interface RequisitionPoLinkInput {
  readonly requisitionId: UUID;
  readonly reqLineId: UUID;
  readonly poId: UUID;
  readonly poLineId: UUID;
}

interface POHeaderRow extends QueryResultRow {
  po_number: string;
  currency: string | null;
}

export interface PostingSummary {
  readonly insertedPoDistributions: number;
  readonly insertedPreEncumbrances: number;
  readonly insertedPoEncumbrances: number;
  readonly createdSubledgerEntries: number;
  readonly createdSubledgerLines: number;
}

export interface BudgetValidationIssue {
  readonly costCenterId: UUID;
  readonly costCenterCode: string | null;
  readonly requiredAmount: number;
  readonly availableAmount: number;
  readonly deficitAmount: number;
}

export interface BudgetValidationResult {
  readonly isValid: boolean;
  readonly issues: BudgetValidationIssue[];
}

export interface AccountingTransitionSummary {
  readonly insertedEncumbrances: number;
  readonly createdSubledgerEntries: number;
  readonly createdSubledgerLines: number;
}

function parseAmount(value: string): number {
  return parseFloat(value);
}

function deriveFiscalPeriod(dateString: string): { year: number; period: string } {
  const date = new Date(dateString);
  const year = date.getUTCFullYear();
  const month = String(date.getUTCMonth() + 1).padStart(2, '0');
  return {
    year,
    period: `${year}-${month}`,
  };
}

async function generateSubledgerEntryNumber(
  queryOneTx: <T extends QueryResultRow = QueryResultRow>(
    sql: string,
    values?: unknown[]
  ) => Promise<T | null>
): Promise<string> {
  const now = new Date();
  const year = now.getUTCFullYear();
  const month = String(now.getUTCMonth() + 1).padStart(2, '0');
  const prefix = `SL-${year}${month}-`;

  const result = await queryOneTx<{ count: string }>(
    `SELECT COUNT(*) as count
     FROM subledger_entries
     WHERE entry_number LIKE $1`,
    [`${prefix}%`]
  );

  const sequence = (parseInt(result?.count ?? '0', 10) || 0) + 1;
  return `${prefix}${String(sequence).padStart(4, '0')}`;
}

export async function createPreEncumbrancesForRequisition(
  requisitionId: UUID,
  createdBy?: UUID
): Promise<number> {
  return withTransaction(async (ctx) => {
    const rows = await ctx.queryMany<RequisitionDistributionRow>(
      `SELECT
         rd.requisition_distribution_id,
         rd.req_line_id,
         rd.cost_center_id,
         rd.department_id,
         rd.percent_allocation::text,
         rd.amount::text,
         rd.currency,
         rh.requested_date::text
       FROM requisition_distributions rd
       JOIN requisition_lines rl ON rd.req_line_id = rl.req_line_id
       JOIN requisition_headers rh ON rl.requisition_id = rh.requisition_id
       WHERE rh.requisition_id = $1`,
      [requisitionId]
    );

    let inserted = 0;
    for (const row of rows) {
      const existing = await ctx.queryOne<ExistingIdRow>(
        `SELECT encumbrance_id as id
         FROM budget_encumbrances
         WHERE source_type = 'REQUISITION'
           AND source_document_id = $1
           AND source_line_id = $2
           AND encumbrance_type = 'PRE_ENCUMBRANCE'
         LIMIT 1`,
        [requisitionId, row.req_line_id]
      );

      if (existing) {
        continue;
      }

      const fiscal = deriveFiscalPeriod(row.requested_date);
      await ctx.queryOne(
        `INSERT INTO budget_encumbrances (
           source_type,
           source_document_id,
           source_line_id,
           reference_requisition_id,
           cost_center_id,
           department_id,
           fiscal_year,
           fiscal_period,
           encumbrance_type,
           amount,
           currency,
           status,
           effective_date,
           notes,
           created_by,
           updated_by
         ) VALUES (
           'REQUISITION',
           $1,
           $2,
           $1,
           $3,
           $4,
           $5,
           $6,
           'PRE_ENCUMBRANCE',
           $7,
           $8,
           'OPEN',
           CURRENT_DATE,
           $9,
           $10,
           $10
         )`,
        [
          requisitionId,
          row.req_line_id,
          row.cost_center_id,
          row.department_id,
          fiscal.year,
          fiscal.period,
          parseAmount(row.amount),
          row.currency,
          `Auto-posted from requisition ${requisitionId}`,
          createdBy ?? null,
        ]
      );
      inserted++;
    }

    return inserted;
  });
}

export async function copyRequisitionDistributionsToPO(
  links: readonly RequisitionPoLinkInput[],
  createdBy?: UUID
): Promise<number> {
  if (links.length === 0) {
    return 0;
  }

  return withTransaction(async (ctx) => {
    let inserted = 0;

    for (const link of links) {
      const requisitionRows = await ctx.queryMany<RequisitionDistributionRow>(
        `SELECT
           rd.requisition_distribution_id,
           rd.req_line_id,
           rd.cost_center_id,
           rd.department_id,
           rd.percent_allocation::text,
           rd.amount::text,
           rd.currency,
           CURRENT_DATE::text as requested_date
         FROM requisition_distributions rd
         WHERE rd.req_line_id = $1`,
        [link.reqLineId]
      );

      if (requisitionRows.length > 0) {
        for (const row of requisitionRows) {
          const existing = await ctx.queryOne<ExistingIdRow>(
            `SELECT po_distribution_id as id
             FROM po_distributions
             WHERE po_line_id = $1
               AND requisition_distribution_id = $2
             LIMIT 1`,
            [link.poLineId, row.requisition_distribution_id]
          );

          if (existing) {
            continue;
          }

          await ctx.queryOne(
            `INSERT INTO po_distributions (
               po_id,
               po_line_id,
               requisition_distribution_id,
               cost_center_id,
               department_id,
               gl_account,
               percent_allocation,
               amount,
               currency,
               distribution_type,
               is_active,
               created_by,
               updated_by
             ) VALUES (
               $1,
               $2,
               $3,
               $4,
               $5,
               (SELECT gl_account FROM cost_centers WHERE cost_center_id = $4),
               $6,
               $7,
               $8,
               'ENCUMBRANCE',
               TRUE,
               $9,
               $9
             )`,
            [
              link.poId,
              link.poLineId,
              row.requisition_distribution_id,
              row.cost_center_id,
              row.department_id,
              parseFloat(row.percent_allocation),
              parseAmount(row.amount),
              row.currency,
              createdBy ?? null,
            ]
          );
          inserted++;
        }
        continue;
      }

      const fallback = await ctx.queryOne<POFallbackDistributionRow>(
        `SELECT
           pol.line_id as po_line_id,
           pol.total_price::text as amount,
           COALESCE(po.currency, 'USD') as currency,
           COALESCE(pol.cost_center_id, po.cost_center_id) as cost_center_id,
           cc.department_id,
           cc.gl_account
         FROM purchase_order_lines pol
         JOIN purchase_orders po ON pol.po_id = po.po_id
         LEFT JOIN cost_centers cc ON cc.cost_center_id = COALESCE(pol.cost_center_id, po.cost_center_id)
         WHERE pol.line_id = $1
           AND pol.po_id = $2`,
        [link.poLineId, link.poId]
      );

      if (!fallback?.cost_center_id) {
        logger.warn('Skipping PO distribution fallback due missing cost center', {
          poId: link.poId,
          poLineId: link.poLineId,
          reqLineId: link.reqLineId,
        });
        continue;
      }

      const existingFallback = await ctx.queryOne<ExistingIdRow>(
        `SELECT po_distribution_id as id
         FROM po_distributions
         WHERE po_line_id = $1
           AND requisition_distribution_id IS NULL
         LIMIT 1`,
        [link.poLineId]
      );
      if (existingFallback) {
        continue;
      }

      await ctx.queryOne(
        `INSERT INTO po_distributions (
           po_id,
           po_line_id,
           requisition_distribution_id,
           cost_center_id,
           department_id,
           gl_account,
           percent_allocation,
           amount,
           currency,
           distribution_type,
           is_active,
           created_by,
           updated_by
         ) VALUES (
           $1,
           $2,
           NULL,
           $3,
           $4,
           $5,
           100.00,
           $6,
           $7,
           'ENCUMBRANCE',
           TRUE,
           $8,
           $8
         )`,
        [
          link.poId,
          link.poLineId,
          fallback.cost_center_id,
          fallback.department_id,
          fallback.gl_account,
          parseAmount(fallback.amount),
          fallback.currency,
          createdBy ?? null,
        ]
      );
      inserted++;
    }

    return inserted;
  });
}

export async function postEncumbrancesForPO(
  poId: UUID,
  createdBy?: UUID
): Promise<Pick<PostingSummary, 'insertedPoEncumbrances' | 'createdSubledgerEntries' | 'createdSubledgerLines'>> {
  return withTransaction(async (ctx) => {
    const distributionCount = await ctx.queryOne<{ count: string }>(
      `SELECT COUNT(*) as count
       FROM po_distributions
       WHERE po_id = $1
         AND is_active = TRUE`,
      [poId]
    );
    const hasDistributions = (parseInt(distributionCount?.count ?? '0', 10) || 0) > 0;

    if (!hasDistributions) {
      const fallbackRows = await ctx.queryMany<POFallbackDistributionRow>(
        `SELECT
           pol.line_id as po_line_id,
           pol.total_price::text as amount,
           COALESCE(po.currency, 'USD') as currency,
           COALESCE(pol.cost_center_id, po.cost_center_id) as cost_center_id,
           cc.department_id,
           cc.gl_account
         FROM purchase_order_lines pol
         JOIN purchase_orders po ON pol.po_id = po.po_id
         LEFT JOIN cost_centers cc ON cc.cost_center_id = COALESCE(pol.cost_center_id, po.cost_center_id)
         WHERE pol.po_id = $1`,
        [poId]
      );

      for (const row of fallbackRows) {
        if (!row.cost_center_id) {
          logger.warn('Skipping fallback PO distribution due missing cost center', {
            poId,
            poLineId: row.po_line_id,
          });
          continue;
        }

        const existing = await ctx.queryOne<ExistingIdRow>(
          `SELECT po_distribution_id as id
           FROM po_distributions
           WHERE po_line_id = $1
             AND requisition_distribution_id IS NULL
           LIMIT 1`,
          [row.po_line_id]
        );
        if (existing) {
          continue;
        }

        await ctx.queryOne(
          `INSERT INTO po_distributions (
             po_id,
             po_line_id,
             cost_center_id,
             department_id,
             gl_account,
             percent_allocation,
             amount,
             currency,
             distribution_type,
             is_active,
             created_by,
             updated_by
           ) VALUES (
             $1,
             $2,
             $3,
             $4,
             $5,
             100.00,
             $6,
             $7,
             'ENCUMBRANCE',
             TRUE,
             $8,
             $8
           )`,
          [
            poId,
            row.po_line_id,
            row.cost_center_id,
            row.department_id,
            row.gl_account,
            parseAmount(row.amount),
            row.currency,
            createdBy ?? null,
          ]
        );
      }
    }

    const postings = await ctx.queryMany<PODistributionPostingRow>(
      `SELECT
         pd.po_distribution_id,
         pd.po_line_id,
         pd.cost_center_id,
         pd.department_id,
         COALESCE(pd.gl_account, cc.gl_account) as gl_account,
         pd.amount::text,
         pd.currency
       FROM po_distributions pd
       LEFT JOIN cost_centers cc ON cc.cost_center_id = pd.cost_center_id
       WHERE pd.po_id = $1
         AND pd.is_active = TRUE`,
      [poId]
    );

    let insertedPoEncumbrances = 0;
    const encumbranceRows: Array<{
      encumbranceId: UUID;
      poDistributionId: UUID;
      costCenterId: UUID;
      departmentId: UUID | null;
      glAccount: string | null;
      amount: number;
      currency: string;
    }> = [];

    for (const posting of postings) {
      const existing = await ctx.queryOne<ExistingIdRow>(
        `SELECT encumbrance_id as id
         FROM budget_encumbrances
         WHERE source_type = 'PURCHASE_ORDER'
           AND source_document_id = $1
           AND source_line_id = $2
           AND encumbrance_type = 'ENCUMBRANCE'
         LIMIT 1`,
        [poId, posting.po_line_id]
      );

      if (existing) {
        continue;
      }

      const now = new Date();
      const fiscalYear = now.getUTCFullYear();
      const fiscalPeriod = `${fiscalYear}-${String(now.getUTCMonth() + 1).padStart(2, '0')}`;
      const inserted = await ctx.queryOne<{ encumbrance_id: string }>(
        `INSERT INTO budget_encumbrances (
           source_type,
           source_document_id,
           source_line_id,
           reference_po_id,
           reference_po_line_id,
           cost_center_id,
           department_id,
           fiscal_year,
           fiscal_period,
           encumbrance_type,
           amount,
           currency,
           status,
           effective_date,
           notes,
           created_by,
           updated_by
         ) VALUES (
           'PURCHASE_ORDER',
           $1,
           $2,
           $1,
           $2,
           $3,
           $4,
           $5,
           $6,
           'ENCUMBRANCE',
           $7,
           $8,
           'OPEN',
           CURRENT_DATE,
           $9,
           $10,
           $10
         )
         RETURNING encumbrance_id`,
        [
          poId,
          posting.po_line_id,
          posting.cost_center_id,
          posting.department_id,
          fiscalYear,
          fiscalPeriod,
          parseAmount(posting.amount),
          posting.currency,
          `Auto-posted from approved PO ${poId}`,
          createdBy ?? null,
        ]
      );

      if (!inserted) {
        continue;
      }

      insertedPoEncumbrances++;
      encumbranceRows.push({
        encumbranceId: inserted.encumbrance_id,
        poDistributionId: posting.po_distribution_id,
        costCenterId: posting.cost_center_id,
        departmentId: posting.department_id,
        glAccount: posting.gl_account,
        amount: parseAmount(posting.amount),
        currency: posting.currency,
      });
    }

    if (encumbranceRows.length === 0) {
      return {
        insertedPoEncumbrances,
        createdSubledgerEntries: 0,
        createdSubledgerLines: 0,
      };
    }

    const existingEntry = await ctx.queryOne<ExistingIdRow>(
      `SELECT subledger_entry_id as id
       FROM subledger_entries
       WHERE source_type = 'PURCHASE_ORDER'
         AND source_document_id = $1
         AND status IN ('DRAFT', 'POSTED')
       LIMIT 1`,
      [poId]
    );

    if (existingEntry) {
      return {
        insertedPoEncumbrances,
        createdSubledgerEntries: 0,
        createdSubledgerLines: 0,
      };
    }

    const poHeader = await ctx.queryOne<POHeaderRow>(
      `SELECT po_number, COALESCE(currency, 'USD') as currency
       FROM purchase_orders
       WHERE po_id = $1`,
      [poId]
    );

    const totalAmount = encumbranceRows.reduce((sum, row) => sum + row.amount, 0);
    const entryNumber = await generateSubledgerEntryNumber(ctx.queryOne);
    const now = new Date();
    const periodYear = now.getUTCFullYear();
    const periodMonth = now.getUTCMonth() + 1;

    const entry = await ctx.queryOne<{ subledger_entry_id: string }>(
      `INSERT INTO subledger_entries (
         entry_number,
         entry_date,
         period_year,
         period_month,
         source_module,
         source_type,
         source_document_id,
         source_document_number,
         status,
         currency,
         total_debit,
         total_credit,
         description,
         posted_at,
         posted_by,
         created_by,
         updated_by
       ) VALUES (
         $1,
         CURRENT_DATE,
         $2,
         $3,
         'PROCUREMENT',
         'PURCHASE_ORDER',
         $4,
         $5,
         'POSTED',
         $6,
         $7,
         $7,
         $8,
         NOW(),
         $9,
         $9,
         $9
       )
       RETURNING subledger_entry_id`,
      [
        entryNumber,
        periodYear,
        periodMonth,
        poId,
        poHeader?.po_number ?? null,
        poHeader?.currency ?? 'USD',
        totalAmount,
        `PO encumbrance posting for ${poHeader?.po_number ?? poId}`,
        createdBy ?? null,
      ]
    );

    if (!entry) {
      return {
        insertedPoEncumbrances,
        createdSubledgerEntries: 0,
        createdSubledgerLines: 0,
      };
    }

    let lineNumber = 1;
    let createdSubledgerLines = 0;
    for (const row of encumbranceRows) {
      const debitAccount = row.glAccount ?? '5000-PO-ENCUMBRANCE';
      const creditAccount = '2190-BUDGET-RESERVE';

      await ctx.queryOne(
        `INSERT INTO subledger_lines (
           subledger_entry_id,
           line_number,
           po_distribution_id,
           budget_encumbrance_id,
           cost_center_id,
           department_id,
           gl_account,
           debit_amount,
           credit_amount,
           currency,
           memo,
           created_by
         ) VALUES (
           $1, $2, $3, $4, $5, $6, $7, $8, 0, $9, $10, $11
         )`,
        [
          entry.subledger_entry_id,
          lineNumber++,
          row.poDistributionId,
          row.encumbranceId,
          row.costCenterId,
          row.departmentId,
          debitAccount,
          row.amount,
          row.currency,
          'PO encumbrance debit',
          createdBy ?? null,
        ]
      );

      await ctx.queryOne(
        `INSERT INTO subledger_lines (
           subledger_entry_id,
           line_number,
           po_distribution_id,
           budget_encumbrance_id,
           cost_center_id,
           department_id,
           gl_account,
           debit_amount,
           credit_amount,
           currency,
           memo,
           created_by
         ) VALUES (
           $1, $2, $3, $4, $5, $6, $7, 0, $8, $9, $10, $11
         )`,
        [
          entry.subledger_entry_id,
          lineNumber++,
          row.poDistributionId,
          row.encumbranceId,
          row.costCenterId,
          row.departmentId,
          creditAccount,
          row.amount,
          row.currency,
          'PO encumbrance credit',
          createdBy ?? null,
        ]
      );

      createdSubledgerLines += 2;
    }

    return {
      insertedPoEncumbrances,
      createdSubledgerEntries: 1,
      createdSubledgerLines,
    };
  });
}

export async function countPOEncumbrances(poId: UUID): Promise<number> {
  const result = await queryOne<{ count: string }>(
    `SELECT COUNT(*) as count
     FROM budget_encumbrances
     WHERE source_type = 'PURCHASE_ORDER'
       AND source_document_id = $1
       AND encumbrance_type = 'ENCUMBRANCE'`,
    [poId]
  );

  return parseInt(result?.count ?? '0', 10) || 0;
}

interface BudgetRow extends QueryResultRow {
  cost_center_id: string;
  cost_center_code: string | null;
  required_amount: string;
  available_amount: string | null;
  budget_amount: string | null;
  spent_amount: string | null;
  committed_amount: string | null;
}

interface PostingDistributionRow extends QueryResultRow {
  po_distribution_id: string | null;
  po_line_id: string;
  cost_center_id: string;
  department_id: string | null;
  gl_account: string | null;
  amount: string;
  currency: string;
}

function parseNullableAmount(value: string | null): number | null {
  if (value === null) {
    return null;
  }
  const parsed = parseFloat(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function deriveAvailableBudget(row: BudgetRow): number {
  const available = parseNullableAmount(row.available_amount);
  if (available !== null) {
    return available;
  }

  const budget = parseNullableAmount(row.budget_amount) ?? 0;
  const spent = parseNullableAmount(row.spent_amount) ?? 0;
  const committed = parseNullableAmount(row.committed_amount) ?? 0;
  return budget - spent - committed;
}

function toBudgetValidationResult(rows: BudgetRow[]): BudgetValidationResult {
  const issues: BudgetValidationIssue[] = [];

  for (const row of rows) {
    const requiredAmount = parseAmount(row.required_amount);
    const availableAmount = deriveAvailableBudget(row);
    if (requiredAmount > availableAmount + 0.009) {
      issues.push({
        costCenterId: row.cost_center_id,
        costCenterCode: row.cost_center_code,
        requiredAmount: Math.round(requiredAmount * 100) / 100,
        availableAmount: Math.round(availableAmount * 100) / 100,
        deficitAmount: Math.round((requiredAmount - availableAmount) * 100) / 100,
      });
    }
  }

  return {
    isValid: issues.length === 0,
    issues,
  };
}

export async function validateRequisitionBudget(
  requisitionId: UUID
): Promise<BudgetValidationResult> {
  const distributionRows = await queryMany<BudgetRow>(
    `WITH required AS (
       SELECT
         rd.cost_center_id,
         SUM(rd.amount)::text as required_amount
       FROM requisition_distributions rd
       JOIN requisition_lines rl ON rl.req_line_id = rd.req_line_id
       WHERE rl.requisition_id = $1
       GROUP BY rd.cost_center_id
     )
     SELECT
       r.cost_center_id,
       cc.code as cost_center_code,
       r.required_amount,
       cc.available_amount::text as available_amount,
       cc.budget_amount::text as budget_amount,
       cc.spent_amount::text as spent_amount,
       cc.committed_amount::text as committed_amount
     FROM required r
     JOIN cost_centers cc ON cc.cost_center_id = r.cost_center_id`,
    [requisitionId]
  );

  if (distributionRows.length > 0) {
    return toBudgetValidationResult(distributionRows);
  }

  const fallbackRows = await queryMany<BudgetRow>(
    `WITH required AS (
       SELECT
         COALESCE(rl.cost_center_id, rh.cost_center_id) as cost_center_id,
         SUM(rl.line_total)::text as required_amount
       FROM requisition_lines rl
       JOIN requisition_headers rh ON rh.requisition_id = rl.requisition_id
       WHERE rl.requisition_id = $1
       GROUP BY COALESCE(rl.cost_center_id, rh.cost_center_id)
     )
     SELECT
       r.cost_center_id,
       cc.code as cost_center_code,
       r.required_amount,
       cc.available_amount::text as available_amount,
       cc.budget_amount::text as budget_amount,
       cc.spent_amount::text as spent_amount,
       cc.committed_amount::text as committed_amount
     FROM required r
     JOIN cost_centers cc ON cc.cost_center_id = r.cost_center_id
     WHERE r.cost_center_id IS NOT NULL`,
    [requisitionId]
  );

  return toBudgetValidationResult(fallbackRows);
}

export async function validatePOBudget(poId: UUID): Promise<BudgetValidationResult> {
  const distributionRows = await queryMany<BudgetRow>(
    `WITH required AS (
       SELECT
         pd.cost_center_id,
         SUM(pd.amount)::text as required_amount
       FROM po_distributions pd
       WHERE pd.po_id = $1
         AND pd.is_active = TRUE
       GROUP BY pd.cost_center_id
     )
     SELECT
       r.cost_center_id,
       cc.code as cost_center_code,
       r.required_amount,
       cc.available_amount::text as available_amount,
       cc.budget_amount::text as budget_amount,
       cc.spent_amount::text as spent_amount,
       cc.committed_amount::text as committed_amount
     FROM required r
     JOIN cost_centers cc ON cc.cost_center_id = r.cost_center_id`,
    [poId]
  );

  if (distributionRows.length > 0) {
    return toBudgetValidationResult(distributionRows);
  }

  const fallbackRows = await queryMany<BudgetRow>(
    `WITH required AS (
       SELECT
         COALESCE(pol.cost_center_id, po.cost_center_id) as cost_center_id,
         SUM(pol.total_price)::text as required_amount
       FROM purchase_order_lines pol
       JOIN purchase_orders po ON po.po_id = pol.po_id
       WHERE pol.po_id = $1
       GROUP BY COALESCE(pol.cost_center_id, po.cost_center_id)
     )
     SELECT
       r.cost_center_id,
       cc.code as cost_center_code,
       r.required_amount,
       cc.available_amount::text as available_amount,
       cc.budget_amount::text as budget_amount,
       cc.spent_amount::text as spent_amount,
       cc.committed_amount::text as committed_amount
     FROM required r
     JOIN cost_centers cc ON cc.cost_center_id = r.cost_center_id
     WHERE r.cost_center_id IS NOT NULL`,
    [poId]
  );

  return toBudgetValidationResult(fallbackRows);
}

async function getPostingDistributionsForPO(
  queryManyTx: <T extends QueryResultRow = QueryResultRow>(
    sql: string,
    values?: unknown[]
  ) => Promise<T[]>,
  poId: UUID
): Promise<PostingDistributionRow[]> {
  return queryManyTx<PostingDistributionRow>(
    `WITH distributions AS (
       SELECT
         pd.po_distribution_id,
         pd.po_line_id,
         pd.cost_center_id,
         pd.department_id,
         COALESCE(pd.gl_account, cc.gl_account) as gl_account,
         pd.amount::text as amount,
         pd.currency
       FROM po_distributions pd
       LEFT JOIN cost_centers cc ON cc.cost_center_id = pd.cost_center_id
       WHERE pd.po_id = $1
         AND pd.is_active = TRUE
     ),
     fallback AS (
       SELECT
         NULL::uuid as po_distribution_id,
         pol.line_id as po_line_id,
         COALESCE(pol.cost_center_id, po.cost_center_id) as cost_center_id,
         cc.department_id,
         cc.gl_account,
         pol.total_price::text as amount,
         COALESCE(po.currency, 'USD') as currency
       FROM purchase_order_lines pol
       JOIN purchase_orders po ON po.po_id = pol.po_id
       LEFT JOIN cost_centers cc ON cc.cost_center_id = COALESCE(pol.cost_center_id, po.cost_center_id)
       WHERE pol.po_id = $1
         AND NOT EXISTS (SELECT 1 FROM distributions)
     )
     SELECT
       d.po_distribution_id,
       d.po_line_id,
       d.cost_center_id,
       d.department_id,
       d.gl_account,
       d.amount,
       d.currency
     FROM distributions d
     WHERE d.cost_center_id IS NOT NULL
     UNION ALL
     SELECT
       f.po_distribution_id,
       f.po_line_id,
       f.cost_center_id,
       f.department_id,
       f.gl_account,
       f.amount,
       f.currency
     FROM fallback f
     WHERE f.cost_center_id IS NOT NULL`,
    [poId]
  );
}

async function postTransitionForPO(
  poId: UUID,
  sourceType: 'RECEIPT' | 'INVOICE',
  sourceDocumentId: UUID,
  sourceDocumentNumber: string | undefined,
  encumbranceType: 'ACCRUAL' | 'LIABILITY',
  debitMemo: string,
  creditMemo: string,
  debitAccountResolver: (row: PostingDistributionRow) => string,
  creditAccountResolver: (row: PostingDistributionRow) => string,
  createdBy?: UUID
): Promise<AccountingTransitionSummary> {
  return withTransaction(async (ctx) => {
    const existingEntry = await ctx.queryOne<ExistingIdRow>(
      `SELECT subledger_entry_id as id
       FROM subledger_entries
       WHERE source_type = $1
         AND source_document_id = $2
         AND status IN ('DRAFT', 'POSTED')
       LIMIT 1`,
      [sourceType, sourceDocumentId]
    );

    if (existingEntry) {
      return {
        insertedEncumbrances: 0,
        createdSubledgerEntries: 0,
        createdSubledgerLines: 0,
      };
    }

    const distributions = await getPostingDistributionsForPO(ctx.queryMany, poId);
    if (distributions.length === 0) {
      return {
        insertedEncumbrances: 0,
        createdSubledgerEntries: 0,
        createdSubledgerLines: 0,
      };
    }

    const now = new Date();
    const fiscalYear = now.getUTCFullYear();
    const fiscalPeriod = `${fiscalYear}-${String(now.getUTCMonth() + 1).padStart(2, '0')}`;
    const insertedRows: Array<{
      encumbranceId: UUID;
      poDistributionId: UUID | null;
      costCenterId: UUID;
      departmentId: UUID | null;
      glAccount: string | null;
      amount: number;
      currency: string;
    }> = [];
    let insertedEncumbrances = 0;

    for (const distribution of distributions) {
      const sourceLineId = distribution.po_distribution_id ?? distribution.po_line_id;
      const existingEncumbrance = await ctx.queryOne<ExistingIdRow>(
        `SELECT encumbrance_id as id
         FROM budget_encumbrances
         WHERE source_type = $1
           AND source_document_id = $2
           AND source_line_id = $3
           AND encumbrance_type = $4
         LIMIT 1`,
        [sourceType, sourceDocumentId, sourceLineId, encumbranceType]
      );

      if (existingEncumbrance) {
        continue;
      }

      const inserted = await ctx.queryOne<{ encumbrance_id: string }>(
        `INSERT INTO budget_encumbrances (
           source_type,
           source_document_id,
           source_line_id,
           reference_po_id,
           reference_po_line_id,
           cost_center_id,
           department_id,
           fiscal_year,
           fiscal_period,
           encumbrance_type,
           amount,
           currency,
           status,
           effective_date,
           notes,
           created_by,
           updated_by
         ) VALUES (
           $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, 'OPEN', CURRENT_DATE, $13, $14, $14
         )
         RETURNING encumbrance_id`,
        [
          sourceType,
          sourceDocumentId,
          sourceLineId,
          poId,
          distribution.po_line_id,
          distribution.cost_center_id,
          distribution.department_id,
          fiscalYear,
          fiscalPeriod,
          encumbranceType,
          parseAmount(distribution.amount),
          distribution.currency,
          `Auto-posted ${encumbranceType.toLowerCase()} from ${sourceType.toLowerCase()} ${sourceDocumentId}`,
          createdBy ?? null,
        ]
      );

      if (!inserted) {
        continue;
      }

      insertedEncumbrances++;
      insertedRows.push({
        encumbranceId: inserted.encumbrance_id,
        poDistributionId: distribution.po_distribution_id,
        costCenterId: distribution.cost_center_id,
        departmentId: distribution.department_id,
        glAccount: distribution.gl_account,
        amount: parseAmount(distribution.amount),
        currency: distribution.currency,
      });
    }

    if (insertedRows.length === 0) {
      return {
        insertedEncumbrances,
        createdSubledgerEntries: 0,
        createdSubledgerLines: 0,
      };
    }

    const totalAmount = insertedRows.reduce((sum, row) => sum + row.amount, 0);
    const entryNumber = await generateSubledgerEntryNumber(ctx.queryOne);
    const periodYear = now.getUTCFullYear();
    const periodMonth = now.getUTCMonth() + 1;

    const entry = await ctx.queryOne<{ subledger_entry_id: string }>(
      `INSERT INTO subledger_entries (
         entry_number,
         entry_date,
         period_year,
         period_month,
         source_module,
         source_type,
         source_document_id,
         source_document_number,
         status,
         currency,
         total_debit,
         total_credit,
         description,
         posted_at,
         posted_by,
         created_by,
         updated_by
       ) VALUES (
         $1, CURRENT_DATE, $2, $3, 'PROCUREMENT', $4, $5, $6, 'POSTED', $7, $8, $8, $9, NOW(), $10, $10, $10
       )
       RETURNING subledger_entry_id`,
      [
        entryNumber,
        periodYear,
        periodMonth,
        sourceType,
        sourceDocumentId,
        sourceDocumentNumber ?? null,
        insertedRows[0]?.currency ?? 'USD',
        totalAmount,
        `${sourceType} ${encumbranceType.toLowerCase()} posting for PO ${poId}`,
        createdBy ?? null,
      ]
    );

    if (!entry) {
      return {
        insertedEncumbrances,
        createdSubledgerEntries: 0,
        createdSubledgerLines: 0,
      };
    }

    let createdSubledgerLines = 0;
    let lineNumber = 1;
    for (const row of insertedRows) {
      await ctx.queryOne(
        `INSERT INTO subledger_lines (
           subledger_entry_id,
           line_number,
           po_distribution_id,
           budget_encumbrance_id,
           cost_center_id,
           department_id,
           gl_account,
           debit_amount,
           credit_amount,
           currency,
           memo,
           created_by
         ) VALUES (
           $1, $2, $3, $4, $5, $6, $7, $8, 0, $9, $10, $11
         )`,
        [
          entry.subledger_entry_id,
          lineNumber++,
          row.poDistributionId,
          row.encumbranceId,
          row.costCenterId,
          row.departmentId,
          debitAccountResolver({
            po_distribution_id: row.poDistributionId,
            po_line_id: '',
            cost_center_id: row.costCenterId,
            department_id: row.departmentId,
            gl_account: row.glAccount,
            amount: String(row.amount),
            currency: row.currency,
          }),
          row.amount,
          row.currency,
          debitMemo,
          createdBy ?? null,
        ]
      );

      await ctx.queryOne(
        `INSERT INTO subledger_lines (
           subledger_entry_id,
           line_number,
           po_distribution_id,
           budget_encumbrance_id,
           cost_center_id,
           department_id,
           gl_account,
           debit_amount,
           credit_amount,
           currency,
           memo,
           created_by
         ) VALUES (
           $1, $2, $3, $4, $5, $6, $7, 0, $8, $9, $10, $11
         )`,
        [
          entry.subledger_entry_id,
          lineNumber++,
          row.poDistributionId,
          row.encumbranceId,
          row.costCenterId,
          row.departmentId,
          creditAccountResolver({
            po_distribution_id: row.poDistributionId,
            po_line_id: '',
            cost_center_id: row.costCenterId,
            department_id: row.departmentId,
            gl_account: row.glAccount,
            amount: String(row.amount),
            currency: row.currency,
          }),
          row.amount,
          row.currency,
          creditMemo,
          createdBy ?? null,
        ]
      );

      createdSubledgerLines += 2;
    }

    return {
      insertedEncumbrances,
      createdSubledgerEntries: 1,
      createdSubledgerLines,
    };
  });
}

export async function postAccrualForReceipt(
  poId: UUID,
  receiptId: UUID,
  receiptNumber?: string,
  createdBy?: UUID
): Promise<AccountingTransitionSummary> {
  const result = await postTransitionForPO(
    poId,
    'RECEIPT',
    receiptId,
    receiptNumber,
    'ACCRUAL',
    'Receipt accrual debit',
    'Receipt accrual credit',
    () => '1400-INVENTORY-ACCRUAL',
    row => row.gl_account ?? '2200-GRNI',
    createdBy
  );

  if (result.insertedEncumbrances > 0) {
    await queryOne(
      `UPDATE budget_encumbrances
       SET status = 'PARTIALLY_RELEASED',
           updated_at = NOW(),
           notes = COALESCE(notes || E'\n', '') || 'Partially released by receipt accrual posting'
       WHERE reference_po_id = $1
         AND encumbrance_type = 'ENCUMBRANCE'
         AND status = 'OPEN'`,
      [poId]
    );
  }

  return result;
}

export async function postLiabilityForInvoice(
  poId: UUID,
  invoiceId: UUID,
  invoiceNumber?: string,
  createdBy?: UUID
): Promise<AccountingTransitionSummary> {
  const result = await postTransitionForPO(
    poId,
    'INVOICE',
    invoiceId,
    invoiceNumber,
    'LIABILITY',
    'Invoice liability debit',
    'Invoice liability credit',
    row => row.gl_account ?? '5000-PURCHASE-EXPENSE',
    () => '2000-ACCOUNTS-PAYABLE',
    createdBy
  );

  if (result.insertedEncumbrances > 0) {
    await queryOne(
      `UPDATE budget_encumbrances
       SET status = 'RELEASED',
           released_date = NOW(),
           updated_at = NOW(),
           notes = COALESCE(notes || E'\n', '') || 'Released by invoice liability posting'
       WHERE reference_po_id = $1
         AND encumbrance_type IN ('ENCUMBRANCE', 'ACCRUAL')
         AND status IN ('OPEN', 'PARTIALLY_RELEASED')`,
      [poId]
    );
  }

  return result;
}

export async function evaluatePOCloseGuard(
  poId: UUID
): Promise<{ canClose: boolean; reasons: string[] }> {
  const unresolvedResult = await queryOne<{ count: string }>(
    `SELECT COUNT(*)::text as count
     FROM budget_encumbrances
     WHERE reference_po_id = $1
       AND encumbrance_type IN ('ENCUMBRANCE', 'ACCRUAL')
       AND status IN ('OPEN', 'PARTIALLY_RELEASED')`,
    [poId]
  );

  const liabilityResult = await queryOne<{ count: string }>(
    `SELECT COUNT(*)::text as count
     FROM budget_encumbrances
     WHERE reference_po_id = $1
       AND source_type = 'INVOICE'
       AND encumbrance_type = 'LIABILITY'`,
    [poId]
  );

  const unresolvedCount = parseInt(unresolvedResult?.count ?? '0', 10) || 0;
  const liabilityCount = parseInt(liabilityResult?.count ?? '0', 10) || 0;
  const reasons: string[] = [];

  if (unresolvedCount > 0) {
    reasons.push(
      `PO has ${unresolvedCount} unresolved encumbrance/accrual accounting record(s)`
    );
  }

  if (liabilityCount === 0) {
    reasons.push('PO has no invoice liability posting');
  }

  return {
    canClose: reasons.length === 0,
    reasons,
  };
}
