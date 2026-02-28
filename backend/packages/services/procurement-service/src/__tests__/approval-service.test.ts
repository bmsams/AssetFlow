/**
 * Approval Service Unit Tests
 *
 * Tests for approval workflow operations.
 * Requirements: 17.1-17.5
 */

// Mock the dependencies before importing service
jest.mock('@ams/events');
jest.mock('../approval/approval-repository');
jest.mock('@ams/utils', () => ({
  createLogger: () => ({
    info: jest.fn(),
    error: jest.fn(),
    warn: jest.fn(),
    debug: jest.fn(),
  }),
  now: () => '2024-01-15T10:00:00.000Z',
}));

import { publishEvent } from '@ams/events';
import * as repository from '../approval/approval-repository';
import {
  getApprovalThresholdForAmount,
  getApproversForAmount,
  createDelegation,
  canApproveOnBehalf,
  getPendingApprovalsForUser,
  sendApprovalReminders,
} from '../approval/approval-service';

const mockRepository = jest.mocked(repository);
const mockPublishEvent = jest.mocked(publishEvent);

// ============================================================================
// Test Data
// ============================================================================

const mockThreshold = {
  thresholdId: '111e4567-e89b-12d3-a456-426614174000',
  minAmount: 0,
  maxAmount: 10000,
  approverRoleId: '222e4567-e89b-12d3-a456-426614174000',
  approverRoleName: 'Manager',
  requiresMultipleApprovers: false,
  isActive: true,
  createdAt: '2024-01-15T10:00:00.000Z',
  updatedAt: '2024-01-15T10:00:00.000Z',
};

const mockDelegation = {
  delegationId: '333e4567-e89b-12d3-a456-426614174000',
  delegatorId: '444e4567-e89b-12d3-a456-426614174000',
  delegatorName: 'John Doe',
  delegateId: '555e4567-e89b-12d3-a456-426614174000',
  delegateName: 'Jane Smith',
  startDate: '2024-01-01',
  endDate: '2024-12-31',
  isActive: true,
  createdAt: '2024-01-15T10:00:00.000Z',
  updatedAt: '2024-01-15T10:00:00.000Z',
};

const mockPendingApproval = {
  poId: '666e4567-e89b-12d3-a456-426614174000',
  poNumber: 'PO-20240115-0001',
  vendorName: 'Acme Corporation',
  totalAmount: 5000,
  requestedBy: '777e4567-e89b-12d3-a456-426614174000',
  requestedByName: 'Bob Wilson',
  requestedDate: '2024-01-10',
  daysWaiting: 5,
};

