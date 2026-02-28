/**
 * Utility Functions for Seed Data Generation
 */

/**
 * Generate asset tag in format AMS-{TYPE}-{DATE}-{RANDOM}
 * Matches the asset tag format defined in product.md
 */
export function generateAssetTag(assetType: 'HARDWARE' | 'SOFTWARE' | 'ENTERPRISE'): string {
  const typePrefix = assetType === 'HARDWARE' ? 'HW' : assetType === 'SOFTWARE' ? 'SW' : 'EA';
  const date = new Date().toISOString().slice(0, 10).replace(/-/g, '');
  const random = Math.random().toString(36).substring(2, 8).toUpperCase();
  return `AMS-${typePrefix}-${date}-${random}`;
}

/**
 * Generate a unique serial number
 */
export function generateSerialNumber(prefix: string, index: number): string {
  return `${prefix}${Date.now().toString(36).toUpperCase()}${index.toString().padStart(4, '0')}`;
}

/**
 * Generate a Cognito sub from email (for seed data only)
 */
export function generateCognitoSub(email: string): string {
  return `cognito-${email.replace('@', '-').replace('.', '-')}`;
}
