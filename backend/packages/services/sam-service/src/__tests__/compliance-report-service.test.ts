/**
 * Unit tests for Compliance Report Service
 *
 * Tests the business logic for compliance reporting:
 * - Generate audit-ready reports showing license ownership and usage evidence (Requirement 4.14)
 * - Support PDF, Excel, CSV export formats (Requirement 16.7)
 * - Include audit trail information for compliance
 *
 * Requirements: 4.14, 16.7
 */

import * as complianceReportService from '../compliance-report/compliance-report-service';
import * as complianceReportRepository from '../compliance-report/compliance-report-repository';

// Mock the repository
jest.mock('../compliance-report/compliance-report-repository');

// Mock the cache module
jest.mock('@ams/cache', () => ({
  get: jest.fn().mockResolvedValue(null),
  set: jest.fn().mockResolvedValue(undefined),
  del: jest.fn().mockResolvedValue(undefined),
  DEFAULT_TTL: { SHORT: 60, MEDIUM: 300, LONG: 3600 },
}));

// Mock the events module
jest.mock('@ams/events', () => ({
  publishEvent: jest.fn().mockResolvedValue('event-id'),
}));

// Mock uuid
jest.mock('uuid', () => ({
  v4: jest.fn().mockReturnValue('mock-report-uuid-1234'),
}));

const mockRepository = complianceReportRepository as jest.Mocked<typeof complianceReportRepository>;

