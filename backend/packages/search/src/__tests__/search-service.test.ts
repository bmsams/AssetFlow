/**
 * Search Service Unit Tests
 *
 * Tests for OpenSearch integration
 * Validates Requirements: 10.5, 10.6
 */

// Mock the OpenSearch client
const mockSearch = jest.fn();
const mockIndex = jest.fn();
const mockUpdate = jest.fn();
const mockDelete = jest.fn();
const mockGet = jest.fn();
const mockBulk = jest.fn();
const mockClusterHealth = jest.fn();
const mockCount = jest.fn();

jest.mock('@opensearch-project/opensearch', () => ({
  Client: jest.fn().mockImplementation(() => ({
    search: mockSearch,
    index: mockIndex,
    update: mockUpdate,
    delete: mockDelete,
    get: mockGet,
    bulk: mockBulk,
    count: mockCount,
    cluster: {
      health: mockClusterHealth,
    },
    close: jest.fn(),
  })),
}));

jest.mock('@opensearch-project/opensearch/aws', () => ({
  AwsSigv4Signer: jest.fn(() => ({})),
}));

jest.mock('@aws-sdk/credential-provider-node', () => ({
  defaultProvider: jest.fn(() => jest.fn()),
}));

jest.mock('@ams/utils', () => ({
  createLogger: jest.fn(() => ({
    debug: jest.fn(),
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
  })),
}));

import {
  searchAssets,
  indexAsset,
  updateAssetDocument,
  deleteAssetDocument,
  bulkIndexAssets,
  getAssetFromIndex,
  getSearchSuggestions,
  getSearchAggregations,
  countAssets,
  isSearchHealthy,
} from '../search-service';
import type { AssetDocument, AssetSearchParams, SearchOptions } from '../search-service';

