import { useState, useEffect, useCallback } from 'react';
import { useNavigate, useParams, useSearchParams, Link } from 'react-router-dom';
import { Form } from '@ams/ui';
import { procurementApi } from '../../services/procurement-api';
import { receivingApi } from '../../services/receiving-api';
import type { ReceivingRecordResponse, ReceivingLine, ScanAssetResponse } from '../../services/receiving-api';
import type { ReceivingItem, ReceivingStatus } from '../../types/procurement';
import { getReceivingStatusColor } from '../../types/procurement';
import { formatDate, formatStatus } from '../../utils/formatters';
import styles from '../admin/AdminPage.module.css';

/**
 * Map API receiving status to frontend receiving status
 */
function mapReceivingStatus(apiStatus: string): ReceivingStatus {
  switch (apiStatus) {
    case 'PENDING':
      return 'PENDING';
    case 'IN_PROGRESS':
      return 'IN_PROGRESS';
    case 'COMPLETED':
      return 'COMPLETED';
    case 'CANCELLED':
      return 'CANCELLED';
    default:
      return 'PENDING';
  }
}

/**
 * Serial number entry for a line item
 */
interface SerialNumberEntry {
  serialNumber: string;
  assetId?: string;
  addedAt: string;
}

/**
 * Line item state for receiving
 */
interface ReceivingLineState {
  lineId: string;
  receivingLineId: string;
  productDescription: string;
  expectedQuantity: number;
  receivedQuantity: number;
  pendingQuantity: number;
  serialNumbers: SerialNumberEntry[];
  inspectionRequired: boolean;
  notes: string;
}

/**
 * ReceivingForm Component
 * Implements Task 17.2.2: Create ReceivingForm.tsx for receiving workflow
 * Updated by Task 22.3: Update ReceivingForm to Use Real API
 *
 * Requirements from spec (Requirement 13, 21):
 * - Create receiving record from purchase order
 * - Enter serial numbers during receiving via API
 * - Record partial receiving
 * - Mark items for quality inspection
 */
