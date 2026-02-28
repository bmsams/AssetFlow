import { Navigate, type RouteObject } from 'react-router-dom';
import { type NavGroup } from '../components/layout';
import type { UserRole } from '../hooks/useAuth';
import { ProtectedRoute } from '../components/auth/ProtectedRoute';

// Page Components
import { DashboardPage } from '../pages/DashboardPage';
import { AssetsPage } from '../pages/AssetsPage';
import { AssetDetailPageWrapper } from '../pages/AssetDetailPageWrapper';
import { AssetCreatePage } from '../pages/AssetCreatePage';
import { AssetEditPage } from '../pages/AssetEditPage';
import { HardwareAssetsPage } from '../pages/HardwareAssetsPage';
import { SoftwareAssetsPage } from '../pages/SoftwareAssetsPage';
import { EnterpriseAssetsPage } from '../pages/EnterpriseAssetsPage';
import { StockroomPage } from '../pages/StockroomPage';
import { ContractsPage } from '../pages/ContractsPage';
import { ReportsPage } from '../pages/ReportsPage';
import { SettingsPage } from '../pages/SettingsPage';
import { NotFoundPage } from '../pages/NotFoundPage';
import { ProcurementPage } from '../pages/ProcurementPage';
import { LicenseWorkbenchPage } from '../pages/LicenseWorkbenchPage';
import { AssetLifecyclePage } from '../pages/AssetLifecyclePage';
import { ServiceCatalogPage } from '../pages/ServiceCatalogPage';
import { LoginPage } from '../pages/LoginPage';

// Report Page Components
import { AssetSummaryReport } from '../pages/reports/AssetSummaryReport';
import { AssetAgingReport } from '../pages/reports/AssetAgingReport';
import { AssetByLocationReport } from '../pages/reports/AssetByLocationReport';
import { AssetByDepartmentReport } from '../pages/reports/AssetByDepartmentReport';
import { CostCenterUtilizationReport } from '../pages/reports/CostCenterUtilizationReport';
import { ProcurementSpendingReport } from '../pages/reports/ProcurementSpendingReport';
import { WorkOrderSummaryReport } from '../pages/reports/WorkOrderSummaryReport';
import { MaintenanceComplianceReport } from '../pages/reports/MaintenanceComplianceReport';

// Admin Page Components - New Unified Pages
import {
  LocationsPage,
  StoragePage,
  DepartmentsPage,
  DepartmentForm,
  CostCentersPage,
  CostCenterForm,
  VendorsPage,
  VendorForm,
  ManufacturersPage,
  ManufacturerForm,
  ModelsPage,
  ModelForm,
  UsersPage,
  UserEditPage,
} from '../pages/admin';

// Procurement Page Components
import {
  PurchaseOrdersPage,
  PurchaseOrderForm,
  PurchaseOrderDetailPage,
  RequisitionsPage,
  RequisitionForm,
  RequisitionDetailPage,
} from '../pages/procurement';

// Receiving Components
import { ReceivingForm, InspectionForm } from '../pages/procurement';

// HAM Page Components
import { TransfersPage } from '../pages/ham/TransfersPage';
import { LoanerManagementPage } from '../pages/ham/LoanerManagementPage';
import { AuditScanPage } from '../pages/ham/AuditScanPage';
import { DisposalPage } from '../pages/ham/DisposalPage';

// EAM Page Components
import { WorkOrdersPage } from '../pages/eam/WorkOrdersPage';
import { MaintenancePlansPage } from '../pages/eam/MaintenancePlansPage';
import { LinearAssetsPage } from '../pages/eam/LinearAssetsPage';
import { PartsInventoryPage } from '../pages/eam/PartsInventoryPage';

// Notification Pages
import { NotificationPreferencesPage } from '../pages/NotificationPreferencesPage';

/**
 * Application routes configuration
 * Supports browser history navigation (Requirement 11.4)
 * With role-based access control (Requirement 20.1.5)
 */
