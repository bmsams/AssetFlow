/**
 * Reference data types for the Asset Management System
 *
 * This module defines extended types for administrative CRUD operations.
 * These types extend or complement the basic types in other modules
 * (contract.ts, hardware-asset.ts, user.ts) with additional fields
 * needed for full administrative control.
 */

import type { UUID, ISODateString } from './common';

// ============================================================================
// Vendor Types
// ============================================================================

/**
 * Types of vendors in the system
 */
export type VendorType =
  | 'MANUFACTURER'
  | 'RESELLER'
  | 'DISTRIBUTOR'
  | 'SERVICE_PROVIDER'
  | 'CONSULTANT'
  | 'CONTRACTOR'
  | 'LESSOR'
  | 'OTHER';

/**
 * Vendor rating status for procurement decisions
 */
export type VendorRating =
  | 'PREFERRED'
  | 'APPROVED'
  | 'CONDITIONAL'
  | 'PROBATION'
  | 'SUSPENDED'
  | 'BLACKLISTED';

// ============================================================================
// Model Types
// ============================================================================

/**
 * Model lifecycle status
 */
export type ModelStatus = 'ACTIVE' | 'DEPRECATED' | 'END_OF_LIFE';

// ============================================================================
// Department Admin Interfaces
// ============================================================================

/**
 * Extended department entity with full details for admin operations
 */
export interface DepartmentDetails {
  readonly departmentId: UUID;
  readonly code: string;
  readonly name: string;
  readonly parentDepartmentId: UUID | null;
  readonly isActive: boolean;
  readonly childDepartments?: readonly DepartmentDetails[];
  readonly createdAt: ISODateString;
  readonly updatedAt: ISODateString;
}

/**
 * Request payload for creating a new department
 */
export interface CreateDepartmentRequest {
  readonly code: string;
  readonly name: string;
  readonly parentDepartmentId?: UUID;
}

/**
 * Request payload for updating an existing department
 */
export interface UpdateDepartmentRequest {
  readonly name?: string;
  readonly parentDepartmentId?: UUID;
  readonly isActive?: boolean;
}

/**
 * Filters for listing departments
 */
export interface DepartmentListFilters {
  readonly parentDepartmentId?: UUID;
  readonly isActive?: boolean;
  readonly includeHierarchy?: boolean;
  readonly search?: string;
}

// ============================================================================
// Cost Center Admin Interfaces
// ============================================================================

/**
 * Extended cost center entity with full details for admin operations
 */
export interface CostCenterDetails {
  readonly costCenterId: UUID;
  readonly code: string;
  readonly name: string;
  readonly departmentId: UUID | null;
  readonly budgetAmount: number;
  readonly spentAmount: number;
  readonly availableAmount: number;
  readonly fiscalYear: number;
  readonly isActive: boolean;
  readonly createdAt: ISODateString;
  readonly updatedAt: ISODateString;
}

/**
 * Request payload for creating a new cost center
 */
export interface CreateCostCenterRequest {
  readonly code: string;
  readonly name: string;
  readonly departmentId?: UUID;
  readonly budgetAmount: number;
  readonly fiscalYear: number;
}

/**
 * Request payload for updating an existing cost center
 */
export interface UpdateCostCenterRequest {
  readonly name?: string;
  readonly departmentId?: UUID;
  readonly budgetAmount?: number;
  readonly isActive?: boolean;
}

/**
 * Filters for listing cost centers
 */
export interface CostCenterListFilters {
  readonly departmentId?: UUID;
  readonly fiscalYear?: number;
  readonly isActive?: boolean;
  readonly search?: string;
}

// ============================================================================
// Vendor Admin Interfaces
// ============================================================================

/**
 * Extended vendor entity with full details for admin operations
 */
export interface VendorDetails {
  readonly vendorId: UUID;
  readonly vendorCode: string | null;
  readonly vendorName: string;
  readonly vendorType: VendorType | null;
  readonly contactName: string | null;
  readonly contactEmail: string | null;
  readonly contactPhone: string | null;
  readonly addressLine1: string | null;
  readonly addressLine2: string | null;
  readonly city: string | null;
  readonly stateProvince: string | null;
  readonly postalCode: string | null;
  readonly country: string | null;
  readonly paymentTerms: string | null;
  readonly rating: VendorRating | null;
  readonly isActive: boolean;
  readonly createdAt: ISODateString;
  readonly updatedAt: ISODateString;
}

/**
 * Request payload for creating a new vendor
 */
