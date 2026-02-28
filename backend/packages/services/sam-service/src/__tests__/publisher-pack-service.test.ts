/**
 * Unit tests for Publisher Pack Service
 *
 * Tests vendor-specific license calculation functionality:
 * - Microsoft license calculations (Requirement 4.3)
 * - Oracle license calculations (Requirement 4.4)
 * - Adobe and Salesforce license calculations (Requirement 4.5)
 */

import type { EntitlementDetails, InstallationWithHardware } from '../publisher-pack/publisher-pack-repository';
import {
  calculateMicrosoftLicenses,
  calculateOracleLicenses,
  calculateAdobeLicenses,
  calculateSalesforceLicenses,
  categorizeMicrosoftProduct,
  categorizeOracleProduct,
  getOracleProcessorCoreFactor,
  normalizePublisher,
  isSupportedPublisher,
  getSupportedPublishers,
} from '../publisher-pack/publisher-pack-service';

/**
 * Helper to create mock installation with hardware
 */
function createMockInstallation(overrides: Partial<InstallationWithHardware> = {}): InstallationWithHardware {
  return {
    installationId: 'inst-001',
    softwareProductId: 'prod-001',
    hardwareAssetId: 'hw-001',
    installedDate: '2024-01-01',
    lastUsedDate: '2024-06-01',
    versionDetected: '1.0',
    status: 'ACTIVE',
    hardware: {
      assetId: 'hw-001',
      assetTag: 'HW-001',
      manufacturer: 'Dell',
      model: 'PowerEdge R640',
      cpu: 'Intel Xeon Gold 6248',
      coreCount: 20,
      processorCount: 2,
      memoryGb: 128,
      isVirtual: false,
      hypervisorType: null,
      assignedToUserId: 'user-001',
      status: 'DEPLOYED',
    },
    ...overrides,
  };
}

/**
 * Helper to create mock entitlement
 */
function createMockEntitlement(overrides: Partial<EntitlementDetails> = {}): EntitlementDetails {
  return {
    entitlementId: 'ent-001',
    softwareProductId: 'prod-001',
    licenseType: 'PERPETUAL',
    quantityPurchased: 10,
    quantityAvailable: 10,
    metricType: 'PER_CORE',
    metricValue: null,
    startDate: '2024-01-01',
    endDate: null,
    isActive: true,
    ...overrides,
  };
}

