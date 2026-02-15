import { useState, useEffect, useCallback } from 'react';
import { useNavigate, useParams, Link } from 'react-router-dom';
import { receivingApi } from '../../services/receiving-api';
import type { InspectionRecord, InspectionResult as ApiInspectionResult } from '../../services/receiving-api';
import { formatDate, formatStatus } from '../../utils/formatters';
import styles from '../admin/AdminPage.module.css';

/**
 * Inspection status type
 * Aligned with backend lifecycle-service InspectionStatus
 */
export type InspectionStatus = 'PENDING' | 'PASSED' | 'FAILED';

/**
 * Inspection result type
 * Aligned with backend lifecycle-service InspectionResult
 */
export type InspectionResult = 'PASSED' | 'FAILED';

/**
 * Inspection item interface (mapped from API InspectionRecord)
 */
export interface InspectionItem {
  inspectionId: string;
  receivingId?: string;
  receivingLineId: string;
  assetTag?: string;
  serialNumber: string;
  productDescription: string;
  vendorName: string;
  poNumber: string;
  receivedDate: string;
  status: InspectionStatus;
  inspectedBy?: string;
  inspectedDate?: string;
  result?: InspectionResult;
  notes?: string;
  defects?: string[];
}

/**
 * Inspection checklist item
 */
interface ChecklistItem {
  id: string;
  label: string;
  checked: boolean;
  required: boolean;
}

/**
 * Default inspection checklist
 */
const DEFAULT_CHECKLIST: ChecklistItem[] = [
  { id: 'physical', label: 'Physical condition - no visible damage', checked: false, required: true },
  { id: 'packaging', label: 'Original packaging intact', checked: false, required: false },
  { id: 'accessories', label: 'All accessories included', checked: false, required: true },
  { id: 'documentation', label: 'Documentation/manuals present', checked: false, required: false },
  { id: 'serial', label: 'Serial number matches documentation', checked: false, required: true },
  { id: 'power', label: 'Powers on successfully', checked: false, required: true },
  { id: 'functionality', label: 'Basic functionality verified', checked: false, required: true },
];

/**
 * InspectionForm Component
 * Implements Task 17.2.4: Create InspectionForm.tsx for quality inspection
 *
 * Requirements from spec (Requirement 13.5):
 * - Mark items for quality inspection
 * - Create inspection records
 * - Hold asset creation until inspection passes
 */
