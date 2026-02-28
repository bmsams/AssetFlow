/**
 * Validation Middleware Tests
 * 
 * Tests for request validation middleware including body, query,
 * path parameter, and header validation.
 * 
 * Validates: Requirements 8.5
 */

import type { APIGatewayProxyEvent, APIGatewayProxyResult } from 'aws-lambda';

import {
  createSchemaValidator,
  getValidatedBody,
  getValidatedPathParams,
  getValidatedQueryParams,
  RequestValidationError,
  SchemaValidator,
  validateRequest,
  validateRequestBody,
  validateSchema,
  withBodyValidation,
  withPathValidation,
  withQueryValidation,
  withValidation,
  type EndpointValidationSchema,
  type JsonSchema,
} from '../index';

// Mock logger
jest.mock('@ams/utils', () => ({
  createLogger: () => ({
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
    debug: jest.fn(),
  }),
}));

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
    path: '/test',
    pathParameters: null,
    queryStringParameters: null,
    multiValueQueryStringParameters: null,
    stageVariables: null,
    requestContext: {
      accountId: '123456789012',
      apiId: 'test-api',
      authorizer: null,
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
        userAgent: 'test-agent',
        userArn: null,
      },
      path: '/test',
      stage: 'test',
      requestId: 'test-request-id',
      requestTimeEpoch: Date.now(),
      resourceId: 'test-resource',
      resourcePath: '/test',
    },
    resource: '/test',
    ...overrides,
  };
}