describe('Publisher Pack Service', () => {
  describe('normalizePublisher', () => {
    it('should normalize Microsoft variations', () => {
      expect(normalizePublisher('Microsoft')).toBe('MICROSOFT');
      expect(normalizePublisher('MICROSOFT')).toBe('MICROSOFT');
      expect(normalizePublisher('microsoft corporation')).toBe('MICROSOFT');
      expect(normalizePublisher('MS')).toBe('MICROSOFT');
    });

    it('should normalize Oracle variations', () => {
      expect(normalizePublisher('Oracle')).toBe('ORACLE');
      expect(normalizePublisher('ORACLE')).toBe('ORACLE');
      expect(normalizePublisher('Oracle Corporation')).toBe('ORACLE');
    });

    it('should normalize Adobe variations', () => {
      expect(normalizePublisher('Adobe')).toBe('ADOBE');
      expect(normalizePublisher('ADOBE')).toBe('ADOBE');
      expect(normalizePublisher('Adobe Inc.')).toBe('ADOBE');
    });

    it('should normalize Salesforce variations', () => {
      expect(normalizePublisher('Salesforce')).toBe('SALESFORCE');
      expect(normalizePublisher('SALESFORCE')).toBe('SALESFORCE');
      expect(normalizePublisher('SFDC')).toBe('SALESFORCE');
    });

    it('should return null for unsupported publishers', () => {
      expect(normalizePublisher('Unknown')).toBeNull();
      expect(normalizePublisher('IBM')).toBeNull();
      expect(normalizePublisher('SAP')).toBeNull();
    });
  });

  describe('isSupportedPublisher', () => {
    it('should return true for supported publishers', () => {
      expect(isSupportedPublisher('Microsoft')).toBe(true);
      expect(isSupportedPublisher('Oracle')).toBe(true);
      expect(isSupportedPublisher('Adobe')).toBe(true);
      expect(isSupportedPublisher('Salesforce')).toBe(true);
    });

    it('should return false for unsupported publishers', () => {
      expect(isSupportedPublisher('IBM')).toBe(false);
      expect(isSupportedPublisher('SAP')).toBe(false);
      expect(isSupportedPublisher('Unknown')).toBe(false);
    });
  });

  describe('getSupportedPublishers', () => {
    it('should return all supported publishers', () => {
      const publishers = getSupportedPublishers();
      expect(publishers).toContain('MICROSOFT');
      expect(publishers).toContain('ORACLE');
      expect(publishers).toContain('ADOBE');
      expect(publishers).toContain('SALESFORCE');
      expect(publishers).toHaveLength(4);
    });
  });

  describe('categorizeMicrosoftProduct', () => {
    it('should categorize SQL Server products', () => {
      expect(categorizeMicrosoftProduct('SQL Server 2019 Enterprise')).toBe('SQL_SERVER');
      expect(categorizeMicrosoftProduct('Microsoft SQLServer Standard')).toBe('SQL_SERVER');
    });

    it('should categorize Windows Server products', () => {
      expect(categorizeMicrosoftProduct('Windows Server 2022 Datacenter')).toBe('WINDOWS_SERVER');
      expect(categorizeMicrosoftProduct('Microsoft Windows Server Standard')).toBe('WINDOWS_SERVER');
    });

    it('should categorize Office 365 products', () => {
      expect(categorizeMicrosoftProduct('Office 365 E3')).toBe('OFFICE_365');
      expect(categorizeMicrosoftProduct('Microsoft 365 Business')).toBe('OFFICE_365');
      expect(categorizeMicrosoftProduct('O365 Enterprise')).toBe('OFFICE_365');
      expect(categorizeMicrosoftProduct('M365 E5')).toBe('OFFICE_365');
    });

    it('should categorize Office Perpetual products', () => {
      expect(categorizeMicrosoftProduct('Office 2021 Professional')).toBe('OFFICE_PERPETUAL');
      expect(categorizeMicrosoftProduct('Microsoft Office Standard 2019')).toBe('OFFICE_PERPETUAL');
    });

    it('should categorize Visual Studio products', () => {
      expect(categorizeMicrosoftProduct('Visual Studio Enterprise 2022')).toBe('VISUAL_STUDIO');
      expect(categorizeMicrosoftProduct('Microsoft Visual Studio Professional')).toBe('VISUAL_STUDIO');
    });

    it('should return OTHER for unknown products', () => {
      expect(categorizeMicrosoftProduct('Microsoft Project')).toBe('OTHER');
      expect(categorizeMicrosoftProduct('Visio Professional')).toBe('OTHER');
    });
  });

  describe('categorizeOracleProduct', () => {
    it('should categorize Database Enterprise products', () => {
      expect(categorizeOracleProduct('Oracle Database Enterprise Edition')).toBe('DATABASE_ENTERPRISE');
      expect(categorizeOracleProduct('Database 19c Enterprise')).toBe('DATABASE_ENTERPRISE');
    });

    it('should categorize Database Standard products', () => {
      expect(categorizeOracleProduct('Oracle Database Standard Edition')).toBe('DATABASE_STANDARD');
      expect(categorizeOracleProduct('Database Standard Edition 2')).toBe('DATABASE_STANDARD');
    });

    it('should categorize Database Options', () => {
      expect(categorizeOracleProduct('Oracle Partitioning')).toBe('DATABASE_OPTIONS');
      expect(categorizeOracleProduct('Real Application Clusters (RAC)')).toBe('DATABASE_OPTIONS');
      expect(categorizeOracleProduct('Oracle Database Advanced Security')).toBe('DATABASE_OPTIONS');
      expect(categorizeOracleProduct('Diagnostics Pack')).toBe('DATABASE_OPTIONS');
      expect(categorizeOracleProduct('Tuning Pack')).toBe('DATABASE_OPTIONS');
    });

    it('should categorize Management Packs', () => {
      expect(categorizeOracleProduct('Oracle Enterprise Manager Management Pack')).toBe('MANAGEMENT_PACKS');
      expect(categorizeOracleProduct('Enterprise Manager Cloud Control')).toBe('MANAGEMENT_PACKS');
    });

    it('should categorize Middleware products', () => {
      expect(categorizeOracleProduct('Oracle WebLogic Server')).toBe('MIDDLEWARE');
      expect(categorizeOracleProduct('Oracle Fusion Middleware')).toBe('MIDDLEWARE');
    });

    it('should return OTHER for unknown products', () => {
      expect(categorizeOracleProduct('Oracle Java SE')).toBe('OTHER');
      expect(categorizeOracleProduct('Oracle Linux')).toBe('OTHER');
    });
  });

  describe('getOracleProcessorCoreFactor', () => {
    it('should return 0.5 for Intel Xeon processors', () => {
      expect(getOracleProcessorCoreFactor('Intel Xeon Gold 6248')).toBe(0.5);
      expect(getOracleProcessorCoreFactor('Xeon E5-2680')).toBe(0.5);
    });

    it('should return 0.5 for AMD EPYC processors', () => {
      expect(getOracleProcessorCoreFactor('AMD EPYC 7742')).toBe(0.5);
      expect(getOracleProcessorCoreFactor('EPYC 7002 Series')).toBe(0.5);
    });

    it('should return 1.0 for IBM POWER processors', () => {
      expect(getOracleProcessorCoreFactor('IBM POWER9')).toBe(1.0);
      expect(getOracleProcessorCoreFactor('POWER8')).toBe(1.0);
    });

    it('should return 0.25 for Oracle SPARC processors', () => {
      expect(getOracleProcessorCoreFactor('Oracle SPARC M8')).toBe(0.25);
      expect(getOracleProcessorCoreFactor('SPARC T8')).toBe(0.25);
    });

    it('should return 0.5 for unknown processors', () => {
      expect(getOracleProcessorCoreFactor('Unknown CPU')).toBe(0.5);
      expect(getOracleProcessorCoreFactor(null)).toBe(0.5);
    });
  });

  describe('calculateMicrosoftLicenses', () => {
    /**
     * Requirement 4.3: Microsoft per-core licensing for SQL Server
     */
    describe('SQL Server per-core licensing', () => {
      it('should calculate licenses based on total cores', () => {
        const installations = [
          createMockInstallation({
            hardware: {
              ...createMockInstallation().hardware,
              coreCount: 16,
              processorCount: 2,
            },
          }),
        ];
        const entitlements = [createMockEntitlement({ quantityPurchased: 8 })];

        const result = calculateMicrosoftLicenses('SQL Server 2019 Enterprise', installations, entitlements);

        expect(result.calculationMethod).toBe('PER_CORE_2PACK');
        expect(result.licensesRequired).toBe(8); // 16 cores / 2 cores per license
        expect(result.licensesOwned).toBe(8);
        expect(result.compliancePosition).toBe('COMPLIANT');
      });

      it('should apply minimum 4 cores per processor rule', () => {
        const installations = [
          createMockInstallation({
            hardware: {
              ...createMockInstallation().hardware,
              coreCount: 2, // Less than minimum
              processorCount: 2,
            },
          }),
        ];
        const entitlements = [createMockEntitlement({ quantityPurchased: 4 })];

        const result = calculateMicrosoftLicenses('SQL Server 2019 Standard', installations, entitlements);

        // Minimum 4 cores per processor × 2 processors = 8 cores
        expect(result.licensesRequired).toBe(4); // 8 cores / 2 cores per license
        expect((result.details as any).totalCores).toBe(8);
      });

      it('should detect under-licensing', () => {
        const installations = [
          createMockInstallation({
            hardware: {
              ...createMockInstallation().hardware,
              coreCount: 32,
              processorCount: 2,
            },
          }),
        ];
        const entitlements = [createMockEntitlement({ quantityPurchased: 8 })];

        const result = calculateMicrosoftLicenses('SQL Server 2019 Enterprise', installations, entitlements);

        expect(result.licensesRequired).toBe(16); // 32 cores / 2
        expect(result.licensesOwned).toBe(8);
        expect(result.compliancePosition).toBe('UNDER_LICENSED');
        expect(result.warnings.length).toBeGreaterThan(0);
      });
    });

    /**
     * Requirement 4.3: Microsoft per-core licensing for Windows Server
     */
    describe('Windows Server per-core licensing', () => {
      it('should apply minimum 16 cores per server rule', () => {
        const installations = [
          createMockInstallation({
            hardware: {
              ...createMockInstallation().hardware,
              coreCount: 8, // Less than minimum
              processorCount: 1,
            },
          }),
        ];
        const entitlements = [createMockEntitlement({ quantityPurchased: 8 })];

        const result = calculateMicrosoftLicenses('Windows Server 2022 Datacenter', installations, entitlements);

        // Minimum 16 cores per server
        expect(result.licensesRequired).toBe(8); // 16 cores / 2 cores per license
        expect((result.details as any).totalCores).toBe(16);
      });
    });

    /**
     * Requirement 4.3: Microsoft per-user subscription for Office 365
     */
    describe('Office 365 per-user licensing', () => {
      it('should count unique users', () => {
        const installations = [
          createMockInstallation({
            hardware: { ...createMockInstallation().hardware, assignedToUserId: 'user-001' },
          }),
          createMockInstallation({
            installationId: 'inst-002',
            hardware: { ...createMockInstallation().hardware, assignedToUserId: 'user-002' },
          }),
          createMockInstallation({
            installationId: 'inst-003',
            hardware: { ...createMockInstallation().hardware, assignedToUserId: 'user-001' }, // Same user
          }),
        ];
        const entitlements = [createMockEntitlement({ quantityPurchased: 2, metricType: 'PER_USER' })];

        const result = calculateMicrosoftLicenses('Office 365 E3', installations, entitlements);

        expect(result.calculationMethod).toBe('PER_USER_SUBSCRIPTION');
        expect(result.licensesRequired).toBe(2); // 2 unique users
        expect((result.details as any).totalUsers).toBe(2);
        expect(result.compliancePosition).toBe('COMPLIANT');
      });
    });

    /**
     * Requirement 4.3: Microsoft per-device licensing for Office Perpetual
     */
    describe('Office Perpetual per-device licensing', () => {
      it('should count total devices', () => {
        const installations = [
          createMockInstallation(),
          createMockInstallation({ installationId: 'inst-002' }),
          createMockInstallation({ installationId: 'inst-003' }),
        ];
        const entitlements = [createMockEntitlement({ quantityPurchased: 3, metricType: 'PER_DEVICE' })];

        const result = calculateMicrosoftLicenses('Office 2021 Professional', installations, entitlements);

        expect(result.calculationMethod).toBe('PER_DEVICE');
        expect(result.licensesRequired).toBe(3);
        expect((result.details as any).totalDevices).toBe(3);
        expect(result.compliancePosition).toBe('COMPLIANT');
      });
    });

    it('should add warning for virtual machine installations', () => {
      const installations = [
        createMockInstallation({
          hardware: { ...createMockInstallation().hardware, isVirtual: true },
        }),
      ];
      const entitlements = [createMockEntitlement({ quantityPurchased: 10 })];

      const result = calculateMicrosoftLicenses('SQL Server 2019 Enterprise', installations, entitlements);

      expect(result.warnings.some(w => w.includes('virtual machine'))).toBe(true);
    });
  });

  describe('calculateOracleLicenses', () => {
    /**
     * Requirement 4.4: Oracle processor-based licensing with core factor
     */
    describe('Processor-based licensing', () => {
      it('should apply core factor for Intel Xeon processors', () => {
        const installations = [
          createMockInstallation({
            hardware: {
              ...createMockInstallation().hardware,
              cpu: 'Intel Xeon Gold 6248',
              coreCount: 20,
              processorCount: 2,
            },
          }),
        ];
        const entitlements = [createMockEntitlement({ quantityPurchased: 10, metricType: 'PER_PROCESSOR' })];

        const result = calculateOracleLicenses('Oracle Database Enterprise Edition', installations, entitlements);

        expect(result.calculationMethod).toBe('PROCESSOR_CORE_FACTOR');
        // 20 cores × 0.5 core factor = 10 processor licenses
        expect(result.licensesRequired).toBe(10);
        expect((result.details as any).processorCoreFactor).toBe(0.5);
      });

      it('should apply different core factor for SPARC processors', () => {
        const installations = [
          createMockInstallation({
            hardware: {
              ...createMockInstallation().hardware,
              cpu: 'Oracle SPARC M8',
              coreCount: 32,
              processorCount: 1,
            },
          }),
        ];
        const entitlements = [createMockEntitlement({ quantityPurchased: 8, metricType: 'PER_PROCESSOR' })];

        const result = calculateOracleLicenses('Oracle Database Enterprise Edition', installations, entitlements);

        // 32 cores × 0.25 core factor = 8 processor licenses
        expect(result.licensesRequired).toBe(8);
        expect((result.details as any).processorCoreFactor).toBe(0.25);
      });
    });

    /**
     * Requirement 4.4: Oracle Named User Plus licensing
     */
    describe('Named User Plus licensing', () => {
      it('should count unique users with minimum per processor', () => {
        const installations = [
          createMockInstallation({
            hardware: {
              ...createMockInstallation().hardware,
              processorCount: 2,
              assignedToUserId: 'user-001',
            },
          }),
        ];
        const entitlements = [createMockEntitlement({ quantityPurchased: 50, metricType: 'PER_USER' })];

        const result = calculateOracleLicenses('Oracle Database Standard Edition', installations, entitlements);

        expect(result.calculationMethod).toBe('NAMED_USER_PLUS');
        // Minimum 25 named users per processor × 2 processors = 50
        expect(result.licensesRequired).toBe(50);
        expect((result.details as any).minimumNamedUsers).toBe(25);
      });
    });

    /**
     * Requirement 4.4: Oracle Database Options licensing
     */
    describe('Database Options licensing', () => {
      it('should add warning about matching base database metric', () => {
        const installations = [createMockInstallation()];
        const entitlements = [createMockEntitlement({ quantityPurchased: 10 })];

        const result = calculateOracleLicenses('Oracle Partitioning', installations, entitlements);

        expect(result.warnings.some(w => w.includes('base database'))).toBe(true);
      });
    });

    /**
     * Requirement 4.4: Oracle Management Packs licensing
     */
    describe('Management Packs licensing', () => {
      it('should license per managed target', () => {
        const installations = [
          createMockInstallation(),
          createMockInstallation({ installationId: 'inst-002' }),
          createMockInstallation({ installationId: 'inst-003' }),
        ];
        const entitlements = [createMockEntitlement({ quantityPurchased: 3 })];

        const result = calculateOracleLicenses('Oracle Enterprise Manager Management Pack', installations, entitlements);

        expect(result.calculationMethod).toBe('PER_TARGET');
        expect(result.licensesRequired).toBe(3);
      });
    });

    it('should add high audit risk warning for under-licensing', () => {
      const installations = [
        createMockInstallation({
          hardware: { ...createMockInstallation().hardware, coreCount: 40 },
        }),
      ];
      const entitlements = [createMockEntitlement({ quantityPurchased: 10 })];

      const result = calculateOracleLicenses('Oracle Database Enterprise Edition', installations, entitlements);

      expect(result.compliancePosition).toBe('UNDER_LICENSED');
      expect(result.warnings.some(w => w.includes('AUDIT RISK'))).toBe(true);
    });

    it('should warn about soft partitioning for virtual machines', () => {
      const installations = [
        createMockInstallation({
          hardware: { ...createMockInstallation().hardware, isVirtual: true },
        }),
      ];
      const entitlements = [createMockEntitlement({ quantityPurchased: 10, metricType: 'PER_PROCESSOR' })];

      const result = calculateOracleLicenses('Oracle Database Enterprise Edition', installations, entitlements);

      expect(result.warnings.some(w => w.includes('soft partitioning'))).toBe(true);
    });
  });

  describe('calculateAdobeLicenses', () => {
    /**
     * Requirement 4.5: Adobe Named User licensing
     */
    describe('Named User licensing', () => {
      it('should count unique users', () => {
        const installations = [
          createMockInstallation({
            hardware: { ...createMockInstallation().hardware, assignedToUserId: 'user-001' },
          }),
          createMockInstallation({
            installationId: 'inst-002',
            hardware: { ...createMockInstallation().hardware, assignedToUserId: 'user-002' },
          }),
        ];
        const entitlements = [createMockEntitlement({ quantityPurchased: 2, metricType: 'PER_USER' })];

        const result = calculateAdobeLicenses('Adobe Creative Cloud', installations, entitlements);

        expect(result.calculationMethod).toBe('NAMED_USER');
        expect(result.licensesRequired).toBe(2);
        expect((result.details as any).totalNamedUsers).toBe(2);
        expect(result.compliancePosition).toBe('COMPLIANT');
      });

      it('should warn when more than 2 devices per user', () => {
        const installations = [
          createMockInstallation({
            hardware: { ...createMockInstallation().hardware, assignedToUserId: 'user-001' },
          }),
          createMockInstallation({
            installationId: 'inst-002',
            hardware: { ...createMockInstallation().hardware, assignedToUserId: 'user-001' },
          }),
          createMockInstallation({
            installationId: 'inst-003',
            hardware: { ...createMockInstallation().hardware, assignedToUserId: 'user-001' },
          }),
        ];
        const entitlements = [createMockEntitlement({ quantityPurchased: 1, metricType: 'PER_USER' })];

        const result = calculateAdobeLicenses('Adobe Creative Cloud', installations, entitlements);

        expect(result.warnings.some(w => w.includes('2 devices per user'))).toBe(true);
      });
    });

    /**
     * Requirement 4.5: Adobe Device licensing
     */
    describe('Device licensing', () => {
      it('should count total devices', () => {
        const installations = [
          createMockInstallation(),
          createMockInstallation({ installationId: 'inst-002' }),
        ];
        const entitlements = [createMockEntitlement({ quantityPurchased: 2, metricType: 'PER_DEVICE' })];

        const result = calculateAdobeLicenses('Adobe Acrobat Pro', installations, entitlements);

        expect(result.calculationMethod).toBe('PER_DEVICE');
        expect(result.licensesRequired).toBe(2);
        expect((result.details as any).totalDevices).toBe(2);
      });
    });

    it('should detect subscription type from entitlements', () => {
      const installations = [createMockInstallation()];
      const entitlements = [createMockEntitlement({ quantityPurchased: 1, metricType: 'SUBSCRIPTION' })];

      const result = calculateAdobeLicenses('Adobe Creative Cloud', installations, entitlements);

      expect((result.details as any).subscriptionType).toBe('ANNUAL');
    });
  });

  describe('calculateSalesforceLicenses', () => {
    /**
     * Requirement 4.5: Salesforce user-based licensing
     */
    describe('User licensing', () => {
      it('should count unique users', () => {
        const installations = [
          createMockInstallation({
            hardware: { ...createMockInstallation().hardware, assignedToUserId: 'user-001' },
          }),
          createMockInstallation({
            installationId: 'inst-002',
            hardware: { ...createMockInstallation().hardware, assignedToUserId: 'user-002' },
          }),
          createMockInstallation({
            installationId: 'inst-003',
            hardware: { ...createMockInstallation().hardware, assignedToUserId: 'user-003' },
          }),
        ];
        const entitlements = [createMockEntitlement({ quantityPurchased: 3, metricType: 'PER_USER' })];

        const result = calculateSalesforceLicenses('Salesforce Sales Cloud', installations, entitlements);

        expect(result.calculationMethod).toBe('PER_USER');
        expect(result.licensesRequired).toBe(3);
        expect((result.details as any).totalUsers).toBe(3);
        expect(result.compliancePosition).toBe('COMPLIANT');
      });

      it('should detect platform license type', () => {
        const installations = [createMockInstallation()];
        const entitlements = [createMockEntitlement({ quantityPurchased: 1 })];

        const result = calculateSalesforceLicenses('Salesforce Platform', installations, entitlements);

        expect((result.details as any).licenseType).toBe('PLATFORM');
      });

      it('should detect community license type', () => {
        const installations = [createMockInstallation()];
        const entitlements = [createMockEntitlement({ quantityPurchased: 1 })];

        const result = calculateSalesforceLicenses('Salesforce Community Cloud', installations, entitlements);

        expect((result.details as any).licenseType).toBe('COMMUNITY');
      });
    });

    it('should suggest reclamation for inactive users', () => {
      const thirtyOneDaysAgo = new Date();
      thirtyOneDaysAgo.setDate(thirtyOneDaysAgo.getDate() - 31);

      const installations = [
        createMockInstallation({
          lastUsedDate: thirtyOneDaysAgo.toISOString(),
        }),
      ];
      const entitlements = [createMockEntitlement({ quantityPurchased: 1 })];

      const result = calculateSalesforceLicenses('Salesforce Sales Cloud', installations, entitlements);

      expect(result.warnings.some(w => w.includes('inactive') || w.includes('reclamation'))).toBe(true);
    });
  });

  describe('Compliance position calculation', () => {
    it('should return COMPLIANT when licenses match', () => {
      const installations = [createMockInstallation()];
      const entitlements = [createMockEntitlement({ quantityPurchased: 1, metricType: 'PER_DEVICE' })];

      const result = calculateAdobeLicenses('Adobe Acrobat', installations, entitlements);

      expect(result.compliancePosition).toBe('COMPLIANT');
      expect(result.overUnderCount).toBe(0);
    });

    it('should return OVER_LICENSED when more licenses than needed', () => {
      const installations = [createMockInstallation()];
      const entitlements = [createMockEntitlement({ quantityPurchased: 5, metricType: 'PER_DEVICE' })];

      const result = calculateAdobeLicenses('Adobe Acrobat', installations, entitlements);

      expect(result.compliancePosition).toBe('OVER_LICENSED');
      expect(result.overUnderCount).toBe(4);
    });

    it('should return UNDER_LICENSED when fewer licenses than needed', () => {
      const installations = [
        createMockInstallation(),
        createMockInstallation({ installationId: 'inst-002' }),
        createMockInstallation({ installationId: 'inst-003' }),
      ];
      const entitlements = [createMockEntitlement({ quantityPurchased: 1, metricType: 'PER_DEVICE' })];

      const result = calculateAdobeLicenses('Adobe Acrobat', installations, entitlements);

      expect(result.compliancePosition).toBe('UNDER_LICENSED');
      expect(result.overUnderCount).toBe(-2);
    });
  });
});
