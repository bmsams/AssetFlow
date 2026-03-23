/**
 * useNotifications Hook
 * Implements Requirement 13.6: Mobile interface shall implement push notifications for assigned tasks and alerts
 * 
 * Provides React hooks for:
 * - Push notification permission management
 * - Notification subscription
 * - Notification preferences
 * - Click action handling
 */

import { useState, useEffect, useCallback, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  PushNotificationService,
  getPushNotificationService,
  NotificationClickHandler,
  NotificationReceivedHandler,
} from '../services/push-notification-service';
import type {
  NotificationPermission,
  NotificationPreferences,
  NotificationServiceState,
  PushNotificationPayload,
  NotificationType,
} from '../types/notification';

/**
 * Hook options for useNotifications
 */
export interface UseNotificationsOptions {
  /** Auto-initialize on mount (default: true) */
  autoInitialize?: boolean;
  /** Auto-navigate on notification click (default: true) */
  autoNavigate?: boolean;
  /** Callback when notification is received */
  onNotificationReceived?: NotificationReceivedHandler;
  /** Callback when notification is clicked */
  onNotificationClick?: NotificationClickHandler;
}

/**
 * Return type for useNotifications hook
 */
export interface UseNotificationsResult {
  /** Current service state */
  state: NotificationServiceState;
  /** Current preferences */
  preferences: NotificationPreferences;
  /** Whether notifications are supported */
  isSupported: boolean;
  /** Whether notifications are enabled */
  isEnabled: boolean;
  /** Whether permission has been granted */
  isPermissionGranted: boolean;
  /** Request notification permission */
  requestPermission: () => Promise<NotificationPermission>;
  /** Subscribe to push notifications */
  subscribe: (vapidPublicKey?: string) => Promise<boolean>;
  /** Unsubscribe from push notifications */
  unsubscribe: () => Promise<boolean>;
  /** Show a local notification */
  showNotification: (payload: PushNotificationPayload) => Promise<boolean>;
  /** Update global preferences */
  updatePreferences: (updates: Partial<NotificationPreferences>) => void;
  /** Update preference for a specific type */
  updateTypePreference: (
    type: NotificationType,
    updates: Partial<{ enabled: boolean; push: boolean; inApp: boolean; email: boolean }>
  ) => void;
  /** Toggle push notifications globally */
  togglePushEnabled: (enabled: boolean) => void;
  /** Error message if any */
  error: string | null;
}

/**
 * Hook for managing push notifications
 * 
 * @param options - Hook options
 * @returns Notification state and controls
 * 
 * @example
 * ```tsx
 * const { 
 *   isSupported, 
 *   isEnabled, 
 *   requestPermission, 
 *   subscribe 
 * } = useNotifications();
 * 
 * const handleEnableNotifications = async () => {
 *   const permission = await requestPermission();
 *   if (permission === 'granted') {
 *     await subscribe();
 *   }
 * };
 * ```
 */