describe('Search Service', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    // Reset environment variables
    process.env['OPENSEARCH_ENDPOINT'] = 'http://localhost:9200';
    process.env['OPENSEARCH_USE_AWS'] = 'false';
  });

  /**
   * Validates: Requirements 10.5
   * Full-text search with pagination, filtering, sorting
   */
  describe('searchAssets', () => {
    const mockSearchResponse = {
      body: {
        took: 25,
        hits: {
          total: { value: 2 },
          max_score: 1.5,
          hits: [
            {
              _id: 'asset-1',
              _score: 1.5,
              _source: {
                assetId: 'asset-1',
                assetTag: 'AMS-HW-001',
                assetType: 'HARDWARE',
                displayName: 'Test Laptop',
                status: 'DEPLOYED',
                createdAt: '2024-01-15T10:00:00.000Z',
                updatedAt: '2024-01-15T10:00:00.000Z',
              },
            },
            {
              _id: 'asset-2',
              _score: 1.2,
              _source: {
                assetId: 'asset-2',
                assetTag: 'AMS-HW-002',
                assetType: 'HARDWARE',
                displayName: 'Test Desktop',
                status: 'IN_STOCK',
                createdAt: '2024-01-15T11:00:00.000Z',
                updatedAt: '2024-01-15T11:00:00.000Z',
              },
            },
          ],
        },
      },
    };

    beforeEach(() => {
      mockSearch.mockResolvedValue(mockSearchResponse);
    });

    it('should search with full-text query', async () => {
      const params: AssetSearchParams = { query: 'laptop' };
      const result = await searchAssets(params);

      expect(mockSearch).toHaveBeenCalledWith(
        expect.objectContaining({
          index: 'assets',
          body: expect.objectContaining({
            query: expect.objectContaining({
              bool: expect.objectContaining({
                must: expect.arrayContaining([
                  expect.objectContaining({
                    multi_match: expect.objectContaining({
                      query: 'laptop',
                    }),
                  }),
                ]),
              }),
            }),
          }),
        })
      );

      expect(result.items).toHaveLength(2);
      expect(result.total).toBe(2);
      expect(result.maxScore).toBe(1.5);
    });

    it('should filter by asset type', async () => {
      const params: AssetSearchParams = { assetType: 'HARDWARE' };
      await searchAssets(params);

      expect(mockSearch).toHaveBeenCalledWith(
        expect.objectContaining({
          body: expect.objectContaining({
            query: expect.objectContaining({
              bool: expect.objectContaining({
                filter: expect.arrayContaining([
                  { term: { assetType: 'HARDWARE' } },
                ]),
              }),
            }),
          }),
        })
      );
    });

    it('should filter by status', async () => {
      const params: AssetSearchParams = { status: 'DEPLOYED' };
      await searchAssets(params);

      expect(mockSearch).toHaveBeenCalledWith(
        expect.objectContaining({
          body: expect.objectContaining({
            query: expect.objectContaining({
              bool: expect.objectContaining({
                filter: expect.arrayContaining([
                  { term: { status: 'DEPLOYED' } },
                ]),
              }),
            }),
          }),
        })
      );
    });

    it('should filter by multiple statuses', async () => {
      const params: AssetSearchParams = { statuses: ['DEPLOYED', 'IN_STOCK'] };
      await searchAssets(params);

      expect(mockSearch).toHaveBeenCalledWith(
        expect.objectContaining({
          body: expect.objectContaining({
            query: expect.objectContaining({
              bool: expect.objectContaining({
                filter: expect.arrayContaining([
                  { terms: { status: ['DEPLOYED', 'IN_STOCK'] } },
                ]),
              }),
            }),
          }),
        })
      );
    });

    it('should filter by date range', async () => {
      const params: AssetSearchParams = {
        createdAfter: '2024-01-01',
        createdBefore: '2024-12-31',
      };
      await searchAssets(params);

      expect(mockSearch).toHaveBeenCalledWith(
        expect.objectContaining({
          body: expect.objectContaining({
            query: expect.objectContaining({
              bool: expect.objectContaining({
                filter: expect.arrayContaining([
                  {
                    range: {
                      createdAt: {
                        gte: '2024-01-01',
                        lte: '2024-12-31',
                      },
                    },
                  },
                ]),
              }),
            }),
          }),
        })
      );
    });

    it('should support pagination', async () => {
      const params: AssetSearchParams = {};
      const options: SearchOptions = {
        pagination: { page: 2, limit: 10 },
      };
      await searchAssets(params, options);

      expect(mockSearch).toHaveBeenCalledWith(
        expect.objectContaining({
          body: expect.objectContaining({
            from: 10, // (page - 1) * limit
            size: 10,
          }),
        })
      );
    });

    it('should cap limit at 100', async () => {
      const params: AssetSearchParams = {};
      const options: SearchOptions = {
        pagination: { page: 1, limit: 200 },
      };
      await searchAssets(params, options);

      expect(mockSearch).toHaveBeenCalledWith(
        expect.objectContaining({
          body: expect.objectContaining({
            size: 100, // Capped at 100
          }),
        })
      );
    });

    it('should support sorting', async () => {
      const params: AssetSearchParams = {};
      const options: SearchOptions = {
        sort: { field: 'displayName', direction: 'asc' },
      };
      await searchAssets(params, options);

      expect(mockSearch).toHaveBeenCalledWith(
        expect.objectContaining({
          body: expect.objectContaining({
            sort: expect.arrayContaining([
              { 'displayName.keyword': { order: 'asc' } },
            ]),
          }),
        })
      );
    });

    it('should use default sort when not specified', async () => {
      const params: AssetSearchParams = {};
      await searchAssets(params);

      expect(mockSearch).toHaveBeenCalledWith(
        expect.objectContaining({
          body: expect.objectContaining({
            sort: expect.arrayContaining([
              { updatedAt: { order: 'desc' } },
            ]),
          }),
        })
      );
    });

    it('should return match_all query when no filters', async () => {
      const params: AssetSearchParams = {};
      await searchAssets(params);

      expect(mockSearch).toHaveBeenCalledWith(
        expect.objectContaining({
          body: expect.objectContaining({
            query: { match_all: {} },
          }),
        })
      );
    });

    it('should calculate hasMore correctly', async () => {
      const params: AssetSearchParams = {};
      const options: SearchOptions = {
        pagination: { page: 1, limit: 20 },
      };
      const result = await searchAssets(params, options);

      expect(result.hasMore).toBe(false); // 2 items, total 2
    });

    it('should include timing information', async () => {
      const params: AssetSearchParams = { query: 'laptop' };
      const result = await searchAssets(params);

      expect(result.took).toBeDefined();
      expect(typeof result.took).toBe('number');
    });
  });

  /**
   * Index operations
   */
  describe('indexAsset', () => {
    const mockAsset: AssetDocument = {
      assetId: 'asset-1',
      assetTag: 'AMS-HW-001',
      assetType: 'HARDWARE',
      displayName: 'Test Laptop',
      status: 'DEPLOYED',
      createdAt: '2024-01-15T10:00:00.000Z',
      updatedAt: '2024-01-15T10:00:00.000Z',
    };

    beforeEach(() => {
      mockIndex.mockResolvedValue({ body: { result: 'created' } });
    });

    it('should index an asset document', async () => {
      await indexAsset(mockAsset);

      expect(mockIndex).toHaveBeenCalledWith({
        index: 'assets',
        id: 'asset-1',
        body: mockAsset,
        refresh: 'wait_for',
      });
    });

    it('should throw on index error', async () => {
      mockIndex.mockRejectedValue(new Error('Index failed'));

      await expect(indexAsset(mockAsset)).rejects.toThrow('Index failed');
    });
  });

  describe('updateAssetDocument', () => {
    beforeEach(() => {
      mockUpdate.mockResolvedValue({ body: { result: 'updated' } });
    });

    it('should update an asset document', async () => {
      await updateAssetDocument('asset-1', { displayName: 'Updated Laptop' });

      expect(mockUpdate).toHaveBeenCalledWith({
        index: 'assets',
        id: 'asset-1',
        body: {
          doc: { displayName: 'Updated Laptop' },
        },
        refresh: 'wait_for',
      });
    });
  });

  describe('deleteAssetDocument', () => {
    beforeEach(() => {
      mockDelete.mockResolvedValue({ body: { result: 'deleted' } });
    });

    it('should delete an asset document', async () => {
      await deleteAssetDocument('asset-1');

      expect(mockDelete).toHaveBeenCalledWith({
        index: 'assets',
        id: 'asset-1',
        refresh: 'wait_for',
      });
    });

    it('should ignore not found errors', async () => {
      const notFoundError = new Error('Not found');
      (notFoundError as Error & { statusCode: number }).statusCode = 404;
      mockDelete.mockRejectedValue(notFoundError);

      await expect(deleteAssetDocument('asset-1')).resolves.not.toThrow();
    });
  });

  describe('bulkIndexAssets', () => {
    const mockAssets: AssetDocument[] = [
      {
        assetId: 'asset-1',
        assetTag: 'AMS-HW-001',
        assetType: 'HARDWARE',
        displayName: 'Laptop 1',
        status: 'DEPLOYED',
        createdAt: '2024-01-15T10:00:00.000Z',
        updatedAt: '2024-01-15T10:00:00.000Z',
      },
      {
        assetId: 'asset-2',
        assetTag: 'AMS-HW-002',
        assetType: 'HARDWARE',
        displayName: 'Laptop 2',
        status: 'IN_STOCK',
        createdAt: '2024-01-15T11:00:00.000Z',
        updatedAt: '2024-01-15T11:00:00.000Z',
      },
    ];

    beforeEach(() => {
      mockBulk.mockResolvedValue({
        body: {
          errors: false,
          items: [
            { index: { result: 'created' } },
            { index: { result: 'created' } },
          ],
        },
      });
    });

    it('should bulk index multiple assets', async () => {
      await bulkIndexAssets(mockAssets);

      expect(mockBulk).toHaveBeenCalledWith({
        body: expect.arrayContaining([
          { index: { _index: 'assets', _id: 'asset-1' } },
          mockAssets[0],
          { index: { _index: 'assets', _id: 'asset-2' } },
          mockAssets[1],
        ]),
        refresh: 'wait_for',
      });
    });

    it('should handle empty array', async () => {
      await bulkIndexAssets([]);

      expect(mockBulk).not.toHaveBeenCalled();
    });
  });

  describe('getAssetFromIndex', () => {
    beforeEach(() => {
      mockGet.mockResolvedValue({
        body: {
          found: true,
          _source: {
            assetId: 'asset-1',
            assetTag: 'AMS-HW-001',
            assetType: 'HARDWARE',
            displayName: 'Test Laptop',
            status: 'DEPLOYED',
            createdAt: '2024-01-15T10:00:00.000Z',
            updatedAt: '2024-01-15T10:00:00.000Z',
          },
        },
      });
    });

    it('should get an asset from the index', async () => {
      const result = await getAssetFromIndex('asset-1');

      expect(mockGet).toHaveBeenCalledWith({
        index: 'assets',
        id: 'asset-1',
      });
      expect(result).not.toBeNull();
      expect(result?.assetId).toBe('asset-1');
    });

    it('should return null for not found', async () => {
      mockGet.mockResolvedValue({ body: { found: false } });

      const result = await getAssetFromIndex('non-existent');

      expect(result).toBeNull();
    });

    it('should return null on 404 error', async () => {
      const notFoundError = new Error('Not found');
      (notFoundError as Error & { statusCode: number }).statusCode = 404;
      mockGet.mockRejectedValue(notFoundError);

      const result = await getAssetFromIndex('non-existent');

      expect(result).toBeNull();
    });
  });

  /**
   * Validates: Requirements 10.5
   * Highlighting and aggregations for enhanced search
   */
  describe('searchAssets with highlighting', () => {
    const mockSearchResponseWithHighlight = {
      body: {
        took: 25,
        hits: {
          total: { value: 1 },
          max_score: 1.5,
          hits: [
            {
              _id: 'asset-1',
              _score: 1.5,
              _source: {
                assetId: 'asset-1',
                assetTag: 'AMS-HW-001',
                assetType: 'HARDWARE',
                displayName: 'Test Laptop',
                status: 'DEPLOYED',
                createdAt: '2024-01-15T10:00:00.000Z',
                updatedAt: '2024-01-15T10:00:00.000Z',
              },
              highlight: {
                displayName: ['Test <em>Laptop</em>'],
                description: ['A <em>laptop</em> for testing'],
              },
            },
          ],
        },
      },
    };

    beforeEach(() => {
      mockSearch.mockResolvedValue(mockSearchResponseWithHighlight);
    });

    it('should include highlight configuration when enabled', async () => {
      const params: AssetSearchParams = { query: 'laptop' };
      const options: SearchOptions = {
        highlight: { enabled: true },
      };
      await searchAssets(params, options);

      expect(mockSearch).toHaveBeenCalledWith(
        expect.objectContaining({
          body: expect.objectContaining({
            highlight: expect.objectContaining({
              pre_tags: ['<em>'],
              post_tags: ['</em>'],
              fields: expect.any(Object),
            }),
          }),
        })
      );
    });

    it('should use custom highlight tags', async () => {
      const params: AssetSearchParams = { query: 'laptop' };
      const options: SearchOptions = {
        highlight: { 
          enabled: true, 
          preTag: '<mark>', 
          postTag: '</mark>' 
        },
      };
      await searchAssets(params, options);

      expect(mockSearch).toHaveBeenCalledWith(
        expect.objectContaining({
          body: expect.objectContaining({
            highlight: expect.objectContaining({
              pre_tags: ['<mark>'],
              post_tags: ['</mark>'],
            }),
          }),
        })
      );
    });

    it('should return highlights in result', async () => {
      const params: AssetSearchParams = { query: 'laptop' };
      const options: SearchOptions = {
        highlight: { enabled: true },
      };
      const result = await searchAssets(params, options);

      expect(result.highlights).toBeDefined();
      expect(result.highlights?.['displayName']).toContain('Test <em>Laptop</em>');
    });
  });

  describe('searchAssets with aggregations', () => {
    const mockSearchResponseWithAggs = {
      body: {
        took: 30,
        hits: {
          total: { value: 10 },
          max_score: 1.0,
          hits: [],
        },
        aggregations: {
          byType: {
            buckets: [
              { key: 'HARDWARE', doc_count: 5 },
              { key: 'SOFTWARE', doc_count: 3 },
              { key: 'ENTERPRISE', doc_count: 2 },
            ],
          },
          byStatus: {
            buckets: [
              { key: 'DEPLOYED', doc_count: 4 },
              { key: 'IN_STOCK', doc_count: 3 },
              { key: 'RETIRED', doc_count: 3 },
            ],
          },
          byManufacturer: {
            buckets: [
              { key: 'Dell', doc_count: 4 },
              { key: 'HP', doc_count: 3 },
              { key: 'Lenovo', doc_count: 3 },
            ],
          },
        },
      },
    };

    beforeEach(() => {
      mockSearch.mockResolvedValue(mockSearchResponseWithAggs);
    });

    it('should include aggregations when requested', async () => {
      const params: AssetSearchParams = {};
      const options: SearchOptions = {
        includeAggregations: true,
      };
      await searchAssets(params, options);

      expect(mockSearch).toHaveBeenCalledWith(
        expect.objectContaining({
          body: expect.objectContaining({
            aggs: expect.objectContaining({
              byType: expect.any(Object),
              byStatus: expect.any(Object),
              byManufacturer: expect.any(Object),
            }),
          }),
        })
      );
    });

    it('should return parsed aggregations', async () => {
      const params: AssetSearchParams = {};
      const options: SearchOptions = {
        includeAggregations: true,
      };
      const result = await searchAssets(params, options);

      expect(result.aggregations).toBeDefined();
      expect(result.aggregations?.byType).toHaveLength(3);
      expect(result.aggregations?.byType?.[0]).toEqual({ key: 'HARDWARE', count: 5 });
      expect(result.aggregations?.byStatus).toHaveLength(3);
      expect(result.aggregations?.byManufacturer).toHaveLength(3);
    });
  });

  /**
   * Validates: Requirements 10.5
   * Search suggestions for autocomplete
   */
  describe('getSearchSuggestions', () => {
    const mockSuggestionsResponse = {
      body: {
        took: 10,
        hits: {
          total: { value: 3 },
          hits: [
            {
              _score: 2.5,
              _source: { displayName: 'Laptop Pro', assetTag: 'AMS-HW-001' },
            },
            {
              _score: 2.0,
              _source: { displayName: 'Laptop Standard', assetTag: 'AMS-HW-002' },
            },
            {
              _score: 1.5,
              _source: { displayName: 'Laptop Basic', assetTag: 'AMS-HW-003' },
            },
          ],
        },
      },
    };

    beforeEach(() => {
      mockSearch.mockResolvedValue(mockSuggestionsResponse);
    });

    it('should return suggestions for valid prefix', async () => {
      const suggestions = await getSearchSuggestions('lap');

      expect(suggestions).toHaveLength(3);
      expect(suggestions[0]).toEqual({ text: 'Laptop Pro', score: 2.5 });
    });

    it('should return empty array for short prefix', async () => {
      const suggestions = await getSearchSuggestions('l');

      expect(suggestions).toHaveLength(0);
      expect(mockSearch).not.toHaveBeenCalled();
    });

    it('should return empty array for empty prefix', async () => {
      const suggestions = await getSearchSuggestions('');

      expect(suggestions).toHaveLength(0);
      expect(mockSearch).not.toHaveBeenCalled();
    });

    it('should respect limit parameter', async () => {
      await getSearchSuggestions('lap', 5);

      expect(mockSearch).toHaveBeenCalledWith(
        expect.objectContaining({
          body: expect.objectContaining({
            size: 5,
          }),
        })
      );
    });
  });

  /**
   * Validates: Requirements 10.5
   * Aggregations-only search
   */
  describe('getSearchAggregations', () => {
    const mockAggsOnlyResponse = {
      body: {
        took: 15,
        hits: {
          total: { value: 100 },
          hits: [],
        },
        aggregations: {
          byType: {
            buckets: [
              { key: 'HARDWARE', doc_count: 50 },
              { key: 'SOFTWARE', doc_count: 30 },
            ],
          },
          byStatus: {
            buckets: [
              { key: 'DEPLOYED', doc_count: 40 },
            ],
          },
          byManufacturer: {
            buckets: [
              { key: 'Dell', doc_count: 25 },
            ],
          },
        },
      },
    };

    beforeEach(() => {
      mockSearch.mockResolvedValue(mockAggsOnlyResponse);
    });

    it('should return aggregations without documents', async () => {
      const params: AssetSearchParams = { assetType: 'HARDWARE' };
      const result = await getSearchAggregations(params);

      expect(mockSearch).toHaveBeenCalledWith(
        expect.objectContaining({
          body: expect.objectContaining({
            size: 0, // No documents
            aggs: expect.any(Object),
          }),
        })
      );

      expect(result.byType).toHaveLength(2);
      expect(result.byStatus).toHaveLength(1);
    });
  });

  /**
   * Validates: Requirements 10.5
   * Count assets
   */
  describe('countAssets', () => {
    beforeEach(() => {
      mockCount.mockResolvedValue({
        body: { count: 42 },
      });
    });

    it('should return count of matching assets', async () => {
      const params: AssetSearchParams = { assetType: 'HARDWARE' };
      const count = await countAssets(params);

      expect(count).toBe(42);
      expect(mockCount).toHaveBeenCalledWith(
        expect.objectContaining({
          index: 'assets',
          body: expect.objectContaining({
            query: expect.any(Object),
          }),
        })
      );
    });
  });

  /**
   * Validates: Requirements 10.6
   * Health check for sub-500ms response times
   */
  describe('isSearchHealthy', () => {
    it('should return true when search is responsive', async () => {
      mockSearch.mockResolvedValue({
        body: {
          took: 10,
          hits: { total: { value: 0 }, hits: [] },
        },
      });

      const isHealthy = await isSearchHealthy();

      expect(isHealthy).toBe(true);
    });

    it('should return false when search fails', async () => {
      mockSearch.mockRejectedValue(new Error('Connection failed'));

      const isHealthy = await isSearchHealthy();

      expect(isHealthy).toBe(false);
    });
  });

  /**
   * Validates: Requirements 10.5
   * Relevance scoring with field boosting
   */
  describe('relevance scoring', () => {
    const mockSearchResponse = {
      body: {
        took: 25,
        hits: {
          total: { value: 1 },
          max_score: 5.0,
          hits: [
            {
              _id: 'asset-1',
              _score: 5.0,
              _source: {
                assetId: 'asset-1',
                assetTag: 'AMS-HW-001',
                assetType: 'HARDWARE',
                displayName: 'Test Laptop',
                status: 'DEPLOYED',
                createdAt: '2024-01-15T10:00:00.000Z',
                updatedAt: '2024-01-15T10:00:00.000Z',
              },
            },
          ],
        },
      },
    };

    beforeEach(() => {
      mockSearch.mockResolvedValue(mockSearchResponse);
    });

    it('should use multi_match with field boosting', async () => {
      const params: AssetSearchParams = { query: 'laptop' };
      await searchAssets(params);

      expect(mockSearch).toHaveBeenCalledWith(
        expect.objectContaining({
          body: expect.objectContaining({
            query: expect.objectContaining({
              bool: expect.objectContaining({
                must: expect.arrayContaining([
                  expect.objectContaining({
                    multi_match: expect.objectContaining({
                      query: 'laptop',
                      fields: expect.arrayContaining([
                        'displayName^3',
                        'assetTag^4',
                        'serialNumber^4',
                      ]),
                      fuzziness: 'AUTO',
                      minimum_should_match: '75%',
                    }),
                  }),
                ]),
              }),
            }),
          }),
        })
      );
    });

    it('should return maxScore in results', async () => {
      const params: AssetSearchParams = { query: 'laptop' };
      const result = await searchAssets(params);

      expect(result.maxScore).toBe(5.0);
    });
  });
});
