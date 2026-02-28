/**
 * Update Contract Lambda Handler
 *
 * Updates an existing contract.
 * Requirement 6A.1: Store contracts with vendor, type, dates, value, and terms
 * Requirement 6A.2: Support contract types: Purchase, Lease, Maintenance, Support, License, Warranty
 */

import type { APIGatewayProxyEvent, APIGatewayProxyResult } from 'aws-lambda';

import { API_ERROR_CODES, createApiResponse, createErrorResponse, createLambdaResponse, HTTP_STATUS } from '@ams/types';
import { createLogger, validateUUID } from '@ams/utils';

import type { ContractStatus, ContractType, RenewalType, UpdateContractInput } from '../contract/contract-service';
import * as contractService from '../contract/contract-service';

const logger = createLogger({ service: 'update-contract-handler' });

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
 * Valid renewal types
 */
const VALID_RENEWAL_TYPES: RenewalType[] = [
  'NONE',
  'MANUAL',
  'AUTO_RENEW',
  'EVERGREEN',
  'NEGOTIATED',
];

/**
 * Validate request body
 */
function validateRequest(body: unknown): { valid: true; data: Omit<UpdateContractInput, 'updatedBy'> } | { valid: false; errors: string[] } {
  if (!body || typeof body !== 'object') {
    return { valid: false, errors: ['Request body is required'] };
  }

  const request = body as Record<string, unknown>;
  const errors: string[] = [];

  // Check that at least one field is being updated
  const updateableFields = [
    'contractName', 'description', 'vendorId', 'contractType',
    'startDate', 'endDate', 'totalValue', 'status',
    'paymentTerms', 'renewalType', 'autoRenewal', 'cancellationNoticeDays',
    'slaTerms', 'currency', 'annualValue', 'remainingValue',
    'documentUrl', 'signedDate', 'effectiveDate',
    'terminationDate', 'terminationReason', 'ownerId', 'notes'
  ];

  const hasUpdates = updateableFields.some(field => request[field] !== undefined);
  if (!hasUpdates) {
    return { valid: false, errors: ['At least one field must be provided for update'] };
  }

  // Validate vendorId (optional UUID)
  if (request['vendorId'] !== undefined && request['vendorId'] !== null) {
    if (typeof request['vendorId'] !== 'string') {
      errors.push('vendorId must be a string');
    } else {
      const uuidError = validateUUID(request['vendorId'] as string, 'vendorId');
      if (uuidError) {
        errors.push(uuidError.message);
      }
    }
  }

  // Validate contractType (optional)
  if (request['contractType'] !== undefined && request['contractType'] !== null) {
    if (typeof request['contractType'] !== 'string') {
      errors.push('contractType must be a string');
    } else if (!VALID_CONTRACT_TYPES.includes(request['contractType'] as ContractType)) {
      errors.push(`contractType must be one of: ${VALID_CONTRACT_TYPES.join(', ')}`);
    }
  }

  // Validate status (optional)
  if (request['status'] !== undefined && request['status'] !== null) {
    if (typeof request['status'] !== 'string') {
      errors.push('status must be a string');
    } else if (!VALID_CONTRACT_STATUSES.includes(request['status'] as ContractStatus)) {
      errors.push(`status must be one of: ${VALID_CONTRACT_STATUSES.join(', ')}`);
    }
  }

  // Validate optional string fields
  const optionalStringFields = [
    'contractName', 'description', 'paymentTerms', 'slaTerms',
    'currency', 'documentUrl', 'terminationReason', 'notes'
  ];
  for (const field of optionalStringFields) {
    if (request[field] !== undefined && request[field] !== null && typeof request[field] !== 'string') {
      errors.push(`${field} must be a string`);
    }
  }

  // Validate optional UUID fields
  const optionalUuidFields = ['ownerId'];
  for (const field of optionalUuidFields) {
    if (request[field] !== undefined && request[field] !== null) {
      if (typeof request[field] !== 'string') {
        errors.push(`${field} must be a string`);
      } else {
        const uuidError = validateUUID(request[field] as string, field);
        if (uuidError) {
          errors.push(uuidError.message);
        }
      }
    }
  }

  // Validate optional date fields
  const optionalDateFields = ['startDate', 'endDate', 'signedDate', 'effectiveDate', 'terminationDate'];
  for (const field of optionalDateFields) {
    if (request[field] !== undefined && request[field] !== null) {
      if (typeof request[field] !== 'string') {
        errors.push(`${field} must be a string`);
      } else {
        const date = new Date(request[field] as string);
        if (isNaN(date.getTime())) {
          errors.push(`${field} must be a valid ISO date string`);
        }
      }
    }
  }

  // Validate optional number fields
  const optionalNumberFields = ['totalValue', 'annualValue', 'remainingValue'];
  for (const field of optionalNumberFields) {
    if (request[field] !== undefined && request[field] !== null) {
      if (typeof request[field] !== 'number') {
        errors.push(`${field} must be a number`);
      } else if (request[field] < 0) {
        errors.push(`${field} cannot be negative`);
      }
    }
  }

  // Validate cancellationNoticeDays (optional number)
  if (request['cancellationNoticeDays'] !== undefined && request['cancellationNoticeDays'] !== null) {
    if (typeof request['cancellationNoticeDays'] !== 'number') {
      errors.push('cancellationNoticeDays must be a number');
    } else if (request['cancellationNoticeDays'] < 0) {
      errors.push('cancellationNoticeDays cannot be negative');
    } else if (!Number.isInteger(request['cancellationNoticeDays'])) {
      errors.push('cancellationNoticeDays must be an integer');
    }
  }

  // Validate renewalType (optional)
  if (request['renewalType'] !== undefined && request['renewalType'] !== null) {
    if (typeof request['renewalType'] !== 'string') {
      errors.push('renewalType must be a string');
    } else if (!VALID_RENEWAL_TYPES.includes(request['renewalType'] as RenewalType)) {
      errors.push(`renewalType must be one of: ${VALID_RENEWAL_TYPES.join(', ')}`);
    }
  }

  // Validate autoRenewal (optional boolean)
  if (request['autoRenewal'] !== undefined && request['autoRenewal'] !== null) {
    if (typeof request['autoRenewal'] !== 'boolean') {
      errors.push('autoRenewal must be a boolean');
    }
  }

  if (errors.length > 0) {
    return { valid: false, errors };
  }

  return {
    valid: true,
    data: {
      contractName: request['contractName'] as string | undefined,
      description: request['description'] as string | undefined,
      vendorId: request['vendorId'] as string | undefined,
      contractType: request['contractType'] as ContractType | undefined,
      startDate: request['startDate'] as string | undefined,
      endDate: request['endDate'] as string | undefined,
      totalValue: request['totalValue'] as number | undefined,
      status: request['status'] as ContractStatus | undefined,
      paymentTerms: request['paymentTerms'] as string | undefined,
      renewalType: request['renewalType'] as RenewalType | undefined,
      autoRenewal: request['autoRenewal'] as boolean | undefined,
      cancellationNoticeDays: request['cancellationNoticeDays'] as number | undefined,
      slaTerms: request['slaTerms'] as string | undefined,
      currency: request['currency'] as string | undefined,
      annualValue: request['annualValue'] as number | undefined,
      remainingValue: request['remainingValue'] as number | undefined,
      documentUrl: request['documentUrl'] as string | undefined,
      signedDate: request['signedDate'] as string | undefined,
      effectiveDate: request['effectiveDate'] as string | undefined,
      terminationDate: request['terminationDate'] as string | undefined,
      terminationReason: request['terminationReason'] as string | undefined,
      ownerId: request['ownerId'] as string | undefined,
      notes: request['notes'] as string | undefined,
    },
  };
}

