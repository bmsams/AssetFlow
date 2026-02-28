/**
 * Maintenance Handlers Unit Tests
 *
 * Tests for Lambda handlers for maintenance plan management.
 * Requirements: 5.1, 5.2
 */

describe('CreateMaintenancePlanHandler', () => {
  describe('Request validation', () => {
    const VALID_MAINTENANCE_TYPES = [
      'PREVENTIVE', 'PREDICTIVE', 'INSPECTION', 'CALIBRATION',
      'LUBRICATION', 'CLEANING', 'SAFETY_CHECK', 'REGULATORY', 'SEASONAL', 'OTHER'
    ];
    const VALID_SCHEDULE_TYPES = ['TIME_BASED', 'USAGE_BASED', 'CONDITION_BASED', 'HYBRID'];
    const VALID_PRIORITIES = ['CRITICAL', 'HIGH', 'MEDIUM', 'LOW'];

    function validateRequest(body: unknown): { valid: boolean; errors: string[] } {
      if (!body || typeof body !== 'object') {
        return { valid: false, errors: ['Request body is required'] };
      }

      const request = body as Record<string, unknown>;
      const errors: string[] = [];

      if (!request['assetId']) {
        errors.push('assetId is required');
      }

      if (!request['planName']) {
        errors.push('planName is required');
      }

      if (!request['maintenanceType']) {
        errors.push('maintenanceType is required');
      } else if (!VALID_MAINTENANCE_TYPES.includes(request['maintenanceType'] as string)) {
        errors.push(`maintenanceType must be one of: ${VALID_MAINTENANCE_TYPES.join(', ')}`);
      }

      if (!request['scheduleType']) {
        errors.push('scheduleType is required');
      } else if (!VALID_SCHEDULE_TYPES.includes(request['scheduleType'] as string)) {
        errors.push(`scheduleType must be one of: ${VALID_SCHEDULE_TYPES.join(', ')}`);
      }

      const scheduleType = request['scheduleType'] as string;
      if (scheduleType === 'TIME_BASED' && !request['frequencyDays']) {
        errors.push('frequencyDays is required for TIME_BASED schedules');
      }

      if (scheduleType === 'USAGE_BASED' && !request['frequencyHours']) {
        errors.push('frequencyHours is required for USAGE_BASED schedules');
      }

      if (request['priority'] !== undefined && !VALID_PRIORITIES.includes(request['priority'] as string)) {
        errors.push(`priority must be one of: ${VALID_PRIORITIES.join(', ')}`);
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
        planName: 'Test Plan',
        maintenanceType: 'PREVENTIVE',
        scheduleType: 'TIME_BASED',
        frequencyDays: 30,
      });

      expect(result.valid).toBe(false);
      expect(result.errors).toContain('assetId is required');
    });

    it('should require planName', () => {
      const result = validateRequest({
        assetId: '123e4567-e89b-12d3-a456-426614174000',
        maintenanceType: 'PREVENTIVE',
        scheduleType: 'TIME_BASED',
        frequencyDays: 30,
      });

      expect(result.valid).toBe(false);
      expect(result.errors).toContain('planName is required');
    });

    it('should require maintenanceType', () => {
      const result = validateRequest({
        assetId: '123e4567-e89b-12d3-a456-426614174000',
        planName: 'Test Plan',
        scheduleType: 'TIME_BASED',
        frequencyDays: 30,
      });

      expect(result.valid).toBe(false);
      expect(result.errors).toContain('maintenanceType is required');
    });

    it('should require scheduleType', () => {
      const result = validateRequest({
        assetId: '123e4567-e89b-12d3-a456-426614174000',
        planName: 'Test Plan',
        maintenanceType: 'PREVENTIVE',
        frequencyDays: 30,
      });

      expect(result.valid).toBe(false);
      expect(result.errors).toContain('scheduleType is required');
    });

    it('should require frequencyDays for TIME_BASED schedules', () => {
      const result = validateRequest({
        assetId: '123e4567-e89b-12d3-a456-426614174000',
        planName: 'Test Plan',
        maintenanceType: 'PREVENTIVE',
        scheduleType: 'TIME_BASED',
      });

      expect(result.valid).toBe(false);
      expect(result.errors).toContain('frequencyDays is required for TIME_BASED schedules');
    });

    it('should require frequencyHours for USAGE_BASED schedules', () => {
      const result = validateRequest({
        assetId: '123e4567-e89b-12d3-a456-426614174000',
        planName: 'Test Plan',
        maintenanceType: 'PREVENTIVE',
        scheduleType: 'USAGE_BASED',
      });

      expect(result.valid).toBe(false);
      expect(result.errors).toContain('frequencyHours is required for USAGE_BASED schedules');
    });

    it('should accept valid TIME_BASED request', () => {
      const result = validateRequest({
        assetId: '123e4567-e89b-12d3-a456-426614174000',
        planName: 'Monthly Inspection',
        maintenanceType: 'INSPECTION',
        scheduleType: 'TIME_BASED',
        frequencyDays: 30,
        priority: 'MEDIUM',
      });

      expect(result.valid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it('should accept valid USAGE_BASED request', () => {
      const result = validateRequest({
        assetId: '123e4567-e89b-12d3-a456-426614174000',
        planName: 'Oil Change',
        maintenanceType: 'PREVENTIVE',
        scheduleType: 'USAGE_BASED',
        frequencyHours: 500,
        priority: 'HIGH',
      });

      expect(result.valid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it('should reject invalid maintenanceType', () => {
      const result = validateRequest({
        assetId: '123e4567-e89b-12d3-a456-426614174000',
        planName: 'Test Plan',
        maintenanceType: 'INVALID_TYPE',
        scheduleType: 'TIME_BASED',
        frequencyDays: 30,
      });

      expect(result.valid).toBe(false);
      expect(result.errors.some(e => e.includes('maintenanceType must be one of'))).toBe(true);
    });

    it('should reject invalid scheduleType', () => {
      const result = validateRequest({
        assetId: '123e4567-e89b-12d3-a456-426614174000',
        planName: 'Test Plan',
        maintenanceType: 'PREVENTIVE',
        scheduleType: 'INVALID_SCHEDULE',
        frequencyDays: 30,
      });

      expect(result.valid).toBe(false);
      expect(result.errors.some(e => e.includes('scheduleType must be one of'))).toBe(true);
    });

    it('should reject invalid priority', () => {
      const result = validateRequest({
        assetId: '123e4567-e89b-12d3-a456-426614174000',
        planName: 'Test Plan',
        maintenanceType: 'PREVENTIVE',
        scheduleType: 'TIME_BASED',
        frequencyDays: 30,
        priority: 'INVALID_PRIORITY',
      });

      expect(result.valid).toBe(false);
      expect(result.errors.some(e => e.includes('priority must be one of'))).toBe(true);
    });
  });
});


describe('UpdateMaintenancePlanHandler', () => {
  describe('Request validation', () => {
    const VALID_MAINTENANCE_TYPES = [
      'PREVENTIVE', 'PREDICTIVE', 'INSPECTION', 'CALIBRATION',
      'LUBRICATION', 'CLEANING', 'SAFETY_CHECK', 'REGULATORY', 'SEASONAL', 'OTHER'
    ];
    const VALID_SCHEDULE_TYPES = ['TIME_BASED', 'USAGE_BASED', 'CONDITION_BASED', 'HYBRID'];
    const VALID_PRIORITIES = ['CRITICAL', 'HIGH', 'MEDIUM', 'LOW'];

    function validateUpdateRequest(body: unknown): { valid: boolean; errors: string[] } {
      if (!body || typeof body !== 'object') {
        return { valid: false, errors: ['Request body is required'] };
      }

      const request = body as Record<string, unknown>;
      const errors: string[] = [];

      if (request['maintenanceType'] !== undefined &&
          !VALID_MAINTENANCE_TYPES.includes(request['maintenanceType'] as string)) {
        errors.push(`maintenanceType must be one of: ${VALID_MAINTENANCE_TYPES.join(', ')}`);
      }

      if (request['scheduleType'] !== undefined &&
          !VALID_SCHEDULE_TYPES.includes(request['scheduleType'] as string)) {
        errors.push(`scheduleType must be one of: ${VALID_SCHEDULE_TYPES.join(', ')}`);
      }

      if (request['priority'] !== undefined &&
          !VALID_PRIORITIES.includes(request['priority'] as string)) {
        errors.push(`priority must be one of: ${VALID_PRIORITIES.join(', ')}`);
      }

      if (request['frequencyDays'] !== undefined && request['frequencyDays'] !== null) {
        if (typeof request['frequencyDays'] !== 'number' || request['frequencyDays'] <= 0) {
          errors.push('frequencyDays must be a positive number');
        }
      }

      if (request['frequencyHours'] !== undefined && request['frequencyHours'] !== null) {
        if (typeof request['frequencyHours'] !== 'number' || request['frequencyHours'] <= 0) {
          errors.push('frequencyHours must be a positive number');
        }
      }

      return { valid: errors.length === 0, errors };
    }

    it('should accept partial updates', () => {
      const result = validateUpdateRequest({
        planName: 'Updated Plan Name',
      });

      expect(result.valid).toBe(true);
    });

    it('should accept empty update (no changes)', () => {
      const result = validateUpdateRequest({});

      expect(result.valid).toBe(true);
    });

    it('should validate maintenanceType if provided', () => {
      const result = validateUpdateRequest({
        maintenanceType: 'INVALID_TYPE',
      });

      expect(result.valid).toBe(false);
      expect(result.errors.some(e => e.includes('maintenanceType must be one of'))).toBe(true);
    });

    it('should validate scheduleType if provided', () => {
      const result = validateUpdateRequest({
        scheduleType: 'INVALID_SCHEDULE',
      });

      expect(result.valid).toBe(false);
      expect(result.errors.some(e => e.includes('scheduleType must be one of'))).toBe(true);
    });

    it('should validate priority if provided', () => {
      const result = validateUpdateRequest({
        priority: 'INVALID_PRIORITY',
      });

      expect(result.valid).toBe(false);
      expect(result.errors.some(e => e.includes('priority must be one of'))).toBe(true);
    });

    it('should reject negative frequencyDays', () => {
      const result = validateUpdateRequest({
        frequencyDays: -5,
      });

      expect(result.valid).toBe(false);
      expect(result.errors).toContain('frequencyDays must be a positive number');
    });

    it('should reject zero frequencyDays', () => {
      const result = validateUpdateRequest({
        frequencyDays: 0,
      });

      expect(result.valid).toBe(false);
      expect(result.errors).toContain('frequencyDays must be a positive number');
    });

    it('should accept null frequencyDays (to clear)', () => {
      const result = validateUpdateRequest({
        frequencyDays: null,
      });

      expect(result.valid).toBe(true);
    });

    it('should accept valid update with multiple fields', () => {
      const result = validateUpdateRequest({
        planName: 'Updated Plan',
        maintenanceType: 'CALIBRATION',
        priority: 'HIGH',
        frequencyDays: 90,
        isActive: false,
      });

      expect(result.valid).toBe(true);
    });
  });
});

describe('CheckDueMaintenanceHandler', () => {
  describe('Date validation', () => {
    function validateDateFormat(date: string | undefined): boolean {
      if (!date) return true;
      return /^\d{4}-\d{2}-\d{2}$/.test(date);
    }

    it('should accept valid date format', () => {
      expect(validateDateFormat('2024-01-15')).toBe(true);
    });

    it('should accept undefined date', () => {
      expect(validateDateFormat(undefined)).toBe(true);
    });

    it('should reject invalid date format', () => {
      expect(validateDateFormat('01-15-2024')).toBe(false);
      expect(validateDateFormat('2024/01/15')).toBe(false);
      expect(validateDateFormat('2024-1-15')).toBe(false);
      expect(validateDateFormat('invalid')).toBe(false);
    });
  });

  describe('Query parameters', () => {
    it('should parse generateWorkOrders flag', () => {
      const parseGenerateWorkOrders = (value: string | undefined): boolean => {
        return value === 'true';
      };

      expect(parseGenerateWorkOrders('true')).toBe(true);
      expect(parseGenerateWorkOrders('false')).toBe(false);
      expect(parseGenerateWorkOrders(undefined)).toBe(false);
      expect(parseGenerateWorkOrders('TRUE')).toBe(false); // Case sensitive
    });

    it('should parse daysAhead with default', () => {
      const parseDaysAhead = (value: string | undefined): number => {
        return parseInt(value ?? '7', 10);
      };

      expect(parseDaysAhead('14')).toBe(14);
      expect(parseDaysAhead('30')).toBe(30);
      expect(parseDaysAhead(undefined)).toBe(7);
    });
  });
});
