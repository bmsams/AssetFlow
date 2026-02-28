/**
 * Approval Workflow Handlers Unit Tests
 *
 * Tests for approval workflow Lambda handlers:
 * - route-for-approval handler (Requirement 6B.4)
 * - approve-request handler (Requirement 6B.5, 6B.6)
 * - reject-request handler (Requirement 6B.5)
 */

import type { APIGatewayProxyEvent } from 'aws-lambda';

// Mock the dependencies before importing handlers
jest.mock('@ams/database', () => ({
  queryOne: jest.fn(),
  queryMany: jest.fn(),
  resolveUserIdFromAuthId: jest.fn(async () => '123e4567-e89b-12d3-a456-426614174000'),
  ensureUserIdFromAuthClaims: jest.fn(async () => '123e4567-e89b-12d3-a456-426614174000'),
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
  validateUUID: (value: string, fieldName: string) => {
    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
    if (!uuidRegex.test(value)) {
      return { message: `${fieldName} must be a valid UUID` };
    }
    return null;
  },
}));

jest.mock('@ams/types', () => ({
  API_ERROR_CODES: {
    BAD_REQUEST: 'BAD_REQUEST',
    UNAUTHORIZED: 'UNAUTHORIZED',
    FORBIDDEN: 'FORBIDDEN',
    NOT_FOUND: 'NOT_FOUND',
    CONFLICT: 'CONFLICT',
    VALIDATION_ERROR: 'VALIDATION_ERROR',
    INTERNAL_ERROR: 'INTERNAL_ERROR',
  },
  HTTP_STATUS: {
    OK: 200,
    CREATED: 201,
    BAD_REQUEST: 400,
    UNAUTHORIZED: 401,
    FORBIDDEN: 403,
    NOT_FOUND: 404,
    CONFLICT: 409,
    INTERNAL_SERVER_ERROR: 500,
  },
  createApiResponse: (data: unknown, requestId: string) => ({
    success: true,
    data,
    requestId,
  }),
  createErrorResponse: (code: string, message: string, requestId: string, errors?: unknown[]) => ({
    success: false,
    error: { code, message, errors },
    requestId,
  }),
  createLambdaResponse: (statusCode: number, body: unknown) => ({
    statusCode,
    body: JSON.stringify(body),
    headers: { 'Content-Type': 'application/json' },
  }),
}));

// Mock the service
jest.mock('../approval-workflow/approval-workflow-service', () => ({
  routeForApproval: jest.fn(),
  approveRequest: jest.fn(),
  rejectRequest: jest.fn(),
  delegateApproval: jest.fn(),
}));

import { handler as routeForApprovalHandler } from '../handlers/route-for-approval';
import { handler as approveRequestHandler } from '../handlers/approve-request';
import { handler as rejectRequestHandler } from '../handlers/reject-request';
import * as approvalWorkflowService from '../approval-workflow/approval-workflow-service';

const mockApprovalWorkflowService = approvalWorkflowService as jest.Mocked<typeof approvalWorkflowService>;

/**
 * Create a mock API Gateway event
 */
function createMockEvent(overrides: Partial<APIGatewayProxyEvent> = {}): APIGatewayProxyEvent {
  return {
    body: null,
    headers: {},
    multiValueHeaders: {},
    httpMethod: 'POST',
    isBase64Encoded: false,
    path: '/approvals',
    pathParameters: null,
    queryStringParameters: null,
    multiValueQueryStringParameters: null,
    stageVariables: null,
    requestContext: {
      accountId: '123456789012',
      apiId: 'api-id',
      authorizer: {
        claims: {
          sub: '123e4567-e89b-12d3-a456-426614174000',
        },
      },
      protocol: 'HTTP/1.1',
      httpMethod: 'POST',
      identity: {
        accessKey: null,
        accountId: null,
        apiKey: null,
        apiKeyId: null,
        caller: null,
        clientCert: null,
        cognitoAuthenticationProvider: null,
        cognitoAuthenticationType: null,
        cognitoIdentityId: null,
        cognitoIdentityPoolId: null,
        principalOrgId: null,
        sourceIp: '127.0.0.1',
        user: null,
        userAgent: 'test',
        userArn: null,
      },
      path: '/approvals',
      stage: 'test',
      requestId: 'test-request-id',
      requestTimeEpoch: Date.now(),
      resourceId: 'resource-id',
      resourcePath: '/approvals',
    },
    resource: '/approvals',
    ...overrides,
  };
}

