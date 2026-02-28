/**
 * Unit tests for Event Publisher
 *
 * Tests the event publishing functionality for domain events.
 * Validates: Requirements 9.1, 9.2
 */

import { PublishCommand, SNSClient } from '@aws-sdk/client-sns';
import { mockClient } from 'aws-sdk-client-mock';

import type { Asset } from '@ams/types';

import {
  publishAssetCreated,
  publishAssetDeleted,
  publishAssetStateChanged,
  publishAssetUpdated,
  publishContractExpiring,
  publishEvent,
  publishEvents,
  publishLoanerOverdue,
  publishReconciliationCompleted,
  publishStockLevelAlert,
  publishTransferOrderCreated,
  publishWorkOrderCreated,
} from '../publisher';

// Mock the SNS client
const snsMock = mockClient(SNSClient);

// Mock the logger
jest.mock('@ams/utils', () => ({
  createLogger: () => ({
    info: jest.fn(),
    error: jest.fn(),
    warn: jest.fn(),
    debug: jest.fn(),
  }),
}));

describe('Event Publisher', () => {
  const mockTopicArn = 'arn:aws:sns:us-east-1:123456789012:asset-events';
  const mockMessageId = 'mock-message-id-12345';

  beforeEach(() => {
    snsMock.reset();
    snsMock.on(PublishCommand).resolves({ MessageId: mockMessageId });

    // Set environment variables
    process.env['EVENTS_TOPIC_ARN'] = mockTopicArn;
    process.env['SERVICE_NAME'] = 'test-service';
  });

  afterEach(() => {
    delete process.env['EVENTS_TOPIC_ARN'];
    delete process.env['SERVICE_NAME'];
  });

  describe('publishEvent', () => {
    it('should publish an event to SNS with correct structure', async () => {
      const result = await publishEvent('ASSET_CREATED', {
        assetId: 'asset-123',
        assetType: 'HARDWARE',
        assetTag: 'AMS-HW-20250101-ABC123',
        createdBy: 'user-456',
      });

      expect(result.eventType).toBe('ASSET_CREATED');
      expect(result.messageId).toBe(mockMessageId);
      expect(result.eventId).toBeDefined();

      // Verify SNS was called with correct parameters
      const calls = snsMock.commandCalls(PublishCommand);
      expect(calls).toHaveLength(1);

      const call = calls[0];
      expect(call).toBeDefined();
      const publishInput = call!.args[0].input;
      expect(publishInput.TopicArn).toBe(mockTopicArn);

      // Verify message structure
      const message = JSON.parse(publishInput.Message as string);
      expect(message.eventType).toBe('ASSET_CREATED');
      expect(message.version).toBe('1.0');
      expect(message.source).toBe('test-service');
      expect(message.payload.assetId).toBe('asset-123');
      expect(message.timestamp).toBeDefined();
      expect(message.eventId).toBeDefined();
    });

    it('should include message attributes for filtering', async () => {
      await publishEvent(
        'ASSET_CREATED',
        { assetId: 'asset-123' },
        undefined,
        { assetType: 'HARDWARE' }
      );

      const calls = snsMock.commandCalls(PublishCommand);
      const call = calls[0];
      expect(call).toBeDefined();
      const publishInput = call!.args[0].input;

      expect(publishInput.MessageAttributes).toBeDefined();
      expect(publishInput.MessageAttributes?.['eventType']?.StringValue).toBe('ASSET_CREATED');
      expect(publishInput.MessageAttributes?.['category']?.StringValue).toBe('ASSET');
      expect(publishInput.MessageAttributes?.['assetType']?.StringValue).toBe('HARDWARE');
    });

    it('should use custom topic ARN when provided', async () => {
      const customTopicArn = 'arn:aws:sns:us-east-1:123456789012:custom-topic';

      await publishEvent(
        'ASSET_CREATED',
        { assetId: 'asset-123' },
        { topicArn: customTopicArn }
      );

      const calls = snsMock.commandCalls(PublishCommand);
      const call = calls[0];
      expect(call).toBeDefined();
      expect(call!.args[0].input.TopicArn).toBe(customTopicArn);
    });

    it('should include correlation ID when provided', async () => {
      const correlationId = 'correlation-123';

      await publishEvent(
        'ASSET_CREATED',
        { assetId: 'asset-123' },
        { correlationId }
      );

      const calls = snsMock.commandCalls(PublishCommand);
      const call = calls[0];
      expect(call).toBeDefined();
      const message = JSON.parse(call!.args[0].input.Message as string);
      expect(message.correlationId).toBe(correlationId);
    });

    it('should throw error when EVENTS_TOPIC_ARN is not set', async () => {
      delete process.env['EVENTS_TOPIC_ARN'];

      await expect(
        publishEvent('ASSET_CREATED', { assetId: 'asset-123' })
      ).rejects.toThrow('EVENTS_TOPIC_ARN environment variable is required');
    });

    it('should throw error for invalid event type', async () => {
      await expect(
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        publishEvent('INVALID_EVENT' as any, { assetId: 'asset-123' })
      ).rejects.toThrow('Invalid event type: INVALID_EVENT');
    });

    it('should propagate SNS errors', async () => {
      snsMock.on(PublishCommand).rejects(new Error('SNS publish failed'));

      await expect(
        publishEvent('ASSET_CREATED', { assetId: 'asset-123' })
      ).rejects.toThrow('SNS publish failed');
    });
  });

  describe('publishEvents', () => {
    it('should publish multiple events sequentially', async () => {
      const events = [
        { eventType: 'ASSET_CREATED' as const, payload: { assetId: 'asset-1' } },
        { eventType: 'ASSET_UPDATED' as const, payload: { assetId: 'asset-2' } },
        { eventType: 'ASSET_DELETED' as const, payload: { assetId: 'asset-3' } },
      ];

      const results = await publishEvents(events);

      expect(results).toHaveLength(3);
      expect(results[0]?.eventType).toBe('ASSET_CREATED');
      expect(results[1]?.eventType).toBe('ASSET_UPDATED');
      expect(results[2]?.eventType).toBe('ASSET_DELETED');

      const calls = snsMock.commandCalls(PublishCommand);
      expect(calls).toHaveLength(3);
    });
  });


  describe('Asset Event Publishers', () => {
    const mockAsset: Asset = {
      assetId: 'asset-123',
      assetTag: 'AMS-HW-20250101-ABC123',
      assetType: 'HARDWARE',
      displayName: 'Test Laptop',
      status: 'IN_STOCK',
      createdAt: '2025-01-01T00:00:00Z',
      updatedAt: '2025-01-01T00:00:00Z',
    };

    describe('publishAssetCreated', () => {
      it('should publish asset created event with correct payload', async () => {
        const result = await publishAssetCreated(
          'asset-123',
          'HARDWARE',
          'AMS-HW-20250101-ABC123',
          'user-456',
          mockAsset
        );

        expect(result.eventType).toBe('ASSET_CREATED');

        const calls = snsMock.commandCalls(PublishCommand);
        const call = calls[0];
        expect(call).toBeDefined();
        const message = JSON.parse(call!.args[0].input.Message as string);

        expect(message.payload.assetId).toBe('asset-123');
        expect(message.payload.assetType).toBe('HARDWARE');
        expect(message.payload.assetTag).toBe('AMS-HW-20250101-ABC123');
        expect(message.payload.createdBy).toBe('user-456');
        expect(message.payload.asset).toEqual(mockAsset);
      });

      it('should include assetType in message attributes', async () => {
        await publishAssetCreated(
          'asset-123',
          'SOFTWARE',
          'AMS-SW-20250101-XYZ789',
          'user-456',
          { ...mockAsset, assetType: 'SOFTWARE' }
        );

        const calls = snsMock.commandCalls(PublishCommand);
        const call = calls[0];
        expect(call).toBeDefined();
        const attrs = call!.args[0].input.MessageAttributes;
        expect(attrs?.['assetType']?.StringValue).toBe('SOFTWARE');
      });
    });

    describe('publishAssetUpdated', () => {
      it('should publish asset updated event with changes', async () => {
        const changes = [
          { field: 'displayName', oldValue: 'Old Name', newValue: 'New Name' },
          { field: 'status', oldValue: 'IN_STOCK', newValue: 'DEPLOYED' },
        ];

        const result = await publishAssetUpdated(
          'asset-123',
          'HARDWARE',
          'user-456',
          changes
        );

        expect(result.eventType).toBe('ASSET_UPDATED');

        const calls = snsMock.commandCalls(PublishCommand);
        const call = calls[0];
        expect(call).toBeDefined();
        const message = JSON.parse(call!.args[0].input.Message as string);

        expect(message.payload.assetId).toBe('asset-123');
        expect(message.payload.updatedBy).toBe('user-456');
        expect(message.payload.changes).toEqual(changes);
      });
    });

    describe('publishAssetStateChanged', () => {
      it('should publish state change event with previous and new state', async () => {
        const result = await publishAssetStateChanged(
          'asset-123',
          'HARDWARE',
          'IN_STOCK',
          'DEPLOYED',
          'user-456',
          'Deployed to user workstation'
        );

        expect(result.eventType).toBe('ASSET_STATE_CHANGED');

        const calls = snsMock.commandCalls(PublishCommand);
        const call = calls[0];
        expect(call).toBeDefined();
        const message = JSON.parse(call!.args[0].input.Message as string);

        expect(message.payload.assetId).toBe('asset-123');
        expect(message.payload.previousState).toBe('IN_STOCK');
        expect(message.payload.newState).toBe('DEPLOYED');
        expect(message.payload.changedBy).toBe('user-456');
        expect(message.payload.reason).toBe('Deployed to user workstation');
      });
    });

    describe('publishAssetDeleted', () => {
      it('should publish asset deleted event', async () => {
        const result = await publishAssetDeleted(
          'asset-123',
          'HARDWARE',
          'AMS-HW-20250101-ABC123',
          'user-456'
        );

        expect(result.eventType).toBe('ASSET_DELETED');

        const calls = snsMock.commandCalls(PublishCommand);
        const call = calls[0];
        expect(call).toBeDefined();
        const message = JSON.parse(call!.args[0].input.Message as string);

        expect(message.payload.assetId).toBe('asset-123');
        expect(message.payload.assetTag).toBe('AMS-HW-20250101-ABC123');
        expect(message.payload.deletedBy).toBe('user-456');
      });
    });
  });


  describe('SAM Event Publishers', () => {
    describe('publishReconciliationCompleted', () => {
      it('should publish reconciliation completed event', async () => {
        const result = await publishReconciliationCompleted(
          'product-123',
          'Microsoft Office 365',
          'Microsoft',
          'UNDER_LICENSED',
          100,
          120,
          -20
        );

        expect(result.eventType).toBe('RECONCILIATION_COMPLETED');

        const calls = snsMock.commandCalls(PublishCommand);
        const call = calls[0];
        expect(call).toBeDefined();
        const message = JSON.parse(call!.args[0].input.Message as string);

        expect(message.payload.productId).toBe('product-123');
        expect(message.payload.productName).toBe('Microsoft Office 365');
        expect(message.payload.publisher).toBe('Microsoft');
        expect(message.payload.compliancePosition).toBe('UNDER_LICENSED');
        expect(message.payload.entitlementsOwned).toBe(100);
        expect(message.payload.installationsFound).toBe(120);
        expect(message.payload.overUnderCount).toBe(-20);
      });
    });
  });

  describe('HAM Event Publishers', () => {
    describe('publishTransferOrderCreated', () => {
      it('should publish transfer order created event', async () => {
        const result = await publishTransferOrderCreated(
          'transfer-123',
          'stockroom-1',
          'stockroom-2',
          'user-456',
          5
        );

        expect(result.eventType).toBe('TRANSFER_ORDER_CREATED');

        const calls = snsMock.commandCalls(PublishCommand);
        const call = calls[0];
        expect(call).toBeDefined();
        const message = JSON.parse(call!.args[0].input.Message as string);

        expect(message.payload.transferId).toBe('transfer-123');
        expect(message.payload.fromStockroomId).toBe('stockroom-1');
        expect(message.payload.toStockroomId).toBe('stockroom-2');
        expect(message.payload.requestedBy).toBe('user-456');
        expect(message.payload.assetCount).toBe(5);
      });
    });

    describe('publishStockLevelAlert', () => {
      it('should publish stock level alert with HIGH priority when quantity is 0', async () => {
        await publishStockLevelAlert(
          'stockroom-1',
          'Main Stockroom',
          'product-123',
          'Dell Laptop',
          0,
          10,
          20
        );

        const calls = snsMock.commandCalls(PublishCommand);
        const call = calls[0];
        expect(call).toBeDefined();
        const attrs = call!.args[0].input.MessageAttributes;
        expect(attrs?.['priority']?.StringValue).toBe('HIGH');
      });

      it('should publish stock level alert with NORMAL priority when quantity > 0', async () => {
        await publishStockLevelAlert(
          'stockroom-1',
          'Main Stockroom',
          'product-123',
          'Dell Laptop',
          5,
          10,
          20
        );

        const calls = snsMock.commandCalls(PublishCommand);
        const call = calls[0];
        expect(call).toBeDefined();
        const attrs = call!.args[0].input.MessageAttributes;
        expect(attrs?.['priority']?.StringValue).toBe('NORMAL');
      });
    });

    describe('publishLoanerOverdue', () => {
      it('should publish loaner overdue event with escalation level', async () => {
        const result = await publishLoanerOverdue(
          'checkout-123',
          'asset-456',
          'user-789',
          '2025-01-01T00:00:00Z',
          5,
          2
        );

        expect(result.eventType).toBe('LOANER_OVERDUE');

        const calls = snsMock.commandCalls(PublishCommand);
        const call = calls[0];
        expect(call).toBeDefined();
        const message = JSON.parse(call!.args[0].input.Message as string);

        expect(message.payload.checkoutId).toBe('checkout-123');
        expect(message.payload.daysOverdue).toBe(5);
        expect(message.payload.escalationLevel).toBe(2);
      });

      it('should set HIGH priority when escalation level >= 3', async () => {
        await publishLoanerOverdue(
          'checkout-123',
          'asset-456',
          'user-789',
          '2025-01-01T00:00:00Z',
          10,
          3
        );

        const calls = snsMock.commandCalls(PublishCommand);
        const call = calls[0];
        expect(call).toBeDefined();
        const attrs = call!.args[0].input.MessageAttributes;
        expect(attrs?.['priority']?.StringValue).toBe('HIGH');
      });
    });
  });

  describe('EAM Event Publishers', () => {
    describe('publishWorkOrderCreated', () => {
      it('should publish work order created event', async () => {
        const result = await publishWorkOrderCreated(
          'wo-123',
          'asset-456',
          'PREVENTIVE_MAINTENANCE',
          'HIGH',
          'tech-789',
          '2025-02-01T00:00:00Z'
        );

        expect(result.eventType).toBe('WORK_ORDER_CREATED');

        const calls = snsMock.commandCalls(PublishCommand);
        const call = calls[0];
        expect(call).toBeDefined();
        const message = JSON.parse(call!.args[0].input.Message as string);

        expect(message.payload.workOrderId).toBe('wo-123');
        expect(message.payload.assetId).toBe('asset-456');
        expect(message.payload.workType).toBe('PREVENTIVE_MAINTENANCE');
        expect(message.payload.priority).toBe('HIGH');
        expect(message.payload.assignedTo).toBe('tech-789');
      });

      it('should set CRITICAL priority for CRITICAL work orders', async () => {
        await publishWorkOrderCreated(
          'wo-123',
          'asset-456',
          'EMERGENCY_REPAIR',
          'CRITICAL'
        );

        const calls = snsMock.commandCalls(PublishCommand);
        const call = calls[0];
        expect(call).toBeDefined();
        const attrs = call!.args[0].input.MessageAttributes;
        expect(attrs?.['priority']?.StringValue).toBe('CRITICAL');
      });
    });
  });

  describe('Contract Event Publishers', () => {
    describe('publishContractExpiring', () => {
      it('should publish contract expiring event', async () => {
        const result = await publishContractExpiring(
          'contract-123',
          'CON-2025-001',
          'MAINTENANCE',
          'vendor-456',
          'Dell Technologies',
          '2025-03-01T00:00:00Z',
          30,
          50000
        );

        expect(result.eventType).toBe('CONTRACT_EXPIRING');

        const calls = snsMock.commandCalls(PublishCommand);
        const call = calls[0];
        expect(call).toBeDefined();
        const message = JSON.parse(call!.args[0].input.Message as string);

        expect(message.payload.contractId).toBe('contract-123');
        expect(message.payload.contractNumber).toBe('CON-2025-001');
        expect(message.payload.daysUntilExpiration).toBe(30);
        expect(message.payload.totalValue).toBe(50000);
      });

      it('should set HIGH priority when <= 30 days until expiration', async () => {
        await publishContractExpiring(
          'contract-123',
          'CON-2025-001',
          'MAINTENANCE',
          'vendor-456',
          'Dell Technologies',
          '2025-03-01T00:00:00Z',
          30,
          50000
        );

        const calls = snsMock.commandCalls(PublishCommand);
        const call = calls[0];
        expect(call).toBeDefined();
        const attrs = call!.args[0].input.MessageAttributes;
        expect(attrs?.['priority']?.StringValue).toBe('HIGH');
      });

      it('should set NORMAL priority when > 30 days until expiration', async () => {
        await publishContractExpiring(
          'contract-123',
          'CON-2025-001',
          'MAINTENANCE',
          'vendor-456',
          'Dell Technologies',
          '2025-06-01T00:00:00Z',
          90,
          50000
        );

        const calls = snsMock.commandCalls(PublishCommand);
        const call = calls[0];
        expect(call).toBeDefined();
        const attrs = call!.args[0].input.MessageAttributes;
        expect(attrs?.['priority']?.StringValue).toBe('NORMAL');
      });
    });
  });

  describe('Message Attributes', () => {
    it('should include category attribute based on event type', async () => {
      // Asset event
      await publishEvent('ASSET_CREATED', { assetId: 'asset-1' });
      let calls = snsMock.commandCalls(PublishCommand);
      let call = calls[0];
      expect(call).toBeDefined();
      expect(call!.args[0].input.MessageAttributes?.['category']?.StringValue).toBe('ASSET');

      snsMock.reset();
      snsMock.on(PublishCommand).resolves({ MessageId: mockMessageId });

      // SAM event
      await publishEvent('RECONCILIATION_COMPLETED', { productId: 'product-1' });
      calls = snsMock.commandCalls(PublishCommand);
      call = calls[0];
      expect(call).toBeDefined();
      expect(call!.args[0].input.MessageAttributes?.['category']?.StringValue).toBe('SAM');

      snsMock.reset();
      snsMock.on(PublishCommand).resolves({ MessageId: mockMessageId });

      // HAM event
      await publishEvent('TRANSFER_ORDER_CREATED', { transferId: 'transfer-1' });
      calls = snsMock.commandCalls(PublishCommand);
      call = calls[0];
      expect(call).toBeDefined();
      expect(call!.args[0].input.MessageAttributes?.['category']?.StringValue).toBe('HAM');

      snsMock.reset();
      snsMock.on(PublishCommand).resolves({ MessageId: mockMessageId });

      // EAM event
      await publishEvent('WORK_ORDER_CREATED', { workOrderId: 'wo-1' });
      calls = snsMock.commandCalls(PublishCommand);
      call = calls[0];
      expect(call).toBeDefined();
      expect(call!.args[0].input.MessageAttributes?.['category']?.StringValue).toBe('EAM');

      snsMock.reset();
      snsMock.on(PublishCommand).resolves({ MessageId: mockMessageId });

      // Contract event
      await publishEvent('CONTRACT_EXPIRING', { contractId: 'contract-1' });
      calls = snsMock.commandCalls(PublishCommand);
      call = calls[0];
      expect(call).toBeDefined();
      expect(call!.args[0].input.MessageAttributes?.['category']?.StringValue).toBe('CONTRACT');
    });

    it('should include source attribute', async () => {
      await publishEvent('ASSET_CREATED', { assetId: 'asset-1' });

      const calls = snsMock.commandCalls(PublishCommand);
      const call = calls[0];
      expect(call).toBeDefined();
      expect(call!.args[0].input.MessageAttributes?.['source']?.StringValue).toBe('test-service');
    });

    it('should include eventId attribute', async () => {
      const result = await publishEvent('ASSET_CREATED', { assetId: 'asset-1' });

      const calls = snsMock.commandCalls(PublishCommand);
      const call = calls[0];
      expect(call).toBeDefined();
      expect(call!.args[0].input.MessageAttributes?.['eventId']?.StringValue).toBe(result.eventId);
    });
  });
});
