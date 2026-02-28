/**
 * Approval Workflow Service Unit Tests
 *
 * Tests for Approval Workflow Service:
 * - Route requests based on configurable rules (Requirement 6B.4)
 * - Notify approvers and track approval status (Requirement 6B.5)
 * - Multi-level approvals and delegation (Requirement 6B.6)
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

// Mock the repositories
jest.mock('../approval-workflow/approval-workflow-repository');
jest.mock('../request/request-repository');

import * as approvalWorkflowService from '../approval-workflow/approval-workflow-service';
import * as approvalWorkflowRepository from '../approval-workflow/approval-workflow-repository';
import * as requestRepository from '../request/request-repository';
import { publishEvent } from '@ams/events';

const mockApprovalWorkflowRepository = approvalWorkflowRepository as jest.Mocked<typeof approvalWorkflowRepository>;
const mockRequestRepository = requestRepository as jest.Mocked<typeof requestRepository>;
const mockPublishEvent = publishEvent as jest.Mock;

describe('Approval Workflow Service', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('routeForApproval', () => {
    const mockWorkflow = {
      workflowId: '123e4567-e89b-12d3-a456-426614174001',
      requestId: '123e4567-e89b-12d3-a456-426614174000',
      requestType: 'STANDARD',
      status: 'IN_PROGRESS' as const,
      currentLevel: 1,
      maxLevel: 2,
      currentApproverId: '123e4567-e89b-12d3-a456-426614174002',
      initiatedBy: '123e4567-e89b-12d3-a456-426614174003',
      initiatedDate: '2024-01-15T10:00:00.000Z',
    };

    const mockSteps = [
      {
        stepId: '123e4567-e89b-12d3-a456-426614174010',
        workflowId: mockWorkflow.workflowId,
        stepLevel: 1,
        approverId: '123e4567-e89b-12d3-a456-426614174002',
        approverName: 'Manager 1',
        status: 'PENDING' as const,
      },
      {
        stepId: '123e4567-e89b-12d3-a456-426614174011',
        workflowId: mockWorkflow.workflowId,
        stepLevel: 2,
        approverId: '123e4567-e89b-12d3-a456-426614174004',
        approverName: 'Manager 2',
        status: 'PENDING' as const,
      },
    ];

    it('should route a request for approval successfully', async () => {
      mockApprovalWorkflowRepository.getWorkflowByRequestId.mockResolvedValue(null);
      mockApprovalWorkflowRepository.getActiveRoutingRules.mockResolvedValue([]);
      mockApprovalWorkflowRepository.createWorkflow.mockResolvedValue({
        workflow: mockWorkflow as any,
        steps: mockSteps as any,
      });

      const input = {
        requestId: mockWorkflow.requestId,
        requestType: 'STANDARD',
        initiatedBy: mockWorkflow.initiatedBy,
        estimatedCost: 5000,
      };

      const result = await approvalWorkflowService.routeForApproval(input);

      expect(result.workflow.workflowId).toBe(mockWorkflow.workflowId);
      expect(result.steps.length).toBe(2);
      expect(mockPublishEvent).toHaveBeenCalledWith('APPROVAL_REQUIRED', expect.any(Object));
    });

    it('should return existing workflow if already exists', async () => {
      mockApprovalWorkflowRepository.getWorkflowByRequestId.mockResolvedValue(mockWorkflow as any);
      mockApprovalWorkflowRepository.getWorkflowSteps.mockResolvedValue(mockSteps as any);

      const input = {
        requestId: mockWorkflow.requestId,
        requestType: 'STANDARD',
        initiatedBy: mockWorkflow.initiatedBy,
      };

      const result = await approvalWorkflowService.routeForApproval(input);

      expect(result.workflow.workflowId).toBe(mockWorkflow.workflowId);
      expect(mockApprovalWorkflowRepository.createWorkflow).not.toHaveBeenCalled();
    });
  });

  describe('approveRequest', () => {
    const mockWorkflow = {
      workflowId: '123e4567-e89b-12d3-a456-426614174001',
      requestId: '123e4567-e89b-12d3-a456-426614174000',
      status: 'IN_PROGRESS' as const,
      currentLevel: 1,
      maxLevel: 2,
    };

    const mockStep1 = {
      stepId: '123e4567-e89b-12d3-a456-426614174010',
      workflowId: mockWorkflow.workflowId,
      stepLevel: 1,
      approverId: '123e4567-e89b-12d3-a456-426614174002',
      status: 'PENDING' as const,
    };

    const mockStep2 = {
      stepId: '123e4567-e89b-12d3-a456-426614174011',
      workflowId: mockWorkflow.workflowId,
      stepLevel: 2,
      approverId: '123e4567-e89b-12d3-a456-426614174004',
      status: 'PENDING' as const,
    };

    it('should approve a request and move to next level', async () => {
      mockApprovalWorkflowRepository.getWorkflowByRequestId.mockResolvedValue(mockWorkflow as any);
      mockApprovalWorkflowRepository.getCurrentPendingStep.mockResolvedValue(mockStep1 as any);
      mockApprovalWorkflowRepository.canUserApproveStep.mockResolvedValue(true);
      mockApprovalWorkflowRepository.updateApprovalStep.mockResolvedValue({
        ...mockStep1,
        status: 'APPROVED',
        decision: 'APPROVED',
      } as any);
      mockApprovalWorkflowRepository.getWorkflowSteps.mockResolvedValue([
        { ...mockStep1, status: 'APPROVED' },
        mockStep2,
      ] as any);
      mockApprovalWorkflowRepository.updateWorkflowStatus.mockResolvedValue({
        ...mockWorkflow,
        currentLevel: 2,
      } as any);

      const result = await approvalWorkflowService.approveRequest(
        mockWorkflow.requestId,
        { approverId: mockStep1.approverId }
      );

      expect(result.approved).toBe(true);
      expect(result.isComplete).toBe(false);
      expect(mockPublishEvent).toHaveBeenCalledWith('APPROVAL_STEP_COMPLETED', expect.any(Object));
    });

    it('should throw error when workflow not found', async () => {
      mockApprovalWorkflowRepository.getWorkflowByRequestId.mockResolvedValue(null);

      await expect(
        approvalWorkflowService.approveRequest('non-existent-id', { approverId: 'approver-1' })
      ).rejects.toThrow('No approval workflow found');
    });

    it('should throw error when user not authorized', async () => {
      mockApprovalWorkflowRepository.getWorkflowByRequestId.mockResolvedValue(mockWorkflow as any);
      mockApprovalWorkflowRepository.getCurrentPendingStep.mockResolvedValue(mockStep1 as any);
      mockApprovalWorkflowRepository.canUserApproveStep.mockResolvedValue(false);

      await expect(
        approvalWorkflowService.approveRequest(mockWorkflow.requestId, { approverId: 'unauthorized' })
      ).rejects.toThrow('not authorized');
    });
  });

  describe('rejectRequest', () => {
    const mockWorkflow = {
      workflowId: '123e4567-e89b-12d3-a456-426614174001',
      requestId: '123e4567-e89b-12d3-a456-426614174000',
      status: 'IN_PROGRESS' as const,
      currentLevel: 1,
    };

    const mockStep = {
      stepId: '123e4567-e89b-12d3-a456-426614174010',
      workflowId: mockWorkflow.workflowId,
      stepLevel: 1,
      approverId: '123e4567-e89b-12d3-a456-426614174002',
      status: 'PENDING' as const,
    };

    it('should reject a request successfully', async () => {
      mockApprovalWorkflowRepository.getWorkflowByRequestId.mockResolvedValue(mockWorkflow as any);
      mockApprovalWorkflowRepository.getCurrentPendingStep.mockResolvedValue(mockStep as any);
      mockApprovalWorkflowRepository.canUserApproveStep.mockResolvedValue(true);
      mockApprovalWorkflowRepository.updateApprovalStep.mockResolvedValue({
        ...mockStep,
        status: 'REJECTED',
        decision: 'REJECTED',
      } as any);
      mockApprovalWorkflowRepository.updateWorkflowStatus.mockResolvedValue({
        ...mockWorkflow,
        status: 'REJECTED',
      } as any);
      mockRequestRepository.updateRequestStatus.mockResolvedValue({} as any);

      const result = await approvalWorkflowService.rejectRequest(
        mockWorkflow.requestId,
        { rejectedBy: mockStep.approverId, rejectionReason: 'Budget constraints' }
      );

      expect(result.approved).toBe(false);
      expect(result.isComplete).toBe(true);
      expect(mockPublishEvent).toHaveBeenCalledWith('REQUEST_REJECTED', expect.any(Object));
    });
  });

  describe('delegateApproval', () => {
    const mockWorkflow = {
      workflowId: '123e4567-e89b-12d3-a456-426614174001',
      requestId: '123e4567-e89b-12d3-a456-426614174000',
      status: 'IN_PROGRESS' as const,
      currentLevel: 1,
    };

    const mockStep = {
      stepId: '123e4567-e89b-12d3-a456-426614174010',
      workflowId: mockWorkflow.workflowId,
      stepLevel: 1,
      approverId: '123e4567-e89b-12d3-a456-426614174002',
      status: 'PENDING' as const,
      delegatedTo: null,
    };

    it('should delegate approval successfully', async () => {
      mockApprovalWorkflowRepository.getWorkflowByRequestId.mockResolvedValue(mockWorkflow as any);
      mockApprovalWorkflowRepository.getCurrentPendingStep.mockResolvedValue(mockStep as any);
      mockApprovalWorkflowRepository.updateApprovalStep.mockResolvedValue({
        ...mockStep,
        status: 'DELEGATED',
        delegatedTo: '123e4567-e89b-12d3-a456-426614174005',
      } as any);
      mockApprovalWorkflowRepository.updateWorkflowStatus.mockResolvedValue({
        ...mockWorkflow,
        status: 'DELEGATED',
      } as any);

      const result = await approvalWorkflowService.delegateApproval(
        mockWorkflow.requestId,
        {
          delegatedBy: mockStep.approverId,
          delegatedTo: '123e4567-e89b-12d3-a456-426614174005',
          reason: 'Out of office',
        }
      );

      expect(result.approved).toBe(false);
      expect(result.isComplete).toBe(false);
      expect(mockPublishEvent).toHaveBeenCalledWith('APPROVAL_DELEGATED', expect.any(Object));
    });
  });

  describe('getWorkflowForRequest', () => {
    it('should return workflow with steps', async () => {
      const mockWorkflow = { workflowId: 'workflow-1', requestId: 'request-1' };
      const mockSteps = [{ stepId: 'step-1', stepLevel: 1 }];

      mockApprovalWorkflowRepository.getWorkflowByRequestId.mockResolvedValue(mockWorkflow as any);
      mockApprovalWorkflowRepository.getWorkflowSteps.mockResolvedValue(mockSteps as any);

      const result = await approvalWorkflowService.getWorkflowForRequest('request-1');

      expect(result).not.toBeNull();
      expect(result?.workflow.workflowId).toBe('workflow-1');
    });

    it('should return null when workflow not found', async () => {
      mockApprovalWorkflowRepository.getWorkflowByRequestId.mockResolvedValue(null);

      const result = await approvalWorkflowService.getWorkflowForRequest('non-existent');

      expect(result).toBeNull();
    });
  });
});

