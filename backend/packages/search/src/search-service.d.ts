/**
 * OpenSearch Search Service
 *
 * Implements full-text search for assets with:
 * - Pagination, filtering, and sorting (Requirement 10.5)
 * - Sub-500ms response times (Requirement 10.6)
 * - Full-text search with relevance scoring
 * - Performance optimizations for fast response times
 */
import type { Asset, AssetStatus, AssetType, PaginatedResult, SortDirection, UUID } from '@ams/types';
/**
 * Advanced search query parameters
 */
export interface AssetSearchParams {
    /** Full-text search query */
    readonly query?: string;
    /** Filter by asset type */
    readonly assetType?: AssetType;
    /** Filter by status */
    readonly status?: AssetStatus;
    /** Filter by multiple statuses */
    readonly statuses?: readonly AssetStatus[];
    /** Filter by assigned user */
    readonly assignedTo?: UUID;
    /** Filter by stockroom */
    readonly stockroomId?: UUID;
    /** Filter by manufacturer */
    readonly manufacturer?: string;
    /** Filter by model */
    readonly model?: string;
    /** Filter by serial number */
    readonly serialNumber?: string;
    /** Filter by creation date range start */
    readonly createdAfter?: string;
    /** Filter by creation date range end */
    readonly createdBefore?: string;
    /** Filter by update date range start */
    readonly updatedAfter?: string;
    /** Filter by update date range end */
    readonly updatedBefore?: string;
}
/**
 * Search pagination parameters
 */
export interface SearchPaginationParams {
    readonly page?: number;
    readonly limit?: number;
    readonly cursor?: string;
}
/**
 * Search sort parameters
 */
export interface SearchSortParams {
    readonly field?: string;
    readonly direction?: SortDirection;
}
/**
 * Combined search options
 */
export interface SearchOptions {
    readonly pagination?: SearchPaginationParams;
    readonly sort?: SearchSortParams;
    readonly highlight?: HighlightConfig;
    readonly includeAggregations?: boolean;
}
/**
 * Search result with relevance score
 */
export interface SearchResult<T> extends PaginatedResult<T> {
    readonly maxScore?: number;
    readonly took: number;
    readonly highlights?: Record<string, readonly string[]>;
    readonly aggregations?: SearchAggregations;
}
/**
 * Search aggregations for faceted search
 */
export interface SearchAggregations {
    readonly byType?: readonly AggregationBucket[];
    readonly byStatus?: readonly AggregationBucket[];
    readonly byManufacturer?: readonly AggregationBucket[];
}
/**
 * Aggregation bucket
 */
export interface AggregationBucket {
    readonly key: string;
    readonly count: number;
}
/**
 * Search highlight configuration
 */
export interface HighlightConfig {
    readonly enabled?: boolean;
    readonly fields?: readonly string[];
    readonly preTag?: string;
    readonly postTag?: string;
}
/**
 * Search suggestions
 */
export interface SearchSuggestion {
    readonly text: string;
    readonly score: number;
}
/**
 * Asset document in OpenSearch
 */
export interface AssetDocument {
    readonly assetId: string;
    readonly assetTag: string;
    readonly assetType: AssetType;
    readonly displayName: string;
    readonly description?: string;
    readonly status: AssetStatus;
    readonly substatus?: string;
    readonly assignedTo?: string;
    readonly stockroomId?: string;
    readonly manufacturer?: string;
    readonly model?: string;
    readonly serialNumber?: string;
    readonly createdAt: string;
    readonly updatedAt: string;
    readonly createdBy?: string;
    readonly updatedBy?: string;
}
/**
 * Search assets using OpenSearch
 *
 * Implements Requirements 10.5, 10.6:
 * - Full-text search with pagination, filtering, sorting
 * - Sub-500ms response times for typical queries
 * - Relevance scoring with field boosting
 * - Optional highlighting and aggregations
 */
export declare function searchAssets(params: AssetSearchParams, options?: SearchOptions): Promise<SearchResult<Asset>>;
/**
 * Index an asset document
 */
export declare function indexAsset(asset: AssetDocument): Promise<void>;
/**
 * Update an asset document
 */
export declare function updateAssetDocument(assetId: string, updates: Partial<AssetDocument>): Promise<void>;
/**
 * Delete an asset document
 */
export declare function deleteAssetDocument(assetId: string): Promise<void>;
/**
 * Bulk index multiple assets
 */
export declare function bulkIndexAssets(assets: readonly AssetDocument[]): Promise<void>;
/**
 * Get asset by ID from OpenSearch
 */
export declare function getAssetFromIndex(assetId: string): Promise<Asset | null>;
/**
 * Get search suggestions for autocomplete
 * Implements fast prefix-based suggestions for asset search
 */
export declare function getSearchSuggestions(prefix: string, limit?: number): Promise<readonly SearchSuggestion[]>;
/**
 * Search assets with aggregations only (no results)
 * Useful for getting facet counts without fetching documents
 */
export declare function getSearchAggregations(params: AssetSearchParams): Promise<SearchAggregations>;
/**
 * Count assets matching search criteria
 * Optimized for counting without fetching documents
 */
export declare function countAssets(params: AssetSearchParams): Promise<number>;
/**
 * Check if search service is healthy and responsive
 * Returns true if response time is within threshold
 */
export declare function isSearchHealthy(): Promise<boolean>;
//# sourceMappingURL=search-service.d.ts.map