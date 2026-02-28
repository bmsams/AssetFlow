/**
 * Vendor Handlers - Lambda handlers for Vendor CRUD operations
 *
 * Implements HTTP endpoints for:
 * - POST /admin/vendors - Create a new vendor
 * - GET /admin/vendors/{vendorId} - Get vendor by ID
 * - PUT /admin/vendors/{vendorId} - Update vendor
 * - DELETE /admin/vendors/{vendorId} - Delete vendor
 * - GET /admin/vendors - List vendors with pagination and filters
 * - GET /admin/vendors/search - Search vendors by name or code
 * - PUT /admin/vendors/{vendorId}/rating - Update vendor rating
 * - GET /admin/vendors/type/{vendorType} - Get vendors by type
 * - GET /admin/vendors/rating/{rating} - Get vendors by rating
 * - GET /admin/vendors/purchasing - Get vendors eligible for purchasing
 *
 * Requirement 9: Vendor Management
 */

import type { APIGatewayProxyEvent, APIGatewayProxyResult } from 'aws-lambda';

import type {
  CreateVendorRequest,
  UpsertVendorModelPriceRequest,
  UpdateVendorRequest,
  UUID,
  VendorListFilters,
  VendorRating,
  VendorType,
} from '@ams/types';
import {
  API_ERROR_CODES,
  createApiResponse,
  createErrorResponse,
  createLambdaResponse,
  HTTP_STATUS,
} from '@ams/types';
import { createLogger, validateUUID } from '@ams/utils';

import * as vendorService from '../reference-data/vendor-service';
import * as vendorModelPriceService from '../reference-data/vendor-model-price-service';
import {
  VendorCodeExistsError,
  VendorHasDependenciesError,
  VendorNotFoundError,
} from '../reference-data/vendor-service';
import { getUserContext } from '../utils/user-context';

const logger = createLogger({ service: 'vendor-handlers' });


// ============================================================================
// Constants
// ============================================================================

/**
 * Valid vendor types
 */
const VALID_VENDOR_TYPES: VendorType[] = [
  'MANUFACTURER',
  'RESELLER',
  'DISTRIBUTOR',
  'SERVICE_PROVIDER',
  'CONSULTANT',
  'CONTRACTOR',
  'LESSOR',
  'OTHER',
];

/**
 * Valid vendor ratings
 */
const VALID_VENDOR_RATINGS: VendorRating[] = [
  'PREFERRED',
  'APPROVED',
  'CONDITIONAL',
  'PROBATION',
  'SUSPENDED',
  'BLACKLISTED',
];

// ============================================================================
// Request Validation
// ============================================================================

/**
 * Validation result type
 */
interface ValidationResult {
  readonly valid: boolean;
  readonly errors: string[];
}

/**
 * Validate vendor code format
 * Code must be alphanumeric with dashes/underscores, max 50 chars
 */
function isValidVendorCode(code: string): boolean {
  const codeRegex = /^[a-zA-Z0-9_-]+$/;
  return codeRegex.test(code) && code.length <= 50;
}

/**
 * Validate email format
 */
function isValidEmail(email: string): boolean {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(email);
}

/**
 * Validate create vendor request
 * Requirement 9.1: Create vendor with name, type, contact information, and payment terms
 */
function validateCreateVendorRequest(body: unknown): ValidationResult {
  const errors: string[] = [];

  if (!body || typeof body !== 'object') {
    return { valid: false, errors: ['Request body is required'] };
  }

  const request = body as Record<string, unknown>;

  // Required: vendorName
  if (!request['vendorName'] || typeof request['vendorName'] !== 'string') {
    errors.push('vendorName is required and must be a string');
  } else if (request['vendorName'].length < 1 || request['vendorName'].length > 255) {
    errors.push('vendorName must be between 1 and 255 characters');
  }

  // Optional: vendorCode
  if (request['vendorCode'] !== undefined && request['vendorCode'] !== null) {
    if (typeof request['vendorCode'] !== 'string') {
      errors.push('vendorCode must be a string');
    } else if (request['vendorCode'].length > 50) {
      errors.push('vendorCode must be at most 50 characters');
    } else if (!isValidVendorCode(request['vendorCode'])) {
      errors.push('vendorCode must contain only alphanumeric characters, dashes, and underscores');
    }
  }

  // Optional: vendorType
  if (request['vendorType'] !== undefined && request['vendorType'] !== null) {
    if (typeof request['vendorType'] !== 'string') {
      errors.push('vendorType must be a string');
    } else if (!VALID_VENDOR_TYPES.includes(request['vendorType'] as VendorType)) {
      errors.push(`vendorType must be one of: ${VALID_VENDOR_TYPES.join(', ')}`);
    }
  }

  // Optional: contactEmail
  if (request['contactEmail'] !== undefined && request['contactEmail'] !== null) {
    if (typeof request['contactEmail'] !== 'string') {
      errors.push('contactEmail must be a string');
    } else if (!isValidEmail(request['contactEmail'])) {
      errors.push('contactEmail must be a valid email address');
    }
  }

  // Optional: contactName
  if (request['contactName'] !== undefined && request['contactName'] !== null) {
    if (typeof request['contactName'] !== 'string') {
      errors.push('contactName must be a string');
    } else if (request['contactName'].length > 255) {
      errors.push('contactName must be at most 255 characters');
    }
  }

  // Optional: contactPhone
  if (request['contactPhone'] !== undefined && request['contactPhone'] !== null) {
    if (typeof request['contactPhone'] !== 'string') {
      errors.push('contactPhone must be a string');
    } else if (request['contactPhone'].length > 50) {
      errors.push('contactPhone must be at most 50 characters');
    }
  }

  // Optional: paymentTerms
  if (request['paymentTerms'] !== undefined && request['paymentTerms'] !== null) {
    if (typeof request['paymentTerms'] !== 'string') {
      errors.push('paymentTerms must be a string');
    } else if (request['paymentTerms'].length > 100) {
      errors.push('paymentTerms must be at most 100 characters');
    }
  }

  return { valid: errors.length === 0, errors };
}

