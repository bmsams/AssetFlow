/**
 * Create Work Order Lambda Handler
 *
 * Creates a new manual work order (not tied to a maintenance plan).
 * Supports creating work orders for corrective maintenance, emergency repairs, etc.
 * Requirements: 2C.7
 */

import type { APIGatewayProxyEvent, APIGatewayProxyResult } from 'aws-lambda';

import { ensureUserIdFromAuthClaims, queryOne, resolveUserIdFromAuthId } from '@ams/database';
import { API_ERROR_CODES, createApiResponse, createErrorResponse, createLambdaResponse, HTTP_STATUS } from '@ams/types';
import { createLogger, validate, validateUUID } from '@ams/utils';

import type { CreateWorkOrderRequest, WorkOrderPriority, WorkOrderType } from '../maintenance/maintenance-service';
import * as maintenanceService from '../maintenance/maintenance-service';

const logger = createLogger({ service: 'create-work-order-handler' });

const VALID_WORK_TYPES: WorkOrderType[] = [
  'PREVENTIVE', 'CORRECTIVE', 'EMERGENCY', 'INSPECTION',
  'CALIBRATION', 'INSTALLATION', 'MODIFICATION', 'DECOMMISSION', 'PROJECT', 'OTHER'
];

const VALID_PRIORITIES: WorkOrderPriority[] = ['CRITICAL', 'HIGH', 'MEDIUM', 'LOW'];

interface CreateWorkOrderValidationSuccess {
  readonly valid: true;
  readonly data: CreateWorkOrderRequest;
  readonly buildingId?: string;
}

interface CreateWorkOrderValidationFailure {
  readonly valid: false;
  readonly errors: string[];
}

type CreateWorkOrderValidationResult =
  | CreateWorkOrderValidationSuccess
  | CreateWorkOrderValidationFailure;

/**
 * Validate create work order request
 */
function validateRequest(body: unknown): CreateWorkOrderValidationResult {
  if (!body || typeof body !== 'object') {
    return { valid: false, errors: ['Request body is required'] };
  }

  const request = body as Record<string, unknown>;
  const errors: string[] = [];

  // Required fields
  if (!request['assetId']) {
    errors.push('assetId is required');
  } else {
    const uuidError = validateUUID(request['assetId'] as string, 'assetId');
    if (uuidError) {
      errors.push(uuidError.message);
    }
  }

  if (!request['workType']) {
    errors.push('workType is required');
  } else if (!VALID_WORK_TYPES.includes(request['workType'] as WorkOrderType)) {
    errors.push(`workType must be one of: ${VALID_WORK_TYPES.join(', ')}`);
  }

  if (!request['title']) {
    errors.push('title is required');
  }

  // Validate optional fields
  if (request['priority'] !== undefined && !VALID_PRIORITIES.includes(request['priority'] as WorkOrderPriority)) {
    errors.push(`priority must be one of: ${VALID_PRIORITIES.join(', ')}`);
  }

  if (request['maintenancePlanId'] !== undefined) {
    const uuidError = validateUUID(request['maintenancePlanId'] as string, 'maintenancePlanId');
    if (uuidError) {
      errors.push(uuidError.message);
    }
  }

  if (request['assignedTo'] !== undefined) {
    const uuidError = validateUUID(request['assignedTo'] as string, 'assignedTo');
    if (uuidError) {
      errors.push(uuidError.message);
    }
  }

  if (request['facilityId'] !== undefined) {
    const uuidError = validateUUID(request['facilityId'] as string, 'facilityId');
    if (uuidError) {
      errors.push(uuidError.message);
    }
  }

  if (request['parentWorkOrderId'] !== undefined) {
    const uuidError = validateUUID(request['parentWorkOrderId'] as string, 'parentWorkOrderId');
    if (uuidError) {
      errors.push(uuidError.message);
    }
  }

  let buildingId: string | undefined;
  if (request['buildingId'] !== undefined) {
    const rawBuildingId = request['buildingId'] as string;
    const uuidError = validateUUID(rawBuildingId, 'buildingId');
    if (uuidError) {
      errors.push(uuidError.message);
    } else {
      buildingId = rawBuildingId;
    }
  }

  // Validate numeric fields
  if (request['estimatedDurationHours'] !== undefined) {
    if (typeof request['estimatedDurationHours'] !== 'number' || request['estimatedDurationHours'] < 0) {
      errors.push('estimatedDurationHours must be a non-negative number');
    }
  }

  if (request['estimatedCost'] !== undefined) {
    if (typeof request['estimatedCost'] !== 'number' || request['estimatedCost'] < 0) {
      errors.push('estimatedCost must be a non-negative number');
    }
  }

  // Validate date formats
  if (request['scheduledDate'] !== undefined) {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(request['scheduledDate'] as string)) {
      errors.push('scheduledDate must be in YYYY-MM-DD format');
    }
  }

  if (request['dueDate'] !== undefined) {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(request['dueDate'] as string)) {
      errors.push('dueDate must be in YYYY-MM-DD format');
    }
  }

  // Validate string lengths
  const result = validate()
    .stringLength(request['title'] as string | undefined, 'title', 1, 255)
    .stringLength(request['description'] as string | undefined, 'description', 0, 2000)
    .stringLength(request['instructions'] as string | undefined, 'instructions', 0, 5000)
    .stringLength(request['workLocation'] as string | undefined, 'workLocation', 0, 255)
    .result();

  if (!result.isValid) {
    errors.push(...result.errors.map(e => e.message));
  }

  if (errors.length > 0) {
    return { valid: false, errors };
  }

  return {
    valid: true,
    data: {
      assetId: request['assetId'] as string,
      maintenancePlanId: request['maintenancePlanId'] as string | undefined,
      workType: request['workType'] as WorkOrderType,
      priority: request['priority'] as WorkOrderPriority | undefined,
      title: request['title'] as string,
      description: request['description'] as string | undefined,
      instructions: request['instructions'] as string | undefined,
      assignedTo: request['assignedTo'] as string | undefined,
      scheduledDate: request['scheduledDate'] as string | undefined,
      dueDate: request['dueDate'] as string | undefined,
      estimatedDurationHours: request['estimatedDurationHours'] as number | undefined,
      estimatedCost: request['estimatedCost'] as number | undefined,
      workLocation: request['workLocation'] as string | undefined,
      facilityId: request['facilityId'] as string | undefined,
      requiresApproval: request['requiresApproval'] as boolean | undefined,
      parentWorkOrderId: request['parentWorkOrderId'] as string | undefined,
    },
    ...(buildingId ? { buildingId } : {}),
  };
}

