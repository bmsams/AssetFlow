/**
 * Widget types for Dashboard Customization
 * Implements Requirements 12.7, 12.8:
 * - Dashboard widgets shall be configurable per user
 * - Drill-down navigation from summary metrics to detailed records
 */

import type { AssetType, AssetStatus } from './asset';

/**
 * Available widget types for the dashboard
 */
export type WidgetType =
  | 'stat_card'
  | 'lifecycle_chart'
  | 'lease_expirations'
  | 'compliance_indicators'
  | 'category_breakdown'
  | 'recent_activity';

/**
 * Widget size options
 */
export type WidgetSize = 'small' | 'medium' | 'large';

/**
 * Widget configuration stored per user
 */
export interface WidgetConfig {
  /** Unique identifier for the widget instance */
  id: string;
  /** Type of widget to render */
  type: WidgetType;
  /** Display title for the widget */
  title: string;
  /** Whether the widget is visible */
  visible: boolean;
  /** Position in the grid (row, column) */
  position: {
    row: number;
    column: number;
  };
  /** Size of the widget */
  size: WidgetSize;
  /** Widget-specific settings */
  settings?: WidgetSettings;
}

/**
 * Widget-specific settings
 */
export interface WidgetSettings {
  /** Maximum items to display (for list widgets) */
  maxItems?: number;
  /** Show legend (for chart widgets) */
  showLegend?: boolean;
  /** Filter by asset types */
  assetTypes?: AssetType[];
  /** Filter by asset statuses */
  statuses?: AssetStatus[];
  /** Refresh interval in seconds */
  refreshInterval?: number;
  /** Show trend indicators */
  showTrends?: boolean;
}

/**
 * User's dashboard layout preferences
 */
export interface DashboardLayout {
  /** User ID this layout belongs to */
  userId: string;
  /** Layout name (for multiple saved layouts) */
  name: string;
  /** Whether this is the default layout */
  isDefault: boolean;
  /** Widget configurations */
  widgets: WidgetConfig[];
  /** Number of columns in the grid */
  columns: number;
  /** Last modified timestamp */
  lastModified: string;
}

/**
 * Drill-down navigation target
 */
export interface DrillDownTarget {
  /** Target route path */
  path: string;
  /** Query parameters for filtering */
  params?: Record<string, string>;
  /** Display label for the navigation */
  label: string;
}

/**
 * Widget metadata for the widget picker
 */
export interface WidgetMetadata {
  type: WidgetType;
  name: string;
  description: string;
  icon: string;
  defaultSize: WidgetSize;
  supportsDrillDown: boolean;
  availableSizes: WidgetSize[];
}

/**
 * Available widgets metadata
 */
export const WIDGET_METADATA: WidgetMetadata[] = [
  {
    type: 'stat_card',
    name: 'Statistics Card',
    description: 'Display key metrics with optional trends',
    icon: '📊',
    defaultSize: 'small',
    supportsDrillDown: true,
    availableSizes: ['small', 'medium'],
  },
  {
    type: 'lifecycle_chart',
    name: 'Lifecycle Chart',
    description: 'Asset distribution across lifecycle states',
    icon: '📈',
    defaultSize: 'large',
    supportsDrillDown: true,
    availableSizes: ['medium', 'large'],
  },
  {
    type: 'lease_expirations',
    name: 'Lease Expirations',
    description: 'Upcoming lease expiration alerts',
    icon: '📅',
    defaultSize: 'medium',
    supportsDrillDown: true,
    availableSizes: ['small', 'medium', 'large'],
  },
  {
    type: 'compliance_indicators',
    name: 'Compliance Status',
    description: 'License and warranty compliance indicators',
    icon: '✅',
    defaultSize: 'medium',
    supportsDrillDown: true,
    availableSizes: ['small', 'medium', 'large'],
  },
  {
    type: 'category_breakdown',
    name: 'Category Breakdown',
    description: 'Asset counts and values by category',
    icon: '🏷️',
    defaultSize: 'medium',
    supportsDrillDown: true,
    availableSizes: ['small', 'medium', 'large'],
  },
  {
    type: 'recent_activity',
    name: 'Recent Activity',
    description: 'Latest asset changes and events',
    icon: '🕐',
    defaultSize: 'medium',
    supportsDrillDown: true,
    availableSizes: ['small', 'medium', 'large'],
  },
];

/**
 * Default dashboard layout for new users
 */
export const DEFAULT_DASHBOARD_LAYOUT: Omit<DashboardLayout, 'userId' | 'lastModified'> = {
  name: 'Default Layout',
  isDefault: true,
  columns: 12,
  widgets: [
    {
      id: 'widget-total-value',
      type: 'stat_card',
      title: 'Total Asset Value',
      visible: true,
      position: { row: 0, column: 0 },
      size: 'medium',
      settings: { showTrends: true },
    },
    {
      id: 'widget-total-count',
      type: 'stat_card',
      title: 'Total Assets',
      visible: true,
      position: { row: 0, column: 1 },
      size: 'small',
      settings: { showTrends: true },
    },
    {
      id: 'widget-category-breakdown',
      type: 'category_breakdown',
      title: 'Assets by Category',
      visible: true,
      position: { row: 0, column: 2 },
      size: 'medium',
    },
    {
      id: 'widget-lifecycle',
      type: 'lifecycle_chart',
      title: 'Asset Lifecycle Distribution',
      visible: true,
      position: { row: 1, column: 0 },
      size: 'large',
      settings: { showLegend: true },
    },
    {
      id: 'widget-leases',
      type: 'lease_expirations',
      title: 'Upcoming Lease Expirations',
      visible: true,
      position: { row: 1, column: 1 },
      size: 'small',
      settings: { maxItems: 5 },
    },
    {
      id: 'widget-compliance',
      type: 'compliance_indicators',
      title: 'Compliance Status',
      visible: true,
      position: { row: 2, column: 0 },
      size: 'small',
    },
  ],
};

/**
 * Get drill-down target for a widget type
 */
export function getDrillDownTarget(
  widgetType: WidgetType,
  context?: Record<string, string>
): DrillDownTarget | null {
  const targets: Record<WidgetType, DrillDownTarget> = {
    stat_card: {
      path: '/assets',
      label: 'View All Assets',
      params: context,
    },
    lifecycle_chart: {
      path: '/assets',
      label: 'View Assets by Status',
      params: context,
    },
    lease_expirations: {
      path: '/contracts',
      label: 'View Contracts',
      params: { type: 'lease', ...context },
    },
    compliance_indicators: {
      path: '/licenses',
      label: 'View License Workbench',
      params: context,
    },
    category_breakdown: {
      path: '/assets',
      label: 'View Assets by Category',
      params: context,
    },
    recent_activity: {
      path: '/assets',
      label: 'View Recent Changes',
      params: { sort: 'updated_at', order: 'desc', ...context },
    },
  };

  return targets[widgetType] || null;
}

/**
 * Get widget size in grid columns
 */
export function getWidgetGridSpan(size: WidgetSize): number {
  switch (size) {
    case 'small':
      return 3;
    case 'medium':
      return 4;
    case 'large':
      return 6;
    default:
      return 4;
  }
}
