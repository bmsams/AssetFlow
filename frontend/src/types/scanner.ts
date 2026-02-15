/**
 * Scanner types for the Asset Management System
 * Implements Requirements 13.1, 13.2, 13.3: Mobile barcode/QR scanning
 */

/**
 * Supported barcode formats
 */
export type BarcodeFormat = 
  | 'QR_CODE'
  | 'CODE_128'
  | 'CODE_39'
  | 'EAN_13'
  | 'EAN_8'
  | 'UPC_A'
  | 'UPC_E'
  | 'DATA_MATRIX';

/**
 * Scanner status states
 */
export type ScannerStatus = 
  | 'idle'
  | 'initializing'
  | 'scanning'
  | 'processing'
  | 'error'
  | 'permission_denied';

/**
 * Scan result from barcode detection
 */
export interface ScanResult {
  /** Unique identifier for this scan */
  scanId: string;
  /** The decoded barcode value */
  barcodeValue: string;
  /** The format of the barcode */
  barcodeFormat: BarcodeFormat;
  /** Timestamp when the scan occurred */
  scannedAt: string;
  /** Whether the scan was performed offline */
  isOffline: boolean;
  /** Associated asset if found */
  asset?: ScannedAsset;
  /** Error message if asset lookup failed */
  error?: string;
}

/**
 * Asset information returned after scanning
 * Implements Requirement 13.2: Display asset details after scanning
 */
export interface ScannedAsset {
  assetId: string;
  assetTag: string;
  displayName: string;
  assetType: 'HARDWARE' | 'SOFTWARE' | 'ENTERPRISE';
  status: string;
  serialNumber?: string;
  manufacturer?: string;
  model?: string;
  assignedTo?: string;
  location?: string;
  lastUpdated: string;
}

/**
 * Offline scan entry for sync queue
 * Implements Requirement 13.3: Offline scanning with sync
 */
export interface OfflineScan {
  /** Unique identifier for this offline scan */
  id: string;
  /** The decoded barcode value */
  barcodeValue: string;
  /** The format of the barcode */
  barcodeFormat: BarcodeFormat;
  /** Timestamp when the scan occurred */
  scannedAt: string;
  /** Sync status */
  syncStatus: 'pending' | 'syncing' | 'synced' | 'failed';
  /** Error message if sync failed */
  syncError?: string;
  /** Number of sync attempts */
  syncAttempts: number;
  /** Timestamp of last sync attempt */
  lastSyncAttempt?: string;
  /** Resolved asset after sync */
  resolvedAsset?: ScannedAsset;
}

/**
 * Scan history entry
 */
export interface ScanHistoryEntry {
  /** Unique identifier */
  id: string;
  /** The decoded barcode value */
  barcodeValue: string;
  /** The format of the barcode */
  barcodeFormat: BarcodeFormat;
  /** Timestamp when the scan occurred */
  scannedAt: string;
  /** Associated asset if found */
  asset?: ScannedAsset;
  /** Whether scan was successful */
  success: boolean;
  /** Error message if failed */
  error?: string;
}

/**
 * Scanner configuration options
 */
export interface ScannerConfig {
  /** Supported barcode formats to detect */
  formats: BarcodeFormat[];
  /** Whether to enable continuous scanning */
  continuousScan: boolean;
  /** Delay between scans in continuous mode (ms) */
  scanDelay: number;
  /** Whether to play sound on successful scan */
  soundEnabled: boolean;
  /** Whether to vibrate on successful scan */
  vibrationEnabled: boolean;
  /** Camera facing mode */
  facingMode: 'environment' | 'user';
}

/**
 * Default scanner configuration
 */
export const DEFAULT_SCANNER_CONFIG: ScannerConfig = {
  formats: ['QR_CODE', 'CODE_128', 'CODE_39', 'EAN_13'],
  continuousScan: false,
  scanDelay: 1500,
  soundEnabled: true,
  vibrationEnabled: true,
  facingMode: 'environment',
};

/**
 * Camera permission status
 */
export type CameraPermission = 'granted' | 'denied' | 'prompt' | 'unavailable';

/**
 * Scanner error types
 */
export type ScannerError = 
  | 'CAMERA_NOT_FOUND'
  | 'PERMISSION_DENIED'
  | 'INITIALIZATION_FAILED'
  | 'DECODE_ERROR'
  | 'NETWORK_ERROR'
  | 'ASSET_NOT_FOUND';
