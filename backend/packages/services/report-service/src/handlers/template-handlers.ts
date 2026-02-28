/**
 * Template Lambda Handlers
 *
 * Handlers for report template CRUD operations.
 *
 * Requirements:
 * - 16.10: Support report templates that can be saved and shared across users
 * - 16.9: Log report access for audit purposes
 */

import type { APIGatewayProxyEvent, APIGatewayProxyResult } from 'aws-lambda';

import { API_ERROR_CODES, createApiResponse, createErrorResponse, createLambdaResponse, HTTP_STATUS } from '@ams/types';
import { createLogger, validateUUID } from '@ams/utils';

import type {
  CreateTemplateRequest,
  CustomReportDataSource,
  ExportFormat,
  TemplateVisibility,
  UpdateTemplateRequest,
} from '../report/report-types';
import * as templateService from '../template/template-service';

const logger = createLogger({ service: 'template-handlers' });

const VALID_DATA_SOURCES: CustomReportDataSource[] = [
  'ASSETS', 'HARDWARE_ASSETS', 'SOFTWARE_ASSETS', 'ENTERPRISE_ASSETS',
  'CONTRACTS', 'PURCHASE_ORDERS', 'WORK_ORDERS', 'STOCKROOMS',
  'ENTITLEMENTS', 'INSTALLATIONS',
];

const VALID_VISIBILITIES: TemplateVisibility[] = ['PRIVATE', 'SHARED', 'PUBLIC'];
const VALID_FORMATS: ExportFormat[] = ['PDF', 'EXCEL', 'CSV'];

// ============================================================================
// Create Template Handler
// ============================================================================

/**
 * Create a new report template
 */
export async function createTemplateHandler(
  event: APIGatewayProxyEvent
): Promise<APIGatewayProxyResult> {
  const requestId = event.requestContext.requestId;
  const userId = event.requestContext.authorizer?.['claims']?.['sub'] as string | undefined;

  logger.info('Create template request received', { requestId });

  try {
    if (!userId) {
      return createLambdaResponse(
        HTTP_STATUS.UNAUTHORIZED,
        createErrorResponse(API_ERROR_CODES.UNAUTHORIZED, 'User authentication required', requestId)
      );
    }

    let body: unknown;
    try {
      body = event.body ? JSON.parse(event.body) : null;
    } catch {
      return createLambdaResponse(
        HTTP_STATUS.BAD_REQUEST,
        createErrorResponse(API_ERROR_CODES.BAD_REQUEST, 'Invalid JSON in request body', requestId)
      );
    }

    const validation = validateCreateTemplateRequest(body);
    if (!validation.valid) {
      return createLambdaResponse(
        HTTP_STATUS.BAD_REQUEST,
        createErrorResponse(
          API_ERROR_CODES.VALIDATION_ERROR,
          'Validation failed',
          requestId,
          validation.errors.map(msg => ({ field: '', message: msg, code: 'VALIDATION_ERROR' }))
        )
      );
    }

    const template = await templateService.createTemplate(validation.data, userId);

    logger.info('Template created', { requestId, templateId: template.templateId });

    return createLambdaResponse(
      HTTP_STATUS.CREATED,
      createApiResponse(template, requestId)
    );
  } catch (error) {
    const err = error as Error;
    logger.error('Failed to create template', err, { requestId });

    if (err.message.includes('is required') || err.message.includes('must be')) {
      return createLambdaResponse(
        HTTP_STATUS.BAD_REQUEST,
        createErrorResponse(API_ERROR_CODES.BAD_REQUEST, err.message, requestId)
      );
    }

    return createLambdaResponse(
      HTTP_STATUS.INTERNAL_SERVER_ERROR,
      createErrorResponse(API_ERROR_CODES.INTERNAL_ERROR, 'Failed to create template', requestId)
    );
  }
}

// ============================================================================
// Get Template Handler
// ============================================================================

/**
 * Get a template by ID
 */
