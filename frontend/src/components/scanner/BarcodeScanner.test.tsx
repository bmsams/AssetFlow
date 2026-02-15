import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { BarcodeScanner } from './BarcodeScanner';
import type { ScanResult } from '../../types/scanner';

// Mock navigator.mediaDevices
const mockGetUserMedia = vi.fn();
const mockVibrate = vi.fn();

beforeEach(() => {
  // Setup navigator mocks
  Object.defineProperty(navigator, 'mediaDevices', {
    value: {
      getUserMedia: mockGetUserMedia,
    },
    writable: true,
    configurable: true,
  });

  Object.defineProperty(navigator, 'vibrate', {
    value: mockVibrate,
    writable: true,
    configurable: true,
  });
});

afterEach(() => {
  vi.clearAllMocks();
});

describe('BarcodeScanner', () => {
  it('renders scanner container', () => {
    render(<BarcodeScanner onScan={() => {}} mockMode />);
    expect(screen.getByRole('region', { name: 'Barcode scanner' })).toBeInTheDocument();
  });

  it('displays status message', () => {
    render(<BarcodeScanner onScan={() => {}} mockMode />);
    expect(screen.getByRole('status')).toBeInTheDocument();
  });

  it('shows mock mode indicator when mockMode is true', () => {
    render(<BarcodeScanner onScan={() => {}} mockMode />);
    expect(screen.getByText('Mock Scanner Mode')).toBeInTheDocument();
    expect(screen.getByText('Camera disabled for testing')).toBeInTheDocument();
  });

  it('shows simulate scan button in mock mode', () => {
    render(<BarcodeScanner onScan={() => {}} mockMode />);
    expect(screen.getByTestId('mock-scan-button')).toBeInTheDocument();
  });

  it('calls onScan when simulate scan button is clicked', async () => {
    const handleScan = vi.fn();
    render(<BarcodeScanner onScan={handleScan} mockMode />);
    
    fireEvent.click(screen.getByTestId('mock-scan-button'));
    
    await waitFor(() => {
      expect(handleScan).toHaveBeenCalled();
    });
  });

  it('includes barcode value in scan result', async () => {
    const handleScan = vi.fn();
    render(<BarcodeScanner onScan={handleScan} mockMode />);
    
    fireEvent.click(screen.getByTestId('mock-scan-button'));
    
    await waitFor(() => {
      expect(handleScan).toHaveBeenCalledWith(
        expect.objectContaining({
          barcodeValue: 'AMS-HW-20250101-ABC123',
          barcodeFormat: 'QR_CODE',
        })
      );
    });
  });

  it('includes scan timestamp in result', async () => {
    const handleScan = vi.fn();
    render(<BarcodeScanner onScan={handleScan} mockMode />);
    
    fireEvent.click(screen.getByTestId('mock-scan-button'));
    
    await waitFor(() => {
      const result = handleScan.mock.calls[0][0] as ScanResult;
      expect(result.scannedAt).toBeDefined();
      expect(new Date(result.scannedAt).getTime()).toBeLessThanOrEqual(Date.now());
    });
  });

  it('generates unique scan ID for each scan', async () => {
    const handleScan = vi.fn();
    render(<BarcodeScanner onScan={handleScan} mockMode />);
    
    fireEvent.click(screen.getByTestId('mock-scan-button'));
    
    await waitFor(() => {
      const result = handleScan.mock.calls[0][0] as ScanResult;
      expect(result.scanId).toBeDefined();
      expect(result.scanId).toMatch(/^scan-/);
    });
  });

  it('marks scan as offline when isOffline is true', async () => {
    const handleScan = vi.fn();
    render(<BarcodeScanner onScan={handleScan} mockMode isOffline />);
    
    fireEvent.click(screen.getByTestId('mock-scan-button'));
    
    await waitFor(() => {
      const result = handleScan.mock.calls[0][0] as ScanResult;
      expect(result.isOffline).toBe(true);
    });
  });

  it('shows offline badge when isOffline is true', () => {
    render(<BarcodeScanner onScan={() => {}} mockMode isOffline />);
    expect(screen.getByText('Offline')).toBeInTheDocument();
  });

  it('applies custom className', () => {
    render(<BarcodeScanner onScan={() => {}} mockMode className="custom-class" />);
    const container = screen.getByRole('region', { name: 'Barcode scanner' });
    expect(container).toHaveClass('custom-class');
  });

  it('does not render video element in mock mode', () => {
    render(<BarcodeScanner onScan={() => {}} mockMode />);
    expect(screen.queryByRole('video')).not.toBeInTheDocument();
  });

  it('triggers haptic feedback on scan when supported', async () => {
    const handleScan = vi.fn();
    render(<BarcodeScanner onScan={handleScan} mockMode />);
    
    fireEvent.click(screen.getByTestId('mock-scan-button'));
    
    await waitFor(() => {
      expect(mockVibrate).toHaveBeenCalledWith(100);
    });
  });

  it('does not crash when vibration is not supported', async () => {
    Object.defineProperty(navigator, 'vibrate', {
      value: undefined,
      writable: true,
      configurable: true,
    });

    const handleScan = vi.fn();
    render(<BarcodeScanner onScan={handleScan} mockMode />);
    
    fireEvent.click(screen.getByTestId('mock-scan-button'));
    
    await waitFor(() => {
      expect(handleScan).toHaveBeenCalled();
    });
  });
});

