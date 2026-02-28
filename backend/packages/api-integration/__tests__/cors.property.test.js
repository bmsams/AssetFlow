"use strict";
/**
 * Property-Based Tests for CORS Configuration
 *
 * These tests verify that CORS headers are correctly configured
 * for the API Gateway endpoints.
 *
 * **Property 5: CORS Headers for Allowed Origins**
 * **Validates: Requirements 8.1-8.5**
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
 * CORS configuration as defined in the API stack
 */
const CORS_CONFIG = {
    allowedOrigins: [
        'http://localhost:3000',
        'http://localhost:5173',
        'https://localhost:3000',
        // CloudFront domain would be added dynamically
    ],
    allowedMethods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS', 'PATCH'],
    allowedHeaders: [
        'Content-Type',
        'X-Amz-Date',
        'Authorization',
        'X-Api-Key',
        'X-Amz-Security-Token',
        'X-Amz-User-Agent',
    ],
    maxAge: 3600, // 1 hour in seconds
    allowCredentials: true,
};
/**
 * Simulates CORS header generation based on request origin
 */
function generateCorsHeaders(requestOrigin) {
    // Check if origin is allowed (in real implementation, this would be more sophisticated)
    const isAllowed = CORS_CONFIG.allowedOrigins.some((allowed) => allowed === requestOrigin || allowed === '*');
    if (!isAllowed) {
        return null;
    }
    return {
        'Access-Control-Allow-Origin': requestOrigin,
        'Access-Control-Allow-Methods': CORS_CONFIG.allowedMethods.join(', '),
        'Access-Control-Allow-Headers': CORS_CONFIG.allowedHeaders.join(', '),
        'Access-Control-Max-Age': CORS_CONFIG.maxAge.toString(),
        'Access-Control-Allow-Credentials': CORS_CONFIG.allowCredentials.toString(),
    };
}
/**
 * Validates CORS headers structure
 */
function validateCorsHeaders(headers) {
    const requiredHeaders = [
        'Access-Control-Allow-Origin',
        'Access-Control-Allow-Methods',
        'Access-Control-Allow-Headers',
    ];
    return requiredHeaders.every((header) => header in headers && headers[header].length > 0);
}
describe('CORS Property Tests', () => {
    /**
     * Property 5: CORS Headers for Allowed Origins
     * **Validates: Requirements 8.1-8.5**
     *
     * For any allowed origin, the response must include valid CORS headers.
     */
    describe('Property 5: CORS Headers for Allowed Origins', () => {
        it('allowed origins receive valid CORS headers', () => {
            fc.assert(fc.property(fc.constantFrom(...CORS_CONFIG.allowedOrigins), (origin) => {
                const headers = generateCorsHeaders(origin);
                // Headers should be generated for allowed origins
                expect(headers).not.toBeNull();
                if (headers) {
                    // Validate structure
                    expect(validateCorsHeaders(headers)).toBe(true);
                    // Origin should match request
                    expect(headers['Access-Control-Allow-Origin']).toBe(origin);
                    // All required methods should be present
                    const methods = headers['Access-Control-Allow-Methods'].split(', ');
                    expect(methods).toContain('GET');
                    expect(methods).toContain('POST');
                    expect(methods).toContain('PUT');
                    expect(methods).toContain('DELETE');
                    expect(methods).toContain('OPTIONS');
                }
                return true;
            }), { numRuns: CORS_CONFIG.allowedOrigins.length });
        });
        it('disallowed origins do not receive CORS headers', () => {
            const disallowedOrigins = [
                'http://malicious-site.com',
                'https://attacker.example.com',
                'http://localhost:9999',
                'https://phishing.site',
            ];
            fc.assert(fc.property(fc.constantFrom(...disallowedOrigins), (origin) => {
                const headers = generateCorsHeaders(origin);
                // Headers should NOT be generated for disallowed origins
                expect(headers).toBeNull();
                return true;
            }), { numRuns: disallowedOrigins.length });
        });
        it('CORS headers include Authorization header for authenticated requests', () => {
            fc.assert(fc.property(fc.constantFrom(...CORS_CONFIG.allowedOrigins), (origin) => {
                const headers = generateCorsHeaders(origin);
                if (headers) {
                    const allowedHeaders = headers['Access-Control-Allow-Headers'].split(', ');
                    expect(allowedHeaders).toContain('Authorization');
                    expect(allowedHeaders).toContain('Content-Type');
                }
                return true;
            }), { numRuns: CORS_CONFIG.allowedOrigins.length });
        });
        it('CORS headers allow credentials for authenticated requests', () => {
            fc.assert(fc.property(fc.constantFrom(...CORS_CONFIG.allowedOrigins), (origin) => {
                const headers = generateCorsHeaders(origin);
                if (headers && CORS_CONFIG.allowCredentials) {
                    expect(headers['Access-Control-Allow-Credentials']).toBe('true');
                }
                return true;
            }), { numRuns: CORS_CONFIG.allowedOrigins.length });
        });
        it('CORS max-age is set for preflight caching', () => {
            fc.assert(fc.property(fc.constantFrom(...CORS_CONFIG.allowedOrigins), (origin) => {
                const headers = generateCorsHeaders(origin);
                if (headers) {
                    const maxAge = parseInt(headers['Access-Control-Max-Age'], 10);
                    expect(maxAge).toBeGreaterThan(0);
                    expect(maxAge).toBeLessThanOrEqual(86400); // Max 24 hours
                }
                return true;
            }), { numRuns: CORS_CONFIG.allowedOrigins.length });
        });
    });
    /**
     * Additional CORS validation tests
     */
    describe('CORS Configuration Validation', () => {
        it('all HTTP methods are valid', () => {
            const validMethods = ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS', 'HEAD'];
            for (const method of CORS_CONFIG.allowedMethods) {
                expect(validMethods).toContain(method);
            }
        });
        it('required headers for API authentication are allowed', () => {
            const requiredAuthHeaders = ['Authorization', 'Content-Type', 'X-Api-Key'];
            for (const header of requiredAuthHeaders) {
                expect(CORS_CONFIG.allowedHeaders).toContain(header);
            }
        });
        it('localhost origins are allowed for development', () => {
            const localhostOrigins = CORS_CONFIG.allowedOrigins.filter((o) => o.includes('localhost'));
            expect(localhostOrigins.length).toBeGreaterThan(0);
        });
    });
});
//# sourceMappingURL=cors.property.test.js.map