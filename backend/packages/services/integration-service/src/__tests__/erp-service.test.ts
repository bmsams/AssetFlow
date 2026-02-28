/**
 * ERP Service Unit Tests
 *
 * Tests for ERP integration service including:
 * - Purchase order synchronization (Requirement 7.3)
 * - Cost center synchronization (Requirement 7.4)
 * - SAP, Oracle, Workday connector handling
 */

import type {
  ERPCostCenter,
  ERPPurchaseOrder,
  SyncCostCentersRequest,
  SyncPurchaseOrdersRequest,
} from '../erp/erp-types';

// Mock the repository module
jest.mock('../erp/erp-repository', () => ({
  createERPSyncAuditLog: jest.fn().mockResolvedValue('audit-log-id-123'),
  updateERPSyncAuditLog: jest.fn().mockResolvedValue(undefined),
  updateERPConnectionLastSync: jest.fn().mockResolvedValue(undefined),
  upsertERPPurchaseOrder: jest.fn().mockResolvedValue({ created: true }),
  upsertERPCostCenter: jest.fn().mockResolvedValue({ created: true }),
  upsertLocalCostCenter: jest.fn().mockResolvedValue('local-cc-id-123'),
  getERPPurchaseOrdersBySystem: jest.fn().mockResolvedValue([]),
  getERPCostCentersBySystem: jest.fn().mockResolvedValue([]),
  getERPConnectionConfig: jest.fn().mockResolvedValue(null),
}));

// Mock the connectors
const mockSAPConnector = {
  erpSystem: 'SAP' as const,
  testConnection: jest.fn().mockResolvedValue(true),
  fetchPurchaseOrders: jest.fn().mockResolvedValue([]),
  sendPurchaseOrder: jest.fn().mockResolvedValue({ erpRecordId: 'po-1', operation: 'CREATED' }),
  fetchCostCenters: jest.fn().mockResolvedValue([]),
  sendCostCenter: jest.fn().mockResolvedValue({ erpRecordId: 'cc-1', operation: 'CREATED' }),
};

const mockOracleConnector = {
  erpSystem: 'ORACLE' as const,
  testConnection: jest.fn().mockResolvedValue(true),
  fetchPurchaseOrders: jest.fn().mockResolvedValue([]),
  sendPurchaseOrder: jest.fn().mockResolvedValue({ erpRecordId: 'po-1', operation: 'CREATED' }),
  fetchCostCenters: jest.fn().mockResolvedValue([]),
  sendCostCenter: jest.fn().mockResolvedValue({ erpRecordId: 'cc-1', operation: 'CREATED' }),
};

const mockWorkdayConnector = {
  erpSystem: 'WORKDAY' as const,
  testConnection: jest.fn().mockResolvedValue(true),
  fetchPurchaseOrders: jest.fn().mockResolvedValue([]),
  sendPurchaseOrder: jest.fn().mockResolvedValue({ erpRecordId: 'po-1', operation: 'CREATED' }),
  fetchCostCenters: jest.fn().mockResolvedValue([]),
  sendCostCenter: jest.fn().mockResolvedValue({ erpRecordId: 'cc-1', operation: 'CREATED' }),
};

jest.mock('../erp/connectors/sap-connector', () => ({
  createSAPConnector: jest.fn(() => mockSAPConnector),
}));

jest.mock('../erp/connectors/oracle-connector', () => ({
  createOracleConnector: jest.fn(() => mockOracleConnector),
}));

jest.mock('../erp/connectors/workday-connector', () => ({
  createWorkdayConnector: jest.fn(() => mockWorkdayConnector),
}));

// Mock logger
jest.mock('@ams/utils', () => ({
  createLogger: jest.fn(() => ({
    info: jest.fn(),
    debug: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
  })),
}));

// Import after mocks are set up
import * as erpService from '../erp/erp-service';
import * as repository from '../erp/erp-repository';

