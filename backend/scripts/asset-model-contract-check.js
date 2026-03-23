#!/usr/bin/env node

/**
 * Asset shared model contract check
 *
 * Verifies critical DB -> backend types -> OpenAPI -> frontend mappings
 * for shared asset entities (core + relationships + HAM/SAM/EAM projections).
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

function readJson(relativePath, baseDir = backendRoot) {
  const filePath = path.resolve(baseDir, relativePath);
  return JSON.parse(fs.readFileSync(filePath, 'utf8'));
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

function assertTableColumns(tables, tableName, requiredColumns, failures) {
  const table = tables[tableName];
  if (!table) {
    failures.push(`missing table '${tableName}' in mappings/tables.json`);
    return;
  }

  const columns = new Set(table.columns ?? []);
  for (const column of requiredColumns) {
    if (!columns.has(column)) {
      failures.push(`table '${tableName}' missing required column '${column}'`);
    }
  }
}

function main() {
  const failures = [];

  const contract = readJson('docs/contracts/asset-shared-contract.json', repoRoot);
  const tables = readJson('mappings/tables.json', repoRoot);

  const { content: backendAssetTypes } = readFile('packages/types/src/asset.ts');
  const { content: backendHardwareTypes } = readFile('packages/types/src/hardware-asset.ts');
  const { content: backendSoftwareTypes } = readFile('packages/types/src/software-asset.ts');
  const { content: backendEnterpriseTypes } = readFile('packages/types/src/enterprise-asset.ts');
  const { content: assetRepository } = readFile('packages/services/asset-service/src/service/asset-repository.ts');
  const { content: relationshipRepository } = readFile(
    'packages/services/asset-service/src/service/relationship-repository.ts'
  );
  const { content: openApi } = readFile('api/openapi.yaml');
  const { content: frontendAssetTypes } = readFile('frontend/src/types/asset.ts', repoRoot);
  const { content: frontendAssetApi } = readFile('frontend/src/services/asset-api.ts', repoRoot);
  const { content: frontendRelationshipUi } = readFile(
    'frontend/src/components/asset-detail/AssetRelationships.tsx',
    repoRoot
  );

  const assetTypeValues = contract.enums.assetType;
  const assetStatusValues = contract.enums.assetStatus;
  const relationTypeValues = contract.enums.assetRelationType;

  requireAll(
    backendAssetTypes,
    assetTypeValues.map((value) => `'${value}'`),
    '@ams/types AssetType',
    failures
  );

  requireAll(
    backendHardwareTypes,
    ['stockroomId', 'building'],
    '@ams/types HardwareAsset projection',
    failures
  );
  requireAll(
    backendSoftwareTypes,
    ['softwareProductId'],
    '@ams/types SoftwareAsset projection',
    failures
  );
  requireAll(
    backendEnterpriseTypes,
    ['facilityId', 'building', 'operatingHours'],
    '@ams/types EnterpriseAsset projection',
    failures
  );
  requireAll(
    backendAssetTypes,
    assetStatusValues.map((value) => `'${value}'`),
    '@ams/types AssetStatus',
    failures
  );
  requireAll(
    backendAssetTypes,
    relationTypeValues.map((value) => `'${value}'`),
    '@ams/types AssetRelationType',
    failures
  );

  requireAll(
    frontendAssetTypes,
    assetTypeValues.map((value) => `'${value}'`),
    'frontend AssetType',
    failures
  );
  requireAll(
    frontendAssetTypes,
    assetStatusValues.map((value) => `'${value}'`),
    'frontend AssetStatus',
    failures
  );
  requireAll(
    frontendAssetTypes,
    relationTypeValues.map((value) => `'${value}'`),
    'frontend RelationshipType',
    failures
  );

  requireAll(openApi, assetTypeValues, 'OpenAPI AssetType enum', failures);
  requireAll(openApi, assetStatusValues, 'OpenAPI AssetStatus enum', failures);
  requireAll(openApi, relationTypeValues, 'OpenAPI AssetRelationType enum', failures);

  requireAll(
    openApi,
    ['/assets:', '/assets/{assetId}:', '/assets/{assetId}/relationships:'],
    'OpenAPI asset route coverage',
    failures
  );

  const assetCore = contract.entities.assetCore;
  const assetRelationship = contract.entities.assetRelationship;
  const hamProjection = contract.entities.hamProjection;
  const samProjection = contract.entities.samProjection;
  const eamProjection = contract.entities.eamProjection;

  assertTableColumns(tables, assetCore.table, assetCore.requiredColumns, failures);
  assertTableColumns(tables, assetRelationship.table, assetRelationship.requiredColumns, failures);
  assertTableColumns(tables, hamProjection.table, hamProjection.requiredColumns, failures);
  assertTableColumns(tables, samProjection.table, samProjection.requiredColumns, failures);
  assertTableColumns(tables, eamProjection.table, eamProjection.requiredColumns, failures);

  requireAll(
    assetRepository,
    [
      'INSERT INTO assets',
      'upsertHardwareAttributes',
      'upsertSoftwareAttributes',
      'upsertEnterpriseAttributes',
      'asset_type',
      'status',
    ],
    'asset repository create/projection flow',
    failures
  );

  requireAll(
    relationshipRepository,
    ['relation_type', 'source_asset_id', 'target_asset_id', 'metadata'],
    'relationship repository canonical fields',
    failures
  );

  requireAll(
    frontendAssetApi,
    [
      'const relationType = mapRelationshipType(raw.relationship.relationType);',
      'relationType,',
      'relationshipType: relationType',
      'const VALID_RELATIONSHIP_TYPES: readonly RelationshipType[] = RELATIONSHIP_TYPES;',
    ],
    'frontend asset-api relationship mapper',
    failures
  );

  requireAll(
    frontendRelationshipUi,
    ['getRelationshipType', 'relationship.relationType ?? relationship.relationshipType'],
    'frontend relationship UI compatibility fallback',
    failures
  );

  if (failures.length > 0) {
    console.error('[asset-model-contract] failed checks:');
    for (const failure of failures) {
      console.error(`- ${failure}`);
    }
    process.exit(1);
  }

  console.log('[asset-model-contract] all checks passed');
}

main();