export function InspectionForm() {
  const navigate = useNavigate();
  const { inspectionId } = useParams<{ inspectionId: string }>();

  // Loading states
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Inspection data
  const [inspectionItem, setInspectionItem] = useState<InspectionItem | null>(null);
  const [checklist, setChecklist] = useState<ChecklistItem[]>(DEFAULT_CHECKLIST);
  const [result, setResult] = useState<InspectionResult | ''>('');
  const [notes, setNotes] = useState('');
  const [defects, setDefects] = useState<string[]>([]);
  const [newDefect, setNewDefect] = useState('');

  /**
   * Map API inspection record to InspectionItem
   */
  const mapInspectionRecord = useCallback((
    record: InspectionRecord,
    line?: { productDescription?: string; receivingId?: string; },
    context?: { vendorName?: string; poNumber?: string; }
  ): InspectionItem => {
    return {
      inspectionId: record.inspectionId,
      receivingLineId: record.receivingLineId,
      serialNumber: record.serialNumber || 'N/A',
      productDescription: line?.productDescription || 'Unknown Product',
      vendorName: context?.vendorName || 'Unknown Vendor',
      poNumber: context?.poNumber || 'Unknown PO',
      receivedDate: record.createdAt,
      status: record.status as InspectionStatus,
      inspectedBy: record.inspectedByName,
      inspectedDate: record.inspectedAt,
      result: record.result as InspectionResult | undefined,
      notes: record.notes,
    };
  }, []);

  /**
   * Load inspection item data from API
   */
  const loadInspectionItem = useCallback(async () => {
    if (!inspectionId) return;

    try {
      setIsLoading(true);
      setError(null);

      const response = await receivingApi.inspection.get(inspectionId);
      const record = response.inspectionRecord;
      const line = response.receivingLine;

      let context: { vendorName?: string; poNumber?: string } | undefined;
      if (line.receivingId) {
        try {
          const receiving = await receivingApi.get(line.receivingId);
          context = {
            vendorName: receiving.receivingRecord.vendorName ?? undefined,
            poNumber: receiving.receivingRecord.poNumber ?? undefined,
          };
        } catch {
          // Keep fallback values if receiving context cannot be loaded.
        }
      }

      setInspectionItem(mapInspectionRecord(record, line, context));
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load inspection item');
    } finally {
      setIsLoading(false);
    }
  }, [inspectionId, mapInspectionRecord]);

  useEffect(() => {
    loadInspectionItem();
  }, [loadInspectionItem]);

  /**
   * Toggle checklist item
   */
  const toggleChecklistItem = (itemId: string) => {
    setChecklist((prev) =>
      prev.map((item) =>
        item.id === itemId ? { ...item, checked: !item.checked } : item
      )
    );
  };

  /**
   * Add a defect
   */
  const addDefect = () => {
    const trimmed = newDefect.trim();
    if (!trimmed) return;

    if (defects.includes(trimmed)) {
      setError('This defect has already been added');
      return;
    }

    setDefects((prev) => [...prev, trimmed]);
    setNewDefect('');
    setError(null);
  };

  /**
   * Remove a defect
   */
  const removeDefect = (defect: string) => {
    setDefects((prev) => prev.filter((d) => d !== defect));
  };

  /**
   * Check if all required checklist items are checked
   */
  const areRequiredItemsChecked = () => {
    return checklist.filter((item) => item.required).every((item) => item.checked);
  };

  /**
   * Get checklist completion percentage
   */
  const getChecklistCompletion = () => {
    const checked = checklist.filter((item) => item.checked).length;
    return Math.round((checked / checklist.length) * 100);
  };

  /**
   * Validate form before submission
   */
  const validateForm = (): boolean => {
    if (!result) {
      setError('Please select an inspection result');
      return false;
    }

    if (result === 'PASSED' && !areRequiredItemsChecked()) {
      setError('All required checklist items must be checked to pass inspection');
      return false;
    }

    if (result === 'FAILED' && defects.length === 0) {
      setError('Please add at least one defect for failed inspection');
      return false;
    }

    return true;
  };

  /**
   * Submit inspection result via API
   */
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!validateForm() || !inspectionId || !result) return;

    try {
      setIsSaving(true);
      setError(null);

      await receivingApi.inspection.recordResult(inspectionId, {
        result: result as ApiInspectionResult,
        notes: notes || undefined,
        failureReason: result === 'FAILED' ? defects.join('; ') : undefined,
      });

      navigate('/procurement/receiving');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to submit inspection result');
    } finally {
      setIsSaving(false);
    }
  };

  /**
   * Get result color
   */
  const getResultColor = (r: InspectionResult | '') => {
    switch (r) {
      case 'PASSED':
        return 'var(--color-success-500)';
      case 'FAILED':
        return 'var(--color-error-500)';
      default:
        return 'var(--color-text-secondary)';
    }
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

  if (!inspectionItem) {
    return (
      <div className={styles.adminPage}>
        <div className={styles.errorBanner}>
          <p>Inspection item not found</p>
          <button type="button" onClick={() => navigate('/procurement/receiving')}>
            Back to Receiving
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className={styles.adminPage}>
      <nav className={styles.breadcrumb}>
        <Link to="/procurement/receiving" className={styles.breadcrumbLink}>
          Receiving
        </Link>
        <span className={styles.breadcrumbSeparator}>/</span>
        <span className={styles.breadcrumbCurrent}>Quality Inspection</span>
      </nav>

      <div className={styles.pageHeader}>
        <div>
          <h1 className={styles.pageTitle}>Quality Inspection</h1>
          <p className={styles.pageDescription}>
            Inspect item {inspectionItem.serialNumber} from {inspectionItem.poNumber}
          </p>
        </div>
      </div>

      {/* Item Details Card */}
      <div className={styles.formSection} style={{ marginBottom: 'var(--spacing-6)' }}>
        <h2 className={styles.formSectionTitle}>Item Details</h2>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 'var(--spacing-4)' }}>
          <div>
            <span style={{ fontSize: 'var(--font-size-sm)', color: 'var(--color-text-secondary)' }}>Serial Number</span>
            <p style={{ fontWeight: 'var(--font-weight-semibold)', margin: 'var(--spacing-1) 0 0', fontFamily: 'monospace' }}>
              {inspectionItem.serialNumber}
            </p>
          </div>
          <div>
            <span style={{ fontSize: 'var(--font-size-sm)', color: 'var(--color-text-secondary)' }}>Product</span>
            <p style={{ fontWeight: 'var(--font-weight-semibold)', margin: 'var(--spacing-1) 0 0' }}>
              {inspectionItem.productDescription}
            </p>
          </div>
          <div>
            <span style={{ fontSize: 'var(--font-size-sm)', color: 'var(--color-text-secondary)' }}>Vendor</span>
            <p style={{ fontWeight: 'var(--font-weight-semibold)', margin: 'var(--spacing-1) 0 0' }}>
              {inspectionItem.vendorName}
            </p>
          </div>
          <div>
            <span style={{ fontSize: 'var(--font-size-sm)', color: 'var(--color-text-secondary)' }}>PO Number</span>
            <p style={{ fontWeight: 'var(--font-weight-semibold)', margin: 'var(--spacing-1) 0 0' }}>
              {inspectionItem.poNumber}
            </p>
          </div>
          <div>
            <span style={{ fontSize: 'var(--font-size-sm)', color: 'var(--color-text-secondary)' }}>Received Date</span>
            <p style={{ fontWeight: 'var(--font-weight-semibold)', margin: 'var(--spacing-1) 0 0' }}>
              {formatDate(inspectionItem.receivedDate)}
            </p>
          </div>
          <div>
            <span style={{ fontSize: 'var(--font-size-sm)', color: 'var(--color-text-secondary)' }}>Status</span>
            <p style={{ margin: 'var(--spacing-1) 0 0' }}>
              <span
                className={styles.statusBadge}
                style={{
                  backgroundColor: 'var(--color-warning-100)',
                  color: 'var(--color-warning-700)',
                }}
              >
                {formatStatus(inspectionItem.status)}
              </span>
            </p>
          </div>
        </div>
      </div>

      {error && (
        <div className={styles.errorBanner}>
          <p>{error}</p>
        </div>
      )}

      <form onSubmit={handleSubmit}>
        {/* Inspection Checklist */}
        <div className={styles.formSection} style={{ marginBottom: 'var(--spacing-6)' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 'var(--spacing-4)' }}>
            <h2 className={styles.formSectionTitle} style={{ margin: 0, border: 'none', paddingBottom: 0 }}>
              Inspection Checklist
            </h2>
            <span style={{ fontSize: 'var(--font-size-sm)', color: 'var(--color-text-secondary)' }}>
              {getChecklistCompletion()}% complete
            </span>
          </div>

          {/* Progress bar */}
          <div style={{
            height: '4px',
            backgroundColor: 'var(--color-bg-secondary)',
            borderRadius: 'var(--radius-full)',
            marginBottom: 'var(--spacing-4)',
            overflow: 'hidden',
          }}>
            <div style={{
              height: '100%',
              width: `${getChecklistCompletion()}%`,
              backgroundColor: getChecklistCompletion() === 100 ? 'var(--color-success-500)' : 'var(--color-primary-500)',
              transition: 'width 0.3s ease',
            }} />
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--spacing-3)' }}>
            {checklist.map((item) => (
              <label
                key={item.id}
                style={{
                  display: 'flex',
                  alignItems: 'flex-start',
                  gap: 'var(--spacing-3)',
                  cursor: 'pointer',
                  padding: 'var(--spacing-2)',
                  borderRadius: 'var(--radius-md)',
                  backgroundColor: item.checked ? 'var(--color-success-50)' : 'transparent',
                  transition: 'background-color 0.2s ease',
                }}
              >
                <input
                  type="checkbox"
                  checked={item.checked}
                  onChange={() => toggleChecklistItem(item.id)}
                  disabled={isSaving}
                  style={{ marginTop: '2px' }}
                />
                <span style={{ flex: 1 }}>
                  {item.label}
                  {item.required && (
                    <span style={{ color: 'var(--color-error-500)', marginLeft: 'var(--spacing-1)' }}>*</span>
                  )}
                </span>
                {item.checked && (
                  <svg viewBox="0 0 24 24" fill="none" stroke="var(--color-success-500)" strokeWidth="2" style={{ width: '20px', height: '20px' }}>
                    <polyline points="20 6 9 17 4 12" />
                  </svg>
                )}
              </label>
            ))}
          </div>
          <p style={{ fontSize: 'var(--font-size-xs)', color: 'var(--color-text-secondary)', marginTop: 'var(--spacing-2)' }}>
            * Required items must be checked to pass inspection
          </p>
        </div>

        {/* Inspection Result */}
        <div className={styles.formSection} style={{ marginBottom: 'var(--spacing-6)' }}>
          <h2 className={styles.formSectionTitle}>Inspection Result</h2>

          <div style={{ display: 'flex', gap: 'var(--spacing-3)', marginBottom: 'var(--spacing-4)' }}>
            {(['PASSED', 'FAILED'] as InspectionResult[]).map((r) => (
              <button
                key={r}
                type="button"
                onClick={() => setResult(r)}
                disabled={isSaving}
                style={{
                  flex: 1,
                  padding: 'var(--spacing-4)',
                  border: `2px solid ${result === r ? getResultColor(r) : 'var(--color-border)'}`,
                  borderRadius: 'var(--radius-lg)',
                  backgroundColor: result === r ? `color-mix(in srgb, ${getResultColor(r)} 10%, transparent)` : 'transparent',
                  cursor: 'pointer',
                  transition: 'all 0.2s ease',
                }}
              >
                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 'var(--spacing-2)' }}>
                  {r === 'PASSED' && (
                    <svg viewBox="0 0 24 24" fill="none" stroke={getResultColor(r)} strokeWidth="2" style={{ width: '32px', height: '32px' }}>
                      <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14" />
                      <polyline points="22 4 12 14.01 9 11.01" />
                    </svg>
                  )}
                  {r === 'FAILED' && (
                    <svg viewBox="0 0 24 24" fill="none" stroke={getResultColor(r)} strokeWidth="2" style={{ width: '32px', height: '32px' }}>
                      <circle cx="12" cy="12" r="10" />
                      <line x1="15" y1="9" x2="9" y2="15" />
                      <line x1="9" y1="9" x2="15" y2="15" />
                    </svg>
                  )}
                  <span style={{ fontWeight: 'var(--font-weight-semibold)', color: result === r ? getResultColor(r) : 'var(--color-text-primary)' }}>
                    {r === 'PASSED' ? 'Pass' : 'Fail'}
                  </span>
                </div>
              </button>
            ))}
          </div>

        </div>

        {/* Defects (shown for FAIL) */}
        {result === 'FAILED' && (
          <div className={styles.formSection} style={{ marginBottom: 'var(--spacing-6)' }}>
            <h2 className={styles.formSectionTitle}>Defects Found</h2>

            <div style={{ display: 'flex', gap: 'var(--spacing-2)', marginBottom: 'var(--spacing-3)' }}>
              <input
                type="text"
                className={styles.formInput}
                placeholder="Describe the defect..."
                value={newDefect}
                onChange={(e) => setNewDefect(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    e.preventDefault();
                    addDefect();
                  }
                }}
                disabled={isSaving}
                style={{ flex: 1 }}
              />
              <button
                type="button"
                className={styles.secondaryButton}
                onClick={addDefect}
                disabled={!newDefect.trim() || isSaving}
              >
                Add Defect
              </button>
            </div>

            {defects.length > 0 && (
              <ul style={{ listStyle: 'none', padding: 0, margin: 0 }}>
                {defects.map((defect, idx) => (
                  <li
                    key={idx}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      padding: 'var(--spacing-2) var(--spacing-3)',
                      backgroundColor: 'var(--color-error-50)',
                      borderRadius: 'var(--radius-md)',
                      marginBottom: 'var(--spacing-2)',
                    }}
                  >
                    <span style={{ color: 'var(--color-error-700)' }}>
                      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" style={{ width: '16px', height: '16px', marginRight: 'var(--spacing-2)', verticalAlign: 'middle' }}>
                        <circle cx="12" cy="12" r="10" />
                        <line x1="15" y1="9" x2="9" y2="15" />
                        <line x1="9" y1="9" x2="15" y2="15" />
                      </svg>
                      {defect}
                    </span>
                    <button
                      type="button"
                      onClick={() => removeDefect(defect)}
                      disabled={isSaving}
                      style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--color-error-500)' }}
                      aria-label={`Remove defect: ${defect}`}
                    >
                      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" style={{ width: '16px', height: '16px' }}>
                        <line x1="18" y1="6" x2="6" y2="18" />
                        <line x1="6" y1="6" x2="18" y2="18" />
                      </svg>
                    </button>
                  </li>
                ))}
              </ul>
            )}

            {result === 'FAILED' && defects.length === 0 && (
              <p style={{ fontSize: 'var(--font-size-sm)', color: 'var(--color-error-500)' }}>
                At least one defect must be recorded for failed inspection
              </p>
            )}
          </div>
        )}

        {/* Notes */}
        <div className={styles.formSection} style={{ marginBottom: 'var(--spacing-6)' }}>
          <h2 className={styles.formSectionTitle}>Inspection Notes</h2>
          <textarea
            className={styles.formTextarea}
            placeholder="Add any additional notes about this inspection..."
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            disabled={isSaving}
            rows={4}
          />
        </div>

        {/* Form Actions */}
        <div className={styles.formActions}>
          <button
            type="button"
            className={styles.secondaryButton}
            onClick={() => navigate('/procurement/receiving')}
            disabled={isSaving}
          >
            Cancel
          </button>
          <button
            type="submit"
            className={styles.primaryButton}
            disabled={isSaving || !result}
            style={{
              backgroundColor: result ? getResultColor(result) : undefined,
            }}
          >
            {isSaving ? 'Submitting...' : `Submit ${result ? formatStatus(result) : 'Result'}`}
          </button>
        </div>
      </form>
    </div>
  );
}

export default InspectionForm;
