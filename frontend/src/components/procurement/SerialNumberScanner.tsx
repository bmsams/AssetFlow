import { useState, useRef, useEffect, useCallback } from 'react';
import styles from '../../pages/admin/AdminPage.module.css';

/**
 * Scanned serial number entry
 */
export interface ScannedSerial {
  serialNumber: string;
  scannedAt: string;
  source: 'manual' | 'barcode';
}

/**
 * SerialNumberScanner Props
 */
export interface SerialNumberScannerProps {
  /** Maximum number of serial numbers allowed */
  maxCount?: number;
  /** Current count of serial numbers */
  currentCount?: number;
  /** Callback when serial numbers are added */
  onSerialsAdded: (serials: ScannedSerial[]) => void;
  /** List of already entered serial numbers */
  existingSerials?: string[];
  /** Whether the scanner is disabled */
  disabled?: boolean;
  /** Placeholder text for input */
  placeholder?: string;
  /** Auto-focus the input */
  autoFocus?: boolean;
}

/**
 * SerialNumberScanner Component
 * Implements Task 17.2.3: Create SerialNumberScanner.tsx for barcode scanning
 *
 * Requirements from spec (Requirement 13.2):
 * - Scan or enter serial numbers during receiving
 * - Support barcode scanner input (rapid keystroke detection)
 * - Support manual entry
 * - Validate for duplicates
 */