describe('SchemaValidator', () => {
  let validator: SchemaValidator;

  beforeEach(() => {
    validator = createSchemaValidator();
  });

  describe('type validation', () => {
    it('should validate string type', () => {
      const schema: JsonSchema = { type: 'string' };
      
      expect(validator.validate('hello', schema).isValid).toBe(true);
      expect(validator.validate(123, schema).isValid).toBe(false);
    });

    it('should validate number type', () => {
      const schema: JsonSchema = { type: 'number' };
      
      expect(validator.validate(123, schema).isValid).toBe(true);
      expect(validator.validate(123.45, schema).isValid).toBe(true);
      expect(validator.validate('123', schema).isValid).toBe(false);
    });

    it('should validate integer type', () => {
      const schema: JsonSchema = { type: 'integer' };
      
      expect(validator.validate(123, schema).isValid).toBe(true);
      expect(validator.validate(123.45, schema).isValid).toBe(false);
    });

    it('should validate boolean type', () => {
      const schema: JsonSchema = { type: 'boolean' };
      
      expect(validator.validate(true, schema).isValid).toBe(true);
      expect(validator.validate(false, schema).isValid).toBe(true);
      expect(validator.validate('true', schema).isValid).toBe(false);
    });

    it('should validate array type', () => {
      const schema: JsonSchema = { type: 'array' };
      
      expect(validator.validate([], schema).isValid).toBe(true);
      expect(validator.validate([1, 2, 3], schema).isValid).toBe(true);
      expect(validator.validate('not an array', schema).isValid).toBe(false);
    });

    it('should validate object type', () => {
      const schema: JsonSchema = { type: 'object' };
      
      expect(validator.validate({}, schema).isValid).toBe(true);
      expect(validator.validate({ key: 'value' }, schema).isValid).toBe(true);
      expect(validator.validate('not an object', schema).isValid).toBe(false);
    });
  });

  describe('required fields', () => {
    it('should validate required fields', () => {
      const schema: JsonSchema = {
        type: 'object',
        required: ['name', 'email'],
        properties: {
          name: { type: 'string' },
          email: { type: 'string' },
        },
      };

      const validResult = validator.validate({ name: 'John', email: 'john@example.com' }, schema);
      expect(validResult.isValid).toBe(true);

      const invalidResult = validator.validate({ name: 'John' }, schema);
      expect(invalidResult.isValid).toBe(false);
      expect(invalidResult.errors).toHaveLength(1);
      expect(invalidResult.errors[0]?.field).toBe('email');
      expect(invalidResult.errors[0]?.code).toBe('REQUIRED');
    });

    it('should report multiple missing required fields', () => {
      const schema: JsonSchema = {
        type: 'object',
        required: ['name', 'email', 'age'],
        properties: {
          name: { type: 'string' },
          email: { type: 'string' },
          age: { type: 'integer' },
        },
      };

      const result = validator.validate({}, schema);
      expect(result.isValid).toBe(false);
      expect(result.errors).toHaveLength(3);
    });
  });

  describe('format validation', () => {
    it('should validate email format', () => {
      const schema: JsonSchema = { type: 'string', format: 'email' };

      expect(validator.validate('test@example.com', schema).isValid).toBe(true);
      expect(validator.validate('invalid-email', schema).isValid).toBe(false);
    });

    it('should validate uuid format', () => {
      const schema: JsonSchema = { type: 'string', format: 'uuid' };

      expect(validator.validate('550e8400-e29b-41d4-a716-446655440000', schema).isValid).toBe(true);
      expect(validator.validate('not-a-uuid', schema).isValid).toBe(false);
    });

    it('should validate date-time format', () => {
      const schema: JsonSchema = { type: 'string', format: 'date-time' };

      expect(validator.validate('2024-01-15T10:30:00Z', schema).isValid).toBe(true);
      expect(validator.validate('not-a-date', schema).isValid).toBe(false);
    });

    it('should validate uri format', () => {
      const schema: JsonSchema = { type: 'string', format: 'uri' };

      expect(validator.validate('https://example.com/path', schema).isValid).toBe(true);
      expect(validator.validate('not a uri', schema).isValid).toBe(false);
    });
  });

  describe('string constraints', () => {
    it('should validate minLength', () => {
      const schema: JsonSchema = { type: 'string', minLength: 3 };

      expect(validator.validate('abc', schema).isValid).toBe(true);
      expect(validator.validate('ab', schema).isValid).toBe(false);
    });

    it('should validate maxLength', () => {
      const schema: JsonSchema = { type: 'string', maxLength: 5 };

      expect(validator.validate('hello', schema).isValid).toBe(true);
      expect(validator.validate('hello world', schema).isValid).toBe(false);
    });

    it('should validate pattern', () => {
      const schema: JsonSchema = { type: 'string', pattern: '^[A-Z]{3}-\\d{4}$' };

      expect(validator.validate('ABC-1234', schema).isValid).toBe(true);
      expect(validator.validate('abc-1234', schema).isValid).toBe(false);
      expect(validator.validate('ABCD-1234', schema).isValid).toBe(false);
    });
  });

  describe('number constraints', () => {
    it('should validate minimum', () => {
      const schema: JsonSchema = { type: 'number', minimum: 0 };

      expect(validator.validate(0, schema).isValid).toBe(true);
      expect(validator.validate(10, schema).isValid).toBe(true);
      expect(validator.validate(-1, schema).isValid).toBe(false);
    });

    it('should validate maximum', () => {
      const schema: JsonSchema = { type: 'number', maximum: 100 };

      expect(validator.validate(100, schema).isValid).toBe(true);
      expect(validator.validate(50, schema).isValid).toBe(true);
      expect(validator.validate(101, schema).isValid).toBe(false);
    });

    it('should validate exclusiveMinimum', () => {
      const schema: JsonSchema = { type: 'number', exclusiveMinimum: 0 };

      expect(validator.validate(1, schema).isValid).toBe(true);
      expect(validator.validate(0, schema).isValid).toBe(false);
    });

    it('should validate exclusiveMaximum', () => {
      const schema: JsonSchema = { type: 'number', exclusiveMaximum: 100 };

      expect(validator.validate(99, schema).isValid).toBe(true);
      expect(validator.validate(100, schema).isValid).toBe(false);
    });
  });

  describe('array constraints', () => {
    it('should validate minItems', () => {
      const schema: JsonSchema = { type: 'array', minItems: 2 };

      expect(validator.validate([1, 2], schema).isValid).toBe(true);
      expect(validator.validate([1], schema).isValid).toBe(false);
    });

    it('should validate maxItems', () => {
      const schema: JsonSchema = { type: 'array', maxItems: 3 };

      expect(validator.validate([1, 2, 3], schema).isValid).toBe(true);
      expect(validator.validate([1, 2, 3, 4], schema).isValid).toBe(false);
    });

    it('should validate uniqueItems', () => {
      const schema: JsonSchema = { type: 'array', uniqueItems: true };

      expect(validator.validate([1, 2, 3], schema).isValid).toBe(true);
      expect(validator.validate([1, 2, 2], schema).isValid).toBe(false);
    });

    it('should validate array items schema', () => {
      const schema: JsonSchema = {
        type: 'array',
        items: { type: 'string' },
      };

      expect(validator.validate(['a', 'b', 'c'], schema).isValid).toBe(true);
      expect(validator.validate(['a', 1, 'c'], schema).isValid).toBe(false);
    });
  });

  describe('enum validation', () => {
    it('should validate enum values', () => {
      const schema: JsonSchema = {
        type: 'string',
        enum: ['HARDWARE', 'SOFTWARE', 'ENTERPRISE'],
      };

      expect(validator.validate('HARDWARE', schema).isValid).toBe(true);
      expect(validator.validate('SOFTWARE', schema).isValid).toBe(true);
      expect(validator.validate('INVALID', schema).isValid).toBe(false);
    });
  });

  describe('nested object validation', () => {
    it('should validate nested objects', () => {
      const schema: JsonSchema = {
        type: 'object',
        required: ['user'],
        properties: {
          user: {
            type: 'object',
            required: ['name', 'email'],
            properties: {
              name: { type: 'string', minLength: 1 },
              email: { type: 'string', format: 'email' },
            },
          },
        },
      };

      const validData = {
        user: {
          name: 'John',
          email: 'john@example.com',
        },
      };
      expect(validator.validate(validData, schema).isValid).toBe(true);

      const invalidData = {
        user: {
          name: '',
          email: 'invalid',
        },
      };
      const result = validator.validate(invalidData, schema);
      expect(result.isValid).toBe(false);
      expect(result.errors.length).toBeGreaterThan(0);
    });
  });

  describe('additional properties', () => {
    it('should reject additional properties by default', () => {
      const schema: JsonSchema = {
        type: 'object',
        properties: {
          name: { type: 'string' },
        },
        additionalProperties: false,
      };

      expect(validator.validate({ name: 'John' }, schema).isValid).toBe(true);
      expect(validator.validate({ name: 'John', extra: 'field' }, schema).isValid).toBe(false);
    });
  });
});

