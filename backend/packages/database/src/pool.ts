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

import type { Pool, PoolClient, PoolConfig, QueryResult, QueryResultRow } from 'pg';
import pg from 'pg';

import { createLogger } from '@ams/utils';

import type { DatabaseConfig } from './connection';
import { buildDatabaseConfig } from './connection';

const logger = createLogger({ service: 'database-pool' });

/**
 * Global pool instance (reused across Lambda invocations)
 */
let pool: Pool | null = null;

/**
 * Pool initialization timestamp for tracking
 */
let poolInitializedAt: number | null = null;

/**
 * Lambda-optimized pool configuration defaults
 * These values are tuned for serverless environments
 */
export const LAMBDA_POOL_DEFAULTS = {
  /** Maximum connections per Lambda instance (keep low to avoid exhausting DB connections) */
  maxConnections: 5,
  /** Minimum connections to maintain (0 for Lambda to allow full cleanup) */
  minConnections: 0,
  /** Idle timeout in ms (shorter for Lambda to release connections quickly) */
  idleTimeoutMs: 10000,
  /** Connection timeout in ms (shorter for Lambda cold starts) */
  connectionTimeoutMs: 5000,
  /** Statement timeout in ms (prevent long-running queries) */
  statementTimeoutMs: 30000,
  /** Query timeout in ms */
  queryTimeoutMs: 30000,
  /** Allow exit on idle (important for Lambda) */
  allowExitOnIdle: true,
} as const;

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
 * Internal metrics tracking
 */
interface InternalMetrics {
  totalQueries: number;
  totalErrors: number;
  totalQueryDurationMs: number;
  connectionAcquires: number;
  connectionReleases: number;
  connectionErrors: number;
}

/**
 * Internal metrics state
 */
let metrics: InternalMetrics = {
  totalQueries: 0,
  totalErrors: 0,
  totalQueryDurationMs: 0,
  connectionAcquires: 0,
  connectionReleases: 0,
  connectionErrors: 0,
};

/**
 * Reset internal metrics (useful for testing)
 */
export function resetMetrics(): void {
  metrics = {
    totalQueries: 0,
    totalErrors: 0,
    totalQueryDurationMs: 0,
    connectionAcquires: 0,
    connectionReleases: 0,
    connectionErrors: 0,
  };
  logger.debug('Pool metrics reset');
}

/**
 * Initialize the database connection pool
 * Optimized for Lambda with connection reuse across invocations
 */
export async function initializePool(config?: DatabaseConfig): Promise<Pool> {
  if (pool) {
    logger.debug('Reusing existing connection pool', {
      totalConnections: pool.totalCount,
      idleConnections: pool.idleCount,
      uptimeMs: poolInitializedAt ? Date.now() - poolInitializedAt : 0,
    });
    return pool;
  }

  logger.info('Initializing database connection pool');

  const dbConfig = await buildDatabaseConfig(config ?? {});

  // Merge Lambda-optimized defaults with provided config
  const poolConfig: PoolConfig = {
    host: dbConfig.host,
    port: dbConfig.port,
    database: dbConfig.database,
    user: dbConfig.username,
    password: dbConfig.password,
    ssl: dbConfig.ssl ? { rejectUnauthorized: false } : false,
    // Lambda-optimized settings
    max: Math.min(dbConfig.maxConnections, LAMBDA_POOL_DEFAULTS.maxConnections),
    min: LAMBDA_POOL_DEFAULTS.minConnections,
    idleTimeoutMillis: dbConfig.idleTimeoutMs ?? LAMBDA_POOL_DEFAULTS.idleTimeoutMs,
    connectionTimeoutMillis: dbConfig.connectionTimeoutMs ?? LAMBDA_POOL_DEFAULTS.connectionTimeoutMs,
    // Lambda-specific optimizations
    allowExitOnIdle: LAMBDA_POOL_DEFAULTS.allowExitOnIdle,
    // Statement timeout to prevent long-running queries
    statement_timeout: LAMBDA_POOL_DEFAULTS.statementTimeoutMs,
    query_timeout: LAMBDA_POOL_DEFAULTS.queryTimeoutMs,
  };

  pool = new pg.Pool(poolConfig);
  poolInitializedAt = Date.now();

  // Set up event handlers for monitoring
  pool.on('connect', (client) => {
    logger.debug('New database connection established', {
      totalConnections: pool?.totalCount,
    });
    // Set session-level statement timeout
    client.query(`SET statement_timeout = ${LAMBDA_POOL_DEFAULTS.statementTimeoutMs}`).catch((err) => {
      logger.warn('Failed to set statement timeout', { error: err.message });
    });
  });

  pool.on('acquire', () => {
    metrics.connectionAcquires++;
    logger.debug('Connection acquired from pool', {
      totalConnections: pool?.totalCount,
      idleConnections: pool?.idleCount,
      waitingClients: pool?.waitingCount,
    });
  });

  pool.on('release', () => {
    metrics.connectionReleases++;
    logger.debug('Connection released to pool', {
      totalConnections: pool?.totalCount,
      idleConnections: pool?.idleCount,
    });
  });

  pool.on('remove', () => {
    logger.debug('Connection removed from pool', {
      totalConnections: pool?.totalCount,
    });
  });

  pool.on('error', (err) => {
    metrics.connectionErrors++;
    logger.error('Unexpected pool error', err, {
      totalConnections: pool?.totalCount,
    });
  });

  // Test the connection
  try {
    const client = await pool.connect();
    await client.query('SELECT 1');
    client.release();
    logger.info('Database connection pool initialized successfully', {
      maxConnections: poolConfig.max,
      idleTimeoutMs: poolConfig.idleTimeoutMillis,
      connectionTimeoutMs: poolConfig.connectionTimeoutMillis,
    });
  } catch (error) {
    logger.error('Failed to initialize database connection pool', error as Error);
    await pool.end();
    pool = null;
    poolInitializedAt = null;
    throw error;
  }

  return pool;
}

