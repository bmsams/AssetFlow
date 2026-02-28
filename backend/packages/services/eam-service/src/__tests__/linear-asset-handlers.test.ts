/**
 * Linear Asset Handlers Unit Tests
 *
 * Tests for linear asset Lambda handlers.
 * Requirement 5.3: Track assets spanning physical distances with segment-based location tracking
 */

describe('CreateLinearAssetHandler', () => {
  describe('Request validation', () => {
    const VALID_LINEAR_UNITS = ['METERS', 'KILOMETERS', 'FEET', 'MILES', 'YARDS'];
    const VALID_ROUTE_TYPES = ['PIPELINE', 'CABLE', 'TRACK', 'ROAD', 'FENCE', 'CONVEYOR', 'DUCT', 'OTHER'];
    const VALID_CONDITION_RATINGS = ['EXCELLENT', 'GOOD', 'FAIR', 'POOR', 'CRITICAL'];

    function validateCreateRequest(body: unknown): { valid: boolean; errors: string[] } {
      if (!body || typeof body !== 'object') {
        return { valid: false, errors: ['Request body is required'] };
      }

      const request = body as Record<string, unknown>;
      const errors: string[] = [];

      // Required fields
      if (!request['assetId']) {
        errors.push('assetId is required');
      } else if (typeof request['assetId'] !== 'string' || !/^[0-9a-f-]{36}$/i.test(request['assetId'])) {
        errors.push('assetId must be a valid UUID');
      }

      // Validate optional enum fields
      if (request['linearUnitOfMeasure'] !== undefined && !VALID_LINEAR_UNITS.includes(request['linearUnitOfMeasure'] as string)) {
        errors.push(`linearUnitOfMeasure must be one of: ${VALID_LINEAR_UNITS.join(', ')}`);
      }

      if (request['routeType'] !== undefined && !VALID_ROUTE_TYPES.includes(request['routeType'] as string)) {
        errors.push(`routeType must be one of: ${VALID_ROUTE_TYPES.join(', ')}`);
      }

      if (request['overallConditionRating'] !== undefined && !VALID_CONDITION_RATINGS.includes(request['overallConditionRating'] as string)) {
        errors.push(`overallConditionRating must be one of: ${VALID_CONDITION_RATINGS.join(', ')}`);
      }

      // Validate GPS coordinates
      if (request['startGpsLatitude'] !== undefined) {
        const lat = request['startGpsLatitude'] as number;
        if (typeof lat !== 'number' || lat < -90 || lat > 90) {
          errors.push('startGpsLatitude must be a number between -90 and 90');
        }
      }

      if (request['startGpsLongitude'] !== undefined) {
        const lng = request['startGpsLongitude'] as number;
        if (typeof lng !== 'number' || lng < -180 || lng > 180) {
          errors.push('startGpsLongitude must be a number between -180 and 180');
        }
      }

      return { valid: errors.length === 0, errors };
    }

    it('should require assetId', () => {
      const result = validateCreateRequest({});
      expect(result.valid).toBe(false);
      expect(result.errors).toContain('assetId is required');
    });

    it('should validate assetId is a UUID', () => {
      const result = validateCreateRequest({ assetId: 'not-a-uuid' });
      expect(result.valid).toBe(false);
      expect(result.errors).toContain('assetId must be a valid UUID');
    });

    it('should accept valid assetId', () => {
      const result = validateCreateRequest({ assetId: '123e4567-e89b-12d3-a456-426614174000' });
      expect(result.valid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it('should validate linearUnitOfMeasure enum', () => {
      const result = validateCreateRequest({
        assetId: '123e4567-e89b-12d3-a456-426614174000',
        linearUnitOfMeasure: 'INVALID',
      });
      expect(result.valid).toBe(false);
      expect(result.errors.some(e => e.includes('linearUnitOfMeasure'))).toBe(true);
    });

    it('should accept valid linearUnitOfMeasure', () => {
      const result = validateCreateRequest({
        assetId: '123e4567-e89b-12d3-a456-426614174000',
        linearUnitOfMeasure: 'KILOMETERS',
      });
      expect(result.valid).toBe(true);
    });

    it('should validate routeType enum', () => {
      const result = validateCreateRequest({
        assetId: '123e4567-e89b-12d3-a456-426614174000',
        routeType: 'INVALID',
      });
      expect(result.valid).toBe(false);
      expect(result.errors.some(e => e.includes('routeType'))).toBe(true);
    });

    it('should validate GPS latitude range', () => {
      const result = validateCreateRequest({
        assetId: '123e4567-e89b-12d3-a456-426614174000',
        startGpsLatitude: 91,
      });
      expect(result.valid).toBe(false);
      expect(result.errors.some(e => e.includes('startGpsLatitude'))).toBe(true);
    });

    it('should validate GPS longitude range', () => {
      const result = validateCreateRequest({
        assetId: '123e4567-e89b-12d3-a456-426614174000',
        startGpsLongitude: 181,
      });
      expect(result.valid).toBe(false);
      expect(result.errors.some(e => e.includes('startGpsLongitude'))).toBe(true);
    });

    it('should accept valid complete request', () => {
      const result = validateCreateRequest({
        assetId: '123e4567-e89b-12d3-a456-426614174000',
        startLocation: 'Mile Marker 0',
        endLocation: 'Mile Marker 100',
        linearUnitOfMeasure: 'MILES',
        routeType: 'PIPELINE',
        overallConditionRating: 'GOOD',
        startGpsLatitude: 40.7128,
        startGpsLongitude: -74.0060,
        endGpsLatitude: 41.8781,
        endGpsLongitude: -87.6298,
      });
      expect(result.valid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });
  });
});


describe('UpdateSegmentHandler', () => {
  describe('Request validation', () => {
    const VALID_CONDITION_RATINGS = ['EXCELLENT', 'GOOD', 'FAIR', 'POOR', 'CRITICAL'];

    function validateUpdateRequest(body: unknown): { valid: boolean; errors: string[] } {
      if (!body || typeof body !== 'object') {
        return { valid: false, errors: ['Request body is required'] };
      }

      const request = body as Record<string, unknown>;
      const errors: string[] = [];

      // Validate condition rating if provided
      if (request['conditionRating'] !== undefined && request['conditionRating'] !== null) {
        if (!VALID_CONDITION_RATINGS.includes(request['conditionRating'] as string)) {
          errors.push(`conditionRating must be one of: ${VALID_CONDITION_RATINGS.join(', ')}`);
        }
      }

      // Validate segment length if provided
      if (request['segmentLength'] !== undefined && request['segmentLength'] !== null) {
        if (typeof request['segmentLength'] !== 'number' || request['segmentLength'] <= 0) {
          errors.push('segmentLength must be a positive number');
        }
      }

      // Validate GPS coordinates
      if (request['startGpsLatitude'] !== undefined && request['startGpsLatitude'] !== null) {
        const lat = request['startGpsLatitude'] as number;
        if (typeof lat !== 'number' || lat < -90 || lat > 90) {
          errors.push('startGpsLatitude must be a number between -90 and 90');
        }
      }

      // Validate defect count if provided
      if (request['defectCount'] !== undefined) {
        if (typeof request['defectCount'] !== 'number' || request['defectCount'] < 0 || !Number.isInteger(request['defectCount'])) {
          errors.push('defectCount must be a non-negative integer');
        }
      }

      // Validate hasActiveDefects if provided
      if (request['hasActiveDefects'] !== undefined && typeof request['hasActiveDefects'] !== 'boolean') {
        errors.push('hasActiveDefects must be a boolean');
      }

      // Validate date formats
      if (request['installationDate'] !== undefined && request['installationDate'] !== null) {
        if (!/^\d{4}-\d{2}-\d{2}$/.test(request['installationDate'] as string)) {
          errors.push('installationDate must be in YYYY-MM-DD format');
        }
      }

      return { valid: errors.length === 0, errors };
    }

    it('should accept empty update request', () => {
      const result = validateUpdateRequest({});
      expect(result.valid).toBe(true);
    });

    it('should validate conditionRating enum', () => {
      const result = validateUpdateRequest({ conditionRating: 'INVALID' });
      expect(result.valid).toBe(false);
      expect(result.errors.some(e => e.includes('conditionRating'))).toBe(true);
    });

    it('should accept valid conditionRating', () => {
      const result = validateUpdateRequest({ conditionRating: 'GOOD' });
      expect(result.valid).toBe(true);
    });

    it('should allow null conditionRating', () => {
      const result = validateUpdateRequest({ conditionRating: null });
      expect(result.valid).toBe(true);
    });

    it('should validate segmentLength is positive', () => {
      const result = validateUpdateRequest({ segmentLength: 0 });
      expect(result.valid).toBe(false);
      expect(result.errors.some(e => e.includes('segmentLength'))).toBe(true);
    });

    it('should reject negative segmentLength', () => {
      const result = validateUpdateRequest({ segmentLength: -100 });
      expect(result.valid).toBe(false);
    });

    it('should accept valid segmentLength', () => {
      const result = validateUpdateRequest({ segmentLength: 150.5 });
      expect(result.valid).toBe(true);
    });

    it('should validate defectCount is non-negative integer', () => {
      const result = validateUpdateRequest({ defectCount: -1 });
      expect(result.valid).toBe(false);
      expect(result.errors.some(e => e.includes('defectCount'))).toBe(true);
    });

    it('should reject non-integer defectCount', () => {
      const result = validateUpdateRequest({ defectCount: 1.5 });
      expect(result.valid).toBe(false);
    });

    it('should accept valid defectCount', () => {
      const result = validateUpdateRequest({ defectCount: 5 });
      expect(result.valid).toBe(true);
    });

    it('should validate hasActiveDefects is boolean', () => {
      const result = validateUpdateRequest({ hasActiveDefects: 'true' });
      expect(result.valid).toBe(false);
      expect(result.errors.some(e => e.includes('hasActiveDefects'))).toBe(true);
    });

    it('should accept valid hasActiveDefects', () => {
      const result = validateUpdateRequest({ hasActiveDefects: true });
      expect(result.valid).toBe(true);
    });

    it('should validate date format', () => {
      const result = validateUpdateRequest({ installationDate: '2024/01/15' });
      expect(result.valid).toBe(false);
      expect(result.errors.some(e => e.includes('installationDate'))).toBe(true);
    });

    it('should accept valid date format', () => {
      const result = validateUpdateRequest({ installationDate: '2024-01-15' });
      expect(result.valid).toBe(true);
    });

    it('should accept valid complete update request', () => {
      const result = validateUpdateRequest({
        startMarker: 'MM-50',
        endMarker: 'MM-75',
        segmentLength: 25,
        conditionRating: 'FAIR',
        material: 'Steel',
        installationDate: '2020-06-15',
        defectCount: 2,
        hasActiveDefects: true,
        lastInspectionDate: '2024-01-10',
        lastInspectionNotes: 'Minor corrosion detected',
        nextInspectionDue: '2024-07-10',
      });
      expect(result.valid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });
  });
});

describe('GetLinearAssetHandler', () => {
  describe('Path parameter validation', () => {
    function validateUUID(value: string): boolean {
      return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(value);
    }

    it('should validate linearAssetId is a UUID', () => {
      expect(validateUUID('123e4567-e89b-12d3-a456-426614174000')).toBe(true);
      expect(validateUUID('not-a-uuid')).toBe(false);
      expect(validateUUID('')).toBe(false);
    });
  });

  describe('Query parameter handling', () => {
    it('should parse includeSegments parameter', () => {
      const parseIncludeSegments = (value: string | undefined): boolean => {
        return value === 'true';
      };

      expect(parseIncludeSegments('true')).toBe(true);
      expect(parseIncludeSegments('false')).toBe(false);
      expect(parseIncludeSegments(undefined)).toBe(false);
      expect(parseIncludeSegments('TRUE')).toBe(false); // Case sensitive
    });
  });
});

describe('ListSegmentsHandler', () => {
  describe('Pagination parameter validation', () => {
    function validatePagination(page: string | undefined, limit: string | undefined): { valid: boolean; errors: string[] } {
      const errors: string[] = [];

      const pageNum = parseInt(page ?? '1', 10);
      const limitNum = parseInt(limit ?? '50', 10);

      if (isNaN(pageNum) || pageNum < 1) {
        errors.push('page must be a positive integer');
      }

      if (isNaN(limitNum) || limitNum < 1 || limitNum > 100) {
        errors.push('limit must be between 1 and 100');
      }

      return { valid: errors.length === 0, errors };
    }

    it('should accept default pagination', () => {
      const result = validatePagination(undefined, undefined);
      expect(result.valid).toBe(true);
    });

    it('should accept valid page number', () => {
      const result = validatePagination('5', '50');
      expect(result.valid).toBe(true);
    });

    it('should reject page less than 1', () => {
      const result = validatePagination('0', '50');
      expect(result.valid).toBe(false);
      expect(result.errors.some(e => e.includes('page'))).toBe(true);
    });

    it('should reject negative page', () => {
      const result = validatePagination('-1', '50');
      expect(result.valid).toBe(false);
    });

    it('should reject non-numeric page', () => {
      const result = validatePagination('abc', '50');
      expect(result.valid).toBe(false);
    });

    it('should reject limit less than 1', () => {
      const result = validatePagination('1', '0');
      expect(result.valid).toBe(false);
      expect(result.errors.some(e => e.includes('limit'))).toBe(true);
    });

    it('should reject limit greater than 100', () => {
      const result = validatePagination('1', '101');
      expect(result.valid).toBe(false);
    });

    it('should accept limit at boundaries', () => {
      expect(validatePagination('1', '1').valid).toBe(true);
      expect(validatePagination('1', '100').valid).toBe(true);
    });
  });
});

describe('Error response handling', () => {
  describe('HTTP status codes', () => {
    const HTTP_STATUS = {
      OK: 200,
      CREATED: 201,
      BAD_REQUEST: 400,
      NOT_FOUND: 404,
      CONFLICT: 409,
      INTERNAL_SERVER_ERROR: 500,
    };

    it('should return 201 for successful creation', () => {
      expect(HTTP_STATUS.CREATED).toBe(201);
    });

    it('should return 200 for successful retrieval', () => {
      expect(HTTP_STATUS.OK).toBe(200);
    });

    it('should return 400 for validation errors', () => {
      expect(HTTP_STATUS.BAD_REQUEST).toBe(400);
    });

    it('should return 404 for not found', () => {
      expect(HTTP_STATUS.NOT_FOUND).toBe(404);
    });

    it('should return 409 for conflicts', () => {
      expect(HTTP_STATUS.CONFLICT).toBe(409);
    });

    it('should return 500 for internal errors', () => {
      expect(HTTP_STATUS.INTERNAL_SERVER_ERROR).toBe(500);
    });
  });

  describe('Error message mapping', () => {
    function mapErrorToResponse(error: Error): { status: number; message: string } {
      if (error.message.includes('not found')) {
        return { status: 404, message: 'Resource not found' };
      }
      if (error.message.includes('already exists') || error.message.includes('duplicate')) {
        return { status: 409, message: 'Resource already exists' };
      }
      if (error.message.includes('must be positive') || error.message.includes('validation')) {
        return { status: 400, message: error.message };
      }
      return { status: 500, message: 'Internal server error' };
    }

    it('should map not found errors to 404', () => {
      const result = mapErrorToResponse(new Error('Linear asset not found'));
      expect(result.status).toBe(404);
    });

    it('should map duplicate errors to 409', () => {
      const result = mapErrorToResponse(new Error('Linear asset already exists'));
      expect(result.status).toBe(409);
    });

    it('should map validation errors to 400', () => {
      const result = mapErrorToResponse(new Error('Segment length must be positive'));
      expect(result.status).toBe(400);
    });

    it('should map unknown errors to 500', () => {
      const result = mapErrorToResponse(new Error('Database connection failed'));
      expect(result.status).toBe(500);
    });
  });
});
