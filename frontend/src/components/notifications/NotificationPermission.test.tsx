/**
 * Tests for NotificationPermission Component
 * Implements Requirement 13.6: Mobile interface shall implement push notifications for assigned tasks and alerts
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { BrowserRouter } from 'react-router-dom';
import { NotificationPermission } from './NotificationPermission';
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

describe('NotificationPermission', () => {
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

  describe('rendering', () => {
    it('should render with default props', () => {
      renderWithRouter(<NotificationPermission />);
      
      expect(screen.getByRole('heading', { name: 'Enable Notifications' })).toBeInTheDocument();
      expect(screen.getByText(/Stay updated with task assignments/)).toBeInTheDocument();
      expect(screen.getByRole('button', { name: /enable notifications/i })).toBeInTheDocument();
    });

    it('should render with custom title and description', () => {
      renderWithRouter(
        <NotificationPermission
          title="Custom Title"
          description="Custom description text"
        />
      );
      
      expect(screen.getByText('Custom Title')).toBeInTheDocument();
      expect(screen.getByText('Custom description text')).toBeInTheDocument();
    });

    it('should render with custom button text', () => {
      renderWithRouter(
        <NotificationPermission
          enableButtonText="Turn On"
          dismissButtonText="Skip"
          onDismiss={() => {}}
        />
      );
      
      expect(screen.getByRole('button', { name: /turn on/i })).toBeInTheDocument();
      expect(screen.getByRole('button', { name: /skip/i })).toBeInTheDocument();
    });

    it('should not render dismiss button when onDismiss is not provided', () => {
      renderWithRouter(<NotificationPermission />);
      
      expect(screen.queryByRole('button', { name: /not now/i })).not.toBeInTheDocument();
    });

    it('should render dismiss button when onDismiss is provided', () => {
      renderWithRouter(<NotificationPermission onDismiss={() => {}} />);
      
      expect(screen.getByRole('button', { name: /not now/i })).toBeInTheDocument();
    });

    it('should apply custom className', () => {
      const { container } = renderWithRouter(
        <NotificationPermission className="custom-class" />
      );
      
      expect(container.querySelector('.custom-class')).toBeInTheDocument();
    });
  });

  describe('variants', () => {
    it('should render card variant by default', () => {
      const { container } = renderWithRouter(<NotificationPermission />);
      
      expect(container.querySelector('[class*="card"]')).toBeInTheDocument();
    });

    it('should render banner variant', () => {
      const { container } = renderWithRouter(
        <NotificationPermission variant="banner" />
      );
      
      expect(container.querySelector('[class*="banner"]')).toBeInTheDocument();
    });

    it('should render modal variant', () => {
      const { container } = renderWithRouter(
        <NotificationPermission variant="modal" />
      );
      
      expect(container.querySelector('[class*="modal"]')).toBeInTheDocument();
    });
  });

  describe('permission states', () => {
    it('should not render when permission is already granted', () => {
      mockPermission = 'granted';
      (window.Notification as unknown as { permission: string }).permission = 'granted';
      resetPushNotificationService();
      
      const { container } = renderWithRouter(<NotificationPermission />);
      
      expect(container.firstChild).toBeNull();
    });

    it('should show denied message when permission is denied', () => {
      mockPermission = 'denied';
      (window.Notification as unknown as { permission: string }).permission = 'denied';
      resetPushNotificationService();
      
      renderWithRouter(<NotificationPermission />);
      
      expect(screen.getByText('Notifications Blocked')).toBeInTheDocument();
      expect(screen.getByText(/Notifications are blocked for this site/)).toBeInTheDocument();
    });
  });

  describe('interactions', () => {
    it('should call requestPermission when enable button is clicked', async () => {
      mockPermission = 'granted';
      (window.Notification.requestPermission as ReturnType<typeof vi.fn>).mockResolvedValue('granted');
      
      renderWithRouter(<NotificationPermission />);
      
      const enableButton = screen.getByRole('button', { name: /enable notifications/i });
      fireEvent.click(enableButton);
      
      await waitFor(() => {
        expect(window.Notification.requestPermission).toHaveBeenCalled();
      });
    });

    it('should call onPermissionGranted when permission is granted', async () => {
      mockPermission = 'granted';
      (window.Notification.requestPermission as ReturnType<typeof vi.fn>).mockResolvedValue('granted');
      
      const onGranted = vi.fn();
      renderWithRouter(<NotificationPermission onPermissionGranted={onGranted} />);
      
      const enableButton = screen.getByRole('button', { name: /enable notifications/i });
      fireEvent.click(enableButton);
      
      await waitFor(() => {
        expect(onGranted).toHaveBeenCalled();
      });
    });

    it('should call onPermissionDenied when permission is denied', async () => {
      mockPermission = 'denied';
      (window.Notification.requestPermission as ReturnType<typeof vi.fn>).mockResolvedValue('denied');
      
      const onDenied = vi.fn();
      renderWithRouter(<NotificationPermission onPermissionDenied={onDenied} />);
      
      const enableButton = screen.getByRole('button', { name: /enable notifications/i });
      fireEvent.click(enableButton);
      
      await waitFor(() => {
        expect(onDenied).toHaveBeenCalled();
      });
    });

    it('should call onDismiss when dismiss button is clicked', () => {
      const onDismiss = vi.fn();
      renderWithRouter(<NotificationPermission onDismiss={onDismiss} />);
      
      const dismissButton = screen.getByRole('button', { name: /not now/i });
      fireEvent.click(dismissButton);
      
      expect(onDismiss).toHaveBeenCalled();
    });

    it('should show loading state while requesting permission', async () => {
      // Create a promise that we can control
      let resolvePermission: (value: NotificationPermission) => void;
      const permissionPromise = new Promise<NotificationPermission>((resolve) => {
        resolvePermission = resolve;
      });
      (window.Notification.requestPermission as ReturnType<typeof vi.fn>).mockReturnValue(permissionPromise);
      
      renderWithRouter(<NotificationPermission />);
      
      const enableButton = screen.getByRole('button', { name: /enable notifications/i });
      fireEvent.click(enableButton);
      
      // Should show loading state
      await waitFor(() => {
        expect(screen.getByText(/requesting/i)).toBeInTheDocument();
      });
      
      // Resolve the permission
      resolvePermission!('granted');
    });

    it('should disable buttons while requesting permission', async () => {
      let resolvePermission: (value: NotificationPermission) => void;
      const permissionPromise = new Promise<NotificationPermission>((resolve) => {
        resolvePermission = resolve;
      });
      (window.Notification.requestPermission as ReturnType<typeof vi.fn>).mockReturnValue(permissionPromise);
      
      renderWithRouter(<NotificationPermission onDismiss={() => {}} />);
      
      const enableButton = screen.getByRole('button', { name: /enable notifications/i });
      fireEvent.click(enableButton);
      
      await waitFor(() => {
        expect(enableButton).toBeDisabled();
      });
      
      resolvePermission!('granted');
    });
  });

  describe('accessibility', () => {
    it('should have proper ARIA attributes', () => {
      renderWithRouter(<NotificationPermission />);
      
      expect(screen.getByRole('region')).toHaveAttribute(
        'aria-label',
        'Notification permission request'
      );
    });

    it('should have proper ARIA attributes for denied state', () => {
      mockPermission = 'denied';
      (window.Notification as unknown as { permission: string }).permission = 'denied';
      resetPushNotificationService();
      
      renderWithRouter(<NotificationPermission />);
      
      expect(screen.getByRole('alert')).toBeInTheDocument();
    });

    it('should have aria-busy on button while loading', async () => {
      let resolvePermission: (value: NotificationPermission) => void;
      const permissionPromise = new Promise<NotificationPermission>((resolve) => {
        resolvePermission = resolve;
      });
      (window.Notification.requestPermission as ReturnType<typeof vi.fn>).mockReturnValue(permissionPromise);
      
      renderWithRouter(<NotificationPermission />);
      
      const enableButton = screen.getByRole('button', { name: /enable notifications/i });
      fireEvent.click(enableButton);
      
      await waitFor(() => {
        expect(enableButton).toHaveAttribute('aria-busy', 'true');
      });
      
      resolvePermission!('granted');
    });
  });
});

describe('NotificationPermission - Requirements Validation', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    localStorage.clear();
    mockPermission = 'default';
    (window.Notification as unknown as { permission: string }).permission = 'default';
    resetPushNotificationService();
  });

  /**
   * Validates Requirement 13.6: Mobile interface shall implement push notifications for assigned tasks and alerts
   */
  it('should provide UI for enabling push notifications (Requirement 13.6)', () => {
    renderWithRouter(<NotificationPermission />);
    
    // Verify permission request UI is present
    expect(screen.getByRole('heading', { name: 'Enable Notifications' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /enable notifications/i })).toBeInTheDocument();
    
    // Verify description mentions tasks and alerts
    expect(screen.getByText(/task assignments/i)).toBeInTheDocument();
    expect(screen.getByText(/alerts/i)).toBeInTheDocument();
  });
});
