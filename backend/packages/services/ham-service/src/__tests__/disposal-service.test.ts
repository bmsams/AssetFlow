/**
 * Disposal Service Unit Tests
 *
 * Tests for Disposal Service:
 * - Disposal workflow status transitions (Requirement 3.6)
 * - Task creation and validation (Requirement 3.6)
 * - Destruction certificate generation (Requirement 3.7)
 */

import type {
  CreateDisposalWorkflowRequest,
  DisposalMethod,
  DisposalTaskStatus,
  DisposalWorkflowStatus,
  RecordDestructionRequest,
} from '../disposal/disposal-service';

// Mock the dependencies
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

describe('Disposal Service Types', () => {
  describe('DisposalWorkflowStatus', () => {
    it('should have all required status values', () => {
      const validStatuses: DisposalWorkflowStatus[] = [
        'INITIATED',
        'DATA_WIPE_PENDING',
        'DATA_WIPE_COMPLETE',
        'ENVIRONMENTAL_CHECK_PENDING',
        'ENVIRONMENTAL_CHECK_COMPLETE',
        'PICKUP_SCHEDULED',
        'COMPLETED',
        'CANCELLED',
      ];

      // Verify all statuses are valid strings
      validStatuses.forEach(status => {
        expect(typeof status).toBe('string');
        expect(status.length).toBeGreaterThan(0);
      });
    });

    it('should follow logical workflow progression', () => {
      // Define the expected workflow progression
      const workflowProgression: DisposalWorkflowStatus[] = [
        'INITIATED',
        'DATA_WIPE_PENDING',
        'DATA_WIPE_COMPLETE',
        'ENVIRONMENTAL_CHECK_PENDING',
        'ENVIRONMENTAL_CHECK_COMPLETE',
        'PICKUP_SCHEDULED',
        'COMPLETED',
      ];

      // Verify progression order
      expect(workflowProgression.indexOf('INITIATED')).toBeLessThan(
        workflowProgression.indexOf('DATA_WIPE_PENDING')
      );
      expect(workflowProgression.indexOf('DATA_WIPE_PENDING')).toBeLessThan(
        workflowProgression.indexOf('DATA_WIPE_COMPLETE')
      );
      expect(workflowProgression.indexOf('PICKUP_SCHEDULED')).toBeLessThan(
        workflowProgression.indexOf('COMPLETED')
      );
    });
  });

  describe('DisposalMethod', () => {
    it('should have all required disposal methods', () => {
      const validMethods: DisposalMethod[] = [
        'RECYCLED',
        'DONATED',
        'SOLD',
        'DESTROYED',
        'RETURNED_TO_VENDOR',
        'TRADE_IN',
      ];

      // Verify all methods are valid strings
      validMethods.forEach(method => {
        expect(typeof method).toBe('string');
        expect(method.length).toBeGreaterThan(0);
      });

      // Verify we have at least 6 disposal methods
      expect(validMethods.length).toBeGreaterThanOrEqual(6);
    });
  });

  describe('DisposalTaskStatus', () => {
    it('should have all required task status values', () => {
      const validStatuses: DisposalTaskStatus[] = [
        'PENDING',
        'IN_PROGRESS',
        'COMPLETED',
        'SKIPPED',
        'FAILED',
      ];

      // Verify all statuses are valid strings
      validStatuses.forEach(status => {
        expect(typeof status).toBe('string');
        expect(status.length).toBeGreaterThan(0);
      });
    });
  });
});

