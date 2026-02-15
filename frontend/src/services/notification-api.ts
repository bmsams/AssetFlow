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

// ============================================================================
// API Functions
// ============================================================================

/**
 * Get notification history for the current user
 */
export async function getNotificationHistory(): Promise<Notification[]> {
  const response = await apiClient.get<Notification[]>('/notifications/history');

  if (!response.success || !response.data) {
    throw new ApiError(
      response.error?.code || 'FETCH_FAILED',
      response.error?.message || 'Failed to fetch notification history',
      400,
      response.requestId
    );
  }

  return response.data;
}

/**
 * Mark a notification as read
 */
export async function markNotificationRead(notificationId: string): Promise<void> {
  const response = await apiClient.patch<void>(
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
  const response = await apiClient.get<NotificationPreferences>(
    '/notifications/preferences'
  );

  if (!response.success || !response.data) {
    throw new ApiError(
      response.error?.code || 'FETCH_FAILED',
      response.error?.message || 'Failed to fetch notification preferences',
      400,
      response.requestId
    );
  }

  return response.data;
}

/**
 * Update notification preferences
 */
export async function updatePreferences(
  prefs: Partial<NotificationPreferences>
): Promise<NotificationPreferences> {
  const response = await apiClient.patch<NotificationPreferences>(
    '/notifications/preferences',
    prefs
  );

  if (!response.success || !response.data) {
    throw new ApiError(
      response.error?.code || 'ACTION_FAILED',
      response.error?.message || 'Failed to update notification preferences',
      400,
      response.requestId
    );
  }

  return response.data;
}

export const notificationApi = {
  getNotificationHistory,
  markNotificationRead,
  getPreferences,
  updatePreferences,
};

export default notificationApi;
