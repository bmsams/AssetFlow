/**
 * Requisition Service
 *
 * Business logic for requisition lifecycle and conversion to
 * one-vendor-per-PO grouped purchase orders.
 */

import type { PaginatedResult, PaginationParams, UUID } from '@ams/types';
import { createLogger } from '@ams/utils';

import type { PurchaseOrderWithLines } from '@ams/types';

import type { CreatePOLineRequest } from '@ams/types';
import * as accountingService from '../accounting/accounting-service';
import * as poService from '../purchase-order/po-service';
import type {
  CreateRequisitionInput,
  Requisition,
  RequisitionLine,
  RequisitionListFilters,
  RequisitionPoLink,
  RequisitionStatus,
  RequisitionWithLines,
} from './requisition-repository';
import * as repository from './requisition-repository';

const logger = createLogger({ service: 'requisition-service' });

const SUBMITTABLE_STATUSES: RequisitionStatus[] = ['DRAFT', 'REJECTED'];
const APPROVABLE_STATUSES: RequisitionStatus[] = ['PENDING_APPROVAL'];
const CONVERTIBLE_STATUSES: RequisitionStatus[] = ['APPROVED', 'PARTIALLY_CONVERTED'];

export interface RequisitionConversionResult {
  readonly requisition: RequisitionWithLines;
  readonly purchaseOrders: PurchaseOrderWithLines[];
  readonly links: RequisitionPoLink[];
}

interface ConversionGroup {
  readonly key: string;
  readonly vendorId: UUID;
  readonly currency: string;
  readonly lines: RequisitionLine[];
}

function canSubmit(status: RequisitionStatus): boolean {
  return SUBMITTABLE_STATUSES.includes(status);
}

function canApprove(status: RequisitionStatus): boolean {
  return APPROVABLE_STATUSES.includes(status);
}

function canConvert(status: RequisitionStatus): boolean {
  return CONVERTIBLE_STATUSES.includes(status);
}

function buildGroupKey(requisition: RequisitionWithLines, line: RequisitionLine): string {
  return [
    line.vendorId ?? 'NO_VENDOR',
    line.currency,
    requisition.legalEntity ?? '',
    requisition.shipToBuildingId ?? '',
  ].join('|');
}

function buildConversionGroups(requisition: RequisitionWithLines): ConversionGroup[] {
  const groups = new Map<string, ConversionGroup>();
  const linesToConvert = requisition.lines.filter(
    line => line.status === 'APPROVED' && !line.convertedPoLineId
  );

  for (const line of linesToConvert) {
    if (!line.vendorId) {
      throw new Error(`Cannot convert requisition line ${line.lineNumber}: no vendor resolved`);
    }

    const key = buildGroupKey(requisition, line);
    const existing = groups.get(key);
    if (existing) {
      (existing.lines as RequisitionLine[]).push(line);
      continue;
    }

    groups.set(key, {
      key,
      vendorId: line.vendorId,
      currency: line.currency,
      lines: [line],
    });
  }

  return Array.from(groups.values());
}

function resolveGroupCostCenterId(
  requisition: RequisitionWithLines,
  group: ConversionGroup
): UUID {
  const fromHeader = requisition.costCenterId;
  if (fromHeader) {
    return fromHeader;
  }

  const fromLine = group.lines.find(line => line.costCenterId)?.costCenterId;
  if (fromLine) {
    return fromLine;
  }

  throw new Error(
    `Cannot convert requisition ${requisition.requisitionNumber}: no cost center on header or grouped lines`
  );
}

function mapRequisitionLinesToPOLines(lines: RequisitionLine[]): CreatePOLineRequest[] {
  return lines.map(line => ({
    productType: line.productType,
    productId: line.productId ?? undefined,
    productDescription: line.productDescription,
    sku: line.sku ?? undefined,
    quantity: line.quantity,
    unitPrice: line.unitPrice,
    vendorId: line.vendorId ?? undefined,
    costCenterId: line.costCenterId ?? undefined,
    notes: line.notes ?? undefined,
  }));
}

export async function createRequisition(input: CreateRequisitionInput): Promise<RequisitionWithLines> {
  if (!input.lines || input.lines.length === 0) {
    throw new Error('Requisition must contain at least one line');
  }

  return repository.createRequisition(input);
}

export async function getRequisition(requisitionId: UUID): Promise<RequisitionWithLines | null> {
  return repository.getRequisitionWithLines(requisitionId);
}

export async function getRequisitionLinks(requisitionId: UUID): Promise<RequisitionPoLink[]> {
  return repository.getRequisitionPoLinks(requisitionId);
}

export async function listRequisitions(
  filters: RequisitionListFilters = {},
  pagination: PaginationParams = {}
): Promise<PaginatedResult<Requisition>> {
  return repository.listRequisitions(filters, pagination);
}

export async function submitRequisition(
  requisitionId: UUID,
  updatedBy?: UUID
): Promise<RequisitionWithLines> {
  const requisition = await repository.getRequisitionWithLines(requisitionId);
  if (!requisition) {
    throw new Error(`Requisition not found: ${requisitionId}`);
  }

  if (!canSubmit(requisition.status)) {
    throw new Error(`Cannot submit requisition in ${requisition.status} status`);
  }

  if (requisition.lines.length === 0) {
    throw new Error('Cannot submit requisition with no lines');
  }

  await repository.updateRequisitionStatus(requisitionId, 'PENDING_APPROVAL', { updatedBy });
  const updated = await repository.getRequisitionWithLines(requisitionId);
  if (!updated) {
    throw new Error('Failed to retrieve submitted requisition');
  }

  return updated;
}

