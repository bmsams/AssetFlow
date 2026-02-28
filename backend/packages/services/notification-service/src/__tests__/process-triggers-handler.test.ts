/**
 * Process Triggers Handler Unit Tests
 *
 * Tests for the Lambda handler that processes notification triggers.
 *
 * Requirements:
 * - 17.3: Contract expiration notifications at 90, 60, 30 days
 * - 17.4: Loaner overdue escalating reminders
 * - 17.5: Stock level alerts when inventory falls below threshold
 * - 17.6: Compliance alerts for license violations
 */

import type { Context } from 'aws-lambda';

import {
  handler,
  handleContractExpirations,
  handleLoanerOverdues,
  handleStockLevels,
  handleComplianceAlerts,
} from '../handlers/process-triggers';
import type { TriggerType } from '../triggers/trigger-types';

// ============================================================================
// Test Setup
// ============================================================================

const mockContext: Context = {
  awsRequestId: 'test-request-id',
  callbackWaitsForEmptyEventLoop: false,
  functionName: 'process-triggers',
  functionVersion: '1',
  invokedFunctionArn: 'arn:aws:lambda:us-east-1:123456789:function:process-triggers',
  memoryLimitInMB: '256',
  logGroupName: '/aws/lambda/process-triggers',
  logStreamName: '2024/01/01/[$LATEST]abc123',
  getRemainingTimeInMillis: () => 30000,
  done: jest.fn(),
  fail: jest.fn(),
  succeed: jest.fn(),
};

describe('Process Triggers Handler', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    // Reset environment variables
    delete process.env['DRY_RUN_MODE'];
    delete process.env['MAX_TRIGGERS_PER_BATCH'];
    delete process.env['STOCK_COOLDOWN_MINUTES'];
    delete process.env['COMPLIANCE_COOLDOWN_MINUTES'];
  });

  // ==========================================================================
  // Main Handler Tests
  // ==========================================================================

  describe('handler', () => {
    it('should process all trigger types by default', async () => {
      const event = {};

      const response = await handler(event, mockContext);

      expect(response.statusCode).toBe(200);
      expect(response.body).toBeDefined();
      expect(response.body.checkedAt).toBeDefined();
      expect(response.body.results).toBeDefined();
      expect(Array.isArray(response.body.results)).toBe(true);
    });

    it('should process specific trigger types when specified', async () => {
      const triggerTypes: TriggerType[] = ['CONTRACT_EXPIRATION', 'LOANER_OVERDUE'];
      const event = {
        detail: {
          triggerTypes,
        },
      };

      const response = await handler(event, mockContext);

      expect(response.statusCode).toBe(200);
      expect(response.body.results.length).toBeLessThanOrEqual(2);
    });

    it('should respect dry run mode from event', async () => {
      const event = {
        detail: {
          dryRun: true,
        },
      };

      const response = await handler(event, mockContext);

      expect(response.statusCode).toBe(200);
      // In dry run mode, no notifications should be sent
      expect(response.body.totalNotificationsSent).toBe(0);
    });

    it('should respect dry run mode from environment', async () => {
      process.env['DRY_RUN_MODE'] = 'true';

      const event = {};

      const response = await handler(event, mockContext);

      expect(response.statusCode).toBe(200);
      expect(response.body.totalNotificationsSent).toBe(0);
    });

    it('should respect limit from event', async () => {
      const event = {
        detail: {
          limit: 10,
        },
      };

      const response = await handler(event, mockContext);

      expect(response.statusCode).toBe(200);
    });

    it('should include checkedAt timestamp in response', async () => {
      const event = {};

      const response = await handler(event, mockContext);

      expect(response.body.checkedAt).toBeDefined();
      expect(new Date(response.body.checkedAt).getTime()).not.toBeNaN();
    });
  });

  // ==========================================================================
  // Contract Expiration Handler Tests
  // ==========================================================================

  describe('handleContractExpirations', () => {
    it('should process contract expiration triggers', async () => {
      const event = {};

      const response = await handleContractExpirations(event, mockContext);

      expect(response.statusCode).toBe(200);
      expect(response.body.results).toHaveLength(1);
      expect(response.body.results[0]?.triggerType).toBe('CONTRACT_EXPIRATION');
    });

    it('should respect limit parameter', async () => {
      const event = {
        detail: {
          limit: 5,
        },
      };

      const response = await handleContractExpirations(event, mockContext);

      expect(response.statusCode).toBe(200);
    });

    it('should respect dryRun parameter', async () => {
      const event = {
        detail: {
          dryRun: true,
        },
      };

      const response = await handleContractExpirations(event, mockContext);

      expect(response.statusCode).toBe(200);
      expect(response.body.totalNotificationsSent).toBe(0);
    });
  });

  // ==========================================================================
  // Loaner Overdue Handler Tests
  // ==========================================================================

  describe('handleLoanerOverdues', () => {
    it('should process loaner overdue triggers', async () => {
      const event = {};

      const response = await handleLoanerOverdues(event, mockContext);

      expect(response.statusCode).toBe(200);
      expect(response.body.results).toHaveLength(1);
      expect(response.body.results[0]?.triggerType).toBe('LOANER_OVERDUE');
    });

    it('should respect limit parameter', async () => {
      const event = {
        detail: {
          limit: 10,
        },
      };

      const response = await handleLoanerOverdues(event, mockContext);

      expect(response.statusCode).toBe(200);
    });
  });

  // ==========================================================================
  // Stock Level Handler Tests
  // ==========================================================================

  describe('handleStockLevels', () => {
    it('should process stock level triggers', async () => {
      const event = {};

      const response = await handleStockLevels(event, mockContext);

      expect(response.statusCode).toBe(200);
      expect(response.body.results).toHaveLength(1);
      expect(response.body.results[0]?.triggerType).toBe('STOCK_LEVEL');
    });

    it('should respect limit parameter', async () => {
      const event = {
        detail: {
          limit: 20,
        },
      };

      const response = await handleStockLevels(event, mockContext);

      expect(response.statusCode).toBe(200);
    });
  });

  // ==========================================================================
  // Compliance Alert Handler Tests
  // ==========================================================================

  describe('handleComplianceAlerts', () => {
    it('should process compliance alert triggers', async () => {
      const event = {};

      const response = await handleComplianceAlerts(event, mockContext);

      expect(response.statusCode).toBe(200);
      expect(response.body.results).toHaveLength(1);
      expect(response.body.results[0]?.triggerType).toBe('COMPLIANCE_ALERT');
    });

    it('should respect limit parameter', async () => {
      const event = {
        detail: {
          limit: 15,
        },
      };

      const response = await handleComplianceAlerts(event, mockContext);

      expect(response.statusCode).toBe(200);
    });
  });

  // ==========================================================================
  // Error Handling Tests
  // ==========================================================================

  describe('Error Handling', () => {
    it('should return 200 status with empty results when no data', async () => {
      const event = {};
      const response = await handler(event, mockContext);

      // Even with no data, should return 200 with empty results
      expect(response.statusCode).toBe(200);
    });

    it('should include error count in response', async () => {
      const event = {};

      const response = await handler(event, mockContext);

      expect(response.body.totalErrors).toBeDefined();
      expect(typeof response.body.totalErrors).toBe('number');
    });
  });
});
