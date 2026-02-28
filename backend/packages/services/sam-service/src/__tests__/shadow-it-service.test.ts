/**
 * Unit tests for Shadow IT Service
 *
 * Tests the business logic for shadow IT detection:
 * - Analyzing network traffic logs to identify unauthorized SaaS applications (Requirement 4.8)
 * - Creating alerts with application details and user information (Requirement 4.9)
 *
 * Requirements: 4.8, 4.9
 */

import * as shadowITService from '../shadow-it/shadow-it-service';
import * as shadowITRepository from '../shadow-it/shadow-it-repository';

// Mock the repository
jest.mock('../shadow-it/shadow-it-repository');

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

const mockRepository = shadowITRepository as jest.Mocked<typeof shadowITRepository>;

describe('Shadow IT Service', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('analyzeShadowIT', () => {
    const mockTrafficLogs: shadowITRepository.TrafficLogEntry[] = [
      {
        timestamp: '2024-01-15T10:00:00Z',
        userId: 'user-1',
        sourceIp: '192.168.1.100',
        destinationDomain: 'dropbox.com',
        destinationUrl: 'https://dropbox.com/upload',
        bytesTransferred: 1024000,
        protocol: 'HTTPS',
      },
      {
        timestamp: '2024-01-15T10:05:00Z',
        userId: 'user-2',
        sourceIp: '192.168.1.101',
        destinationDomain: 'dropbox.com',
        destinationUrl: 'https://dropbox.com/download',
        bytesTransferred: 2048000,
        protocol: 'HTTPS',
      },
      {
        timestamp: '2024-01-15T10:10:00Z',
        userId: 'user-1',
        sourceIp: '192.168.1.100',
        destinationDomain: 'slack.com',
        destinationUrl: 'https://slack.com/api/chat',
        bytesTransferred: 512,
        protocol: 'HTTPS',
      },
    ];

    const mockDetection: shadowITRepository.ShadowITDetection = {
      detectionId: 'detection-1',
      applicationName: 'Dropbox',
      applicationDomain: 'dropbox.com',
      category: 'FILE_SHARING',
      riskLevel: 'HIGH',
      usersAffected: ['user-1', 'user-2'],
      firstDetectedAt: '2024-01-15T10:00:00Z',
      lastSeenAt: '2024-01-15T10:05:00Z',
      totalBytesTransferred: 3072000,
      accessCount: 2,
      status: 'DETECTED',
      reviewedBy: null,
      reviewedAt: null,
      reviewNotes: null,
      knownApplicationId: null,
      createdAt: '2024-01-15T10:00:00Z',
      updatedAt: '2024-01-15T10:05:00Z',
    };

    const mockAlert: shadowITRepository.ShadowITAlert = {
      alertId: 'alert-1',
      detectionId: 'detection-1',
      applicationName: 'Dropbox',
      applicationDomain: 'dropbox.com',
      userId: 'user-1',
      userEmail: null,
      riskLevel: 'HIGH',
      accessCount: 1,
      bytesTransferred: 1024000,
      firstAccessAt: '2024-01-15T10:00:00Z',
      lastAccessAt: '2024-01-15T10:00:00Z',
      status: 'NEW',
      acknowledgedBy: null,
      acknowledgedAt: null,
      resolvedBy: null,
      resolvedAt: null,
      notes: null,
      createdAt: '2024-01-15T10:00:00Z',
      updatedAt: '2024-01-15T10:00:00Z',
    };

    it('should analyze traffic logs and detect shadow IT applications', async () => {
      mockRepository.getApprovedApplications.mockResolvedValue([]);
      mockRepository.upsertDetection.mockResolvedValue(mockDetection);
      mockRepository.hasExistingAlert.mockResolvedValue(false);
      mockRepository.createAlert.mockResolvedValue(mockAlert);

      const result = await shadowITService.analyzeShadowIT(mockTrafficLogs);

      expect(result.logsAnalyzed).toBe(3);
      expect(result.shadowITDetected).toBeGreaterThan(0);
      expect(result.detections.length).toBeGreaterThan(0);
      expect(mockRepository.upsertDetection).toHaveBeenCalled();
    });

    it('should skip approved applications', async () => {
      const approvedApp: shadowITRepository.KnownApplication = {
        applicationId: 'app-1',
        applicationName: 'Dropbox',
        domain: 'dropbox.com',
        domainPatterns: [],
        category: 'FILE_SHARING',
        vendor: 'Dropbox Inc',
        isApproved: true,
        isBlocked: false,
        riskLevel: 'LOW',
        description: null,
        dataClassification: null,
        complianceNotes: null,
        createdAt: '2024-01-01T00:00:00Z',
        updatedAt: '2024-01-01T00:00:00Z',
      };

      mockRepository.getApprovedApplications.mockResolvedValue([approvedApp]);
      mockRepository.upsertDetection.mockResolvedValue(mockDetection);
      mockRepository.hasExistingAlert.mockResolvedValue(false);
      mockRepository.createAlert.mockResolvedValue(mockAlert);

      const result = await shadowITService.analyzeShadowIT(mockTrafficLogs);

      // Dropbox should be skipped since it's approved
      // Only Slack should be detected
      expect(result.logsAnalyzed).toBe(3);
    });

    it('should return empty result for empty traffic logs', async () => {
      const result = await shadowITService.analyzeShadowIT([]);

      expect(result.logsAnalyzed).toBe(0);
      expect(result.uniqueDomainsFound).toBe(0);
      expect(result.shadowITDetected).toBe(0);
      expect(result.alertsGenerated).toBe(0);
      expect(result.detections).toHaveLength(0);
      expect(result.alerts).toHaveLength(0);
    });

    it('should not create duplicate alerts for same user/detection', async () => {
      mockRepository.getApprovedApplications.mockResolvedValue([]);
      mockRepository.upsertDetection.mockResolvedValue(mockDetection);
      mockRepository.hasExistingAlert.mockResolvedValue(true); // Alert already exists
      mockRepository.createAlert.mockResolvedValue(mockAlert);

      const result = await shadowITService.analyzeShadowIT(mockTrafficLogs);

      // Alerts should not be created since they already exist
      expect(mockRepository.createAlert).not.toHaveBeenCalled();
      expect(result.alertsGenerated).toBe(0);
    });

    it('should categorize known SaaS applications correctly', async () => {
      const singleLog: shadowITRepository.TrafficLogEntry[] = [
        {
          timestamp: '2024-01-15T10:00:00Z',
          userId: 'user-1',
          sourceIp: '192.168.1.100',
          destinationDomain: 'github.com',
          destinationUrl: 'https://github.com/repo',
          bytesTransferred: 1024,
          protocol: 'HTTPS',
        },
      ];

      const githubDetection: shadowITRepository.ShadowITDetection = {
        ...mockDetection,
        applicationName: 'GitHub',
        applicationDomain: 'github.com',
        category: 'DEVELOPMENT',
        riskLevel: 'MEDIUM',
      };

      mockRepository.getApprovedApplications.mockResolvedValue([]);
      mockRepository.upsertDetection.mockResolvedValue(githubDetection);
      mockRepository.hasExistingAlert.mockResolvedValue(false);
      mockRepository.createAlert.mockResolvedValue({
        ...mockAlert,
        applicationName: 'GitHub',
        applicationDomain: 'github.com',
        riskLevel: 'MEDIUM',
      });

      const result = await shadowITService.analyzeShadowIT(singleLog);

      expect(result.shadowITDetected).toBe(1);
      expect(mockRepository.upsertDetection).toHaveBeenCalledWith(
        expect.objectContaining({
          applicationName: 'GitHub',
          applicationDomain: 'github.com',
          category: 'DEVELOPMENT',
        })
      );
    });

    it('should aggregate multiple accesses from same user', async () => {
      const multipleAccessLogs: shadowITRepository.TrafficLogEntry[] = [
        {
          timestamp: '2024-01-15T10:00:00Z',
          userId: 'user-1',
          sourceIp: '192.168.1.100',
          destinationDomain: 'dropbox.com',
          destinationUrl: 'https://dropbox.com/upload',
          bytesTransferred: 1000,
          protocol: 'HTTPS',
        },
        {
          timestamp: '2024-01-15T10:05:00Z',
          userId: 'user-1',
          sourceIp: '192.168.1.100',
          destinationDomain: 'dropbox.com',
          destinationUrl: 'https://dropbox.com/download',
          bytesTransferred: 2000,
          protocol: 'HTTPS',
        },
      ];

      mockRepository.getApprovedApplications.mockResolvedValue([]);
      mockRepository.upsertDetection.mockResolvedValue(mockDetection);
      mockRepository.hasExistingAlert.mockResolvedValue(false);
      mockRepository.createAlert.mockResolvedValue(mockAlert);

      await shadowITService.analyzeShadowIT(multipleAccessLogs);

      // Should create detection with aggregated data
      expect(mockRepository.upsertDetection).toHaveBeenCalledWith(
        expect.objectContaining({
          applicationDomain: 'dropbox.com',
          totalBytesTransferred: 3000,
          accessCount: 2,
          usersAffected: ['user-1'],
        })
      );
    });
  });

  describe('getDetections', () => {
    const mockDetections: shadowITRepository.ShadowITDetection[] = [
      {
        detectionId: 'detection-1',
        applicationName: 'Dropbox',
        applicationDomain: 'dropbox.com',
        category: 'FILE_SHARING',
        riskLevel: 'HIGH',
        usersAffected: ['user-1'],
        firstDetectedAt: '2024-01-15T10:00:00Z',
        lastSeenAt: '2024-01-15T10:00:00Z',
        totalBytesTransferred: 1024000,
        accessCount: 1,
        status: 'DETECTED',
        reviewedBy: null,
        reviewedAt: null,
        reviewNotes: null,
        knownApplicationId: null,
        createdAt: '2024-01-15T10:00:00Z',
        updatedAt: '2024-01-15T10:00:00Z',
      },
    ];

    it('should return all detections', async () => {
      mockRepository.getDetections.mockResolvedValue(mockDetections);

      const result = await shadowITService.getDetections();

      expect(result).toEqual(mockDetections);
      expect(mockRepository.getDetections).toHaveBeenCalledWith(undefined, 100);
    });

    it('should filter by status', async () => {
      mockRepository.getDetections.mockResolvedValue(mockDetections);

      await shadowITService.getDetections('DETECTED', 50);

      expect(mockRepository.getDetections).toHaveBeenCalledWith('DETECTED', 50);
    });
  });

  describe('updateDetectionStatus', () => {
    const mockDetection: shadowITRepository.ShadowITDetection = {
      detectionId: 'detection-1',
      applicationName: 'Dropbox',
      applicationDomain: 'dropbox.com',
      category: 'FILE_SHARING',
      riskLevel: 'HIGH',
      usersAffected: ['user-1'],
      firstDetectedAt: '2024-01-15T10:00:00Z',
      lastSeenAt: '2024-01-15T10:00:00Z',
      totalBytesTransferred: 1024000,
      accessCount: 1,
      status: 'APPROVED',
      reviewedBy: 'reviewer-1',
      reviewedAt: '2024-01-16T10:00:00Z',
      reviewNotes: 'Approved for business use',
      knownApplicationId: null,
      createdAt: '2024-01-15T10:00:00Z',
      updatedAt: '2024-01-16T10:00:00Z',
    };

    it('should update detection status to APPROVED', async () => {
      mockRepository.updateDetectionStatus.mockResolvedValue(mockDetection);

      const result = await shadowITService.updateDetectionStatus(
        'detection-1',
        'APPROVED',
        'reviewer-1',
        'Approved for business use'
      );

      expect(result.status).toBe('APPROVED');
      expect(result.reviewedBy).toBe('reviewer-1');
      expect(mockRepository.updateDetectionStatus).toHaveBeenCalledWith(
        'detection-1',
        'APPROVED',
        'reviewer-1',
        'Approved for business use'
      );
    });

    it('should update detection status to BLOCKED', async () => {
      const blockedDetection = { ...mockDetection, status: 'BLOCKED' as const };
      mockRepository.updateDetectionStatus.mockResolvedValue(blockedDetection);

      const result = await shadowITService.updateDetectionStatus(
        'detection-1',
        'BLOCKED',
        'reviewer-1',
        'Security risk - blocked'
      );

      expect(result.status).toBe('BLOCKED');
    });
  });

  describe('acknowledgeAlert', () => {
    const mockAlert: shadowITRepository.ShadowITAlert = {
      alertId: 'alert-1',
      detectionId: 'detection-1',
      applicationName: 'Dropbox',
      applicationDomain: 'dropbox.com',
      userId: 'user-1',
      userEmail: null,
      riskLevel: 'HIGH',
      accessCount: 1,
      bytesTransferred: 1024000,
      firstAccessAt: '2024-01-15T10:00:00Z',
      lastAccessAt: '2024-01-15T10:00:00Z',
      status: 'ACKNOWLEDGED',
      acknowledgedBy: 'admin-1',
      acknowledgedAt: '2024-01-16T10:00:00Z',
      resolvedBy: null,
      resolvedAt: null,
      notes: 'Investigating',
      createdAt: '2024-01-15T10:00:00Z',
      updatedAt: '2024-01-16T10:00:00Z',
    };

    it('should acknowledge alert', async () => {
      mockRepository.updateAlertStatus.mockResolvedValue(mockAlert);

      const result = await shadowITService.acknowledgeAlert(
        'alert-1',
        'admin-1',
        'Investigating'
      );

      expect(result.status).toBe('ACKNOWLEDGED');
      expect(result.acknowledgedBy).toBe('admin-1');
      expect(mockRepository.updateAlertStatus).toHaveBeenCalledWith(
        'alert-1',
        'ACKNOWLEDGED',
        'admin-1',
        'Investigating'
      );
    });
  });

  describe('resolveAlert', () => {
    const mockAlert: shadowITRepository.ShadowITAlert = {
      alertId: 'alert-1',
      detectionId: 'detection-1',
      applicationName: 'Dropbox',
      applicationDomain: 'dropbox.com',
      userId: 'user-1',
      userEmail: null,
      riskLevel: 'HIGH',
      accessCount: 1,
      bytesTransferred: 1024000,
      firstAccessAt: '2024-01-15T10:00:00Z',
      lastAccessAt: '2024-01-15T10:00:00Z',
      status: 'RESOLVED',
      acknowledgedBy: 'admin-1',
      acknowledgedAt: '2024-01-16T10:00:00Z',
      resolvedBy: 'admin-1',
      resolvedAt: '2024-01-17T10:00:00Z',
      notes: 'User educated about policy',
      createdAt: '2024-01-15T10:00:00Z',
      updatedAt: '2024-01-17T10:00:00Z',
    };

    it('should resolve alert', async () => {
      mockRepository.updateAlertStatus.mockResolvedValue(mockAlert);

      const result = await shadowITService.resolveAlert(
        'alert-1',
        'admin-1',
        'User educated about policy'
      );

      expect(result.status).toBe('RESOLVED');
      expect(result.resolvedBy).toBe('admin-1');
      expect(mockRepository.updateAlertStatus).toHaveBeenCalledWith(
        'alert-1',
        'RESOLVED',
        'admin-1',
        'User educated about policy'
      );
    });
  });

  describe('ignoreAlert', () => {
    const mockAlert: shadowITRepository.ShadowITAlert = {
      alertId: 'alert-1',
      detectionId: 'detection-1',
      applicationName: 'Dropbox',
      applicationDomain: 'dropbox.com',
      userId: 'user-1',
      userEmail: null,
      riskLevel: 'HIGH',
      accessCount: 1,
      bytesTransferred: 1024000,
      firstAccessAt: '2024-01-15T10:00:00Z',
      lastAccessAt: '2024-01-15T10:00:00Z',
      status: 'IGNORED',
      acknowledgedBy: null,
      acknowledgedAt: null,
      resolvedBy: null,
      resolvedAt: null,
      notes: 'False positive',
      createdAt: '2024-01-15T10:00:00Z',
      updatedAt: '2024-01-16T10:00:00Z',
    };

    it('should ignore alert', async () => {
      mockRepository.updateAlertStatus.mockResolvedValue(mockAlert);

      const result = await shadowITService.ignoreAlert(
        'alert-1',
        'admin-1',
        'False positive'
      );

      expect(result.status).toBe('IGNORED');
      expect(mockRepository.updateAlertStatus).toHaveBeenCalledWith(
        'alert-1',
        'IGNORED',
        'admin-1',
        'False positive'
      );
    });
  });

  describe('getShadowITSummary', () => {
    const mockSummary = {
      totalDetections: 10,
      byStatus: {
        DETECTED: 5,
        UNDER_REVIEW: 2,
        APPROVED: 2,
        BLOCKED: 1,
      },
      byRiskLevel: {
        LOW: 2,
        MEDIUM: 3,
        HIGH: 4,
        CRITICAL: 1,
      },
      byCategory: {
        FILE_SHARING: 3,
        COLLABORATION: 2,
        DEVELOPMENT: 2,
        SOCIAL_MEDIA: 3,
      },
      totalUsersAffected: 25,
      totalAlerts: 50,
      newAlerts: 15,
    };

    it('should return shadow IT summary statistics', async () => {
      mockRepository.getShadowITSummary.mockResolvedValue(mockSummary);

      const result = await shadowITService.getShadowITSummary();

      expect(result).toEqual(mockSummary);
      expect(result.totalDetections).toBe(10);
      expect(result.totalUsersAffected).toBe(25);
      expect(result.newAlerts).toBe(15);
    });
  });

  describe('getKnownApplications', () => {
    const mockApps: shadowITRepository.KnownApplication[] = [
      {
        applicationId: 'app-1',
        applicationName: 'Microsoft 365',
        domain: 'office.com',
        domainPatterns: ['%.office.com', '%.microsoft.com'],
        category: 'PRODUCTIVITY',
        vendor: 'Microsoft',
        isApproved: true,
        isBlocked: false,
        riskLevel: 'LOW',
        description: 'Corporate productivity suite',
        dataClassification: 'INTERNAL',
        complianceNotes: null,
        createdAt: '2024-01-01T00:00:00Z',
        updatedAt: '2024-01-01T00:00:00Z',
      },
    ];

    it('should return known applications', async () => {
      mockRepository.getKnownApplications.mockResolvedValue(mockApps);

      const result = await shadowITService.getKnownApplications();

      expect(result).toEqual(mockApps);
      expect(result).toHaveLength(1);
      expect(result[0]?.applicationName).toBe('Microsoft 365');
      expect(result[0]?.isApproved).toBe(true);
    });
  });

  describe('getApprovedApplications', () => {
    const mockApprovedApps: shadowITRepository.KnownApplication[] = [
      {
        applicationId: 'app-1',
        applicationName: 'Slack',
        domain: 'slack.com',
        domainPatterns: [],
        category: 'COLLABORATION',
        vendor: 'Salesforce',
        isApproved: true,
        isBlocked: false,
        riskLevel: 'LOW',
        description: 'Team communication',
        dataClassification: null,
        complianceNotes: null,
        createdAt: '2024-01-01T00:00:00Z',
        updatedAt: '2024-01-01T00:00:00Z',
      },
    ];

    it('should return only approved applications', async () => {
      mockRepository.getApprovedApplications.mockResolvedValue(mockApprovedApps);

      const result = await shadowITService.getApprovedApplications();

      expect(result).toEqual(mockApprovedApps);
      expect(result.every((app) => app.isApproved)).toBe(true);
    });
  });

  describe('getBlockedApplications', () => {
    const mockBlockedApps: shadowITRepository.KnownApplication[] = [
      {
        applicationId: 'app-2',
        applicationName: 'TikTok',
        domain: 'tiktok.com',
        domainPatterns: [],
        category: 'SOCIAL_MEDIA',
        vendor: 'ByteDance',
        isApproved: false,
        isBlocked: true,
        riskLevel: 'CRITICAL',
        description: 'Blocked due to security concerns',
        dataClassification: null,
        complianceNotes: 'Data sovereignty concerns',
        createdAt: '2024-01-01T00:00:00Z',
        updatedAt: '2024-01-01T00:00:00Z',
      },
    ];

    it('should return only blocked applications', async () => {
      mockRepository.getBlockedApplications.mockResolvedValue(mockBlockedApps);

      const result = await shadowITService.getBlockedApplications();

      expect(result).toEqual(mockBlockedApps);
      expect(result.every((app) => app.isBlocked)).toBe(true);
    });
  });
});
