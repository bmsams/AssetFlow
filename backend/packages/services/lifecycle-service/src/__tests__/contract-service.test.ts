/**
 * Contract Service Unit Tests
 *
 * Tests for Contract Service business logic:
 * - Contract creation (Requirement 6A.1, 6A.2)
 * - Contract updates and status transitions
 * - Contract-asset/entitlement linking (Requirement 6A.3)
 */

// Mock the dependencies before importing service
jest.mock('@ams/database', () => ({
  queryOne: jest.fn(),
  queryMany: jest.fn(),
  withTransaction: jest.fn((fn) => fn({
    queryOne: jest.fn(),
    queryMany: jest.fn(),
  })),
}));

jest.mock('@ams/cache', () => ({
  del: jest.fn().mockResolvedValue(undefined),
  get: jest.fn().mockResolvedValue(null),
  set: jest.fn().mockResolvedValue(undefined),
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
jest.mock('../contract/contract-repository', () => ({
  createContract: jest.fn(),
  updateContract: jest.fn(),
  getContractById: jest.fn(),
  getContractByNumber: jest.fn(),
  getContractsByVendor: jest.fn(),
  getContracts: jest.fn(),
  linkContractToAsset: jest.fn(),
  unlinkContractFromAsset: jest.fn(),
  getContractAssets: jest.fn(),
  linkContractToEntitlement: jest.fn(),
  unlinkContractFromEntitlement: jest.fn(),
  getContractEntitlements: jest.fn(),
  getExpiringContracts: jest.fn(),
}));

import * as contractService from '../contract/contract-service';
import * as repository from '../contract/contract-repository';
import { publishEvent } from '@ams/events';

const mockRepository = repository as unknown as jest.Mocked<typeof repository>;
const mockPublishEvent = publishEvent as unknown as jest.Mock;


describe('Contract Service', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('createContract', () => {
    it('should create a contract successfully', async () => {
      const mockContract = {
        contractId: '123e4567-e89b-12d3-a456-426614174001',
        contractNumber: 'CON-ABC123-XYZ',
        vendorId: '123e4567-e89b-12d3-a456-426614174002',
        contractType: 'MAINTENANCE',
        startDate: '2024-01-01',
        endDate: '2025-01-01',
        status: 'DRAFT',
        totalValue: 10000,
      };

      mockRepository.createContract.mockResolvedValue(mockContract as any);

      const result = await contractService.createContract({
        vendorId: '123e4567-e89b-12d3-a456-426614174002',
        contractType: 'MAINTENANCE',
        startDate: '2024-01-01',
        endDate: '2025-01-01',
        totalValue: 10000,
      });

      expect(result.contractId).toBe(mockContract.contractId);
      expect(result.contractType).toBe('MAINTENANCE');
      expect(mockPublishEvent).toHaveBeenCalledWith('CONTRACT_CREATED', expect.any(Object));
    });

    it('should throw error for invalid contract type', async () => {
      await expect(
        contractService.createContract({
          vendorId: '123e4567-e89b-12d3-a456-426614174002',
          contractType: 'INVALID' as any,
          startDate: '2024-01-01',
          endDate: '2025-01-01',
        })
      ).rejects.toThrow('Invalid contract type');
    });

    it('should throw error when end date is before start date', async () => {
      await expect(
        contractService.createContract({
          vendorId: '123e4567-e89b-12d3-a456-426614174002',
          contractType: 'MAINTENANCE',
          startDate: '2025-01-01',
          endDate: '2024-01-01',
        })
      ).rejects.toThrow('End date must be after start date');
    });

    it('should throw error for negative total value', async () => {
      await expect(
        contractService.createContract({
          vendorId: '123e4567-e89b-12d3-a456-426614174002',
          contractType: 'MAINTENANCE',
          startDate: '2024-01-01',
          endDate: '2025-01-01',
          totalValue: -100,
        })
      ).rejects.toThrow('Total value cannot be negative');
    });

    it('should support all contract types', async () => {
      const contractTypes: contractService.ContractType[] = [
        'PURCHASE', 'LEASE', 'MAINTENANCE', 'SUPPORT', 'LICENSE', 'WARRANTY'
      ];

      for (const contractType of contractTypes) {
        const mockContract = {
          contractId: '123e4567-e89b-12d3-a456-426614174001',
          contractNumber: `CON-${contractType}`,
          vendorId: '123e4567-e89b-12d3-a456-426614174002',
          contractType,
          startDate: '2024-01-01',
          endDate: '2025-01-01',
          status: 'DRAFT',
        };

        mockRepository.createContract.mockResolvedValue(mockContract as any);

        const result = await contractService.createContract({
          vendorId: '123e4567-e89b-12d3-a456-426614174002',
          contractType,
          startDate: '2024-01-01',
          endDate: '2025-01-01',
        });

        expect(result.contractType).toBe(contractType);
      }
    });
  });


  describe('updateContract', () => {
    it('should update a contract successfully', async () => {
      const existingContract = {
        contractId: '123e4567-e89b-12d3-a456-426614174001',
        contractNumber: 'CON-ABC123-XYZ',
        vendorId: '123e4567-e89b-12d3-a456-426614174002',
        contractType: 'MAINTENANCE',
        startDate: '2024-01-01',
        endDate: '2025-01-01',
        status: 'DRAFT',
      };

      const updatedContract = {
        ...existingContract,
        status: 'ACTIVE',
      };

      mockRepository.getContractById.mockResolvedValue(existingContract as any);
      mockRepository.updateContract.mockResolvedValue(updatedContract as any);

      const result = await contractService.updateContract(
        '123e4567-e89b-12d3-a456-426614174001',
        { status: 'ACTIVE' }
      );

      expect(result.status).toBe('ACTIVE');
      expect(mockPublishEvent).toHaveBeenCalledWith('CONTRACT_UPDATED', expect.any(Object));
    });

    it('should throw error when contract not found', async () => {
      mockRepository.getContractById.mockResolvedValue(null);

      await expect(
        contractService.updateContract(
          '123e4567-e89b-12d3-a456-426614174001',
          { status: 'ACTIVE' }
        )
      ).rejects.toThrow('Contract not found');
    });

    it('should throw error for invalid status transition', async () => {
      const existingContract = {
        contractId: '123e4567-e89b-12d3-a456-426614174001',
        status: 'TERMINATED',
      };

      mockRepository.getContractById.mockResolvedValue(existingContract as any);

      await expect(
        contractService.updateContract(
          '123e4567-e89b-12d3-a456-426614174001',
          { status: 'ACTIVE' }
        )
      ).rejects.toThrow('Invalid status transition');
    });

    it('should allow valid status transitions', async () => {
      const transitions = [
        { from: 'DRAFT', to: 'ACTIVE' },
        { from: 'DRAFT', to: 'PENDING_APPROVAL' },
        { from: 'PENDING_APPROVAL', to: 'ACTIVE' },
        { from: 'ACTIVE', to: 'EXPIRED' },
        { from: 'ACTIVE', to: 'TERMINATED' },
      ];

      for (const { from, to } of transitions) {
        const existingContract = {
          contractId: '123e4567-e89b-12d3-a456-426614174001',
          vendorId: '123e4567-e89b-12d3-a456-426614174002',
          startDate: '2024-01-01',
          endDate: '2025-01-01',
          status: from,
        };

        const updatedContract = {
          ...existingContract,
          status: to,
        };

        mockRepository.getContractById.mockResolvedValue(existingContract as any);
        mockRepository.updateContract.mockResolvedValue(updatedContract as any);

        const result = await contractService.updateContract(
          '123e4567-e89b-12d3-a456-426614174001',
          { status: to as any }
        );

        expect(result.status).toBe(to);
      }
    });
  });

  describe('linkContractToAsset', () => {
    it('should link contract to asset successfully', async () => {
      const mockContract = {
        contractId: '123e4567-e89b-12d3-a456-426614174001',
        contractNumber: 'CON-ABC123-XYZ',
      };

      const mockLink = {
        linkId: '123e4567-e89b-12d3-a456-426614174003',
        contractId: '123e4567-e89b-12d3-a456-426614174001',
        assetId: '123e4567-e89b-12d3-a456-426614174004',
        linkType: 'COVERED',
      };

      mockRepository.getContractById.mockResolvedValue(mockContract as any);
      mockRepository.linkContractToAsset.mockResolvedValue(mockLink as any);

      const result = await contractService.linkContractToAsset(
        '123e4567-e89b-12d3-a456-426614174001',
        '123e4567-e89b-12d3-a456-426614174004'
      );

      expect(result.linkId).toBe(mockLink.linkId);
      expect(mockPublishEvent).toHaveBeenCalledWith('CONTRACT_ASSET_LINKED', expect.any(Object));
    });

    it('should throw error when contract not found', async () => {
      mockRepository.getContractById.mockResolvedValue(null);

      await expect(
        contractService.linkContractToAsset(
          '123e4567-e89b-12d3-a456-426614174001',
          '123e4567-e89b-12d3-a456-426614174004'
        )
      ).rejects.toThrow('Contract not found');
    });
  });

  describe('linkContractToEntitlement', () => {
    it('should link contract to entitlement successfully', async () => {
      const mockContract = {
        contractId: '123e4567-e89b-12d3-a456-426614174001',
        contractNumber: 'CON-ABC123-XYZ',
      };

      const mockLink = {
        linkId: '123e4567-e89b-12d3-a456-426614174003',
        contractId: '123e4567-e89b-12d3-a456-426614174001',
        entitlementId: '123e4567-e89b-12d3-a456-426614174005',
        linkType: 'LICENSE',
      };

      mockRepository.getContractById.mockResolvedValue(mockContract as any);
      mockRepository.linkContractToEntitlement.mockResolvedValue(mockLink as any);

      const result = await contractService.linkContractToEntitlement(
        '123e4567-e89b-12d3-a456-426614174001',
        '123e4567-e89b-12d3-a456-426614174005'
      );

      expect(result.linkId).toBe(mockLink.linkId);
      expect(mockPublishEvent).toHaveBeenCalledWith('CONTRACT_ENTITLEMENT_LINKED', expect.any(Object));
    });
  });

  describe('getContractsByVendor', () => {
    it('should return paginated contracts for vendor', async () => {
      const mockResult = {
        items: [
          { contractId: 'con-1', contractType: 'MAINTENANCE' },
          { contractId: 'con-2', contractType: 'SUPPORT' },
        ],
        total: 2,
        page: 1,
        limit: 50,
        hasMore: false,
      };

      mockRepository.getContractsByVendor.mockResolvedValue(mockResult as any);

      const result = await contractService.getContractsByVendor(
        '123e4567-e89b-12d3-a456-426614174002'
      );

      expect(result.items.length).toBe(2);
      expect(result.total).toBe(2);
    });
  });

  describe('getContractWithLinks', () => {
    it('should return contract with linked assets and entitlements', async () => {
      const mockContract = {
        contractId: '123e4567-e89b-12d3-a456-426614174001',
        contractNumber: 'CON-ABC123-XYZ',
      };

      const mockAssets = [
        { linkId: 'link-1', assetId: 'asset-1' },
      ];

      const mockEntitlements = [
        { linkId: 'link-2', entitlementId: 'ent-1' },
      ];

      mockRepository.getContractById.mockResolvedValue(mockContract as any);
      mockRepository.getContractAssets.mockResolvedValue(mockAssets as any);
      mockRepository.getContractEntitlements.mockResolvedValue(mockEntitlements as any);

      const result = await contractService.getContractWithLinks(
        '123e4567-e89b-12d3-a456-426614174001'
      );

      expect(result).not.toBeNull();
      expect(result!.contract.contractId).toBe(mockContract.contractId);
      expect(result!.assets.length).toBe(1);
      expect(result!.entitlements.length).toBe(1);
    });

    it('should return null when contract not found', async () => {
      mockRepository.getContractById.mockResolvedValue(null);

      const result = await contractService.getContractWithLinks(
        '123e4567-e89b-12d3-a456-426614174001'
      );

      expect(result).toBeNull();
    });
  });

  describe('activateContract', () => {
    it('should activate a draft contract', async () => {
      const existingContract = {
        contractId: '123e4567-e89b-12d3-a456-426614174001',
        vendorId: '123e4567-e89b-12d3-a456-426614174002',
        startDate: '2024-01-01',
        endDate: '2025-01-01',
        status: 'DRAFT',
      };

      const activatedContract = {
        ...existingContract,
        status: 'ACTIVE',
      };

      mockRepository.getContractById.mockResolvedValue(existingContract as any);
      mockRepository.updateContract.mockResolvedValue(activatedContract as any);

      const result = await contractService.activateContract(
        '123e4567-e89b-12d3-a456-426614174001'
      );

      expect(result.status).toBe('ACTIVE');
    });

    it('should return existing contract if already active', async () => {
      const existingContract = {
        contractId: '123e4567-e89b-12d3-a456-426614174001',
        status: 'ACTIVE',
      };

      mockRepository.getContractById.mockResolvedValue(existingContract as any);

      const result = await contractService.activateContract(
        '123e4567-e89b-12d3-a456-426614174001'
      );

      expect(result.status).toBe('ACTIVE');
      expect(mockRepository.updateContract).not.toHaveBeenCalled();
    });
  });

  describe('terminateContract', () => {
    it('should terminate an active contract', async () => {
      const existingContract = {
        contractId: '123e4567-e89b-12d3-a456-426614174001',
        vendorId: '123e4567-e89b-12d3-a456-426614174002',
        startDate: '2024-01-01',
        endDate: '2025-01-01',
        status: 'ACTIVE',
      };

      const terminatedContract = {
        ...existingContract,
        status: 'TERMINATED',
        terminationReason: 'Vendor out of business',
      };

      mockRepository.getContractById.mockResolvedValue(existingContract as any);
      mockRepository.updateContract.mockResolvedValue(terminatedContract as any);

      const result = await contractService.terminateContract(
        '123e4567-e89b-12d3-a456-426614174001',
        'Vendor out of business'
      );

      expect(result.status).toBe('TERMINATED');
    });
  });
});
