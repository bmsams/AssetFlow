import { ReactNode } from 'react';

/**
 * Represents an item in a breadcrumb navigation path
 */
export interface BreadcrumbItem {
  /**
   * The text to display for the breadcrumb item
   */
  label: string;
  
  /**
   * Optional URL to navigate to when clicked.
   * If not provided, the item will be rendered as a non-clickable element.
   * The last item in a breadcrumb list typically doesn't have an href.
   */
  href?: string;
}

/**
 * Width options for page layouts
 */
export type PageWidthVariant = 'sm' | 'md' | 'lg' | 'xl' | 'full';

/**
 * Configuration options for page layout components
 */
export interface PageConfig {
  /**
   * The title of the page, rendered as an H1
   */
  title: string;

  /**
   * Optional description text displayed below the title
   */
  description?: string;

  /**
   * Optional breadcrumb navigation items
   */
  breadcrumbs?: BreadcrumbItem[];

  /**
   * Optional actions to display in the page header (buttons, links, etc.)
   */
  headerActions?: ReactNode;

  /**
   * Optional timestamp for when the page content was last updated
   */
  lastUpdated?: Date;

  /**
   * Maximum width for the page content
   * @default 'xl'
   */
  maxWidth?: PageWidthVariant;

  /**
   * Custom class name to apply to the page layout container
   */
  className?: string;
}

/**
 * Common breadcrumb configurations for reuse across the application
 */
export const BREADCRUMB_CONFIGS = {
  /**
   * Dashboard as the only breadcrumb
   */
  DASHBOARD: [
    { label: 'Dashboard', href: '/' }
  ] as BreadcrumbItem[],

  /**
   * Dashboard > Assets breadcrumbs
   */
  ASSETS: [
    { label: 'Dashboard', href: '/' },
    { label: 'Assets', href: '/assets' }
  ] as BreadcrumbItem[],

  /**
   * Dashboard > Stockroom breadcrumbs
   */
  STOCKROOM: [
    { label: 'Dashboard', href: '/' },
    { label: 'Stockroom', href: '/stockrooms' }
  ] as BreadcrumbItem[],

  /**
   * Dashboard > Procurement breadcrumbs
   */
  PROCUREMENT: [
    { label: 'Dashboard', href: '/' },
    { label: 'Procurement', href: '/procurement' }
  ] as BreadcrumbItem[],

  /**
   * Dashboard > Admin breadcrumbs
   */
  ADMIN: [
    { label: 'Dashboard', href: '/' },
    { label: 'Administration' }
  ] as BreadcrumbItem[],

  /**
   * Dashboard > Reports breadcrumbs
   */
  REPORTS: [
    { label: 'Dashboard', href: '/' },
    { label: 'Reports', href: '/reports' }
  ] as BreadcrumbItem[],

  /**
   * Dashboard > License Workbench breadcrumbs
   */
  LICENSE_WORKBENCH: [
    { label: 'Dashboard', href: '/' },
    { label: 'License Workbench', href: '/licenses' }
  ] as BreadcrumbItem[],

  // Admin sub-page breadcrumbs - Locations
  /**
   * Dashboard > Admin > Buildings breadcrumbs
   */
  ADMIN_BUILDINGS: [
    { label: 'Dashboard', href: '/' },
    { label: 'Administration' },
    { label: 'Buildings' }
  ] as BreadcrumbItem[],

  /**
   * Dashboard > Admin > Floors breadcrumbs
   */
  ADMIN_FLOORS: [
    { label: 'Dashboard', href: '/' },
    { label: 'Administration' },
    { label: 'Floors' }
  ] as BreadcrumbItem[],

  /**
   * Dashboard > Admin > Rooms breadcrumbs
   */
  ADMIN_ROOMS: [
    { label: 'Dashboard', href: '/' },
    { label: 'Administration' },
    { label: 'Rooms' }
  ] as BreadcrumbItem[],

  /**
   * Dashboard > Admin > Racks breadcrumbs
   */
  ADMIN_RACKS: [
    { label: 'Dashboard', href: '/' },
    { label: 'Administration' },
    { label: 'Racks' }
  ] as BreadcrumbItem[],

  /**
   * Dashboard > Admin > Locations breadcrumbs
   */
  ADMIN_LOCATIONS: [
    { label: 'Dashboard', href: '/' },
    { label: 'Administration' },
    { label: 'Locations' }
  ] as BreadcrumbItem[],

  // Admin sub-page breadcrumbs - Organization
  /**
   * Dashboard > Admin > Departments breadcrumbs
   */
  ADMIN_DEPARTMENTS: [
    { label: 'Dashboard', href: '/' },
    { label: 'Administration' },
    { label: 'Departments' }
  ] as BreadcrumbItem[],

  /**
   * Dashboard > Admin > Cost Centers breadcrumbs
   */
  ADMIN_COST_CENTERS: [
    { label: 'Dashboard', href: '/' },
    { label: 'Administration' },
    { label: 'Cost Centers' }
  ] as BreadcrumbItem[],

  /**
   * Dashboard > Admin > Users breadcrumbs
   */
  ADMIN_USERS: [
    { label: 'Dashboard', href: '/' },
    { label: 'Administration' },
    { label: 'Users' }
  ] as BreadcrumbItem[],

  // Admin sub-page breadcrumbs - Catalog
  /**
   * Dashboard > Admin > Manufacturers breadcrumbs
   */
  ADMIN_MANUFACTURERS: [
    { label: 'Dashboard', href: '/' },
    { label: 'Administration' },
    { label: 'Manufacturers' }
  ] as BreadcrumbItem[],

  /**
   * Dashboard > Admin > Models breadcrumbs
   */
  ADMIN_MODELS: [
    { label: 'Dashboard', href: '/' },
    { label: 'Administration' },
    { label: 'Product Catalog' }
  ] as BreadcrumbItem[],

  /**
   * Dashboard > Admin > Vendors breadcrumbs
   */
  ADMIN_VENDORS: [
    { label: 'Dashboard', href: '/' },
    { label: 'Administration' },
    { label: 'Vendors' }
  ] as BreadcrumbItem[],

  // Admin sub-page breadcrumbs - Inventory
  /**
   * Dashboard > Admin > Stockrooms breadcrumbs
   */
  ADMIN_STOCKROOMS: [
    { label: 'Dashboard', href: '/' },
    { label: 'Administration' },
    { label: 'Stockrooms' }
  ] as BreadcrumbItem[],

  /**
   * Dashboard > Admin > Bin Locations breadcrumbs
   */
  ADMIN_BIN_LOCATIONS: [
    { label: 'Dashboard', href: '/' },
    { label: 'Administration' },
    { label: 'Bin Locations' }
  ] as BreadcrumbItem[],

  /**
   * Dashboard > Admin > Storage breadcrumbs
   */
  ADMIN_STORAGE: [
    { label: 'Dashboard', href: '/' },
    { label: 'Administration' },
    { label: 'Storage' }
  ] as BreadcrumbItem[]
};
