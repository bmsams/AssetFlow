/**
 * Schedule Handlers - Lambda handlers for report scheduling
 *
 * Handlers for creating, managing, and executing report schedules.
 *
 * Requirements:
 * - 16.4: Schedule automated report generation and distribution via email
 */

import type { APIGatewayProxyEvent, APIGatewayProxyResult, ScheduledEvent } from 'aws-lambda';

import { API_ERROR_CODES, createApiResponse, createErrorResponse, createLambdaResponse, HTTP_STATUS } from '@ams/types';
import { createLogger, validateUUID } from '@ams/utils';

import * as scheduleService from '../schedule/schedule-service';
import type {
  CreateScheduleRequest,
  DayOfWeek,
  ScheduleFrequency,
  ScheduleStatus,
  UpdateScheduleRequest,
} from '../report/report-types';

const logger = createLogger({ service: 'schedule-handlers' });

// ============================================================================
// Constants
// ============================================================================

const VALID_FREQUENCIES: ScheduleFrequency[] = ['DAILY', 'WEEKLY', 'MONTHLY', 'CUSTOM'];
const VALID_DAYS_OF_WEEK: DayOfWeek[] = [
  'MONDAY', 'TUESDAY', 'WEDNESDAY', 'THURSDAY', 'FRIDAY', 'SATURDAY', 'SUNDAY'
];
const VALID_STATUSES: ScheduleStatus[] = ['ACTIVE', 'PAUSED', 'COMPLETED', 'FAILED'];


// ============================================================================
// Create Schedule Handler
// ============================================================================

/**
 * Lambda handler for creating a report schedule
 */
export async function scheduleReportHandler(
  event: APIGatewayProxyEvent
): Promise<APIGatewayProxyResult> {
  const requestId = event.requestContext.requestId;
  const userId = event.requestContext.authorizer?.['claims']?.['sub'] as string | undefined;

  logger.info('Create schedule request received', { requestId });

  try {
    // Validate user ID
    if (!userId) {
      return createLambdaResponse(
        HTTP_STATUS.UNAUTHORIZED,
        createErrorResponse(API_ERROR_CODES.UNAUTHORIZED, 'User authentication required', requestId)
      );
    }

    // Parse request body
    let body: unknown;
    try {
      body = event.body ? JSON.parse(event.body) : null;
    } catch {
      return createLambdaResponse(
        HTTP_STATUS.BAD_REQUEST,
        createErrorResponse(API_ERROR_CODES.BAD_REQUEST, 'Invalid JSON in request body', requestId)
      );
    }

    // Validate request
    const validation = validateCreateScheduleRequest(body);
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

    // Create the schedule
    const schedule = await scheduleService.createSchedule(validation.data, userId);

    logger.info('Schedule created', {
      requestId,
      scheduleId: schedule.scheduleId,
      name: schedule.name,
    });

    return createLambdaResponse(
      HTTP_STATUS.CREATED,
      createApiResponse(schedule, requestId)
    );
  } catch (error) {
    const err = error as Error;
    logger.error('Failed to create schedule', err, { requestId });

    if (err.message.includes('is required') || err.message.includes('must be') || err.message.includes('Invalid')) {
      return createLambdaResponse(
        HTTP_STATUS.BAD_REQUEST,
        createErrorResponse(API_ERROR_CODES.BAD_REQUEST, err.message, requestId)
      );
    }

    return createLambdaResponse(
      HTTP_STATUS.INTERNAL_SERVER_ERROR,
      createErrorResponse(API_ERROR_CODES.INTERNAL_ERROR, 'Failed to create schedule', requestId)
    );
  }
}


// ============================================================================
// Get Scheduled Reports Handler
// ============================================================================

/**
 * Lambda handler for listing scheduled reports
 */
