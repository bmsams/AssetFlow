import React, { useState } from 'react';
import type { AnyAssetDetail } from '../../types/asset';
import type { TransitionAction, TransitionFormData } from './StateTransitionDialog';
import styles from './WorkflowForms.module.css';

/**
 * Disposal form data structure
 */
export interface DisposalFormData extends TransitionFormData {
  disposalDate: string;
  disposalMethod: 'RECYCLING' | 'DONATION' | 'SALE' | 'DESTRUCTION' | 'RETURN_TO_VENDOR' | 'OTHER';
  disposalVendorId?: string;
  disposalVendorName?: string;
  disposalVendorReference?: string;
  disposalCost?: number;
  disposalRevenue?: number;
  environmentalCompliance: boolean;
  dataDestruction: boolean;
  dataDestructionMethod?: string;
  dataDestructionCertificate?: string;
  disposalProofAttached: boolean;
  approvedBy?: string;
  approvedByName?: string;
  disposalLocation?: string;
}

/**
 * Vendor option type
 */
interface VendorOption {
  id: string;
  name: string;
  type: string;
  environmentalCertification?: boolean;
}

/**
 * User option type
 */
interface UserOption {
  id: string;
  name: string;
  role: string;
}

export interface DisposalFormProps {
  /** Asset being transitioned */
  asset: AnyAssetDetail;
  /** Transition action details */
  transition: TransitionAction;
  /** Callback when form is submitted */
  onSubmit: (data: DisposalFormData) => void;
  /** Callback when form is cancelled */
  onCancel: () => void;
  /** Whether parent dialog is currently submitting */
  isSubmitting?: boolean;
  /** Error message from parent submission */
  error?: string | null;
}

/**
 * DisposalForm component for asset disposal workflow
 * 
 * Implements Task 19.1.7: Create DisposalForm.tsx for disposal workflow
 */
