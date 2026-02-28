import { BrowserRouter, useLocation, useRoutes } from 'react-router-dom';
import { useEffect, useMemo } from 'react';
import { ThemeProvider } from './components/theme';
import { ToastProvider } from './components/ui';
import { MainLayout } from './components/layout';
import { Announcer } from './components/accessibility';
import { routes, navigationGroups } from './routes';
import { useAuth } from './hooks/useAuth';
import { filterNavGroupsByRoles } from './utils/navigation';

/**
 * Router component that renders routes within the main layout
 * Implements client-side routing with React Router (Requirement 11.4)
 */
function AppRoutes() {
  const location = useLocation();
  const element = useRoutes(routes);
  const { user } = useAuth();

  const filteredNavGroups = useMemo(
    () => filterNavGroupsByRoles(navigationGroups, user?.roles ?? []),
    [user?.roles]
  );

  useEffect(() => {
    const path = location.pathname;
    let pageTitle = 'Asset Management System';

    const titleMap: Record<string, string> = {
      '/': 'Dashboard - AMS',
      '/assets': 'All Assets - AMS',
      '/assets/hardware': 'Hardware Assets - AMS',
      '/assets/software': 'Software Assets - AMS',
      '/assets/enterprise': 'Enterprise Assets - AMS',
      '/procurement': 'Procurement - AMS',
      '/stockrooms': 'Stockrooms - AMS',
      '/licenses': 'License Workbench - AMS',
      '/contracts': 'Contracts - AMS',
      '/reports': 'Reports - AMS',
      '/settings': 'Settings - AMS',
      '/login': 'Login - AMS',
      '/service-catalog': 'Service Catalog - AMS',
      '/notifications': 'Notifications - AMS',
      '/ham/transfers': 'Transfers - AMS',
      '/ham/loaners': 'Loaners - AMS',
      '/ham/audit-scans': 'Audit Scans - AMS',
      '/ham/disposal': 'Disposal - AMS',
      '/eam/work-orders': 'Work Orders - AMS',
      '/eam/maintenance-plans': 'Maintenance Plans - AMS',
      '/eam/linear-assets': 'Linear Assets - AMS',
      '/eam/parts-inventory': 'Parts Inventory - AMS',
    };

    const prefixMap: [string, string][] = [
      ['/procurement/purchase-orders', 'Purchase Orders - AMS'],
      ['/procurement/requisitions', 'Requisitions - AMS'],
      ['/procurement/receiving', 'Receiving - AMS'],
      ['/reports/', 'Report - AMS'],
      ['/admin/', 'Administration - AMS'],
      ['/assets/', 'Asset Details - AMS'],
    ];

    if (titleMap[path]) {
      pageTitle = titleMap[path];
    } else {
      const match = prefixMap.find(([prefix]) => path.startsWith(prefix));
      pageTitle = match ? match[1] : 'Asset Management System';
    }

    document.title = pageTitle;
  }, [location.pathname]);

  return (
    <MainLayout navGroups={filteredNavGroups}>
      {element}
    </MainLayout>
  );
}

/**
 * Root application component
 * - BrowserRouter enables browser history navigation (Requirement 11.4)
 * - ThemeProvider enables dark/light mode support (Requirement 11.9)
 * - ToastProvider enables success/error notifications
 * - MainLayout provides responsive sidebar navigation (Requirement 11.2)
 * - Announcer provides global screen reader announcements (Requirement 11.2)
 */
export function App() {
  return (
    <BrowserRouter>
      <ThemeProvider>
        <ToastProvider>
          <Announcer />
          <AppRoutes />
        </ToastProvider>
      </ThemeProvider>
    </BrowserRouter>
  );
}
