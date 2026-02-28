/**
 * Database Error Handler
 *
 * Provides utilities for handling database errors in Lambda handlers.
 * Converts database-specific errors to appropriate HTTP responses.
 *
 * Validates: Requirements 4.5
 */
/**
 * Database error types
 */
export declare enum DatabaseErrorType {
    CONNECTION_ERROR = "CONNECTION_ERROR",
    QUERY_ERROR = "QUERY_ERROR",
    TIMEOUT_ERROR = "TIMEOUT_ERROR",
    CONSTRAINT_VIOLATION = "CONSTRAINT_VIOLATION",
    NOT_FOUND = "NOT_FOUND",
    UNKNOWN = "UNKNOWN"
}
/**
 * Structured database error
 */
export interface DatabaseError {
    readonly type: DatabaseErrorType;
    readonly message: string;
    readonly code?: string;
    readonly detail?: string;
    readonly constraint?: string;
    readonly table?: string;
    readonly column?: string;
    readonly originalError: Error;
}
/**
 * Parse a database error into a structured format
 */
export declare function parseDatabaseError(error: unknown): DatabaseError;
/**
 * Get HTTP status code for a database error
 */
export declare function getHttpStatusForDatabaseError(error: DatabaseError): number;
/**
 * Get user-friendly error message for a database error
 */
export declare function getUserFriendlyMessage(error: DatabaseError): string;
/**
 * Log database error with appropriate level and context
 */
export declare function logDatabaseError(error: DatabaseError, context?: Record<string, unknown>): void;
/**
 * Handle database error in Lambda handler
 * Returns appropriate HTTP response based on error type
 */
export declare function handleDatabaseError(error: unknown, requestId: string, context?: Record<string, unknown>): {
    statusCode: number;
    body: string;
    headers: Record<string, string>;
};
/**
 * Wrapper for database operations with error handling
 */
export declare function withDatabaseErrorHandling<T>(operation: () => Promise<T>, requestId: string, context?: Record<string, unknown>): Promise<T>;
//# sourceMappingURL=error-handler.d.ts.map