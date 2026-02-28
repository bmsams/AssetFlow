/**
 * Procurement Service
 *
 * Provides purchase order management, approval workflows, and line item operations
 * for the Asset Management System.
 *
 * Modules:
 * - purchase-order: PO CRUD and lifecycle management
 * - approval: Approval workflow with threshold routing
 * - requisition: Requisition lifecycle and requisition-to-PO conversion
 * - accounting: Procurement accounting postings and distribution propagation
 */

// Purchase Order exports
export * from './purchase-order';

// Approval exports
export * from './approval';

// Requisition exports
export * from './requisition';

// Accounting exports
export * from './accounting';

// Handler exports
export * from './handlers';
