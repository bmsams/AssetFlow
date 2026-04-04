/**
 * Authentication Service
 *
 * Provides Cognito authentication functionality for the frontend.
 * Handles login, logout, token management, and session handling.
 *
 * Validates: Requirements 7.1, 7.2, 7.3, 7.5, 7.6, 7.7
 */

import {
  setAccessToken,
  setRefreshToken,
  getAccessToken,
  getRefreshToken,
  clearTokens,
  isAuthenticated,
} from './api-client';

/**
 * Cognito configuration
 */
interface CognitoConfig {
  userPoolId: string;
  clientId: string;
  region: string;
  domain: string;
}

interface CognitoAuthResult {
  AccessToken?: string;
  IdToken?: string;
  RefreshToken?: string;
}

interface CognitoAuthResponse {
  message?: string;
  __type?: string;
  ChallengeName?: string;
  AuthenticationResult?: CognitoAuthResult;
}

/**
 * User information
 */
export interface UserInfo {
  sub: string;
  email: string;
  emailVerified: boolean;
  name?: string | undefined;
  givenName?: string | undefined;
  familyName?: string | undefined;
}

/**
 * Login credentials
 */
export interface LoginCredentials {
  email: string;
  password: string;
}

function asRecord(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    return {};
  }
  return value as Record<string, unknown>;
}

function asString(value: unknown): string | undefined {
  return typeof value === 'string' ? value : undefined;
}

function asBoolean(value: unknown): boolean | undefined {
  return typeof value === 'boolean' ? value : undefined;
}

function getEnvString(key: string): string | undefined {
  const env = import.meta.env as Record<string, unknown>;
  const value = env[key];
  return typeof value === 'string' ? value : undefined;
}

function parseCognitoAuthResult(value: unknown): CognitoAuthResult | undefined {
  const payload = asRecord(value);
  const accessToken = asString(payload['AccessToken']);
  const idToken = asString(payload['IdToken']);
  const refreshToken = asString(payload['RefreshToken']);

  if (!accessToken && !idToken && !refreshToken) {
    return undefined;
  }

  return {
    AccessToken: accessToken,
    IdToken: idToken,
    RefreshToken: refreshToken,
  };
}

function parseCognitoResponse(value: unknown): CognitoAuthResponse {
  const payload = asRecord(value);
  return {
    message: asString(payload['message']),
    __type: asString(payload['__type']),
    ChallengeName: asString(payload['ChallengeName']),
    AuthenticationResult: parseCognitoAuthResult(payload['AuthenticationResult']),
  };
}

/**
 * Get Cognito configuration from environment
 */
function getCognitoConfig(): CognitoConfig {
  return {
    userPoolId: getEnvString('VITE_COGNITO_USER_POOL_ID') ?? '',
    clientId: getEnvString('VITE_COGNITO_CLIENT_ID') ?? '',
    region: getEnvString('VITE_AWS_REGION') ?? 'us-east-1',
    domain: getEnvString('VITE_COGNITO_DOMAIN') ?? '',
  };
}

/**
 * Parse JWT token to extract payload
 */
function parseJwt(token: string): Record<string, unknown> {
  try {
    const base64Url = token.split('.')[1];
    if (!base64Url) return {};
    
    const base64 = base64Url.replace(/-/g, '+').replace(/_/g, '/');
    const jsonPayload = decodeURIComponent(
      atob(base64)
        .split('')
        .map((c) => '%' + ('00' + c.charCodeAt(0).toString(16)).slice(-2))
        .join('')
    );
    const parsed: unknown = JSON.parse(jsonPayload);
    return asRecord(parsed);
  } catch {
    return {};
  }
}

/**
 * Check if token is expired
 */
function isTokenExpired(token: string): boolean {
  const payload = parseJwt(token);
  const exp = payload['exp'];
  
  if (typeof exp !== 'number') return true;
  
  // Add 60 second buffer for clock skew
  return Date.now() >= (exp * 1000) - 60000;
}

/**
 * Get user info from ID token
 */
function getUserInfoFromToken(idToken: string): UserInfo | null {
  const payload = parseJwt(idToken);
  const sub = asString(payload['sub']);
  const email = asString(payload['email']);
  
  if (!sub || !email) {
    return null;
  }
  
  return {
    sub,
    email,
    emailVerified: asBoolean(payload['email_verified']) ?? false,
    name: asString(payload['name']),
    givenName: asString(payload['given_name']),
    familyName: asString(payload['family_name']),
  };
}

/**
 * Storage keys for tokens
 */
const ID_TOKEN_KEY = 'ams_id_token';

/**
 * Store ID token
 */
function setIdToken(token: string): void {
  localStorage.setItem(ID_TOKEN_KEY, token);
}

/**
 * Get ID token
 */
export function getIdToken(): string | null {
  return localStorage.getItem(ID_TOKEN_KEY);
}

/**
 * Clear ID token
 */
function clearIdToken(): void {
  localStorage.removeItem(ID_TOKEN_KEY);
}

/**
 * Login with email and password using Cognito
 * Uses the USER_PASSWORD_AUTH flow
 */
