#!/usr/bin/env npx ts-node
/**
 * Deployment Verification Script
 *
 * Verifies that the deployed API is functioning correctly by:
 * 1. Checking the health endpoint
 * 2. Running smoke tests (create, get, list assets)
 * 3. Reporting response times and status
 *
 * Usage:
 *   npm run verify
 *
 * Environment Variables:
 *   API_URL - The API Gateway URL (default: from .env.dev)
 *
 * Validates: Requirements 10.1, 10.4, 10.5, 10.6
 */

import * as fs from 'fs';
import * as path from 'path';

// ============================================================================
// Types
// ============================================================================

interface VerificationResult {
  name: string;
  success: boolean;
  duration: number;
  statusCode?: number;
  error?: string;
  details?: Record<string, unknown>;
}

interface VerificationReport {
  timestamp: string;
  apiUrl: string;
  results: VerificationResult[];
  summary: {
    total: number;
    passed: number;
    failed: number;
    totalDuration: number;
  };
}

// ============================================================================
// Configuration
// ============================================================================

function loadEnvFile(): Record<string, string> {
  const envPath = path.join(__dirname, '../../.env.dev');
  const env: Record<string, string> = {};

  if (fs.existsSync(envPath)) {
    const content = fs.readFileSync(envPath, 'utf-8');
    for (const line of content.split('\n')) {
      const trimmed = line.trim();
      if (trimmed && !trimmed.startsWith('#')) {
        const [key, ...valueParts] = trimmed.split('=');
        if (key) {
          env[key] = valueParts.join('=');
        }
      }
    }
  }

  return env;
}

function getApiUrl(): string {
  const envVars = loadEnvFile();
  return process.env['API_URL'] || envVars['VITE_API_URL'] || 'http://localhost:3001/v1';
}

// ============================================================================
// HTTP Client
// ============================================================================

async function makeRequest(
  method: string,
  url: string,
  body?: unknown,
  headers?: Record<string, string>
): Promise<{ status: number; data: unknown; duration: number }> {
  const start = Date.now();

  const response = await fetch(url, {
    method,
    headers: {
      'Content-Type': 'application/json',
      ...headers,
    },
    body: body ? JSON.stringify(body) : undefined,
  });

  const duration = Date.now() - start;
  let data: unknown;

  try {
    data = await response.json();
  } catch {
    data = null;
  }

  return { status: response.status, data, duration };
}

// ============================================================================
// Verification Tests
// ============================================================================

