"use strict";
/**
 * Retry utilities with exponential backoff
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.CircuitBreaker = exports.DEFAULT_CIRCUIT_BREAKER_CONFIG = exports.DEFAULT_RETRY_CONFIG = void 0;
exports.calculateBackoffDelay = calculateBackoffDelay;
exports.sleep = sleep;
exports.isRetryableError = isRetryableError;
exports.withRetry = withRetry;
exports.tryWithRetry = tryWithRetry;
const logger_1 = require("./logger");
/**
 * Default retry configuration
 */
exports.DEFAULT_RETRY_CONFIG = {
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
function calculateBackoffDelay(attempt, baseDelayMs, maxDelayMs) {
    const exponentialDelay = baseDelayMs * Math.pow(2, attempt);
    const jitter = Math.random() * 0.3 * exponentialDelay;
    return Math.min(exponentialDelay + jitter, maxDelayMs);
}
/**
 * Sleep for a specified duration
 */
function sleep(ms) {
    return new Promise((resolve) => setTimeout(resolve, ms));
}
/**
 * Check if an error is retryable
 */
function isRetryableError(error, config) {
    // Custom retry check function takes precedence
    if (config.shouldRetry) {
        return config.shouldRetry(error);
    }
    // Check against retryable error codes
    if (config.retryableErrors) {
        const errorCode = error.code;
        if (errorCode && config.retryableErrors.includes(errorCode)) {
            return true;
        }
        // Check error message for retryable patterns
        return config.retryableErrors.some((code) => error.message.includes(code));
    }
    return false;
}
/**
 * Execute a function with retry logic
 */
async function withRetry(fn, config = {}) {
    const fullConfig = { ...exports.DEFAULT_RETRY_CONFIG, ...config };
    let lastError;
    for (let attempt = 0; attempt <= fullConfig.maxRetries; attempt++) {
        try {
            return await fn();
        }
        catch (error) {
            lastError = error;
            if (attempt === fullConfig.maxRetries) {
                logger_1.logger.error(`All ${fullConfig.maxRetries + 1} attempts failed`, lastError, { attempt });
                throw lastError;
            }
            if (!isRetryableError(lastError, fullConfig)) {
                logger_1.logger.error('Non-retryable error encountered', lastError, { attempt });
                throw lastError;
            }
            const delay = calculateBackoffDelay(attempt, fullConfig.baseDelayMs, fullConfig.maxDelayMs);
            logger_1.logger.warn(`Attempt ${attempt + 1} failed, retrying in ${delay}ms`, {
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
async function tryWithRetry(fn, config = {}) {
    const fullConfig = { ...exports.DEFAULT_RETRY_CONFIG, ...config };
    let attempts = 0;
    for (let attempt = 0; attempt <= fullConfig.maxRetries; attempt++) {
        attempts = attempt + 1;
        try {
            const result = await fn();
            return { success: true, result, attempts };
        }
        catch (error) {
            const err = error;
            if (attempt === fullConfig.maxRetries || !isRetryableError(err, fullConfig)) {
                return { success: false, error: err, attempts };
            }
            const delay = calculateBackoffDelay(attempt, fullConfig.baseDelayMs, fullConfig.maxDelayMs);
            await sleep(delay);
        }
    }
    return { success: false, error: new Error('Retry failed'), attempts };
}
/**
 * Default circuit breaker configuration
 */
exports.DEFAULT_CIRCUIT_BREAKER_CONFIG = {
    failureThreshold: 5,
    successThreshold: 3,
    timeout: 30000,
    halfOpenRequests: 1,
};
/**
 * Circuit breaker for protecting against cascading failures
 */
class CircuitBreaker {
    state = 'CLOSED';
    failures = 0;
    successes = 0;
    lastFailureTime = 0;
    halfOpenAttempts = 0;
    config;
    constructor(config = {}) {
        this.config = { ...exports.DEFAULT_CIRCUIT_BREAKER_CONFIG, ...config };
    }
    /**
     * Get current circuit state
     */
    getState() {
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
    async execute(fn) {
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
        }
        catch (error) {
            this.onFailure();
            throw error;
        }
    }
    /**
     * Record a successful execution
     */
    onSuccess() {
        this.failures = 0;
        if (this.state === 'HALF_OPEN') {
            this.successes++;
            if (this.successes >= this.config.successThreshold) {
                this.state = 'CLOSED';
                this.successes = 0;
                logger_1.logger.info('Circuit breaker closed');
            }
        }
    }
    /**
     * Record a failed execution
     */
    onFailure() {
        this.failures++;
        this.lastFailureTime = Date.now();
        if (this.state === 'HALF_OPEN') {
            this.state = 'OPEN';
            this.successes = 0;
            logger_1.logger.warn('Circuit breaker opened from half-open state');
        }
        else if (this.failures >= this.config.failureThreshold) {
            this.state = 'OPEN';
            logger_1.logger.warn('Circuit breaker opened', { failures: this.failures });
        }
    }
    /**
     * Reset the circuit breaker
     */
    reset() {
        this.state = 'CLOSED';
        this.failures = 0;
        this.successes = 0;
        this.halfOpenAttempts = 0;
    }
}
exports.CircuitBreaker = CircuitBreaker;
//# sourceMappingURL=retry.js.map