/**
 * Validate update vendor request
 * Requirement 9.3: Update vendor details including contacts and payment terms
 */
function validateUpdateVendorRequest(body: unknown): ValidationResult {
  const errors: string[] = [];

  if (!body || typeof body !== 'object') {
    return { valid: false, errors: ['Request body is required'] };
  }

  const request = body as Record<string, unknown>;

  // Check if at least one field is provided
  const updateFields = [
    'vendorName',
    'vendorType',
    'contactName',
    'contactEmail',
    'contactPhone',
    'addressLine1',
    'addressLine2',
    'city',
    'stateProvince',
    'postalCode',
    'country',
    'paymentTerms',
    'rating',
    'isActive',
  ];
  const hasUpdateField = updateFields.some((field) => request[field] !== undefined);
  if (!hasUpdateField) {
    errors.push('At least one field must be provided for update');
  }

  // Validate vendorName if provided
  if (request['vendorName'] !== undefined) {
    if (typeof request['vendorName'] !== 'string') {
      errors.push('vendorName must be a string');
    } else if (request['vendorName'].length < 1 || request['vendorName'].length > 255) {
      errors.push('vendorName must be between 1 and 255 characters');
    }
  }

  // Validate vendorType if provided
  if (request['vendorType'] !== undefined && request['vendorType'] !== null) {
    if (typeof request['vendorType'] !== 'string') {
      errors.push('vendorType must be a string');
    } else if (!VALID_VENDOR_TYPES.includes(request['vendorType'] as VendorType)) {
      errors.push(`vendorType must be one of: ${VALID_VENDOR_TYPES.join(', ')}`);
    }
  }

  // Validate contactEmail if provided
  if (request['contactEmail'] !== undefined && request['contactEmail'] !== null) {
    if (typeof request['contactEmail'] !== 'string') {
      errors.push('contactEmail must be a string');
    } else if (request['contactEmail'] !== '' && !isValidEmail(request['contactEmail'])) {
      errors.push('contactEmail must be a valid email address');
    }
  }

  // Validate rating if provided
  if (request['rating'] !== undefined && request['rating'] !== null) {
    if (typeof request['rating'] !== 'string') {
      errors.push('rating must be a string');
    } else if (!VALID_VENDOR_RATINGS.includes(request['rating'] as VendorRating)) {
      errors.push(`rating must be one of: ${VALID_VENDOR_RATINGS.join(', ')}`);
    }
  }

  // Validate isActive if provided
  if (request['isActive'] !== undefined && typeof request['isActive'] !== 'boolean') {
    errors.push('isActive must be a boolean');
  }

  return { valid: errors.length === 0, errors };
}

/**
 * Validate update vendor rating request
 * Requirement 9.4: Update rating and log the change in audit history
 */
function validateUpdateRatingRequest(body: unknown): ValidationResult {
  const errors: string[] = [];

  if (!body || typeof body !== 'object') {
    return { valid: false, errors: ['Request body is required'] };
  }

  const request = body as Record<string, unknown>;

  // Required: rating
  if (!request['rating'] || typeof request['rating'] !== 'string') {
    errors.push('rating is required and must be a string');
  } else if (!VALID_VENDOR_RATINGS.includes(request['rating'] as VendorRating)) {
    errors.push(`rating must be one of: ${VALID_VENDOR_RATINGS.join(', ')}`);
  }

  return { valid: errors.length === 0, errors };
}

/**
 * Parse list filters from query parameters
 */
function parseListFilters(queryParams: Record<string, string | undefined>): VendorListFilters {
  const result: VendorListFilters = {};

  if (queryParams['vendorType']) {
    if (VALID_VENDOR_TYPES.includes(queryParams['vendorType'] as VendorType)) {
      Object.assign(result, { vendorType: queryParams['vendorType'] as VendorType });
    }
  }
  if (queryParams['rating']) {
    if (VALID_VENDOR_RATINGS.includes(queryParams['rating'] as VendorRating)) {
      Object.assign(result, { rating: queryParams['rating'] as VendorRating });
    }
  }
  if (queryParams['isActive'] !== undefined) {
    Object.assign(result, { isActive: queryParams['isActive'] === 'true' });
  }
  if (queryParams['search']) {
    Object.assign(result, { search: queryParams['search'] });
  }

  return result;
}

async function requireDbUserId(
  event: APIGatewayProxyEvent,
  requestId: string
): Promise<{ ok: true; userId: UUID } | { ok: false; response: APIGatewayProxyResult }> {
  const { authSub, userId } = await getUserContext(event);
  if (!authSub) {
    return {
      ok: false,
      response: createLambdaResponse(
        HTTP_STATUS.UNAUTHORIZED,
        createErrorResponse(API_ERROR_CODES.UNAUTHORIZED, 'Authentication required', requestId)
      ),
    };
  }

  if (!userId) {
    return {
      ok: false,
      response: createLambdaResponse(
        HTTP_STATUS.FORBIDDEN,
        createErrorResponse(API_ERROR_CODES.USER_NOT_PROVISIONED, 'User is not provisioned', requestId)
      ),
    };
  }

  return { ok: true, userId };
}