export function useNotifications(
  options: UseNotificationsOptions = {}
): UseNotificationsResult {
  const {
    autoInitialize = true,
    autoNavigate = true,
    onNotificationReceived,
    onNotificationClick,
  } = options;

  const navigate = useNavigate();
  const serviceRef = useRef<PushNotificationService | null>(null);

  const [state, setState] = useState<NotificationServiceState>(() => {
    const service = getPushNotificationService();
    return service.getState();
  });

  const [preferences, setPreferences] = useState<NotificationPreferences>(() => {
    const service = getPushNotificationService();
    return service.getPreferences();
  });

  // Initialize service
  useEffect(() => {
    serviceRef.current = getPushNotificationService();

    // Subscribe to state changes
    const unsubscribeState = serviceRef.current.onStateChange((newState) => {
      setState(newState);
    });

    // Initialize if auto-initialize is enabled
    if (autoInitialize) {
      void serviceRef.current.initialize();
    }

    return () => {
      unsubscribeState();
    };
  }, [autoInitialize]);

  // Set up notification click handler with navigation
  useEffect(() => {
    if (!serviceRef.current) return;

    const handleClick: NotificationClickHandler = (notification, action) => {
      // Call custom handler if provided
      onNotificationClick?.(notification, action);

      // Auto-navigate if enabled
      if (autoNavigate && notification.data?.url) {
        // Focus window if in background
        if (document.visibilityState === 'hidden') {
          window.focus();
        }

        // Navigate to the URL
        navigate(notification.data.url);
      }
    };

    return serviceRef.current.onNotificationClick(handleClick);
  }, [autoNavigate, navigate, onNotificationClick]);

  // Set up notification received handler
  useEffect(() => {
    if (!serviceRef.current || !onNotificationReceived) return;

    return serviceRef.current.onNotificationReceived(onNotificationReceived);
  }, [onNotificationReceived]);

  // Request permission
  const requestPermission = useCallback(async (): Promise<NotificationPermission> => {
    if (!serviceRef.current) return 'denied';
    return serviceRef.current.requestPermission();
  }, []);

  // Subscribe to push notifications
  const subscribe = useCallback(async (vapidPublicKey?: string): Promise<boolean> => {
    if (!serviceRef.current) return false;
    const subscription = await serviceRef.current.subscribe(vapidPublicKey);
    return subscription !== null;
  }, []);

  // Unsubscribe from push notifications
  const unsubscribe = useCallback(async (): Promise<boolean> => {
    if (!serviceRef.current) return false;
    return serviceRef.current.unsubscribe();
  }, []);

  // Show a local notification
  const showNotification = useCallback(async (payload: PushNotificationPayload): Promise<boolean> => {
    if (!serviceRef.current) return false;
    return serviceRef.current.showNotification(payload);
  }, []);

  // Update global preferences
  const updatePreferences = useCallback((updates: Partial<NotificationPreferences>): void => {
    if (!serviceRef.current) return;
    serviceRef.current.updatePreferences(updates);
    setPreferences(serviceRef.current.getPreferences());
  }, []);

  // Update type-specific preference
  const updateTypePreference = useCallback((
    type: NotificationType,
    updates: Partial<{ enabled: boolean; push: boolean; inApp: boolean; email: boolean }>
  ): void => {
    if (!serviceRef.current) return;
    serviceRef.current.updateTypePreference(type, updates);
    setPreferences(serviceRef.current.getPreferences());
  }, []);

  // Toggle push enabled
  const togglePushEnabled = useCallback((enabled: boolean): void => {
    updatePreferences({ pushEnabled: enabled });
  }, [updatePreferences]);

  return {
    state,
    preferences,
    isSupported: state.isSupported,
    isEnabled: state.isSupported && state.permission === 'granted' && preferences.pushEnabled,
    isPermissionGranted: state.permission === 'granted',
    requestPermission,
    subscribe,
    unsubscribe,
    showNotification,
    updatePreferences,
    updateTypePreference,
    togglePushEnabled,
    error: state.error,
  };
}

/**
 * Hook for handling notification actions
 * Provides navigation helpers for common notification actions
 * 
 * @example
 * ```tsx
 * const { navigateToTask, navigateToAsset } = useNotificationActions();
 * 
 * // In notification click handler
 * if (notification.data?.entityType === 'task') {
 *   navigateToTask(notification.data.entityId);
 * }
 * ```
 */
export function useNotificationActions() {
  const navigate = useNavigate();

  const navigateToTask = useCallback((taskId: string) => {
    navigate(`/tasks/${taskId}`);
  }, [navigate]);

  const navigateToAsset = useCallback((assetId: string) => {
    navigate(`/assets/${assetId}`);
  }, [navigate]);

  const navigateToAlert = useCallback((alertId: string) => {
    navigate(`/alerts/${alertId}`);
  }, [navigate]);

  const navigateToContract = useCallback((contractId: string) => {
    navigate(`/contracts/${contractId}`);
  }, [navigate]);

  const navigateToMaintenance = useCallback((maintenanceId: string) => {
    navigate(`/maintenance/${maintenanceId}`);
  }, [navigate]);

  const handleNotificationNavigation = useCallback((notification: PushNotificationPayload) => {
    const { entityType, entityId, url } = notification.data || {};

    if (url) {
      navigate(url);
      return;
    }

    if (!entityId) return;

    switch (entityType) {
      case 'task':
        navigateToTask(entityId);
        break;
      case 'asset':
        navigateToAsset(entityId);
        break;
      case 'alert':
        navigateToAlert(entityId);
        break;
      case 'contract':
        navigateToContract(entityId);
        break;
      case 'maintenance':
        navigateToMaintenance(entityId);
        break;
    }
  }, [navigate, navigateToTask, navigateToAsset, navigateToAlert, navigateToContract, navigateToMaintenance]);

  return {
    navigateToTask,
    navigateToAsset,
    navigateToAlert,
    navigateToContract,
    navigateToMaintenance,
    handleNotificationNavigation,
  };
}

export default useNotifications;
