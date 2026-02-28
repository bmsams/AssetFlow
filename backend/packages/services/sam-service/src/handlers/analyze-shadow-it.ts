/**
 * Analyze Shadow IT Lambda Handler
 *
 * Analyzes network traffic logs to identify unauthorized SaaS application usage
 * and generates alerts with application details and user information.
 *
 * Requirements: 4.8, 4.9
 */

import type { APIGatewayProxyEvent, APIGatewayProxyResult } from 'aws-lambda';

import {
  API_ERROR_CODES,
  createApiResponse,
  createErrorResponse,
  createLambdaResponse,
  HTTP_STATUS,
} from '@ams/types';
import { createLogger, validateUUID } from '@ams/utils';

import type { ShadowITStatus, TrafficLogEntry } from '../shadow-it/shadow-it-repository';
import * as shadowITService from '../shadow-it/shadow-it-service';

const logger = createLogger({ service: 'analyze-shadow-it-handler' });

/**
 * Request body for analyzing shadow IT
 */
interface AnalyzeShadowITRequest {
  readonly trafficLogs: readonly TrafficLogEntry[];
}

/**
 * Validate traffic log entry
 */
function validateTrafficLogEntry(
  entry: unknown,
  index: number
): { valid: true; entry: TrafficLogEntry } | { valid: false; error: string } {
  if (!entry || typeof entry !== 'object') {
    return { valid: false, error: `trafficLogs[${index}] must be an object` };
  }

  const log = entry as Record<string, unknown>;

  if (typeof log['timestamp'] !== 'string') {
    return { valid: false, error: `trafficLogs[${index}].timestamp must be a string` };
  }

  if (typeof log['userId'] !== 'string') {
    return { valid: false, error: `trafficLogs[${index}].userId must be a string` };
  }

  if (typeof log['sourceIp'] !== 'string') {
    return { valid: false, error: `trafficLogs[${index}].sourceIp must be a string` };
  }

  if (typeof log['destinationDomain'] !== 'string') {
    return { valid: false, error: `trafficLogs[${index}].destinationDomain must be a string` };
  }

  if (typeof log['destinationUrl'] !== 'string') {
    return { valid: false, error: `trafficLogs[${index}].destinationUrl must be a string` };
  }

  if (typeof log['bytesTransferred'] !== 'number' || log['bytesTransferred'] < 0) {
    return { valid: false, error: `trafficLogs[${index}].bytesTransferred must be a non-negative number` };
  }

  if (typeof log['protocol'] !== 'string') {
    return { valid: false, error: `trafficLogs[${index}].protocol must be a string` };
  }

  return {
    valid: true,
    entry: {
      timestamp: log['timestamp'] as string,
      userId: log['userId'] as string,
      sourceIp: log['sourceIp'] as string,
      destinationDomain: log['destinationDomain'] as string,
      destinationUrl: log['destinationUrl'] as string,
      bytesTransferred: log['bytesTransferred'] as number,
      protocol: log['protocol'] as string,
    },
  };
}

/**
 * Lambda handler for analyzing shadow IT from traffic logs
 *
 * POST /shadow-it/analyze
 * Body: { trafficLogs: TrafficLogEntry[] }
 *
 * Requirement 4.8: Analyze network traffic logs to identify unauthorized SaaS application usage
 * Requirement 4.9: Create alerts with application details and user information
 */
