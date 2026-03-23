/**
 * Create Maintenance Plan Lambda Handler
 *
 * Creates a new maintenance plan for an enterprise asset.
 * Supports time-based and usage-based scheduling.
 * Requirements: 5.1
 */

import type { APIGatewayProxyEvent, APIGatewayProxyResult } from 'aws-lambda';

import { API_ERROR_CODES, createApiResponse, createErrorResponse, createLambdaResponse, HTTP_STATUS } from '@ams/types';
import { createLogger, validate, validateUUID } from '@ams/utils';

import type { CreateMaintenancePlanRequest, MaintenanceType, ScheduleType, WorkOrderPriority } from '../maintenance/maintenance-service';
import * as maintenanceService from '../maintenance/maintenance-service';

const logger = createLogger({ service: 'create-maintenance-plan-handler' });

const VALID_MAINTENANCE_TYPES: MaintenanceType[] = [
  'PREVENTIVE', 'PREDICTIVE', 'INSPECTION', 'CALIBRATION',
  'LUBRICATION', 'CLEANING', 'SAFETY_CHECK', 'REGULATORY', 'SEASONAL', 'OTHER'
];

const VALID_SCHEDULE_TYPES: ScheduleType[] = ['TIME_BASED', 'USAGE_BASED', 'CONDITION_BASED', 'HYBRID'];
const VALID_PRIORITIES: WorkOrderPriority[] = ['CRITICAL', 'HIGH', 'MEDIUM', 'LOW'];


/**
 * Validate create maintenance plan request
 */
function validateRequest(body: unknown): { valid: true; data: CreateMaintenancePlanRequest } | { valid: false; errors: string[] } {
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

  if (!request['planName']) {
    errors.push('planName is required');
  }

  if (!request['maintenanceType']) {
    errors.push('maintenanceType is required');
  } else if (!VALID_MAINTENANCE_TYPES.includes(request['maintenanceType'] as MaintenanceType)) {
    errors.push(`maintenanceType must be one of: ${VALID_MAINTENANCE_TYPES.join(', ')}`);
  }

  if (!request['scheduleType']) {
    errors.push('scheduleType is required');
  } else if (!VALID_SCHEDULE_TYPES.includes(request['scheduleType'] as ScheduleType)) {
    errors.push(`scheduleType must be one of: ${VALID_SCHEDULE_TYPES.join(', ')}`);
  }

  // Validate schedule configuration
  const scheduleType = request['scheduleType'] as ScheduleType;
  if (scheduleType === 'TIME_BASED' && !request['frequencyDays']) {
    errors.push('frequencyDays is required for TIME_BASED schedules');
  }

  if (scheduleType === 'USAGE_BASED' && !request['frequencyHours']) {
    errors.push('frequencyHours is required for USAGE_BASED schedules');
  }

  // Validate numeric fields
  if (request['frequencyDays'] !== undefined) {
    if (typeof request['frequencyDays'] !== 'number' || request['frequencyDays'] <= 0) {
      errors.push('frequencyDays must be a positive number');
    }
  }

  if (request['frequencyHours'] !== undefined) {
    if (typeof request['frequencyHours'] !== 'number' || request['frequencyHours'] <= 0) {
      errors.push('frequencyHours must be a positive number');
    }
  }

  if (request['leadTimeDays'] !== undefined) {
    if (typeof request['leadTimeDays'] !== 'number' || request['leadTimeDays'] < 0) {
      errors.push('leadTimeDays must be a non-negative number');
    }
  }

  if (request['priority'] !== undefined && !VALID_PRIORITIES.includes(request['priority'] as WorkOrderPriority)) {
    errors.push(`priority must be one of: ${VALID_PRIORITIES.join(', ')}`);
  }

  // Validate string lengths
  const result = validate()
    .stringLength(request['planName'] as string | undefined, 'planName', 1, 255)
    .stringLength(request['description'] as string | undefined, 'description', 0, 2000)
    .result();

  if (!result.isValid) {
    errors.push(...result.errors.map((e: { message: string }) => e.message));
  }

  if (errors.length > 0) {
    return { valid: false, errors };
  }

  return {
    valid: true,
    data: {
      assetId: request['assetId'] as string,
      planName: request['planName'] as string,
      description: request['description'] as string | undefined,
      maintenanceType: request['maintenanceType'] as MaintenanceType,
      scheduleType: request['scheduleType'] as ScheduleType,
      frequencyDays: request['frequencyDays'] as number | undefined,
      frequencyHours: request['frequencyHours'] as number | undefined,
      procedureDocumentId: request['procedureDocumentId'] as string | undefined,
      estimatedDurationHours: request['estimatedDurationHours'] as number | undefined,
      estimatedCost: request['estimatedCost'] as number | undefined,
      leadTimeDays: request['leadTimeDays'] as number | undefined,
      allowEarlyExecution: request['allowEarlyExecution'] as boolean | undefined,
      maxOverdueDays: request['maxOverdueDays'] as number | undefined,
      defaultAssignedTo: request['defaultAssignedTo'] as string | undefined,
      requiredSkills: request['requiredSkills'] as string[] | undefined,
      requiredCertifications: request['requiredCertifications'] as string[] | undefined,
      priority: request['priority'] as WorkOrderPriority | undefined,
    },
  };
}


export async function handler(event: APIGatewayProxyEvent): Promise<APIGatewayProxyResult> {
  const requestId = event.requestContext.requestId;
  const userId = event.requestContext.authorizer?.['claims']?.['sub'] as string | undefined;

  logger.info('Create maintenance plan request received', { requestId });

  try {
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

    // Create maintenance plan
    const plan = await maintenanceService.createMaintenancePlan({
      ...validation.data,
      createdBy: userId,
    });

    logger.info('Maintenance plan created successfully', {
      requestId,
      planId: plan.planId,
      assetId: plan.assetId,
    });

    return createLambdaResponse(
      HTTP_STATUS.CREATED,
      createApiResponse(plan, requestId)
    );
  } catch (error) {
    const err = error as Error;
    logger.error('Failed to create maintenance plan', err, { requestId });

    if (err.message.includes('not found')) {
      return createLambdaResponse(
        HTTP_STATUS.NOT_FOUND,
        createErrorResponse(API_ERROR_CODES.NOT_FOUND, err.message, requestId)
      );
    }

    return createLambdaResponse(
      HTTP_STATUS.INTERNAL_SERVER_ERROR,
      createErrorResponse(API_ERROR_CODES.INTERNAL_ERROR, 'Failed to create maintenance plan', requestId)
    );
  }
}
