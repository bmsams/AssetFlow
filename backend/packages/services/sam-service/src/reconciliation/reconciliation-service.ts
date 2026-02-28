/**
 * Reconciliation Service - Business logic for software license reconciliation
 *
 * Implements:
 * - Reconciliation engine for comparing entitlements vs installations (Requirement 4.1)
 * - Compliance position calculation (compliant, over-licensed, under-licensed) (Requirement 4.2)
 *
 * Requirements: 4.1, 4.2
 */

import type { CompliancePosition, UUID } from '@ams/types';
import * as cache from '@ams/cache';
import { publishEvent } from '@ams/events';
import { createLogger, now } from '@ams/utils';
import { v4 as uuidv4 } from 'uuid';

import type {
  Entitlement,
  EntitlementSummary,
  InstallationSummary,
  ReconciliationResult,
  SoftwareInstallation,
  SoftwareProduct,
} from './reconciliation-repository';
import * as repository from './reconciliation-repository';

const logger = createLogger({ service: 'reconciliation-service' });

/**
 * Cache key for reconciliation results
 */
function reconciliationCacheKey(productId: UUID): string {
  return `reconciliation:${productId}:result`;
}

/**
 * Cache key for compliance position
 */
function complianceCacheKey(productId: UUID): string {
  return `compliance:${productId}:position`;
}

/**
 * Compliance position details
 */
export interface CompliancePositionDetails {
  readonly productId: UUID;
  readonly product: SoftwareProduct | null;
  readonly entitlementsOwned: number;
  readonly installationsFound: number;
  readonly compliancePosition: CompliancePosition;
  readonly overUnderCount: number;
  readonly compliancePercentage: number;
  readonly lastReconciledAt: string | null;
  readonly entitlementDetails: EntitlementSummary | null;
  readonly installationDetails: InstallationSummary | null;
}

/**
 * Reconciliation run result
 */
export interface ReconciliationRunResult {
  readonly runId: UUID;
  readonly startedAt: string;
  readonly completedAt: string;
  readonly productsReconciled: number;
  readonly results: readonly ReconciliationResult[];
  readonly summary: {
    readonly compliant: number;
    readonly overLicensed: number;
    readonly underLicensed: number;
  };
}

/**
 * Calculate compliance position based on entitlements owned vs installations found
 * Requirement 4.2: Determine compliance status as compliant, over-licensed, or under-licensed
 *
 * @param entitlementsOwned - Total number of licenses owned
 * @param installationsFound - Total number of installations discovered
 * @returns Compliance position
 */
export function calculateComplianceStatus(
  entitlementsOwned: number,
  installationsFound: number
): CompliancePosition {
  if (entitlementsOwned >= installationsFound) {
    if (entitlementsOwned > installationsFound) {
      return 'OVER_LICENSED';
    }
    return 'COMPLIANT';
  }
  return 'UNDER_LICENSED';
}

/**
 * Calculate the over/under licensed count
 * Positive = over-licensed, Negative = under-licensed, Zero = compliant
 */
export function calculateOverUnderCount(
  entitlementsOwned: number,
  installationsFound: number
): number {
  return entitlementsOwned - installationsFound;
}

/**
 * Calculate compliance percentage
 * 100% = exactly compliant, >100% = over-licensed, <100% = under-licensed
 */
export function calculateCompliancePercentage(
  entitlementsOwned: number,
  installationsFound: number
): number {
  if (installationsFound === 0) {
    return entitlementsOwned > 0 ? 100 : 0;
  }
  return Math.round((entitlementsOwned / installationsFound) * 100 * 100) / 100;
}

/**
 * Get entitlements for a software product
 * Requirement 4.1: Get entitlements owned
 */
export async function getEntitlements(productId: UUID): Promise<Entitlement[]> {
  logger.info('Getting entitlements for product', { productId });
  return repository.getEntitlementsByProduct(productId, true);
}

/**
 * Get installations for a software product
 * Requirement 4.1: Get installations discovered
 */
export async function getInstallations(productId: UUID): Promise<SoftwareInstallation[]> {
  logger.info('Getting installations for product', { productId });
  return repository.getInstallationsByProduct(productId, true);
}

