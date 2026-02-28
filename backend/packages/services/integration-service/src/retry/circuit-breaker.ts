/**
 * Circuit Breaker Implementation for Integration Services
 *
 * Implements the circuit breaker pattern to prevent cascading failures
 * when external integration services are unavailable.
 *
 * Requirements:
 * - 7.7: Implement retry logic with exponential backoff for failed integration attempts
 */

import { createLogger } from '@ams/utils';
import { v4 as uuidv4 } from 'uuid';

import type {
  CircuitBreakerEvent,
  CircuitBreakerState,
  CircuitBreakerStatus,
  IntegrationCircuitBreakerConfig,
  IntegrationType,
} from './retry-types';
import { DEFAULT_CIRCUIT_BREAKER_CONFIG } from './retry-types';

const logger = createLogger({ service: 'circuit-breaker' });

/**
 * Circuit breaker for a specific integration type
 */
export class IntegrationCircuitBreaker {
  private state: CircuitBreakerState = 'CLOSED';
  private failureCount = 0;
  private successCount = 0;
  private halfOpenAttempts = 0;
  private lastFailureTime?: number;
  private lastSuccessTime?: number;
  private totalRequests = 0;
  private totalFailures = 0;
  private totalSuccesses = 0;
  private readonly config: IntegrationCircuitBreakerConfig;
  private readonly integrationType: IntegrationType;
  private readonly eventListeners: ((event: CircuitBreakerEvent) => void)[] = [];

  constructor(
    integrationType: IntegrationType,
    config: Partial<IntegrationCircuitBreakerConfig> = {}
  ) {
    this.integrationType = integrationType;
    this.config = { ...DEFAULT_CIRCUIT_BREAKER_CONFIG, ...config };
  }

  /**
   * Get the current state of the circuit breaker
   * Automatically transitions from OPEN to HALF_OPEN after timeout
   */
  getState(): CircuitBreakerState {
    if (this.state === 'OPEN' && this.lastFailureTime) {
      const now = Date.now();
      if (now - this.lastFailureTime >= this.config.timeoutMs) {
        this.transitionTo('HALF_OPEN', 'Timeout elapsed, testing recovery');
        this.halfOpenAttempts = 0;
      }
    }
    return this.state;
  }

  /**
   * Get the current status of the circuit breaker
   */
  getStatus(): CircuitBreakerStatus {
    return {
      integrationType: this.integrationType,
      state: this.getState(),
      failureCount: this.failureCount,
      successCount: this.successCount,
      lastFailureTime: this.lastFailureTime
        ? new Date(this.lastFailureTime).toISOString()
        : undefined,
      lastSuccessTime: this.lastSuccessTime
        ? new Date(this.lastSuccessTime).toISOString()
        : undefined,
      nextRetryTime:
        this.state === 'OPEN' && this.lastFailureTime
          ? new Date(this.lastFailureTime + this.config.timeoutMs).toISOString()
          : undefined,
      totalRequests: this.totalRequests,
      totalFailures: this.totalFailures,
      totalSuccesses: this.totalSuccesses,
    };
  }

  /**
   * Check if a request is allowed through the circuit breaker
   */
  isRequestAllowed(): boolean {
    const currentState = this.getState();

    if (currentState === 'CLOSED') {
      return true;
    }

    if (currentState === 'OPEN') {
      return false;
    }

    // HALF_OPEN state - allow limited requests
    return this.halfOpenAttempts < this.config.halfOpenMaxRequests;
  }

  /**
   * Execute a function through the circuit breaker
   */
  async execute<T>(fn: () => Promise<T>): Promise<T> {
    const currentState = this.getState();
    this.totalRequests++;

    if (currentState === 'OPEN') {
      const error = new Error(
        `Circuit breaker is OPEN for ${this.integrationType}. ` +
        `Next retry allowed at ${new Date(this.lastFailureTime! + this.config.timeoutMs).toISOString()}`
      );
      (error as Error & { code: string }).code = 'CIRCUIT_BREAKER_OPEN';
      throw error;
    }

    if (currentState === 'HALF_OPEN') {
      if (this.halfOpenAttempts >= this.config.halfOpenMaxRequests) {
        const error = new Error(
          `Circuit breaker is HALF_OPEN for ${this.integrationType}, max test requests reached`
        );
        (error as Error & { code: string }).code = 'CIRCUIT_BREAKER_HALF_OPEN';
        throw error;
      }
      this.halfOpenAttempts++;
    }

    try {
      const result = await fn();
      this.recordSuccess();
      return result;
    } catch (error) {
      this.recordFailure();
      throw error;
    }
  }

