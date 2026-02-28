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
 * Structured log entry
 */
interface LogEntry {
  readonly timestamp: string;
  readonly level: LogLevel;
  readonly message: string;
  readonly context?: LogContext;
  readonly error?: {
    readonly name: string;
    readonly message: string;
    readonly stack?: string;
  };
  readonly data?: unknown;
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
 * Log level priority for filtering
 */
const LOG_LEVEL_PRIORITY: Record<LogLevel, number> = {
  DEBUG: 0,
  INFO: 1,
  WARN: 2,
  ERROR: 3,
};

/**
 * Default log level based on environment
 */
function getDefaultLogLevel(): LogLevel {
  const env = process.env['NODE_ENV'] ?? 'development';
  return env === 'production' ? 'INFO' : 'DEBUG';
}

/**
 * Logger class for structured logging
 */
export class Logger {
  private readonly config: LoggerConfig;

  constructor(config: Partial<LoggerConfig> = {}) {
    this.config = {
      service: config.service ?? process.env['SERVICE_NAME'] ?? 'unknown',
      minLevel: config.minLevel ?? getDefaultLogLevel(),
      context: config.context,
    };
  }

  /**
   * Create a child logger with additional context
   */
  child(context: LogContext): Logger {
    return new Logger({
      ...this.config,
      context: { ...this.config.context, ...context },
    });
  }

  /**
   * Check if a log level should be logged
   */
  private shouldLog(level: LogLevel): boolean {
    return LOG_LEVEL_PRIORITY[level] >= LOG_LEVEL_PRIORITY[this.config.minLevel];
  }

  /**
   * Format and output a log entry
   */
  private log(
    level: LogLevel,
    message: string,
    data?: unknown,
    error?: Error
  ): void {
    if (!this.shouldLog(level)) {
      return;
    }

    const entry: LogEntry = {
      timestamp: new Date().toISOString(),
      level,
      message,
      context: {
        service: this.config.service,
        ...this.config.context,
      },
      ...(data !== undefined && { data }),
      ...(error && {
        error: {
          name: error.name,
          message: error.message,
          stack: error.stack,
        },
      }),
    };

    // Output as JSON for CloudWatch Logs Insights
    const output = JSON.stringify(entry);

    switch (level) {
      case 'DEBUG':
      case 'INFO':
        // eslint-disable-next-line no-console
        console.info(output);
        break;
      case 'WARN':
        console.warn(output);
        break;
      case 'ERROR':
        console.error(output);
        break;
    }
  }

  /**
   * Log debug message
   */
  debug(message: string, data?: unknown): void {
    this.log('DEBUG', message, data);
  }

  /**
   * Log info message
   */
  info(message: string, data?: unknown): void {
    this.log('INFO', message, data);
  }

  /**
   * Log warning message
   */
  warn(message: string, data?: unknown): void {
    this.log('WARN', message, data);
  }

  /**
   * Log error message
   */
  error(message: string, error?: Error, data?: unknown): void {
    this.log('ERROR', message, data, error);
  }

  /**
   * Log with timing information
   */
  timed<T>(operation: string, fn: () => T): T {
    const start = Date.now();
    try {
      const result = fn();
      const duration = Date.now() - start;
      this.info(`${operation} completed`, { duration, durationMs: duration });
      return result;
    } catch (error) {
      const duration = Date.now() - start;
      this.error(`${operation} failed`, error as Error, { duration, durationMs: duration });
      throw error;
    }
  }

  /**
   * Log with async timing information
   */
  async timedAsync<T>(operation: string, fn: () => Promise<T>): Promise<T> {
    const start = Date.now();
    try {
      const result = await fn();
      const duration = Date.now() - start;
      this.info(`${operation} completed`, { duration, durationMs: duration });
      return result;
    } catch (error) {
      const duration = Date.now() - start;
      this.error(`${operation} failed`, error as Error, { duration, durationMs: duration });
      throw error;
    }
  }
}

/**
 * Create a logger instance
 */
export function createLogger(config?: Partial<LoggerConfig>): Logger {
  return new Logger(config);
}

/**
 * Default logger instance
 */
export const logger = createLogger();
