/**
 * API Client Service
 *
 * Provides a centralized HTTP client for communicating with the backend API.
 * Handles authentication, error handling, and request/response processing.
 *
 * Validates: Requirements 6.1, 6.2, 9.5
 */

/**
 * API configuration based on environment
 */
interface ApiConfig {
  baseUrl: string;
  timeout: number;
  retryAttempts: number;
  retryDelay: number;
}

/**
 * API response wrapper
 */
interface ApiResponse<T> {
  success: boolean;
  data?: T;
  error?: {
    code: string;
    message: string;
  };
  requestId?: string;
}

/**
 * Request options
 */
interface RequestOptions {
  headers?: Record<string, string>;
  timeout?: number;
  skipAuth?: boolean;
}

/**
 * Get API configuration based on environment
 */
function getApiConfig(): ApiConfig {
  const baseUrl = import.meta.env.VITE_API_URL || 'http://localhost:3001/v1';

  return {
    baseUrl: baseUrl.endsWith('/') ? baseUrl.slice(0, -1) : baseUrl,
    timeout: 30000, // 30 seconds
    retryAttempts: 3,
    retryDelay: 1000, // 1 second
  };
}

/**
 * Token storage keys
 * Note: API Gateway COGNITO_USER_POOLS authorizer validates ID tokens,
 * so we use the ID token for API requests.
 */
const TOKEN_STORAGE_KEY = 'ams_id_token';
const ACCESS_TOKEN_KEY = 'ams_access_token';
const REFRESH_TOKEN_KEY = 'ams_refresh_token';

/**
 * Get stored access token
 */
export function getAccessToken(): string | null {
  return localStorage.getItem(TOKEN_STORAGE_KEY);
}

/**
 * Set access token
 */
export function setAccessToken(token: string): void {
  localStorage.setItem(TOKEN_STORAGE_KEY, token);
}

/**
 * Get stored refresh token
 */
export function getRefreshToken(): string | null {
  return localStorage.getItem(REFRESH_TOKEN_KEY);
}

/**
 * Set refresh token
 */
export function setRefreshToken(token: string): void {
  localStorage.setItem(REFRESH_TOKEN_KEY, token);
}

/**
 * Clear all tokens (logout)
 */
export function clearTokens(): void {
  localStorage.removeItem(TOKEN_STORAGE_KEY);
  localStorage.removeItem(ACCESS_TOKEN_KEY);
  localStorage.removeItem(REFRESH_TOKEN_KEY);
}

/**
 * Check if user is authenticated
 */
export function isAuthenticated(): boolean {
  return getAccessToken() !== null;
}

/**
 * API error class
 */
export class ApiError extends Error {
  constructor(
    public readonly code: string,
    message: string,
    public readonly statusCode: number,
    public readonly requestId?: string
  ) {
    super(message);
    this.name = 'ApiError';
  }
}

/**
 * Sleep utility for retry delays
 */
function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Check if error is retryable
 */
function isRetryableError(statusCode: number): boolean {
  // Retry on server errors and rate limiting
  return statusCode >= 500 || statusCode === 429;
}

function isLikelyDnsResolutionError(error: Error): boolean {
  const message = error.message.toLowerCase();
  return (
    message.includes('name_not_resolved') ||
    message.includes('err_name_not_resolved') ||
    message.includes('dns') ||
    message.includes('failed to fetch')
  );
}

/**
 * Make an HTTP request with retry logic
 */
