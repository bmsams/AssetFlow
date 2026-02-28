/**
 * Publisher Pack Service - Business logic for vendor-specific license calculations
 *
 * Implements:
 * - Microsoft license calculations (per-core, per-user, O365) (Requirement 4.3)
 * - Oracle license calculations (database options, management packs) (Requirement 4.4)
 * - Adobe and Salesforce license calculations (Requirement 4.5)
 *
 * Requirements: 4.3, 4.4, 4.5
 */

import type { CompliancePosition, LicenseCalculation, UUID } from '@ams/types';
import * as cache from '@ams/cache';
import { publishEvent } from '@ams/events';
import { createLogger, now } from '@ams/utils';

import type {
  EntitlementDetails,
  InstallationWithHardware,
} from './publisher-pack-repository';
import * as repository from './publisher-pack-repository';

const logger = createLogger({ service: 'publisher-pack-service' });

/**
 * Supported publishers with specialized license calculation logic
 */
export type SupportedPublisher = 'MICROSOFT' | 'ORACLE' | 'ADOBE' | 'SALESFORCE';

/**
 * Microsoft product categories for license calculation
 */
export type MicrosoftProductCategory = 
  | 'SQL_SERVER'
  | 'WINDOWS_SERVER'
  | 'OFFICE_365'
  | 'OFFICE_PERPETUAL'
  | 'VISUAL_STUDIO'
  | 'OTHER';

/**
 * Oracle product categories for license calculation
 */
export type OracleProductCategory =
  | 'DATABASE_ENTERPRISE'
  | 'DATABASE_STANDARD'
  | 'DATABASE_OPTIONS'
  | 'MANAGEMENT_PACKS'
  | 'MIDDLEWARE'
  | 'OTHER';

/**
 * License calculation details for Microsoft products
 */
export interface MicrosoftLicenseDetails {
  readonly productCategory: MicrosoftProductCategory;
  readonly totalCores: number;
  readonly totalProcessors: number;
  readonly totalUsers: number;
  readonly totalDevices: number;
  readonly coresPerLicense: number;
  readonly minimumCoresPerServer: number;
  readonly minimumCoresPerProcessor: number;
  readonly subscriptionCount: number;
}

/**
 * License calculation details for Oracle products
 */
export interface OracleLicenseDetails {
  readonly productCategory: OracleProductCategory;
  readonly totalProcessors: number;
  readonly totalCores: number;
  readonly namedUserCount: number;
  readonly processorCoreFactor: number;
  readonly minimumNamedUsers: number;
  readonly databaseOptions: readonly string[];
  readonly managementPacks: readonly string[];
}

/**
 * License calculation details for Adobe products
 */
export interface AdobeLicenseDetails {
  readonly licenseType: 'NAMED_USER' | 'DEVICE' | 'SHARED_DEVICE';
  readonly totalNamedUsers: number;
  readonly totalDevices: number;
  readonly subscriptionType: 'ANNUAL' | 'MONTHLY' | 'PERPETUAL';
}

/**
 * License calculation details for Salesforce products
 */
export interface SalesforceLicenseDetails {
  readonly licenseType: 'USER' | 'PLATFORM' | 'COMMUNITY';
  readonly totalUsers: number;
  readonly activeUsers: number;
  readonly loginCredits: number;
}

/**
 * Publisher-specific calculation result
 */
export interface PublisherCalculationResult {
  readonly productId: UUID;
  readonly publisher: SupportedPublisher;
  readonly productName: string;
  readonly calculationMethod: string;
  readonly licensesRequired: number;
  readonly licensesOwned: number;
  readonly compliancePosition: CompliancePosition;
  readonly overUnderCount: number;
  readonly details: MicrosoftLicenseDetails | OracleLicenseDetails | AdobeLicenseDetails | SalesforceLicenseDetails;
  readonly calculatedAt: string;
  readonly warnings: readonly string[];
}

/**
 * Cache key for publisher calculation results
 */
function publisherCalcCacheKey(productId: UUID): string {
  return `publisher-calc:${productId}:result`;
}

/**
 * Determine compliance position based on licenses required vs owned
 */
function determineCompliancePosition(
  licensesRequired: number,
  licensesOwned: number
): CompliancePosition {
  if (licensesOwned >= licensesRequired) {
    return licensesOwned > licensesRequired ? 'OVER_LICENSED' : 'COMPLIANT';
  }
  return 'UNDER_LICENSED';
}

