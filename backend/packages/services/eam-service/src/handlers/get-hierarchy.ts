/**
 * Get Hierarchy Handler
 *
 * Lambda handler for retrieving asset hierarchy (ancestors, descendants, or full tree).
 *
 * Requirement 5.6: THE Asset_Hierarchy_Service SHALL support parent-child 
 * relationships for complex equipment with sub-components
 */

import type { APIGatewayProxyEvent, APIGatewayProxyResult } from 'aws-lambda';
import { createLogger } from '@ams/utils';

import * as assetHierarchyService from '../asset-hierarchy/asset-hierarchy-service';
import type { HierarchyType } from '../asset-hierarchy/asset-hierarchy-service';
import { MAX_HIERARCHY_DEPTH } from '../asset-hierarchy/asset-hierarchy-repository';

const logger = createLogger({ service: 'get-hierarchy-handler' });

/**
 * Valid hierarchy types
 */
const VALID_HIERARCHY_TYPES: readonly HierarchyType[] = ['ancestors', 'descendants', 'full'];

/**
 * Lambda handler for getting asset hierarchy
 */
export async function handler(
  event: APIGatewayProxyEvent
): Promise<APIGatewayProxyResult> {
  logger.info('Get hierarchy request received', {
    path: event.path,
    httpMethod: event.httpMethod,
    queryStringParameters: event.queryStringParameters,
  });

  try {
    // Get asset ID from path parameters
    const assetId = event.pathParameters?.['assetId'];

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

    // Get hierarchy type from query parameters (default: descendants)
    const typeParam = event.queryStringParameters?.['type'] ?? 'descendants';
    
    if (!VALID_HIERARCHY_TYPES.includes(typeParam as HierarchyType)) {
      return {
        statusCode: 400,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          error: 'Bad Request',
          message: `Invalid hierarchy type. Must be one of: ${VALID_HIERARCHY_TYPES.join(', ')}`,
        }),
      };
    }

    const hierarchyType = typeParam as HierarchyType;

    // Get max depth from query parameters (optional)
    let maxDepth: number | undefined;
    if (event.queryStringParameters?.['maxDepth']) {
      maxDepth = parseInt(event.queryStringParameters['maxDepth'], 10);
      if (isNaN(maxDepth) || maxDepth < 1) {
        return {
          statusCode: 400,
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            error: 'Bad Request',
            message: 'maxDepth must be a positive integer',
          }),
        };
      }
      // Cap at maximum allowed depth
      maxDepth = Math.min(maxDepth, MAX_HIERARCHY_DEPTH);
    }

    logger.info('Getting hierarchy', { assetId, hierarchyType, maxDepth });

    // Get the hierarchy
    const result = await assetHierarchyService.getHierarchy(assetId, hierarchyType, maxDepth);

    logger.info('Hierarchy retrieved successfully', {
      assetId,
      hierarchyType,
      totalNodes: result.totalNodes,
      maxDepth: result.maxDepth,
    });

    return {
      statusCode: 200,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        assetId,
        hierarchyType,
        rootAsset: result.rootAsset,
        nodes: result.nodes,
        totalNodes: result.totalNodes,
        maxDepth: result.maxDepth,
      }),
    };
  } catch (error) {
    const err = error as Error;
    logger.error('Failed to get hierarchy', err);

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
        message: 'Failed to retrieve hierarchy',
      }),
    };
  }
}

/**
 * Lambda handler for getting direct children of an asset
 */
export async function handlerChildren(
  event: APIGatewayProxyEvent
): Promise<APIGatewayProxyResult> {
  logger.info('Get children request received', {
    path: event.path,
    httpMethod: event.httpMethod,
  });

  try {
    const assetId = event.pathParameters?.['assetId'];

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

    logger.info('Getting children', { assetId });

    const children = await assetHierarchyService.getChildAssets(assetId);

    logger.info('Children retrieved successfully', {
      assetId,
      childCount: children.length,
    });

    return {
      statusCode: 200,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        parentAssetId: assetId,
        children,
        count: children.length,
      }),
    };
  } catch (error) {
    const err = error as Error;
    logger.error('Failed to get children', err);

    return {
      statusCode: 500,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        error: 'Internal Server Error',
        message: 'Failed to retrieve children',
      }),
    };
  }
}

/**
 * Lambda handler for getting parent of an asset
 */
export async function handlerParent(
  event: APIGatewayProxyEvent
): Promise<APIGatewayProxyResult> {
  logger.info('Get parent request received', {
    path: event.path,
    httpMethod: event.httpMethod,
  });

  try {
    const assetId = event.pathParameters?.['assetId'];

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

    logger.info('Getting parent', { assetId });

    const parent = await assetHierarchyService.getParentAsset(assetId);

    if (!parent) {
      return {
        statusCode: 200,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          childAssetId: assetId,
          parent: null,
          message: 'Asset has no parent (is a root asset)',
        }),
      };
    }

    logger.info('Parent retrieved successfully', {
      assetId,
      parentAssetId: parent.assetId,
    });

    return {
      statusCode: 200,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        childAssetId: assetId,
        parent,
      }),
    };
  } catch (error) {
    const err = error as Error;
    logger.error('Failed to get parent', err);

    return {
      statusCode: 500,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        error: 'Internal Server Error',
        message: 'Failed to retrieve parent',
      }),
    };
  }
}