export interface CreateVendorRequest {
  readonly vendorCode?: string;
  readonly vendorName: string;
  readonly vendorType?: VendorType;
  readonly contactName?: string;
  readonly contactEmail?: string;
  readonly contactPhone?: string;
  readonly addressLine1?: string;
  readonly addressLine2?: string;
  readonly city?: string;
  readonly stateProvince?: string;
  readonly postalCode?: string;
  readonly country?: string;
  readonly paymentTerms?: string;
}

/**
 * Request payload for updating an existing vendor
 */
export interface UpdateVendorRequest {
  readonly vendorName?: string;
  readonly vendorType?: VendorType;
  readonly contactName?: string;
  readonly contactEmail?: string;
  readonly contactPhone?: string;
  readonly addressLine1?: string;
  readonly addressLine2?: string;
  readonly city?: string;
  readonly stateProvince?: string;
  readonly postalCode?: string;
  readonly country?: string;
  readonly paymentTerms?: string;
  readonly rating?: VendorRating;
  readonly isActive?: boolean;
}

/**
 * Filters for listing vendors
 */
export interface VendorListFilters {
  readonly vendorType?: VendorType;
  readonly rating?: VendorRating;
  readonly isActive?: boolean;
  readonly search?: string;
}

// ============================================================================
// Vendor ↔ Model Pricing
// ============================================================================

/**
 * Vendor-specific price for a hardware model (catalog item).
 */
export interface VendorModelPrice {
  readonly vendorId: UUID;
  readonly modelId: UUID;
  readonly countryCode: string;
  readonly manufacturerName: string;
  readonly modelName: string;
  readonly sku: string | null;
  readonly unitPrice: number;
  readonly currency: string;
  readonly vendorSku: string | null;
  readonly isActive: boolean;
  readonly createdAt: ISODateString;
  readonly updatedAt: ISODateString;
}

export interface UpsertVendorModelPriceRequest {
  readonly unitPrice: number;
  readonly currency?: string;
  readonly countryCode?: string;
  readonly vendorSku?: string;
  readonly isActive?: boolean;
}

export interface VendorModelPriceListFilters {
  readonly modelId?: UUID;
  readonly countryCode?: string;
  readonly isActive?: boolean;
}

// ============================================================================
// Manufacturer Admin Interfaces
// ============================================================================

/**
 * Extended manufacturer entity with full details for admin operations
 */
export interface ManufacturerDetails {
  readonly manufacturerId: UUID;
  readonly name: string;
  readonly website: string | null;
  readonly modelCount: number;
  readonly isActive: boolean;
  readonly createdAt: ISODateString;
  readonly updatedAt: ISODateString;
}

/**
 * Request payload for creating a new manufacturer
 */
export interface CreateManufacturerRequest {
  readonly name: string;
  readonly website?: string;
}

/**
 * Request payload for updating an existing manufacturer
 */
export interface UpdateManufacturerRequest {
  readonly name?: string;
  readonly website?: string;
  readonly isActive?: boolean;
}

/**
 * Filters for listing manufacturers
 */
export interface ManufacturerListFilters {
  readonly isActive?: boolean;
  readonly search?: string;
}

// ============================================================================
// Model Admin Interfaces
// ============================================================================

/**
 * Extended model entity with full details for admin operations
 */
export interface ModelDetails {
  readonly modelId: UUID;
  readonly manufacturerId: UUID;
  readonly manufacturerName: string;
  readonly modelName: string;
  readonly modelNumber: string | null;
  readonly sku: string | null;
  readonly category: string | null;
  readonly specifications: Record<string, unknown> | null;
  readonly status: ModelStatus;
  readonly assetCount: number;
  readonly isActive: boolean;
  readonly createdAt: ISODateString;
  readonly updatedAt: ISODateString;
}

/**
 * Request payload for creating a new model
 */
export interface CreateModelRequest {
  readonly manufacturerId: UUID;
  readonly modelName: string;
  readonly modelNumber?: string;
  readonly sku?: string;
  readonly category?: string;
  readonly specifications?: Record<string, unknown>;
}

/**
 * Request payload for updating an existing model
 */
export interface UpdateModelRequest {
  readonly modelName?: string;
  readonly modelNumber?: string;
  readonly sku?: string;
  readonly category?: string;
  readonly specifications?: Record<string, unknown>;
  readonly status?: ModelStatus;
  readonly isActive?: boolean;
}

/**
 * Filters for listing models
 */
export interface ModelListFilters {
  readonly manufacturerId?: UUID;
  readonly status?: ModelStatus;
  readonly category?: string;
  readonly isActive?: boolean;
  readonly search?: string;
}