/**
 * Lambda handler for updating a contract
 */
export async function handler(
  event: APIGatewayProxyEvent
): Promise<APIGatewayProxyResult> {
  const requestId = event.requestContext.requestId;
  const userId = event.requestContext.authorizer?.['claims']?.['sub'] as string | undefined;

  logger.info('Update contract received', { requestId });

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

    // Update the contract
    const updateInput: UpdateContractInput = {
      ...validation.data,
      updatedBy: userId,
    };

    const contract = await contractService.updateContract(contractId, updateInput);

    logger.info('Contract updated', {
      contractId: contract.contractId,
      contractNumber: contract.contractNumber,
      status: contract.status,
    });

    return createLambdaResponse(
      HTTP_STATUS.OK,
      createApiResponse(contract, requestId)
    );
  } catch (error) {
    const err = error as Error;
    logger.error('Failed to update contract', err, { requestId });

    // Handle specific errors
    if (err.message.includes('not found')) {
      return createLambdaResponse(
        HTTP_STATUS.NOT_FOUND,
        createErrorResponse(API_ERROR_CODES.NOT_FOUND, err.message, requestId)
      );
    }

    if (err.message.includes('Invalid status transition')) {
      return createLambdaResponse(
        HTTP_STATUS.BAD_REQUEST,
        createErrorResponse(API_ERROR_CODES.BAD_REQUEST, err.message, requestId)
      );
    }

    if (err.message.includes('is required') || 
        err.message.includes('must be') || 
        err.message.includes('cannot be') ||
        err.message.includes('Invalid')) {
      return createLambdaResponse(
        HTTP_STATUS.BAD_REQUEST,
        createErrorResponse(API_ERROR_CODES.BAD_REQUEST, err.message, requestId)
      );
    }

    return createLambdaResponse(
      HTTP_STATUS.INTERNAL_SERVER_ERROR,
      createErrorResponse(API_ERROR_CODES.INTERNAL_ERROR, 'Failed to update contract', requestId)
    );
  }
}