/**
 * Normalize publisher name to supported publisher
 */
export function normalizePublisher(publisher: string): SupportedPublisher | null {
  const normalized = publisher.toUpperCase().trim();
  
  if (normalized.includes('MICROSOFT') || normalized === 'MS') {
    return 'MICROSOFT';
  }
  if (normalized.includes('ORACLE')) {
    return 'ORACLE';
  }
  if (normalized.includes('ADOBE')) {
    return 'ADOBE';
  }
  if (normalized.includes('SALESFORCE') || normalized === 'SFDC') {
    return 'SALESFORCE';
  }
  
  return null;
}

/**
 * Check if a publisher is supported
 */
export function isSupportedPublisher(publisher: string): boolean {
  return normalizePublisher(publisher) !== null;
}

/**
 * Categorize Microsoft product based on product name
 */
export function categorizeMicrosoftProduct(productName: string): MicrosoftProductCategory {
  const name = productName.toUpperCase();
  
  if (name.includes('SQL SERVER') || name.includes('SQLSERVER')) {
    return 'SQL_SERVER';
  }
  if (name.includes('WINDOWS SERVER')) {
    return 'WINDOWS_SERVER';
  }
  if (name.includes('OFFICE 365') || name.includes('O365') || name.includes('MICROSOFT 365') || name.includes('M365')) {
    return 'OFFICE_365';
  }
  if (name.includes('OFFICE') && !name.includes('365')) {
    return 'OFFICE_PERPETUAL';
  }
  if (name.includes('VISUAL STUDIO')) {
    return 'VISUAL_STUDIO';
  }
  
  return 'OTHER';
}

/**
 * Categorize Oracle product based on product name
 */
export function categorizeOracleProduct(productName: string): OracleProductCategory {
  const name = productName.toUpperCase();
  
  // Check Management Packs first (before DATABASE_OPTIONS since "Diagnostics Pack" could match)
  if (name.includes('MANAGEMENT PACK') || name.includes('ENTERPRISE MANAGER')) {
    return 'MANAGEMENT_PACKS';
  }
  // Check Middleware before database options
  if (name.includes('WEBLOGIC') || name.includes('FUSION MIDDLEWARE')) {
    return 'MIDDLEWARE';
  }
  // Database editions
  if (name.includes('DATABASE') && name.includes('ENTERPRISE')) {
    return 'DATABASE_ENTERPRISE';
  }
  if (name.includes('DATABASE') && name.includes('STANDARD')) {
    return 'DATABASE_STANDARD';
  }
  // Database options - specific option names (must be exact matches to avoid false positives)
  if (name.includes('PARTITIONING') || 
      name.includes(' RAC') || name.includes('RAC ') || name === 'RAC' ||
      name.includes('REAL APPLICATION CLUSTERS') ||
      (name.includes('ADVANCED') && name.includes('SECURITY') && name.includes('DATABASE')) ||
      name.includes('DIAGNOSTICS PACK') || 
      name.includes('TUNING PACK')) {
    return 'DATABASE_OPTIONS';
  }
  
  return 'OTHER';
}

/**
 * Get Oracle processor core factor based on processor type
 * Oracle uses different core factors for different processor architectures
 */
export function getOracleProcessorCoreFactor(cpu: string | null): number {
  if (!cpu) return 0.5; // Default factor
  
  const cpuUpper = cpu.toUpperCase();
  
  // Intel Xeon processors
  if (cpuUpper.includes('XEON')) {
    return 0.5;
  }
  // AMD EPYC processors
  if (cpuUpper.includes('EPYC') || cpuUpper.includes('AMD')) {
    return 0.5;
  }
  // IBM POWER processors
  if (cpuUpper.includes('POWER')) {
    return 1.0;
  }
  // Oracle SPARC processors
  if (cpuUpper.includes('SPARC')) {
    return 0.25;
  }
  
  return 0.5; // Default for unknown processors
}

/**
 * Calculate Microsoft licenses required
 * Requirement 4.3: Apply per-core, per-user, and subscription-based calculations
 *
 * Microsoft licensing rules:
 * - SQL Server: Per-core licensing with minimum 4 cores per processor
 * - Windows Server: Per-core with minimum 16 cores per server
 * - Office 365: Per-user subscription
 * - Office Perpetual: Per-device
 * - Visual Studio: Per-user
 */
