#!/usr/bin/env node
/* eslint-disable no-console */

const fs = require('fs');
const path = require('path');

const backendRoot = path.resolve(__dirname, '..');
const repoRoot = path.resolve(backendRoot, '..');

function readJson(relativePath, baseDir = repoRoot) {
  const filePath = path.resolve(baseDir, relativePath);
  return JSON.parse(fs.readFileSync(filePath, 'utf8'));
}

function readFile(relativePath, baseDir = repoRoot) {
  const filePath = path.resolve(baseDir, relativePath);
  return fs.readFileSync(filePath, 'utf8');
}

function readJsonIfExists(relativePath, baseDir = repoRoot) {
  const filePath = path.resolve(baseDir, relativePath);
  if (!fs.existsSync(filePath)) {
    return null;
  }
  return JSON.parse(fs.readFileSync(filePath, 'utf8'));
}

function parseOpenApiRoutes(openApiContent) {
  const lines = openApiContent.split(/\r?\n/);
  const routesByPath = new Map();
  let currentPath = null;

  for (const line of lines) {
    const pathMatch = line.match(/^\s{2}(\/[^:]+):\s*$/);
    if (pathMatch) {
      currentPath = pathMatch[1];
      if (!routesByPath.has(currentPath)) {
        routesByPath.set(currentPath, new Set());
      }
      continue;
    }

    const methodMatch = line.match(/^\s{4}(get|post|put|delete|patch|options|head):\s*$/);
    if (currentPath && methodMatch) {
      routesByPath.get(currentPath).add(methodMatch[1].toUpperCase());
      continue;
    }
  }

  return routesByPath;
}

function parseRuntimeRoutes(cdkRoutePayload) {
  const routesByPath = new Map();
  for (const route of cdkRoutePayload.routes ?? []) {
    const routePath = String(route.path ?? '').trim();
    if (!routePath) {
      continue;
    }
    if (!routesByPath.has(routePath)) {
      routesByPath.set(routePath, new Set());
    }

    const methods = route.methods ?? [];
    for (const method of methods) {
      routesByPath.get(routePath).add(String(method).toUpperCase());
    }
  }
  return routesByPath;
}

function toRouteSet(routesByPath) {
  const result = new Set();
  for (const [routePath, methods] of routesByPath.entries()) {
    for (const method of methods) {
      result.add(`${method} ${routePath}`);
    }
  }
  return result;
}

function setDiff(leftSet, rightSet) {
  const result = [];
  for (const value of leftSet) {
    if (!rightSet.has(value)) {
      result.push(value);
    }
  }
  return result.sort();
}

function collectMethodMismatches(runtimeByPath, openApiByPath) {
  const mismatches = [];
  const allPaths = new Set([...runtimeByPath.keys(), ...openApiByPath.keys()]);

  for (const routePath of allPaths) {
    const runtimeMethods = runtimeByPath.get(routePath) ?? new Set();
    const openApiMethods = openApiByPath.get(routePath) ?? new Set();

    const missingInOpenApi = [...runtimeMethods].filter((m) => !openApiMethods.has(m));
    const undocumentedInRuntime = [...openApiMethods].filter((m) => !runtimeMethods.has(m));

    if (missingInOpenApi.length === 0 && undocumentedInRuntime.length === 0) {
      continue;
    }

    mismatches.push({
      path: routePath,
      runtimeMethods: [...runtimeMethods].sort(),
      openApiMethods: [...openApiMethods].sort(),
      missingInOpenApi: missingInOpenApi.sort(),
      undocumentedInRuntime: undocumentedInRuntime.sort(),
    });
  }

  return mismatches.sort((a, b) => a.path.localeCompare(b.path));
}

function writeReport(report) {
  const outputDir = path.resolve(repoRoot, 'output', 'audit', 'contracts');
  fs.mkdirSync(outputDir, { recursive: true });
  const reportPath = path.join(outputDir, 'route-runtime-parity.json');
  fs.writeFileSync(reportPath, `${JSON.stringify(report, null, 2)}\n`, 'utf8');
  return reportPath;
}

function fail(errors) {
  console.error('[route-runtime-parity] parity check failed:');
  for (const error of errors) {
    console.error(`- ${error}`);
  }
  process.exit(1);
}

function listContractFiles() {
  const contractsDir = path.resolve(repoRoot, 'docs', 'contracts');
  if (!fs.existsSync(contractsDir)) {
    return [];
  }
  return fs
    .readdirSync(contractsDir, { withFileTypes: true })
    .filter((entry) => entry.isFile() && entry.name.endsWith('-shared-contract.json'))
    .map((entry) => path.resolve(contractsDir, entry.name))
    .sort();
}

function toRoutePairs(requiredRoutes) {
  const pairs = [];
  for (const route of requiredRoutes ?? []) {
    const routePath = String(route.path ?? '').trim();
    if (!routePath) {
      continue;
    }
    for (const method of route.methods ?? []) {
      pairs.push(`${String(method).toUpperCase()} ${routePath}`);
    }
  }
  return pairs;
}

