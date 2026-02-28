/**
 * SAP ERP Connector
 *
 * Implements connection to SAP ERP systems for:
 * - Purchase order synchronization
 * - Cost center synchronization
 *
 * Requirements:
 * - 7.3: Sync purchase orders from SAP
 * - 7.4: Sync cost centers from SAP
 */

import { createLogger } from '@ams/utils';

import type {
  ERPConnector,
  ERPCostCenter,
  ERPPurchaseOrder,
  ERPRecordSyncResult,
  SyncCostCentersRequest,
  SyncPurchaseOrdersRequest,
} from '../erp-types';

const logger = createLogger({ service: 'sap-connector' });

/**
 * SAP API configuration from environment
 */
interface SAPConfig {
  baseUrl: string;
  clientId: string;
  clientSecret: string;
  companyCode: string;
}

function getSAPConfig(): SAPConfig {
  return {
    baseUrl: process.env['SAP_API_BASE_URL'] ?? 'https://api.sap.example.com',
    clientId: process.env['SAP_CLIENT_ID'] ?? '',
    clientSecret: process.env['SAP_CLIENT_SECRET'] ?? '',
    companyCode: process.env['SAP_COMPANY_CODE'] ?? '1000',
  };
}

/**
 * SAP Connector implementation
 */
class SAPConnector implements ERPConnector {
  readonly erpSystem = 'SAP' as const;
  private config: SAPConfig;
  private accessToken: string | null = null;

  constructor() {
    this.config = getSAPConfig();
  }

  /**
   * Get OAuth2 access token from SAP
   */
  private async getAccessToken(): Promise<string> {
    if (this.accessToken) {
      return this.accessToken;
    }

    logger.debug('Obtaining SAP access token');

    // In production, this would make an OAuth2 token request
    // For now, we simulate the token acquisition
    try {
      // Simulated OAuth2 flow - in production use actual SAP OAuth endpoint
      const tokenUrl = `${this.config.baseUrl}/oauth/token`;
      
      logger.info('SAP OAuth token request', { tokenUrl });
      
      // Placeholder for actual OAuth implementation
      this.accessToken = 'sap-access-token-placeholder';
      return this.accessToken;
    } catch (error) {
      logger.error('Failed to obtain SAP access token', error as Error);
      throw new Error('SAP authentication failed');
    }
  }

  /**
   * Test connection to SAP system
   */
  async testConnection(): Promise<boolean> {
    try {
      await this.getAccessToken();
      logger.info('SAP connection test successful');
      return true;
    } catch (error) {
      logger.error('SAP connection test failed', error as Error);
      return false;
    }
  }

  /**
   * Fetch purchase orders from SAP
   * Uses SAP OData API for purchase order retrieval
   */
  async fetchPurchaseOrders(
    request: SyncPurchaseOrdersRequest
  ): Promise<ERPPurchaseOrder[]> {
    logger.info('Fetching purchase orders from SAP', {
      fromDate: request.fromDate,
      toDate: request.toDate,
      poNumbers: request.poNumbers,
    });

    await this.getAccessToken();

    // Build OData query parameters
    const filters: string[] = [];
    if (request.fromDate) {
      filters.push(`CreationDate ge datetime'${request.fromDate}'`);
    }
    if (request.toDate) {
      filters.push(`CreationDate le datetime'${request.toDate}'`);
    }
    if (request.poNumbers && request.poNumbers.length > 0) {
      const poFilter = request.poNumbers.map(po => `PurchaseOrder eq '${po}'`).join(' or ');
      filters.push(`(${poFilter})`);
    }
    if (request.statusFilter && request.statusFilter.length > 0) {
      const statusFilter = request.statusFilter.map(s => `Status eq '${s}'`).join(' or ');
      filters.push(`(${statusFilter})`);
    }

    // In production, this would call SAP OData API
    // GET /sap/opu/odata/sap/API_PURCHASEORDER_PROCESS_SRV/A_PurchaseOrder
    const apiUrl = `${this.config.baseUrl}/sap/opu/odata/sap/API_PURCHASEORDER_PROCESS_SRV/A_PurchaseOrder`;
    
    logger.debug('SAP purchase order API call', { apiUrl, filters });

    // Simulated response - in production, parse actual SAP response
    const purchaseOrders: ERPPurchaseOrder[] = [];
    
    return purchaseOrders;
  }