export function calculateMicrosoftLicenses(
  productName: string,
  installations: readonly InstallationWithHardware[],
  entitlements: readonly EntitlementDetails[]
): PublisherCalculationResult {
  const category = categorizeMicrosoftProduct(productName);
  const warnings: string[] = [];
  
  let licensesRequired = 0;
  let calculationMethod = '';
  let totalCores = 0;
  let totalProcessors = 0;
  let totalUsers = 0;
  let totalDevices = installations.length;
  let coresPerLicense = 2;
  let minimumCoresPerServer = 16;
  let minimumCoresPerProcessor = 4;
  let subscriptionCount = 0;

  // Calculate based on product category
  switch (category) {
    case 'SQL_SERVER':
      // SQL Server per-core licensing
      // Minimum 4 cores per processor, sold in 2-core packs
      coresPerLicense = 2;
      minimumCoresPerProcessor = 4;
      
      for (const install of installations) {
        const cores = install.hardware.coreCount ?? 4;
        const processors = install.hardware.processorCount ?? 1;
        
        // Apply minimum cores per processor rule
        const effectiveCores = Math.max(cores, processors * minimumCoresPerProcessor);
        totalCores += effectiveCores;
        totalProcessors += processors;
      }
      
      // Round up to nearest 2-core pack
      licensesRequired = Math.ceil(totalCores / coresPerLicense);
      calculationMethod = 'PER_CORE_2PACK';
      break;

    case 'WINDOWS_SERVER':
      // Windows Server per-core licensing
      // Minimum 16 cores per server, minimum 8 cores per processor
      coresPerLicense = 2;
      minimumCoresPerServer = 16;
      minimumCoresPerProcessor = 8;
      
      for (const install of installations) {
        const cores = install.hardware.coreCount ?? 4;
        const processors = install.hardware.processorCount ?? 1;
        
        // Apply minimum cores rules
        const minByProcessor = processors * minimumCoresPerProcessor;
        const effectiveCores = Math.max(cores, minByProcessor, minimumCoresPerServer);
        totalCores += effectiveCores;
        totalProcessors += processors;
      }
      
      licensesRequired = Math.ceil(totalCores / coresPerLicense);
      calculationMethod = 'PER_CORE_2PACK';
      break;

    case 'OFFICE_365':
      // Office 365 per-user subscription
      const uniqueUsers = new Set<string>();
      for (const install of installations) {
        if (install.hardware.assignedToUserId) {
          uniqueUsers.add(install.hardware.assignedToUserId);
        }
      }
      totalUsers = uniqueUsers.size;
      subscriptionCount = totalUsers;
      licensesRequired = totalUsers;
      calculationMethod = 'PER_USER_SUBSCRIPTION';
      break;

    case 'OFFICE_PERPETUAL':
    case 'OTHER':
      // Per-device licensing
      licensesRequired = totalDevices;
      calculationMethod = 'PER_DEVICE';
      break;

    case 'VISUAL_STUDIO':
      // Visual Studio per-user
      const vsUsers = new Set<string>();
      for (const install of installations) {
        if (install.hardware.assignedToUserId) {
          vsUsers.add(install.hardware.assignedToUserId);
        }
      }
      totalUsers = vsUsers.size;
      licensesRequired = totalUsers;
      calculationMethod = 'PER_USER';
      break;
  }

  // Calculate licenses owned from entitlements
  const licensesOwned = entitlements.reduce((sum, e) => sum + e.quantityPurchased, 0);
  
  // Add warnings for potential issues
  if (licensesRequired > licensesOwned) {
    warnings.push(`Under-licensed by ${licensesRequired - licensesOwned} licenses`);
  }
  
  // Check for virtual machine considerations
  const virtualInstalls = installations.filter(i => i.hardware.isVirtual);
  if (virtualInstalls.length > 0) {
    warnings.push(`${virtualInstalls.length} virtual machine installations detected - verify VM licensing rights`);
  }

  const compliancePosition = determineCompliancePosition(licensesRequired, licensesOwned);

  return {
    productId: installations[0]?.softwareProductId ?? '',
    publisher: 'MICROSOFT',
    productName,
    calculationMethod,
    licensesRequired,
    licensesOwned,
    compliancePosition,
    overUnderCount: licensesOwned - licensesRequired,
    details: {
      productCategory: category,
      totalCores,
      totalProcessors,
      totalUsers,
      totalDevices,
      coresPerLicense,
      minimumCoresPerServer,
      minimumCoresPerProcessor,
      subscriptionCount,
    } as MicrosoftLicenseDetails,
    calculatedAt: now(),
    warnings,
  };
}

