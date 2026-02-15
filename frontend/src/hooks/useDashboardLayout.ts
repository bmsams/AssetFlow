/**
 * Hook for managing dashboard layout preferences
 * Implements Requirement 12.7: Dashboard widgets shall be configurable per user
 */

import { useState, useEffect, useCallback } from 'react';
import type { DashboardLayout, WidgetConfig } from '../types/widget';
import { DEFAULT_DASHBOARD_LAYOUT } from '../types/widget';

const STORAGE_KEY = 'ams-dashboard-layout';

/**
 * Get the current user ID (placeholder - would come from auth context)
 */
function getCurrentUserId(): string {
  return 'current-user';
}

/**
 * Load layout from localStorage
 */
function loadLayoutFromStorage(userId: string): DashboardLayout | null {
  try {
    const stored = localStorage.getItem(`${STORAGE_KEY}-${userId}`);
    if (stored) {
      return JSON.parse(stored) as DashboardLayout;
    }
  } catch (error) {
    console.error('Failed to load dashboard layout from storage:', error);
  }
  return null;
}

/**
 * Save layout to localStorage
 */
function saveLayoutToStorage(layout: DashboardLayout): void {
  try {
    localStorage.setItem(`${STORAGE_KEY}-${layout.userId}`, JSON.stringify(layout));
  } catch (error) {
    console.error('Failed to save dashboard layout to storage:', error);
  }
}

/**
 * Create default layout for a user
 */
function createDefaultLayout(userId: string): DashboardLayout {
  return {
    ...DEFAULT_DASHBOARD_LAYOUT,
    userId,
    lastModified: new Date().toISOString(),
  };
}

export interface UseDashboardLayoutReturn {
  /** Current dashboard layout */
  layout: DashboardLayout;
  /** Whether the layout is loading */
  isLoading: boolean;
  /** Whether the layout has unsaved changes */
  hasChanges: boolean;
  /** Update a specific widget configuration */
  updateWidget: (widgetId: string, updates: Partial<WidgetConfig>) => void;
  /** Add a new widget to the layout */
  addWidget: (widget: WidgetConfig) => void;
  /** Remove a widget from the layout */
  removeWidget: (widgetId: string) => void;
  /** Toggle widget visibility */
  toggleWidgetVisibility: (widgetId: string) => void;
  /** Reorder widgets */
  reorderWidgets: (widgets: WidgetConfig[]) => void;
  /** Save the current layout */
  saveLayout: () => void;
  /** Reset to default layout */
  resetToDefault: () => void;
  /** Get visible widgets sorted by position */
  getVisibleWidgets: () => WidgetConfig[];
}

/**
 * Hook for managing dashboard layout preferences
 */
export function useDashboardLayout(): UseDashboardLayoutReturn {
  const [layout, setLayout] = useState<DashboardLayout>(() => {
    const userId = getCurrentUserId();
    return loadLayoutFromStorage(userId) || createDefaultLayout(userId);
  });
  const [isLoading, setIsLoading] = useState(true);
  const [hasChanges, setHasChanges] = useState(false);
  const [savedLayout, setSavedLayout] = useState<DashboardLayout | null>(null);

  // Load layout on mount
  useEffect(() => {
    const userId = getCurrentUserId();
    const stored = loadLayoutFromStorage(userId);
    if (stored) {
      setLayout(stored);
      setSavedLayout(stored);
    } else {
      const defaultLayout = createDefaultLayout(userId);
      setLayout(defaultLayout);
      setSavedLayout(defaultLayout);
    }
    setIsLoading(false);
  }, []);

  // Track changes
  useEffect(() => {
    if (savedLayout) {
      const hasUnsavedChanges = JSON.stringify(layout.widgets) !== JSON.stringify(savedLayout.widgets);
      setHasChanges(hasUnsavedChanges);
    }
  }, [layout, savedLayout]);

  const updateWidget = useCallback((widgetId: string, updates: Partial<WidgetConfig>) => {
    setLayout((prev) => ({
      ...prev,
      widgets: prev.widgets.map((widget) =>
        widget.id === widgetId ? { ...widget, ...updates } : widget
      ),
      lastModified: new Date().toISOString(),
    }));
  }, []);

  const addWidget = useCallback((widget: WidgetConfig) => {
    setLayout((prev) => ({
      ...prev,
      widgets: [...prev.widgets, widget],
      lastModified: new Date().toISOString(),
    }));
  }, []);

  const removeWidget = useCallback((widgetId: string) => {
    setLayout((prev) => ({
      ...prev,
      widgets: prev.widgets.filter((widget) => widget.id !== widgetId),
      lastModified: new Date().toISOString(),
    }));
  }, []);

  const toggleWidgetVisibility = useCallback((widgetId: string) => {
    setLayout((prev) => ({
      ...prev,
      widgets: prev.widgets.map((widget) =>
        widget.id === widgetId ? { ...widget, visible: !widget.visible } : widget
      ),
      lastModified: new Date().toISOString(),
    }));
  }, []);

  const reorderWidgets = useCallback((widgets: WidgetConfig[]) => {
    setLayout((prev) => ({
      ...prev,
      widgets,
      lastModified: new Date().toISOString(),
    }));
  }, []);

  const saveLayout = useCallback(() => {
    saveLayoutToStorage(layout);
    setSavedLayout(layout);
    setHasChanges(false);
  }, [layout]);

  const resetToDefault = useCallback(() => {
    const userId = getCurrentUserId();
    const defaultLayout = createDefaultLayout(userId);
    setLayout(defaultLayout);
    saveLayoutToStorage(defaultLayout);
    setSavedLayout(defaultLayout);
    setHasChanges(false);
  }, []);

  const getVisibleWidgets = useCallback(() => {
    return layout.widgets
      .filter((widget) => widget.visible)
      .sort((a, b) => {
        if (a.position.row !== b.position.row) {
          return a.position.row - b.position.row;
        }
        return a.position.column - b.position.column;
      });
  }, [layout.widgets]);

  return {
    layout,
    isLoading,
    hasChanges,
    updateWidget,
    addWidget,
    removeWidget,
    toggleWidgetVisibility,
    reorderWidgets,
    saveLayout,
    resetToDefault,
    getVisibleWidgets,
  };
}

export default useDashboardLayout;