export async function handler(
  event: APIGatewayProxyEvent
): Promise<APIGatewayProxyResult> {
  const requestId = event.requestContext.requestId;

  logger.info('Analyze shadow IT request received', { requestId });

  try {
    // Parse request body
    if (!event.body) {
      return createLambdaResponse(
        HTTP_STATUS.BAD_REQUEST,
        createErrorResponse(API_ERROR_CODES.BAD_REQUEST, 'Request body is required', requestId)
      );
    }

    let request: AnalyzeShadowITRequest;
    try {
      request = JSON.parse(event.body) as AnalyzeShadowITRequest;
    } catch {
      return createLambdaResponse(
        HTTP_STATUS.BAD_REQUEST,
        createErrorResponse(API_ERROR_CODES.BAD_REQUEST, 'Invalid JSON in request body', requestId)
      );
    }

    // Validate trafficLogs array
    if (!Array.isArray(request.trafficLogs)) {
      return createLambdaResponse(
        HTTP_STATUS.BAD_REQUEST,
        createErrorResponse(
          API_ERROR_CODES.VALIDATION_ERROR,
          'trafficLogs must be an array',
          requestId
        )
      );
    }

    // Validate each traffic log entry (limit validation to first 100 for performance)
    const validatedLogs: TrafficLogEntry[] = [];
    const maxValidation = Math.min(request.trafficLogs.length, 100);

    for (let i = 0; i < maxValidation; i++) {
      const result = validateTrafficLogEntry(request.trafficLogs[i], i);
      if (!result.valid) {
        return createLambdaResponse(
          HTTP_STATUS.BAD_REQUEST,
          createErrorResponse(API_ERROR_CODES.VALIDATION_ERROR, result.error, requestId)
        );
      }
      validatedLogs.push(result.entry);
    }

    // Add remaining logs without detailed validation (trust the format after first 100)
    for (let i = maxValidation; i < request.trafficLogs.length; i++) {
      validatedLogs.push(request.trafficLogs[i] as TrafficLogEntry);
    }

    logger.info('Analyzing shadow IT from traffic logs', {
      requestId,
      logCount: validatedLogs.length,
    });

    const result = await shadowITService.analyzeShadowIT(validatedLogs);

    logger.info('Shadow IT analysis completed', {
      requestId,
      analysisId: result.analysisId,
      logsAnalyzed: result.logsAnalyzed,
      shadowITDetected: result.shadowITDetected,
      alertsGenerated: result.alertsGenerated,
    });

    return createLambdaResponse(HTTP_STATUS.OK, createApiResponse(result, requestId));
  } catch (error) {
    const err = error as Error;
    logger.error('Failed to analyze shadow IT', err, { requestId });

    return createLambdaResponse(
      HTTP_STATUS.INTERNAL_SERVER_ERROR,
      createErrorResponse(
        API_ERROR_CODES.INTERNAL_ERROR,
        'Failed to analyze shadow IT',
        requestId
      )
    );
  }
}

/**
 * Lambda handler for getting shadow IT detections
 *
 * GET /shadow-it/detections
 * Query params: status (optional), limit (optional)
 */
export async function getDetectionsHandler(
  event: APIGatewayProxyEvent
): Promise<APIGatewayProxyResult> {
  const requestId = event.requestContext.requestId;

  logger.info('Get shadow IT detections request received', { requestId });

  try {
    const queryParams = event.queryStringParameters ?? {};
    const status = queryParams['status'] as ShadowITStatus | undefined;
    const limit = queryParams['limit'] ? parseInt(queryParams['limit'], 10) : 100;

    // Validate limit
    if (isNaN(limit) || limit < 1 || limit > 1000) {
      return createLambdaResponse(
        HTTP_STATUS.BAD_REQUEST,
        createErrorResponse(
          API_ERROR_CODES.VALIDATION_ERROR,
          'limit must be a number between 1 and 1000',
          requestId
        )
      );
    }

    // Validate status if provided
    const validStatuses = ['DETECTED', 'UNDER_REVIEW', 'APPROVED', 'BLOCKED'];
    if (status && !validStatuses.includes(status)) {
      return createLambdaResponse(
        HTTP_STATUS.BAD_REQUEST,
        createErrorResponse(
          API_ERROR_CODES.VALIDATION_ERROR,
          `status must be one of: ${validStatuses.join(', ')}`,
          requestId
        )
      );
    }

    logger.info('Getting shadow IT detections', {
      requestId,
      status,
      limit,
    });

    const detections = await shadowITService.getDetections(status, limit);
    const summary = await shadowITService.getShadowITSummary();

    return createLambdaResponse(
      HTTP_STATUS.OK,
      createApiResponse(
        {
          items: detections,
          count: detections.length,
          summary,
        },
        requestId
      )
    );
  } catch (error) {
    const err = error as Error;
    logger.error('Failed to get shadow IT detections', err, { requestId });

    return createLambdaResponse(
      HTTP_STATUS.INTERNAL_SERVER_ERROR,
      createErrorResponse(
        API_ERROR_CODES.INTERNAL_ERROR,
        'Failed to get shadow IT detections',
        requestId
      )
    );
  }
}

/**
 * Lambda handler for getting a specific shadow IT detection
 *
 * GET /shadow-it/detections/{detectionId}
 */