export async function login(credentials: LoginCredentials): Promise<UserInfo> {
  const config = getCognitoConfig();
  
  if (!config.userPoolId || !config.clientId) {
    throw new Error('Cognito configuration is missing');
  }
  
  // Use Cognito InitiateAuth API
  const response = await fetch(
    `https://cognito-idp.${config.region}.amazonaws.com/`,
    {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-amz-json-1.1',
        'X-Amz-Target': 'AWSCognitoIdentityProviderService.InitiateAuth',
      },
      body: JSON.stringify({
        AuthFlow: 'USER_PASSWORD_AUTH',
        ClientId: config.clientId,
        AuthParameters: {
          USERNAME: credentials.email,
          PASSWORD: credentials.password,
        },
      }),
    }
  );
  
  const rawData: unknown = await response.json().catch(() => ({}));
  const data = parseCognitoResponse(rawData);
  
  if (!response.ok) {
    const errorMessage = data.message ?? data.__type ?? 'Authentication failed';
    throw new Error(errorMessage);
  }
  
  const authResult = data.AuthenticationResult;
  
  if (!authResult?.AccessToken || !authResult.IdToken) {
    // Handle challenges (MFA, new password required, etc.)
    if (data.ChallengeName) {
      throw new Error(`Authentication challenge required: ${data.ChallengeName}`);
    }
    throw new Error('Authentication failed: No result returned');
  }
  
  // Store tokens
  setAccessToken(authResult.AccessToken);
  setIdToken(authResult.IdToken);
  if (authResult.RefreshToken) {
    setRefreshToken(authResult.RefreshToken);
  }
  
  // Get user info from ID token
  const userInfo = getUserInfoFromToken(authResult.IdToken);
  
  if (!userInfo) {
    throw new Error('Failed to parse user information');
  }
  
  // Dispatch auth state change event
  window.dispatchEvent(new CustomEvent('auth:login', { detail: userInfo }));
  
  return userInfo;
}

/**
 * Logout and clear all tokens
 */
export async function logout(): Promise<void> {
  const config = getCognitoConfig();
  const accessToken = getAccessToken();
  
  // Try to sign out from Cognito (best effort)
  if (accessToken && config.clientId) {
    try {
      await fetch(
        `https://cognito-idp.${config.region}.amazonaws.com/`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/x-amz-json-1.1',
            'X-Amz-Target': 'AWSCognitoIdentityProviderService.GlobalSignOut',
          },
          body: JSON.stringify({
            AccessToken: accessToken,
          }),
        }
      );
    } catch {
      // Ignore errors during sign out
    }
  }
  
  // Clear all tokens
  clearTokens();
  clearIdToken();
  
  // Dispatch auth state change event
  window.dispatchEvent(new CustomEvent('auth:logout'));
}

/**
 * Refresh the access token using the refresh token
 */
export async function refreshAccessToken(): Promise<string> {
  const config = getCognitoConfig();
  const refreshToken = getRefreshToken();
  
  if (!refreshToken) {
    throw new Error('No refresh token available');
  }
  
  const response = await fetch(
    `https://cognito-idp.${config.region}.amazonaws.com/`,
    {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-amz-json-1.1',
        'X-Amz-Target': 'AWSCognitoIdentityProviderService.InitiateAuth',
      },
      body: JSON.stringify({
        AuthFlow: 'REFRESH_TOKEN_AUTH',
        ClientId: config.clientId,
        AuthParameters: {
          REFRESH_TOKEN: refreshToken,
        },
      }),
    }
  );
  
  const rawData: unknown = await response.json().catch(() => ({}));
  const data = parseCognitoResponse(rawData);
  
  if (!response.ok) {
    // Refresh token expired or invalid - force logout
    await logout();
    throw new Error('Session expired. Please log in again.');
  }
  
  const authResult = data.AuthenticationResult;
  
  if (!authResult?.AccessToken) {
    await logout();
    throw new Error('Failed to refresh token');
  }
  
  // Update tokens
  setAccessToken(authResult.AccessToken);
  const idToken = authResult.IdToken;
  if (idToken) {
    setIdToken(idToken);
  }
  
  return authResult.AccessToken;
}

/**
 * Get current user info
 */
export function getCurrentUser(): UserInfo | null {
  const idToken = getIdToken();
  
  if (!idToken) {
    return null;
  }
  
  if (isTokenExpired(idToken)) {
    return null;
  }
  
  return getUserInfoFromToken(idToken);
}

/**
 * Check if the current session is valid
 */
export function isSessionValid(): boolean {
  const accessToken = getAccessToken();
  
  if (!accessToken) {
    return false;
  }
  
  return !isTokenExpired(accessToken);
}

/**
 * Get valid access token, refreshing if necessary
 */
export async function getValidAccessToken(): Promise<string | null> {
  const accessToken = getAccessToken();
  
  if (!accessToken) {
    return null;
  }
  
  if (!isTokenExpired(accessToken)) {
    return accessToken;
  }
  
  // Try to refresh
  try {
    return await refreshAccessToken();
  } catch {
    return null;
  }
}

/**
 * Auth service object for convenience
 */
export const authService = {
  login,
  logout,
  refreshAccessToken,
  getCurrentUser,
  isSessionValid,
  getValidAccessToken,
  isAuthenticated,
};

export default authService;
