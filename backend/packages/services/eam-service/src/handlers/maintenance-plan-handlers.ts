/**
 * Maintenance Plan Handlers
 *
 * Consolidated Lambda handlers for maintenance plan management.
 * Provides endpoints for CRUD operations, due maintenance checking,
 * and automatic work order generation.
 *
 * Requirements: 15.1, 15.2, 15.3, 15.4, 15.5, 15.6
 */

import type { APIGatewayProxyEvent, APIGatewayProxyResult } from 'aws-lambda';

import {
  API_ERROR_CODES,
  createApiResponse,
  createErrorResponse,
  createLambdaResponse,
  HTTP_STATUS,
} from '@ams/types';
import { createLogger, validate, validateUUID } from '@ams/utils';

import type {
  CreateMaintenancePlanRequest,
  MaintenanceType,
  ScheduleType,
  UpdateMaintenancePlanRequest,
  WorkOrderPriority,
} from '../maintenance/maintenance-service';
import * as maintenanceService from '../maintenance/maintenance-service';

const logger = createLogger({ service: 'maintenance-plan-handlers' });

// ============================================================================
// Constants
// ============================================================================

const DEFAULTS = {
  PAGE: 1,
  LIMIT: 50,
  MAX_LIMIT: 100,
  DAYS_AHEAD: 7,
} as const;

const VALIDATION = {
  MAX_PLAN_NAME_LENGTH: 255,
  MAX_DESCRIPTION_LENGTH: 2000,
} as const;

const VALID_MAINTENANCE_TYPES: readonly MaintenanceType[] = [
  'PREVENTIVE', 'PREDICTIVE', 'INSPECTION', 'CALIBRATION',
  'LUBRICATION', 'CLEANING', 'SAFETY_CHECK', 'REGULATORY', 'SEASONAL', 'OTHER',
] as const;

const VALID_SCHEDULE_TYPES: readonly ScheduleType[] = [
  'TIME_BASED', 'USAGE_BASED', 'CONDITION_BASED', 'HYBRID',
] as const;

const VALID_PRIORITIES: readonly WorkOrderPriority[] = [
  'CRITICAL', 'HIGH', 'MEDIUM', 'LOW',
] as const;
const VALID_STATUS_FILTERS = ['active', 'paused', 'all'] as const;
type MaintenanceStatusFilter = (typeof VALID_STATUS_FILTERS)[number];

// ============================================================================
// Helper Functions
// ============================================================================

/**
 * Parse JSON request body with error handling
 */
function parseRequestBody(
  body: string | null,
  requestId: string
): { success: true; data: unknown } | { success: false; response: APIGatewayProxyResult } {
  try {
    return { success: true, data: body ? JSON.parse(body) : null };
  } catch {
    return {
      success: false,
      response: createLambdaResponse(
        HTTP_STATUS.BAD_REQUEST,
        createErrorResponse(API_ERROR_CODES.BAD_REQUEST, 'Invalid JSON in request body', requestId)
      ),
    };
  }
}

/**
 * Validate and return error response for required UUID parameter
 */
function validateRequiredUUID(
  value: string | undefined,
  fieldName: string,
  requestId: string
): APIGatewayProxyResult | null {
  if (!value) {
    return createLambdaResponse(
      HTTP_STATUS.BAD_REQUEST,
      createErrorResponse(API_ERROR_CODES.BAD_REQUEST, `${fieldName} is required`, requestId)
    );
  }
  const uuidError = validateUUID(value, fieldName);
  if (uuidError) {
    return createLambdaResponse(
      HTTP_STATUS.BAD_REQUEST,
      createErrorResponse(API_ERROR_CODES.VALIDATION_ERROR, uuidError.message, requestId)
    );
  }
  return null;
}

/**
 * Extract pagination parameters from query string
 */
