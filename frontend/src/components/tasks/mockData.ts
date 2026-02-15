/**
 * Mock data for task management components
 * Used for development and testing
 */

import type { Task, TaskEvidence, TaskStats } from '../../types/task';

/**
 * Mock tasks for testing
 */
export const mockTasks: Task[] = [
  {
    id: 'task-001',
    title: 'Laptop Maintenance - Dell Latitude 5540',
    description: 'Perform routine maintenance including cleaning, software updates, and hardware inspection.',
    type: 'maintenance',
    status: 'pending',
    priority: 'medium',
    assignedTo: {
      userId: 'user-001',
      userName: 'John Smith',
      userEmail: 'john.smith@example.com',
      assignedAt: '2025-01-15T08:00:00Z',
    },
    asset: {
      assetId: 'asset-001',
      assetTag: 'AMS-HW-20250101-ABC123',
      displayName: 'Dell Latitude 5540 Laptop',
      assetType: 'HARDWARE',
      status: 'DEPLOYED',
      location: 'Building A, Floor 2, Room 201',
    },
    dueDate: '2025-01-20T17:00:00Z',
    scheduledDate: '2025-01-18T09:00:00Z',
    evidence: [],
    estimatedDuration: 60,
    location: 'Building A, Floor 2, Room 201',
    instructions: '1. Backup user data\n2. Run system diagnostics\n3. Clean hardware\n4. Update software\n5. Document findings',
    requiredParts: ['Cleaning kit', 'Thermal paste'],
    createdAt: '2025-01-14T10:00:00Z',
    updatedAt: '2025-01-15T08:00:00Z',
  },
  {
    id: 'task-002',
    title: 'Network Switch Inspection',
    description: 'Inspect Cisco Catalyst 9200 switch for any issues and verify connectivity.',
    type: 'inspection',
    status: 'in_progress',
    priority: 'high',
    assignedTo: {
      userId: 'user-001',
      userName: 'John Smith',
      userEmail: 'john.smith@example.com',
      assignedAt: '2025-01-14T14:00:00Z',
    },
    asset: {
      assetId: 'asset-003',
      assetTag: 'AMS-HW-20250103-GHI789',
      displayName: 'Cisco Catalyst 9200 Switch',
      assetType: 'HARDWARE',
      status: 'DEPLOYED',
      location: 'Data Center, Rack B-12',
    },
    dueDate: '2025-01-16T17:00:00Z',
    evidence: [],
    estimatedDuration: 45,
    location: 'Data Center, Rack B-12',
    instructions: '1. Check LED indicators\n2. Verify port connectivity\n3. Review logs\n4. Test failover',
    createdAt: '2025-01-13T09:00:00Z',
    updatedAt: '2025-01-15T10:30:00Z',
  },
  {
    id: 'task-003',
    title: 'HVAC Unit Repair',
    description: 'Repair HVAC unit - replace faulty compressor and test system.',
    type: 'repair',
    status: 'pending',
    priority: 'urgent',
    assignedTo: {
      userId: 'user-001',
      userName: 'John Smith',
      userEmail: 'john.smith@example.com',
      assignedAt: '2025-01-15T07:00:00Z',
    },
    asset: {
      assetId: 'asset-005',
      assetTag: 'AMS-ENT-20250105-MNO345',
      displayName: 'HVAC Unit - Building A',
      assetType: 'ENTERPRISE',
      status: 'IN_MAINTENANCE',
      location: 'Building A, Roof',
    },
    dueDate: '2025-01-16T12:00:00Z',
    evidence: [],
    workOrderId: 'WO-2025-001',
    estimatedDuration: 180,
    location: 'Building A, Roof',
    instructions: '1. Isolate power\n2. Remove old compressor\n3. Install new compressor\n4. Test system\n5. Document repair',
    requiredParts: ['Compressor unit', 'Refrigerant', 'Gaskets'],
    createdAt: '2025-01-15T06:00:00Z',
    updatedAt: '2025-01-15T07:00:00Z',
  },
  {
    id: 'task-004',
    title: 'Stockroom Audit - Stockroom A',
    description: 'Perform quarterly inventory audit of Stockroom A.',
    type: 'audit',
    status: 'completed',
    priority: 'medium',
    assignedTo: {
      userId: 'user-001',
      userName: 'John Smith',
      userEmail: 'john.smith@example.com',
      assignedAt: '2025-01-10T08:00:00Z',
    },
    dueDate: '2025-01-14T17:00:00Z',
    completedAt: '2025-01-14T15:30:00Z',
    completionNotes: 'Audit completed successfully. 2 minor discrepancies found and resolved.',
    evidence: [
      {
        id: 'evidence-001',
        type: 'photo',
        data: 'data:image/jpeg;base64,/9j/4AAQSkZJRg...',
        filename: 'stockroom-audit-001.jpg',
        mimeType: 'image/jpeg',
        capturedAt: '2025-01-14T14:00:00Z',
        notes: 'Stockroom A - Row 1',
      },
    ],
    estimatedDuration: 120,
    actualDuration: 150,
    location: 'Stockroom A',
    instructions: '1. Count all items\n2. Verify serial numbers\n3. Check condition\n4. Report discrepancies',
    createdAt: '2025-01-08T10:00:00Z',
    updatedAt: '2025-01-14T15:30:00Z',
  },
  {
    id: 'task-005',
    title: 'New Laptop Installation',
    description: 'Install and configure new HP EliteBook for new employee.',
    type: 'installation',
    status: 'pending',
    priority: 'low',
    assignedTo: {
      userId: 'user-001',
      userName: 'John Smith',
      userEmail: 'john.smith@example.com',
      assignedAt: '2025-01-15T09:00:00Z',
    },
    asset: {
      assetId: 'asset-002',
      assetTag: 'AMS-HW-20250102-DEF456',
      displayName: 'HP EliteBook 840 G9',
      assetType: 'HARDWARE',
      status: 'IN_STOCK',
      location: 'Stockroom A',
    },
    dueDate: '2025-01-22T17:00:00Z',
    scheduledDate: '2025-01-20T10:00:00Z',
    evidence: [],
    estimatedDuration: 90,
    location: 'Building B, Floor 3, Room 305',
    instructions: '1. Retrieve from stockroom\n2. Install OS and software\n3. Configure user account\n4. Deploy to user\n5. Update asset record',
    createdAt: '2025-01-15T08:30:00Z',
    updatedAt: '2025-01-15T09:00:00Z',
  },
  {
    id: 'task-006',
    title: 'Old Server Disposal',
    description: 'Securely dispose of decommissioned server following data destruction protocols.',
    type: 'disposal',
    status: 'pending',
    priority: 'medium',
    assignedTo: {
      userId: 'user-001',
      userName: 'John Smith',
      userEmail: 'john.smith@example.com',
      assignedAt: '2025-01-15T11:00:00Z',
    },
    dueDate: '2025-01-25T17:00:00Z',
    evidence: [],
    estimatedDuration: 60,
    location: 'Data Center, Rack A-05',
    instructions: '1. Verify data wipe completion\n2. Remove from rack\n3. Document serial numbers\n4. Prepare for vendor pickup\n5. Obtain destruction certificate',
    createdAt: '2025-01-15T10:00:00Z',
    updatedAt: '2025-01-15T11:00:00Z',
  },
];

