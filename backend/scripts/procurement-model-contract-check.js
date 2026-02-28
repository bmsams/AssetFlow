#!/usr/bin/env node

/**
 * Procurement model contract sanity check
 *
 * Verifies critical DB -> backend types -> OpenAPI -> frontend mappings
 * for procurement entities (PO + requisitions + accounting linkage).
 */

const fs = require('fs');
const path = require('path');

const backendRoot = path.resolve(__dirname, '..');
const repoRoot = path.resolve(backendRoot, '..');

function readFile(relativePath, baseDir = backendRoot) {
  const filePath = path.resolve(baseDir, relativePath);
  return {
    filePath,
    content: fs.readFileSync(filePath, 'utf8'),
  };
}

function requireIncludes(content, token, context, failures) {
  if (!content.includes(token)) {
    failures.push(`${context} is missing token: ${token}`);
  }
}

function requireAll(content, tokens, context, failures) {
  for (const token of tokens) {
    requireIncludes(content, token, context, failures);
  }
}

function main() {
  const failures = [];

  const poStatuses = [
    'DRAFT',
    'PENDING_APPROVAL',
    'APPROVED',
    'REJECTED',
    'SENT',
    'ACKNOWLEDGED',
    'PARTIALLY_RECEIVED',
    'RECEIVED',
    'CLOSED',
    'INVOICED',
    'PAID',
    'ON_HOLD',
    'CANCELLED',
  ];

  const requisitionStatuses = [
    'DRAFT',
    'PENDING_APPROVAL',
    'APPROVED',
    'REJECTED',
    'PARTIALLY_CONVERTED',
    'CONVERTED',
    'CANCELLED',
  ];

  const requisitionLineStatuses = ['DRAFT', 'APPROVED', 'REJECTED', 'CONVERTED'];

  const { content: v028 } = readFile('migrations/V028__align_purchase_order_status_constraint.sql', repoRoot);
  const { content: v026 } = readFile('migrations/V026__requisition_workflow.sql', repoRoot);
  const { content: v027 } = readFile('migrations/V027__procurement_accounting.sql', repoRoot);
  const { content: v025 } = readFile('migrations/V025__po_line_vendor.sql', repoRoot);
  const { content: v023 } = readFile('migrations/V023__po_line_cost_center_stockroom_building.sql', repoRoot);
  const { content: v030 } = readFile(
    'migrations/V030__procurement_number_sequences_and_approval_status_guard.sql',
    repoRoot
  );
  const { content: backendPOType } = readFile('packages/types/src/purchase-order.ts');
  const { content: backendContractType } = readFile('packages/types/src/contract.ts');
  const { content: poRepository } = readFile(
    'packages/services/procurement-service/src/purchase-order/po-repository.ts'
  );
  const { content: requisitionRepository } = readFile(
    'packages/services/procurement-service/src/requisition/requisition-repository.ts'
  );
  const { content: poService } = readFile('packages/services/procurement-service/src/purchase-order/po-service.ts');
  const { content: openApi } = readFile('api/openapi.yaml');
  const { content: frontendProcurementTypes } = readFile(
    'frontend/src/types/procurement.ts',
    repoRoot
  );
  const { content: frontendProcurementApi } = readFile(
    'frontend/src/services/procurement-api.ts',
    repoRoot
  );

  requireAll(v028, poStatuses.map((status) => `'${status}'`), 'V028 purchase_orders status constraint', failures);

  requireAll(backendPOType, poStatuses.map((status) => `'${status}'`), '@ams/types POStatus', failures);
  requireAll(
    backendContractType,
    poStatuses.map((status) => `'${status}'`),
    '@ams/types PurchaseOrderStatus',
    failures
  );
  requireAll(
    frontendProcurementTypes,
    poStatuses.map((status) => `'${status}'`),
    'frontend PurchaseOrderStatus',
    failures
  );
  requireAll(
    frontendProcurementApi,
    poStatuses.map((status) => `'${status}'`),
    'frontend procurement-api VALID_PO_STATUSES',
    failures
  );
  requireAll(openApi, poStatuses, 'OpenAPI PurchaseOrderStatus', failures);

  requireAll(v026, requisitionStatuses.map((status) => `'${status}'`), 'V026 requisition_status enum', failures);
  requireAll(
    requisitionRepository,
    requisitionStatuses.map((status) => `'${status}'`),
    'requisition repository status type',
    failures
  );
  requireAll(
    frontendProcurementApi,
    requisitionStatuses.map((status) => `'${status}'`),
    'frontend requisition statuses',
    failures
  );
  requireAll(openApi, requisitionStatuses, 'OpenAPI requisition statuses', failures);
  requireAll(
    v026,
    requisitionLineStatuses.map((status) => `'${status}'`),
    'V026 requisition_line_status enum',
    failures
  );

  requireAll(
    v026,
    [
      'CREATE TABLE IF NOT EXISTS requisition_headers',
      'CREATE TABLE IF NOT EXISTS requisition_lines',
      'CREATE TABLE IF NOT EXISTS requisition_distributions',
      'CREATE TABLE IF NOT EXISTS requisition_approvals',
      'CREATE TABLE IF NOT EXISTS requisition_line_sources',
      'CREATE TABLE IF NOT EXISTS requisition_po_links',
    ],
    'V026 requisition entities',
    failures
  );
  requireAll(
    v026,
    [
      'converted_po_id UUID REFERENCES purchase_orders(po_id)',
      'converted_po_line_id UUID REFERENCES purchase_order_lines(line_id)',
      'UNIQUE (req_line_id, po_line_id)',
    ],
    'V026 requisition to PO lineage',
    failures
  );

  requireAll(
    v027,
    [
      'CREATE TABLE IF NOT EXISTS po_distributions',
      'CREATE TABLE IF NOT EXISTS budget_encumbrances',
      'CREATE TABLE IF NOT EXISTS subledger_entries',
      'CREATE TABLE IF NOT EXISTS subledger_lines',
      'requisition_distribution_id UUID REFERENCES requisition_distributions(requisition_distribution_id) ON DELETE SET NULL',
      'po_line_id UUID NOT NULL REFERENCES purchase_order_lines(line_id) ON DELETE CASCADE',
    ],
    'V027 accounting entities and references',
    failures
  );

  requireAll(
    v030,
    [
      'CREATE SEQUENCE IF NOT EXISTS purchase_order_number_seq',
      'CREATE SEQUENCE IF NOT EXISTS requisition_number_seq',
      'CREATE OR REPLACE FUNCTION generate_po_number()',
      'CREATE OR REPLACE FUNCTION generate_requisition_number()',
      "ADD CONSTRAINT valid_requisition_approval_status",
      "CHECK (status IN ('PENDING', 'APPROVED', 'REJECTED'))",
    ],
    'V030 sequence-backed numbering and requisition approval status guard',
    failures
  );

  requireAll(
    v025,
    [
      'ADD COLUMN IF NOT EXISTS vendor_id UUID REFERENCES vendors(vendor_id)',
      'ADD COLUMN IF NOT EXISTS vendor_name VARCHAR(255)',
    ],
    'V025 PO line vendor override columns',
    failures
  );
  requireAll(
    v023,
    ['ADD COLUMN IF NOT EXISTS cost_center_id UUID REFERENCES cost_centers(cost_center_id)'],
    'V023 PO line cost center override column',
    failures
  );

  requireAll(
    poRepository,
    [
      'SELECT generate_po_number() as "poNumber"',
      'withTransaction(async (ctx)',
      'export async function createPurchaseOrderWithLines(',
      'COALESCE(pol.vendor_id, po.vendor_id) as "effectiveVendorId"',
      'COALESCE(line_vendor.vendor_name, pol.vendor_name, header_vendor.vendor_name, \'\') as "effectiveVendorName"',
      'COALESCE(pol.cost_center_id, po.cost_center_id) as "effectiveCostCenterId"',
      'COALESCE(line_cc.code, header_cc.code, \'\') as "effectiveCostCenterCode"',
    ],
    'PO repository effective field projection',
    failures
  );
  requireAll(
    requisitionRepository,
    ['SELECT generate_requisition_number() as "requisitionNumber"'],
    'Requisition repository sequence-backed number generation',
    failures
  );

  requireAll(
    poService,
    ['repository.createPurchaseOrderWithLines(request, lines ?? [])'],
    'PO service transactional create usage',
    failures
  );

  requireAll(
    frontendProcurementApi,
    [
      'effectiveVendorId',
      'effectiveVendorName',
      'effectiveCostCenterId',
      'effectiveCostCenterCode',
    ],
    'frontend PO line mapper effective fields',
    failures
  );

  requireAll(
    openApi,
    [
      '/procurement/purchase-orders/{poId}/receipt-accounting',
      '/procurement/purchase-orders/{poId}/invoice-accounting',
      '/procurement/purchase-orders/{poId}/close-guard',
      '/procurement/purchase-orders/{poId}/close',
      '/procurement/requisitions',
      '/procurement/requisitions/{requisitionId}',
      '/procurement/requisitions/{requisitionId}/convert',
      '/procurement/requisitions/{requisitionId}/links',
    ],
    'OpenAPI procurement coverage',
    failures
  );

  if (failures.length > 0) {
    console.error('[procurement-model-contract] failed checks:');
    for (const failure of failures) {
      console.error(`- ${failure}`);
    }
    process.exit(1);
  }

  console.log('[procurement-model-contract] all checks passed');
}

main();
