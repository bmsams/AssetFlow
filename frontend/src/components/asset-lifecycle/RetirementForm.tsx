import React, { useState } from 'react';
import type { AnyAssetDetail } from '../../types/asset';
import type { TransitionAction, TransitionFormData } from './StateTransitionDialog';
import styles from './WorkflowForms.module.css';

/**
 * Retirement form data structure
 */
export interface RetirementFormData extends TransitionFormData {
  retirementDate: string;
  retirementType: 'END_OF_LIFE' | 'OBSOLETE' | 'DAMAGED' | 'LOST' | 'STOLEN' | 'OTHER';
  replacementAssetId?: string;
  replacementAssetTag?: string;
  retirementReason: string;
  financialImpact?: string;
  approvedBy?: string;
  approvedByName?: string;
  dataWiped: boolean;
  recoveredParts: boolean;
  recoveredPartsDescription?: string;
}

/**
 * Asset option type
 */
interface AssetOption {
  id: string;
  tag: string;
  name: string;
  model?: string;
}

/**
 * User option type
 */
interface UserOption {
  id: string;
  name: string;
  role: string;
}

export interface RetirementFormProps {
  /** Asset being transitioned */
  asset: AnyAssetDetail;
  /** Transition action details */
  transition: TransitionAction;
  /** Callback when form is submitted */
  onSubmit: (data: RetirementFormData) => void;
  /** Callback when form is cancelled */
  onCancel: () => void;
}

/**
 * RetirementForm component for asset retirement workflow
 * 
 * Implements Task 19.1.6: Create RetirementForm.tsx for retirement workflow
 */
