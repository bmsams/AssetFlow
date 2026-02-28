/**
 * Database transaction management
 */
import type { QueryResult, QueryResultRow } from 'pg';
/**
 * Transaction isolation levels
 */
export type IsolationLevel = 'READ UNCOMMITTED' | 'READ COMMITTED' | 'REPEATABLE READ' | 'SERIALIZABLE';
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
    query<T extends QueryResultRow = QueryResultRow>(text: string, values?: unknown[]): Promise<QueryResult<T>>;
    /**
     * Execute a query and return the first row
     */
    queryOne<T extends QueryResultRow = QueryResultRow>(text: string, values?: unknown[]): Promise<T | null>;
    /**
     * Execute a query and return all rows
     */
    queryMany<T extends QueryResultRow = QueryResultRow>(text: string, values?: unknown[]): Promise<T[]>;
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
 * Execute a function within a database transaction
 *
 * @param fn - Function to execute within the transaction
 * @param options - Transaction options
 * @returns The result of the function
 */
export declare function withTransaction<T>(fn: (ctx: TransactionContext) => Promise<T>, options?: TransactionOptions): Promise<T>;
/**
 * Execute a function within a read-only transaction
 */
export declare function withReadOnlyTransaction<T>(fn: (ctx: TransactionContext) => Promise<T>, isolationLevel?: IsolationLevel): Promise<T>;
/**
 * Execute a function within a serializable transaction
 */
export declare function withSerializableTransaction<T>(fn: (ctx: TransactionContext) => Promise<T>): Promise<T>;
/**
 * Retry a transaction on serialization failure
 */
export declare function withRetryableTransaction<T>(fn: (ctx: TransactionContext) => Promise<T>, options?: TransactionOptions, maxRetries?: number): Promise<T>;
//# sourceMappingURL=transaction.d.ts.map