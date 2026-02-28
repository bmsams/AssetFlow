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
import { createLogger } from '@ams/utils';

import { getOpenSearchClient } from './client';
import { ASSET_INDEX } from './indices';

const logger = createLogger({ service: 'search-service' });

/**
 * Performance thresholds (Requirement 10.6)
 */
const PERFORMANCE_THRESHOLD_MS = 500;
const REQUEST_TIMEOUT_MS = 5000;

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
  readonly took: number; // Time in milliseconds
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
 * Default sort field and direction
 */
const DEFAULT_SORT_FIELD = 'updatedAt';
const DEFAULT_SORT_DIRECTION: SortDirection = 'desc';

/**
 * Valid sort fields
 */
const VALID_SORT_FIELDS = new Set([
  'assetTag',
  'displayName',
  'assetType',
  'status',
  'createdAt',
  'updatedAt',
  'manufacturer',
  'model',
]);

/**
 * Build OpenSearch query from search parameters
 * Implements relevance scoring with field boosting for better search results
 */
function buildSearchQuery(params: AssetSearchParams): Record<string, unknown> {
  const must: Record<string, unknown>[] = [];
  const filter: Record<string, unknown>[] = [];

  // Full-text search query with relevance scoring
  if (params.query && params.query.trim()) {
    must.push({
      multi_match: {
        query: params.query,
        fields: [
          'displayName^3',           // Highest boost for display name
          'displayName.autocomplete^2',
          'description^1.5',
          'assetTag^4',              // Asset tag is very important
          'serialNumber^4',          // Serial number is very important
          'manufacturer^2',
          'model^2',
        ],
        type: 'best_fields',
        fuzziness: 'AUTO',
        prefix_length: 2,
        operator: 'or',
        minimum_should_match: '75%', // At least 75% of terms should match
      },
    });
  }

  // Asset type filter
  if (params.assetType) {
    filter.push({ term: { assetType: params.assetType } });
  }

  // Status filter (single)
  if (params.status) {
    filter.push({ term: { status: params.status } });
  }

  // Status filter (multiple)
  if (params.statuses && params.statuses.length > 0) {
    filter.push({ terms: { status: params.statuses } });
  }

  // Assigned to filter
  if (params.assignedTo) {
    filter.push({ term: { assignedTo: params.assignedTo } });
  }

  // Stockroom filter
  if (params.stockroomId) {
    filter.push({ term: { stockroomId: params.stockroomId } });
  }

  // Manufacturer filter
  if (params.manufacturer) {
    filter.push({ term: { manufacturer: params.manufacturer } });
  }

  // Model filter
  if (params.model) {
    filter.push({ term: { model: params.model } });
  }

  // Serial number filter
  if (params.serialNumber) {
    filter.push({ term: { serialNumber: params.serialNumber } });
  }

  // Date range filters
  if (params.createdAfter || params.createdBefore) {
    const range: Record<string, string> = {};
    if (params.createdAfter) range['gte'] = params.createdAfter;
    if (params.createdBefore) range['lte'] = params.createdBefore;
    filter.push({ range: { createdAt: range } });
  }

  if (params.updatedAfter || params.updatedBefore) {
    const range: Record<string, string> = {};
    if (params.updatedAfter) range['gte'] = params.updatedAfter;
    if (params.updatedBefore) range['lte'] = params.updatedBefore;
    filter.push({ range: { updatedAt: range } });
  }

  // Build the final query
  if (must.length === 0 && filter.length === 0) {
    return { match_all: {} };
  }

  return {
    bool: {
      ...(must.length > 0 ? { must } : {}),
      ...(filter.length > 0 ? { filter } : {}),
    },
  };
}

/**
 * Build sort configuration
 */
function buildSort(sort?: SearchSortParams): Array<Record<string, unknown>> {
  const field = sort?.field && VALID_SORT_FIELDS.has(sort.field)
    ? sort.field
    : DEFAULT_SORT_FIELD;
  const direction = sort?.direction ?? DEFAULT_SORT_DIRECTION;

  // For text fields, use the keyword sub-field
  const sortField = field === 'displayName' ? 'displayName.keyword' : field;

  return [
    { [sortField]: { order: direction } },
    { assetId: { order: 'asc' } }, // Secondary sort for consistency
  ];
}

