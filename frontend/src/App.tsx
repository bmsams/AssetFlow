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

    if (path === '/') pageTitle = 'Dashboard - AMS';
    else if (path === '/assets') pageTitle = 'All Assets - AMS';
    else if (path === '/assets/hardware') pageTitle = 'Hardware Assets - AMS';
    else if (path === '/assets/software') pageTitle = 'Software Assets - AMS';
    else if (path === '/assets/enterprise') pageTitle = 'Enterprise Assets - AMS';
    else if (path.startsWith('/assets/')) pageTitle = 'Asset Details - AMS';
    else if (path === '/procurement') pageTitle = 'Procurement - AMS';
    else if (path.startsWith('/procurement/purchase-orders')) pageTitle = 'Purchase Orders - AMS';
    else if (path.startsWith('/procurement/receiving')) pageTitle = 'Receiving - AMS';
    else if (path === '/stockrooms') pageTitle = 'Stockrooms - AMS';
    else if (path === '/licenses') pageTitle = 'License Workbench - AMS';
    else if (path === '/contracts') pageTitle = 'Contracts - AMS';
    else if (path === '/reports') pageTitle = 'Reports - AMS';
    else if (path.startsWith('/reports/')) pageTitle = 'Report - AMS';
    else if (path.startsWith('/admin/')) pageTitle = 'Administration - AMS';
    else if (path === '/settings') pageTitle = 'Settings - AMS';
    else if (path === '/login') pageTitle = 'Login - AMS';
    else pageTitle = 'Page Not Found - AMS';

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
