/**
 * Deploy Asset Lambda Handler
 *
 * Deploys an asset to a user and optionally creates CMDB relationships.
 * Requirement 6.6: Assign the asset to a user and create CMDB relationships
 * Requirement 6.7: Correlate discovery data with the asset record
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

import type { DeployAssetInput, RelationType } from '../deployment/deployment-service';
import * as deploymentService from '../deployment/deployment-service';

const logger = createLogger({ service: 'deploy-asset-handler' });

/**
 * Valid relationship types for deployment
 */
const VALID_RELATION_TYPES: RelationType[] = [
  'PARENT_CHILD',
  'DEPENDENCY',
  'CONNECTED_TO',
  'INSTALLED_ON',
  'RUNS_ON',
  'LOCATED_IN',
  'MANAGED_BY',
  'USED_BY',
];

/**
 * Validate a relationship in the request
 */
function validateRelationship(
  rel: unknown,
  index: number
): { valid: true; data: NonNullable<DeployAssetInput['relationships']>[number] } | { valid: false; errors: string[] } {
  if (!rel || typeof rel !== 'object') {
    return { valid: false, errors: [`relationships[${index}]: must be an object`] };
  }

  const relObj = rel as Record<string, unknown>;
  const errors: string[] = [];

  // Validate targetAssetId (required)
  if (!relObj['targetAssetId']) {
    errors.push(`relationships[${index}]: targetAssetId is required`);
  } else if (typeof relObj['targetAssetId'] !== 'string') {
    errors.push(`relationships[${index}]: targetAssetId must be a string`);
  } else {
    const uuidError = validateUUID(relObj['targetAssetId'] as string, 'targetAssetId');
    if (uuidError) {
      errors.push(`relationships[${index}]: ${uuidError.message}`);
    }
  }

  // Validate relationType (required)
  if (!relObj['relationType']) {
    errors.push(`relationships[${index}]: relationType is required`);
  } else if (typeof relObj['relationType'] !== 'string') {
    errors.push(`relationships[${index}]: relationType must be a string`);
  } else if (!VALID_RELATION_TYPES.includes(relObj['relationType'] as RelationType)) {
    errors.push(
      `relationships[${index}]: relationType must be one of: ${VALID_RELATION_TYPES.join(', ')}`
    );
  }

  // Validate optional metadata
  if (relObj['metadata'] !== undefined && relObj['metadata'] !== null) {
    if (typeof relObj['metadata'] !== 'object' || Array.isArray(relObj['metadata'])) {
      errors.push(`relationships[${index}]: metadata must be an object`);
    }
  }

  if (errors.length > 0) {
    return { valid: false, errors };
  }

  return {
    valid: true,
    data: {
      targetAssetId: relObj['targetAssetId'] as string,
      relationType: relObj['relationType'] as RelationType,
      metadata: relObj['metadata'] as Record<string, unknown> | undefined,
    },
  };
}

/**
 * Validate discovery data in the request
 */
function validateDiscoveryData(
  data: unknown
): { valid: true; data: DeployAssetInput['discoveryData'] } | { valid: false; errors: string[] } {
  if (!data || typeof data !== 'object') {
    return { valid: false, errors: ['discoveryData: must be an object'] };
  }

  const dataObj = data as Record<string, unknown>;
  const errors: string[] = [];

  // Validate discoverySource (required)
  if (!dataObj['discoverySource']) {
    errors.push('discoveryData.discoverySource is required');
  } else if (typeof dataObj['discoverySource'] !== 'string') {
    errors.push('discoveryData.discoverySource must be a string');
  }

  // Validate discoveryRecordId (required)
  if (!dataObj['discoveryRecordId']) {
    errors.push('discoveryData.discoveryRecordId is required');
  } else if (typeof dataObj['discoveryRecordId'] !== 'string') {
    errors.push('discoveryData.discoveryRecordId must be a string');
  }

  // Validate optional string fields
  const optionalFields = ['serialNumber', 'macAddress', 'hostname', 'ipAddress'];
  for (const field of optionalFields) {
    if (dataObj[field] !== undefined && dataObj[field] !== null && typeof dataObj[field] !== 'string') {
      errors.push(`discoveryData.${field} must be a string`);
    }
  }

  if (errors.length > 0) {
    return { valid: false, errors };
  }

  return {
    valid: true,
    data: {
      discoverySource: dataObj['discoverySource'] as string,
      discoveryRecordId: dataObj['discoveryRecordId'] as string,
      serialNumber: dataObj['serialNumber'] as string | undefined,
      macAddress: dataObj['macAddress'] as string | undefined,
      hostname: dataObj['hostname'] as string | undefined,
      ipAddress: dataObj['ipAddress'] as string | undefined,
    },
  };
}

/**
 * Validate deploy asset request body
 */
