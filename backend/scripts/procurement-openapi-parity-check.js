#!/usr/bin/env node
/* eslint-disable no-console */

const fs = require('fs');
const path = require('path');

const repoRoot = path.resolve(__dirname, '..');
const openapiPath = path.join(repoRoot, 'api', 'openapi.yaml');

function loadLines(filePath) {
  return fs.readFileSync(filePath, 'utf8').split(/\r?\n/);
}

function collectProcurementRoutes(lines) {
  const routes = new Map();
  let currentPath = null;

  for (const line of lines) {
    const procurementPathMatch = line.match(/^\s{2}(\/procurement\/[^:]+):\s*$/);
    if (procurementPathMatch) {
      currentPath = procurementPathMatch[1];
      if (!routes.has(currentPath)) {
        routes.set(currentPath, new Set());
      }
      continue;
    }

    const anyPathMatch = line.match(/^\s{2}(\/[^:]+):\s*$/);
    if (anyPathMatch) {
      currentPath = null;
      continue;
    }

    if (!currentPath) {
      continue;
    }

    const methodMatch = line.match(/^\s{4}(get|post|put|delete|patch|options|head):\s*$/);
    if (methodMatch) {
      routes.get(currentPath).add(methodMatch[1]);
    }
  }

  return routes;
}

function fail(errors) {
  console.error('\n[procurement-openapi-parity] parity check failed:');
  for (const error of errors) {
    console.error(`- ${error}`);
  }
  process.exit(1);
}

const REQUIRED = {
  '/procurement/purchase-orders': ['get', 'post'],
  '/procurement/purchase-orders/{poId}': ['get', 'put'],
  '/procurement/purchase-orders/{poId}/lines': ['get', 'post'],
  '/procurement/purchase-orders/{poId}/lines/{lineId}': ['put', 'delete'],
  '/procurement/purchase-orders/{poId}/submit': ['post'],
  '/procurement/purchase-orders/{poId}/approve': ['post'],
  '/procurement/purchase-orders/{poId}/reject': ['post'],
  '/procurement/purchase-orders/{poId}/send': ['post'],
  '/procurement/purchase-orders/{poId}/cancel': ['post'],
  '/procurement/purchase-orders/{poId}/receipt-accounting': ['post'],
  '/procurement/purchase-orders/{poId}/invoice-accounting': ['post'],
  '/procurement/purchase-orders/{poId}/close-guard': ['get'],
  '/procurement/purchase-orders/{poId}/close': ['post'],
  '/procurement/pending-approvals': ['get'],
  '/procurement/requisitions': ['get', 'post'],
  '/procurement/requisitions/{requisitionId}': ['get'],
  '/procurement/requisitions/{requisitionId}/submit': ['post'],
  '/procurement/requisitions/{requisitionId}/approve': ['post'],
  '/procurement/requisitions/{requisitionId}/reject': ['post'],
  '/procurement/requisitions/{requisitionId}/convert': ['post'],
  '/procurement/requisitions/{requisitionId}/links': ['get'],
};

const DISALLOWED = {
  '/procurement/purchase-orders/{poId}': ['delete'],
};

const lines = loadLines(openapiPath);
const routes = collectProcurementRoutes(lines);
const errors = [];

for (const [requiredPath, methods] of Object.entries(REQUIRED)) {
  const presentMethods = routes.get(requiredPath);
  if (!presentMethods) {
    errors.push(`missing path '${requiredPath}'`);
    continue;
  }

  for (const method of methods) {
    if (!presentMethods.has(method)) {
      errors.push(`path '${requiredPath}' missing method '${method.toUpperCase()}'`);
    }
  }
}

for (const [pathName, methods] of Object.entries(DISALLOWED)) {
  const presentMethods = routes.get(pathName);
  if (!presentMethods) {
    continue;
  }

  for (const method of methods) {
    if (presentMethods.has(method)) {
      errors.push(`path '${pathName}' contains disallowed method '${method.toUpperCase()}'`);
    }
  }
}

if (errors.length > 0) {
  fail(errors);
}

console.log('[procurement-openapi-parity] all checks passed');
