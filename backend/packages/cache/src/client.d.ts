/**
 * Redis client management for Lambda functions
 */
import Redis from 'ioredis';
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
 * Initialize the Redis client
 */
export declare function initializeRedis(config?: Partial<RedisConfig>): Redis;
/**
 * Get the Redis client
 */
export declare function getRedisClient(): Redis;
/**
 * Close the Redis client
 */
export declare function closeRedis(): Promise<void>;
/**
 * Health check for Redis connection
 */
export declare function redisHealthCheck(): Promise<boolean>;
/**
 * Get Redis client status
 */
export declare function getRedisStatus(): 'connected' | 'connecting' | 'disconnected' | 'unknown';
//# sourceMappingURL=client.d.ts.map