/**
 * Identify Reclamation Candidates Lambda Handler
 *
 * Identifies software installations that haven't been used within configurable
 * time periods and creates reclamation candidates for license recovery.
 *
 * Requirements: 4.6
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

import * as reclamationService from '../reclamation/reclamation-service';

const logger = createLogger({ service: 'identify-reclamation-candidates-handler' });

/**
 * Request body for identifying reclamation candidates
 */
interface IdentifyReclamationCandidatesRequest {
  readonly productId?: string;
  readonly ruleIds?: string[];
}

/**
 * Lambda handler for identifying reclamation candidates
 *
 * POST /reclamation/identify
 * Body: { productId?: string, ruleIds?: string[] }
 *
 * If productId is provided, only scans installations for that product.
 * If ruleIds are provided, only applies those specific rules.
 * If neither is provided, applies all active rules to all products.
 */
export async function handler(
  event: APIGatewayProxyEvent
): Promise<APIGatewayProxyResult> {
  const requestId = event.requestContext.requestId;

  logger.info('Identify reclamation candidates request received', { requestId });

  try {
    // Parse request body
    let request: IdentifyReclamationCandidatesRequest = {};
    if (event.body) {
      try {
        request = JSON.parse(event.body) as IdentifyReclamationCandidatesRequest;
      } catch {
        return createLambdaResponse(
          HTTP_STATUS.BAD_REQUEST,
          createErrorResponse(API_ERROR_CODES.BAD_REQUEST, 'Invalid JSON in request body', requestId)
        );
      }
    }

    // Validate productId if provided
    if (request.productId) {
      const uuidError = validateUUID(request.productId, 'productId');
      if (uuidError) {
        return createLambdaResponse(
          HTTP_STATUS.BAD_REQUEST,
          createErrorResponse(API_ERROR_CODES.VALIDATION_ERROR, uuidError.message, requestId)
        );
      }
    }

    // Validate ruleIds if provided
    if (request.ruleIds && request.ruleIds.length > 0) {
      for (const ruleId of request.ruleIds) {
        const uuidError = validateUUID(ruleId, 'ruleId');
        if (uuidError) {
          return createLambdaResponse(
            HTTP_STATUS.BAD_REQUEST,
            createErrorResponse(API_ERROR_CODES.VALIDATION_ERROR, uuidError.message, requestId)
          );
        }
      }
    }

    // Get specific rules if ruleIds provided
    let rules: reclamationService.ReclamationRule[] | undefined;
    if (request.ruleIds && request.ruleIds.length > 0) {
      const rulePromises = request.ruleIds.map((id) => reclamationService.getReclamationRule(id));
      const ruleResults = await Promise.all(rulePromises);
      rules = ruleResults.filter(
        (r): r is reclamationService.ReclamationRule => r !== null
      );

      if (rules.length === 0) {
        return createLambdaResponse(
          HTTP_STATUS.NOT_FOUND,
          createErrorResponse(
            API_ERROR_CODES.NOT_FOUND,
            'None of the specified rules were found',
            requestId
          )
        );
      }
    }

    logger.info('Identifying reclamation candidates', {
      requestId,
      productId: request.productId,
      ruleCount: rules?.length ?? 'all',
    });

    const result = await reclamationService.identifyReclamationCandidates(
      rules,
      request.productId
    );

    logger.info('Reclamation candidate identification completed', {
      requestId,
      runId: result.runId,
      rulesApplied: result.rulesApplied,
      installationsScanned: result.installationsScanned,
      candidatesIdentified: result.candidatesIdentified,
      potentialSavings: result.potentialSavings,
    });

    return createLambdaResponse(HTTP_STATUS.OK, createApiResponse(result, requestId));
  } catch (error) {
    const err = error as Error;
    logger.error('Failed to identify reclamation candidates', err, { requestId });

    return createLambdaResponse(
      HTTP_STATUS.INTERNAL_SERVER_ERROR,
      createErrorResponse(
        API_ERROR_CODES.INTERNAL_ERROR,
        'Failed to identify reclamation candidates',
        requestId
      )
    );
  }
}

/**
 * Lambda handler for getting reclamation candidates
 *
 * GET /reclamation/candidates
 * Query params: status (optional), limit (optional)
 */
export async function getCandidatesHandler(
  event: APIGatewayProxyEvent
): Promise<APIGatewayProxyResult> {
  const requestId = event.requestContext.requestId;

  logger.info('Get reclamation candidates request received', { requestId });

  try {
    const queryParams = event.queryStringParameters ?? {};
    const status = queryParams['status'] as reclamationService.ReclamationCandidate['status'] | undefined;
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
    const validStatuses = [
      'IDENTIFIED',
      'PENDING_APPROVAL',
      'APPROVED',
      'IN_PROGRESS',
      'COMPLETED',
      'CANCELLED',
    ];
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

    logger.info('Getting reclamation candidates', {
      requestId,
      status,
      limit,
    });

    const candidates = await reclamationService.getReclamationCandidates(status, limit);

    // Get summary statistics
    const summary = await reclamationService.getReclamationSummary();

    return createLambdaResponse(
      HTTP_STATUS.OK,
      createApiResponse(
        {
          items: candidates,
          count: candidates.length,
          summary,
        },
        requestId
      )
    );
  } catch (error) {
    const err = error as Error;
    logger.error('Failed to get reclamation candidates', err, { requestId });

    return createLambdaResponse(
      HTTP_STATUS.INTERNAL_SERVER_ERROR,
      createErrorResponse(
        API_ERROR_CODES.INTERNAL_ERROR,
        'Failed to get reclamation candidates',
        requestId
      )
    );
  }
}

/**
 * Lambda handler for getting reclamation rules
 *
 * GET /reclamation/rules
 */
export async function getRulesHandler(
  event: APIGatewayProxyEvent
): Promise<APIGatewayProxyResult> {
  const requestId = event.requestContext.requestId;

  logger.info('Get reclamation rules request received', { requestId });

  try {
    const rules = await reclamationService.getReclamationRules();

    return createLambdaResponse(
      HTTP_STATUS.OK,
      createApiResponse(
        {
          items: rules,
          count: rules.length,
        },
        requestId
      )
    );
  } catch (error) {
    const err = error as Error;
    logger.error('Failed to get reclamation rules', err, { requestId });

    return createLambdaResponse(
      HTTP_STATUS.INTERNAL_SERVER_ERROR,
      createErrorResponse(
        API_ERROR_CODES.INTERNAL_ERROR,
        'Failed to get reclamation rules',
        requestId
      )
    );
  }
}
