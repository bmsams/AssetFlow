import React, { useState } from 'react';
import type { AnyAssetDetail } from '../../types/asset';
import type { TransitionAction, TransitionFormData } from './StateTransitionDialog';
import styles from './WorkflowForms.module.css';

/**
 * Maintenance form data structure
 */
export interface MaintenanceFormData extends TransitionFormData {
  maintenanceType: 'REPAIR' | 'PREVENTIVE' | 'UPGRADE' | 'INSPECTION';
  requestDate: string;
  scheduledDate?: string;
  estimatedCompletionDate?: string;
  priority: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
  maintainerType: 'INTERNAL' | 'VENDOR';
  vendorId?: string;
  vendorName?: string;
  internalTechnicianId?: string;
  internalTechnicianName?: string;
  description: string;
  workOrderNumber?: string;
  estimatedCost?: number;
}

/**
 * Vendor option type
 */
interface VendorOption {
  id: string;
  name: string;
  type: string;
}

/**
 * Technician option type
 */
interface TechnicianOption {
  id: string;
  name: string;
  department: string;
}

export interface MaintenanceFormProps {
  /** Asset being transitioned */
  asset: AnyAssetDetail;
  /** Transition action details */
  transition: TransitionAction;
  /** Callback when form is submitted */
  onSubmit: (data: MaintenanceFormData) => void;
  /** Callback when form is cancelled */
  onCancel: () => void;
  /** Whether parent dialog is currently submitting */
  isSubmitting?: boolean;
  /** Error message from parent submission */
  error?: string | null;
}

/**
 * MaintenanceForm component for asset maintenance workflow
 * 
 * Implements Task 19.1.5: Create MaintenanceForm.tsx for maintenance workflow
 */
