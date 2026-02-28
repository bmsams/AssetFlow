/**
 * Deployment Service Unit Tests
 *
 * Tests for Deployment Service:
 * - Deploy Asset (Requirement 6.6)
 * - Assign To User (Requirement 6.6)
 * - Create CMDB Relationships (Requirement 6.6)
 * - Correlate Discovery Data (Requirement 6.7)
 */

// Mock dependencies before importing service
jest.mock('@ams/database', () => ({
  queryOne: jest.fn(),
  queryMany: jest.fn(),
  withTransaction: jest.fn((fn) =>
    fn({
      queryOne: jest.fn(),
      queryMany: jest.fn(),
    })
  ),
}));

jest.mock('@ams/events', () => ({
  publishEvent: jest.fn().mockResolvedValue(undefined),
}));

jest.mock('@ams/utils', () => ({
  createLogger: () => ({
    info: jest.fn(),
    error: jest.fn(),
    warn: jest.fn(),
    debug: jest.fn(),
  }),
  now: () => '2024-01-15T10:00:00.000Z',
}));

// Mock the repository
jest.mock('../deployment/deployment-repository');

import * as deploymentService from '../deployment/deployment-service';
import * as repository from '../deployment/deployment-repository';
import { publishEvent } from '@ams/events';

const mockRepository = repository as jest.Mocked<typeof repository>;
const mockPublishEvent = publishEvent as jest.MockedFunction<typeof publishEvent>;


// Test data constants
const VALID_ASSET_ID = '123e4567-e89b-12d3-a456-426614174001';
const VALID_USER_ID = '123e4567-e89b-12d3-a456-426614174002';
const VALID_DEPLOYER_ID = '123e4567-e89b-12d3-a456-426614174000';
const VALID_TARGET_ASSET_ID = '123e4567-e89b-12d3-a456-426614174003';

const mockDeploymentRecord = {
  deploymentId: '123e4567-e89b-12d3-a456-426614174010',
  assetId: VALID_ASSET_ID,
  assetTag: 'AST-ABC123',
  assetName: 'MacBook Pro',
  assignedToUserId: VALID_USER_ID,
  assignedToUserName: 'John Doe',
  assignedToUserEmail: 'john.doe@example.com',
  deployedBy: VALID_DEPLOYER_ID,
  deployedByName: 'Admin User',
  deploymentDate: '2024-01-15T10:00:00.000Z',
  status: 'COMPLETED' as const,
  location: 'Building A',
  department: 'Engineering',
  costCenter: 'CC-1001',
  notes: null,
  discoveryCorrelationId: null,
  discoverySource: null,
  discoveryCorrelatedAt: null,
  createdAt: '2024-01-15T10:00:00.000Z',
  updatedAt: '2024-01-15T10:00:00.000Z',
};

