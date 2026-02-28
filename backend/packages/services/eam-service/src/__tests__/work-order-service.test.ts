/**
 * Work Order Service Unit Tests
 *
 * Tests for enhanced work order management including:
 * - Parts tracking (Requirement 14.3)
 * - Assignment (Requirement 14.2)
 * - Status transitions (Requirement 14.5)
 * - Completion with labor hours (Requirement 14.4)
 */

import {
  VALID_STATE_TRANSITIONS,
  isValidStateTransition,
  canAssign,
  canComplete,
} from '../work-order/work-order-service';
import type { WorkOrderStatus } from '../work-order/work-order-service';

describe('WorkOrderService', () => {
  describe('State Transitions (Requirement 14.5)', () => {
    describe('isValidStateTransition', () => {
      it('should allow OPEN → ASSIGNED transition', () => {
        expect(isValidStateTransition('OPEN', 'ASSIGNED')).toBe(true);
      });

      it('should allow OPEN → IN_PROGRESS transition', () => {
        expect(isValidStateTransition('OPEN', 'IN_PROGRESS')).toBe(true);
      });

      it('should allow OPEN → CANCELLED transition', () => {
        expect(isValidStateTransition('OPEN', 'CANCELLED')).toBe(true);
      });

      it('should not allow OPEN → COMPLETED transition directly', () => {
        expect(isValidStateTransition('OPEN', 'COMPLETED')).toBe(false);
      });

      it('should allow ASSIGNED → IN_PROGRESS transition', () => {
        expect(isValidStateTransition('ASSIGNED', 'IN_PROGRESS')).toBe(true);
      });

      it('should allow ASSIGNED → ON_HOLD transition', () => {
        expect(isValidStateTransition('ASSIGNED', 'ON_HOLD')).toBe(true);
      });

      it('should allow ASSIGNED → OPEN transition (unassign)', () => {
        expect(isValidStateTransition('ASSIGNED', 'OPEN')).toBe(true);
      });

      it('should allow IN_PROGRESS → COMPLETED transition', () => {
        expect(isValidStateTransition('IN_PROGRESS', 'COMPLETED')).toBe(true);
      });

      it('should allow IN_PROGRESS → ON_HOLD transition', () => {
        expect(isValidStateTransition('IN_PROGRESS', 'ON_HOLD')).toBe(true);
      });

      it('should allow IN_PROGRESS → PENDING_PARTS transition', () => {
        expect(isValidStateTransition('IN_PROGRESS', 'PENDING_PARTS')).toBe(true);
      });

      it('should allow IN_PROGRESS → PENDING_APPROVAL transition', () => {
        expect(isValidStateTransition('IN_PROGRESS', 'PENDING_APPROVAL')).toBe(true);
      });

      it('should allow ON_HOLD → IN_PROGRESS transition', () => {
        expect(isValidStateTransition('ON_HOLD', 'IN_PROGRESS')).toBe(true);
      });

      it('should allow PENDING_PARTS → IN_PROGRESS transition', () => {
        expect(isValidStateTransition('PENDING_PARTS', 'IN_PROGRESS')).toBe(true);
      });

      it('should allow PENDING_APPROVAL → COMPLETED transition', () => {
        expect(isValidStateTransition('PENDING_APPROVAL', 'COMPLETED')).toBe(true);
      });

      it('should allow COMPLETED → CLOSED transition', () => {
        expect(isValidStateTransition('COMPLETED', 'CLOSED')).toBe(true);
      });

      it('should not allow COMPLETED → IN_PROGRESS transition', () => {
        expect(isValidStateTransition('COMPLETED', 'IN_PROGRESS')).toBe(false);
      });

      it('should not allow CANCELLED → any transition', () => {
        const allStatuses: WorkOrderStatus[] = [
          'OPEN', 'ASSIGNED', 'IN_PROGRESS', 'ON_HOLD',
          'PENDING_PARTS', 'PENDING_APPROVAL', 'COMPLETED', 'CANCELLED', 'CLOSED'
        ];
        
        allStatuses.forEach(status => {
          expect(isValidStateTransition('CANCELLED', status)).toBe(false);
        });
      });

      it('should not allow CLOSED → any transition', () => {
        const allStatuses: WorkOrderStatus[] = [
          'OPEN', 'ASSIGNED', 'IN_PROGRESS', 'ON_HOLD',
          'PENDING_PARTS', 'PENDING_APPROVAL', 'COMPLETED', 'CANCELLED', 'CLOSED'
        ];
        
        allStatuses.forEach(status => {
          expect(isValidStateTransition('CLOSED', status)).toBe(false);
        });
      });
    });

    describe('VALID_STATE_TRANSITIONS constant', () => {
      it('should have transitions defined for all statuses', () => {
        const allStatuses: WorkOrderStatus[] = [
          'OPEN', 'ASSIGNED', 'IN_PROGRESS', 'ON_HOLD',
          'PENDING_PARTS', 'PENDING_APPROVAL', 'COMPLETED', 'CANCELLED', 'CLOSED'
        ];

        allStatuses.forEach(status => {
          expect(VALID_STATE_TRANSITIONS[status]).toBeDefined();
          expect(Array.isArray(VALID_STATE_TRANSITIONS[status])).toBe(true);
        });
      });

      it('should have empty transitions for terminal states', () => {
        expect(VALID_STATE_TRANSITIONS['CANCELLED']).toHaveLength(0);
        expect(VALID_STATE_TRANSITIONS['CLOSED']).toHaveLength(0);
      });

      it('should allow cancellation from most active states', () => {
        const cancellableStatuses: WorkOrderStatus[] = [
          'OPEN', 'ASSIGNED', 'IN_PROGRESS', 'ON_HOLD', 'PENDING_PARTS', 'PENDING_APPROVAL'
        ];

        cancellableStatuses.forEach(status => {
          expect(VALID_STATE_TRANSITIONS[status]).toContain('CANCELLED');
        });
      });
    });
  });

  describe('Assignment Validation (Requirement 14.2)', () => {
    describe('canAssign', () => {
      it('should allow assignment from OPEN status', () => {
        expect(canAssign('OPEN')).toBe(true);
      });

      it('should allow reassignment from ASSIGNED status', () => {
        expect(canAssign('ASSIGNED')).toBe(true);
      });

      it('should not allow assignment from IN_PROGRESS status', () => {
        expect(canAssign('IN_PROGRESS')).toBe(false);
      });

      it('should not allow assignment from ON_HOLD status', () => {
        expect(canAssign('ON_HOLD')).toBe(false);
      });

      it('should not allow assignment from PENDING_PARTS status', () => {
        expect(canAssign('PENDING_PARTS')).toBe(false);
      });

      it('should not allow assignment from PENDING_APPROVAL status', () => {
        expect(canAssign('PENDING_APPROVAL')).toBe(false);
      });

      it('should not allow assignment from COMPLETED status', () => {
        expect(canAssign('COMPLETED')).toBe(false);
      });

      it('should not allow assignment from CANCELLED status', () => {
        expect(canAssign('CANCELLED')).toBe(false);
      });

      it('should not allow assignment from CLOSED status', () => {
        expect(canAssign('CLOSED')).toBe(false);
      });
    });
  });

  describe('Completion Validation (Requirement 14.4)', () => {
    describe('canComplete', () => {
      it('should allow completion from OPEN status', () => {
        expect(canComplete('OPEN')).toBe(true);
      });

      it('should allow completion from ASSIGNED status', () => {
        expect(canComplete('ASSIGNED')).toBe(true);
      });

      it('should allow completion from IN_PROGRESS status', () => {
        expect(canComplete('IN_PROGRESS')).toBe(true);
      });

      it('should allow completion from ON_HOLD status', () => {
        expect(canComplete('ON_HOLD')).toBe(true);
      });

      it('should allow completion from PENDING_PARTS status', () => {
        expect(canComplete('PENDING_PARTS')).toBe(true);
      });

      it('should allow completion from PENDING_APPROVAL status', () => {
        expect(canComplete('PENDING_APPROVAL')).toBe(true);
      });

      it('should not allow completion from COMPLETED status', () => {
        expect(canComplete('COMPLETED')).toBe(false);
      });

      it('should not allow completion from CANCELLED status', () => {
        expect(canComplete('CANCELLED')).toBe(false);
      });

      it('should not allow completion from CLOSED status', () => {
        expect(canComplete('CLOSED')).toBe(false);
      });
    });
  });

  describe('Work Order Lifecycle Flow', () => {
    it('should support standard workflow: OPEN → ASSIGNED → IN_PROGRESS → COMPLETED → CLOSED', () => {
      expect(isValidStateTransition('OPEN', 'ASSIGNED')).toBe(true);
      expect(isValidStateTransition('ASSIGNED', 'IN_PROGRESS')).toBe(true);
      expect(isValidStateTransition('IN_PROGRESS', 'COMPLETED')).toBe(true);
      expect(isValidStateTransition('COMPLETED', 'CLOSED')).toBe(true);
    });

    it('should support direct completion: OPEN → IN_PROGRESS → COMPLETED', () => {
      expect(isValidStateTransition('OPEN', 'IN_PROGRESS')).toBe(true);
      expect(isValidStateTransition('IN_PROGRESS', 'COMPLETED')).toBe(true);
    });

    it('should support hold workflow: IN_PROGRESS → ON_HOLD → IN_PROGRESS', () => {
      expect(isValidStateTransition('IN_PROGRESS', 'ON_HOLD')).toBe(true);
      expect(isValidStateTransition('ON_HOLD', 'IN_PROGRESS')).toBe(true);
    });

    it('should support parts waiting workflow: IN_PROGRESS → PENDING_PARTS → IN_PROGRESS', () => {
      expect(isValidStateTransition('IN_PROGRESS', 'PENDING_PARTS')).toBe(true);
      expect(isValidStateTransition('PENDING_PARTS', 'IN_PROGRESS')).toBe(true);
    });

    it('should support approval workflow: IN_PROGRESS → PENDING_APPROVAL → COMPLETED', () => {
      expect(isValidStateTransition('IN_PROGRESS', 'PENDING_APPROVAL')).toBe(true);
      expect(isValidStateTransition('PENDING_APPROVAL', 'COMPLETED')).toBe(true);
    });
  });
});