export async function getTemplateHandler(
  event: APIGatewayProxyEvent
): Promise<APIGatewayProxyResult> {
  const requestId = event.requestContext.requestId;
  const userId = event.requestContext.authorizer?.['claims']?.['sub'] as string | undefined;
  const templateId = event.pathParameters?.['templateId'];

  logger.info('Get template request received', { requestId, templateId });

  try {
    if (!userId) {
      return createLambdaResponse(
        HTTP_STATUS.UNAUTHORIZED,
        createErrorResponse(API_ERROR_CODES.UNAUTHORIZED, 'User authentication required', requestId)
      );
    }

    if (!templateId) {
      return createLambdaResponse(
        HTTP_STATUS.BAD_REQUEST,
        createErrorResponse(API_ERROR_CODES.BAD_REQUEST, 'Template ID is required', requestId)
      );
    }

    const uuidError = validateUUID(templateId, 'templateId');
    if (uuidError) {
      return createLambdaResponse(
        HTTP_STATUS.BAD_REQUEST,
        createErrorResponse(API_ERROR_CODES.BAD_REQUEST, uuidError.message, requestId)
      );
    }

    const template = await templateService.getTemplate(templateId, userId);

    if (!template) {
      return createLambdaResponse(
        HTTP_STATUS.NOT_FOUND,
        createErrorResponse(API_ERROR_CODES.NOT_FOUND, 'Template not found', requestId)
      );
    }

    return createLambdaResponse(
      HTTP_STATUS.OK,
      createApiResponse(template, requestId)
    );
  } catch (error) {
    const err = error as Error;
    logger.error('Failed to get template', err, { requestId, templateId });

    return createLambdaResponse(
      HTTP_STATUS.INTERNAL_SERVER_ERROR,
      createErrorResponse(API_ERROR_CODES.INTERNAL_ERROR, 'Failed to get template', requestId)
    );
  }
}

// ============================================================================
// Update Template Handler
// ============================================================================

/**
 * Update an existing template
 */
export async function updateTemplateHandler(
  event: APIGatewayProxyEvent
): Promise<APIGatewayProxyResult> {
  const requestId = event.requestContext.requestId;
  const userId = event.requestContext.authorizer?.['claims']?.['sub'] as string | undefined;
  const templateId = event.pathParameters?.['templateId'];

  logger.info('Update template request received', { requestId, templateId });

  try {
    if (!userId) {
      return createLambdaResponse(
        HTTP_STATUS.UNAUTHORIZED,
        createErrorResponse(API_ERROR_CODES.UNAUTHORIZED, 'User authentication required', requestId)
      );
    }

    if (!templateId) {
      return createLambdaResponse(
        HTTP_STATUS.BAD_REQUEST,
        createErrorResponse(API_ERROR_CODES.BAD_REQUEST, 'Template ID is required', requestId)
      );
    }

    let body: unknown;
    try {
      body = event.body ? JSON.parse(event.body) : null;
    } catch {
      return createLambdaResponse(
        HTTP_STATUS.BAD_REQUEST,
        createErrorResponse(API_ERROR_CODES.BAD_REQUEST, 'Invalid JSON in request body', requestId)
      );
    }

    const validation = validateUpdateTemplateRequest(body);
    if (!validation.valid) {
      return createLambdaResponse(
        HTTP_STATUS.BAD_REQUEST,
        createErrorResponse(
          API_ERROR_CODES.VALIDATION_ERROR,
          'Validation failed',
          requestId,
          validation.errors.map(msg => ({ field: '', message: msg, code: 'VALIDATION_ERROR' }))
        )
      );
    }

    const template = await templateService.updateTemplate(templateId, validation.data, userId);

    logger.info('Template updated', { requestId, templateId });

    return createLambdaResponse(
      HTTP_STATUS.OK,
      createApiResponse(template, requestId)
    );
  } catch (error) {
    const err = error as Error;
    logger.error('Failed to update template', err, { requestId, templateId });

    if (err.message.includes('not found')) {
      return createLambdaResponse(
        HTTP_STATUS.NOT_FOUND,
        createErrorResponse(API_ERROR_CODES.NOT_FOUND, err.message, requestId)
      );
    }

    if (err.message.includes('Only the template owner')) {
      return createLambdaResponse(
        HTTP_STATUS.FORBIDDEN,
        createErrorResponse(API_ERROR_CODES.FORBIDDEN, err.message, requestId)
      );
    }

    return createLambdaResponse(
      HTTP_STATUS.INTERNAL_SERVER_ERROR,
      createErrorResponse(API_ERROR_CODES.INTERNAL_ERROR, 'Failed to update template', requestId)
    );
  }
}

// ============================================================================
// Delete Template Handler
// ============================================================================

/**
 * Delete a template
 */
