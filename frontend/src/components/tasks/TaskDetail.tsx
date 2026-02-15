import { useState, useCallback } from 'react';
import type { Task, TaskStatusUpdate, TaskEvidence } from '../../types/task';
import { TaskStatusUpdater } from './TaskStatusUpdater';
import { EvidenceCapture } from './EvidenceCapture';
import { formatTaskType, isTaskOverdue } from './mockData';
import styles from './TaskDetail.module.css';

export interface TaskDetailProps {
  /** Task to display */
  task: Task;
  /** Callback when task status is updated */
  onStatusUpdate: (taskId: string, update: TaskStatusUpdate) => void;
  /** Callback to go back */
  onBack?: () => void;
  /** Whether the update is in progress */
  isUpdating?: boolean;
  /** Custom class name */
  className?: string;
}

/**
 * TaskDetail component for displaying full task details with completion workflow
 * Implements Requirements 13.4, 13.5, 13.7: Task display, status updates, and evidence capture
 */
export function TaskDetail({
  task,
  onStatusUpdate,
  onBack,
  isUpdating = false,
  className = '',
}: TaskDetailProps) {
  const [showEvidenceCapture, setShowEvidenceCapture] = useState(false);
  const [capturedEvidence, setCapturedEvidence] = useState<TaskEvidence[]>([]);

  const isOverdue = isTaskOverdue(task);

  /**
   * Handle evidence capture
   */
  const handleEvidenceCapture = useCallback((evidence: TaskEvidence) => {
    setCapturedEvidence((prev) => [...prev, evidence]);
    setShowEvidenceCapture(false);
  }, []);

  /**
   * Handle status update
   */
  const handleStatusUpdate = useCallback((update: TaskStatusUpdate) => {
    // Include captured evidence in the update
    const fullUpdate: TaskStatusUpdate = {
      ...update,
      evidence: update.evidence || capturedEvidence.length > 0 ? [...(update.evidence || []), ...capturedEvidence] : undefined,
    };
    onStatusUpdate(task.id, fullUpdate);
    
    // Clear captured evidence after successful update
    if (update.status === 'completed') {
      setCapturedEvidence([]);
    }
  }, [task.id, capturedEvidence, onStatusUpdate]);

  /**
   * Format date for display
   */
  const formatDate = (dateString: string): string => {
    return new Date(dateString).toLocaleDateString('en-US', {
      weekday: 'short',
      month: 'short',
      day: 'numeric',
      hour: 'numeric',
      minute: '2-digit',
    });
  };

  // Show evidence capture view
  if (showEvidenceCapture) {
    return (
      <EvidenceCapture
        onCapture={handleEvidenceCapture}
        onCancel={() => setShowEvidenceCapture(false)}
        className={className}
      />
    );
  }

  return (
    <div className={`${styles.taskDetail} ${className}`}>
      {/* Header */}
      <header className={styles.header}>
        {onBack && (
          <button
            type="button"
            className={styles.backButton}
            onClick={onBack}
            aria-label="Go back"
          >
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <polyline points="15 18 9 12 15 6" />
            </svg>
          </button>
        )}
        <div className={styles.headerContent}>
          <div className={styles.badges}>
            <span 
              className={`${styles.priorityBadge} ${styles[`priority${task.priority.charAt(0).toUpperCase() + task.priority.slice(1)}`]}`}
            >
              {task.priority}
            </span>
            <span 
              className={`${styles.statusBadge} ${styles[`status${task.status.charAt(0).toUpperCase() + task.status.slice(1).replace('_', '')}`]}`}
            >
              {task.status.replace('_', ' ')}
            </span>
            {isOverdue && (
              <span className={styles.overdueBadge}>Overdue</span>
            )}
          </div>
          <h1 className={styles.title}>{task.title}</h1>
          <span className={styles.taskType}>{formatTaskType(task.type)}</span>
        </div>
      </header>

      {/* Content */}
      <div className={styles.content}>
        {/* Description */}
        <section className={styles.section}>
          <h2 className={styles.sectionTitle}>Description</h2>
          <p className={styles.description}>{task.description}</p>
        </section>

        {/* Asset info */}
        {task.asset && (
          <section className={styles.section}>
            <h2 className={styles.sectionTitle}>Related Asset</h2>
            <div className={styles.assetCard}>
              <div className={styles.assetIcon}>
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <rect x="2" y="3" width="20" height="14" rx="2" ry="2" />
                  <line x1="8" y1="21" x2="16" y2="21" />
                  <line x1="12" y1="17" x2="12" y2="21" />
                </svg>
              </div>
              <div className={styles.assetInfo}>
                <span className={styles.assetTag}>{task.asset.assetTag}</span>
                <span className={styles.assetName}>{task.asset.displayName}</span>
                {task.asset.location && (
                  <span className={styles.assetLocation}>{task.asset.location}</span>
                )}
              </div>
            </div>
          </section>
        )}

        {/* Schedule info */}
        <section className={styles.section}>
          <h2 className={styles.sectionTitle}>Schedule</h2>
          <div className={styles.scheduleGrid}>
            <div className={styles.scheduleItem}>
              <span className={styles.scheduleLabel}>Due Date</span>
              <span className={`${styles.scheduleValue} ${isOverdue ? styles.overdue : ''}`}>
                {formatDate(task.dueDate)}
              </span>
            </div>
            {task.scheduledDate && (
              <div className={styles.scheduleItem}>
                <span className={styles.scheduleLabel}>Scheduled</span>
                <span className={styles.scheduleValue}>{formatDate(task.scheduledDate)}</span>
              </div>
            )}
            {task.estimatedDuration && (
              <div className={styles.scheduleItem}>
                <span className={styles.scheduleLabel}>Est. Duration</span>
                <span className={styles.scheduleValue}>{task.estimatedDuration} minutes</span>
              </div>
            )}
            {task.completedAt && (
              <div className={styles.scheduleItem}>
                <span className={styles.scheduleLabel}>Completed</span>
                <span className={styles.scheduleValue}>{formatDate(task.completedAt)}</span>
              </div>
            )}
          </div>
        </section>

        {/* Location */}
        {task.location && (
          <section className={styles.section}>
            <h2 className={styles.sectionTitle}>Location</h2>
            <div className={styles.locationCard}>
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z" />
                <circle cx="12" cy="10" r="3" />
              </svg>
              <span>{task.location}</span>
            </div>
          </section>
        )}

        {/* Instructions */}
        {task.instructions && (
          <section className={styles.section}>
            <h2 className={styles.sectionTitle}>Instructions</h2>
            <div className={styles.instructions}>
              {task.instructions.split('\n').map((line, index) => (
                <p key={index} className={styles.instructionLine}>{line}</p>
              ))}
            </div>
          </section>
        )}

        {/* Required parts */}
        {task.requiredParts && task.requiredParts.length > 0 && (
          <section className={styles.section}>
            <h2 className={styles.sectionTitle}>Required Parts</h2>
            <ul className={styles.partsList}>
              {task.requiredParts.map((part, index) => (
                <li key={index} className={styles.partItem}>
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14" />
                    <polyline points="22 4 12 14.01 9 11.01" />
                  </svg>
                  {part}
                </li>
              ))}
            </ul>
          </section>
        )}

        {/* Existing evidence */}
        {task.evidence.length > 0 && (
          <section className={styles.section}>
            <h2 className={styles.sectionTitle}>Evidence ({task.evidence.length})</h2>
            <div className={styles.evidenceGrid}>
              {task.evidence.map((evidence) => (
                <div key={evidence.id} className={styles.evidenceItem}>
                  <img 
                    src={evidence.data} 
                    alt={evidence.notes || 'Evidence photo'} 
                    className={styles.evidenceImage}
                  />
                  {evidence.notes && (
                    <span className={styles.evidenceNotes}>{evidence.notes}</span>
                  )}
                  <span className={styles.evidenceDate}>
                    {formatDate(evidence.capturedAt)}
                  </span>
                </div>
              ))}
            </div>
          </section>
        )}

        {/* Completion notes */}
        {task.completionNotes && (
          <section className={styles.section}>
            <h2 className={styles.sectionTitle}>Completion Notes</h2>
            <p className={styles.completionNotes}>{task.completionNotes}</p>
          </section>
        )}

        {/* Assignment info */}
        <section className={styles.section}>
          <h2 className={styles.sectionTitle}>Assignment</h2>
          <div className={styles.assignmentCard}>
            <div className={styles.assigneeAvatar}>
              {task.assignedTo.userName.charAt(0).toUpperCase()}
            </div>
            <div className={styles.assigneeInfo}>
              <span className={styles.assigneeName}>{task.assignedTo.userName}</span>
              {task.assignedTo.userEmail && (
                <span className={styles.assigneeEmail}>{task.assignedTo.userEmail}</span>
              )}
              <span className={styles.assignedDate}>
                Assigned {formatDate(task.assignedTo.assignedAt)}
              </span>
            </div>
          </div>
        </section>
      </div>

      {/* Status updater */}
      <div className={styles.statusSection}>
        <TaskStatusUpdater
          task={task}
          onStatusUpdate={handleStatusUpdate}
          onCaptureEvidence={() => setShowEvidenceCapture(true)}
          evidence={capturedEvidence}
          isUpdating={isUpdating}
        />
      </div>
    </div>
  );
}

export default TaskDetail;