  /**
   * Record a successful execution
   */
  recordSuccess(): void {
    this.totalRequests++;
    this.lastSuccessTime = Date.now();
    this.totalSuccesses++;
    this.failureCount = 0;

    if (this.state === 'HALF_OPEN') {
      this.successCount++;
      if (this.successCount >= this.config.successThreshold) {
        this.transitionTo('CLOSED', 'Success threshold reached');
        this.successCount = 0;
      }
    }
  }

  /**
   * Record a failed execution
   */
  recordFailure(): void {
    this.totalRequests++;
    this.failureCount++;
    this.lastFailureTime = Date.now();
    this.totalFailures++;

    if (this.state === 'HALF_OPEN') {
      this.transitionTo('OPEN', 'Failure during half-open state');
      this.successCount = 0;
    } else if (this.failureCount >= this.config.failureThreshold) {
      this.transitionTo('OPEN', `Failure threshold (${this.config.failureThreshold}) reached`);
    }
  }

  /**
   * Manually force the circuit breaker to a specific state
   */
  forceState(state: CircuitBreakerState, reason: string): void {
    this.transitionTo(state, `Manually forced: ${reason}`);
    if (state === 'CLOSED') {
      this.failureCount = 0;
      this.successCount = 0;
    }
  }

  /**
   * Reset the circuit breaker to initial state
   */
  reset(): void {
    this.transitionTo('CLOSED', 'Manual reset');
    this.failureCount = 0;
    this.successCount = 0;
    this.halfOpenAttempts = 0;
    this.lastFailureTime = undefined;
    this.lastSuccessTime = undefined;
  }

  /**
   * Add an event listener for state changes
   */
  onStateChange(listener: (event: CircuitBreakerEvent) => void): void {
    this.eventListeners.push(listener);
  }

  /**
   * Remove an event listener
   */
  removeStateChangeListener(listener: (event: CircuitBreakerEvent) => void): void {
    const index = this.eventListeners.indexOf(listener);
    if (index > -1) {
      this.eventListeners.splice(index, 1);
    }
  }

  /**
   * Transition to a new state and emit event
   */
  private transitionTo(newState: CircuitBreakerState, reason: string): void {
    const previousState = this.state;
    if (previousState === newState) {
      return;
    }

    this.state = newState;

    const event: CircuitBreakerEvent = {
      eventId: uuidv4(),
      integrationType: this.integrationType,
      previousState,
      newState,
      reason,
      failureCount: this.failureCount,
      timestamp: new Date().toISOString(),
    };

    logger.info('Circuit breaker state changed', {
      integrationType: this.integrationType,
      previousState,
      newState,
      reason,
      failureCount: this.failureCount,
    });

    // Notify listeners
    for (const listener of this.eventListeners) {
      try {
        listener(event);
      } catch (error) {
        logger.error('Error in circuit breaker event listener', error as Error);
      }
    }
  }
}

/**
 * Registry of circuit breakers for different integration types
 */
export class CircuitBreakerRegistry {
  private readonly breakers = new Map<IntegrationType, IntegrationCircuitBreaker>();
  private readonly defaultConfig: Partial<IntegrationCircuitBreakerConfig>;

  constructor(defaultConfig: Partial<IntegrationCircuitBreakerConfig> = {}) {
    this.defaultConfig = defaultConfig;
  }

  /**
   * Get or create a circuit breaker for an integration type
   */
  getBreaker(
    integrationType: IntegrationType,
    config?: Partial<IntegrationCircuitBreakerConfig>
  ): IntegrationCircuitBreaker {
    let breaker = this.breakers.get(integrationType);
    if (!breaker) {
      breaker = new IntegrationCircuitBreaker(integrationType, {
        ...this.defaultConfig,
        ...config,
      });
      this.breakers.set(integrationType, breaker);
    }
    return breaker;
  }

  /**
   * Get status of all circuit breakers
   */
  getAllStatus(): CircuitBreakerStatus[] {
    return Array.from(this.breakers.values()).map((breaker) => breaker.getStatus());
  }

  /**
   * Reset all circuit breakers
   */
  resetAll(): void {
    for (const breaker of this.breakers.values()) {
      breaker.reset();
    }
  }

  /**
   * Get circuit breakers in OPEN state
   */
  getOpenBreakers(): CircuitBreakerStatus[] {
    return this.getAllStatus().filter((status) => status.state === 'OPEN');
  }

  /**
   * Check if any circuit breaker is open
   */
  hasOpenBreakers(): boolean {
    return this.getOpenBreakers().length > 0;
  }
}

// Global circuit breaker registry instance
export const circuitBreakerRegistry = new CircuitBreakerRegistry();