export async function getScheduledReportsHandler(
  event: APIGatewayProxyEvent
): Promise<APIGatewayProxyResult> {
  const requestId = event.requestContext.requestId;
  const userId = event.requestContext.authorizer?.['claims']?.['sub'] as string | undefined;

  logger.info('Get scheduled reports request received', { requestId });

  try {
    // Validate user ID
    if (!userId) {
      return createLambdaResponse(
        HTTP_STATUS.UNAUTHORIZED,
        createErrorResponse(API_ERROR_CODES.UNAUTHORIZED, 'User authentication required', requestId)
      );
    }

    // Parse query parameters
    const queryParams = event.queryStringParameters ?? {};
    const page = queryParams['page'] ? parseInt(queryParams['page'], 10) : 1;
    const limit = queryParams['limit'] ? parseInt(queryParams['limit'], 10) : 20;
    const status = queryParams['status'] as ScheduleStatus | undefined;
    const reportType = queryParams['reportType'];
    const sortBy = queryParams['sortBy'] as 'name' | 'createdAt' | 'nextRunAt' | 'lastRunAt' | undefined;
    const sortDirection = queryParams['sortDirection'] as 'ASC' | 'DESC' | undefined;

    // Validate pagination
    if (page < 1) {
      return createLambdaResponse(
        HTTP_STATUS.BAD_REQUEST,
        createErrorResponse(API_ERROR_CODES.BAD_REQUEST, 'Page must be at least 1', requestId)
      );
    }

    if (limit < 1 || limit > 100) {
      return createLambdaResponse(
        HTTP_STATUS.BAD_REQUEST,
        createErrorResponse(API_ERROR_CODES.BAD_REQUEST, 'Limit must be between 1 and 100', requestId)
      );
    }

    // Validate status if provided
    if (status && !VALID_STATUSES.includes(status)) {
      return createLambdaResponse(
        HTTP_STATUS.BAD_REQUEST,
        createErrorResponse(
          API_ERROR_CODES.BAD_REQUEST,
          `Invalid status: ${status}. Valid statuses are: ${VALID_STATUSES.join(', ')}`,
          requestId
        )
      );
    }

    // List schedules
    const result = await scheduleService.listSchedules({
      createdBy: userId,
      status,
      reportType: reportType as any,
      page,
      limit,
      sortBy,
      sortDirection,
    });

    logger.info('Schedules retrieved', {
      requestId,
      total: result.total,
      page: result.page,
    });

    return createLambdaResponse(
      HTTP_STATUS.OK,
      createApiResponse(result, requestId)
    );
  } catch (error) {
    const err = error as Error;
    logger.error('Failed to get scheduled reports', err, { requestId });

    return createLambdaResponse(
      HTTP_STATUS.INTERNAL_SERVER_ERROR,
      createErrorResponse(API_ERROR_CODES.INTERNAL_ERROR, 'Failed to get scheduled reports', requestId)
    );
  }
}


// ============================================================================
// Get Schedule By ID Handler
// ============================================================================

/**
 * Lambda handler for getting a specific schedule
 */
export async function getScheduleHandler(
  event: APIGatewayProxyEvent
): Promise<APIGatewayProxyResult> {
  const requestId = event.requestContext.requestId;
  const userId = event.requestContext.authorizer?.['claims']?.['sub'] as string | undefined;
  const scheduleId = event.pathParameters?.['scheduleId'];

  logger.info('Get schedule request received', { requestId, scheduleId });

  try {
    // Validate user ID
    if (!userId) {
      return createLambdaResponse(
        HTTP_STATUS.UNAUTHORIZED,
        createErrorResponse(API_ERROR_CODES.UNAUTHORIZED, 'User authentication required', requestId)
      );
    }

    // Validate schedule ID
    if (!scheduleId) {
      return createLambdaResponse(
        HTTP_STATUS.BAD_REQUEST,
        createErrorResponse(API_ERROR_CODES.BAD_REQUEST, 'Schedule ID is required', requestId)
      );
    }

    const uuidError = validateUUID(scheduleId, 'scheduleId');
    if (uuidError) {
      return createLambdaResponse(
        HTTP_STATUS.BAD_REQUEST,
        createErrorResponse(API_ERROR_CODES.BAD_REQUEST, uuidError.message, requestId)
      );
    }

    // Get the schedule
    const schedule = await scheduleService.getSchedule(scheduleId);

    if (!schedule) {
      return createLambdaResponse(
        HTTP_STATUS.NOT_FOUND,
        createErrorResponse(API_ERROR_CODES.NOT_FOUND, 'Schedule not found', requestId)
      );
    }

    logger.info('Schedule retrieved', { requestId, scheduleId });

    return createLambdaResponse(
      HTTP_STATUS.OK,
      createApiResponse(schedule, requestId)
    );
  } catch (error) {
    const err = error as Error;
    logger.error('Failed to get schedule', err, { requestId, scheduleId });

    return createLambdaResponse(
      HTTP_STATUS.INTERNAL_SERVER_ERROR,
      createErrorResponse(API_ERROR_CODES.INTERNAL_ERROR, 'Failed to get schedule', requestId)
    );
  }
}


