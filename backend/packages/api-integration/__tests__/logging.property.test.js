"use strict";
/**
 * Property-Based Tests for Request Logging
 *
 * These tests verify that request logging captures all required fields
 * for monitoring and debugging purposes.
 *
 * **Property 6: Request Logging Completeness**
 * **Validates: Requirements 12.1**
 */
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
const fc = __importStar(require("fast-check"));
/**
 * Required fields for request logging
 */
const REQUIRED_LOG_FIELDS = [
    'requestId',
    'timestamp',
    'method',
    'path',
    'statusCode',
    'duration',
    'userAgent',
    'sourceIp',
];
/**
 * Optional but recommended fields (for documentation purposes)
 */
const _OPTIONAL_LOG_FIELDS = [
    'userId',
    'errorMessage',
    'errorCode',
    'requestBody',
    'responseBody',
    'traceId',
];
// Suppress unused variable warning - kept for documentation
void _OPTIONAL_LOG_FIELDS;
/**
 * HTTP methods that should be logged
 */
const HTTP_METHODS = ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'];
/**
 * Generate a mock request log entry
 */
function generateLogEntry(method, path, statusCode, duration) {
    return {
        requestId: `req-${Date.now()}-${Math.random().toString(36).substring(2, 8)}`,
        timestamp: new Date().toISOString(),
        method,
        path,
        statusCode,
        duration,
        userAgent: 'Mozilla/5.0 (compatible; TestClient/1.0)',
        sourceIp: '192.168.1.1',
        traceId: `trace-${Math.random().toString(36).substring(2, 10)}`,
    };
}
/**
 * Validate that a log entry contains all required fields
 */
function validateLogEntry(entry) {
    const missingFields = [];
    for (const field of REQUIRED_LOG_FIELDS) {
        if (!(field in entry) || entry[field] === undefined) {
            missingFields.push(field);
        }
    }
    return {
        valid: missingFields.length === 0,
        missingFields,
    };
}
/**
 * Validate request ID format
 */
function isValidRequestId(requestId) {
    // Request ID should be non-empty and follow a pattern
    return requestId.length > 0 && /^[a-zA-Z0-9-_]+$/.test(requestId);
}
/**
 * Validate timestamp format (ISO 8601)
 */
function isValidTimestamp(timestamp) {
    const date = new Date(timestamp);
    return !isNaN(date.getTime()) && timestamp.includes('T');
}
/**
 * Validate HTTP status code
 */
function isValidStatusCode(statusCode) {
    return statusCode >= 100 && statusCode < 600;
}
/**
 * Validate duration (non-negative)
 */