export async function getDetectionHandler(
  event: APIGatewayProxyEvent
): Promise<APIGatewayProxyResult> {
  const requestId = event.requestContext.requestId;
  const detectionId = event.pathParameters?.['detectionId'];

  logger.info('Get shadow IT detection request received', { requestId, detectionId });

  try {
    if (!detectionId) {
      return createLambdaResponse(
        HTTP_STATUS.BAD_REQUEST,
        createErrorResponse(API_ERROR_CODES.BAD_REQUEST, 'detectionId is required', requestId)
      );
    }

    const uuidError = validateUUID(detectionId, 'detectionId');
    if (uuidError) {
      return createLambdaResponse(
        HTTP_STATUS.BAD_REQUEST,
        createErrorResponse(API_ERROR_CODES.VALIDATION_ERROR, uuidError.message, requestId)
      );
    }

    const detection = await shadowITService.getDetection(detectionId);

    if (!detection) {
      return createLambdaResponse(
        HTTP_STATUS.NOT_FOUND,
        createErrorResponse(
          API_ERROR_CODES.NOT_FOUND,
          `Shadow IT detection not found: ${detectionId}`,
          requestId
        )
      );
    }

    // Get associated alerts
    const alerts = await shadowITService.getAlertsByDetection(detectionId);

    return createLambdaResponse(
      HTTP_STATUS.OK,
      createApiResponse(
        {
          detection,
          alerts,
        },
        requestId
      )
    );
  } catch (error) {
    const err = error as Error;
    logger.error('Failed to get shadow IT detection', err, { requestId, detectionId });

    return createLambdaResponse(
      HTTP_STATUS.INTERNAL_SERVER_ERROR,
      createErrorResponse(
        API_ERROR_CODES.INTERNAL_ERROR,
        'Failed to get shadow IT detection',
        requestId
      )
    );
  }
}

/**
 * Lambda handler for updating shadow IT detection status
 *
 * PATCH /shadow-it/detections/{detectionId}
 * Body: { status: ShadowITStatus, reviewNotes?: string }
 */
export async function updateDetectionStatusHandler(
  event: APIGatewayProxyEvent
): Promise<APIGatewayProxyResult> {
  const requestId = event.requestContext.requestId;
  const detectionId = event.pathParameters?.['detectionId'];

  logger.info('Update shadow IT detection status request received', { requestId, detectionId });

  try {
    if (!detectionId) {
      return createLambdaResponse(
        HTTP_STATUS.BAD_REQUEST,
        createErrorResponse(API_ERROR_CODES.BAD_REQUEST, 'detectionId is required', requestId)
      );
    }

    const uuidError = validateUUID(detectionId, 'detectionId');
    if (uuidError) {
      return createLambdaResponse(
        HTTP_STATUS.BAD_REQUEST,
        createErrorResponse(API_ERROR_CODES.VALIDATION_ERROR, uuidError.message, requestId)
      );
    }

    if (!event.body) {
      return createLambdaResponse(
        HTTP_STATUS.BAD_REQUEST,
        createErrorResponse(API_ERROR_CODES.BAD_REQUEST, 'Request body is required', requestId)
      );
    }

    let body: { status?: string; reviewNotes?: string };
    try {
      body = JSON.parse(event.body) as { status?: string; reviewNotes?: string };
    } catch {
      return createLambdaResponse(
        HTTP_STATUS.BAD_REQUEST,
        createErrorResponse(API_ERROR_CODES.BAD_REQUEST, 'Invalid JSON in request body', requestId)
      );
    }

    // Validate status
    const validStatuses = ['DETECTED', 'UNDER_REVIEW', 'APPROVED', 'BLOCKED'];
    if (!body.status || !validStatuses.includes(body.status)) {
      return createLambdaResponse(
        HTTP_STATUS.BAD_REQUEST,
        createErrorResponse(
          API_ERROR_CODES.VALIDATION_ERROR,
          `status must be one of: ${validStatuses.join(', ')}`,
          requestId
        )
      );
    }

    // Get user ID from authorizer context (in real implementation)
    const reviewedBy = event.requestContext.authorizer?.['userId'] as string ?? 'system';

    const detection = await shadowITService.updateDetectionStatus(
      detectionId,
      body.status as ShadowITStatus,
      reviewedBy,
      body.reviewNotes
    );

    logger.info('Shadow IT detection status updated', {
      requestId,
      detectionId,
      status: body.status,
      reviewedBy,
    });

    return createLambdaResponse(HTTP_STATUS.OK, createApiResponse(detection, requestId));
  } catch (error) {
    const err = error as Error;

    if (err.message.includes('not found')) {
      return createLambdaResponse(
        HTTP_STATUS.NOT_FOUND,
        createErrorResponse(API_ERROR_CODES.NOT_FOUND, err.message, requestId)
      );
    }

    logger.error('Failed to update shadow IT detection status', err, { requestId, detectionId });

    return createLambdaResponse(
      HTTP_STATUS.INTERNAL_SERVER_ERROR,
      createErrorResponse(
        API_ERROR_CODES.INTERNAL_ERROR,
        'Failed to update shadow IT detection status',
        requestId
      )
    );
  }
}