// ============================================================================
// Update Schedule Handler
// ============================================================================

/**
 * Lambda handler for updating a schedule
 */
export async function updateScheduleHandler(
  event: APIGatewayProxyEvent
): Promise<APIGatewayProxyResult> {
  const requestId = event.requestContext.requestId;
  const userId = event.requestContext.authorizer?.['claims']?.['sub'] as string | undefined;
  const scheduleId = event.pathParameters?.['scheduleId'];

  logger.info('Update schedule request received', { requestId, scheduleId });

  try {
    // Validate user ID
    if (!userId) {
      return createLambdaResponse(
        HTTP_STATUS.UNAUTHORIZED,
        createErrorResponse(API_ERROR_CODES.UNAUTHORIZED, 'User authentication required', requestId)
      );
    }

    // Validate schedule ID
    if (!scheduleId) {
      return createLambdaResponse(
        HTTP_STATUS.BAD_REQUEST,
        createErrorResponse(API_ERROR_CODES.BAD_REQUEST, 'Schedule ID is required', requestId)
      );
    }

    const uuidError = validateUUID(scheduleId, 'scheduleId');
    if (uuidError) {
      return createLambdaResponse(
        HTTP_STATUS.BAD_REQUEST,
        createErrorResponse(API_ERROR_CODES.BAD_REQUEST, uuidError.message, requestId)
      );
    }

    // Parse request body
    let body: unknown;
    try {
      body = event.body ? JSON.parse(event.body) : null;
    } catch {
      return createLambdaResponse(
        HTTP_STATUS.BAD_REQUEST,
        createErrorResponse(API_ERROR_CODES.BAD_REQUEST, 'Invalid JSON in request body', requestId)
      );
    }

    // Validate request
    const validation = validateUpdateScheduleRequest(body);
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

    // Update the schedule
    const schedule = await scheduleService.updateSchedule(scheduleId, validation.data, userId);

    if (!schedule) {
      return createLambdaResponse(
        HTTP_STATUS.NOT_FOUND,
        createErrorResponse(API_ERROR_CODES.NOT_FOUND, 'Schedule not found', requestId)
      );
    }

    logger.info('Schedule updated', { requestId, scheduleId });

    return createLambdaResponse(
      HTTP_STATUS.OK,
      createApiResponse(schedule, requestId)
    );
  } catch (error) {
    const err = error as Error;
    logger.error('Failed to update schedule', err, { requestId, scheduleId });

    if (err.message.includes('is required') || err.message.includes('must be') || err.message.includes('Invalid')) {
      return createLambdaResponse(
        HTTP_STATUS.BAD_REQUEST,
        createErrorResponse(API_ERROR_CODES.BAD_REQUEST, err.message, requestId)
      );
    }

    return createLambdaResponse(
      HTTP_STATUS.INTERNAL_SERVER_ERROR,
      createErrorResponse(API_ERROR_CODES.INTERNAL_ERROR, 'Failed to update schedule', requestId)
    );
  }
}


// ============================================================================
// Delete Schedule Handler
// ============================================================================

/**
 * Lambda handler for deleting a schedule
 */
export async function deleteScheduleHandler(
  event: APIGatewayProxyEvent
): Promise<APIGatewayProxyResult> {
  const requestId = event.requestContext.requestId;
  const userId = event.requestContext.authorizer?.['claims']?.['sub'] as string | undefined;
  const scheduleId = event.pathParameters?.['scheduleId'];

  logger.info('Delete schedule request received', { requestId, scheduleId });

  try {
    // Validate user ID
    if (!userId) {
      return createLambdaResponse(
        HTTP_STATUS.UNAUTHORIZED,
        createErrorResponse(API_ERROR_CODES.UNAUTHORIZED, 'User authentication required', requestId)
      );
    }

    // Validate schedule ID
    if (!scheduleId) {
      return createLambdaResponse(
        HTTP_STATUS.BAD_REQUEST,
        createErrorResponse(API_ERROR_CODES.BAD_REQUEST, 'Schedule ID is required', requestId)
      );
    }

    const uuidError = validateUUID(scheduleId, 'scheduleId');
    if (uuidError) {
      return createLambdaResponse(
        HTTP_STATUS.BAD_REQUEST,
        createErrorResponse(API_ERROR_CODES.BAD_REQUEST, uuidError.message, requestId)
      );
    }

    // Delete the schedule
    const deleted = await scheduleService.deleteSchedule(scheduleId);

    if (!deleted) {
      return createLambdaResponse(
        HTTP_STATUS.NOT_FOUND,
        createErrorResponse(API_ERROR_CODES.NOT_FOUND, 'Schedule not found', requestId)
      );
    }

    logger.info('Schedule deleted', { requestId, scheduleId });

    return createLambdaResponse(
      HTTP_STATUS.NO_CONTENT,
      null as any
    );
  } catch (error) {
    const err = error as Error;
    logger.error('Failed to delete schedule', err, { requestId, scheduleId });

    return createLambdaResponse(
      HTTP_STATUS.INTERNAL_SERVER_ERROR,
      createErrorResponse(API_ERROR_CODES.INTERNAL_ERROR, 'Failed to delete schedule', requestId)
    );
  }
}


