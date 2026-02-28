/**
 * Seed Data Types
 * 
 * These types represent the shape of seed data records before they are
 * inserted into the database. They differ from @ams/types entity types
 * which represent database records with IDs and timestamps.
 */

/** Department seed data */
export interface SeedDepartment {
  name: string;
  code: string;
}

/** User seed data */
export interface SeedUser {
  email: string;
  firstName: string;
  lastName: string;
  departmentCode: string;
  role: string;
}

/** Stockroom seed data */
export interface SeedStockroom {
  name: string;
  location: string;
  stockroomType: string;
  stockroomCode: string;
}

/** Manufacturer seed data */
export interface SeedManufacturer {
  name: string;
  normalizedName: string;
  aliases: string[];
  website?: string;
}

/** Model seed data */
export interface SeedModel {
  manufacturerName: string;
  modelName: string;
  normalizedName: string;
  modelNumber: string;
  modelCategory: string;
  specifications?: Record<string, unknown>;
}

/** Facility seed data */
export interface SeedFacility {
  facilityCode: string;
  name: string;
  facilityType: string;
  city: string;
  stateProvince: string;
  country: string;
}

/** Vendor seed data */
export interface SeedVendor {
  vendorName: string;
  vendorCode: string;
  vendorType: string;
  contactName: string;
  contactEmail: string;
  contactPhone: string;
  paymentTerms: string;
}

/** Contract seed data */
export interface SeedContract {
  contractNumber: string;
  contractName: string;
  vendorCode: string;
  contractType: string;
  totalValue: number;
  startDate: string;
  endDate: string;
  status: string;
}

/** Software product seed data */
export interface SeedSoftwareProduct {
  publisher: string;
  productName: string;
  version: string;
  edition: string;
  productCategory: string;
  isSaas: boolean;
}

/** Entitlement seed data */
export interface SeedEntitlement {
  productName: string;
  licenseType: string;
  quantityPurchased: number;
  unitCost: number;
  metricType: string;
  startDate: string;
  endDate?: string;
}

/** Enterprise asset seed data */
export interface SeedEnterpriseAsset {
  displayName: string;
  description: string;
  status: string;
  serialNumber: string;
  manufacturer: string;
  model: string;
  assetClass: string;
  criticalityLevel: string;
  facilityCode: string;
  operatingHours: number;
}

/** Maintenance plan seed data */
export interface SeedMaintenancePlan {
  assetDisplayName: string;
  planName: string;
  maintenanceType: string;
  frequencyDays: number;
  estimatedDurationHours: number;
}

/** Purchase order line seed data */
export interface SeedPurchaseOrderLine {
  lineNumber: number;
  productDescription: string;
  productType: 'HARDWARE_MODEL' | 'SOFTWARE_PRODUCT' | 'SERVICE' | 'OTHER';
  quantity: number;
  unitPrice: number;
}

/** Purchase order seed data */
export interface SeedPurchaseOrder {
  poNumber: string;
  vendorCode: string;
  requesterEmail: string;
  status: string;
  orderDate: string;
  expectedDeliveryDate: string;
  totalAmount: number;
  lines: SeedPurchaseOrderLine[];
}

// ============================================================================
// HAM Operation Types
// ============================================================================

/** Transfer order seed data */
export interface SeedTransferOrder {
  transferNumber: string;
  fromStockroomCode: string;
  toStockroomCode: string;
  status: string;
  priority: string;
  requesterEmail: string;
  reason: string;
  lines: SeedTransferLine[];
}

/** Transfer order line seed data */
export interface SeedTransferLine {
  lineNumber: number;
  productDescription: string;
  quantity: number;
  status: string;
}

/** Loaner checkout seed data */
export interface SeedLoanerCheckout {
  checkoutNumber: string;
  assetDisplayName: string;
  checkedOutToEmail: string;
  checkedOutByEmail: string;
  dueDateOffsetDays: number;
  conditionOut: string;
  purpose: string;
  departmentCode: string;
  status: string;
  isOverdue: boolean;
}

/** Disposal workflow seed data */
export interface SeedDisposalWorkflow {
  workflowNumber: string;
  assetDisplayName: string;
  status: string;
  disposalMethod: string;
  initiatedByEmail: string;
  dataWipeRequired: boolean;
  environmentalCheckRequired: boolean;
  notes: string;
  tasks: SeedDisposalTask[];
}

/** Disposal task seed data */
export interface SeedDisposalTask {
  taskType: string;
  taskName: string;
  description: string;
  status: string;
  sequence: number;
  isRequired: boolean;
}

// ============================================================================
// EAM Operation Types
// ============================================================================

/** Work order seed data */
export interface SeedWorkOrder {
  workOrderNumber: string;
  assetDisplayName: string;
  workType: string;
  priority: string;
  status: string;
  title: string;
  description: string;
  estimatedDurationHours: number;
  assignedToEmail?: string;
  facilityCode: string;
  scheduledDateOffsetDays: number;
}

/** Spare part seed data */
export interface SeedSparePart {
  partNumber: string;
  partName: string;
  description: string;
  manufacturer: string;
  category: string;
  quantityOnHand: number;
  reorderPoint: number;
  reorderQuantity: number;
  unitCost: number;
  storageLocation: string;
  isCritical: boolean;
  abcClassification: string;
}

/** Linear asset seed data */
export interface SeedLinearAsset {
  assetDisplayName: string;
  startLocation: string;
  endLocation: string;
  totalLength: number;
  linearUnit: string;
  routeType: string;
  routeDescription: string;
  overallCondition: string;
  segments: SeedLinearSegment[];
}

/** Linear asset segment seed data */
export interface SeedLinearSegment {
  sequenceNumber: number;
  startMarker: string;
  endMarker: string;
  segmentLength: number;
  conditionRating: string;
  material: string;
  segmentDescription: string;
}

/** Hardware asset seed data */
export interface SeedHardwareAsset {
  displayName: string;
  description: string;
  status: string;
  serialNumber: string;
  modelName: string;
  modelCategory: string;
  departmentCode: string;
  stockroomCode?: string;
  assignedToEmail?: string;
  purchasePrice: number;
  warrantyMonths: number;
}