export async function deleteTemplateHandler(
  event: APIGatewayProxyEvent
): Promise<APIGatewayProxyResult> {
  const requestId = event.requestContext.requestId;
  const userId = event.requestContext.authorizer?.['claims']?.['sub'] as string | undefined;
  const templateId = event.pathParameters?.['templateId'];

  logger.info('Delete template request received', { requestId, templateId });

  try {
    if (!userId) {
      return createLambdaResponse(
        HTTP_STATUS.UNAUTHORIZED,
        createErrorResponse(API_ERROR_CODES.UNAUTHORIZED, 'User authentication required', requestId)
      );
    }

    if (!templateId) {
      return createLambdaResponse(
        HTTP_STATUS.BAD_REQUEST,
        createErrorResponse(API_ERROR_CODES.BAD_REQUEST, 'Template ID is required', requestId)
      );
    }

    await templateService.deleteTemplate(templateId, userId);

    logger.info('Template deleted', { requestId, templateId });

    return createLambdaResponse(
      HTTP_STATUS.NO_CONTENT,
      null
    );
  } catch (error) {
    const err = error as Error;
    logger.error('Failed to delete template', err, { requestId, templateId });

    if (err.message.includes('not found')) {
      return createLambdaResponse(
        HTTP_STATUS.NOT_FOUND,
        createErrorResponse(API_ERROR_CODES.NOT_FOUND, err.message, requestId)
      );
    }

    if (err.message.includes('Only the template owner')) {
      return createLambdaResponse(
        HTTP_STATUS.FORBIDDEN,
        createErrorResponse(API_ERROR_CODES.FORBIDDEN, err.message, requestId)
      );
    }

    return createLambdaResponse(
      HTTP_STATUS.INTERNAL_SERVER_ERROR,
      createErrorResponse(API_ERROR_CODES.INTERNAL_ERROR, 'Failed to delete template', requestId)
    );
  }
}

// ============================================================================
// List Templates Handler
// ============================================================================

/**
 * List templates accessible to the user
 */
export async function listTemplatesHandler(
  event: APIGatewayProxyEvent
): Promise<APIGatewayProxyResult> {
  const requestId = event.requestContext.requestId;
  const userId = event.requestContext.authorizer?.['claims']?.['sub'] as string | undefined;

  logger.info('List templates request received', { requestId });

  try {
    if (!userId) {
      return createLambdaResponse(
        HTTP_STATUS.UNAUTHORIZED,
        createErrorResponse(API_ERROR_CODES.UNAUTHORIZED, 'User authentication required', requestId)
      );
    }

    const queryParams = event.queryStringParameters ?? {};
    const page = parseInt(queryParams['page'] ?? '1', 10);
    const limit = parseInt(queryParams['limit'] ?? '20', 10);
    const visibility = queryParams['visibility'] as TemplateVisibility | undefined;
    const searchTerm = queryParams['search'];

    const result = await templateService.listTemplates(
      { page, limit, visibility, searchTerm, includeShared: true },
      userId
    );

    return createLambdaResponse(
      HTTP_STATUS.OK,
      createApiResponse(result, requestId)
    );
  } catch (error) {
    const err = error as Error;
    logger.error('Failed to list templates', err, { requestId });

    return createLambdaResponse(
      HTTP_STATUS.INTERNAL_SERVER_ERROR,
      createErrorResponse(API_ERROR_CODES.INTERNAL_ERROR, 'Failed to list templates', requestId)
    );
  }
}

// ============================================================================
// Share Template Handler
// ============================================================================

/**
 * Share a template with other users
 */
export async function shareTemplateHandler(
  event: APIGatewayProxyEvent
): Promise<APIGatewayProxyResult> {
  const requestId = event.requestContext.requestId;
  const userId = event.requestContext.authorizer?.['claims']?.['sub'] as string | undefined;
  const templateId = event.pathParameters?.['templateId'];

  logger.info('Share template request received', { requestId, templateId });

  try {
    if (!userId) {
      return createLambdaResponse(
        HTTP_STATUS.UNAUTHORIZED,
        createErrorResponse(API_ERROR_CODES.UNAUTHORIZED, 'User authentication required', requestId)
      );
    }

    if (!templateId) {
      return createLambdaResponse(
        HTTP_STATUS.BAD_REQUEST,
        createErrorResponse(API_ERROR_CODES.BAD_REQUEST, 'Template ID is required', requestId)
      );
    }

    let body: { userIds?: string[] };
    try {
      body = event.body ? JSON.parse(event.body) : {};
    } catch {
      return createLambdaResponse(
        HTTP_STATUS.BAD_REQUEST,
        createErrorResponse(API_ERROR_CODES.BAD_REQUEST, 'Invalid JSON in request body', requestId)
      );
    }

    if (!body.userIds || !Array.isArray(body.userIds) || body.userIds.length === 0) {
      return createLambdaResponse(
        HTTP_STATUS.BAD_REQUEST,
        createErrorResponse(API_ERROR_CODES.BAD_REQUEST, 'userIds array is required', requestId)
      );
    }

    const template = await templateService.shareTemplate(templateId, body.userIds, userId);

    logger.info('Template shared', { requestId, templateId, sharedWithCount: body.userIds.length });

    return createLambdaResponse(
      HTTP_STATUS.OK,
      createApiResponse(template, requestId)
    );
  } catch (error) {
    const err = error as Error;
    logger.error('Failed to share template', err, { requestId, templateId });

    if (err.message.includes('not found')) {
      return createLambdaResponse(
        HTTP_STATUS.NOT_FOUND,
        createErrorResponse(API_ERROR_CODES.NOT_FOUND, err.message, requestId)
      );
    }

    if (err.message.includes('Only the template owner')) {
      return createLambdaResponse(
        HTTP_STATUS.FORBIDDEN,
        createErrorResponse(API_ERROR_CODES.FORBIDDEN, err.message, requestId)
      );
    }

    return createLambdaResponse(
      HTTP_STATUS.INTERNAL_SERVER_ERROR,
      createErrorResponse(API_ERROR_CODES.INTERNAL_ERROR, 'Failed to share template', requestId)
    );
  }
}