// ============================================================================
// Pause/Resume Schedule Handlers
// ============================================================================

/**
 * Lambda handler for pausing a schedule
 */
export async function pauseScheduleHandler(
  event: APIGatewayProxyEvent
): Promise<APIGatewayProxyResult> {
  const requestId = event.requestContext.requestId;
  const userId = event.requestContext.authorizer?.['claims']?.['sub'] as string | undefined;
  const scheduleId = event.pathParameters?.['scheduleId'];

  logger.info('Pause schedule request received', { requestId, scheduleId });

  try {
    if (!userId) {
      return createLambdaResponse(
        HTTP_STATUS.UNAUTHORIZED,
        createErrorResponse(API_ERROR_CODES.UNAUTHORIZED, 'User authentication required', requestId)
      );
    }

    if (!scheduleId) {
      return createLambdaResponse(
        HTTP_STATUS.BAD_REQUEST,
        createErrorResponse(API_ERROR_CODES.BAD_REQUEST, 'Schedule ID is required', requestId)
      );
    }

    const uuidError = validateUUID(scheduleId, 'scheduleId');
    if (uuidError) {
      return createLambdaResponse(
        HTTP_STATUS.BAD_REQUEST,
        createErrorResponse(API_ERROR_CODES.BAD_REQUEST, uuidError.message, requestId)
      );
    }

    const schedule = await scheduleService.pauseSchedule(scheduleId);

    if (!schedule) {
      return createLambdaResponse(
        HTTP_STATUS.NOT_FOUND,
        createErrorResponse(API_ERROR_CODES.NOT_FOUND, 'Schedule not found', requestId)
      );
    }

    logger.info('Schedule paused', { requestId, scheduleId });

    return createLambdaResponse(
      HTTP_STATUS.OK,
      createApiResponse(schedule, requestId)
    );
  } catch (error) {
    const err = error as Error;
    logger.error('Failed to pause schedule', err, { requestId, scheduleId });

    return createLambdaResponse(
      HTTP_STATUS.INTERNAL_SERVER_ERROR,
      createErrorResponse(API_ERROR_CODES.INTERNAL_ERROR, 'Failed to pause schedule', requestId)
    );
  }
}

/**
 * Lambda handler for resuming a schedule
 */
export async function resumeScheduleHandler(
  event: APIGatewayProxyEvent
): Promise<APIGatewayProxyResult> {
  const requestId = event.requestContext.requestId;
  const userId = event.requestContext.authorizer?.['claims']?.['sub'] as string | undefined;
  const scheduleId = event.pathParameters?.['scheduleId'];

  logger.info('Resume schedule request received', { requestId, scheduleId });

  try {
    if (!userId) {
      return createLambdaResponse(
        HTTP_STATUS.UNAUTHORIZED,
        createErrorResponse(API_ERROR_CODES.UNAUTHORIZED, 'User authentication required', requestId)
      );
    }

    if (!scheduleId) {
      return createLambdaResponse(
        HTTP_STATUS.BAD_REQUEST,
        createErrorResponse(API_ERROR_CODES.BAD_REQUEST, 'Schedule ID is required', requestId)
      );
    }

    const uuidError = validateUUID(scheduleId, 'scheduleId');
    if (uuidError) {
      return createLambdaResponse(
        HTTP_STATUS.BAD_REQUEST,
        createErrorResponse(API_ERROR_CODES.BAD_REQUEST, uuidError.message, requestId)
      );
    }

    const schedule = await scheduleService.resumeSchedule(scheduleId);

    if (!schedule) {
      return createLambdaResponse(
        HTTP_STATUS.NOT_FOUND,
        createErrorResponse(API_ERROR_CODES.NOT_FOUND, 'Schedule not found', requestId)
      );
    }

    logger.info('Schedule resumed', { requestId, scheduleId });

    return createLambdaResponse(
      HTTP_STATUS.OK,
      createApiResponse(schedule, requestId)
    );
  } catch (error) {
    const err = error as Error;
    logger.error('Failed to resume schedule', err, { requestId, scheduleId });

    return createLambdaResponse(
      HTTP_STATUS.INTERNAL_SERVER_ERROR,
      createErrorResponse(API_ERROR_CODES.INTERNAL_ERROR, 'Failed to resume schedule', requestId)
    );
  }
}


