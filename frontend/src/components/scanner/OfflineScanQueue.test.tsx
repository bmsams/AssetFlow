import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { OfflineScanQueue } from './OfflineScanQueue';
import type { OfflineScan } from '../../types/scanner';

const createMockScan = (overrides: Partial<OfflineScan> = {}): OfflineScan => ({
  id: 'offline-001',
  barcodeValue: 'AMS-HW-20250101-ABC123',
  barcodeFormat: 'QR_CODE',
  scannedAt: '2025-01-15T10:30:00Z',
  syncStatus: 'pending',
  syncAttempts: 0,
  ...overrides,
});

describe('OfflineScanQueue', () => {
  it('renders queue container', () => {
    render(<OfflineScanQueue scans={[createMockScan()]} />);
    expect(screen.getByRole('region', { name: 'Offline scan queue' })).toBeInTheDocument();
  });

  it('displays empty state when no scans', () => {
    render(<OfflineScanQueue scans={[]} />);
    expect(screen.getByText('No offline scans')).toBeInTheDocument();
    expect(screen.getByText('Scans made while offline will appear here')).toBeInTheDocument();
  });

  it('displays title with count', () => {
    render(<OfflineScanQueue scans={[createMockScan(), createMockScan({ id: 'offline-002' })]} />);
    expect(screen.getByText('Offline Scans')).toBeInTheDocument();
    expect(screen.getByText('2')).toBeInTheDocument();
  });

  it('displays barcode value for each scan', () => {
    render(<OfflineScanQueue scans={[createMockScan()]} />);
    expect(screen.getByText('AMS-HW-20250101-ABC123')).toBeInTheDocument();
  });

  it('displays relative time for scans', () => {
    const recentScan = createMockScan({
      scannedAt: new Date(Date.now() - 5 * 60 * 1000).toISOString(), // 5 minutes ago
    });
    render(<OfflineScanQueue scans={[recentScan]} />);
    expect(screen.getByText('5m ago')).toBeInTheDocument();
  });

  it('shows sync button when there are pending scans', () => {
    render(<OfflineScanQueue scans={[createMockScan()]} onSync={() => {}} />);
    expect(screen.getByText('Sync Now')).toBeInTheDocument();
  });

  it('calls onSync when sync button is clicked', () => {
    const handleSync = vi.fn();
    render(<OfflineScanQueue scans={[createMockScan()]} onSync={handleSync} />);
    
    fireEvent.click(screen.getByText('Sync Now'));
    
    expect(handleSync).toHaveBeenCalled();
  });

  it('disables sync button when syncing', () => {
    render(<OfflineScanQueue scans={[createMockScan()]} onSync={() => {}} isSyncing />);
    expect(screen.getByText('Syncing...')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /syncing/i })).toBeDisabled();
  });

  it('disables sync button when offline', () => {
    render(<OfflineScanQueue scans={[createMockScan()]} onSync={() => {}} isOnline={false} />);
    expect(screen.getByText('Sync Now')).toBeDisabled();
  });

  it('shows offline warning when not online', () => {
    render(<OfflineScanQueue scans={[createMockScan()]} isOnline={false} />);
    expect(screen.getByRole('alert')).toBeInTheDocument();
    expect(screen.getByText(/You're offline/)).toBeInTheDocument();
  });

  it('shows clear synced button when there are synced scans', () => {
    const syncedScan = createMockScan({ syncStatus: 'synced' });
    render(<OfflineScanQueue scans={[syncedScan]} onClearSynced={() => {}} />);
    expect(screen.getByText('Clear Synced')).toBeInTheDocument();
  });

  it('calls onClearSynced when clear button is clicked', () => {
    const handleClear = vi.fn();
    const syncedScan = createMockScan({ syncStatus: 'synced' });
    render(<OfflineScanQueue scans={[syncedScan]} onClearSynced={handleClear} />);
    
    fireEvent.click(screen.getByText('Clear Synced'));
    
    expect(handleClear).toHaveBeenCalled();
  });

  it('applies custom className', () => {
    render(<OfflineScanQueue scans={[createMockScan()]} className="custom-class" />);
    const container = screen.getByRole('region', { name: 'Offline scan queue' });
    expect(container).toHaveClass('custom-class');
  });
});