function getPaginationParams(queryParams: Record<string, string | undefined> | null): { page: number; limit: number } {
  const page = parseInt(queryParams?.['page'] ?? String(DEFAULTS.PAGE), 10);
  const limit = Math.min(
    parseInt(queryParams?.['limit'] ?? String(DEFAULTS.LIMIT), 10),
    DEFAULTS.MAX_LIMIT
  );
  return { page: Math.max(1, page), limit: Math.max(1, limit) };
}

/**
 * Create error response based on error type
 */
function handleServiceError(
  error: Error,
  requestId: string,
  defaultMessage: string
): APIGatewayProxyResult {
  if (error.message.includes('not found')) {
    return createLambdaResponse(
      HTTP_STATUS.NOT_FOUND,
      createErrorResponse(API_ERROR_CODES.NOT_FOUND, error.message, requestId)
    );
  }

  if (error.message.includes('Cannot') || error.message.includes('Invalid state')) {
    return createLambdaResponse(
      HTTP_STATUS.CONFLICT,
      createErrorResponse(API_ERROR_CODES.CONFLICT, error.message, requestId)
    );
  }

  return createLambdaResponse(
    HTTP_STATUS.INTERNAL_SERVER_ERROR,
    createErrorResponse(API_ERROR_CODES.INTERNAL_ERROR, defaultMessage, requestId)
  );
}

/**
 * Create validation error response from error messages
 */
function createValidationErrorResponse(
  errors: string[],
  requestId: string
): APIGatewayProxyResult {
  return createLambdaResponse(
    HTTP_STATUS.BAD_REQUEST,
    createErrorResponse(
      API_ERROR_CODES.VALIDATION_ERROR,
      'Validation failed',
      requestId,
      errors.map(msg => ({ field: '', message: msg, code: 'VALIDATION_ERROR' }))
    )
  );
}

// ============================================================================
// Validation Functions
// ============================================================================

/**
 * Validate create maintenance plan request
 */
function validateCreateRequest(
  body: unknown
): { valid: true; data: CreateMaintenancePlanRequest } | { valid: false; errors: string[] } {
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

  // Validate string lengths using fluent validator
  const result = validate()
    .stringLength(request['planName'] as string | undefined, 'planName', 1, VALIDATION.MAX_PLAN_NAME_LENGTH)
    .stringLength(request['description'] as string | undefined, 'description', 0, VALIDATION.MAX_DESCRIPTION_LENGTH)
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

/**
 * Validate update maintenance plan request
 */
function validateUpdateRequest(
  body: unknown
): { valid: true; data: UpdateMaintenancePlanRequest } | { valid: false; errors: string[] } {
  if (!body || typeof body !== 'object') {
    return { valid: false, errors: ['Request body is required'] };
  }

  const request = body as Record<string, unknown>;
  const errors: string[] = [];

  // Validate optional enum fields if provided
  if (request['maintenanceType'] !== undefined &&
      !VALID_MAINTENANCE_TYPES.includes(request['maintenanceType'] as MaintenanceType)) {
    errors.push(`maintenanceType must be one of: ${VALID_MAINTENANCE_TYPES.join(', ')}`);
  }

  if (request['scheduleType'] !== undefined &&
      !VALID_SCHEDULE_TYPES.includes(request['scheduleType'] as ScheduleType)) {
    errors.push(`scheduleType must be one of: ${VALID_SCHEDULE_TYPES.join(', ')}`);
  }

  if (request['priority'] !== undefined &&
      !VALID_PRIORITIES.includes(request['priority'] as WorkOrderPriority)) {
    errors.push(`priority must be one of: ${VALID_PRIORITIES.join(', ')}`);
  }

  // Validate numeric fields (allow null for clearing)
  if (request['frequencyDays'] !== undefined && request['frequencyDays'] !== null) {
    if (typeof request['frequencyDays'] !== 'number' || request['frequencyDays'] <= 0) {
      errors.push('frequencyDays must be a positive number');
    }
  }

  if (request['frequencyHours'] !== undefined && request['frequencyHours'] !== null) {
    if (typeof request['frequencyHours'] !== 'number' || request['frequencyHours'] <= 0) {
      errors.push('frequencyHours must be a positive number');
    }
  }

  if (request['leadTimeDays'] !== undefined) {
    if (typeof request['leadTimeDays'] !== 'number' || request['leadTimeDays'] < 0) {
      errors.push('leadTimeDays must be a non-negative number');
    }
  }

  // Validate string lengths using fluent validator
  const result = validate()
    .stringLength(request['planName'] as string | undefined, 'planName', 1, VALIDATION.MAX_PLAN_NAME_LENGTH)
    .stringLength(request['description'] as string | undefined, 'description', 0, VALIDATION.MAX_DESCRIPTION_LENGTH)
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
      planName: request['planName'] as string | undefined,
      description: request['description'] as string | undefined,
      maintenanceType: request['maintenanceType'] as MaintenanceType | undefined,
      scheduleType: request['scheduleType'] as ScheduleType | undefined,
      frequencyDays: request['frequencyDays'] as number | null | undefined,
      frequencyHours: request['frequencyHours'] as number | null | undefined,
      procedureDocumentId: request['procedureDocumentId'] as string | null | undefined,
      estimatedDurationHours: request['estimatedDurationHours'] as number | null | undefined,
      estimatedCost: request['estimatedCost'] as number | null | undefined,
      leadTimeDays: request['leadTimeDays'] as number | undefined,
      allowEarlyExecution: request['allowEarlyExecution'] as boolean | undefined,
      maxOverdueDays: request['maxOverdueDays'] as number | null | undefined,
      defaultAssignedTo: request['defaultAssignedTo'] as string | null | undefined,
      requiredSkills: request['requiredSkills'] as string[] | null | undefined,
      requiredCertifications: request['requiredCertifications'] as string[] | null | undefined,
      isActive: request['isActive'] as boolean | undefined,
      priority: request['priority'] as WorkOrderPriority | undefined,
    },
  };
}