/**
 * Mock task statistics
 */
export const mockTaskStats: TaskStats = {
  total: mockTasks.length,
  pending: mockTasks.filter(t => t.status === 'pending').length,
  inProgress: mockTasks.filter(t => t.status === 'in_progress').length,
  completed: mockTasks.filter(t => t.status === 'completed').length,
  overdue: mockTasks.filter(t => 
    t.status !== 'completed' && 
    t.status !== 'cancelled' && 
    new Date(t.dueDate) < new Date()
  ).length,
};

/**
 * Simulate API delay for testing
 */
export function simulateApiDelay(ms: number = 500): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Mock function to get tasks
 */
export async function mockGetTasks(): Promise<Task[]> {
  await simulateApiDelay(300);
  return [...mockTasks];
}

/**
 * Mock function to get a single task
 */
export async function mockGetTask(taskId: string): Promise<Task | null> {
  await simulateApiDelay(200);
  return mockTasks.find(t => t.id === taskId) || null;
}

/**
 * Mock function to update task status
 */
export async function mockUpdateTaskStatus(
  taskId: string, 
  status: Task['status'],
  notes?: string,
  evidence?: TaskEvidence[]
): Promise<Task | null> {
  await simulateApiDelay(300);
  const task = mockTasks.find(t => t.id === taskId);
  if (!task) return null;
  
  const updatedTask: Task = {
    ...task,
    status,
    updatedAt: new Date().toISOString(),
  };
  
  if (status === 'completed') {
    updatedTask.completedAt = new Date().toISOString();
    if (notes) updatedTask.completionNotes = notes;
    if (evidence) updatedTask.evidence = [...task.evidence, ...evidence];
  }
  
  return updatedTask;
}

/**
 * Generate a unique evidence ID
 */
export function generateEvidenceId(): string {
  return `evidence-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`;
}

/**
 * Get priority color class
 */
export function getPriorityColor(priority: Task['priority']): string {
  switch (priority) {
    case 'urgent':
      return 'danger';
    case 'high':
      return 'warning';
    case 'medium':
      return 'primary';
    case 'low':
      return 'secondary';
    default:
      return 'secondary';
  }
}

/**
 * Get status color class
 */
export function getStatusColor(status: Task['status']): string {
  switch (status) {
    case 'completed':
      return 'success';
    case 'in_progress':
      return 'primary';
    case 'pending':
      return 'warning';
    case 'cancelled':
      return 'secondary';
    default:
      return 'secondary';
  }
}

/**
 * Format task type for display
 */
export function formatTaskType(type: Task['type']): string {
  return type.charAt(0).toUpperCase() + type.slice(1).replace('_', ' ');
}

/**
 * Check if task is overdue
 */
export function isTaskOverdue(task: Task): boolean {
  if (task.status === 'completed' || task.status === 'cancelled') {
    return false;
  }
  return new Date(task.dueDate) < new Date();
}
