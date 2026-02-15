/**
 * Notification types for the Asset Management System
 * Implements Requirement 13.6: Mobile interface shall implement push notifications for assigned tasks and alerts
 */

/**
 * Notification permission states
 */
export type NotificationPermission = 'default' | 'granted' | 'denied';

/**
 * Notification types that can be enabled/disabled
 */
export type NotificationType =
  | 'task_assigned'
  | 'task_due_soon'
  | 'task_overdue'
  | 'asset_alert'
  | 'maintenance_due'
  | 'stock_low'
  | 'compliance_alert'
  | 'contract_expiring'
  | 'loaner_overdue'
  | 'system_alert';

/**
 * Notification priority levels
 */
export type NotificationPriority = 'low' | 'normal' | 'high' | 'urgent';

/**
 * Notification action types
 */
export type NotificationActionType = 
  | 'view_task'
  | 'view_asset'
  | 'view_alert'
  | 'dismiss'
  | 'snooze';

/**
 * Notification action definition
 */
export interface NotificationAction {
  /** Action identifier */
  action: NotificationActionType;
  /** Display title for the action */
  title: string;
  /** Optional icon for the action */
  icon?: string;
}

/**
 * Push notification payload
 */
export interface PushNotificationPayload {
  /** Unique notification identifier */
  id: string;
  /** Notification type */
  type: NotificationType;
  /** Notification title */
  title: string;
  /** Notification body text */
  body: string;
  /** Optional icon URL */
  icon?: string;
  /** Optional badge URL */
  badge?: string;
  /** Optional image URL */
  image?: string;
  /** Notification priority */
  priority: NotificationPriority;
  /** Timestamp when notification was created */
  timestamp: string;
  /** Optional tag for grouping notifications */
  tag?: string;
  /** Whether notification requires interaction */
  requireInteraction?: boolean;
  /** Available actions */
  actions?: NotificationAction[];
  /** Custom data payload */
  data?: {
    /** URL to navigate to when notification is clicked */
    url?: string;
    /** Related entity ID (task, asset, etc.) */
    entityId?: string;
    /** Related entity type */
    entityType?: 'task' | 'asset' | 'alert' | 'contract' | 'maintenance';
    /** Additional custom data */
    [key: string]: unknown;
  };
}

/**
 * Notification preference for a specific type
 */
export interface NotificationTypePreference {
  /** Notification type */
  type: NotificationType;
  /** Display name for the notification type */
  displayName: string;
  /** Description of what triggers this notification */
  description: string;
  /** Whether this notification type is enabled */
  enabled: boolean;
  /** Whether to show as push notification */
  push: boolean;
  /** Whether to show in-app notification */
  inApp: boolean;
  /** Whether to send email notification */
  email: boolean;
}

/**
 * User notification preferences
 * Implements Requirement 17.2: Allow users to configure notification preferences per event type
 */
export interface NotificationPreferences {
  /** Whether push notifications are enabled globally */
  pushEnabled: boolean;
  /** Whether in-app notifications are enabled globally */
  inAppEnabled: boolean;
  /** Whether email notifications are enabled globally */
  emailEnabled: boolean;
  /** Whether to show notification badges */
  showBadges: boolean;
  /** Whether to play notification sounds */
  playSound: boolean;
  /** Quiet hours start time (HH:mm format) */
  quietHoursStart?: string;
  /** Quiet hours end time (HH:mm format) */
  quietHoursEnd?: string;
  /** Per-type preferences */
  typePreferences: NotificationTypePreference[];
}

/**
 * Default notification type preferences
 */
export const DEFAULT_TYPE_PREFERENCES: NotificationTypePreference[] = [
  {
    type: 'task_assigned',
    displayName: 'Task Assigned',
    description: 'When a new task is assigned to you',
    enabled: true,
    push: true,
    inApp: true,
    email: true,
  },
  {
    type: 'task_due_soon',
    displayName: 'Task Due Soon',
    description: 'When a task is due within 24 hours',
    enabled: true,
    push: true,
    inApp: true,
    email: false,
  },
  {
    type: 'task_overdue',
    displayName: 'Task Overdue',
    description: 'When a task becomes overdue',
    enabled: true,
    push: true,
    inApp: true,
    email: true,
  },
  {
    type: 'asset_alert',
    displayName: 'Asset Alerts',
    description: 'Important alerts about assets you manage',
    enabled: true,
    push: true,
    inApp: true,
    email: false,
  },
  {
    type: 'maintenance_due',
    displayName: 'Maintenance Due',
    description: 'When scheduled maintenance is due',
    enabled: true,
    push: true,
    inApp: true,
    email: true,
  },
  {
    type: 'stock_low',
    displayName: 'Low Stock Alert',
    description: 'When inventory falls below threshold',
    enabled: true,
    push: false,
    inApp: true,
    email: true,
  },
  {
    type: 'compliance_alert',
    displayName: 'Compliance Alert',
    description: 'License compliance issues detected',
    enabled: true,
    push: true,
    inApp: true,
    email: true,
  },
  {
    type: 'contract_expiring',
    displayName: 'Contract Expiring',
    description: 'When a contract is approaching expiration',
    enabled: true,
    push: false,
    inApp: true,
    email: true,
  },
  {
    type: 'loaner_overdue',
    displayName: 'Loaner Overdue',
    description: 'When a loaner asset is overdue for return',
    enabled: true,
    push: true,
    inApp: true,
    email: true,
  },
  {
    type: 'system_alert',
    displayName: 'System Alerts',
    description: 'Important system notifications',
    enabled: true,
    push: true,
    inApp: true,
    email: false,
  },
];

/**
 * Default notification preferences
 */
export const DEFAULT_NOTIFICATION_PREFERENCES: NotificationPreferences = {
  pushEnabled: true,
  inAppEnabled: true,
  emailEnabled: true,
  showBadges: true,
  playSound: true,
  quietHoursStart: undefined,
  quietHoursEnd: undefined,
  typePreferences: DEFAULT_TYPE_PREFERENCES,
};

/**
 * Notification subscription info
 */
export interface NotificationSubscription {
  /** Subscription endpoint URL */
  endpoint: string;
  /** Subscription expiration time */
  expirationTime: number | null;
  /** Subscription keys */
  keys: {
    p256dh: string;
    auth: string;
  };
}

/**
 * Notification service state
 */
export interface NotificationServiceState {
  /** Current permission status */
  permission: NotificationPermission;
  /** Whether service worker is registered */
  serviceWorkerRegistered: boolean;
  /** Whether push subscription is active */
  subscriptionActive: boolean;
  /** Current subscription info */
  subscription: NotificationSubscription | null;
  /** Whether notifications are supported */
  isSupported: boolean;
  /** Error message if any */
  error: string | null;
}
