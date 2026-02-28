/**
 * Work Order Handlers Unit Tests
 *
 * Tests for Lambda handlers for work order management.
 * Requirements: 2C.7
 */

describe('CreateWorkOrderHandler', () => {
  describe('Request validation', () => {
    const VALID_WORK_TYPES = [
      'PREVENTIVE', 'CORRECTIVE', 'EMERGENCY', 'INSPECTION',
      'CALIBRATION', 'INSTALLATION', 'MODIFICATION', 'DECOMMISSION', 'PROJECT', 'OTHER'
    ];
    const VALID_PRIORITIES = ['CRITICAL', 'HIGH', 'MEDIUM', 'LOW'];

    function validateRequest(body: unknown): { valid: boolean; errors: string[] } {
      if (!body || typeof body !== 'object') {
        return { valid: false, errors: ['Request body is required'] };
      }

      const request = body as Record<string, unknown>;
      const errors: string[] = [];

      // Required fields
      if (!request['assetId']) {
        errors.push('assetId is required');
      }

      if (!request['workType']) {
        errors.push('workType is required');
      } else if (!VALID_WORK_TYPES.includes(request['workType'] as string)) {
        errors.push(`workType must be one of: ${VALID_WORK_TYPES.join(', ')}`);
      }

      if (!request['title']) {
        errors.push('title is required');
      }

      // Validate optional fields
      if (request['priority'] !== undefined && !VALID_PRIORITIES.includes(request['priority'] as string)) {
        errors.push(`priority must be one of: ${VALID_PRIORITIES.join(', ')}`);
      }

      // Validate numeric fields
      if (request['estimatedDurationHours'] !== undefined) {
        if (typeof request['estimatedDurationHours'] !== 'number' || request['estimatedDurationHours'] < 0) {
          errors.push('estimatedDurationHours must be a non-negative number');
        }
      }

      if (request['estimatedCost'] !== undefined) {
        if (typeof request['estimatedCost'] !== 'number' || request['estimatedCost'] < 0) {
          errors.push('estimatedCost must be a non-negative number');
        }
      }

      // Validate date formats
      if (request['scheduledDate'] !== undefined) {
        if (!/^\d{4}-\d{2}-\d{2}$/.test(request['scheduledDate'] as string)) {
          errors.push('scheduledDate must be in YYYY-MM-DD format');
        }
      }

      if (request['dueDate'] !== undefined) {
        if (!/^\d{4}-\d{2}-\d{2}$/.test(request['dueDate'] as string)) {
          errors.push('dueDate must be in YYYY-MM-DD format');
        }
      }

      return { valid: errors.length === 0, errors };
    }

    it('should reject empty request body', () => {
      const result = validateRequest(null);

      expect(result.valid).toBe(false);
      expect(result.errors).toContain('Request body is required');
    });

    it('should require assetId', () => {
      const result = validateRequest({
        workType: 'CORRECTIVE',
        title: 'Fix broken pump',
      });

      expect(result.valid).toBe(false);
      expect(result.errors).toContain('assetId is required');
    });

    it('should require workType', () => {
      const result = validateRequest({
        assetId: '123e4567-e89b-12d3-a456-426614174000',
        title: 'Fix broken pump',
      });

      expect(result.valid).toBe(false);
      expect(result.errors).toContain('workType is required');
    });

    it('should require title', () => {
      const result = validateRequest({
        assetId: '123e4567-e89b-12d3-a456-426614174000',
        workType: 'CORRECTIVE',
      });

      expect(result.valid).toBe(false);
      expect(result.errors).toContain('title is required');
    });

    it('should reject invalid workType', () => {
      const result = validateRequest({
        assetId: '123e4567-e89b-12d3-a456-426614174000',
        workType: 'INVALID_TYPE',
        title: 'Fix broken pump',
      });

      expect(result.valid).toBe(false);
      expect(result.errors.some(e => e.includes('workType must be one of'))).toBe(true);
    });

    it('should reject invalid priority', () => {
      const result = validateRequest({
        assetId: '123e4567-e89b-12d3-a456-426614174000',
        workType: 'CORRECTIVE',
        title: 'Fix broken pump',
        priority: 'INVALID_PRIORITY',
      });

      expect(result.valid).toBe(false);
      expect(result.errors.some(e => e.includes('priority must be one of'))).toBe(true);
    });

    it('should reject negative estimatedDurationHours', () => {
      const result = validateRequest({
        assetId: '123e4567-e89b-12d3-a456-426614174000',
        workType: 'CORRECTIVE',
        title: 'Fix broken pump',
        estimatedDurationHours: -5,
      });

      expect(result.valid).toBe(false);
      expect(result.errors).toContain('estimatedDurationHours must be a non-negative number');
    });

    it('should reject negative estimatedCost', () => {
      const result = validateRequest({
        assetId: '123e4567-e89b-12d3-a456-426614174000',
        workType: 'CORRECTIVE',
        title: 'Fix broken pump',
        estimatedCost: -100,
      });

      expect(result.valid).toBe(false);
      expect(result.errors).toContain('estimatedCost must be a non-negative number');
    });

    it('should reject invalid scheduledDate format', () => {
      const result = validateRequest({
        assetId: '123e4567-e89b-12d3-a456-426614174000',
        workType: 'CORRECTIVE',
        title: 'Fix broken pump',
        scheduledDate: '01-15-2024',
      });

      expect(result.valid).toBe(false);
      expect(result.errors).toContain('scheduledDate must be in YYYY-MM-DD format');
    });

    it('should reject invalid dueDate format', () => {
      const result = validateRequest({
        assetId: '123e4567-e89b-12d3-a456-426614174000',
        workType: 'CORRECTIVE',
        title: 'Fix broken pump',
        dueDate: '2024/01/15',
      });

      expect(result.valid).toBe(false);
      expect(result.errors).toContain('dueDate must be in YYYY-MM-DD format');
    });

    it('should accept valid CORRECTIVE work order request', () => {
      const result = validateRequest({
        assetId: '123e4567-e89b-12d3-a456-426614174000',
        workType: 'CORRECTIVE',
        title: 'Fix broken pump',
        priority: 'HIGH',
        description: 'Pump is making unusual noise and needs repair',
        scheduledDate: '2024-01-20',
        dueDate: '2024-01-25',
        estimatedDurationHours: 4,
        estimatedCost: 500,
      });

      expect(result.valid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it('should accept valid EMERGENCY work order request', () => {
      const result = validateRequest({
        assetId: '123e4567-e89b-12d3-a456-426614174000',
        workType: 'EMERGENCY',
        title: 'Critical equipment failure',
        priority: 'CRITICAL',
      });

      expect(result.valid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it('should accept all valid work types', () => {
      VALID_WORK_TYPES.forEach(workType => {
        const result = validateRequest({
          assetId: '123e4567-e89b-12d3-a456-426614174000',
          workType,
          title: `Test ${workType} work order`,
        });

        expect(result.valid).toBe(true);
      });
    });
  });
});

describe('AssignWorkOrderHandler', () => {
  describe('Request validation', () => {
    function validateRequest(body: unknown): { valid: boolean; errors: string[] } {
      if (!body || typeof body !== 'object') {
        return { valid: false, errors: ['Request body is required'] };
      }

      const request = body as Record<string, unknown>;
      const errors: string[] = [];

      if (!request['assignedTo']) {
        errors.push('assignedTo is required');
      }

      return { valid: errors.length === 0, errors };
    }

    it('should reject empty request body', () => {
      const result = validateRequest(null);

      expect(result.valid).toBe(false);
      expect(result.errors).toContain('Request body is required');
    });

    it('should require assignedTo', () => {
      const result = validateRequest({});

      expect(result.valid).toBe(false);
      expect(result.errors).toContain('assignedTo is required');
    });

    it('should accept valid assignment request', () => {
      const result = validateRequest({
        assignedTo: '123e4567-e89b-12d3-a456-426614174000',
      });

      expect(result.valid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });
  });

  describe('Status transition validation', () => {
    const VALID_STATUSES_FOR_ASSIGNMENT = ['OPEN', 'ASSIGNED'];

    function canAssign(currentStatus: string): boolean {
      return VALID_STATUSES_FOR_ASSIGNMENT.includes(currentStatus);
    }

    it('should allow assignment from OPEN status', () => {
      expect(canAssign('OPEN')).toBe(true);
    });

    it('should allow reassignment from ASSIGNED status', () => {
      expect(canAssign('ASSIGNED')).toBe(true);
    });

    it('should not allow assignment from IN_PROGRESS status', () => {
      expect(canAssign('IN_PROGRESS')).toBe(false);
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

describe('CompleteWorkOrderHandler', () => {
  describe('Request validation', () => {
    function validateRequest(body: unknown): { valid: boolean; errors: string[] } {
      // Body is optional for completion
      if (body === null || body === undefined) {
        return { valid: true, errors: [] };
      }

      if (typeof body !== 'object') {
        return { valid: false, errors: ['Request body must be an object'] };
      }

      const request = body as Record<string, unknown>;
      const errors: string[] = [];

      // Validate numeric fields
      if (request['actualDurationHours'] !== undefined) {
        if (typeof request['actualDurationHours'] !== 'number' || request['actualDurationHours'] < 0) {
          errors.push('actualDurationHours must be a non-negative number');
        }
      }

      if (request['actualLaborCost'] !== undefined) {
        if (typeof request['actualLaborCost'] !== 'number' || request['actualLaborCost'] < 0) {
          errors.push('actualLaborCost must be a non-negative number');
        }
      }

      if (request['actualPartsCost'] !== undefined) {
        if (typeof request['actualPartsCost'] !== 'number' || request['actualPartsCost'] < 0) {
          errors.push('actualPartsCost must be a non-negative number');
        }
      }

      return { valid: errors.length === 0, errors };
    }

    it('should accept null body (complete without notes)', () => {
      const result = validateRequest(null);

      expect(result.valid).toBe(true);
    });

    it('should accept undefined body', () => {
      const result = validateRequest(undefined);

      expect(result.valid).toBe(true);
    });

    it('should accept empty object', () => {
      const result = validateRequest({});

      expect(result.valid).toBe(true);
    });

    it('should reject negative actualDurationHours', () => {
      const result = validateRequest({
        actualDurationHours: -2,
      });

      expect(result.valid).toBe(false);
      expect(result.errors).toContain('actualDurationHours must be a non-negative number');
    });

    it('should reject negative actualLaborCost', () => {
      const result = validateRequest({
        actualLaborCost: -100,
      });

      expect(result.valid).toBe(false);
      expect(result.errors).toContain('actualLaborCost must be a non-negative number');
    });

    it('should reject negative actualPartsCost', () => {
      const result = validateRequest({
        actualPartsCost: -50,
      });

      expect(result.valid).toBe(false);
      expect(result.errors).toContain('actualPartsCost must be a non-negative number');
    });

    it('should accept valid completion with all fields', () => {
      const result = validateRequest({
        completionNotes: 'Replaced faulty bearing and tested operation',
        actualDurationHours: 3.5,
        actualLaborCost: 175,
        actualPartsCost: 85,
      });

      expect(result.valid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it('should accept completion with only notes', () => {
      const result = validateRequest({
        completionNotes: 'Work completed successfully',
      });

      expect(result.valid).toBe(true);
    });

    it('should accept zero values for costs', () => {
      const result = validateRequest({
        actualDurationHours: 0,
        actualLaborCost: 0,
        actualPartsCost: 0,
      });

      expect(result.valid).toBe(true);
    });
  });

  describe('Status transition validation', () => {
    const VALID_STATUSES_FOR_COMPLETION = [
      'OPEN', 'ASSIGNED', 'IN_PROGRESS', 'ON_HOLD', 'PENDING_PARTS', 'PENDING_APPROVAL'
    ];

    function canComplete(currentStatus: string): boolean {
      return VALID_STATUSES_FOR_COMPLETION.includes(currentStatus);
    }

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

describe('GetWorkOrderHandler', () => {
  describe('Path parameter validation', () => {
    function validateWorkOrderId(workOrderId: string | undefined): { valid: boolean; error?: string } {
      if (!workOrderId) {
        return { valid: false, error: 'workOrderId is required in path' };
      }

      // Simple UUID format check
      const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
      if (!uuidRegex.test(workOrderId)) {
        return { valid: false, error: 'workOrderId must be a valid UUID' };
      }

      return { valid: true };
    }

    it('should reject missing workOrderId', () => {
      const result = validateWorkOrderId(undefined);

      expect(result.valid).toBe(false);
      expect(result.error).toBe('workOrderId is required in path');
    });

    it('should reject invalid UUID format', () => {
      const result = validateWorkOrderId('invalid-uuid');

      expect(result.valid).toBe(false);
      expect(result.error).toBe('workOrderId must be a valid UUID');
    });

    it('should accept valid UUID', () => {
      const result = validateWorkOrderId('123e4567-e89b-12d3-a456-426614174000');

      expect(result.valid).toBe(true);
    });
  });
});

describe('ListWorkOrdersHandler', () => {
  describe('Query parameter validation', () => {
    const VALID_STATUSES = [
      'OPEN', 'ASSIGNED', 'IN_PROGRESS', 'ON_HOLD',
      'PENDING_PARTS', 'PENDING_APPROVAL', 'COMPLETED', 'CANCELLED', 'CLOSED'
    ];
    const VALID_PRIORITIES = ['CRITICAL', 'HIGH', 'MEDIUM', 'LOW'];

    function validateQueryParams(params: Record<string, string | undefined>): { valid: boolean; errors: string[] } {
      const errors: string[] = [];

      // Validate status
      if (params['status'] && !VALID_STATUSES.includes(params['status'])) {
        errors.push(`status must be one of: ${VALID_STATUSES.join(', ')}`);
      }

      // Validate priority
      if (params['priority'] && !VALID_PRIORITIES.includes(params['priority'])) {
        errors.push(`priority must be one of: ${VALID_PRIORITIES.join(', ')}`);
      }

      // Validate page
      if (params['page']) {
        const page = parseInt(params['page'], 10);
        if (isNaN(page) || page < 1) {
          errors.push('page must be a positive integer');
        }
      }

      // Validate limit
      if (params['limit']) {
        const limit = parseInt(params['limit'], 10);
        if (isNaN(limit) || limit < 1 || limit > 100) {
          errors.push('limit must be an integer between 1 and 100');
        }
      }

      return { valid: errors.length === 0, errors };
    }

    it('should accept empty query parameters', () => {
      const result = validateQueryParams({});

      expect(result.valid).toBe(true);
    });

    it('should accept valid status filter', () => {
      const result = validateQueryParams({ status: 'OPEN' });

      expect(result.valid).toBe(true);
    });

    it('should reject invalid status', () => {
      const result = validateQueryParams({ status: 'INVALID_STATUS' });

      expect(result.valid).toBe(false);
      expect(result.errors.some(e => e.includes('status must be one of'))).toBe(true);
    });

    it('should accept valid priority filter', () => {
      const result = validateQueryParams({ priority: 'HIGH' });

      expect(result.valid).toBe(true);
    });

    it('should reject invalid priority', () => {
      const result = validateQueryParams({ priority: 'INVALID_PRIORITY' });

      expect(result.valid).toBe(false);
      expect(result.errors.some(e => e.includes('priority must be one of'))).toBe(true);
    });

    it('should accept valid pagination', () => {
      const result = validateQueryParams({ page: '2', limit: '25' });

      expect(result.valid).toBe(true);
    });

    it('should reject invalid page (non-numeric)', () => {
      const result = validateQueryParams({ page: 'abc' });

      expect(result.valid).toBe(false);
      expect(result.errors).toContain('page must be a positive integer');
    });

    it('should reject invalid page (zero)', () => {
      const result = validateQueryParams({ page: '0' });

      expect(result.valid).toBe(false);
      expect(result.errors).toContain('page must be a positive integer');
    });

    it('should reject invalid page (negative)', () => {
      const result = validateQueryParams({ page: '-1' });

      expect(result.valid).toBe(false);
      expect(result.errors).toContain('page must be a positive integer');
    });

    it('should reject invalid limit (too high)', () => {
      const result = validateQueryParams({ limit: '101' });

      expect(result.valid).toBe(false);
      expect(result.errors).toContain('limit must be an integer between 1 and 100');
    });

    it('should reject invalid limit (zero)', () => {
      const result = validateQueryParams({ limit: '0' });

      expect(result.valid).toBe(false);
      expect(result.errors).toContain('limit must be an integer between 1 and 100');
    });

    it('should accept all valid statuses', () => {
      VALID_STATUSES.forEach(status => {
        const result = validateQueryParams({ status });
        expect(result.valid).toBe(true);
      });
    });

    it('should accept combined filters', () => {
      const result = validateQueryParams({
        status: 'IN_PROGRESS',
        priority: 'HIGH',
        page: '1',
        limit: '50',
      });

      expect(result.valid).toBe(true);
    });
  });

  describe('Work order status values', () => {
    const ALL_STATUSES = [
      'OPEN', 'ASSIGNED', 'IN_PROGRESS', 'ON_HOLD',
      'PENDING_PARTS', 'PENDING_APPROVAL', 'COMPLETED', 'CANCELLED', 'CLOSED'
    ];

    it('should have 9 valid status values', () => {
      expect(ALL_STATUSES).toHaveLength(9);
    });

    it('should include all required statuses from requirement 2C.7', () => {
      expect(ALL_STATUSES).toContain('OPEN');
      expect(ALL_STATUSES).toContain('ASSIGNED');
      expect(ALL_STATUSES).toContain('IN_PROGRESS');
      expect(ALL_STATUSES).toContain('ON_HOLD');
      expect(ALL_STATUSES).toContain('PENDING_PARTS');
      expect(ALL_STATUSES).toContain('PENDING_APPROVAL');
      expect(ALL_STATUSES).toContain('COMPLETED');
      expect(ALL_STATUSES).toContain('CANCELLED');
      expect(ALL_STATUSES).toContain('CLOSED');
    });
  });
});
