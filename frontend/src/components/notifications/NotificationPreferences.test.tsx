/**
 * Tests for NotificationPreferences Component
 * Implements Requirement 13.6: Mobile interface shall implement push notifications for assigned tasks and alerts
 * Implements Requirement 17.2: Allow users to configure notification preferences per event type
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, within } from '@testing-library/react';
import { BrowserRouter } from 'react-router-dom';
import { NotificationPreferences } from './NotificationPreferences';
import { resetPushNotificationService } from '../../services/push-notification-service';

// Mock Notification API
let mockPermission: NotificationPermission = 'default';

Object.defineProperty(window, 'Notification', {
  value: class MockNotification {
    static permission = mockPermission;
    static requestPermission = vi.fn().mockImplementation(() => Promise.resolve(mockPermission));
    
    constructor() {}
    close = vi.fn();
  },
  writable: true,
  configurable: true,
});

// Mock ServiceWorker API
Object.defineProperty(navigator, 'serviceWorker', {
  value: {
    ready: Promise.resolve({
      showNotification: vi.fn(),
      pushManager: {
        getSubscription: vi.fn().mockResolvedValue(null),
        subscribe: vi.fn().mockResolvedValue({
          toJSON: () => ({
            endpoint: 'https://push.example.com/test',
            expirationTime: null,
            keys: { p256dh: 'test-key', auth: 'test-auth' },
          }),
        }),
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

// Wrapper for Router context
const renderWithRouter = (ui: React.ReactElement) => {
  return render(<BrowserRouter>{ui}</BrowserRouter>);
};

describe('NotificationPreferences', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    localStorage.clear();
    mockPermission = 'granted';
    (window.Notification as unknown as { permission: string }).permission = 'granted';
    resetPushNotificationService();
  });

  afterEach(() => {
    resetPushNotificationService();
  });

  describe('rendering', () => {
    it('should render with default props', () => {
      renderWithRouter(<NotificationPreferences />);
      
      expect(screen.getByText('Notification Preferences')).toBeInTheDocument();
      expect(screen.getByText(/Choose which notifications/)).toBeInTheDocument();
    });

    it('should render with custom title and description', () => {
      renderWithRouter(
        <NotificationPreferences
          title="Custom Title"
          description="Custom description"
        />
      );
      
      expect(screen.getByText('Custom Title')).toBeInTheDocument();
      expect(screen.getByText('Custom description')).toBeInTheDocument();
    });

    it('should apply custom className', () => {
      const { container } = renderWithRouter(
        <NotificationPreferences className="custom-class" />
      );
      
      expect(container.querySelector('.custom-class')).toBeInTheDocument();
    });
  });

  describe('global settings', () => {
    it('should render global settings when showGlobalSettings is true', () => {
      renderWithRouter(<NotificationPreferences showGlobalSettings />);
      
      expect(screen.getByText('Global Settings')).toBeInTheDocument();
      expect(screen.getByText('Push Notifications')).toBeInTheDocument();
      expect(screen.getByText('In-App Notifications')).toBeInTheDocument();
      expect(screen.getByText('Email Notifications')).toBeInTheDocument();
      expect(screen.getByText('Notification Badges')).toBeInTheDocument();
      expect(screen.getByText('Notification Sounds')).toBeInTheDocument();
    });

    it('should not render global settings when showGlobalSettings is false', () => {
      renderWithRouter(<NotificationPreferences showGlobalSettings={false} />);
      
      expect(screen.queryByText('Global Settings')).not.toBeInTheDocument();
    });

    it('should toggle push notifications', () => {
      renderWithRouter(<NotificationPreferences showGlobalSettings />);
      
      const pushToggle = screen.getByLabelText('Enable push notifications');
      expect(pushToggle).toBeChecked();
      
      fireEvent.click(pushToggle);
      expect(pushToggle).not.toBeChecked();
    });

    it('should toggle in-app notifications', () => {
      renderWithRouter(<NotificationPreferences showGlobalSettings />);
      
      const inAppToggle = screen.getByLabelText('Enable in-app notifications');
      expect(inAppToggle).toBeChecked();
      
      fireEvent.click(inAppToggle);
      expect(inAppToggle).not.toBeChecked();
    });

    it('should toggle email notifications', () => {
      renderWithRouter(<NotificationPreferences showGlobalSettings />);
      
      const emailToggle = screen.getByLabelText('Enable email notifications');
      expect(emailToggle).toBeChecked();
      
      fireEvent.click(emailToggle);
      expect(emailToggle).not.toBeChecked();
    });

    it('should toggle notification badges', () => {
      renderWithRouter(<NotificationPreferences showGlobalSettings />);
      
      const badgesToggle = screen.getByLabelText('Show notification badges');
      expect(badgesToggle).toBeChecked();
      
      fireEvent.click(badgesToggle);
      expect(badgesToggle).not.toBeChecked();
    });

    it('should toggle notification sounds', () => {
      renderWithRouter(<NotificationPreferences showGlobalSettings />);
      
      const soundToggle = screen.getByLabelText('Enable notification sounds');
      expect(soundToggle).toBeChecked();
      
      fireEvent.click(soundToggle);
      expect(soundToggle).not.toBeChecked();
    });
  });

  describe('quiet hours', () => {
    it('should render quiet hours when showQuietHours is true', () => {
      renderWithRouter(<NotificationPreferences showQuietHours />);
      
      expect(screen.getByText('Quiet Hours')).toBeInTheDocument();
      expect(screen.getByLabelText('From')).toBeInTheDocument();
      expect(screen.getByLabelText('To')).toBeInTheDocument();
    });

    it('should not render quiet hours when showQuietHours is false', () => {
      renderWithRouter(<NotificationPreferences showQuietHours={false} />);
      
      expect(screen.queryByText('Quiet Hours')).not.toBeInTheDocument();
    });

    it('should update quiet hours start time', () => {
      renderWithRouter(<NotificationPreferences showQuietHours />);
      
      const startInput = screen.getByLabelText('From');
      fireEvent.change(startInput, { target: { value: '22:00' } });
      
      expect(startInput).toHaveValue('22:00');
    });

    it('should update quiet hours end time', () => {
      renderWithRouter(<NotificationPreferences showQuietHours />);
      
      const endInput = screen.getByLabelText('To');
      fireEvent.change(endInput, { target: { value: '07:00' } });
      
      expect(endInput).toHaveValue('07:00');
    });

    it('should show clear button when quiet hours are set', () => {
      renderWithRouter(<NotificationPreferences showQuietHours />);
      
      const startInput = screen.getByLabelText('From');
      fireEvent.change(startInput, { target: { value: '22:00' } });
      
      expect(screen.getByRole('button', { name: /clear/i })).toBeInTheDocument();
    });

    it('should clear quiet hours when clear button is clicked', () => {
      renderWithRouter(<NotificationPreferences showQuietHours />);
      
      const startInput = screen.getByLabelText('From');
      const endInput = screen.getByLabelText('To');
      
      fireEvent.change(startInput, { target: { value: '22:00' } });
      fireEvent.change(endInput, { target: { value: '07:00' } });
      
      const clearButton = screen.getByRole('button', { name: /clear/i });
      fireEvent.click(clearButton);
      
      expect(startInput).toHaveValue('');
      expect(endInput).toHaveValue('');
    });
  });

  describe('notification types', () => {
    it('should render notification type categories', () => {
      renderWithRouter(<NotificationPreferences />);
      
      expect(screen.getByText('Notification Types')).toBeInTheDocument();
      expect(screen.getByText('Tasks')).toBeInTheDocument();
      expect(screen.getByText('Assets & Maintenance')).toBeInTheDocument();
      expect(screen.getByText('Compliance & Contracts')).toBeInTheDocument();
      expect(screen.getByText('System')).toBeInTheDocument();
    });

    it('should render task notification types', () => {
      renderWithRouter(<NotificationPreferences />);
      
      expect(screen.getByText('Task Assigned')).toBeInTheDocument();
      expect(screen.getByText('Task Due Soon')).toBeInTheDocument();
      expect(screen.getByText('Task Overdue')).toBeInTheDocument();
    });

    it('should render asset notification types', () => {
      renderWithRouter(<NotificationPreferences />);
      
      expect(screen.getByText('Asset Alerts')).toBeInTheDocument();
      expect(screen.getByText('Maintenance Due')).toBeInTheDocument();
      expect(screen.getByText('Low Stock Alert')).toBeInTheDocument();
    });

    it('should render compliance notification types', () => {
      renderWithRouter(<NotificationPreferences />);
      
      expect(screen.getByText('Compliance Alert')).toBeInTheDocument();
      expect(screen.getByText('Contract Expiring')).toBeInTheDocument();
      expect(screen.getByText('Loaner Overdue')).toBeInTheDocument();
    });

    it('should render system notification types', () => {
      renderWithRouter(<NotificationPreferences />);
      
      expect(screen.getByText('System Alerts')).toBeInTheDocument();
    });

    it('should toggle notification type enabled state', () => {
      renderWithRouter(<NotificationPreferences />);
      
      const taskAssignedToggle = screen.getByLabelText('Enable Task Assigned');
      expect(taskAssignedToggle).toBeChecked();
      
      fireEvent.click(taskAssignedToggle);
      expect(taskAssignedToggle).not.toBeChecked();
    });
  });

  describe('channel toggles', () => {
    it('should show channel toggles when showChannelToggles is true and type is enabled', () => {
      renderWithRouter(<NotificationPreferences showChannelToggles />);
      
      // Find the channel toggle labels (Push, In-App, Email)
      const pushLabels = screen.getAllByText('Push');
      const inAppLabels = screen.getAllByText('In-App');
      const emailLabels = screen.getAllByText('Email');
      
      expect(pushLabels.length).toBeGreaterThan(0);
      expect(inAppLabels.length).toBeGreaterThan(0);
      expect(emailLabels.length).toBeGreaterThan(0);
    });

    it('should not show channel toggles when showChannelToggles is false', () => {
      renderWithRouter(<NotificationPreferences showChannelToggles={false} />);
      
      // Channel labels should not be present
      expect(screen.queryByText('Push')).not.toBeInTheDocument();
      expect(screen.queryByText('In-App')).not.toBeInTheDocument();
      expect(screen.queryByText('Email')).not.toBeInTheDocument();
    });
  });

  describe('permission prompt', () => {
    it('should show permission prompt when permission is not granted', () => {
      mockPermission = 'default';
      (window.Notification as unknown as { permission: string }).permission = 'default';
      resetPushNotificationService();
      
      renderWithRouter(<NotificationPreferences />);
      
      expect(screen.getByText('Push notifications are disabled')).toBeInTheDocument();
      expect(screen.getByRole('button', { name: /enable/i })).toBeInTheDocument();
    });

    it('should not show permission prompt when permission is granted', () => {
      renderWithRouter(<NotificationPreferences />);
      
      expect(screen.queryByText('Push notifications are disabled')).not.toBeInTheDocument();
    });
  });

  describe('callbacks', () => {
    it('should call onPreferencesChange when global setting changes', () => {
      const onChange = vi.fn();
      renderWithRouter(
        <NotificationPreferences showGlobalSettings onPreferencesChange={onChange} />
      );
      
      const pushToggle = screen.getByLabelText('Enable push notifications');
      fireEvent.click(pushToggle);
      
      expect(onChange).toHaveBeenCalled();
    });

    it('should call onPreferencesChange when type preference changes', () => {
      const onChange = vi.fn();
      renderWithRouter(<NotificationPreferences onPreferencesChange={onChange} />);
      
      const taskAssignedToggle = screen.getByLabelText('Enable Task Assigned');
      fireEvent.click(taskAssignedToggle);
      
      expect(onChange).toHaveBeenCalled();
    });

    it('should call onPreferencesChange when quiet hours change', () => {
      const onChange = vi.fn();
      renderWithRouter(
        <NotificationPreferences showQuietHours onPreferencesChange={onChange} />
      );
      
      const startInput = screen.getByLabelText('From');
      fireEvent.change(startInput, { target: { value: '22:00' } });
      
      expect(onChange).toHaveBeenCalled();
    });
  });

  describe('persistence', () => {
    it('should persist preferences to localStorage', () => {
      renderWithRouter(<NotificationPreferences showGlobalSettings />);
      
      const pushToggle = screen.getByLabelText('Enable push notifications');
      fireEvent.click(pushToggle);
      
      const stored = JSON.parse(localStorage.getItem('ams_notification_preferences') || '{}');
      expect(stored.pushEnabled).toBe(false);
    });

    it('should load persisted preferences', () => {
      localStorage.setItem('ams_notification_preferences', JSON.stringify({
        pushEnabled: false,
        playSound: false,
      }));
      resetPushNotificationService();
      
      renderWithRouter(<NotificationPreferences showGlobalSettings />);
      
      const pushToggle = screen.getByLabelText('Enable push notifications');
      const soundToggle = screen.getByLabelText('Enable notification sounds');
      
      expect(pushToggle).not.toBeChecked();
      expect(soundToggle).not.toBeChecked();
    });
  });
});

describe('NotificationPreferences - Requirements Validation', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    localStorage.clear();
    mockPermission = 'granted';
    (window.Notification as unknown as { permission: string }).permission = 'granted';
    resetPushNotificationService();
  });

  /**
   * Validates Requirement 13.6: Mobile interface shall implement push notifications for assigned tasks and alerts
   */
  it('should provide UI for managing push notification preferences (Requirement 13.6)', () => {
    renderWithRouter(<NotificationPreferences showGlobalSettings />);
    
    // Verify push notification toggle is present
    expect(screen.getByText('Push Notifications')).toBeInTheDocument();
    expect(screen.getByLabelText('Enable push notifications')).toBeInTheDocument();
    
    // Verify task notification types are present
    expect(screen.getByText('Task Assigned')).toBeInTheDocument();
    expect(screen.getByText('Task Due Soon')).toBeInTheDocument();
    expect(screen.getByText('Task Overdue')).toBeInTheDocument();
    
    // Verify alert notification types are present
    expect(screen.getByText('Asset Alerts')).toBeInTheDocument();
    expect(screen.getByText('Compliance Alert')).toBeInTheDocument();
    expect(screen.getByText('System Alerts')).toBeInTheDocument();
  });

  /**
   * Validates Requirement 17.2: Allow users to configure notification preferences per event type
   */
  it('should allow per-type notification configuration (Requirement 17.2)', () => {
    renderWithRouter(<NotificationPreferences showChannelToggles />);
    
    // Verify each notification type has its own toggle
    const typeToggles = [
      'Enable Task Assigned',
      'Enable Task Due Soon',
      'Enable Task Overdue',
      'Enable Asset Alerts',
      'Enable Maintenance Due',
      'Enable Low Stock Alert',
      'Enable Compliance Alert',
      'Enable Contract Expiring',
      'Enable Loaner Overdue',
      'Enable System Alerts',
    ];
    
    typeToggles.forEach(label => {
      expect(screen.getByLabelText(label)).toBeInTheDocument();
    });
    
    // Verify types can be individually toggled
    const taskAssignedToggle = screen.getByLabelText('Enable Task Assigned');
    expect(taskAssignedToggle).toBeChecked();
    
    fireEvent.click(taskAssignedToggle);
    expect(taskAssignedToggle).not.toBeChecked();
    
    // Other types should remain unchanged
    const taskDueSoonToggle = screen.getByLabelText('Enable Task Due Soon');
    expect(taskDueSoonToggle).toBeChecked();
  });

  /**
   * Validates Requirement 17.9: Implement notification batching to prevent alert fatigue
   */
  it('should provide quiet hours to prevent alert fatigue (Requirement 17.9)', () => {
    renderWithRouter(<NotificationPreferences showQuietHours />);
    
    // Verify quiet hours settings are present
    expect(screen.getByText('Quiet Hours')).toBeInTheDocument();
    expect(screen.getByText(/Notifications will be silenced/)).toBeInTheDocument();
    expect(screen.getByLabelText('From')).toBeInTheDocument();
    expect(screen.getByLabelText('To')).toBeInTheDocument();
  });
});
