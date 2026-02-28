/**
 * Notification API Service
 *
 * Provides methods for interacting with the Notification Service.
 * Handles notification history, read status, and user preferences.
 *
 * Implements Task 10.1: Create notification API client
 * Validates: Requirements 9.2, 9.3, 9.4
 */

import { apiClient, ApiError } from './api-client';
import { getCurrentUser } from './auth-service';

// ============================================================================
// Types
// ============================================================================

export interface Notification {
  notificationId: string;
  userId: string;
  title: string;
  message: string;
  type: 'info' | 'warning' | 'error' | 'success';
  category: 'asset' | 'procurement' | 'maintenance' | 'compliance' | 'system';
  read: boolean;
  createdAt: string;
  link?: string;
}

export interface NotificationPreferences {
  emailEnabled: boolean;
  pushEnabled: boolean;
  categories: Record<string, boolean>;
}

/** Shape returned by the backend preferences endpoint */
interface BackendPreferences {
  preferencesId?: string;
  userId?: string;
  globalEnabled?: boolean;
  defaultFrequency?: string;
  defaultChannels?: string[];
  eventPreferences?: Array<{
    eventType: string;
    enabled: boolean;
    channels?: Array<{ channel: string; enabled: boolean; frequency?: string }>;
  }>;
  quietHours?: Record<string, unknown>;
  batchingConfig?: Record<string, unknown>;
  // Frontend-shaped fields (in case backend ever returns them directly)
  emailEnabled?: boolean;
  pushEnabled?: boolean;
  categories?: Record<string, boolean>;
}

/**
 * Map backend preferences to frontend shape
 */
function mapBackendPreferences(raw: BackendPreferences): NotificationPreferences {
  // If already in frontend shape, return as-is
  if (raw.categories !== undefined && raw.emailEnabled !== undefined) {
    return {
      emailEnabled: raw.emailEnabled,
      pushEnabled: raw.pushEnabled ?? false,
      categories: raw.categories ?? {},
    };
  }

  // Map from backend shape
  const channels = raw.defaultChannels ?? [];
  const emailEnabled = channels.includes('EMAIL') && (raw.globalEnabled !== false);
  const pushEnabled = channels.includes('PUSH') && (raw.globalEnabled !== false);

  // Build categories from eventPreferences
  const categories: Record<string, boolean> = {};
  if (Array.isArray(raw.eventPreferences)) {
    for (const ep of raw.eventPreferences) {
      // Event types like "ASSET_CREATED" → category "asset"
      const cat = ep.eventType.split('_')[0].toLowerCase();
      // If any event in this category is enabled, mark category enabled
      if (categories[cat] === undefined) {
        categories[cat] = ep.enabled;
      } else {
        categories[cat] = categories[cat] || ep.enabled;
      }
    }
  }

  // If no event preferences, provide sensible defaults
  if (Object.keys(categories).length === 0) {
    for (const cat of ['asset', 'procurement', 'maintenance', 'compliance', 'system']) {
      categories[cat] = true;
    }
  }

  return { emailEnabled, pushEnabled, categories };
}

// ============================================================================
// API Functions
// ============================================================================

/**
 * Get notification history for the current user
 */
export async function getNotificationHistory(): Promise<Notification[]> {
  const response = await apiClient.get<Notification[] | { items: Notification[] }>('/notifications/history');

  if (!response.success || !response.data) {
    throw new ApiError(
      response.error?.code || 'FETCH_FAILED',
      response.error?.message || 'Failed to fetch notification history',
      400,
      response.requestId
    );
  }

  const data = response.data;
  return Array.isArray(data) ? data : data.items ?? [];
}

/**
 * Mark a notification as read
 */
export async function markNotificationRead(notificationId: string): Promise<void> {
  const response = await apiClient.post<void>(
    `/notifications/${notificationId}/read`
  );

  if (!response.success) {
    throw new ApiError(
      response.error?.code || 'ACTION_FAILED',
      response.error?.message || 'Failed to mark notification as read',
      400,
      response.requestId
    );
  }
}

/**
 * Get notification preferences for the current user
 */
export async function getPreferences(): Promise<NotificationPreferences> {
  const user = getCurrentUser();
  const userId = user?.sub || 'me';
  const response = await apiClient.get<BackendPreferences>(
    `/users/${userId}/notification-preferences`
  );

  if (!response.success || !response.data) {
    throw new ApiError(
      response.error?.code || 'FETCH_FAILED',
      response.error?.message || 'Failed to fetch notification preferences',
      400,
      response.requestId
    );
  }

  return mapBackendPreferences(response.data);
}

/**
 * Update notification preferences
 */
export async function updatePreferences(
  prefs: Partial<NotificationPreferences>
): Promise<NotificationPreferences> {
  const user = getCurrentUser();
  const userId = user?.sub || 'me';

  // Map frontend shape to backend update shape
  const backendPayload: Record<string, unknown> = {};
  if (prefs.emailEnabled !== undefined || prefs.pushEnabled !== undefined) {
    const channels: string[] = [];
    if (prefs.emailEnabled) channels.push('EMAIL');
    if (prefs.pushEnabled) channels.push('PUSH');
    channels.push('IN_APP');
    backendPayload.defaultChannels = channels;
    backendPayload.globalEnabled = prefs.emailEnabled || prefs.pushEnabled;
  }
  if (prefs.categories !== undefined) {
    // Map categories to eventPreferences updates
    const eventPreferences = Object.entries(prefs.categories).map(([cat, enabled]) => ({
      eventType: `${cat.toUpperCase()}_UPDATED`,
      enabled,
    }));
    backendPayload.eventPreferences = eventPreferences;
  }

  const response = await apiClient.put<BackendPreferences>(
    `/users/${userId}/notification-preferences`,
    backendPayload
  );

  if (!response.success || !response.data) {
    throw new ApiError(
      response.error?.code || 'ACTION_FAILED',
      response.error?.message || 'Failed to update notification preferences',
      400,
      response.requestId
    );
  }

  return mapBackendPreferences(response.data);
}

export const notificationApi = {
  getNotificationHistory,
  markNotificationRead,
  getPreferences,
  updatePreferences,
};

export default notificationApi;
