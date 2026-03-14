import React, { useState, useEffect } from 'react';
import type { AnyAssetDetail } from '../../types/asset';
import type { TransitionAction, TransitionFormData } from './StateTransitionDialog';
import styles from './WorkflowForms.module.css';

/**
 * Deployment form data structure
 */
export interface DeploymentFormData extends TransitionFormData {
  assignedTo: string;
  assignedToName: string;
  assignedToEmail?: string;
  departmentId: string;
  departmentName: string;
  locationId?: string;
  locationName?: string;
  deploymentDate: string;
  expectedReturnDate?: string;
  deploymentType: 'PERMANENT' | 'TEMPORARY' | 'PROJECT';
  deploymentInstructions?: string;
}

/**
 * Department option type
 */
interface DepartmentOption {
  id: string;
  name: string;
}

/**
 * Location option type
 */
interface LocationOption {
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
  departmentId?: string;
}

export interface DeploymentFormProps {
  /** Asset being transitioned */
  asset: AnyAssetDetail;
  /** Transition action details */
  transition: TransitionAction;
  /** Callback when form is submitted */
  onSubmit: (data: DeploymentFormData) => void;
  /** Callback when form is cancelled */
  onCancel: () => void;
  /** Whether parent dialog is currently submitting */
  isSubmitting?: boolean;
  /** Error message from parent submission */
  error?: string | null;
}

/**
 * DeploymentForm component for asset deployment workflow
 * 
 * Implements Task 19.1.3: Create DeploymentForm.tsx for deploy workflow
 */