function collectContractRoutes() {
  const contractFiles = listContractFiles();
  const requiredRuntime = [];
  const requiredOpenApi = [];

  for (const contractFile of contractFiles) {
    const contract = JSON.parse(fs.readFileSync(contractFile, 'utf8'));
    const contractName = path.basename(contractFile);

    for (const pair of toRoutePairs(contract.requiredRuntimeRoutes)) {
      requiredRuntime.push({ route: pair, contract: contractName });
    }

    for (const pair of toRoutePairs(contract.requiredOpenApiRoutes)) {
      requiredOpenApi.push({ route: pair, contract: contractName });
    }
  }

  return {
    contractFiles: contractFiles.map((filePath) => path.relative(repoRoot, filePath)),
    requiredRuntime,
    requiredOpenApi,
  };
}

function toContractRouteSet(routeEntries) {
  return new Set(routeEntries.map((entry) => entry.route));
}

function collectRouteOwners(routeEntries) {
  const owners = new Map();
  for (const entry of routeEntries) {
    if (!owners.has(entry.route)) {
      owners.set(entry.route, new Set());
    }
    owners.get(entry.route).add(entry.contract);
  }
  return owners;
}

function annotateRouteEntries(routes, ownersByRoute) {
  return routes.map((route) => ({
    route,
    contracts: [...(ownersByRoute.get(route) ?? [])].sort(),
  }));
}

function normalizeAllowlist(rawValues) {
  const set = new Set();
  for (const rawValue of rawValues ?? []) {
    const normalized = String(rawValue ?? '').trim().toUpperCase();
    if (normalized.length > 0) {
      set.add(normalized);
    }
  }
  return set;
}

function applyAllowlist(routes, allowlist) {
  const allowed = [];
  const unresolved = [];
  for (const route of routes) {
    const normalized = String(route).trim().toUpperCase();
    if (allowlist.has(normalized)) {
      allowed.push(route);
    } else {
      unresolved.push(route);
    }
  }
  return { allowed, unresolved };
}

