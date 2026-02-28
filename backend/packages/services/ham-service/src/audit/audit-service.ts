/**
 * Audit Service - Business logic layer for mobile audit operations
 *
 * Implements:
 * - Barcode and QR code scanning for asset verification (Requirement 3.4)
 * - Discrepancy calculation between expected and scanned assets (Requirement 3.5)
 */

import type { PaginatedResult, PaginationParams, UUID } from '@ams/types';
import * as cache from '@ams/cache';
import { publishEvent } from '@ams/events';
import { createLogger } from '@ams/utils';

import type {
  AssetCondition,
  AuditRecord,
  AuditScan,
  CreateAuditScanRequest,
  DiscrepancySummary,
  DiscrepancyType,
  ExpectedInventoryItem,
} from './audit-repository';
import * as repository from './audit-repository';

const logger = createLogger({ service: 'audit-service' });

/**
 * Barcode format types
 */
export type BarcodeFormat = 'CODE128' | 'CODE39' | 'QR_CODE' | 'DATA_MATRIX' | 'EAN13' | 'UPC_A' | 'UNKNOWN';

/**
 * Barcode validation result
 */
export interface BarcodeValidationResult {
  readonly isValid: boolean;
  readonly format: BarcodeFormat;
  readonly normalizedValue: string;
  readonly errors: readonly string[];
}

/**
 * QR code validation result
 */
export interface QRCodeValidationResult {
  readonly isValid: boolean;
  readonly format: 'QR_CODE';
  readonly normalizedValue: string;
  readonly parsedData: Record<string, string> | null;
  readonly errors: readonly string[];
}

/**
 * Audit scan result
 */
export interface AuditScanResult {
  readonly scan: AuditScan;
  readonly asset: {
    readonly assetId: UUID;
    readonly assetTag: string;
    readonly serialNumber: string | null;
  } | null;
  readonly discrepancy: {
    readonly type: DiscrepancyType;
    readonly description: string;
  } | null;
  readonly auditUpdated: AuditRecord;
}

/**
 * Discrepancy calculation result
 */
export interface DiscrepancyCalculationResult {
  readonly auditId: UUID;
  readonly stockroomId: UUID;
  readonly summary: {
    readonly itemsExpected: number;
    readonly itemsScanned: number;
    readonly itemsMatched: number;
    readonly itemsMissing: number;
    readonly itemsExtra: number;
    readonly itemsDamaged: number;
    readonly totalDiscrepancies: number;
    readonly accuracyPercentage: number;
  };
  readonly discrepancies: PaginatedResult<DiscrepancySummary>;
}

/**
 * Barcode pattern definitions
 */
const BARCODE_PATTERNS: Record<BarcodeFormat, RegExp> = {
  CODE128: /^[\x00-\x7F]+$/,
  CODE39: /^[A-Z0-9\-. $/+%]+$/,
  QR_CODE: /^.+$/,
  DATA_MATRIX: /^.+$/,
  EAN13: /^\d{13}$/,
  UPC_A: /^\d{12}$/,
  UNKNOWN: /^.+$/,
};

/**
 * Asset tag pattern (e.g., AST-XXXXXX or similar)
 */
const ASSET_TAG_PATTERN = /^[A-Z]{2,4}-?\d{4,10}$/i;

/**
 * Serial number pattern (alphanumeric, 5-50 chars)
 */
const SERIAL_NUMBER_PATTERN = /^[A-Z0-9\-_]{5,50}$/i;

/**
 * Validate barcode format and content
 * Requirement 3.4: Support barcode scanning for asset verification
 */