// ============================================================================
// Process Scheduled Reports Handler (CloudWatch Events Trigger)
// ============================================================================

/**
 * Lambda handler for processing scheduled reports
 * Triggered by CloudWatch Events on a schedule (e.g., every 5 minutes)
 */
export async function processScheduledReportsHandler(
  event: ScheduledEvent
): Promise<void> {
  const requestId = event.id ?? generateUUID();

  logger.info('Process scheduled reports triggered', {
    requestId,
    time: event.time,
    source: event.source,
  });

  try {
    const result = await scheduleService.processScheduledReports({});

    logger.info('Scheduled reports processing completed', {
      requestId,
      processedCount: result.processedCount,
      successCount: result.successCount,
      failureCount: result.failureCount,
    });
  } catch (error) {
    const err = error as Error;
    logger.error('Failed to process scheduled reports', err, { requestId });
    throw error;
  }
}

// ============================================================================
// Get Schedule Execution History Handler
// ============================================================================

/**
 * Lambda handler for getting schedule execution history
 */
export async function getScheduleExecutionHistoryHandler(
  event: APIGatewayProxyEvent
): Promise<APIGatewayProxyResult> {
  const requestId = event.requestContext.requestId;
  const userId = event.requestContext.authorizer?.['claims']?.['sub'] as string | undefined;
  const scheduleId = event.pathParameters?.['scheduleId'];

  logger.info('Get schedule execution history request received', { requestId, scheduleId });

  try {
    if (!userId) {
      return createLambdaResponse(
        HTTP_STATUS.UNAUTHORIZED,
        createErrorResponse(API_ERROR_CODES.UNAUTHORIZED, 'User authentication required', requestId)
      );
    }

    if (!scheduleId) {
      return createLambdaResponse(
        HTTP_STATUS.BAD_REQUEST,
        createErrorResponse(API_ERROR_CODES.BAD_REQUEST, 'Schedule ID is required', requestId)
      );
    }

    const uuidError = validateUUID(scheduleId, 'scheduleId');
    if (uuidError) {
      return createLambdaResponse(
        HTTP_STATUS.BAD_REQUEST,
        createErrorResponse(API_ERROR_CODES.BAD_REQUEST, uuidError.message, requestId)
      );
    }

    const queryParams = event.queryStringParameters ?? {};
    const limit = queryParams['limit'] ? parseInt(queryParams['limit'], 10) : 10;

    if (limit < 1 || limit > 100) {
      return createLambdaResponse(
        HTTP_STATUS.BAD_REQUEST,
        createErrorResponse(API_ERROR_CODES.BAD_REQUEST, 'Limit must be between 1 and 100', requestId)
      );
    }

    const executions = await scheduleService.getScheduleExecutionHistory(scheduleId, limit);

    logger.info('Schedule execution history retrieved', {
      requestId,
      scheduleId,
      count: executions.length,
    });

    return createLambdaResponse(
      HTTP_STATUS.OK,
      createApiResponse({ executions }, requestId)
    );
  } catch (error) {
    const err = error as Error;
    logger.error('Failed to get schedule execution history', err, { requestId, scheduleId });

    return createLambdaResponse(
      HTTP_STATUS.INTERNAL_SERVER_ERROR,
      createErrorResponse(API_ERROR_CODES.INTERNAL_ERROR, 'Failed to get execution history', requestId)
    );
  }
}