/**
 * Build highlight configuration for search results
 */
function buildHighlight(config?: HighlightConfig): Record<string, unknown> | undefined {
  if (!config?.enabled) {
    return undefined;
  }

  const fields = config.fields ?? ['displayName', 'description', 'assetTag', 'serialNumber'];
  const preTag = config.preTag ?? '<em>';
  const postTag = config.postTag ?? '</em>';

  const highlightFields: Record<string, Record<string, unknown>> = {};
  for (const field of fields) {
    highlightFields[field] = {};
  }

  return {
    pre_tags: [preTag],
    post_tags: [postTag],
    fields: highlightFields,
    fragment_size: 150,
    number_of_fragments: 3,
  };
}

/**
 * Build aggregations for faceted search
 */
function buildAggregations(): Record<string, unknown> {
  return {
    byType: {
      terms: {
        field: 'assetType',
        size: 10,
      },
    },
    byStatus: {
      terms: {
        field: 'status',
        size: 15,
      },
    },
    byManufacturer: {
      terms: {
        field: 'manufacturer',
        size: 20,
      },
    },
  };
}

/**
 * Parse aggregation results from OpenSearch response
 */
function parseAggregations(
  aggs: Record<string, { buckets?: Array<{ key: string; doc_count: number }> }> | undefined
): SearchAggregations | undefined {
  if (!aggs) {
    return undefined;
  }

  const mapBuckets = (buckets?: Array<{ key: string; doc_count: number }>): AggregationBucket[] => {
    return (buckets ?? []).map((bucket) => ({
      key: bucket.key,
      count: bucket.doc_count,
    }));
  };

  return {
    byType: mapBuckets(aggs['byType']?.buckets),
    byStatus: mapBuckets(aggs['byStatus']?.buckets),
    byManufacturer: mapBuckets(aggs['byManufacturer']?.buckets),
  };
}

/**
 * Extract highlights from search hit
 */
function extractHighlights(
  hit: { highlight?: Record<string, string[]> }
): Record<string, readonly string[]> | undefined {
  if (!hit.highlight) {
    return undefined;
  }

  const highlights: Record<string, readonly string[]> = {};
  for (const [field, fragments] of Object.entries(hit.highlight)) {
    highlights[field] = fragments;
  }
  return highlights;
}

/**
 * Map OpenSearch hit to Asset
 */
