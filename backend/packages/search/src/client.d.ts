/**
 * OpenSearch client configuration and connection management
 *
 * Provides a singleton OpenSearch client for full-text search operations.
 * Implements Requirement 10.5: Full-text asset search with sub-second response times
 */
import { Client } from '@opensearch-project/opensearch';
/**
 * OpenSearch configuration
 */
export interface OpenSearchConfig {
    readonly endpoint: string;
    readonly region: string;
    readonly useAws: boolean;
}
/**
 * Get or create the OpenSearch client singleton
 */
export declare function getOpenSearchClient(): Client;
/**
 * Close the OpenSearch client connection
 */
export declare function closeOpenSearchClient(): Promise<void>;
/**
 * Check if OpenSearch is available
 */
export declare function isOpenSearchAvailable(): Promise<boolean>;
//# sourceMappingURL=client.d.ts.map