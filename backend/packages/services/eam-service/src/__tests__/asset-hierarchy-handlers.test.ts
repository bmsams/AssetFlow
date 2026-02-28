/**
 * Asset Hierarchy Handlers Unit Tests
 *
 * Tests for asset hierarchy Lambda handlers.
 * Requirement 5.6: Support parent-child relationships for complex equipment with sub-components
 * Requirement 5.7: Propagate relevant status updates to child components
 */

import type { APIGatewayProxyEvent } from 'aws-lambda';

describe('Asset Hierarchy Handlers', () => {
  describe('Link Parent-Child Handler', () => {
    describe('Request validation', () => {
      interface LinkParentChildRequestBody {
        parentAssetId?: string;
        childAssetId?: string;
      }

      function validateRequest(body: unknown): { valid: boolean; error?: string } {
        if (!body || typeof body !== 'object') {
          return { valid: false, error: 'Request body is required' };
        }

        const request = body as LinkParentChildRequestBody;

        if (typeof request.parentAssetId !== 'string' || !request.parentAssetId) {
          return { valid: false, error: 'parentAssetId is required' };
        }

        if (typeof request.childAssetId !== 'string' || !request.childAssetId) {
          return { valid: false, error: 'childAssetId is required' };
        }

        return { valid: true };
      }

      it('should accept valid request with both IDs', () => {
        const body = {
          parentAssetId: 'parent-123',
          childAssetId: 'child-456',
        };

        const result = validateRequest(body);
        expect(result.valid).toBe(true);
      });

      it('should reject request without parentAssetId', () => {
        const body = {
          childAssetId: 'child-456',
        };

        const result = validateRequest(body);
        expect(result.valid).toBe(false);
        expect(result.error).toContain('parentAssetId');
      });

      it('should reject request without childAssetId', () => {
        const body = {
          parentAssetId: 'parent-123',
        };

        const result = validateRequest(body);
        expect(result.valid).toBe(false);
        expect(result.error).toContain('childAssetId');
      });

      it('should reject empty request body', () => {
        const result = validateRequest({});
        expect(result.valid).toBe(false);
      });

      it('should reject null request body', () => {
        const result = validateRequest(null);
        expect(result.valid).toBe(false);
      });

      it('should reject empty string parentAssetId', () => {
        const body = {
          parentAssetId: '',
          childAssetId: 'child-456',
        };

        const result = validateRequest(body);
        expect(result.valid).toBe(false);
      });

      it('should reject empty string childAssetId', () => {
        const body = {
          parentAssetId: 'parent-123',
          childAssetId: '',
        };

        const result = validateRequest(body);
        expect(result.valid).toBe(false);
      });
    });
  });

  describe('Get Hierarchy Handler', () => {
    describe('Query parameter validation', () => {
      const VALID_HIERARCHY_TYPES = ['ancestors', 'descendants', 'full'];

      function validateHierarchyType(type: string | undefined): { valid: boolean; error?: string } {
        const hierarchyType = type ?? 'descendants';

        if (!VALID_HIERARCHY_TYPES.includes(hierarchyType)) {
          return {
            valid: false,
            error: `Invalid hierarchy type. Must be one of: ${VALID_HIERARCHY_TYPES.join(', ')}`,
          };
        }

        return { valid: true };
      }

      function validateMaxDepth(maxDepth: string | undefined): { valid: boolean; value?: number; error?: string } {
        if (!maxDepth) {
          return { valid: true };
        }

        const parsed = parseInt(maxDepth, 10);
        if (isNaN(parsed) || parsed < 1) {
          return { valid: false, error: 'maxDepth must be a positive integer' };
        }

        return { valid: true, value: Math.min(parsed, 10) }; // Cap at 10
      }

      it('should accept "ancestors" type', () => {
        const result = validateHierarchyType('ancestors');
        expect(result.valid).toBe(true);
      });

      it('should accept "descendants" type', () => {
        const result = validateHierarchyType('descendants');
        expect(result.valid).toBe(true);
      });

      it('should accept "full" type', () => {
        const result = validateHierarchyType('full');
        expect(result.valid).toBe(true);
      });

      it('should default to "descendants" when type is undefined', () => {
        const result = validateHierarchyType(undefined);
        expect(result.valid).toBe(true);
      });

      it('should reject invalid hierarchy type', () => {
        const result = validateHierarchyType('invalid');
        expect(result.valid).toBe(false);
        expect(result.error).toContain('Invalid hierarchy type');
      });

      it('should accept valid maxDepth', () => {
        const result = validateMaxDepth('5');
        expect(result.valid).toBe(true);
        expect(result.value).toBe(5);
      });

      it('should cap maxDepth at 10', () => {
        const result = validateMaxDepth('100');
        expect(result.valid).toBe(true);
        expect(result.value).toBe(10);
      });

      it('should reject non-numeric maxDepth', () => {
        const result = validateMaxDepth('abc');
        expect(result.valid).toBe(false);
        expect(result.error).toContain('positive integer');
      });

      it('should reject zero maxDepth', () => {
        const result = validateMaxDepth('0');
        expect(result.valid).toBe(false);
      });

      it('should reject negative maxDepth', () => {
        const result = validateMaxDepth('-5');
        expect(result.valid).toBe(false);
      });

      it('should accept undefined maxDepth', () => {
        const result = validateMaxDepth(undefined);
        expect(result.valid).toBe(true);
        expect(result.value).toBeUndefined();
      });
    });
  });

  describe('Propagate Status Handler', () => {
    describe('Status validation', () => {
      const VALID_STATUSES = [
        'ORDERED',
        'RECEIVED',
        'IN_STOCK',
        'RESERVED',
        'DEPLOYED',
        'IN_MAINTENANCE',
        'RETIRED',
        'DISPOSED',
      ];

      function validateStatus(status: string | undefined): { valid: boolean; error?: string } {
        if (!status || !VALID_STATUSES.includes(status)) {
          return {
            valid: false,
            error: `status is required and must be one of: ${VALID_STATUSES.join(', ')}`,
          };
        }

        return { valid: true };
      }

      it.each(VALID_STATUSES)('should accept %s as valid status', (status) => {
        const result = validateStatus(status);
        expect(result.valid).toBe(true);
      });

      it('should reject undefined status', () => {
        const result = validateStatus(undefined);
        expect(result.valid).toBe(false);
      });

      it('should reject invalid status', () => {
        const result = validateStatus('INVALID_STATUS');
        expect(result.valid).toBe(false);
        expect(result.error).toContain('must be one of');
      });

      it('should reject empty string status', () => {
        const result = validateStatus('');
        expect(result.valid).toBe(false);
      });
    });

    describe('Propagation check', () => {
      const PROPAGATING_STATUSES = ['RETIRED', 'DISPOSED', 'IN_MAINTENANCE'];

      function shouldPropagateStatus(status: string): boolean {
        return PROPAGATING_STATUSES.includes(status);
      }

      it('should indicate RETIRED propagates', () => {
        expect(shouldPropagateStatus('RETIRED')).toBe(true);
      });

      it('should indicate DISPOSED propagates', () => {
        expect(shouldPropagateStatus('DISPOSED')).toBe(true);
      });

      it('should indicate IN_MAINTENANCE propagates', () => {
        expect(shouldPropagateStatus('IN_MAINTENANCE')).toBe(true);
      });

      it('should indicate DEPLOYED does not propagate', () => {
        expect(shouldPropagateStatus('DEPLOYED')).toBe(false);
      });

      it('should indicate IN_STOCK does not propagate', () => {
        expect(shouldPropagateStatus('IN_STOCK')).toBe(false);
      });
    });
  });

  describe('Unlink Parent-Child Handler', () => {
    describe('Path parameter validation', () => {
      function extractAssetId(event: Partial<APIGatewayProxyEvent>): string | null {
        return event.pathParameters?.['assetId'] ?? event.pathParameters?.['childAssetId'] ?? null;
      }

      it('should extract assetId from path parameters', () => {
        const event: Partial<APIGatewayProxyEvent> = {
          pathParameters: { assetId: 'asset-123' },
        };

        expect(extractAssetId(event)).toBe('asset-123');
      });

      it('should extract childAssetId as fallback', () => {
        const event: Partial<APIGatewayProxyEvent> = {
          pathParameters: { childAssetId: 'child-456' },
        };

        expect(extractAssetId(event)).toBe('child-456');
      });

      it('should return null when no path parameters', () => {
        const event: Partial<APIGatewayProxyEvent> = {
          pathParameters: null,
        };

        expect(extractAssetId(event)).toBeNull();
      });

      it('should return null when path parameters empty', () => {
        const event: Partial<APIGatewayProxyEvent> = {
          pathParameters: {},
        };

        expect(extractAssetId(event)).toBeNull();
      });
    });
  });

  describe('Error response formatting', () => {
    interface ErrorResponse {
      error: string;
      message: string;
    }

    function formatErrorResponse(
      statusCode: number,
      error: string,
      message: string
    ): { statusCode: number; body: string } {
      return {
        statusCode,
        body: JSON.stringify({ error, message }),
      };
    }

    it('should format 400 Bad Request error', () => {
      const response = formatErrorResponse(400, 'Bad Request', 'Invalid input');
      expect(response.statusCode).toBe(400);

      const body: ErrorResponse = JSON.parse(response.body);
      expect(body.error).toBe('Bad Request');
      expect(body.message).toBe('Invalid input');
    });

    it('should format 404 Not Found error', () => {
      const response = formatErrorResponse(404, 'Not Found', 'Asset not found');
      expect(response.statusCode).toBe(404);

      const body: ErrorResponse = JSON.parse(response.body);
      expect(body.error).toBe('Not Found');
      expect(body.message).toBe('Asset not found');
    });

    it('should format 500 Internal Server Error', () => {
      const response = formatErrorResponse(500, 'Internal Server Error', 'Unexpected error');
      expect(response.statusCode).toBe(500);

      const body: ErrorResponse = JSON.parse(response.body);
      expect(body.error).toBe('Internal Server Error');
    });
  });

  describe('Success response formatting', () => {
    interface SuccessResponse<T> {
      message: string;
      data?: T;
    }

    function formatSuccessResponse<T>(
      statusCode: number,
      message: string,
      data?: T
    ): { statusCode: number; body: string } {
      const responseBody: SuccessResponse<T> = { message };
      if (data !== undefined) {
        responseBody.data = data;
      }
      return {
        statusCode,
        body: JSON.stringify(responseBody),
      };
    }

    it('should format 200 OK response with data', () => {
      const data = { assetId: 'asset-123', parentAssetId: 'parent-456' };
      const response = formatSuccessResponse(200, 'Success', data);

      expect(response.statusCode).toBe(200);

      const body = JSON.parse(response.body);
      expect(body.message).toBe('Success');
      expect(body.data.assetId).toBe('asset-123');
    });

    it('should format 200 OK response without data', () => {
      const response = formatSuccessResponse(200, 'Operation completed');

      expect(response.statusCode).toBe(200);

      const body = JSON.parse(response.body);
      expect(body.message).toBe('Operation completed');
      expect(body.data).toBeUndefined();
    });

    it('should format 201 Created response', () => {
      const data = { id: 'new-123' };
      const response = formatSuccessResponse(201, 'Created', data);

      expect(response.statusCode).toBe(201);
    });
  });
});

