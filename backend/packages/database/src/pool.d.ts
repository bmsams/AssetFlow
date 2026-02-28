/**
 * Database connection pool management for Lambda functions
 *
 * Implements connection pooling optimized for serverless environments
 * with proper connection reuse across Lambda invocations.
 *
 * Key features:
 * - Connection reuse across Lambda invocations (warm starts)
 * - Lambda-optimized pool configuration
 * - Comprehensive metrics monitoring
 * - Graceful connection cleanup
 *
 * Validates: Requirements 10.7
 */
import type { Pool, PoolClient, QueryResult, QueryResultRow } from 'pg';
import type { DatabaseConfig } from './connection';
/**
 * Lambda-optimized pool configuration defaults
 * These values are tuned for serverless environments
 */
export declare const LAMBDA_POOL_DEFAULTS: {
    /** Maximum connections per Lambda instance (keep low to avoid exhausting DB connections) */
    readonly maxConnections: 5;
    /** Minimum connections to maintain (0 for Lambda to allow full cleanup) */
    readonly minConnections: 0;
    /** Idle timeout in ms (shorter for Lambda to release connections quickly) */
    readonly idleTimeoutMs: 10000;
    /** Connection timeout in ms (shorter for Lambda cold starts) */
    readonly connectionTimeoutMs: 5000;
    /** Statement timeout in ms (prevent long-running queries) */
    readonly statementTimeoutMs: 30000;
    /** Query timeout in ms */
    readonly queryTimeoutMs: 30000;
    /** Allow exit on idle (important for Lambda) */
    readonly allowExitOnIdle: true;
};
/**
 * Pool statistics for monitoring
 */
export interface PoolStats {
    readonly totalConnections: number;
    readonly idleConnections: number;
    readonly waitingClients: number;
}
/**
 * Extended pool metrics for comprehensive monitoring
 */
export interface PoolMetrics {
    /** Basic pool statistics */
    readonly stats: PoolStats;
    /** Pool initialization timestamp */
    readonly initializedAt: number | null;
    /** Pool uptime in milliseconds */
    readonly uptimeMs: number;
    /** Total queries executed since pool initialization */
    readonly totalQueries: number;
    /** Total query errors since pool initialization */
    readonly totalErrors: number;
    /** Average query duration in milliseconds */
    readonly avgQueryDurationMs: number;
    /** Connection acquire count */
    readonly connectionAcquires: number;
    /** Connection release count */
    readonly connectionReleases: number;
    /** Connection errors count */
    readonly connectionErrors: number;
    /** Pool is healthy */
    readonly isHealthy: boolean;
}
/**
 * Reset internal metrics (useful for testing)
 */
export declare function resetMetrics(): void;
/**
 * Initialize the database connection pool
 * Optimized for Lambda with connection reuse across invocations
 */
export declare function initializePool(config?: DatabaseConfig): Promise<Pool>;
/**
 * Get the current connection pool
 */
export declare function getPool(): Promise<Pool>;
/**
 * Get a client from the pool
 */
export declare function getClient(): Promise<PoolClient>;
/**
 * Execute a query using the pool with metrics tracking
 */
export declare function query<T extends QueryResultRow = QueryResultRow>(text: string, values?: unknown[]): Promise<QueryResult<T>>;
/**
 * Execute a query and return the first row
 */
export declare function queryOne<T extends QueryResultRow = QueryResultRow>(text: string, values?: unknown[]): Promise<T | null>;
/**
 * Execute a query and return all rows
 */
export declare function queryMany<T extends QueryResultRow = QueryResultRow>(text: string, values?: unknown[]): Promise<T[]>;
/**
 * Get pool statistics
 */
export declare function getPoolStats(): PoolStats | null;
/**
 * Get comprehensive pool metrics for monitoring
 */
export declare function getPoolMetrics(): PoolMetrics;
/**
 * Close the connection pool gracefully
 * Waits for active queries to complete before closing
 */
export declare function closePool(): Promise<void>;
/**
 * Drain the connection pool
 * Releases all idle connections while keeping the pool active
 */
export declare function drainPool(): Promise<void>;
/**
 * Warm up the connection pool
 * Pre-establishes connections to reduce cold start latency
 */
export declare function warmupPool(connectionCount?: number): Promise<void>;
/**
 * Health check for the database connection
 */
export declare function healthCheck(): Promise<boolean>;
/**
 * Detailed health check with metrics
 */
export declare function detailedHealthCheck(): Promise<{
    healthy: boolean;
    latencyMs: number;
    poolMetrics: PoolMetrics;
    error?: string;
}>;
/**
 * Wrapper for Lambda handlers that ensures pool cleanup
 */
export declare function withDatabase<TEvent, TResult>(handler: (event: TEvent, pool: Pool) => Promise<TResult>): (event: TEvent) => Promise<TResult>;
/**
 * Wrapper for Lambda handlers with automatic connection management
 * Acquires a client, executes the handler, and releases the client
 */
export declare function withClient<TEvent, TResult>(handler: (event: TEvent, client: PoolClient) => Promise<TResult>): (event: TEvent) => Promise<TResult>;
/**
 * Check if the pool is initialized
 */
export declare function isPoolInitialized(): boolean;
/**
 * Get pool initialization timestamp
 */
export declare function getPoolInitializedAt(): number | null;
/**
 * Register cleanup handlers for graceful shutdown
 * Call this in Lambda initialization to ensure proper cleanup
 */
export declare function registerCleanupHandlers(): void;
//# sourceMappingURL=pool.d.ts.map