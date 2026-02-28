/**
 * Procurement Accounting Service
 *
 * Orchestrates accounting postings for procurement workflow milestones.
 */

import type { UUID } from '@ams/types';
import { createLogger } from '@ams/utils';

import type {
  AccountingTransitionSummary,
  BudgetValidationResult,
  PostingSummary,
} from './accounting-repository';
import {
  copyRequisitionDistributionsToPO,
  createPreEncumbrancesForRequisition,
  evaluatePOCloseGuard,
  postEncumbrancesForPO,
  postAccrualForReceipt,
  postLiabilityForInvoice,
  validatePOBudget,
  validateRequisitionBudget,
} from './accounting-repository';

const logger = createLogger({ service: 'accounting-service' });

interface RequisitionPoLinkInput {
  readonly requisitionId: UUID;
  readonly reqLineId: UUID;
  readonly poId: UUID;
  readonly poLineId: UUID;
}

function isMissingAccountingSchemaError(error: Error): boolean {
  const message = error.message.toLowerCase();
  return (
    message.includes('relation "po_distributions" does not exist') ||
    message.includes('relation "budget_encumbrances" does not exist') ||
    message.includes('relation "subledger_entries" does not exist') ||
    message.includes('relation "subledger_lines" does not exist') ||
    message.includes('relation "requisition_distributions" does not exist')
  );
}

export async function postPreEncumbranceForApprovedRequisition(
  requisitionId: UUID,
  approverId?: UUID
): Promise<Pick<PostingSummary, 'insertedPreEncumbrances'>> {
  try {
    const insertedPreEncumbrances = await createPreEncumbrancesForRequisition(
      requisitionId,
      approverId
    );

    logger.info('Posted requisition pre-encumbrance', {
      requisitionId,
      insertedPreEncumbrances,
    });

    return { insertedPreEncumbrances };
  } catch (error) {
    const err = error as Error;
    if (isMissingAccountingSchemaError(err)) {
      logger.warn('Skipping requisition pre-encumbrance: accounting schema not yet applied', {
        requisitionId,
        error: err.message,
      });
      return { insertedPreEncumbrances: 0 };
    }

    throw err;
  }
}

export async function syncPoDistributionsFromRequisition(
  links: readonly RequisitionPoLinkInput[],
  createdBy?: UUID
): Promise<Pick<PostingSummary, 'insertedPoDistributions'>> {
  try {
    const insertedPoDistributions = await copyRequisitionDistributionsToPO(links, createdBy);

    logger.info('Synced PO distributions from requisition links', {
      linkCount: links.length,
      insertedPoDistributions,
    });

    return { insertedPoDistributions };
  } catch (error) {
    const err = error as Error;
    if (isMissingAccountingSchemaError(err)) {
      logger.warn('Skipping PO distribution sync: accounting schema not yet applied', {
        linkCount: links.length,
        error: err.message,
      });
      return { insertedPoDistributions: 0 };
    }

    throw err;
  }
}

export async function postEncumbranceForApprovedPO(
  poId: UUID,
  approvedBy?: UUID
): Promise<Pick<PostingSummary, 'insertedPoEncumbrances' | 'createdSubledgerEntries' | 'createdSubledgerLines'>> {
  try {
    const result = await postEncumbrancesForPO(poId, approvedBy);

    logger.info('Posted PO encumbrance and subledger entries', {
      poId,
      ...result,
    });

    return result;
  } catch (error) {
    const err = error as Error;
    if (isMissingAccountingSchemaError(err)) {
      logger.warn('Skipping PO encumbrance posting: accounting schema not yet applied', {
        poId,
        error: err.message,
      });
      return {
        insertedPoEncumbrances: 0,
        createdSubledgerEntries: 0,
        createdSubledgerLines: 0,
      };
    }

    throw err;
  }
}