describe('Approval Service', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  // ============================================================================
  // Threshold Routing Tests (Requirement 17.1)
  // ============================================================================

  describe('getApprovalThresholdForAmount', () => {
    it('should return threshold for amount (Requirement 17.1)', async () => {
      mockRepository.getApprovalThresholdForAmount.mockResolvedValue(mockThreshold);

      const result = await getApprovalThresholdForAmount(5000);

      expect(result).toEqual(mockThreshold);
      expect(mockRepository.getApprovalThresholdForAmount).toHaveBeenCalledWith(5000);
    });

    it('should return null when no threshold found', async () => {
      mockRepository.getApprovalThresholdForAmount.mockResolvedValue(null);

      const result = await getApprovalThresholdForAmount(1000000);

      expect(result).toBeNull();
    });
  });

  describe('getApproversForAmount', () => {
    it('should return approvers for amount', async () => {
      const mockApprovers = [
        { userId: '888e4567-e89b-12d3-a456-426614174000', userName: 'Manager 1', email: 'manager1@example.com' },
      ];
      mockRepository.getApprovalThresholdForAmount.mockResolvedValue(mockThreshold);
      mockRepository.getApproversForThreshold.mockResolvedValue(mockApprovers);

      const result = await getApproversForAmount(5000);

      expect(result).toEqual(mockApprovers);
    });

    it('should return empty array when no threshold found', async () => {
      mockRepository.getApprovalThresholdForAmount.mockResolvedValue(null);

      const result = await getApproversForAmount(1000000);

      expect(result).toEqual([]);
    });
  });

  // ============================================================================
  // Delegation Tests (Requirement 17.4)
  // ============================================================================

  describe('createDelegation', () => {
    it('should create delegation (Requirement 17.4)', async () => {
      mockRepository.getActiveDelegation.mockResolvedValue(null);
      mockRepository.createDelegation.mockResolvedValue(mockDelegation);

      const request = {
        delegatorId: mockDelegation.delegatorId,
        delegateId: mockDelegation.delegateId,
        startDate: '2024-01-01',
        endDate: '2024-12-31',
      };

      const result = await createDelegation(request);

      expect(result).toEqual(mockDelegation);
    });

    it('should throw error when end date is before start date', async () => {
      const request = {
        delegatorId: mockDelegation.delegatorId,
        delegateId: mockDelegation.delegateId,
        startDate: '2024-12-31',
        endDate: '2024-01-01',
      };

      await expect(createDelegation(request)).rejects.toThrow('End date must be after start date');
    });

    it('should throw error when user already has active delegation', async () => {
      mockRepository.getActiveDelegation.mockResolvedValue(mockDelegation);

      const request = {
        delegatorId: mockDelegation.delegatorId,
        delegateId: mockDelegation.delegateId,
        startDate: '2024-01-01',
        endDate: '2024-12-31',
      };

      await expect(createDelegation(request)).rejects.toThrow('User already has an active delegation');
    });
  });

  describe('canApproveOnBehalf', () => {
    it('should return true when delegation exists', async () => {
      mockRepository.getDelegationsForDelegate.mockResolvedValue([mockDelegation]);

      const result = await canApproveOnBehalf(
        mockDelegation.delegateId,
        mockDelegation.delegatorId
      );

      expect(result).toBe(true);
    });

    it('should return false when no delegation exists', async () => {
      mockRepository.getDelegationsForDelegate.mockResolvedValue([]);

      const result = await canApproveOnBehalf(
        mockDelegation.delegateId,
        mockDelegation.delegatorId
      );

      expect(result).toBe(false);
    });
  });

  // ============================================================================
  // Pending Approvals Tests
  // ============================================================================

  describe('getPendingApprovalsForUser', () => {
    it('should return pending approvals including delegated', async () => {
      mockRepository.getPendingApprovalsForUser.mockResolvedValue([mockPendingApproval]);
      mockRepository.getDelegationsForDelegate.mockResolvedValue([]);

      const result = await getPendingApprovalsForUser('user-id');

      expect(result).toHaveLength(1);
      expect(result[0]).toEqual(mockPendingApproval);
    });
  });

  // ============================================================================
  // Reminder Tests (Requirement 17.5)
  // ============================================================================

  describe('sendApprovalReminders', () => {
    it('should send reminders for overdue approvals (Requirement 17.5)', async () => {
      mockRepository.getPendingApprovalsForReminder.mockResolvedValue([mockPendingApproval]);
      mockRepository.getApprovalThresholdForAmount.mockResolvedValue(mockThreshold);
      mockRepository.getApproversForThreshold.mockResolvedValue([
        { userId: 'approver-id', userName: 'Approver', email: 'approver@example.com' },
      ]);
      mockPublishEvent.mockResolvedValue({} as any);

      const result = await sendApprovalReminders(3);

      expect(result.remindersSent).toBe(1);
      expect(result.errors).toHaveLength(0);
      expect(mockPublishEvent).toHaveBeenCalledWith(
        'APPROVAL_REMINDER_SENT',
        expect.objectContaining({
          poId: mockPendingApproval.poId,
          poNumber: mockPendingApproval.poNumber,
        })
      );
    });
  });
});