async function request<T>(
  method: string,
  path: string,
  body?: unknown,
  options: RequestOptions = {}
): Promise<ApiResponse<T>> {
  const config = getApiConfig();
  const url = `${config.baseUrl}${path}`;

  // Build headers
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...options.headers,
  };

  // Add authorization header if authenticated and not skipped
  if (!options.skipAuth) {
    const token = getAccessToken();
    if (token) {
      headers['Authorization'] = `Bearer ${token}`;
    }
  }

  // Request configuration
  const fetchOptions: RequestInit = {
    method,
    headers,
    body: body ? JSON.stringify(body) : undefined,
  };

  // Retry logic with exponential backoff
  let lastError: Error | null = null;
  for (let attempt = 0; attempt < config.retryAttempts; attempt++) {
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(
        () => controller.abort(),
        options.timeout || config.timeout
      );

      const response = await fetch(url, {
        ...fetchOptions,
        signal: controller.signal,
      });

      clearTimeout(timeoutId);

      // Parse response
      const responseData = await response.json().catch(() => ({}));

      // Handle 401 Unauthorized - redirect to login
      if (response.status === 401) {
        clearTokens();
        // Dispatch event for auth state change
        window.dispatchEvent(new CustomEvent('auth:unauthorized'));
        throw new ApiError(
          'UNAUTHORIZED',
          'Session expired. Please log in again.',
          401,
          responseData.requestId
        );
      }

      // Handle error responses
      if (!response.ok) {
        const error = new ApiError(
          responseData.error?.code || 'UNKNOWN_ERROR',
          responseData.error?.message || 'An unexpected error occurred',
          response.status,
          responseData.requestId
        );

        // Retry on retryable errors
        if (isRetryableError(response.status) && attempt < config.retryAttempts - 1) {
          lastError = error;
          await sleep(config.retryDelay * Math.pow(2, attempt));
          continue;
        }

        throw error;
      }

      // Return successful response
      return {
        success: true,
        data: responseData.data ?? responseData,
        requestId: responseData.requestId,
      };
    } catch (error) {
      if (error instanceof ApiError) {
        throw error;
      }

      // Handle network errors
      if (error instanceof Error) {
        if (error.name === 'AbortError') {
          throw new ApiError('TIMEOUT', 'Request timed out', 408);
        }

        lastError = error;

        // Do not retry DNS/name-resolution failures; they are not transient.
        if (isLikelyDnsResolutionError(error)) {
          throw new ApiError('NETWORK_ERROR', 'Unable to resolve API host', 0);
        }

        // Retry on other network errors
        if (attempt < config.retryAttempts - 1) {
          await sleep(config.retryDelay * Math.pow(2, attempt));
          continue;
        }
      }

      throw new ApiError(
        'NETWORK_ERROR',
        lastError?.message || 'Network error occurred',
        0
      );
    }
  }

  throw new ApiError(
    'MAX_RETRIES',
    'Maximum retry attempts exceeded',
    0
  );
}

/**
 * HTTP GET request
 */
export async function get<T>(
  path: string,
  options?: RequestOptions
): Promise<ApiResponse<T>> {
  return request<T>('GET', path, undefined, options);
}

/**
 * HTTP POST request
 */
export async function post<T>(
  path: string,
  body?: unknown,
  options?: RequestOptions
): Promise<ApiResponse<T>> {
  return request<T>('POST', path, body, options);
}

/**
 * HTTP PUT request
 */
export async function put<T>(
  path: string,
  body?: unknown,
  options?: RequestOptions
): Promise<ApiResponse<T>> {
  return request<T>('PUT', path, body, options);
}

/**
 * HTTP PATCH request
 */
export async function patch<T>(
  path: string,
  body?: unknown,
  options?: RequestOptions
): Promise<ApiResponse<T>> {
  return request<T>('PATCH', path, body, options);
}

/**
 * HTTP DELETE request
 */
export async function del<T>(
  path: string,
  options?: RequestOptions
): Promise<ApiResponse<T>> {
  return request<T>('DELETE', path, undefined, options);
}

/**
 * API client object for convenience
 */
export const apiClient = {
  get,
  post,
  put,
  patch,
  delete: del,
  getAccessToken,
  setAccessToken,
  getRefreshToken,
  setRefreshToken,
  clearTokens,
  isAuthenticated,
};

export default apiClient;