export const routes: RouteObject[] = [
  {
    path: '/login',
    element: <LoginPage />,
  },
  {
    path: '/',
    element: <ProtectedRoute requiredRoles={['viewer', 'admin', 'asset_manager', 'inventory_manager', 'procurement_manager', 'facilities_manager', 'auditor']}><DashboardPage /></ProtectedRoute>,
  },
  // Asset Management Routes
  {
    path: '/assets',
    element: <ProtectedRoute requiredRoles={['viewer', 'admin', 'asset_manager', 'auditor']}><AssetsPage /></ProtectedRoute>,
  },
  {
    path: '/assets/new',
    element: <ProtectedRoute requiredRoles={['admin', 'asset_manager']}><AssetCreatePage /></ProtectedRoute>,
  },
  {
    path: '/assets/:assetId',
    element: <ProtectedRoute requiredRoles={['viewer', 'admin', 'asset_manager', 'auditor']}><AssetDetailPageWrapper /></ProtectedRoute>,
  },
  {
    path: '/assets/:assetId/edit',
    element: <ProtectedRoute requiredRoles={['admin', 'asset_manager']}><AssetEditPage /></ProtectedRoute>,
  },
  {
    path: '/assets/hardware',
    element: <ProtectedRoute requiredRoles={['viewer', 'admin', 'asset_manager', 'auditor']}><HardwareAssetsPage /></ProtectedRoute>,
  },
  {
    path: '/assets/software',
    element: <ProtectedRoute requiredRoles={['viewer', 'admin', 'asset_manager', 'license_analyst', 'auditor']}><SoftwareAssetsPage /></ProtectedRoute>,
  },
  {
    path: '/assets/enterprise',
    element: <ProtectedRoute requiredRoles={['viewer', 'admin', 'asset_manager', 'facilities_manager', 'auditor']}><EnterpriseAssetsPage /></ProtectedRoute>,
  },
  {
    path: '/assets/:assetId/lifecycle',
    element: <ProtectedRoute requiredRoles={['asset_manager', 'admin']}><AssetLifecyclePage /></ProtectedRoute>,
  },
  // Stockroom Routes
  {
    path: '/stockrooms',
    element: <ProtectedRoute requiredRoles={['viewer', 'admin', 'inventory_manager', 'asset_manager', 'facilities_manager']}><StockroomPage /></ProtectedRoute>,
  },
  // Procurement Routes
  {
    path: '/procurement',
    element: <ProtectedRoute requiredRoles={['procurement_manager', 'admin']}><ProcurementPage /></ProtectedRoute>,
  },
  {
    path: '/licenses',
    element: <ProtectedRoute requiredRoles={['viewer', 'admin', 'license_analyst']}><LicenseWorkbenchPage /></ProtectedRoute>,
  },
  {
    path: '/service-catalog',
    element: <ProtectedRoute requiredRoles={['viewer', 'admin', 'asset_manager']}><ServiceCatalogPage /></ProtectedRoute>,
  },
  {
    path: '/contracts',
    element: <ProtectedRoute requiredRoles={['auditor', 'procurement_manager', 'admin', 'license_analyst', 'viewer']}><ContractsPage /></ProtectedRoute>,
  },
  // Reports Routes
  {
    path: '/reports',
    element: <ProtectedRoute requiredRoles={['auditor', 'viewer', 'admin', 'facilities_manager', 'asset_manager']}><ReportsPage /></ProtectedRoute>,
  },
  {
    path: '/reports/asset-summary',
    element: <ProtectedRoute requiredRoles={['auditor', 'viewer', 'admin', 'facilities_manager', 'asset_manager']}><AssetSummaryReport /></ProtectedRoute>,
  },
  {
    path: '/reports/asset-aging',
    element: <ProtectedRoute requiredRoles={['auditor', 'viewer', 'admin', 'facilities_manager', 'asset_manager']}><AssetAgingReport /></ProtectedRoute>,
  },
  {
    path: '/reports/assets-by-location',
    element: <ProtectedRoute requiredRoles={['auditor', 'viewer', 'admin', 'facilities_manager', 'asset_manager']}><AssetByLocationReport /></ProtectedRoute>,
  },
  {
    path: '/reports/assets-by-department',
    element: <ProtectedRoute requiredRoles={['auditor', 'viewer', 'admin', 'facilities_manager', 'asset_manager']}><AssetByDepartmentReport /></ProtectedRoute>,
  },
  {
    path: '/reports/cost-center-utilization',
    element: <ProtectedRoute requiredRoles={['auditor', 'admin']}><CostCenterUtilizationReport /></ProtectedRoute>,
  },
  {
    path: '/reports/procurement-spending',
    element: <ProtectedRoute requiredRoles={['auditor', 'procurement_manager', 'admin']}><ProcurementSpendingReport /></ProtectedRoute>,
  },
  {
    path: '/reports/work-order-summary',
    element: <ProtectedRoute requiredRoles={['auditor', 'facilities_manager', 'admin']}><WorkOrderSummaryReport /></ProtectedRoute>,
  },
  {
    path: '/reports/maintenance-compliance',
    element: <ProtectedRoute requiredRoles={['auditor', 'facilities_manager', 'admin']}><MaintenanceComplianceReport /></ProtectedRoute>,
  },
  // Settings Route
  {
    path: '/settings',
    element: <ProtectedRoute requiredRoles={['admin']}><SettingsPage /></ProtectedRoute>,
  },
  // Admin - Unified Location & Storage Management (New Compact UI)
  {
    path: '/admin',
    element: <Navigate to="/admin/locations" replace />,
  },
  {
    path: '/admin/locations',
    element: <ProtectedRoute requiredRoles={['admin']}><LocationsPage /></ProtectedRoute>,
  },
  {
    path: '/admin/storage',
    element: <ProtectedRoute requiredRoles={['admin']}><StoragePage /></ProtectedRoute>,
  },
  // Admin - Reference Data: Departments
  {
    path: '/admin/departments',
    element: <ProtectedRoute requiredRoles={['admin']}><DepartmentsPage /></ProtectedRoute>,
  },
  {
    path: '/admin/departments/new',
    element: <ProtectedRoute requiredRoles={['admin']}><DepartmentForm /></ProtectedRoute>,
  },
  {
    path: '/admin/departments/:departmentId',
    element: <ProtectedRoute requiredRoles={['admin']}><DepartmentForm /></ProtectedRoute>,
  },
  // Admin - Reference Data: Cost Centers
  {
    path: '/admin/cost-centers',
    element: <ProtectedRoute requiredRoles={['admin']}><CostCentersPage /></ProtectedRoute>,
  },
  {
    path: '/admin/cost-centers/new',
    element: <ProtectedRoute requiredRoles={['admin']}><CostCenterForm /></ProtectedRoute>,
  },
  {
    path: '/admin/cost-centers/:costCenterId',
    element: <ProtectedRoute requiredRoles={['admin']}><CostCenterForm /></ProtectedRoute>,
  },
  {
    path: '/admin/cost-centers/:costCenterId/edit',
    element: <ProtectedRoute requiredRoles={['admin']}><CostCenterForm /></ProtectedRoute>,
  },
  // Admin - Reference Data: Vendors
  {
    path: '/admin/vendors',
    element: <ProtectedRoute requiredRoles={['admin', 'procurement_manager']}><VendorsPage /></ProtectedRoute>,
  },
  {
    path: '/admin/vendors/new',
    element: <ProtectedRoute requiredRoles={['admin', 'procurement_manager']}><VendorForm /></ProtectedRoute>,
  },
  {
    path: '/admin/vendors/:vendorId',
    element: <ProtectedRoute requiredRoles={['admin', 'procurement_manager']}><VendorForm /></ProtectedRoute>,
  },
  // Admin - Reference Data: Manufacturers
  {
    path: '/admin/manufacturers',
    element: <ProtectedRoute requiredRoles={['admin']}><ManufacturersPage /></ProtectedRoute>,
  },
  {
    path: '/admin/manufacturers/new',
    element: <ProtectedRoute requiredRoles={['admin']}><ManufacturerForm /></ProtectedRoute>,
  },
  {
    path: '/admin/manufacturers/:manufacturerId',
    element: <ProtectedRoute requiredRoles={['admin']}><ManufacturerForm /></ProtectedRoute>,
  },
  // Admin - Reference Data: Product Catalog (Models)
  {
    path: '/admin/products',
    element: <ProtectedRoute requiredRoles={['admin']}><ModelsPage /></ProtectedRoute>,
  },
  {
    path: '/admin/products/new',
    element: <ProtectedRoute requiredRoles={['admin']}><ModelForm /></ProtectedRoute>,
  },
  {
    path: '/admin/products/:modelId',
    element: <ProtectedRoute requiredRoles={['admin']}><ModelForm /></ProtectedRoute>,
  },
  // Admin - Users
  {
    path: '/admin/users',
    element: <ProtectedRoute requiredRoles={['admin']}><UsersPage /></ProtectedRoute>,
  },
  {
    path: '/admin/users/:userId/edit',
    element: <ProtectedRoute requiredRoles={['admin']}><UserEditPage /></ProtectedRoute>,
  },
  // Procurement - Purchase Order Management
  {
    path: '/procurement/purchase-orders',
    element: <ProtectedRoute requiredRoles={['procurement_manager', 'admin']}><PurchaseOrdersPage /></ProtectedRoute>,
  },
  {
    path: '/procurement/requisitions',
    element: <ProtectedRoute requiredRoles={['procurement_manager', 'admin']}><RequisitionsPage /></ProtectedRoute>,
  },
  {
    path: '/procurement/requisitions/new',
    element: <ProtectedRoute requiredRoles={['procurement_manager', 'admin']}><RequisitionForm /></ProtectedRoute>,
  },
  {
    path: '/procurement/requisitions/:requisitionId',
    element: <ProtectedRoute requiredRoles={['procurement_manager', 'admin']}><RequisitionDetailPage /></ProtectedRoute>,
  },
  {
    path: '/procurement/purchase-orders/new',
    element: <ProtectedRoute requiredRoles={['procurement_manager', 'admin']}><PurchaseOrderForm /></ProtectedRoute>,
  },
  {
    path: '/procurement/purchase-orders/:poId',
    element: <ProtectedRoute requiredRoles={['procurement_manager', 'admin']}><PurchaseOrderDetailPage /></ProtectedRoute>,
  },
  {
    path: '/procurement/purchase-orders/:poId/edit',
    element: <ProtectedRoute requiredRoles={['procurement_manager', 'admin']}><PurchaseOrderForm /></ProtectedRoute>,
  },
  // Receiving & Inspection
  {
    path: '/procurement/receiving',
    element: <ProtectedRoute requiredRoles={['procurement_manager', 'inventory_manager', 'admin']}><ReceivingForm /></ProtectedRoute>,
  },
  {
    path: '/procurement/inspections/:inspectionId',
    element: <ProtectedRoute requiredRoles={['procurement_manager', 'inventory_manager', 'admin']}><InspectionForm /></ProtectedRoute>,
  },
  // HAM Workflow Routes
  {
    path: '/ham/transfers',
    element: <ProtectedRoute requiredRoles={['admin', 'asset_manager', 'inventory_manager']}><TransfersPage /></ProtectedRoute>,
  },
  {
    path: '/ham/loaners',
    element: <ProtectedRoute requiredRoles={['admin', 'asset_manager']}><LoanerManagementPage /></ProtectedRoute>,
  },
  {
    path: '/ham/audit-scans',
    element: <ProtectedRoute requiredRoles={['admin', 'asset_manager']}><AuditScanPage /></ProtectedRoute>,
  },
  {
    path: '/ham/disposal',
    element: <ProtectedRoute requiredRoles={['admin', 'asset_manager']}><DisposalPage /></ProtectedRoute>,
  },
  // EAM Workflow Routes
  {
    path: '/eam/work-orders',
    element: <ProtectedRoute requiredRoles={['admin', 'facilities_manager']}><WorkOrdersPage /></ProtectedRoute>,
  },
  {
    path: '/eam/maintenance-plans',
    element: <ProtectedRoute requiredRoles={['admin', 'facilities_manager']}><MaintenancePlansPage /></ProtectedRoute>,
  },
  {
    path: '/eam/linear-assets',
    element: <ProtectedRoute requiredRoles={['admin', 'facilities_manager']}><LinearAssetsPage /></ProtectedRoute>,
  },
  {
    path: '/eam/parts-inventory',
    element: <ProtectedRoute requiredRoles={['admin', 'facilities_manager']}><PartsInventoryPage /></ProtectedRoute>,
  },
  // Notification Preferences
  {
    path: '/notifications/preferences',
    element: <ProtectedRoute><NotificationPreferencesPage /></ProtectedRoute>,
  },
  {
    path: '*',
    element: <NotFoundPage />,
  },
];