export function DisposalForm({
  asset,
  transition,
  onSubmit,
  onCancel,
  isSubmitting = false,
  error = null,
}: DisposalFormProps) {
  // Form state
  const [disposalDate, setDisposalDate] = useState(
    new Date().toISOString().split('T')[0]
  );
  const [disposalMethod, setDisposalMethod] = useState<'RECYCLING' | 'DONATION' | 'SALE' | 'DESTRUCTION' | 'RETURN_TO_VENDOR' | 'OTHER'>('RECYCLING');
  const [disposalVendorId, setDisposalVendorId] = useState('');
  const [disposalVendorReference, setDisposalVendorReference] = useState('');
  const [disposalCost, setDisposalCost] = useState<string>('');
  const [disposalRevenue, setDisposalRevenue] = useState<string>('');
  const [environmentalCompliance, setEnvironmentalCompliance] = useState(false);
  const [dataDestruction, setDataDestruction] = useState(false);
  const [dataDestructionMethod, setDataDestructionMethod] = useState('');
  const [dataDestructionCertificate, setDataDestructionCertificate] = useState('');
  const [disposalProofAttached, setDisposalProofAttached] = useState(false);
  const [approvedBy, setApprovedBy] = useState('');
  const [disposalLocation, setDisposalLocation] = useState('');
  const [notes, setNotes] = useState('');
  const [reason, setReason] = useState('');

  // Mock data for dropdown options
  // In a real implementation, these would be fetched from an API
  const vendors: VendorOption[] = [
    { id: 'vendor-1', name: 'GreenTech Recycling', type: 'RECYCLING', environmentalCertification: true },
    { id: 'vendor-2', name: 'SecureDestruct Inc.', type: 'DESTRUCTION', environmentalCertification: true },
    { id: 'vendor-3', name: 'TechDonations Foundation', type: 'DONATION' },
    { id: 'vendor-4', name: 'AssetBuyers LLC', type: 'SALE' },
    { id: 'vendor-5', name: 'Electronics Recyclers', type: 'RECYCLING', environmentalCertification: true },
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
    if (isSubmitting) return;

    const selectedVendor = vendors.find(v => v.id === disposalVendorId);
    const selectedApprover = approvers.find(a => a.id === approvedBy);

    const disposalData: DisposalFormData = {
      assetId: asset.assetId,
      fromStatus: asset.status,
      toStatus: transition.toStatus,
      disposalDate,
      disposalMethod,
      disposalVendorId: disposalVendorId || undefined,
      disposalVendorName: selectedVendor?.name,
      disposalVendorReference: disposalVendorReference || undefined,
      disposalCost: disposalCost ? parseFloat(disposalCost) : undefined,
      disposalRevenue: disposalRevenue ? parseFloat(disposalRevenue) : undefined,
      environmentalCompliance,
      dataDestruction,
      dataDestructionMethod: dataDestruction ? dataDestructionMethod : undefined,
      dataDestructionCertificate: dataDestruction ? dataDestructionCertificate : undefined,
      disposalProofAttached,
      approvedBy: approvedBy || undefined,
      approvedByName: selectedApprover?.name,
      disposalLocation: disposalLocation || undefined,
      notes,
      reason,
    };

    onSubmit(disposalData);
  };

  // Show data destruction section for hardware assets
  const showDataDestruction = asset.assetType === 'HARDWARE';
  
  // Filter vendors based on disposal method
  const filteredVendors = vendors.filter(
    vendor => vendor.type === disposalMethod || vendor.type === 'OTHER'
  );

  // Determine if environmentalCompliance should be checked by default
  // based on selected vendor's certification
  return (
    <form className={styles.form} onSubmit={handleSubmit}>
      <div className={styles.header} style={{ borderColor: transition.color }}>
        <h2 className={styles.title}>
          Dispose Asset: {asset.displayName}
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
                <span className={styles.detailLabel}>Model:</span>
                <span className={styles.detailValue}>{asset.model || 'N/A'}</span>
              </div>
            </>
          )}
        </div>

        <div className={styles.formSection}>
          <h3 className={styles.sectionTitle}>Disposal Details</h3>

          <div className={styles.formRow}>
            <div className={styles.formGroup}>
              <label htmlFor="disposalDate" className={styles.label}>
                Disposal Date *
              </label>
              <input
                type="date"
                id="disposalDate"
                className={styles.input}
                value={disposalDate}
                onChange={(e) => setDisposalDate(e.target.value)}
                required
              />
            </div>

            <div className={styles.formGroup}>
              <label htmlFor="disposalMethod" className={styles.label}>
                Disposal Method *
              </label>
              <select
                id="disposalMethod"
                className={styles.select}
                value={disposalMethod}
                onChange={(e) =>
                  setDisposalMethod(
                    e.target.value as 'RECYCLING' | 'DONATION' | 'SALE' | 'DESTRUCTION' | 'RETURN_TO_VENDOR' | 'OTHER'
                  )
                }
                required
              >
                <option value="RECYCLING">Recycling</option>
                <option value="DONATION">Donation</option>
                <option value="SALE">Sale</option>
                <option value="DESTRUCTION">Destruction</option>
                <option value="RETURN_TO_VENDOR">Return to Vendor</option>
                <option value="OTHER">Other</option>
              </select>
            </div>
          </div>

          <div className={styles.formGroup}>
            <label htmlFor="disposalVendorId" className={styles.label}>
              Disposal Vendor/Recipient
            </label>
            <select
              id="disposalVendorId"
              className={styles.select}
              value={disposalVendorId}
              onChange={(e) => {
                setDisposalVendorId(e.target.value);
                // Auto-set environmental compliance if vendor has certification
                const vendor = vendors.find(v => v.id === e.target.value);
                if (vendor?.environmentalCertification) {
                  setEnvironmentalCompliance(true);
                }
              }}
            >
              <option value="">Select a vendor...</option>
              {filteredVendors.map(vendor => (
                <option key={vendor.id} value={vendor.id}>
                  {vendor.name} {vendor.environmentalCertification ? '(Certified)' : ''}
                </option>
              ))}
            </select>
          </div>

          <div className={styles.formGroup}>
            <label htmlFor="disposalVendorReference" className={styles.label}>
              Vendor Reference/Receipt Number
            </label>
            <input
              type="text"
              id="disposalVendorReference"
              className={styles.input}
              value={disposalVendorReference}
              onChange={(e) => setDisposalVendorReference(e.target.value)}
              placeholder="Enter reference or receipt number..."
            />
          </div>

          <div className={styles.formGroup}>
            <label htmlFor="disposalLocation" className={styles.label}>
              Disposal Location
            </label>
            <input
              type="text"
              id="disposalLocation"
              className={styles.input}
              value={disposalLocation}
              onChange={(e) => setDisposalLocation(e.target.value)}
              placeholder="Enter disposal location..."
            />
          </div>
        </div>

        <div className={styles.formSection}>
          <h3 className={styles.sectionTitle}>Financial Details</h3>

          <div className={styles.formRow}>
            <div className={styles.formGroup}>
              <label htmlFor="disposalCost" className={styles.label}>
                Disposal Cost
              </label>
              <input
                type="number"
                id="disposalCost"
                className={styles.input}
                value={disposalCost}
                onChange={(e) => setDisposalCost(e.target.value)}
                placeholder="Enter disposal cost..."
                step="0.01"
                min="0"
              />
              <p className={styles.helperText}>
                Enter any fees paid for disposal service.
              </p>
            </div>

            <div className={styles.formGroup}>
              <label htmlFor="disposalRevenue" className={styles.label}>
                Disposal Revenue
              </label>
              <input
                type="number"
                id="disposalRevenue"
                className={styles.input}
                value={disposalRevenue}
                onChange={(e) => setDisposalRevenue(e.target.value)}
                placeholder="Enter disposal revenue..."
                step="0.01"
                min="0"
              />
              <p className={styles.helperText}>
                Enter any revenue generated from asset sale or trade-in.
              </p>
            </div>
          </div>
        </div>

        <div className={styles.formSection}>
          <h3 className={styles.sectionTitle}>Compliance & Documentation</h3>

          <div className={styles.checkboxGroup}>
            <input
              type="checkbox"
              id="environmentalCompliance"
              className={styles.checkbox}
              checked={environmentalCompliance}
              onChange={(e) => setEnvironmentalCompliance(e.target.checked)}
            />
            <label htmlFor="environmentalCompliance" className={styles.checkboxLabel}>
              This disposal complies with environmental regulations
            </label>
          </div>

          {showDataDestruction && (
            <div className={styles.checkboxGroup}>
              <input
                type="checkbox"
                id="dataDestruction"
                className={styles.checkbox}
                checked={dataDestruction}
                onChange={(e) => setDataDestruction(e.target.checked)}
              />
              <label htmlFor="dataDestruction" className={styles.checkboxLabel}>
                Data has been permanently destroyed/wiped
              </label>
            </div>
          )}

          {showDataDestruction && dataDestruction && (
            <>
              <div className={styles.formGroup}>
                <label htmlFor="dataDestructionMethod" className={styles.label}>
                  Data Destruction Method
                </label>
                <select
                  id="dataDestructionMethod"
                  className={styles.select}
                  value={dataDestructionMethod}
                  onChange={(e) => setDataDestructionMethod(e.target.value)}
                  required={dataDestruction}
                >
                  <option value="">Select a method...</option>
                  <option value="WIPE">Software Wipe</option>
                  <option value="DEGAUSS">Degaussing</option>
                  <option value="SHRED">Physical Shredding</option>
                  <option value="CERTIFICATE">Certified Destruction</option>
                  <option value="OTHER">Other</option>
                </select>
              </div>

              <div className={styles.formGroup}>
                <label htmlFor="dataDestructionCertificate" className={styles.label}>
                  Certificate Reference
                </label>
                <input
                  type="text"
                  id="dataDestructionCertificate"
                  className={styles.input}
                  value={dataDestructionCertificate}
                  onChange={(e) => setDataDestructionCertificate(e.target.value)}
                  placeholder="Enter certificate reference number..."
                />
              </div>
            </>
          )}

          <div className={styles.checkboxGroup}>
            <input
              type="checkbox"
              id="disposalProofAttached"
              className={styles.checkbox}
              checked={disposalProofAttached}
              onChange={(e) => setDisposalProofAttached(e.target.checked)}
            />
            <label htmlFor="disposalProofAttached" className={styles.checkboxLabel}>
              Disposal proof documentation has been attached to this asset
            </label>
          </div>
        </div>

        <div className={styles.formSection}>
          <h3 className={styles.sectionTitle}>Approval & Notes</h3>

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
              <option value="END_OF_LIFE">End of lifecycle completed</option>
              <option value="POLICY">Company disposal policy</option>
              <option value="ENVIRONMENTAL">Environmental compliance</option>
              <option value="SPACE">Storage space constraints</option>
              <option value="RECYCLING_EVENT">Organization-wide recycling event</option>
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
              placeholder="Enter any additional notes about this disposal..."
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
          {isSubmitting ? 'Processing...' : 'Dispose Asset'}
        </button>
      </div>
    </form>
  );
}

export default DisposalForm;
