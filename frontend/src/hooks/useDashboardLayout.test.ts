/**
 * Tests for useDashboardLayout hook
 * Validates Requirement 12.7: Dashboard widgets shall be configurable per user
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useDashboardLayout } from './useDashboardLayout';
import type { WidgetConfig } from '../types/widget';

// Mock localStorage
const localStorageMock = (() => {
  let store: Record<string, string> = {};
  return {
    getItem: vi.fn((key: string) => store[key] || null),
    setItem: vi.fn((key: string, value: string) => {
      store[key] = value;
    }),
    removeItem: vi.fn((key: string) => {
      delete store[key];
    }),
    clear: vi.fn(() => {
      store = {};
    }),
  };
})();

Object.defineProperty(window, 'localStorage', {
  value: localStorageMock,
});

describe('useDashboardLayout', () => {
  beforeEach(() => {
    localStorageMock.clear();
    vi.clearAllMocks();
  });

  describe('Initial State', () => {
    it('returns default layout when no saved layout exists', () => {
      const { result } = renderHook(() => useDashboardLayout());

      expect(result.current.layout).toBeDefined();
      expect(result.current.layout.name).toBe('Default Layout');
      expect(result.current.layout.isDefault).toBe(true);
      expect(result.current.layout.widgets.length).toBeGreaterThan(0);
    });

    it('loads saved layout from localStorage', () => {
      const savedLayout = {
        userId: 'current-user',
        name: 'Custom Layout',
        isDefault: false,
        columns: 12,
        widgets: [
          {
            id: 'custom-widget',
            type: 'stat_card',
            title: 'Custom Widget',
            visible: true,
            position: { row: 0, column: 0 },
            size: 'medium',
          },
        ],
        lastModified: new Date().toISOString(),
      };

      localStorageMock.setItem(
        'ams-dashboard-layout-current-user',
        JSON.stringify(savedLayout)
      );

      const { result } = renderHook(() => useDashboardLayout());

      expect(result.current.layout.name).toBe('Custom Layout');
      expect(result.current.layout.widgets).toHaveLength(1);
      expect(result.current.layout.widgets[0].id).toBe('custom-widget');
    });

    it('sets isLoading to false after initialization', async () => {
      const { result } = renderHook(() => useDashboardLayout());

      // After initial render, isLoading should be false
      expect(result.current.isLoading).toBe(false);
    });
  });

  describe('Widget Management', () => {
    it('adds a new widget to the layout', () => {
      const { result } = renderHook(() => useDashboardLayout());
      const initialCount = result.current.layout.widgets.length;

      const newWidget: WidgetConfig = {
        id: 'new-widget-123',
        type: 'compliance_indicators',
        title: 'New Compliance Widget',
        visible: true,
        position: { row: 5, column: 0 },
        size: 'large',
      };

      act(() => {
        result.current.addWidget(newWidget);
      });

      expect(result.current.layout.widgets.length).toBe(initialCount + 1);
      expect(result.current.layout.widgets.find((w) => w.id === 'new-widget-123')).toBeDefined();
    });

    it('removes a widget from the layout', () => {
      const { result } = renderHook(() => useDashboardLayout());
      const widgetToRemove = result.current.layout.widgets[0];
      const initialCount = result.current.layout.widgets.length;

      act(() => {
        result.current.removeWidget(widgetToRemove.id);
      });

      expect(result.current.layout.widgets.length).toBe(initialCount - 1);
      expect(result.current.layout.widgets.find((w) => w.id === widgetToRemove.id)).toBeUndefined();
    });

    it('updates widget configuration', () => {
      const { result } = renderHook(() => useDashboardLayout());
      const widgetToUpdate = result.current.layout.widgets[0];

      act(() => {
        result.current.updateWidget(widgetToUpdate.id, {
          title: 'Updated Title',
          size: 'large',
        });
      });

      const updatedWidget = result.current.layout.widgets.find((w) => w.id === widgetToUpdate.id);
      expect(updatedWidget?.title).toBe('Updated Title');
      expect(updatedWidget?.size).toBe('large');
    });

    it('toggles widget visibility', () => {
      const { result } = renderHook(() => useDashboardLayout());
      const widget = result.current.layout.widgets[0];
      const initialVisibility = widget.visible;

      act(() => {
        result.current.toggleWidgetVisibility(widget.id);
      });

      const toggledWidget = result.current.layout.widgets.find((w) => w.id === widget.id);
      expect(toggledWidget?.visible).toBe(!initialVisibility);
    });

    it('reorders widgets', () => {
      const { result } = renderHook(() => useDashboardLayout());
      const originalWidgets = [...result.current.layout.widgets];
      const reorderedWidgets = [...originalWidgets].reverse();

      act(() => {
        result.current.reorderWidgets(reorderedWidgets);
      });

      expect(result.current.layout.widgets[0].id).toBe(reorderedWidgets[0].id);
    });
  });

  describe('Layout Persistence', () => {
    it('saves layout to localStorage', () => {
      const { result } = renderHook(() => useDashboardLayout());

      act(() => {
        result.current.addWidget({
          id: 'test-widget',
          type: 'stat_card',
          title: 'Test',
          visible: true,
          position: { row: 0, column: 0 },
          size: 'small',
        });
      });

      act(() => {
        result.current.saveLayout();
      });

      expect(localStorageMock.setItem).toHaveBeenCalled();
      const savedData = JSON.parse(
        localStorageMock.setItem.mock.calls[localStorageMock.setItem.mock.calls.length - 1][1]
      );
      expect(savedData.widgets.find((w: WidgetConfig) => w.id === 'test-widget')).toBeDefined();
    });

    it('tracks unsaved changes', () => {
      const { result } = renderHook(() => useDashboardLayout());

      expect(result.current.hasChanges).toBe(false);

      act(() => {
        result.current.addWidget({
          id: 'new-widget',
          type: 'stat_card',
          title: 'New',
          visible: true,
          position: { row: 0, column: 0 },
          size: 'small',
        });
      });

      expect(result.current.hasChanges).toBe(true);

      act(() => {
        result.current.saveLayout();
      });

      expect(result.current.hasChanges).toBe(false);
    });

    it('resets to default layout', () => {
      const { result } = renderHook(() => useDashboardLayout());

      // Make some changes
      act(() => {
        result.current.removeWidget(result.current.layout.widgets[0].id);
        result.current.addWidget({
          id: 'custom-widget',
          type: 'stat_card',
          title: 'Custom',
          visible: true,
          position: { row: 0, column: 0 },
          size: 'small',
        });
      });

      act(() => {
        result.current.resetToDefault();
      });

      expect(result.current.layout.name).toBe('Default Layout');
      expect(result.current.layout.isDefault).toBe(true);
      expect(result.current.hasChanges).toBe(false);
    });
  });

  describe('Visible Widgets', () => {
    it('returns only visible widgets', () => {
      const { result } = renderHook(() => useDashboardLayout());
      const widget = result.current.layout.widgets[0];

      // Hide a widget
      act(() => {
        result.current.toggleWidgetVisibility(widget.id);
      });

      const visibleWidgets = result.current.getVisibleWidgets();
      expect(visibleWidgets.find((w) => w.id === widget.id)).toBeUndefined();
    });

    it('sorts visible widgets by position', () => {
      const { result } = renderHook(() => useDashboardLayout());

      // Add widgets with specific positions
      act(() => {
        result.current.addWidget({
          id: 'widget-row-2',
          type: 'stat_card',
          title: 'Row 2',
          visible: true,
          position: { row: 2, column: 0 },
          size: 'small',
        });
        result.current.addWidget({
          id: 'widget-row-1',
          type: 'stat_card',
          title: 'Row 1',
          visible: true,
          position: { row: 1, column: 0 },
          size: 'small',
        });
      });

      const visibleWidgets = result.current.getVisibleWidgets();
      
      // Verify widgets are sorted by row
      for (let i = 1; i < visibleWidgets.length; i++) {
        const prev = visibleWidgets[i - 1];
        const curr = visibleWidgets[i];
        expect(
          prev.position.row < curr.position.row ||
          (prev.position.row === curr.position.row && prev.position.column <= curr.position.column)
        ).toBe(true);
      }
    });
  });

  describe('Requirement 12.7 Validation', () => {
    /**
     * Validates Requirement 12.7: Dashboard widgets shall be configurable per user
     */
    it('supports per-user widget configuration (Requirement 12.7)', () => {
      const { result } = renderHook(() => useDashboardLayout());

      // Verify user-specific layout
      expect(result.current.layout.userId).toBe('current-user');

      // Verify widgets can be configured
      const widget = result.current.layout.widgets[0];
      act(() => {
        result.current.updateWidget(widget.id, {
          settings: { maxItems: 10, showTrends: true },
        });
      });

      const updatedWidget = result.current.layout.widgets.find((w) => w.id === widget.id);
      expect(updatedWidget?.settings?.maxItems).toBe(10);
      expect(updatedWidget?.settings?.showTrends).toBe(true);
    });

    /**
     * Validates Requirement 12.7: Layout customization per user
     */
    it('persists layout customization per user (Requirement 12.7)', () => {
      const { result } = renderHook(() => useDashboardLayout());

      // Customize layout
      act(() => {
        result.current.addWidget({
          id: 'user-custom-widget',
          type: 'recent_activity',
          title: 'My Activity',
          visible: true,
          position: { row: 10, column: 0 },
          size: 'medium',
        });
        result.current.saveLayout();
      });

      // Verify saved to user-specific key
      expect(localStorageMock.setItem).toHaveBeenCalledWith(
        'ams-dashboard-layout-current-user',
        expect.any(String)
      );
    });
  });
});
