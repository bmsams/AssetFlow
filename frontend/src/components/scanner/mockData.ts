/**
 * Mock data for barcode scanner components
 * Used for development and testing
 */

import type { ScannedAsset, ScanHistoryEntry, OfflineScan, BarcodeFormat } from '../../types/scanner';

/**
 * Mock scanned assets for testing
 */
export const mockScannedAssets: Record<string, ScannedAsset> = {
  'AMS-HW-20250101-ABC123': {
    assetId: 'asset-001',
    assetTag: 'AMS-HW-20250101-ABC123',
    displayName: 'Dell Latitude 5540 Laptop',
    assetType: 'HARDWARE',
    status: 'DEPLOYED',
    serialNumber: 'DL5540-SN-12345',
    manufacturer: 'Dell',
    model: 'Latitude 5540',
    assignedTo: 'John Smith',
    location: 'Building A, Floor 2, Room 201',
    lastUpdated: '2025-01-15T10:30:00Z',
  },
  'AMS-HW-20250102-DEF456': {
    assetId: 'asset-002',
    assetTag: 'AMS-HW-20250102-DEF456',
    displayName: 'HP EliteBook 840 G9',
    assetType: 'HARDWARE',
    status: 'IN_STOCK',
    serialNumber: 'HP840G9-SN-67890',
    manufacturer: 'HP',
    model: 'EliteBook 840 G9',
    location: 'Stockroom A',
    lastUpdated: '2025-01-10T14:20:00Z',
  },
  'AMS-HW-20250103-GHI789': {
    assetId: 'asset-003',
    assetTag: 'AMS-HW-20250103-GHI789',
    displayName: 'Cisco Catalyst 9200 Switch',
    assetType: 'HARDWARE',
    status: 'DEPLOYED',
    serialNumber: 'CISCO-9200-SN-11111',
    manufacturer: 'Cisco',
    model: 'Catalyst 9200',
    location: 'Data Center, Rack B-12',
    lastUpdated: '2025-01-08T09:15:00Z',
  },
  'AMS-SW-20250104-JKL012': {
    assetId: 'asset-004',
    assetTag: 'AMS-SW-20250104-JKL012',
    displayName: 'Microsoft Office 365 E3',
    assetType: 'SOFTWARE',
    status: 'DEPLOYED',
    lastUpdated: '2025-01-12T16:45:00Z',
  },
  'AMS-ENT-20250105-MNO345': {
    assetId: 'asset-005',
    assetTag: 'AMS-ENT-20250105-MNO345',
    displayName: 'HVAC Unit - Building A',
    assetType: 'ENTERPRISE',
    status: 'IN_MAINTENANCE',
    serialNumber: 'HVAC-UNIT-22334',
    manufacturer: 'Carrier',
    model: 'WeatherMaker 50XC',
    location: 'Building A, Roof',
    lastUpdated: '2025-01-14T11:00:00Z',
  },
};

/**
 * Mock scan history entries
 */
export const mockScanHistory: ScanHistoryEntry[] = [
  {
    id: 'scan-001',
    barcodeValue: 'AMS-HW-20250101-ABC123',
    barcodeFormat: 'QR_CODE',
    scannedAt: '2025-01-15T10:30:00Z',
    asset: mockScannedAssets['AMS-HW-20250101-ABC123']!,
    success: true,
  },
  {
    id: 'scan-002',
    barcodeValue: 'AMS-HW-20250102-DEF456',
    barcodeFormat: 'CODE_128',
    scannedAt: '2025-01-15T09:45:00Z',
    asset: mockScannedAssets['AMS-HW-20250102-DEF456']!,
    success: true,
  },
  {
    id: 'scan-003',
    barcodeValue: 'UNKNOWN-BARCODE-123',
    barcodeFormat: 'CODE_39',
    scannedAt: '2025-01-15T09:30:00Z',
    success: false,
    error: 'Asset not found',
  },
  {
    id: 'scan-004',
    barcodeValue: 'AMS-HW-20250103-GHI789',
    barcodeFormat: 'QR_CODE',
    scannedAt: '2025-01-14T16:20:00Z',
    asset: mockScannedAssets['AMS-HW-20250103-GHI789']!,
    success: true,
  },
  {
    id: 'scan-005',
    barcodeValue: 'AMS-ENT-20250105-MNO345',
    barcodeFormat: 'QR_CODE',
    scannedAt: '2025-01-14T14:10:00Z',
    asset: mockScannedAssets['AMS-ENT-20250105-MNO345']!,
    success: true,
  },
];

/**
 * Mock offline scan queue
 */
export const mockOfflineScans: OfflineScan[] = [
  {
    id: 'offline-001',
    barcodeValue: 'AMS-HW-20250106-PQR678',
    barcodeFormat: 'QR_CODE',
    scannedAt: '2025-01-15T08:00:00Z',
    syncStatus: 'pending',
    syncAttempts: 0,
  },
  {
    id: 'offline-002',
    barcodeValue: 'AMS-HW-20250107-STU901',
    barcodeFormat: 'CODE_128',
    scannedAt: '2025-01-15T07:45:00Z',
    syncStatus: 'failed',
    syncError: 'Network timeout',
    syncAttempts: 3,
    lastSyncAttempt: '2025-01-15T09:00:00Z',
  },
];

/**
 * Simulate API delay for testing
 */
export function simulateApiDelay(ms: number = 500): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Mock function to look up asset by barcode
 * Simulates API call with delay
 */
export async function mockLookupAsset(barcodeValue: string): Promise<ScannedAsset | null> {
  await simulateApiDelay(300);
  return mockScannedAssets[barcodeValue] || null;
}

/**
 * Generate a unique scan ID
 */
export function generateScanId(): string {
  return `scan-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`;
}

/**
 * Generate a unique offline scan ID
 */
export function generateOfflineScanId(): string {
  return `offline-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`;
}

/**
 * Mock barcode detection result for testing
 * Since camera won't work in tests, this simulates detection
 */
export interface MockDetectionResult {
  barcodeValue: string;
  barcodeFormat: BarcodeFormat;
}

/**
 * Predefined mock detection results for testing
 */
export const mockDetectionResults: MockDetectionResult[] = [
  { barcodeValue: 'AMS-HW-20250101-ABC123', barcodeFormat: 'QR_CODE' },
  { barcodeValue: 'AMS-HW-20250102-DEF456', barcodeFormat: 'CODE_128' },
  { barcodeValue: 'AMS-HW-20250103-GHI789', barcodeFormat: 'QR_CODE' },
];