describe('BarcodeScanner - Camera Initialization', () => {
  it('requests camera permission when not in mock mode', async () => {
    const mockStream = {
      getTracks: () => [{ stop: vi.fn() }],
    };
    mockGetUserMedia.mockResolvedValue(mockStream);

    render(<BarcodeScanner onScan={() => {}} isActive />);

    await waitFor(() => {
      expect(mockGetUserMedia).toHaveBeenCalledWith(
        expect.objectContaining({
          video: expect.objectContaining({
            facingMode: 'environment',
          }),
        })
      );
    });
  });

  it('calls onError when camera permission is denied', async () => {
    const permissionError = new Error('Permission denied');
    permissionError.name = 'NotAllowedError';
    mockGetUserMedia.mockRejectedValue(permissionError);

    const handleError = vi.fn();
    render(<BarcodeScanner onScan={() => {}} onError={handleError} isActive />);

    await waitFor(() => {
      expect(handleError).toHaveBeenCalledWith('PERMISSION_DENIED', 'Camera permission denied');
    });
  });

  it('shows retry button when permission is denied', async () => {
    const permissionError = new Error('Permission denied');
    permissionError.name = 'NotAllowedError';
    mockGetUserMedia.mockRejectedValue(permissionError);

    render(<BarcodeScanner onScan={() => {}} isActive />);

    await waitFor(() => {
      expect(screen.getByText('Retry Camera Access')).toBeInTheDocument();
    });
  });

  it('calls onError when camera is not found', async () => {
    const notFoundError = new Error('No camera');
    notFoundError.name = 'NotFoundError';
    mockGetUserMedia.mockRejectedValue(notFoundError);

    const handleError = vi.fn();
    render(<BarcodeScanner onScan={() => {}} onError={handleError} isActive />);

    await waitFor(() => {
      expect(handleError).toHaveBeenCalledWith('CAMERA_NOT_FOUND', 'No camera found');
    });
  });

  it('handles missing mediaDevices API', async () => {
    Object.defineProperty(navigator, 'mediaDevices', {
      value: undefined,
      writable: true,
      configurable: true,
    });

    const handleError = vi.fn();
    render(<BarcodeScanner onScan={() => {}} onError={handleError} isActive />);

    await waitFor(() => {
      expect(handleError).toHaveBeenCalledWith(
        'CAMERA_NOT_FOUND',
        'Camera not available on this device'
      );
    });
  });
});

describe('BarcodeScanner - Requirements Validation', () => {
  /**
   * Validates Requirement 13.1: Mobile interface shall support barcode/QR code scanning
   */
  it('supports barcode scanning for asset lookup (Requirement 13.1)', async () => {
    const handleScan = vi.fn();
    render(<BarcodeScanner onScan={handleScan} mockMode />);
    
    // Verify scanner is rendered and functional
    expect(screen.getByRole('region', { name: 'Barcode scanner' })).toBeInTheDocument();
    
    // Trigger a scan
    fireEvent.click(screen.getByTestId('mock-scan-button'));
    
    await waitFor(() => {
      expect(handleScan).toHaveBeenCalledWith(
        expect.objectContaining({
          barcodeValue: expect.any(String),
          barcodeFormat: expect.any(String),
        })
      );
    });
  });

  /**
   * Validates Requirement 13.2: Display asset details after scanning
   */
  it('returns asset details in scan result when found (Requirement 13.2)', async () => {
    const handleScan = vi.fn();
    render(<BarcodeScanner onScan={handleScan} mockMode />);
    
    fireEvent.click(screen.getByTestId('mock-scan-button'));
    
    await waitFor(() => {
      const result = handleScan.mock.calls[0][0] as ScanResult;
      // Asset should be included when found
      expect(result.asset).toBeDefined();
      expect(result.asset?.assetTag).toBe('AMS-HW-20250101-ABC123');
      expect(result.asset?.displayName).toBeDefined();
    });
  });

  /**
   * Validates Requirement 13.3: Offline scanning with sync
   */
  it('supports offline scanning mode (Requirement 13.3)', async () => {
    const handleScan = vi.fn();
    render(<BarcodeScanner onScan={handleScan} mockMode isOffline />);
    
    // Verify offline indicator is shown
    expect(screen.getByText('Offline')).toBeInTheDocument();
    
    // Trigger scan in offline mode
    fireEvent.click(screen.getByTestId('mock-scan-button'));
    
    await waitFor(() => {
      const result = handleScan.mock.calls[0][0] as ScanResult;
      expect(result.isOffline).toBe(true);
    });
  });
});
