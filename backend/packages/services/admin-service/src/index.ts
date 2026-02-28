/**
 * @ams/admin-service - Administrative Service
 *
 * Provides administrative operations including:
 * - Location Service (Requirements 1-4): Building, Floor, Room, Rack management
 * - Stockroom Admin Service (Requirements 5-6): Stockroom CRUD, Bin/Shelf locations
 * - Reference Data Service (Requirements 7-11): Departments, Cost Centers, Vendors, Manufacturers, Models
 * - User Admin Service (Requirement 12): User administration and role management
 */

// Export location module with namespace to avoid conflicts
export * as location from './location';

// Export stockroom admin module with namespace
export * as stockroom from './stockroom';

// Export reference data module with namespace
export * as referenceData from './reference-data';

// Export user admin module with namespace
export * as userAdmin from './user-admin';

// Export handlers for Lambda functions
export * as handlers from './handlers';
