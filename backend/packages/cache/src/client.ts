/**
 * Redis client management for Lambda functions
 */

import Redis from 'ioredis';

import { createLogger } from '@ams/utils';

const logger = createLogger({ service: 'cache-client' });

/**
 * Redis configuration
 */
export interface RedisConfig {
  readonly host: string;
  readonly port: number;
  readonly password?: string;
  readonly tls?: boolean;
  readonly db?: number;
  readonly keyPrefix?: string;
  readonly connectTimeout?: number;
  readonly commandTimeout?: number;
  readonly maxRetriesPerRequest?: number;
}

/**
 * Global Redis client (reused across Lambda invocations)
 */
let redisClient: Redis | null = null;

/**
 * Get Redis configuration from environment
 */
function getConfigFromEnvironment(): RedisConfig {
  const host = process.env['REDIS_HOST'];
  const port = process.env['REDIS_PORT'];

  if (!host) {
    throw new Error('REDIS_HOST environment variable is required');
  }

  return {
    host,
    port: port ? parseInt(port, 10) : 6379,
    password: process.env['REDIS_PASSWORD'],
    tls: process.env['REDIS_TLS'] !== 'false',
    db: process.env['REDIS_DB'] ? parseInt(process.env['REDIS_DB'], 10) : 0,
    keyPrefix: process.env['REDIS_KEY_PREFIX'] ?? 'ams:',
    connectTimeout: 10000,
    commandTimeout: 5000,
    maxRetriesPerRequest: 3,
  };
}

/**
 * Initialize the Redis client
 */
export function initializeRedis(config?: Partial<RedisConfig>): Redis {
  if (redisClient) {
    logger.debug('Reusing existing Redis client');
    return redisClient;
  }

  logger.info('Initializing Redis client');

  const envConfig = getConfigFromEnvironment();
  const fullConfig: RedisConfig = { ...envConfig, ...config };

  redisClient = new Redis({
    host: fullConfig.host,
    port: fullConfig.port,
    password: fullConfig.password,
    db: fullConfig.db,
    keyPrefix: fullConfig.keyPrefix,
    connectTimeout: fullConfig.connectTimeout,
    commandTimeout: fullConfig.commandTimeout,
    maxRetriesPerRequest: fullConfig.maxRetriesPerRequest,
    tls: fullConfig.tls ? {} : undefined,
    lazyConnect: true,
    enableReadyCheck: true,
    retryStrategy: (times: number) => {
      if (times > 3) {
        logger.error('Redis connection failed after 3 retries');
        return null; // Stop retrying
      }
      const delay = Math.min(times * 200, 2000);
      logger.warn(`Redis connection retry ${times}, waiting ${delay}ms`);
      return delay;
    },
  });

  // Set up event handlers
  redisClient.on('connect', () => {
    logger.info('Redis client connected');
  });

  redisClient.on('ready', () => {
    logger.info('Redis client ready');
  });

  redisClient.on('error', (err) => {
    logger.error('Redis client error', err);
  });

  redisClient.on('close', () => {
    logger.info('Redis client connection closed');
  });

  redisClient.on('reconnecting', () => {
    logger.warn('Redis client reconnecting');
  });

  return redisClient;
}

/**
 * Get the Redis client
 */
export function getRedisClient(): Redis {
  if (!redisClient) {
    return initializeRedis();
  }
  return redisClient;
}

/**
 * Close the Redis client
 */
export async function closeRedis(): Promise<void> {
  if (redisClient) {
    logger.info('Closing Redis client');
    await redisClient.quit();
    redisClient = null;
    logger.info('Redis client closed');
  }
}

/**
 * Health check for Redis connection
 */
export async function redisHealthCheck(): Promise<boolean> {
  try {
    const client = getRedisClient();
    const result = await client.ping();
    return result === 'PONG';
  } catch (error) {
    logger.error('Redis health check failed', error as Error);
    return false;
  }
}

/**
 * Get Redis client status
 */
export function getRedisStatus(): 'connected' | 'connecting' | 'disconnected' | 'unknown' {
  if (!redisClient) {
    return 'disconnected';
  }

  switch (redisClient.status) {
    case 'ready':
    case 'connect':
      return 'connected';
    case 'connecting':
    case 'reconnecting':
      return 'connecting';
    case 'close':
    case 'end':
      return 'disconnected';
    default:
      return 'unknown';
  }
}
