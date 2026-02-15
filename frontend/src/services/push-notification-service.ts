/**
 * Push Notification Service
 * Implements Requirement 13.6: Mobile interface shall implement push notifications for assigned tasks and alerts
 * 
 * Features:
 * - Browser push notification support via Web Push API
 * - Permission management
 * - Notification preferences
 * - Click action handling
 * - Service worker integration
 */

import type {
  NotificationPermission as NotifPermission,
  PushNotificationPayload,
  NotificationPreferences,
  NotificationSubscription,
  NotificationServiceState,
  NotificationType,
} from '../types/notification';
import { DEFAULT_NOTIFICATION_PREFERENCES } from '../types/notification';

/**
 * Notification click handler type
 */
export type NotificationClickHandler = (notification: PushNotificationPayload, action?: string) => void;

/**
 * Notification received handler type
 */
export type NotificationReceivedHandler = (notification: PushNotificationPayload) => void;

/**
 * State change handler type
 */
export type StateChangeHandler = (state: NotificationServiceState) => void;

/**
 * Storage keys for preferences
 */
const STORAGE_KEYS = {
  PREFERENCES: 'ams_notification_preferences',
  SUBSCRIPTION: 'ams_push_subscription',
} as const;

/**
 * Check if notifications are supported in the current browser
 */
export function isNotificationSupported(): boolean {
  return 'Notification' in window && 'serviceWorker' in navigator && 'PushManager' in window;
}

/**
 * Get current notification permission
 */
export function getNotificationPermission(): NotifPermission {
  if (!('Notification' in window)) {
    return 'denied';
  }
  return Notification.permission as NotifPermission;
}

/**
 * Push Notification Service Class
 * Manages push notifications with Web Push API
 */
export class PushNotificationService {
  private state: NotificationServiceState;
  private preferences: NotificationPreferences;
  private clickHandlers: Set<NotificationClickHandler> = new Set();
  private receivedHandlers: Set<NotificationReceivedHandler> = new Set();
  private stateChangeHandlers: Set<StateChangeHandler> = new Set();
  private serviceWorkerRegistration: ServiceWorkerRegistration | null = null;

  constructor() {
    this.state = {
      permission: getNotificationPermission(),
      serviceWorkerRegistered: false,
      subscriptionActive: false,
      subscription: null,
      isSupported: isNotificationSupported(),
      error: null,
    };
    this.preferences = this.loadPreferences();
  }

  /**
   * Get current service state
   */
  getState(): NotificationServiceState {
    return { ...this.state };
  }

  /**
   * Get current preferences
   */
  getPreferences(): NotificationPreferences {
    return { ...this.preferences };
  }

  /**
   * Check if notifications are supported
   */
  isSupported(): boolean {
    return this.state.isSupported;
  }

  /**
   * Check if notifications are enabled
   */
  isEnabled(): boolean {
    return (
      this.state.isSupported &&
      this.state.permission === 'granted' &&
      this.preferences.pushEnabled
    );
  }

  /**
   * Initialize the service
   * Registers service worker and checks subscription status
   */
  async initialize(): Promise<void> {
    if (!this.state.isSupported) {
      this.updateState({ error: 'Push notifications are not supported in this browser' });
      return;
    }

    try {
      // Register service worker
      await this.registerServiceWorker();

      // Check existing subscription
      await this.checkSubscription();

      // Set up message listener for service worker messages
      this.setupMessageListener();
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Failed to initialize notifications';
      this.updateState({ error: errorMessage });
    }
  }

  /**
   * Request notification permission
   */
  async requestPermission(): Promise<NotifPermission> {
    if (!this.state.isSupported) {
      return 'denied';
    }

    try {
      const permission = await Notification.requestPermission();
      this.updateState({ permission: permission as NotifPermission, error: null });
      return permission as NotifPermission;
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Failed to request permission';
      this.updateState({ error: errorMessage });
      return 'denied';
    }
  }

  /**
   * Subscribe to push notifications
   */
  async subscribe(vapidPublicKey?: string): Promise<NotificationSubscription | null> {
    if (!this.state.isSupported || this.state.permission !== 'granted') {
      return null;
    }

    if (!this.serviceWorkerRegistration) {
      await this.registerServiceWorker();
    }

    if (!this.serviceWorkerRegistration) {
      this.updateState({ error: 'Service worker not registered' });
      return null;
    }

    try {
      // Build subscription options
      const subscribeOptions: PushSubscriptionOptionsInit = {
        userVisibleOnly: true,
      };
      
      // Add VAPID key if provided
      if (vapidPublicKey) {
        const keyArray = this.urlBase64ToUint8Array(vapidPublicKey);
        subscribeOptions.applicationServerKey = keyArray.buffer as ArrayBuffer;
      }

      const subscription = await this.serviceWorkerRegistration.pushManager.subscribe(subscribeOptions);

      const subscriptionData = this.serializeSubscription(subscription);
      this.saveSubscription(subscriptionData);
      this.updateState({
        subscriptionActive: true,
        subscription: subscriptionData,
        error: null,
      });

      return subscriptionData;
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Failed to subscribe';
      this.updateState({ error: errorMessage });
      return null;
    }
  }

