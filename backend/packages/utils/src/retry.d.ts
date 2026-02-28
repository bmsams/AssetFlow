/**
 * Retry utilities with exponential backoff
 */
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
export declare const DEFAULT_RETRY_CONFIG: RetryConfig;
/**
 * Calculate delay with exponential backoff and jitter
 */
export declare function calculateBackoffDelay(attempt: number, baseDelayMs: number, maxDelayMs: number): number;
/**
 * Sleep for a specified duration
 */
export declare function sleep(ms: number): Promise<void>;
/**
 * Check if an error is retryable
 */
export declare function isRetryableError(error: Error, config: RetryConfig): boolean;
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
export declare function withRetry<T>(fn: () => Promise<T>, config?: Partial<RetryConfig>): Promise<T>;
/**
 * Execute a function with retry logic, returning a result object
 */
export declare function tryWithRetry<T>(fn: () => Promise<T>, config?: Partial<RetryConfig>): Promise<RetryResult<T>>;
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
export declare const DEFAULT_CIRCUIT_BREAKER_CONFIG: CircuitBreakerConfig;
/**
 * Circuit breaker for protecting against cascading failures
 */
export declare class CircuitBreaker {
    private state;
    private failures;
    private successes;
    private lastFailureTime;
    private halfOpenAttempts;
    private readonly config;
    constructor(config?: Partial<CircuitBreakerConfig>);
    /**
     * Get current circuit state
     */
    getState(): CircuitState;
    /**
     * Execute a function through the circuit breaker
     */
    execute<T>(fn: () => Promise<T>): Promise<T>;
    /**
     * Record a successful execution
     */
    private onSuccess;
    /**
     * Record a failed execution
     */
    private onFailure;
    /**
     * Reset the circuit breaker
     */
    reset(): void;
}
