import { useMemo } from 'react';
import type { Task } from '../../types/task';
import { SwipeableCard, type SwipeAction } from '../layout/SwipeableCard';
import { getPriorityColor, getStatusColor, formatTaskType, isTaskOverdue } from './mockData';
import styles from './TaskCard.module.css';

export interface TaskCardProps {
  /** Task to display */
  task: Task;
  /** Callback when task is tapped */
  onTap?: (task: Task) => void;
  /** Callback when task status should be updated to in_progress */
  onStart?: (task: Task) => void;
  /** Callback when task should be marked complete */
  onComplete?: (task: Task) => void;
  /** Whether swipe actions are enabled */
  swipeEnabled?: boolean;
  /** Custom class name */
  className?: string;
}

/**
 * TaskCard component for displaying individual task information
 * Implements Requirement 13.4: Display assigned tasks with completion workflows
 */
export function TaskCard({
  task,
  onTap,
  onStart,
  onComplete,
  swipeEnabled = true,
  className = '',
}: TaskCardProps) {
  const isOverdue = useMemo(() => isTaskOverdue(task), [task]);
  
  const swipeActions = useMemo<SwipeAction[]>(() => {
    const actions: SwipeAction[] = [];
    
    if (!swipeEnabled) return actions;
    
    // Right swipe: Start task (only for pending tasks)
    if (task.status === 'pending' && onStart) {
      actions.push({
        direction: 'right',
        label: 'Start',
        color: 'primary',
        icon: (
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <polygon points="5 3 19 12 5 21 5 3" />
          </svg>
        ),
        onSwipe: () => onStart(task),
      });
    }
    
    // Left swipe: Complete task (only for in_progress tasks)
    if (task.status === 'in_progress' && onComplete) {
      actions.push({
        direction: 'left',
        label: 'Complete',
        color: 'success',
        icon: (
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <polyline points="20 6 9 17 4 12" />
          </svg>
        ),
        onSwipe: () => onComplete(task),
      });
    }
    
    return actions;
  }, [task, swipeEnabled, onStart, onComplete]);

  const formatDueDate = (dateString: string): string => {
    const date = new Date(dateString);
    const now = new Date();
    const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const startOfDue = new Date(date.getFullYear(), date.getMonth(), date.getDate()); const diffDays = Math.round((startOfDue.getTime() - startOfToday.getTime()) / (1000 * 60 * 60 * 24));
    
    if (diffDays < 0) {
      return `${Math.abs(diffDays)} day${Math.abs(diffDays) !== 1 ? 's' : ''} overdue`;
    } else if (diffDays === 0) {
      return 'Due today';
    } else if (diffDays === 1) {
      return 'Due tomorrow';
    } else if (diffDays <= 7) {
      return `Due in ${diffDays} days`;
    } else {
      return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
    }
  };

  const handleTap = () => {
    if (onTap) {
      onTap(task);
    }
  };

  return (
    <SwipeableCard
      actions={swipeActions}
      onTap={handleTap}
      className={`${styles.taskCard} ${className}`}
      disabled={!swipeEnabled && !onTap}
    >
      <article 
        className={styles.cardContent}
        aria-label={`Task: ${task.title}`}
      >
        {/* Header with priority and status */}
        <div className={styles.cardHeader}>
          <span 
            className={`${styles.priorityBadge} ${styles[`priority${task.priority.charAt(0).toUpperCase() + task.priority.slice(1)}`]}`}
            aria-label={`Priority: ${task.priority}`}
          >
            {task.priority}
          </span>
          <span 
            className={`${styles.statusBadge} ${styles[`status${task.status.charAt(0).toUpperCase() + task.status.slice(1).replace('_', '')}`]}`}
            aria-label={`Status: ${task.status.replace('_', ' ')}`}
          >
            {task.status.replace('_', ' ')}
          </span>
        </div>

        {/* Title and type */}
        <h3 className={styles.title}>{task.title}</h3>
        <span className={styles.taskType}>{formatTaskType(task.type)}</span>

        {/* Asset info if available */}
        {task.asset && (
          <div className={styles.assetInfo}>
            <svg 
              className={styles.assetIcon} 
              viewBox="0 0 24 24" 
              fill="none" 
              stroke="currentColor" 
              strokeWidth="2"
              aria-hidden="true"
            >
              <rect x="2" y="3" width="20" height="14" rx="2" ry="2" />
              <line x1="8" y1="21" x2="16" y2="21" />
              <line x1="12" y1="17" x2="12" y2="21" />
            </svg>
            <span className={styles.assetTag}>{task.asset.assetTag}</span>
          </div>
        )}

        {/* Location */}
        {task.location && (
          <div className={styles.locationInfo}>
            <svg 
              className={styles.locationIcon} 
              viewBox="0 0 24 24" 
              fill="none" 
              stroke="currentColor" 
              strokeWidth="2"
              aria-hidden="true"
            >
              <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z" />
              <circle cx="12" cy="10" r="3" />
            </svg>
            <span className={styles.locationText}>{task.location}</span>
          </div>
        )}

        {/* Footer with due date */}
        <div className={styles.cardFooter}>
          <div className={`${styles.dueDate} ${isOverdue ? styles.overdue : ''}`}>
            <svg 
              className={styles.clockIcon} 
              viewBox="0 0 24 24" 
              fill="none" 
              stroke="currentColor" 
              strokeWidth="2"
              aria-hidden="true"
            >
              <circle cx="12" cy="12" r="10" />
              <polyline points="12 6 12 12 16 14" />
            </svg>
            <span>{formatDueDate(task.dueDate)}</span>
          </div>
          
          {task.estimatedDuration && (
            <div className={styles.duration}>
              <svg 
                className={styles.durationIcon} 
                viewBox="0 0 24 24" 
                fill="none" 
                stroke="currentColor" 
                strokeWidth="2"
                aria-hidden="true"
              >
                <path d="M12 2v4M12 18v4M4.93 4.93l2.83 2.83M16.24 16.24l2.83 2.83M2 12h4M18 12h4M4.93 19.07l2.83-2.83M16.24 7.76l2.83-2.83" />
              </svg>
              <span>{task.estimatedDuration} min</span>
            </div>
          )}
        </div>

        {/* Swipe hint for actionable tasks */}
        {swipeEnabled && (task.status === 'pending' || task.status === 'in_progress') && (
          <div className={styles.swipeHint} aria-hidden="true">
            {task.status === 'pending' && onStart && (
              <span className={styles.swipeRight}>← Swipe right to start</span>
            )}
            {task.status === 'in_progress' && onComplete && (
              <span className={styles.swipeLeft}>Swipe left to complete →</span>
            )}
          </div>
        )}
      </article>
    </SwipeableCard>
  );
}

export default TaskCard;
