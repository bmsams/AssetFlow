/**
 * Tests for Push Notification Service
 * Implements Requirement 13.6: Mobile interface shall implement push notifications for assigned tasks and alerts
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
  PushNotificationService,
  getPushNotificationService,
  resetPushNotificationService,
  isNotificationSupported,
  getNotificationPermission,
} from './push-notification-service';
import type { PushNotificationPayload, NotificationPreferences } from '../types/notification';

// Mock Notification API
const mockNotification = vi.fn();
let mockPermission: NotificationPermission = 'default';

Object.defineProperty(window, 'Notification', {
  value: class MockNotification {
    static permission = mockPermission;
    static requestPermission = vi.fn().mockImplementation(() => Promise.resolve(mockPermission));
    
    title: string;
    options: NotificationOptions;
    onclick: ((event: Event) => void) | null = null;
    
    constructor(title: string, options?: NotificationOptions) {
      this.title = title;
      this.options = options || {};
      mockNotification(title, options);
    }
    
    close = vi.fn();
  },
  writable: true,
  configurable: true,
});

// Mock ServiceWorker API
const mockShowNotification = vi.fn().mockResolvedValue(undefined);
const mockGetSubscription = vi.fn().mockResolvedValue(null);
const mockSubscribe = vi.fn();
const mockUnsubscribe = vi.fn().mockResolvedValue(true);

const mockPushManager = {
  getSubscription: mockGetSubscription,
  subscribe: mockSubscribe,
};

const mockServiceWorkerRegistration = {
  showNotification: mockShowNotification,
  pushManager: mockPushManager,
};

Object.defineProperty(navigator, 'serviceWorker', {
  value: {
    ready: Promise.resolve(mockServiceWorkerRegistration),
    addEventListener: vi.fn(),
  },
  writable: true,
  configurable: true,
});

// Mock PushManager
Object.defineProperty(window, 'PushManager', {
  value: class MockPushManager {},
  writable: true,
  configurable: true,
});

describe('Push Notification Service', () => {
  let service: PushNotificationService;

  beforeEach(() => {
    vi.clearAllMocks();
    localStorage.clear();
    mockPermission = 'default';
    (window.Notification as unknown as { permission: string }).permission = 'default';
    resetPushNotificationService();
    service = new PushNotificationService();
  });

  afterEach(() => {
    resetPushNotificationService();
  });

  describe('isNotificationSupported', () => {
    it('should return true when all APIs are available', () => {
      expect(isNotificationSupported()).toBe(true);
    });
  });

  describe('getNotificationPermission', () => {
    it('should return current permission state', () => {
      expect(getNotificationPermission()).toBe('default');
    });

    it('should return denied when Notification API is not available', () => {
      const originalNotification = window.Notification;
      // @ts-expect-error - Testing missing API
      delete window.Notification;
      
      expect(getNotificationPermission()).toBe('denied');
      
      window.Notification = originalNotification;
    });
  });

  describe('PushNotificationService', () => {
    describe('initialization', () => {
      it('should start with correct initial state', () => {
        const state = service.getState();
        
        expect(state.permission).toBe('default');
        expect(state.isSupported).toBe(true);
        expect(state.serviceWorkerRegistered).toBe(false);
        expect(state.subscriptionActive).toBe(false);
        expect(state.subscription).toBeNull();
        expect(state.error).toBeNull();
      });

      it('should load default preferences', () => {
        const preferences = service.getPreferences();
        
        expect(preferences.pushEnabled).toBe(true);
        expect(preferences.inAppEnabled).toBe(true);
        expect(preferences.emailEnabled).toBe(true);
        expect(preferences.showBadges).toBe(true);
        expect(preferences.playSound).toBe(true);
        expect(preferences.typePreferences).toHaveLength(10);
      });

      it('should load saved preferences from localStorage', () => {
        const savedPrefs: Partial<NotificationPreferences> = {
          pushEnabled: false,
          playSound: false,
        };
        localStorage.setItem('ams_notification_preferences', JSON.stringify(savedPrefs));
        
        const newService = new PushNotificationService();
        const preferences = newService.getPreferences();
        
        expect(preferences.pushEnabled).toBe(false);
        expect(preferences.playSound).toBe(false);
        expect(preferences.inAppEnabled).toBe(true); // Default value
      });
    });

    describe('isSupported', () => {
      it('should return true when notifications are supported', () => {
        expect(service.isSupported()).toBe(true);
      });
    });

    describe('isEnabled', () => {
      it('should return false when permission is not granted', () => {
        expect(service.isEnabled()).toBe(false);
      });

      it('should return false when push is disabled in preferences', async () => {
        mockPermission = 'granted';
        (window.Notification as unknown as { permission: string }).permission = 'granted';
        (window.Notification.requestPermission as ReturnType<typeof vi.fn>).mockResolvedValue('granted');
        
        const newService = new PushNotificationService();
        newService.updatePreferences({ pushEnabled: false });
        
        expect(newService.isEnabled()).toBe(false);
      });
    });

    describe('requestPermission', () => {
      it('should request permission and update state', async () => {
        mockPermission = 'granted';
        (window.Notification.requestPermission as ReturnType<typeof vi.fn>).mockResolvedValue('granted');
        
        const result = await service.requestPermission();
        
        expect(result).toBe('granted');
        expect(window.Notification.requestPermission).toHaveBeenCalled();
        expect(service.getState().permission).toBe('granted');
      });

      it('should handle denied permission', async () => {
        mockPermission = 'denied';
        (window.Notification.requestPermission as ReturnType<typeof vi.fn>).mockResolvedValue('denied');
        
        const result = await service.requestPermission();
        
        expect(result).toBe('denied');
        expect(service.getState().permission).toBe('denied');
      });

      it('should handle permission request error', async () => {
        (window.Notification.requestPermission as ReturnType<typeof vi.fn>).mockRejectedValue(new Error('Permission error'));
        
        const result = await service.requestPermission();
        
        expect(result).toBe('denied');
        expect(service.getState().error).toBe('Permission error');
      });
    });

    describe('updatePreferences', () => {
      it('should update preferences', () => {
        service.updatePreferences({ pushEnabled: false, playSound: false });
        
        const preferences = service.getPreferences();
        expect(preferences.pushEnabled).toBe(false);
        expect(preferences.playSound).toBe(false);
      });

      it('should persist preferences to localStorage', () => {
        service.updatePreferences({ pushEnabled: false });
        
        const stored = JSON.parse(localStorage.getItem('ams_notification_preferences') || '{}');
        expect(stored.pushEnabled).toBe(false);
      });
    });

    describe('updateTypePreference', () => {
      it('should update specific type preference', () => {
        service.updateTypePreference('task_assigned', { enabled: false, push: false });
        
        const preferences = service.getPreferences();
        const taskPref = preferences.typePreferences.find(p => p.type === 'task_assigned');
        
        expect(taskPref?.enabled).toBe(false);
        expect(taskPref?.push).toBe(false);
      });
    });

    describe('showNotification', () => {
      it('should not show notification when not enabled', async () => {
        const payload: PushNotificationPayload = {
          id: 'test-1',
          type: 'task_assigned',
          title: 'Test Notification',
          body: 'Test body',
          priority: 'normal',
          timestamp: new Date().toISOString(),
        };
        
        const result = await service.showNotification(payload);
        
        expect(result).toBe(false);
        expect(mockShowNotification).not.toHaveBeenCalled();
      });

      it('should not show notification when type is disabled', async () => {
        mockPermission = 'granted';
        (window.Notification as unknown as { permission: string }).permission = 'granted';
        
        const newService = new PushNotificationService();
        await newService.initialize();
        newService.updateTypePreference('task_assigned', { enabled: false });
        
        const payload: PushNotificationPayload = {
          id: 'test-1',
          type: 'task_assigned',
          title: 'Test Notification',
          body: 'Test body',
          priority: 'normal',
          timestamp: new Date().toISOString(),
        };
        
        const result = await newService.showNotification(payload);
        
        expect(result).toBe(false);
      });
    });

    describe('onStateChange', () => {
      it('should notify handlers of state changes', async () => {
        const handler = vi.fn();
        service.onStateChange(handler);
        
        // Should be called immediately with current state
        expect(handler).toHaveBeenCalledWith(expect.objectContaining({
          permission: 'default',
          isSupported: true,
        }));
        
        handler.mockClear();
        
        // Request permission to trigger state change
        mockPermission = 'granted';
        (window.Notification.requestPermission as ReturnType<typeof vi.fn>).mockResolvedValue('granted');
        await service.requestPermission();
        
        expect(handler).toHaveBeenCalledWith(expect.objectContaining({
          permission: 'granted',
        }));
      });

      it('should allow unsubscribing from state changes', async () => {
        const handler = vi.fn();
        const unsubscribe = service.onStateChange(handler);
        
        handler.mockClear();
        unsubscribe();
        
        mockPermission = 'granted';
        (window.Notification.requestPermission as ReturnType<typeof vi.fn>).mockResolvedValue('granted');
        await service.requestPermission();
        
        expect(handler).not.toHaveBeenCalled();
      });
    });

    describe('onNotificationClick', () => {
      it('should notify click handlers', () => {
        const handler = vi.fn();
        service.onNotificationClick(handler);
        
        const payload: PushNotificationPayload = {
          id: 'test-1',
          type: 'task_assigned',
          title: 'Test',
          body: 'Test body',
          priority: 'normal',
          timestamp: new Date().toISOString(),
        };
        
        service.handleNotificationClick(payload, 'view_task');
        
        expect(handler).toHaveBeenCalledWith(payload, 'view_task');
      });

      it('should allow unsubscribing from click events', () => {
        const handler = vi.fn();
        const unsubscribe = service.onNotificationClick(handler);
        
        unsubscribe();
        
        const payload: PushNotificationPayload = {
          id: 'test-1',
          type: 'task_assigned',
          title: 'Test',
          body: 'Test body',
          priority: 'normal',
          timestamp: new Date().toISOString(),
        };
        
        service.handleNotificationClick(payload);
        
        expect(handler).not.toHaveBeenCalled();
      });
    });

    describe('onNotificationReceived', () => {
      it('should notify received handlers', async () => {
        mockPermission = 'granted';
        (window.Notification as unknown as { permission: string }).permission = 'granted';
        
        const newService = new PushNotificationService();
        await newService.initialize();
        
        const handler = vi.fn();
        newService.onNotificationReceived(handler);
        
        const payload: PushNotificationPayload = {
          id: 'test-1',
          type: 'task_assigned',
          title: 'Test',
          body: 'Test body',
          priority: 'normal',
          timestamp: new Date().toISOString(),
        };
        
        await newService.showNotification(payload);
        
        expect(handler).toHaveBeenCalledWith(payload);
      });
    });

    describe('quiet hours', () => {
      it('should respect quiet hours settings', async () => {
        mockPermission = 'granted';
        (window.Notification as unknown as { permission: string }).permission = 'granted';
        
        const newService = new PushNotificationService();
        await newService.initialize();
        
        // Set quiet hours to current time
        const now = new Date();
        const startHour = now.getHours().toString().padStart(2, '0');
        const startMinute = now.getMinutes().toString().padStart(2, '0');
        const endHour = ((now.getHours() + 1) % 24).toString().padStart(2, '0');
        
        newService.updatePreferences({
          quietHoursStart: `${startHour}:${startMinute}`,
          quietHoursEnd: `${endHour}:00`,
        });
        
        const payload: PushNotificationPayload = {
          id: 'test-1',
          type: 'task_assigned',
          title: 'Test',
          body: 'Test body',
          priority: 'normal',
          timestamp: new Date().toISOString(),
        };
        
        const result = await newService.showNotification(payload);
        
        // Should not show during quiet hours
        expect(result).toBe(false);
      });
    });
  });

  describe('Singleton', () => {
    it('should return same instance', () => {
      const instance1 = getPushNotificationService();
      const instance2 = getPushNotificationService();
      
      expect(instance1).toBe(instance2);
    });

    it('should reset instance', () => {
      const instance1 = getPushNotificationService();
      resetPushNotificationService();
      const instance2 = getPushNotificationService();
      
      expect(instance1).not.toBe(instance2);
    });
  });
});

describe('Push Notification Service - Requirements Validation', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    localStorage.clear();
    resetPushNotificationService();
  });

  /**
   * Validates Requirement 13.6: Mobile interface shall implement push notifications for assigned tasks and alerts
   */
  it('should support push notifications for tasks and alerts (Requirement 13.6)', () => {
    const service = new PushNotificationService();
    const preferences = service.getPreferences();
    
    // Verify task notification types are supported
    const taskTypes = preferences.typePreferences.filter(p => 
      ['task_assigned', 'task_due_soon', 'task_overdue'].includes(p.type)
    );
    expect(taskTypes).toHaveLength(3);
    
    // Verify alert notification types are supported
    const alertTypes = preferences.typePreferences.filter(p => 
      ['asset_alert', 'compliance_alert', 'system_alert'].includes(p.type)
    );
    expect(alertTypes).toHaveLength(3);
  });

  /**
   * Validates Requirement 17.2: Allow users to configure notification preferences per event type
   */
  it('should allow per-type notification configuration (Requirement 17.2)', () => {
    const service = new PushNotificationService();
    
    // Update specific type preference
    service.updateTypePreference('task_assigned', {
      enabled: false,
      push: false,
      inApp: true,
      email: false,
    });
    
    const preferences = service.getPreferences();
    const taskPref = preferences.typePreferences.find(p => p.type === 'task_assigned');
    
    expect(taskPref?.enabled).toBe(false);
    expect(taskPref?.push).toBe(false);
    expect(taskPref?.inApp).toBe(true);
    expect(taskPref?.email).toBe(false);
    
    // Other types should remain unchanged
    const otherPref = preferences.typePreferences.find(p => p.type === 'task_due_soon');
    expect(otherPref?.enabled).toBe(true);
  });
});
