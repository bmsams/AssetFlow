import { useState, useCallback } from 'react';
import type { Task, TaskStatus, TaskStatusUpdate, TaskEvidence } from '../../types/task';
import styles from './TaskStatusUpdater.module.css';

export interface TaskStatusUpdaterProps {
  /** Current task */
  task: Task;
  /** Callback when status is updated */
  onStatusUpdate: (update: TaskStatusUpdate) => void;
  /** Callback to open evidence capture */
  onCaptureEvidence?: () => void;
  /** List of captured evidence */
  evidence?: TaskEvidence[];
  /** Whether the update is in progress */
  isUpdating?: boolean;
  /** Custom class name */
  className?: string;
}

/**
 * TaskStatusUpdater component for updating task status
 * Implements Requirement 13.5: Support task status updates
 */
export function TaskStatusUpdater({
  task,
  onStatusUpdate,
  onCaptureEvidence,
  evidence = [],
  isUpdating = false,
  className = '',
}: TaskStatusUpdaterProps) {
  const [notes, setNotes] = useState('');
  const [duration, setDuration] = useState<number | undefined>(task.estimatedDuration);
  const [showConfirmation, setShowConfirmation] = useState(false);
  const [pendingStatus, setPendingStatus] = useState<TaskStatus | null>(null);

  /**
   * Get available status transitions based on current status
   */
  const getAvailableTransitions = (): TaskStatus[] => {
    switch (task.status) {
      case 'pending':
        return ['in_progress', 'cancelled'];
      case 'in_progress':
        return ['completed', 'pending', 'cancelled'];
      case 'completed':
        return []; // Cannot change from completed
      case 'cancelled':
        return ['pending']; // Can reopen cancelled tasks
      default:
        return [];
    }
  };

  /**
   * Get button label for status
   */
  const getStatusLabel = (status: TaskStatus): string => {
    switch (status) {
      case 'pending':
        return 'Move to Pending';
      case 'in_progress':
        return 'Start Task';
      case 'completed':
        return 'Complete Task';
      case 'cancelled':
        return 'Cancel Task';
      default:
        return status;
    }
  };

  /**
   * Get button color for status
   */
  const getStatusButtonClass = (status: TaskStatus): string => {
    switch (status) {
      case 'in_progress':
        return styles.buttonPrimary;
      case 'completed':
        return styles.buttonSuccess;
      case 'cancelled':
        return styles.buttonDanger;
      default:
        return styles.buttonSecondary;
    }
  };

  /**
   * Handle status button click
   */
  const handleStatusClick = useCallback((status: TaskStatus) => {
    if (status === 'completed') {
      // Show confirmation for completion
      setPendingStatus(status);
      setShowConfirmation(true);
    } else {
      // Direct update for other statuses
      onStatusUpdate({
        status,
        notes: notes.trim() || undefined,
      });
    }
  }, [notes, onStatusUpdate]);

  /**
   * Confirm completion
   */
  const confirmCompletion = useCallback(() => {
    if (!pendingStatus) return;

    onStatusUpdate({
      status: pendingStatus,
      notes: notes.trim() || undefined,
      evidence: evidence.length > 0 ? evidence : undefined,
      actualDuration: duration,
    });

    setShowConfirmation(false);
    setPendingStatus(null);
    setNotes('');
  }, [pendingStatus, notes, evidence, duration, onStatusUpdate]);

  /**
   * Cancel confirmation
   */
  const cancelConfirmation = useCallback(() => {
    setShowConfirmation(false);
    setPendingStatus(null);
  }, []);

  const availableTransitions = getAvailableTransitions();

  if (availableTransitions.length === 0) {
    return (
      <div className={`${styles.statusUpdater} ${className}`}>
        <div className={styles.completedMessage}>
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14" />
            <polyline points="22 4 12 14.01 9 11.01" />
          </svg>
          <span>Task {task.status === 'completed' ? 'completed' : 'closed'}</span>
        </div>
      </div>
    );
  }

  return (
    <div className={`${styles.statusUpdater} ${className}`}>
      {/* Current status indicator */}
      <div className={styles.currentStatus}>
        <span className={styles.statusLabel}>Current Status:</span>
        <span className={`${styles.statusBadge} ${styles[`status${task.status.charAt(0).toUpperCase() + task.status.slice(1).replace('_', '')}`]}`}>
          {task.status.replace('_', ' ')}
        </span>
      </div>

      {/* Notes input */}
      <div className={styles.notesSection}>
        <label htmlFor="status-notes" className={styles.inputLabel}>
          Notes (optional)
        </label>
        <textarea
          id="status-notes"
          className={styles.notesInput}
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          placeholder="Add notes about this status change..."
          rows={2}
          disabled={isUpdating}
        />
      </div>

      {/* Evidence section (for completion) */}
      {task.status === 'in_progress' && onCaptureEvidence && (
        <div className={styles.evidenceSection}>
          <div className={styles.evidenceHeader}>
            <span className={styles.inputLabel}>Evidence ({evidence.length})</span>
            <button
              type="button"
              className={styles.addEvidenceButton}
              onClick={onCaptureEvidence}
              disabled={isUpdating}
              data-testid="add-evidence-button"
            >
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z" />
                <circle cx="12" cy="13" r="4" />
              </svg>
              Add Photo
            </button>
          </div>

          {evidence.length > 0 && (
            <div className={styles.evidenceList}>
              {evidence.map((item) => (
                <div key={item.id} className={styles.evidenceItem}>
                  <img 
                    src={item.data} 
                    alt={item.notes || 'Evidence photo'} 
                    className={styles.evidenceThumbnail}
                  />
                  {item.notes && (
                    <span className={styles.evidenceNotes}>{item.notes}</span>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Status action buttons */}
      <div className={styles.actionButtons}>
        {availableTransitions.map((status) => (
          <button
            key={status}
            type="button"
            className={`${styles.statusButton} ${getStatusButtonClass(status)}`}
            onClick={() => handleStatusClick(status)}
            disabled={isUpdating}
            data-testid={`status-button-${status}`}
          >
            {isUpdating ? (
              <span className={styles.buttonSpinner} />
            ) : (
              getStatusLabel(status)
            )}
          </button>
        ))}
      </div>

      {/* Completion confirmation modal */}
      {showConfirmation && (
        <div className={styles.confirmationOverlay} role="dialog" aria-modal="true">
          <div className={styles.confirmationModal}>
            <h3 className={styles.confirmationTitle}>Complete Task?</h3>
            <p className={styles.confirmationText}>
              Are you sure you want to mark this task as completed?
            </p>

            {/* Duration input */}
            <div className={styles.durationSection}>
              <label htmlFor="actual-duration" className={styles.inputLabel}>
                Actual Duration (minutes)
              </label>
              <input
                id="actual-duration"
                type="number"
                className={styles.durationInput}
                value={duration || ''}
                onChange={(e) => setDuration(e.target.value ? parseInt(e.target.value, 10) : undefined)}
                min={1}
                placeholder={task.estimatedDuration?.toString() || 'Enter duration'}
              />
            </div>

            {/* Evidence summary */}
            {evidence.length > 0 && (
              <p className={styles.evidenceSummary}>
                {evidence.length} photo{evidence.length !== 1 ? 's' : ''} will be attached as evidence.
              </p>
            )}

            <div className={styles.confirmationActions}>
              <button
                type="button"
                className={styles.cancelConfirmButton}
                onClick={cancelConfirmation}
              >
                Cancel
              </button>
              <button
                type="button"
                className={styles.confirmCompleteButton}
                onClick={confirmCompletion}
                data-testid="confirm-complete-button"
              >
                Complete Task
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default TaskStatusUpdater;
