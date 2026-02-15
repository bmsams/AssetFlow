import { useCallback, useMemo } from 'react';
import type { POLine, CreatePOLineRequest } from '../../services/procurement-api';
import { formatCurrency } from '../../utils/formatters';
import { PRODUCT_TYPE_OPTIONS } from '../../constants/procurement';
import styles from '../admin/AdminPage.module.css';

/**
 * Line item for editing (can be either existing POLine or new CreatePOLineRequest)
 */
export interface EditablePOLine {
  /** Line ID (only present for existing lines) */
  lineId?: string;
  /** Line number for display */
  lineNumber?: number;
  /** Product type */
  productType: CreatePOLineRequest['productType'];
  /** Optional product ID reference */
  productId?: string;
  /** Product description */
  productDescription: string;
  /** SKU (optional) */
  sku?: string;
  /** Quantity */
  quantity: number;
  /** Unit price */
  unitPrice: number;
  /** Notes (optional) */
  notes?: string;
  /** Quantity received (only for existing lines) */
  quantityReceived?: number;
}

/**
 * Validation errors for a line item
 */
export interface LineValidationErrors {
  productDescription?: string;
  quantity?: string;
  unitPrice?: string;
}

/**
 * Props for POLineEditor component
 */
export interface POLineEditorProps {
  /** Array of line items to display/edit */
  lines: EditablePOLine[];
  /** Callback when a new line is added */
  onAddLine: () => void;
  /** Callback when a line is updated */
  onUpdateLine: (index: number, field: keyof EditablePOLine, value: string | number) => void;
  /** Callback when a line is removed */
  onRemoveLine: (index: number) => void;
  /** Whether the editor is in read-only mode */
  readOnly?: boolean;
  /** Validation errors per line index */
  lineErrors?: Record<number, LineValidationErrors>;
  /** Whether to show the quantity received column (for detail view) */
  showQuantityReceived?: boolean;
  /** Custom class name for the container */
  className?: string;
}

/**
 * POLineEditor Component
 * 
 * A reusable React component for managing purchase order line items.
 * Implements Task 17.1.3: Create POLineEditor.tsx for line item management
 *
 * Requirements from spec (Requirement 16):
 * - Add line items with product details, quantities, and unit prices
 * - Update line item quantities or prices with automatic total recalculation
 * - Remove line items from a purchase order
 * - Display line totals and overall subtotal
 *
 * Features:
 * - Product type dropdown (Hardware, Software, Service, Other)
 * - Product description input
 * - SKU input (optional)
 * - Quantity input with validation
 * - Unit price input with validation
 * - Line total display (auto-calculated)
 * - Add line button
 * - Remove line button per row
 * - Subtotal display at bottom
 */