/**
 * Calculate Oracle licenses required
 * Requirement 4.4: Verify database options and management packs for audit compliance
 *
 * Oracle licensing rules:
 * - Processor-based: Cores × Core Factor (varies by processor type)
 * - Named User Plus: Minimum 25 named users per processor
 * - Database Options: Licensed separately, same metric as base database
 * - Management Packs: Licensed per target (managed database)
 */
export function calculateOracleLicenses(
  productName: string,
  installations: readonly InstallationWithHardware[],
  entitlements: readonly EntitlementDetails[]
): PublisherCalculationResult {
  const category = categorizeOracleProduct(productName);
  const warnings: string[] = [];
  
  let licensesRequired = 0;
  let calculationMethod = '';
  let totalProcessors = 0;
  let totalCores = 0;
  let namedUserCount = 0;
  let processorCoreFactor = 0.5;
  const minimumNamedUsers = 25;
  const databaseOptions: string[] = [];
  const managementPacks: string[] = [];

  // Determine license metric from entitlements
  const hasProcessorLicense = entitlements.some(e => 
    e.metricType === 'PER_PROCESSOR' || e.metricType === 'PER_CORE'
  );
  const hasNamedUserLicense = entitlements.some(e => e.metricType === 'PER_USER');

  // Calculate based on product category and license type
  switch (category) {
    case 'DATABASE_ENTERPRISE':
    case 'DATABASE_STANDARD':
      if (hasProcessorLicense || !hasNamedUserLicense) {
        // Processor-based licensing
        for (const install of installations) {
          const cores = install.hardware.coreCount ?? 4;
          const processors = install.hardware.processorCount ?? 1;
          const coreFactor = getOracleProcessorCoreFactor(install.hardware.cpu);
          
          totalCores += cores;
          totalProcessors += processors;
          processorCoreFactor = coreFactor;
          
          // Oracle processor licenses = cores × core factor
          licensesRequired += Math.ceil(cores * coreFactor);
        }
        calculationMethod = 'PROCESSOR_CORE_FACTOR';
      } else {
        // Named User Plus licensing
        const uniqueUsers = new Set<string>();
        for (const install of installations) {
          if (install.hardware.assignedToUserId) {
            uniqueUsers.add(install.hardware.assignedToUserId);
          }
          totalProcessors += install.hardware.processorCount ?? 1;
        }
        
        // Minimum 25 named users per processor
        const minByProcessors = totalProcessors * minimumNamedUsers;
        namedUserCount = Math.max(uniqueUsers.size, minByProcessors);
        licensesRequired = namedUserCount;
        calculationMethod = 'NAMED_USER_PLUS';
      }
      break;

    case 'DATABASE_OPTIONS':
      // Database options must be licensed at same level as base database
      for (const install of installations) {
        const cores = install.hardware.coreCount ?? 4;
        const coreFactor = getOracleProcessorCoreFactor(install.hardware.cpu);
        totalCores += cores;
        licensesRequired += Math.ceil(cores * coreFactor);
      }
      calculationMethod = 'PROCESSOR_CORE_FACTOR';
      warnings.push('Database options must match base database license metric');
      break;

    case 'MANAGEMENT_PACKS':
      // Management packs licensed per managed target
      licensesRequired = installations.length;
      calculationMethod = 'PER_TARGET';
      break;

    case 'MIDDLEWARE':
    case 'OTHER':
      // Default to processor-based
      for (const install of installations) {
        const cores = install.hardware.coreCount ?? 4;
        const coreFactor = getOracleProcessorCoreFactor(install.hardware.cpu);
        totalCores += cores;
        licensesRequired += Math.ceil(cores * coreFactor);
      }
      calculationMethod = 'PROCESSOR_CORE_FACTOR';
      break;
  }

  // Calculate licenses owned from entitlements
  const licensesOwned = entitlements.reduce((sum, e) => sum + e.quantityPurchased, 0);
  
  // Add Oracle-specific warnings
  if (licensesRequired > licensesOwned) {
    warnings.push(`Under-licensed by ${licensesRequired - licensesOwned} licenses - HIGH AUDIT RISK`);
  }
  
  // Check for virtualization
  const virtualInstalls = installations.filter(i => i.hardware.isVirtual);
  if (virtualInstalls.length > 0 && !hasNamedUserLicense) {
    warnings.push('Oracle soft partitioning rules may require licensing entire physical host');
  }

  const compliancePosition = determineCompliancePosition(licensesRequired, licensesOwned);

  return {
    productId: installations[0]?.softwareProductId ?? '',
    publisher: 'ORACLE',
    productName,
    calculationMethod,
    licensesRequired,
    licensesOwned,
    compliancePosition,
    overUnderCount: licensesOwned - licensesRequired,
    details: {
      productCategory: category,
      totalProcessors,
      totalCores,
      namedUserCount,
      processorCoreFactor,
      minimumNamedUsers,
      databaseOptions,
      managementPacks,
    } as OracleLicenseDetails,
    calculatedAt: now(),
    warnings,
  };
}