function validateRequest(body: unknown): {
  valid: true;
  data: Omit<DeployAssetInput, 'deployedBy'>;
} | { valid: false; errors: string[] } {
  if (!body || typeof body !== 'object') {
    return { valid: false, errors: ['Request body is required'] };
  }

  const request = body as Record<string, unknown>;
  const errors: string[] = [];

  // Validate assetId (required)
  if (!request['assetId']) {
    errors.push('assetId is required');
  } else if (typeof request['assetId'] !== 'string') {
    errors.push('assetId must be a string');
  } else {
    const uuidError = validateUUID(request['assetId'] as string, 'assetId');
    if (uuidError) {
      errors.push(uuidError.message);
    }
  }

  // Validate assignedToUserId (required)
  if (!request['assignedToUserId']) {
    errors.push('assignedToUserId is required');
  } else if (typeof request['assignedToUserId'] !== 'string') {
    errors.push('assignedToUserId must be a string');
  } else {
    const uuidError = validateUUID(request['assignedToUserId'] as string, 'assignedToUserId');
    if (uuidError) {
      errors.push(uuidError.message);
    }
  }

  // Validate optional string fields
  const optionalStringFields = ['deployedByName', 'location', 'department', 'costCenter', 'notes'];
  for (const field of optionalStringFields) {
    if (request[field] !== undefined && request[field] !== null && typeof request[field] !== 'string') {
      errors.push(`${field} must be a string`);
    }
  }

  // Validate optional relationships array
  let validatedRelationships: DeployAssetInput['relationships'] | undefined;
  if (request['relationships'] !== undefined && request['relationships'] !== null) {
    if (!Array.isArray(request['relationships'])) {
      errors.push('relationships must be an array');
    } else {
      validatedRelationships = [];
      for (let i = 0; i < request['relationships'].length; i++) {
        const relValidation = validateRelationship(request['relationships'][i], i);
        if (!relValidation.valid) {
          errors.push(...relValidation.errors);
        } else {
          validatedRelationships.push(relValidation.data);
        }
      }
    }
  }

  // Validate optional discoveryData
  let validatedDiscoveryData: DeployAssetInput['discoveryData'] | undefined;
  if (request['discoveryData'] !== undefined && request['discoveryData'] !== null) {
    const discoveryValidation = validateDiscoveryData(request['discoveryData']);
    if (!discoveryValidation.valid) {
      errors.push(...discoveryValidation.errors);
    } else {
      validatedDiscoveryData = discoveryValidation.data;
    }
  }

  if (errors.length > 0) {
    return { valid: false, errors };
  }

  return {
    valid: true,
    data: {
      assetId: request['assetId'] as string,
      assignedToUserId: request['assignedToUserId'] as string,
      deployedByName: request['deployedByName'] as string | undefined,
      location: request['location'] as string | undefined,
      department: request['department'] as string | undefined,
      costCenter: request['costCenter'] as string | undefined,
      notes: request['notes'] as string | undefined,
      relationships: validatedRelationships,
      discoveryData: validatedDiscoveryData,
    },
  };
}

/**
 * Lambda handler for deploying an asset
 */
export async function handler(
  event: APIGatewayProxyEvent
): Promise<APIGatewayProxyResult> {
  const requestId = event.requestContext.requestId;
  const userId = event.requestContext.authorizer?.['claims']?.['sub'] as string | undefined;

  logger.info('Deploy asset request received', { requestId });

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
    const validation = validateRequest(body);
    if (!validation.valid) {
      return createLambdaResponse(
        HTTP_STATUS.BAD_REQUEST,
        createErrorResponse(
          API_ERROR_CODES.VALIDATION_ERROR,
          'Validation failed',
          requestId,
          validation.errors.map((msg) => ({ field: '', message: msg, code: 'VALIDATION_ERROR' }))
        )
      );
    }

    // Deploy the asset
    const input: DeployAssetInput = {
      ...validation.data,
      deployedBy: userId,
    };

    const result = await deploymentService.deployAsset(input);

    logger.info('Asset deployed', {
      requestId,
      deploymentId: result.deployment.deploymentId,
      assetId: result.deployment.assetId,
      assignedToUserId: result.deployment.assignedToUserId,
      relationshipsCreated: result.relationships.length,
    });

    return createLambdaResponse(HTTP_STATUS.CREATED, createApiResponse(result, requestId));
  } catch (error) {
    const err = error as Error;
    logger.error('Failed to deploy asset', err, { requestId });

    // Handle specific errors
    if (err.message.includes('not found')) {
      return createLambdaResponse(
        HTTP_STATUS.NOT_FOUND,
        createErrorResponse(API_ERROR_CODES.NOT_FOUND, err.message, requestId)
      );
    }

    if (
      err.message.includes('cannot be deployed') ||
      err.message.includes('Must be one of') ||
      err.message.includes('is required') ||
      err.message.includes('must be')
    ) {
      return createLambdaResponse(
        HTTP_STATUS.BAD_REQUEST,
        createErrorResponse(API_ERROR_CODES.BAD_REQUEST, err.message, requestId)
      );
    }

    return createLambdaResponse(
      HTTP_STATUS.INTERNAL_SERVER_ERROR,
      createErrorResponse(API_ERROR_CODES.INTERNAL_ERROR, 'Failed to deploy asset', requestId)
    );
  }
}
