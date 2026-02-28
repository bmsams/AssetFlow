/**
 * Get Contracts by Vendor Lambda Handler
 *
 * Retrieves contracts for a specific vendor with optional filtering.
 * Requirement 6A.1: Store contracts with vendor
 * Requirement 6A.2: Support contract types: Purchase, Lease, Maintenance, Support, License, Warranty
 */

import type { APIGatewayProxyEvent, APIGatewayProxyResult } from 'aws-lambda';

import { API_ERROR_CODES, createApiResponse, createErrorResponse, createLambdaResponse, HTTP_STATUS } from '@ams/types';
import { createLogger, validateUUID } from '@ams/utils';

import type { ContractStatus, ContractType } from '../contract/contract-service';
import * as contractService from '../contract/contract-service';

const logger = createLogger({ service: 'get-contracts-by-vendor-handler' });

/**
 * Valid contract types
 */
const VALID_CONTRACT_TYPES: ContractType[] = [
  'PURCHASE',
  'LEASE',
  'MAINTENANCE',
  'SUPPORT',
  'LICENSE',
  'WARRANTY',
];

/**
 * Valid contract statuses
 */
const VALID_CONTRACT_STATUSES: ContractStatus[] = [
  'DRAFT',
  'PENDING_APPROVAL',
  'ACTIVE',
  'EXPIRED',
  'TERMINATED',
  'RENEWED',
];

/**
 * Lambda handler for getting contracts by vendor
 */
export async function handler(
  event: APIGatewayProxyEvent
): Promise<APIGatewayProxyResult> {
  const requestId = event.requestContext.requestId;
  const userId = event.requestContext.authorizer?.['claims']?.['sub'] as string | undefined;

  logger.info('Get contracts by vendor received', { requestId });

  try {
    // Validate user ID
    if (!userId) {
      return createLambdaResponse(
        HTTP_STATUS.UNAUTHORIZED,
        createErrorResponse(API_ERROR_CODES.UNAUTHORIZED, 'User authentication required', requestId)
      );
    }

    // Get vendor ID from path parameters or query string
    const vendorId = event.pathParameters?.['vendorId'] || event.queryStringParameters?.['vendorId'];

    // If no vendorId, delegate to list all contracts
    if (!vendorId) {
      return listContractsHandler(event);
    }

    // Validate vendor ID is a valid UUID
    const uuidError = validateUUID(vendorId, 'vendorId');
    if (uuidError) {
      return createLambdaResponse(
        HTTP_STATUS.BAD_REQUEST,
        createErrorResponse(API_ERROR_CODES.BAD_REQUEST, uuidError.message, requestId)
      );
    }

    // Parse query parameters
    const queryParams = event.queryStringParameters ?? {};
    const page = queryParams['page'] ? parseInt(queryParams['page'], 10) : 1;
    const limit = queryParams['limit'] ? parseInt(queryParams['limit'], 10) : 50;

    // Validate pagination parameters
    if (isNaN(page) || page < 1) {
      return createLambdaResponse(
        HTTP_STATUS.BAD_REQUEST,
        createErrorResponse(API_ERROR_CODES.BAD_REQUEST, 'page must be a positive integer', requestId)
      );
    }

    if (isNaN(limit) || limit < 1 || limit > 100) {
      return createLambdaResponse(
        HTTP_STATUS.BAD_REQUEST,
        createErrorResponse(API_ERROR_CODES.BAD_REQUEST, 'limit must be between 1 and 100', requestId)
      );
    }

    // Parse status filter
    let statusFilter: ContractStatus[] | undefined;
    if (queryParams['status']) {
      const statuses = queryParams['status'].split(',');
      // Validate each status
      for (const status of statuses) {
        if (!VALID_CONTRACT_STATUSES.includes(status as ContractStatus)) {
          return createLambdaResponse(
            HTTP_STATUS.BAD_REQUEST,
            createErrorResponse(
              API_ERROR_CODES.BAD_REQUEST,
              `Invalid status: ${status}. Must be one of: ${VALID_CONTRACT_STATUSES.join(', ')}`,
              requestId
            )
          );
        }
      }
      statusFilter = statuses as ContractStatus[];
    }

    // Parse type filter
    let typeFilter: ContractType[] | undefined;
    if (queryParams['type']) {
      const types = queryParams['type'].split(',');
      // Validate each type
      for (const type of types) {
        if (!VALID_CONTRACT_TYPES.includes(type as ContractType)) {
          return createLambdaResponse(
            HTTP_STATUS.BAD_REQUEST,
            createErrorResponse(
              API_ERROR_CODES.BAD_REQUEST,
              `Invalid type: ${type}. Must be one of: ${VALID_CONTRACT_TYPES.join(', ')}`,
              requestId
            )
          );
        }
      }
      typeFilter = types as ContractType[];
    }

    // Get contracts for the vendor
    const result = await contractService.getContractsByVendor(
      vendorId,
      { page, limit },
      statusFilter,
      typeFilter
    );

    logger.info('Contracts retrieved', {
      vendorId,
      total: result.total,
      page: result.page,
      limit: result.limit,
    });

    return createLambdaResponse(
      HTTP_STATUS.OK,
      createApiResponse(result, requestId)
    );
  } catch (error) {
    const err = error as Error;
    logger.error('Failed to get contracts by vendor', err, { requestId });

    return createLambdaResponse(
      HTTP_STATUS.INTERNAL_SERVER_ERROR,
      createErrorResponse(API_ERROR_CODES.INTERNAL_ERROR, 'Failed to get contracts', requestId)
    );
  }
}

/**
 * Lambda handler for getting a single contract by ID
 */