// ============================================================================
// Vendor-Model Price Validation
// ============================================================================

function validateUpsertVendorModelPriceRequest(
  body: unknown
): { valid: true; data: UpsertVendorModelPriceRequest } | { valid: false; errors: string[] } {
  const errors: string[] = [];

  if (!body || typeof body !== 'object') {
    return { valid: false, errors: ['Request body is required'] };
  }

  const request = body as Record<string, unknown>;

  if (request['unitPrice'] === undefined || request['unitPrice'] === null || typeof request['unitPrice'] !== 'number') {
    errors.push('unitPrice is required and must be a number');
  } else if ((request['unitPrice'] as number) < 0) {
    errors.push('unitPrice must be a non-negative number');
  }

  if (request['currency'] !== undefined && request['currency'] !== null) {
    if (typeof request['currency'] !== 'string') {
      errors.push('currency must be a string');
    } else if ((request['currency'] as string).trim().length !== 3) {
      errors.push('currency must be a 3-letter code (e.g., USD)');
    }
  }

  if (request['countryCode'] !== undefined && request['countryCode'] !== null) {
    if (typeof request['countryCode'] !== 'string') {
      errors.push('countryCode must be a string');
    } else {
      const normalizedCountryCode = request['countryCode'].trim().toUpperCase();
      if (!/^[A-Z0-9_-]{2,10}$/.test(normalizedCountryCode)) {
        errors.push('countryCode must be 2-10 characters using A-Z, 0-9, _ or -');
      }
    }
  }

  if (request['vendorSku'] !== undefined && request['vendorSku'] !== null && typeof request['vendorSku'] !== 'string') {
    errors.push('vendorSku must be a string');
  }

  if (request['isActive'] !== undefined && typeof request['isActive'] !== 'boolean') {
    errors.push('isActive must be a boolean');
  }

  if (errors.length > 0) {
    return { valid: false, errors };
  }

  return {
    valid: true,
    data: {
      unitPrice: request['unitPrice'] as number,
      currency: request['currency'] as string | undefined,
      countryCode: request['countryCode'] as string | undefined,
      vendorSku: request['vendorSku'] as string | undefined,
      isActive: request['isActive'] as boolean | undefined,
    },
  };
}

function normalizeCountryCode(value?: string): string | undefined {
  if (!value) {
    return undefined;
  }
  const normalized = value.trim().toUpperCase();
  return normalized.length > 0 ? normalized : undefined;
}

// ============================================================================
// Lambda Handlers
// ============================================================================

/**
 * Create a new vendor
 * POST /admin/vendors
 *
 * Requirement 9.1: Create vendor with name, type, contact information, and payment terms
 */
export async function createVendorHandler(
  event: APIGatewayProxyEvent
): Promise<APIGatewayProxyResult> {
  const requestId = event.requestContext.requestId;

  logger.info('Create vendor request received', { requestId });

  try {
    const ctx = await requireDbUserId(event, requestId);
    if (!ctx.ok) return ctx.response;

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
    const validation = validateCreateVendorRequest(body);
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

    const request = body as CreateVendorRequest;

    // Create vendor
    const vendor = await vendorService.createVendor(request, ctx.userId);

    logger.info('Vendor created successfully', {
      requestId,
      vendorId: vendor.vendorId,
      vendorCode: vendor.vendorCode,
    });

    return createLambdaResponse(HTTP_STATUS.CREATED, createApiResponse(vendor, requestId));
  } catch (error) {
    const err = error as Error;

    if (err instanceof VendorCodeExistsError) {
      logger.warn('Vendor code already exists', { requestId, error: err.message });
      return createLambdaResponse(
        HTTP_STATUS.CONFLICT,
        createErrorResponse(API_ERROR_CODES.CONFLICT, err.message, requestId)
      );
    }

    logger.error('Failed to create vendor', err, { requestId });
    return createLambdaResponse(
      HTTP_STATUS.INTERNAL_SERVER_ERROR,
      createErrorResponse(API_ERROR_CODES.INTERNAL_ERROR, 'Failed to create vendor', requestId)
    );
  }
}


/**
 * Get vendor by ID
 * GET /admin/vendors/{vendorId}
 *
 * Requirement 9.2: Return complete vendor details including contacts and payment terms
 */
export async function getVendorHandler(
  event: APIGatewayProxyEvent
): Promise<APIGatewayProxyResult> {
  const requestId = event.requestContext.requestId;

  logger.info('Get vendor request received', { requestId });

  try {
    // Get vendor ID from path parameters
    const vendorId = event.pathParameters?.['vendorId'];
    if (!vendorId) {
      return createLambdaResponse(
        HTTP_STATUS.BAD_REQUEST,
        createErrorResponse(API_ERROR_CODES.BAD_REQUEST, 'vendorId is required', requestId)
      );
    }

    // Validate UUID format
    const uuidError = validateUUID(vendorId, 'vendorId');
    if (uuidError) {
      return createLambdaResponse(
        HTTP_STATUS.BAD_REQUEST,
        createErrorResponse(API_ERROR_CODES.BAD_REQUEST, uuidError.message, requestId)
      );
    }

    // Get vendor
    const vendor = await vendorService.getVendorById(vendorId);

    if (!vendor) {
      return createLambdaResponse(
        HTTP_STATUS.NOT_FOUND,
        createErrorResponse(API_ERROR_CODES.NOT_FOUND, `Vendor not found: ${vendorId}`, requestId)
      );
    }

    logger.info('Vendor retrieved successfully', {
      requestId,
      vendorId: vendor.vendorId,
    });

    return createLambdaResponse(HTTP_STATUS.OK, createApiResponse(vendor, requestId));
  } catch (error) {
    const err = error as Error;
    logger.error('Failed to get vendor', err, { requestId });

    return createLambdaResponse(
      HTTP_STATUS.INTERNAL_SERVER_ERROR,
      createErrorResponse(API_ERROR_CODES.INTERNAL_ERROR, 'Failed to get vendor', requestId)
    );
  }
}