describe('Compliance Report Service', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('generateComplianceReport', () => {
    const mockSummary: complianceReportRepository.ComplianceReportSummary = {
      totalProducts: 10,
      compliantProducts: 7,
      overLicensedProducts: 2,
      underLicensedProducts: 1,
      totalEntitlements: 25,
      totalInstallations: 150,
      totalLicenseCost: 50000,
      potentialRiskExposure: 5000,
      complianceRate: 70,
    };

    const mockProductData: complianceReportRepository.ProductComplianceData[] = [
      {
        productId: 'product-1',
        publisher: 'Microsoft',
        productName: 'Office 365',
        version: '2024',
        edition: 'Enterprise',
        entitlementsOwned: 100,
        installationsFound: 95,
        compliancePosition: 'COMPLIANT',
        overUnderCount: 5,
        compliancePercentage: 105.26,
        lastReconciledAt: '2024-06-01T00:00:00Z',
        totalLicenseCost: 25000,
        potentialRisk: 0,
      },
      {
        productId: 'product-2',
        publisher: 'Adobe',
        productName: 'Creative Cloud',
        version: '2024',
        edition: 'All Apps',
        entitlementsOwned: 50,
        installationsFound: 60,
        compliancePosition: 'UNDER_LICENSED',
        overUnderCount: -10,
        compliancePercentage: 83.33,
        lastReconciledAt: '2024-06-01T00:00:00Z',
        totalLicenseCost: 25000,
        potentialRisk: 5000,
      },
    ];

    const mockEntitlements: complianceReportRepository.EntitlementDetail[] = [
      {
        entitlementId: 'ent-1',
        softwareProductId: 'product-1',
        licenseType: 'SUBSCRIPTION',
        metricType: 'PER_USER',
        quantityPurchased: 100,
        quantityAvailable: 100,
        unitCost: 250,
        startDate: '2024-01-01',
        endDate: '2024-12-31',
        contractNumber: 'CONTRACT-001',
        purchaseOrderNumber: 'PO-001',
        vendorName: 'Microsoft',
      },
    ];

    const mockInstallations: complianceReportRepository.InstallationDetail[] = [
      {
        installationId: 'inst-1',
        softwareProductId: 'product-1',
        hardwareAssetId: 'asset-1',
        assetTag: 'LAPTOP-001',
        hostname: 'user-laptop-001',
        assignedUser: 'John Doe',
        department: 'Engineering',
        installedDate: '2024-01-15',
        lastUsedDate: '2024-06-10',
        usageMinutes30Day: 4500,
        discoverySource: 'SCCM',
        isAuthorized: true,
      },
    ];

    const mockEvidence: complianceReportRepository.LicenseOwnershipEvidence[] = [
      {
        evidenceId: 'evidence-1',
        entitlementId: 'ent-1',
        evidenceType: 'PURCHASE_ORDER',
        documentNumber: 'PO-001',
        documentDate: '2024-01-01',
        vendorName: 'Microsoft',
        description: 'Office 365 Enterprise licenses',
        quantity: 100,
        unitCost: 250,
        totalCost: 25000,
        documentUrl: 'https://docs.example.com/po-001.pdf',
        createdAt: '2024-01-01T00:00:00Z',
      },
    ];

    it('should generate a full compliance report', async () => {
      mockRepository.getComplianceReportSummary.mockResolvedValue(mockSummary);
      mockRepository.getProductComplianceData.mockResolvedValue(mockProductData);
      mockRepository.getEntitlementDetails.mockResolvedValue(mockEntitlements);
      mockRepository.getInstallationDetails.mockResolvedValue(mockInstallations);
      mockRepository.getLicenseOwnershipEvidence.mockResolvedValue(mockEvidence);

      const result = await complianceReportService.generateComplianceReport({
        reportType: 'FULL',
        title: 'Q2 2024 Compliance Report',
      });

      expect(result.reportId).toBe('mock-report-uuid-1234');
      expect(result.reportType).toBe('FULL');
      expect(result.summary).toEqual(mockSummary);
      expect(result.products.length).toBe(2);
      expect(result.metadata.title).toBe('Q2 2024 Compliance Report');
      expect(result.metadata.productCount).toBe(2);
    });

    it('should generate a summary report', async () => {
      mockRepository.getComplianceReportSummary.mockResolvedValue(mockSummary);
      mockRepository.getProductComplianceData.mockResolvedValue(mockProductData);
      mockRepository.getEntitlementDetails.mockResolvedValue([]);
      mockRepository.getInstallationDetails.mockResolvedValue([]);

      const result = await complianceReportService.generateComplianceReport({
        reportType: 'SUMMARY',
      });

      expect(result.reportType).toBe('SUMMARY');
      expect(result.summary.totalProducts).toBe(10);
      expect(result.summary.complianceRate).toBe(70);
    });

    it('should filter by publisher', async () => {
      mockRepository.getComplianceReportSummary.mockResolvedValue(mockSummary);
      mockRepository.getProductComplianceData.mockResolvedValue([mockProductData[0]!]);
      mockRepository.getEntitlementDetails.mockResolvedValue(mockEntitlements);
      mockRepository.getInstallationDetails.mockResolvedValue(mockInstallations);
      mockRepository.getLicenseOwnershipEvidence.mockResolvedValue(mockEvidence);

      const result = await complianceReportService.generateComplianceReport({
        filters: {
          publishers: ['Microsoft'],
        },
      });

      expect(mockRepository.getProductComplianceData).toHaveBeenCalledWith(
        expect.objectContaining({ publishers: ['Microsoft'] })
      );
      expect(result.products.length).toBe(1);
      expect(result.products[0]?.publisher).toBe('Microsoft');
    });

    it('should filter by compliance status', async () => {
      mockRepository.getComplianceReportSummary.mockResolvedValue(mockSummary);
      mockRepository.getProductComplianceData.mockResolvedValue([mockProductData[1]!]);
      mockRepository.getEntitlementDetails.mockResolvedValue([]);
      mockRepository.getInstallationDetails.mockResolvedValue([]);

      const result = await complianceReportService.generateComplianceReport({
        filters: {
          complianceStatus: 'UNDER_LICENSED',
        },
      });

      expect(mockRepository.getProductComplianceData).toHaveBeenCalledWith(
        expect.objectContaining({ complianceStatus: 'UNDER_LICENSED' })
      );
      expect(result.products.length).toBe(1);
      expect(result.products[0]?.compliancePosition).toBe('UNDER_LICENSED');
    });

    it('should include ownership evidence when requested', async () => {
      mockRepository.getComplianceReportSummary.mockResolvedValue(mockSummary);
      mockRepository.getProductComplianceData.mockResolvedValue([mockProductData[0]!]);
      mockRepository.getEntitlementDetails.mockResolvedValue(mockEntitlements);
      mockRepository.getInstallationDetails.mockResolvedValue(mockInstallations);
      mockRepository.getLicenseOwnershipEvidence.mockResolvedValue(mockEvidence);

      const result = await complianceReportService.generateComplianceReport({
        filters: {
          includeEvidence: true,
        },
      });

      expect(mockRepository.getLicenseOwnershipEvidence).toHaveBeenCalled();
      expect(result.products[0]?.ownershipEvidence.length).toBeGreaterThan(0);
    });

    it('should exclude installations when not requested', async () => {
      mockRepository.getComplianceReportSummary.mockResolvedValue(mockSummary);
      mockRepository.getProductComplianceData.mockResolvedValue([mockProductData[0]!]);
      mockRepository.getEntitlementDetails.mockResolvedValue(mockEntitlements);
      mockRepository.getLicenseOwnershipEvidence.mockResolvedValue([]);

      const result = await complianceReportService.generateComplianceReport({
        filters: {
          includeInstallations: false,
          includeEvidence: false,
        },
      });

      expect(mockRepository.getInstallationDetails).not.toHaveBeenCalled();
      expect(result.products[0]?.installations.length).toBe(0);
    });

    it('should include audit trail when requested', async () => {
      const mockAuditTrail: complianceReportRepository.AuditTrailEntry[] = [
        {
          auditId: 'audit-1',
          entityType: 'ENTITLEMENT',
          entityId: 'ent-1',
          action: 'CREATE',
          performedBy: 'admin',
          performedAt: '2024-01-01T00:00:00Z',
          previousValue: null,
          newValue: { quantity: 100 },
          ipAddress: '192.168.1.1',
        },
      ];

      mockRepository.getComplianceReportSummary.mockResolvedValue(mockSummary);
      mockRepository.getProductComplianceData.mockResolvedValue([mockProductData[0]!]);
      mockRepository.getEntitlementDetails.mockResolvedValue(mockEntitlements);
      mockRepository.getInstallationDetails.mockResolvedValue([]);
      mockRepository.getLicenseOwnershipEvidence.mockResolvedValue([]);
      mockRepository.getComplianceAuditTrail.mockResolvedValue(mockAuditTrail);

      const result = await complianceReportService.generateComplianceReport({
        filters: {
          includeAuditTrail: true,
          includeInstallations: false,
          includeEvidence: false,
        },
      });

      expect(mockRepository.getComplianceAuditTrail).toHaveBeenCalled();
      expect(result.products[0]?.auditTrail.length).toBe(1);
    });

    it('should calculate metadata correctly', async () => {
      mockRepository.getComplianceReportSummary.mockResolvedValue(mockSummary);
      mockRepository.getProductComplianceData.mockResolvedValue(mockProductData);
      mockRepository.getEntitlementDetails.mockResolvedValue(mockEntitlements);
      mockRepository.getInstallationDetails.mockResolvedValue(mockInstallations);
      mockRepository.getLicenseOwnershipEvidence.mockResolvedValue(mockEvidence);

      const result = await complianceReportService.generateComplianceReport();

      expect(result.metadata.productCount).toBe(2);
      expect(result.metadata.generationDurationMs).toBeGreaterThanOrEqual(0);
    });
  });

  describe('getComplianceSummary', () => {
    const mockSummary: complianceReportRepository.ComplianceReportSummary = {
      totalProducts: 10,
      compliantProducts: 7,
      overLicensedProducts: 2,
      underLicensedProducts: 1,
      totalEntitlements: 25,
      totalInstallations: 150,
      totalLicenseCost: 50000,
      potentialRiskExposure: 5000,
      complianceRate: 70,
    };

    it('should return compliance summary', async () => {
      mockRepository.getComplianceReportSummary.mockResolvedValue(mockSummary);

      const result = await complianceReportService.getComplianceSummary();

      expect(result).toEqual(mockSummary);
      expect(result.complianceRate).toBe(70);
    });

    it('should apply filters to summary', async () => {
      mockRepository.getComplianceReportSummary.mockResolvedValue(mockSummary);

      await complianceReportService.getComplianceSummary({
        publishers: ['Microsoft'],
      });

      expect(mockRepository.getComplianceReportSummary).toHaveBeenCalledWith({
        publishers: ['Microsoft'],
      });
    });
  });

  describe('exportReport', () => {
    const mockReport: complianceReportService.ComplianceReport = {
      reportId: 'report-1',
      reportType: 'FULL',
      generatedAt: '2024-06-15T10:00:00Z',
      generatedBy: 'user-1',
      filters: {},
      summary: {
        totalProducts: 2,
        compliantProducts: 1,
        overLicensedProducts: 0,
        underLicensedProducts: 1,
        totalEntitlements: 5,
        totalInstallations: 50,
        totalLicenseCost: 25000,
        potentialRiskExposure: 2500,
        complianceRate: 50,
      },
      products: [
        {
          productId: 'product-1',
          publisher: 'Microsoft',
          productName: 'Office 365',
          version: '2024',
          edition: 'Enterprise',
          entitlementsOwned: 100,
          installationsFound: 95,
          compliancePosition: 'COMPLIANT',
          overUnderCount: 5,
          compliancePercentage: 105.26,
          lastReconciledAt: '2024-06-01T00:00:00Z',
          totalLicenseCost: 25000,
          potentialRisk: 0,
          entitlements: [
            {
              entitlementId: 'ent-1',
              softwareProductId: 'product-1',
              licenseType: 'SUBSCRIPTION',
              metricType: 'PER_USER',
              quantityPurchased: 100,
              quantityAvailable: 100,
              unitCost: 250,
              startDate: '2024-01-01',
              endDate: '2024-12-31',
              contractNumber: 'CONTRACT-001',
              purchaseOrderNumber: 'PO-001',
              vendorName: 'Microsoft',
            },
          ],
          installations: [],
          ownershipEvidence: [],
          auditTrail: [],
        },
      ],
      metadata: {
        title: 'Test Report',
        description: 'Test description',
        generationDurationMs: 100,
        productCount: 1,
        entitlementCount: 1,
        installationCount: 0,
        evidenceCount: 0,
        auditEntryCount: 0,
      },
    };

    beforeEach(() => {
      // Mock cache.get to return the report
      const cache = require('@ams/cache');
      cache.get.mockResolvedValue(mockReport);
    });

    it('should export report as CSV', async () => {
      const result = await complianceReportService.exportReport('report-1', 'CSV');

      expect(result.format).toBe('CSV');
      expect(result.filename).toBe('compliance-report-report-1.csv');
      expect(result.contentType).toBe('text/csv');
      expect(result.content).toContain('Software License Compliance Report');
      expect(result.content).toContain('Microsoft');
      expect(result.content).toContain('Office 365');
    });

    it('should export report as Excel', async () => {
      const result = await complianceReportService.exportReport('report-1', 'EXCEL');

      expect(result.format).toBe('EXCEL');
      expect(result.filename).toBe('compliance-report-report-1.xlsx');
      expect(result.contentType).toBe('application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
      expect(result.content).toContain('<?xml');
      expect(result.content).toContain('Workbook');
    });

    it('should export report as PDF', async () => {
      const result = await complianceReportService.exportReport('report-1', 'PDF');

      expect(result.format).toBe('PDF');
      expect(result.filename).toBe('compliance-report-report-1.pdf');
      expect(result.contentType).toBe('application/pdf');
      expect(result.content).toContain('SOFTWARE LICENSE COMPLIANCE REPORT');
    });

    it('should throw error for non-existent report', async () => {
      const cache = require('@ams/cache');
      cache.get.mockResolvedValue(null);

      await expect(
        complianceReportService.exportReport('non-existent', 'CSV')
      ).rejects.toThrow('Report not found');
    });

    it('should throw error for unsupported format', async () => {
      await expect(
        complianceReportService.exportReport('report-1', 'XML' as complianceReportRepository.ExportFormat)
      ).rejects.toThrow('Unsupported export format');
    });

    it('should include summary in CSV export', async () => {
      const result = await complianceReportService.exportReport('report-1', 'CSV');

      expect(result.content).toContain('SUMMARY');
      expect(result.content).toContain('Total Products,2');
      expect(result.content).toContain('Compliance Rate,50%');
    });

    it('should include entitlement details in CSV export', async () => {
      const result = await complianceReportService.exportReport('report-1', 'CSV');

      expect(result.content).toContain('ENTITLEMENT DETAILS');
      expect(result.content).toContain('SUBSCRIPTION');
      expect(result.content).toContain('PER_USER');
    });
  });

  describe('getAvailablePublishers', () => {
    it('should return list of publishers', async () => {
      mockRepository.getDistinctPublishers.mockResolvedValue([
        'Adobe',
        'Microsoft',
        'Oracle',
        'Salesforce',
      ]);

      const result = await complianceReportService.getAvailablePublishers();

      expect(result).toHaveLength(4);
      expect(result).toContain('Microsoft');
      expect(result).toContain('Adobe');
    });
  });

  describe('getComplianceIssues', () => {
    const mockUnderLicensed: complianceReportRepository.ProductComplianceData[] = [
      {
        productId: 'product-1',
        publisher: 'Adobe',
        productName: 'Creative Cloud',
        version: '2024',
        edition: 'All Apps',
        entitlementsOwned: 50,
        installationsFound: 60,
        compliancePosition: 'UNDER_LICENSED',
        overUnderCount: -10,
        compliancePercentage: 83.33,
        lastReconciledAt: '2024-06-01T00:00:00Z',
        totalLicenseCost: 25000,
        potentialRisk: 5000,
      },
    ];

    it('should return under-licensed products by default', async () => {
      mockRepository.getProductComplianceData.mockResolvedValue(mockUnderLicensed);

      const result = await complianceReportService.getComplianceIssues();

      expect(mockRepository.getProductComplianceData).toHaveBeenCalledWith({
        complianceStatus: 'UNDER_LICENSED',
      });
      expect(result.length).toBe(1);
      expect(result[0]?.compliancePosition).toBe('UNDER_LICENSED');
    });

    it('should filter by specified compliance status', async () => {
      mockRepository.getProductComplianceData.mockResolvedValue([]);

      await complianceReportService.getComplianceIssues('OVER_LICENSED');

      expect(mockRepository.getProductComplianceData).toHaveBeenCalledWith({
        complianceStatus: 'OVER_LICENSED',
      });
    });
  });
});
