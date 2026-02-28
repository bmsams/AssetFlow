/**
 * Database transaction management
 */

import type { PoolClient, QueryResult, QueryResultRow } from 'pg';

import { createLogger } from '@ams/utils';

import { getClient } from './pool';

const logger = createLogger({ service: 'database-transaction' });

/**
 * Transaction isolation levels
 */
export type IsolationLevel =
  | 'READ UNCOMMITTED'
  | 'READ COMMITTED'
  | 'REPEATABLE READ'
  | 'SERIALIZABLE';

/**
 * Transaction options
 */
export interface TransactionOptions {
  readonly isolationLevel?: IsolationLevel;
  readonly readOnly?: boolean;
  readonly deferrable?: boolean;
}

/**
 * Transaction context for executing queries within a transaction
 */
export interface TransactionContext {
  /**
   * Execute a query within the transaction
   */
  query<T extends QueryResultRow = QueryResultRow>(
    text: string,
    values?: unknown[]
  ): Promise<QueryResult<T>>;

  /**
   * Execute a query and return the first row
   */
  queryOne<T extends QueryResultRow = QueryResultRow>(
    text: string,
    values?: unknown[]
  ): Promise<T | null>;

  /**
   * Execute a query and return all rows
   */
  queryMany<T extends QueryResultRow = QueryResultRow>(
    text: string,
    values?: unknown[]
  ): Promise<T[]>;

  /**
   * Create a savepoint
   */
  savepoint(name: string): Promise<void>;

  /**
   * Rollback to a savepoint
   */
  rollbackToSavepoint(name: string): Promise<void>;

  /**
   * Release a savepoint
   */
  releaseSavepoint(name: string): Promise<void>;
}

/**
 * Create a transaction context from a client
 */
function createTransactionContext(client: PoolClient): TransactionContext {
  return {
    async query<T extends QueryResultRow = QueryResultRow>(
      text: string,
      values?: unknown[]
    ): Promise<QueryResult<T>> {
      return client.query<T>(text, values);
    },

    async queryOne<T extends QueryResultRow = QueryResultRow>(
      text: string,
      values?: unknown[]
    ): Promise<T | null> {
      const result = await client.query<T>(text, values);
      return result.rows[0] ?? null;
    },

    async queryMany<T extends QueryResultRow = QueryResultRow>(
      text: string,
      values?: unknown[]
    ): Promise<T[]> {
      const result = await client.query<T>(text, values);
      return result.rows;
    },

    async savepoint(name: string): Promise<void> {
      await client.query(`SAVEPOINT ${name}`);
    },

    async rollbackToSavepoint(name: string): Promise<void> {
      await client.query(`ROLLBACK TO SAVEPOINT ${name}`);
    },

    async releaseSavepoint(name: string): Promise<void> {
      await client.query(`RELEASE SAVEPOINT ${name}`);
    },
  };
}

/**
 * Build BEGIN statement with options
 */
function buildBeginStatement(options: TransactionOptions): string {
  const parts = ['BEGIN'];

  if (options.isolationLevel) {
    parts.push(`ISOLATION LEVEL ${options.isolationLevel}`);
  }

  if (options.readOnly) {
    parts.push('READ ONLY');
  } else {
    parts.push('READ WRITE');
  }

  if (options.deferrable && options.isolationLevel === 'SERIALIZABLE' && options.readOnly) {
    parts.push('DEFERRABLE');
  }

  return parts.join(' ');
}

/**
 * Execute a function within a database transaction
 *
 * @param fn - Function to execute within the transaction
 * @param options - Transaction options
 * @returns The result of the function
 */
export async function withTransaction<T>(
  fn: (ctx: TransactionContext) => Promise<T>,
  options: TransactionOptions = {}
): Promise<T> {
  const client = await getClient();
  const ctx = createTransactionContext(client);
  const beginStatement = buildBeginStatement(options);

  try {
    logger.debug('Starting transaction', { isolationLevel: options.isolationLevel });
    await client.query(beginStatement);

    const result = await fn(ctx);

    await client.query('COMMIT');
    logger.debug('Transaction committed');

    return result;
  } catch (error) {
    logger.error('Transaction failed, rolling back', error as Error);
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
}

/**
 * Execute a function within a read-only transaction
 */
export async function withReadOnlyTransaction<T>(
  fn: (ctx: TransactionContext) => Promise<T>,
  isolationLevel: IsolationLevel = 'READ COMMITTED'
): Promise<T> {
  return withTransaction(fn, { isolationLevel, readOnly: true });
}

/**
 * Execute a function within a serializable transaction
 */
export async function withSerializableTransaction<T>(
  fn: (ctx: TransactionContext) => Promise<T>
): Promise<T> {
  return withTransaction(fn, { isolationLevel: 'SERIALIZABLE' });
}

/**
 * Retry a transaction on serialization failure
 */
export async function withRetryableTransaction<T>(
  fn: (ctx: TransactionContext) => Promise<T>,
  options: TransactionOptions = {},
  maxRetries = 3
): Promise<T> {
  let lastError: Error | undefined;

  for (let attempt = 0; attempt < maxRetries; attempt++) {
    try {
      return await withTransaction(fn, options);
    } catch (error) {
      lastError = error as Error;

      // Check if it's a serialization failure (PostgreSQL error code 40001)
      const pgError = error as Error & { code?: string };
      if (pgError.code === '40001') {
        logger.warn(`Serialization failure, retrying (attempt ${attempt + 1}/${maxRetries})`);
        continue;
      }

      // Check if it's a deadlock (PostgreSQL error code 40P01)
      if (pgError.code === '40P01') {
        logger.warn(`Deadlock detected, retrying (attempt ${attempt + 1}/${maxRetries})`);
        continue;
      }

      // Non-retryable error
      throw error;
    }
  }

  logger.error('Transaction failed after max retries', lastError);
  throw lastError ?? new Error('Transaction failed');
}