export function POLineEditor({
  lines,
  onAddLine,
  onUpdateLine,
  onRemoveLine,
  readOnly = false,
  lineErrors = {},
  showQuantityReceived = false,
  className,
}: POLineEditorProps) {
  /**
   * Calculate line total (quantity * unitPrice)
   */
  const calculateLineTotal = useCallback((line: EditablePOLine): number => {
    return line.quantity * line.unitPrice;
  }, []);

  /**
   * Calculate subtotal (sum of all line totals)
   */
  const subtotal = useMemo(() => {
    return lines.reduce((sum, line) => sum + calculateLineTotal(line), 0);
  }, [lines, calculateLineTotal]);

  /**
   * Handle field change for a line item
   */
  const handleFieldChange = useCallback(
    (index: number, field: keyof EditablePOLine, value: string | number) => {
      onUpdateLine(index, field, value);
    },
    [onUpdateLine]
  );

  /**
   * Handle product type change
   */
  const handleProductTypeChange = useCallback(
    (index: number, value: string) => {
      handleFieldChange(index, 'productType', value as CreatePOLineRequest['productType']);
    },
    [handleFieldChange]
  );

  /**
   * Handle quantity change with parsing
   */
  const handleQuantityChange = useCallback(
    (index: number, value: string) => {
      const parsed = parseInt(value, 10);
      handleFieldChange(index, 'quantity', isNaN(parsed) ? 0 : parsed);
    },
    [handleFieldChange]
  );

  /**
   * Handle unit price change with parsing
   */
  const handleUnitPriceChange = useCallback(
    (index: number, value: string) => {
      const parsed = parseFloat(value);
      handleFieldChange(index, 'unitPrice', isNaN(parsed) ? 0 : parsed);
    },
    [handleFieldChange]
  );

  /**
   * Check if a line can be removed
   */
  const canRemoveLine = useCallback(
    (line: EditablePOLine): boolean => {
      // Cannot remove if read-only
      if (readOnly) return false;
      // Cannot remove if there's only one line
      if (lines.length <= 1) return false;
      // Cannot remove if line has received items
      if (line.quantityReceived && line.quantityReceived > 0) return false;
      return true;
    },
    [readOnly, lines.length]
  );

  /**
   * Get tooltip for remove button
   */
  const getRemoveTooltip = useCallback(
    (line: EditablePOLine): string => {
      if (readOnly) return 'Cannot remove in read-only mode';
      if (lines.length <= 1) return 'At least one line item is required';
      if (line.quantityReceived && line.quantityReceived > 0) {
        return 'Cannot remove line with received items';
      }
      return 'Remove line item';
    },
    [readOnly, lines.length]
  );

  return (
    <div className={className}>
      {/* Header with Add Line button */}
      {!readOnly && (
        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            marginBottom: 'var(--spacing-4)',
          }}
        >
          <h3
            className={styles.formSectionTitle}
            style={{ margin: 0, border: 'none', paddingBottom: 0 }}
          >
            Line Items
          </h3>
          <button
            type="button"
            className={styles.secondaryButton}
            onClick={onAddLine}
          >
            <svg
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              className={styles.buttonIcon}
            >
              <line x1="12" y1="5" x2="12" y2="19" />
              <line x1="5" y1="12" x2="19" y2="12" />
            </svg>
            Add Line Item
          </button>
        </div>
      )}

      {/* Read-only header */}
      {readOnly && (
        <h3
          className={styles.formSectionTitle}
          style={{ marginBottom: 'var(--spacing-4)' }}
        >
          Line Items
        </h3>
      )}

      {/* Line Items Table */}
      <div className={styles.tableContainer}>
        <table className={styles.table}>
          <thead>
            <tr>
              {showQuantityReceived && <th style={{ width: '50px' }}>#</th>}
              <th style={{ width: '120px' }}>Type</th>
              <th>Description</th>
              <th style={{ width: '100px' }}>SKU</th>
              <th style={{ width: '80px' }}>Qty</th>
              <th style={{ width: '120px' }}>Unit Price</th>
              <th style={{ width: '120px' }}>Line Total</th>
              {showQuantityReceived && <th style={{ width: '80px' }}>Received</th>}
              {!readOnly && <th style={{ width: '60px' }}>Actions</th>}
            </tr>
          </thead>
          <tbody>
            {lines.map((line, index) => (
              <tr key={line.lineId || `new-${index}`}>
                {/* Line Number (for detail view) */}
                {showQuantityReceived && (
                  <td style={{ textAlign: 'center', color: 'var(--color-text-secondary)' }}>
                    {line.lineNumber || index + 1}
                  </td>
                )}

                {/* Product Type */}
                <td>
                  {readOnly ? (
                    <span>
                      {PRODUCT_TYPE_OPTIONS.find((opt) => opt.value === line.productType)?.label ||
                        line.productType}
                    </span>
                  ) : (
                    <select
                      value={line.productType}
                      onChange={(e) => handleProductTypeChange(index, e.target.value)}
                      className={styles.formSelect}
                      style={{
                        padding: 'var(--spacing-1) var(--spacing-2)',
                        fontSize: 'var(--font-size-xs)',
                      }}
                    >
                      {PRODUCT_TYPE_OPTIONS.map((opt) => (
                        <option key={opt.value} value={opt.value}>
                          {opt.label}
                        </option>
                      ))}
                    </select>
                  )}
                </td>

                {/* Product Description */}
                <td>
                  {readOnly ? (
                    <span>{line.productDescription}</span>
                  ) : (
                    <>
                      <input
                        type="text"
                        value={line.productDescription}
                        onChange={(e) =>
                          handleFieldChange(index, 'productDescription', e.target.value)
                        }
                        className={`${styles.formInput} ${
                          lineErrors[index]?.productDescription ? styles.error : ''
                        }`}
                        style={{
                          padding: 'var(--spacing-1) var(--spacing-2)',
                          fontSize: 'var(--font-size-xs)',
                        }}
                        placeholder="Product description..."
                      />
                      {lineErrors[index]?.productDescription && (
                        <span
                          className={styles.formError}
                          style={{ fontSize: 'var(--font-size-xs)' }}
                        >
                          {lineErrors[index].productDescription}
                        </span>
                      )}
                    </>
                  )}
                </td>

                {/* SKU */}
                <td>
                  {readOnly ? (
                    <span className={styles.codeCell}>{line.sku || '-'}</span>
                  ) : (
                    <input
                      type="text"
                      value={line.sku || ''}
                      onChange={(e) => handleFieldChange(index, 'sku', e.target.value)}
                      className={styles.formInput}
                      style={{
                        padding: 'var(--spacing-1) var(--spacing-2)',
                        fontSize: 'var(--font-size-xs)',
                      }}
                      placeholder="SKU"
                    />
                  )}
                </td>

                {/* Quantity */}
                <td>
                  {readOnly ? (
                    <span style={{ textAlign: 'right', display: 'block' }}>{line.quantity}</span>
                  ) : (
                    <>
                      <input
                        type="number"
                        value={line.quantity}
                        onChange={(e) => handleQuantityChange(index, e.target.value)}
                        className={`${styles.formInput} ${
                          lineErrors[index]?.quantity ? styles.error : ''
                        }`}
                        style={{
                          padding: 'var(--spacing-1) var(--spacing-2)',
                          fontSize: 'var(--font-size-xs)',
                          textAlign: 'right',
                        }}
                        min="1"
                      />
                      {lineErrors[index]?.quantity && (
                        <span
                          className={styles.formError}
                          style={{ fontSize: 'var(--font-size-xs)' }}
                        >
                          {lineErrors[index].quantity}
                        </span>
                      )}
                    </>
                  )}
                </td>

                {/* Unit Price */}
                <td>
                  {readOnly ? (
                    <span style={{ textAlign: 'right', display: 'block' }}>
                      {formatCurrency(line.unitPrice)}
                    </span>
                  ) : (
                    <>
                      <input
                        type="number"
                        value={line.unitPrice}
                        onChange={(e) => handleUnitPriceChange(index, e.target.value)}
                        className={`${styles.formInput} ${
                          lineErrors[index]?.unitPrice ? styles.error : ''
                        }`}
                        style={{
                          padding: 'var(--spacing-1) var(--spacing-2)',
                          fontSize: 'var(--font-size-xs)',
                          textAlign: 'right',
                        }}
                        min="0"
                        step="0.01"
                      />
                      {lineErrors[index]?.unitPrice && (
                        <span
                          className={styles.formError}
                          style={{ fontSize: 'var(--font-size-xs)' }}
                        >
                          {lineErrors[index].unitPrice}
                        </span>
                      )}
                    </>
                  )}
                </td>

                {/* Line Total */}
                <td
                  style={{
                    textAlign: 'right',
                    fontWeight: 'var(--font-weight-medium)',
                  }}
                >
                  {formatCurrency(calculateLineTotal(line))}
                </td>

                {/* Quantity Received (for detail view) */}
                {showQuantityReceived && (
                  <td style={{ textAlign: 'right' }}>
                    <span
                      style={{
                        color:
                          line.quantityReceived === line.quantity
                            ? 'var(--color-success-600)'
                            : line.quantityReceived && line.quantityReceived > 0
                            ? 'var(--color-warning-600)'
                            : 'var(--color-text-secondary)',
                      }}
                    >
                      {line.quantityReceived || 0}
                    </span>
                  </td>
                )}

                {/* Actions */}
                {!readOnly && (
                  <td>
                    <button
                      type="button"
                      className={`${styles.iconButton} ${styles.dangerButton}`}
                      onClick={() => onRemoveLine(index)}
                      title={getRemoveTooltip(line)}
                      disabled={!canRemoveLine(line)}
                    >
                      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                        <polyline points="3 6 5 6 21 6" />
                        <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
                      </svg>
                    </button>
                  </td>
                )}
              </tr>
            ))}

            {/* Empty state */}
            {lines.length === 0 && (
              <tr>
                <td
                  colSpan={showQuantityReceived ? 9 : readOnly ? 6 : 7}
                  style={{
                    textAlign: 'center',
                    padding: 'var(--spacing-8)',
                    color: 'var(--color-text-secondary)',
                  }}
                >
                  No line items. {!readOnly && 'Click "Add Line Item" to add one.'}
                </td>
              </tr>
            )}
          </tbody>

          {/* Footer with Subtotal */}
          {lines.length > 0 && (
            <tfoot>
              <tr>
                <td
                  colSpan={showQuantityReceived ? (readOnly ? 6 : 7) : readOnly ? 5 : 6}
                  style={{
                    textAlign: 'right',
                    fontWeight: 'var(--font-weight-semibold)',
                    paddingRight: 'var(--spacing-4)',
                  }}
                >
                  Subtotal:
                </td>
                <td
                  style={{
                    textAlign: 'right',
                    fontWeight: 'var(--font-weight-bold)',
                    fontSize: 'var(--font-size-base)',
                  }}
                >
                  {formatCurrency(subtotal)}
                </td>
                {showQuantityReceived && <td />}
                {!readOnly && <td />}
              </tr>
            </tfoot>
          )}
        </table>
      </div>
    </div>
  );
}