function mapHitToAsset(hit: { _source: AssetDocument; _score?: number }): Asset {
  const source = hit._source;
  return {
    assetId: source.assetId,
    assetTag: source.assetTag,
    assetType: source.assetType,
    displayName: source.displayName,
    description: source.description,
    status: source.status,
    substatus: source.substatus,
    createdAt: source.createdAt,
    updatedAt: source.updatedAt,
    createdBy: source.createdBy,
    updatedBy: source.updatedBy,
  };
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
export async function searchAssets(
  params: AssetSearchParams,
  options: SearchOptions = {}
): Promise<SearchResult<Asset>> {
  const startTime = Date.now();
  const client = getOpenSearchClient();

  const { pagination = {}, sort, highlight, includeAggregations } = options;
  const page = pagination.page ?? 1;
  const limit = Math.min(pagination.limit ?? 20, 100); // Cap at 100
  const from = (page - 1) * limit;

  logger.info('Searching assets', { params, page, limit });

  try {
    // Build the search request body
    const searchBody: Record<string, unknown> = {
      query: buildSearchQuery(params),
      sort: buildSort(sort),
      from,
      size: limit,
      track_total_hits: true,
      // Performance optimization: only fetch needed fields
      _source: true,
    };

    // Add highlighting if enabled
    const highlightConfig = buildHighlight(highlight);
    if (highlightConfig) {
      searchBody['highlight'] = highlightConfig;
    }

    // Add aggregations if requested
    if (includeAggregations) {
      searchBody['aggs'] = buildAggregations();
    }

    const response = await client.search({
      index: ASSET_INDEX,
      body: searchBody,
      // Performance optimization: set request timeout (Requirement 10.6)
      timeout: `${REQUEST_TIMEOUT_MS}ms`,
    });

    const hits = response.body['hits'];
    const total = typeof hits.total === 'number' ? hits.total : hits.total.value;
    const items = hits.hits.map(mapHitToAsset);
    const took = Date.now() - startTime;

    // Extract highlights from first hit if available (for display purposes)
    const firstHitHighlights = hits.hits[0] ? extractHighlights(hits.hits[0]) : undefined;

    // Parse aggregations if present
    const aggregations = parseAggregations(response.body['aggregations']);

    logger.info('Search completed', {
      total,
      returned: items.length,
      took,
      opensearchTook: response.body['took'],
      hasHighlights: !!firstHitHighlights,
      hasAggregations: !!aggregations,
    });

    // Log warning if response time exceeds threshold (Requirement 10.6)
    if (took > PERFORMANCE_THRESHOLD_MS) {
      logger.warn('Search response time exceeded threshold', { 
        took, 
        threshold: PERFORMANCE_THRESHOLD_MS,
        params,
      });
    }

    return {
      items,
      total,
      page,
      limit,
      hasMore: from + items.length < total,
      maxScore: hits.max_score ?? undefined,
      took,
      highlights: firstHitHighlights,
      aggregations,
    };
  } catch (error) {
    const took = Date.now() - startTime;
    logger.error('Search failed', error as Error, { params, took });
    throw error;
  }
}

/**
 * Index an asset document
 */
export async function indexAsset(asset: AssetDocument): Promise<void> {
  const client = getOpenSearchClient();

  try {
    await client.index({
      index: ASSET_INDEX,
      id: asset.assetId,
      body: asset,
      refresh: 'wait_for', // Ensure immediate visibility
    });

    logger.debug('Asset indexed', { assetId: asset.assetId });
  } catch (error) {
    logger.error('Failed to index asset', error as Error, { assetId: asset.assetId });
    throw error;
  }
}

/**
 * Update an asset document
 */
export async function updateAssetDocument(
  assetId: string,
  updates: Partial<AssetDocument>
): Promise<void> {
  const client = getOpenSearchClient();

  try {
    await client.update({
      index: ASSET_INDEX,
      id: assetId,
      body: {
        doc: updates,
      },
      refresh: 'wait_for',
    });

    logger.debug('Asset document updated', { assetId });
  } catch (error) {
    logger.error('Failed to update asset document', error as Error, { assetId });
    throw error;
  }
}

/**
 * Delete an asset document
 */
export async function deleteAssetDocument(assetId: string): Promise<void> {
  const client = getOpenSearchClient();

  try {
    await client.delete({
      index: ASSET_INDEX,
      id: assetId,
      refresh: 'wait_for',
    });

    logger.debug('Asset document deleted', { assetId });
  } catch (error) {
    // Ignore not found errors
    if ((error as { statusCode?: number }).statusCode === 404) {
      logger.debug('Asset document not found for deletion', { assetId });
      return;
    }
    logger.error('Failed to delete asset document', error as Error, { assetId });
    throw error;
  }
}

/**
 * Bulk index multiple assets
 */
export async function bulkIndexAssets(assets: readonly AssetDocument[]): Promise<void> {
  if (assets.length === 0) return;

  const client = getOpenSearchClient();

  const body = assets.flatMap((asset) => [
    { index: { _index: ASSET_INDEX, _id: asset.assetId } },
    asset,
  ]);

  try {
    const response = await client.bulk({
      body,
      refresh: 'wait_for',
    });

    if (response.body['errors']) {
      const bulkErrors = response.body['items']
        .filter((item: { index?: { error?: unknown } }) => item.index?.error)
        .map((item: { index?: { error?: unknown } }) => item.index?.error);
      logger.error('Bulk index had errors', undefined, { bulkErrors });
    }

    logger.info('Bulk indexed assets', { count: assets.length });
  } catch (error) {
    logger.error('Failed to bulk index assets', error as Error);
    throw error;
  }
}

/**
 * Get asset by ID from OpenSearch
 */
export async function getAssetFromIndex(assetId: string): Promise<Asset | null> {
  const client = getOpenSearchClient();

  try {
    const response = await client.get({
      index: ASSET_INDEX,
      id: assetId,
    });

    if (!response.body['found']) {
      return null;
    }

    return mapHitToAsset({ _source: response.body['_source'] as AssetDocument, _score: 1 });
  } catch (error) {
    if ((error as { statusCode?: number }).statusCode === 404) {
      return null;
    }
    logger.error('Failed to get asset from index', error as Error, { assetId });
    throw error;
  }
}

/**
 * Get search suggestions for autocomplete
 * Implements fast prefix-based suggestions for asset search
 */
export async function getSearchSuggestions(
  prefix: string,
  limit: number = 10
): Promise<readonly SearchSuggestion[]> {
  if (!prefix || prefix.trim().length < 2) {
    return [];
  }

  const startTime = Date.now();
  const client = getOpenSearchClient();

  try {
    const response = await client.search({
      index: ASSET_INDEX,
      body: {
        query: {
          bool: {
            should: [
              {
                prefix: {
                  'displayName.keyword': {
                    value: prefix.toLowerCase(),
                    boost: 2,
                  },
                },
              },
              {
                match_phrase_prefix: {
                  'displayName.autocomplete': {
                    query: prefix,
                    max_expansions: 50,
                  },
                },
              },
              {
                prefix: {
                  assetTag: {
                    value: prefix.toUpperCase(),
                    boost: 3,
                  },
                },
              },
            ],
            minimum_should_match: 1,
          },
        },
        size: limit,
        _source: ['displayName', 'assetTag'],
      },
      timeout: `${PERFORMANCE_THRESHOLD_MS}ms`,
    });

    const took = Date.now() - startTime;
    const hits = response.body['hits'].hits;

    const suggestions: SearchSuggestion[] = hits.map(
      (hit: { _source: { displayName: string; assetTag: string }; _score: number }) => ({
        text: hit._source.displayName || hit._source.assetTag,
        score: hit._score,
      })
    );

    logger.debug('Search suggestions completed', { prefix, count: suggestions.length, took });

    return suggestions;
  } catch (error) {
    logger.error('Failed to get search suggestions', error as Error, { prefix });
    return [];
  }
}

/**
 * Search assets with aggregations only (no results)
 * Useful for getting facet counts without fetching documents
 */
export async function getSearchAggregations(
  params: AssetSearchParams
): Promise<SearchAggregations> {
  const startTime = Date.now();
  const client = getOpenSearchClient();

  try {
    const response = await client.search({
      index: ASSET_INDEX,
      body: {
        query: buildSearchQuery(params),
        size: 0, // Don't return any documents
        aggs: buildAggregations(),
      },
      timeout: `${PERFORMANCE_THRESHOLD_MS}ms`,
    });

    const took = Date.now() - startTime;
    const aggregations = parseAggregations(response.body['aggregations']) ?? {
      byType: [],
      byStatus: [],
      byManufacturer: [],
    };

    logger.debug('Aggregations completed', { took });

    return aggregations;
  } catch (error) {
    logger.error('Failed to get search aggregations', error as Error, { params });
    throw error;
  }
}

/**
 * Count assets matching search criteria
 * Optimized for counting without fetching documents
 */
export async function countAssets(params: AssetSearchParams): Promise<number> {
  const startTime = Date.now();
  const client = getOpenSearchClient();

  try {
    const response = await client.count({
      index: ASSET_INDEX,
      body: {
        query: buildSearchQuery(params),
      },
    });

    const took = Date.now() - startTime;
    const count = response.body['count'];

    logger.debug('Count completed', { count, took });

    return count;
  } catch (error) {
    logger.error('Failed to count assets', error as Error, { params });
    throw error;
  }
}

/**
 * Check if search service is healthy and responsive
 * Returns true if response time is within threshold
 */
export async function isSearchHealthy(): Promise<boolean> {
  const startTime = Date.now();
  const client = getOpenSearchClient();

  try {
    // Simple query to test responsiveness
    await client.search({
      index: ASSET_INDEX,
      body: {
        query: { match_all: {} },
        size: 1,
      },
      timeout: `${PERFORMANCE_THRESHOLD_MS}ms`,
    });

    const took = Date.now() - startTime;
    const isHealthy = took < PERFORMANCE_THRESHOLD_MS;

    if (!isHealthy) {
      logger.warn('Search service response time degraded', { took, threshold: PERFORMANCE_THRESHOLD_MS });
    }

    return isHealthy;
  } catch (error) {
    logger.error('Search health check failed', error as Error);
    return false;
  }
}