describe('Deployment Service', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('deployAsset', () => {
    it('should deploy asset successfully', async () => {
      mockRepository.createDeployment.mockResolvedValue(mockDeploymentRecord);

      const result = await deploymentService.deployAsset({
        assetId: VALID_ASSET_ID,
        assignedToUserId: VALID_USER_ID,
        deployedBy: VALID_DEPLOYER_ID,
        deployedByName: 'Admin User',
        location: 'Building A',
        department: 'Engineering',
        costCenter: 'CC-1001',
      });

      expect(result.deployment).toEqual(mockDeploymentRecord);
      expect(result.relationships).toEqual([]);
      expect(mockRepository.createDeployment).toHaveBeenCalledWith({
        assetId: VALID_ASSET_ID,
        assignedToUserId: VALID_USER_ID,
        deployedBy: VALID_DEPLOYER_ID,
        deployedByName: 'Admin User',
        location: 'Building A',
        department: 'Engineering',
        costCenter: 'CC-1001',
        notes: undefined,
      });
      expect(mockPublishEvent).toHaveBeenCalledWith('ASSET_DEPLOYED', expect.any(Object));
    });

    it('should create CMDB relationships during deployment', async () => {
      const mockRelationship = {
        relationshipId: '123e4567-e89b-12d3-a456-426614174020',
        deploymentId: mockDeploymentRecord.deploymentId,
        sourceAssetId: VALID_ASSET_ID,
        targetAssetId: VALID_TARGET_ASSET_ID,
        relationType: 'CONNECTED_TO' as const,
        metadata: { port: 'USB-C' },
        createdAt: '2024-01-15T10:00:00.000Z',
      };

      mockRepository.createDeployment.mockResolvedValue(mockDeploymentRecord);
      mockRepository.createDeploymentRelationship.mockResolvedValue(mockRelationship);

      const result = await deploymentService.deployAsset({
        assetId: VALID_ASSET_ID,
        assignedToUserId: VALID_USER_ID,
        deployedBy: VALID_DEPLOYER_ID,
        relationships: [
          {
            targetAssetId: VALID_TARGET_ASSET_ID,
            relationType: 'CONNECTED_TO',
            metadata: { port: 'USB-C' },
          },
        ],
      });

      expect(result.relationships.length).toBe(1);
      expect(result.relationships[0]).toEqual(mockRelationship);
      expect(mockRepository.createDeploymentRelationship).toHaveBeenCalledWith({
        deploymentId: mockDeploymentRecord.deploymentId,
        sourceAssetId: VALID_ASSET_ID,
        targetAssetId: VALID_TARGET_ASSET_ID,
        relationType: 'CONNECTED_TO',
        metadata: { port: 'USB-C' },
      });
    });

    it('should correlate discovery data during deployment', async () => {
      const mockCorrelation = {
        correlationId: '123e4567-e89b-12d3-a456-426614174030',
        assetId: VALID_ASSET_ID,
        discoverySource: 'SCCM',
        discoveryRecordId: 'SCCM-12345',
        serialNumber: 'SN12345',
        macAddress: '00:11:22:33:44:55',
        hostname: 'LAPTOP-001',
        ipAddress: '192.168.1.100',
        lastDiscoveredAt: '2024-01-15T10:00:00.000Z',
        correlatedAt: '2024-01-15T10:00:00.000Z',
        correlatedBy: VALID_DEPLOYER_ID,
        confidence: 100,
      };

      mockRepository.createDeployment.mockResolvedValue(mockDeploymentRecord);
      mockRepository.correlateDiscoveryData.mockResolvedValue(mockCorrelation);

      const result = await deploymentService.deployAsset({
        assetId: VALID_ASSET_ID,
        assignedToUserId: VALID_USER_ID,
        deployedBy: VALID_DEPLOYER_ID,
        discoveryData: {
          discoverySource: 'SCCM',
          discoveryRecordId: 'SCCM-12345',
          serialNumber: 'SN12345',
          macAddress: '00:11:22:33:44:55',
          hostname: 'LAPTOP-001',
          ipAddress: '192.168.1.100',
        },
      });

      expect(result.deployment).toEqual(mockDeploymentRecord);
      expect(mockRepository.correlateDiscoveryData).toHaveBeenCalledWith({
        assetId: VALID_ASSET_ID,
        discoverySource: 'SCCM',
        discoveryRecordId: 'SCCM-12345',
        serialNumber: 'SN12345',
        macAddress: '00:11:22:33:44:55',
        hostname: 'LAPTOP-001',
        ipAddress: '192.168.1.100',
        correlatedBy: VALID_DEPLOYER_ID,
      });
    });

    it('should continue deployment even if relationship creation fails', async () => {
      mockRepository.createDeployment.mockResolvedValue(mockDeploymentRecord);
      mockRepository.createDeploymentRelationship.mockRejectedValue(
        new Error('Target asset not found')
      );

      const result = await deploymentService.deployAsset({
        assetId: VALID_ASSET_ID,
        assignedToUserId: VALID_USER_ID,
        deployedBy: VALID_DEPLOYER_ID,
        relationships: [
          {
            targetAssetId: VALID_TARGET_ASSET_ID,
            relationType: 'CONNECTED_TO',
          },
        ],
      });

      expect(result.deployment).toEqual(mockDeploymentRecord);
      expect(result.relationships).toEqual([]);
    });

    it('should continue deployment even if discovery correlation fails', async () => {
      mockRepository.createDeployment.mockResolvedValue(mockDeploymentRecord);
      mockRepository.correlateDiscoveryData.mockRejectedValue(
        new Error('Discovery correlation failed')
      );

      const result = await deploymentService.deployAsset({
        assetId: VALID_ASSET_ID,
        assignedToUserId: VALID_USER_ID,
        deployedBy: VALID_DEPLOYER_ID,
        discoveryData: {
          discoverySource: 'SCCM',
          discoveryRecordId: 'SCCM-12345',
        },
      });

      expect(result.deployment).toEqual(mockDeploymentRecord);
    });
  });

  describe('assignToUser', () => {
    it('should assign asset to new user', async () => {
      mockRepository.getDeploymentByAssetId.mockResolvedValue(null);
      mockRepository.createDeployment.mockResolvedValue(mockDeploymentRecord);

      const result = await deploymentService.assignToUser({
        assetId: VALID_ASSET_ID,
        newUserId: VALID_USER_ID,
        assignedBy: VALID_DEPLOYER_ID,
        assignedByName: 'Admin User',
        location: 'Building A',
        department: 'Engineering',
      });

      expect(result.deployment).toEqual(mockDeploymentRecord);
      expect(result.previousAssignment).toBeNull();
      expect(mockPublishEvent).toHaveBeenCalledWith('ASSET_REASSIGNED', expect.any(Object));
    });

    it('should reassign asset from previous user', async () => {
      const previousUserId = '123e4567-e89b-12d3-a456-426614174099';
      const previousDeployment = {
        ...mockDeploymentRecord,
        deploymentId: '123e4567-e89b-12d3-a456-426614174009',
        assignedToUserId: previousUserId,
        assignedToUserName: 'Jane Smith',
        deploymentDate: '2024-01-01T10:00:00.000Z',
      };

      mockRepository.getDeploymentByAssetId.mockResolvedValue(previousDeployment);
      mockRepository.createDeployment.mockResolvedValue(mockDeploymentRecord);

      const result = await deploymentService.assignToUser({
        assetId: VALID_ASSET_ID,
        newUserId: VALID_USER_ID,
        assignedBy: VALID_DEPLOYER_ID,
      });

      expect(result.deployment).toEqual(mockDeploymentRecord);
      expect(result.previousAssignment).toEqual(previousDeployment);
    });

    it('should return existing deployment if already assigned to same user', async () => {
      const existingDeployment = {
        ...mockDeploymentRecord,
        assignedToUserId: VALID_USER_ID,
      };

      mockRepository.getDeploymentByAssetId.mockResolvedValue(existingDeployment);

      const result = await deploymentService.assignToUser({
        assetId: VALID_ASSET_ID,
        newUserId: VALID_USER_ID,
        assignedBy: VALID_DEPLOYER_ID,
      });

      expect(result.deployment).toEqual(existingDeployment);
      expect(result.previousAssignment).toBeNull();
      expect(mockRepository.createDeployment).not.toHaveBeenCalled();
    });
  });

  describe('correlateDiscoveryData', () => {
    it('should correlate discovery data with asset', async () => {
      const mockCorrelation = {
        correlationId: '123e4567-e89b-12d3-a456-426614174030',
        assetId: VALID_ASSET_ID,
        discoverySource: 'SCCM',
        discoveryRecordId: 'SCCM-12345',
        serialNumber: 'SN12345',
        macAddress: '00:11:22:33:44:55',
        hostname: 'LAPTOP-001',
        ipAddress: '192.168.1.100',
        lastDiscoveredAt: '2024-01-15T10:00:00.000Z',
        correlatedAt: '2024-01-15T10:00:00.000Z',
        correlatedBy: VALID_DEPLOYER_ID,
        confidence: 100,
      };

      mockRepository.correlateDiscoveryData.mockResolvedValue(mockCorrelation);

      const result = await deploymentService.correlateDiscoveryData({
        assetId: VALID_ASSET_ID,
        discoverySource: 'SCCM',
        discoveryRecordId: 'SCCM-12345',
        serialNumber: 'SN12345',
        macAddress: '00:11:22:33:44:55',
        hostname: 'LAPTOP-001',
        ipAddress: '192.168.1.100',
        correlatedBy: VALID_DEPLOYER_ID,
        confidence: 100,
      });

      expect(result).toEqual(mockCorrelation);
      expect(mockPublishEvent).toHaveBeenCalledWith('DISCOVERY_CORRELATED', expect.any(Object));
    });
  });

  describe('autoCorrelateDiscovery', () => {
    it('should auto-correlate by serial number with 100% confidence', async () => {
      const mockAsset = {
        asset_id: VALID_ASSET_ID,
        asset_tag: 'AST-ABC123',
        display_name: 'MacBook Pro',
        status: 'DEPLOYED' as const,
      };

      const mockCorrelation = {
        correlationId: '123e4567-e89b-12d3-a456-426614174030',
        assetId: VALID_ASSET_ID,
        discoverySource: 'SCCM',
        discoveryRecordId: 'SCCM-12345',
        serialNumber: 'SN12345',
        macAddress: null,
        hostname: null,
        ipAddress: null,
        lastDiscoveredAt: '2024-01-15T10:00:00.000Z',
        correlatedAt: '2024-01-15T10:00:00.000Z',
        correlatedBy: null,
        confidence: 100,
      };

      mockRepository.findAssetByDiscoveryAttributes.mockResolvedValue(mockAsset);
      mockRepository.correlateDiscoveryData.mockResolvedValue(mockCorrelation);

      const result = await deploymentService.autoCorrelateDiscovery(
        'SCCM',
        'SCCM-12345',
        { serialNumber: 'SN12345' }
      );

      expect(result).toEqual(mockCorrelation);
      expect(mockRepository.correlateDiscoveryData).toHaveBeenCalledWith(
        expect.objectContaining({
          confidence: 100,
        })
      );
      expect(mockPublishEvent).toHaveBeenCalledWith('DISCOVERY_AUTO_CORRELATED', expect.any(Object));
    });

    it('should auto-correlate by MAC address with 90% confidence', async () => {
      const mockAsset = {
        asset_id: VALID_ASSET_ID,
        asset_tag: 'AST-ABC123',
        display_name: 'MacBook Pro',
        status: 'DEPLOYED' as const,
      };

      const mockCorrelation = {
        correlationId: '123e4567-e89b-12d3-a456-426614174030',
        assetId: VALID_ASSET_ID,
        discoverySource: 'SCCM',
        discoveryRecordId: 'SCCM-12345',
        serialNumber: null,
        macAddress: '00:11:22:33:44:55',
        hostname: null,
        ipAddress: null,
        lastDiscoveredAt: '2024-01-15T10:00:00.000Z',
        correlatedAt: '2024-01-15T10:00:00.000Z',
        correlatedBy: null,
        confidence: 90,
      };

      mockRepository.findAssetByDiscoveryAttributes.mockResolvedValue(mockAsset);
      mockRepository.correlateDiscoveryData.mockResolvedValue(mockCorrelation);

      const result = await deploymentService.autoCorrelateDiscovery(
        'SCCM',
        'SCCM-12345',
        { macAddress: '00:11:22:33:44:55' }
      );

      expect(result).toEqual(mockCorrelation);
      expect(mockRepository.correlateDiscoveryData).toHaveBeenCalledWith(
        expect.objectContaining({
          confidence: 90,
        })
      );
    });

    it('should return null when no matching asset found', async () => {
      mockRepository.findAssetByDiscoveryAttributes.mockResolvedValue(null);

      const result = await deploymentService.autoCorrelateDiscovery(
        'SCCM',
        'SCCM-12345',
        { serialNumber: 'UNKNOWN-SN' }
      );

      expect(result).toBeNull();
      expect(mockRepository.correlateDiscoveryData).not.toHaveBeenCalled();
    });
  });

  describe('createDeploymentRelationship', () => {
    it('should create CMDB relationship for deployment', async () => {
      const mockRelationship = {
        relationshipId: '123e4567-e89b-12d3-a456-426614174020',
        deploymentId: mockDeploymentRecord.deploymentId,
        sourceAssetId: VALID_ASSET_ID,
        targetAssetId: VALID_TARGET_ASSET_ID,
        relationType: 'CONNECTED_TO' as const,
        metadata: null,
        createdAt: '2024-01-15T10:00:00.000Z',
      };

      mockRepository.getDeploymentById.mockResolvedValue(mockDeploymentRecord);
      mockRepository.createDeploymentRelationship.mockResolvedValue(mockRelationship);

      const result = await deploymentService.createDeploymentRelationship(
        mockDeploymentRecord.deploymentId,
        VALID_ASSET_ID,
        VALID_TARGET_ASSET_ID,
        'CONNECTED_TO'
      );

      expect(result).toEqual(mockRelationship);
      expect(mockPublishEvent).toHaveBeenCalledWith('CMDB_RELATIONSHIP_CREATED', expect.any(Object));
    });

    it('should throw error if deployment not found', async () => {
      mockRepository.getDeploymentById.mockResolvedValue(null);

      await expect(
        deploymentService.createDeploymentRelationship(
          'non-existent-id',
          VALID_ASSET_ID,
          VALID_TARGET_ASSET_ID,
          'CONNECTED_TO'
        )
      ).rejects.toThrow('Deployment not found');
    });

    it('should throw error if source asset does not match deployment', async () => {
      mockRepository.getDeploymentById.mockResolvedValue(mockDeploymentRecord);

      await expect(
        deploymentService.createDeploymentRelationship(
          mockDeploymentRecord.deploymentId,
          'different-asset-id',
          VALID_TARGET_ASSET_ID,
          'CONNECTED_TO'
        )
      ).rejects.toThrow('does not match deployment asset');
    });
  });

  describe('cancelDeployment', () => {
    it('should cancel pending deployment', async () => {
      const pendingDeployment = {
        ...mockDeploymentRecord,
        status: 'PENDING' as const,
      };
      const cancelledDeployment = {
        ...pendingDeployment,
        status: 'CANCELLED' as const,
      };

      mockRepository.getDeploymentById.mockResolvedValue(pendingDeployment);
      mockRepository.updateDeploymentStatus.mockResolvedValue(cancelledDeployment);

      const result = await deploymentService.cancelDeployment(
        mockDeploymentRecord.deploymentId,
        VALID_DEPLOYER_ID,
        'No longer needed'
      );

      expect(result.status).toBe('CANCELLED');
      expect(mockPublishEvent).toHaveBeenCalledWith('DEPLOYMENT_CANCELLED', expect.any(Object));
    });

    it('should throw error when cancelling completed deployment', async () => {
      mockRepository.getDeploymentById.mockResolvedValue(mockDeploymentRecord);

      await expect(
        deploymentService.cancelDeployment(
          mockDeploymentRecord.deploymentId,
          VALID_DEPLOYER_ID
        )
      ).rejects.toThrow('Cannot cancel a completed deployment');
    });

    it('should throw error when deployment already cancelled', async () => {
      const cancelledDeployment = {
        ...mockDeploymentRecord,
        status: 'CANCELLED' as const,
      };

      mockRepository.getDeploymentById.mockResolvedValue(cancelledDeployment);

      await expect(
        deploymentService.cancelDeployment(
          mockDeploymentRecord.deploymentId,
          VALID_DEPLOYER_ID
        )
      ).rejects.toThrow('already cancelled');
    });
  });
});