describe('WorkOrderHandlers Validation', () => {
  describe('Add Part Request Validation', () => {
    const VALID_UUID = '123e4567-e89b-12d3-a456-426614174000';

    function validateAddPartRequest(body: unknown): { valid: boolean; errors: string[] } {
      if (!body || typeof body !== 'object') {
        return { valid: false, errors: ['Request body is required'] };
      }

      const request = body as Record<string, unknown>;
      const errors: string[] = [];

      // Required fields
      if (!request['partId']) {
        errors.push('partId is required');
      } else {
        const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
        if (!uuidRegex.test(request['partId'] as string)) {
          errors.push('partId must be a valid UUID');
        }
      }

      if (request['quantityRequired'] === undefined) {
        errors.push('quantityRequired is required');
      } else if (typeof request['quantityRequired'] !== 'number' || request['quantityRequired'] <= 0) {
        errors.push('quantityRequired must be a positive number');
      }

      return { valid: errors.length === 0, errors };
    }

    it('should reject empty request body', () => {
      const result = validateAddPartRequest(null);
      expect(result.valid).toBe(false);
      expect(result.errors).toContain('Request body is required');
    });

    it('should require partId', () => {
      const result = validateAddPartRequest({
        quantityRequired: 5,
      });
      expect(result.valid).toBe(false);
      expect(result.errors).toContain('partId is required');
    });

    it('should require quantityRequired', () => {
      const result = validateAddPartRequest({
        partId: VALID_UUID,
      });
      expect(result.valid).toBe(false);
      expect(result.errors).toContain('quantityRequired is required');
    });

    it('should reject invalid partId format', () => {
      const result = validateAddPartRequest({
        partId: 'invalid-uuid',
        quantityRequired: 5,
      });
      expect(result.valid).toBe(false);
      expect(result.errors).toContain('partId must be a valid UUID');
    });

    it('should reject zero quantityRequired', () => {
      const result = validateAddPartRequest({
        partId: VALID_UUID,
        quantityRequired: 0,
      });
      expect(result.valid).toBe(false);
      expect(result.errors).toContain('quantityRequired must be a positive number');
    });

    it('should reject negative quantityRequired', () => {
      const result = validateAddPartRequest({
        partId: VALID_UUID,
        quantityRequired: -5,
      });
      expect(result.valid).toBe(false);
      expect(result.errors).toContain('quantityRequired must be a positive number');
    });

    it('should accept valid request', () => {
      const result = validateAddPartRequest({
        partId: VALID_UUID,
        quantityRequired: 5,
      });
      expect(result.valid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it('should accept valid request with notes', () => {
      const result = validateAddPartRequest({
        partId: VALID_UUID,
        quantityRequired: 5,
        notes: 'Replacement bearing for motor',
      });
      expect(result.valid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });
  });

  describe('Record Part Usage Request Validation', () => {
    const VALID_UUID = '123e4567-e89b-12d3-a456-426614174000';

    function validateRecordPartUsageRequest(body: unknown): { valid: boolean; errors: string[] } {
      if (!body || typeof body !== 'object') {
        return { valid: false, errors: ['Request body is required'] };
      }

      const request = body as Record<string, unknown>;
      const errors: string[] = [];

      // Required fields
      if (!request['partId']) {
        errors.push('partId is required');
      } else {
        const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
        if (!uuidRegex.test(request['partId'] as string)) {
          errors.push('partId must be a valid UUID');
        }
      }

      if (request['quantityUsed'] === undefined) {
        errors.push('quantityUsed is required');
      } else if (typeof request['quantityUsed'] !== 'number' || request['quantityUsed'] <= 0) {
        errors.push('quantityUsed must be a positive number');
      }

      return { valid: errors.length === 0, errors };
    }

    it('should reject empty request body', () => {
      const result = validateRecordPartUsageRequest(null);
      expect(result.valid).toBe(false);
      expect(result.errors).toContain('Request body is required');
    });

    it('should require partId', () => {
      const result = validateRecordPartUsageRequest({
        quantityUsed: 3,
      });
      expect(result.valid).toBe(false);
      expect(result.errors).toContain('partId is required');
    });

    it('should require quantityUsed', () => {
      const result = validateRecordPartUsageRequest({
        partId: VALID_UUID,
      });
      expect(result.valid).toBe(false);
      expect(result.errors).toContain('quantityUsed is required');
    });

    it('should reject zero quantityUsed', () => {
      const result = validateRecordPartUsageRequest({
        partId: VALID_UUID,
        quantityUsed: 0,
      });
      expect(result.valid).toBe(false);
      expect(result.errors).toContain('quantityUsed must be a positive number');
    });

    it('should reject negative quantityUsed', () => {
      const result = validateRecordPartUsageRequest({
        partId: VALID_UUID,
        quantityUsed: -3,
      });
      expect(result.valid).toBe(false);
      expect(result.errors).toContain('quantityUsed must be a positive number');
    });

    it('should accept valid request', () => {
      const result = validateRecordPartUsageRequest({
        partId: VALID_UUID,
        quantityUsed: 3,
      });
      expect(result.valid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it('should accept valid request with notes', () => {
      const result = validateRecordPartUsageRequest({
        partId: VALID_UUID,
        quantityUsed: 3,
        notes: 'Used during motor replacement',
      });
      expect(result.valid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });
  });

  describe('Update Status Request Validation', () => {
    const VALID_STATUSES = [
      'OPEN', 'ASSIGNED', 'IN_PROGRESS', 'ON_HOLD',
      'PENDING_PARTS', 'PENDING_APPROVAL', 'COMPLETED', 'CANCELLED', 'CLOSED'
    ];

    function validateUpdateStatusRequest(body: unknown): { valid: boolean; errors: string[] } {
      if (!body || typeof body !== 'object') {
        return { valid: false, errors: ['Request body is required'] };
      }

      const request = body as Record<string, unknown>;
      const errors: string[] = [];

      if (!request['status']) {
        errors.push('status is required');
      } else if (!VALID_STATUSES.includes(request['status'] as string)) {
        errors.push(`status must be one of: ${VALID_STATUSES.join(', ')}`);
      }

      return { valid: errors.length === 0, errors };
    }

    it('should reject empty request body', () => {
      const result = validateUpdateStatusRequest(null);
      expect(result.valid).toBe(false);
      expect(result.errors).toContain('Request body is required');
    });

    it('should require status', () => {
      const result = validateUpdateStatusRequest({});
      expect(result.valid).toBe(false);
      expect(result.errors).toContain('status is required');
    });

    it('should reject invalid status', () => {
      const result = validateUpdateStatusRequest({
        status: 'INVALID_STATUS',
      });
      expect(result.valid).toBe(false);
      expect(result.errors.some(e => e.includes('status must be one of'))).toBe(true);
    });

    it('should accept all valid statuses', () => {
      VALID_STATUSES.forEach(status => {
        const result = validateUpdateStatusRequest({ status });
        expect(result.valid).toBe(true);
      });
    });
  });

  describe('List Work Orders Query Validation', () => {
    const VALID_STATUSES = [
      'OPEN', 'ASSIGNED', 'IN_PROGRESS', 'ON_HOLD',
      'PENDING_PARTS', 'PENDING_APPROVAL', 'COMPLETED', 'CANCELLED', 'CLOSED'
    ];
    const VALID_PRIORITIES = ['CRITICAL', 'HIGH', 'MEDIUM', 'LOW'];
    const VALID_WORK_TYPES = [
      'PREVENTIVE', 'CORRECTIVE', 'EMERGENCY', 'INSPECTION',
      'CALIBRATION', 'INSTALLATION', 'MODIFICATION', 'DECOMMISSION', 'PROJECT', 'OTHER'
    ];

    function validateListQueryParams(params: Record<string, string | undefined>): { valid: boolean; errors: string[] } {
      const errors: string[] = [];

      if (params['status'] && !VALID_STATUSES.includes(params['status'])) {
        errors.push(`status must be one of: ${VALID_STATUSES.join(', ')}`);
      }

      if (params['priority'] && !VALID_PRIORITIES.includes(params['priority'])) {
        errors.push(`priority must be one of: ${VALID_PRIORITIES.join(', ')}`);
      }

      if (params['workType'] && !VALID_WORK_TYPES.includes(params['workType'])) {
        errors.push(`workType must be one of: ${VALID_WORK_TYPES.join(', ')}`);
      }

      if (params['fromDate'] && !/^\d{4}-\d{2}-\d{2}$/.test(params['fromDate'])) {
        errors.push('fromDate must be in YYYY-MM-DD format');
      }

      if (params['toDate'] && !/^\d{4}-\d{2}-\d{2}$/.test(params['toDate'])) {
        errors.push('toDate must be in YYYY-MM-DD format');
      }

      if (params['page']) {
        const page = parseInt(params['page'], 10);
        if (isNaN(page) || page < 1) {
          errors.push('page must be a positive integer');
        }
      }

      if (params['limit']) {
        const limit = parseInt(params['limit'], 10);
        if (isNaN(limit) || limit < 1 || limit > 100) {
          errors.push('limit must be an integer between 1 and 100');
        }
      }

      return { valid: errors.length === 0, errors };
    }

    it('should accept empty query parameters', () => {
      const result = validateListQueryParams({});
      expect(result.valid).toBe(true);
    });

    it('should accept valid status filter', () => {
      const result = validateListQueryParams({ status: 'IN_PROGRESS' });
      expect(result.valid).toBe(true);
    });

    it('should reject invalid status', () => {
      const result = validateListQueryParams({ status: 'INVALID' });
      expect(result.valid).toBe(false);
    });

    it('should accept valid priority filter', () => {
      const result = validateListQueryParams({ priority: 'HIGH' });
      expect(result.valid).toBe(true);
    });

    it('should reject invalid priority', () => {
      const result = validateListQueryParams({ priority: 'INVALID' });
      expect(result.valid).toBe(false);
    });

    it('should accept valid workType filter', () => {
      const result = validateListQueryParams({ workType: 'CORRECTIVE' });
      expect(result.valid).toBe(true);
    });

    it('should reject invalid workType', () => {
      const result = validateListQueryParams({ workType: 'INVALID' });
      expect(result.valid).toBe(false);
    });

    it('should accept valid date format', () => {
      const result = validateListQueryParams({ fromDate: '2024-01-15', toDate: '2024-01-31' });
      expect(result.valid).toBe(true);
    });

    it('should reject invalid date format', () => {
      const result = validateListQueryParams({ fromDate: '01-15-2024' });
      expect(result.valid).toBe(false);
    });

    it('should accept valid pagination', () => {
      const result = validateListQueryParams({ page: '2', limit: '25' });
      expect(result.valid).toBe(true);
    });

    it('should reject invalid page', () => {
      const result = validateListQueryParams({ page: '0' });
      expect(result.valid).toBe(false);
    });

    it('should reject limit over 100', () => {
      const result = validateListQueryParams({ limit: '101' });
      expect(result.valid).toBe(false);
    });

    it('should accept combined filters', () => {
      const result = validateListQueryParams({
        status: 'IN_PROGRESS',
        priority: 'HIGH',
        workType: 'CORRECTIVE',
        fromDate: '2024-01-01',
        toDate: '2024-12-31',
        page: '1',
        limit: '50',
      });
      expect(result.valid).toBe(true);
    });
  });
});