export function validateBarcode(barcode: string): BarcodeValidationResult {
  const errors: string[] = [];

  if (!barcode || typeof barcode !== 'string') {
    return {
      isValid: false,
      format: 'UNKNOWN',
      normalizedValue: '',
      errors: ['Barcode value is required'],
    };
  }

  const trimmedBarcode = barcode.trim();

  if (trimmedBarcode.length === 0) {
    return {
      isValid: false,
      format: 'UNKNOWN',
      normalizedValue: '',
      errors: ['Barcode value cannot be empty'],
    };
  }

  if (trimmedBarcode.length > 255) {
    errors.push('Barcode value exceeds maximum length of 255 characters');
  }

  // Detect barcode format
  let format: BarcodeFormat = 'UNKNOWN';

  if (BARCODE_PATTERNS.EAN13.test(trimmedBarcode)) {
    format = 'EAN13';
  } else if (BARCODE_PATTERNS.UPC_A.test(trimmedBarcode)) {
    format = 'UPC_A';
  } else if (BARCODE_PATTERNS.CODE39.test(trimmedBarcode.toUpperCase())) {
    format = 'CODE39';
  } else if (BARCODE_PATTERNS.CODE128.test(trimmedBarcode)) {
    format = 'CODE128';
  }

  // Normalize the barcode value
  const normalizedValue = trimmedBarcode.toUpperCase().replace(/\s+/g, '');

  // Validate it looks like an asset tag or serial number
  const isAssetTag = ASSET_TAG_PATTERN.test(normalizedValue);
  const isSerialNumber = SERIAL_NUMBER_PATTERN.test(normalizedValue);

  if (!isAssetTag && !isSerialNumber && format === 'UNKNOWN') {
    errors.push('Barcode does not match expected asset tag or serial number format');
  }

  return {
    isValid: errors.length === 0,
    format,
    normalizedValue,
    errors,
  };
}

/**
 * Validate QR code format and content
 * Requirement 3.4: Support QR code scanning for asset verification
 */
export function validateQRCode(qrData: string): QRCodeValidationResult {
  const errors: string[] = [];

  if (!qrData || typeof qrData !== 'string') {
    return {
      isValid: false,
      format: 'QR_CODE',
      normalizedValue: '',
      parsedData: null,
      errors: ['QR code data is required'],
    };
  }

  const trimmedData = qrData.trim();

  if (trimmedData.length === 0) {
    return {
      isValid: false,
      format: 'QR_CODE',
      normalizedValue: '',
      parsedData: null,
      errors: ['QR code data cannot be empty'],
    };
  }

  if (trimmedData.length > 2048) {
    errors.push('QR code data exceeds maximum length of 2048 characters');
  }

  // Try to parse as JSON (structured QR code)
  let parsedData: Record<string, string> | null = null;
  let normalizedValue = trimmedData;

  try {
    const parsed = JSON.parse(trimmedData);
    if (typeof parsed === 'object' && parsed !== null) {
      parsedData = parsed as Record<string, string>;
      // Extract asset tag or serial number from parsed data
      normalizedValue = parsed.assetTag ?? parsed.serialNumber ?? parsed.id ?? trimmedData;
    }
  } catch {
    // Not JSON, treat as plain text
    // Try to parse as key=value pairs (e.g., "assetTag=AST-001;serial=ABC123")
    if (trimmedData.includes('=')) {
      parsedData = {};
      const pairs = trimmedData.split(/[;&]/);
      for (const pair of pairs) {
        const [key, value] = pair.split('=');
        if (key && value) {
          parsedData[key.trim()] = value.trim();
        }
      }
      normalizedValue = parsedData['assetTag'] ?? parsedData['serial'] ?? parsedData['id'] ?? trimmedData;
    }
  }

  // Normalize the value
  normalizedValue = normalizedValue.toUpperCase().replace(/\s+/g, '');

  // Validate the extracted value
  const isAssetTag = ASSET_TAG_PATTERN.test(normalizedValue);
  const isSerialNumber = SERIAL_NUMBER_PATTERN.test(normalizedValue);

  if (!isAssetTag && !isSerialNumber && !parsedData) {
    errors.push('QR code does not contain valid asset identification data');
  }

  return {
    isValid: errors.length === 0,
    format: 'QR_CODE',
    normalizedValue,
    parsedData,
    errors,
  };
}

/**
 * Record an audit scan
 * Requirement 3.4: Support barcode and QR code scanning for asset verification
 */
