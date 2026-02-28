/**
 * @ams/seed-data - Shared Seed Data for Asset Management System
 *
 * This package contains all seed data definitions used for database seeding
 * in both the migration-runner Lambda and the local seed script.
 *
 * Validates: Requirements 3.1-3.12 from real-api-integration spec
 */

// Types
export * from './types';

// Constants
export * from './constants';

// Utilities
export * from './utils';

// Seed Data
export { DEPARTMENTS } from './departments';
export { USERS } from './users';
export { STOCKROOMS } from './stockrooms';
export { MANUFACTURERS } from './manufacturers';
export { MODELS, MODEL_CATEGORIES, MODELS_BY_CATEGORY } from './models';
export { FACILITIES } from './facilities';
export { VENDORS } from './vendors';
export { CONTRACTS } from './contracts';
export { SOFTWARE_PRODUCTS, ENTITLEMENTS } from './software-products';
export { ENTERPRISE_ASSETS, MAINTENANCE_PLANS } from './enterprise-assets';
export { PURCHASE_ORDERS } from './purchase-orders';

// HAM Operations
export { TRANSFER_ORDERS, LOANER_CHECKOUTS, DISPOSAL_WORKFLOWS } from './ham-operations';

// EAM Operations
export { WORK_ORDERS, SPARE_PARTS, LINEAR_ASSETS } from './eam-operations';
