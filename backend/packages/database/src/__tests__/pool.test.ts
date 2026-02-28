/**
 * Database Connection Pool Unit Tests
 *
 * Tests for the database connection pool optimized for Lambda functions
 * Validates Requirements: 10.7
 */

// Mock pg module
const mockPoolClient = {
  query: jest.fn(),
  release: jest.fn(),
};

const mockPool = {
  connect: jest.fn().mockResolvedValue(mockPoolClient),
  query: jest.fn(),
  end: jest.fn().mockResolvedValue(undefined),
  on: jest.fn(),
  totalCount: 2,
  idleCount: 1,
  waitingCount: 0,
};

jest.mock('pg', () => ({
  Pool: jest.fn(() => mockPool),
}));

// Mock connection module
jest.mock('../connection', () => ({
  buildDatabaseConfig: jest.fn().mockResolvedValue({
    host: 'localhost',
    port: 5432,
    database: 'test_db',
    username: 'test_user',
    password: 'test_password',
    ssl: false,
    connectionTimeoutMs: 5000,
    idleTimeoutMs: 10000,
    maxConnections: 5,
  }),
}));

// Mock logger
jest.mock('@ams/utils', () => ({
  createLogger: jest.fn(() => ({
    debug: jest.fn(),
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
  })),
}));

// Import after mocks
import {
  initializePool,
  getPool,
  getClient,
  query,
  queryOne,
  queryMany,
  getPoolStats,
  getPoolMetrics,
  closePool,
  warmupPool,
  healthCheck,
  detailedHealthCheck,
  withDatabase,
  withClient,
  isPoolInitialized,
  getPoolInitializedAt,
  resetMetrics,
  LAMBDA_POOL_DEFAULTS,
} from '../pool';

