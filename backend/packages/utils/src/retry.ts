/**
 * Retry utilities with exponential backoff
 */

import { logger } from './logger';

/**
 * Retry configuration
 */
export interface RetryConfig {
  readonly maxRetries: number;
  readonly baseDelayMs: number;
  readonly maxDelayMs: number;
  readonly retryableErrors?: readonly string[];
  readonly shouldRetry?: (error: Error) => boolean;
}

/**
 * Default retry configuration
 */
export const DEFAULT_RETRY_CONFIG: RetryConfig = {
  maxRetries: 3,
  baseDelayMs: 1000,
  maxDelayMs: 30000,
  retryableErrors: [
    'ECONNRESET',
    'ETIMEDOUT',
    'ECONNREFUSED',
    'SERVICE_UNAVAILABLE',
    'RATE_LIMITED',
    'CONNECTION_TIMEOUT',
  ],
};

/**
 * Calculate delay with exponential backoff and jitter
 */
export function calculateBackoffDelay(
  attempt: number,
  baseDelayMs: number,
  maxDelayMs: number
): number {
  const exponentialDelay = baseDelayMs * Math.pow(2, attempt);
  const jitter = Math.random() * 0.3 * exponentialDelay;
  return Math.min(exponentialDelay + jitter, maxDelayMs);
}

/**
 * Sleep for a specified duration
 */
export function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Check if an error is retryable
 */
export function isRetryableError(error: Error, config: RetryConfig): boolean {
  // Custom retry check function takes precedence
  if (config.shouldRetry) {
    return config.shouldRetry(error);
  }

  // Check against retryable error codes
  if (config.retryableErrors) {
    const errorCode = (error as Error & { code?: string }).code;
    if (errorCode && config.retryableErrors.includes(errorCode)) {
      return true;
    }

    // Check error message for retryable patterns
    return config.retryableErrors.some(
      (code) => error.message.includes(code)
    );
  }

  return false;
}

/**
 * Retry result
 */
export interface RetryResult<T> {
  readonly success: boolean;
  readonly result?: T;
  readonly error?: Error;
  readonly attempts: number;
}

/**
 * Execute a function with retry logic
 */
export async function withRetry<T>(
  fn: () => Promise<T>,
  config: Partial<RetryConfig> = {}
): Promise<T> {
  const fullConfig: RetryConfig = { ...DEFAULT_RETRY_CONFIG, ...config };
  let lastError: Error | undefined;

  for (let attempt = 0; attempt <= fullConfig.maxRetries; attempt++) {
    try {
      return await fn();
    } catch (error) {
      lastError = error as Error;

      if (attempt === fullConfig.maxRetries) {
        logger.error(
          `All ${fullConfig.maxRetries + 1} attempts failed`,
          lastError,
          { attempt }
        );
        throw lastError;
      }

      if (!isRetryableError(lastError, fullConfig)) {
        logger.error('Non-retryable error encountered', lastError, { attempt });
        throw lastError;
      }

      const delay = calculateBackoffDelay(
        attempt,
        fullConfig.baseDelayMs,
        fullConfig.maxDelayMs
      );

      logger.warn(`Attempt ${attempt + 1} failed, retrying in ${delay}ms`, {
        error: lastError.message,
        attempt,
        delay,
      });

      await sleep(delay);
    }
  }

  // This should never be reached, but TypeScript needs it
  throw lastError ?? new Error('Retry failed');
}

/**
 * Execute a function with retry logic, returning a result object
 */
export async function tryWithRetry<T>(
  fn: () => Promise<T>,
  config: Partial<RetryConfig> = {}
): Promise<RetryResult<T>> {
  const fullConfig: RetryConfig = { ...DEFAULT_RETRY_CONFIG, ...config };
  let attempts = 0;

  for (let attempt = 0; attempt <= fullConfig.maxRetries; attempt++) {
    attempts = attempt + 1;
    try {
      const result = await fn();
      return { success: true, result, attempts };
    } catch (error) {
      const err = error as Error;

      if (attempt === fullConfig.maxRetries || !isRetryableError(err, fullConfig)) {
        return { success: false, error: err, attempts };
      }

      const delay = calculateBackoffDelay(
        attempt,
        fullConfig.baseDelayMs,
        fullConfig.maxDelayMs
      );

      await sleep(delay);
    }
  }

  return { success: false, error: new Error('Retry failed'), attempts };
}

/**
 * Circuit breaker state
 */
export type CircuitState = 'CLOSED' | 'OPEN' | 'HALF_OPEN';

/**
 * Circuit breaker configuration
 */
export interface CircuitBreakerConfig {
  readonly failureThreshold: number;
  readonly successThreshold: number;
  readonly timeout: number;
  readonly halfOpenRequests: number;
}

/**
 * Default circuit breaker configuration
 */
export const DEFAULT_CIRCUIT_BREAKER_CONFIG: CircuitBreakerConfig = {
  failureThreshold: 5,
  successThreshold: 3,
  timeout: 30000,
  halfOpenRequests: 1,
};

/**
 * Circuit breaker for protecting against cascading failures
 */
export class CircuitBreaker {
  private state: CircuitState = 'CLOSED';
  private failures = 0;
  private successes = 0;
  private lastFailureTime = 0;
  private halfOpenAttempts = 0;
  private readonly config: CircuitBreakerConfig;

  constructor(config: Partial<CircuitBreakerConfig> = {}) {
    this.config = { ...DEFAULT_CIRCUIT_BREAKER_CONFIG, ...config };
  }

  /**
   * Get current circuit state
   */
  getState(): CircuitState {
    if (this.state === 'OPEN') {
      const now = Date.now();
      if (now - this.lastFailureTime >= this.config.timeout) {
        this.state = 'HALF_OPEN';
        this.halfOpenAttempts = 0;
      }
    }
    return this.state;
  }

  /**
   * Execute a function through the circuit breaker
   */
  async execute<T>(fn: () => Promise<T>): Promise<T> {
    const currentState = this.getState();

    if (currentState === 'OPEN') {
      throw new Error('Circuit breaker is OPEN');
    }

    if (currentState === 'HALF_OPEN') {
      if (this.halfOpenAttempts >= this.config.halfOpenRequests) {
        throw new Error('Circuit breaker is HALF_OPEN, max attempts reached');
      }
      this.halfOpenAttempts++;
    }

    try {
      const result = await fn();
      this.onSuccess();
      return result;
    } catch (error) {
      this.onFailure();
      throw error;
    }
  }

  /**
   * Record a successful execution
   */
  private onSuccess(): void {
    this.failures = 0;

    if (this.state === 'HALF_OPEN') {
      this.successes++;
      if (this.successes >= this.config.successThreshold) {
        this.state = 'CLOSED';
        this.successes = 0;
        logger.info('Circuit breaker closed');
      }
    }
  }

  /**
   * Record a failed execution
   */
  private onFailure(): void {
    this.failures++;
    this.lastFailureTime = Date.now();

    if (this.state === 'HALF_OPEN') {
      this.state = 'OPEN';
      this.successes = 0;
      logger.warn('Circuit breaker opened from half-open state');
    } else if (this.failures >= this.config.failureThreshold) {
      this.state = 'OPEN';
      logger.warn('Circuit breaker opened', { failures: this.failures });
    }
  }

  /**
   * Reset the circuit breaker
   */
  reset(): void {
    this.state = 'CLOSED';
    this.failures = 0;
    this.successes = 0;
    this.halfOpenAttempts = 0;
  }
}
