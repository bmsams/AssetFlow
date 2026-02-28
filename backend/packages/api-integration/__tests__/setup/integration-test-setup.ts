/**
 * Integration test setup
 * Provides common setup and teardown hooks for integration tests
 */
import { DbTestClient, CacheTestClient } from './test-helpers';

// Global setup - runs once before all tests
export const globalSetup = async (): Promise<void> => {
  // Ensure database connection
  try {
    const dbClient = DbTestClient.getInstance();
    await dbClient.query('SELECT 1');
    console.info('✓ Connected to test database');
  } catch (error) {
    console.error('Failed to connect to test database:', error);
    throw error;
  }
  
  // Ensure Redis connection
  try {
    const cacheClient = CacheTestClient.getInstance();
    await cacheClient.connect();
    console.info('✓ Connected to test Redis instance');
  } catch (error) {
    console.error('Failed to connect to Redis:', error);
    throw error;
  }
};

// Global teardown - runs once after all tests
export const globalTeardown = async (): Promise<void> => {
  try {
    const dbClient = DbTestClient.getInstance();
    await dbClient.close();
    console.info('✓ Closed database connection');
  } catch (error) {
    console.error('Error closing database connection:', error);
  }
  
  try {
    const cacheClient = CacheTestClient.getInstance();
    await cacheClient.disconnect();
    console.info('✓ Disconnected from Redis');
  } catch (error) {
    console.error('Error disconnecting from Redis:', error);
  }
};

// Setup - runs before each test suite
export const setup = async (): Promise<void> => {
  const dbClient = DbTestClient.getInstance();
  const cacheClient = CacheTestClient.getInstance();
  
  // Clean database and cache before tests
  try {
    await dbClient.cleanDb();
    await cacheClient.clearCache();
  } catch (error) {
    console.error('Error in test setup:', error);
    throw error;
  }
};

// Teardown - runs after each test suite
export const teardown = async (): Promise<void> => {
  // Additional cleanup if needed
};