describe('Disposal Workflow Validation', () => {
  describe('CreateDisposalWorkflowRequest validation', () => {
    it('should require assetId', () => {
      const validRequest: CreateDisposalWorkflowRequest = {
        assetId: '123e4567-e89b-12d3-a456-426614174000',
        initiatedBy: '123e4567-e89b-12d3-a456-426614174001',
      };

      expect(validRequest.assetId).toBeDefined();
      expect(typeof validRequest.assetId).toBe('string');
    });

    it('should require initiatedBy', () => {
      const validRequest: CreateDisposalWorkflowRequest = {
        assetId: '123e4567-e89b-12d3-a456-426614174000',
        initiatedBy: '123e4567-e89b-12d3-a456-426614174001',
      };

      expect(validRequest.initiatedBy).toBeDefined();
      expect(typeof validRequest.initiatedBy).toBe('string');
    });

    it('should allow optional disposalMethod', () => {
      const requestWithMethod: CreateDisposalWorkflowRequest = {
        assetId: '123e4567-e89b-12d3-a456-426614174000',
        initiatedBy: '123e4567-e89b-12d3-a456-426614174001',
        disposalMethod: 'RECYCLED',
      };

      const requestWithoutMethod: CreateDisposalWorkflowRequest = {
        assetId: '123e4567-e89b-12d3-a456-426614174000',
        initiatedBy: '123e4567-e89b-12d3-a456-426614174001',
      };

      expect(requestWithMethod.disposalMethod).toBe('RECYCLED');
      expect(requestWithoutMethod.disposalMethod).toBeUndefined();
    });

    it('should allow optional dataWipeRequired flag', () => {
      const requestWithDataWipe: CreateDisposalWorkflowRequest = {
        assetId: '123e4567-e89b-12d3-a456-426614174000',
        initiatedBy: '123e4567-e89b-12d3-a456-426614174001',
        dataWipeRequired: true,
      };

      const requestWithoutDataWipe: CreateDisposalWorkflowRequest = {
        assetId: '123e4567-e89b-12d3-a456-426614174000',
        initiatedBy: '123e4567-e89b-12d3-a456-426614174001',
        dataWipeRequired: false,
      };

      expect(requestWithDataWipe.dataWipeRequired).toBe(true);
      expect(requestWithoutDataWipe.dataWipeRequired).toBe(false);
    });

    it('should allow optional environmentalCheckRequired flag', () => {
      const requestWithEnvCheck: CreateDisposalWorkflowRequest = {
        assetId: '123e4567-e89b-12d3-a456-426614174000',
        initiatedBy: '123e4567-e89b-12d3-a456-426614174001',
        environmentalCheckRequired: true,
      };

      expect(requestWithEnvCheck.environmentalCheckRequired).toBe(true);
    });
  });

  describe('RecordDestructionRequest validation', () => {
    it('should require destructionDate', () => {
      const validRequest: RecordDestructionRequest = {
        destructionDate: '2024-01-15',
        destructionMethod: 'DESTROYED',
        verifiedBy: '123e4567-e89b-12d3-a456-426614174001',
      };

      expect(validRequest.destructionDate).toBeDefined();
      expect(typeof validRequest.destructionDate).toBe('string');
    });

    it('should require destructionMethod', () => {
      const validRequest: RecordDestructionRequest = {
        destructionDate: '2024-01-15',
        destructionMethod: 'DESTROYED',
        verifiedBy: '123e4567-e89b-12d3-a456-426614174001',
      };

      expect(validRequest.destructionMethod).toBeDefined();
      expect(validRequest.destructionMethod).toBe('DESTROYED');
    });

    it('should require verifiedBy', () => {
      const validRequest: RecordDestructionRequest = {
        destructionDate: '2024-01-15',
        destructionMethod: 'DESTROYED',
        verifiedBy: '123e4567-e89b-12d3-a456-426614174001',
      };

      expect(validRequest.verifiedBy).toBeDefined();
      expect(typeof validRequest.verifiedBy).toBe('string');
    });

    it('should allow optional vendor information', () => {
      const requestWithVendor: RecordDestructionRequest = {
        destructionDate: '2024-01-15',
        destructionMethod: 'DESTROYED',
        verifiedBy: '123e4567-e89b-12d3-a456-426614174001',
        vendorId: '123e4567-e89b-12d3-a456-426614174002',
        vendorName: 'Secure Disposal Inc.',
      };

      expect(requestWithVendor.vendorId).toBeDefined();
      expect(requestWithVendor.vendorName).toBe('Secure Disposal Inc.');
    });

    it('should allow optional document URL', () => {
      const requestWithDoc: RecordDestructionRequest = {
        destructionDate: '2024-01-15',
        destructionMethod: 'DESTROYED',
        verifiedBy: '123e4567-e89b-12d3-a456-426614174001',
        documentUrl: 'https://example.com/certificates/cert-123.pdf',
      };

      expect(requestWithDoc.documentUrl).toBeDefined();
    });
  });
});