/**
 * Lambda handler for getting shadow IT alerts
 *
 * GET /shadow-it/alerts
 * Query params: status (optional), userId (optional), limit (optional)
 */
export async function getAlertsHandler(
  event: APIGatewayProxyEvent
): Promise<APIGatewayProxyResult> {
  const requestId = event.requestContext.requestId;

  logger.info('Get shadow IT alerts request received', { requestId });

  try {
    const queryParams = event.queryStringParameters ?? {};
    const status = queryParams['status'] as shadowITService.ShadowITAlert['status'] | undefined;
    const userId = queryParams['userId'];
    const limit = queryParams['limit'] ? parseInt(queryParams['limit'], 10) : 100;

    // Validate limit
    if (isNaN(limit) || limit < 1 || limit > 1000) {
      return createLambdaResponse(
        HTTP_STATUS.BAD_REQUEST,
        createErrorResponse(
          API_ERROR_CODES.VALIDATION_ERROR,
          'limit must be a number between 1 and 1000',
          requestId
        )
      );
    }

    // Validate status if provided
    const validStatuses = ['NEW', 'ACKNOWLEDGED', 'RESOLVED', 'IGNORED'];
    if (status && !validStatuses.includes(status)) {
      return createLambdaResponse(
        HTTP_STATUS.BAD_REQUEST,
        createErrorResponse(
          API_ERROR_CODES.VALIDATION_ERROR,
          `status must be one of: ${validStatuses.join(', ')}`,
          requestId
        )
      );
    }

    // Validate userId if provided
    if (userId) {
      const uuidError = validateUUID(userId, 'userId');
      if (uuidError) {
        return createLambdaResponse(
          HTTP_STATUS.BAD_REQUEST,
          createErrorResponse(API_ERROR_CODES.VALIDATION_ERROR, uuidError.message, requestId)
        );
      }
    }

    logger.info('Getting shadow IT alerts', {
      requestId,
      status,
      userId,
      limit,
    });

    let alerts: shadowITService.ShadowITAlert[];

    if (userId) {
      alerts = await shadowITService.getAlertsByUser(userId);
      // Filter by status if provided
      if (status) {
        alerts = alerts.filter((a) => a.status === status);
      }
      // Apply limit
      alerts = alerts.slice(0, limit);
    } else if (status) {
      alerts = await shadowITService.getAlertsByStatus(status, limit);
    } else {
      alerts = await shadowITService.getAlertsByStatus(['NEW', 'ACKNOWLEDGED'], limit);
    }

    return createLambdaResponse(
      HTTP_STATUS.OK,
      createApiResponse(
        {
          items: alerts,
          count: alerts.length,
        },
        requestId
      )
    );
  } catch (error) {
    const err = error as Error;
    logger.error('Failed to get shadow IT alerts', err, { requestId });

    return createLambdaResponse(
      HTTP_STATUS.INTERNAL_SERVER_ERROR,
      createErrorResponse(
        API_ERROR_CODES.INTERNAL_ERROR,
        'Failed to get shadow IT alerts',
        requestId
      )
    );
  }
}

/**
 * Lambda handler for updating shadow IT alert status
 *
 * PATCH /shadow-it/alerts/{alertId}
 * Body: { action: 'acknowledge' | 'resolve' | 'ignore', notes?: string }
 */
