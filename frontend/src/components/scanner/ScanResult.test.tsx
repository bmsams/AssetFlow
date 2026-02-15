import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { ScanResult } from './ScanResult';
import type { ScanResult as ScanResultType } from '../../types/scanner';
import { mockScannedAssets } from './mockData';

const mockAsset = mockScannedAssets['AMS-HW-20250101-ABC123'];

const createMockResult = (overrides: Partial<ScanResultType> = {}): ScanResultType => {
  const base: ScanResultType = {
    scanId: 'scan-001',
    barcodeValue: 'AMS-HW-20250101-ABC123',
    barcodeFormat: 'QR_CODE',
    scannedAt: '2025-01-15T10:30:00Z',
    isOffline: false,
    asset: mockAsset,
  };
  return { ...base, ...overrides };
};

describe('ScanResult', () => {
  it('renders scan result container', () => {
    render(<ScanResult result={createMockResult()} />);
    expect(screen.getByRole('region', { name: 'Scan result' })).toBeInTheDocument();
  });

  it('displays scan metadata', () => {
    render(<ScanResult result={createMockResult()} />);
    expect(screen.getByText('QR CODE')).toBeInTheDocument();
  });

  it('displays asset name when asset is found', () => {
    render(<ScanResult result={createMockResult()} />);
    expect(screen.getByText('Dell Latitude 5540 Laptop')).toBeInTheDocument();
  });

  it('displays asset tag when asset is found', () => {
    render(<ScanResult result={createMockResult()} />);
    expect(screen.getByText('AMS-HW-20250101-ABC123')).toBeInTheDocument();
  });

  it('displays asset status badge', () => {
    render(<ScanResult result={createMockResult()} />);
    expect(screen.getByText('DEPLOYED')).toBeInTheDocument();
  });

  it('displays serial number when available', () => {
    render(<ScanResult result={createMockResult()} />);
    expect(screen.getByText('Serial Number')).toBeInTheDocument();
    expect(screen.getByText('DL5540-SN-12345')).toBeInTheDocument();
  });

  it('displays manufacturer when available', () => {
    render(<ScanResult result={createMockResult()} />);
    expect(screen.getByText('Manufacturer')).toBeInTheDocument();
    expect(screen.getByText('Dell')).toBeInTheDocument();
  });

  it('displays model when available', () => {
    render(<ScanResult result={createMockResult()} />);
    expect(screen.getByText('Model')).toBeInTheDocument();
    expect(screen.getByText('Latitude 5540')).toBeInTheDocument();
  });

  it('displays assigned to when available', () => {
    render(<ScanResult result={createMockResult()} />);
    expect(screen.getByText('Assigned To')).toBeInTheDocument();
    expect(screen.getByText('John Smith')).toBeInTheDocument();
  });

  it('displays location when available', () => {
    render(<ScanResult result={createMockResult()} />);
    expect(screen.getByText('Location')).toBeInTheDocument();
    expect(screen.getByText('Building A, Floor 2, Room 201')).toBeInTheDocument();
  });

  it('displays last updated date', () => {
    render(<ScanResult result={createMockResult()} />);
    expect(screen.getByText('Last Updated')).toBeInTheDocument();
  });

  it('shows not found state when asset is not found', () => {
    const result: ScanResultType = {
      scanId: 'scan-001',
      barcodeValue: 'AMS-HW-20250101-ABC123',
      barcodeFormat: 'QR_CODE',
      scannedAt: '2025-01-15T10:30:00Z',
      isOffline: false,
      error: 'Asset not found',
    };
    render(<ScanResult result={result} />);
    
    expect(screen.getByText('Asset Not Found')).toBeInTheDocument();
    expect(screen.getByText(/No asset found with barcode/)).toBeInTheDocument();
  });

  it('displays barcode value in not found state', () => {
    const result: ScanResultType = {
      scanId: 'scan-001',
      barcodeValue: 'AMS-HW-20250101-ABC123',
      barcodeFormat: 'QR_CODE',
      scannedAt: '2025-01-15T10:30:00Z',
      isOffline: false,
      error: 'Asset not found',
    };
    render(<ScanResult result={result} />);
    
    expect(screen.getByText('AMS-HW-20250101-ABC123')).toBeInTheDocument();
  });

  it('shows offline pending state when offline and no asset', () => {
    const result: ScanResultType = {
      scanId: 'scan-001',
      barcodeValue: 'AMS-HW-20250101-ABC123',
      barcodeFormat: 'QR_CODE',
      scannedAt: '2025-01-15T10:30:00Z',
      isOffline: true,
    };
    render(<ScanResult result={result} />);
    
    expect(screen.getByText('Scan Saved Offline')).toBeInTheDocument();
    expect(screen.getByText(/will be synced when you're back online/)).toBeInTheDocument();
  });

  it('shows offline badge when scan was offline', () => {
    const result = createMockResult({ isOffline: true });
    render(<ScanResult result={result} />);
    
    expect(screen.getByText('Offline')).toBeInTheDocument();
  });

  it('calls onViewDetails when view details button is clicked', () => {
    const handleViewDetails = vi.fn();
    render(<ScanResult result={createMockResult()} onViewDetails={handleViewDetails} />);
    
    fireEvent.click(screen.getByText('View Full Details'));
    
    expect(handleViewDetails).toHaveBeenCalledWith('asset-001');
  });

  it('calls onScanAgain when scan again button is clicked', () => {
    const handleScanAgain = vi.fn();
    render(<ScanResult result={createMockResult()} onScanAgain={handleScanAgain} />);
    
    fireEvent.click(screen.getByText('Scan Another'));
    
    expect(handleScanAgain).toHaveBeenCalled();
  });

  it('calls onDismiss when dismiss button is clicked', () => {
    const handleDismiss = vi.fn();
    render(<ScanResult result={createMockResult()} onDismiss={handleDismiss} />);
    
    fireEvent.click(screen.getByText('Dismiss'));
    
    expect(handleDismiss).toHaveBeenCalled();
  });

  it('does not show view details button when no asset', () => {
    const result: ScanResultType = {
      scanId: 'scan-001',
      barcodeValue: 'AMS-HW-20250101-ABC123',
      barcodeFormat: 'QR_CODE',
      scannedAt: '2025-01-15T10:30:00Z',
      isOffline: false,
    };
    render(<ScanResult result={result} onViewDetails={() => {}} />);
    
    expect(screen.queryByText('View Full Details')).not.toBeInTheDocument();
  });

  it('does not show view details button when onViewDetails not provided', () => {
    render(<ScanResult result={createMockResult()} />);
    
    expect(screen.queryByText('View Full Details')).not.toBeInTheDocument();
  });

  it('applies custom className', () => {
    render(<ScanResult result={createMockResult()} className="custom-class" />);
    const container = screen.getByRole('region', { name: 'Scan result' });
    expect(container).toHaveClass('custom-class');
  });
});

describe('ScanResult - Asset Types', () => {
  it('displays hardware asset icon for HARDWARE type', () => {
    render(<ScanResult result={createMockResult()} />);
    // Hardware icon should be rendered (monitor icon)
    const container = screen.getByRole('region', { name: 'Scan result' });
    expect(container).toBeInTheDocument();
  });

  it('displays software asset correctly', () => {
    const softwareAsset = mockScannedAssets['AMS-SW-20250104-JKL012']!;
    const result = createMockResult({
      barcodeValue: 'AMS-SW-20250104-JKL012',
      asset: softwareAsset,
    });
    render(<ScanResult result={result} />);
    
    expect(screen.getByText('Microsoft Office 365 E3')).toBeInTheDocument();
    expect(screen.getByText('DEPLOYED')).toBeInTheDocument();
  });

  it('displays enterprise asset correctly', () => {
    const enterpriseAsset = mockScannedAssets['AMS-ENT-20250105-MNO345']!;
    const result = createMockResult({
      barcodeValue: 'AMS-ENT-20250105-MNO345',
      asset: enterpriseAsset,
    });
    render(<ScanResult result={result} />);
    
    expect(screen.getByText('HVAC Unit - Building A')).toBeInTheDocument();
    expect(screen.getByText('IN MAINTENANCE')).toBeInTheDocument();
  });
});

describe('ScanResult - Status Badges', () => {
  it('displays DEPLOYED status with correct styling', () => {
    render(<ScanResult result={createMockResult()} />);
    const badge = screen.getByText('DEPLOYED');
    expect(badge).toBeInTheDocument();
  });

  it('displays IN_STOCK status correctly', () => {
    const inStockAsset = mockScannedAssets['AMS-HW-20250102-DEF456']!;
    const result = createMockResult({
      barcodeValue: 'AMS-HW-20250102-DEF456',
      asset: inStockAsset,
    });
    render(<ScanResult result={result} />);
    
    expect(screen.getByText('IN STOCK')).toBeInTheDocument();
  });

  it('displays IN_MAINTENANCE status correctly', () => {
    const maintenanceAsset = mockScannedAssets['AMS-ENT-20250105-MNO345']!;
    const result = createMockResult({
      barcodeValue: 'AMS-ENT-20250105-MNO345',
      asset: maintenanceAsset,
    });
    render(<ScanResult result={result} />);
    
    expect(screen.getByText('IN MAINTENANCE')).toBeInTheDocument();
  });
});

describe('ScanResult - Requirements Validation', () => {
  /**
   * Validates Requirement 13.2: Display asset details after scanning
   */
  it('displays comprehensive asset details (Requirement 13.2)', () => {
    render(<ScanResult result={createMockResult()} />);
    
    // Verify all key asset details are displayed
    expect(screen.getByText('Dell Latitude 5540 Laptop')).toBeInTheDocument();
    expect(screen.getByText('AMS-HW-20250101-ABC123')).toBeInTheDocument();
    expect(screen.getByText('DEPLOYED')).toBeInTheDocument();
    expect(screen.getByText('DL5540-SN-12345')).toBeInTheDocument();
    expect(screen.getByText('Dell')).toBeInTheDocument();
    expect(screen.getByText('Latitude 5540')).toBeInTheDocument();
    expect(screen.getByText('John Smith')).toBeInTheDocument();
    expect(screen.getByText('Building A, Floor 2, Room 201')).toBeInTheDocument();
  });

  /**
   * Validates Requirement 13.3: Offline scanning support
   */
  it('handles offline scan results appropriately (Requirement 13.3)', () => {
    const offlineResult: ScanResultType = {
      scanId: 'scan-001',
      barcodeValue: 'AMS-HW-20250101-ABC123',
      barcodeFormat: 'QR_CODE',
      scannedAt: '2025-01-15T10:30:00Z',
      isOffline: true,
    };
    render(<ScanResult result={offlineResult} />);
    
    // Verify offline state is communicated to user
    expect(screen.getByText('Offline')).toBeInTheDocument();
    expect(screen.getByText('Scan Saved Offline')).toBeInTheDocument();
    expect(screen.getByText(/will be synced when you're back online/)).toBeInTheDocument();
  });
});
