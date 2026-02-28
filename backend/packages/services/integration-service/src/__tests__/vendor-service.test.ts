/**
 * Vendor Service Unit Tests
 *
 * Tests for the Vendor Integration Service business logic.
 * Requirements:
 * - 7.5: Receive Advance Ship Notices from resellers like CDW and Insight
 * - 7.6: Pre-create asset records with serial numbers before physical arrival
 */

import type {
  CDWASNPayload,
  InsightASNPayload,
  VendorCatalogSearchRequest,
} from '../vendor/vendor-types';
import * as vendorService from '../vendor/vendor-service';
import * as repository from '../vendor/vendor-repository';

// Mock the repository module
jest.mock('../vendor/vendor-repository');

// Mock the logger
jest.mock('@ams/utils', () => ({
  createLogger: () => ({
    info: jest.fn(),
    debug: jest.fn(),
    error: jest.fn(),
    warn: jest.fn(),
  }),
}));

const mockRepository = repository as jest.Mocked<typeof repository>;

describe('Vendor Service', () => {
  beforeEach(() => {
    jest.clearAllMocks();

    // Default mock implementations
    mockRepository.findASNByVendorNumber.mockResolvedValue(null);
    mockRepository.findPurchaseOrderByNumber.mockResolvedValue(null);
    mockRepository.createASN.mockResolvedValue({
      asnId: 'test-asn-id',
      vendorType: 'CDW',
      vendorName: 'CDW',
      vendorAsnNumber: 'ASN-001',
      purchaseOrderNumber: 'PO-001',
      shipDate: '2024-01-15',
      expectedDeliveryDate: '2024-01-20',
      status: 'PROCESSING',
      totalItems: 2,
      processedItems: 0,
      failedItems: 0,
      lines: [],
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    });
    mockRepository.createASNLine.mockResolvedValue({
      lineId: 'test-line-id',
      asnId: 'test-asn-id',
      lineNumber: 1,
      vendorPartNumber: 'CDW-001',
      description: 'Test Item',
      quantity: 2,
      serialNumbers: ['SN001', 'SN002'],
      status: 'PENDING',
      createdAssetIds: [],
      linkedAssetIds: [],
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    });
    mockRepository.findAssetBySerialNumber.mockResolvedValue(null);
    mockRepository.preCreateAssetFromASN.mockImplementation(
      async (serialNumber, asnId, asnLineId, _poId, vendorType, manufacturer, model, description, expectedDeliveryDate) => ({
        assetId: `asset-${serialNumber}`,
        assetTag: `AMS-HW-20240115-${serialNumber}`,
        serialNumber,
        asnId,
        asnLineId,
        vendorType,
        manufacturer,
        model,
        description,
        expectedDeliveryDate,
        status: 'ORDERED' as const,
        createdAt: new Date().toISOString(),
      })
    );
    mockRepository.updateASNStatus.mockResolvedValue();
    mockRepository.updateASNLineStatus.mockResolvedValue();
  });

  describe('processCDWASN', () => {
    const baseCDWPayload: CDWASNPayload = {
      asnNumber: 'CDW-ASN-001',
      poNumber: 'PO-2024-001',
      shipDate: '2024-01-15T00:00:00Z',
      estimatedDeliveryDate: '2024-01-20T00:00:00Z',
      carrier: 'FedEx',
      trackingNumber: '1234567890',
      shipFrom: {
        address1: '200 N Milwaukee Ave',
        city: 'Vernon Hills',
        state: 'IL',
        zip: '60061',
        country: 'USA',
      },
      shipTo: {
        address1: '123 Main St',
        city: 'Chicago',
        state: 'IL',
        zip: '60601',
        country: 'USA',
      },
      items: [
        {
          lineNumber: 1,
          cdwPartNumber: 'CDW-LAPTOP-001',
          mfrPartNumber: 'DELL-LAT-5540',
          description: 'Dell Latitude 5540 Laptop',
          quantity: 2,
          serialNumbers: ['SN-DELL-001', 'SN-DELL-002'],
          manufacturer: 'Dell',
          unitPrice: 1299.99,
        },
      ],
    };

    it('should process CDW ASN and pre-create assets', async () => {
      const result = await vendorService.processCDWASN(baseCDWPayload);

      expect(result.vendorType).toBe('CDW');
      expect(result.vendorAsnNumber).toBe('CDW-ASN-001');
      expect(result.purchaseOrderNumber).toBe('PO-2024-001');
      expect(result.status).toBe('COMPLETED');
      expect(result.totalItems).toBe(2);
      expect(result.assetsCreated).toBe(2);
      expect(result.itemsFailed).toBe(0);
      expect(result.lineResults).toHaveLength(1);

      const firstLineResult = result.lineResults[0];
      expect(firstLineResult).toBeDefined();
      expect(firstLineResult!.status).toBe('ASSET_CREATED');
      expect(firstLineResult!.createdAssetIds).toHaveLength(2);

      expect(mockRepository.createASN).toHaveBeenCalledWith(
        expect.objectContaining({
          vendorType: 'CDW',
          vendorAsnNumber: 'CDW-ASN-001',
          purchaseOrderNumber: 'PO-2024-001',
        })
      );

      expect(mockRepository.preCreateAssetFromASN).toHaveBeenCalledTimes(2);
    });

    it('should skip already processed ASN', async () => {
      mockRepository.findASNByVendorNumber.mockResolvedValue({
        asnId: 'existing-asn-id',
        vendorType: 'CDW',
        vendorName: 'CDW',
        vendorAsnNumber: 'CDW-ASN-001',
        purchaseOrderNumber: 'PO-2024-001',
        shipDate: '2024-01-15',
        expectedDeliveryDate: '2024-01-20',
        status: 'COMPLETED',
        totalItems: 2,
        processedItems: 2,
        failedItems: 0,
        lines: [],
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      });

      const result = await vendorService.processCDWASN(baseCDWPayload);

      expect(result.status).toBe('COMPLETED');
      expect(result.asnId).toBe('existing-asn-id');
      expect(mockRepository.createASN).not.toHaveBeenCalled();
    });

    it('should link to existing purchase order', async () => {
      mockRepository.findPurchaseOrderByNumber.mockResolvedValue({
        poId: 'po-uuid-001',
        vendorId: 'vendor-uuid-001',
      });

      await vendorService.processCDWASN(baseCDWPayload);

      expect(mockRepository.createASN).toHaveBeenCalledWith(
        expect.objectContaining({
          purchaseOrderId: 'po-uuid-001',
        })
      );
    });

    it('should link existing assets instead of creating new ones', async () => {
      mockRepository.findAssetBySerialNumber.mockResolvedValue({
        assetId: 'existing-asset-id',
        assetTag: 'AMS-HW-20240101-ABC123',
      });

      const result = await vendorService.processCDWASN(baseCDWPayload);

      expect(result.assetsLinked).toBe(2);
      expect(result.assetsCreated).toBe(0);
      expect(mockRepository.preCreateAssetFromASN).not.toHaveBeenCalled();
    });

    it('should handle items without serial numbers', async () => {
      const payloadWithoutSerials: CDWASNPayload = {
        ...baseCDWPayload,
        items: [
          {
            lineNumber: 1,
            cdwPartNumber: 'CDW-CABLE-001',
            description: 'Network Cable',
            quantity: 10,
            // No serialNumbers
          },
        ],
      };

      const result = await vendorService.processCDWASN(payloadWithoutSerials);

      expect(result.totalItems).toBe(0);
      expect(result.itemsSkipped).toBe(1);
      expect(result.lineResults[0]!.status).toBe('SKIPPED');
    });

    it('should handle partial failures', async () => {
      mockRepository.preCreateAssetFromASN
        .mockResolvedValueOnce({
          assetId: 'asset-1',
          assetTag: 'AMS-HW-20240115-001',
          serialNumber: 'SN-DELL-001',
          asnId: 'test-asn-id',
          asnLineId: 'test-line-id',
          vendorType: 'CDW',
          description: 'Test',
          expectedDeliveryDate: '2024-01-20',
          status: 'ORDERED',
          createdAt: new Date().toISOString(),
        })
        .mockRejectedValueOnce(new Error('Database error'));

      const result = await vendorService.processCDWASN(baseCDWPayload);

      expect(result.status).toBe('PARTIAL');
      expect(result.assetsCreated).toBe(1);
      expect(result.itemsFailed).toBe(1);
      expect(result.errors).toHaveLength(1);
      expect(result.errors[0]!.errorMessage).toBe('Database error');
    });

    it('should record processing time', async () => {
      const result = await vendorService.processCDWASN(baseCDWPayload);

      expect(result.processingTimeMs).toBeGreaterThanOrEqual(0);
    });
  });

  describe('processInsightASN', () => {
    const baseInsightPayload: InsightASNPayload = {
      shipmentId: 'INSIGHT-SHIP-001',
      purchaseOrderNumber: 'PO-2024-002',
      shipmentDate: '2024-01-16T00:00:00Z',
      expectedArrival: '2024-01-21T00:00:00Z',
      carrierCode: 'UPS',
      trackingId: '1Z999AA10123456784',
      originAddress: {
        line1: '6820 S Harl Ave',
        city: 'Tempe',
        stateProvince: 'AZ',
        postalCode: '85283',
        countryCode: 'US',
      },
      destinationAddress: {
        line1: '456 Corporate Blvd',
        city: 'Phoenix',
        stateProvince: 'AZ',
        postalCode: '85001',
        countryCode: 'US',
      },
      lineItems: [
        {
          lineNum: 1,
          insightPartNumber: 'INS-HP-001',
          manufacturerPartNumber: 'HP-ELITE-840',
          itemDescription: 'HP EliteBook 840 G9',
          qty: 3,
          serialNums: ['HP-SN-001', 'HP-SN-002', 'HP-SN-003'],
          mfr: 'HP',
          model: 'EliteBook 840 G9',
          price: 1499.99,
        },
      ],
    };

    it('should process Insight ASN and pre-create assets', async () => {
      const result = await vendorService.processInsightASN(baseInsightPayload);

      expect(result.vendorType).toBe('INSIGHT');
      expect(result.vendorAsnNumber).toBe('INSIGHT-SHIP-001');
      expect(result.purchaseOrderNumber).toBe('PO-2024-002');
      expect(result.status).toBe('COMPLETED');
      expect(result.totalItems).toBe(3);
      expect(result.assetsCreated).toBe(3);

      expect(mockRepository.createASN).toHaveBeenCalledWith(
        expect.objectContaining({
          vendorType: 'INSIGHT',
          vendorName: 'Insight',
          vendorAsnNumber: 'INSIGHT-SHIP-001',
        })
      );

      expect(mockRepository.preCreateAssetFromASN).toHaveBeenCalledTimes(3);
    });

    it('should skip already processed Insight ASN', async () => {
      mockRepository.findASNByVendorNumber.mockResolvedValue({
        asnId: 'existing-insight-asn',
        vendorType: 'INSIGHT',
        vendorName: 'Insight',
        vendorAsnNumber: 'INSIGHT-SHIP-001',
        purchaseOrderNumber: 'PO-2024-002',
        shipDate: '2024-01-16',
        expectedDeliveryDate: '2024-01-21',
        status: 'COMPLETED',
        totalItems: 3,
        processedItems: 3,
        failedItems: 0,
        lines: [],
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      });

      const result = await vendorService.processInsightASN(baseInsightPayload);

      expect(result.status).toBe('COMPLETED');
      expect(mockRepository.createASN).not.toHaveBeenCalled();
    });

    it('should handle multiple line items', async () => {
      const multiLinePayload: InsightASNPayload = {
        ...baseInsightPayload,
        lineItems: [
          {
            lineNum: 1,
            insightPartNumber: 'INS-HP-001',
            itemDescription: 'HP EliteBook',
            qty: 2,
            serialNums: ['HP-001', 'HP-002'],
            mfr: 'HP',
          },
          {
            lineNum: 2,
            insightPartNumber: 'INS-DELL-001',
            itemDescription: 'Dell Latitude',
            qty: 1,
            serialNums: ['DELL-001'],
            mfr: 'Dell',
          },
        ],
      };

      const result = await vendorService.processInsightASN(multiLinePayload);

      expect(result.totalItems).toBe(3);
      expect(result.assetsCreated).toBe(3);
      expect(result.lineResults).toHaveLength(2);
    });
  });

  describe('processASN', () => {
    it('should route CDW ASN to correct processor', async () => {
      const cdwPayload: CDWASNPayload = {
        asnNumber: 'CDW-001',
        poNumber: 'PO-001',
        shipDate: '2024-01-15',
        estimatedDeliveryDate: '2024-01-20',
        items: [],
      };

      const result = await vendorService.processASN('CDW', cdwPayload);

      expect(result.vendorType).toBe('CDW');
    });

    it('should route Insight ASN to correct processor', async () => {
      const insightPayload: InsightASNPayload = {
        shipmentId: 'INS-001',
        purchaseOrderNumber: 'PO-001',
        shipmentDate: '2024-01-15',
        expectedArrival: '2024-01-20',
        lineItems: [],
      };

      const result = await vendorService.processASN('INSIGHT', insightPayload);

      expect(result.vendorType).toBe('INSIGHT');
    });

    it('should throw error for unsupported vendor', async () => {
      await expect(
        vendorService.processASN('UNKNOWN' as any, {} as any)
      ).rejects.toThrow('Unsupported vendor type: UNKNOWN');
    });
  });

  describe('getVendorCatalog', () => {
    beforeEach(() => {
      mockRepository.getVendorCatalogItems.mockResolvedValue({
        items: [
          {
            catalogItemId: 'cat-001',
            vendorType: 'CDW',
            vendorPartNumber: 'CDW-001',
            manufacturer: 'Dell',
            model: 'Latitude 5540',
            description: 'Dell Latitude 5540 Laptop',
            category: 'Laptops',
            unitPrice: 1299.99,
            currency: 'USD',
            availability: 'IN_STOCK',
            lastUpdatedAt: new Date().toISOString(),
            createdAt: new Date().toISOString(),
          },
        ],
        totalCount: 1,
      });
      mockRepository.getVendorCatalogCategories.mockResolvedValue(['Laptops', 'Desktops', 'Monitors']);
    });

    it('should return vendor catalog', async () => {
      const catalog = await vendorService.getVendorCatalog('CDW');

      expect(catalog.vendorType).toBe('CDW');
      expect(catalog.vendorName).toBe('CDW');
      expect(catalog.totalItems).toBe(1);
      expect(catalog.items).toHaveLength(1);
      expect(catalog.categories).toEqual(['Laptops', 'Desktops', 'Monitors']);
    });

    it('should return correct vendor names', async () => {
      const cdwCatalog = await vendorService.getVendorCatalog('CDW');
      expect(cdwCatalog.vendorName).toBe('CDW');

      const insightCatalog = await vendorService.getVendorCatalog('INSIGHT');
      expect(insightCatalog.vendorName).toBe('Insight');

      const shiCatalog = await vendorService.getVendorCatalog('SHI');
      expect(shiCatalog.vendorName).toBe('SHI International');
    });
  });

  describe('searchVendorCatalog', () => {
    beforeEach(() => {
      mockRepository.getVendorCatalogItems.mockResolvedValue({
        items: [
          {
            catalogItemId: 'cat-001',
            vendorType: 'CDW',
            vendorPartNumber: 'CDW-001',
            manufacturer: 'Dell',
            model: 'Latitude 5540',
            description: 'Dell Latitude 5540 Laptop',
            category: 'Laptops',
            unitPrice: 1299.99,
            currency: 'USD',
            availability: 'IN_STOCK',
            lastUpdatedAt: new Date().toISOString(),
            createdAt: new Date().toISOString(),
          },
        ],
        totalCount: 50,
      });
    });

    it('should search catalog with filters', async () => {
      const request: VendorCatalogSearchRequest = {
        vendorType: 'CDW',
        searchTerm: 'laptop',
        category: 'Laptops',
        manufacturer: 'Dell',
        minPrice: 1000,
        maxPrice: 2000,
        page: 1,
        limit: 20,
      };

      const result = await vendorService.searchVendorCatalog(request);

      expect(result.items).toHaveLength(1);
      expect(result.totalCount).toBe(50);
      expect(result.page).toBe(1);
      expect(result.limit).toBe(20);
      expect(result.hasMore).toBe(true);

      expect(mockRepository.getVendorCatalogItems).toHaveBeenCalledWith(request);
    });

    it('should handle pagination correctly', async () => {
      mockRepository.getVendorCatalogItems.mockResolvedValue({
        items: [],
        totalCount: 100,
      });

      const result = await vendorService.searchVendorCatalog({
        page: 3,
        limit: 25,
      });

      expect(result.page).toBe(3);
      expect(result.limit).toBe(25);
      expect(result.hasMore).toBe(true); // 3 * 25 = 75 < 100
    });

    it('should indicate no more results when at end', async () => {
      mockRepository.getVendorCatalogItems.mockResolvedValue({
        items: [],
        totalCount: 50,
      });

      const result = await vendorService.searchVendorCatalog({
        page: 2,
        limit: 50,
      });

      expect(result.hasMore).toBe(false); // 2 * 50 = 100 >= 50
    });
  });

  describe('getASN', () => {
    it('should return ASN by ID', async () => {
      mockRepository.getASNById.mockResolvedValue({
        asnId: 'test-asn-id',
        vendorType: 'CDW',
        vendorName: 'CDW',
        vendorAsnNumber: 'ASN-001',
        purchaseOrderNumber: 'PO-001',
        shipDate: '2024-01-15',
        expectedDeliveryDate: '2024-01-20',
        status: 'COMPLETED',
        totalItems: 2,
        processedItems: 2,
        failedItems: 0,
        lines: [],
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      });

      const asn = await vendorService.getASN('test-asn-id');

      expect(asn).not.toBeNull();
      expect(asn!.asnId).toBe('test-asn-id');
      expect(mockRepository.getASNById).toHaveBeenCalledWith('test-asn-id');
    });

    it('should return null for non-existent ASN', async () => {
      mockRepository.getASNById.mockResolvedValue(null);

      const asn = await vendorService.getASN('non-existent-id');

      expect(asn).toBeNull();
    });
  });

  describe('getASNStatistics', () => {
    it('should return ASN statistics', async () => {
      mockRepository.getASNStatistics.mockResolvedValue({
        total: 100,
        pending: 10,
        completed: 85,
        failed: 5,
        assetsCreated: 500,
      });

      const stats = await vendorService.getASNStatistics('CDW');

      expect(stats.total).toBe(100);
      expect(stats.pending).toBe(10);
      expect(stats.completed).toBe(85);
      expect(stats.failed).toBe(5);
      expect(stats.assetsCreated).toBe(500);
    });

    it('should return statistics for all vendors when no type specified', async () => {
      mockRepository.getASNStatistics.mockResolvedValue({
        total: 200,
        pending: 20,
        completed: 170,
        failed: 10,
        assetsCreated: 1000,
      });

      const stats = await vendorService.getASNStatistics();

      expect(stats.total).toBe(200);
      expect(mockRepository.getASNStatistics).toHaveBeenCalledWith(undefined);
    });
  });

  describe('error handling', () => {
    it('should handle repository errors gracefully during ASN processing', async () => {
      mockRepository.createASN.mockRejectedValue(new Error('Database connection failed'));

      await expect(
        vendorService.processCDWASN({
          asnNumber: 'ASN-001',
          poNumber: 'PO-001',
          shipDate: '2024-01-15',
          estimatedDeliveryDate: '2024-01-20',
          items: [],
        })
      ).rejects.toThrow('Database connection failed');
    });

    it('should handle all assets failing during ASN processing', async () => {
      mockRepository.preCreateAssetFromASN.mockRejectedValue(new Error('Asset creation failed'));

      const result = await vendorService.processCDWASN({
        asnNumber: 'ASN-001',
        poNumber: 'PO-001',
        shipDate: '2024-01-15',
        estimatedDeliveryDate: '2024-01-20',
        items: [
          {
            lineNumber: 1,
            cdwPartNumber: 'CDW-001',
            description: 'Test Item',
            quantity: 2,
            serialNumbers: ['SN001', 'SN002'],
          },
        ],
      });

      expect(result.status).toBe('FAILED');
      expect(result.itemsFailed).toBe(2);
      expect(result.assetsCreated).toBe(0);
    });
  });
});

