/**
 * Task management components
 * Implements Requirements 13.4, 13.5, 13.7: Mobile task management
 */

export { TaskCard } from './TaskCard';
export type { TaskCardProps } from './TaskCard';

export { TaskList } from './TaskList';
export type { TaskListProps } from './TaskList';

export { TaskDetail } from './TaskDetail';
export type { TaskDetailProps } from './TaskDetail';

export { TaskStatusUpdater } from './TaskStatusUpdater';
export type { TaskStatusUpdaterProps } from './TaskStatusUpdater';

export { EvidenceCapture } from './EvidenceCapture';
export type { EvidenceCaptureProps, CameraStatus } from './EvidenceCapture';

// Re-export mock data utilities
export {
  mockTasks,
  mockTaskStats,
  mockGetTasks,
  mockGetTask,
  mockUpdateTaskStatus,
  generateEvidenceId,
  getPriorityColor,
  getStatusColor,
  formatTaskType,
  isTaskOverdue,
} from './mockData';