export function formatBudgetValidationFailure(result: BudgetValidationResult): string {
  if (result.isValid || result.issues.length === 0) {
    return 'Budget validation failed';
  }

  const details = result.issues
    .map((issue) => {
      const code = issue.costCenterCode ?? issue.costCenterId;
      return `${code}: required ${issue.requiredAmount.toFixed(2)}, available ${issue.availableAmount.toFixed(
        2
      )}, deficit ${issue.deficitAmount.toFixed(2)}`;
    })
    .join('; ');

  return `Budget validation failed: ${details}`;
}

export async function validateBudgetForRequisition(
  requisitionId: UUID
): Promise<BudgetValidationResult> {
  try {
    const result = await validateRequisitionBudget(requisitionId);
    logger.info('Validated requisition budget', {
      requisitionId,
      isValid: result.isValid,
      issueCount: result.issues.length,
    });
    return result;
  } catch (error) {
    const err = error as Error;
    if (isMissingAccountingSchemaError(err)) {
      logger.warn('Skipping requisition budget validation: accounting schema not yet applied', {
        requisitionId,
        error: err.message,
      });
      return {
        isValid: true,
        issues: [],
      };
    }

    throw err;
  }
}

export async function validateBudgetForPO(poId: UUID): Promise<BudgetValidationResult> {
  try {
    const result = await validatePOBudget(poId);
    logger.info('Validated PO budget', {
      poId,
      isValid: result.isValid,
      issueCount: result.issues.length,
    });
    return result;
  } catch (error) {
    const err = error as Error;
    if (isMissingAccountingSchemaError(err)) {
      logger.warn('Skipping PO budget validation: accounting schema not yet applied', {
        poId,
        error: err.message,
      });
      return {
        isValid: true,
        issues: [],
      };
    }

    throw err;
  }
}

export async function postReceiptAccrualForPO(
  poId: UUID,
  receiptId: UUID,
  receiptNumber?: string,
  createdBy?: UUID
): Promise<AccountingTransitionSummary> {
  try {
    const result = await postAccrualForReceipt(poId, receiptId, receiptNumber, createdBy);
    logger.info('Posted receipt accrual accounting transition', {
      poId,
      receiptId,
      ...result,
    });
    return result;
  } catch (error) {
    const err = error as Error;
    if (isMissingAccountingSchemaError(err)) {
      logger.warn('Skipping receipt accrual posting: accounting schema not yet applied', {
        poId,
        receiptId,
        error: err.message,
      });
      return {
        insertedEncumbrances: 0,
        createdSubledgerEntries: 0,
        createdSubledgerLines: 0,
      };
    }

    throw err;
  }
}

export async function postInvoiceLiabilityForPO(
  poId: UUID,
  invoiceId: UUID,
  invoiceNumber?: string,
  createdBy?: UUID
): Promise<AccountingTransitionSummary> {
  try {
    const result = await postLiabilityForInvoice(poId, invoiceId, invoiceNumber, createdBy);
    logger.info('Posted invoice liability accounting transition', {
      poId,
      invoiceId,
      ...result,
    });
    return result;
  } catch (error) {
    const err = error as Error;
    if (isMissingAccountingSchemaError(err)) {
      logger.warn('Skipping invoice liability posting: accounting schema not yet applied', {
        poId,
        invoiceId,
        error: err.message,
      });
      return {
        insertedEncumbrances: 0,
        createdSubledgerEntries: 0,
        createdSubledgerLines: 0,
      };
    }

    throw err;
  }
}

export async function getPOCloseGuard(
  poId: UUID
): Promise<{ canClose: boolean; reasons: string[] }> {
  try {
    return await evaluatePOCloseGuard(poId);
  } catch (error) {
    const err = error as Error;
    if (isMissingAccountingSchemaError(err)) {
      logger.warn('Skipping PO close guard: accounting schema not yet applied', {
        poId,
        error: err.message,
      });
      return {
        canClose: true,
        reasons: [],
      };
    }
    throw err;
  }
}
