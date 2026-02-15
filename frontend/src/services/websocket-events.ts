/**
 * WebSocket Event Types for Real-Time Dashboard Updates
 * Implements Requirement 12.6: Real-time dashboard updates via WebSocket
 */

import type { AssetType, AssetStatus } from '../types/asset';

/**
 * All possible dashboard event types
 */
export type DashboardEventType =
  | 'ASSET_CREATED'
  | 'ASSET_UPDATED'
  | 'ASSET_DELETED'
  | 'ASSET_STATE_CHANGED'
  | 'INVENTORY_CHANGED'
  | 'COMPLIANCE_CHANGED'
  | 'LEASE_EXPIRATION_WARNING'
  | 'TRANSFER_ORDER_UPDATED'
  | 'STOCK_LEVEL_ALERT'
  | 'RECLAMATION_IDENTIFIED'
  | 'CONNECTION_ESTABLISHED'
  | 'HEARTBEAT';

/**
 * Base event structure
 */
export interface BaseEvent {
  eventType: DashboardEventType;
  timestamp: string;
  correlationId: string;
}

/**
 * Asset created event
 */
export interface AssetCreatedEvent extends BaseEvent {
  eventType: 'ASSET_CREATED';
  payload: {
    assetId: string;
    assetTag: string;
    assetType: AssetType;
    displayName: string;
    status: AssetStatus;
    createdBy: string;
  };
}

/**
 * Asset updated event
 */
export interface AssetUpdatedEvent extends BaseEvent {
  eventType: 'ASSET_UPDATED';
  payload: {
    assetId: string;
    assetTag: string;
    assetType: AssetType;
    changes: Record<string, { old: unknown; new: unknown }>;
    updatedBy: string;
  };
}

/**
 * Asset deleted event
 */
export interface AssetDeletedEvent extends BaseEvent {
  eventType: 'ASSET_DELETED';
  payload: {
    assetId: string;
    assetTag: string;
    assetType: AssetType;
    deletedBy: string;
  };
}

/**
 * Asset state changed event
 */
export interface AssetStateChangedEvent extends BaseEvent {
  eventType: 'ASSET_STATE_CHANGED';
  payload: {
    assetId: string;
    assetTag: string;
    assetType: AssetType;
    previousState: AssetStatus;
    newState: AssetStatus;
    changedBy: string;
    reason?: string;
  };
}

/**
 * Inventory changed event (stockroom updates)
 */
export interface InventoryChangedEvent extends BaseEvent {
  eventType: 'INVENTORY_CHANGED';
  payload: {
    stockroomId: string;
    stockroomName: string;
    productId: string;
    productName: string;
    previousQuantity: number;
    newQuantity: number;
    changeType: 'INCREASE' | 'DECREASE' | 'ADJUSTMENT';
  };
}

/**
 * Compliance position changed event
 */
export interface ComplianceChangedEvent extends BaseEvent {
  eventType: 'COMPLIANCE_CHANGED';
  payload: {
    productId: string;
    productName: string;
    previousPosition: 'COMPLIANT' | 'OVER_LICENSED' | 'UNDER_LICENSED';
    newPosition: 'COMPLIANT' | 'OVER_LICENSED' | 'UNDER_LICENSED';
    entitlementsOwned: number;
    installationsFound: number;
  };
}

/**
 * Lease expiration warning event
 */
export interface LeaseExpirationEvent extends BaseEvent {
  eventType: 'LEASE_EXPIRATION_WARNING';
  payload: {
    assetId: string;
    assetTag: string;
    displayName: string;
    leaseEndDate: string;
    daysUntilExpiration: number;
    monthlyLeaseCost: number;
    severity: 'critical' | 'warning' | 'info';
  };
}

/**
 * Transfer order updated event
 */
export interface TransferOrderUpdatedEvent extends BaseEvent {
  eventType: 'TRANSFER_ORDER_UPDATED';
  payload: {
    transferId: string;
    fromStockroom: string;
    toStockroom: string;
    status: 'PENDING' | 'APPROVED' | 'IN_TRANSIT' | 'COMPLETED' | 'CANCELLED';
    itemCount: number;
  };
}

