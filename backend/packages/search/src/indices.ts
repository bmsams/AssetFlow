/**
 * OpenSearch index definitions and management
 *
 * Defines index mappings for asset search functionality.
 */

import { createLogger } from '@ams/utils';

import { getOpenSearchClient } from './client';

const logger = createLogger({ service: 'opensearch-indices' });

/**
 * Asset index name
 */
export const ASSET_INDEX = 'assets';

/**
 * Asset index mapping for OpenSearch
 */
export const ASSET_INDEX_MAPPING = {
  mappings: {
    properties: {
      assetId: { type: 'keyword' },
      assetTag: { type: 'keyword' },
      assetType: { type: 'keyword' },
      displayName: {
        type: 'text',
        analyzer: 'standard',
        fields: {
          keyword: { type: 'keyword' },
          autocomplete: {
            type: 'text',
            analyzer: 'autocomplete',
            search_analyzer: 'standard',
          },
        },
      },
      description: {
        type: 'text',
        analyzer: 'standard',
      },
      status: { type: 'keyword' },
      substatus: { type: 'keyword' },
      assignedTo: { type: 'keyword' },
      stockroomId: { type: 'keyword' },
      manufacturer: { type: 'keyword' },
      model: { type: 'keyword' },
      serialNumber: { type: 'keyword' },
      createdAt: { type: 'date' },
      updatedAt: { type: 'date' },
      createdBy: { type: 'keyword' },
      updatedBy: { type: 'keyword' },
    },
  },
  settings: {
    number_of_shards: 2,
    number_of_replicas: 1,
    analysis: {
      analyzer: {
        autocomplete: {
          type: 'custom',
          tokenizer: 'standard',
          filter: ['lowercase', 'autocomplete_filter'],
        },
      },
      filter: {
        autocomplete_filter: {
          type: 'edge_ngram',
          min_gram: 2,
          max_gram: 20,
        },
      },
    },
  },
};

/**
 * Create the asset index if it doesn't exist
 */
export async function ensureAssetIndex(): Promise<void> {
  const client = getOpenSearchClient();

  try {
    const exists = await client.indices.exists({ index: ASSET_INDEX });

    if (!exists.body) {
      logger.info('Creating asset index', { index: ASSET_INDEX });
      await client.indices.create({
        index: ASSET_INDEX,
        body: ASSET_INDEX_MAPPING,
      });
      logger.info('Asset index created successfully');
    } else {
      logger.debug('Asset index already exists');
    }
  } catch (error) {
    logger.error('Failed to ensure asset index', error as Error);
    throw error;
  }
}

/**
 * Delete the asset index (for testing/reset)
 */
export async function deleteAssetIndex(): Promise<void> {
  const client = getOpenSearchClient();

  try {
    const exists = await client.indices.exists({ index: ASSET_INDEX });

    if (exists.body) {
      await client.indices.delete({ index: ASSET_INDEX });
      logger.info('Asset index deleted');
    }
  } catch (error) {
    logger.error('Failed to delete asset index', error as Error);
    throw error;
  }
}

/**
 * Refresh the asset index (force immediate visibility of changes)
 */
export async function refreshAssetIndex(): Promise<void> {
  const client = getOpenSearchClient();
  await client.indices.refresh({ index: ASSET_INDEX });
}
