import React, { useState } from 'react';
import type { AnyAssetDetail } from '../../types/asset';
import type { TransitionAction, TransitionFormData } from './StateTransitionDialog';
import styles from './WorkflowForms.module.css';

/**
 * Return form data structure
 */
export interface ReturnFormData extends TransitionFormData {
  returnDate: string;
  receivedByUserId?: string;
  receivedByName?: string;
  stockroomId?: string;
  stockroomName?: string;
  conditionRating: 'EXCELLENT' | 'GOOD' | 'FAIR' | 'POOR' | 'DAMAGED';
  conditionNotes?: string;
  needsMaintenance: boolean;
}

/**
 * Stockroom option type
 */
interface StockroomOption {
  id: string;
  name: string;
  type: string;
}

/**
 * User option type
 */
interface UserOption {
  id: string;
  name: string;
  email: string;
}

export interface ReturnFormProps {
  /** Asset being transitioned */
  asset: AnyAssetDetail;
  /** Transition action details */
  transition: TransitionAction;
  /** Callback when form is submitted */
  onSubmit: (data: ReturnFormData) => void;
  /** Callback when form is cancelled */
  onCancel: () => void;
  /** Whether parent dialog is currently submitting */
  isSubmitting?: boolean;
  /** Error message from parent submission */
  error?: string | null;
}

/**
 * ReturnForm component for asset return workflow
 * 
 * Implements Task 19.1.4: Create ReturnForm.tsx for return workflow
 */