describe('ERP Service', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    // Reset default mock implementations after clearing
    mockSAPConnector.testConnection.mockResolvedValue(true);
    mockSAPConnector.fetchPurchaseOrders.mockResolvedValue([]);
    mockSAPConnector.fetchCostCenters.mockResolvedValue([]);
    mockOracleConnector.testConnection.mockResolvedValue(true);
    mockOracleConnector.fetchPurchaseOrders.mockResolvedValue([]);
    mockOracleConnector.fetchCostCenters.mockResolvedValue([]);
    mockWorkdayConnector.testConnection.mockResolvedValue(true);
    mockWorkdayConnector.fetchPurchaseOrders.mockResolvedValue([]);
    mockWorkdayConnector.fetchCostCenters.mockResolvedValue([]);
  });

  describe('syncPurchaseOrders', () => {
    /**
     * Validates: Requirement 7.3 - Sync purchase orders from ERP systems
     */
    it('should sync purchase orders from SAP successfully', async () => {
      const mockPurchaseOrders: ERPPurchaseOrder[] = [
        {
          erpPurchaseOrderId: 'SAP-PO-001',
          erpSystem: 'SAP',
          poNumber: 'PO-2024-001',
          vendorId: 'V001',
          vendorName: 'Test Vendor',
          status: 'APPROVED',
          orderDate: '2024-01-15T00:00:00Z',
          totalAmount: 5000.00,
          currency: 'USD',
          lines: [
            {
              lineNumber: 1,
              itemNumber: 'ITEM-001',
              description: 'Test Item',
              quantity: 10,
              unitPrice: 500.00,
              totalPrice: 5000.00,
              unitOfMeasure: 'EA',
              receivedQuantity: 0,
            },
          ],
          createdAt: '2024-01-15T00:00:00Z',
          updatedAt: '2024-01-15T00:00:00Z',
        },
      ];

      mockSAPConnector.fetchPurchaseOrders.mockResolvedValue(mockPurchaseOrders);

      const request: SyncPurchaseOrdersRequest = {
        erpSystem: 'SAP',
        direction: 'INBOUND',
      };

      const result = await erpService.syncPurchaseOrders(request);

      expect(result.erpSystem).toBe('SAP');
      expect(result.totalRecords).toBe(1);
      expect(result.createdCount).toBe(1);
      expect(result.failedCount).toBe(0);
      expect(mockSAPConnector.testConnection).toHaveBeenCalled();
      expect(mockSAPConnector.fetchPurchaseOrders).toHaveBeenCalledWith(request);
      expect(repository.upsertERPPurchaseOrder).toHaveBeenCalledWith(mockPurchaseOrders[0]);
    });

    /**
     * Validates: Requirement 7.3 - Sync purchase orders from Oracle
     */
    it('should sync purchase orders from Oracle successfully', async () => {
      const mockPurchaseOrders: ERPPurchaseOrder[] = [
        {
          erpPurchaseOrderId: 'ORACLE-PO-001',
          erpSystem: 'ORACLE',
          poNumber: 'PO-2024-002',
          vendorId: 'V002',
          vendorName: 'Oracle Vendor',
          status: 'ORDERED',
          orderDate: '2024-01-16T00:00:00Z',
          totalAmount: 10000.00,
          currency: 'USD',
          lines: [],
          createdAt: '2024-01-16T00:00:00Z',
          updatedAt: '2024-01-16T00:00:00Z',
        },
      ];

      mockOracleConnector.fetchPurchaseOrders.mockResolvedValue(mockPurchaseOrders);

      const request: SyncPurchaseOrdersRequest = {
        erpSystem: 'ORACLE',
      };

      const result = await erpService.syncPurchaseOrders(request);

      expect(result.erpSystem).toBe('ORACLE');
      expect(result.totalRecords).toBe(1);
      expect(mockOracleConnector.testConnection).toHaveBeenCalled();
    });

    /**
     * Validates: Requirement 7.3 - Sync purchase orders from Workday
     */
    it('should sync purchase orders from Workday successfully', async () => {
      mockWorkdayConnector.fetchPurchaseOrders.mockResolvedValue([]);

      const request: SyncPurchaseOrdersRequest = {
        erpSystem: 'WORKDAY',
      };

      const result = await erpService.syncPurchaseOrders(request);

      expect(result.erpSystem).toBe('WORKDAY');
      expect(result.totalRecords).toBe(0);
      expect(mockWorkdayConnector.testConnection).toHaveBeenCalled();
    });

    it('should handle connection failure gracefully', async () => {
      mockSAPConnector.testConnection.mockResolvedValue(false);

      const request: SyncPurchaseOrdersRequest = {
        erpSystem: 'SAP',
      };

      await expect(erpService.syncPurchaseOrders(request)).rejects.toThrow(
        'Failed to connect to SAP system'
      );
    });

    it('should create audit log for sync operation', async () => {
      mockSAPConnector.fetchPurchaseOrders.mockResolvedValue([]);

      const request: SyncPurchaseOrdersRequest = {
        erpSystem: 'SAP',
      };

      await erpService.syncPurchaseOrders(request);

      expect(repository.createERPSyncAuditLog).toHaveBeenCalledWith(
        'SAP',
        'PURCHASE_ORDER_SYNC',
        'INBOUND'
      );
      expect(repository.updateERPSyncAuditLog).toHaveBeenCalled();
    });

    it('should filter purchase orders by date range', async () => {
      mockSAPConnector.fetchPurchaseOrders.mockResolvedValue([]);

      const request: SyncPurchaseOrdersRequest = {
        erpSystem: 'SAP',
        fromDate: '2024-01-01T00:00:00Z',
        toDate: '2024-01-31T23:59:59Z',
      };

      await erpService.syncPurchaseOrders(request);

      expect(mockSAPConnector.fetchPurchaseOrders).toHaveBeenCalledWith(request);
    });
  });

  describe('syncCostCenters', () => {
    /**
     * Validates: Requirement 7.4 - Sync cost centers from ERP systems
     */
    it('should sync cost centers from SAP successfully', async () => {
      const mockCostCenters: ERPCostCenter[] = [
        {
          erpCostCenterId: 'SAP-CC-001',
          erpSystem: 'SAP',
          costCenterCode: 'CC-1000',
          name: 'IT Department',
          status: 'ACTIVE',
          budgetAmount: 100000.00,
          currency: 'USD',
          createdAt: '2024-01-01T00:00:00Z',
          updatedAt: '2024-01-01T00:00:00Z',
        },
      ];

      mockSAPConnector.fetchCostCenters.mockResolvedValue(mockCostCenters);

      const request: SyncCostCentersRequest = {
        erpSystem: 'SAP',
        direction: 'INBOUND',
      };

      const result = await erpService.syncCostCenters(request);

      expect(result.erpSystem).toBe('SAP');
      expect(result.totalRecords).toBe(1);
      expect(result.createdCount).toBe(1);
      expect(repository.upsertERPCostCenter).toHaveBeenCalledWith(mockCostCenters[0]);
    });

    /**
     * Validates: Requirement 7.4 - Sync cost centers from Oracle
     */
    it('should sync cost centers from Oracle successfully', async () => {
      const mockCostCenters: ERPCostCenter[] = [
        {
          erpCostCenterId: 'ORACLE-CC-001',
          erpSystem: 'ORACLE',
          costCenterCode: 'CC-2000',
          name: 'Finance Department',
          status: 'ACTIVE',
          createdAt: '2024-01-01T00:00:00Z',
          updatedAt: '2024-01-01T00:00:00Z',
        },
      ];

      mockOracleConnector.fetchCostCenters.mockResolvedValue(mockCostCenters);

      const request: SyncCostCentersRequest = {
        erpSystem: 'ORACLE',
      };

      const result = await erpService.syncCostCenters(request);

      expect(result.erpSystem).toBe('ORACLE');
      expect(result.totalRecords).toBe(1);
    });

    /**
     * Validates: Requirement 7.4 - Sync cost centers from Workday
     */
    it('should sync cost centers from Workday successfully', async () => {
      mockWorkdayConnector.fetchCostCenters.mockResolvedValue([]);

      const request: SyncCostCentersRequest = {
        erpSystem: 'WORKDAY',
        includeInactive: true,
      };

      const result = await erpService.syncCostCenters(request);

      expect(result.erpSystem).toBe('WORKDAY');
      expect(result.totalRecords).toBe(0);
    });

    it('should create audit log for cost center sync', async () => {
      mockSAPConnector.fetchCostCenters.mockResolvedValue([]);

      const request: SyncCostCentersRequest = {
        erpSystem: 'SAP',
      };

      await erpService.syncCostCenters(request);

      expect(repository.createERPSyncAuditLog).toHaveBeenCalledWith(
        'SAP',
        'COST_CENTER_SYNC',
        'INBOUND'
      );
    });

    it('should filter cost centers by company code', async () => {
      mockSAPConnector.fetchCostCenters.mockResolvedValue([]);

      const request: SyncCostCentersRequest = {
        erpSystem: 'SAP',
        companyCode: '1000',
      };

      await erpService.syncCostCenters(request);

      expect(mockSAPConnector.fetchCostCenters).toHaveBeenCalledWith(request);
    });
  });

  describe('testERPConnection', () => {
    it('should return true when SAP connection succeeds', async () => {
      mockSAPConnector.testConnection.mockResolvedValue(true);

      const result = await erpService.testERPConnection('SAP');

      expect(result).toBe(true);
    });

    it('should return false when connection fails', async () => {
      mockOracleConnector.testConnection.mockResolvedValue(false);

      const result = await erpService.testERPConnection('ORACLE');

      expect(result).toBe(false);
    });

    it('should return false when connection throws error', async () => {
      mockWorkdayConnector.testConnection.mockRejectedValue(new Error('Connection timeout'));

      const result = await erpService.testERPConnection('WORKDAY');

      expect(result).toBe(false);
    });
  });

  describe('getERPPurchaseOrders', () => {
    it('should retrieve purchase orders by ERP system', async () => {
      const mockPOs: ERPPurchaseOrder[] = [
        {
          erpPurchaseOrderId: 'PO-001',
          erpSystem: 'SAP',
          poNumber: 'PO-2024-001',
          vendorId: 'V001',
          vendorName: 'Vendor 1',
          status: 'APPROVED',
          orderDate: '2024-01-15T00:00:00Z',
          totalAmount: 1000,
          currency: 'USD',
          lines: [],
          createdAt: '2024-01-15T00:00:00Z',
          updatedAt: '2024-01-15T00:00:00Z',
        },
      ];

      (repository.getERPPurchaseOrdersBySystem as jest.Mock).mockResolvedValue(mockPOs);

      const result = await erpService.getERPPurchaseOrders('SAP');

      expect(result).toEqual(mockPOs);
      expect(repository.getERPPurchaseOrdersBySystem).toHaveBeenCalledWith('SAP', 100);
    });
  });

  describe('getERPCostCenters', () => {
    it('should retrieve cost centers by ERP system', async () => {
      const mockCCs: ERPCostCenter[] = [
        {
          erpCostCenterId: 'CC-001',
          erpSystem: 'SAP',
          costCenterCode: 'CC-1000',
          name: 'IT',
          status: 'ACTIVE',
          createdAt: '2024-01-01T00:00:00Z',
          updatedAt: '2024-01-01T00:00:00Z',
        },
      ];

      (repository.getERPCostCentersBySystem as jest.Mock).mockResolvedValue(mockCCs);

      const result = await erpService.getERPCostCenters('SAP', false, 100);

      expect(result).toEqual(mockCCs);
      expect(repository.getERPCostCentersBySystem).toHaveBeenCalledWith('SAP', false, 100);
    });
  });
});