export async function getContractHandler(
  event: APIGatewayProxyEvent
): Promise<APIGatewayProxyResult> {
  const requestId = event.requestContext.requestId;
  const userId = event.requestContext.authorizer?.['claims']?.['sub'] as string | undefined;

  logger.info('Get contract received', { requestId });

  try {
    // Validate user ID
    if (!userId) {
      return createLambdaResponse(
        HTTP_STATUS.UNAUTHORIZED,
        createErrorResponse(API_ERROR_CODES.UNAUTHORIZED, 'User authentication required', requestId)
      );
    }

    // Get contract ID from path parameters
    const contractId = event.pathParameters?.['contractId'];
    if (!contractId) {
      return createLambdaResponse(
        HTTP_STATUS.BAD_REQUEST,
        createErrorResponse(API_ERROR_CODES.BAD_REQUEST, 'contractId is required', requestId)
      );
    }

    // Validate contract ID is a valid UUID
    const uuidError = validateUUID(contractId, 'contractId');
    if (uuidError) {
      return createLambdaResponse(
        HTTP_STATUS.BAD_REQUEST,
        createErrorResponse(API_ERROR_CODES.BAD_REQUEST, uuidError.message, requestId)
      );
    }

    // Check if we should include linked assets and entitlements
    const includeLinks = event.queryStringParameters?.['includeLinks'] === 'true';

    let result;
    if (includeLinks) {
      result = await contractService.getContractWithLinks(contractId);
    } else {
      const contract = await contractService.getContract(contractId);
      result = contract ? { contract } : null;
    }

    if (!result) {
      return createLambdaResponse(
        HTTP_STATUS.NOT_FOUND,
        createErrorResponse(API_ERROR_CODES.NOT_FOUND, `Contract not found: ${contractId}`, requestId)
      );
    }

    logger.info('Contract retrieved', {
      contractId,
      contractNumber: result.contract.contractNumber,
    });

    return createLambdaResponse(
      HTTP_STATUS.OK,
      createApiResponse(result, requestId)
    );
  } catch (error) {
    const err = error as Error;
    logger.error('Failed to get contract', err, { requestId });

    return createLambdaResponse(
      HTTP_STATUS.INTERNAL_SERVER_ERROR,
      createErrorResponse(API_ERROR_CODES.INTERNAL_ERROR, 'Failed to get contract', requestId)
    );
  }
}

/**
 * Lambda handler for listing all contracts with optional filters
 */
export async function listContractsHandler(
  event: APIGatewayProxyEvent
): Promise<APIGatewayProxyResult> {
  const requestId = event.requestContext.requestId;
  const userId = event.requestContext.authorizer?.['claims']?.['sub'] as string | undefined;

  logger.info('List contracts received', { requestId });

  try {
    // Validate user ID
    if (!userId) {
      return createLambdaResponse(
        HTTP_STATUS.UNAUTHORIZED,
        createErrorResponse(API_ERROR_CODES.UNAUTHORIZED, 'User authentication required', requestId)
      );
    }

    // Parse query parameters
    const queryParams = event.queryStringParameters ?? {};
    const page = queryParams['page'] ? parseInt(queryParams['page'], 10) : 1;
    const limit = queryParams['limit'] ? parseInt(queryParams['limit'], 10) : 50;

    // Validate pagination parameters
    if (isNaN(page) || page < 1) {
      return createLambdaResponse(
        HTTP_STATUS.BAD_REQUEST,
        createErrorResponse(API_ERROR_CODES.BAD_REQUEST, 'page must be a positive integer', requestId)
      );
    }

    if (isNaN(limit) || limit < 1 || limit > 100) {
      return createLambdaResponse(
        HTTP_STATUS.BAD_REQUEST,
        createErrorResponse(API_ERROR_CODES.BAD_REQUEST, 'limit must be between 1 and 100', requestId)
      );
    }

    // Parse status filter
    let statusFilter: ContractStatus[] | undefined;
    if (queryParams['status']) {
      const statuses = queryParams['status'].split(',');
      for (const status of statuses) {
        if (!VALID_CONTRACT_STATUSES.includes(status as ContractStatus)) {
          return createLambdaResponse(
            HTTP_STATUS.BAD_REQUEST,
            createErrorResponse(
              API_ERROR_CODES.BAD_REQUEST,
              `Invalid status: ${status}. Must be one of: ${VALID_CONTRACT_STATUSES.join(', ')}`,
              requestId
            )
          );
        }
      }
      statusFilter = statuses as ContractStatus[];
    }

    // Parse type filter
    let typeFilter: ContractType[] | undefined;
    if (queryParams['type']) {
      const types = queryParams['type'].split(',');
      for (const type of types) {
        if (!VALID_CONTRACT_TYPES.includes(type as ContractType)) {
          return createLambdaResponse(
            HTTP_STATUS.BAD_REQUEST,
            createErrorResponse(
              API_ERROR_CODES.BAD_REQUEST,
              `Invalid type: ${type}. Must be one of: ${VALID_CONTRACT_TYPES.join(', ')}`,
              requestId
            )
          );
        }
      }
      typeFilter = types as ContractType[];
    }

    // Get contracts
    const result = await contractService.getContracts(
      { page, limit },
      statusFilter,
      typeFilter
    );

    logger.info('Contracts listed', {
      total: result.total,
      page: result.page,
      limit: result.limit,
    });

    return createLambdaResponse(
      HTTP_STATUS.OK,
      createApiResponse(result, requestId)
    );
  } catch (error) {
    const err = error as Error;
    logger.error('Failed to list contracts', err, { requestId });

    return createLambdaResponse(
      HTTP_STATUS.INTERNAL_SERVER_ERROR,
      createErrorResponse(API_ERROR_CODES.INTERNAL_ERROR, 'Failed to list contracts', requestId)
    );
  }
}