  /**
   * Unsubscribe from push notifications
   */
  async unsubscribe(): Promise<boolean> {
    if (!this.serviceWorkerRegistration) {
      return false;
    }

    try {
      const subscription = await this.serviceWorkerRegistration.pushManager.getSubscription();
      if (subscription) {
        await subscription.unsubscribe();
      }

      this.clearSubscription();
      this.updateState({
        subscriptionActive: false,
        subscription: null,
        error: null,
      });

      return true;
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Failed to unsubscribe';
      this.updateState({ error: errorMessage });
      return false;
    }
  }

  /**
   * Show a local notification
   */
  async showNotification(payload: PushNotificationPayload): Promise<boolean> {
    if (!this.isEnabled()) {
      return false;
    }

    // Check if this notification type is enabled
    if (!this.isNotificationTypeEnabled(payload.type)) {
      return false;
    }

    // Check quiet hours
    if (this.isInQuietHours()) {
      return false;
    }

    try {
      // Notify received handlers
      this.notifyReceivedHandlers(payload);

      // Show the notification
      if (this.serviceWorkerRegistration) {
        await this.serviceWorkerRegistration.showNotification(payload.title, {
          body: payload.body,
          icon: payload.icon,
          badge: payload.badge,
          tag: payload.tag,
          requireInteraction: payload.requireInteraction,
          data: { ...payload.data, notificationId: payload.id, notificationType: payload.type },
        });
      } else {
        // Fallback to basic Notification API
        const notification = new Notification(payload.title, {
          body: payload.body,
          icon: payload.icon,
          badge: payload.badge,
          tag: payload.tag,
          requireInteraction: payload.requireInteraction,
          data: { ...payload.data, notificationId: payload.id, notificationType: payload.type },
        });

        notification.onclick = () => {
          this.handleNotificationClick(payload);
          notification.close();
        };
      }

      return true;
    } catch (error) {
      console.error('Failed to show notification:', error);
      return false;
    }
  }

  /**
   * Update notification preferences
   */
  updatePreferences(updates: Partial<NotificationPreferences>): void {
    this.preferences = { ...this.preferences, ...updates };
    this.savePreferences();
  }

  /**
   * Update preference for a specific notification type
   */
  updateTypePreference(
    type: NotificationType,
    updates: Partial<{ enabled: boolean; push: boolean; inApp: boolean; email: boolean }>
  ): void {
    const typePreferences = this.preferences.typePreferences.map(pref =>
      pref.type === type ? { ...pref, ...updates } : pref
    );
    this.preferences = { ...this.preferences, typePreferences };
    this.savePreferences();
  }

  /**
   * Subscribe to notification clicks
   */
  onNotificationClick(handler: NotificationClickHandler): () => void {
    this.clickHandlers.add(handler);
    return () => {
      this.clickHandlers.delete(handler);
    };
  }

  /**
   * Subscribe to notification received events
   */
  onNotificationReceived(handler: NotificationReceivedHandler): () => void {
    this.receivedHandlers.add(handler);
    return () => {
      this.receivedHandlers.delete(handler);
    };
  }

  /**
   * Subscribe to state changes
   */
  onStateChange(handler: StateChangeHandler): () => void {
    this.stateChangeHandlers.add(handler);
    // Immediately notify with current state
    handler(this.getState());
    return () => {
      this.stateChangeHandlers.delete(handler);
    };
  }

  /**
   * Handle notification click
   */
  handleNotificationClick(notification: PushNotificationPayload, action?: string): void {
    this.clickHandlers.forEach(handler => {
      try {
        handler(notification, action);
      } catch (error) {
        console.error('Error in notification click handler:', error);
      }
    });
  }

  /**
   * Check if a notification type is enabled
   */
  private isNotificationTypeEnabled(type: NotificationType): boolean {
    const typePref = this.preferences.typePreferences.find(p => p.type === type);
    return typePref ? typePref.enabled && typePref.push : true;
  }

  /**
   * Check if currently in quiet hours
   */
  private isInQuietHours(): boolean {
    const { quietHoursStart, quietHoursEnd } = this.preferences;
    if (!quietHoursStart || !quietHoursEnd) {
      return false;
    }

    const now = new Date();
    const currentTime = `${now.getHours().toString().padStart(2, '0')}:${now.getMinutes().toString().padStart(2, '0')}`;

    // Handle overnight quiet hours (e.g., 22:00 to 07:00)
    if (quietHoursStart > quietHoursEnd) {
      return currentTime >= quietHoursStart || currentTime < quietHoursEnd;
    }

    return currentTime >= quietHoursStart && currentTime < quietHoursEnd;
  }