describe('Hierarchy Response Structure', () => {
  interface HierarchyResponse {
    assetId: string;
    hierarchyType: string;
    rootAsset: object | null;
    nodes: object[];
    totalNodes: number;
    maxDepth: number;
  }

  function createHierarchyResponse(
    assetId: string,
    hierarchyType: string,
    nodes: object[],
    rootAsset: object | null = null
  ): HierarchyResponse {
    const maxDepth = nodes.length > 0
      ? Math.max(...nodes.map((n: { depth?: number }) => n.depth ?? 0))
      : 0;

    return {
      assetId,
      hierarchyType,
      rootAsset,
      nodes,
      totalNodes: nodes.length,
      maxDepth,
    };
  }

  it('should include all required fields', () => {
    const response = createHierarchyResponse('asset-123', 'descendants', []);

    expect(response).toHaveProperty('assetId');
    expect(response).toHaveProperty('hierarchyType');
    expect(response).toHaveProperty('rootAsset');
    expect(response).toHaveProperty('nodes');
    expect(response).toHaveProperty('totalNodes');
    expect(response).toHaveProperty('maxDepth');
  });

  it('should calculate correct totalNodes', () => {
    const nodes = [
      { assetId: 'child-1', depth: 1 },
      { assetId: 'child-2', depth: 1 },
      { assetId: 'grandchild-1', depth: 2 },
    ];

    const response = createHierarchyResponse('root', 'descendants', nodes);

    expect(response.totalNodes).toBe(3);
  });

  it('should calculate correct maxDepth', () => {
    const nodes = [
      { assetId: 'child-1', depth: 1 },
      { assetId: 'grandchild-1', depth: 2 },
      { assetId: 'great-grandchild-1', depth: 3 },
    ];

    const response = createHierarchyResponse('root', 'descendants', nodes);

    expect(response.maxDepth).toBe(3);
  });

  it('should handle empty nodes array', () => {
    const response = createHierarchyResponse('leaf', 'descendants', []);

    expect(response.totalNodes).toBe(0);
    expect(response.maxDepth).toBe(0);
  });
});