// ============================================================================
// Validation Functions
// ============================================================================

interface CreateScheduleBody {
  name?: string;
  description?: string;
  reportType?: string;
  reportConfig?: unknown;
  frequency?: string;
  cronExpression?: string;
  dayOfWeek?: string;
  dayOfMonth?: number;
  timeOfDay?: string;
  timezone?: string;
  recipients?: string[];
  emailSubject?: string;
  emailBody?: string;
}

/**
 * Validate create schedule request
 */
function validateCreateScheduleRequest(
  body: unknown
): { valid: true; data: CreateScheduleRequest } | { valid: false; errors: string[] } {
  if (!body || typeof body !== 'object') {
    return { valid: false, errors: ['Request body is required'] };
  }

  const request = body as CreateScheduleBody;
  const errors: string[] = [];

  // Validate name (required)
  if (!request.name) {
    errors.push('name is required');
  } else if (typeof request.name !== 'string') {
    errors.push('name must be a string');
  } else if (request.name.length > 255) {
    errors.push('name must be 255 characters or less');
  }

  // Validate reportType (required)
  if (!request.reportType) {
    errors.push('reportType is required');
  } else if (typeof request.reportType !== 'string') {
    errors.push('reportType must be a string');
  }

  // Validate reportConfig (required)
  if (!request.reportConfig) {
    errors.push('reportConfig is required');
  } else if (typeof request.reportConfig !== 'object') {
    errors.push('reportConfig must be an object');
  }

  // Validate frequency (required)
  if (!request.frequency) {
    errors.push('frequency is required');
  } else if (!VALID_FREQUENCIES.includes(request.frequency as ScheduleFrequency)) {
    errors.push(`Invalid frequency: ${request.frequency}. Valid values are: ${VALID_FREQUENCIES.join(', ')}`);
  }

  // Validate cronExpression for CUSTOM frequency
  if (request.frequency === 'CUSTOM' && !request.cronExpression) {
    errors.push('cronExpression is required for CUSTOM frequency');
  }

  // Validate dayOfWeek for WEEKLY frequency
  if (request.frequency === 'WEEKLY') {
    if (!request.dayOfWeek) {
      errors.push('dayOfWeek is required for WEEKLY frequency');
    } else if (!VALID_DAYS_OF_WEEK.includes(request.dayOfWeek as DayOfWeek)) {
      errors.push(`Invalid dayOfWeek: ${request.dayOfWeek}. Valid values are: ${VALID_DAYS_OF_WEEK.join(', ')}`);
    }
  }

  // Validate dayOfMonth for MONTHLY frequency
  if (request.frequency === 'MONTHLY') {
    if (!request.dayOfMonth) {
      errors.push('dayOfMonth is required for MONTHLY frequency');
    } else if (typeof request.dayOfMonth !== 'number' || request.dayOfMonth < 1 || request.dayOfMonth > 31) {
      errors.push('dayOfMonth must be a number between 1 and 31');
    }
  }

  // Validate timeOfDay (required)
  if (!request.timeOfDay) {
    errors.push('timeOfDay is required');
  } else if (!/^([01]\d|2[0-3]):([0-5]\d)$/.test(request.timeOfDay)) {
    errors.push('timeOfDay must be in HH:mm format');
  }

  // Validate recipients (required)
  if (!request.recipients || !Array.isArray(request.recipients)) {
    errors.push('recipients is required and must be an array');
  } else if (request.recipients.length === 0) {
    errors.push('At least one recipient is required');
  } else {
    for (const recipient of request.recipients) {
      if (!isValidEmail(recipient)) {
        errors.push(`Invalid email address: ${recipient}`);
      }
    }
  }

  // Validate optional fields
  if (request.description !== undefined && typeof request.description !== 'string') {
    errors.push('description must be a string');
  }

  if (request.emailSubject !== undefined && typeof request.emailSubject !== 'string') {
    errors.push('emailSubject must be a string');
  }

  if (request.emailBody !== undefined && typeof request.emailBody !== 'string') {
    errors.push('emailBody must be a string');
  }

  if (errors.length > 0) {
    return { valid: false, errors };
  }

  return {
    valid: true,
    data: {
      name: request.name!,
      description: request.description,
      reportType: request.reportType as any,
      reportConfig: request.reportConfig as any,
      frequency: request.frequency as ScheduleFrequency,
      cronExpression: request.cronExpression,
      dayOfWeek: request.dayOfWeek as DayOfWeek | undefined,
      dayOfMonth: request.dayOfMonth,
      timeOfDay: request.timeOfDay!,
      timezone: request.timezone,
      recipients: request.recipients!,
      emailSubject: request.emailSubject,
      emailBody: request.emailBody,
    },
  };
}