export async function updateAlertStatusHandler(
  event: APIGatewayProxyEvent
): Promise<APIGatewayProxyResult> {
  const requestId = event.requestContext.requestId;
  const alertId = event.pathParameters?.['alertId'];

  logger.info('Update shadow IT alert status request received', { requestId, alertId });

  try {
    if (!alertId) {
      return createLambdaResponse(
        HTTP_STATUS.BAD_REQUEST,
        createErrorResponse(API_ERROR_CODES.BAD_REQUEST, 'alertId is required', requestId)
      );
    }

    const uuidError = validateUUID(alertId, 'alertId');
    if (uuidError) {
      return createLambdaResponse(
        HTTP_STATUS.BAD_REQUEST,
        createErrorResponse(API_ERROR_CODES.VALIDATION_ERROR, uuidError.message, requestId)
      );
    }

    if (!event.body) {
      return createLambdaResponse(
        HTTP_STATUS.BAD_REQUEST,
        createErrorResponse(API_ERROR_CODES.BAD_REQUEST, 'Request body is required', requestId)
      );
    }

    let body: { action?: string; notes?: string };
    try {
      body = JSON.parse(event.body) as { action?: string; notes?: string };
    } catch {
      return createLambdaResponse(
        HTTP_STATUS.BAD_REQUEST,
        createErrorResponse(API_ERROR_CODES.BAD_REQUEST, 'Invalid JSON in request body', requestId)
      );
    }

    // Validate action
    const validActions = ['acknowledge', 'resolve', 'ignore'];
    if (!body.action || !validActions.includes(body.action)) {
      return createLambdaResponse(
        HTTP_STATUS.BAD_REQUEST,
        createErrorResponse(
          API_ERROR_CODES.VALIDATION_ERROR,
          `action must be one of: ${validActions.join(', ')}`,
          requestId
        )
      );
    }

    // Get user ID from authorizer context (in real implementation)
    const updatedBy = event.requestContext.authorizer?.['userId'] as string ?? 'system';

    let alert: shadowITService.ShadowITAlert;

    switch (body.action) {
      case 'acknowledge':
        alert = await shadowITService.acknowledgeAlert(alertId, updatedBy, body.notes);
        break;
      case 'resolve':
        alert = await shadowITService.resolveAlert(alertId, updatedBy, body.notes);
        break;
      case 'ignore':
        alert = await shadowITService.ignoreAlert(alertId, updatedBy, body.notes);
        break;
      default:
        throw new Error(`Unknown action: ${body.action}`);
    }

    logger.info('Shadow IT alert status updated', {
      requestId,
      alertId,
      action: body.action,
      updatedBy,
    });

    return createLambdaResponse(HTTP_STATUS.OK, createApiResponse(alert, requestId));
  } catch (error) {
    const err = error as Error;

    if (err.message.includes('not found')) {
      return createLambdaResponse(
        HTTP_STATUS.NOT_FOUND,
        createErrorResponse(API_ERROR_CODES.NOT_FOUND, err.message, requestId)
      );
    }

    logger.error('Failed to update shadow IT alert status', err, { requestId, alertId });

    return createLambdaResponse(
      HTTP_STATUS.INTERNAL_SERVER_ERROR,
      createErrorResponse(
        API_ERROR_CODES.INTERNAL_ERROR,
        'Failed to update shadow IT alert status',
        requestId
      )
    );
  }
}

/**
 * Lambda handler for getting shadow IT summary
 *
 * GET /shadow-it/summary
 */
export async function getSummaryHandler(
  event: APIGatewayProxyEvent
): Promise<APIGatewayProxyResult> {
  const requestId = event.requestContext.requestId;

  logger.info('Get shadow IT summary request received', { requestId });

  try {
    const summary = await shadowITService.getShadowITSummary();
    const knownApps = await shadowITService.getKnownApplications();
    const approvedApps = await shadowITService.getApprovedApplications();
    const blockedApps = await shadowITService.getBlockedApplications();

    return createLambdaResponse(
      HTTP_STATUS.OK,
      createApiResponse(
        {
          summary,
          knownApplicationsCount: knownApps.length,
          approvedApplicationsCount: approvedApps.length,
          blockedApplicationsCount: blockedApps.length,
        },
        requestId
      )
    );
  } catch (error) {
    const err = error as Error;
    logger.error('Failed to get shadow IT summary', err, { requestId });

    return createLambdaResponse(
      HTTP_STATUS.INTERNAL_SERVER_ERROR,
      createErrorResponse(
        API_ERROR_CODES.INTERNAL_ERROR,
        'Failed to get shadow IT summary',
        requestId
      )
    );
  }
}
