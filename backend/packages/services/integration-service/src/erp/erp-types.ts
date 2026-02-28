/**
 * ERP Integration Types
 *
 * Type definitions for ERP system integration with SAP, Oracle, and Workday.
 * Supports bidirectional synchronization of purchase orders, cost centers,
 * and financial data.
 *
 * Requirements:
 * - 7.3: Sync purchase orders from ERP systems (SAP, Oracle, Workday)
 * - 7.4: Sync cost centers from ERP systems
 */

import type { ISODateString, UUID } from '@ams/types';

/**
 * Supported ERP system types
 */
export type ERPSystemType = 'SAP' | 'ORACLE' | 'WORKDAY';

/**
 * ERP sync operation types
 */
export type ERPSyncOperation = 
  | 'PURCHASE_ORDER_SYNC'
  | 'COST_CENTER_SYNC'
  | 'FINANCIAL_DATA_SYNC';

/**
 * ERP sync status
 */
export type ERPSyncStatus = 
  | 'PENDING'
  | 'IN_PROGRESS'
  | 'COMPLETED'
  | 'FAILED'
  | 'PARTIAL';

/**
 * ERP sync direction
 */
export type ERPSyncDirection = 'INBOUND' | 'OUTBOUND' | 'BIDIRECTIONAL';

/**
 * ERP connection configuration
 */
export interface ERPConnectionConfig {
  readonly connectionId: UUID;
  readonly erpSystem: ERPSystemType;
  readonly connectionName: string;
  readonly baseUrl: string;
  readonly authType: 'BASIC' | 'OAUTH2' | 'API_KEY' | 'CERTIFICATE';
  readonly isActive: boolean;
  readonly syncDirection: ERPSyncDirection;
  readonly syncIntervalMinutes: number;
  readonly lastSyncAt?: ISODateString;
  readonly createdAt: ISODateString;
  readonly updatedAt: ISODateString;
}

// ============================================================================
// Purchase Order Types
// ============================================================================

/**
 * Purchase order status in ERP systems
 */
export type ERPPurchaseOrderStatus = 
  | 'DRAFT'
  | 'SUBMITTED'
  | 'APPROVED'
  | 'REJECTED'
  | 'ORDERED'
  | 'PARTIALLY_RECEIVED'
  | 'RECEIVED'
  | 'CLOSED'
  | 'CANCELLED';

/**
 * Purchase order line item from ERP
 */
export interface ERPPurchaseOrderLine {
  readonly lineNumber: number;
  readonly itemNumber: string;
  readonly description: string;
  readonly quantity: number;
  readonly unitPrice: number;
  readonly totalPrice: number;
  readonly unitOfMeasure: string;
  readonly receivedQuantity: number;
  readonly deliveryDate?: ISODateString;
  readonly costCenterId?: string;
  readonly glAccount?: string;
  readonly taxAmount?: number;
  readonly discountAmount?: number;
}

/**
 * Purchase order from ERP system
 */
export interface ERPPurchaseOrder {
  readonly erpPurchaseOrderId: string;
  readonly erpSystem: ERPSystemType;
  readonly poNumber: string;
  readonly vendorId: string;
  readonly vendorName: string;
  readonly status: ERPPurchaseOrderStatus;
  readonly orderDate: ISODateString;
  readonly expectedDeliveryDate?: ISODateString;
  readonly totalAmount: number;
  readonly currency: string;
  readonly requesterId?: string;
  readonly requesterName?: string;
  readonly approverId?: string;
  readonly approverName?: string;
  readonly costCenterId?: string;
  readonly costCenterName?: string;
  readonly companyCode?: string;
  readonly plantCode?: string;
  readonly lines: readonly ERPPurchaseOrderLine[];
  readonly notes?: string;
  readonly createdAt: ISODateString;
  readonly updatedAt: ISODateString;
}

/**
 * SAP-specific purchase order fields
 */
export interface SAPPurchaseOrder extends ERPPurchaseOrder {
  readonly erpSystem: 'SAP';
  readonly sapDocumentNumber: string;
  readonly purchasingOrganization: string;
  readonly purchasingGroup: string;
  readonly documentType: string;
  readonly releaseStatus?: string;
  readonly paymentTerms?: string;
  readonly incoterms?: string;
}

/**
 * Oracle-specific purchase order fields
 */
export interface OraclePurchaseOrder extends ERPPurchaseOrder {
  readonly erpSystem: 'ORACLE';
  readonly oraclePoHeaderId: number;
  readonly operatingUnit: string;
  readonly buyerId?: number;
  readonly approvalStatus?: string;
  readonly closedCode?: string;
  readonly firmFlag?: boolean;
}

/**
 * Workday-specific purchase order fields
 */
export interface WorkdayPurchaseOrder extends ERPPurchaseOrder {
  readonly erpSystem: 'WORKDAY';
  readonly workdayPurchaseOrderId: string;
  readonly spendCategory?: string;
  readonly supplierContractId?: string;
  readonly requisitionId?: string;
  readonly businessProcessStatus?: string;
}

// ============================================================================
// Cost Center Types
// ============================================================================

/**
 * Cost center status
 */
export type CostCenterStatus = 'ACTIVE' | 'INACTIVE' | 'BLOCKED';

/**
 * Cost center from ERP system
 */
