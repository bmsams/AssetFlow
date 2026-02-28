/**
 * Database Error Handler
 *
 * Provides utilities for handling database errors in Lambda handlers.
 * Converts database-specific errors to appropriate HTTP responses.
 *
 * Validates: Requirements 4.5
 */

import { createLogger } from '@ams/utils';

const logger = createLogger({ service: 'database-error-handler' });

/**
 * Database error types
 */
export enum DatabaseErrorType {
  CONNECTION_ERROR = 'CONNECTION_ERROR',
  QUERY_ERROR = 'QUERY_ERROR',
  TIMEOUT_ERROR = 'TIMEOUT_ERROR',
  CONSTRAINT_VIOLATION = 'CONSTRAINT_VIOLATION',
  NOT_FOUND = 'NOT_FOUND',
  UNKNOWN = 'UNKNOWN',
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
 * PostgreSQL error codes
 * @see https://www.postgresql.org/docs/current/errcodes-appendix.html
 */
const PG_ERROR_CODES = {
  // Connection errors
  CONNECTION_EXCEPTION: '08000',
  CONNECTION_DOES_NOT_EXIST: '08003',
  CONNECTION_FAILURE: '08006',
  SQLCLIENT_UNABLE_TO_ESTABLISH_SQLCONNECTION: '08001',
  SQLSERVER_REJECTED_ESTABLISHMENT_OF_SQLCONNECTION: '08004',
  // Integrity constraint violations
  INTEGRITY_CONSTRAINT_VIOLATION: '23000',
  RESTRICT_VIOLATION: '23001',
  NOT_NULL_VIOLATION: '23502',
  FOREIGN_KEY_VIOLATION: '23503',
  UNIQUE_VIOLATION: '23505',
  CHECK_VIOLATION: '23514',
  EXCLUSION_VIOLATION: '23P01',
  // Query errors
  SYNTAX_ERROR: '42601',
  UNDEFINED_TABLE: '42P01',
  UNDEFINED_COLUMN: '42703',
  // Timeout errors
  QUERY_CANCELED: '57014',
  STATEMENT_TIMEOUT: '57014',
} as const;

/**
 * Check if error is a PostgreSQL error
 */
function isPgError(error: unknown): error is Error & { code?: string; detail?: string; constraint?: string; table?: string; column?: string } {
  return error instanceof Error && 'code' in error;
}

/**
 * Check if error is a connection error
 */
function isConnectionError(error: unknown): boolean {
  if (!isPgError(error)) return false;
  
  const code = error.code ?? '';
  
  // Check PostgreSQL connection error codes
  if (code.startsWith('08')) return true;
  
  // Check Node.js network errors
  const networkErrors = ['ECONNREFUSED', 'ENOTFOUND', 'ETIMEDOUT', 'ECONNRESET', 'EPIPE'];
  if (networkErrors.includes(code)) return true;
  
  // Check error message for connection-related keywords
  const message = error.message.toLowerCase();
  return message.includes('connection') || 
         message.includes('connect') || 
         message.includes('network') ||
         message.includes('timeout');
}

/**
 * Check if error is a timeout error
 */
function isTimeoutError(error: unknown): boolean {
  if (!isPgError(error)) return false;
  
  const code = error.code ?? '';
  if (code === PG_ERROR_CODES.QUERY_CANCELED) return true;
  
  const message = error.message.toLowerCase();
  return message.includes('timeout') || 
         message.includes('canceling statement due to statement timeout');
}

/**
 * Check if error is a constraint violation
 */
function isConstraintViolation(error: unknown): boolean {
  if (!isPgError(error)) return false;
  
  const code = error.code ?? '';
  return code.startsWith('23');
}

/**
 * Parse a database error into a structured format
 */
export function parseDatabaseError(error: unknown): DatabaseError {
  const originalError = error instanceof Error ? error : new Error(String(error));
  
  if (isConnectionError(error)) {
    return {
      type: DatabaseErrorType.CONNECTION_ERROR,
      message: 'Database connection failed',
      code: isPgError(error) ? error.code : undefined,
      originalError,
    };
  }
  
  if (isTimeoutError(error)) {
    return {
      type: DatabaseErrorType.TIMEOUT_ERROR,
      message: 'Database query timed out',
      code: isPgError(error) ? error.code : undefined,
      originalError,
    };
  }
  
  if (isConstraintViolation(error) && isPgError(error)) {
    const code = error.code ?? '';
    let message = 'Database constraint violation';
    
    switch (code) {
      case PG_ERROR_CODES.UNIQUE_VIOLATION:
        message = 'Duplicate value violates unique constraint';
        break;
      case PG_ERROR_CODES.FOREIGN_KEY_VIOLATION:
        message = 'Foreign key constraint violation';
        break;
      case PG_ERROR_CODES.NOT_NULL_VIOLATION:
        message = 'Required field cannot be null';
        break;
      case PG_ERROR_CODES.CHECK_VIOLATION:
        message = 'Value violates check constraint';
        break;
    }
    
    return {
      type: DatabaseErrorType.CONSTRAINT_VIOLATION,
      message,
      code,
      detail: error.detail,
      constraint: error.constraint,
      table: error.table,
      column: error.column,
      originalError,
    };
  }
  
  if (isPgError(error)) {
    return {
      type: DatabaseErrorType.QUERY_ERROR,
      message: 'Database query failed',
      code: error.code,
      detail: error.detail,
      originalError,
    };
  }
  
  return {
    type: DatabaseErrorType.UNKNOWN,
    message: originalError.message,
    originalError,
  };
}

/**
 * Get HTTP status code for a database error
 */
export function getHttpStatusForDatabaseError(error: DatabaseError): number {
  switch (error.type) {
    case DatabaseErrorType.CONNECTION_ERROR:
    case DatabaseErrorType.TIMEOUT_ERROR:
      return 503; // Service Unavailable
    case DatabaseErrorType.CONSTRAINT_VIOLATION:
      return 409; // Conflict
    case DatabaseErrorType.NOT_FOUND:
      return 404; // Not Found
    case DatabaseErrorType.QUERY_ERROR:
    case DatabaseErrorType.UNKNOWN:
    default:
      return 500; // Internal Server Error
  }
}

/**
 * Get user-friendly error message for a database error
 */
export function getUserFriendlyMessage(error: DatabaseError): string {
  switch (error.type) {
    case DatabaseErrorType.CONNECTION_ERROR:
      return 'Unable to connect to the database. Please try again later.';
    case DatabaseErrorType.TIMEOUT_ERROR:
      return 'The request took too long to process. Please try again.';
    case DatabaseErrorType.CONSTRAINT_VIOLATION:
      if (error.constraint?.includes('unique')) {
        return 'A record with this value already exists.';
      }
      if (error.constraint?.includes('fk') || error.code === PG_ERROR_CODES.FOREIGN_KEY_VIOLATION) {
        return 'Referenced record does not exist.';
      }
      return 'The data violates database constraints.';
    case DatabaseErrorType.NOT_FOUND:
      return 'The requested resource was not found.';
    default:
      return 'An unexpected database error occurred.';
  }
}

/**
 * Log database error with appropriate level and context
 */
export function logDatabaseError(
  error: DatabaseError,
  context: Record<string, unknown> = {}
): void {
  const logContext = {
    errorType: error.type,
    errorCode: error.code,
    constraint: error.constraint,
    table: error.table,
    column: error.column,
    ...context,
  };
  
  switch (error.type) {
    case DatabaseErrorType.CONNECTION_ERROR:
      logger.error('Database connection error', error.originalError, logContext);
      break;
    case DatabaseErrorType.TIMEOUT_ERROR:
      logger.warn('Database query timeout', logContext);
      break;
    case DatabaseErrorType.CONSTRAINT_VIOLATION:
      logger.warn('Database constraint violation', logContext);
      break;
    default:
      logger.error('Database error', error.originalError, logContext);
  }
}

/**
 * Handle database error in Lambda handler
 * Returns appropriate HTTP response based on error type
 */
export function handleDatabaseError(
  error: unknown,
  requestId: string,
  context: Record<string, unknown> = {}
): {
  statusCode: number;
  body: string;
  headers: Record<string, string>;
} {
  const dbError = parseDatabaseError(error);
  const statusCode = getHttpStatusForDatabaseError(dbError);
  const message = getUserFriendlyMessage(dbError);
  
  logDatabaseError(dbError, { requestId, ...context });
  
  const errorCode = statusCode === 503 ? 'SERVICE_UNAVAILABLE' : 
                    statusCode === 409 ? 'CONFLICT' :
                    statusCode === 404 ? 'NOT_FOUND' : 'INTERNAL_ERROR';
  
  return {
    statusCode,
    body: JSON.stringify({
      success: false,
      error: {
        code: errorCode,
        message,
      },
      requestId,
    }),
    headers: {
      'Content-Type': 'application/json',
    },
  };
}

/**
 * Wrapper for database operations with error handling
 */
export async function withDatabaseErrorHandling<T>(
  operation: () => Promise<T>,
  requestId: string,
  context: Record<string, unknown> = {}
): Promise<T> {
  try {
    return await operation();
  } catch (error) {
    const dbError = parseDatabaseError(error);
    logDatabaseError(dbError, { requestId, ...context });
    throw error;
  }
}