export function RetirementForm({
  asset,
  transition,
  onSubmit,
  onCancel,
}: RetirementFormProps) {
  // Form state
  const [retirementDate, setRetirementDate] = useState(
    new Date().toISOString().split('T')[0]
  );
  const [retirementType, setRetirementType] = useState<'END_OF_LIFE' | 'OBSOLETE' | 'DAMAGED' | 'LOST' | 'STOLEN' | 'OTHER'>('END_OF_LIFE');
  const [replacementAssetId, setReplacementAssetId] = useState('');
  const [retirementReason, setRetirementReason] = useState('');
  const [financialImpact, setFinancialImpact] = useState('');
  const [approvedBy, setApprovedBy] = useState('');
  const [dataWiped, setDataWiped] = useState(false);
  const [recoveredParts, setRecoveredParts] = useState(false);
  const [recoveredPartsDescription, setRecoveredPartsDescription] = useState('');
  const [notes, setNotes] = useState('');
  const [reason, setReason] = useState('');

  // Mock data for dropdown options
  // In a real implementation, these would be fetched from an API
  const replacementAssets: AssetOption[] = [
    { id: 'asset-1', tag: 'HW-00123', name: 'Dell XPS 13', model: 'XPS 13 9310' },
    { id: 'asset-2', tag: 'HW-00124', name: 'Dell XPS 15', model: 'XPS 15 9510' },
    { id: 'asset-3', tag: 'HW-00125', name: 'MacBook Pro 13"', model: 'MacBook Pro 13" M1' },
    { id: 'asset-4', tag: 'HW-00126', name: 'ThinkPad X1 Carbon', model: 'X1 Carbon Gen 9' },
  ];
  
  const approvers: UserOption[] = [
    { id: 'user-1', name: 'John Smith', role: 'IT Manager' },
    { id: 'user-2', name: 'Emily Johnson', role: 'Asset Manager' },
    { id: 'user-3', name: 'Michael Davis', role: 'Procurement Manager' },
    { id: 'user-4', name: 'Sarah Wilson', role: 'Finance Director' },
  ];

  // Handle form submission
  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    const selectedAsset = replacementAssets.find(a => a.id === replacementAssetId);
    const selectedApprover = approvers.find(a => a.id === approvedBy);

    const retirementData: RetirementFormData = {
      assetId: asset.assetId,
      fromStatus: asset.status,
      toStatus: transition.toStatus,
      retirementDate,
      retirementType,
      replacementAssetId: replacementAssetId || undefined,
      replacementAssetTag: selectedAsset?.tag,
      retirementReason,
      financialImpact: financialImpact || undefined,
      approvedBy: approvedBy || undefined,
      approvedByName: selectedApprover?.name,
      dataWiped,
      recoveredParts,
      recoveredPartsDescription: recoveredParts ? recoveredPartsDescription : undefined,
      notes,
      reason,
    };

    onSubmit(retirementData);
  };

  // Show special warning for lost or stolen assets
  const showSecurityWarning = retirementType === 'LOST' || retirementType === 'STOLEN';

  return (
    <form className={styles.form} onSubmit={handleSubmit}>
      <div className={styles.header} style={{ borderColor: transition.color }}>
        <h2 className={styles.title}>
          Retire Asset: {asset.displayName}
        </h2>
        <button 
          type="button" 
          className={styles.closeButton}
          onClick={onCancel}
          aria-label="Close form"
        >
          <span className="material-icons">close</span>
        </button>
      </div>

      <div className={styles.content}>
        <p className={styles.description}>
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
          {asset.assetType === 'HARDWARE' && (
            <>
              <div className={styles.assetDetail}>
                <span className={styles.detailLabel}>Serial Number:</span>
                <span className={styles.detailValue}>{asset.serialNumber || 'N/A'}</span>
              </div>
              <div className={styles.assetDetail}>
                <span className={styles.detailLabel}>Model:</span>
                <span className={styles.detailValue}>{asset.model || 'N/A'}</span>
              </div>
            </>
          )}
          
          <div className={styles.assetDetail}>
            <span className={styles.detailLabel}>Acquisition Date:</span>
            <span className={styles.detailValue}>{asset.createdAt ? new Date(asset.createdAt).toLocaleDateString() : 'Unknown'}</span>
          </div>
          {asset.assetType === 'HARDWARE' && (
            <div className={styles.assetDetail}>
              <span className={styles.detailLabel}>Purchase Price:</span>
              <span className={styles.detailValue}>
                {asset.purchasePrice ? `$${asset.purchasePrice.toFixed(2)}` : 'Unknown'}
              </span>
            </div>
          )}
        </div>

        <div className={styles.formSection}>
          <h3 className={styles.sectionTitle}>Retirement Details</h3>

          <div className={styles.formRow}>
            <div className={styles.formGroup}>
              <label htmlFor="retirementDate" className={styles.label}>
                Retirement Date *
              </label>
              <input
                type="date"
                id="retirementDate"
                className={styles.input}
                value={retirementDate}
                onChange={(e) => setRetirementDate(e.target.value)}
                required
              />
            </div>

            <div className={styles.formGroup}>
              <label htmlFor="retirementType" className={styles.label}>
                Retirement Type *
              </label>
              <select
                id="retirementType"
                className={styles.select}
                value={retirementType}
                onChange={(e) => setRetirementType(e.target.value as any)}
                required
              >
                <option value="END_OF_LIFE">End of Life</option>
                <option value="OBSOLETE">Obsolete/Outdated</option>
                <option value="DAMAGED">Damaged Beyond Repair</option>
                <option value="LOST">Lost</option>
                <option value="STOLEN">Stolen</option>
                <option value="OTHER">Other</option>
              </select>
            </div>
          </div>

          {showSecurityWarning && (
            <div className={styles.warningMessage}>
              <span className="material-icons">security</span>
              <span>Lost or stolen assets may require security incident reporting. Please follow company security protocols.</span>
            </div>
          )}

          <div className={styles.formGroup}>
            <label htmlFor="retirementReason" className={styles.label}>
              Detailed Retirement Reason *
            </label>
            <textarea
              id="retirementReason"
              className={styles.textarea}
              value={retirementReason}
              onChange={(e) => setRetirementReason(e.target.value)}
              rows={3}
              placeholder="Provide detailed explanation for retiring this asset..."
              required
            />
          </div>

          <div className={styles.formGroup}>
            <label htmlFor="financialImpact" className={styles.label}>
              Financial Impact
            </label>
            <textarea
              id="financialImpact"
              className={styles.textarea}
              value={financialImpact}
              onChange={(e) => setFinancialImpact(e.target.value)}
              rows={2}
              placeholder="Describe any financial impact (e.g., remaining book value, write-off impact)..."
            />
          </div>
        </div>

        <div className={styles.formSection}>
          <h3 className={styles.sectionTitle}>Replacement & Approval</h3>

          <div className={styles.formGroup}>
            <label htmlFor="replacementAssetId" className={styles.label}>
              Replacement Asset
            </label>
            <select
              id="replacementAssetId"
              className={styles.select}
              value={replacementAssetId}
              onChange={(e) => setReplacementAssetId(e.target.value)}
            >
              <option value="">No replacement asset</option>
              {replacementAssets.map(asset => (
                <option key={asset.id} value={asset.id}>
                  {asset.tag} - {asset.name} ({asset.model || 'N/A'})
                </option>
              ))}
            </select>
            <p className={styles.helperText}>
              Select a replacement asset if this retirement is part of a replacement process.
            </p>
          </div>

          <div className={styles.formGroup}>
            <label htmlFor="approvedBy" className={styles.label}>
              Approved By
            </label>
            <select
              id="approvedBy"
              className={styles.select}
              value={approvedBy}
              onChange={(e) => setApprovedBy(e.target.value)}
            >
              <option value="">Select an approver...</option>
              {approvers.map(approver => (
                <option key={approver.id} value={approver.id}>
                  {approver.name} ({approver.role})
                </option>
              ))}
            </select>
          </div>
        </div>

        <div className={styles.formSection}>
          <h3 className={styles.sectionTitle}>Asset Disposition</h3>

          {asset.assetType === 'HARDWARE' && (
            <div className={styles.checkboxGroup}>
              <input
                type="checkbox"
                id="dataWiped"
                className={styles.checkbox}
                checked={dataWiped}
                onChange={(e) => setDataWiped(e.target.checked)}
              />
              <label htmlFor="dataWiped" className={styles.checkboxLabel}>
                Data has been securely wiped from this device
              </label>
            </div>
          )}

          <div className={styles.checkboxGroup}>
            <input
              type="checkbox"
              id="recoveredParts"
              className={styles.checkbox}
              checked={recoveredParts}
              onChange={(e) => setRecoveredParts(e.target.checked)}
            />
            <label htmlFor="recoveredParts" className={styles.checkboxLabel}>
              Salvageable parts have been recovered
            </label>
          </div>

          {recoveredParts && (
            <div className={styles.formGroup}>
              <label htmlFor="recoveredPartsDescription" className={styles.label}>
                Recovered Parts Description
              </label>
              <textarea
                id="recoveredPartsDescription"
                className={styles.textarea}
                value={recoveredPartsDescription}
                onChange={(e) => setRecoveredPartsDescription(e.target.value)}
                rows={2}
                placeholder="Describe which parts were recovered and their condition..."
              />
            </div>
          )}
        </div>

        <div className={styles.formSection}>
          <h3 className={styles.sectionTitle}>Additional Information</h3>

          <div className={styles.formGroup}>
            <label htmlFor="reason" className={styles.label}>
              Reason *
            </label>
            <select
              id="reason"
              className={styles.select}
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              required
            >
              <option value="">Select a reason...</option>
              <option value="LIFECYCLE">End of lifecycle</option>
              <option value="COST">Cost reduction</option>
              <option value="TECHNOLOGY">Technology refresh</option>
              <option value="COMPLIANCE">Compliance requirement</option>
              <option value="DAMAGE">Asset damage</option>
              <option value="PERFORMANCE">Poor performance</option>
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
              placeholder="Enter any additional notes about this retirement..."
            />
          </div>
        </div>
      </div>

      <div className={styles.actions}>
        <button
          type="button"
          className={styles.cancelButton}
          onClick={onCancel}
        >
          Cancel
        </button>
        <button
          type="submit"
          className={styles.confirmButton}
          style={{ backgroundColor: transition.color }}
        >
          Retire Asset
        </button>
      </div>
    </form>
  );
}

export default RetirementForm;