/**
 * Calculate Adobe licenses required
 * Requirement 4.5: Handle named user and device licensing
 *
 * Adobe licensing rules:
 * - Named User: One license per user, can install on multiple devices
 * - Device License: One license per device
 * - Shared Device: Pool of licenses for shared workstations
 */
export function calculateAdobeLicenses(
  productName: string,
  installations: readonly InstallationWithHardware[],
  entitlements: readonly EntitlementDetails[]
): PublisherCalculationResult {
  const warnings: string[] = [];
  
  // Determine license type from entitlements
  const hasNamedUserLicense = entitlements.some(e => e.metricType === 'PER_USER');
  const hasDeviceLicense = entitlements.some(e => e.metricType === 'PER_DEVICE');
  
  let licensesRequired = 0;
  let calculationMethod = '';
  let totalNamedUsers = 0;
  let totalDevices = installations.length;
  let licenseType: 'NAMED_USER' | 'DEVICE' | 'SHARED_DEVICE' = 'NAMED_USER';
  let subscriptionType: 'ANNUAL' | 'MONTHLY' | 'PERPETUAL' = 'ANNUAL';

  // Determine subscription type from entitlements
  const hasSubscription = entitlements.some(e => e.metricType === 'SUBSCRIPTION');
  subscriptionType = hasSubscription ? 'ANNUAL' : 'PERPETUAL';

  if (hasNamedUserLicense || (!hasDeviceLicense && !hasNamedUserLicense)) {
    // Named User licensing (default for Adobe Creative Cloud)
    const uniqueUsers = new Set<string>();
    for (const install of installations) {
      if (install.hardware.assignedToUserId) {
        uniqueUsers.add(install.hardware.assignedToUserId);
      }
    }
    totalNamedUsers = uniqueUsers.size;
    licensesRequired = totalNamedUsers;
    calculationMethod = 'NAMED_USER';
    licenseType = 'NAMED_USER';
    
    // Adobe allows installation on 2 devices per named user
    if (totalDevices > totalNamedUsers * 2) {
      warnings.push(`More than 2 devices per user detected - verify license compliance`);
    }
  } else if (hasDeviceLicense) {
    // Device licensing
    licensesRequired = totalDevices;
    calculationMethod = 'PER_DEVICE';
    licenseType = 'DEVICE';
  }

  // Calculate licenses owned from entitlements
  const licensesOwned = entitlements.reduce((sum, e) => sum + e.quantityPurchased, 0);
  
  // Add warnings
  if (licensesRequired > licensesOwned) {
    warnings.push(`Under-licensed by ${licensesRequired - licensesOwned} licenses`);
  }

  const compliancePosition = determineCompliancePosition(licensesRequired, licensesOwned);

  return {
    productId: installations[0]?.softwareProductId ?? '',
    publisher: 'ADOBE',
    productName,
    calculationMethod,
    licensesRequired,
    licensesOwned,
    compliancePosition,
    overUnderCount: licensesOwned - licensesRequired,
    details: {
      licenseType,
      totalNamedUsers,
      totalDevices,
      subscriptionType,
    } as AdobeLicenseDetails,
    calculatedAt: now(),
    warnings,
  };
}

