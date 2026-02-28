/**
 * OpenSearch client configuration and connection management
 *
 * Provides a singleton OpenSearch client for full-text search operations.
 * Implements Requirement 10.5: Full-text asset search with sub-second response times
 */

import { Client } from '@opensearch-project/opensearch';
import { AwsSigv4Signer } from '@opensearch-project/opensearch/aws';
import { defaultProvider } from '@aws-sdk/credential-provider-node';
import { createLogger } from '@ams/utils';

const logger = createLogger({ service: 'opensearch-client' });

/**
 * OpenSearch configuration
 */
export interface OpenSearchConfig {
  readonly endpoint: string;
  readonly region: string;
  readonly useAws: boolean;
}

let client: Client | null = null;
let currentConfig: OpenSearchConfig | null = null;

/**
 * Get OpenSearch configuration from environment
 */
function getConfig(): OpenSearchConfig {
  const endpoint = process.env['OPENSEARCH_ENDPOINT'];
  if (!endpoint) {
    logger.warn('OPENSEARCH_ENDPOINT not set — OpenSearch operations will fail');
    throw new Error('OPENSEARCH_ENDPOINT environment variable is required');
  }
  return {
    endpoint,
    region: process.env['AWS_REGION'] ?? 'us-east-1',
    useAws: process.env['OPENSEARCH_USE_AWS'] === 'true',
  };
}


/**
 * Create OpenSearch client with AWS Sigv4 authentication
 */
function createAwsClient(config: OpenSearchConfig): Client {
  return new Client({
    ...AwsSigv4Signer({
      region: config.region,
      service: 'es',
      getCredentials: () => {
        const credentialsProvider = defaultProvider();
        return credentialsProvider();
      },
    }),
    node: config.endpoint,
    requestTimeout: 30000,
    maxRetries: 3,
  });
}

/**
 * Create local OpenSearch client (for development)
 */
function createLocalClient(config: OpenSearchConfig): Client {
  return new Client({
    node: config.endpoint,
    requestTimeout: 30000,
    maxRetries: 3,
  });
}

/**
 * Get or create the OpenSearch client singleton
 */
export function getOpenSearchClient(): Client {
  const config = getConfig();

  // Return existing client if config hasn't changed
  if (client && currentConfig?.endpoint === config.endpoint) {
    return client;
  }

  logger.info('Creating OpenSearch client', {
    endpoint: config.endpoint,
    region: config.region,
    useAws: config.useAws,
  });

  client = config.useAws
    ? createAwsClient(config)
    : createLocalClient(config);

  currentConfig = config;
  return client;
}

/**
 * Close the OpenSearch client connection
 */
export async function closeOpenSearchClient(): Promise<void> {
  if (client) {
    await client.close();
    client = null;
    currentConfig = null;
    logger.info('OpenSearch client closed');
  }
}

/**
 * Check if OpenSearch is available
 */
export async function isOpenSearchAvailable(): Promise<boolean> {
  try {
    const opensearch = getOpenSearchClient();
    const response = await opensearch.cluster.health({});
    return response.body['status'] !== 'red';
  } catch (error) {
    logger.warn('OpenSearch health check failed', { error: (error as Error).message });
    return false;
  }
}