/**
 * Update vendor details
 * PUT /admin/vendors/{vendorId}
 *
 * Requirement 9.3: Update vendor details including contacts and payment terms
 */
export async function updateVendorHandler(
  event: APIGatewayProxyEvent
): Promise<APIGatewayProxyResult> {
  const requestId = event.requestContext.requestId;

  logger.info('Update vendor request received', { requestId });

  try {
    const ctx = await requireDbUserId(event, requestId);
    if (!ctx.ok) return ctx.response;

    // Get vendor ID from path parameters
    const vendorId = event.pathParameters?.['vendorId'];
    if (!vendorId) {
      return createLambdaResponse(
        HTTP_STATUS.BAD_REQUEST,
        createErrorResponse(API_ERROR_CODES.BAD_REQUEST, 'vendorId is required', requestId)
      );
    }

    // Validate UUID format
    const uuidError = validateUUID(vendorId, 'vendorId');
    if (uuidError) {
      return createLambdaResponse(
        HTTP_STATUS.BAD_REQUEST,
        createErrorResponse(API_ERROR_CODES.BAD_REQUEST, uuidError.message, requestId)
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
    const validation = validateUpdateVendorRequest(body);
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

    const request = body as UpdateVendorRequest;

    // Update vendor
    const vendor = await vendorService.updateVendor(vendorId, request, ctx.userId);

    logger.info('Vendor updated successfully', {
      requestId,
      vendorId: vendor.vendorId,
    });

    return createLambdaResponse(HTTP_STATUS.OK, createApiResponse(vendor, requestId));
  } catch (error) {
    const err = error as Error;

    if (err instanceof VendorNotFoundError) {
      logger.warn('Vendor not found', { requestId, error: err.message });
      return createLambdaResponse(
        HTTP_STATUS.NOT_FOUND,
        createErrorResponse(API_ERROR_CODES.NOT_FOUND, err.message, requestId)
      );
    }

    logger.error('Failed to update vendor', err, { requestId });
    return createLambdaResponse(
      HTTP_STATUS.INTERNAL_SERVER_ERROR,
      createErrorResponse(API_ERROR_CODES.INTERNAL_ERROR, 'Failed to update vendor', requestId)
    );
  }
}


/**
 * Delete a vendor
 * DELETE /admin/vendors/{vendorId}
 *
 * Requirement 9.5: Reject deletion if has purchase orders or assets
 */
export async function deleteVendorHandler(
  event: APIGatewayProxyEvent
): Promise<APIGatewayProxyResult> {
  const requestId = event.requestContext.requestId;

  logger.info('Delete vendor request received', { requestId });

  try {
    // Get vendor ID from path parameters
    const vendorId = event.pathParameters?.['vendorId'];
    if (!vendorId) {
      return createLambdaResponse(
        HTTP_STATUS.BAD_REQUEST,
        createErrorResponse(API_ERROR_CODES.BAD_REQUEST, 'vendorId is required', requestId)
      );
    }

    // Validate UUID format
    const uuidError = validateUUID(vendorId, 'vendorId');
    if (uuidError) {
      return createLambdaResponse(
        HTTP_STATUS.BAD_REQUEST,
        createErrorResponse(API_ERROR_CODES.BAD_REQUEST, uuidError.message, requestId)
      );
    }

    // Delete vendor
    const deleted = await vendorService.deleteVendor(vendorId);

    if (deleted) {
      logger.info('Vendor deleted successfully', { requestId, vendorId });
      return createLambdaResponse(HTTP_STATUS.NO_CONTENT, null);
    }

    // Should not reach here if vendor exists
    return createLambdaResponse(
      HTTP_STATUS.INTERNAL_SERVER_ERROR,
      createErrorResponse(API_ERROR_CODES.INTERNAL_ERROR, 'Failed to delete vendor', requestId)
    );
  } catch (error) {
    const err = error as Error;

    if (err instanceof VendorNotFoundError) {
      logger.warn('Vendor not found', { requestId, error: err.message });
      return createLambdaResponse(
        HTTP_STATUS.NOT_FOUND,
        createErrorResponse(API_ERROR_CODES.NOT_FOUND, err.message, requestId)
      );
    }

    if (err instanceof VendorHasDependenciesError) {
      logger.warn('Vendor has dependencies', {
        requestId,
        error: err.message,
        poCount: err.poCount,
        assetCount: err.assetCount,
      });
      return createLambdaResponse(
        HTTP_STATUS.CONFLICT,
        createErrorResponse(API_ERROR_CODES.CONFLICT, err.message, requestId)
      );
    }

    logger.error('Failed to delete vendor', err, { requestId });
    return createLambdaResponse(
      HTTP_STATUS.INTERNAL_SERVER_ERROR,
      createErrorResponse(API_ERROR_CODES.INTERNAL_ERROR, 'Failed to delete vendor', requestId)
    );
  }
}


/**
 * List vendors with pagination and filters
 * GET /admin/vendors
 *
 * Requirement 9.6: Return paginated list with type and rating filters
 */
export async function listVendorsHandler(
  event: APIGatewayProxyEvent
): Promise<APIGatewayProxyResult> {
  const requestId = event.requestContext.requestId;

  logger.info('List vendors request received', { requestId });

  try {
    // Parse query parameters
    const queryParams = event.queryStringParameters ?? {};

    // Parse pagination
    const page = queryParams['page'] ? parseInt(queryParams['page'], 10) : 1;
    const limit = queryParams['limit'] ? parseInt(queryParams['limit'], 10) : 20;

    // Validate pagination
    if (isNaN(page) || page < 1) {
      return createLambdaResponse(
        HTTP_STATUS.BAD_REQUEST,
        createErrorResponse(API_ERROR_CODES.BAD_REQUEST, 'page must be a positive integer', requestId)
      );
    }

    if (isNaN(limit) || limit < 1 || limit > 1000) {
      return createLambdaResponse(
        HTTP_STATUS.BAD_REQUEST,
        createErrorResponse(API_ERROR_CODES.BAD_REQUEST, 'limit must be between 1 and 1000', requestId)
      );
    }

    // Parse filters
    const filters = parseListFilters(queryParams);

    // List vendors
    const result = await vendorService.listVendors(filters, { page, limit });

    logger.info('Vendors listed successfully', {
      requestId,
      total: result.total,
      page: result.page,
      limit: result.limit,
      itemCount: result.items.length,
    });

    return createLambdaResponse(HTTP_STATUS.OK, createApiResponse(result, requestId));
  } catch (error) {
    const err = error as Error;
    logger.error('Failed to list vendors', err, { requestId });

    return createLambdaResponse(
      HTTP_STATUS.INTERNAL_SERVER_ERROR,
      createErrorResponse(API_ERROR_CODES.INTERNAL_ERROR, 'Failed to list vendors', requestId)
    );
  }
}


/**
 * Search vendors by name or code
 * GET /admin/vendors/search?q={searchTerm}
 *
 * Requirement 9.7: Return matching vendors using partial text matching
 */
export async function searchVendorsHandler(
  event: APIGatewayProxyEvent
): Promise<APIGatewayProxyResult> {
  const requestId = event.requestContext.requestId;

  logger.info('Search vendors request received', { requestId });

  try {
    // Get search term from query parameters
    const queryParams = event.queryStringParameters ?? {};
    const searchTerm = queryParams['q'] ?? queryParams['search'] ?? '';

    if (!searchTerm || searchTerm.trim().length === 0) {
      return createLambdaResponse(
        HTTP_STATUS.BAD_REQUEST,
        createErrorResponse(
          API_ERROR_CODES.BAD_REQUEST,
          'Search term (q or search) is required',
          requestId
        )
      );
    }

    if (searchTerm.length < 2) {
      return createLambdaResponse(
        HTTP_STATUS.BAD_REQUEST,
        createErrorResponse(
          API_ERROR_CODES.BAD_REQUEST,
          'Search term must be at least 2 characters',
          requestId
        )
      );
    }

    // Search vendors
    const vendors = await vendorService.searchVendors(searchTerm.trim());

    logger.info('Vendors search completed', {
      requestId,
      searchTerm,
      resultCount: vendors.length,
    });

    return createLambdaResponse(
      HTTP_STATUS.OK,
      createApiResponse({ vendors, count: vendors.length }, requestId)
    );
  } catch (error) {
    const err = error as Error;
    logger.error('Failed to search vendors', err, { requestId });

    return createLambdaResponse(
      HTTP_STATUS.INTERNAL_SERVER_ERROR,
      createErrorResponse(API_ERROR_CODES.INTERNAL_ERROR, 'Failed to search vendors', requestId)
    );
  }
}


/**
 * Update vendor rating
 * PUT /admin/vendors/{vendorId}/rating
 *
 * Requirement 9.4: Update rating and log the change in audit history
 */
export async function updateVendorRatingHandler(
  event: APIGatewayProxyEvent
): Promise<APIGatewayProxyResult> {
  const requestId = event.requestContext.requestId;

  logger.info('Update vendor rating request received', { requestId });

  try {
    const ctx = await requireDbUserId(event, requestId);
    if (!ctx.ok) return ctx.response;

    // Get vendor ID from path parameters
    const vendorId = event.pathParameters?.['vendorId'];
    if (!vendorId) {
      return createLambdaResponse(
        HTTP_STATUS.BAD_REQUEST,
        createErrorResponse(API_ERROR_CODES.BAD_REQUEST, 'vendorId is required', requestId)
      );
    }

    // Validate UUID format
    const uuidError = validateUUID(vendorId, 'vendorId');
    if (uuidError) {
      return createLambdaResponse(
        HTTP_STATUS.BAD_REQUEST,
        createErrorResponse(API_ERROR_CODES.BAD_REQUEST, uuidError.message, requestId)
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
    const validation = validateUpdateRatingRequest(body);
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

    const request = body as { rating: VendorRating };

    // Update vendor rating
    const vendor = await vendorService.updateVendorRating(vendorId, request.rating, ctx.userId);

    logger.info('Vendor rating updated successfully', {
      requestId,
      vendorId: vendor.vendorId,
      newRating: vendor.rating,
    });

    return createLambdaResponse(HTTP_STATUS.OK, createApiResponse(vendor, requestId));
  } catch (error) {
    const err = error as Error;

    if (err instanceof VendorNotFoundError) {
      logger.warn('Vendor not found', { requestId, error: err.message });
      return createLambdaResponse(
        HTTP_STATUS.NOT_FOUND,
        createErrorResponse(API_ERROR_CODES.NOT_FOUND, err.message, requestId)
      );
    }

    logger.error('Failed to update vendor rating', err, { requestId });
    return createLambdaResponse(
      HTTP_STATUS.INTERNAL_SERVER_ERROR,
      createErrorResponse(API_ERROR_CODES.INTERNAL_ERROR, 'Failed to update vendor rating', requestId)
    );
  }
}


/**
 * Get vendors by type
 * GET /admin/vendors/type/{vendorType}
 *
 * Requirement 9.6: Filter vendors by type
 */
export async function getVendorsByTypeHandler(
  event: APIGatewayProxyEvent
): Promise<APIGatewayProxyResult> {
  const requestId = event.requestContext.requestId;

  logger.info('Get vendors by type request received', { requestId });

  try {
    // Get vendor type from path parameters
    const vendorType = event.pathParameters?.['vendorType'];
    if (!vendorType) {
      return createLambdaResponse(
        HTTP_STATUS.BAD_REQUEST,
        createErrorResponse(API_ERROR_CODES.BAD_REQUEST, 'vendorType is required', requestId)
      );
    }

    // Validate vendor type
    if (!VALID_VENDOR_TYPES.includes(vendorType as VendorType)) {
      return createLambdaResponse(
        HTTP_STATUS.BAD_REQUEST,
        createErrorResponse(
          API_ERROR_CODES.BAD_REQUEST,
          `vendorType must be one of: ${VALID_VENDOR_TYPES.join(', ')}`,
          requestId
        )
      );
    }

    // Get vendors by type
    const vendors = await vendorService.getVendorsByType(vendorType as VendorType);

    logger.info('Vendors by type retrieved successfully', {
      requestId,
      vendorType,
      count: vendors.length,
    });

    return createLambdaResponse(
      HTTP_STATUS.OK,
      createApiResponse({ vendors, count: vendors.length }, requestId)
    );
  } catch (error) {
    const err = error as Error;
    logger.error('Failed to get vendors by type', err, { requestId });

    return createLambdaResponse(
      HTTP_STATUS.INTERNAL_SERVER_ERROR,
      createErrorResponse(API_ERROR_CODES.INTERNAL_ERROR, 'Failed to get vendors by type', requestId)
    );
  }
}


/**
 * Get vendors by rating
 * GET /admin/vendors/rating/{rating}
 *
 * Requirement 9.6: Filter vendors by rating
 */
export async function getVendorsByRatingHandler(
  event: APIGatewayProxyEvent
): Promise<APIGatewayProxyResult> {
  const requestId = event.requestContext.requestId;

  logger.info('Get vendors by rating request received', { requestId });

  try {
    // Get rating from path parameters
    const rating = event.pathParameters?.['rating'];
    if (!rating) {
      return createLambdaResponse(
        HTTP_STATUS.BAD_REQUEST,
        createErrorResponse(API_ERROR_CODES.BAD_REQUEST, 'rating is required', requestId)
      );
    }

    // Validate rating
    if (!VALID_VENDOR_RATINGS.includes(rating as VendorRating)) {
      return createLambdaResponse(
        HTTP_STATUS.BAD_REQUEST,
        createErrorResponse(
          API_ERROR_CODES.BAD_REQUEST,
          `rating must be one of: ${VALID_VENDOR_RATINGS.join(', ')}`,
          requestId
        )
      );
    }

    // Get vendors by rating
    const vendors = await vendorService.getVendorsByRating(rating as VendorRating);

    logger.info('Vendors by rating retrieved successfully', {
      requestId,
      rating,
      count: vendors.length,
    });

    return createLambdaResponse(
      HTTP_STATUS.OK,
      createApiResponse({ vendors, count: vendors.length }, requestId)
    );
  } catch (error) {
    const err = error as Error;
    logger.error('Failed to get vendors by rating', err, { requestId });

    return createLambdaResponse(
      HTTP_STATUS.INTERNAL_SERVER_ERROR,
      createErrorResponse(API_ERROR_CODES.INTERNAL_ERROR, 'Failed to get vendors by rating', requestId)
    );
  }
}


/**
 * Get vendors eligible for purchasing
 * GET /admin/vendors/purchasing
 *
 * Returns vendors that can receive purchase orders (excludes SUSPENDED and BLACKLISTED)
 */
export async function getVendorsForPurchasingHandler(
  event: APIGatewayProxyEvent
): Promise<APIGatewayProxyResult> {
  const requestId = event.requestContext.requestId;

  logger.info('Get vendors for purchasing request received', { requestId });

  try {
    // Get vendors eligible for purchasing
    const vendors = await vendorService.getVendorsForPurchasing();

    logger.info('Vendors for purchasing retrieved successfully', {
      requestId,
      count: vendors.length,
    });

    return createLambdaResponse(
      HTTP_STATUS.OK,
      createApiResponse({ vendors, count: vendors.length }, requestId)
    );
  } catch (error) {
    const err = error as Error;
    logger.error('Failed to get vendors for purchasing', err, { requestId });

    return createLambdaResponse(
      HTTP_STATUS.INTERNAL_SERVER_ERROR,
      createErrorResponse(API_ERROR_CODES.INTERNAL_ERROR, 'Failed to get vendors for purchasing', requestId)
    );
  }
}


/**
 * List vendor model prices
 * GET /admin/vendors/{vendorId}/model-prices
 */
export async function listVendorModelPricesHandler(
  event: APIGatewayProxyEvent
): Promise<APIGatewayProxyResult> {
  const requestId = event.requestContext.requestId;
  const vendorId = event.pathParameters?.['vendorId'];

  logger.info('List vendor model prices request received', { requestId, vendorId });

  try {
    if (!vendorId) {
      return createLambdaResponse(
        HTTP_STATUS.BAD_REQUEST,
        createErrorResponse(API_ERROR_CODES.BAD_REQUEST, 'vendorId is required', requestId)
      );
    }

    const vendorIdError = validateUUID(vendorId, 'vendorId');
    if (vendorIdError) {
      return createLambdaResponse(
        HTTP_STATUS.BAD_REQUEST,
        createErrorResponse(API_ERROR_CODES.VALIDATION_ERROR, vendorIdError.message, requestId)
      );
    }

    const queryParams = event.queryStringParameters ?? {};
    const modelIdParam = queryParams['modelId'];
    const isActiveParam = queryParams['isActive'];
    const countryCodeParam = normalizeCountryCode(queryParams['countryCode']);

    if (modelIdParam) {
      const modelIdError = validateUUID(modelIdParam, 'modelId');
      if (modelIdError) {
        return createLambdaResponse(
          HTTP_STATUS.BAD_REQUEST,
          createErrorResponse(API_ERROR_CODES.VALIDATION_ERROR, modelIdError.message, requestId)
        );
      }
    }

    if (countryCodeParam && !/^[A-Z0-9_-]{2,10}$/.test(countryCodeParam)) {
      return createLambdaResponse(
        HTTP_STATUS.BAD_REQUEST,
        createErrorResponse(
          API_ERROR_CODES.VALIDATION_ERROR,
          'countryCode must be 2-10 characters using A-Z, 0-9, _ or -',
          requestId
        )
      );
    }

    const items = await vendorModelPriceService.listVendorModelPrices(vendorId as UUID, {
      modelId: modelIdParam as UUID | undefined,
      countryCode: countryCodeParam,
      isActive: isActiveParam !== undefined ? isActiveParam === 'true' : undefined,
    });

    return createLambdaResponse(
      HTTP_STATUS.OK,
      createApiResponse({ items, total: items.length }, requestId)
    );
  } catch (error) {
    const err = error as Error;
    logger.error('Failed to list vendor model prices', err, { requestId, vendorId });
    return createLambdaResponse(
      HTTP_STATUS.INTERNAL_SERVER_ERROR,
      createErrorResponse(API_ERROR_CODES.INTERNAL_ERROR, 'Failed to list vendor model prices', requestId)
    );
  }
}

/**
 * Upsert vendor model price
 * PUT /admin/vendors/{vendorId}/model-prices/{modelId}
 */
export async function upsertVendorModelPriceHandler(
  event: APIGatewayProxyEvent
): Promise<APIGatewayProxyResult> {
  const requestId = event.requestContext.requestId;
  const vendorId = event.pathParameters?.['vendorId'];
  const modelId = event.pathParameters?.['modelId'];

  logger.info('Upsert vendor model price request received', { requestId, vendorId, modelId });

  try {
    const ctx = await requireDbUserId(event, requestId);
    if (!ctx.ok) return ctx.response;

    if (!vendorId || !modelId) {
      return createLambdaResponse(
        HTTP_STATUS.BAD_REQUEST,
        createErrorResponse(API_ERROR_CODES.BAD_REQUEST, 'vendorId and modelId are required', requestId)
      );
    }

    const vendorIdError = validateUUID(vendorId, 'vendorId');
    if (vendorIdError) {
      return createLambdaResponse(
        HTTP_STATUS.BAD_REQUEST,
        createErrorResponse(API_ERROR_CODES.VALIDATION_ERROR, vendorIdError.message, requestId)
      );
    }

    const modelIdError = validateUUID(modelId, 'modelId');
    if (modelIdError) {
      return createLambdaResponse(
        HTTP_STATUS.BAD_REQUEST,
        createErrorResponse(API_ERROR_CODES.VALIDATION_ERROR, modelIdError.message, requestId)
      );
    }

    let body: unknown;
    try {
      body = event.body ? JSON.parse(event.body) : null;
    } catch {
      return createLambdaResponse(
        HTTP_STATUS.BAD_REQUEST,
        createErrorResponse(API_ERROR_CODES.BAD_REQUEST, 'Invalid JSON in request body', requestId)
      );
    }

    const validation = validateUpsertVendorModelPriceRequest(body);
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

    const price = await vendorModelPriceService.upsertVendorModelPrice(
      vendorId as UUID,
      modelId as UUID,
      validation.data,
      ctx.userId
    );

    return createLambdaResponse(HTTP_STATUS.OK, createApiResponse(price, requestId));
  } catch (error) {
    const err = error as Error;
    logger.error('Failed to upsert vendor model price', err, { requestId, vendorId, modelId });
    return createLambdaResponse(
      HTTP_STATUS.INTERNAL_SERVER_ERROR,
      createErrorResponse(API_ERROR_CODES.INTERNAL_ERROR, 'Failed to upsert vendor model price', requestId)
    );
  }
}

/**
 * Deactivate vendor model price
 * DELETE /admin/vendors/{vendorId}/model-prices/{modelId}
 */
export async function deactivateVendorModelPriceHandler(
  event: APIGatewayProxyEvent
): Promise<APIGatewayProxyResult> {
  const requestId = event.requestContext.requestId;
  const vendorId = event.pathParameters?.['vendorId'];
  const modelId = event.pathParameters?.['modelId'];
  const countryCode = normalizeCountryCode(event.queryStringParameters?.['countryCode']);

  logger.info('Deactivate vendor model price request received', { requestId, vendorId, modelId });

  try {
    const ctx = await requireDbUserId(event, requestId);
    if (!ctx.ok) return ctx.response;

    if (!vendorId || !modelId) {
      return createLambdaResponse(
        HTTP_STATUS.BAD_REQUEST,
        createErrorResponse(API_ERROR_CODES.BAD_REQUEST, 'vendorId and modelId are required', requestId)
      );
    }

    const vendorIdError = validateUUID(vendorId, 'vendorId');
    if (vendorIdError) {
      return createLambdaResponse(
        HTTP_STATUS.BAD_REQUEST,
        createErrorResponse(API_ERROR_CODES.VALIDATION_ERROR, vendorIdError.message, requestId)
      );
    }

    const modelIdError = validateUUID(modelId, 'modelId');
    if (modelIdError) {
      return createLambdaResponse(
        HTTP_STATUS.BAD_REQUEST,
        createErrorResponse(API_ERROR_CODES.VALIDATION_ERROR, modelIdError.message, requestId)
      );
    }

    if (countryCode && !/^[A-Z0-9_-]{2,10}$/.test(countryCode)) {
      return createLambdaResponse(
        HTTP_STATUS.BAD_REQUEST,
        createErrorResponse(
          API_ERROR_CODES.VALIDATION_ERROR,
          'countryCode must be 2-10 characters using A-Z, 0-9, _ or -',
          requestId
        )
      );
    }

    await vendorModelPriceService.deactivateVendorModelPrice(
      vendorId as UUID,
      modelId as UUID,
      countryCode,
      ctx.userId
    );

    return createLambdaResponse(HTTP_STATUS.NO_CONTENT, '');
  } catch (error) {
    const err = error as Error;

    if (err.message.includes('not found')) {
      return createLambdaResponse(
        HTTP_STATUS.NOT_FOUND,
        createErrorResponse(API_ERROR_CODES.NOT_FOUND, err.message, requestId)
      );
    }

    logger.error('Failed to deactivate vendor model price', err, { requestId, vendorId, modelId });
    return createLambdaResponse(
      HTTP_STATUS.INTERNAL_SERVER_ERROR,
      createErrorResponse(API_ERROR_CODES.INTERNAL_ERROR, 'Failed to deactivate vendor model price', requestId)
    );
  }
}

// ============================================================================
// Unified Router Handler
// ============================================================================

/**
 * Unified vendor handler that routes requests based on HTTP method and path.
 *
 * Routes:
 * - GET    /admin/vendors                       -> listVendorsHandler
 * - GET    /admin/vendors/search                -> searchVendorsHandler
 * - GET    /admin/vendors/purchasing             -> getVendorsForPurchasingHandler
 * - GET    /admin/vendors/type/{vendorType}      -> getVendorsByTypeHandler
 * - GET    /admin/vendors/rating/{rating}        -> getVendorsByRatingHandler
 * - GET    /admin/vendors/{vendorId}             -> getVendorHandler
 * - POST   /admin/vendors                       -> createVendorHandler
 * - PUT    /admin/vendors/{vendorId}             -> updateVendorHandler
 * - PUT    /admin/vendors/{vendorId}/rating      -> updateVendorRatingHandler
 * - DELETE /admin/vendors/{vendorId}             -> deleteVendorHandler
 */
export async function handler(
  event: APIGatewayProxyEvent
): Promise<APIGatewayProxyResult> {
  const method = event.httpMethod;
  const path = event.path;
  const vendorId = event.pathParameters?.['vendorId'];
  const modelId = event.pathParameters?.['modelId'];

  logger.info('Vendor handler request', { method, path, vendorId });

  // Route based on method and path
  if (method === 'GET') {
    if (path.match(/\/admin\/vendors\/[^/]+\/model-prices\/?$/)) {
      return listVendorModelPricesHandler(event);
    }
    // Static sub-resource paths must be checked before the generic {vendorId} pattern
    if (path.match(/\/admin\/vendors\/search\/?$/)) {
      return searchVendorsHandler(event);
    }
    if (path.match(/\/admin\/vendors\/purchasing\/?$/)) {
      return getVendorsForPurchasingHandler(event);
    }
    if (path.match(/\/admin\/vendors\/type\/[^/]+\/?$/)) {
      return getVendorsByTypeHandler(event);
    }
    if (path.match(/\/admin\/vendors\/rating\/[^/]+\/?$/)) {
      return getVendorsByRatingHandler(event);
    }
    if (vendorId) {
      return getVendorHandler(event);
    }
    // Base path: list all vendors
    if (path.match(/\/admin\/vendors\/?$/)) {
      return listVendorsHandler(event);
    }
  }

  if (method === 'POST') {
    if (path.match(/\/admin\/vendors\/?$/)) {
      return createVendorHandler(event);
    }
  }

  if (method === 'PUT') {
    if (vendorId && modelId && path.match(/\/admin\/vendors\/[^/]+\/model-prices\/[^/]+\/?$/)) {
      return upsertVendorModelPriceHandler(event);
    }
    if (vendorId && path.match(/\/admin\/vendors\/[^/]+\/rating\/?$/)) {
      return updateVendorRatingHandler(event);
    }
    if (vendorId) {
      return updateVendorHandler(event);
    }
  }

  if (method === 'DELETE') {
    if (vendorId && modelId && path.match(/\/admin\/vendors\/[^/]+\/model-prices\/[^/]+\/?$/)) {
      return deactivateVendorModelPriceHandler(event);
    }
    if (vendorId) {
      return deleteVendorHandler(event);
    }
  }

  return createLambdaResponse(
    405,
    createErrorResponse(
      API_ERROR_CODES.BAD_REQUEST,
      `Method ${method} not allowed for ${path}`,
      event.requestContext.requestId
    )
  );
}

export default handler;