/**
 * Calculate Salesforce licenses required
 * Requirement 4.5: Handle user-based licensing
 *
 * Salesforce licensing rules:
 * - User License: One license per user
 * - Platform License: Limited functionality, lower cost
 * - Community License: External users with login credits
 */
export function calculateSalesforceLicenses(
  productName: string,
  installations: readonly InstallationWithHardware[],
  entitlements: readonly EntitlementDetails[]
): PublisherCalculationResult {
  const warnings: string[] = [];
  
  // Salesforce is always user-based
  const uniqueUsers = new Set<string>();
  for (const install of installations) {
    if (install.hardware.assignedToUserId) {
      uniqueUsers.add(install.hardware.assignedToUserId);
    }
  }
  
  const totalUsers = uniqueUsers.size;
  const activeUsers = totalUsers; // All discovered users are considered active
  
  // Determine license type from product name
  let licenseType: 'USER' | 'PLATFORM' | 'COMMUNITY' = 'USER';
  const nameUpper = productName.toUpperCase();
  
  if (nameUpper.includes('PLATFORM')) {
    licenseType = 'PLATFORM';
  } else if (nameUpper.includes('COMMUNITY') || nameUpper.includes('PARTNER')) {
    licenseType = 'COMMUNITY';
  }

  const licensesRequired = totalUsers;
  const calculationMethod = 'PER_USER';
  
  // Calculate licenses owned from entitlements
  const licensesOwned = entitlements.reduce((sum, e) => sum + e.quantityPurchased, 0);
  
  // Add warnings
  if (licensesRequired > licensesOwned) {
    warnings.push(`Under-licensed by ${licensesRequired - licensesOwned} user licenses`);
  }
  
  // Check for inactive users that could be reclaimed
  const inactiveThreshold = 30; // days
  const potentiallyInactive = installations.filter(i => {
    if (!i.lastUsedDate) return true;
    const lastUsed = new Date(i.lastUsedDate);
    const daysSinceUse = Math.floor((Date.now() - lastUsed.getTime()) / (1000 * 60 * 60 * 24));
    return daysSinceUse > inactiveThreshold;
  });
  
  if (potentiallyInactive.length > 0) {
    warnings.push(`${potentiallyInactive.length} users may be inactive - consider license reclamation`);
  }

  const compliancePosition = determineCompliancePosition(licensesRequired, licensesOwned);

  return {
    productId: installations[0]?.softwareProductId ?? '',
    publisher: 'SALESFORCE',
    productName,
    calculationMethod,
    licensesRequired,
    licensesOwned,
    compliancePosition,
    overUnderCount: licensesOwned - licensesRequired,
    details: {
      licenseType,
      totalUsers,
      activeUsers,
      loginCredits: 0, // Would be populated from Salesforce API
    } as SalesforceLicenseDetails,
    calculatedAt: now(),
    warnings,
  };
}

/**
 * Apply publisher-specific license calculation rules
 * Requirement 4.3, 4.4, 4.5: Apply vendor-specific license calculation rules
 *
 * @param productId - Software product ID to calculate licenses for
 * @returns Publisher-specific calculation result
 */