export function ReturnForm({
  asset,
  transition,
  onSubmit,
  onCancel,
  isSubmitting = false,
  error = null,
}: ReturnFormProps) {
  // Form state
  const [returnDate, setReturnDate] = useState(
    new Date().toISOString().split('T')[0]
  );
  const [receivedByUserId, setReceivedByUserId] = useState('');
  const [receivedByName, setReceivedByName] = useState('');
  const [stockroomId, setStockroomId] = useState('');
  const [stockroomName, setStockroomName] = useState('');
  const [conditionRating, setConditionRating] = useState<'EXCELLENT' | 'GOOD' | 'FAIR' | 'POOR' | 'DAMAGED'>('GOOD');
  const [conditionNotes, setConditionNotes] = useState('');
  const [needsMaintenance, setNeedsMaintenance] = useState(false);
  const [notes, setNotes] = useState('');
  const [reason, setReason] = useState('');

  // Mock data for dropdown options
  // In a real implementation, these would be fetched from an API
  const stockrooms: StockroomOption[] = [
    { id: 'stock-1', name: 'Main Stockroom', type: 'PRIMARY' },
    { id: 'stock-2', name: 'IT Stockroom', type: 'DEPARTMENT' },
    { id: 'stock-3', name: 'East Branch Stockroom', type: 'SATELLITE' },
    { id: 'stock-4', name: 'Maintenance Room', type: 'MAINTENANCE' },
  ];
  
  const users: UserOption[] = [
    { id: 'user-1', name: 'John Smith', email: 'john.smith@example.com' },
    { id: 'user-2', name: 'Emily Johnson', email: 'emily.johnson@example.com' },
    { id: 'user-3', name: 'Michael Davis', email: 'michael.davis@example.com' },
    { id: 'user-4', name: 'Sarah Wilson', email: 'sarah.wilson@example.com' },
  ];

  // Handle form submission
  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (isSubmitting) return;

    // If needs maintenance is checked, we might want to modify the data
    // or handle this specially in the parent component
    const returnData: ReturnFormData = {
      assetId: asset.assetId,
      fromStatus: asset.status,
      toStatus: transition.toStatus,
      returnDate,
      receivedByUserId,
      receivedByName: receivedByUserId ? users.find(u => u.id === receivedByUserId)?.name || '' : '',
      stockroomId,
      stockroomName: stockroomId ? stockrooms.find(s => s.id === stockroomId)?.name || '' : '',
      conditionRating,
      conditionNotes,
      needsMaintenance,
      notes,
      reason,
    };

    onSubmit(returnData);
  };

  // Show a maintenance warning if condition is poor or damaged
  const showMaintenanceWarning = conditionRating === 'POOR' || conditionRating === 'DAMAGED';

  return (
    <form className={styles.form} onSubmit={handleSubmit}>
      <div className={styles.header} style={{ borderColor: transition.color }}>
        <h2 className={styles.title}>
          Return Asset: {asset.displayName}
        </h2>
        <button 
          type="button" 
          className={styles.closeButton}
          onClick={onCancel}
          aria-label="Close form"
          disabled={isSubmitting}
        >
          <span className="material-icons">close</span>
        </button>
      </div>

      <div className={styles.content}>
        <p className={styles.description}>
          {transition.description}
        </p>
        {error && (
          <div className={styles.errorMessage}>
            <span className="material-icons">error</span>
            <span>{error}</span>
          </div>
        )}

        <div className={styles.assetDetails}>
          <div className={styles.assetDetail}>
            <span className={styles.detailLabel}>Asset Tag:</span>
            <span className={styles.detailValue}>{asset.assetTag}</span>
          </div>
          <div className={styles.assetDetail}>
            <span className={styles.detailLabel}>Current Status:</span>
            <span className={styles.detailValue}>{asset.status}</span>
          </div>
          {asset.assetType === 'HARDWARE' && (
            <>
              <div className={styles.assetDetail}>
                <span className={styles.detailLabel}>Serial Number:</span>
                <span className={styles.detailValue}>{asset.serialNumber || 'N/A'}</span>
              </div>
              <div className={styles.assetDetail}>
                <span className={styles.detailLabel}>Assigned To:</span>
                <span className={styles.detailValue}>{asset.assignedToName || asset.assignedTo || 'N/A'}</span>
              </div>
            </>
          )}
        </div>

        <div className={styles.formSection}>
          <h3 className={styles.sectionTitle}>Return Details</h3>

          <div className={styles.formRow}>
            <div className={styles.formGroup}>
              <label htmlFor="returnDate" className={styles.label}>
                Return Date *
              </label>
              <input
                type="date"
                id="returnDate"
                className={styles.input}
                value={returnDate}
                onChange={(e) => setReturnDate(e.target.value)}
                required
              />
            </div>

            <div className={styles.formGroup}>
              <label htmlFor="stockroomId" className={styles.label}>
                Stockroom *
              </label>
              <select
                id="stockroomId"
                className={styles.select}
                value={stockroomId}
                onChange={(e) => setStockroomId(e.target.value)}
                required
              >
                <option value="">Select a stockroom...</option>
                {stockrooms.map(stockroom => (
                  <option key={stockroom.id} value={stockroom.id}>
                    {stockroom.name} ({stockroom.type})
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div className={styles.formGroup}>
            <label htmlFor="receivedByUserId" className={styles.label}>
              Received By
            </label>
            <select
              id="receivedByUserId"
              className={styles.select}
              value={receivedByUserId}
              onChange={(e) => setReceivedByUserId(e.target.value)}
            >
              <option value="">Select a user...</option>
              {users.map(user => (
                <option key={user.id} value={user.id}>
                  {user.name} ({user.email})
                </option>
              ))}
            </select>
          </div>
        </div>

        <div className={styles.formSection}>
          <h3 className={styles.sectionTitle}>Asset Condition</h3>

          <div className={styles.formGroup}>
            <label htmlFor="conditionRating" className={styles.label}>
              Condition Rating *
            </label>
            <select
              id="conditionRating"
              className={styles.select}
              value={conditionRating}
              onChange={(e) => setConditionRating(e.target.value as any)}
              required
            >
              <option value="EXCELLENT">Excellent - Like new</option>
              <option value="GOOD">Good - Minor wear</option>
              <option value="FAIR">Fair - Moderate wear, fully functional</option>
              <option value="POOR">Poor - Significant wear, needs attention</option>
              <option value="DAMAGED">Damaged - Requires repair</option>
            </select>
          </div>

          {showMaintenanceWarning && (
            <div className={styles.warningMessage}>
              <span className="material-icons">warning</span>
              <span>Asset condition indicates maintenance may be required.</span>
            </div>
          )}

          <div className={styles.formGroup}>
            <label htmlFor="conditionNotes" className={styles.label}>
              Condition Notes
            </label>
            <textarea
              id="conditionNotes"
              className={styles.textarea}
              value={conditionNotes}
              onChange={(e) => setConditionNotes(e.target.value)}
              rows={3}
              placeholder="Describe the condition of the asset in detail..."
            />
          </div>

          <div className={styles.checkboxGroup}>
            <input
              type="checkbox"
              id="needsMaintenance"
              className={styles.checkbox}
              checked={needsMaintenance}
              onChange={(e) => setNeedsMaintenance(e.target.checked)}
            />
            <label htmlFor="needsMaintenance" className={styles.checkboxLabel}>
              Asset requires maintenance before redeployment
            </label>
          </div>
        </div>

        <div className={styles.formSection}>
          <h3 className={styles.sectionTitle}>Additional Information</h3>

          <div className={styles.formGroup}>
            <label htmlFor="reason" className={styles.label}>
              Reason for Return *
            </label>
            <select
              id="reason"
              className={styles.select}
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              required
            >
              <option value="">Select a reason...</option>
              <option value="PROJECT_END">Project completed</option>
              <option value="EMPLOYEE_DEPARTURE">Employee departure</option>
              <option value="REPLACEMENT">Equipment replacement</option>
              <option value="REASSIGNMENT">Asset reassignment</option>
              <option value="TECHNICAL_ISSUE">Technical issues</option>
              <option value="OTHER">Other</option>
            </select>
          </div>

          <div className={styles.formGroup}>
            <label htmlFor="notes" className={styles.label}>
              Notes
            </label>
            <textarea
              id="notes"
              className={styles.textarea}
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              rows={3}
              placeholder="Enter any additional notes about this return..."
            />
          </div>
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
          {isSubmitting ? 'Processing...' : 'Return Asset'}
        </button>
      </div>
    </form>
  );
}

export default ReturnForm;
