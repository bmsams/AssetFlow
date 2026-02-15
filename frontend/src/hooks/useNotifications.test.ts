/**
 * Tests for useNotifications Hook
 * Implements Requirement 13.6: Mobile interface shall implement push notifications for assigned tasks and alerts
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, act, waitFor } from '@testing-library/react';
import { BrowserRouter } from 'react-router-dom';
import { useNotifications, useNotificationActions } from './useNotifications';
import { resetPushNotificationService } from '../services/push-notification-service';
import type { PushNotificationPayload } from '../types/notification';
import React from 'react';

// Mock Notification API
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
    }
    
    close = vi.fn();
  },
  writable: true,
  configurable: true,
});

// Mock ServiceWorker API
const mockShowNotification = vi.fn().mockResolvedValue(undefined);
const mockGetSubscription = vi.fn().mockResolvedValue(null);
const mockSubscribe = vi.fn().mockResolvedValue({
  toJSON: () => ({
    endpoint: 'https://push.example.com/test',
    expirationTime: null,
    keys: { p256dh: 'test-key', auth: 'test-auth' },
  }),
  unsubscribe: vi.fn().mockResolvedValue(true),
});

Object.defineProperty(navigator, 'serviceWorker', {
  value: {
    ready: Promise.resolve({
      showNotification: mockShowNotification,
      pushManager: {
        getSubscription: mockGetSubscription,
        subscribe: mockSubscribe,
      },
    }),
    addEventListener: vi.fn(),
  },
  writable: true,
  configurable: true,
});

Object.defineProperty(window, 'PushManager', {
  value: class MockPushManager {},
  writable: true,
  configurable: true,
});

// Mock react-router-dom navigate
const mockNavigate = vi.fn();
vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual('react-router-dom');
  return {
    ...actual,
    useNavigate: () => mockNavigate,
  };
});

// Wrapper component for hooks that need Router context
const wrapper = ({ children }: { children: React.ReactNode }) => (
  React.createElement(BrowserRouter, null, children)
);

describe('useNotifications', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    localStorage.clear();
    mockPermission = 'default';
    (window.Notification as unknown as { permission: string }).permission = 'default';
    resetPushNotificationService();
  });

  afterEach(() => {
    resetPushNotificationService();
  });

  describe('initialization', () => {
    it('should return initial state', () => {
      const { result } = renderHook(() => useNotifications(), { wrapper });
      
      expect(result.current.isSupported).toBe(true);
      expect(result.current.isEnabled).toBe(false);
      expect(result.current.isPermissionGranted).toBe(false);
      expect(result.current.error).toBeNull();
    });

    it('should return preferences', () => {
      const { result } = renderHook(() => useNotifications(), { wrapper });
      
      expect(result.current.preferences).toBeDefined();
      expect(result.current.preferences.pushEnabled).toBe(true);
      expect(result.current.preferences.typePreferences).toHaveLength(10);
    });
  });

  describe('requestPermission', () => {
    it('should request permission and update state', async () => {
      mockPermission = 'granted';
      (window.Notification.requestPermission as ReturnType<typeof vi.fn>).mockResolvedValue('granted');
      
      const { result } = renderHook(() => useNotifications(), { wrapper });
      
      let permission: NotificationPermission;
      await act(async () => {
        permission = await result.current.requestPermission();
      });
      
      expect(permission!).toBe('granted');
      expect(window.Notification.requestPermission).toHaveBeenCalled();
    });

    it('should handle denied permission', async () => {
      mockPermission = 'denied';
      (window.Notification.requestPermission as ReturnType<typeof vi.fn>).mockResolvedValue('denied');
      
      const { result } = renderHook(() => useNotifications(), { wrapper });
      
      let permission: NotificationPermission;
      await act(async () => {
        permission = await result.current.requestPermission();
      });
      
      expect(permission!).toBe('denied');
    });
  });

  describe('subscribe', () => {
    it('should subscribe to push notifications', async () => {
      mockPermission = 'granted';
      (window.Notification as unknown as { permission: string }).permission = 'granted';
      (window.Notification.requestPermission as ReturnType<typeof vi.fn>).mockResolvedValue('granted');
      
      const { result } = renderHook(() => useNotifications(), { wrapper });
      
      // First request permission
      await act(async () => {
        await result.current.requestPermission();
      });
      
      // Then subscribe
      let subscribed: boolean;
      await act(async () => {
        subscribed = await result.current.subscribe();
      });
      
      expect(subscribed!).toBe(true);
    });

    it('should return false when permission not granted', async () => {
      const { result } = renderHook(() => useNotifications(), { wrapper });
      
      let subscribed: boolean;
      await act(async () => {
        subscribed = await result.current.subscribe();
      });
      
      expect(subscribed!).toBe(false);
    });
  });

  describe('updatePreferences', () => {
    it('should update global preferences', () => {
      const { result } = renderHook(() => useNotifications(), { wrapper });
      
      act(() => {
        result.current.updatePreferences({ pushEnabled: false });
      });
      
      expect(result.current.preferences.pushEnabled).toBe(false);
    });

    it('should update type-specific preferences', () => {
      const { result } = renderHook(() => useNotifications(), { wrapper });
      
      act(() => {
        result.current.updateTypePreference('task_assigned', { enabled: false });
      });
      
      const taskPref = result.current.preferences.typePreferences.find(
        p => p.type === 'task_assigned'
      );
      expect(taskPref?.enabled).toBe(false);
    });
  });

  describe('togglePushEnabled', () => {
    it('should toggle push notifications', () => {
      const { result } = renderHook(() => useNotifications(), { wrapper });
      
      expect(result.current.preferences.pushEnabled).toBe(true);
      
      act(() => {
        result.current.togglePushEnabled(false);
      });
      
      expect(result.current.preferences.pushEnabled).toBe(false);
      
      act(() => {
        result.current.togglePushEnabled(true);
      });
      
      expect(result.current.preferences.pushEnabled).toBe(true);
    });
  });

  describe('callbacks', () => {
    it('should call onNotificationReceived callback', async () => {
      mockPermission = 'granted';
      (window.Notification as unknown as { permission: string }).permission = 'granted';
      
      const onReceived = vi.fn();
      const { result } = renderHook(
        () => useNotifications({ onNotificationReceived: onReceived }),
        { wrapper }
      );
      
      const payload: PushNotificationPayload = {
        id: 'test-1',
        type: 'task_assigned',
        title: 'Test',
        body: 'Test body',
        priority: 'normal',
        timestamp: new Date().toISOString(),
      };
      
      await act(async () => {
        await result.current.showNotification(payload);
      });
      
      expect(onReceived).toHaveBeenCalledWith(payload);
    });
  });
});

describe('useNotificationActions', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should provide navigation functions', () => {
    const { result } = renderHook(() => useNotificationActions(), { wrapper });
    
    expect(result.current.navigateToTask).toBeDefined();
    expect(result.current.navigateToAsset).toBeDefined();
    expect(result.current.navigateToAlert).toBeDefined();
    expect(result.current.navigateToContract).toBeDefined();
    expect(result.current.navigateToMaintenance).toBeDefined();
    expect(result.current.handleNotificationNavigation).toBeDefined();
  });

  it('should navigate to task', () => {
    const { result } = renderHook(() => useNotificationActions(), { wrapper });
    
    act(() => {
      result.current.navigateToTask('task-123');
    });
    
    expect(mockNavigate).toHaveBeenCalledWith('/tasks/task-123');
  });

  it('should navigate to asset', () => {
    const { result } = renderHook(() => useNotificationActions(), { wrapper });
    
    act(() => {
      result.current.navigateToAsset('asset-456');
    });
    
    expect(mockNavigate).toHaveBeenCalledWith('/assets/asset-456');
  });

  it('should handle notification navigation with URL', () => {
    const { result } = renderHook(() => useNotificationActions(), { wrapper });
    
    const payload: PushNotificationPayload = {
      id: 'test-1',
      type: 'task_assigned',
      title: 'Test',
      body: 'Test body',
      priority: 'normal',
      timestamp: new Date().toISOString(),
      data: {
        url: '/custom/path',
      },
    };
    
    act(() => {
      result.current.handleNotificationNavigation(payload);
    });
    
    expect(mockNavigate).toHaveBeenCalledWith('/custom/path');
  });

  it('should handle notification navigation with entity type', () => {
    const { result } = renderHook(() => useNotificationActions(), { wrapper });
    
    const payload: PushNotificationPayload = {
      id: 'test-1',
      type: 'task_assigned',
      title: 'Test',
      body: 'Test body',
      priority: 'normal',
      timestamp: new Date().toISOString(),
      data: {
        entityType: 'task',
        entityId: 'task-789',
      },
    };
    
    act(() => {
      result.current.handleNotificationNavigation(payload);
    });
    
    expect(mockNavigate).toHaveBeenCalledWith('/tasks/task-789');
  });

  it('should handle notification navigation for different entity types', () => {
    const { result } = renderHook(() => useNotificationActions(), { wrapper });
    
    const entityTypes = [
      { type: 'asset', path: '/assets/id-1' },
      { type: 'alert', path: '/alerts/id-2' },
      { type: 'contract', path: '/contracts/id-3' },
      { type: 'maintenance', path: '/maintenance/id-4' },
    ] as const;
    
    entityTypes.forEach(({ type, path }) => {
      mockNavigate.mockClear();
      
      const payload: PushNotificationPayload = {
        id: `test-${type}`,
        type: 'system_alert',
        title: 'Test',
        body: 'Test body',
        priority: 'normal',
        timestamp: new Date().toISOString(),
        data: {
          entityType: type,
          entityId: path.split('/')[2],
        },
      };
      
      act(() => {
        result.current.handleNotificationNavigation(payload);
      });
      
      expect(mockNavigate).toHaveBeenCalledWith(path);
    });
  });
});

describe('useNotifications - Requirements Validation', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    localStorage.clear();
    resetPushNotificationService();
  });

  /**
   * Validates Requirement 13.6: Mobile interface shall implement push notifications for assigned tasks and alerts
   */
  it('should provide push notification functionality (Requirement 13.6)', () => {
    const { result } = renderHook(() => useNotifications(), { wrapper });
    
    // Verify all required functions are available
    expect(result.current.requestPermission).toBeDefined();
    expect(result.current.subscribe).toBeDefined();
    expect(result.current.unsubscribe).toBeDefined();
    expect(result.current.showNotification).toBeDefined();
    
    // Verify state tracking
    expect(result.current.isSupported).toBeDefined();
    expect(result.current.isEnabled).toBeDefined();
    expect(result.current.isPermissionGranted).toBeDefined();
  });

  /**
   * Validates Requirement 17.2: Allow users to configure notification preferences per event type
   */
  it('should allow preference configuration per event type (Requirement 17.2)', () => {
    const { result } = renderHook(() => useNotifications(), { wrapper });
    
    // Verify preference update functions
    expect(result.current.updatePreferences).toBeDefined();
    expect(result.current.updateTypePreference).toBeDefined();
    expect(result.current.togglePushEnabled).toBeDefined();
    
    // Verify type preferences are available
    expect(result.current.preferences.typePreferences).toBeDefined();
    expect(result.current.preferences.typePreferences.length).toBeGreaterThan(0);
    
    // Verify each type has required fields
    result.current.preferences.typePreferences.forEach(pref => {
      expect(pref.type).toBeDefined();
      expect(pref.displayName).toBeDefined();
      expect(pref.description).toBeDefined();
      expect(typeof pref.enabled).toBe('boolean');
      expect(typeof pref.push).toBe('boolean');
      expect(typeof pref.inApp).toBe('boolean');
      expect(typeof pref.email).toBe('boolean');
    });
  });
});
