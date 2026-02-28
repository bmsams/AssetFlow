/**
 * Integration test helpers and utilities
 * Provides common functionality for cross-service integration tests
 */
import { createPool, Pool, PoolConfig } from 'pg';
import { RedisClientType, createClient } from 'redis';

/**
 * Test database connection configuration
 */
const dbConfig: PoolConfig = {
  host: process.env.DB_HOST || 'localhost',
  port: Number(process.env.DB_PORT || 5432),
  user: process.env.DB_USER || 'postgres',
  password: process.env.DB_PASSWORD || 'postgres',
  database: process.env.DB_NAME || 'ams_test',
  max: 10,
  idleTimeoutMillis: 30000,
};

/**
 * Test redis connection configuration
 */
const redisConfig = {
  url: process.env.REDIS_URL || 'redis://localhost:6379',
};

/**
 * Create and manage database connections for integration tests
 */
class DbTestClient {
  private static instance: DbTestClient;
  private pool: Pool;

  private constructor() {
    this.pool = createPool(dbConfig);
  }

  public static getInstance(): DbTestClient {
    if (!DbTestClient.instance) {
      DbTestClient.instance = new DbTestClient();
    }
    return DbTestClient.instance;
  }

  public getPool(): Pool {
    return this.pool;
  }

  public async query(text: string, params?: any[]) {
    return this.pool.query(text, params);
  }

  public async cleanDb() {
    // Delete data from tables in a way that respects foreign key constraints
    // This allows tests to start with a clean slate
    await this.pool.query(`
      DO $$ 
      BEGIN
        -- Disable triggers temporarily to avoid permission issues
        SET session_replication_role = 'replica';
        
        -- Delete data from tables in reverse dependency order
        TRUNCATE work_order_parts, work_orders, maintenance_plans CASCADE;
        TRUNCATE receiving_items, receiving, inspection_results CASCADE;
        TRUNCATE purchase_order_lines, purchase_order_approvals, purchase_orders CASCADE;
        TRUNCATE asset_history, hardware_assets, software_assets, enterprise_assets CASCADE;
        TRUNCATE rooms, floors, buildings CASCADE;
        TRUNCATE bin_locations, stockroom_inventory, stockrooms CASCADE;
        TRUNCATE department_hierarchy, departments, cost_centers CASCADE;
        TRUNCATE vendors, manufacturers, models CASCADE;
        
        -- Re-enable triggers
        SET session_replication_role = 'origin';
      END $$;
    `);
  }

  public async close() {
    await this.pool.end();
  }
}

/**
 * Create and manage Redis connections for integration tests
 */
class CacheTestClient {
  private static instance: CacheTestClient;
  private client: RedisClientType;
  private connected: boolean = false;

  private constructor() {
    this.client = createClient(redisConfig);
    this.client.on('error', (err) => console.error('Redis client error', err));
  }

  public static getInstance(): CacheTestClient {
    if (!CacheTestClient.instance) {
      CacheTestClient.instance = new CacheTestClient();
    }
    return CacheTestClient.instance;
  }

  public async connect() {
    if (!this.connected) {
      await this.client.connect();
      this.connected = true;
    }
    return this.client;
  }

  public async clearCache() {
    await this.connect();
    await this.client.flushDb();
  }

  public async disconnect() {
    if (this.connected) {
      await this.client.disconnect();
      this.connected = false;
    }
  }
}

/**
 * Generate a unique identifier for test data
 */
const generateUniqueId = (prefix: string = 'test'): string => {
  return `${prefix}_${Date.now()}_${Math.floor(Math.random() * 10000)}`;
};

/**
 * Wait for a specified amount of time
 */
const wait = (ms: number): Promise<void> => {
  return new Promise(resolve => setTimeout(resolve, ms));
};

// Export test utilities
export {
  DbTestClient,
  CacheTestClient,
  generateUniqueId,
  wait
};