export async function recordAuditScan(
  auditId: UUID,
  barcodeScanned: string,
  scannedBy: UUID,
  options: {
    foundLocation?: string;
    foundCondition?: AssetCondition;
    notes?: string;
  } = {}
): Promise<AuditScanResult> {
  logger.info('Recording audit scan', { auditId, barcodeScanned, scannedBy });

  // Validate the barcode
  const barcodeValidation = validateBarcode(barcodeScanned);
  if (!barcodeValidation.isValid) {
    // Try QR code validation
    const qrValidation = validateQRCode(barcodeScanned);
    if (!qrValidation.isValid) {
      throw new Error(`Invalid scan data: ${[...barcodeValidation.errors, ...qrValidation.errors].join(', ')}`);
    }
  }

  // Get the audit record
  const audit = await repository.getAuditById(auditId);
  if (!audit) {
    throw new Error(`Audit not found: ${auditId}`);
  }

  if (audit.status !== 'IN_PROGRESS') {
    throw new Error(`Audit is not in progress. Current status: ${audit.status}`);
  }

  // Normalize the barcode value
  const normalizedBarcode = barcodeScanned.trim().toUpperCase();

  // Check if already scanned
  const alreadyScanned = await repository.isAssetAlreadyScanned(auditId, normalizedBarcode);
  if (alreadyScanned) {
    throw new Error(`Asset already scanned in this audit: ${normalizedBarcode}`);
  }

  // Look up the asset
  const assetInfo = await repository.findAssetByBarcode(normalizedBarcode);

  // Determine if this is a discrepancy
  let isDiscrepancy = false;
  let discrepancyType: DiscrepancyType | undefined;
  let discrepancyDescription: string | undefined;
  let expected = false;

  if (assetInfo) {
    // Asset found in system
    expected = assetInfo.stockroomId === audit.stockroomId;

    if (!expected) {
      // Asset found but not expected in this stockroom
      isDiscrepancy = true;
      discrepancyType = 'WRONG_LOCATION';
      discrepancyDescription = `Asset ${normalizedBarcode} found but not expected in this stockroom`;
    } else if (options.foundCondition === 'DAMAGED') {
      isDiscrepancy = true;
      discrepancyType = 'DAMAGED';
      discrepancyDescription = `Asset ${normalizedBarcode} found damaged`;
    }
  } else {
    // Asset not found in system - unexpected item
    isDiscrepancy = true;
    discrepancyType = 'EXTRA';
    discrepancyDescription = `Unknown asset scanned: ${normalizedBarcode}`;
  }

  // Create the scan record
  const scanRequest: CreateAuditScanRequest = {
    auditId,
    assetId: assetInfo?.assetId,
    assetTag: assetInfo?.assetTag ?? normalizedBarcode,
    serialNumber: assetInfo?.serialNumber ?? undefined,
    barcodeScanned: normalizedBarcode,
    scannedBy,
    expected,
    found: true,
    foundLocation: options.foundLocation,
    foundCondition: options.foundCondition,
    isDiscrepancy,
    discrepancyType,
    discrepancyNotes: discrepancyDescription,
    notes: options.notes,
  };

  const scan = await repository.createAuditScan(scanRequest);

  // Update audit counts
  const updatedAudit = await repository.updateAuditCounts(auditId);
  if (!updatedAudit) {
    throw new Error('Failed to update audit counts');
  }

  // Invalidate cache
  await cache.del(`audit:${auditId}:discrepancies`);

  // Publish scan event
  await publishEvent('AUDIT_SCAN_RECORDED', {
    scanId: scan.scanId,
    auditId,
    assetTag: scan.assetTag,
    isDiscrepancy,
    discrepancyType,
    scannedBy,
  });

  logger.info('Audit scan recorded', {
    scanId: scan.scanId,
    auditId,
    assetTag: scan.assetTag,
    isDiscrepancy,
  });

  return {
    scan,
    asset: assetInfo ? {
      assetId: assetInfo.assetId,
      assetTag: assetInfo.assetTag,
      serialNumber: assetInfo.serialNumber,
    } : null,
    discrepancy: isDiscrepancy && discrepancyType ? {
      type: discrepancyType,
      description: discrepancyDescription ?? 'Unknown discrepancy',
    } : null,
    auditUpdated: updatedAudit,
  };
}

/**
 * Get audit discrepancies
 * Requirement 3.5: Compare scanned assets against expected inventory and report discrepancies
 */
