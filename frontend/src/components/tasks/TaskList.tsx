import { useState, useMemo, useCallback } from 'react';
import type { Task, TaskFilter, TaskSort, TaskStatus, TaskPriority } from '../../types/task';
import { TaskCard } from './TaskCard';
import { isTaskOverdue } from './mockData';
import styles from './TaskList.module.css';

export interface TaskListProps {
  /** List of tasks to display */
  tasks: Task[];
  /** Loading state */
  isLoading?: boolean;
  /** Error message */
  error?: string | null;
  /** Callback when a task is selected */
  onTaskSelect?: (task: Task) => void;
  /** Callback when task status should be updated to in_progress */
  onTaskStart?: (task: Task) => void;
  /** Callback when task should be marked complete */
  onTaskComplete?: (task: Task) => void;
  /** Whether to show filters */
  showFilters?: boolean;
  /** Initial filter state */
  initialFilter?: TaskFilter;
  /** Initial sort state */
  initialSort?: TaskSort;
  /** Custom class name */
  className?: string;
  /** Empty state message */
  emptyMessage?: string;
}

/**
 * TaskList component for displaying a filterable list of tasks
 * Implements Requirement 13.4: Display assigned tasks with completion workflows
 */
export function TaskList({
  tasks,
  isLoading = false,
  error = null,
  onTaskSelect,
  onTaskStart,
  onTaskComplete,
  showFilters = true,
  initialFilter = {},
  initialSort = { field: 'dueDate', direction: 'asc' },
  className = '',
  emptyMessage = 'No tasks found',
}: TaskListProps) {
  const [filter, setFilter] = useState<TaskFilter>(initialFilter);
  const [sort, setSort] = useState<TaskSort>(initialSort);

  // Filter tasks
  const filteredTasks = useMemo(() => {
    return tasks.filter((task) => {
      // Status filter
      if (filter.status) {
        const statuses = Array.isArray(filter.status) ? filter.status : [filter.status];
        if (!statuses.includes(task.status)) return false;
      }

      // Priority filter
      if (filter.priority) {
        const priorities = Array.isArray(filter.priority) ? filter.priority : [filter.priority];
        if (!priorities.includes(task.priority)) return false;
      }

      // Type filter
      if (filter.type) {
        const types = Array.isArray(filter.type) ? filter.type : [filter.type];
        if (!types.includes(task.type)) return false;
      }

      // Search query
      if (filter.searchQuery) {
        const query = filter.searchQuery.toLowerCase();
        const matchesTitle = task.title.toLowerCase().includes(query);
        const matchesDescription = task.description.toLowerCase().includes(query);
        const matchesAsset = task.asset?.assetTag.toLowerCase().includes(query) || 
                            task.asset?.displayName.toLowerCase().includes(query);
        if (!matchesTitle && !matchesDescription && !matchesAsset) return false;
      }

      // Due date range
      if (filter.dueDateFrom) {
        if (new Date(task.dueDate) < new Date(filter.dueDateFrom)) return false;
      }
      if (filter.dueDateTo) {
        if (new Date(task.dueDate) > new Date(filter.dueDateTo)) return false;
      }

      return true;
    });
  }, [tasks, filter]);

  // Sort tasks
  const sortedTasks = useMemo(() => {
    const sorted = [...filteredTasks];
    
    sorted.sort((a, b) => {
      let comparison = 0;
      
      switch (sort.field) {
        case 'dueDate':
          comparison = new Date(a.dueDate).getTime() - new Date(b.dueDate).getTime();
          break;
        case 'priority': {
          const priorityOrder: Record<TaskPriority, number> = { urgent: 0, high: 1, medium: 2, low: 3 };
          comparison = priorityOrder[a.priority] - priorityOrder[b.priority];
          break;
        }
        case 'status': {
          const statusOrder: Record<TaskStatus, number> = { in_progress: 0, pending: 1, completed: 2, cancelled: 3 };
          comparison = statusOrder[a.status] - statusOrder[b.status];
          break;
        }
        case 'createdAt':
          comparison = new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime();
          break;
        case 'title':
          comparison = a.title.localeCompare(b.title);
          break;
      }
      
      return sort.direction === 'asc' ? comparison : -comparison;
    });
    
    return sorted;
  }, [filteredTasks, sort]);

  // Group tasks by status for quick stats
  const taskStats = useMemo(() => {
    return {
      total: tasks.length,
      pending: tasks.filter(t => t.status === 'pending').length,
      inProgress: tasks.filter(t => t.status === 'in_progress').length,
      completed: tasks.filter(t => t.status === 'completed').length,
      overdue: tasks.filter(t => isTaskOverdue(t)).length,
    };
  }, [tasks]);

  const handleSearchChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    setFilter(prev => ({ ...prev, searchQuery: e.target.value }));
  }, []);

  const handleStatusFilterChange = useCallback((status: TaskStatus | 'all') => {
    setFilter(prev => ({
      ...prev,
      status: status === 'all' ? undefined : status,
    }));
  }, []);

  const handleSortChange = useCallback((field: TaskSort['field']) => {
    setSort(prev => ({
      field,
      direction: prev.field === field && prev.direction === 'asc' ? 'desc' : 'asc',
    }));
  }, []);

  const clearFilters = useCallback(() => {
    setFilter({});
  }, []);

  const hasActiveFilters = filter.status || filter.priority || filter.type || filter.searchQuery;

  if (error) {
    return (
      <div className={`${styles.taskList} ${className}`} role="alert">
        <div className={styles.errorState}>
          <svg className={styles.errorIcon} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <circle cx="12" cy="12" r="10" />
            <line x1="12" y1="8" x2="12" y2="12" />
            <line x1="12" y1="16" x2="12.01" y2="16" />
          </svg>
          <p>{error}</p>
        </div>
      </div>
    );
  }

  return (
    <div className={`${styles.taskList} ${className}`}>
      {/* Stats bar */}
      <div className={styles.statsBar} role="status" aria-label="Task statistics">
        <div className={styles.statItem}>
          <span className={styles.statValue}>{taskStats.total}</span>
          <span className={styles.statLabel}>Total</span>
        </div>
        <div className={styles.statItem}>
          <span className={`${styles.statValue} ${styles.statPending}`}>{taskStats.pending}</span>
          <span className={styles.statLabel}>Pending</span>
        </div>
        <div className={styles.statItem}>
          <span className={`${styles.statValue} ${styles.statInProgress}`}>{taskStats.inProgress}</span>
          <span className={styles.statLabel}>In Progress</span>
        </div>
        <div className={styles.statItem}>
          <span className={`${styles.statValue} ${styles.statCompleted}`}>{taskStats.completed}</span>
          <span className={styles.statLabel}>Completed</span>
        </div>
        {taskStats.overdue > 0 && (
          <div className={styles.statItem}>
            <span className={`${styles.statValue} ${styles.statOverdue}`}>{taskStats.overdue}</span>
            <span className={styles.statLabel}>Overdue</span>
          </div>
        )}
      </div>

      {/* Filters */}
      {showFilters && (
        <div className={styles.filterSection}>
          {/* Search */}
          <div className={styles.searchWrapper}>
            <svg className={styles.searchIcon} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <circle cx="11" cy="11" r="8" />
              <line x1="21" y1="21" x2="16.65" y2="16.65" />
            </svg>
            <input
              type="search"
              className={styles.searchInput}
              placeholder="Search tasks..."
              value={filter.searchQuery || ''}
              onChange={handleSearchChange}
              aria-label="Search tasks"
            />
          </div>

          {/* Quick filters */}
          <div className={styles.quickFilters} role="group" aria-label="Filter by status">
            <button
              type="button"
              className={`${styles.filterChip} ${!filter.status ? styles.filterChipActive : ''}`}
              onClick={() => handleStatusFilterChange('all')}
            >
              All
            </button>
            <button
              type="button"
              className={`${styles.filterChip} ${filter.status === 'pending' ? styles.filterChipActive : ''}`}
              onClick={() => handleStatusFilterChange('pending')}
            >
              Pending
            </button>
            <button
              type="button"
              className={`${styles.filterChip} ${filter.status === 'in_progress' ? styles.filterChipActive : ''}`}
              onClick={() => handleStatusFilterChange('in_progress')}
            >
              In Progress
            </button>
            <button
              type="button"
              className={`${styles.filterChip} ${filter.status === 'completed' ? styles.filterChipActive : ''}`}
              onClick={() => handleStatusFilterChange('completed')}
            >
              Completed
            </button>
          </div>

          {/* Sort and more filters */}
          <div className={styles.filterActions}>
            <button
              type="button"
              className={styles.sortButton}
              onClick={() => handleSortChange(sort.field)}
              aria-label={`Sort by ${sort.field}, ${sort.direction === 'asc' ? 'ascending' : 'descending'}`}
            >
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <line x1="4" y1="6" x2="20" y2="6" />
                <line x1="4" y1="12" x2="16" y2="12" />
                <line x1="4" y1="18" x2="12" y2="18" />
              </svg>
              Sort
              {sort.direction === 'asc' ? ' (Asc)' : ' (Desc)'}
            </button>

            {hasActiveFilters && (
              <button
                type="button"
                className={styles.clearButton}
                onClick={clearFilters}
                aria-label="Clear all filters"
              >
                Clear
              </button>
            )}
          </div>
        </div>
      )}

      {/* Task list */}
      <div className={styles.listContainer} role="list" aria-label="Task list">
        {isLoading ? (
          <div className={styles.loadingState}>
            <div className={styles.spinner} aria-hidden="true" />
            <p>Loading tasks...</p>
          </div>
        ) : sortedTasks.length === 0 ? (
          <div className={styles.emptyState}>
            <svg className={styles.emptyIcon} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2" />
              <rect x="9" y="3" width="6" height="4" rx="1" />
              <line x1="9" y1="12" x2="15" y2="12" />
              <line x1="9" y1="16" x2="15" y2="16" />
            </svg>
            <p>{emptyMessage}</p>
            {hasActiveFilters && (
              <button
                type="button"
                className={styles.clearFiltersButton}
                onClick={clearFilters}
              >
                Clear filters
              </button>
            )}
          </div>
        ) : (
          sortedTasks.map((task) => (
            <div key={task.id} role="listitem">
              <TaskCard
                task={task}
                onTap={onTaskSelect}
                onStart={onTaskStart}
                onComplete={onTaskComplete}
              />
            </div>
          ))
        )}
      </div>

      {/* Results count */}
      {!isLoading && sortedTasks.length > 0 && (
        <div className={styles.resultsCount} aria-live="polite">
          Showing {sortedTasks.length} of {tasks.length} tasks
        </div>
      )}
    </div>
  );
}

export default TaskList;

