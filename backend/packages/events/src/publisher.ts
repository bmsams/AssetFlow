/**
 * Event publisher for SNS topics
 *
 * This module provides utilities for publishing domain events to SNS topics.
 * Events are published with message attributes for filtering and routing.
 *
 * Requirements: 9.1, 9.2 - Event-Driven Architecture
 * - THE Event_Bus SHALL publish domain events for all significant asset state changes
 * - WHEN an asset is created, updated, or deleted, THE Event_Bus SHALL publish
 *   corresponding events with full payload
 */

import { PublishCommand, SNSClient } from '@aws-sdk/client-sns';
import { v4 as uuidv4 } from 'uuid';

import type {
  Asset,
  AssetStatus,
  AssetType,
  CompliancePosition,
  EventCategory,
  EventType,
} from '@ams/types';
import { EVENT_CATEGORIES, isValidEventType } from '@ams/types';
import { createLogger } from '@ams/utils';

const logger = createLogger({ service: 'event-publisher' });

/**
 * SNS client (reused across Lambda invocations for connection pooling)
 */
const snsClient = new SNSClient({});

/**
 * Event publisher configuration
 */
export interface PublisherConfig {
  /** SNS topic ARN to publish to */
  readonly topicArn: string;
  /** Source service name for event attribution */
  readonly source?: string;
  /** Optional correlation ID for request tracing */
  readonly correlationId?: string;
}

/**
 * Published event result
 */
export interface PublishResult {
  /** Unique event ID */
  readonly eventId: string;
  /** SNS message ID */
  readonly messageId: string;
  /** Event type that was published */
  readonly eventType: EventType;
}


/**
 * Event envelope structure published to SNS
 */
export interface EventEnvelope {
  /** Unique event identifier */
  readonly eventId: string;
  /** Event type discriminator */
  readonly eventType: EventType;
  /** ISO 8601 timestamp */
  readonly timestamp: string;
  /** Event schema version */
  readonly version: string;
  /** Source service */
  readonly source: string;
  /** Optional correlation ID */
  readonly correlationId?: string;
  /** Event payload */
  readonly payload: Record<string, unknown>;
}

/**
 * SNS message attribute value
 */
interface MessageAttributeValue {
  DataType: 'String';
  StringValue: string;
}

/**
 * SNS message attributes for filtering
 */
type MessageAttributes = Record<string, MessageAttributeValue>;

/**
 * Get topic ARN from environment
 */
function getTopicArn(): string {
  const topicArn = process.env['EVENTS_TOPIC_ARN'];
  if (!topicArn) {
    throw new Error('EVENTS_TOPIC_ARN environment variable is required');
  }
  return topicArn;
}

/**
 * Get service name for event source
 */
function getServiceName(): string {
  return process.env['SERVICE_NAME'] ?? 'ams-backend';
}


/**
 * Build SNS message attributes for event filtering
 */
function buildMessageAttributes(
  eventId: string,
  eventType: EventType,
  source: string,
  options?: {
    assetType?: AssetType;
    priority?: 'LOW' | 'NORMAL' | 'HIGH' | 'CRITICAL';
  }
): MessageAttributes {
  const category: EventCategory = EVENT_CATEGORIES[eventType];

  const attributes: MessageAttributes = {
    eventType: {
      DataType: 'String',
      StringValue: eventType,
    },
    source: {
      DataType: 'String',
      StringValue: source,
    },
    eventId: {
      DataType: 'String',
      StringValue: eventId,
    },
    category: {
      DataType: 'String',
      StringValue: category,
    },
  };

  if (options?.assetType) {
    attributes['assetType'] = {
      DataType: 'String',
      StringValue: options.assetType,
    };
  }

  if (options?.priority) {
    attributes['priority'] = {
      DataType: 'String',
      StringValue: options.priority,
    };
  }

  return attributes;
}

/**
 * Publish a domain event to SNS
 *
 * This is the core publish function that handles event envelope creation,
 * message attribute building, and SNS publishing.
 */