/**
 * Stock level alert event
 */
export interface StockLevelAlertEvent extends BaseEvent {
  eventType: 'STOCK_LEVEL_ALERT';
  payload: {
    stockroomId: string;
    stockroomName: string;
    productId: string;
    productName: string;
    currentQuantity: number;
    reorderPoint: number;
    alertType: 'LOW_STOCK' | 'OUT_OF_STOCK' | 'OVERSTOCKED';
  };
}

/**
 * Reclamation candidate identified event
 */
export interface ReclamationIdentifiedEvent extends BaseEvent {
  eventType: 'RECLAMATION_IDENTIFIED';
  payload: {
    installationId: string;
    productName: string;
    assetTag: string;
    daysSinceLastUse: number;
    estimatedSavings: number;
  };
}

/**
 * Connection established event (sent by server on connect)
 */
export interface ConnectionEstablishedEvent extends BaseEvent {
  eventType: 'CONNECTION_ESTABLISHED';
  payload: {
    connectionId: string;
    serverTime: string;
  };
}

/**
 * Heartbeat event for connection health
 */
export interface HeartbeatEvent extends BaseEvent {
  eventType: 'HEARTBEAT';
  payload: {
    serverTime: string;
  };
}

/**
 * Union type of all dashboard events
 */
export type DashboardEvent =
  | AssetCreatedEvent
  | AssetUpdatedEvent
  | AssetDeletedEvent
  | AssetStateChangedEvent
  | InventoryChangedEvent
  | ComplianceChangedEvent
  | LeaseExpirationEvent
  | TransferOrderUpdatedEvent
  | StockLevelAlertEvent
  | ReclamationIdentifiedEvent
  | ConnectionEstablishedEvent
  | HeartbeatEvent;

/**
 * Type guard to check if an object is a valid DashboardEvent
 */
export function isDashboardEvent(obj: unknown): obj is DashboardEvent {
  if (typeof obj !== 'object' || obj === null) {
    return false;
  }

  const event = obj as Record<string, unknown>;
  
  return (
    typeof event.eventType === 'string' &&
    typeof event.timestamp === 'string' &&
    typeof event.correlationId === 'string' &&
    isValidEventType(event.eventType)
  );
}

/**
 * Check if event type is valid
 */
function isValidEventType(type: string): type is DashboardEventType {
  const validTypes: DashboardEventType[] = [
    'ASSET_CREATED',
    'ASSET_UPDATED',
    'ASSET_DELETED',
    'ASSET_STATE_CHANGED',
    'INVENTORY_CHANGED',
    'COMPLIANCE_CHANGED',
    'LEASE_EXPIRATION_WARNING',
    'TRANSFER_ORDER_UPDATED',
    'STOCK_LEVEL_ALERT',
    'RECLAMATION_IDENTIFIED',
    'CONNECTION_ESTABLISHED',
    'HEARTBEAT',
  ];
  return validTypes.includes(type as DashboardEventType);
}

/**
 * Type guard for specific event types
 */
export function isAssetEvent(
  event: DashboardEvent
): event is AssetCreatedEvent | AssetUpdatedEvent | AssetDeletedEvent | AssetStateChangedEvent {
  return (
    event.eventType === 'ASSET_CREATED' ||
    event.eventType === 'ASSET_UPDATED' ||
    event.eventType === 'ASSET_DELETED' ||
    event.eventType === 'ASSET_STATE_CHANGED'
  );
}

export function isInventoryEvent(
  event: DashboardEvent
): event is InventoryChangedEvent | StockLevelAlertEvent | TransferOrderUpdatedEvent {
  return (
    event.eventType === 'INVENTORY_CHANGED' ||
    event.eventType === 'STOCK_LEVEL_ALERT' ||
    event.eventType === 'TRANSFER_ORDER_UPDATED'
  );
}

export function isComplianceEvent(
  event: DashboardEvent
): event is ComplianceChangedEvent | ReclamationIdentifiedEvent {
  return (
    event.eventType === 'COMPLIANCE_CHANGED' ||
    event.eventType === 'RECLAMATION_IDENTIFIED'
  );
}
