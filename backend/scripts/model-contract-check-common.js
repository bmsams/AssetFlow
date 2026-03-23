#!/usr/bin/env node
/* eslint-disable no-console */

const fs = require('fs');
const path = require('path');

const backendRoot = path.resolve(__dirname, '..');
const repoRoot = path.resolve(backendRoot, '..');

function readFile(relativePath, baseDir = repoRoot) {
  const filePath = path.resolve(baseDir, relativePath);
  return {
    filePath,
    content: fs.readFileSync(filePath, 'utf8'),
  };
}

function readJson(relativePath, baseDir = repoRoot) {
  const filePath = path.resolve(baseDir, relativePath);
  return JSON.parse(fs.readFileSync(filePath, 'utf8'));
}

function requireIncludes(content, token, context, failures) {
  if (!content.includes(token)) {
    failures.push(`${context} is missing token: ${token}`);
  }
}

function requireAll(content, tokens, context, failures) {
  for (const token of tokens ?? []) {
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
  for (const column of requiredColumns ?? []) {
    if (!columns.has(column)) {
      failures.push(`table '${tableName}' missing required column '${column}'`);
    }
  }
}

function assertViewExists(tables, viewName, failures) {
  if (!tables[viewName]) {
    failures.push(`missing view '${viewName}' in mappings/tables.json`);
  }
}

function parseOpenApiRoutes(openApiContent) {
  const lines = openApiContent.split(/\r?\n/);
  const routeMap = new Map();
  let currentPath = null;

  for (const line of lines) {
    const pathMatch = line.match(/^\s{2}(\/[^:]+):\s*$/);
    if (pathMatch) {
      currentPath = pathMatch[1];
      if (!routeMap.has(currentPath)) {
        routeMap.set(currentPath, new Set());
      }
      continue;
    }

    const methodMatch = line.match(/^\s{4}(get|post|put|delete|patch|options|head):\s*$/);
    if (currentPath && methodMatch) {
      routeMap.get(currentPath).add(methodMatch[1].toUpperCase());
      continue;
    }

    const anyTopLevelPath = line.match(/^\s{2}(\/[^:]+):\s*$/);
    if (!anyTopLevelPath) {
      continue;
    }
  }

  return routeMap;
}

function normalizeRuntimePath(pathValue) {
  return String(pathValue ?? '').trim();
}

function buildRuntimeRouteMap(runtimeRoutes) {
  const routeMap = new Map();

  for (const route of runtimeRoutes ?? []) {
    const routePath = normalizeRuntimePath(route.path);
    if (!routePath) {
      continue;
    }

    if (!routeMap.has(routePath)) {
      routeMap.set(routePath, new Set());
    }
    const methodSet = routeMap.get(routePath);
    for (const method of route.methods ?? []) {
      methodSet.add(String(method).toUpperCase());
    }
  }

  return routeMap;
}

function assertRoutes(routeMap, requiredRoutes, context, failures) {
  for (const requiredRoute of requiredRoutes ?? []) {
    const pathName = requiredRoute.path;
    const requiredMethods = requiredRoute.methods ?? [];

    const presentMethods = routeMap.get(pathName);
    if (!presentMethods) {
      failures.push(`${context} missing route path '${pathName}'`);
      continue;
    }

    for (const method of requiredMethods) {
      const normalizedMethod = String(method).toUpperCase();
      if (!presentMethods.has(normalizedMethod)) {
        failures.push(
          `${context} route '${pathName}' missing method '${normalizedMethod}'`
        );
      }
    }
  }
}

function resolveBase(baseHint) {
  if (!baseHint || baseHint === 'repo') {
    return repoRoot;
  }
  if (baseHint === 'backend') {
    return backendRoot;
  }
  return repoRoot;
}

function checkEnumTargets(contract, failures) {
  const enumTargets = contract.enumTargets ?? [];
  for (const target of enumTargets) {
    const values = contract.enums?.[target.enum] ?? [];
    if (values.length === 0) {
      failures.push(
        `contract enum '${target.enum}' referenced by enumTargets but not defined`
      );
      continue;
    }

    for (const fileRef of target.files ?? []) {
      const relativePath = typeof fileRef === 'string' ? fileRef : fileRef.path;
      const baseDir = resolveBase(typeof fileRef === 'string' ? 'repo' : fileRef.base);
      const { content } = readFile(relativePath, baseDir);
      for (const value of values) {
        requireIncludes(
          content,
          String(value),
          `${contract.module} enum ${target.enum} in ${relativePath}`,
          failures
        );
      }
    }
  }
}

function checkFileTokens(contract, failures) {
  for (const fileCheck of contract.fileChecks ?? []) {
    const baseDir = resolveBase(fileCheck.base);
    const { content } = readFile(fileCheck.path, baseDir);
    requireAll(
      content,
      fileCheck.tokens ?? [],
      `${contract.module} file check ${fileCheck.path}`,
      failures
    );
  }
}

function runContractCheck(contractRelativePath, label) {
  const failures = [];

  const contract = readJson(contractRelativePath, repoRoot);
  const tables = readJson('mappings/tables.json', repoRoot);
  const runtimeRoutes = readJson('mappings/cdk_routes.json', repoRoot).routes ?? [];
  const { content: openApi } = readFile('backend/api/openapi.yaml', repoRoot);

  for (const entity of Object.values(contract.entities ?? {})) {
    assertTableColumns(tables, entity.table, entity.requiredColumns, failures);
  }

  for (const viewName of contract.requiredViews ?? []) {
    assertViewExists(tables, viewName, failures);
  }

  checkEnumTargets(contract, failures);
  checkFileTokens(contract, failures);

  const runtimeRouteMap = buildRuntimeRouteMap(runtimeRoutes);
  const openApiRouteMap = parseOpenApiRoutes(openApi);

  assertRoutes(
    runtimeRouteMap,
    contract.requiredRuntimeRoutes ?? [],
    `${contract.module} runtime routes`,
    failures
  );
  assertRoutes(
    openApiRouteMap,
    contract.requiredOpenApiRoutes ?? [],
    `${contract.module} OpenAPI routes`,
    failures
  );

  if (failures.length > 0) {
    console.error(`[${label}] failed checks:`);
    for (const failure of failures) {
      console.error(`- ${failure}`);
    }
    process.exit(1);
  }

  console.log(`[${label}] all checks passed`);
}

module.exports = {
  runContractCheck,
};