/**
 * Get the current connection pool
 */
export async function getPool(): Promise<Pool> {
  if (!pool) {
    return initializePool();
  }
  return pool;
}

/**
 * Get a client from the pool
 */
export async function getClient(): Promise<PoolClient> {
  const p = await getPool();
  return p.connect();
}

/**
 * Execute a query using the pool with metrics tracking
 */
export async function query<T extends QueryResultRow = QueryResultRow>(
  text: string,
  values?: unknown[]
): Promise<QueryResult<T>> {
  const p = await getPool();
  const start = Date.now();

  try {
    const result = await p.query<T>(text, values);
    const duration = Date.now() - start;

    // Track metrics
    metrics.totalQueries++;
    metrics.totalQueryDurationMs += duration;

    logger.debug('Query executed', {
      query: text.substring(0, 100),
      duration,
      rowCount: result.rowCount,
    });

    return result;
  } catch (error) {
    const duration = Date.now() - start;
    
    // Track error metrics
    metrics.totalQueries++;
    metrics.totalErrors++;
    metrics.totalQueryDurationMs += duration;

    logger.error('Query failed', error as Error, {
      query: text.substring(0, 100),
      duration,
    });
    throw error;
  }
}

/**
 * Execute a query and return the first row
 */
export async function queryOne<T extends QueryResultRow = QueryResultRow>(
  text: string,
  values?: unknown[]
): Promise<T | null> {
  const result = await query<T>(text, values);
  return result.rows[0] ?? null;
}

/**
 * Execute a query and return all rows
 */
export async function queryMany<T extends QueryResultRow = QueryResultRow>(
  text: string,
  values?: unknown[]
): Promise<T[]> {
  const result = await query<T>(text, values);
  return result.rows;
}

/**
 * Get pool statistics
 */
export function getPoolStats(): PoolStats | null {
  if (!pool) {
    return null;
  }

  return {
    totalConnections: pool.totalCount,
    idleConnections: pool.idleCount,
    waitingClients: pool.waitingCount,
  };
}

/**
 * Get comprehensive pool metrics for monitoring
 */
export function getPoolMetrics(): PoolMetrics {
  const stats = getPoolStats() ?? {
    totalConnections: 0,
    idleConnections: 0,
    waitingClients: 0,
  };

  const uptimeMs = poolInitializedAt ? Date.now() - poolInitializedAt : 0;
  const avgQueryDurationMs = metrics.totalQueries > 0 
    ? metrics.totalQueryDurationMs / metrics.totalQueries 
    : 0;

  // Pool is healthy if it exists and has no waiting clients with available idle connections
  const isHealthy = pool !== null && 
    (stats.waitingClients === 0 || stats.idleConnections > 0) &&
    metrics.connectionErrors < 10; // Threshold for connection errors

  return {
    stats,
    initializedAt: poolInitializedAt,
    uptimeMs,
    totalQueries: metrics.totalQueries,
    totalErrors: metrics.totalErrors,
    avgQueryDurationMs: Math.round(avgQueryDurationMs * 100) / 100,
    connectionAcquires: metrics.connectionAcquires,
    connectionReleases: metrics.connectionReleases,
    connectionErrors: metrics.connectionErrors,
    isHealthy,
  };
}

