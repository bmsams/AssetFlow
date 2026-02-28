#!/usr/bin/env node
/* eslint-disable no-console */

const fs = require('fs');
const path = require('path');

function loadJson(filePath) {
  return JSON.parse(fs.readFileSync(filePath, 'utf8'));
}

function fail(message, errors) {
  console.error(`\n[schema-smoke] ${message}`);
  for (const error of errors) {
    console.error(`- ${error}`);
  }
  process.exit(1);
}

function assertColumns(tables, tableName, requiredColumns, errors) {
  const table = tables[tableName];
  if (!table) {
    errors.push(`missing table '${tableName}'`);
    return;
  }

  const columns = new Set(table.columns ?? []);
  for (const column of requiredColumns) {
    if (!columns.has(column)) {
      errors.push(`table '${tableName}' missing required column '${column}'`);
    }
  }
}

function assertNoPatterns(filePath, patterns, errors) {
  const content = fs.readFileSync(filePath, 'utf8');
  for (const pattern of patterns) {
    if (pattern.test(content)) {
      errors.push(`file '${filePath}' contains prohibited pattern ${pattern}`);
    }
  }
}

const repoRoot = path.resolve(__dirname, '..', '..');
const tablesPath = path.join(repoRoot, 'mappings', 'tables.json');
const tables = loadJson(tablesPath);

const tableErrors = [];
assertColumns(
  tables,
  'hardware_assets',
  ['building', 'floor', 'room', 'rack'],
  tableErrors
);
assertColumns(
  tables,
  'purchase_orders',
  [
    'po_id',
    'po_number',
    'vendor_id',
    'requested_by',
    'approved_by',
    'ship_to_address',
    'shipping_method',
    'payment_terms',
    'currency',
    'subtotal',
    'shipping_amount',
    'tax_amount',
    'total_amount',
  ],
  tableErrors
);
assertColumns(
  tables,
  'purchase_order_lines',
  [
    'line_id',
    'po_id',
    'line_number',
    'product_description',
    'quantity',
    'received_quantity',
    'unit_price',
    'total_price',
    'status',
    'vendor_id',
    'vendor_name',
    'cost_center_id',
  ],
  tableErrors
);
assertColumns(
  tables,
  'request_lines',
  ['line_id', 'request_id', 'purchase_order_id', 'purchase_order_line_id', 'updated_at'],
  tableErrors
);
assertColumns(
  tables,
  'vendor_model_prices',
  ['vendor_id', 'model_id', 'unit_price', 'currency', 'is_active'],
  tableErrors
);

if (tableErrors.length > 0) {
  fail('table contract checks failed', tableErrors);
}

const patternErrors = [];
assertNoPatterns(
  path.join(
    repoRoot,
    'backend',
    'packages',
    'services',
    'admin-service',
    'src',
    'location',
    'location-repository.ts'
  ),
  [/ha\.room_id\b/g, /ha\.rack_id\b/g, /hardware_assets\s+WHERE\s+rack_id\b/g],
  patternErrors
);

assertNoPatterns(
  path.join(
    repoRoot,
    'backend',
    'packages',
    'services',
    'lifecycle-service',
    'src',
    'procurement',
    'procurement-repository.ts'
  ),
  [
    /po\.vendor_name\b/g,
    /po\.requester_id\b/g,
    /po\.approver_id\b/g,
    /source_request_id\s*=\s*\$/g,
    /cc\.cost_center_code\b/g,
    /hcc\.cost_center_code\b/g,
  ],
  patternErrors
);

assertNoPatterns(
  path.join(
    repoRoot,
    'backend',
    'packages',
    'services',
    'lifecycle-service',
    'src',
    'receiving',
    'receiving-repository.ts'
  ),
  [/po\.vendor_name\s+AS\s+header_vendor_name\b/g, /pol\.vendor_id\b/g, /pol\.vendor_name\b/g],
  patternErrors
);

if (patternErrors.length > 0) {
  fail('query pattern checks failed', patternErrors);
}

console.log('[schema-smoke] all checks passed');
