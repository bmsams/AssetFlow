/**
 * Discovery Service Unit Tests
 *
 * Tests for the Discovery Integration Service business logic.
 * Requirements:
 * - 7.1: Ingest asset data from SCCM, Jamf, Tanium
 * - 7.2: Match discovery records to existing assets by serial_number and mac_address
 */

import type {
  JamfPayload,
  SCCMPayload,
  TaniumPayload,
} from '../discovery/discovery-types';
import * as discoveryService from '../discovery/discovery-service';
import * as repository from '../discovery/discovery-repository';

// Mock the repository module
jest.mock('../discovery/discovery-repository');

// Mock event publishing to keep tests isolated from AWS SDK runtime
jest.mock('@ams/events', () => ({
  publishEvent: jest.fn().mockResolvedValue(undefined),
}));

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

describe('Discovery Service', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    
    // Default mock implementations
    mockRepository.getDiscoverySourceConfig.mockResolvedValue(null);
    mockRepository.findDiscoveryRecordBySourceId.mockResolvedValue(null);
    mockRepository.matchDiscoveryRecordToAsset.mockResolvedValue({
      matched: false,
      confidence: 0,
    });
    mockRepository.createDiscoveryRecord.mockResolvedValue({
      discoveryRecordId: 'test-record-id',
      sourceType: 'SCCM',
      sourceId: 'test-source-id',
      sourceName: 'Test',
      status: 'CREATED',
      lastSeen: new Date().toISOString(),
      discoveredAt: new Date().toISOString(),
      rawData: {},
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    });
    mockRepository.createHardwareAssetFromDiscovery.mockResolvedValue('new-asset-id');
    mockRepository.updateHardwareAssetFromDiscovery.mockResolvedValue();
    mockRepository.updateDiscoverySourceLastSync.mockResolvedValue();
  });

  describe('ingestSCCMData', () => {
    const baseSCCMPayload: SCCMPayload = {
      devices: [
        {
          resourceId: 'sccm-001',
          name: 'DESKTOP-001',
          serialNumber: 'SN123456',
          macAddresses: ['00:11:22:33:44:55'],
          ipAddresses: ['192.168.1.100'],
          manufacturer: 'Dell',
          model: 'OptiPlex 7090',
          operatingSystem: 'Windows 11 Enterprise',
          operatingSystemVersion: '22H2',
          lastActiveTime: '2024-01-15T10:30:00Z',
        },
      ],
      collectionId: 'SMS00001',
      collectionName: 'All Systems',
      syncTimestamp: '2024-01-15T12:00:00Z',
    };

    it('should ingest SCCM data and create new assets when no match found', async () => {
      const result = await discoveryService.ingestSCCMData(baseSCCMPayload);

      expect(result.sourceType).toBe('SCCM');
      expect(result.sourceName).toBe('All Systems');
      expect(result.totalRecords).toBe(1);
      expect(result.createdCount).toBe(1);
      expect(result.matchedCount).toBe(0);
      expect(result.failedCount).toBe(0);
      expect(result.records).toHaveLength(1);
      
      const firstRecord = result.records[0];
      expect(firstRecord).toBeDefined();
      expect(firstRecord!.status).toBe('CREATED');
      expect(firstRecord!.assetId).toBe('new-asset-id');

      expect(mockRepository.matchDiscoveryRecordToAsset).toHaveBeenCalledWith(
        'SN123456',
        '00:11:22:33:44:55'
      );
      expect(mockRepository.createHardwareAssetFromDiscovery).toHaveBeenCalled();
    });

    it('should match SCCM device to existing asset by serial number', async () => {
      mockRepository.matchDiscoveryRecordToAsset.mockResolvedValue({
        matched: true,
        assetId: 'existing-asset-id',
        matchType: 'SERIAL_NUMBER',
        confidence: 100,
      });

      const result = await discoveryService.ingestSCCMData(baseSCCMPayload);

      expect(result.matchedCount).toBe(1);
      expect(result.createdCount).toBe(0);
      
      const firstRecord = result.records[0];
      expect(firstRecord).toBeDefined();
      expect(firstRecord!.status).toBe('MATCHED');
      expect(firstRecord!.assetId).toBe('existing-asset-id');
      expect(firstRecord!.matchType).toBe('SERIAL_NUMBER');

      expect(mockRepository.updateHardwareAssetFromDiscovery).toHaveBeenCalledWith(
        'existing-asset-id',
        'Windows 11 Enterprise',
        '192.168.1.100',
        '2024-01-15T10:30:00Z'
      );
    });

    it('should ignore devices without serial number or MAC address', async () => {
      const payloadWithNoIdentifiers: SCCMPayload = {
        devices: [
          {
            resourceId: 'sccm-002',
            name: 'UNKNOWN-DEVICE',
            // No serialNumber or macAddresses
          },
        ],
        syncTimestamp: '2024-01-15T12:00:00Z',
      };

      const result = await discoveryService.ingestSCCMData(payloadWithNoIdentifiers);

      expect(result.ignoredCount).toBe(1);
      
      const firstRecord = result.records[0];
      expect(firstRecord).toBeDefined();
      expect(firstRecord!.status).toBe('IGNORED');
      expect(firstRecord!.errorMessage).toContain('No serial number or MAC address');
    });

    it('should handle multiple devices in a single payload', async () => {
      const multiDevicePayload: SCCMPayload = {
        devices: [
          {
            resourceId: 'sccm-001',
            name: 'DESKTOP-001',
            serialNumber: 'SN111111',
          },
          {
            resourceId: 'sccm-002',
            name: 'DESKTOP-002',
            serialNumber: 'SN222222',
          },
          {
            resourceId: 'sccm-003',
            name: 'DESKTOP-003',
            macAddresses: ['AA:BB:CC:DD:EE:FF'],
          },
        ],
        syncTimestamp: '2024-01-15T12:00:00Z',
      };

      // First device matches, others create new assets
      mockRepository.matchDiscoveryRecordToAsset
        .mockResolvedValueOnce({
          matched: true,
          assetId: 'existing-asset-1',
          matchType: 'SERIAL_NUMBER',
          confidence: 100,
        })
        .mockResolvedValueOnce({ matched: false, confidence: 0 })
        .mockResolvedValueOnce({ matched: false, confidence: 0 });

      const result = await discoveryService.ingestSCCMData(multiDevicePayload);

      expect(result.totalRecords).toBe(3);
      expect(result.matchedCount).toBe(1);
      expect(result.createdCount).toBe(2);
    });

    it('should record processing time', async () => {
      const result = await discoveryService.ingestSCCMData(baseSCCMPayload);

      expect(result.processingTimeMs).toBeGreaterThanOrEqual(0);
    });
  });

  describe('ingestJamfData', () => {
    const baseJamfPayload: JamfPayload = {
      computers: [
        {
          id: 1,
          name: 'MacBook-001',
          serialNumber: 'C02XYZ123456',
          macAddress: 'A1:B2:C3:D4:E5:F6',
          ipAddress: '192.168.1.50',
          make: 'Apple',
          model: 'MacBook Pro (16-inch, 2021)',
          osName: 'macOS',
          osVersion: '14.2.1',
          lastContactTime: '2024-01-15T09:00:00Z',
        },
      ],
      mobileDevices: [
        {
          id: 100,
          name: 'iPad-001',
          serialNumber: 'DMXYZ789012',
          wifiMacAddress: 'F1:E2:D3:C4:B5:A6',
          model: 'iPad Pro 12.9-inch (6th generation)',
          osType: 'iPadOS',
          osVersion: '17.2',
          lastInventoryUpdate: '2024-01-15T08:00:00Z',
        },
      ],
      syncTimestamp: '2024-01-15T12:00:00Z',
    };

    it('should ingest Jamf computers and mobile devices', async () => {
      const result = await discoveryService.ingestJamfData(baseJamfPayload);

      expect(result.sourceType).toBe('JAMF');
      expect(result.sourceName).toBe('Jamf');
      expect(result.totalRecords).toBe(2);
      expect(result.createdCount).toBe(2);
      expect(result.records).toHaveLength(2);
    });

    it('should match Jamf device to existing asset by MAC address', async () => {
      mockRepository.matchDiscoveryRecordToAsset.mockResolvedValue({
        matched: true,
        assetId: 'existing-mac-asset',
        matchType: 'MAC_ADDRESS',
        confidence: 95,
      });

      const result = await discoveryService.ingestJamfData(baseJamfPayload);

      expect(result.matchedCount).toBe(2);
      
      const firstRecord = result.records[0];
      expect(firstRecord).toBeDefined();
      expect(firstRecord!.matchType).toBe('MAC_ADDRESS');
    });

    it('should handle computers-only payload', async () => {
      const computersOnlyPayload: JamfPayload = {
        computers: baseJamfPayload.computers,
        syncTimestamp: '2024-01-15T12:00:00Z',
      };

      const result = await discoveryService.ingestJamfData(computersOnlyPayload);

      expect(result.totalRecords).toBe(1);
      
      const firstRecord = result.records[0];
      expect(firstRecord).toBeDefined();
      expect(firstRecord!.sourceId).toBe('computer-1');
    });

    it('should handle mobile devices-only payload', async () => {
      const mobileOnlyPayload: JamfPayload = {
        mobileDevices: baseJamfPayload.mobileDevices,
        syncTimestamp: '2024-01-15T12:00:00Z',
      };

      const result = await discoveryService.ingestJamfData(mobileOnlyPayload);

      expect(result.totalRecords).toBe(1);
      
      const firstRecord = result.records[0];
      expect(firstRecord).toBeDefined();
      expect(firstRecord!.sourceId).toBe('mobile-100');
    });

    it('should set manufacturer to Apple for Jamf devices', async () => {
      await discoveryService.ingestJamfData(baseJamfPayload);

      // Check that createHardwareAssetFromDiscovery was called with Apple manufacturer
      expect(mockRepository.createHardwareAssetFromDiscovery).toHaveBeenCalledWith(
        expect.any(String), // serialNumber
        expect.any(String), // macAddress
        expect.any(String), // hostname
        'Apple', // manufacturer
        expect.any(String), // model
        expect.any(String), // operatingSystem
        expect.any(String) // ipAddress
      );
    });
  });

  describe('ingestTaniumData', () => {
    const baseTaniumPayload: TaniumPayload = {
      endpoints: [
        {
          computerID: 'tanium-001',
          computerName: 'WORKSTATION-001',
          serialNumber: 'TN123456789',
          macAddresses: ['11:22:33:44:55:66'],
          ipAddresses: ['10.0.0.100'],
          manufacturer: 'Lenovo',
          model: 'ThinkPad X1 Carbon',
          operatingSystem: 'Windows 10 Enterprise',
          osGeneration: '21H2',
          lastSeenDate: '2024-01-15T11:00:00Z',
        },
      ],
      questionId: 'Q12345',
      syncTimestamp: '2024-01-15T12:00:00Z',
    };

    it('should ingest Tanium endpoint data', async () => {
      const result = await discoveryService.ingestTaniumData(baseTaniumPayload);

      expect(result.sourceType).toBe('TANIUM');
      expect(result.sourceName).toBe('Tanium');
      expect(result.totalRecords).toBe(1);
      expect(result.createdCount).toBe(1);
    });

    it('should match Tanium endpoint to existing asset', async () => {
      mockRepository.matchDiscoveryRecordToAsset.mockResolvedValue({
        matched: true,
        assetId: 'existing-tanium-asset',
        matchType: 'SERIAL_NUMBER',
        confidence: 100,
      });

      const result = await discoveryService.ingestTaniumData(baseTaniumPayload);

      expect(result.matchedCount).toBe(1);
      
      const firstRecord = result.records[0];
      expect(firstRecord).toBeDefined();
      expect(firstRecord!.assetId).toBe('existing-tanium-asset');
    });

    it('should ignore endpoints without identifiers', async () => {
      const noIdentifiersPayload: TaniumPayload = {
        endpoints: [
          {
            computerID: 'tanium-002',
            computerName: 'UNKNOWN-ENDPOINT',
            // No serialNumber or macAddresses
          },
        ],
        syncTimestamp: '2024-01-15T12:00:00Z',
      };

      const result = await discoveryService.ingestTaniumData(noIdentifiersPayload);

      expect(result.ignoredCount).toBe(1);
      
      const firstRecord = result.records[0];
      expect(firstRecord).toBeDefined();
      expect(firstRecord!.status).toBe('IGNORED');
    });
  });

  describe('matchToExistingAsset', () => {
    it('should match by serial number with high confidence', async () => {
      mockRepository.matchDiscoveryRecordToAsset.mockResolvedValue({
        matched: true,
        assetId: 'asset-by-serial',
        matchType: 'SERIAL_NUMBER',
        confidence: 100,
      });

      const result = await discoveryService.matchToExistingAsset('SN123456', undefined);

      expect(result.matched).toBe(true);
      expect(result.assetId).toBe('asset-by-serial');
      expect(result.matchType).toBe('SERIAL_NUMBER');
    });

    it('should match by MAC address when serial number not found', async () => {
      mockRepository.matchDiscoveryRecordToAsset.mockResolvedValue({
        matched: true,
        assetId: 'asset-by-mac',
        matchType: 'MAC_ADDRESS',
        confidence: 95,
      });

      const result = await discoveryService.matchToExistingAsset(undefined, '00:11:22:33:44:55');

      expect(result.matched).toBe(true);
      expect(result.assetId).toBe('asset-by-mac');
      expect(result.matchType).toBe('MAC_ADDRESS');
    });

    it('should return no match when neither identifier matches', async () => {
      mockRepository.matchDiscoveryRecordToAsset.mockResolvedValue({
        matched: false,
        confidence: 0,
      });

      const result = await discoveryService.matchToExistingAsset('UNKNOWN-SN', 'FF:FF:FF:FF:FF:FF');

      expect(result.matched).toBe(false);
      expect(result.assetId).toBeUndefined();
    });
  });

  describe('getDiscoveryStatistics', () => {
    it('should return statistics for a discovery source', async () => {
      mockRepository.getDiscoveryStatistics.mockResolvedValue({
        total: 100,
        matched: 60,
        created: 30,
        failed: 5,
        pending: 5,
      });

      const result = await discoveryService.getDiscoveryStatistics('SCCM', 'All Systems');

      expect(result.total).toBe(100);
      expect(result.matched).toBe(60);
      expect(result.created).toBe(30);
      expect(result.failed).toBe(5);
      expect(result.pending).toBe(5);
    });
  });

  describe('error handling', () => {
    it('should handle repository errors gracefully', async () => {
      mockRepository.matchDiscoveryRecordToAsset.mockRejectedValue(new Error('Database error'));

      const payload: SCCMPayload = {
        devices: [
          {
            resourceId: 'sccm-error',
            name: 'ERROR-DEVICE',
            serialNumber: 'SN-ERROR',
          },
        ],
        syncTimestamp: '2024-01-15T12:00:00Z',
      };

      const result = await discoveryService.ingestSCCMData(payload);

      expect(result.failedCount).toBe(1);
      
      const firstRecord = result.records[0];
      expect(firstRecord).toBeDefined();
      expect(firstRecord!.status).toBe('FAILED');
      expect(firstRecord!.errorMessage).toBe('Database error');
      expect(result.errors).toHaveLength(1);
    });
  });
});