/**
 * Run reconciliation for a specific software product
 * Requirement 4.1: Calculate compliance position by comparing entitlements owned vs installations discovered
 * Requirement 4.2: Determine compliance status
 *
 * @param productId - Software product ID to reconcile
 * @param reconciliationType - Type of reconciliation (AUTOMATIC, MANUAL, ON_DEMAND, AUDIT_PREP)
 * @param runId - Optional run ID for batch reconciliation
 * @returns Reconciliation result
 */
export async function runReconciliation(
  productId: UUID,
  reconciliationType: 'AUTOMATIC' | 'MANUAL' | 'ON_DEMAND' | 'AUDIT_PREP' = 'ON_DEMAND',
  runId?: UUID
): Promise<ReconciliationResult> {
  logger.info('Running reconciliation for product', { productId, reconciliationType, runId });

  // Verify product exists
  const product = await repository.getProductById(productId);
  if (!product) {
    throw new Error(`Software product not found: ${productId}`);
  }

  // Get entitlement summary (licenses owned)
  const entitlementSummary = await repository.getEntitlementSummary(productId);
  const entitlementsOwned = entitlementSummary?.totalQuantityPurchased ?? 0;

  // Get installation summary (software discovered)
  const installationSummary = await repository.getInstallationSummary(productId);
  const installationsFound = installationSummary?.activeInstallations ?? 0;

  // Calculate compliance position
  const compliancePosition = calculateComplianceStatus(entitlementsOwned, installationsFound);
  const overUnderCount = calculateOverUnderCount(entitlementsOwned, installationsFound);
  const compliancePercentage = calculateCompliancePercentage(entitlementsOwned, installationsFound);

  const timestamp = now();

  // Save reconciliation result
  const result = await repository.saveReconciliationResult({
    softwareProductId: productId,
    entitlementsOwned,
    installationsFound,
    compliancePosition,
    overUnderCount,
    lastReconciledAt: timestamp,
    effectiveLicensePosition: entitlementsOwned,
    licenseDemand: installationsFound,
    compliancePercentage,
    reconciliationRunId: runId ?? null,
    reconciliationType,
  });

  // Invalidate cache
  await cache.del(reconciliationCacheKey(productId));
  await cache.del(complianceCacheKey(productId));

  // Publish reconciliation completed event
  await publishEvent('RECONCILIATION_COMPLETED', {
    resultId: result.resultId,
    productId,
    publisher: product.publisher,
    productName: product.productName,
    entitlementsOwned,
    installationsFound,
    compliancePosition,
    overUnderCount,
    compliancePercentage,
    reconciliationType,
    runId,
  });

  logger.info('Reconciliation completed', {
    productId,
    compliancePosition,
    entitlementsOwned,
    installationsFound,
    overUnderCount,
  });

  return result;
}

/**
 * Run reconciliation for all active products
 * Requirement 4.1: Calculate compliance position for all products
 *
 * @param reconciliationType - Type of reconciliation
 * @returns Reconciliation run result with all product results
 */
export async function runReconciliationForAllProducts(
  reconciliationType: 'AUTOMATIC' | 'MANUAL' | 'ON_DEMAND' | 'AUDIT_PREP' = 'AUTOMATIC'
): Promise<ReconciliationRunResult> {
  const runId = uuidv4();
  const startedAt = now();

  logger.info('Starting reconciliation run for all products', { runId, reconciliationType });

  // Get all active products
  const products = await repository.getActiveProducts();
  const results: ReconciliationResult[] = [];

  let compliant = 0;
  let overLicensed = 0;
  let underLicensed = 0;

  // Reconcile each product
  for (const product of products) {
    try {
      const result = await runReconciliation(product.productId, reconciliationType, runId);
      results.push(result);

      // Update summary counts
      switch (result.compliancePosition) {
        case 'COMPLIANT':
          compliant++;
          break;
        case 'OVER_LICENSED':
          overLicensed++;
          break;
        case 'UNDER_LICENSED':
          underLicensed++;
          break;
      }
    } catch (error) {
      logger.error('Failed to reconcile product', error as Error, {
        productId: product.productId,
        runId,
      });
      // Continue with other products
    }
  }

  const completedAt = now();

  // Publish run completed event
  await publishEvent('RECONCILIATION_RUN_COMPLETED', {
    runId,
    startedAt,
    completedAt,
    productsReconciled: results.length,
    totalProducts: products.length,
    compliant,
    overLicensed,
    underLicensed,
    reconciliationType,
  });

  logger.info('Reconciliation run completed', {
    runId,
    productsReconciled: results.length,
    compliant,
    overLicensed,
    underLicensed,
  });

  return {
    runId,
    startedAt,
    completedAt,
    productsReconciled: results.length,
    results,
    summary: {
      compliant,
      overLicensed,
      underLicensed,
    },
  };
}