function main() {
  const mode = String(process.env['ROUTE_PARITY_MODE'] ?? 'contract')
    .trim()
    .toLowerCase();
  const normalizedMode = mode.length > 0 ? mode : 'contract';

  const cdkRoutes = readJson('mappings/cdk_routes.json', repoRoot);
  const openApiContent = readFile('backend/api/openapi.yaml', repoRoot);
  const exceptionConfig =
    readJsonIfExists('docs/contracts/route-parity-exceptions.json', repoRoot) ?? {};

  const runtimeByPath = parseRuntimeRoutes(cdkRoutes);
  const openApiByPath = parseOpenApiRoutes(openApiContent);

  const runtimeRouteSet = toRouteSet(runtimeByPath);
  const openApiRouteSet = toRouteSet(openApiByPath);

  const missingInOpenApi = setDiff(runtimeRouteSet, openApiRouteSet);
  const undocumentedInRuntime = setDiff(openApiRouteSet, runtimeRouteSet);
  const methodMismatches = collectMethodMismatches(runtimeByPath, openApiByPath);

  const contractRoutes = collectContractRoutes();
  const requiredRuntimeSet = toContractRouteSet(contractRoutes.requiredRuntime);
  const requiredOpenApiSet = toContractRouteSet(contractRoutes.requiredOpenApi);
  const requiredRuntimeOwners = collectRouteOwners(contractRoutes.requiredRuntime);
  const requiredOpenApiOwners = collectRouteOwners(contractRoutes.requiredOpenApi);

  const requiredRuntimeMissingRuntime = setDiff(requiredRuntimeSet, runtimeRouteSet);
  const requiredRuntimeMissingOpenApi = setDiff(requiredRuntimeSet, openApiRouteSet);
  const requiredOpenApiMissingOpenApi = setDiff(requiredOpenApiSet, openApiRouteSet);
  const requiredOpenApiMissingRuntime = setDiff(requiredOpenApiSet, runtimeRouteSet);

  const allowMissingRuntime = normalizeAllowlist(exceptionConfig.allowMissingRuntimeRoutes);
  const allowMissingOpenApi = normalizeAllowlist(exceptionConfig.allowMissingOpenApiRoutes);
  const allowUndocumentedRuntime = normalizeAllowlist(
    exceptionConfig.allowUndocumentedRuntimeRoutes
  );

  const missingRuntimeResolution = applyAllowlist(requiredRuntimeMissingRuntime, allowMissingRuntime);
  const missingOpenApiResolution = applyAllowlist(
    requiredOpenApiMissingOpenApi,
    allowMissingOpenApi
  );
  const runtimeMissingOpenApiResolution = applyAllowlist(
    requiredRuntimeMissingOpenApi,
    allowMissingOpenApi
  );
  const openApiMissingRuntimeResolution = applyAllowlist(
    requiredOpenApiMissingRuntime,
    allowUndocumentedRuntime
  );

  const report = {
    generatedAt: new Date().toISOString(),
    mode: normalizedMode,
    runtimeRouteCount: runtimeRouteSet.size,
    openApiRouteCount: openApiRouteSet.size,
    missingInOpenApiCount: missingInOpenApi.length,
    undocumentedInRuntimeCount: undocumentedInRuntime.length,
    methodMismatchCount: methodMismatches.length,
    missingInOpenApi,
    undocumentedInRuntime,
    methodMismatches,
    contractScope: {
      contractFiles: contractRoutes.contractFiles,
      requiredRuntimeRouteCount: requiredRuntimeSet.size,
      requiredOpenApiRouteCount: requiredOpenApiSet.size,
      requiredRuntimeMissingRuntimeCount: requiredRuntimeMissingRuntime.length,
      requiredRuntimeMissingOpenApiCount: requiredRuntimeMissingOpenApi.length,
      requiredOpenApiMissingOpenApiCount: requiredOpenApiMissingOpenApi.length,
      requiredOpenApiMissingRuntimeCount: requiredOpenApiMissingRuntime.length,
      allowedMissingRuntimeCount: missingRuntimeResolution.allowed.length,
      allowedMissingOpenApiCount:
        missingOpenApiResolution.allowed.length + runtimeMissingOpenApiResolution.allowed.length,
      allowedUndocumentedRuntimeCount: openApiMissingRuntimeResolution.allowed.length,
      requiredRuntimeMissingRuntime: annotateRouteEntries(
        requiredRuntimeMissingRuntime,
        requiredRuntimeOwners
      ),
      requiredRuntimeMissingOpenApi: annotateRouteEntries(
        requiredRuntimeMissingOpenApi,
        requiredRuntimeOwners
      ),
      requiredOpenApiMissingOpenApi: annotateRouteEntries(
        requiredOpenApiMissingOpenApi,
        requiredOpenApiOwners
      ),
      requiredOpenApiMissingRuntime: annotateRouteEntries(
        requiredOpenApiMissingRuntime,
        requiredOpenApiOwners
      ),
      unresolvedMissingRuntime: annotateRouteEntries(
        missingRuntimeResolution.unresolved,
        requiredRuntimeOwners
      ),
      unresolvedMissingOpenApi: annotateRouteEntries(
        missingOpenApiResolution.unresolved,
        requiredOpenApiOwners
      ),
      unresolvedRuntimeMissingOpenApi: annotateRouteEntries(
        runtimeMissingOpenApiResolution.unresolved,
        requiredRuntimeOwners
      ),
      unresolvedOpenApiMissingRuntime: annotateRouteEntries(
        openApiMissingRuntimeResolution.unresolved,
        requiredOpenApiOwners
      ),
    },
  };

  const reportPath = writeReport(report);

  if (normalizedMode === 'strict') {
    if (missingInOpenApi.length > 0 || undocumentedInRuntime.length > 0) {
      fail([
        `runtime routes missing from OpenAPI: ${missingInOpenApi.length}`,
        `OpenAPI routes not found at runtime: ${undocumentedInRuntime.length}`,
        `details written to ${reportPath}`,
      ]);
    }
  } else if (normalizedMode === 'contract-strict') {
    if (
      missingRuntimeResolution.unresolved.length > 0 ||
      missingOpenApiResolution.unresolved.length > 0 ||
      runtimeMissingOpenApiResolution.unresolved.length > 0 ||
      openApiMissingRuntimeResolution.unresolved.length > 0
    ) {
      fail([
        `contract required runtime routes missing at runtime: ${missingRuntimeResolution.unresolved.length}`,
        `contract required OpenAPI routes missing in OpenAPI: ${missingOpenApiResolution.unresolved.length}`,
        `contract runtime routes missing in OpenAPI: ${runtimeMissingOpenApiResolution.unresolved.length}`,
        `contract OpenAPI routes missing at runtime: ${openApiMissingRuntimeResolution.unresolved.length}`,
        `details written to ${reportPath}`,
      ]);
    }
  } else if (
    missingRuntimeResolution.unresolved.length > 0 ||
    missingOpenApiResolution.unresolved.length > 0
  ) {
    fail([
      `contract required runtime routes missing at runtime: ${missingRuntimeResolution.unresolved.length}`,
      `contract required OpenAPI routes missing in OpenAPI: ${missingOpenApiResolution.unresolved.length}`,
      `details written to ${reportPath}`,
    ]);
  }

  console.log(`[route-runtime-parity] checks passed (mode=${normalizedMode})`);
  console.log(
    `[route-runtime-parity] full-drift runtime->openapi=${missingInOpenApi.length}, openapi->runtime=${undocumentedInRuntime.length}`
  );
  console.log(
    `[route-runtime-parity] contract unresolved runtime-missing=${missingRuntimeResolution.unresolved.length}, openapi-missing=${missingOpenApiResolution.unresolved.length}`
  );
  console.log(`[route-runtime-parity] report: ${reportPath}`);
}

main();
