/**
 * Audit Module - Exports for mobile audit operations
 *
 * Implements:
 * - Barcode and QR code scanning for asset verification (Requirement 3.4)
 * - Discrepancy calculation between expected and scanned assets (Requirement 3.5)
 */

// Export service functions
export {
  calculateDiscrepancies,
  getAudit,
  getAuditDiscrepancies,
  getAuditScans,
  recordAuditScan,
  validateBarcode,
  validateQRCode,
} from './audit-service';

// Export types
export type {
  AssetCondition,
  AuditRecord,
  AuditScan,
  AuditScanResult,
  AuditStatus,
  AuditType,
  BarcodeFormat,
  BarcodeValidationResult,
  CreateAuditScanRequest,
  DiscrepancyCalculationResult,
  DiscrepancySummary,
  DiscrepancyType,
  ExpectedInventoryItem,
  QRCodeValidationResult,
} from './audit-service';
