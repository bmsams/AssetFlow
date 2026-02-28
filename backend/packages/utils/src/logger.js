"use strict";
/**
 * Structured logging utilities for Lambda functions
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.logger = exports.Logger = void 0;
exports.createLogger = createLogger;
/**
 * Log level priority for filtering
 */
const LOG_LEVEL_PRIORITY = {
    DEBUG: 0,
    INFO: 1,
    WARN: 2,
    ERROR: 3,
};
/**
 * Default log level based on environment
 */
function getDefaultLogLevel() {
    const env = process.env['NODE_ENV'] ?? 'development';
    return env === 'production' ? 'INFO' : 'DEBUG';
}
/**
 * Logger class for structured logging
 */
class Logger {
    config;
    constructor(config = {}) {
        this.config = {
            service: config.service ?? process.env['SERVICE_NAME'] ?? 'unknown',
            minLevel: config.minLevel ?? getDefaultLogLevel(),
            context: config.context,
        };
    }
    /**
     * Create a child logger with additional context
     */
    child(context) {
        return new Logger({
            ...this.config,
            context: { ...this.config.context, ...context },
        });
    }
    /**
     * Check if a log level should be logged
     */
    shouldLog(level) {
        return LOG_LEVEL_PRIORITY[level] >= LOG_LEVEL_PRIORITY[this.config.minLevel];
    }
    /**
     * Format and output a log entry
     */
    log(level, message, data, error) {
        if (!this.shouldLog(level)) {
            return;
        }
        const entry = {
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
    debug(message, data) {
        this.log('DEBUG', message, data);
    }
    /**
     * Log info message
     */
    info(message, data) {
        this.log('INFO', message, data);
    }
    /**
     * Log warning message
     */
    warn(message, data) {
        this.log('WARN', message, data);
    }
    /**
     * Log error message
     */
    error(message, error, data) {
        this.log('ERROR', message, data, error);
    }
    /**
     * Log with timing information
     */
    timed(operation, fn) {
        const start = Date.now();
        try {
            const result = fn();
            const duration = Date.now() - start;
            this.info(`${operation} completed`, { duration, durationMs: duration });
            return result;
        }
        catch (error) {
            const duration = Date.now() - start;
            this.error(`${operation} failed`, error, { duration, durationMs: duration });
            throw error;
        }
    }
    /**
     * Log with async timing information
     */
    async timedAsync(operation, fn) {
        const start = Date.now();
        try {
            const result = await fn();
            const duration = Date.now() - start;
            this.info(`${operation} completed`, { duration, durationMs: duration });
            return result;
        }
        catch (error) {
            const duration = Date.now() - start;
            this.error(`${operation} failed`, error, { duration, durationMs: duration });
            throw error;
        }
    }
}
exports.Logger = Logger;
/**
 * Create a logger instance
 */
function createLogger(config) {
    return new Logger(config);
}
/**
 * Default logger instance
 */
exports.logger = createLogger();
//# sourceMappingURL=logger.js.map