export async function approveRequisition(
  requisitionId: UUID,
  approverId: UUID,
  notes?: string
): Promise<RequisitionWithLines> {
  const requisition = await repository.getRequisitionWithLines(requisitionId);
  if (!requisition) {
    throw new Error(`Requisition not found: ${requisitionId}`);
  }

  if (!canApprove(requisition.status)) {
    throw new Error(`Cannot approve requisition in ${requisition.status} status`);
  }

  const budgetValidation = await accountingService.validateBudgetForRequisition(requisitionId);
  if (!budgetValidation.isValid) {
    throw new Error(accountingService.formatBudgetValidationFailure(budgetValidation));
  }

  await repository.createRequisitionApprovalRecord(requisitionId, approverId, 'APPROVED', notes);
  await repository.updateRequisitionStatus(requisitionId, 'APPROVED', {
    approvedBy: approverId,
    approvedDate: new Date().toISOString(),
    updatedBy: approverId,
  });

  for (const line of requisition.lines) {
    await repository.updateRequisitionLineStatus(line.reqLineId, 'APPROVED');
  }

  await accountingService.postPreEncumbranceForApprovedRequisition(requisitionId, approverId);

  const updated = await repository.getRequisitionWithLines(requisitionId);
  if (!updated) {
    throw new Error('Failed to retrieve approved requisition');
  }

  return updated;
}

export async function rejectRequisition(
  requisitionId: UUID,
  rejectedBy: UUID,
  reason: string
): Promise<RequisitionWithLines> {
  const requisition = await repository.getRequisitionWithLines(requisitionId);
  if (!requisition) {
    throw new Error(`Requisition not found: ${requisitionId}`);
  }

  if (!canApprove(requisition.status)) {
    throw new Error(`Cannot reject requisition in ${requisition.status} status`);
  }

  await repository.createRequisitionApprovalRecord(requisitionId, rejectedBy, 'REJECTED', reason);
  await repository.updateRequisitionStatus(requisitionId, 'REJECTED', {
    rejectedBy,
    rejectedDate: new Date().toISOString(),
    rejectionReason: reason,
    updatedBy: rejectedBy,
  });

  for (const line of requisition.lines) {
    if (line.status !== 'CONVERTED') {
      await repository.updateRequisitionLineStatus(line.reqLineId, 'REJECTED');
    }
  }

  const updated = await repository.getRequisitionWithLines(requisitionId);
  if (!updated) {
    throw new Error('Failed to retrieve rejected requisition');
  }

  return updated;
}

export async function convertRequisitionToPOs(
  requisitionId: UUID,
  convertedBy?: UUID
): Promise<RequisitionConversionResult> {
  const requisition = await repository.getRequisitionWithLines(requisitionId);
  if (!requisition) {
    throw new Error(`Requisition not found: ${requisitionId}`);
  }

  if (!canConvert(requisition.status)) {
    throw new Error(`Cannot convert requisition in ${requisition.status} status`);
  }

  const groups = buildConversionGroups(requisition);
  if (groups.length === 0) {
    throw new Error('No approved unconverted requisition lines found for conversion');
  }

  const purchaseOrders: PurchaseOrderWithLines[] = [];
  const linkRecords: Array<{
    requisitionId: UUID;
    reqLineId: UUID;
    poId: UUID;
    poLineId: UUID;
    vendorId: UUID;
    createdBy?: UUID;
  }> = [];

  for (const group of groups) {
    const costCenterId = resolveGroupCostCenterId(requisition, group);
    const poLines = mapRequisitionLinesToPOLines(group.lines);

    const po = await poService.createPurchaseOrder(
      {
        vendorId: group.vendorId,
        costCenterId,
        currency: group.currency,
        expectedDeliveryDate: requisition.needByDate ?? undefined,
        notes: `Generated from requisition ${requisition.requisitionNumber}`,
        createdBy: convertedBy,
      },
      poLines
    );
    purchaseOrders.push(po);

    for (let i = 0; i < group.lines.length; i++) {
      const reqLine = group.lines[i]!;
      const poLine = po.lines[i];
      if (!poLine) {
        throw new Error(
          `Generated PO ${po.poNumber} line mismatch while linking requisition ${requisition.requisitionNumber}`
        );
      }

      linkRecords.push({
        requisitionId,
        reqLineId: reqLine.reqLineId,
        poId: po.poId,
        poLineId: poLine.lineId,
        vendorId: group.vendorId,
        createdBy: convertedBy,
      });
    }
  }

  await repository.createRequisitionPoLinks(linkRecords);
  await accountingService.syncPoDistributionsFromRequisition(linkRecords, convertedBy);

  const refreshed = await repository.getRequisitionWithLines(requisitionId);
  if (!refreshed) {
    throw new Error('Failed to load converted requisition');
  }

  const unconverted = refreshed.lines.filter(line => !line.convertedPoLineId);
  await repository.updateRequisitionStatus(
    requisitionId,
    unconverted.length > 0 ? 'PARTIALLY_CONVERTED' : 'CONVERTED',
    {
      convertedDate: new Date().toISOString(),
      updatedBy: convertedBy,
    }
  );

  const requisitionAfterStatus = await repository.getRequisitionWithLines(requisitionId);
  if (!requisitionAfterStatus) {
    throw new Error('Failed to load requisition after status update');
  }

  const links = await repository.getRequisitionPoLinks(requisitionId);

  logger.info('Requisition converted to PO(s)', {
    requisitionId,
    requisitionNumber: requisition.requisitionNumber,
    poCount: purchaseOrders.length,
    linkCount: links.length,
  });

  return {
    requisition: requisitionAfterStatus,
    purchaseOrders,
    links,
  };
}