describe('validateSchema', () => {
  it('should validate using convenience function', () => {
    const schema: JsonSchema = {
      type: 'object',
      required: ['name'],
      properties: {
        name: { type: 'string' },
      },
    };

    expect(validateSchema({ name: 'test' }, schema).isValid).toBe(true);
    expect(validateSchema({}, schema).isValid).toBe(false);
  });
});

describe('validateRequestBody', () => {
  it('should validate JSON body', () => {
    const schema: JsonSchema = {
      type: 'object',
      required: ['name'],
      properties: {
        name: { type: 'string' },
      },
    };

    const validResult = validateRequestBody(JSON.stringify({ name: 'test' }), schema);
    expect(validResult.isValid).toBe(true);

    const invalidResult = validateRequestBody(JSON.stringify({}), schema);
    expect(invalidResult.isValid).toBe(false);
  });

  it('should handle invalid JSON', () => {
    const schema: JsonSchema = { type: 'object' };
    const result = validateRequestBody('not valid json', schema);
    
    expect(result.isValid).toBe(false);
    expect(result.errors[0]?.code).toBe('INVALID_JSON');
  });

  it('should handle null body', () => {
    const schema: JsonSchema = { type: 'object' };
    const result = validateRequestBody(null, schema);
    
    expect(result.isValid).toBe(true);
  });
});