/**
 * Create an empty line item for adding new lines
 */
export function createEmptyLine(): EditablePOLine {
  return {
    productType: 'HARDWARE_MODEL',
    productDescription: '',
    sku: '',
    quantity: 1,
    unitPrice: 0,
    notes: '',
  };
}

/**
 * Convert POLine from API to EditablePOLine
 */
export function poLineToEditable(line: POLine): EditablePOLine {
  return {
    lineId: line.lineId,
    lineNumber: line.lineNumber,
    productType: line.productType,
    productId: line.productId,
    productDescription: line.productDescription,
    sku: line.sku,
    quantity: line.quantity,
    unitPrice: line.unitPrice,
    notes: line.notes,
    quantityReceived: line.quantityReceived,
  };
}

/**
 * Convert EditablePOLine to CreatePOLineRequest for API
 */
export function editableToCreateRequest(line: EditablePOLine): CreatePOLineRequest {
  return {
    productType: line.productType,
    productId: line.productId,
    productDescription: line.productDescription,
    sku: line.sku || undefined,
    quantity: line.quantity,
    unitPrice: line.unitPrice,
    notes: line.notes || undefined,
  };
}

/**
 * Validate a line item
 */
export function validateLine(line: EditablePOLine): LineValidationErrors {
  const errors: LineValidationErrors = {};

  if (!line.productDescription.trim()) {
    errors.productDescription = 'Description is required';
  }

  if (line.quantity <= 0) {
    errors.quantity = 'Quantity must be greater than 0';
  }

  if (line.unitPrice < 0) {
    errors.unitPrice = 'Unit price cannot be negative';
  }

  return errors;
}

/**
 * Validate all lines and return errors by index
 */
export function validateLines(lines: EditablePOLine[]): Record<number, LineValidationErrors> {
  const errors: Record<number, LineValidationErrors> = {};

  lines.forEach((line, index) => {
    const lineErrors = validateLine(line);
    if (Object.keys(lineErrors).length > 0) {
      errors[index] = lineErrors;
    }
  });

  return errors;
}

/**
 * Calculate subtotal from lines
 */
export function calculateSubtotal(lines: EditablePOLine[]): number {
  return lines.reduce((sum, line) => sum + line.quantity * line.unitPrice, 0);
}

export default POLineEditor;