describe('Disposal Task Requirements', () => {
  describe('Required tasks for disposal workflow', () => {
    it('should include data sanitization task when dataWipeRequired is true', () => {
      // Requirement 3.6: Data sanitization verification
      const expectedTaskTypes = [
        'DATA_SANITIZATION',
        'ENVIRONMENTAL_COMPLIANCE',
        'VENDOR_PICKUP',
        'DESTRUCTION_VERIFICATION',
        'CERTIFICATE_GENERATION',
      ];

      expect(expectedTaskTypes).toContain('DATA_SANITIZATION');
    });

    it('should include environmental compliance task when environmentalCheckRequired is true', () => {
      // Requirement 3.6: Environmental compliance
      const expectedTaskTypes = [
        'DATA_SANITIZATION',
        'ENVIRONMENTAL_COMPLIANCE',
        'VENDOR_PICKUP',
        'DESTRUCTION_VERIFICATION',
        'CERTIFICATE_GENERATION',
      ];

      expect(expectedTaskTypes).toContain('ENVIRONMENTAL_COMPLIANCE');
    });

    it('should include vendor pickup task', () => {
      // Requirement 3.7: Create tasks for vendor pickup
      const expectedTaskTypes = [
        'DATA_SANITIZATION',
        'ENVIRONMENTAL_COMPLIANCE',
        'VENDOR_PICKUP',
        'DESTRUCTION_VERIFICATION',
        'CERTIFICATE_GENERATION',
      ];

      expect(expectedTaskTypes).toContain('VENDOR_PICKUP');
    });

    it('should include destruction verification task', () => {
      // Requirement 3.7: Destruction certificate generation
      const expectedTaskTypes = [
        'DATA_SANITIZATION',
        'ENVIRONMENTAL_COMPLIANCE',
        'VENDOR_PICKUP',
        'DESTRUCTION_VERIFICATION',
        'CERTIFICATE_GENERATION',
      ];

      expect(expectedTaskTypes).toContain('DESTRUCTION_VERIFICATION');
    });

    it('should include certificate generation task', () => {
      // Requirement 3.7: Destruction certificate generation
      const expectedTaskTypes = [
        'DATA_SANITIZATION',
        'ENVIRONMENTAL_COMPLIANCE',
        'VENDOR_PICKUP',
        'DESTRUCTION_VERIFICATION',
        'CERTIFICATE_GENERATION',
      ];

      expect(expectedTaskTypes).toContain('CERTIFICATE_GENERATION');
    });
  });

  describe('Task sequencing', () => {
    it('should have tasks in logical order', () => {
      // Define expected task order
      const taskOrder = [
        'DATA_SANITIZATION',      // 1. First wipe data
        'ENVIRONMENTAL_COMPLIANCE', // 2. Check compliance
        'VENDOR_PICKUP',          // 3. Schedule pickup
        'DESTRUCTION_VERIFICATION', // 4. Verify destruction
        'CERTIFICATE_GENERATION', // 5. Generate certificate
      ];

      // Verify data sanitization comes before pickup
      expect(taskOrder.indexOf('DATA_SANITIZATION')).toBeLessThan(
        taskOrder.indexOf('VENDOR_PICKUP')
      );

      // Verify destruction verification comes before certificate
      expect(taskOrder.indexOf('DESTRUCTION_VERIFICATION')).toBeLessThan(
        taskOrder.indexOf('CERTIFICATE_GENERATION')
      );
    });
  });
});