describe('validateRequest', () => {
  let validator: SchemaValidator;

  beforeEach(() => {
    validator = createSchemaValidator();
  });

  it('should validate body', () => {
    const schemas: EndpointValidationSchema = {
      body: {
        type: 'object',
        required: ['name'],
        properties: {
          name: { type: 'string' },
        },
      },
    };

    const validEvent = createMockEvent({
      body: JSON.stringify({ name: 'test' }),
    });
    expect(validateRequest(validEvent, schemas, validator).isValid).toBe(true);

    const invalidEvent = createMockEvent({
      body: JSON.stringify({}),
    });
    expect(validateRequest(invalidEvent, schemas, validator).isValid).toBe(false);
  });

  it('should validate query parameters', () => {
    const schemas: EndpointValidationSchema = {
      queryStringParameters: {
        type: 'object',
        required: ['page'],
        properties: {
          page: { type: 'integer', minimum: 1 },
          limit: { type: 'integer', minimum: 1, maximum: 100 },
        },
      },
    };

    const validEvent = createMockEvent({
      queryStringParameters: { page: '1', limit: '10' },
    });
    expect(validateRequest(validEvent, schemas, validator).isValid).toBe(true);

    const invalidEvent = createMockEvent({
      queryStringParameters: { limit: '10' },
    });
    expect(validateRequest(invalidEvent, schemas, validator).isValid).toBe(false);
  });

  it('should validate path parameters', () => {
    const schemas: EndpointValidationSchema = {
      pathParameters: {
        type: 'object',
        required: ['assetId'],
        properties: {
          assetId: { type: 'string', format: 'uuid' },
        },
      },
    };

    const validEvent = createMockEvent({
      pathParameters: { assetId: '550e8400-e29b-41d4-a716-446655440000' },
    });
    expect(validateRequest(validEvent, schemas, validator).isValid).toBe(true);

    const invalidEvent = createMockEvent({
      pathParameters: { assetId: 'not-a-uuid' },
    });
    expect(validateRequest(invalidEvent, schemas, validator).isValid).toBe(false);
  });

  it('should validate headers', () => {
    const schemas: EndpointValidationSchema = {
      headers: {
        type: 'object',
        required: ['x-api-key'],
        properties: {
          'x-api-key': { type: 'string', minLength: 10 },
        },
      },
    };

    const validEvent = createMockEvent({
      headers: { 'X-Api-Key': 'my-secret-api-key' },
    });
    expect(validateRequest(validEvent, schemas, validator).isValid).toBe(true);

    const invalidEvent = createMockEvent({
      headers: { 'X-Api-Key': 'short' },
    });
    expect(validateRequest(invalidEvent, schemas, validator).isValid).toBe(false);
  });

  it('should validate multiple targets', () => {
    const schemas: EndpointValidationSchema = {
      body: {
        type: 'object',
        required: ['name'],
        properties: {
          name: { type: 'string' },
        },
      },
      pathParameters: {
        type: 'object',
        required: ['id'],
        properties: {
          id: { type: 'string', format: 'uuid' },
        },
      },
    };

    const validEvent = createMockEvent({
      body: JSON.stringify({ name: 'test' }),
      pathParameters: { id: '550e8400-e29b-41d4-a716-446655440000' },
    });
    expect(validateRequest(validEvent, schemas, validator).isValid).toBe(true);

    const invalidEvent = createMockEvent({
      body: JSON.stringify({}),
      pathParameters: { id: 'invalid' },
    });
    const result = validateRequest(invalidEvent, schemas, validator);
    expect(result.isValid).toBe(false);
    expect(result.errors.length).toBe(2);
  });
});