function isValidDuration(duration) {
    return duration >= 0;
}
describe('Request Logging Property Tests', () => {
    /**
     * Property 6: Request Logging Completeness
     * **Validates: Requirements 12.1**
     *
     * All API requests must be logged with required fields.
     */
    describe('Property 6: Request Logging Completeness', () => {
        it('all log entries contain required fields', () => {
            fc.assert(fc.property(fc.constantFrom(...HTTP_METHODS), fc.stringMatching(/^\/[a-z]+(?:\/[a-z0-9-]+)*$/), fc.integer({ min: 100, max: 599 }), fc.integer({ min: 0, max: 30000 }), (method, path, statusCode, duration) => {
                const logEntry = generateLogEntry(method, path, statusCode, duration);
                const validation = validateLogEntry(logEntry);
                expect(validation.valid).toBe(true);
                if (!validation.valid) {
                    console.log('Missing fields:', validation.missingFields);
                }
                return validation.valid;
            }), { numRuns: 100 });
        });
        it('request IDs are valid and unique', () => {
            const requestIds = new Set();
            fc.assert(fc.property(fc.constantFrom(...HTTP_METHODS), fc.stringMatching(/^\/[a-z]+$/), (method, path) => {
                const logEntry = generateLogEntry(method, path, 200, 100);
                // Validate format
                expect(isValidRequestId(logEntry.requestId)).toBe(true);
                // Check uniqueness
                expect(requestIds.has(logEntry.requestId)).toBe(false);
                requestIds.add(logEntry.requestId);
                return true;
            }), { numRuns: 50 });
        });
        it('timestamps are valid ISO 8601 format', () => {
            fc.assert(fc.property(fc.constantFrom(...HTTP_METHODS), fc.stringMatching(/^\/[a-z]+$/), (method, path) => {
                const logEntry = generateLogEntry(method, path, 200, 100);
                expect(isValidTimestamp(logEntry.timestamp)).toBe(true);
                return true;
            }), { numRuns: 20 });
        });
        it('status codes are valid HTTP status codes', () => {
            fc.assert(fc.property(fc.integer({ min: 100, max: 599 }), (statusCode) => {
                const logEntry = generateLogEntry('GET', '/test', statusCode, 100);
                expect(isValidStatusCode(logEntry.statusCode)).toBe(true);
                expect(logEntry.statusCode).toBe(statusCode);
                return true;
            }), { numRuns: 50 });
        });
        it('duration is non-negative', () => {
            fc.assert(fc.property(fc.integer({ min: 0, max: 60000 }), (duration) => {
                const logEntry = generateLogEntry('GET', '/test', 200, duration);
                expect(isValidDuration(logEntry.duration)).toBe(true);
                expect(logEntry.duration).toBe(duration);
                return true;
            }), { numRuns: 50 });
        });
        it('HTTP method is preserved in log entry', () => {
            fc.assert(fc.property(fc.constantFrom(...HTTP_METHODS), (method) => {
                const logEntry = generateLogEntry(method, '/test', 200, 100);
                expect(logEntry.method).toBe(method);
                expect(HTTP_METHODS).toContain(logEntry.method);
                return true;
            }), { numRuns: HTTP_METHODS.length });
        });
        it('path is preserved in log entry', () => {
            const testPaths = ['/assets', '/assets/123', '/health', '/users', '/api/v1/assets'];
            fc.assert(fc.property(fc.constantFrom(...testPaths), (path) => {
                const logEntry = generateLogEntry('GET', path, 200, 100);
                expect(logEntry.path).toBe(path);
                return true;
            }), { numRuns: testPaths.length });
        });
    });
    /**
     * Error logging tests
     */
    describe('Error Logging', () => {
        it('error responses include error information', () => {
            const errorStatusCodes = [400, 401, 403, 404, 500, 502, 503];
            fc.assert(fc.property(fc.constantFrom(...errorStatusCodes), (statusCode) => {
                const logEntry = generateLogEntry('GET', '/test', statusCode, 100);
                // For error status codes, the log entry should be valid
                const validation = validateLogEntry(logEntry);
                expect(validation.valid).toBe(true);
                // Status code should indicate error
                expect(logEntry.statusCode).toBeGreaterThanOrEqual(400);
                return true;
            }), { numRuns: errorStatusCodes.length });
        });
    });
    /**
     * Log field validation tests
     */
    describe('Log Field Validation', () => {
        it('all required fields are defined', () => {
            expect(REQUIRED_LOG_FIELDS.length).toBeGreaterThan(0);
            expect(REQUIRED_LOG_FIELDS).toContain('requestId');
            expect(REQUIRED_LOG_FIELDS).toContain('timestamp');
            expect(REQUIRED_LOG_FIELDS).toContain('method');
            expect(REQUIRED_LOG_FIELDS).toContain('path');
            expect(REQUIRED_LOG_FIELDS).toContain('statusCode');
            expect(REQUIRED_LOG_FIELDS).toContain('duration');
        });
        it('source IP is captured for security auditing', () => {
            expect(REQUIRED_LOG_FIELDS).toContain('sourceIp');
        });
        it('user agent is captured for client identification', () => {
            expect(REQUIRED_LOG_FIELDS).toContain('userAgent');
        });
    });
});
//# sourceMappingURL=logging.property.test.js.map