export async function publishEvent(
  eventType: EventType,
  payload: Record<string, unknown>,
  config?: Partial<PublisherConfig>,
  options?: {
    assetType?: AssetType;
    priority?: 'LOW' | 'NORMAL' | 'HIGH' | 'CRITICAL';
  }
): Promise<PublishResult> {
  // Validate event type
  if (!isValidEventType(eventType)) {
    throw new Error(`Invalid event type: ${eventType}`);
  }

  const topicArn = config?.topicArn ?? getTopicArn();
  const source = config?.source ?? getServiceName();
  const eventId = uuidv4();

  const event: EventEnvelope = {
    eventId,
    eventType,
    timestamp: new Date().toISOString(),
    version: '1.0',
    source,
    correlationId: config?.correlationId,
    payload,
  };

  const messageAttributes = buildMessageAttributes(eventId, eventType, source, options);

  try {
    const command = new PublishCommand({
      TopicArn: topicArn,
      Message: JSON.stringify(event),
      MessageAttributes: messageAttributes,
    });

    const response = await snsClient.send(command);

    logger.info('Event published', {
      eventId,
      eventType,
      messageId: response.MessageId,
      category: EVENT_CATEGORIES[eventType],
    });

    return {
      eventId,
      messageId: response.MessageId ?? '',
      eventType,
    };
  } catch (error) {
    logger.error('Failed to publish event', error as Error, {
      eventType,
      eventId,
    });
    throw error;
  }
}

/**
 * Publish multiple events in batch
 *
 * Note: SNS doesn't support true batch publishing, so this publishes
 * events sequentially. For high-throughput scenarios, consider using
 * SQS batch send instead.
 */
export async function publishEvents(
  events: readonly { eventType: EventType; payload: Record<string, unknown> }[],
  config?: Partial<PublisherConfig>
): Promise<PublishResult[]> {
  const results: PublishResult[] = [];

  for (const event of events) {
    const result = await publishEvent(event.eventType, event.payload, config);
    results.push(result);
  }

  return results;
}


// ============================================================================
// Asset Event Publishers
// ============================================================================

/**
 * Publish asset created event
 *
 * Validates: Requirements 9.1, 9.2
 */
export async function publishAssetCreated(
  assetId: string,
  assetType: AssetType,
  assetTag: string,
  createdBy: string,
  asset: Asset,
  config?: Partial<PublisherConfig>
): Promise<PublishResult> {
  return publishEvent(
    'ASSET_CREATED',
    {
      assetId,
      assetType,
      assetTag,
      createdBy,
      asset,
    },
    config,
    { assetType }
  );
}

/**
 * Publish asset updated event
 *
 * Validates: Requirements 9.1, 9.2
 */
export async function publishAssetUpdated(
  assetId: string,
  assetType: AssetType,
  updatedBy: string,
  changes: readonly { field: string; oldValue: unknown; newValue: unknown }[],
  config?: Partial<PublisherConfig>
): Promise<PublishResult> {
  return publishEvent(
    'ASSET_UPDATED',
    {
      assetId,
      assetType,
      updatedBy,
      changes,
    },
    config,
    { assetType }
  );
}

/**
 * Publish asset state changed event
 *
 * Validates: Requirements 9.1, 9.2
 */
export async function publishAssetStateChanged(
  assetId: string,
  assetType: AssetType,
  previousState: AssetStatus,
  newState: AssetStatus,
  changedBy: string,
  reason?: string,
  config?: Partial<PublisherConfig>
): Promise<PublishResult> {
  return publishEvent(
    'ASSET_STATE_CHANGED',
    {
      assetId,
      assetType,
      previousState,
      newState,
      changedBy,
      reason,
    },
    config,
    { assetType }
  );
}

/**
 * Publish asset deleted event
 *
 * Validates: Requirements 9.1, 9.2
 */
export async function publishAssetDeleted(
  assetId: string,
  assetType: AssetType,
  assetTag: string,
  deletedBy: string,
  config?: Partial<PublisherConfig>
): Promise<PublishResult> {
  return publishEvent(
    'ASSET_DELETED',
    {
      assetId,
      assetType,
      assetTag,
      deletedBy,
    },
    config,
    { assetType }
  );
}


