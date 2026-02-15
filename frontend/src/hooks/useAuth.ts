/**
 * Authentication hook for the Asset Management System
 * Provides user authentication state and role-based access control
 */

import { useState, useEffect, useCallback } from 'react';
import * as authService from '../services/auth-service';
import { extractRolesFromToken } from '../utils/role-mapping';

/**
 * User roles in the system
 * Aligned with backend @ams/types SYSTEM_ROLES
 */
export type UserRole = 
  | 'admin'
  | 'asset_manager'
  | 'inventory_manager'
  | 'procurement_manager'
  | 'license_analyst'
  | 'facilities_manager'
  | 'auditor'
  | 'viewer';

/**
 * Authenticated user information
 */
export interface AuthUser {
  id: string;
  email: string;
  name: string;
  roles: UserRole[];
}

/**
 * Authentication state
 */
export interface AuthState {
  user: AuthUser | null;
  isAuthenticated: boolean;
  isLoading: boolean;
}

/**
 * Authentication hook return type
 */
export interface UseAuthReturn extends AuthState {
  login: (email: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
  hasRole: (role: UserRole) => boolean;
  hasAnyRole: (roles: UserRole[]) => boolean;
}

/**
 * Hook for managing authentication state
 * 
 * In a real implementation, this would integrate with Cognito or another auth provider.
 * For now, it provides a mock implementation for development.
 */
export function useAuth(): UseAuthReturn {
  const [state, setState] = useState<AuthState>({
    user: null,
    isAuthenticated: false,
    isLoading: true,
  });

  const checkAuth = useCallback(() => {
    try {
      const userInfo = authService.getCurrentUser();
      const sessionValid = authService.isSessionValid();
      if (userInfo && sessionValid) {
        const idToken = authService.getIdToken();
        const user: AuthUser = {
          id: userInfo.sub,
          email: userInfo.email,
          name: userInfo.name || userInfo.email,
          roles: extractRolesFromToken(idToken),
        };
        setState({
          user,
          isAuthenticated: true,
          isLoading: false,
        });
        return;
      }
    } catch (error) {
      console.error('Auth check failed:', error);
    }

    setState({
      user: null,
      isAuthenticated: false,
      isLoading: false,
    });
  }, []);

  useEffect(() => {
    checkAuth();
    const onAuthChanged = () => checkAuth();
    window.addEventListener('auth:login', onAuthChanged);
    window.addEventListener('auth:logout', onAuthChanged);
    window.addEventListener('auth:unauthorized', onAuthChanged);
    return () => {
      window.removeEventListener('auth:login', onAuthChanged);
      window.removeEventListener('auth:logout', onAuthChanged);
      window.removeEventListener('auth:unauthorized', onAuthChanged);
    };
  }, [checkAuth]);

  const login = useCallback(async (email: string, password: string) => {
    setState(prev => ({ ...prev, isLoading: true }));
    
    try {
      const userInfo = await authService.login({ email, password });
      const idToken = authService.getIdToken();
      const user: AuthUser = {
        id: userInfo.sub,
        email: userInfo.email,
        name: userInfo.name || userInfo.email,
        roles: extractRolesFromToken(idToken),
      };
      setState({
        user,
        isAuthenticated: true,
        isLoading: false,
      });
    } catch (error) {
      setState({
        user: null,
        isAuthenticated: false,
        isLoading: false,
      });
      throw error;
    }
  }, []);

  const logout = useCallback(async () => {
    await authService.logout();
    setState({
      user: null,
      isAuthenticated: false,
      isLoading: false,
    });
  }, []);

  const hasRole = useCallback((role: UserRole): boolean => {
    return state.user?.roles?.includes(role) ?? false;
  }, [state.user]);

  const hasAnyRole = useCallback((roles: UserRole[]): boolean => {
    return roles.some(role => state.user?.roles?.includes(role));
  }, [state.user]);

  return {
    ...state,
    login,
    logout,
    hasRole,
    hasAnyRole,
  };
}

export default useAuth;
