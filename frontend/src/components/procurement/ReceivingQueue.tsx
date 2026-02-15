import { useState, useCallback } from 'react';
import type { HTMLAttributes } from 'react';
import type { ReceivingItem } from '../../types/procurement';
import {
  formatStatus,
  getReceivingStatusColor,
} from '../../types/procurement';
import styles from './ReceivingQueue.module.css';

/**
 * Serial number entry data for a receiving line
 */
export interface SerialNumberEntry {
  serialNumber: string;
  addedAt: string;
}

/**
 * Receiving line with serial numbers for expanded view
 */
export interface ReceivingLineWithSerials extends ReceivingItem {
  serialNumbers: SerialNumberEntry[];
  inspectionRequired: boolean;
}

/**
 * Complete receiving request data
 */
export interface CompleteReceivingRequest {
  receivingId: string;
  quantityReceived: number;
  serialNumbers: string[];
  inspectionRequired: boolean;
  notes?: string;
}

export interface ReceivingQueueProps extends HTMLAttributes<HTMLDivElement> {
  /** List of receiving items */
  items: ReceivingItem[];
  /** Title for the queue */
  title?: string;
  /** Maximum items to display */
  maxItems?: number;
  /** Loading state */
  isLoading?: boolean;
  /** Callback when an item is clicked */
  onItemClick?: (item: ReceivingItem) => void;
  /** Callback when receive action is clicked */
  onReceive?: (item: ReceivingItem) => void;
  /** Callback when report issue action is clicked */
  onReportIssue?: (item: ReceivingItem) => void;
  /** Callback when view all is clicked */
  onViewAll?: () => void;
  /** Callback when receiving is completed with serial numbers */
  onCompleteReceiving?: (request: CompleteReceivingRequest) => Promise<void>;
  /** Enable serial number entry mode */
  enableSerialNumberEntry?: boolean;
}

/**
 * ReceivingQueue component for displaying items awaiting receiving
 * Implements Requirement 12.3: Show receiving queue with actions
 * Implements Requirement 13: Enhanced Receiving Workflow with serial number entry
 */
