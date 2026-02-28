/**
 * Link Parent-Child Handler
 *
 * Lambda handler for linking assets in a parent-child relationship.
 * Supports complex equipment with sub-components.
 *
 * Requirement 5.6: THE Asset_Hierarchy_Service SHALL support parent-child 
 * relationships for complex equipment with sub-components
 */

import type { APIGatewayProxyEvent, APIGatewayProxyResult } from 'aws-lambda';
import { createLogger } from '@ams/utils';

import * as assetHierarchyService from '../asset-hierarchy/asset-hierarchy-service';

const logger = createLogger({ service: 'link-parent-child-handler' });

/**
 * Request body for linking parent-child
 */
interface LinkParentChildRequestBody {
  readonly parentAssetId: string;
  readonly childAssetId: string;
}

/**
 * Validate request body
 */
function validateRequest(body: unknown): body is LinkParentChildRequestBody {
  if (!body || typeof body !== 'object') {
    return false;
  }

  const request = body as Record<string, unknown>;

  if (typeof request['parentAssetId'] !== 'string' || !request['parentAssetId']) {
    return false;
  }

  if (typeof request['childAssetId'] !== 'string' || !request['childAssetId']) {
    return false;
  }

  return true;
}

/**
 * Lambda handler for linking parent-child relationship
 */
export async function handler(
  event: APIGatewayProxyEvent
): Promise<APIGatewayProxyResult> {
  logger.info('Link parent-child request received', {
    path: event.path,
    httpMethod: event.httpMethod,
  });

  try {
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
          message: 'parentAssetId and childAssetId are required',
        }),
      };
    }

    const { parentAssetId, childAssetId } = requestBody;

    logger.info('Linking parent-child relationship', { parentAssetId, childAssetId });

    // Link the assets
    const updatedChild = await assetHierarchyService.linkParentChild({
      parentAssetId,
      childAssetId,
    });

    logger.info('Parent-child relationship created successfully', {
      parentAssetId,
      childAssetId: updatedChild.assetId,
    });

    return {
      statusCode: 200,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        message: 'Parent-child relationship created successfully',
        asset: updatedChild,
      }),
    };
  } catch (error) {
    const err = error as Error;
    logger.error('Failed to link parent-child relationship', err);

    // Handle specific error cases
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

    if (err.message.includes('circular reference') || err.message.includes('own parent')) {
      return {
        statusCode: 400,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          error: 'Bad Request',
          message: err.message,
        }),
      };
    }

    return {
      statusCode: 500,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        error: 'Internal Server Error',
        message: 'Failed to create parent-child relationship',
      }),
    };
  }
}