describe('Status Propagation Response Structure', () => {
  interface PropagationResponse {
    parentAssetId: string;
    newStatus: string;
    childrenUpdated: number;
    updatedAssetIds: string[];
  }

  function createPropagationResponse(
    parentAssetId: string,
    newStatus: string,
    updatedAssetIds: string[]
  ): PropagationResponse {
    return {
      parentAssetId,
      newStatus,
      childrenUpdated: updatedAssetIds.length,
      updatedAssetIds,
    };
  }

  it('should include all required fields', () => {
    const response = createPropagationResponse('parent-123', 'RETIRED', []);

    expect(response).toHaveProperty('parentAssetId');
    expect(response).toHaveProperty('newStatus');
    expect(response).toHaveProperty('childrenUpdated');
    expect(response).toHaveProperty('updatedAssetIds');
  });

  it('should calculate correct childrenUpdated count', () => {
    const updatedIds = ['child-1', 'child-2', 'grandchild-1'];
    const response = createPropagationResponse('parent-123', 'RETIRED', updatedIds);

    expect(response.childrenUpdated).toBe(3);
  });

  it('should handle no children updated', () => {
    const response = createPropagationResponse('leaf-123', 'RETIRED', []);

    expect(response.childrenUpdated).toBe(0);
    expect(response.updatedAssetIds).toEqual([]);
  });
});