/**
 * Get compliance position for a software product
 * Requirement 4.2: Get current compliance status
 *
 * @param productId - Software product ID
 * @returns Compliance position details
 */
export async function getCompliancePosition(productId: UUID): Promise<CompliancePositionDetails> {
  logger.info('Getting compliance position for product', { productId });

  // Try cache first
  const cacheKey = complianceCacheKey(productId);
  const cached = await cache.get<CompliancePositionDetails>(cacheKey);
  if (cached) {
    logger.debug('Returning cached compliance position', { productId });
    return cached;
  }

  // Get product details
  const product = await repository.getProductById(productId);
  if (!product) {
    throw new Error(`Software product not found: ${productId}`);
  }

  // Get latest reconciliation result
  const latestResult = await repository.getLatestReconciliationResult(productId);

  // Get current entitlement and installation summaries
  const entitlementSummary = await repository.getEntitlementSummary(productId);
  const installationSummary = await repository.getInstallationSummary(productId);

  // Calculate current position (may differ from last reconciliation)
  const entitlementsOwned = entitlementSummary?.totalQuantityPurchased ?? 0;
  const installationsFound = installationSummary?.activeInstallations ?? 0;
  const compliancePosition = calculateComplianceStatus(entitlementsOwned, installationsFound);
  const overUnderCount = calculateOverUnderCount(entitlementsOwned, installationsFound);
  const compliancePercentage = calculateCompliancePercentage(entitlementsOwned, installationsFound);

  const result: CompliancePositionDetails = {
    productId,
    product,
    entitlementsOwned,
    installationsFound,
    compliancePosition,
    overUnderCount,
    compliancePercentage,
    lastReconciledAt: latestResult?.lastReconciledAt ?? null,
    entitlementDetails: entitlementSummary,
    installationDetails: installationSummary,
  };

  // Cache the result
  await cache.set(cacheKey, result, cache.DEFAULT_TTL.SHORT);

  return result;
}

/**
 * Get compliance positions for multiple products
 */
export async function getCompliancePositions(
  productIds?: UUID[]
): Promise<CompliancePositionDetails[]> {
  logger.info('Getting compliance positions', { productCount: productIds?.length ?? 'all' });

  let products: SoftwareProduct[];

  if (productIds && productIds.length > 0) {
    // Get specific products
    const productPromises = productIds.map((id) => repository.getProductById(id));
    const productResults = await Promise.all(productPromises);
    products = productResults.filter((p): p is SoftwareProduct => p !== null);
  } else {
    // Get all active products
    products = await repository.getActiveProducts();
  }

  // Get compliance position for each product
  const positionPromises = products.map((p) => getCompliancePosition(p.productId));
  return Promise.all(positionPromises);
}

/**
 * Get products with compliance issues
 */
export async function getComplianceIssues(): Promise<CompliancePositionDetails[]> {
  logger.info('Getting products with compliance issues');

  const underLicensedResults = await repository.getProductsWithComplianceIssues();
  const productIds = underLicensedResults.map((r) => r.softwareProductId);

  if (productIds.length === 0) {
    return [];
  }

  return getCompliancePositions(productIds);
}

/**
 * Get products needing reconciliation
 */
export async function getProductsNeedingReconciliation(
  staleDays = 7
): Promise<SoftwareProduct[]> {
  logger.info('Getting products needing reconciliation', { staleDays });
  return repository.getProductsNeedingReconciliation(staleDays);
}

// Re-export types
export type {
  Entitlement,
  EntitlementSummary,
  InstallationSummary,
  ReconciliationResult,
  SoftwareInstallation,
  SoftwareProduct,
} from './reconciliation-repository';