describe('OfflineScanQueue - Status Summary', () => {
  it('displays pending count in summary', () => {
    const scans = [
      createMockScan({ id: '1', syncStatus: 'pending' }),
      createMockScan({ id: '2', syncStatus: 'pending' }),
    ];
    render(<OfflineScanQueue scans={scans} />);
    expect(screen.getByText('2 pending')).toBeInTheDocument();
  });

  it('displays syncing count in summary', () => {
    const scans = [createMockScan({ syncStatus: 'syncing' })];
    render(<OfflineScanQueue scans={scans} />);
    expect(screen.getByText('1 syncing')).toBeInTheDocument();
  });

  it('displays synced count in summary', () => {
    const scans = [createMockScan({ syncStatus: 'synced' })];
    render(<OfflineScanQueue scans={scans} />);
    expect(screen.getByText('1 synced')).toBeInTheDocument();
  });

  it('displays failed count in summary', () => {
    const scans = [createMockScan({ syncStatus: 'failed', syncError: 'Network error' })];
    render(<OfflineScanQueue scans={scans} />);
    expect(screen.getByText('1 failed')).toBeInTheDocument();
  });

  it('displays multiple status counts', () => {
    const scans = [
      createMockScan({ id: '1', syncStatus: 'pending' }),
      createMockScan({ id: '2', syncStatus: 'synced' }),
      createMockScan({ id: '3', syncStatus: 'failed', syncError: 'Error' }),
    ];
    render(<OfflineScanQueue scans={scans} />);
    
    expect(screen.getByText('1 pending')).toBeInTheDocument();
    expect(screen.getByText('1 synced')).toBeInTheDocument();
    expect(screen.getByText('1 failed')).toBeInTheDocument();
  });
});

describe('OfflineScanQueue - Expandable Details', () => {
  it('expands scan details when clicked', () => {
    render(<OfflineScanQueue scans={[createMockScan()]} />);
    
    // Click to expand
    fireEvent.click(screen.getByRole('button', { expanded: false }));
    
    // Details should be visible
    expect(screen.getByText('Barcode Format')).toBeInTheDocument();
    expect(screen.getByText('Scanned At')).toBeInTheDocument();
    expect(screen.getByText('Sync Attempts')).toBeInTheDocument();
  });

  it('collapses scan details when clicked again', () => {
    render(<OfflineScanQueue scans={[createMockScan()]} />);
    
    // Click to expand
    fireEvent.click(screen.getByRole('button', { expanded: false }));
    expect(screen.getByText('Barcode Format')).toBeInTheDocument();
    
    // Click to collapse
    fireEvent.click(screen.getByRole('button', { expanded: true }));
    expect(screen.queryByText('Barcode Format')).not.toBeInTheDocument();
  });

  it('shows error message for failed scans', () => {
    const failedScan = createMockScan({
      syncStatus: 'failed',
      syncError: 'Network timeout',
      syncAttempts: 3,
    });
    render(<OfflineScanQueue scans={[failedScan]} />);
    
    // Expand to see details
    fireEvent.click(screen.getByRole('button', { expanded: false }));
    
    expect(screen.getByText('Error')).toBeInTheDocument();
    expect(screen.getByText('Network timeout')).toBeInTheDocument();
  });

  it('shows last sync attempt time for failed scans', () => {
    const failedScan = createMockScan({
      syncStatus: 'failed',
      syncError: 'Error',
      lastSyncAttempt: '2025-01-15T09:00:00Z',
    });
    render(<OfflineScanQueue scans={[failedScan]} />);
    
    fireEvent.click(screen.getByRole('button', { expanded: false }));
    
    expect(screen.getByText('Last Attempt')).toBeInTheDocument();
  });

  it('shows retry button for failed scans', () => {
    const failedScan = createMockScan({ syncStatus: 'failed', syncError: 'Error' });
    render(<OfflineScanQueue scans={[failedScan]} onRetry={() => {}} />);
    
    fireEvent.click(screen.getByRole('button', { expanded: false }));
    
    expect(screen.getByText('Retry')).toBeInTheDocument();
  });

  it('calls onRetry when retry button is clicked', () => {
    const handleRetry = vi.fn();
    const failedScan = createMockScan({ syncStatus: 'failed', syncError: 'Error' });
    render(<OfflineScanQueue scans={[failedScan]} onRetry={handleRetry} />);
    
    fireEvent.click(screen.getByRole('button', { expanded: false }));
    fireEvent.click(screen.getByText('Retry'));
    
    expect(handleRetry).toHaveBeenCalledWith('offline-001');
  });

  it('shows remove button when onRemove is provided', () => {
    render(<OfflineScanQueue scans={[createMockScan()]} onRemove={() => {}} />);
    
    fireEvent.click(screen.getByRole('button', { expanded: false }));
    
    expect(screen.getByText('Remove')).toBeInTheDocument();
  });

  it('calls onRemove when remove button is clicked', () => {
    const handleRemove = vi.fn();
    render(<OfflineScanQueue scans={[createMockScan()]} onRemove={handleRemove} />);
    
    fireEvent.click(screen.getByRole('button', { expanded: false }));
    fireEvent.click(screen.getByText('Remove'));
    
    expect(handleRemove).toHaveBeenCalledWith('offline-001');
  });
});

