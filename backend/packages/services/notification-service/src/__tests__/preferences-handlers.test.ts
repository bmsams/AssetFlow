/**
 * Notification Preferences Handlers Unit Tests
 *
 * Tests for get-preferences and update-preferences Lambda handlers:
 * - User notification preferences per event type (Requirement 17.2)
 * - Notification batching to prevent alert fatigue (Requirement 17.9)
 */

// Mock the dependencies before importing handlers
jest.mock('@ams/database', () => ({
  queryOne: jest.fn(),
  queryMany: jest.fn(),
  withTransaction: jest.fn((fn) =>
    fn({
      queryOne: jest.fn(),
      queryMany: jest.fn(),
    })
  ),
}));

jest.mock('@ams/cache', () => ({
  del: jest.fn().mockResolvedValue(undefined),
  get: jest.fn().mockResolvedValue(null),
  set: jest.fn().mockResolvedValue(undefined),
  entityKey: jest.fn((entityType: string, id: string) => `${entityType}:${id}`),
  CACHE_ENTITY_TYPES: {
    NOTIFICATION_PREFERENCES: 'notification-prefs',
    NOTIFICATION: 'notification',
    REPORT: 'report',
  },
  DEFAULT_TTL: {
    MEDIUM: 300,
  },
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
  validateUUID: jest.fn((value: string) => {
    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
    if (!value || !uuidRegex.test(value)) {
      return { message: `must be a valid UUID` };
    }
    return null;
  }),
}));

import type { APIGatewayProxyEvent } from 'aws-lambda';
import { handler as getPreferencesHandler } from '../handlers/get-preferences';
import { handler as updatePreferencesHandler } from '../handlers/update-preferences';
import * as preferencesRepository from '../preferences/preferences-repository';

/**
 * Create a mock API Gateway event
 */
function createMockEvent(overrides: Partial<APIGatewayProxyEvent> = {}): APIGatewayProxyEvent {
  return {
    body: null,
    headers: {},
    multiValueHeaders: {},
    httpMethod: 'GET',
    isBase64Encoded: false,
    path: '/users/123e4567-e89b-42d3-a456-426614174000/notification-preferences',
    pathParameters: {
      userId: '123e4567-e89b-42d3-a456-426614174000',
    },
    queryStringParameters: null,
    multiValueQueryStringParameters: null,
    stageVariables: null,
    requestContext: {
      accountId: '123456789012',
      apiId: 'api-id',
      authorizer: {
        claims: {
          sub: '123e4567-e89b-42d3-a456-426614174000',
        },
      },
      httpMethod: 'GET',
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
      path: '/users/123e4567-e89b-42d3-a456-426614174000/notification-preferences',
      protocol: 'HTTP/1.1',
      requestId: 'request-id',
      requestTimeEpoch: Date.now(),
      resourceId: 'resource-id',
      resourcePath: '/users/{userId}/notification-preferences',
      stage: 'test',
    },
    resource: '/users/{userId}/notification-preferences',
    ...overrides,
  };
}

describe('Get Preferences Handler', () => {
  const testUserId = '123e4567-e89b-42d3-a456-426614174000';

  beforeEach(() => {
    jest.clearAllMocks();
    preferencesRepository.resetStores();
  });

  /**
   * Validates: Requirement 17.2
   * Users should be able to retrieve their notification preferences
   */
  it('should return user preferences successfully', async () => {
    const event = createMockEvent();

    const result = await getPreferencesHandler(event);

    expect(result.statusCode).toBe(200);

    const body = JSON.parse(result.body);
    expect(body.data).toBeDefined();
    expect(body.data.userId).toBe(testUserId);
    expect(body.data.globalEnabled).toBe(true);
  });

  it('should return 400 when userId is missing', async () => {
    const event = createMockEvent({
      pathParameters: {},
    });

    const result = await getPreferencesHandler(event);

    expect(result.statusCode).toBe(400);

    const body = JSON.parse(result.body);
    expect(body.error.message).toContain('userId');
  });

  it('should return 400 for invalid userId format', async () => {
    const event = createMockEvent({
      pathParameters: {
        userId: 'invalid-uuid',
      },
    });

    const result = await getPreferencesHandler(event);

    expect(result.statusCode).toBe(400);

    const body = JSON.parse(result.body);
    expect(body.error.message).toContain('UUID');
  });

  it('should return 403 when accessing another users preferences', async () => {
    const event = createMockEvent({
      pathParameters: {
        userId: '123e4567-e89b-42d3-a456-426614174999', // Different user
      },
      requestContext: {
        ...createMockEvent().requestContext,
        authorizer: {
          claims: {
            sub: '123e4567-e89b-42d3-a456-426614174000', // Authenticated as different user
          },
        },
      },
    });

    const result = await getPreferencesHandler(event);

    expect(result.statusCode).toBe(403);

    const body = JSON.parse(result.body);
    expect(body.error.message).toContain('own notification preferences');
  });

  it('should allow admin to access any users preferences', async () => {
    const event = createMockEvent({
      pathParameters: {
        userId: '123e4567-e89b-42d3-a456-426614174999', // Different user
      },
      requestContext: {
        ...createMockEvent().requestContext,
        authorizer: {
          claims: {
            sub: '123e4567-e89b-42d3-a456-426614174000',
            'custom:role': 'ADMIN',
          },
        },
      },
    });

    const result = await getPreferencesHandler(event);

    expect(result.statusCode).toBe(200);
  });
});