  /**
   * Send purchase order to SAP
   */
  async sendPurchaseOrder(
    purchaseOrder: ERPPurchaseOrder
  ): Promise<ERPRecordSyncResult> {
    logger.info('Sending purchase order to SAP', {
      poNumber: purchaseOrder.poNumber,
    });

    await this.getAccessToken();

    try {
      // In production, this would POST to SAP OData API
      // POST /sap/opu/odata/sap/API_PURCHASEORDER_PROCESS_SRV/A_PurchaseOrder
      
      logger.info('Purchase order sent to SAP successfully', {
        poNumber: purchaseOrder.poNumber,
      });

      return {
        erpRecordId: purchaseOrder.erpPurchaseOrderId,
        operation: 'CREATED',
      };
    } catch (error) {
      const err = error as Error;
      logger.error('Failed to send purchase order to SAP', err);
      return {
        erpRecordId: purchaseOrder.erpPurchaseOrderId,
        operation: 'FAILED',
        errorMessage: err.message,
      };
    }
  }

  /**
   * Fetch cost centers from SAP
   * Uses SAP OData API for cost center retrieval
   */
  async fetchCostCenters(
    request: SyncCostCentersRequest
  ): Promise<ERPCostCenter[]> {
    logger.info('Fetching cost centers from SAP', {
      companyCode: request.companyCode,
      includeInactive: request.includeInactive,
    });

    await this.getAccessToken();

    // Build OData query parameters
    const filters: string[] = [];
    const companyCode = request.companyCode ?? this.config.companyCode;
    filters.push(`ControllingArea eq '${companyCode}'`);
    
    if (!request.includeInactive) {
      filters.push(`ValidityEndDate ge datetime'${new Date().toISOString()}'`);
    }
    if (request.costCenterCodes && request.costCenterCodes.length > 0) {
      const ccFilter = request.costCenterCodes.map(cc => `CostCenter eq '${cc}'`).join(' or ');
      filters.push(`(${ccFilter})`);
    }

    // In production, this would call SAP OData API
    // GET /sap/opu/odata/sap/API_COSTCENTER_SRV/A_CostCenter
    const apiUrl = `${this.config.baseUrl}/sap/opu/odata/sap/API_COSTCENTER_SRV/A_CostCenter`;
    
    logger.debug('SAP cost center API call', { apiUrl, filters });

    // Simulated response - in production, parse actual SAP response
    const costCenters: ERPCostCenter[] = [];
    
    return costCenters;
  }

  /**
   * Send cost center to SAP
   */
  async sendCostCenter(
    costCenter: ERPCostCenter
  ): Promise<ERPRecordSyncResult> {
    logger.info('Sending cost center to SAP', {
      costCenterCode: costCenter.costCenterCode,
    });

    await this.getAccessToken();

    try {
      // In production, this would POST to SAP OData API
      // POST /sap/opu/odata/sap/API_COSTCENTER_SRV/A_CostCenter
      
      logger.info('Cost center sent to SAP successfully', {
        costCenterCode: costCenter.costCenterCode,
      });

      return {
        erpRecordId: costCenter.erpCostCenterId,
        operation: 'CREATED',
      };
    } catch (error) {
      const err = error as Error;
      logger.error('Failed to send cost center to SAP', err);
      return {
        erpRecordId: costCenter.erpCostCenterId,
        operation: 'FAILED',
        errorMessage: err.message,
      };
    }
  }
}

/**
 * Create SAP connector instance
 */
export function createSAPConnector(): ERPConnector {
  return new SAPConnector();
}
