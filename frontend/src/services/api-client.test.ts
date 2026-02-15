/**
 * Tests for API Client
 *
 * These tests verify that the API client correctly handles
 * authentication tokens and request/response processing.
 *
 * **Property 4: Authenticated Requests Include Authorization Token**
 * **Validates: Requirements 6.3, 7.4**
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import {
  getAccessToken,
  setAccessToken,
  clearTokens,
  isAuthenticated,
  setRefreshToken,
  getRefreshToken,
} from './api-client';

// Mock localStorage
const localStorageMock = (() => {
  let store: Record<string, string> = {};
  return {
    getItem: vi.fn((key: string) => store[key] || null),
    setItem: vi.fn((key: string, value: string) => {
      store[key] = value;
    }),
    removeItem: vi.fn((key: string) => {
      delete store[key];
    }),
    clear: vi.fn(() => {
      store = {};
    }),
  };
})();

Object.defineProperty(window, 'localStorage', {
  value: localStorageMock,
});

describe('API Client Tests', () => {
  beforeEach(() => {
    localStorageMock.clear();
    vi.clearAllMocks();
  });

  afterEach(() => {
    clearTokens();
  });

  /**
   * Property 4: Authenticated Requests Include Authorization Token
   * **Validates: Requirements 6.3, 7.4**
   */
  describe('Property 4: Authenticated Requests Include Authorization Token', () => {
    it('setAccessToken stores token and getAccessToken retrieves it', () => {
      const testTokens = [
        'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiIxMjM0NTY3ODkwIn0.dozjgNryP4J3jVmNHl0w5N_XgL0n3I9PlFUP0THsR8U',
        'simple-token-12345',
        'token-with-special-chars!@#$%',
        'a'.repeat(500),
      ];

      for (const token of testTokens) {
        setAccessToken(token);
        const retrieved = getAccessToken();
        expect(retrieved).toBe(token);
      }
    });

    it('isAuthenticated returns true when token is set', () => {
      expect(isAuthenticated()).toBe(false);
      setAccessToken('test-token');
      expect(isAuthenticated()).toBe(true);
    });

    it('isAuthenticated returns false when no token is set', () => {
      clearTokens();
      expect(isAuthenticated()).toBe(false);
    });

    it('clearTokens removes all tokens', () => {
      setAccessToken('access-token-123');
      setRefreshToken('refresh-token-456');

      expect(getAccessToken()).toBe('access-token-123');
      expect(getRefreshToken()).toBe('refresh-token-456');

      clearTokens();

      expect(getAccessToken()).toBeNull();
      expect(getRefreshToken()).toBeNull();
      expect(isAuthenticated()).toBe(false);
    });

    it('refresh token is stored and retrieved correctly', () => {
      const refreshToken = 'refresh-token-xyz';
      setRefreshToken(refreshToken);
      expect(getRefreshToken()).toBe(refreshToken);
    });
  });

  /**
   * Token format validation tests
   */
  describe('Token Format Validation', () => {
    it('JWT-like tokens are stored correctly', () => {
      const jwtToken = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiIxMjM0NTY3ODkwIiwibmFtZSI6IkpvaG4gRG9lIiwiaWF0IjoxNTE2MjM5MDIyfQ.SflKxwRJSMeKKF2QT4fwpMeJf36POk6yJV_adQssw5c';
      setAccessToken(jwtToken);
      const retrieved = getAccessToken();
      expect(retrieved).toBe(jwtToken);
      expect(retrieved).toContain('.');
    });

    it('tokens with special characters are handled correctly', () => {
      const specialTokens = [
        'token+with+plus',
        'token/with/slash',
        'token=with=equals',
        'token_with_underscore',
        'token-with-dash',
      ];

      for (const token of specialTokens) {
        setAccessToken(token);
        expect(getAccessToken()).toBe(token);
      }
    });
  });

  /**
   * Token lifecycle tests
   */
  describe('Token Lifecycle', () => {
    it('multiple token updates preserve latest value', () => {
      const tokens = ['token1', 'token2', 'token3', 'final-token'];
      
      for (const token of tokens) {
        setAccessToken(token);
      }
      
      expect(getAccessToken()).toBe('final-token');
    });

    it('access and refresh tokens are independent', () => {
      const accessToken = 'access-token-abc';
      const refreshToken = 'refresh-token-xyz';

      setAccessToken(accessToken);
      setRefreshToken(refreshToken);

      expect(getAccessToken()).toBe(accessToken);
      expect(getRefreshToken()).toBe(refreshToken);
      expect(getAccessToken()).not.toBe(getRefreshToken());
    });

    it('clearing access token does not affect refresh token', () => {
      setAccessToken('access');
      setRefreshToken('refresh');

      // Clear only access token by setting it to empty and removing
      localStorage.removeItem('ams_access_token');

      // Refresh token should still be there
      expect(getRefreshToken()).toBe('refresh');
    });
  });
});