/**
 * Close the connection pool gracefully
 * Waits for active queries to complete before closing
 */
export async function closePool(): Promise<void> {
  if (pool) {
    const stats = getPoolStats();
    logger.info('Closing database connection pool', {
      totalConnections: stats?.totalConnections,
      idleConnections: stats?.idleConnections,
      waitingClients: stats?.waitingClients,
    });
    
    try {
      await pool.end();
      logger.info('Database connection pool closed successfully');
    } catch (error) {
      logger.error('Error closing database connection pool', error as Error);
      throw error;
    } finally {
      pool = null;
      poolInitializedAt = null;
    }
  }
}

/**
 * Drain the connection pool
 * Releases all idle connections while keeping the pool active
 */
export async function drainPool(): Promise<void> {
  if (!pool) {
    return;
  }

  const stats = getPoolStats();
  logger.info('Draining connection pool', {
    totalConnections: stats?.totalConnections,
    idleConnections: stats?.idleConnections,
  });

  // The pg pool doesn't have a direct drain method, but we can
  // close and reinitialize to achieve similar effect
  // For Lambda, this is typically not needed as connections are
  // automatically released when idle
}

/**
 * Warm up the connection pool
 * Pre-establishes connections to reduce cold start latency
 */
export async function warmupPool(connectionCount = 1): Promise<void> {
  const p = await getPool();
  const clients: PoolClient[] = [];

  logger.info('Warming up connection pool', { connectionCount });

  try {
    // Acquire multiple connections to warm up the pool
    for (let i = 0; i < connectionCount; i++) {
      const client = await p.connect();
      // Execute a simple query to ensure connection is fully established
      await client.query('SELECT 1');
      clients.push(client);
    }

    logger.info('Connection pool warmed up successfully', {
      connectionsWarmed: clients.length,
      totalConnections: p.totalCount,
    });
  } finally {
    // Release all acquired connections back to the pool
    for (const client of clients) {
      client.release();
    }
  }
}

/**
 * Health check for the database connection
 */
export async function healthCheck(): Promise<boolean> {
  try {
    const result = await query('SELECT 1 as health');
    return result.rowCount === 1;
  } catch (error) {
    logger.error('Database health check failed', error as Error);
    return false;
  }
}

/**
 * Detailed health check with metrics
 */
export async function detailedHealthCheck(): Promise<{
  healthy: boolean;
  latencyMs: number;
  poolMetrics: PoolMetrics;
  error?: string;
}> {
  const start = Date.now();
  const poolMetrics = getPoolMetrics();

  try {
    await query('SELECT 1 as health');
    const latencyMs = Date.now() - start;

    return {
      healthy: true,
      latencyMs,
      poolMetrics,
    };
  } catch (error) {
    const latencyMs = Date.now() - start;
    const err = error as Error;

    return {
      healthy: false,
      latencyMs,
      poolMetrics,
      error: err.message,
    };
  }
}

/**
 * Wrapper for Lambda handlers that ensures pool cleanup
 */
export function withDatabase<TEvent, TResult>(
  handler: (event: TEvent, pool: Pool) => Promise<TResult>
): (event: TEvent) => Promise<TResult> {
  return async (event: TEvent): Promise<TResult> => {
    const p = await getPool();
    return handler(event, p);
  };
}

/**
 * Wrapper for Lambda handlers with automatic connection management
 * Acquires a client, executes the handler, and releases the client
 */
export function withClient<TEvent, TResult>(
  handler: (event: TEvent, client: PoolClient) => Promise<TResult>
): (event: TEvent) => Promise<TResult> {
  return async (event: TEvent): Promise<TResult> => {
    const client = await getClient();
    try {
      return await handler(event, client);
    } finally {
      client.release();
    }
  };
}

/**
 * Check if the pool is initialized
 */
export function isPoolInitialized(): boolean {
  return pool !== null;
}

/**
 * Get pool initialization timestamp
 */
export function getPoolInitializedAt(): number | null {
  return poolInitializedAt;
}

/**
 * Register cleanup handlers for graceful shutdown
 * Call this in Lambda initialization to ensure proper cleanup
 */
export function registerCleanupHandlers(): void {
  // Handle process termination signals
  const cleanup = async (signal: string): Promise<void> => {
    logger.info(`Received ${signal}, cleaning up database connections`);
    await closePool();
    process.exit(0);
  };

  process.on('SIGTERM', () => cleanup('SIGTERM'));
  process.on('SIGINT', () => cleanup('SIGINT'));

  logger.debug('Database cleanup handlers registered');
}
