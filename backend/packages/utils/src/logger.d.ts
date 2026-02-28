/**
 * Structured logging utilities for Lambda functions
 */
/**
 * Log levels
 */
export type LogLevel = 'DEBUG' | 'INFO' | 'WARN' | 'ERROR';
/**
 * Log context for structured logging
 */
export interface LogContext {
    readonly requestId?: string;
    readonly userId?: string;
    readonly service?: string;
    readonly operation?: string;
    readonly [key: string]: unknown;
}
/**
 * Logger configuration
 */
interface LoggerConfig {
    readonly service: string;
    readonly minLevel: LogLevel;
    readonly context?: LogContext;
}
/**
 * Logger class for structured logging
 */
export declare class Logger {
    private readonly config;
    constructor(config?: Partial<LoggerConfig>);
    /**
     * Create a child logger with additional context
     */
    child(context: LogContext): Logger;
    /**
     * Check if a log level should be logged
     */
    private shouldLog;
    /**
     * Format and output a log entry
     */
    private log;
    /**
     * Log debug message
     */
    debug(message: string, data?: unknown): void;
    /**
     * Log info message
     */
    info(message: string, data?: unknown): void;
    /**
     * Log warning message
     */
    warn(message: string, data?: unknown): void;
    /**
     * Log error message
     */
    error(message: string, error?: Error, data?: unknown): void;
    /**
     * Log with timing information
     */
    timed<T>(operation: string, fn: () => T): T;
    /**
     * Log with async timing information
     */
    timedAsync<T>(operation: string, fn: () => Promise<T>): Promise<T>;
}
/**
 * Create a logger instance
 */
export declare function createLogger(config?: Partial<LoggerConfig>): Logger;
/**
 * Default logger instance
 */
export declare const logger: Logger;
export {};
