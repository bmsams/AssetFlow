/**
 * OpenSearch index definitions and management
 *
 * Defines index mappings for asset search functionality.
 */
/**
 * Asset index name
 */
export declare const ASSET_INDEX = "assets";
/**
 * Asset index mapping for OpenSearch
 */
export declare const ASSET_INDEX_MAPPING: {
    mappings: {
        properties: {
            assetId: {
                type: string;
            };
            assetTag: {
                type: string;
            };
            assetType: {
                type: string;
            };
            displayName: {
                type: string;
                analyzer: string;
                fields: {
                    keyword: {
                        type: string;
                    };
                    autocomplete: {
                        type: string;
                        analyzer: string;
                        search_analyzer: string;
                    };
                };
            };
            description: {
                type: string;
                analyzer: string;
            };
            status: {
                type: string;
            };
            substatus: {
                type: string;
            };
            assignedTo: {
                type: string;
            };
            stockroomId: {
                type: string;
            };
            manufacturer: {
                type: string;
            };
            model: {
                type: string;
            };
            serialNumber: {
                type: string;
            };
            createdAt: {
                type: string;
            };
            updatedAt: {
                type: string;
            };
            createdBy: {
                type: string;
            };
            updatedBy: {
                type: string;
            };
        };
    };
    settings: {
        number_of_shards: number;
        number_of_replicas: number;
        analysis: {
            analyzer: {
                autocomplete: {
                    type: string;
                    tokenizer: string;
                    filter: string[];
                };
            };
            filter: {
                autocomplete_filter: {
                    type: string;
                    min_gram: number;
                    max_gram: number;
                };
            };
        };
    };
};
/**
 * Create the asset index if it doesn't exist
 */
export declare function ensureAssetIndex(): Promise<void>;
/**
 * Delete the asset index (for testing/reset)
 */
export declare function deleteAssetIndex(): Promise<void>;
/**
 * Refresh the asset index (force immediate visibility of changes)
 */
export declare function refreshAssetIndex(): Promise<void>;
//# sourceMappingURL=indices.d.ts.map