describe('OfflineScanQueue - Requirements Validation', () => {
  /**
   * Validates Requirement 13.3: Offline scanning with sync when online
   */
  it('displays offline scans pending sync (Requirement 13.3)', () => {
    const pendingScans = [
      createMockScan({ id: '1', barcodeValue: 'AMS-HW-001', syncStatus: 'pending' }),
      createMockScan({ id: '2', barcodeValue: 'AMS-HW-002', syncStatus: 'pending' }),
    ];
    render(<OfflineScanQueue scans={pendingScans} />);
    
    expect(screen.getByText('AMS-HW-001')).toBeInTheDocument();
    expect(screen.getByText('AMS-HW-002')).toBeInTheDocument();
    expect(screen.getByText('2 pending')).toBeInTheDocument();
  });

  /**
   * Validates Requirement 13.3: Sync functionality
   */
  it('provides sync functionality when online (Requirement 13.3)', () => {
    const handleSync = vi.fn();
    render(
      <OfflineScanQueue 
        scans={[createMockScan()]} 
        onSync={handleSync} 
        isOnline={true} 
      />
    );
    
    const syncButton = screen.getByText('Sync Now');
    expect(syncButton).not.toBeDisabled();
    
    fireEvent.click(syncButton);
    expect(handleSync).toHaveBeenCalled();
  });

  /**
   * Validates Requirement 13.3: Offline state handling
   */
  it('prevents sync when offline (Requirement 13.3)', () => {
    render(
      <OfflineScanQueue 
        scans={[createMockScan()]} 
        onSync={() => {}} 
        isOnline={false} 
      />
    );
    
    expect(screen.getByText('Sync Now')).toBeDisabled();
    expect(screen.getByText(/You're offline/)).toBeInTheDocument();
  });

  /**
   * Validates Requirement 13.3: Sync status tracking
   */
  it('tracks sync status for each scan (Requirement 13.3)', () => {
    const scans = [
      createMockScan({ id: '1', syncStatus: 'pending' }),
      createMockScan({ id: '2', syncStatus: 'syncing' }),
      createMockScan({ id: '3', syncStatus: 'synced' }),
      createMockScan({ id: '4', syncStatus: 'failed', syncError: 'Error' }),
    ];
    render(<OfflineScanQueue scans={scans} />);
    
    expect(screen.getByText('1 pending')).toBeInTheDocument();
    expect(screen.getByText('1 syncing')).toBeInTheDocument();
    expect(screen.getByText('1 synced')).toBeInTheDocument();
    expect(screen.getByText('1 failed')).toBeInTheDocument();
  });
});