describe('Route For Approval Handler', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('should route a request for approval successfully', async () => {
    const mockResult = {
      workflow: { workflowId: 'workflow-1', requestId: '123e4567-e89b-12d3-a456-426614174001' },
      steps: [{ stepId: 'step-1', stepLevel: 1 }],
      matchedRules: [],
      approverCount: 1,
      levelCount: 1,
    };

    mockApprovalWorkflowService.routeForApproval.mockResolvedValue(mockResult as any);

    const event = createMockEvent({
      body: JSON.stringify({
        requestId: '123e4567-e89b-12d3-a456-426614174001',
        requestType: 'STANDARD',
        estimatedCost: 5000,
      }),
    });

    const response = await routeForApprovalHandler(event);

    expect(response.statusCode).toBe(201);
    const body = JSON.parse(response.body);
    expect(body.data.workflow.workflowId).toBe('workflow-1');
  });

  it('should return 401 when user not authenticated', async () => {
    const event = createMockEvent({
      requestContext: {
        ...createMockEvent().requestContext,
        authorizer: {},
      },
    });

    const response = await routeForApprovalHandler(event);

    expect(response.statusCode).toBe(401);
  });

  it('should return 400 when requestId is missing', async () => {
    const event = createMockEvent({
      body: JSON.stringify({ requestType: 'STANDARD' }),
    });

    const response = await routeForApprovalHandler(event);

    expect(response.statusCode).toBe(400);
  });

  it('should return 400 when requestId is invalid UUID', async () => {
    const event = createMockEvent({
      body: JSON.stringify({ requestId: 'invalid-uuid', requestType: 'STANDARD' }),
    });

    const response = await routeForApprovalHandler(event);

    expect(response.statusCode).toBe(400);
  });

  it('should return 400 for invalid JSON', async () => {
    const event = createMockEvent({ body: 'invalid json' });

    const response = await routeForApprovalHandler(event);

    expect(response.statusCode).toBe(400);
  });
});

describe('Approve Request Handler', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('should approve a request successfully', async () => {
    const mockResult = {
      workflow: { workflowId: 'workflow-1', status: 'IN_PROGRESS' },
      step: { stepId: 'step-1', status: 'APPROVED' },
      approved: true,
      message: 'Approved at level 1',
      isComplete: false,
    };

    mockApprovalWorkflowService.approveRequest.mockResolvedValue(mockResult as any);

    const event = createMockEvent({
      pathParameters: { requestId: '123e4567-e89b-12d3-a456-426614174001' },
      body: JSON.stringify({ reason: 'Approved for business need' }),
    });

    const response = await approveRequestHandler(event);

    expect(response.statusCode).toBe(200);
    const body = JSON.parse(response.body);
    expect(body.data.approved).toBe(true);
  });

  it('should delegate approval when action is delegate', async () => {
    const mockResult = {
      workflow: { workflowId: 'workflow-1', status: 'DELEGATED' },
      step: { stepId: 'step-1', status: 'DELEGATED' },
      approved: false,
      message: 'Delegated to user',
      isComplete: false,
    };

    mockApprovalWorkflowService.delegateApproval.mockResolvedValue(mockResult as any);

    const event = createMockEvent({
      pathParameters: { requestId: '123e4567-e89b-12d3-a456-426614174001' },
      queryStringParameters: { action: 'delegate' },
      body: JSON.stringify({
        delegatedTo: '123e4567-e89b-12d3-a456-426614174002',
        reason: 'Out of office',
      }),
    });

    const response = await approveRequestHandler(event);

    expect(response.statusCode).toBe(200);
    expect(mockApprovalWorkflowService.delegateApproval).toHaveBeenCalled();
  });

  it('should return 400 when requestId is missing', async () => {
    const event = createMockEvent({ pathParameters: {} });

    const response = await approveRequestHandler(event);

    expect(response.statusCode).toBe(400);
  });

  it('should return 404 when workflow not found', async () => {
    mockApprovalWorkflowService.approveRequest.mockRejectedValue(
      new Error('No approval workflow found for request')
    );

    const event = createMockEvent({
      pathParameters: { requestId: '123e4567-e89b-12d3-a456-426614174001' },
    });

    const response = await approveRequestHandler(event);

    expect(response.statusCode).toBe(404);
  });

  it('should return 403 when user not authorized', async () => {
    mockApprovalWorkflowService.approveRequest.mockRejectedValue(
      new Error('User is not authorized to approve this step')
    );

    const event = createMockEvent({
      pathParameters: { requestId: '123e4567-e89b-12d3-a456-426614174001' },
    });

    const response = await approveRequestHandler(event);

    expect(response.statusCode).toBe(403);
  });
});

