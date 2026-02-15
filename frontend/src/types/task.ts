/**
 * Task types for the Asset Management System
 * Implements Requirements 13.4, 13.5, 13.7: Mobile task management
 */

/**
 * Task status states
 * Implements Requirement 13.5: Support task status updates
 */
export type TaskStatus = 'pending' | 'in_progress' | 'completed' | 'cancelled';

/**
 * Task priority levels
 */
export type TaskPriority = 'low' | 'medium' | 'high' | 'urgent';

/**
 * Task type categories
 */
export type TaskType = 
  | 'maintenance'
  | 'audit'
  | 'installation'
  | 'repair'
  | 'inspection'
  | 'disposal'
  | 'transfer'
  | 'other';

/**
 * Evidence type for task completion
 * Implements Requirement 13.7: Capture completion evidence (photos)
 */
export interface TaskEvidence {
  /** Unique identifier for the evidence */
  id: string;
  /** Type of evidence */
  type: 'photo' | 'signature' | 'document';
  /** URL or base64 data of the evidence */
  data: string;
  /** Filename for the evidence */
  filename: string;
  /** MIME type of the evidence */
  mimeType: string;
  /** Timestamp when evidence was captured */
  capturedAt: string;
  /** Optional notes about the evidence */
  notes?: string;
}

/**
 * Task assignment information
 */
export interface TaskAssignment {
  /** User ID of the assignee */
  userId: string;
  /** Display name of the assignee */
  userName: string;
  /** Email of the assignee */
  userEmail?: string;
  /** Timestamp when assigned */
  assignedAt: string;
}

/**
 * Related asset information for a task
 */
export interface TaskAsset {
  /** Asset ID */
  assetId: string;
  /** Asset tag */
  assetTag: string;
  /** Display name */
  displayName: string;
  /** Asset type */
  assetType: 'HARDWARE' | 'SOFTWARE' | 'ENTERPRISE';
  /** Current status */
  status: string;
  /** Location */
  location?: string;
}

/**
 * Task entity
 * Implements Requirement 13.4: Display assigned tasks with completion workflows
 */
export interface Task {
  /** Unique identifier */
  id: string;
  /** Task title */
  title: string;
  /** Task description */
  description: string;
  /** Task type */
  type: TaskType;
  /** Current status */
  status: TaskStatus;
  /** Priority level */
  priority: TaskPriority;
  /** Assignment information */
  assignedTo: TaskAssignment;
  /** Related asset */
  asset?: TaskAsset;
  /** Due date */
  dueDate: string;
  /** Scheduled date */
  scheduledDate?: string;
  /** Completion date */
  completedAt?: string;
  /** Completion notes */
  completionNotes?: string;
  /** Evidence collected for completion */
  evidence: TaskEvidence[];
  /** Work order ID if associated */
  workOrderId?: string;
  /** Estimated duration in minutes */
  estimatedDuration?: number;
  /** Actual duration in minutes */
  actualDuration?: number;
  /** Location for the task */
  location?: string;
  /** Instructions for completing the task */
  instructions?: string;
  /** Required parts or materials */
  requiredParts?: string[];
  /** Created timestamp */
  createdAt: string;
  /** Last updated timestamp */
  updatedAt: string;
}

/**
 * Task filter options
 */
export interface TaskFilter {
  /** Filter by status */
  status?: TaskStatus | TaskStatus[];
  /** Filter by priority */
  priority?: TaskPriority | TaskPriority[];
  /** Filter by type */
  type?: TaskType | TaskType[];
  /** Filter by due date range */
  dueDateFrom?: string;
  dueDateTo?: string;
  /** Search query */
  searchQuery?: string;
}

/**
 * Task sort options
 */
export type TaskSortField = 'dueDate' | 'priority' | 'status' | 'createdAt' | 'title';
export type TaskSortDirection = 'asc' | 'desc';

export interface TaskSort {
  field: TaskSortField;
  direction: TaskSortDirection;
}

/**
 * Task status update request
 * Implements Requirement 13.5: Support task status updates
 */
export interface TaskStatusUpdate {
  /** New status */
  status: TaskStatus;
  /** Notes for the status change */
  notes?: string;
  /** Evidence for completion */
  evidence?: TaskEvidence[];
  /** Actual duration in minutes */
  actualDuration?: number;
}

/**
 * Camera capture options for evidence
 * Implements Requirement 13.7: Capture completion evidence (photos)
 */
export interface CameraCaptureOptions {
  /** Quality of the captured image (0-1) */
  quality?: number;
  /** Maximum width of the captured image */
  maxWidth?: number;
  /** Maximum height of the captured image */
  maxHeight?: number;
  /** Whether to use front or back camera */
  facingMode?: 'user' | 'environment';
}

/**
 * Default camera capture options
 */
export const DEFAULT_CAMERA_OPTIONS: CameraCaptureOptions = {
  quality: 0.8,
  maxWidth: 1920,
  maxHeight: 1080,
  facingMode: 'environment',
};

/**
 * Task statistics
 */
export interface TaskStats {
  total: number;
  pending: number;
  inProgress: number;
  completed: number;
  overdue: number;
}
