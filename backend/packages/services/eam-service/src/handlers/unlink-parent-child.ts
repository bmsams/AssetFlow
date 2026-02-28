/**
 * Unlink Parent-Child Handler
 *
 * Lambda handler for removing parent-child relationships between assets.
 *
 * Requirement 5.6: THE Asset_Hierarchy_Service SHALL support parent-child 
 * relationships for complex equipment with sub-components
 */

import type { APIGatewayProxyEvent, APIGatewayProxyResult } from 'aws-lambda';
import { createLogger } from '@ams/utils';

import * as assetHierarchyService from '../asset-hierarchy/asset-hierarchy-service';

const logger = createLogger({ service: 'unlink-parent-child-handler' });

/**
 * Lambda handler for unlinking parent-child relationship
 */
export async function handler(
  event: APIGatewayProxyEvent
): Promise<APIGatewayProxyResult> {
  logger.info('Unlink parent-child request received', {
    path: event.path,
    httpMethod: event.httpMethod,
  });

  try {
    // Get child asset ID from path parameters
    const childAssetId = event.pathParameters?.['assetId'] || event.pathParameters?.['childAssetId'];

    if (!childAssetId) {
      return {
        statusCode: 400,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          error: 'Bad Request',
          message: 'Asset ID is required in path parameters',
        }),
      };
    }

    logger.info('Unlinking parent-child relationship', { childAssetId });

    // Unlink the asset from its parent
    const updatedChild = await assetHierarchyService.unlinkParentChild(childAssetId);

    logger.info('Parent-child relationship removed successfully', {
      childAssetId: updatedChild.assetId,
    });

    return {
      statusCode: 200,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        message: 'Parent-child relationship removed successfully',
        asset: updatedChild,
      }),
    };
  } catch (error) {
    const err = error as Error;
    logger.error('Failed to unlink parent-child relationship', err);

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

    if (err.message.includes('no parent')) {
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
        message: 'Failed to remove parent-child relationship',
      }),
    };
  }
}