describe('withValidation middleware', () => {
  const mockHandler = jest.fn<Promise<APIGatewayProxyResult>, [APIGatewayProxyEvent]>();

  beforeEach(() => {
    mockHandler.mockReset();
    mockHandler.mockResolvedValue({
      statusCode: 200,
      body: JSON.stringify({ success: true }),
    });
  });

  it('should pass valid requests to handler', async () => {
    const schemas: EndpointValidationSchema = {
      body: {
        type: 'object',
        required: ['name'],
        properties: {
          name: { type: 'string' },
        },
      },
    };

    const handler = withValidation(schemas)(mockHandler);
    const event = createMockEvent({
      body: JSON.stringify({ name: 'test' }),
    });

    const result = await handler(event);

    expect(result.statusCode).toBe(200);
    expect(mockHandler).toHaveBeenCalledWith(event);
  });

  it('should return 400 for invalid requests', async () => {
    const schemas: EndpointValidationSchema = {
      body: {
        type: 'object',
        required: ['name', 'email'],
        properties: {
          name: { type: 'string' },
          email: { type: 'string', format: 'email' },
        },
      },
    };

    const handler = withValidation(schemas)(mockHandler);
    const event = createMockEvent({
      body: JSON.stringify({ name: 'test' }),
    });

    const result = await handler(event);

    expect(result.statusCode).toBe(400);
    expect(mockHandler).not.toHaveBeenCalled();

    const body = JSON.parse(result.body);
    expect(body.error.code).toBe('VALIDATION_ERROR');
    expect(body.error.details).toHaveLength(1);
    expect(body.error.details[0].field).toBe('email');
    expect(body.error.details[0].code).toBe('REQUIRED');
  });

  it('should return standardized error format', async () => {
    const schemas: EndpointValidationSchema = {
      body: {
        type: 'object',
        required: ['email'],
        properties: {
          email: { type: 'string', format: 'email' },
        },
      },
    };

    const handler = withValidation(schemas)(mockHandler);
    const event = createMockEvent({
      body: JSON.stringify({ email: 'invalid-email' }),
    });

    const result = await handler(event);
    const body = JSON.parse(result.body);

    expect(body).toHaveProperty('error');
    expect(body.error).toHaveProperty('code', 'VALIDATION_ERROR');
    expect(body.error).toHaveProperty('message', 'Request validation failed');
    expect(body.error).toHaveProperty('details');
    expect(body.error).toHaveProperty('requestId', 'test-request-id');
    expect(body.error).toHaveProperty('timestamp');
    expect(body.error.details[0]).toHaveProperty('field');
    expect(body.error.details[0]).toHaveProperty('message');
    expect(body.error.details[0]).toHaveProperty('code');
  });

  it('should handle invalid JSON body', async () => {
    const schemas: EndpointValidationSchema = {
      body: {
        type: 'object',
        properties: {
          name: { type: 'string' },
        },
      },
    };

    const handler = withValidation(schemas)(mockHandler);
    const event = createMockEvent({
      body: 'not valid json',
    });

    const result = await handler(event);

    expect(result.statusCode).toBe(400);
    const body = JSON.parse(result.body);
    expect(body.error.details[0].code).toBe('INVALID_JSON');
  });
});

describe('withBodyValidation', () => {
  const mockHandler = jest.fn<Promise<APIGatewayProxyResult>, [APIGatewayProxyEvent]>();

  beforeEach(() => {
    mockHandler.mockReset();
    mockHandler.mockResolvedValue({
      statusCode: 200,
      body: JSON.stringify({ success: true }),
    });
  });

  it('should validate body only', async () => {
    const schema: JsonSchema = {
      type: 'object',
      required: ['name'],
      properties: {
        name: { type: 'string' },
      },
    };

    const handler = withBodyValidation(schema)(mockHandler);
    
    const validEvent = createMockEvent({
      body: JSON.stringify({ name: 'test' }),
    });
    const validResult = await handler(validEvent);
    expect(validResult.statusCode).toBe(200);

    const invalidEvent = createMockEvent({
      body: JSON.stringify({}),
    });
    const invalidResult = await handler(invalidEvent);
    expect(invalidResult.statusCode).toBe(400);
  });
});

describe('withQueryValidation', () => {
  const mockHandler = jest.fn<Promise<APIGatewayProxyResult>, [APIGatewayProxyEvent]>();

  beforeEach(() => {
    mockHandler.mockReset();
    mockHandler.mockResolvedValue({
      statusCode: 200,
      body: JSON.stringify({ success: true }),
    });
  });

  it('should validate query parameters only', async () => {
    const schema: JsonSchema = {
      type: 'object',
      required: ['page'],
      properties: {
        page: { type: 'integer', minimum: 1 },
      },
    };

    const handler = withQueryValidation(schema)(mockHandler);
    
    const validEvent = createMockEvent({
      queryStringParameters: { page: '1' },
    });
    const validResult = await handler(validEvent);
    expect(validResult.statusCode).toBe(200);

    const invalidEvent = createMockEvent({
      queryStringParameters: {},
    });
    const invalidResult = await handler(invalidEvent);
    expect(invalidResult.statusCode).toBe(400);
  });
});

