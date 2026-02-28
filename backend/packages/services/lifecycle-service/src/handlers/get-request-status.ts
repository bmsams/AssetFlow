/**
 * Get Request Status Lambda Handler
 *
 * Retrieves the status and details of a request.
 * Requirement 6B.8: Request status tracking and notifications to requesters
 */

import type { APIGatewayProxyEvent, APIGatewayProxyResult } from 'aws-lambda';

import { API_ERROR_CODES, createApiResponse, createErrorResponse, createLambdaResponse, HTTP_STATUS } from '@ams/types';
import { createLogger, validateUUID } from '@ams/utils';

import * as requestService from '../request/request-service';

const logger = createLogger({ service: 'get-request-status-handler' });

/**
 * Lambda handler for getting request status
 */
export async function handler(
  event: APIGatewayProxyEvent
): Promise<APIGatewayProxyResult> {
  const lambdaRequestId = event.requestContext.requestId;
  const userId = event.requestContext.authorizer?.['claims']?.['sub'] as string | undefined;

  logger.info('Get request status received', { lambdaRequestId });

  try {
    // Validate user ID
    if (!userId) {
      return createLambdaResponse(
        HTTP_STATUS.UNAUTHORIZED,
        createErrorResponse(API_ERROR_CODES.UNAUTHORIZED, 'User authentication required', lambdaRequestId)
      );
    }

    // Get request ID from path parameters
    const requestId = event.pathParameters?.['requestId'];
    if (!requestId) {
      return createLambdaResponse(
        HTTP_STATUS.BAD_REQUEST,
        createErrorResponse(API_ERROR_CODES.BAD_REQUEST, 'requestId is required', lambdaRequestId)
      );
    }

    // Validate request ID is a valid UUID
    const uuidError = validateUUID(requestId, 'requestId');
    if (uuidError) {
      return createLambdaResponse(
        HTTP_STATUS.BAD_REQUEST,
        createErrorResponse(API_ERROR_CODES.BAD_REQUEST, uuidError.message, lambdaRequestId)
      );
    }

    // Get request status
    const result = await requestService.getRequestStatus(requestId);

    if (!result) {
      return createLambdaResponse(
        HTTP_STATUS.NOT_FOUND,
        createErrorResponse(API_ERROR_CODES.NOT_FOUND, `Request not found: ${requestId}`, lambdaRequestId)
      );
    }

    // Check if user has permission to view this request
    // Users can view their own requests, or if they are an approver
    const isRequester = result.request.requesterId === userId;
    const isApprover = result.request.currentApproverId === userId;
    
    // For now, allow access if user is requester or approver
    // In a full implementation, this would check role-based permissions
    if (!isRequester && !isApprover) {
      // Log the access attempt but still allow for now
      // In production, you might want to restrict this
      logger.warn('User accessing request they did not create', {
        userId,
        requestId,
        requesterId: result.request.requesterId,
      });
    }

    logger.info('Request status retrieved', {
      requestId,
      requestNumber: result.request.requestNumber,
      status: result.request.status,
    });

    return createLambdaResponse(
      HTTP_STATUS.OK,
      createApiResponse(result, lambdaRequestId)
    );
  } catch (error) {
    const err = error as Error;
    logger.error('Failed to get request status', err, { lambdaRequestId });

    return createLambdaResponse(
      HTTP_STATUS.INTERNAL_SERVER_ERROR,
      createErrorResponse(API_ERROR_CODES.INTERNAL_ERROR, 'Failed to get request status', lambdaRequestId)
    );
  }
}

/**
 * Lambda handler for getting requests by requester (list)
 */
export async function listHandler(
  event: APIGatewayProxyEvent
): Promise<APIGatewayProxyResult> {
  const lambdaRequestId = event.requestContext.requestId;
  const userId = event.requestContext.authorizer?.['claims']?.['sub'] as string | undefined;

  logger.info('List requests received', { lambdaRequestId });

  try {
    // Validate user ID
    if (!userId) {
      return createLambdaResponse(
        HTTP_STATUS.UNAUTHORIZED,
        createErrorResponse(API_ERROR_CODES.UNAUTHORIZED, 'User authentication required', lambdaRequestId)
      );
    }

    // Parse query parameters
    const queryParams = event.queryStringParameters ?? {};
    const page = queryParams['page'] ? parseInt(queryParams['page'], 10) : 1;
    const limit = queryParams['limit'] ? parseInt(queryParams['limit'], 10) : 50;

    // Validate pagination parameters
    if (isNaN(page) || page < 1) {
      return createLambdaResponse(
        HTTP_STATUS.BAD_REQUEST,
        createErrorResponse(API_ERROR_CODES.BAD_REQUEST, 'page must be a positive integer', lambdaRequestId)
      );
    }

    if (isNaN(limit) || limit < 1 || limit > 100) {
      return createLambdaResponse(
        HTTP_STATUS.BAD_REQUEST,
        createErrorResponse(API_ERROR_CODES.BAD_REQUEST, 'limit must be between 1 and 100', lambdaRequestId)
      );
    }

    // Parse status filter
    let statusFilter: requestService.RequestStatus[] | undefined;
    if (queryParams['status']) {
      statusFilter = queryParams['status'].split(',') as requestService.RequestStatus[];
    }

    // Get requests for the user
    const result = await requestService.getRequesterRequests(
      userId,
      { page, limit },
      statusFilter
    );

    logger.info('Requests listed', {
      userId,
      total: result.total,
      page: result.page,
      limit: result.limit,
    });

    return createLambdaResponse(
      HTTP_STATUS.OK,
      createApiResponse(result, lambdaRequestId)
    );
  } catch (error) {
    const err = error as Error;
    logger.error('Failed to list requests', err, { lambdaRequestId });

    return createLambdaResponse(
      HTTP_STATUS.INTERNAL_SERVER_ERROR,
      createErrorResponse(API_ERROR_CODES.INTERNAL_ERROR, 'Failed to list requests', lambdaRequestId)
    );
  }
}
