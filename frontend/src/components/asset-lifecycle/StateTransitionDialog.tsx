import React, { useState } from 'react';
import type { AssetStatus, AnyAssetDetail } from '../../types/asset';
import styles from './StateTransitionDialog.module.css';

/**
 * Transition action definition
 */
export interface TransitionAction {
  fromStatus: AssetStatus;
  toStatus: AssetStatus;
  label: string;
  description: string;
  color: string;
  requiresApproval?: boolean;
}

export interface StateTransitionDialogProps {
  /** Asset being transitioned */
  asset: AnyAssetDetail;
  /** Transition action details */
  transition: TransitionAction;
  /** Whether the dialog is visible */
  isOpen: boolean;
  /** Callback when dialog is closed */
  onClose: () => void;
  /** Callback when transition is confirmed */
  onConfirm: (data: TransitionFormData) => Promise<void>;
  /** Custom form component */
  FormComponent?: React.ComponentType<{
    asset: AnyAssetDetail;
    transition: TransitionAction;
    onSubmit: (data: TransitionFormData) => void;
    onCancel: () => void;
  }>;
}

/**
 * Base data for transition forms
 */
export interface TransitionFormData {
  notes?: string;
  reason?: string;
  assetId: string;
  fromStatus: AssetStatus;
  toStatus: AssetStatus;
  [key: string]: any;
}

/**
 * StateTransitionDialog component
 * Modal dialog for asset lifecycle state transitions
 * 
 * Implements Task 19.1.2: Create StateTransitionDialog.tsx for state changes
 */
export function StateTransitionDialog({
  asset,
  transition,
  isOpen,
  onClose,
  onConfirm,
  FormComponent,
}: StateTransitionDialogProps) {
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!isOpen) {
    return null;
  }

  const handleSubmit = async (formData: TransitionFormData) => {
    setIsSubmitting(true);
    setError(null);

    try {
      await onConfirm({
        ...formData,
        assetId: asset.assetId,
        fromStatus: asset.status,
        toStatus: transition.toStatus,
      });
      onClose();
    } catch (err) {
      console.error('Transition failed:', err);
      setError(err instanceof Error ? err.message : 'Failed to complete transition');
    } finally {
      setIsSubmitting(false);
    }
  };

  // Default form if no custom form is provided
  const renderDefaultForm = () => (
    <DefaultTransitionForm
      asset={asset}
      transition={transition}
      onSubmit={handleSubmit}
      onCancel={onClose}
      isSubmitting={isSubmitting}
      error={error}
    />
  );

  return (
    <div className={styles.backdrop} onClick={onClose}>
      <div 
        className={styles.dialog}
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-labelledby="transition-dialog-title"
        aria-describedby="transition-dialog-description"
      >
        {FormComponent ? (
          <FormComponent
            asset={asset}
            transition={transition}
            onSubmit={handleSubmit}
            onCancel={onClose}
          />
        ) : (
          renderDefaultForm()
        )}
      </div>
    </div>
  );
}

interface DefaultTransitionFormProps {
  asset: AnyAssetDetail;
  transition: TransitionAction;
  onSubmit: (data: TransitionFormData) => void;
  onCancel: () => void;
  isSubmitting: boolean;
  error: string | null;
}

/**
 * Default form for state transitions
 */
function DefaultTransitionForm({
  asset,
  transition,
  onSubmit,
  onCancel,
  isSubmitting,
  error,
}: DefaultTransitionFormProps) {
  const [notes, setNotes] = useState('');
  const [reason, setReason] = useState('');

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSubmit({
      notes,
      reason,
      assetId: asset.assetId,
      fromStatus: asset.status,
      toStatus: transition.toStatus,
    });
  };

  return (
    <form className={styles.form} onSubmit={handleSubmit}>
      <div className={styles.header} style={{ borderColor: transition.color }}>
        <h2 id="transition-dialog-title" className={styles.title}>
          {transition.label} - {asset.displayName}
        </h2>
        <button 
          type="button" 
          className={styles.closeButton}
          onClick={onCancel}
          aria-label="Close dialog"
        >
          <span className="material-icons">close</span>
        </button>
      </div>

      <div className={styles.content}>
        <p id="transition-dialog-description" className={styles.description}>
          {transition.description}
        </p>

        <div className={styles.assetDetails}>
          <div className={styles.assetDetail}>
            <span className={styles.detailLabel}>Asset Tag:</span>
            <span className={styles.detailValue}>{asset.assetTag}</span>
          </div>
          <div className={styles.assetDetail}>
            <span className={styles.detailLabel}>Current Status:</span>
            <span className={styles.detailValue}>{asset.status}</span>
          </div>
          <div className={styles.assetDetail}>
            <span className={styles.detailLabel}>New Status:</span>
            <span className={styles.detailValue}>{transition.toStatus}</span>
          </div>
        </div>

        {transition.requiresApproval && (
          <div className={styles.approvalWarning}>
            <span className="material-icons">warning</span>
            <span>This action requires approval.</span>
          </div>
        )}

        <div className={styles.formFields}>
          <div className={styles.formField}>
            <label htmlFor="reason" className={styles.label}>
              Reason
            </label>
            <select
              id="reason"
              className={styles.select}
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              required
            >
              <option value="">Select a reason...</option>
              <option value="SCHEDULED">Scheduled action</option>
              <option value="REQUESTED">User requested</option>
              <option value="DAMAGED">Damaged or defective</option>
              <option value="UPGRADE">Being upgraded</option>
              <option value="LIFECYCLE">Lifecycle policy</option>
              <option value="OTHER">Other</option>
            </select>
          </div>

          <div className={styles.formField}>
            <label htmlFor="notes" className={styles.label}>
              Notes
            </label>
            <textarea
              id="notes"
              className={styles.textarea}
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              rows={4}
              placeholder="Enter additional details or notes about this transition..."
            />
          </div>

          {error && (
            <div className={styles.error}>
              <span className="material-icons">error</span>
              <span>{error}</span>
            </div>
          )}
        </div>
      </div>

      <div className={styles.actions}>
        <button
          type="button"
          className={styles.cancelButton}
          onClick={onCancel}
          disabled={isSubmitting}
        >
          Cancel
        </button>
        <button
          type="submit"
          className={styles.confirmButton}
          style={{ backgroundColor: transition.color }}
          disabled={isSubmitting}
        >
          {isSubmitting ? (
            <>
              <span className={styles.spinner} />
              Processing...
            </>
          ) : (
            transition.label
          )}
        </button>
      </div>
    </form>
  );
}

export default StateTransitionDialog;