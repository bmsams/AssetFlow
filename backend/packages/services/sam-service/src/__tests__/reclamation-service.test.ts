/**
 * Unit tests for Reclamation Service
 *
 * Tests the business logic for software license reclamation:
 * - Identifying unused software installations (Requirement 4.6)
 * - Initiating reclamation workflows (Requirement 4.7)
 * - Returning licenses to available pool (Requirement 4.7)
 *
 * Requirements: 4.6, 4.7
 */

import * as reclamationService from '../reclamation/reclamation-service';
import * as reclamationRepository from '../reclamation/reclamation-repository';

// Mock the repository
jest.mock('../reclamation/reclamation-repository');

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
  v4: jest.fn().mockReturnValue('mock-uuid-1234'),
}));

const mockRepository = reclamationRepository as jest.Mocked<typeof reclamationRepository>;

describe('Reclamation Service', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('getReclamationRules', () => {
    it('should return all active reclamation rules', async () => {
      const mockRules: reclamationRepository.ReclamationRule[] = [
        {
          ruleId: 'rule-1',
          ruleName: 'Standard 90-Day Unused',
          description: 'Software not used in 90 days',
          softwareProductId: null,
          productCategory: null,
          publisher: null,
          daysSinceLastUse: 90,
          minUsageMinutes30Day: 60,
          minUsageMinutes90Day: 0,
          priority: 100,
          isActive: true,
          autoCreateCandidates: true,
          requireApproval: true,
          notifyUser: true,
          notifyManager: true,
          notificationDaysBeforeAction: 14,
          createdAt: '2024-01-01T00:00:00Z',
          updatedAt: '2024-01-01T00:00:00Z',
        },
      ];

      mockRepository.getActiveRules.mockResolvedValue(mockRules);

      const result = await reclamationService.getReclamationRules();

      expect(result).toEqual(mockRules);
      expect(mockRepository.getActiveRules).toHaveBeenCalled();
    });
  });

  describe('identifyReclamationCandidates', () => {
    const mockRule: reclamationRepository.ReclamationRule = {
      ruleId: 'rule-1',
      ruleName: 'Standard 90-Day Unused',
      description: 'Software not used in 90 days',
      softwareProductId: null,
      productCategory: null,
      publisher: null,
      daysSinceLastUse: 90,
      minUsageMinutes30Day: 60,
      minUsageMinutes90Day: 0,
      priority: 100,
      isActive: true,
      autoCreateCandidates: true,
      requireApproval: true,
      notifyUser: true,
      notifyManager: true,
      notificationDaysBeforeAction: 14,
      createdAt: '2024-01-01T00:00:00Z',
      updatedAt: '2024-01-01T00:00:00Z',
    };

    const mockInstallation: reclamationRepository.InstallationUsageDetails = {
      installationId: 'install-1',
      softwareProductId: 'product-1',
      hardwareAssetId: 'asset-1',
      productName: 'Adobe Photoshop',
      publisher: 'Adobe',
      productCategory: 'CREATIVE',
      installedDate: '2023-01-01T00:00:00Z',
      lastUsedDate: '2023-10-01T00:00:00Z',
      usageMinutes30Day: 0,
      daysSinceLastUse: 120,
      assignedToUserId: 'user-1',
      assignedToUserEmail: 'user@example.com',
      managerId: 'manager-1',
      status: 'ACTIVE',
      unitCost: 50.0,
    };

    const mockCandidate: reclamationRepository.ReclamationCandidate = {
      candidateId: 'candidate-1',
      installationId: 'install-1',
      daysSinceLastUse: 120,
      reclamationRuleId: 'rule-1',
      status: 'IDENTIFIED',
      workflowId: null,
      identifiedAt: '2024-01-15T10:00:00Z',
      usageAtIdentification: 0,
      userNotifiedAt: null,
      managerNotifiedAt: null,
      notificationCount: 0,
      approvalRequestedAt: null,
      approvedBy: null,
      approvedAt: null,
      rejectionReason: null,
      actionScheduledAt: null,
      actionCompletedAt: null,
      actionType: null,
      actionResult: null,
      licenseRecovered: false,
      licenseRecoveredAt: null,
      entitlementId: null,
      notes: 'Identified by rule: Standard 90-Day Unused',
      createdAt: '2024-01-15T10:00:00Z',
      updatedAt: '2024-01-15T10:00:00Z',
    };

    it('should identify reclamation candidates based on rules', async () => {
      mockRepository.getActiveRules.mockResolvedValue([mockRule]);
      mockRepository.findUnusedInstallations.mockResolvedValue([mockInstallation]);
      mockRepository.createCandidate.mockResolvedValue(mockCandidate);

      const result = await reclamationService.identifyReclamationCandidates();

      expect(result.rulesApplied).toBe(1);
      expect(result.candidatesIdentified).toBe(1);
      expect(result.potentialSavings).toBe(50.0);
      expect(result.candidates).toHaveLength(1);
      expect(mockRepository.findUnusedInstallations).toHaveBeenCalledWith(
        90, // daysSinceLastUse from rule
        60, // minUsageMinutes30Day from rule
        undefined,
        undefined,
        undefined
      );
    });

    it('should filter by productId when provided', async () => {
      const productId = 'product-123';
      mockRepository.getActiveRules.mockResolvedValue([mockRule]);
      mockRepository.findUnusedInstallations.mockResolvedValue([]);

      await reclamationService.identifyReclamationCandidates(undefined, productId);

      expect(mockRepository.findUnusedInstallations).toHaveBeenCalledWith(
        90,
        60,
        productId,
        undefined,
        undefined
      );
    });

    it('should use specific rules when provided', async () => {
      const specificRule = { ...mockRule, ruleId: 'specific-rule' };
      mockRepository.findUnusedInstallations.mockResolvedValue([]);

      await reclamationService.identifyReclamationCandidates([specificRule]);

      expect(mockRepository.getActiveRules).not.toHaveBeenCalled();
      expect(mockRepository.findUnusedInstallations).toHaveBeenCalled();
    });

    it('should return empty result when no rules are active', async () => {
      mockRepository.getActiveRules.mockResolvedValue([]);

      const result = await reclamationService.identifyReclamationCandidates();

      expect(result.rulesApplied).toBe(0);
      expect(result.candidatesIdentified).toBe(0);
      expect(result.candidates).toHaveLength(0);
    });

    it('should not create duplicate candidates for same installation', async () => {
      const rule1 = { ...mockRule, ruleId: 'rule-1', priority: 1 };
      const rule2 = { ...mockRule, ruleId: 'rule-2', priority: 2 };

      mockRepository.getActiveRules.mockResolvedValue([rule1, rule2]);
      mockRepository.findUnusedInstallations.mockResolvedValue([mockInstallation]);
      mockRepository.createCandidate.mockResolvedValue(mockCandidate);

      const result = await reclamationService.identifyReclamationCandidates();

      // Should only create one candidate even though two rules match
      expect(result.candidatesIdentified).toBe(1);
      expect(mockRepository.createCandidate).toHaveBeenCalledTimes(1);
    });

    it('should skip candidate creation when autoCreateCandidates is false', async () => {
      const ruleNoAutoCreate = { ...mockRule, autoCreateCandidates: false };
      mockRepository.getActiveRules.mockResolvedValue([ruleNoAutoCreate]);
      mockRepository.findUnusedInstallations.mockResolvedValue([mockInstallation]);

      const result = await reclamationService.identifyReclamationCandidates();

      expect(result.candidatesIdentified).toBe(0);
      expect(mockRepository.createCandidate).not.toHaveBeenCalled();
    });
  });

  describe('initiateReclamation', () => {
    const mockCandidate: reclamationRepository.ReclamationCandidate = {
      candidateId: 'candidate-1',
      installationId: 'install-1',
      daysSinceLastUse: 120,
      reclamationRuleId: 'rule-1',
      status: 'IDENTIFIED',
      workflowId: null,
      identifiedAt: '2024-01-15T10:00:00Z',
      usageAtIdentification: 0,
      userNotifiedAt: null,
      managerNotifiedAt: null,
      notificationCount: 0,
      approvalRequestedAt: null,
      approvedBy: null,
      approvedAt: null,
      rejectionReason: null,
      actionScheduledAt: null,
      actionCompletedAt: null,
      actionType: null,
      actionResult: null,
      licenseRecovered: false,
      licenseRecoveredAt: null,
      entitlementId: null,
      notes: null,
      createdAt: '2024-01-15T10:00:00Z',
      updatedAt: '2024-01-15T10:00:00Z',
    };

    const mockRule: reclamationRepository.ReclamationRule = {
      ruleId: 'rule-1',
      ruleName: 'Standard 90-Day Unused',
      description: null,
      softwareProductId: null,
      productCategory: null,
      publisher: null,
      daysSinceLastUse: 90,
      minUsageMinutes30Day: 0,
      minUsageMinutes90Day: 0,
      priority: 100,
      isActive: true,
      autoCreateCandidates: true,
      requireApproval: true,
      notifyUser: true,
      notifyManager: true,
      notificationDaysBeforeAction: 14,
      createdAt: '2024-01-01T00:00:00Z',
      updatedAt: '2024-01-01T00:00:00Z',
    };

    it('should initiate reclamation workflow with approval required', async () => {
      mockRepository.getCandidateById.mockResolvedValue(mockCandidate);
      mockRepository.getRuleById.mockResolvedValue(mockRule);
      mockRepository.updateCandidateStatus.mockResolvedValue({
        ...mockCandidate,
        status: 'PENDING_APPROVAL',
        workflowId: 'mock-uuid-1234',
      });

      const result = await reclamationService.initiateReclamation('candidate-1');

      expect(result.status).toBe('PENDING_APPROVAL');
      expect(result.requiresApproval).toBe(true);
      expect(result.userNotified).toBe(true);
      expect(result.managerNotified).toBe(true);
      expect(result.workflowId).toBe('mock-uuid-1234');
    });

    it('should skip approval when skipApproval option is true', async () => {
      mockRepository.getCandidateById.mockResolvedValue(mockCandidate);
      mockRepository.getRuleById.mockResolvedValue(mockRule);
      mockRepository.updateCandidateStatus.mockResolvedValue({
        ...mockCandidate,
        status: 'IN_PROGRESS',
        workflowId: 'mock-uuid-1234',
      });

      const result = await reclamationService.initiateReclamation('candidate-1', {
        skipApproval: true,
      });

      expect(result.status).toBe('IN_PROGRESS');
      expect(result.requiresApproval).toBe(false);
    });

    it('should skip notifications when skipNotification option is true', async () => {
      mockRepository.getCandidateById.mockResolvedValue(mockCandidate);
      mockRepository.getRuleById.mockResolvedValue(mockRule);
      mockRepository.updateCandidateStatus.mockResolvedValue({
        ...mockCandidate,
        status: 'PENDING_APPROVAL',
        workflowId: 'mock-uuid-1234',
      });

      const result = await reclamationService.initiateReclamation('candidate-1', {
        skipNotification: true,
      });

      expect(result.userNotified).toBe(false);
      expect(result.managerNotified).toBe(false);
    });

    it('should throw error when candidate not found', async () => {
      mockRepository.getCandidateById.mockResolvedValue(null);

      await expect(
        reclamationService.initiateReclamation('non-existent')
      ).rejects.toThrow('Reclamation candidate not found');
    });

    it('should throw error when candidate status is invalid', async () => {
      mockRepository.getCandidateById.mockResolvedValue({
        ...mockCandidate,
        status: 'COMPLETED',
      });

      await expect(
        reclamationService.initiateReclamation('candidate-1')
      ).rejects.toThrow('Cannot initiate reclamation for candidate in status: COMPLETED');
    });
  });

  describe('approveReclamation', () => {
    const mockCandidate: reclamationRepository.ReclamationCandidate = {
      candidateId: 'candidate-1',
      installationId: 'install-1',
      daysSinceLastUse: 120,
      reclamationRuleId: 'rule-1',
      status: 'PENDING_APPROVAL',
      workflowId: 'workflow-1',
      identifiedAt: '2024-01-15T10:00:00Z',
      usageAtIdentification: 0,
      userNotifiedAt: '2024-01-15T10:00:00Z',
      managerNotifiedAt: '2024-01-15T10:00:00Z',
      notificationCount: 1,
      approvalRequestedAt: '2024-01-15T10:00:00Z',
      approvedBy: null,
      approvedAt: null,
      rejectionReason: null,
      actionScheduledAt: null,
      actionCompletedAt: null,
      actionType: 'UNINSTALL',
      actionResult: null,
      licenseRecovered: false,
      licenseRecoveredAt: null,
      entitlementId: null,
      notes: null,
      createdAt: '2024-01-15T10:00:00Z',
      updatedAt: '2024-01-15T10:00:00Z',
    };

    it('should approve reclamation candidate', async () => {
      mockRepository.getCandidateById.mockResolvedValue(mockCandidate);
      mockRepository.updateCandidateStatus.mockResolvedValue({
        ...mockCandidate,
        status: 'APPROVED',
        approvedBy: 'approver-1',
        approvedAt: '2024-01-16T10:00:00Z',
      });

      const result = await reclamationService.approveReclamation('candidate-1', 'approver-1');

      expect(result.status).toBe('APPROVED');
      expect(result.approvedBy).toBe('approver-1');
      expect(mockRepository.updateCandidateStatus).toHaveBeenCalledWith(
        'candidate-1',
        'APPROVED',
        expect.objectContaining({ approvedBy: 'approver-1' })
      );
    });

    it('should throw error when candidate not in PENDING_APPROVAL status', async () => {
      mockRepository.getCandidateById.mockResolvedValue({
        ...mockCandidate,
        status: 'IDENTIFIED',
      });

      await expect(
        reclamationService.approveReclamation('candidate-1', 'approver-1')
      ).rejects.toThrow('Cannot approve candidate in status: IDENTIFIED');
    });
  });

  describe('rejectReclamation', () => {
    const mockCandidate: reclamationRepository.ReclamationCandidate = {
      candidateId: 'candidate-1',
      installationId: 'install-1',
      daysSinceLastUse: 120,
      reclamationRuleId: 'rule-1',
      status: 'PENDING_APPROVAL',
      workflowId: 'workflow-1',
      identifiedAt: '2024-01-15T10:00:00Z',
      usageAtIdentification: 0,
      userNotifiedAt: null,
      managerNotifiedAt: null,
      notificationCount: 0,
      approvalRequestedAt: null,
      approvedBy: null,
      approvedAt: null,
      rejectionReason: null,
      actionScheduledAt: null,
      actionCompletedAt: null,
      actionType: null,
      actionResult: null,
      licenseRecovered: false,
      licenseRecoveredAt: null,
      entitlementId: null,
      notes: null,
      createdAt: '2024-01-15T10:00:00Z',
      updatedAt: '2024-01-15T10:00:00Z',
    };

    it('should reject reclamation candidate', async () => {
      mockRepository.getCandidateById.mockResolvedValue(mockCandidate);
      mockRepository.updateCandidateStatus.mockResolvedValue({
        ...mockCandidate,
        status: 'REJECTED' as const,
        rejectionReason: 'User needs this software',
      });

      const result = await reclamationService.rejectReclamation(
        'candidate-1',
        'rejector-1',
        'User needs this software'
      );

      expect(result.status).toBe('REJECTED');
      expect(result.rejectionReason).toBe('User needs this software');
    });
  });

  describe('completeReclamation', () => {
    const mockCandidate: reclamationRepository.ReclamationCandidate = {
      candidateId: 'candidate-1',
      installationId: 'install-1',
      daysSinceLastUse: 120,
      reclamationRuleId: 'rule-1',
      status: 'APPROVED',
      workflowId: 'workflow-1',
      identifiedAt: '2024-01-15T10:00:00Z',
      usageAtIdentification: 0,
      userNotifiedAt: null,
      managerNotifiedAt: null,
      notificationCount: 0,
      approvalRequestedAt: null,
      approvedBy: 'approver-1',
      approvedAt: '2024-01-16T10:00:00Z',
      rejectionReason: null,
      actionScheduledAt: null,
      actionCompletedAt: null,
      actionType: 'UNINSTALL',
      actionResult: null,
      licenseRecovered: false,
      licenseRecoveredAt: null,
      entitlementId: null,
      notes: null,
      createdAt: '2024-01-15T10:00:00Z',
      updatedAt: '2024-01-15T10:00:00Z',
    };

    it('should complete reclamation and return license to pool', async () => {
      mockRepository.getCandidateById.mockResolvedValue(mockCandidate);
      mockRepository.updateCandidateStatus.mockResolvedValue({
        ...mockCandidate,
        status: 'COMPLETED',
        licenseRecovered: true,
        entitlementId: 'entitlement-1',
      });
      mockRepository.markInstallationReclaimed.mockResolvedValue(undefined);
      mockRepository.returnLicenseToPool.mockResolvedValue(undefined);

      const result = await reclamationService.completeReclamation('candidate-1', {
        actionResult: 'Software uninstalled successfully',
        licenseRecovered: true,
        entitlementId: 'entitlement-1',
      });

      expect(result.status).toBe('COMPLETED');
      expect(result.licenseRecovered).toBe(true);
      expect(mockRepository.markInstallationReclaimed).toHaveBeenCalledWith('install-1');
      expect(mockRepository.returnLicenseToPool).toHaveBeenCalledWith('entitlement-1');
    });

    it('should complete reclamation without returning license when not recovered', async () => {
      mockRepository.getCandidateById.mockResolvedValue(mockCandidate);
      mockRepository.updateCandidateStatus.mockResolvedValue({
        ...mockCandidate,
        status: 'COMPLETED',
        licenseRecovered: false,
      });
      mockRepository.markInstallationReclaimed.mockResolvedValue(undefined);

      await reclamationService.completeReclamation('candidate-1', {
        actionResult: 'Software disabled but license not recovered',
        licenseRecovered: false,
      });

      expect(mockRepository.returnLicenseToPool).not.toHaveBeenCalled();
    });
  });

  describe('cancelReclamation', () => {
    const mockCandidate: reclamationRepository.ReclamationCandidate = {
      candidateId: 'candidate-1',
      installationId: 'install-1',
      daysSinceLastUse: 120,
      reclamationRuleId: 'rule-1',
      status: 'IDENTIFIED',
      workflowId: null,
      identifiedAt: '2024-01-15T10:00:00Z',
      usageAtIdentification: 0,
      userNotifiedAt: null,
      managerNotifiedAt: null,
      notificationCount: 0,
      approvalRequestedAt: null,
      approvedBy: null,
      approvedAt: null,
      rejectionReason: null,
      actionScheduledAt: null,
      actionCompletedAt: null,
      actionType: null,
      actionResult: null,
      licenseRecovered: false,
      licenseRecoveredAt: null,
      entitlementId: null,
      notes: null,
      createdAt: '2024-01-15T10:00:00Z',
      updatedAt: '2024-01-15T10:00:00Z',
    };

    it('should cancel reclamation candidate', async () => {
      mockRepository.getCandidateById.mockResolvedValue(mockCandidate);
      mockRepository.updateCandidateStatus.mockResolvedValue({
        ...mockCandidate,
        status: 'CANCELLED',
        notes: 'Cancelled: User requested to keep software',
      });

      const result = await reclamationService.cancelReclamation(
        'candidate-1',
        'User requested to keep software'
      );

      expect(result.status).toBe('CANCELLED');
    });

    it('should throw error when trying to cancel completed candidate', async () => {
      mockRepository.getCandidateById.mockResolvedValue({
        ...mockCandidate,
        status: 'COMPLETED',
      });

      await expect(
        reclamationService.cancelReclamation('candidate-1', 'Some reason')
      ).rejects.toThrow('Cannot cancel candidate in status: COMPLETED');
    });
  });

  describe('getReclamationSummary', () => {
    it('should return reclamation summary statistics', async () => {
      const mockSummary = {
        totalCandidates: 100,
        byStatus: {
          IDENTIFIED: 50,
          PENDING_APPROVAL: 20,
          APPROVED: 10,
          COMPLETED: 15,
          CANCELLED: 5,
        },
        potentialSavings: 5000.0,
        licensesRecovered: 15,
      };

      mockRepository.getReclamationSummary.mockResolvedValue(mockSummary);

      const result = await reclamationService.getReclamationSummary();

      expect(result).toEqual(mockSummary);
      expect(result.totalCandidates).toBe(100);
      expect(result.potentialSavings).toBe(5000.0);
      expect(result.licensesRecovered).toBe(15);
    });
  });
});
