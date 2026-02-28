/**
 * Core Asset types for the Asset Management System
 */
import type { BaseEntity, ISODateString, UUID } from './common';
/**
 * Asset type classification
 */
export type AssetType = 'HARDWARE' | 'SOFTWARE' | 'ENTERPRISE';
/**
 * Asset lifecycle states
 */
export type AssetStatus = 'ORDERED' | 'RECEIVED' | 'IN_STOCK' | 'RESERVED' | 'DEPLOYED' | 'IN_MAINTENANCE' | 'RETIRED' | 'DISPOSED';
/**
 * Valid state transitions for assets
 */
export declare const VALID_STATE_TRANSITIONS: Record<AssetStatus, readonly AssetStatus[]>;
/**
 * Core asset entity
 */
export interface Asset extends BaseEntity {
    readonly assetId: UUID;
    readonly assetTag: string;
    readonly assetType: AssetType;
    readonly displayName: string;
    readonly description?: string;
    readonly status: AssetStatus;
    readonly substatus?: string;
}
/**
 * Request to create a new asset
 */
export interface CreateAssetRequest {
    readonly assetType: AssetType;
    readonly displayName: string;
    readonly description?: string;
    readonly status?: AssetStatus;
    readonly attributes?: Record<string, unknown>;
}
/**
 * Request to update an existing asset
 */
export interface UpdateAssetRequest {
    readonly displayName?: string;
    readonly description?: string;
    readonly substatus?: string;
    readonly attributes?: Record<string, unknown>;
}
/**
 * Asset state transition request
 */
export interface StateTransitionRequest {
    readonly newState: AssetStatus;
    readonly reason?: string;
}
/**
 * Asset relationship types (CMDB relationship types)
 *
 * - PARENT_CHILD: Hierarchical relationship (e.g., server contains components)
 * - DEPENDENCY: Asset depends on another asset
 * - CONNECTED_TO: Network or physical connection
 * - INSTALLED_ON: Software installed on hardware
 * - RUNS_ON: Service runs on infrastructure
 * - LOCATION: Asset is located at/in another asset
 * - COMPONENT: Asset is a component of another asset
 */
export type AssetRelationType = 'PARENT_CHILD' | 'DEPENDENCY' | 'CONNECTED_TO' | 'INSTALLED_ON' | 'RUNS_ON' | 'LOCATION' | 'COMPONENT';
/**
 * Valid relationship types array for validation
 */
export declare const VALID_RELATIONSHIP_TYPES: readonly AssetRelationType[];
/**
 * Asset relationship
 */
export interface AssetRelationship {
    readonly relationshipId: UUID;
    readonly sourceAssetId: UUID;
    readonly targetAssetId: UUID;
    readonly relationType: AssetRelationType;
    readonly metadata?: Record<string, unknown>;
    readonly createdAt: ISODateString;
    readonly createdBy?: UUID;
}
/**
 * Request to create an asset relationship
 */
export interface CreateRelationshipRequest {
    readonly sourceAssetId: UUID;
    readonly targetAssetId: UUID;
    readonly relationType: AssetRelationType;
    readonly metadata?: Record<string, unknown>;
}
/**
 * Request to delete an asset relationship
 */
export interface DeleteRelationshipRequest {
    readonly sourceAssetId: UUID;
    readonly targetAssetId: UUID;
    readonly relationType?: AssetRelationType;
}
/**
 * Query parameters for getting related assets
 */
export interface RelatedAssetsQuery {
    readonly assetId: UUID;
    readonly relationType?: AssetRelationType;
    readonly direction?: 'source' | 'target' | 'both';
}
/**
 * Related asset with relationship details
 */
export interface RelatedAsset {
    readonly asset: Asset;
    readonly relationship: AssetRelationship;
    readonly direction: 'source' | 'target';
}
/**
 * Asset search query parameters
 */
export interface AssetSearchQuery {
    readonly query?: string;
    readonly assetType?: AssetType;
    readonly status?: AssetStatus;
    readonly assignedTo?: UUID;
    readonly stockroomId?: UUID;
    readonly buildingId?: UUID;
    readonly building?: string;
    readonly createdAfter?: ISODateString;
    readonly createdBefore?: ISODateString;
}