describe('withPathValidation', () => {
  const mockHandler = jest.fn<Promise<APIGatewayProxyResult>, [APIGatewayProxyEvent]>();

  beforeEach(() => {
    mockHandler.mockReset();
    mockHandler.mockResolvedValue({
      statusCode: 200,
      body: JSON.stringify({ success: true }),
    });
  });

  it('should validate path parameters only', async () => {
    const schema: JsonSchema = {
      type: 'object',
      required: ['id'],
      properties: {
        id: { type: 'string', format: 'uuid' },
      },
    };

    const handler = withPathValidation(schema)(mockHandler);
    
    const validEvent = createMockEvent({
      pathParameters: { id: '550e8400-e29b-41d4-a716-446655440000' },
    });
    const validResult = await handler(validEvent);
    expect(validResult.statusCode).toBe(200);

    const invalidEvent = createMockEvent({
      pathParameters: { id: 'not-a-uuid' },
    });
    const invalidResult = await handler(invalidEvent);
    expect(invalidResult.statusCode).toBe(400);
  });
});

describe('getValidatedBody', () => {
  it('should return parsed and validated body', () => {
    const schema: JsonSchema = {
      type: 'object',
      required: ['name'],
      properties: {
        name: { type: 'string' },
        count: { type: 'integer', default: 10 },
      },
    };

    const event = createMockEvent({
      body: JSON.stringify({ name: 'test' }),
    });

    const result = getValidatedBody<{ name: string; count: number }>(event, schema);
    expect(result.name).toBe('test');
    expect(result.count).toBe(10); // Default value applied
  });

  it('should throw RequestValidationError for invalid body', () => {
    const schema: JsonSchema = {
      type: 'object',
      required: ['name'],
      properties: {
        name: { type: 'string' },
      },
    };

    const event = createMockEvent({
      body: JSON.stringify({}),
    });

    expect(() => getValidatedBody(event, schema)).toThrow(RequestValidationError);
  });

  it('should throw RequestValidationError for invalid JSON', () => {
    const schema: JsonSchema = { type: 'object' };
    const event = createMockEvent({
      body: 'not valid json',
    });

    expect(() => getValidatedBody(event, schema)).toThrow(RequestValidationError);
  });
});

describe('getValidatedQueryParams', () => {
  it('should return parsed and validated query params', () => {
    const schema: JsonSchema = {
      type: 'object',
      properties: {
        page: { type: 'integer', default: 1 },
        limit: { type: 'integer', default: 20 },
      },
    };

    const event = createMockEvent({
      queryStringParameters: { page: '5' },
    });

    const result = getValidatedQueryParams<{ page: number; limit: number }>(event, schema);
    expect(result.page).toBe(5);
    expect(result.limit).toBe(20); // Default value applied
  });

  it('should throw RequestValidationError for invalid params', () => {
    const schema: JsonSchema = {
      type: 'object',
      required: ['page'],
      properties: {
        page: { type: 'integer', minimum: 1 },
      },
    };

    const event = createMockEvent({
      queryStringParameters: {},
    });

    expect(() => getValidatedQueryParams(event, schema)).toThrow(RequestValidationError);
  });
});

describe('getValidatedPathParams', () => {
  it('should return validated path params', () => {
    const schema: JsonSchema = {
      type: 'object',
      required: ['id'],
      properties: {
        id: { type: 'string', format: 'uuid' },
      },
    };

    const event = createMockEvent({
      pathParameters: { id: '550e8400-e29b-41d4-a716-446655440000' },
    });

    const result = getValidatedPathParams<{ id: string }>(event, schema);
    expect(result.id).toBe('550e8400-e29b-41d4-a716-446655440000');
  });

  it('should throw RequestValidationError for invalid params', () => {
    const schema: JsonSchema = {
      type: 'object',
      required: ['id'],
      properties: {
        id: { type: 'string', format: 'uuid' },
      },
    };

    const event = createMockEvent({
      pathParameters: { id: 'not-a-uuid' },
    });

    expect(() => getValidatedPathParams(event, schema)).toThrow(RequestValidationError);
  });
});

describe('RequestValidationError', () => {
  it('should have correct properties', () => {
    const errors = [
      { field: 'name', message: 'name is required', code: 'REQUIRED' },
    ];
    const error = new RequestValidationError('Validation failed', errors);

    expect(error.name).toBe('RequestValidationError');
    expect(error.message).toBe('Validation failed');
    expect(error.code).toBe('VALIDATION_ERROR');
    expect(error.statusCode).toBe(400);
    expect(error.errors).toEqual(errors);
  });
});