describe('Reject Request Handler', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('should reject a request successfully', async () => {
    const mockResult = {
      workflow: { workflowId: 'workflow-1', status: 'REJECTED' },
      step: { stepId: 'step-1', status: 'REJECTED' },
      approved: false,
      message: 'Request rejected',
      isComplete: true,
    };

    mockApprovalWorkflowService.rejectRequest.mockResolvedValue(mockResult as any);

    const event = createMockEvent({
      pathParameters: { requestId: '123e4567-e89b-12d3-a456-426614174001' },
      body: JSON.stringify({ rejectionReason: 'Budget constraints' }),
    });

    const response = await rejectRequestHandler(event);

    expect(response.statusCode).toBe(200);
    const body = JSON.parse(response.body);
    expect(body.data.approved).toBe(false);
    expect(body.data.isComplete).toBe(true);
  });

  it('should return 400 when rejectionReason is missing', async () => {
    const event = createMockEvent({
      pathParameters: { requestId: '123e4567-e89b-12d3-a456-426614174001' },
      body: JSON.stringify({}),
    });

    const response = await rejectRequestHandler(event);

    expect(response.statusCode).toBe(400);
  });

  it('should return 400 when rejectionReason is empty', async () => {
    const event = createMockEvent({
      pathParameters: { requestId: '123e4567-e89b-12d3-a456-426614174001' },
      body: JSON.stringify({ rejectionReason: '   ' }),
    });

    const response = await rejectRequestHandler(event);

    expect(response.statusCode).toBe(400);
  });

  it('should return 400 when requestId is missing', async () => {
    const event = createMockEvent({
      pathParameters: {},
      body: JSON.stringify({ rejectionReason: 'Test reason' }),
    });

    const response = await rejectRequestHandler(event);

    expect(response.statusCode).toBe(400);
  });

  it('should return 404 when workflow not found', async () => {
    mockApprovalWorkflowService.rejectRequest.mockRejectedValue(
      new Error('No approval workflow found for request')
    );

    const event = createMockEvent({
      pathParameters: { requestId: '123e4567-e89b-12d3-a456-426614174001' },
      body: JSON.stringify({ rejectionReason: 'Test reason' }),
    });

    const response = await rejectRequestHandler(event);

    expect(response.statusCode).toBe(404);
  });

  it('should return 403 when user not authorized', async () => {
    mockApprovalWorkflowService.rejectRequest.mockRejectedValue(
      new Error('User is not authorized to reject this step')
    );

    const event = createMockEvent({
      pathParameters: { requestId: '123e4567-e89b-12d3-a456-426614174001' },
      body: JSON.stringify({ rejectionReason: 'Test reason' }),
    });

    const response = await rejectRequestHandler(event);

    expect(response.statusCode).toBe(403);
  });
});

