/**
 * @ams/types - Shared TypeScript types for Asset Management System
 *
 * This package contains all shared type definitions used across
 * the backend services.
 */

// Core asset types
export * from './asset';
export * from './hardware-asset';
export * from './software-asset';
export * from './enterprise-asset';

// Supporting types
export * from './contract';
export * from './stockroom';
export * from './user';
export * from './audit';

// API types
export * from './api';
export * from './events';

// Common types
export * from './common';

// Location hierarchy types
export * from './location';

// Reference data types
export * from './reference-data';

// Purchase order types
export * from './purchase-order';

// Report types
export * from './report';

// Notification types
export * from './notification';

// Lifecycle types
export * from './lifecycle';

// Integration types
export * from './integration';