// ============================================================================
// Validation Helpers
// ============================================================================

function validateCreateTemplateRequest(body: unknown): { valid: true; data: CreateTemplateRequest } | { valid: false; errors: string[] } {
  if (!body || typeof body !== 'object') {
    return { valid: false, errors: ['Request body is required'] };
  }

  const request = body as Record<string, unknown>;
  const errors: string[] = [];

  if (!request['name'] || typeof request['name'] !== 'string') {
    errors.push('name is required and must be a string');
  } else if ((request['name'] as string).length > 255) {
    errors.push('name must be 255 characters or less');
  }

  if (request['description'] !== undefined && typeof request['description'] !== 'string') {
    errors.push('description must be a string');
  }

  if (!request['definition'] || typeof request['definition'] !== 'object') {
    errors.push('definition is required');
  } else {
    const def = request['definition'] as Record<string, unknown>;
    if (!def['dataSource'] || !VALID_DATA_SOURCES.includes(def['dataSource'] as CustomReportDataSource)) {
      errors.push(`definition.dataSource is required and must be one of: ${VALID_DATA_SOURCES.join(', ')}`);
    }
    if (!def['columns'] || !Array.isArray(def['columns']) || def['columns'].length === 0) {
      errors.push('definition.columns is required and must be a non-empty array');
    }
  }

  if (request['visibility'] !== undefined && !VALID_VISIBILITIES.includes(request['visibility'] as TemplateVisibility)) {
    errors.push(`visibility must be one of: ${VALID_VISIBILITIES.join(', ')}`);
  }

  if (request['defaultFormat'] !== undefined && !VALID_FORMATS.includes(request['defaultFormat'] as ExportFormat)) {
    errors.push(`defaultFormat must be one of: ${VALID_FORMATS.join(', ')}`);
  }

  if (errors.length > 0) {
    return { valid: false, errors };
  }

  return {
    valid: true,
    data: {
      name: request['name'] as string,
      description: request['description'] as string | undefined,
      definition: request['definition'] as CreateTemplateRequest['definition'],
      defaultFormat: request['defaultFormat'] as ExportFormat | undefined,
      visibility: request['visibility'] as TemplateVisibility | undefined,
      sharedWith: request['sharedWith'] as string[] | undefined,
      tags: request['tags'] as string[] | undefined,
    },
  };
}

function validateUpdateTemplateRequest(body: unknown): { valid: true; data: UpdateTemplateRequest } | { valid: false; errors: string[] } {
  if (!body || typeof body !== 'object') {
    return { valid: false, errors: ['Request body is required'] };
  }

  const request = body as Record<string, unknown>;
  const errors: string[] = [];

  if (request['name'] !== undefined) {
    if (typeof request['name'] !== 'string') {
      errors.push('name must be a string');
    } else if ((request['name'] as string).length > 255) {
      errors.push('name must be 255 characters or less');
    }
  }

  if (request['visibility'] !== undefined && !VALID_VISIBILITIES.includes(request['visibility'] as TemplateVisibility)) {
    errors.push(`visibility must be one of: ${VALID_VISIBILITIES.join(', ')}`);
  }

  if (errors.length > 0) {
    return { valid: false, errors };
  }

  return {
    valid: true,
    data: {
      name: request['name'] as string | undefined,
      description: request['description'] as string | undefined,
      definition: request['definition'] as UpdateTemplateRequest['definition'],
      defaultFormat: request['defaultFormat'] as ExportFormat | undefined,
      visibility: request['visibility'] as TemplateVisibility | undefined,
      sharedWith: request['sharedWith'] as string[] | undefined,
      tags: request['tags'] as string[] | undefined,
    },
  };
}
