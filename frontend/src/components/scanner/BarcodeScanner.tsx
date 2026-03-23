import { useState, useCallback, useRef, useEffect } from 'react';
import type { 
  ScannerStatus, 
  ScanResult, 
  ScannerConfig, 
  BarcodeFormat,
  CameraPermission,
  ScannerError 
} from '../../types/scanner';
import { DEFAULT_SCANNER_CONFIG } from '../../types/scanner';
import { generateScanId, mockLookupAsset } from './mockData';
import styles from './BarcodeScanner.module.css';

export interface BarcodeScannerProps {
  /** Callback when a barcode is successfully scanned */
  onScan: (result: ScanResult) => void;
  /** Callback when an error occurs */
  onError?: (error: ScannerError, message: string) => void;
  /** Scanner configuration */
  config?: Partial<ScannerConfig>;
  /** Whether the scanner is currently active */
  isActive?: boolean;
  /** Whether the device is offline */
  isOffline?: boolean;
  /** Custom class name */
  className?: string;
  /** Mock mode for testing (bypasses camera) */
  mockMode?: boolean;
  /** Mock barcode value for testing */
  mockBarcodeValue?: string;
}

/**
 * BarcodeScanner component for camera-based barcode/QR scanning
 * Implements Requirement 13.1: Mobile interface shall support barcode/QR code scanning
 */