  /**
   * Register service worker
   */
  private async registerServiceWorker(): Promise<void> {
    if (!('serviceWorker' in navigator)) {
      return;
    }

    try {
      // In a real app, this would register an actual service worker file
      // For now, we'll check if one is already registered
      const registration = await navigator.serviceWorker.ready;
      this.serviceWorkerRegistration = registration;
      this.updateState({ serviceWorkerRegistered: true });
    } catch (error) {
      console.error('Service worker registration failed:', error);
      // Don't throw - we can still use basic Notification API
    }
  }

  /**
   * Check existing subscription
   */
  private async checkSubscription(): Promise<void> {
    if (!this.serviceWorkerRegistration) {
      return;
    }

    try {
      const subscription = await this.serviceWorkerRegistration.pushManager.getSubscription();
      if (subscription) {
        const subscriptionData = this.serializeSubscription(subscription);
        this.updateState({
          subscriptionActive: true,
          subscription: subscriptionData,
        });
      }
    } catch (error) {
      console.error('Failed to check subscription:', error);
    }
  }

  /**
   * Set up message listener for service worker messages
   */
  private setupMessageListener(): void {
    if (!('serviceWorker' in navigator)) {
      return;
    }

    navigator.serviceWorker.addEventListener('message', (event) => {
      if (event.data?.type === 'NOTIFICATION_CLICK') {
        const { notification, action } = event.data;
        this.handleNotificationClick(notification, action);
      }
    });
  }

  /**
   * Update state and notify handlers
   */
  private updateState(updates: Partial<NotificationServiceState>): void {
    this.state = { ...this.state, ...updates };
    this.stateChangeHandlers.forEach(handler => {
      try {
        handler(this.getState());
      } catch (error) {
        console.error('Error in state change handler:', error);
      }
    });
  }

  /**
   * Notify received handlers
   */
  private notifyReceivedHandlers(notification: PushNotificationPayload): void {
    this.receivedHandlers.forEach(handler => {
      try {
        handler(notification);
      } catch (error) {
        console.error('Error in notification received handler:', error);
      }
    });
  }

  /**
   * Serialize PushSubscription to our format
   */
  private serializeSubscription(subscription: PushSubscription): NotificationSubscription {
    const json = subscription.toJSON();
    return {
      endpoint: json.endpoint || '',
      expirationTime: json.expirationTime ?? null,
      keys: {
        p256dh: json.keys?.p256dh || '',
        auth: json.keys?.auth || '',
      },
    };
  }

  /**
   * Convert URL-safe base64 to Uint8Array
   */
  private urlBase64ToUint8Array(base64String: string): Uint8Array {
    const padding = '='.repeat((4 - (base64String.length % 4)) % 4);
    const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/');
    const rawData = window.atob(base64);
    const outputArray = new Uint8Array(rawData.length);
    for (let i = 0; i < rawData.length; ++i) {
      outputArray[i] = rawData.charCodeAt(i);
    }
    return outputArray;
  }

  /**
   * Load preferences from storage
   */
  private loadPreferences(): NotificationPreferences {
    try {
      const stored = localStorage.getItem(STORAGE_KEYS.PREFERENCES);
      if (stored) {
        return { ...DEFAULT_NOTIFICATION_PREFERENCES, ...JSON.parse(stored) };
      }
    } catch (error) {
      console.error('Failed to load notification preferences:', error);
    }
    return { ...DEFAULT_NOTIFICATION_PREFERENCES };
  }

  /**
   * Save preferences to storage
   */
  private savePreferences(): void {
    try {
      localStorage.setItem(STORAGE_KEYS.PREFERENCES, JSON.stringify(this.preferences));
    } catch (error) {
      console.error('Failed to save notification preferences:', error);
    }
  }

  /**
   * Save subscription to storage
   */
  private saveSubscription(subscription: NotificationSubscription): void {
    try {
      localStorage.setItem(STORAGE_KEYS.SUBSCRIPTION, JSON.stringify(subscription));
    } catch (error) {
      console.error('Failed to save subscription:', error);
    }
  }

  /**
   * Clear subscription from storage
   */
  private clearSubscription(): void {
    try {
      localStorage.removeItem(STORAGE_KEYS.SUBSCRIPTION);
    } catch (error) {
      console.error('Failed to clear subscription:', error);
    }
  }
}

/**
 * Singleton instance
 */
let defaultInstance: PushNotificationService | null = null;

/**
 * Get the default push notification service instance
 */
export function getPushNotificationService(): PushNotificationService {
  if (!defaultInstance) {
    defaultInstance = new PushNotificationService();
  }
  return defaultInstance;
}

/**
 * Reset the push notification service (for testing)
 */
export function resetPushNotificationService(): void {
  defaultInstance = null;
}