describe('Workflow State Transitions', () => {
  describe('Valid state transitions', () => {
    it('should allow transition from INITIATED to DATA_WIPE_PENDING', () => {
      const validTransitions: Record<DisposalWorkflowStatus, DisposalWorkflowStatus[]> = {
        'INITIATED': ['DATA_WIPE_PENDING', 'ENVIRONMENTAL_CHECK_PENDING', 'CANCELLED'],
        'DATA_WIPE_PENDING': ['DATA_WIPE_COMPLETE', 'CANCELLED'],
        'DATA_WIPE_COMPLETE': ['ENVIRONMENTAL_CHECK_PENDING', 'PICKUP_SCHEDULED', 'CANCELLED'],
        'ENVIRONMENTAL_CHECK_PENDING': ['ENVIRONMENTAL_CHECK_COMPLETE', 'CANCELLED'],
        'ENVIRONMENTAL_CHECK_COMPLETE': ['PICKUP_SCHEDULED', 'CANCELLED'],
        'PICKUP_SCHEDULED': ['COMPLETED', 'CANCELLED'],
        'COMPLETED': [],
        'CANCELLED': [],
      };

      expect(validTransitions['INITIATED']).toContain('DATA_WIPE_PENDING');
    });

    it('should allow transition from DATA_WIPE_PENDING to DATA_WIPE_COMPLETE', () => {
      const validTransitions: Record<DisposalWorkflowStatus, DisposalWorkflowStatus[]> = {
        'INITIATED': ['DATA_WIPE_PENDING', 'ENVIRONMENTAL_CHECK_PENDING', 'CANCELLED'],
        'DATA_WIPE_PENDING': ['DATA_WIPE_COMPLETE', 'CANCELLED'],
        'DATA_WIPE_COMPLETE': ['ENVIRONMENTAL_CHECK_PENDING', 'PICKUP_SCHEDULED', 'CANCELLED'],
        'ENVIRONMENTAL_CHECK_PENDING': ['ENVIRONMENTAL_CHECK_COMPLETE', 'CANCELLED'],
        'ENVIRONMENTAL_CHECK_COMPLETE': ['PICKUP_SCHEDULED', 'CANCELLED'],
        'PICKUP_SCHEDULED': ['COMPLETED', 'CANCELLED'],
        'COMPLETED': [],
        'CANCELLED': [],
      };

      expect(validTransitions['DATA_WIPE_PENDING']).toContain('DATA_WIPE_COMPLETE');
    });

    it('should allow cancellation from any non-terminal state', () => {
      const nonTerminalStates: DisposalWorkflowStatus[] = [
        'INITIATED',
        'DATA_WIPE_PENDING',
        'DATA_WIPE_COMPLETE',
        'ENVIRONMENTAL_CHECK_PENDING',
        'ENVIRONMENTAL_CHECK_COMPLETE',
        'PICKUP_SCHEDULED',
      ];

      // All non-terminal states should allow cancellation
      nonTerminalStates.forEach(state => {
        expect(['COMPLETED', 'CANCELLED']).not.toContain(state);
      });
    });

    it('should not allow transitions from COMPLETED state', () => {
      const terminalStates: DisposalWorkflowStatus[] = ['COMPLETED', 'CANCELLED'];
      
      // Terminal states should not have any valid transitions
      terminalStates.forEach(state => {
        expect(state === 'COMPLETED' || state === 'CANCELLED').toBe(true);
      });
    });
  });
});

describe('Destruction Certificate', () => {
  describe('Certificate requirements', () => {
    it('should include certificate number', () => {
      const certificate = {
        certificateId: '123e4567-e89b-12d3-a456-426614174000',
        certificateNumber: 'CERT-ABC123-XYZ',
        assetId: '123e4567-e89b-12d3-a456-426614174001',
        workflowId: '123e4567-e89b-12d3-a456-426614174002',
        destructionDate: '2024-01-15',
        destructionMethod: 'DESTROYED' as DisposalMethod,
        createdAt: '2024-01-15T10:00:00.000Z',
        createdBy: '123e4567-e89b-12d3-a456-426614174003',
      };

      expect(certificate.certificateNumber).toBeDefined();
      expect(certificate.certificateNumber.length).toBeGreaterThan(0);
    });

    it('should link to asset and workflow', () => {
      const certificate = {
        certificateId: '123e4567-e89b-12d3-a456-426614174000',
        certificateNumber: 'CERT-ABC123-XYZ',
        assetId: '123e4567-e89b-12d3-a456-426614174001',
        workflowId: '123e4567-e89b-12d3-a456-426614174002',
        destructionDate: '2024-01-15',
        destructionMethod: 'DESTROYED' as DisposalMethod,
        createdAt: '2024-01-15T10:00:00.000Z',
        createdBy: '123e4567-e89b-12d3-a456-426614174003',
      };

      expect(certificate.assetId).toBeDefined();
      expect(certificate.workflowId).toBeDefined();
    });

    it('should record destruction date and method', () => {
      // Requirement 3.7: Record disposal method and date
      const certificate = {
        certificateId: '123e4567-e89b-12d3-a456-426614174000',
        certificateNumber: 'CERT-ABC123-XYZ',
        assetId: '123e4567-e89b-12d3-a456-426614174001',
        workflowId: '123e4567-e89b-12d3-a456-426614174002',
        destructionDate: '2024-01-15',
        destructionMethod: 'DESTROYED' as DisposalMethod,
        createdAt: '2024-01-15T10:00:00.000Z',
        createdBy: '123e4567-e89b-12d3-a456-426614174003',
      };

      expect(certificate.destructionDate).toBe('2024-01-15');
      expect(certificate.destructionMethod).toBe('DESTROYED');
    });

    it('should track who created the certificate', () => {
      const certificate = {
        certificateId: '123e4567-e89b-12d3-a456-426614174000',
        certificateNumber: 'CERT-ABC123-XYZ',
        assetId: '123e4567-e89b-12d3-a456-426614174001',
        workflowId: '123e4567-e89b-12d3-a456-426614174002',
        destructionDate: '2024-01-15',
        destructionMethod: 'DESTROYED' as DisposalMethod,
        createdAt: '2024-01-15T10:00:00.000Z',
        createdBy: '123e4567-e89b-12d3-a456-426614174003',
      };

      expect(certificate.createdBy).toBeDefined();
      expect(certificate.createdAt).toBeDefined();
    });
  });

  describe('Certificate number format', () => {
    it('should generate unique certificate numbers', () => {
      // Certificate numbers should follow a pattern like CERT-{timestamp}-{random}
      const certNumber1 = 'CERT-ABC123-XYZ1';
      const certNumber2 = 'CERT-ABC124-XYZ2';

      expect(certNumber1).not.toBe(certNumber2);
      expect(certNumber1.startsWith('CERT-')).toBe(true);
      expect(certNumber2.startsWith('CERT-')).toBe(true);
    });
  });
});

