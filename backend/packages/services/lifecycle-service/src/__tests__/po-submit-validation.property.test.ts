/**
 * Property Test: Submit Blocked Without Effective Vendor
 *
 * Tag: Feature: po-header-line-items, Property 5: Submit blocked without effective vendor
 * Validates: Requirements 1.4
 */

import * as fc from 'fast-check';

jest.mock('@ams/database', () => ({
  queryOne: jest.fn(),
  queryMany: jest.fn(),
  withTransaction: jest.fn((fn) =>
    fn({
      queryOne: jest.fn(),
      queryMany: jest.fn(),
    })
  ),
}));

jest.mock('@ams/cache', () => ({
  del: jest.fn().mockResolvedValue(undefined),
  get: jest.fn().mockResolvedValue(null),
  set: jest.fn().mockResolvedValue(undefined),
}));

jest.mock('@ams/events', () => ({
  publishEvent: jest.fn().mockResolvedValue(undefined),
}));

jest.mock('@ams/utils', () => ({
  createLogger: () => ({
    info: jest.fn(),
    error: jest.fn(),
    warn: jest.fn(),
    debug: jest.fn(),
  }),
  now: () => '2024-01-15T10:00:00.000Z',
}));

jest.mock('../procurement/procurement-repository');

import { publishEvent } from '@ams/events';

import * as repository from '../procurement/procurement-repository';
import * as procurementService from '../procurement/procurement-service';

const mockRepository = repository as jest.Mocked<typeof repository>;
const mockPublishEvent = publishEvent as jest.Mock;

describe('PO Submit Validation Property Tests', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('blocks submit when at least one line has no effective vendor', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.array(fc.boolean(), { minLength: 1, maxLength: 20 }).filter((arr) => arr.includes(false)),
        async (hasVendorFlags) => {
          jest.clearAllMocks();

          const lines = hasVendorFlags.map((hasVendor, index) => ({
            lineId: `line-${index + 1}`,
            lineNumber: index + 1,
            effectiveVendorId: hasVendor ? `vendor-${index + 1}` : null,
          }));
          const firstMissingLine = lines.find((line) => !line.effectiveVendorId)?.lineNumber ?? 1;

          mockRepository.getPurchaseOrderById.mockResolvedValue({
            poId: 'po-1',
            poNumber: 'PO-001',
            status: 'DRAFT',
          } as any);
          mockRepository.getPurchaseOrderLines.mockResolvedValue(lines as any);

          try {
            await procurementService.submitPurchaseOrder('po-1', 'user-1');
            return false;
          } catch (error) {
            const message = (error as Error).message;
            return (
              message === `Cannot submit: line ${firstMissingLine} has no vendor assigned` &&
              mockRepository.updatePurchaseOrderStatus.mock.calls.length === 0 &&
              mockPublishEvent.mock.calls.length === 0
            );
          }
        }
      ),
      { numRuns: 100 }
    );
  });

  it('submits successfully when all lines have effective vendors', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.array(fc.uuid(), { minLength: 1, maxLength: 20 }),
        async (vendorIds) => {
          jest.clearAllMocks();

          const lines = vendorIds.map((vendorId, index) => ({
            lineId: `line-${index + 1}`,
            lineNumber: index + 1,
            effectiveVendorId: vendorId,
            effectiveVendorName: `Vendor ${index + 1}`,
          }));

          mockRepository.getPurchaseOrderById.mockResolvedValue({
            poId: 'po-1',
            poNumber: 'PO-001',
            status: 'DRAFT',
            totalAmount: 1000,
          } as any);
          mockRepository.getPurchaseOrderLines.mockResolvedValue(lines as any);
          mockRepository.updatePurchaseOrderStatus.mockResolvedValue({
            poId: 'po-1',
            poNumber: 'PO-001',
            status: 'PENDING_APPROVAL',
            totalAmount: 1000,
          } as any);

          const result = await procurementService.submitPurchaseOrder('po-1', 'user-1');

          return (
            result.status === 'PENDING_APPROVAL' &&
            mockRepository.updatePurchaseOrderStatus.mock.calls.length === 1 &&
            mockPublishEvent.mock.calls.length === 1
          );
        }
      ),
      { numRuns: 100 }
    );
  });
});