describe('Database Connection Pool', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    resetMetrics();
  });

  /**
   * Validates: Requirements 10.7
   * Lambda-optimized pool configuration
   */
  describe('LAMBDA_POOL_DEFAULTS', () => {
    it('should have appropriate defaults for Lambda environment', () => {
      expect(LAMBDA_POOL_DEFAULTS.maxConnections).toBe(5);
      expect(LAMBDA_POOL_DEFAULTS.minConnections).toBe(0);
      expect(LAMBDA_POOL_DEFAULTS.idleTimeoutMs).toBe(10000);
      expect(LAMBDA_POOL_DEFAULTS.connectionTimeoutMs).toBe(5000);
      expect(LAMBDA_POOL_DEFAULTS.statementTimeoutMs).toBe(30000);
      expect(LAMBDA_POOL_DEFAULTS.allowExitOnIdle).toBe(true);
    });

    it('should have low max connections to avoid exhausting DB connections', () => {
      // Lambda can have many concurrent instances, so each should use few connections
      expect(LAMBDA_POOL_DEFAULTS.maxConnections).toBeLessThanOrEqual(10);
    });

    it('should have short idle timeout for Lambda', () => {
      // Lambda functions should release connections quickly
      expect(LAMBDA_POOL_DEFAULTS.idleTimeoutMs).toBeLessThanOrEqual(30000);
    });
  });

  /**
   * Validates: Requirements 10.7
   * Connection pool initialization
   */
  describe('initializePool', () => {
    beforeEach(async () => {
      // Reset pool state by closing it
      await closePool().catch(() => {});
    });

    it('should initialize pool with Lambda-optimized settings', async () => {
      mockPoolClient.query.mockResolvedValue({ rows: [{ '?column?': 1 }], rowCount: 1 });

      const pool = await initializePool();

      expect(pool).toBeDefined();
      expect(require('pg').Pool).toHaveBeenCalled();
    });

    it('should reuse existing pool on subsequent calls', async () => {
      mockPoolClient.query.mockResolvedValue({ rows: [{ '?column?': 1 }], rowCount: 1 });

      const pool1 = await initializePool();
      const pool2 = await initializePool();

      // Pool constructor should only be called once
      expect(pool1).toBe(pool2);
    });

    it('should set up event handlers for monitoring', async () => {
      mockPoolClient.query.mockResolvedValue({ rows: [{ '?column?': 1 }], rowCount: 1 });

      await initializePool();

      // Verify event handlers are registered
      expect(mockPool.on).toHaveBeenCalledWith('connect', expect.any(Function));
      expect(mockPool.on).toHaveBeenCalledWith('acquire', expect.any(Function));
      expect(mockPool.on).toHaveBeenCalledWith('release', expect.any(Function));
      expect(mockPool.on).toHaveBeenCalledWith('remove', expect.any(Function));
      expect(mockPool.on).toHaveBeenCalledWith('error', expect.any(Function));
    });

    it('should test connection on initialization', async () => {
      mockPoolClient.query.mockResolvedValue({ rows: [{ '?column?': 1 }], rowCount: 1 });

      await initializePool();

      expect(mockPool.connect).toHaveBeenCalled();
      expect(mockPoolClient.query).toHaveBeenCalledWith('SELECT 1');
      expect(mockPoolClient.release).toHaveBeenCalled();
    });
  });

  /**
   * Validates: Requirements 10.7
   * Connection reuse across invocations
   */
  describe('getPool', () => {
    beforeEach(async () => {
      await closePool().catch(() => {});
    });

    it('should initialize pool if not already initialized', async () => {
      mockPoolClient.query.mockResolvedValue({ rows: [{ '?column?': 1 }], rowCount: 1 });

      const pool = await getPool();

      expect(pool).toBeDefined();
    });

    it('should return existing pool if already initialized', async () => {
      mockPoolClient.query.mockResolvedValue({ rows: [{ '?column?': 1 }], rowCount: 1 });

      const pool1 = await getPool();
      const pool2 = await getPool();

      expect(pool1).toBe(pool2);
    });
  });

  describe('getClient', () => {
    beforeEach(async () => {
      await closePool().catch(() => {});
    });

    it('should return a client from the pool', async () => {
      mockPoolClient.query.mockResolvedValue({ rows: [{ '?column?': 1 }], rowCount: 1 });

      const client = await getClient();

      expect(client).toBeDefined();
      expect(mockPool.connect).toHaveBeenCalled();
    });
  });

  /**
   * Validates: Requirements 10.7
   * Query execution with metrics tracking
   */
  describe('query', () => {
    beforeEach(async () => {
      await closePool().catch(() => {});
      mockPoolClient.query.mockResolvedValue({ rows: [{ '?column?': 1 }], rowCount: 1 });
      await initializePool();
    });

    it('should execute query and return result', async () => {
      const mockResult = { rows: [{ id: 1, name: 'test' }], rowCount: 1 };
      mockPool.query.mockResolvedValue(mockResult);

      const result = await query('SELECT * FROM assets WHERE id = $1', [1]);

      expect(result).toEqual(mockResult);
      expect(mockPool.query).toHaveBeenCalledWith('SELECT * FROM assets WHERE id = $1', [1]);
    });

    it('should track query metrics on success', async () => {
      mockPool.query.mockResolvedValue({ rows: [], rowCount: 0 });

      await query('SELECT 1');

      const metrics = getPoolMetrics();
      expect(metrics.totalQueries).toBe(1);
      expect(metrics.totalErrors).toBe(0);
    });

    it('should track error metrics on failure', async () => {
      mockPool.query.mockRejectedValue(new Error('Query failed'));

      await expect(query('SELECT * FROM nonexistent')).rejects.toThrow('Query failed');

      const metrics = getPoolMetrics();
      expect(metrics.totalQueries).toBe(1);
      expect(metrics.totalErrors).toBe(1);
    });
  });

  describe('queryOne', () => {
    beforeEach(async () => {
      await closePool().catch(() => {});
      mockPoolClient.query.mockResolvedValue({ rows: [{ '?column?': 1 }], rowCount: 1 });
      await initializePool();
    });

    it('should return first row when results exist', async () => {
      mockPool.query.mockResolvedValue({ rows: [{ id: 1 }, { id: 2 }], rowCount: 2 });

      const result = await queryOne<{ id: number }>('SELECT * FROM assets');

      expect(result).toEqual({ id: 1 });
    });

    it('should return null when no results', async () => {
      mockPool.query.mockResolvedValue({ rows: [], rowCount: 0 });

      const result = await queryOne('SELECT * FROM assets WHERE id = $1', [999]);

      expect(result).toBeNull();
    });
  });

  describe('queryMany', () => {
    beforeEach(async () => {
      await closePool().catch(() => {});
      mockPoolClient.query.mockResolvedValue({ rows: [{ '?column?': 1 }], rowCount: 1 });
      await initializePool();
    });

    it('should return all rows', async () => {
      const mockRows = [{ id: 1 }, { id: 2 }, { id: 3 }];
      mockPool.query.mockResolvedValue({ rows: mockRows, rowCount: 3 });

      const result = await queryMany<{ id: number }>('SELECT * FROM assets');

      expect(result).toEqual(mockRows);
      expect(result.length).toBe(3);
    });

    it('should return empty array when no results', async () => {
      mockPool.query.mockResolvedValue({ rows: [], rowCount: 0 });

      const result = await queryMany('SELECT * FROM assets WHERE 1 = 0');

      expect(result).toEqual([]);
    });
  });

  /**
   * Validates: Requirements 10.7
   * Pool metrics monitoring
   */
  describe('getPoolStats', () => {
    beforeEach(async () => {
      await closePool().catch(() => {});
    });

    it('should return null when pool is not initialized', () => {
      const stats = getPoolStats();

      expect(stats).toBeNull();
    });

    it('should return pool statistics when initialized', async () => {
      mockPoolClient.query.mockResolvedValue({ rows: [{ '?column?': 1 }], rowCount: 1 });
      await initializePool();

      const stats = getPoolStats();

      expect(stats).toEqual({
        totalConnections: 2,
        idleConnections: 1,
        waitingClients: 0,
      });
    });
  });

  describe('getPoolMetrics', () => {
    beforeEach(async () => {
      await closePool().catch(() => {});
    });

    it('should return comprehensive metrics', async () => {
      mockPoolClient.query.mockResolvedValue({ rows: [{ '?column?': 1 }], rowCount: 1 });
      await initializePool();

      const metrics = getPoolMetrics();

      expect(metrics).toHaveProperty('stats');
      expect(metrics).toHaveProperty('initializedAt');
      expect(metrics).toHaveProperty('uptimeMs');
      expect(metrics).toHaveProperty('totalQueries');
      expect(metrics).toHaveProperty('totalErrors');
      expect(metrics).toHaveProperty('avgQueryDurationMs');
      expect(metrics).toHaveProperty('connectionAcquires');
      expect(metrics).toHaveProperty('connectionReleases');
      expect(metrics).toHaveProperty('connectionErrors');
      expect(metrics).toHaveProperty('isHealthy');
    });

    it('should track uptime correctly', async () => {
      mockPoolClient.query.mockResolvedValue({ rows: [{ '?column?': 1 }], rowCount: 1 });
      await initializePool();

      // Wait a bit
      await new Promise((resolve) => setTimeout(resolve, 50));

      const metrics = getPoolMetrics();

      expect(metrics.uptimeMs).toBeGreaterThanOrEqual(50);
      expect(metrics.initializedAt).not.toBeNull();
    });

    it('should calculate average query duration', async () => {
      mockPoolClient.query.mockResolvedValue({ rows: [{ '?column?': 1 }], rowCount: 1 });
      await initializePool();
      mockPool.query.mockResolvedValue({ rows: [], rowCount: 0 });

      await query('SELECT 1');
      await query('SELECT 2');

      const metrics = getPoolMetrics();

      expect(metrics.totalQueries).toBe(2);
      expect(metrics.avgQueryDurationMs).toBeGreaterThanOrEqual(0);
    });

    it('should report healthy status when pool is working', async () => {
      mockPoolClient.query.mockResolvedValue({ rows: [{ '?column?': 1 }], rowCount: 1 });
      await initializePool();

      const metrics = getPoolMetrics();

      expect(metrics.isHealthy).toBe(true);
    });
  });

  /**
   * Validates: Requirements 10.7
   * Graceful connection cleanup
   */
  describe('closePool', () => {
    beforeEach(async () => {
      await closePool().catch(() => {});
    });

    it('should close the pool gracefully', async () => {
      mockPoolClient.query.mockResolvedValue({ rows: [{ '?column?': 1 }], rowCount: 1 });
      await initializePool();

      await closePool();

      expect(mockPool.end).toHaveBeenCalled();
    });

    it('should handle closing when pool is not initialized', async () => {
      // Should not throw
      await expect(closePool()).resolves.not.toThrow();
    });

    it('should reset pool state after closing', async () => {
      mockPoolClient.query.mockResolvedValue({ rows: [{ '?column?': 1 }], rowCount: 1 });
      await initializePool();

      expect(isPoolInitialized()).toBe(true);

      await closePool();

      expect(isPoolInitialized()).toBe(false);
      expect(getPoolInitializedAt()).toBeNull();
    });
  });

  /**
   * Validates: Requirements 10.7
   * Connection warmup for cold starts
   */
  describe('warmupPool', () => {
    beforeEach(async () => {
      await closePool().catch(() => {});
    });

    it('should warm up connections', async () => {
      mockPoolClient.query.mockResolvedValue({ rows: [{ '?column?': 1 }], rowCount: 1 });
      await initializePool();

      await warmupPool(2);

      // Should acquire and release connections
      expect(mockPool.connect).toHaveBeenCalled();
      expect(mockPoolClient.release).toHaveBeenCalled();
    });

    it('should execute test query on each warmed connection', async () => {
      mockPoolClient.query.mockResolvedValue({ rows: [{ '?column?': 1 }], rowCount: 1 });
      await initializePool();

      await warmupPool(1);

      expect(mockPoolClient.query).toHaveBeenCalledWith('SELECT 1');
    });
  });

  /**
   * Validates: Requirements 10.7
   * Health checks
   */
  describe('healthCheck', () => {
    beforeEach(async () => {
      await closePool().catch(() => {});
      mockPoolClient.query.mockResolvedValue({ rows: [{ '?column?': 1 }], rowCount: 1 });
      await initializePool();
    });

    it('should return true when database is healthy', async () => {
      mockPool.query.mockResolvedValue({ rows: [{ health: 1 }], rowCount: 1 });

      const result = await healthCheck();

      expect(result).toBe(true);
    });

    it('should return false when database is unhealthy', async () => {
      mockPool.query.mockRejectedValue(new Error('Connection failed'));

      const result = await healthCheck();

      expect(result).toBe(false);
    });
  });

  describe('detailedHealthCheck', () => {
    beforeEach(async () => {
      await closePool().catch(() => {});
      mockPoolClient.query.mockResolvedValue({ rows: [{ '?column?': 1 }], rowCount: 1 });
      await initializePool();
    });

    it('should return detailed health information on success', async () => {
      mockPool.query.mockResolvedValue({ rows: [{ health: 1 }], rowCount: 1 });

      const result = await detailedHealthCheck();

      expect(result.healthy).toBe(true);
      expect(result.latencyMs).toBeGreaterThanOrEqual(0);
      expect(result.poolMetrics).toBeDefined();
      expect(result.error).toBeUndefined();
    });

    it('should return error information on failure', async () => {
      mockPool.query.mockRejectedValue(new Error('Connection timeout'));

      const result = await detailedHealthCheck();

      expect(result.healthy).toBe(false);
      expect(result.error).toBe('Connection timeout');
      expect(result.poolMetrics).toBeDefined();
    });
  });

  /**
   * Validates: Requirements 10.7
   * Lambda handler wrappers
   */
  describe('withDatabase', () => {
    beforeEach(async () => {
      await closePool().catch(() => {});
      mockPoolClient.query.mockResolvedValue({ rows: [{ '?column?': 1 }], rowCount: 1 });
    });

    it('should provide pool to handler', async () => {
      const handler = jest.fn().mockResolvedValue('result');
      const wrappedHandler = withDatabase(handler);

      const result = await wrappedHandler({ test: 'event' });

      expect(result).toBe('result');
      expect(handler).toHaveBeenCalledWith({ test: 'event' }, expect.any(Object));
    });
  });

  describe('withClient', () => {
    beforeEach(async () => {
      await closePool().catch(() => {});
      mockPoolClient.query.mockResolvedValue({ rows: [{ '?column?': 1 }], rowCount: 1 });
    });

    it('should provide client to handler and release after', async () => {
      const handler = jest.fn().mockResolvedValue('result');
      const wrappedHandler = withClient(handler);

      const result = await wrappedHandler({ test: 'event' });

      expect(result).toBe('result');
      expect(handler).toHaveBeenCalledWith({ test: 'event' }, expect.any(Object));
      expect(mockPoolClient.release).toHaveBeenCalled();
    });

    it('should release client even on error', async () => {
      const handler = jest.fn().mockRejectedValue(new Error('Handler error'));
      const wrappedHandler = withClient(handler);

      await expect(wrappedHandler({ test: 'event' })).rejects.toThrow('Handler error');
      expect(mockPoolClient.release).toHaveBeenCalled();
    });
  });

  /**
   * Validates: Requirements 10.7
   * Pool state utilities
   */
  describe('isPoolInitialized', () => {
    beforeEach(async () => {
      await closePool().catch(() => {});
    });

    it('should return false when pool is not initialized', () => {
      expect(isPoolInitialized()).toBe(false);
    });

    it('should return true when pool is initialized', async () => {
      mockPoolClient.query.mockResolvedValue({ rows: [{ '?column?': 1 }], rowCount: 1 });
      await initializePool();

      expect(isPoolInitialized()).toBe(true);
    });
  });

  describe('getPoolInitializedAt', () => {
    beforeEach(async () => {
      await closePool().catch(() => {});
    });

    it('should return null when pool is not initialized', () => {
      expect(getPoolInitializedAt()).toBeNull();
    });

    it('should return timestamp when pool is initialized', async () => {
      mockPoolClient.query.mockResolvedValue({ rows: [{ '?column?': 1 }], rowCount: 1 });
      const before = Date.now();
      await initializePool();
      const after = Date.now();

      const initializedAt = getPoolInitializedAt();

      expect(initializedAt).not.toBeNull();
      expect(initializedAt).toBeGreaterThanOrEqual(before);
      expect(initializedAt).toBeLessThanOrEqual(after);
    });
  });

  describe('resetMetrics', () => {
    beforeEach(async () => {
      await closePool().catch(() => {});
      mockPoolClient.query.mockResolvedValue({ rows: [{ '?column?': 1 }], rowCount: 1 });
      await initializePool();
    });

    it('should reset all metrics to zero', async () => {
      mockPool.query.mockResolvedValue({ rows: [], rowCount: 0 });
      await query('SELECT 1');
      await query('SELECT 2');

      let metrics = getPoolMetrics();
      expect(metrics.totalQueries).toBe(2);

      resetMetrics();

      metrics = getPoolMetrics();
      expect(metrics.totalQueries).toBe(0);
      expect(metrics.totalErrors).toBe(0);
      expect(metrics.avgQueryDurationMs).toBe(0);
      expect(metrics.connectionAcquires).toBe(0);
      expect(metrics.connectionReleases).toBe(0);
      expect(metrics.connectionErrors).toBe(0);
    });
  });
});