export function SerialNumberScanner({
  maxCount,
  currentCount = 0,
  onSerialsAdded,
  existingSerials = [],
  disabled = false,
  placeholder = 'Scan barcode or enter serial number...',
  autoFocus = true,
}: SerialNumberScannerProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [inputValue, setInputValue] = useState('');
  const [isBulkMode, setIsBulkMode] = useState(false);
  const [bulkInput, setBulkInput] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [lastKeyTime, setLastKeyTime] = useState(0);
  const [isBarcodeScan, setIsBarcodeScan] = useState(false);

  // Barcode scanner detection threshold (ms between keystrokes)
  const BARCODE_THRESHOLD = 50;

  /**
   * Detect if input is from barcode scanner based on keystroke timing
   */
  const detectBarcodeInput = useCallback((currentTime: number) => {
    const timeDiff = currentTime - lastKeyTime;
    setLastKeyTime(currentTime);

    // If keystrokes are very rapid, likely a barcode scanner
    if (timeDiff < BARCODE_THRESHOLD && timeDiff > 0) {
      setIsBarcodeScan(true);
    } else if (timeDiff > 200) {
      // Reset if there's a pause
      setIsBarcodeScan(false);
    }
  }, [lastKeyTime]);

  /**
   * Validate and add a single serial number
   */
  const addSerial = useCallback((serial: string, source: 'manual' | 'barcode' = 'manual') => {
    const trimmed = serial.trim();
    if (!trimmed) return false;

    // Check for duplicates in existing serials
    if (existingSerials.some((s) => s.toLowerCase() === trimmed.toLowerCase())) {
      setError(`Serial number "${trimmed}" already exists`);
      return false;
    }

    // Check max count
    if (maxCount !== undefined && currentCount >= maxCount) {
      setError(`Maximum of ${maxCount} serial numbers allowed`);
      return false;
    }

    setError(null);
    onSerialsAdded([{
      serialNumber: trimmed,
      scannedAt: new Date().toISOString(),
      source,
    }]);
    return true;
  }, [existingSerials, maxCount, currentCount, onSerialsAdded]);

  /**
   * Handle input change with barcode detection
   */
  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value;
    detectBarcodeInput(Date.now());
    setInputValue(value);
  };

  /**
   * Handle key down events
   */
  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      if (inputValue.trim()) {
        const source = isBarcodeScan ? 'barcode' : 'manual';
        if (addSerial(inputValue, source)) {
          setInputValue('');
          setIsBarcodeScan(false);
        }
      }
    }
  };

  /**
   * Handle add button click
   */
  const handleAddClick = () => {
    if (inputValue.trim()) {
      if (addSerial(inputValue, 'manual')) {
        setInputValue('');
      }
    }
  };

  /**
   * Handle bulk add
   */
  const handleBulkAdd = () => {
    const serials = bulkInput
      .split(/[\n,;]+/)
      .map((s) => s.trim())
      .filter((s) => s.length > 0);

    if (serials.length === 0) return;

    const newSerials: ScannedSerial[] = [];
    const duplicates: string[] = [];
    const existingSet = new Set(existingSerials.map((s) => s.toLowerCase()));

    for (const serial of serials) {
      if (existingSet.has(serial.toLowerCase())) {
        duplicates.push(serial);
      } else if (maxCount === undefined || currentCount + newSerials.length < maxCount) {
        existingSet.add(serial.toLowerCase());
        newSerials.push({
          serialNumber: serial,
          scannedAt: new Date().toISOString(),
          source: 'manual',
        });
      }
    }

    if (newSerials.length > 0) {
      onSerialsAdded(newSerials);
    }

    if (duplicates.length > 0) {
      setError(`Skipped ${duplicates.length} duplicate serial number(s)`);
    } else {
      setError(null);
    }

    setBulkInput('');
  };

  /**
   * Focus input on mount if autoFocus is true
   */
  useEffect(() => {
    if (autoFocus && inputRef.current && !disabled) {
      inputRef.current.focus();
    }
  }, [autoFocus, disabled]);

  const remainingCount = maxCount !== undefined ? maxCount - currentCount : undefined;
  const isAtLimit = maxCount !== undefined && currentCount >= maxCount;

  return (
    <div>
      {/* Mode Toggle */}
      <div style={{ display: 'flex', gap: 'var(--spacing-2)', marginBottom: 'var(--spacing-3)' }}>
        <button
          type="button"
          className={`${styles.secondaryButton} ${!isBulkMode ? styles.active : ''}`}
          onClick={() => setIsBulkMode(false)}
          disabled={disabled}
          style={{ padding: 'var(--spacing-1) var(--spacing-3)', fontSize: 'var(--font-size-sm)' }}
        >
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" style={{ width: '16px', height: '16px', marginRight: 'var(--spacing-1)' }}>
            <rect x="3" y="4" width="18" height="16" rx="2" />
            <line x1="7" y1="8" x2="17" y2="8" />
            <line x1="7" y1="12" x2="17" y2="12" />
            <line x1="7" y1="16" x2="13" y2="16" />
          </svg>
          Single Scan
        </button>
        <button
          type="button"
          className={`${styles.secondaryButton} ${isBulkMode ? styles.active : ''}`}
          onClick={() => setIsBulkMode(true)}
          disabled={disabled}
          style={{ padding: 'var(--spacing-1) var(--spacing-3)', fontSize: 'var(--font-size-sm)' }}
        >
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" style={{ width: '16px', height: '16px', marginRight: 'var(--spacing-1)' }}>
            <line x1="8" y1="6" x2="21" y2="6" />
            <line x1="8" y1="12" x2="21" y2="12" />
            <line x1="8" y1="18" x2="21" y2="18" />
            <line x1="3" y1="6" x2="3.01" y2="6" />
            <line x1="3" y1="12" x2="3.01" y2="12" />
            <line x1="3" y1="18" x2="3.01" y2="18" />
          </svg>
          Bulk Entry
        </button>
      </div>

      {/* Status indicator */}
      {remainingCount !== undefined && (
        <div style={{ 
          marginBottom: 'var(--spacing-2)', 
          fontSize: 'var(--font-size-sm)',
          color: isAtLimit ? 'var(--color-error-500)' : 'var(--color-text-secondary)',
        }}>
          {isAtLimit ? (
            <span>Maximum limit reached ({maxCount} items)</span>
          ) : (
            <span>{remainingCount} more item(s) can be added</span>
          )}
        </div>
      )}

      {/* Barcode scan indicator */}
      {isBarcodeScan && !isBulkMode && (
        <div style={{
          display: 'flex',
          alignItems: 'center',
          gap: 'var(--spacing-2)',
          marginBottom: 'var(--spacing-2)',
          padding: 'var(--spacing-2)',
          backgroundColor: 'var(--color-success-50)',
          borderRadius: 'var(--radius-md)',
          fontSize: 'var(--font-size-sm)',
          color: 'var(--color-success-700)',
        }}>
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" style={{ width: '16px', height: '16px' }}>
            <rect x="3" y="3" width="18" height="18" rx="2" />
            <line x1="7" y1="7" x2="7" y2="17" />
            <line x1="10" y1="7" x2="10" y2="17" />
            <line x1="13" y1="7" x2="13" y2="17" />
            <line x1="17" y1="7" x2="17" y2="17" />
          </svg>
          Barcode scanner detected
        </div>
      )}

      {/* Error message */}
      {error && (
        <div style={{
          display: 'flex',
          alignItems: 'center',
          gap: 'var(--spacing-2)',
          marginBottom: 'var(--spacing-2)',
          padding: 'var(--spacing-2)',
          backgroundColor: 'var(--color-error-50)',
          borderRadius: 'var(--radius-md)',
          fontSize: 'var(--font-size-sm)',
          color: 'var(--color-error-700)',
        }}>
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" style={{ width: '16px', height: '16px' }}>
            <circle cx="12" cy="12" r="10" />
            <line x1="12" y1="8" x2="12" y2="12" />
            <line x1="12" y1="16" x2="12.01" y2="16" />
          </svg>
          {error}
        </div>
      )}

      {/* Single scan mode */}
      {!isBulkMode && (
        <div style={{ display: 'flex', gap: 'var(--spacing-2)' }}>
          <input
            ref={inputRef}
            type="text"
            className={styles.formInput}
            placeholder={placeholder}
            value={inputValue}
            onChange={handleInputChange}
            onKeyDown={handleKeyDown}
            disabled={disabled || isAtLimit}
            style={{ flex: 1 }}
          />
          <button
            type="button"
            className={styles.primaryButton}
            onClick={handleAddClick}
            disabled={disabled || !inputValue.trim() || isAtLimit}
          >
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" style={{ width: '16px', height: '16px', marginRight: 'var(--spacing-1)' }}>
              <line x1="12" y1="5" x2="12" y2="19" />
              <line x1="5" y1="12" x2="19" y2="12" />
            </svg>
            Add
          </button>
        </div>
      )}

      {/* Bulk entry mode */}
      {isBulkMode && (
        <div>
          <textarea
            className={styles.formTextarea}
            placeholder="Enter multiple serial numbers (one per line, or separated by commas)..."
            value={bulkInput}
            onChange={(e) => setBulkInput(e.target.value)}
            disabled={disabled || isAtLimit}
            rows={5}
          />
          <button
            type="button"
            className={styles.primaryButton}
            onClick={handleBulkAdd}
            disabled={disabled || !bulkInput.trim() || isAtLimit}
            style={{ marginTop: 'var(--spacing-2)' }}
          >
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" style={{ width: '16px', height: '16px', marginRight: 'var(--spacing-1)' }}>
              <line x1="12" y1="5" x2="12" y2="19" />
              <line x1="5" y1="12" x2="19" y2="12" />
            </svg>
            Add All
          </button>
        </div>
      )}

      {/* Help text */}
      <p style={{ 
        fontSize: 'var(--font-size-xs)', 
        color: 'var(--color-text-secondary)', 
        marginTop: 'var(--spacing-2)',
      }}>
        {isBulkMode 
          ? 'Enter multiple serial numbers separated by new lines, commas, or semicolons'
          : 'Scan a barcode or type a serial number and press Enter'}
      </p>
    </div>
  );
}

export default SerialNumberScanner;