/**
 * Navigation groups for sidebar
 * Compact organization - reduced from 6 admin items to 2 unified pages
 */
export const navigationGroups: NavGroup[] = [
  {
    title: 'Overview',
    items: [
      {
        path: '/',
        label: 'Dashboard',
        roles: ['viewer', 'admin', 'asset_manager', 'inventory_manager', 'procurement_manager', 'facilities_manager', 'auditor'] as UserRole[],
        icon: (
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <rect x="3" y="3" width="7" height="7" rx="1" />
            <rect x="14" y="3" width="7" height="7" rx="1" />
            <rect x="3" y="14" width="7" height="7" rx="1" />
            <rect x="14" y="14" width="7" height="7" rx="1" />
          </svg>
        ),
      },
    ],
  },
  {
    title: 'Asset Management',
    items: [
      {
        path: '/assets',
        label: 'All Assets',
        roles: ['viewer', 'admin', 'asset_manager', 'auditor'] as UserRole[],
        icon: (
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M20 7h-9" />
            <path d="M14 17H5" />
            <circle cx="17" cy="17" r="3" />
            <circle cx="7" cy="7" r="3" />
          </svg>
        ),
      },
      {
        path: '/assets/hardware',
        label: 'Hardware',
        roles: ['viewer', 'admin', 'asset_manager', 'auditor'] as UserRole[],
        icon: (
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <rect x="2" y="3" width="20" height="14" rx="2" />
            <line x1="8" y1="21" x2="16" y2="21" />
            <line x1="12" y1="17" x2="12" y2="21" />
          </svg>
        ),
      },
      {
        path: '/assets/software',
        label: 'Software',
        roles: ['viewer', 'admin', 'asset_manager', 'license_analyst', 'auditor'] as UserRole[],
        icon: (
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M4 17l6-6-6-6" />
            <path d="M12 19h8" />
          </svg>
        ),
      },
      {
        path: '/assets/enterprise',
        label: 'Enterprise',
        roles: ['viewer', 'admin', 'asset_manager', 'facilities_manager', 'auditor'] as UserRole[],
        icon: (
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M3 21h18" />
            <path d="M5 21V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2v16" />
          </svg>
        ),
      },
    ],
  },
  {
    title: 'Procurement',
    items: [
      {
        path: '/procurement',
        label: 'Overview',
        roles: ['admin', 'procurement_manager'] as UserRole[],
        icon: (
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M6 2L3 6v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V6l-3-4z" />
            <line x1="3" y1="6" x2="21" y2="6" />
            <path d="M16 10a4 4 0 0 1-8 0" />
          </svg>
        ),
      },
      {
        path: '/procurement/purchase-orders',
        label: 'Purchase Orders',
        roles: ['admin', 'procurement_manager'] as UserRole[],
        icon: (
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
            <polyline points="14 2 14 8 20 8" />
          </svg>
        ),
      },
      {
        path: '/procurement/requisitions',
        label: 'Requisitions',
        roles: ['admin', 'procurement_manager'] as UserRole[],
        icon: (
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M9 3h6l1 2h3v16H5V5h3l1-2z" />
            <path d="M9 12h6" />
            <path d="M9 16h6" />
            <path d="M12 8h.01" />
          </svg>
        ),
      },
      {
        path: '/procurement/receiving',
        label: 'Receiving',
        roles: ['admin', 'procurement_manager', 'inventory_manager'] as UserRole[],
        icon: (
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M21 16V8a2 2 0 00-1-1.73l-7-4a2 2 0 00-2 0l-7 4A2 2 0 003 8v8a2 2 0 001 1.73l7 4a2 2 0 002 0l7-4A2 2 0 0021 16z" />
            <polyline points="3.27 6.96 12 12.01 20.73 6.96" />
            <line x1="12" y1="22.08" x2="12" y2="12" />
          </svg>
        ),
      },
      {
        path: '/admin/vendors',
        label: 'Vendors',
        roles: ['admin', 'procurement_manager'] as UserRole[],
        icon: (
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" />
            <circle cx="9" cy="7" r="4" />
            <path d="M22 21v-2a4 4 0 0 0-3-3.87" />
            <path d="M16 3.13a4 4 0 0 1 0 7.75" />
          </svg>
        ),
      },
    ],
  },
  {
    title: 'Inventory',
    items: [
      {
        path: '/stockrooms',
        label: 'Stockrooms',
        roles: ['viewer', 'admin', 'inventory_manager', 'asset_manager', 'facilities_manager'] as UserRole[],
        icon: (
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" />
            <polyline points="9 22 9 12 15 12 15 22" />
          </svg>
        ),
      },
      {
        path: '/contracts',
        label: 'Contracts',
        roles: ['auditor', 'procurement_manager', 'admin', 'license_analyst', 'viewer'] as UserRole[],
        icon: (
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
            <polyline points="14 2 14 8 20 8" />
          </svg>
        ),
      },
      {
        path: '/licenses',
        label: 'Licenses',
        roles: ['admin', 'license_analyst'] as UserRole[],
        icon: (
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M9 12l2 2 4-4" />
            <path d="M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
        ),
      },
      {
        path: '/service-catalog',
        label: 'Service Catalog',
        roles: ['viewer', 'admin', 'asset_manager'] as UserRole[],
        icon: (
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <circle cx="11" cy="11" r="8" />
            <path d="M21 21l-4.35-4.35" />
          </svg>
        ),
      },
    ],
  },
  {
    title: 'HAM Workflows',
    items: [
      {
        path: '/ham/transfers',
        label: 'Transfers',
        roles: ['admin', 'asset_manager', 'inventory_manager'] as UserRole[],
        icon: (
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M17 1l4 4-4 4" />
            <path d="M3 11V9a4 4 0 0 1 4-4h14" />
            <path d="M7 23l-4-4 4-4" />
            <path d="M21 13v2a4 4 0 0 1-4 4H3" />
          </svg>
        ),
      },
      {
        path: '/ham/loaners',
        label: 'Loaners',
        roles: ['admin', 'asset_manager'] as UserRole[],
        icon: (
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" />
            <circle cx="9" cy="7" r="4" />
            <path d="M22 21v-2a4 4 0 0 0-3-3.87" />
            <path d="M16 3.13a4 4 0 0 1 0 7.75" />
          </svg>
        ),
      },
      {
        path: '/ham/audit-scans',
        label: 'Audit Scans',
        roles: ['admin', 'asset_manager'] as UserRole[],
        icon: (
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M9 12l2 2 4-4" />
            <rect x="3" y="3" width="18" height="18" rx="2" />
          </svg>
        ),
      },
      {
        path: '/ham/disposal',
        label: 'Disposal',
        roles: ['admin', 'asset_manager'] as UserRole[],
        icon: (
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <polyline points="3 6 5 6 21 6" />
            <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
          </svg>
        ),
      },
    ],
  },
  {
    title: 'EAM Workflows',
    items: [
      {
        path: '/eam/work-orders',
        label: 'Work Orders',
        roles: ['admin', 'facilities_manager'] as UserRole[],
        icon: (
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M9 5H7a2 2 0 0 0-2 2v12a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V7a2 2 0 0 0-2-2h-2" />
            <rect x="9" y="3" width="6" height="4" rx="1" />
            <path d="M9 14l2 2 4-4" />
          </svg>
        ),
      },
      {
        path: '/eam/maintenance-plans',
        label: 'Maintenance Plans',
        roles: ['admin', 'facilities_manager'] as UserRole[],
        icon: (
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <circle cx="12" cy="12" r="10" />
            <polyline points="12 6 12 12 16 14" />
          </svg>
        ),
      },
      {
        path: '/eam/linear-assets',
        label: 'Linear Assets',
        roles: ['admin', 'facilities_manager'] as UserRole[],
        icon: (
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M2 12h20" />
            <circle cx="6" cy="12" r="2" />
            <circle cx="12" cy="12" r="2" />
            <circle cx="18" cy="12" r="2" />
          </svg>
        ),
      },
      {
        path: '/eam/parts-inventory',
        label: 'Parts Inventory',
        roles: ['admin', 'facilities_manager'] as UserRole[],
        icon: (
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M21 16V8a2 2 0 00-1-1.73l-7-4a2 2 0 00-2 0l-7 4A2 2 0 003 8v8a2 2 0 001 1.73l7 4a2 2 0 002 0l7-4A2 2 0 0021 16z" />
            <polyline points="3.27 6.96 12 12.01 20.73 6.96" />
            <line x1="12" y1="22.08" x2="12" y2="12" />
          </svg>
        ),
      },
    ],
  },
  {
    title: 'Analytics',
    items: [
      {
        path: '/reports',
        label: 'Reports',
        roles: ['auditor', 'viewer', 'admin', 'facilities_manager', 'asset_manager'] as UserRole[],
        icon: (
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <line x1="18" y1="20" x2="18" y2="10" />
            <line x1="12" y1="20" x2="12" y2="4" />
            <line x1="6" y1="20" x2="6" y2="14" />
          </svg>
        ),
      },
    ],
  },
  {
    title: 'Administration',
    items: [
      {
        path: '/admin/locations',
        label: 'Locations',
        roles: ['admin'] as UserRole[],
        icon: (
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M3 21h18" />
            <path d="M5 21V7l8-4v18" />
            <path d="M19 21V11l-6-4" />
          </svg>
        ),
      },
      {
        path: '/admin/storage',
        label: 'Storage',
        roles: ['admin'] as UserRole[],
        icon: (
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M3 21V8l9-5 9 5v13" />
            <rect x="6" y="12" width="4" height="9" />
            <rect x="14" y="12" width="4" height="9" />
          </svg>
        ),
      },
      {
        path: '/admin/departments',
        label: 'Departments',
        roles: ['admin'] as UserRole[],
        icon: (
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
            <circle cx="9" cy="7" r="4" />
            <path d="M23 21v-2a4 4 0 0 0-3-3.87" />
            <path d="M16 3.13a4 4 0 0 1 0 7.75" />
          </svg>
        ),
      },
      {
        path: '/admin/cost-centers',
        label: 'Cost Centers',
        roles: ['admin'] as UserRole[],
        icon: (
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <line x1="12" y1="1" x2="12" y2="23" />
            <path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6" />
          </svg>
        ),
      },
      {
        path: '/admin/products',
        label: 'Product Catalog',
        roles: ['admin'] as UserRole[],
        icon: (
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <rect x="2" y="3" width="20" height="14" rx="2" />
            <line x1="8" y1="21" x2="16" y2="21" />
            <line x1="12" y1="17" x2="12" y2="21" />
          </svg>
        ),
      },
      {
        path: '/admin/manufacturers',
        label: 'Manufacturers',
        roles: ['admin'] as UserRole[],
        icon: (
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M2 20a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2V8l-7 5V8l-7 5V4a2 2 0 0 0-2-2H4a2 2 0 0 0-2 2Z" />
          </svg>
        ),
      },
      {
        path: '/admin/users',
        label: 'Users',
        roles: ['admin'] as UserRole[],
        icon: (
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
            <circle cx="12" cy="7" r="4" />
          </svg>
        ),
      },
      {
        path: '/settings',
        label: 'Settings',
        roles: ['admin'] as UserRole[],
        icon: (
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <circle cx="12" cy="12" r="3" />
            <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z" />
          </svg>
        ),
      },
    ],
  },
];
