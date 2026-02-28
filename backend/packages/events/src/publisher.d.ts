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
import type { Asset, AssetStatus, AssetType, CompliancePosition, EventType } from '@ams/types';
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
 * Publish a domain event to SNS
 *
 * This is the core publish function that handles event envelope creation,
 * message attribute building, and SNS publishing.
 */
export declare function publishEvent(eventType: EventType, payload: Record<string, unknown>, config?: Partial<PublisherConfig>, options?: {
    assetType?: AssetType;
    priority?: 'LOW' | 'NORMAL' | 'HIGH' | 'CRITICAL';
}): Promise<PublishResult>;
/**
 * Publish multiple events in batch
 *
 * Note: SNS doesn't support true batch publishing, so this publishes
 * events sequentially. For high-throughput scenarios, consider using
 * SQS batch send instead.
 */
export declare function publishEvents(events: readonly {
    eventType: EventType;
    payload: Record<string, unknown>;
}[], config?: Partial<PublisherConfig>): Promise<PublishResult[]>;
/**
 * Publish asset created event
 *
 * Validates: Requirements 9.1, 9.2
 */
export declare function publishAssetCreated(assetId: string, assetType: AssetType, assetTag: string, createdBy: string, asset: Asset, config?: Partial<PublisherConfig>): Promise<PublishResult>;
/**
 * Publish asset updated event
 *
 * Validates: Requirements 9.1, 9.2
 */
export declare function publishAssetUpdated(assetId: string, assetType: AssetType, updatedBy: string, changes: readonly {
    field: string;
    oldValue: unknown;
    newValue: unknown;
}[], config?: Partial<PublisherConfig>): Promise<PublishResult>;
/**
 * Publish asset state changed event
 *
 * Validates: Requirements 9.1, 9.2
 */
export declare function publishAssetStateChanged(assetId: string, assetType: AssetType, previousState: AssetStatus, newState: AssetStatus, changedBy: string, reason?: string, config?: Partial<PublisherConfig>): Promise<PublishResult>;
/**
 * Publish asset deleted event
 *
 * Validates: Requirements 9.1, 9.2
 */
export declare function publishAssetDeleted(assetId: string, assetType: AssetType, assetTag: string, deletedBy: string, config?: Partial<PublisherConfig>): Promise<PublishResult>;
/**
 * Publish reconciliation completed event
 */
export declare function publishReconciliationCompleted(productId: string, productName: string, publisher: string, compliancePosition: CompliancePosition, entitlementsOwned: number, installationsFound: number, overUnderCount: number, config?: Partial<PublisherConfig>): Promise<PublishResult>;
/**
 * Publish transfer order created event
 */
export declare function publishTransferOrderCreated(transferId: string, fromStockroomId: string, toStockroomId: string, requestedBy: string, assetCount: number, config?: Partial<PublisherConfig>): Promise<PublishResult>;
/**
 * Publish stock level alert event
 */
export declare function publishStockLevelAlert(stockroomId: string, stockroomName: string, productId: string, productName: string, currentQuantity: number, reorderPoint: number, reorderQuantity: number, config?: Partial<PublisherConfig>): Promise<PublishResult>;
/**
 * Publish loaner overdue event
 */
export declare function publishLoanerOverdue(checkoutId: string, assetId: string, checkedOutTo: string, dueDate: string, daysOverdue: number, escalationLevel: number, config?: Partial<PublisherConfig>): Promise<PublishResult>;
/**
 * Publish work order created event
 */
export declare function publishWorkOrderCreated(workOrderId: string, assetId: string, workType: string, priority: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL', assignedTo?: string, scheduledDate?: string, config?: Partial<PublisherConfig>): Promise<PublishResult>;
/**
 * Publish contract expiring event
 */
export declare function publishContractExpiring(contractId: string, contractNumber: string, contractType: string, vendorId: string, vendorName: string, expirationDate: string, daysUntilExpiration: number, totalValue: number, config?: Partial<PublisherConfig>): Promise<PublishResult>;
//# sourceMappingURL=publisher.d.ts.map