/**
 * Propagate Status Handler
 *
 * Lambda handler for propagating status changes to child components.
 *
 * Requirement 5.7: WHEN a parent asset status changes, THE Asset_Hierarchy_Service 
 * SHALL propagate relevant status updates to child components
 */

import type { APIGatewayProxyEvent, APIGatewayProxyResult } from 'aws-lambda';
import { createLogger } from '@ams/utils';

import * as assetHierarchyService from '../asset-hierarchy/asset-hierarchy-service';
import type { AssetStatus } from '../asset-hierarchy/asset-hierarchy-repository';

const logger = createLogger({ service: 'propagate-status-handler' });

/**
 * Valid asset statuses
 */
const VALID_STATUSES: readonly AssetStatus[] = [
  'ORDERED',
  'RECEIVED',
  'IN_STOCK',
  'RESERVED',
  'DEPLOYED',
  'IN_MAINTENANCE',
  'RETIRED',
  'DISPOSED',
];

/**
 * Request body for status propagation
 */
interface PropagateStatusRequestBody {
  readonly status: AssetStatus;
}

/**
 * Validate request body
 */
function validateRequest(body: unknown): body is PropagateStatusRequestBody {
  if (!body || typeof body !== 'object') {
    return false;
  }

  const request = body as Record<string, unknown>;

  if (typeof request['status'] !== 'string' || !VALID_STATUSES.includes(request['status'] as AssetStatus)) {
    return false;
  }

  return true;
}

/**
 * Lambda handler for propagating status to descendants
 */
export async function handler(
  event: APIGatewayProxyEvent
): Promise<APIGatewayProxyResult> {
  logger.info('Propagate status request received', {
    path: event.path,
    httpMethod: event.httpMethod,
  });

  try {
    // Get parent asset ID from path parameters
    const parentAssetId = event.pathParameters?.['assetId'];

    if (!parentAssetId) {
      return {
        statusCode: 400,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          error: 'Bad Request',
          message: 'Asset ID is required in path parameters',
        }),
      };
    }

    // Parse request body
    if (!event.body) {
      return {
        statusCode: 400,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          error: 'Bad Request',
          message: 'Request body is required',
        }),
      };
    }

    let requestBody: unknown;
    try {
      requestBody = JSON.parse(event.body);
    } catch {
      return {
        statusCode: 400,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          error: 'Bad Request',
          message: 'Invalid JSON in request body',
        }),
      };
    }

    // Validate request
    if (!validateRequest(requestBody)) {
      return {
        statusCode: 400,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          error: 'Bad Request',
          message: `status is required and must be one of: ${VALID_STATUSES.join(', ')}`,
        }),
      };
    }

    const { status } = requestBody;

    // Check if status should propagate
    if (!assetHierarchyService.shouldPropagateStatus(status)) {
      return {
        statusCode: 200,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          message: `Status '${status}' does not propagate to children`,
          parentAssetId,
          status,
          childrenUpdated: 0,
          updatedAssetIds: [],
        }),
      };
    }

    logger.info('Propagating status to descendants', { parentAssetId, status });

    // Propagate the status
    const result = await assetHierarchyService.propagateStatus(parentAssetId, status);

    logger.info('Status propagation complete', {
      parentAssetId,
      status,
      childrenUpdated: result.childrenUpdated,
    });

    return {
      statusCode: 200,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        message: 'Status propagated successfully',
        parentAssetId: result.parentAssetId,
        newStatus: result.newStatus,
        childrenUpdated: result.childrenUpdated,
        updatedAssetIds: result.updatedAssetIds,
      }),
    };
  } catch (error) {
    const err = error as Error;
    logger.error('Failed to propagate status', err);

    if (err.message.includes('not found')) {
      return {
        statusCode: 404,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          error: 'Not Found',
          message: err.message,
        }),
      };
    }

    return {
      statusCode: 500,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        error: 'Internal Server Error',
        message: 'Failed to propagate status',
      }),
    };
  }
}

/**
 * Lambda handler for checking if status should propagate
 * Useful for UI to determine if propagation warning should be shown
 */
export async function handlerCheckPropagation(
  event: APIGatewayProxyEvent
): Promise<APIGatewayProxyResult> {
  logger.info('Check propagation request received', {
    path: event.path,
    httpMethod: event.httpMethod,
  });

  try {
    const assetId = event.pathParameters?.['assetId'];
    const status = event.queryStringParameters?.['status'] as AssetStatus | undefined;

    if (!assetId) {
      return {
        statusCode: 400,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          error: 'Bad Request',
          message: 'Asset ID is required in path parameters',
        }),
      };
    }

    if (!status || !VALID_STATUSES.includes(status)) {
      return {
        statusCode: 400,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          error: 'Bad Request',
          message: `status query parameter is required and must be one of: ${VALID_STATUSES.join(', ')}`,
        }),
      };
    }

    // Check if status would propagate
    const wouldPropagate = assetHierarchyService.shouldPropagateStatus(status);

    // Get descendant count if status would propagate
    let descendantCount = 0;
    if (wouldPropagate) {
      descendantCount = await assetHierarchyService.getDescendantCount(assetId);
    }

    return {
      statusCode: 200,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        assetId,
        status,
        wouldPropagate,
        descendantCount,
        message: wouldPropagate
          ? `Changing status to '${status}' will update ${descendantCount} descendant asset(s)`
          : `Status '${status}' does not propagate to children`,
      }),
    };
  } catch (error) {
    const err = error as Error;
    logger.error('Failed to check propagation', err);

    return {
      statusCode: 500,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        error: 'Internal Server Error',
        message: 'Failed to check propagation',
      }),
    };
  }
}