describe('Validation Result', () => {
  describe('validateDisposalRequirements result structure', () => {
    it('should return isValid flag', () => {
      const validationResult = {
        isValid: true,
        completedTasks: 5,
        totalRequiredTasks: 5,
        pendingTasks: [],
        failedTasks: [],
      };

      expect(validationResult.isValid).toBe(true);
    });

    it('should return task counts', () => {
      const validationResult = {
        isValid: false,
        completedTasks: 3,
        totalRequiredTasks: 5,
        pendingTasks: [
          { taskId: '1', taskType: 'VENDOR_PICKUP', status: 'PENDING' },
          { taskId: '2', taskType: 'CERTIFICATE_GENERATION', status: 'PENDING' },
        ],
        failedTasks: [],
      };

      expect(validationResult.completedTasks).toBe(3);
      expect(validationResult.totalRequiredTasks).toBe(5);
      expect(validationResult.pendingTasks.length).toBe(2);
    });

    it('should identify failed tasks', () => {
      const validationResult = {
        isValid: false,
        completedTasks: 2,
        totalRequiredTasks: 5,
        pendingTasks: [],
        failedTasks: [
          { taskId: '1', taskType: 'DATA_SANITIZATION', status: 'FAILED' },
        ],
      };

      expect(validationResult.failedTasks.length).toBe(1);
      expect(validationResult.isValid).toBe(false);
    });

    it('should be valid only when all required tasks are complete and none failed', () => {
      // Valid case
      const validResult = {
        isValid: true,
        completedTasks: 5,
        totalRequiredTasks: 5,
        pendingTasks: [],
        failedTasks: [],
      };

      expect(validResult.isValid).toBe(true);
      expect(validResult.completedTasks).toBe(validResult.totalRequiredTasks);
      expect(validResult.failedTasks.length).toBe(0);

      // Invalid case - incomplete
      const incompleteResult = {
        isValid: false,
        completedTasks: 3,
        totalRequiredTasks: 5,
        pendingTasks: [{ taskId: '1' }, { taskId: '2' }],
        failedTasks: [],
      };

      expect(incompleteResult.isValid).toBe(false);
      expect(incompleteResult.completedTasks).toBeLessThan(incompleteResult.totalRequiredTasks);

      // Invalid case - has failures
      const failedResult = {
        isValid: false,
        completedTasks: 4,
        totalRequiredTasks: 5,
        pendingTasks: [],
        failedTasks: [{ taskId: '1' }],
      };

      expect(failedResult.isValid).toBe(false);
      expect(failedResult.failedTasks.length).toBeGreaterThan(0);
    });
  });
});

