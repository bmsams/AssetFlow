/**
 * Audit Service Unit Tests
 *
 * Tests for Mobile Audit Service:
 * - Barcode/QR code validation (Requirement 3.4)
 * - Discrepancy calculation (Requirement 3.5)
 */

import {
  validateBarcode,
  validateQRCode,
  calculateDiscrepancies,
} from '../audit/audit-service';
import type { AuditScan, ExpectedInventoryItem } from '../audit/audit-service';

describe('validateBarcode', () => {
  describe('valid barcodes', () => {
    it('should validate a standard asset tag', () => {
      const result = validateBarcode('AST-123456');
      expect(result.isValid).toBe(true);
      expect(result.normalizedValue).toBe('AST-123456');
      expect(result.errors).toHaveLength(0);
    });

    it('should validate an asset tag without hyphen', () => {
      const result = validateBarcode('AST123456');
      expect(result.isValid).toBe(true);
      expect(result.normalizedValue).toBe('AST123456');
    });

    it('should validate a serial number format', () => {
      const result = validateBarcode('SN12345ABCDE');
      expect(result.isValid).toBe(true);
      expect(result.normalizedValue).toBe('SN12345ABCDE');
    });

    it('should normalize lowercase to uppercase', () => {
      const result = validateBarcode('ast-123456');
      expect(result.isValid).toBe(true);
      expect(result.normalizedValue).toBe('AST-123456');
    });

    it('should trim whitespace', () => {
      const result = validateBarcode('  AST-123456  ');
      expect(result.isValid).toBe(true);
      expect(result.normalizedValue).toBe('AST-123456');
    });

    it('should detect EAN13 format', () => {
      const result = validateBarcode('1234567890123');
      expect(result.isValid).toBe(true);
      expect(result.format).toBe('EAN13');
    });

    it('should detect UPC-A format', () => {
      const result = validateBarcode('123456789012');
      expect(result.isValid).toBe(true);
      expect(result.format).toBe('UPC_A');
    });

    it('should detect CODE39 format', () => {
      const result = validateBarcode('ABC-123.456');
      expect(result.isValid).toBe(true);
      expect(result.format).toBe('CODE39');
    });
  });

  describe('invalid barcodes', () => {
    it('should reject empty string', () => {
      const result = validateBarcode('');
      expect(result.isValid).toBe(false);
      expect(result.errors).toContain('Barcode value is required');
    });

    it('should reject whitespace only', () => {
      const result = validateBarcode('   ');
      expect(result.isValid).toBe(false);
      expect(result.errors).toContain('Barcode value cannot be empty');
    });

    it('should reject null-like values', () => {
      const result = validateBarcode(null as unknown as string);
      expect(result.isValid).toBe(false);
      expect(result.errors).toContain('Barcode value is required');
    });

    it('should reject undefined', () => {
      const result = validateBarcode(undefined as unknown as string);
      expect(result.isValid).toBe(false);
      expect(result.errors).toContain('Barcode value is required');
    });

    it('should reject values exceeding max length', () => {
      const longBarcode = 'A'.repeat(256);
      const result = validateBarcode(longBarcode);
      expect(result.isValid).toBe(false);
      expect(result.errors).toContain('Barcode value exceeds maximum length of 255 characters');
    });
  });
});

describe('validateQRCode', () => {
  describe('valid QR codes', () => {
    it('should validate plain text asset tag', () => {
      const result = validateQRCode('AST-123456');
      expect(result.isValid).toBe(true);
      expect(result.normalizedValue).toBe('AST-123456');
      expect(result.format).toBe('QR_CODE');
    });

    it('should parse JSON QR code with assetTag', () => {
      const qrData = JSON.stringify({ assetTag: 'AST-123456', serialNumber: 'SN001' });
      const result = validateQRCode(qrData);
      expect(result.isValid).toBe(true);
      expect(result.normalizedValue).toBe('AST-123456');
      expect(result.parsedData).toEqual({ assetTag: 'AST-123456', serialNumber: 'SN001' });
    });

    it('should parse JSON QR code with serialNumber', () => {
      const qrData = JSON.stringify({ serialNumber: 'SN12345ABCDE' });
      const result = validateQRCode(qrData);
      expect(result.isValid).toBe(true);
      expect(result.normalizedValue).toBe('SN12345ABCDE');
    });

    it('should parse key=value format', () => {
      const result = validateQRCode('assetTag=AST-123456;serial=SN001');
      expect(result.isValid).toBe(true);
      expect(result.normalizedValue).toBe('AST-123456');
      expect(result.parsedData).toEqual({ assetTag: 'AST-123456', serial: 'SN001' });
    });

    it('should parse key=value format with ampersand separator', () => {
      const result = validateQRCode('assetTag=AST-789012&serial=SN002');
      expect(result.isValid).toBe(true);
      expect(result.normalizedValue).toBe('AST-789012');
    });

    it('should normalize to uppercase', () => {
      const result = validateQRCode('ast-123456');
      expect(result.isValid).toBe(true);
      expect(result.normalizedValue).toBe('AST-123456');
    });
  });

  describe('invalid QR codes', () => {
    it('should reject empty string', () => {
      const result = validateQRCode('');
      expect(result.isValid).toBe(false);
      expect(result.errors).toContain('QR code data is required');
    });

    it('should reject null', () => {
      const result = validateQRCode(null as unknown as string);
      expect(result.isValid).toBe(false);
      expect(result.errors).toContain('QR code data is required');
    });

    it('should reject values exceeding max length', () => {
      const longData = 'A'.repeat(2049);
      const result = validateQRCode(longData);
      expect(result.isValid).toBe(false);
      expect(result.errors).toContain('QR code data exceeds maximum length of 2048 characters');
    });
  });
});