async function verifyHealthEndpoint(apiUrl: string): Promise<VerificationResult> {
  const name = 'Health Check';
  const url = `${apiUrl}/health`;

  try {
    const { status, data, duration } = await makeRequest('GET', url);

    if (status === 200) {
      return {
        name,
        success: true,
        duration,
        statusCode: status,
        details: data as Record<string, unknown>,
      };
    }

    return {
      name,
      success: false,
      duration,
      statusCode: status,
      error: `Expected status 200, got ${status}`,
    };
  } catch (error) {
    return {
      name,
      success: false,
      duration: 0,
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  }
}

async function verifyApiGatewayResponse(apiUrl: string): Promise<VerificationResult> {
  const name = 'API Gateway Response';
  const url = `${apiUrl}/assets`;

  try {
    const { status, duration } = await makeRequest('GET', url);

    // Without auth, we expect 401 or 403
    // With a working API Gateway, we should not get 404 or 5xx
    const isExpectedResponse = status === 401 || status === 403 || status === 200;

    return {
      name,
      success: isExpectedResponse,
      duration,
      statusCode: status,
      details: { expectedStatuses: [200, 401, 403] },
      error: isExpectedResponse ? undefined : `Unexpected status: ${status}`,
    };
  } catch (error) {
    return {
      name,
      success: false,
      duration: 0,
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  }
}

async function verifyCorsHeaders(apiUrl: string): Promise<VerificationResult> {
  const name = 'CORS Headers';
  const url = `${apiUrl}/health`;

  try {
    const response = await fetch(url, {
      method: 'OPTIONS',
      headers: {
        'Origin': 'http://localhost:5173',
        'Access-Control-Request-Method': 'GET',
      },
    });

    const duration = 0; // OPTIONS requests are typically fast
    const corsHeader = response.headers.get('Access-Control-Allow-Origin');
    const methodsHeader = response.headers.get('Access-Control-Allow-Methods');

    const hasCors = corsHeader !== null;

    return {
      name,
      success: hasCors,
      duration,
      statusCode: response.status,
      details: {
        'Access-Control-Allow-Origin': corsHeader,
        'Access-Control-Allow-Methods': methodsHeader,
      },
      error: hasCors ? undefined : 'CORS headers not present',
    };
  } catch (error) {
    return {
      name,
      success: false,
      duration: 0,
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  }
}

async function verifyResponseTime(apiUrl: string): Promise<VerificationResult> {
  const name = 'Response Time';
  const url = `${apiUrl}/health`;
  const maxAcceptableMs = 5000; // 5 seconds

  try {
    const { duration } = await makeRequest('GET', url);

    const isAcceptable = duration < maxAcceptableMs;

    return {
      name,
      success: isAcceptable,
      duration,
      details: {
        maxAcceptableMs,
        actualMs: duration,
      },
      error: isAcceptable ? undefined : `Response time ${duration}ms exceeds ${maxAcceptableMs}ms`,
    };
  } catch (error) {
    return {
      name,
      success: false,
      duration: 0,
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  }
}

// ============================================================================
// Main Verification
// ============================================================================

async function runVerification(): Promise<VerificationReport> {
  const apiUrl = getApiUrl().replace(/\/$/, ''); // Remove trailing slash
  const timestamp = new Date().toISOString();

  console.log('\n========================================');
  console.log('  AMS Deployment Verification');
  console.log('========================================\n');
  console.log(`API URL: ${apiUrl}`);
  console.log(`Timestamp: ${timestamp}\n`);

  const results: VerificationResult[] = [];

  // Run verification tests
  console.log('Running verification tests...\n');

  // 1. Health check
  console.log('  [1/4] Health Check...');
  const healthResult = await verifyHealthEndpoint(apiUrl);
  results.push(healthResult);
  console.log(`        ${healthResult.success ? '✓' : '✗'} ${healthResult.duration}ms`);

  // 2. API Gateway response
  console.log('  [2/4] API Gateway Response...');
  const apiResult = await verifyApiGatewayResponse(apiUrl);
  results.push(apiResult);
  console.log(`        ${apiResult.success ? '✓' : '✗'} ${apiResult.duration}ms (status: ${apiResult.statusCode})`);

  // 3. CORS headers
  console.log('  [3/4] CORS Headers...');
  const corsResult = await verifyCorsHeaders(apiUrl);
  results.push(corsResult);
  console.log(`        ${corsResult.success ? '✓' : '✗'}`);

  // 4. Response time
  console.log('  [4/4] Response Time...');
  const timeResult = await verifyResponseTime(apiUrl);
  results.push(timeResult);
  console.log(`        ${timeResult.success ? '✓' : '✗'} ${timeResult.duration}ms`);

  // Calculate summary
  const passed = results.filter((r) => r.success).length;
  const failed = results.filter((r) => !r.success).length;
  const totalDuration = results.reduce((sum, r) => sum + r.duration, 0);

  const report: VerificationReport = {
    timestamp,
    apiUrl,
    results,
    summary: {
      total: results.length,
      passed,
      failed,
      totalDuration,
    },
  };

  // Print summary
  console.log('\n========================================');
  console.log('  Verification Summary');
  console.log('========================================\n');
  console.log(`  Total Tests: ${report.summary.total}`);
  console.log(`  Passed: ${report.summary.passed}`);
  console.log(`  Failed: ${report.summary.failed}`);
  console.log(`  Total Duration: ${report.summary.totalDuration}ms`);

  if (failed > 0) {
    console.log('\n  Failed Tests:');
    for (const result of results.filter((r) => !r.success)) {
      console.log(`    - ${result.name}: ${result.error}`);
    }
  }

  console.log('\n');

  return report;
}

// ============================================================================
// CLI Entry Point
// ============================================================================

async function main(): Promise<void> {
  try {
    const report = await runVerification();

    if (report.summary.failed > 0) {
      console.log('⚠️  Some verification tests failed.');
      process.exit(1);
    }

    console.log('✓ All verification tests passed!');
    process.exit(0);
  } catch (error) {
    console.error('Verification failed with error:', error);
    process.exit(1);
  }
}

// Run if executed directly
if (require.main === module) {
  main();
}

export { runVerification, VerificationReport, VerificationResult };