interface UpdateScheduleBody {
  name?: string;
  description?: string;
  reportConfig?: unknown;
  frequency?: string;
  cronExpression?: string;
  dayOfWeek?: string;
  dayOfMonth?: number;
  timeOfDay?: string;
  timezone?: string;
  recipients?: string[];
  emailSubject?: string;
  emailBody?: string;
  status?: string;
}

/**
 * Validate update schedule request
 */
function validateUpdateScheduleRequest(
  body: unknown
): { valid: true; data: UpdateScheduleRequest } | { valid: false; errors: string[] } {
  if (!body || typeof body !== 'object') {
    return { valid: false, errors: ['Request body is required'] };
  }

  const request = body as UpdateScheduleBody;
  const errors: string[] = [];

  // Validate name (optional)
  if (request.name !== undefined) {
    if (typeof request.name !== 'string') {
      errors.push('name must be a string');
    } else if (request.name.trim().length === 0) {
      errors.push('name cannot be empty');
    } else if (request.name.length > 255) {
      errors.push('name must be 255 characters or less');
    }
  }

  // Validate frequency (optional)
  if (request.frequency !== undefined) {
    if (!VALID_FREQUENCIES.includes(request.frequency as ScheduleFrequency)) {
      errors.push(`Invalid frequency: ${request.frequency}. Valid values are: ${VALID_FREQUENCIES.join(', ')}`);
    }
  }

  // Validate dayOfWeek (optional)
  if (request.dayOfWeek !== undefined) {
    if (!VALID_DAYS_OF_WEEK.includes(request.dayOfWeek as DayOfWeek)) {
      errors.push(`Invalid dayOfWeek: ${request.dayOfWeek}. Valid values are: ${VALID_DAYS_OF_WEEK.join(', ')}`);
    }
  }

  // Validate dayOfMonth (optional)
  if (request.dayOfMonth !== undefined) {
    if (typeof request.dayOfMonth !== 'number' || request.dayOfMonth < 1 || request.dayOfMonth > 31) {
      errors.push('dayOfMonth must be a number between 1 and 31');
    }
  }

  // Validate timeOfDay (optional)
  if (request.timeOfDay !== undefined) {
    if (!/^([01]\d|2[0-3]):([0-5]\d)$/.test(request.timeOfDay)) {
      errors.push('timeOfDay must be in HH:mm format');
    }
  }

  // Validate recipients (optional)
  if (request.recipients !== undefined) {
    if (!Array.isArray(request.recipients)) {
      errors.push('recipients must be an array');
    } else if (request.recipients.length === 0) {
      errors.push('At least one recipient is required');
    } else {
      for (const recipient of request.recipients) {
        if (!isValidEmail(recipient)) {
          errors.push(`Invalid email address: ${recipient}`);
        }
      }
    }
  }

  // Validate status (optional)
  if (request.status !== undefined) {
    if (!VALID_STATUSES.includes(request.status as ScheduleStatus)) {
      errors.push(`Invalid status: ${request.status}. Valid values are: ${VALID_STATUSES.join(', ')}`);
    }
  }

  if (errors.length > 0) {
    return { valid: false, errors };
  }

  return {
    valid: true,
    data: {
      name: request.name,
      description: request.description,
      reportConfig: request.reportConfig as any,
      frequency: request.frequency as ScheduleFrequency | undefined,
      cronExpression: request.cronExpression,
      dayOfWeek: request.dayOfWeek as DayOfWeek | undefined,
      dayOfMonth: request.dayOfMonth,
      timeOfDay: request.timeOfDay,
      timezone: request.timezone,
      recipients: request.recipients,
      emailSubject: request.emailSubject,
      emailBody: request.emailBody,
      status: request.status as ScheduleStatus | undefined,
    },
  };
}

// ============================================================================
// Helper Functions
// ============================================================================

/**
 * Validate email address
 */
function isValidEmail(email: string): boolean {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(email);
}

/**
 * Generate a UUID
 */
function generateUUID(): string {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    const v = c === 'x' ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}