export function ReceivingQueue({
  items,
  title = 'Receiving Queue',
  maxItems = 5,
  isLoading = false,
  onItemClick,
  onReceive,
  onReportIssue,
  onViewAll,
  onCompleteReceiving,
  enableSerialNumberEntry = false,
  className = '',
  ...props
}: ReceivingQueueProps) {
  const displayedItems = items.slice(0, maxItems);
  const hasMore = items.length > maxItems;

  // State for expanded item with serial number entry
  const [expandedItemId, setExpandedItemId] = useState<string | null>(null);
  const [serialNumbers, setSerialNumbers] = useState<Map<string, SerialNumberEntry[]>>(new Map());
  const [currentSerialInput, setCurrentSerialInput] = useState('');
  const [bulkSerialInput, setBulkSerialInput] = useState('');
  const [isBulkMode, setIsBulkMode] = useState(false);
  const [inspectionRequired, setInspectionRequired] = useState<Map<string, boolean>>(new Map());
  const [receivingNotes, setReceivingNotes] = useState<Map<string, string>>(new Map());
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [validationError, setValidationError] = useState<string | null>(null);

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
    });
  };

  const isOverdue = (expectedDate: string) => {
    return new Date(expectedDate) < new Date();
  };

  const pendingCount = items.filter(
    item => item.status === 'PENDING' || item.status === 'IN_PROGRESS'
  ).length;

  // Get serial numbers for an item
  const getSerialNumbersForItem = useCallback((receivingId: string): SerialNumberEntry[] => {
    return serialNumbers.get(receivingId) || [];
  }, [serialNumbers]);

  // Add a single serial number
  const addSerialNumber = useCallback((receivingId: string, serial: string) => {
    const trimmedSerial = serial.trim();
    if (!trimmedSerial) return;

    const currentSerials = getSerialNumbersForItem(receivingId);
    
    // Check for duplicates
    if (currentSerials.some(s => s.serialNumber.toLowerCase() === trimmedSerial.toLowerCase())) {
      setValidationError(`Serial number "${trimmedSerial}" already added`);
      return;
    }

    const newEntry: SerialNumberEntry = {
      serialNumber: trimmedSerial,
      addedAt: new Date().toISOString(),
    };

    setSerialNumbers(prev => {
      const updated = new Map(prev);
      updated.set(receivingId, [...currentSerials, newEntry]);
      return updated;
    });
    setValidationError(null);
  }, [getSerialNumbersForItem]);

  // Add multiple serial numbers (bulk mode)
  const addBulkSerialNumbers = useCallback((receivingId: string, bulkInput: string) => {
    // Split by newlines, commas, or semicolons
    const serials = bulkInput
      .split(/[\n,;]+/)
      .map(s => s.trim())
      .filter(s => s.length > 0);

    if (serials.length === 0) return;

    const currentSerials = getSerialNumbersForItem(receivingId);
    const existingSet = new Set(currentSerials.map(s => s.serialNumber.toLowerCase()));
    const duplicates: string[] = [];
    const newEntries: SerialNumberEntry[] = [];

    for (const serial of serials) {
      if (existingSet.has(serial.toLowerCase())) {
        duplicates.push(serial);
      } else {
        existingSet.add(serial.toLowerCase());
        newEntries.push({
          serialNumber: serial,
          addedAt: new Date().toISOString(),
        });
      }
    }

    if (duplicates.length > 0) {
      setValidationError(`Skipped ${duplicates.length} duplicate serial number(s)`);
    } else {
      setValidationError(null);
    }

    if (newEntries.length > 0) {
      setSerialNumbers(prev => {
        const updated = new Map(prev);
        updated.set(receivingId, [...currentSerials, ...newEntries]);
        return updated;
      });
    }
  }, [getSerialNumbersForItem]);

  // Remove a serial number
  const removeSerialNumber = useCallback((receivingId: string, serialToRemove: string) => {
    setSerialNumbers(prev => {
      const updated = new Map(prev);
      const currentSerials = updated.get(receivingId) || [];
      updated.set(
        receivingId,
        currentSerials.filter(s => s.serialNumber !== serialToRemove)
      );
      return updated;
    });
    setValidationError(null);
  }, []);

  // Clear all serial numbers for an item
  const clearSerialNumbers = useCallback((receivingId: string) => {
    setSerialNumbers(prev => {
      const updated = new Map(prev);
      updated.set(receivingId, []);
      return updated;
    });
    setValidationError(null);
  }, []);

  // Toggle inspection required
  const toggleInspectionRequired = useCallback((receivingId: string) => {
    setInspectionRequired(prev => {
      const updated = new Map(prev);
      updated.set(receivingId, !prev.get(receivingId));
      return updated;
    });
  }, []);

  // Update receiving notes
  const updateReceivingNotes = useCallback((receivingId: string, notes: string) => {
    setReceivingNotes(prev => {
      const updated = new Map(prev);
      updated.set(receivingId, notes);
      return updated;
    });
  }, []);

  // Handle single serial number input
  const handleSerialInputKeyDown = useCallback((
    e: React.KeyboardEvent<HTMLInputElement>,
    receivingId: string
  ) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      addSerialNumber(receivingId, currentSerialInput);
      setCurrentSerialInput('');
    }
  }, [addSerialNumber, currentSerialInput]);

  // Handle bulk serial number submission
  const handleBulkSubmit = useCallback((receivingId: string) => {
    addBulkSerialNumbers(receivingId, bulkSerialInput);
    setBulkSerialInput('');
  }, [addBulkSerialNumbers, bulkSerialInput]);

  // Toggle expanded item
  const handleToggleExpand = useCallback((receivingId: string) => {
    setExpandedItemId(prev => prev === receivingId ? null : receivingId);
    setValidationError(null);
    setCurrentSerialInput('');
    setBulkSerialInput('');
    setIsBulkMode(false);
  }, []);

  // Complete receiving for an item
  const handleCompleteReceiving = useCallback(async (item: ReceivingItem) => {
    if (!onCompleteReceiving) return;

    const itemSerials = getSerialNumbersForItem(item.receivingId);
    const quantityReceived = itemSerials.length;
    const remainingQuantity = item.expectedQuantity - item.receivedQuantity;

    // Validate serial number count
    if (quantityReceived === 0) {
      setValidationError('Please enter at least one serial number');
      return;
    }

    if (quantityReceived > remainingQuantity) {
      setValidationError(`Cannot receive more than ${remainingQuantity} items (${quantityReceived} serial numbers entered)`);
      return;
    }

    setIsSubmitting(true);
    setValidationError(null);

    try {
      await onCompleteReceiving({
        receivingId: item.receivingId,
        quantityReceived,
        serialNumbers: itemSerials.map(s => s.serialNumber),
        inspectionRequired: inspectionRequired.get(item.receivingId) || false,
        notes: receivingNotes.get(item.receivingId),
      });

      // Clear state after successful submission
      clearSerialNumbers(item.receivingId);
      setInspectionRequired(prev => {
        const updated = new Map(prev);
        updated.delete(item.receivingId);
        return updated;
      });
      setReceivingNotes(prev => {
        const updated = new Map(prev);
        updated.delete(item.receivingId);
        return updated;
      });
      setExpandedItemId(null);
    } catch (error) {
      setValidationError(
        error instanceof Error ? error.message : 'Failed to complete receiving'
      );
    } finally {
      setIsSubmitting(false);
    }
  }, [
    onCompleteReceiving,
    getSerialNumbersForItem,
    inspectionRequired,
    receivingNotes,
    clearSerialNumbers,
  ]);

  if (isLoading) {
    return (
      <div className={`${styles.container} ${className}`} {...props}>
        <div className={styles.header}>
          <h3 className={styles.title}>{title}</h3>
        </div>
        <div className={styles.list} aria-busy="true">
          {[1, 2, 3].map((i) => (
            <div key={i} className={styles.skeletonItem}>
              <div className={styles.skeletonHeader} />
              <div className={styles.skeletonBody} />
              <div className={styles.skeletonFooter} />
            </div>
          ))}
        </div>
      </div>
    );
  }

  if (items.length === 0) {
    return (
      <div className={`${styles.container} ${className}`} {...props}>
        <div className={styles.header}>
          <h3 className={styles.title}>{title}</h3>
        </div>
        <div className={styles.emptyState}>
          <svg
            className={styles.emptyIcon}
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            aria-hidden="true"
          >
            <path d="M21 16V8a2 2 0 00-1-1.73l-7-4a2 2 0 00-2 0l-7 4A2 2 0 003 8v8a2 2 0 001 1.73l7 4a2 2 0 002 0l7-4A2 2 0 0021 16z" />
            <polyline points="3.27 6.96 12 12.01 20.73 6.96" />
            <line x1="12" y1="22.08" x2="12" y2="12" />
          </svg>
          <p>No items in receiving queue</p>
        </div>
      </div>
    );
  }

  return (
    <div className={`${styles.container} ${className}`} {...props}>
      <div className={styles.header}>
        <h3 className={styles.title}>{title}</h3>
        <span className={styles.count}>{pendingCount} awaiting</span>
      </div>
      <ul className={styles.list} role="list">
        {displayedItems.map((item) => {
          const overdue = isOverdue(item.expectedDate) && 
            (item.status === 'PENDING' || item.status === 'IN_PROGRESS');
          const isExpanded = expandedItemId === item.receivingId;
          const itemSerials = getSerialNumbersForItem(item.receivingId);
          const remainingQuantity = item.expectedQuantity - item.receivedQuantity;
          const isInspectionRequired = inspectionRequired.get(item.receivingId) || false;
          const itemNotes = receivingNotes.get(item.receivingId) || '';
          
          return (
            <li key={item.receivingId} className={styles.item}>
              <button
                type="button"
                className={styles.itemButton}
                onClick={() => enableSerialNumberEntry 
                  ? handleToggleExpand(item.receivingId) 
                  : onItemClick?.(item)
                }
                aria-label={`View receiving item from ${item.vendorName}`}
                aria-expanded={isExpanded}
              >
                <div className={styles.itemHeader}>
                  <span className={styles.poNumber}>{item.poNumber}</span>
                  <span
                    className={styles.status}
                    style={{ 
                      color: getReceivingStatusColor(item.status),
                      backgroundColor: `color-mix(in srgb, ${getReceivingStatusColor(item.status)} 15%, transparent)`
                    }}
                  >
                    {formatStatus(item.status)}
                  </span>
                </div>
                <div className={styles.itemBody}>
                  <span className={styles.description}>{item.itemDescription}</span>
                </div>
                <div className={styles.itemMeta}>
                  <span className={styles.vendor}>{item.vendorName}</span>
                  <span className={styles.quantity}>
                    {item.receivedQuantity}/{item.expectedQuantity} received
                  </span>
                </div>
                <div className={styles.itemFooter}>
                  <span className={styles.stockroom}>
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
                      <path d="M3 9l9-7 9 7v11a2 2 0 01-2 2H5a2 2 0 01-2-2z" />
                    </svg>
                    {item.stockroomName}
                  </span>
                  <span className={`${styles.date} ${overdue ? styles.overdue : ''}`}>
                    {overdue && (
                      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
                        <circle cx="12" cy="12" r="10" />
                        <line x1="12" y1="8" x2="12" y2="12" />
                        <line x1="12" y1="16" x2="12.01" y2="16" />
                      </svg>
                    )}
                    {overdue ? 'Overdue' : `Expected: ${formatDate(item.expectedDate)}`}
                  </span>
                </div>
                {item.trackingNumber && (
                  <div className={styles.tracking}>
                    <span className={styles.trackingLabel}>Tracking:</span>
                    <span className={styles.trackingNumber}>{item.trackingNumber}</span>
                  </div>
                )}
                {item.notes && (
                  <div className={styles.notes}>
                    <span className={styles.notesText}>{item.notes}</span>
                  </div>
                )}
                {enableSerialNumberEntry && (
                  <div className={styles.expandIndicator}>
                    <svg 
                      viewBox="0 0 24 24" 
                      fill="none" 
                      stroke="currentColor" 
                      strokeWidth="2"
                      className={isExpanded ? styles.expandedIcon : ''}
                      aria-hidden="true"
                    >
                      <polyline points="6 9 12 15 18 9" />
                    </svg>
                    <span>{isExpanded ? 'Click to collapse' : 'Click to enter serial numbers'}</span>
                  </div>
                )}
              </button>

              {/* Serial Number Entry Panel */}
              {enableSerialNumberEntry && isExpanded && (
                <div className={styles.serialNumberPanel}>
                  <div className={styles.serialNumberHeader}>
                    <h4 className={styles.serialNumberTitle}>
                      Serial Number Entry
                    </h4>
                    <span className={styles.serialNumberCount}>
                      {itemSerials.length} of {remainingQuantity} remaining
                    </span>
                  </div>

                  {/* Validation Error */}
                  {validationError && (
                    <div className={styles.validationError}>
                      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
                        <circle cx="12" cy="12" r="10" />
                        <line x1="12" y1="8" x2="12" y2="12" />
                        <line x1="12" y1="16" x2="12.01" y2="16" />
                      </svg>
                      {validationError}
                    </div>
                  )}

                  {/* Mode Toggle */}
                  <div className={styles.modeToggle}>
                    <button
                      type="button"
                      className={`${styles.modeButton} ${!isBulkMode ? styles.modeButtonActive : ''}`}
                      onClick={() => setIsBulkMode(false)}
                    >
                      Single Entry
                    </button>
                    <button
                      type="button"
                      className={`${styles.modeButton} ${isBulkMode ? styles.modeButtonActive : ''}`}
                      onClick={() => setIsBulkMode(true)}
                    >
                      Bulk Entry
                    </button>
                  </div>

                  {/* Single Entry Mode */}
                  {!isBulkMode && (
                    <div className={styles.singleEntryContainer}>
                      <div className={styles.serialInputWrapper}>
                        <input
                          type="text"
                          className={styles.serialInput}
                          placeholder="Enter or scan serial number..."
                          value={currentSerialInput}
                          onChange={(e) => setCurrentSerialInput(e.target.value)}
                          onKeyDown={(e) => handleSerialInputKeyDown(e, item.receivingId)}
                          disabled={isSubmitting}
                          autoFocus
                        />
                        <button
                          type="button"
                          className={styles.addSerialButton}
                          onClick={() => {
                            addSerialNumber(item.receivingId, currentSerialInput);
                            setCurrentSerialInput('');
                          }}
                          disabled={!currentSerialInput.trim() || isSubmitting}
                        >
                          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
                            <line x1="12" y1="5" x2="12" y2="19" />
                            <line x1="5" y1="12" x2="19" y2="12" />
                          </svg>
                          Add
                        </button>
                      </div>
                      <p className={styles.inputHint}>
                        Press Enter or click Add to add serial number
                      </p>
                    </div>
                  )}

                  {/* Bulk Entry Mode */}
                  {isBulkMode && (
                    <div className={styles.bulkEntryContainer}>
                      <textarea
                        className={styles.bulkTextarea}
                        placeholder="Enter multiple serial numbers (one per line, or separated by commas)..."
                        value={bulkSerialInput}
                        onChange={(e) => setBulkSerialInput(e.target.value)}
                        disabled={isSubmitting}
                        rows={4}
                      />
                      <button
                        type="button"
                        className={styles.bulkAddButton}
                        onClick={() => handleBulkSubmit(item.receivingId)}
                        disabled={!bulkSerialInput.trim() || isSubmitting}
                      >
                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
                          <line x1="12" y1="5" x2="12" y2="19" />
                          <line x1="5" y1="12" x2="19" y2="12" />
                        </svg>
                        Add All
                      </button>
                    </div>
                  )}

                  {/* Serial Numbers List */}
                  {itemSerials.length > 0 && (
                    <div className={styles.serialNumbersList}>
                      <div className={styles.serialListHeader}>
                        <span>Entered Serial Numbers ({itemSerials.length})</span>
                        <button
                          type="button"
                          className={styles.clearAllButton}
                          onClick={() => clearSerialNumbers(item.receivingId)}
                          disabled={isSubmitting}
                        >
                          Clear All
                        </button>
                      </div>
                      <ul className={styles.serialList}>
                        {itemSerials.map((serial, index) => (
                          <li key={serial.serialNumber} className={styles.serialListItem}>
                            <span className={styles.serialIndex}>{index + 1}</span>
                            <span className={styles.serialValue}>{serial.serialNumber}</span>
                            <button
                              type="button"
                              className={styles.removeSerialButton}
                              onClick={() => removeSerialNumber(item.receivingId, serial.serialNumber)}
                              disabled={isSubmitting}
                              aria-label={`Remove serial number ${serial.serialNumber}`}
                            >
                              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
                                <line x1="18" y1="6" x2="6" y2="18" />
                                <line x1="6" y1="6" x2="18" y2="18" />
                              </svg>
                            </button>
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}

                  {/* Inspection Checkbox */}
                  <div className={styles.inspectionCheckbox}>
                    <label className={styles.checkboxLabel}>
                      <input
                        type="checkbox"
                        checked={isInspectionRequired}
                        onChange={() => toggleInspectionRequired(item.receivingId)}
                        disabled={isSubmitting}
                      />
                      <span className={styles.checkboxText}>
                        Mark for quality inspection
                      </span>
                    </label>
                    <p className={styles.checkboxHint}>
                      Items marked for inspection will be held until inspection passes
                    </p>
                  </div>

                  {/* Notes */}
                  <div className={styles.receivingNotesContainer}>
                    <label className={styles.notesLabel}>
                      Receiving Notes (optional)
                    </label>
                    <textarea
                      className={styles.receivingNotesInput}
                      placeholder="Add any notes about this receiving..."
                      value={itemNotes}
                      onChange={(e) => updateReceivingNotes(item.receivingId, e.target.value)}
                      disabled={isSubmitting}
                      rows={2}
                    />
                  </div>

                  {/* Complete Receiving Button */}
                  <div className={styles.completeReceivingActions}>
                    <button
                      type="button"
                      className={styles.cancelButton}
                      onClick={() => handleToggleExpand(item.receivingId)}
                      disabled={isSubmitting}
                    >
                      Cancel
                    </button>
                    <button
                      type="button"
                      className={styles.completeReceivingButton}
                      onClick={() => handleCompleteReceiving(item)}
                      disabled={itemSerials.length === 0 || isSubmitting}
                    >
                      {isSubmitting ? (
                        <>
                          <span className={styles.spinner} />
                          Processing...
                        </>
                      ) : (
                        <>
                          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
                            <polyline points="20 6 9 17 4 12" />
                          </svg>
                          Complete Receiving ({itemSerials.length} items)
                        </>
                      )}
                    </button>
                  </div>
                </div>
              )}

              {/* Original Actions (when serial number entry is disabled) */}
              {!enableSerialNumberEntry && (item.status === 'PENDING' || item.status === 'IN_PROGRESS') && (
                <div className={styles.actions}>
                  <button
                    type="button"
                    className={`${styles.actionButton} ${styles.receiveButton}`}
                    onClick={(e) => {
                      e.stopPropagation();
                      onReceive?.(item);
                    }}
                    aria-label={`Receive items for ${item.poNumber}`}
                  >
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
                      <polyline points="20 6 9 17 4 12" />
                    </svg>
                    Receive
                  </button>
                  <button
                    type="button"
                    className={`${styles.actionButton} ${styles.issueButton}`}
                    onClick={(e) => {
                      e.stopPropagation();
                      onReportIssue?.(item);
                    }}
                    aria-label={`Report issue for ${item.poNumber}`}
                  >
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
                      <circle cx="12" cy="12" r="10" />
                      <line x1="12" y1="8" x2="12" y2="12" />
                      <line x1="12" y1="16" x2="12.01" y2="16" />
                    </svg>
                    Report Issue
                  </button>
                </div>
              )}
            </li>
          );
        })}
      </ul>
      {hasMore && onViewAll && (
        <button type="button" className={styles.viewAllButton} onClick={onViewAll}>
          View all {items.length} items
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
            <polyline points="9 18 15 12 9 6" />
          </svg>
        </button>
      )}
    </div>
  );
}

export default ReceivingQueue;