describe('Update Preferences Handler', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    preferencesRepository.resetStores();
  });

  /**
   * Validates: Requirement 17.2
   * Users should be able to update their notification preferences
   */
  it('should update preferences successfully', async () => {
    const event = createMockEvent({
      httpMethod: 'PUT',
      body: JSON.stringify({
        globalEnabled: false,
      }),
    });

    const result = await updatePreferencesHandler(event);

    expect(result.statusCode).toBe(200);

    const body = JSON.parse(result.body);
    expect(body.data.globalEnabled).toBe(false);
  });

  /**
   * Validates: Requirement 17.2
   * Users should be able to configure preferences per event type
   */
  it('should update event-specific preferences', async () => {
    const event = createMockEvent({
      httpMethod: 'PUT',
      body: JSON.stringify({
        eventPreferences: [
          {
            eventType: 'CONTRACT_EXPIRING',
            enabled: false,
          },
        ],
      }),
    });

    const result = await updatePreferencesHandler(event);

    expect(result.statusCode).toBe(200);

    const body = JSON.parse(result.body);
    const contractPref = body.data.eventPreferences.find(
      (ep: { eventType: string }) => ep.eventType === 'CONTRACT_EXPIRING'
    );
    expect(contractPref.enabled).toBe(false);
  });

  /**
   * Validates: Requirement 17.9
   * Users should be able to configure batching settings
   */
  it('should update batching configuration', async () => {
    const event = createMockEvent({
      httpMethod: 'PUT',
      body: JSON.stringify({
        batchingConfig: {
          enabled: true,
          maxBatchSize: 100,
          digestFormat: 'DETAILED',
        },
      }),
    });

    const result = await updatePreferencesHandler(event);

    expect(result.statusCode).toBe(200);

    const body = JSON.parse(result.body);
    expect(body.data.batchingConfig.maxBatchSize).toBe(100);
    expect(body.data.batchingConfig.digestFormat).toBe('DETAILED');
  });

  it('should return 400 when userId is missing', async () => {
    const event = createMockEvent({
      httpMethod: 'PUT',
      pathParameters: {},
      body: JSON.stringify({ globalEnabled: false }),
    });

    const result = await updatePreferencesHandler(event);

    expect(result.statusCode).toBe(400);
  });

  it('should return 400 for invalid JSON body', async () => {
    const event = createMockEvent({
      httpMethod: 'PUT',
      body: 'invalid json',
    });

    const result = await updatePreferencesHandler(event);

    expect(result.statusCode).toBe(400);

    const body = JSON.parse(result.body);
    expect(body.error.message).toContain('Invalid JSON');
  });

  it('should return 400 for invalid frequency value', async () => {
    const event = createMockEvent({
      httpMethod: 'PUT',
      body: JSON.stringify({
        defaultFrequency: 'INVALID_FREQUENCY',
      }),
    });

    const result = await updatePreferencesHandler(event);

    expect(result.statusCode).toBe(400);

    const body = JSON.parse(result.body);
    expect(body.error.details).toBeDefined();
  });

  it('should return 400 for invalid channel value', async () => {
    const event = createMockEvent({
      httpMethod: 'PUT',
      body: JSON.stringify({
        defaultChannels: ['INVALID_CHANNEL'],
      }),
    });

    const result = await updatePreferencesHandler(event);

    expect(result.statusCode).toBe(400);
  });

  it('should return 400 for invalid event type', async () => {
    const event = createMockEvent({
      httpMethod: 'PUT',
      body: JSON.stringify({
        eventPreferences: [
          {
            eventType: 'INVALID_EVENT_TYPE',
            enabled: false,
          },
        ],
      }),
    });

    const result = await updatePreferencesHandler(event);

    expect(result.statusCode).toBe(400);
  });

  it('should return 400 for invalid quiet hours time format', async () => {
    const event = createMockEvent({
      httpMethod: 'PUT',
      body: JSON.stringify({
        quietHours: {
          startTime: '25:00', // Invalid
        },
      }),
    });

    const result = await updatePreferencesHandler(event);

    expect(result.statusCode).toBe(400);

    const body = JSON.parse(result.body);
    expect(body.error.details?.some((d: { message: string }) => d.message.includes('HH:MM'))).toBe(true);
  });

  it('should return 400 for invalid batching config values', async () => {
    const event = createMockEvent({
      httpMethod: 'PUT',
      body: JSON.stringify({
        batchingConfig: {
          maxBatchSize: 0, // Invalid - must be positive
        },
      }),
    });

    const result = await updatePreferencesHandler(event);

    expect(result.statusCode).toBe(400);
  });

  it('should return 403 when updating another users preferences', async () => {
    const event = createMockEvent({
      httpMethod: 'PUT',
      pathParameters: {
        userId: '123e4567-e89b-42d3-a456-426614174999', // Different user
      },
      body: JSON.stringify({ globalEnabled: false }),
      requestContext: {
        ...createMockEvent().requestContext,
        authorizer: {
          claims: {
            sub: '123e4567-e89b-42d3-a456-426614174000',
          },
        },
      },
    });

    const result = await updatePreferencesHandler(event);

    expect(result.statusCode).toBe(403);
  });

  it('should allow admin to update any users preferences', async () => {
    const event = createMockEvent({
      httpMethod: 'PUT',
      pathParameters: {
        userId: '123e4567-e89b-42d3-a456-426614174999', // Different user
      },
      body: JSON.stringify({ globalEnabled: false }),
      requestContext: {
        ...createMockEvent().requestContext,
        authorizer: {
          claims: {
            sub: '123e4567-e89b-42d3-a456-426614174000',
            'custom:role': 'ADMIN',
          },
        },
      },
    });

    const result = await updatePreferencesHandler(event);

    expect(result.statusCode).toBe(200);
  });
});
