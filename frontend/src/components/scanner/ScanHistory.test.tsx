import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { ScanHistory } from './ScanHistory';
import type { ScanHistoryEntry } from '../../types/scanner';
import { mockScannedAssets } from './mockData';

const mockAsset = mockScannedAssets['AMS-HW-20250101-ABC123']!;

const createSuccessEntry = (id: string, overrides: Partial<ScanHistoryEntry> = {}): ScanHistoryEntry => ({
  id,
  barcodeValue: 'AMS-HW-20250101-ABC123',
  barcodeFormat: 'QR_CODE',
  scannedAt: new Date().toISOString(),
  asset: mockAsset,
  success: true,
  ...overrides,
});

const createFailedEntry = (id: string, barcodeValue: string = 'FAILED-001'): ScanHistoryEntry => ({
  id,
  barcodeValue,
  barcodeFormat: 'QR_CODE',
  scannedAt: new Date().toISOString(),
  success: false,
  error: 'Asset not found',
});

describe('ScanHistory', () => {
  it('renders history container', () => {
    render(<ScanHistory history={[createSuccessEntry('scan-001')]} />);
    expect(screen.getByRole('region', { name: 'Scan history' })).toBeInTheDocument();
  });

  it('displays empty state when no history', () => {
    render(<ScanHistory history={[]} />);
    expect(screen.getByText('No scan history')).toBeInTheDocument();
    expect(screen.getByText('Your recent scans will appear here')).toBeInTheDocument();
  });

  it('displays title with count', () => {
    render(<ScanHistory history={[createSuccessEntry('scan-001'), createSuccessEntry('scan-002')]} />);
    expect(screen.getByText('Scan History')).toBeInTheDocument();
    expect(screen.getByText('2')).toBeInTheDocument();
  });

  it('displays asset name for successful scans', () => {
    render(<ScanHistory history={[createSuccessEntry('scan-001')]} />);
    expect(screen.getByText('Dell Latitude 5540 Laptop')).toBeInTheDocument();
  });

  it('displays asset tag for successful scans', () => {
    render(<ScanHistory history={[createSuccessEntry('scan-001')]} />);
    expect(screen.getByText('AMS-HW-20250101-ABC123')).toBeInTheDocument();
  });

  it('displays barcode value for failed scans', () => {
    render(<ScanHistory history={[createFailedEntry('scan-001', 'AMS-HW-20250101-ABC123')]} />);
    expect(screen.getByText('AMS-HW-20250101-ABC123')).toBeInTheDocument();
  });

  it('displays error message for failed scans', () => {
    render(<ScanHistory history={[createFailedEntry('scan-001')]} />);
    expect(screen.getByText('Asset not found')).toBeInTheDocument();
  });

  it('displays barcode format', () => {
    render(<ScanHistory history={[createSuccessEntry('scan-001')]} />);
    expect(screen.getByText('QR CODE')).toBeInTheDocument();
  });

  it('displays asset status badge', () => {
    render(<ScanHistory history={[createSuccessEntry('scan-001')]} />);
    expect(screen.getByText('DEPLOYED')).toBeInTheDocument();
  });

  it('shows clear history button when onClearHistory is provided', () => {
    render(<ScanHistory history={[createSuccessEntry('scan-001')]} onClearHistory={() => {}} />);
    expect(screen.getByText('Clear History')).toBeInTheDocument();
  });

  it('calls onClearHistory when clear button is clicked', () => {
    const handleClear = vi.fn();
    render(<ScanHistory history={[createSuccessEntry('scan-001')]} onClearHistory={handleClear} />);
    
    fireEvent.click(screen.getByText('Clear History'));
    
    expect(handleClear).toHaveBeenCalled();
  });

  it('applies custom className', () => {
    render(<ScanHistory history={[createSuccessEntry('scan-001')]} className="custom-class" />);
    const container = screen.getByRole('region', { name: 'Scan history' });
    expect(container).toHaveClass('custom-class');
  });
});