describe('calculateDiscrepancies', () => {
  const createExpectedItem = (assetTag: string): ExpectedInventoryItem => ({
    assetId: `asset-${assetTag}`,
    assetTag,
    serialNumber: `SN-${assetTag}`,
    expectedLocation: 'BIN-A1',
    expectedCondition: 'GOOD',
  });

  const createScan = (assetTag: string, overrides: Partial<AuditScan> = {}): AuditScan => ({
    scanId: `scan-${assetTag}`,
    auditId: 'audit-001',
    assetId: `asset-${assetTag}`,
    assetTag,
    serialNumber: `SN-${assetTag}`,
    barcodeScanned: assetTag,
    scannedAt: new Date().toISOString(),
    scannedBy: 'user-001',
    expected: true,
    found: true,
    expectedLocation: 'BIN-A1',
    foundLocation: 'BIN-A1',
    binLocation: 'BIN-A1',
    expectedCondition: 'GOOD',
    foundCondition: 'GOOD',
    expectedQuantity: 1,
    foundQuantity: 1,
    isDiscrepancy: false,
    discrepancyType: null,
    discrepancyNotes: null,
    resolved: false,
    resolvedBy: null,
    resolvedAt: null,
    resolutionNotes: null,
    notes: null,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    ...overrides,
  });

  it('should identify all items as matched when expected equals scanned', () => {
    const expected = [
      createExpectedItem('AST-001'),
      createExpectedItem('AST-002'),
      createExpectedItem('AST-003'),
    ];
    const scanned = [
      createScan('AST-001'),
      createScan('AST-002'),
      createScan('AST-003'),
    ];

    const result = calculateDiscrepancies(expected, scanned);

    expect(result.matched).toHaveLength(3);
    expect(result.missing).toHaveLength(0);
    expect(result.extra).toHaveLength(0);
    expect(result.damaged).toHaveLength(0);
  });

  it('should identify missing items', () => {
    const expected = [
      createExpectedItem('AST-001'),
      createExpectedItem('AST-002'),
      createExpectedItem('AST-003'),
    ];
    const scanned = [
      createScan('AST-001'),
    ];

    const result = calculateDiscrepancies(expected, scanned);

    expect(result.matched).toHaveLength(1);
    expect(result.missing).toHaveLength(2);
    expect(result.missing.map(m => m.assetTag)).toEqual(['AST-002', 'AST-003']);
    expect(result.extra).toHaveLength(0);
  });

  it('should identify extra items', () => {
    const expected = [
      createExpectedItem('AST-001'),
    ];
    const scanned = [
      createScan('AST-001'),
      createScan('AST-002'),
      createScan('AST-003'),
    ];

    const result = calculateDiscrepancies(expected, scanned);

    expect(result.matched).toHaveLength(1);
    expect(result.missing).toHaveLength(0);
    expect(result.extra).toHaveLength(2);
    expect(result.extra.map(e => e.assetTag)).toEqual(['AST-002', 'AST-003']);
  });

  it('should identify damaged items', () => {
    const expected = [
      createExpectedItem('AST-001'),
      createExpectedItem('AST-002'),
    ];
    const scanned = [
      createScan('AST-001'),
      createScan('AST-002', { foundCondition: 'DAMAGED' }),
    ];

    const result = calculateDiscrepancies(expected, scanned);

    expect(result.matched).toHaveLength(2);
    expect(result.damaged).toHaveLength(1);
    expect(result.damaged[0]?.assetTag).toBe('AST-002');
  });

  it('should handle empty expected list', () => {
    const expected: ExpectedInventoryItem[] = [];
    const scanned = [
      createScan('AST-001'),
      createScan('AST-002'),
    ];

    const result = calculateDiscrepancies(expected, scanned);

    expect(result.matched).toHaveLength(0);
    expect(result.missing).toHaveLength(0);
    expect(result.extra).toHaveLength(2);
  });

  it('should handle empty scanned list', () => {
    const expected = [
      createExpectedItem('AST-001'),
      createExpectedItem('AST-002'),
    ];
    const scanned: AuditScan[] = [];

    const result = calculateDiscrepancies(expected, scanned);

    expect(result.matched).toHaveLength(0);
    expect(result.missing).toHaveLength(2);
    expect(result.extra).toHaveLength(0);
  });

  it('should handle both empty lists', () => {
    const result = calculateDiscrepancies([], []);

    expect(result.matched).toHaveLength(0);
    expect(result.missing).toHaveLength(0);
    expect(result.extra).toHaveLength(0);
    expect(result.damaged).toHaveLength(0);
  });

  it('should handle complex scenario with missing, extra, and damaged', () => {
    const expected = [
      createExpectedItem('AST-001'),
      createExpectedItem('AST-002'),
      createExpectedItem('AST-003'),
      createExpectedItem('AST-004'),
    ];
    const scanned = [
      createScan('AST-001'),
      createScan('AST-002', { foundCondition: 'DAMAGED' }),
      // AST-003 is missing
      // AST-004 is missing
      createScan('AST-005'), // Extra
      createScan('AST-006'), // Extra
    ];

    const result = calculateDiscrepancies(expected, scanned);

    expect(result.matched).toHaveLength(2);
    expect(result.missing).toHaveLength(2);
    expect(result.missing.map(m => m.assetTag)).toEqual(['AST-003', 'AST-004']);
    expect(result.extra).toHaveLength(2);
    expect(result.extra.map(e => e.assetTag)).toEqual(['AST-005', 'AST-006']);
    expect(result.damaged).toHaveLength(1);
    expect(result.damaged[0]?.assetTag).toBe('AST-002');
  });
});