export interface ERPCostCenter {
  readonly erpCostCenterId: string;
  readonly erpSystem: ERPSystemType;
  readonly costCenterCode: string;
  readonly name: string;
  readonly description?: string;
  readonly status: CostCenterStatus;
  readonly parentCostCenterId?: string;
  readonly managerId?: string;
  readonly managerName?: string;
  readonly companyCode?: string;
  readonly departmentId?: string;
  readonly departmentName?: string;
  readonly budgetAmount?: number;
  readonly spentAmount?: number;
  readonly currency?: string;
  readonly fiscalYear?: number;
  readonly validFrom?: ISODateString;
  readonly validTo?: ISODateString;
  readonly createdAt: ISODateString;
  readonly updatedAt: ISODateString;
}

/**
 * SAP-specific cost center fields
 */
export interface SAPCostCenter extends ERPCostCenter {
  readonly erpSystem: 'SAP';
  readonly controllingArea: string;
  readonly profitCenter?: string;
  readonly functionalArea?: string;
  readonly businessArea?: string;
}

/**
 * Oracle-specific cost center fields
 */
export interface OracleCostCenter extends ERPCostCenter {
  readonly erpSystem: 'ORACLE';
  readonly oracleCostCenterId: number;
  readonly setOfBooksId?: number;
  readonly chartOfAccountsId?: number;
  readonly segmentValue?: string;
}

/**
 * Workday-specific cost center fields
 */
export interface WorkdayCostCenter extends ERPCostCenter {
  readonly erpSystem: 'WORKDAY';
  readonly workdayCostCenterId: string;
  readonly organizationId?: string;
  readonly worktag?: string;
  readonly hierarchyLevel?: number;
}

// ============================================================================
// Sync Result Types
// ============================================================================

/**
 * Individual record sync result
 */
export interface ERPRecordSyncResult {
  readonly erpRecordId: string;
  readonly localRecordId?: UUID;
  readonly operation: 'CREATED' | 'UPDATED' | 'SKIPPED' | 'FAILED';
  readonly errorMessage?: string;
}

/**
 * Purchase order sync result
 */
export interface PurchaseOrderSyncResult {
  readonly erpSystem: ERPSystemType;
  readonly syncTimestamp: ISODateString;
  readonly direction: ERPSyncDirection;
  readonly totalRecords: number;
  readonly createdCount: number;
  readonly updatedCount: number;
  readonly skippedCount: number;
  readonly failedCount: number;
  readonly records: readonly ERPRecordSyncResult[];
  readonly errors: readonly ERPSyncError[];
  readonly processingTimeMs: number;
}

/**
 * Cost center sync result
 */
export interface CostCenterSyncResult {
  readonly erpSystem: ERPSystemType;
  readonly syncTimestamp: ISODateString;
  readonly direction: ERPSyncDirection;
  readonly totalRecords: number;
  readonly createdCount: number;
  readonly updatedCount: number;
  readonly skippedCount: number;
  readonly failedCount: number;
  readonly records: readonly ERPRecordSyncResult[];
  readonly errors: readonly ERPSyncError[];
  readonly processingTimeMs: number;
}

/**
 * ERP sync error details
 */
export interface ERPSyncError {
  readonly erpRecordId: string;
  readonly errorCode: string;
  readonly errorMessage: string;
  readonly timestamp: ISODateString;
  readonly retryable: boolean;
}

// ============================================================================
// Sync Request Types
// ============================================================================

/**
 * Purchase order sync request
 */
export interface SyncPurchaseOrdersRequest {
  readonly erpSystem: ERPSystemType;
  readonly connectionId?: UUID;
  readonly direction?: ERPSyncDirection;
  readonly fromDate?: ISODateString;
  readonly toDate?: ISODateString;
  readonly poNumbers?: readonly string[];
  readonly vendorIds?: readonly string[];
  readonly statusFilter?: readonly ERPPurchaseOrderStatus[];
}

/**
 * Cost center sync request
 */
export interface SyncCostCentersRequest {
  readonly erpSystem: ERPSystemType;
  readonly connectionId?: UUID;
  readonly direction?: ERPSyncDirection;
  readonly costCenterCodes?: readonly string[];
  readonly companyCode?: string;
  readonly includeInactive?: boolean;
}

// ============================================================================
// ERP Connector Interface
// ============================================================================

/**
 * ERP connector interface - implemented by SAP, Oracle, Workday connectors
 */
export interface ERPConnector {
  readonly erpSystem: ERPSystemType;
  
  /**
   * Test connection to ERP system
   */
  testConnection(): Promise<boolean>;
  
  /**
   * Fetch purchase orders from ERP system
   */
  fetchPurchaseOrders(request: SyncPurchaseOrdersRequest): Promise<ERPPurchaseOrder[]>;
  
  /**
   * Send purchase order to ERP system
   */
  sendPurchaseOrder(purchaseOrder: ERPPurchaseOrder): Promise<ERPRecordSyncResult>;
  
  /**
   * Fetch cost centers from ERP system
   */
  fetchCostCenters(request: SyncCostCentersRequest): Promise<ERPCostCenter[]>;
  
  /**
   * Send cost center to ERP system
   */
  sendCostCenter(costCenter: ERPCostCenter): Promise<ERPRecordSyncResult>;
}

/**
 * ERP sync audit log entry
 */
export interface ERPSyncAuditLog {
  readonly auditLogId: UUID;
  readonly erpSystem: ERPSystemType;
  readonly operation: ERPSyncOperation;
  readonly direction: ERPSyncDirection;
  readonly status: ERPSyncStatus;
  readonly totalRecords: number;
  readonly successCount: number;
  readonly failureCount: number;
  readonly startedAt: ISODateString;
  readonly completedAt?: ISODateString;
  readonly errorMessage?: string;
  readonly createdBy?: UUID;
}
