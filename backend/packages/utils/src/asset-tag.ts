/**
 * Asset tag generation utilities
 *
 * Generates unique asset tags following the pattern: AMS-{TYPE}-{TIMESTAMP}-{RANDOM}
 * Example: AMS-HW-20240115-A1B2C3
 */

import { v4 as uuidv4 } from 'uuid';

import type { AssetType } from '@ams/types';

/**
 * Asset type prefixes for tag generation
 */
const ASSET_TYPE_PREFIXES: Record<AssetType, string> = {
  HARDWARE: 'HW',
  SOFTWARE: 'SW',
  ENTERPRISE: 'EN',
};

/**
 * Generate a unique asset tag
 *
 * @param assetType - The type of asset
 * @returns A unique asset tag string
 */
export function generateAssetTag(assetType: AssetType): string {
  const prefix = ASSET_TYPE_PREFIXES[assetType];
  const timestamp = formatDateForTag(new Date());
  const randomPart = generateRandomSuffix();

  return `AMS-${prefix}-${timestamp}-${randomPart}`;
}

/**
 * Format date for asset tag (YYYYMMDD)
 */
function formatDateForTag(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}${month}${day}`;
}

/**
 * Generate a random alphanumeric suffix (6 characters)
 */
function generateRandomSuffix(): string {
  const uuid = uuidv4().replace(/-/g, '');
  return uuid.substring(0, 6).toUpperCase();
}

/**
 * Validate asset tag format
 *
 * @param tag - The asset tag to validate
 * @returns True if the tag matches the expected format
 */
export function isValidAssetTag(tag: string): boolean {
  const pattern = /^AMS-(HW|SW|EN)-\d{8}-[A-Z0-9]{6}$/;
  return pattern.test(tag);
}

/**
 * Parse asset tag to extract components
 *
 * @param tag - The asset tag to parse
 * @returns Parsed components or null if invalid
 */
export function parseAssetTag(tag: string): {
  prefix: string;
  assetType: AssetType;
  date: string;
  suffix: string;
} | null {
  if (!isValidAssetTag(tag)) {
    return null;
  }

  const parts = tag.split('-');
  const typePrefix = parts[1];

  let assetType: AssetType;
  switch (typePrefix) {
    case 'HW':
      assetType = 'HARDWARE';
      break;
    case 'SW':
      assetType = 'SOFTWARE';
      break;
    case 'EN':
      assetType = 'ENTERPRISE';
      break;
    default:
      return null;
  }

  return {
    prefix: parts[0] ?? '',
    assetType,
    date: parts[2] ?? '',
    suffix: parts[3] ?? '',
  };
}

/**
 * Generate a barcode-compatible identifier from asset tag
 *
 * @param tag - The asset tag
 * @returns A barcode-compatible string (Code 128 compatible)
 */
export function generateBarcodeId(tag: string): string {
  // Remove dashes for barcode compatibility
  return tag.replace(/-/g, '');
}

/**
 * Convert barcode ID back to asset tag format
 *
 * @param barcodeId - The barcode identifier
 * @returns The formatted asset tag or null if invalid
 */
export function barcodeIdToAssetTag(barcodeId: string): string | null {
  // Expected format: AMS{TYPE}{DATE}{SUFFIX} = 3 + 2 + 8 + 6 = 19 characters
  if (barcodeId.length !== 19) {
    return null;
  }

  const prefix = barcodeId.substring(0, 3);
  const type = barcodeId.substring(3, 5);
  const date = barcodeId.substring(5, 13);
  const suffix = barcodeId.substring(13, 19);

  const tag = `${prefix}-${type}-${date}-${suffix}`;

  return isValidAssetTag(tag) ? tag : null;
}