async function assetBelongsToBuilding(assetId: string, buildingId: string): Promise<boolean> {
  const result = await queryOne<{ matches: boolean }>(
    `SELECT EXISTS (
       SELECT 1
       FROM hardware_assets ha
       JOIN buildings b ON b.building_id = $2
       WHERE ha.asset_id = $1
         AND (
           LOWER(TRIM(COALESCE(ha.building, ''))) = LOWER(TRIM(COALESCE(b.building_code, '')))
           OR LOWER(TRIM(COALESCE(ha.building, ''))) = LOWER(TRIM(COALESCE(b.name, '')))
         )
     ) AS matches`,
    [assetId, buildingId]
  );

  return result?.matches === true;
}

export async function handler(event: APIGatewayProxyEvent
): Promise<APIGatewayProxyResult> {
  const requestId = event.requestContext.requestId;
  const claims = event.requestContext.authorizer?.['claims'] as Record<string, string> | undefined;
  const authSub = claims?.['sub'];
  const userId =
    (await resolveUserIdFromAuthId(authSub)) ??
    (await ensureUserIdFromAuthClaims({
      sub: authSub ?? '',
      email: claims?.['email'],
      givenName: claims?.['given_name'],
      familyName: claims?.['family_name'],
    }));

  logger.info('Create work order request received', { requestId });

  try {
    if (!authSub) {
      return createLambdaResponse(
        HTTP_STATUS.UNAUTHORIZED,
        createErrorResponse(API_ERROR_CODES.UNAUTHORIZED, 'User authentication required', requestId)
      );
    }

    if (!userId) {
      return createLambdaResponse(
        HTTP_STATUS.FORBIDDEN,
        createErrorResponse(API_ERROR_CODES.USER_NOT_PROVISIONED, 'User is not provisioned in the application', requestId)
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
          validation.errors.map(msg => ({ field: '', message: msg, code: 'VALIDATION_ERROR' }))
        )
      );
    }

    if (validation.buildingId) {
      const matchesBuilding = await assetBelongsToBuilding(
        validation.data.assetId,
        validation.buildingId
      );
      if (!matchesBuilding) {
        return createLambdaResponse(
          HTTP_STATUS.BAD_REQUEST,
          createErrorResponse(
            API_ERROR_CODES.VALIDATION_ERROR,
            'assetId does not belong to the provided buildingId',
            requestId,
            [
              {
                field: 'buildingId',
                message: 'assetId does not belong to the provided buildingId',
                code: 'VALIDATION_ERROR',
              },
            ]
          )
        );
      }
    }

    // Create work order
    const workOrder = await maintenanceService.createWorkOrder({
      ...validation.data,
      createdBy: userId,
    });

    logger.info('Work order created successfully', {
      requestId,
      workOrderId: workOrder.workOrderId,
      workOrderNumber: workOrder.workOrderNumber,
      assetId: workOrder.assetId,
    });

    return createLambdaResponse(
      HTTP_STATUS.CREATED,
      createApiResponse(workOrder, requestId)
    );
  } catch (error) {
    const err = error as Error;
    logger.error('Failed to create work order', err, { requestId });

    if (err.message.includes('not found')) {
      return createLambdaResponse(
        HTTP_STATUS.NOT_FOUND,
        createErrorResponse(API_ERROR_CODES.NOT_FOUND, err.message, requestId)
      );
    }

    return createLambdaResponse(
      HTTP_STATUS.INTERNAL_SERVER_ERROR,
      createErrorResponse(API_ERROR_CODES.INTERNAL_ERROR, 'Failed to create work order', requestId)
    );
  }
}