export function ReceivingForm() {
  const navigate = useNavigate();
  const { receivingId: receivingIdParam } = useParams<{ receivingId: string }>();
  const [searchParams] = useSearchParams();
  const poIdParam = searchParams.get('poId');

  // Loading states
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [isScanning, setIsScanning] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Receiving data
  const [receivingId, setReceivingId] = useState<string | null>(receivingIdParam || null);
  const [receivingItem, setReceivingItem] = useState<ReceivingItem | null>(null);
  const [lineStates, setLineStates] = useState<ReceivingLineState[]>([]);

  // Current input states
  const [activeLineId, setActiveLineId] = useState<string | null>(null);
  const [serialInput, setSerialInput] = useState('');
  const [bulkSerialInput, setBulkSerialInput] = useState('');
  const [isBulkMode, setIsBulkMode] = useState(false);

  /**
   * Create receiving record from PO
   */
  const createReceivingFromPO = useCallback(async (poId: string): Promise<ReceivingRecordResponse | null> => {
    try {
      const response = await receivingApi.createFromPO({ poId });
      setReceivingId(response.receivingRecord.receivingId);
      return response;
    } catch (err) {
      console.error('Failed to create receiving from PO:', err);
      return null;
    }
  }, []);

  /**
   * Load receiving record data
   */
  const loadReceivingRecord = useCallback(async (id: string): Promise<ReceivingRecordResponse | null> => {
    try {
      return await receivingApi.get(id);
    } catch (err) {
      console.error('Failed to load receiving record:', err);
      return null;
    }
  }, []);

  /**
   * Initialize line states from receiving response
   */
  const initializeLineStates = useCallback((response: ReceivingRecordResponse) => {
    const states = response.lines.map((line: ReceivingLine) => ({
      lineId: line.receivingLineId,
      receivingLineId: line.receivingLineId,
      productDescription: line.productDescription,
      expectedQuantity: line.expectedQuantity,
      receivedQuantity: line.receivedQuantity,
      pendingQuantity: line.pendingQuantity,
      serialNumbers: [],
      inspectionRequired: line.inspectionRequired,
      notes: line.notes || '',
    }));
    setLineStates(states);
  }, []);

  /**
   * Load receiving item data
   */
  const loadReceivingItem = useCallback(async () => {
    try {
      setIsLoading(true);
      setError(null);

      // If we have a receivingId, load the existing receiving record
      if (receivingIdParam) {
        const response = await loadReceivingRecord(receivingIdParam);
        if (response) {
          const record = response.receivingRecord;
          setReceivingItem({
            receivingId: record.receivingId,
            poNumber: record.poNumber ?? 'Unknown PO',
            poId: record.poId ?? '',
            vendorName: record.vendorName ?? 'Unknown Vendor',
            itemDescription: response.lines.length > 0 ? response.lines[0].productDescription : 'Multiple Items',
            expectedQuantity: response.lines.reduce((sum, line) => sum + line.expectedQuantity, 0),
            receivedQuantity: response.lines.reduce((sum, line) => sum + line.receivedQuantity, 0),
            status: mapReceivingStatus(record.status),
            expectedDate: record.createdAt,
            stockroomName: record.stockroomName || 'Main Stockroom',
            stockroomId: record.stockroomId || '',
          });
          initializeLineStates(response);
          return;
        }
      }

      // If we have a poId, create a new receiving record from the PO
      if (poIdParam) {
        // First try to create receiving record via API
        const receivingResponse = await createReceivingFromPO(poIdParam);
        
        if (receivingResponse) {
          const record = receivingResponse.receivingRecord;
          setReceivingItem({
            receivingId: record.receivingId,
            poNumber: record.poNumber ?? 'Unknown PO',
            poId: record.poId ?? '',
            vendorName: record.vendorName ?? 'Unknown Vendor',
            itemDescription: receivingResponse.lines.length > 0 ? receivingResponse.lines[0].productDescription : 'Multiple Items',
            expectedQuantity: receivingResponse.lines.reduce((sum, line) => sum + line.expectedQuantity, 0),
            receivedQuantity: receivingResponse.lines.reduce((sum, line) => sum + line.receivedQuantity, 0),
            status: mapReceivingStatus(record.status),
            expectedDate: record.createdAt,
            stockroomName: record.stockroomName || 'Main Stockroom',
            stockroomId: record.stockroomId || '',
          });
          initializeLineStates(receivingResponse);
          return;
        }

        // Fallback: Load PO details and create mock receiving item for display
        try {
          const po = await procurementApi.purchaseOrders.get(poIdParam);
          
          const mockItem: ReceivingItem = {
            receivingId: `recv-${poIdParam}`,
            poNumber: po.poNumber,
            poId: po.poId,
            vendorName: po.vendorName,
            itemDescription: po.lines.length > 0 ? po.lines[0].productDescription : 'Multiple Items',
            expectedQuantity: po.lines.reduce((sum, line) => sum + line.quantity, 0),
            receivedQuantity: po.lines.reduce((sum, line) => sum + line.quantityReceived, 0),
            status: 'PENDING',
            expectedDate: po.expectedDeliveryDate || new Date().toISOString(),
            stockroomName: 'Main Stockroom',
            stockroomId: 'sr-001',
          };

          setReceivingItem(mockItem);

          const lineStates = po.lines.map((line) => ({
            lineId: line.lineId,
            receivingLineId: line.lineId, // Use lineId as fallback
            productDescription: line.productDescription,
            expectedQuantity: line.quantity,
            receivedQuantity: line.quantityReceived,
            pendingQuantity: line.quantity - line.quantityReceived,
            serialNumbers: [],
            inspectionRequired: false,
            notes: '',
          }));

          setLineStates(lineStates);
        } catch (err) {
          console.error('Failed to load PO:', err);
          setError('Failed to load purchase order details');
        }
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load receiving item');
    } finally {
      setIsLoading(false);
    }
  }, [receivingIdParam, poIdParam, loadReceivingRecord, createReceivingFromPO, initializeLineStates]);

  useEffect(() => {
    void loadReceivingItem();
  }, [loadReceivingItem]);

  /**
   * Scan serial number via API
   */
  const scanSerialNumber = useCallback(async (lineId: string, serial: string): Promise<ScanAssetResponse | null> => {
    const trimmed = serial.trim();
    if (!trimmed || !receivingId) return null;

    const line = lineStates.find(l => l.lineId === lineId);
    if (!line) return null;

    try {
      setIsScanning(true);
      setError(null);

      const response = await receivingApi.scanAsset(receivingId, {
        receivingLineId: line.receivingLineId,
        serialNumber: trimmed,
        condition: 'NEW',
      });

      // Update line state with the scanned asset
      setLineStates((prev) =>
        prev.map((l) => {
          if (l.lineId !== lineId) return l;
          return {
            ...l,
            serialNumbers: [
              ...l.serialNumbers,
              {
                serialNumber: trimmed,
                assetId: response.asset.assetId,
                addedAt: new Date().toISOString(),
              },
            ],
            receivedQuantity: response.receivingLine.receivedQuantity,
            pendingQuantity: response.receivingLine.pendingQuantity,
          };
        })
      );

      return response;
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to scan asset';
      setError(message);
      return null;
    } finally {
      setIsScanning(false);
    }
  }, [receivingId, lineStates]);

  /**
   * Add serial number to a line (local only, for fallback mode)
   */
  const addSerialNumberLocal = useCallback((lineId: string, serial: string) => {
    const trimmed = serial.trim();
    if (!trimmed) return;

    setLineStates((prev) =>
      prev.map((line) => {
        if (line.lineId !== lineId) return line;

        // Check for duplicates
        if (line.serialNumbers.some((s) => s.serialNumber.toLowerCase() === trimmed.toLowerCase())) {
          setError(`Serial number "${trimmed}" already added`);
          return line;
        }

        // Check quantity limit
        if (line.serialNumbers.length >= line.pendingQuantity) {
          setError(`Cannot add more serial numbers than pending quantity (${line.pendingQuantity})`);
          return line;
        }

        setError(null);
        return {
          ...line,
          serialNumbers: [
            ...line.serialNumbers,
            { serialNumber: trimmed, addedAt: new Date().toISOString() },
          ],
        };
      })
    );
  }, []);

  /**
   * Add serial number - uses API if available, falls back to local
   */
  const addSerialNumber = useCallback(async (lineId: string, serial: string) => {
    if (receivingId) {
      await scanSerialNumber(lineId, serial);
    } else {
      addSerialNumberLocal(lineId, serial);
    }
  }, [receivingId, scanSerialNumber, addSerialNumberLocal]);

  /**
   * Add bulk serial numbers
   */
  const addBulkSerialNumbers = useCallback(async (lineId: string, bulkInput: string) => {
    const serials = bulkInput
      .split(/[\n,;]+/)
      .map((s) => s.trim())
      .filter((s) => s.length > 0);

    for (const serial of serials) {
      await addSerialNumber(lineId, serial);
    }
  }, [addSerialNumber]);

  /**
   * Remove serial number from a line
   */
  const removeSerialNumber = useCallback((lineId: string, serialToRemove: string) => {
    setLineStates((prev) =>
      prev.map((line) => {
        if (line.lineId !== lineId) return line;
        return {
          ...line,
          serialNumbers: line.serialNumbers.filter((s) => s.serialNumber !== serialToRemove),
        };
      })
    );
    setError(null);
  }, []);

  /**
   * Clear all serial numbers for a line
   */
  const clearSerialNumbers = useCallback((lineId: string) => {
    setLineStates((prev) =>
      prev.map((line) => {
        if (line.lineId !== lineId) return line;
        return { ...line, serialNumbers: [] };
      })
    );
    setError(null);
  }, []);

  /**
   * Toggle inspection required for a line
   */
  const toggleInspection = useCallback(async (lineId: string) => {
    const line = lineStates.find(l => l.lineId === lineId);
    if (!line) return;

    // If marking for inspection and we have a receiving ID, call the API
    if (!line.inspectionRequired && receivingId) {
      try {
        await receivingApi.inspection.markForInspection({
          receivingLineId: line.receivingLineId,
          notes: 'Marked for quality inspection',
        });
      } catch (err) {
        console.error('Failed to mark for inspection:', err);
        // Continue with local state update even if API fails
      }
    }

    setLineStates((prev) =>
      prev.map((l) => {
        if (l.lineId !== lineId) return l;
        return { ...l, inspectionRequired: !l.inspectionRequired };
      })
    );
  }, [lineStates, receivingId]);

  /**
   * Update notes for a line
   */
  const updateNotes = useCallback((lineId: string, notes: string) => {
    setLineStates((prev) =>
      prev.map((line) => {
        if (line.lineId !== lineId) return line;
        return { ...line, notes };
      })
    );
  }, []);

  /**
   * Handle serial input key down
   */
  const handleSerialKeyDown = async (e: React.KeyboardEvent<HTMLInputElement>, lineId: string) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      await addSerialNumber(lineId, serialInput);
      setSerialInput('');
    }
  };

  /**
   * Submit receiving
   */
  const handleSubmit = async () => {
    if (isSaving) return;

    // Validate at least one serial number entered
    const hasSerials = lineStates.some((line) => line.serialNumbers.length > 0);
    if (!hasSerials) {
      setError('Please enter at least one serial number');
      return;
    }

    try {
      setIsSaving(true);
      setError(null);

      // If we have a receiving ID, complete via API
      if (receivingId) {
        await receivingApi.complete(receivingId, {
          notes: 'Receiving completed via web interface',
        });
      }

      navigate('/procurement/receiving');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to complete receiving');
    } finally {
      setIsSaving(false);
    }
  };

  /**
   * Cancel receiving
   */
  const handleCancel = async () => {
    if (receivingId) {
      try {
        await receivingApi.cancel(receivingId, {
          reason: 'Cancelled by user',
        });
      } catch (err) {
        console.error('Failed to cancel receiving:', err);
      }
    }
    navigate('/procurement/receiving');
  };

  /**
   * Get total serial numbers entered
   */
  const getTotalSerialsEntered = () => {
    return lineStates.reduce((sum, line) => sum + line.serialNumbers.length, 0);
  };

  /**
   * Get total pending quantity
   */
  const getTotalPending = () => {
    return lineStates.reduce((sum, line) => sum + line.pendingQuantity, 0);
  };

  if (isLoading) {
    return (
      <div className={styles.adminPage}>
        <div className={styles.formContainer}>
          <div className={styles.skeleton} style={{ height: '600px' }} />
        </div>
      </div>
    );
  }

  // If no receivingId or poId, show a list of POs available for receiving
  if (!receivingItem && !receivingIdParam && !poIdParam) {
    return (
      <div className={styles.adminPage}>
        <div className={styles.pageHeader}>
          <div>
            <h1 className={styles.pageTitle}>Receiving</h1>
            <p className={styles.pageDescription}>
              Select a purchase order to receive items
            </p>
          </div>
        </div>

        <div className={styles.emptyState}>
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className={styles.emptyIcon}>
            <path d="M21 16V8a2 2 0 00-1-1.73l-7-4a2 2 0 00-2 0l-7 4A2 2 0 003 8v8a2 2 0 001 1.73l7 4a2 2 0 002 0l7-4A2 2 0 0021 16z" />
            <polyline points="3.27 6.96 12 12.01 20.73 6.96" />
            <line x1="12" y1="22.08" x2="12" y2="12" />
          </svg>
          <h3>No items to receive</h3>
          <p>Go to Purchase Orders to find orders ready for receiving</p>
          <button
            type="button"
            className={styles.primaryButton}
            onClick={() => navigate('/procurement/purchase-orders')}
          >
            View Purchase Orders
          </button>
        </div>
      </div>
    );
  }

  if (!receivingItem) {
    return (
      <div className={styles.adminPage}>
        <div className={styles.errorBanner}>
          <p>Receiving item not found</p>
          <button type="button" onClick={() => navigate('/procurement/receiving')}>
            Back to Receiving Queue
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className={styles.adminPage}>
      <nav className={styles.breadcrumb}>
        <Link to="/procurement/receiving" className={styles.breadcrumbLink}>
          Receiving Queue
        </Link>
        <span className={styles.breadcrumbSeparator}>/</span>
        <span className={styles.breadcrumbCurrent}>Receive Items</span>
      </nav>

      <div className={styles.pageHeader}>
        <div>
          <h1 className={styles.pageTitle}>Receive Items</h1>
          <p className={styles.pageDescription}>
            Enter serial numbers and complete receiving for {receivingItem.poNumber}
          </p>
        </div>
      </div>

      {/* Receiving Summary Card */}
      <div className={styles.formSection} style={{ marginBottom: 'var(--spacing-6)' }}>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 'var(--spacing-4)' }}>
          <div>
            <span style={{ fontSize: 'var(--font-size-sm)', color: 'var(--color-text-secondary)' }}>PO Number</span>
            <p style={{ fontWeight: 'var(--font-weight-semibold)', margin: 'var(--spacing-1) 0 0' }}>{receivingItem.poNumber}</p>
          </div>
          <div>
            <span style={{ fontSize: 'var(--font-size-sm)', color: 'var(--color-text-secondary)' }}>Vendor</span>
            <p style={{ fontWeight: 'var(--font-weight-semibold)', margin: 'var(--spacing-1) 0 0' }}>{receivingItem.vendorName}</p>
          </div>
          <div>
            <span style={{ fontSize: 'var(--font-size-sm)', color: 'var(--color-text-secondary)' }}>Status</span>
            <p style={{ margin: 'var(--spacing-1) 0 0' }}>
              <span
                className={styles.statusBadge}
                style={{
                  backgroundColor: `color-mix(in srgb, ${getReceivingStatusColor(receivingItem.status)} 15%, transparent)`,
                  color: getReceivingStatusColor(receivingItem.status),
                }}
              >
                {formatStatus(receivingItem.status)}
              </span>
            </p>
          </div>
          <div>
            <span style={{ fontSize: 'var(--font-size-sm)', color: 'var(--color-text-secondary)' }}>Expected Date</span>
            <p style={{ fontWeight: 'var(--font-weight-semibold)', margin: 'var(--spacing-1) 0 0' }}>{formatDate(receivingItem.expectedDate)}</p>
          </div>
          <div>
            <span style={{ fontSize: 'var(--font-size-sm)', color: 'var(--color-text-secondary)' }}>Stockroom</span>
            <p style={{ fontWeight: 'var(--font-weight-semibold)', margin: 'var(--spacing-1) 0 0' }}>{receivingItem.stockroomName}</p>
          </div>
          <div>
            <span style={{ fontSize: 'var(--font-size-sm)', color: 'var(--color-text-secondary)' }}>Progress</span>
            <p style={{ fontWeight: 'var(--font-weight-semibold)', margin: 'var(--spacing-1) 0 0' }}>
              {getTotalSerialsEntered()} / {getTotalPending()} items
            </p>
          </div>
        </div>
      </div>

      {error && (
        <div className={styles.errorBanner}>
          <p>{error}</p>
        </div>
      )}

      {isScanning && (
        <div className={styles.infoBanner} style={{ marginBottom: 'var(--spacing-4)' }}>
          <p>Scanning asset...</p>
        </div>
      )}

      <Form
        initialValues={{}}
        onSubmit={handleSubmit}
        className={styles.form}
        showSubmitError={false}
      >
        {/* Line Items */}
        {lineStates.map((line) => (
          <div key={line.lineId} className={styles.formSection} style={{ marginBottom: 'var(--spacing-4)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 'var(--spacing-4)' }}>
              <div>
                <h3 style={{ margin: 0, fontSize: 'var(--font-size-base)' }}>{line.productDescription}</h3>
                <p style={{ margin: 'var(--spacing-1) 0 0', fontSize: 'var(--font-size-sm)', color: 'var(--color-text-secondary)' }}>
                  {line.serialNumbers.length} of {line.pendingQuantity} items entered
                </p>
              </div>
              <div style={{ display: 'flex', gap: 'var(--spacing-2)' }}>
                <button
                  type="button"
                  className={`${styles.secondaryButton} ${!isBulkMode && activeLineId === line.lineId ? styles.active : ''}`}
                  onClick={() => {
                    setActiveLineId(line.lineId);
                    setIsBulkMode(false);
                  }}
                  style={{ padding: 'var(--spacing-1) var(--spacing-3)', fontSize: 'var(--font-size-sm)' }}
                >
                  Single Entry
                </button>
                <button
                  type="button"
                  className={`${styles.secondaryButton} ${isBulkMode && activeLineId === line.lineId ? styles.active : ''}`}
                  onClick={() => {
                    setActiveLineId(line.lineId);
                    setIsBulkMode(true);
                  }}
                  style={{ padding: 'var(--spacing-1) var(--spacing-3)', fontSize: 'var(--font-size-sm)' }}
                >
                  Bulk Entry
                </button>
              </div>
            </div>

            {/* Serial Number Entry */}
            {activeLineId === line.lineId && !isBulkMode && (
              <div style={{ marginBottom: 'var(--spacing-4)' }}>
                <div style={{ display: 'flex', gap: 'var(--spacing-2)' }}>
                  <input
                    type="text"
                    className={styles.formInput}
                    placeholder="Enter or scan serial number..."
                    value={serialInput}
                    onChange={(e) => setSerialInput(e.target.value)}
                    onKeyDown={(e) => { void handleSerialKeyDown(e, line.lineId); }}
                    disabled={isSaving || isScanning || line.serialNumbers.length >= line.pendingQuantity}
                    autoFocus
                  />
                  <button
                    type="button"
                    className={styles.primaryButton}
                    onClick={() => {
                      void addSerialNumber(line.lineId, serialInput);
                      setSerialInput('');
                    }}
                    disabled={!serialInput.trim() || isSaving || isScanning || line.serialNumbers.length >= line.pendingQuantity}
                  >
                    {isScanning ? 'Scanning...' : 'Add'}
                  </button>
                </div>
                <p style={{ fontSize: 'var(--font-size-xs)', color: 'var(--color-text-secondary)', marginTop: 'var(--spacing-1)' }}>
                  Press Enter or click Add to add serial number
                </p>
              </div>
            )}

            {activeLineId === line.lineId && isBulkMode && (
              <div style={{ marginBottom: 'var(--spacing-4)' }}>
                <textarea
                  className={styles.formTextarea}
                  placeholder="Enter multiple serial numbers (one per line, or separated by commas)..."
                  value={bulkSerialInput}
                  onChange={(e) => setBulkSerialInput(e.target.value)}
                  disabled={isSaving || isScanning}
                  rows={4}
                />
                <button
                  type="button"
                  className={styles.primaryButton}
                  onClick={() => {
                    void addBulkSerialNumbers(line.lineId, bulkSerialInput);
                    setBulkSerialInput('');
                  }}
                  disabled={!bulkSerialInput.trim() || isSaving || isScanning}
                  style={{ marginTop: 'var(--spacing-2)' }}
                >
                  {isScanning ? 'Scanning...' : 'Add All'}
                </button>
              </div>
            )}

            {/* Serial Numbers List */}
            {line.serialNumbers.length > 0 && (
              <div style={{ marginBottom: 'var(--spacing-4)' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 'var(--spacing-2)' }}>
                  <span style={{ fontSize: 'var(--font-size-sm)', fontWeight: 'var(--font-weight-medium)' }}>
                    Entered Serial Numbers ({line.serialNumbers.length})
                  </span>
                  <button
                    type="button"
                    className={styles.secondaryButton}
                    onClick={() => clearSerialNumbers(line.lineId)}
                    disabled={isSaving}
                    style={{ padding: 'var(--spacing-1) var(--spacing-2)', fontSize: 'var(--font-size-xs)' }}
                  >
                    Clear All
                  </button>
                </div>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 'var(--spacing-2)' }}>
                  {line.serialNumbers.map((serial, idx) => (
                    <span
                      key={serial.serialNumber}
                      style={{
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: 'var(--spacing-1)',
                        padding: 'var(--spacing-1) var(--spacing-2)',
                        backgroundColor: serial.assetId ? 'var(--color-success-bg)' : 'var(--color-bg-secondary)',
                        borderRadius: 'var(--radius-md)',
                        fontSize: 'var(--font-size-sm)',
                      }}
                      title={serial.assetId ? `Asset ID: ${serial.assetId}` : 'Not yet synced'}
                    >
                      <span style={{ color: 'var(--color-text-secondary)', fontSize: 'var(--font-size-xs)' }}>{idx + 1}.</span>
                      {serial.serialNumber}
                      {serial.assetId && (
                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" style={{ width: '12px', height: '12px', color: 'var(--color-success)' }}>
                          <polyline points="20 6 9 17 4 12" />
                        </svg>
                      )}
                      <button
                        type="button"
                        onClick={() => removeSerialNumber(line.lineId, serial.serialNumber)}
                        disabled={isSaving}
                        style={{
                          background: 'none',
                          border: 'none',
                          cursor: 'pointer',
                          padding: '2px',
                          display: 'flex',
                          color: 'var(--color-text-secondary)',
                        }}
                        aria-label={`Remove ${serial.serialNumber}`}
                      >
                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" style={{ width: '14px', height: '14px' }}>
                          <line x1="18" y1="6" x2="6" y2="18" />
                          <line x1="6" y1="6" x2="18" y2="18" />
                        </svg>
                      </button>
                    </span>
                  ))}
                </div>
              </div>
            )}

            {/* Inspection Checkbox */}
            <div style={{ marginBottom: 'var(--spacing-3)' }}>
              <label style={{ display: 'flex', alignItems: 'center', gap: 'var(--spacing-2)', cursor: 'pointer' }}>
                <input
                  type="checkbox"
                  checked={line.inspectionRequired}
                  onChange={() => { void toggleInspection(line.lineId); }}
                  disabled={isSaving}
                />
                <span>Mark for quality inspection</span>
              </label>
              <p style={{ fontSize: 'var(--font-size-xs)', color: 'var(--color-text-secondary)', marginTop: 'var(--spacing-1)', marginLeft: 'var(--spacing-6)' }}>
                Items marked for inspection will be held until inspection passes
              </p>
            </div>

            {/* Notes */}
            <div>
              <label className={styles.formLabel}>Notes (optional)</label>
              <textarea
                className={styles.formTextarea}
                placeholder="Add any notes about this receiving..."
                value={line.notes}
                onChange={(e) => updateNotes(line.lineId, e.target.value)}
                disabled={isSaving}
                rows={2}
              />
            </div>
          </div>
        ))}

        {/* Form Actions */}
        <Form.Actions>
          <Form.Submit
            label={`Complete Receiving (${getTotalSerialsEntered()} items)`}
            submittingLabel="Processing..."
            cancelLabel="Cancel"
            onCancel={() => { void handleCancel(); }}
            disabled={isSaving || isScanning || getTotalSerialsEntered() === 0}
          />
        </Form.Actions>
      </Form>
    </div>
  );
}

export default ReceivingForm;