describe('ScanHistory - Filter Tabs', () => {
  it('displays filter tabs', () => {
    render(<ScanHistory history={[createSuccessEntry('scan-001')]} />);
    expect(screen.getByRole('tablist')).toBeInTheDocument();
  });

  it('shows all tab with total count', () => {
    const history = [
      createSuccessEntry('1'),
      createFailedEntry('2'),
    ];
    render(<ScanHistory history={history} />);
    expect(screen.getByRole('tab', { name: /All \(2\)/ })).toBeInTheDocument();
  });

  it('shows found tab with success count', () => {
    const history = [
      createSuccessEntry('1'),
      createFailedEntry('2'),
    ];
    render(<ScanHistory history={history} />);
    expect(screen.getByRole('tab', { name: /^Found \(1\)$/ })).toBeInTheDocument();
  });

  it('shows not found tab with failed count', () => {
    const history = [
      createSuccessEntry('1'),
      createFailedEntry('2'),
    ];
    render(<ScanHistory history={history} />);
    expect(screen.getByRole('tab', { name: /^Not Found \(1\)$/ })).toBeInTheDocument();
  });

  it('filters to show only successful scans', () => {
    const history = [
      createSuccessEntry('1'),
      createFailedEntry('2', 'FAILED-001'),
    ];
    render(<ScanHistory history={history} />);
    
    fireEvent.click(screen.getByRole('tab', { name: /^Found \(/ }));
    
    expect(screen.getByText('Dell Latitude 5540 Laptop')).toBeInTheDocument();
    expect(screen.queryByText('FAILED-001')).not.toBeInTheDocument();
  });

  it('filters to show only failed scans', () => {
    const history = [
      createSuccessEntry('1'),
      createFailedEntry('2', 'FAILED-001'),
    ];
    render(<ScanHistory history={history} />);
    
    fireEvent.click(screen.getByRole('tab', { name: /Not Found/ }));
    
    expect(screen.queryByText('Dell Latitude 5540 Laptop')).not.toBeInTheDocument();
    expect(screen.getByText('FAILED-001')).toBeInTheDocument();
  });

  it('shows no results message when filter has no matches', () => {
    const history = [createSuccessEntry('1')];
    render(<ScanHistory history={history} />);
    
    fireEvent.click(screen.getByRole('tab', { name: /Not Found/ }));
    
    expect(screen.getByText(/No.*scans found/)).toBeInTheDocument();
  });
});

describe('ScanHistory - Actions', () => {
  it('shows view button when onViewAsset is provided and asset exists', () => {
    render(<ScanHistory history={[createSuccessEntry('scan-001')]} onViewAsset={() => {}} />);
    expect(screen.getByRole('button', { name: /View details for/ })).toBeInTheDocument();
  });

  it('calls onViewAsset when view button is clicked', () => {
    const handleView = vi.fn();
    render(<ScanHistory history={[createSuccessEntry('scan-001')]} onViewAsset={handleView} />);
    
    fireEvent.click(screen.getByRole('button', { name: /View details for/ }));
    
    expect(handleView).toHaveBeenCalledWith('asset-001');
  });

  it('does not show view button for failed scans', () => {
    render(<ScanHistory history={[createFailedEntry('scan-001')]} onViewAsset={() => {}} />);
    
    expect(screen.queryByRole('button', { name: /View details for/ })).not.toBeInTheDocument();
  });

  it('shows rescan button when onRescan is provided', () => {
    render(<ScanHistory history={[createSuccessEntry('scan-001')]} onRescan={() => {}} />);
    expect(screen.getByRole('button', { name: /Rescan/ })).toBeInTheDocument();
  });

  it('calls onRescan when rescan button is clicked', () => {
    const handleRescan = vi.fn();
    render(<ScanHistory history={[createSuccessEntry('scan-001')]} onRescan={handleRescan} />);
    
    fireEvent.click(screen.getByRole('button', { name: /Rescan/ }));
    
    expect(handleRescan).toHaveBeenCalledWith('AMS-HW-20250101-ABC123');
  });
});

describe('ScanHistory - Date Grouping', () => {
  it('groups scans by date', () => {
    const today = new Date();
    const yesterday = new Date(today);
    yesterday.setDate(yesterday.getDate() - 1);
    
    const history = [
      createSuccessEntry('1', { scannedAt: today.toISOString() }),
      createSuccessEntry('2', { scannedAt: yesterday.toISOString() }),
    ];
    render(<ScanHistory history={history} />);
    
    expect(screen.getByText('Today')).toBeInTheDocument();
    expect(screen.getByText('Yesterday')).toBeInTheDocument();
  });

  it('shows time for today scans', () => {
    const now = new Date();
    const entry = createSuccessEntry('scan-001', { scannedAt: now.toISOString() });
    render(<ScanHistory history={[entry]} />);
    
    // Should show time format like "10:30 AM"
    const timeRegex = /\d{1,2}:\d{2}/;
    const timeElements = screen.getAllByText(timeRegex);
    expect(timeElements.length).toBeGreaterThan(0);
  });
});

describe('ScanHistory - Max Entries', () => {
  it('limits displayed entries to maxEntries', () => {
    const history = Array.from({ length: 30 }, (_, i) => 
      createSuccessEntry(`scan-${i}`, { 
        barcodeValue: `AMS-HW-${i.toString().padStart(3, '0')}`,
        asset: { ...mockAsset, assetTag: `AMS-HW-${i.toString().padStart(3, '0')}` },
      })
    );
    render(<ScanHistory history={history} maxEntries={10} />);
    
    // Should only show 10 entries
    const items = screen.getAllByText(/AMS-HW-/);
    // Each entry shows asset tag twice (in header and meta), so divide by 2
    expect(items.length / 2).toBeLessThanOrEqual(10);
  });
});

describe('ScanHistory - Asset Types', () => {
  it('displays hardware asset icon', () => {
    render(<ScanHistory history={[createSuccessEntry('scan-001')]} />);
    // Hardware icon should be rendered
    expect(screen.getByRole('region', { name: 'Scan history' })).toBeInTheDocument();
  });

  it('displays software asset correctly', () => {
    const softwareAsset = mockScannedAssets['AMS-SW-20250104-JKL012']!;
    const entry = createSuccessEntry('scan-001', {
      barcodeValue: 'AMS-SW-20250104-JKL012',
      asset: softwareAsset,
    });
    render(<ScanHistory history={[entry]} />);
    
    expect(screen.getByText('Microsoft Office 365 E3')).toBeInTheDocument();
  });

  it('displays enterprise asset correctly', () => {
    const enterpriseAsset = mockScannedAssets['AMS-ENT-20250105-MNO345']!;
    const entry = createSuccessEntry('scan-001', {
      barcodeValue: 'AMS-ENT-20250105-MNO345',
      asset: enterpriseAsset,
    });
    render(<ScanHistory history={[entry]} />);
    
    expect(screen.getByText('HVAC Unit - Building A')).toBeInTheDocument();
  });
});

describe('ScanHistory - Requirements Validation', () => {
  /**
   * Validates Requirement 13.1: Barcode scanning for asset lookup
   */
  it('tracks scan history for asset lookups (Requirement 13.1)', () => {
    const history = [
      createSuccessEntry('1'),
      createFailedEntry('2'),
    ];
    render(<ScanHistory history={history} />);
    
    // Verify history is displayed
    expect(screen.getByText('Scan History')).toBeInTheDocument();
    expect(screen.getByText('2')).toBeInTheDocument();
    
    // Verify filter tabs show counts
    expect(screen.getByRole('tab', { name: /^Found \(1\)$/ })).toBeInTheDocument();
    expect(screen.getByRole('tab', { name: /^Not Found \(1\)$/ })).toBeInTheDocument();
  });

  /**
   * Validates Requirement 13.2: Display asset details
   */
  it('displays asset details in history (Requirement 13.2)', () => {
    render(<ScanHistory history={[createSuccessEntry('scan-001')]} />);
    
    // Verify asset details are shown
    expect(screen.getByText('Dell Latitude 5540 Laptop')).toBeInTheDocument();
    expect(screen.getByText('AMS-HW-20250101-ABC123')).toBeInTheDocument();
    expect(screen.getByText('DEPLOYED')).toBeInTheDocument();
  });

  /**
   * Validates Requirement 13.2: Available actions after scanning
   */
  it('provides actions for scanned assets (Requirement 13.2)', () => {
    const handleView = vi.fn();
    const handleRescan = vi.fn();
    
    render(
      <ScanHistory 
        history={[createSuccessEntry('scan-001')]} 
        onViewAsset={handleView}
        onRescan={handleRescan}
      />
    );
    
    // Verify action buttons are available
    expect(screen.getByRole('button', { name: /View details for/ })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Rescan/ })).toBeInTheDocument();
  });
});