// ============================================================================
// Handler Functions
// ============================================================================

/**
 * Create a new maintenance plan
 * POST /maintenance-plans
 *
 * Requirement 15.1: Create maintenance plan with asset, schedule type, and frequency
 */
export async function createMaintenancePlanHandler(
  event: APIGatewayProxyEvent
): Promise<APIGatewayProxyResult> {
  const requestId = event.requestContext.requestId;
  const userId = event.requestContext.authorizer?.['claims']?.['sub'] as string | undefined;

  logger.info('Create maintenance plan request received', { requestId });

  try {
    // Parse request body
    const parseResult = parseRequestBody(event.body, requestId);
    if (!parseResult.success) {
      return parseResult.response;
    }

    // Validate request
    const validation = validateCreateRequest(parseResult.data);
    if (!validation.valid) {
      return createValidationErrorResponse(validation.errors, requestId);
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

    return createLambdaResponse(HTTP_STATUS.CREATED, createApiResponse(plan, requestId));
  } catch (error) {
    const err = error as Error;
    logger.error('Failed to create maintenance plan', err, { requestId });
    return handleServiceError(err, requestId, 'Failed to create maintenance plan');
  }
}

/**
 * Get maintenance plan by ID or list plans
 * GET /maintenance-plans/:planId
 * GET /maintenance-plans?assetId=xxx
 *
 * Requirement 15.5: List plans with optional asset and status filters
 */
export async function getMaintenancePlanHandler(
  event: APIGatewayProxyEvent
): Promise<APIGatewayProxyResult> {
  const requestId = event.requestContext.requestId;
  const planId = event.pathParameters?.['planId'];
  const assetId = event.queryStringParameters?.['assetId'];
  const statusFilter = event.queryStringParameters?.['status'] as MaintenanceStatusFilter | undefined;

  logger.info('Get maintenance plan request received', { requestId, planId, assetId, statusFilter });

  try {
    if (statusFilter && !VALID_STATUS_FILTERS.includes(statusFilter)) {
      return createLambdaResponse(
        HTTP_STATUS.BAD_REQUEST,
        createErrorResponse(
          API_ERROR_CODES.VALIDATION_ERROR,
          `status must be one of: ${VALID_STATUS_FILTERS.join(', ')}`,
          requestId
        )
      );
    }

    // If planId is provided, get single plan
    if (planId) {
      const uuidError = validateRequiredUUID(planId, 'planId', requestId);
      if (uuidError) return uuidError;

      const plan = await maintenanceService.getMaintenancePlan(planId);
      if (!plan) {
        return createLambdaResponse(
          HTTP_STATUS.NOT_FOUND,
          createErrorResponse(API_ERROR_CODES.NOT_FOUND, `Maintenance plan not found: ${planId}`, requestId)
        );
      }

      return createLambdaResponse(HTTP_STATUS.OK, createApiResponse(plan, requestId));
    }

    // If assetId is provided, get plans for asset
    if (assetId) {
      const uuidError = validateRequiredUUID(assetId, 'assetId', requestId);
      if (uuidError) return uuidError;

      const includeInactive =
        event.queryStringParameters?.['includeInactive'] === 'true' ||
        statusFilter === 'paused' ||
        statusFilter === 'all';
      const plans = await maintenanceService.getMaintenancePlansByAsset(assetId, includeInactive);
      const filteredPlans =
        statusFilter === 'active'
          ? plans.filter(plan => plan.isActive)
          : statusFilter === 'paused'
            ? plans.filter(plan => !plan.isActive)
            : plans;

      return createLambdaResponse(
        HTTP_STATUS.OK,
        createApiResponse({ items: filteredPlans, total: filteredPlans.length }, requestId)
      );
    }

    // Otherwise, get plans with optional status filter and pagination.
    const pagination = getPaginationParams(event.queryStringParameters);
    const result =
      statusFilter === 'paused'
        ? await maintenanceService.getMaintenancePlans(pagination, false)
        : statusFilter === 'all'
          ? await maintenanceService.getMaintenancePlans(pagination)
          : await maintenanceService.getActiveMaintenancePlans(pagination);

    return createLambdaResponse(HTTP_STATUS.OK, createApiResponse(result, requestId));
  } catch (error) {
    const err = error as Error;
    logger.error('Failed to get maintenance plan', err, { requestId, planId, assetId });
    return handleServiceError(err, requestId, 'Failed to get maintenance plan');
  }
}

/**
 * Update a maintenance plan
 * PUT /maintenance-plans/:planId
 *
 * Requirement 15.2: Update plan frequency or schedule and recalculate next due date
 */
export async function updateMaintenancePlanHandler(
  event: APIGatewayProxyEvent
): Promise<APIGatewayProxyResult> {
  const requestId = event.requestContext.requestId;
  const planId = event.pathParameters?.['planId'];
  const userId = event.requestContext.authorizer?.['claims']?.['sub'] as string | undefined;

  logger.info('Update maintenance plan request received', { requestId, planId });

  try {
    // Validate plan ID
    const uuidError = validateRequiredUUID(planId, 'planId', requestId);
    if (uuidError) return uuidError;

    // Parse request body
    const parseResult = parseRequestBody(event.body, requestId);
    if (!parseResult.success) {
      return parseResult.response;
    }

    // Validate request
    const validation = validateUpdateRequest(parseResult.data);
    if (!validation.valid) {
      return createValidationErrorResponse(validation.errors, requestId);
    }

    // Update maintenance plan
    const plan = await maintenanceService.updateMaintenancePlan(planId!, {
      ...validation.data,
      updatedBy: userId,
    });

    logger.info('Maintenance plan updated successfully', { requestId, planId });

    return createLambdaResponse(HTTP_STATUS.OK, createApiResponse(plan, requestId));
  } catch (error) {
    const err = error as Error;
    logger.error('Failed to update maintenance plan', err, { requestId, planId });
    return handleServiceError(err, requestId, 'Failed to update maintenance plan');
  }
}

/**
 * Deactivate a maintenance plan
 * DELETE /maintenance-plans/:planId
 *
 * Requirement 15.4: Deactivate plan to stop automatic work order generation
 */
export async function deactivateMaintenancePlanHandler(
  event: APIGatewayProxyEvent
): Promise<APIGatewayProxyResult> {
  const requestId = event.requestContext.requestId;
  const planId = event.pathParameters?.['planId'];
  const userId = event.requestContext.authorizer?.['claims']?.['sub'] as string | undefined;

  logger.info('Deactivate maintenance plan request received', { requestId, planId });

  try {
    // Validate plan ID
    const uuidError = validateRequiredUUID(planId, 'planId', requestId);
    if (uuidError) return uuidError;

    // Deactivate maintenance plan
    const plan = await maintenanceService.deactivateMaintenancePlan(planId!, userId);

    logger.info('Maintenance plan deactivated successfully', { requestId, planId });

    return createLambdaResponse(HTTP_STATUS.OK, createApiResponse(plan, requestId));
  } catch (error) {
    const err = error as Error;
    logger.error('Failed to deactivate maintenance plan', err, { requestId, planId });
    return handleServiceError(err, requestId, 'Failed to deactivate maintenance plan');
  }
}

/**
 * Check for due maintenance and optionally generate work orders
 * GET /maintenance-plans/due?asOfDate=xxx&generateWorkOrders=true&daysAhead=7
 *
 * Requirement 15.3: Automatically generate work orders when maintenance is due
 * Requirement 15.6: Get maintenance history for an asset
 */
export async function checkDueMaintenanceHandler(
  event: APIGatewayProxyEvent
): Promise<APIGatewayProxyResult> {
  const requestId = event.requestContext.requestId;

  logger.info('Check due maintenance request received', { requestId });

  try {
    const asOfDate = event.queryStringParameters?.['asOfDate'];
    const generateWorkOrders = event.queryStringParameters?.['generateWorkOrders'] === 'true';
    const daysAhead = parseInt(
      event.queryStringParameters?.['daysAhead'] ?? String(DEFAULTS.DAYS_AHEAD),
      10
    );

    // Validate asOfDate format if provided
    if (asOfDate && !/^\d{4}-\d{2}-\d{2}$/.test(asOfDate)) {
      return createLambdaResponse(
        HTTP_STATUS.BAD_REQUEST,
        createErrorResponse(
          API_ERROR_CODES.VALIDATION_ERROR,
          'asOfDate must be in YYYY-MM-DD format',
          requestId
        )
      );
    }

    if (generateWorkOrders) {
      // Get userId only when generating work orders
      const userId = event.requestContext.authorizer?.['claims']?.['sub'] as string | undefined;
      
      // Generate work orders for due maintenance
      const result = await maintenanceService.generateWorkOrders(asOfDate, userId);

      logger.info('Work orders generated', {
        requestId,
        plansProcessed: result.plansProcessed,
        workOrdersCreated: result.workOrdersCreated.length,
        errors: result.errors.length,
      });

      return createLambdaResponse(
        HTTP_STATUS.OK,
        createApiResponse({
          plansProcessed: result.plansProcessed,
          workOrdersCreated: result.workOrdersCreated,
          errors: result.errors,
        }, requestId)
      );
    }

    // Just check for due maintenance without generating work orders
    const dueItems = await maintenanceService.checkDueMaintenance(asOfDate);
    const upcomingPlans = await maintenanceService.getUpcomingMaintenance(daysAhead);

    logger.info('Due maintenance check complete', {
      requestId,
      dueCount: dueItems.length,
      upcomingCount: upcomingPlans.length,
    });

    return createLambdaResponse(
      HTTP_STATUS.OK,
      createApiResponse({
        due: dueItems,
        upcoming: upcomingPlans,
        summary: {
          totalDue: dueItems.length,
          overdue: dueItems.filter(i => i.isOverdue).length,
          critical: dueItems.filter(i => i.isCritical).length,
          upcomingCount: upcomingPlans.length,
        },
      }, requestId)
    );
  } catch (error) {
    const err = error as Error;
    logger.error('Failed to check due maintenance', err, { requestId });
    return handleServiceError(err, requestId, 'Failed to check due maintenance');
  }
}

/**
 * Get maintenance history for an asset
 * GET /maintenance-plans/history/:assetId
 *
 * Requirement 15.6: Get maintenance history for an asset
 */
export async function getMaintenanceHistoryHandler(
  event: APIGatewayProxyEvent
): Promise<APIGatewayProxyResult> {
  const requestId = event.requestContext.requestId;
  const assetId = event.pathParameters?.['assetId'];

  logger.info('Get maintenance history request received', { requestId, assetId });

  try {
    // Validate asset ID
    const uuidError = validateRequiredUUID(assetId, 'assetId', requestId);
    if (uuidError) return uuidError;

    // Get pagination parameters
    const pagination = getPaginationParams(event.queryStringParameters);

    // Get work orders for the asset (maintenance history)
    const workOrders = await maintenanceService.getWorkOrdersByAsset(assetId!, pagination);

    // Get maintenance plans for the asset
    const plans = await maintenanceService.getMaintenancePlansByAsset(assetId!, true);

    logger.info('Maintenance history retrieved', {
      requestId,
      assetId,
      workOrderCount: workOrders.items.length,
      planCount: plans.length,
    });

    const totalPages = Math.ceil(workOrders.total / workOrders.limit);

    return createLambdaResponse(
      HTTP_STATUS.OK,
      createApiResponse({
        assetId,
        maintenancePlans: plans,
        workOrders: workOrders.items,
        pagination: {
          page: workOrders.page,
          limit: workOrders.limit,
          total: workOrders.total,
          totalPages,
        },
      }, requestId)
    );
  } catch (error) {
    const err = error as Error;
    logger.error('Failed to get maintenance history', err, { requestId, assetId });
    return handleServiceError(err, requestId, 'Failed to get maintenance history');
  }
}

// ============================================================================
// Exports
// ============================================================================

export {
  createMaintenancePlanHandler as createHandler,
  getMaintenancePlanHandler as getHandler,
  updateMaintenancePlanHandler as updateHandler,
  deactivateMaintenancePlanHandler as deactivateHandler,
  checkDueMaintenanceHandler as checkDueHandler,
  getMaintenanceHistoryHandler as historyHandler,
};

// ============================================================================
// UNIFIED HANDLER
// Routes API Gateway requests to the appropriate handler function
// CDK routes:
//   GET    /eam/maintenance-plans                    → list
//   POST   /eam/maintenance-plans                    → create
//   GET    /eam/maintenance-plans/{planId}            → get by ID
//   PUT    /eam/maintenance-plans/{planId}            → update
//   GET    /eam/maintenance-plans/check-due           → check due
// ============================================================================

export async function handler(
  event: APIGatewayProxyEvent
): Promise<APIGatewayProxyResult> {
  const method = event.httpMethod;
  const path = event.path;
  const planId = event.pathParameters?.['planId'];

  logger.info('Handler request', { method, path, planId });

  // GET /eam/maintenance-plans/check-due
  if (method === 'GET' && path.endsWith('/check-due')) {
    return checkDueMaintenanceHandler(event);
  }

  // GET /eam/maintenance-plans/{planId}
  if (method === 'GET' && planId) {
    return getMaintenancePlanHandler(event);
  }

  // GET /eam/maintenance-plans
  if (method === 'GET' && !planId) {
    return getMaintenancePlanHandler(event);
  }

  // POST /eam/maintenance-plans
  if (method === 'POST' && !planId) {
    return createMaintenancePlanHandler(event);
  }

  // PUT /eam/maintenance-plans/{planId}
  if (method === 'PUT' && planId) {
    return updateMaintenancePlanHandler(event);
  }

  return createLambdaResponse(405, createErrorResponse(
    API_ERROR_CODES.BAD_REQUEST,
    `Method ${method} not allowed for ${path}`,
    event.requestContext.requestId
  ));
}

export default handler;
