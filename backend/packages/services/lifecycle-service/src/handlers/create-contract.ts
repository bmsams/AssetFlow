/**
 * Create Contract Lambda Handler
 *
 * Creates a new contract with vendor, type, dates, value, and terms.
 * Requirement 6A.1: Store contracts with vendor, type, dates, value, and terms
 * Requirement 6A.2: Support contract types: Purchase, Lease, Maintenance, Support, License, Warranty
 */

import type { APIGatewayProxyEvent, APIGatewayProxyResult } from 'aws-lambda';

import { API_ERROR_CODES, createApiResponse, createErrorResponse, createLambdaResponse, HTTP_STATUS } from '@ams/types';
import { createLogger, validateUUID } from '@ams/utils';

import type { ContractType, CreateContractInput, RenewalType } from '../contract/contract-service';
import * as contractService from '../contract/contract-service';
import { getUserContext } from '../utils/user-context';

const logger = createLogger({ service: 'create-contract-handler' });

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
function validateRequest(body: unknown): { valid: true; data: Omit<CreateContractInput, 'createdBy'> } | { valid: false; errors: string[] } {
  if (!body || typeof body !== 'object') {
    return { valid: false, errors: ['Request body is required'] };
  }

  const request = body as Record<string, unknown>;
  const errors: string[] = [];

  // Validate vendorId (required)
  if (!request['vendorId']) {
    errors.push('vendorId is required');
  } else if (typeof request['vendorId'] !== 'string') {
    errors.push('vendorId must be a string');
  } else {
    const uuidError = validateUUID(request['vendorId'] as string, 'vendorId');
    if (uuidError) {
      errors.push(uuidError.message);
    }
  }

  // Validate contractType (required)
  if (!request['contractType']) {
    errors.push('contractType is required');
  } else if (typeof request['contractType'] !== 'string') {
    errors.push('contractType must be a string');
  } else if (!VALID_CONTRACT_TYPES.includes(request['contractType'] as ContractType)) {
    errors.push(`contractType must be one of: ${VALID_CONTRACT_TYPES.join(', ')}`);
  }

  // Validate startDate (required)
  if (!request['startDate']) {
    errors.push('startDate is required');
  } else if (typeof request['startDate'] !== 'string') {
    errors.push('startDate must be a string');
  } else {
    const date = new Date(request['startDate'] as string);
    if (isNaN(date.getTime())) {
      errors.push('startDate must be a valid ISO date string');
    }
  }

  // Validate endDate (required)
  if (!request['endDate']) {
    errors.push('endDate is required');
  } else if (typeof request['endDate'] !== 'string') {
    errors.push('endDate must be a string');
  } else {
    const date = new Date(request['endDate'] as string);
    if (isNaN(date.getTime())) {
      errors.push('endDate must be a valid ISO date string');
    }
  }

  // Validate date order
  if (request['startDate'] && request['endDate']) {
    const startDate = new Date(request['startDate'] as string);
    const endDate = new Date(request['endDate'] as string);
    if (!isNaN(startDate.getTime()) && !isNaN(endDate.getTime()) && endDate <= startDate) {
      errors.push('endDate must be after startDate');
    }
  }

  // Validate optional string fields
  const optionalStringFields = [
    'contractName', 'description', 'paymentTerms', 'slaTerms',
    'currency', 'documentUrl', 'notes'
  ];
  for (const field of optionalStringFields) {
    if (request[field] !== undefined && request[field] !== null && typeof request[field] !== 'string') {
      errors.push(`${field} must be a string`);
    }
  }

  // Validate optional UUID fields
  const optionalUuidFields = ['previousContractId', 'parentContractId', 'ownerId'];
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
  const optionalDateFields = ['signedDate', 'effectiveDate'];
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

  // Validate totalValue (optional number)
  if (request['totalValue'] !== undefined && request['totalValue'] !== null) {
    if (typeof request['totalValue'] !== 'number') {
      errors.push('totalValue must be a number');
    } else if (request['totalValue'] < 0) {
      errors.push('totalValue cannot be negative');
    }
  }

  // Validate annualValue (optional number)
  if (request['annualValue'] !== undefined && request['annualValue'] !== null) {
    if (typeof request['annualValue'] !== 'number') {
      errors.push('annualValue must be a number');
    } else if (request['annualValue'] < 0) {
      errors.push('annualValue cannot be negative');
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
      vendorId: request['vendorId'] as string,
      contractType: request['contractType'] as ContractType,
      contractName: request['contractName'] as string | undefined,
      description: request['description'] as string | undefined,
      startDate: request['startDate'] as string,
      endDate: request['endDate'] as string,
      totalValue: request['totalValue'] as number | undefined,
      paymentTerms: request['paymentTerms'] as string | undefined,
      renewalType: request['renewalType'] as RenewalType | undefined,
      autoRenewal: request['autoRenewal'] as boolean | undefined,
      cancellationNoticeDays: request['cancellationNoticeDays'] as number | undefined,
      slaTerms: request['slaTerms'] as string | undefined,
      currency: request['currency'] as string | undefined,
      annualValue: request['annualValue'] as number | undefined,
      documentUrl: request['documentUrl'] as string | undefined,
      signedDate: request['signedDate'] as string | undefined,
      effectiveDate: request['effectiveDate'] as string | undefined,
      previousContractId: request['previousContractId'] as string | undefined,
      parentContractId: request['parentContractId'] as string | undefined,
      ownerId: request['ownerId'] as string | undefined,
      notes: request['notes'] as string | undefined,
    },
  };
}

/**
 * Lambda handler for creating a contract
 */
export async function handler(
  event: APIGatewayProxyEvent
): Promise<APIGatewayProxyResult> {
  const requestId = event.requestContext.requestId;
  const { authSub, userId } = await getUserContext(event);

  logger.info('Create contract received', { requestId });

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

    // Create the contract
    const createInput: CreateContractInput = {
      ...validation.data,
      createdBy: userId,
    };

    const contract = await contractService.createContract(createInput);

    logger.info('Contract created', {
      contractId: contract.contractId,
      contractNumber: contract.contractNumber,
      contractType: contract.contractType,
    });

    return createLambdaResponse(
      HTTP_STATUS.CREATED,
      createApiResponse(contract, requestId)
    );
  } catch (error) {
    const err = error as Error;
    logger.error('Failed to create contract', err, { requestId });

    // Handle specific errors
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
      createErrorResponse(API_ERROR_CODES.INTERNAL_ERROR, 'Failed to create contract', requestId)
    );
  }
}
