export { BarcodeScanner } from './BarcodeScanner';
export type { BarcodeScannerProps } from './BarcodeScanner';

export { ScanResult } from './ScanResult';
export type { ScanResultProps } from './ScanResult';

export { OfflineScanQueue } from './OfflineScanQueue';
export type { OfflineScanQueueProps } from './OfflineScanQueue';

export { ScanHistory } from './ScanHistory';
export type { ScanHistoryProps } from './ScanHistory';

export {
  mockScannedAssets,
  mockScanHistory,
  mockOfflineScans,
  mockLookupAsset,
  mockDetectionResults,
  generateScanId,
  generateOfflineScanId,
  simulateApiDelay,
} from './mockData';
export type { MockDetectionResult } from './mockData';
