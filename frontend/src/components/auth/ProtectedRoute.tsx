import React from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { useAuth, type UserRole } from '../../hooks/useAuth';
import { AccessDeniedPage } from '../../pages/AccessDeniedPage';

interface ProtectedRouteProps {
  /** The component to render if access is granted */
  children: React.ReactNode;
  /** Required roles for accessing this route */
  requiredRoles?: UserRole[];
}

/**
 * A wrapper component that checks if the current user has the required roles
 * to access the protected route. If not, it shows an AccessDeniedPage.
 * 
 * Implements Task 20.1.5: Add role-based route protection
 */
export function ProtectedRoute({
  children,
  requiredRoles = [],
}: ProtectedRouteProps) {
  const { user, isAuthenticated, isLoading } = useAuth();
  const location = useLocation();

  // If auth is still loading, show nothing
  if (isLoading) {
    return null;
  }

  // If user is not authenticated, redirect to login
  if (!isAuthenticated) {
    return <Navigate to="/login" state={{ from: location }} replace />;
  }

  // If no specific roles are required, allow access
  if (requiredRoles.length === 0) {
    return <>{children}</>;
  }

  // Check if user has at least one of the required roles
  const hasRequiredRole = user?.roles?.some(role => requiredRoles.includes(role));

  if (!hasRequiredRole) {
    return <AccessDeniedPage requiredRoles={requiredRoles} />;
  }

  // User is authenticated and has the required role(s)
  return <>{children}</>;
}

export default ProtectedRoute;
