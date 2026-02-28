/**
 * @ams/asset-service - Core Asset Service
 *
 * Provides CRUD operations and lifecycle management for assets.
 * Implements Requirements 2.1, 2.6, 2.7 for asset management.
 * Implements Requirements 10.5, 10.6 for search functionality.
 */

// Export handlers with named exports to avoid conflicts
export { handler as createAssetHandler } from './handlers/create-asset';
export { handler as getAssetHandler } from './handlers/get-asset';
export { handler as updateAssetHandler } from './handlers/update-asset';
export { handler as deleteAssetHandler } from './handlers/delete-asset';
export { handler as listAssetsHandler } from './handlers/list-assets';
export { handler as searchAssetsHandler } from './handlers/search-assets';
export { handler as transitionStateHandler } from './handlers/transition-state';
export { handler as getAuditLogHandler } from './handlers/get-audit-log';

// Export service layer (service takes precedence over repository)
export * from './service/asset-service';