export function DeploymentForm({
  asset,
  transition,
  onSubmit,
  onCancel,
  isSubmitting = false,
  error = null,
}: DeploymentFormProps) {
  // Form state
  const [assignedTo, setAssignedTo] = useState('');
  const [assignedToName, setAssignedToName] = useState('');
  const [assignedToEmail, setAssignedToEmail] = useState('');
  const [departmentId, setDepartmentId] = useState('');
  const [departmentName, setDepartmentName] = useState('');
  const [locationId, setLocationId] = useState('');
  const [locationName, setLocationName] = useState('');
  const [deploymentDate, setDeploymentDate] = useState(
    new Date().toISOString().split('T')[0]
  );
  const [expectedReturnDate, setExpectedReturnDate] = useState('');
  const [deploymentType, setDeploymentType] = useState<'PERMANENT' | 'TEMPORARY' | 'PROJECT'>('PERMANENT');
  const [deploymentInstructions, setDeploymentInstructions] = useState('');
  const [notes, setNotes] = useState('');
  const [reason, setReason] = useState('');

  // Mock data for dropdown options
  // In a real implementation, these would be fetched from an API
  const [departments, setDepartments] = useState<DepartmentOption[]>([
    { id: 'dept-1', name: 'IT Department' },
    { id: 'dept-2', name: 'Finance Department' },
    { id: 'dept-3', name: 'Operations Department' },
    { id: 'dept-4', name: 'Marketing Department' },
    { id: 'dept-5', name: 'Human Resources' },
  ]);
  const [locations, setLocations] = useState<LocationOption[]>([
    { id: 'loc-1', name: 'Headquarters - Floor 1', type: 'FLOOR' },
    { id: 'loc-2', name: 'Headquarters - Floor 2', type: 'FLOOR' },
    { id: 'loc-3', name: 'Headquarters - Server Room', type: 'ROOM' },
    { id: 'loc-4', name: 'Headquarters - Conference Room A', type: 'ROOM' },
    { id: 'loc-5', name: 'East Branch Office', type: 'BUILDING' },
  ]);
  const [users, setUsers] = useState<UserOption[]>([
    { id: 'user-1', name: 'John Smith', email: 'john.smith@example.com', departmentId: 'dept-1' },
    { id: 'user-2', name: 'Emily Johnson', email: 'emily.johnson@example.com', departmentId: 'dept-2' },
    { id: 'user-3', name: 'Michael Davis', email: 'michael.davis@example.com', departmentId: 'dept-3' },
    { id: 'user-4', name: 'Sarah Wilson', email: 'sarah.wilson@example.com', departmentId: 'dept-1' },
    { id: 'user-5', name: 'Robert Brown', email: 'robert.brown@example.com', departmentId: 'dept-4' },
  ]);

  // Filter users by department
  const filteredUsers = departmentId
    ? users.filter(user => user.departmentId === departmentId || !user.departmentId)
    : users;

  // Handle form submission
  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (isSubmitting) return;

    const deploymentData: DeploymentFormData = {
      assetId: asset.assetId,
      fromStatus: asset.status,
      toStatus: transition.toStatus,
      assignedTo,
      assignedToName,
      assignedToEmail,
      departmentId,
      departmentName,
      locationId,
      locationName,
      deploymentDate,
      expectedReturnDate: deploymentType === 'TEMPORARY' ? expectedReturnDate : undefined,
      deploymentType,
      deploymentInstructions,
      notes,
      reason,
    };

    onSubmit(deploymentData);
  };

  // Update assignedToName and Email when assignedTo changes
  useEffect(() => {
    if (assignedTo) {
      const selectedUser = users.find(user => user.id === assignedTo);
      if (selectedUser) {
        setAssignedToName(selectedUser.name);
        setAssignedToEmail(selectedUser.email);
      }
    }
  }, [assignedTo, users]);

  // Update departmentName when departmentId changes
  useEffect(() => {
    if (departmentId) {
      const selectedDepartment = departments.find(dept => dept.id === departmentId);
      if (selectedDepartment) {
        setDepartmentName(selectedDepartment.name);
      }
    }
  }, [departmentId, departments]);

  // Update locationName when locationId changes
  useEffect(() => {
    if (locationId) {
      const selectedLocation = locations.find(loc => loc.id === locationId);
      if (selectedLocation) {
        setLocationName(selectedLocation.name);
      }
    }
  }, [locationId, locations]);

  return (
    <form className={styles.form} onSubmit={handleSubmit}>
      <div className={styles.header} style={{ borderColor: transition.color }}>
        <h2 className={styles.title}>
          Deploy Asset: {asset.displayName}
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
          <h3 className={styles.sectionTitle}>Assignment Details</h3>

          <div className={styles.formRow}>
            <div className={styles.formGroup}>
              <label htmlFor="deploymentType" className={styles.label}>
                Deployment Type *
              </label>
              <select
                id="deploymentType"
                className={styles.select}
                value={deploymentType}
                onChange={(e) => setDeploymentType(e.target.value as any)}
                required
              >
                <option value="PERMANENT">Permanent</option>
                <option value="TEMPORARY">Temporary</option>
                <option value="PROJECT">Project-based</option>
              </select>
            </div>

            <div className={styles.formGroup}>
              <label htmlFor="deploymentDate" className={styles.label}>
                Deployment Date *
              </label>
              <input
                type="date"
                id="deploymentDate"
                className={styles.input}
                value={deploymentDate}
                onChange={(e) => setDeploymentDate(e.target.value)}
                required
              />
            </div>
          </div>

          {deploymentType === 'TEMPORARY' && (
            <div className={styles.formGroup}>
              <label htmlFor="expectedReturnDate" className={styles.label}>
                Expected Return Date *
              </label>
              <input
                type="date"
                id="expectedReturnDate"
                className={styles.input}
                value={expectedReturnDate}
                onChange={(e) => setExpectedReturnDate(e.target.value)}
                required
              />
            </div>
          )}

          <div className={styles.formRow}>
            <div className={styles.formGroup}>
              <label htmlFor="departmentId" className={styles.label}>
                Department *
              </label>
              <select
                id="departmentId"
                className={styles.select}
                value={departmentId}
                onChange={(e) => setDepartmentId(e.target.value)}
                required
              >
                <option value="">Select a department...</option>
                {departments.map(dept => (
                  <option key={dept.id} value={dept.id}>
                    {dept.name}
                  </option>
                ))}
              </select>
            </div>

            <div className={styles.formGroup}>
              <label htmlFor="locationId" className={styles.label}>
                Location
              </label>
              <select
                id="locationId"
                className={styles.select}
                value={locationId}
                onChange={(e) => setLocationId(e.target.value)}
              >
                <option value="">Select a location...</option>
                {locations.map(loc => (
                  <option key={loc.id} value={loc.id}>
                    {loc.name}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div className={styles.formGroup}>
            <label htmlFor="assignedTo" className={styles.label}>
              Assigned To *
            </label>
            <select
              id="assignedTo"
              className={styles.select}
              value={assignedTo}
              onChange={(e) => setAssignedTo(e.target.value)}
              required
            >
              <option value="">Select a user...</option>
              {filteredUsers.map(user => (
                <option key={user.id} value={user.id}>
                  {user.name} ({user.email})
                </option>
              ))}
            </select>
          </div>
        </div>

        <div className={styles.formSection}>
          <h3 className={styles.sectionTitle}>Additional Information</h3>

          <div className={styles.formGroup}>
            <label htmlFor="deploymentInstructions" className={styles.label}>
              Deployment Instructions
            </label>
            <textarea
              id="deploymentInstructions"
              className={styles.textarea}
              value={deploymentInstructions}
              onChange={(e) => setDeploymentInstructions(e.target.value)}
              rows={3}
              placeholder="Enter any specific instructions for this deployment..."
            />
          </div>

          <div className={styles.formRow}>
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
                <option value="NEW_HIRE">New hire</option>
                <option value="REPLACEMENT">Replacement device</option>
                <option value="UPGRADE">Hardware upgrade</option>
                <option value="PROJECT">Project allocation</option>
                <option value="OTHER">Other</option>
              </select>
            </div>
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
              placeholder="Enter any additional notes about this deployment..."
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
          {isSubmitting ? 'Processing...' : 'Deploy Asset'}
        </button>
      </div>
    </form>
  );
}

export default DeploymentForm;
