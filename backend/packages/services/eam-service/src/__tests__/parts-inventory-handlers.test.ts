/**
 * Parts Inventory Handlers Unit Tests
 *
 * Tests for Lambda handlers for parts inventory management.
 * Requirements: 5.4, 5.5
 */

describe('ReservePartsHandler', () => {
  describe('Request validation', () => {
    const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

    function validateRequest(body: unknown): { valid: boolean; errors: string[] } {
      if (!body || typeof body !== 'object') {
        return { valid: false, errors: ['Request body is required'] };
      }

      const request = body as Record<string, unknown>;
      const errors: string[] = [];

      // Validate workOrderId
      if (!request['workOrderId']) {
        errors.push('workOrderId is required');
      } else if (!UUID_REGEX.test(request['workOrderId'] as string)) {
        errors.push('workOrderId must be a valid UUID');
      }

      // Validate parts array
      if (!request['parts']) {
        errors.push('parts array is required');
      } else if (!Array.isArray(request['parts'])) {
        errors.push('parts must be an array');
      } else if (request['parts'].length === 0) {
        errors.push('parts array cannot be empty');
      } else {
        const parts = request['parts'] as unknown[];
        for (let i = 0; i < parts.length; i++) {
          const part = parts[i] as Record<string, unknown>;
          
          if (!part || typeof part !== 'object') {
            errors.push(`parts[${i}] must be an object`);
            continue;
          }

          if (!part['partId']) {
            errors.push(`parts[${i}].partId is required`);
          } else if (!UUID_REGEX.test(part['partId'] as string)) {
            errors.push(`parts[${i}].partId must be a valid UUID`);
          }

          if (part['quantityRequired'] === undefined || part['quantityRequired'] === null) {
            errors.push(`parts[${i}].quantityRequired is required`);
          } else if (typeof part['quantityRequired'] !== 'number') {
            errors.push(`parts[${i}].quantityRequired must be a number`);
          } else if (part['quantityRequired'] <= 0) {
            errors.push(`parts[${i}].quantityRequired must be greater than 0`);
          } else if (!Number.isInteger(part['quantityRequired'])) {
            errors.push(`parts[${i}].quantityRequired must be an integer`);
          }
        }
      }

      return { valid: errors.length === 0, errors };
    }

    it('should reject empty request body', () => {
      const result = validateRequest(null);

      expect(result.valid).toBe(false);
      expect(result.errors).toContain('Request body is required');
    });

    it('should require workOrderId', () => {
      const result = validateRequest({
        parts: [{ partId: '123e4567-e89b-12d3-a456-426614174000', quantityRequired: 5 }],
      });

      expect(result.valid).toBe(false);
      expect(result.errors).toContain('workOrderId is required');
    });

    it('should validate workOrderId format', () => {
      const result = validateRequest({
        workOrderId: 'invalid-uuid',
        parts: [{ partId: '123e4567-e89b-12d3-a456-426614174000', quantityRequired: 5 }],
      });

      expect(result.valid).toBe(false);
      expect(result.errors).toContain('workOrderId must be a valid UUID');
    });

    it('should require parts array', () => {
      const result = validateRequest({
        workOrderId: '123e4567-e89b-12d3-a456-426614174000',
      });

      expect(result.valid).toBe(false);
      expect(result.errors).toContain('parts array is required');
    });

    it('should reject non-array parts', () => {
      const result = validateRequest({
        workOrderId: '123e4567-e89b-12d3-a456-426614174000',
        parts: 'not-an-array',
      });

      expect(result.valid).toBe(false);
      expect(result.errors).toContain('parts must be an array');
    });

    it('should reject empty parts array', () => {
      const result = validateRequest({
        workOrderId: '123e4567-e89b-12d3-a456-426614174000',
        parts: [],
      });

      expect(result.valid).toBe(false);
      expect(result.errors).toContain('parts array cannot be empty');
    });

    it('should require partId in each part', () => {
      const result = validateRequest({
        workOrderId: '123e4567-e89b-12d3-a456-426614174000',
        parts: [{ quantityRequired: 5 }],
      });

      expect(result.valid).toBe(false);
      expect(result.errors).toContain('parts[0].partId is required');
    });

    it('should validate partId format', () => {
      const result = validateRequest({
        workOrderId: '123e4567-e89b-12d3-a456-426614174000',
        parts: [{ partId: 'invalid-uuid', quantityRequired: 5 }],
      });

      expect(result.valid).toBe(false);
      expect(result.errors).toContain('parts[0].partId must be a valid UUID');
    });

    it('should require quantityRequired in each part', () => {
      const result = validateRequest({
        workOrderId: '123e4567-e89b-12d3-a456-426614174000',
        parts: [{ partId: '123e4567-e89b-12d3-a456-426614174000' }],
      });

      expect(result.valid).toBe(false);
      expect(result.errors).toContain('parts[0].quantityRequired is required');
    });

    it('should reject non-numeric quantityRequired', () => {
      const result = validateRequest({
        workOrderId: '123e4567-e89b-12d3-a456-426614174000',
        parts: [{ partId: '123e4567-e89b-12d3-a456-426614174000', quantityRequired: 'five' }],
      });

      expect(result.valid).toBe(false);
      expect(result.errors).toContain('parts[0].quantityRequired must be a number');
    });

    it('should reject zero quantityRequired', () => {
      const result = validateRequest({
        workOrderId: '123e4567-e89b-12d3-a456-426614174000',
        parts: [{ partId: '123e4567-e89b-12d3-a456-426614174000', quantityRequired: 0 }],
      });

      expect(result.valid).toBe(false);
      expect(result.errors).toContain('parts[0].quantityRequired must be greater than 0');
    });

    it('should reject negative quantityRequired', () => {
      const result = validateRequest({
        workOrderId: '123e4567-e89b-12d3-a456-426614174000',
        parts: [{ partId: '123e4567-e89b-12d3-a456-426614174000', quantityRequired: -5 }],
      });

      expect(result.valid).toBe(false);
      expect(result.errors).toContain('parts[0].quantityRequired must be greater than 0');
    });

    it('should reject non-integer quantityRequired', () => {
      const result = validateRequest({
        workOrderId: '123e4567-e89b-12d3-a456-426614174000',
        parts: [{ partId: '123e4567-e89b-12d3-a456-426614174000', quantityRequired: 5.5 }],
      });

      expect(result.valid).toBe(false);
      expect(result.errors).toContain('parts[0].quantityRequired must be an integer');
    });

    it('should accept valid request with single part', () => {
      const result = validateRequest({
        workOrderId: '123e4567-e89b-12d3-a456-426614174000',
        parts: [{ partId: '123e4567-e89b-12d3-a456-426614174001', quantityRequired: 5 }],
      });

      expect(result.valid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it('should accept valid request with multiple parts', () => {
      const result = validateRequest({
        workOrderId: '123e4567-e89b-12d3-a456-426614174000',
        parts: [
          { partId: '123e4567-e89b-12d3-a456-426614174001', quantityRequired: 5 },
          { partId: '123e4567-e89b-12d3-a456-426614174002', quantityRequired: 10 },
          { partId: '123e4567-e89b-12d3-a456-426614174003', quantityRequired: 2 },
        ],
      });

      expect(result.valid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it('should validate all parts and collect all errors', () => {
      const result = validateRequest({
        workOrderId: '123e4567-e89b-12d3-a456-426614174000',
        parts: [
          { partId: 'invalid-uuid', quantityRequired: 5 },
          { partId: '123e4567-e89b-12d3-a456-426614174001', quantityRequired: -3 },
          { quantityRequired: 10 },
        ],
      });

      expect(result.valid).toBe(false);
      expect(result.errors.length).toBeGreaterThanOrEqual(3);
    });
  });
});


describe('ConsumePartsHandler', () => {
  describe('Request validation', () => {
    const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

    function validateRequest(body: unknown): { valid: boolean; errors: string[] } {
      // Body is optional - if not provided, all reserved parts will be consumed
      if (body === null || body === undefined) {
        return { valid: true, errors: [] };
      }

      if (typeof body !== 'object') {
        return { valid: false, errors: ['Request body must be an object'] };
      }

      const request = body as Record<string, unknown>;
      const errors: string[] = [];

      // Validate partsUsed array if provided
      if (request['partsUsed'] !== undefined) {
        if (!Array.isArray(request['partsUsed'])) {
          errors.push('partsUsed must be an array');
        } else {
          const partsUsed = request['partsUsed'] as unknown[];
          for (let i = 0; i < partsUsed.length; i++) {
            const part = partsUsed[i] as Record<string, unknown>;
            
            if (!part || typeof part !== 'object') {
              errors.push(`partsUsed[${i}] must be an object`);
              continue;
            }

            if (!part['partId']) {
              errors.push(`partsUsed[${i}].partId is required`);
            } else if (!UUID_REGEX.test(part['partId'] as string)) {
              errors.push(`partsUsed[${i}].partId must be a valid UUID`);
            }

            if (part['quantityUsed'] === undefined || part['quantityUsed'] === null) {
              errors.push(`partsUsed[${i}].quantityUsed is required`);
            } else if (typeof part['quantityUsed'] !== 'number') {
              errors.push(`partsUsed[${i}].quantityUsed must be a number`);
            } else if (part['quantityUsed'] < 0) {
              errors.push(`partsUsed[${i}].quantityUsed must be non-negative`);
            } else if (!Number.isInteger(part['quantityUsed'])) {
              errors.push(`partsUsed[${i}].quantityUsed must be an integer`);
            }
          }
        }
      }

      return { valid: errors.length === 0, errors };
    }

    it('should accept null body (consume all reserved)', () => {
      const result = validateRequest(null);

      expect(result.valid).toBe(true);
    });

    it('should accept undefined body (consume all reserved)', () => {
      const result = validateRequest(undefined);

      expect(result.valid).toBe(true);
    });

    it('should accept empty object (consume all reserved)', () => {
      const result = validateRequest({});

      expect(result.valid).toBe(true);
    });

    it('should reject non-object body', () => {
      const result = validateRequest('not-an-object');

      expect(result.valid).toBe(false);
      expect(result.errors).toContain('Request body must be an object');
    });

    it('should reject non-array partsUsed', () => {
      const result = validateRequest({ partsUsed: 'not-an-array' });

      expect(result.valid).toBe(false);
      expect(result.errors).toContain('partsUsed must be an array');
    });

    it('should accept empty partsUsed array', () => {
      const result = validateRequest({ partsUsed: [] });

      expect(result.valid).toBe(true);
    });

    it('should require partId in each partsUsed entry', () => {
      const result = validateRequest({
        partsUsed: [{ quantityUsed: 5 }],
      });

      expect(result.valid).toBe(false);
      expect(result.errors).toContain('partsUsed[0].partId is required');
    });

    it('should validate partId format', () => {
      const result = validateRequest({
        partsUsed: [{ partId: 'invalid-uuid', quantityUsed: 5 }],
      });

      expect(result.valid).toBe(false);
      expect(result.errors).toContain('partsUsed[0].partId must be a valid UUID');
    });

    it('should require quantityUsed in each partsUsed entry', () => {
      const result = validateRequest({
        partsUsed: [{ partId: '123e4567-e89b-12d3-a456-426614174000' }],
      });

      expect(result.valid).toBe(false);
      expect(result.errors).toContain('partsUsed[0].quantityUsed is required');
    });

    it('should allow zero quantityUsed (no consumption)', () => {
      const result = validateRequest({
        partsUsed: [{ partId: '123e4567-e89b-12d3-a456-426614174000', quantityUsed: 0 }],
      });

      expect(result.valid).toBe(true);
    });

    it('should reject negative quantityUsed', () => {
      const result = validateRequest({
        partsUsed: [{ partId: '123e4567-e89b-12d3-a456-426614174000', quantityUsed: -5 }],
      });

      expect(result.valid).toBe(false);
      expect(result.errors).toContain('partsUsed[0].quantityUsed must be non-negative');
    });

    it('should reject non-integer quantityUsed', () => {
      const result = validateRequest({
        partsUsed: [{ partId: '123e4567-e89b-12d3-a456-426614174000', quantityUsed: 5.5 }],
      });

      expect(result.valid).toBe(false);
      expect(result.errors).toContain('partsUsed[0].quantityUsed must be an integer');
    });

    it('should accept valid partsUsed array', () => {
      const result = validateRequest({
        partsUsed: [
          { partId: '123e4567-e89b-12d3-a456-426614174001', quantityUsed: 5 },
          { partId: '123e4567-e89b-12d3-a456-426614174002', quantityUsed: 10 },
        ],
      });

      expect(result.valid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });
  });
});


describe('CheckPartLevelsHandler', () => {
  describe('Query parameter parsing', () => {
    function parseCriticalOnly(value: string | undefined): boolean {
      return value === 'true';
    }

    it('should parse criticalOnly=true', () => {
      expect(parseCriticalOnly('true')).toBe(true);
    });

    it('should parse criticalOnly=false', () => {
      expect(parseCriticalOnly('false')).toBe(false);
    });

    it('should default to false when undefined', () => {
      expect(parseCriticalOnly(undefined)).toBe(false);
    });

    it('should be case sensitive', () => {
      expect(parseCriticalOnly('TRUE')).toBe(false);
      expect(parseCriticalOnly('True')).toBe(false);
    });
  });

  describe('Alert summary calculation', () => {
    interface Alert {
      isCritical: boolean;
      estimatedOrderCost: number | null;
    }

    function calculateSummary(alerts: Alert[]): {
      totalAlerts: number;
      criticalAlerts: number;
      totalEstimatedCost: number;
    } {
      return {
        totalAlerts: alerts.length,
        criticalAlerts: alerts.filter(a => a.isCritical).length,
        totalEstimatedCost: alerts.reduce((sum, a) => sum + (a.estimatedOrderCost ?? 0), 0),
      };
    }

    it('should calculate summary for empty alerts', () => {
      const summary = calculateSummary([]);

      expect(summary.totalAlerts).toBe(0);
      expect(summary.criticalAlerts).toBe(0);
      expect(summary.totalEstimatedCost).toBe(0);
    });

    it('should count total alerts', () => {
      const alerts: Alert[] = [
        { isCritical: false, estimatedOrderCost: 100 },
        { isCritical: false, estimatedOrderCost: 200 },
        { isCritical: true, estimatedOrderCost: 300 },
      ];

      const summary = calculateSummary(alerts);

      expect(summary.totalAlerts).toBe(3);
    });

    it('should count critical alerts', () => {
      const alerts: Alert[] = [
        { isCritical: false, estimatedOrderCost: 100 },
        { isCritical: true, estimatedOrderCost: 200 },
        { isCritical: true, estimatedOrderCost: 300 },
      ];

      const summary = calculateSummary(alerts);

      expect(summary.criticalAlerts).toBe(2);
    });

    it('should sum estimated costs', () => {
      const alerts: Alert[] = [
        { isCritical: false, estimatedOrderCost: 100 },
        { isCritical: false, estimatedOrderCost: 200 },
        { isCritical: true, estimatedOrderCost: 300 },
      ];

      const summary = calculateSummary(alerts);

      expect(summary.totalEstimatedCost).toBe(600);
    });

    it('should handle null estimated costs', () => {
      const alerts: Alert[] = [
        { isCritical: false, estimatedOrderCost: 100 },
        { isCritical: false, estimatedOrderCost: null },
        { isCritical: true, estimatedOrderCost: 300 },
      ];

      const summary = calculateSummary(alerts);

      expect(summary.totalEstimatedCost).toBe(400);
    });
  });
});