// ============================================================================
// Software Asset Management (SAM) Event Publishers
// ============================================================================

/**
 * Publish reconciliation completed event
 */
export async function publishReconciliationCompleted(
  productId: string,
  productName: string,
  publisher: string,
  compliancePosition: CompliancePosition,
  entitlementsOwned: number,
  installationsFound: number,
  overUnderCount: number,
  config?: Partial<PublisherConfig>
): Promise<PublishResult> {
  return publishEvent(
    'RECONCILIATION_COMPLETED',
    {
      productId,
      productName,
      publisher,
      compliancePosition,
      entitlementsOwned,
      installationsFound,
      overUnderCount,
    },
    config
  );
}


// ============================================================================
// Hardware Asset Management (HAM) Event Publishers
// ============================================================================

/**
 * Publish transfer order created event
 */
export async function publishTransferOrderCreated(
  transferId: string,
  fromStockroomId: string,
  toStockroomId: string,
  requestedBy: string,
  assetCount: number,
  config?: Partial<PublisherConfig>
): Promise<PublishResult> {
  return publishEvent(
    'TRANSFER_ORDER_CREATED',
    {
      transferId,
      fromStockroomId,
      toStockroomId,
      requestedBy,
      assetCount,
    },
    config
  );
}

/**
 * Publish stock level alert event
 */
export async function publishStockLevelAlert(
  stockroomId: string,
  stockroomName: string,
  productId: string,
  productName: string,
  currentQuantity: number,
  reorderPoint: number,
  reorderQuantity: number,
  config?: Partial<PublisherConfig>
): Promise<PublishResult> {
  const priority = currentQuantity === 0 ? 'HIGH' : 'NORMAL';
  return publishEvent(
    'STOCK_LEVEL_ALERT',
    {
      stockroomId,
      stockroomName,
      productId,
      productName,
      currentQuantity,
      reorderPoint,
      reorderQuantity,
    },
    config,
    { priority }
  );
}

/**
 * Publish loaner overdue event
 */
export async function publishLoanerOverdue(
  checkoutId: string,
  assetId: string,
  checkedOutTo: string,
  dueDate: string,
  daysOverdue: number,
  escalationLevel: number,
  config?: Partial<PublisherConfig>
): Promise<PublishResult> {
  const priority = escalationLevel >= 3 ? 'HIGH' : 'NORMAL';
  return publishEvent(
    'LOANER_OVERDUE',
    {
      checkoutId,
      assetId,
      checkedOutTo,
      dueDate,
      daysOverdue,
      escalationLevel,
    },
    config,
    { priority }
  );
}


// ============================================================================
// Enterprise Asset Management (EAM) Event Publishers
// ============================================================================

/**
 * Publish work order created event
 */
export async function publishWorkOrderCreated(
  workOrderId: string,
  assetId: string,
  workType: string,
  priority: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL',
  assignedTo?: string,
  scheduledDate?: string,
  config?: Partial<PublisherConfig>
): Promise<PublishResult> {
  const eventPriority = priority === 'CRITICAL' ? 'CRITICAL' : priority === 'HIGH' ? 'HIGH' : 'NORMAL';
  return publishEvent(
    'WORK_ORDER_CREATED',
    {
      workOrderId,
      assetId,
      workType,
      priority,
      assignedTo,
      scheduledDate,
    },
    config,
    { priority: eventPriority }
  );
}


// ============================================================================
// Contract and Procurement Event Publishers
// ============================================================================

/**
 * Publish contract expiring event
 */
export async function publishContractExpiring(
  contractId: string,
  contractNumber: string,
  contractType: string,
  vendorId: string,
  vendorName: string,
  expirationDate: string,
  daysUntilExpiration: number,
  totalValue: number,
  config?: Partial<PublisherConfig>
): Promise<PublishResult> {
  const priority = daysUntilExpiration <= 30 ? 'HIGH' : 'NORMAL';
  return publishEvent(
    'CONTRACT_EXPIRING',
    {
      contractId,
      contractNumber,
      contractType,
      vendorId,
      vendorName,
      expirationDate,
      daysUntilExpiration,
      totalValue,
    },
    config,
    { priority }
  );
}