export function BarcodeScanner({
  onScan,
  onError,
  config: configOverrides,
  isActive = true,
  isOffline = false,
  className,
  mockMode = false,
  mockBarcodeValue,
}: BarcodeScannerProps) {
  const [status, setStatus] = useState<ScannerStatus>('idle');
  const [_permission, setPermission] = useState<CameraPermission>('prompt');
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const scanIntervalRef = useRef<number | null>(null);

  const config: ScannerConfig = {
    ...DEFAULT_SCANNER_CONFIG,
    ...configOverrides,
  };

  /**
   * Request camera permission and initialize video stream
   */
  const initializeCamera = useCallback(async () => {
    if (mockMode) {
      setStatus('scanning');
      setPermission('granted');
      return;
    }

    setStatus('initializing');
    setErrorMessage(null);

    try {
      // Check if camera API is available
      if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
        setPermission('unavailable');
        setStatus('error');
        setErrorMessage('Camera not available on this device');
        onError?.('CAMERA_NOT_FOUND', 'Camera not available on this device');
        return;
      }

      // Request camera access
      const stream = await navigator.mediaDevices.getUserMedia({
        video: {
          facingMode: config.facingMode,
          width: { ideal: 1280 },
          height: { ideal: 720 },
        },
      });

      streamRef.current = stream;
      setPermission('granted');

      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        await videoRef.current.play();
      }

      setStatus('scanning');
    } catch (error) {
      const err = error as Error;
      if (err.name === 'NotAllowedError' || err.name === 'PermissionDeniedError') {
        setPermission('denied');
        setStatus('permission_denied');
        setErrorMessage('Camera permission denied. Please allow camera access to scan barcodes.');
        onError?.('PERMISSION_DENIED', 'Camera permission denied');
      } else if (err.name === 'NotFoundError') {
        setPermission('unavailable');
        setStatus('error');
        setErrorMessage('No camera found on this device');
        onError?.('CAMERA_NOT_FOUND', 'No camera found');
      } else {
        setStatus('error');
        setErrorMessage('Failed to initialize camera');
        onError?.('INITIALIZATION_FAILED', err.message);
      }
    }
  }, [config.facingMode, mockMode, onError]);

  /**
   * Stop camera stream and cleanup
   */
  const stopCamera = useCallback(() => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((track) => track.stop());
      streamRef.current = null;
    }
    if (scanIntervalRef.current) {
      clearInterval(scanIntervalRef.current);
      scanIntervalRef.current = null;
    }
    setStatus('idle');
  }, []);

  /**
   * Process a detected barcode
   */
  const processBarcode = useCallback(
    async (barcodeValue: string, barcodeFormat: BarcodeFormat) => {
      setStatus('processing');

      // Provide haptic feedback if supported
      if (config.vibrationEnabled && navigator.vibrate) {
        navigator.vibrate(100);
      }

      const scanId = generateScanId();
      const scannedAt = new Date().toISOString();

      try {
        // Look up asset (will be null if offline or not found)
        const asset = isOffline ? undefined : await mockLookupAsset(barcodeValue);

        const result: ScanResult = {
          scanId,
          barcodeValue,
          barcodeFormat,
          scannedAt,
          isOffline,
        };
        
        if (asset) {
          result.asset = asset;
        }
        if (!asset && !isOffline) {
          result.error = 'Asset not found';
        }

        onScan(result);
        setStatus('scanning');
      } catch (error) {
        const err = error as Error;
        const result: ScanResult = {
          scanId,
          barcodeValue,
          barcodeFormat,
          scannedAt,
          isOffline,
          error: err.message,
        };
        onScan(result);
        setStatus('scanning');
      }
    },
    [config.vibrationEnabled, isOffline, onScan]
  );

  /**
   * Handle mock scan for testing
   */
  const handleMockScan = useCallback(() => {
    if (mockMode && mockBarcodeValue) {
      void processBarcode(mockBarcodeValue, 'QR_CODE');
    }
  }, [mockMode, mockBarcodeValue, processBarcode]);

  /**
   * Manual scan trigger (for mock mode or manual input)
   */
  const triggerScan = useCallback(
    (barcodeValue: string, barcodeFormat: BarcodeFormat = 'QR_CODE') => {
      void processBarcode(barcodeValue, barcodeFormat);
    },
    [processBarcode]
  );

  // Initialize camera when active
  useEffect(() => {
    if (isActive) {
      void initializeCamera();
    } else {
      stopCamera();
    }

    return () => {
      stopCamera();
    };
  }, [isActive, initializeCamera, stopCamera]);

  // Handle mock mode scanning
  useEffect(() => {
    if (mockMode && mockBarcodeValue && status === 'scanning') {
      handleMockScan();
    }
  }, [mockMode, mockBarcodeValue, status, handleMockScan]);

  const getStatusMessage = () => {
    switch (status) {
      case 'initializing':
        return 'Initializing camera...';
      case 'scanning':
        return isOffline ? 'Scanning (Offline Mode)' : 'Point camera at barcode';
      case 'processing':
        return 'Processing scan...';
      case 'permission_denied':
        return 'Camera access denied';
      case 'error':
        return errorMessage || 'Scanner error';
      default:
        return 'Scanner ready';
    }
  };

  const getStatusIcon = () => {
    switch (status) {
      case 'initializing':
      case 'processing':
        return (
          <svg className={styles.spinnerIcon} viewBox="0 0 24 24" aria-hidden="true">
            <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="3" fill="none" strokeDasharray="31.4 31.4" />
          </svg>
        );
      case 'scanning':
        return (
          <svg className={styles.scanIcon} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
            <rect x="3" y="3" width="18" height="18" rx="2" />
            <line x1="7" y1="12" x2="17" y2="12" />
          </svg>
        );
      case 'permission_denied':
      case 'error':
        return (
          <svg className={styles.errorIcon} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
            <circle cx="12" cy="12" r="10" />
            <line x1="12" y1="8" x2="12" y2="12" />
            <line x1="12" y1="16" x2="12.01" y2="16" />
          </svg>
        );
      default:
        return null;
    }
  };

  return (
    <div 
      className={`${styles.scannerContainer} ${className || ''}`}
      role="region"
      aria-label="Barcode scanner"
    >
      {/* Video Preview */}
      <div className={styles.videoWrapper}>
        {!mockMode && (
          <video
            ref={videoRef}
            className={styles.video}
            playsInline
            muted
            aria-hidden="true"
          />
        )}
        
        {/* Scanning Overlay */}
        <div className={styles.scanOverlay}>
          <div className={styles.scanFrame}>
            <div className={`${styles.scanCorner} ${styles.topLeft}`} />
            <div className={`${styles.scanCorner} ${styles.topRight}`} />
            <div className={`${styles.scanCorner} ${styles.bottomLeft}`} />
            <div className={`${styles.scanCorner} ${styles.bottomRight}`} />
            {status === 'scanning' && <div className={styles.scanLine} />}
          </div>
        </div>

        {/* Mock Mode Indicator */}
        {mockMode && (
          <div className={styles.mockModeOverlay}>
            <p>Mock Scanner Mode</p>
            <p className={styles.mockModeHint}>Camera disabled for testing</p>
          </div>
        )}
      </div>

      {/* Status Bar */}
      <div 
        className={`${styles.statusBar} ${status === 'error' || status === 'permission_denied' ? styles.statusError : ''}`}
        role="status"
        aria-live="polite"
      >
        {getStatusIcon()}
        <span className={styles.statusText}>{getStatusMessage()}</span>
        {isOffline && status === 'scanning' && (
          <span className={styles.offlineBadge}>Offline</span>
        )}
      </div>

      {/* Controls */}
      <div className={styles.controls}>
        {status === 'permission_denied' && (
          <button
            type="button"
            className={styles.retryButton}
            onClick={initializeCamera}
          >
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
              <path d="M23 4v6h-6" />
              <path d="M1 20v-6h6" />
              <path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15" />
            </svg>
            Retry Camera Access
          </button>
        )}

        {mockMode && (
          <button
            type="button"
            className={styles.mockScanButton}
            onClick={() => triggerScan('AMS-HW-20250101-ABC123', 'QR_CODE')}
            data-testid="mock-scan-button"
          >
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
              <rect x="3" y="3" width="18" height="18" rx="2" />
              <line x1="7" y1="12" x2="17" y2="12" />
            </svg>
            Simulate Scan
          </button>
        )}
      </div>
    </div>
  );
}

export default BarcodeScanner;