export async function getAuditDiscrepancies(
  auditId: UUID,
  pagination: PaginationParams = {}
): Promise<DiscrepancyCalculationResult> {
  logger.info('Getting audit discrepancies', { auditId, pagination });

  // Get the audit record
  const audit = await repository.getAuditById(auditId);
  if (!audit) {
    throw new Error(`Audit not found: ${auditId}`);
  }

  // Get expected inventory for the stockroom
  const expectedInventory = await repository.getExpectedInventory(audit.stockroomId);

  // Get all scans for this audit
  const allScans = await repository.getAuditScans(auditId, { page: 1, limit: 10000 });
  const scannedAssetTags = new Set(allScans.items.map(s => s.assetTag).filter(Boolean));

  // Find missing items (expected but not scanned)
  const missingItems: ExpectedInventoryItem[] = expectedInventory.filter(
    item => !scannedAssetTags.has(item.assetTag)
  );

  // Get discrepancies from scans
  const discrepancies = await repository.getAuditDiscrepancies(auditId, pagination);

  // Calculate summary
  const itemsExpected = expectedInventory.length;
  const itemsScanned = allScans.items.filter(s => s.found).length;
  const itemsMatched = allScans.items.filter(s => s.expected && s.found && !s.isDiscrepancy).length;
  const itemsMissing = missingItems.length + allScans.items.filter(s => s.discrepancyType === 'MISSING').length;
  const itemsExtra = allScans.items.filter(s => s.discrepancyType === 'EXTRA').length;
  const itemsDamaged = allScans.items.filter(s => s.discrepancyType === 'DAMAGED').length;
  const totalDiscrepancies = discrepancies.total + missingItems.length;

  // Calculate accuracy percentage
  let accuracyPercentage = 100;
  if (itemsExpected > 0) {
    accuracyPercentage = Math.round((itemsMatched / itemsExpected) * 10000) / 100;
  }

  logger.info('Audit discrepancies calculated', {
    auditId,
    itemsExpected,
    itemsScanned,
    itemsMatched,
    totalDiscrepancies,
    accuracyPercentage,
  });

  return {
    auditId,
    stockroomId: audit.stockroomId,
    summary: {
      itemsExpected,
      itemsScanned,
      itemsMatched,
      itemsMissing,
      itemsExtra,
      itemsDamaged,
      totalDiscrepancies,
      accuracyPercentage,
    },
    discrepancies,
  };
}

/**
 * Calculate discrepancies between expected and scanned inventory
 * Requirement 3.5: Calculate discrepancies (expected vs scanned)
 */
export function calculateDiscrepancies(
  expected: readonly ExpectedInventoryItem[],
  scanned: readonly AuditScan[]
): {
  missing: readonly ExpectedInventoryItem[];
  extra: readonly AuditScan[];
  matched: readonly { expected: ExpectedInventoryItem; scanned: AuditScan }[];
  damaged: readonly AuditScan[];
} {
  const scannedByTag = new Map<string, AuditScan>();
  for (const scan of scanned) {
    if (scan.assetTag) {
      scannedByTag.set(scan.assetTag, scan);
    }
  }

  const expectedByTag = new Map<string, ExpectedInventoryItem>();
  for (const item of expected) {
    expectedByTag.set(item.assetTag, item);
  }

  const missing: ExpectedInventoryItem[] = [];
  const matched: { expected: ExpectedInventoryItem; scanned: AuditScan }[] = [];

  // Find missing and matched items
  for (const item of expected) {
    const scan = scannedByTag.get(item.assetTag);
    if (scan) {
      matched.push({ expected: item, scanned: scan });
    } else {
      missing.push(item);
    }
  }

  // Find extra items (scanned but not expected)
  const extra: AuditScan[] = [];
  for (const scan of scanned) {
    if (scan.assetTag && !expectedByTag.has(scan.assetTag)) {
      extra.push(scan);
    }
  }

  // Find damaged items
  const damaged = scanned.filter(s => s.foundCondition === 'DAMAGED');

  return { missing, extra, matched, damaged };
}

/**
 * Get audit by ID
 */
export async function getAudit(auditId: UUID): Promise<AuditRecord | null> {
  return repository.getAuditById(auditId);
}

/**
 * Get audit scans
 */
export async function getAuditScans(
  auditId: UUID,
  pagination: PaginationParams = {}
): Promise<PaginatedResult<AuditScan>> {
  return repository.getAuditScans(auditId, pagination);
}

// Re-export types
export type {
  AssetCondition,
  AuditRecord,
  AuditScan,
  AuditStatus,
  AuditType,
  CreateAuditScanRequest,
  DiscrepancySummary,
  DiscrepancyType,
  ExpectedInventoryItem,
} from './audit-repository';