export async function applyPublisherRules(productId: UUID): Promise<PublisherCalculationResult> {
  logger.info('Applying publisher rules for product', { productId });

  // Get product details
  const product = await repository.getProductById(productId);
  if (!product) {
    throw new Error(`Software product not found: ${productId}`);
  }

  // Check if publisher is supported
  const normalizedPublisher = normalizePublisher(product.publisher);
  if (!normalizedPublisher) {
    throw new Error(`Unsupported publisher: ${product.publisher}. Supported publishers: Microsoft, Oracle, Adobe, Salesforce`);
  }

  // Try cache first
  const cacheKey = publisherCalcCacheKey(productId);
  const cached = await cache.get<PublisherCalculationResult>(cacheKey);
  if (cached) {
    logger.debug('Returning cached publisher calculation', { productId });
    return cached;
  }

  // Get installations with hardware details
  const installations = await repository.getInstallationsWithHardware(productId);
  if (installations.length === 0) {
    logger.info('No active installations found for product', { productId });
    // Return empty result
    return createEmptyResult(productId, normalizedPublisher, product.productName);
  }

  // Get entitlements
  const entitlements = await repository.getEntitlementDetails(productId);

  // Apply publisher-specific calculation
  let result: PublisherCalculationResult;

  switch (normalizedPublisher) {
    case 'MICROSOFT':
      result = calculateMicrosoftLicenses(product.productName, installations, entitlements);
      break;
    case 'ORACLE':
      result = calculateOracleLicenses(product.productName, installations, entitlements);
      break;
    case 'ADOBE':
      result = calculateAdobeLicenses(product.productName, installations, entitlements);
      break;
    case 'SALESFORCE':
      result = calculateSalesforceLicenses(product.productName, installations, entitlements);
      break;
  }

  // Update productId in result (may be empty string from calculation functions)
  result = { ...result, productId };

  // Cache the result
  await cache.set(cacheKey, result, cache.DEFAULT_TTL.MEDIUM);

  // Publish event
  await publishEvent('PUBLISHER_CALCULATION_COMPLETED', {
    productId,
    publisher: normalizedPublisher,
    productName: product.productName,
    licensesRequired: result.licensesRequired,
    licensesOwned: result.licensesOwned,
    compliancePosition: result.compliancePosition,
    calculationMethod: result.calculationMethod,
    warningCount: result.warnings.length,
  });

  logger.info('Publisher rules applied', {
    productId,
    publisher: normalizedPublisher,
    licensesRequired: result.licensesRequired,
    licensesOwned: result.licensesOwned,
    compliancePosition: result.compliancePosition,
  });

  return result;
}

/**
 * Create empty result for products with no installations
 */
function createEmptyResult(
  productId: UUID,
  publisher: SupportedPublisher,
  productName: string
): PublisherCalculationResult {
  const emptyDetails = {
    productCategory: 'OTHER' as const,
    totalCores: 0,
    totalProcessors: 0,
    totalUsers: 0,
    totalDevices: 0,
    coresPerLicense: 0,
    minimumCoresPerServer: 0,
    minimumCoresPerProcessor: 0,
    subscriptionCount: 0,
  };

  return {
    productId,
    publisher,
    productName,
    calculationMethod: 'NONE',
    licensesRequired: 0,
    licensesOwned: 0,
    compliancePosition: 'COMPLIANT',
    overUnderCount: 0,
    details: emptyDetails,
    calculatedAt: now(),
    warnings: ['No active installations found'],
  };
}

/**
 * Apply publisher rules for all products from a specific publisher
 */
export async function applyPublisherRulesForPublisher(
  publisher: string
): Promise<PublisherCalculationResult[]> {
  logger.info('Applying publisher rules for all products', { publisher });

  const normalizedPublisher = normalizePublisher(publisher);
  if (!normalizedPublisher) {
    throw new Error(`Unsupported publisher: ${publisher}`);
  }

  const products = await repository.getProductsByPublisher(publisher);
  const results: PublisherCalculationResult[] = [];

  for (const product of products) {
    try {
      const result = await applyPublisherRules(product.productId);
      results.push(result);
    } catch (error) {
      logger.error('Failed to apply publisher rules for product', error as Error, {
        productId: product.productId,
        publisher,
      });
    }
  }

  logger.info('Publisher rules applied for all products', {
    publisher,
    productsProcessed: results.length,
    totalProducts: products.length,
  });

  return results;
}

/**
 * Get supported publishers list
 */
export function getSupportedPublishers(): readonly SupportedPublisher[] {
  return ['MICROSOFT', 'ORACLE', 'ADOBE', 'SALESFORCE'] as const;
}

/**
 * Convert PublisherCalculationResult to LicenseCalculation type
 */
export function toLicenseCalculation(result: PublisherCalculationResult): LicenseCalculation {
  return {
    productId: result.productId,
    publisher: result.publisher,
    calculationMethod: result.calculationMethod,
    licensesRequired: result.licensesRequired,
    licensesOwned: result.licensesOwned,
    compliancePosition: result.compliancePosition,
    details: result.details as unknown as Record<string, unknown>,
  };
}

// Re-export types
export type {
  EntitlementDetails,
  InstallationWithHardware,
  PublisherPack,
  PublisherLicenseRule,
} from './publisher-pack-repository';
