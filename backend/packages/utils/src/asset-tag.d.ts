/**
 * Asset tag generation utilities
 *
 * Generates unique asset tags following the pattern: AMS-{TYPE}-{TIMESTAMP}-{RANDOM}
 * Example: AMS-HW-20240115-A1B2C3
 */
import type { AssetType } from '@ams/types';
/**
 * Generate a unique asset tag
 *
 * @param assetType - The type of asset
 * @returns A unique asset tag string
 */
export declare function generateAssetTag(assetType: AssetType): string;
/**
 * Validate asset tag format
 *
 * @param tag - The asset tag to validate
 * @returns True if the tag matches the expected format
 */
export declare function isValidAssetTag(tag: string): boolean;
/**
 * Parse asset tag to extract components
 *
 * @param tag - The asset tag to parse
 * @returns Parsed components or null if invalid
 */
export declare function parseAssetTag(tag: string): {
    prefix: string;
    assetType: AssetType;
    date: string;
    suffix: string;
} | null;
/**
 * Generate a barcode-compatible identifier from asset tag
 *
 * @param tag - The asset tag
 * @returns A barcode-compatible string (Code 128 compatible)
 */
export declare function generateBarcodeId(tag: string): string;
/**
 * Convert barcode ID back to asset tag format
 *
 * @param barcodeId - The barcode identifier
 * @returns The formatted asset tag or null if invalid
 */
export declare function barcodeIdToAssetTag(barcodeId: string): string | null;