export function MaintenanceForm({
  asset,
  transition,
  onSubmit,
  onCancel,
  isSubmitting = false,
  error = null,
}: MaintenanceFormProps) {
  // Form state
  const [maintenanceType, setMaintenanceType] = useState<'REPAIR' | 'PREVENTIVE' | 'UPGRADE' | 'INSPECTION'>('REPAIR');
  const [requestDate, setRequestDate] = useState(
    new Date().toISOString().split('T')[0]
  );
  const [scheduledDate, setScheduledDate] = useState('');
  const [estimatedCompletionDate, setEstimatedCompletionDate] = useState('');
  const [priority, setPriority] = useState<'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL'>('MEDIUM');
  const [maintainerType, setMaintainerType] = useState<'INTERNAL' | 'VENDOR'>('INTERNAL');
  const [vendorId, setVendorId] = useState('');
  const [internalTechnicianId, setInternalTechnicianId] = useState('');
  const [description, setDescription] = useState('');
  const [workOrderNumber, setWorkOrderNumber] = useState('');
  const [estimatedCost, setEstimatedCost] = useState<string>('');
  const [notes, setNotes] = useState('');
  const [reason, setReason] = useState('');

  // Mock data for dropdown options
  // In a real implementation, these would be fetched from an API
  const vendors: VendorOption[] = [
    { id: 'vendor-1', name: 'TechRepair Solutions', type: 'REPAIR' },
    { id: 'vendor-2', name: 'ABC Maintenance Services', type: 'MAINTENANCE' },
    { id: 'vendor-3', name: 'ElectroFix Inc.', type: 'REPAIR' },
    { id: 'vendor-4', name: 'Premium Hardware Support', type: 'SUPPORT' },
  ];
  
  const technicians: TechnicianOption[] = [
    { id: 'tech-1', name: 'Robert Johnson', department: 'IT Support' },
    { id: 'tech-2', name: 'Maria Garcia', department: 'IT Support' },
    { id: 'tech-3', name: 'David Chen', department: 'Facilities' },
    { id: 'tech-4', name: 'Jessica Williams', department: 'Hardware Support' },
  ];

  // Handle form submission
  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (isSubmitting) return;

    const selectedVendor = vendors.find(v => v.id === vendorId);
    const selectedTechnician = technicians.find(t => t.id === internalTechnicianId);

    const maintenanceData: MaintenanceFormData = {
      assetId: asset.assetId,
      fromStatus: asset.status,
      toStatus: transition.toStatus,
      maintenanceType,
      requestDate,
      scheduledDate: scheduledDate || undefined,
      estimatedCompletionDate: estimatedCompletionDate || undefined,
      priority,
      maintainerType,
      vendorId: maintainerType === 'VENDOR' ? vendorId : undefined,
      vendorName: maintainerType === 'VENDOR' && selectedVendor ? selectedVendor.name : undefined,
      internalTechnicianId: maintainerType === 'INTERNAL' ? internalTechnicianId : undefined,
      internalTechnicianName: maintainerType === 'INTERNAL' && selectedTechnician ? selectedTechnician.name : undefined,
      description,
      workOrderNumber: workOrderNumber || undefined,
      estimatedCost: estimatedCost ? parseFloat(estimatedCost) : undefined,
      notes,
      reason,
    };

    onSubmit(maintenanceData);
  };

  // Show critical warning for high or critical priority
  const showUrgentWarning = priority === 'HIGH' || priority === 'CRITICAL';

  return (
    <form className={styles.form} onSubmit={handleSubmit}>
      <div className={styles.header} style={{ borderColor: transition.color }}>
        <h2 className={styles.title}>
          Send to Maintenance: {asset.displayName}
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
          <h3 className={styles.sectionTitle}>Maintenance Details</h3>

          <div className={styles.formRow}>
            <div className={styles.formGroup}>
              <label htmlFor="maintenanceType" className={styles.label}>
                Maintenance Type *
              </label>
              <select
                id="maintenanceType"
                className={styles.select}
                value={maintenanceType}
                onChange={(e) => setMaintenanceType(e.target.value as any)}
                required
              >
                <option value="REPAIR">Repair</option>
                <option value="PREVENTIVE">Preventive Maintenance</option>
                <option value="UPGRADE">Upgrade or Enhancement</option>
                <option value="INSPECTION">Inspection</option>
              </select>
            </div>

            <div className={styles.formGroup}>
              <label htmlFor="priority" className={styles.label}>
                Priority *
              </label>
              <select
                id="priority"
                className={styles.select}
                value={priority}
                onChange={(e) => setPriority(e.target.value as any)}
                required
              >
                <option value="LOW">Low</option>
                <option value="MEDIUM">Medium</option>
                <option value="HIGH">High</option>
                <option value="CRITICAL">Critical</option>
              </select>
            </div>
          </div>

          {showUrgentWarning && (
            <div className={styles.warningMessage}>
              <span className="material-icons">priority_high</span>
              <span>High priority maintenance may require expedited processing.</span>
            </div>
          )}

          <div className={styles.formRow}>
            <div className={styles.formGroup}>
              <label htmlFor="requestDate" className={styles.label}>
                Request Date *
              </label>
              <input
                type="date"
                id="requestDate"
                className={styles.input}
                value={requestDate}
                onChange={(e) => setRequestDate(e.target.value)}
                required
              />
            </div>

            <div className={styles.formGroup}>
              <label htmlFor="scheduledDate" className={styles.label}>
                Scheduled Date
              </label>
              <input
                type="date"
                id="scheduledDate"
                className={styles.input}
                value={scheduledDate}
                onChange={(e) => setScheduledDate(e.target.value)}
              />
            </div>
          </div>

          <div className={styles.formGroup}>
            <label htmlFor="estimatedCompletionDate" className={styles.label}>
              Estimated Completion Date
            </label>
            <input
              type="date"
              id="estimatedCompletionDate"
              className={styles.input}
              value={estimatedCompletionDate}
              onChange={(e) => setEstimatedCompletionDate(e.target.value)}
            />
          </div>

          <div className={styles.formGroup}>
            <label htmlFor="workOrderNumber" className={styles.label}>
              Work Order Number
            </label>
            <input
              type="text"
              id="workOrderNumber"
              className={styles.input}
              value={workOrderNumber}
              onChange={(e) => setWorkOrderNumber(e.target.value)}
              placeholder="Enter work order number if available..."
            />
          </div>

          <div className={styles.formGroup}>
            <label htmlFor="description" className={styles.label}>
              Description of Issue/Work *
            </label>
            <textarea
              id="description"
              className={styles.textarea}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={3}
              placeholder="Describe the maintenance needed..."
              required
            />
          </div>
        </div>

        <div className={styles.formSection}>
          <h3 className={styles.sectionTitle}>Maintainer Information</h3>

          <div className={styles.formGroup}>
            <label htmlFor="maintainerType" className={styles.label}>
              Maintainer Type *
            </label>
            <div className={styles.checkboxGroup} style={{ marginBottom: '1rem' }}>
              <label className={styles.radioOption}>
                <input
                  type="radio"
                  name="maintainerType"
                  checked={maintainerType === 'INTERNAL'}
                  onChange={() => setMaintainerType('INTERNAL')}
                />
                <span>Internal Staff</span>
              </label>
              <label className={styles.radioOption} style={{ marginLeft: '1rem' }}>
                <input
                  type="radio"
                  name="maintainerType"
                  checked={maintainerType === 'VENDOR'}
                  onChange={() => setMaintainerType('VENDOR')}
                />
                <span>External Vendor</span>
              </label>
            </div>
          </div>

          {maintainerType === 'INTERNAL' ? (
            <div className={styles.formGroup}>
              <label htmlFor="internalTechnicianId" className={styles.label}>
                Assign Technician *
              </label>
              <select
                id="internalTechnicianId"
                className={styles.select}
                value={internalTechnicianId}
                onChange={(e) => setInternalTechnicianId(e.target.value)}
                required={maintainerType === 'INTERNAL'}
              >
                <option value="">Select a technician...</option>
                {technicians.map(tech => (
                  <option key={tech.id} value={tech.id}>
                    {tech.name} ({tech.department})
                  </option>
                ))}
              </select>
            </div>
          ) : (
            <div className={styles.formGroup}>
              <label htmlFor="vendorId" className={styles.label}>
                Select Vendor *
              </label>
              <select
                id="vendorId"
                className={styles.select}
                value={vendorId}
                onChange={(e) => setVendorId(e.target.value)}
                required={maintainerType === 'VENDOR'}
              >
                <option value="">Select a vendor...</option>
                {vendors.map(vendor => (
                  <option key={vendor.id} value={vendor.id}>
                    {vendor.name} ({vendor.type})
                  </option>
                ))}
              </select>
            </div>
          )}

          <div className={styles.formGroup}>
            <label htmlFor="estimatedCost" className={styles.label}>
              Estimated Cost
            </label>
            <input
              type="number"
              id="estimatedCost"
              className={styles.input}
              value={estimatedCost}
              onChange={(e) => setEstimatedCost(e.target.value)}
              placeholder="Enter estimated cost..."
              step="0.01"
              min="0"
            />
          </div>
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
              <option value="BROKEN">Broken or not functioning</option>
              <option value="SCHEDULED">Scheduled maintenance</option>
              <option value="UPGRADE">Upgrade needed</option>
              <option value="PERFORMANCE">Performance issues</option>
              <option value="SAFETY">Safety concern</option>
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
              placeholder="Enter any additional notes about this maintenance request..."
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
          {isSubmitting ? 'Processing...' : 'Send to Maintenance'}
        </button>
      </div>
    </form>
  );
}

export default MaintenanceForm;
