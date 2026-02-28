/**
 * Process ASN (Advance Ship Notice) Lambda Handler
 *
 * Handles processing of Advance Ship Notices from vendors like CDW and Insight.
 * Pre-creates asset records with serial numbers before physical arrival.
 *
 * Requirement 7.5: Receive Advance Ship Notices from resellers like CDW and Insight
 * Requirement 7.6: Pre-create asset records with serial numbers before physical arrival
 */

import type { APIGatewayProxyEvent, APIGatewayProxyResult } from 'aws-lambda';

import {
  API_ERROR_CODES,
  createApiResponse,
  createErrorResponse,
  createLambdaResponse,
  HTTP_STATUS,
} from '@ams/types';
import { createLogger } from '@ams/utils';

import type { CDWASNPayload, InsightASNPayload, VendorType } from '../vendor/vendor-types';
import * as vendorService from '../vendor/vendor-service';

const logger = createLogger({ service: 'process-asn-handler' });

/**
 * Supported vendor types for ASN processing
 */
const SUPPORTED_VENDORS: VendorType[] = ['CDW', 'INSIGHT'];

/**
 * Validate CDW ASN payload structure
 */
function validateCDWPayload(
  body: unknown
): { valid: true; payload: CDWASNPayload } | { valid: false; errors: string[] } {
  const errors: string[] = [];

  if (!body || typeof body !== 'object') {
    return { valid: false, errors: ['Request body must be a JSON object'] };
  }

  const payload = body as Record<string, unknown>;

  // Validate required fields
  if (!payload['asnNumber'] || typeof payload['asnNumber'] !== 'string') {
    errors.push('asnNumber is required and must be a string');
  }

  if (!payload['poNumber'] || typeof payload['poNumber'] !== 'string') {
    errors.push('poNumber is required and must be a string');
  }

  if (!payload['shipDate'] || typeof payload['shipDate'] !== 'string') {
    errors.push('shipDate is required and must be a string');
  }

  if (!payload['estimatedDeliveryDate'] || typeof payload['estimatedDeliveryDate'] !== 'string') {
    errors.push('estimatedDeliveryDate is required and must be a string');
  }

  // Validate items array
  if (!Array.isArray(payload['items'])) {
    errors.push('items must be an array');
  } else {
    const items = payload['items'] as Record<string, unknown>[];
    for (let i = 0; i < items.length; i++) {
      const item = items[i]!;
      if (item['lineNumber'] === undefined || typeof item['lineNumber'] !== 'number') {
        errors.push(`items[${i}].lineNumber is required and must be a number`);
      }
      if (!item['cdwPartNumber'] || typeof item['cdwPartNumber'] !== 'string') {
        errors.push(`items[${i}].cdwPartNumber is required and must be a string`);
      }
      if (!item['description'] || typeof item['description'] !== 'string') {
        errors.push(`items[${i}].description is required and must be a string`);
      }
      if (item['quantity'] === undefined || typeof item['quantity'] !== 'number') {
        errors.push(`items[${i}].quantity is required and must be a number`);
      }
    }
  }

  if (errors.length > 0) {
    return { valid: false, errors };
  }

  return { valid: true, payload: payload as unknown as CDWASNPayload };
}

/**
 * Validate Insight ASN payload structure
 */
function validateInsightPayload(
  body: unknown
): { valid: true; payload: InsightASNPayload } | { valid: false; errors: string[] } {
  const errors: string[] = [];

  if (!body || typeof body !== 'object') {
    return { valid: false, errors: ['Request body must be a JSON object'] };
  }

  const payload = body as Record<string, unknown>;

  // Validate required fields
  if (!payload['shipmentId'] || typeof payload['shipmentId'] !== 'string') {
    errors.push('shipmentId is required and must be a string');
  }

  if (!payload['purchaseOrderNumber'] || typeof payload['purchaseOrderNumber'] !== 'string') {
    errors.push('purchaseOrderNumber is required and must be a string');
  }

  if (!payload['shipmentDate'] || typeof payload['shipmentDate'] !== 'string') {
    errors.push('shipmentDate is required and must be a string');
  }

  if (!payload['expectedArrival'] || typeof payload['expectedArrival'] !== 'string') {
    errors.push('expectedArrival is required and must be a string');
  }

  // Validate lineItems array
  if (!Array.isArray(payload['lineItems'])) {
    errors.push('lineItems must be an array');
  } else {
    const items = payload['lineItems'] as Record<string, unknown>[];
    for (let i = 0; i < items.length; i++) {
      const item = items[i]!;
      if (item['lineNum'] === undefined || typeof item['lineNum'] !== 'number') {
        errors.push(`lineItems[${i}].lineNum is required and must be a number`);
      }
      if (!item['insightPartNumber'] || typeof item['insightPartNumber'] !== 'string') {
        errors.push(`lineItems[${i}].insightPartNumber is required and must be a string`);
      }
      if (!item['itemDescription'] || typeof item['itemDescription'] !== 'string') {
        errors.push(`lineItems[${i}].itemDescription is required and must be a string`);
      }
      if (item['qty'] === undefined || typeof item['qty'] !== 'number') {
        errors.push(`lineItems[${i}].qty is required and must be a number`);
      }
    }
  }

  if (errors.length > 0) {
    return { valid: false, errors };
  }

  return { valid: true, payload: payload as unknown as InsightASNPayload };
}

/**
 * Lambda handler for processing Advance Ship Notices
 */
export async function handler(
  event: APIGatewayProxyEvent
): Promise<APIGatewayProxyResult> {
  const requestId = event.requestContext.requestId;

  logger.info('ASN processing request received', { requestId });

  try {
    // Get vendor type from path parameter
    const vendorType = event.pathParameters?.['vendorType']?.toUpperCase() as VendorType | undefined;

    if (!vendorType || !SUPPORTED_VENDORS.includes(vendorType)) {
      return createLambdaResponse(
        HTTP_STATUS.BAD_REQUEST,
        createErrorResponse(
          API_ERROR_CODES.BAD_REQUEST,
          `Invalid vendor type. Supported vendors: ${SUPPORTED_VENDORS.join(', ')}`,
          requestId
        )
      );
    }

    // Parse request body
    if (!event.body) {
      return createLambdaResponse(
        HTTP_STATUS.BAD_REQUEST,
        createErrorResponse(API_ERROR_CODES.BAD_REQUEST, 'Request body is required', requestId)
      );
    }

    let body: unknown;
    try {
      body = JSON.parse(event.body);
    } catch {
      return createLambdaResponse(
        HTTP_STATUS.BAD_REQUEST,
        createErrorResponse(API_ERROR_CODES.BAD_REQUEST, 'Invalid JSON in request body', requestId)
      );
    }

    // Validate and process based on vendor type
    let result;

    if (vendorType === 'CDW') {
      const validationResult = validateCDWPayload(body);
      if (!validationResult.valid) {
        return createLambdaResponse(
          HTTP_STATUS.BAD_REQUEST,
          createErrorResponse(
            API_ERROR_CODES.VALIDATION_ERROR,
            'Validation failed',
            requestId,
            validationResult.errors.map((msg) => ({ field: '', message: msg, code: 'VALIDATION_ERROR' }))
          )
        );
      }
      result = await vendorService.processCDWASN(validationResult.payload);
    } else if (vendorType === 'INSIGHT') {
      const validationResult = validateInsightPayload(body);
      if (!validationResult.valid) {
        return createLambdaResponse(
          HTTP_STATUS.BAD_REQUEST,
          createErrorResponse(
            API_ERROR_CODES.VALIDATION_ERROR,
            'Validation failed',
            requestId,
            validationResult.errors.map((msg) => ({ field: '', message: msg, code: 'VALIDATION_ERROR' }))
          )
        );
      }
      result = await vendorService.processInsightASN(validationResult.payload);
    } else {
      return createLambdaResponse(
        HTTP_STATUS.BAD_REQUEST,
        createErrorResponse(
          API_ERROR_CODES.BAD_REQUEST,
          `Vendor type ${vendorType} is not yet supported`,
          requestId
        )
      );
    }

    logger.info('ASN processing completed', {
      requestId,
      vendorType,
      asnId: result.asnId,
      status: result.status,
      assetsCreated: result.assetsCreated,
      assetsLinked: result.assetsLinked,
      itemsFailed: result.itemsFailed,
      processingTimeMs: result.processingTimeMs,
    });

    return createLambdaResponse(HTTP_STATUS.OK, createApiResponse(result, requestId));
  } catch (error) {
    const err = error as Error;
    logger.error('Failed to process ASN', err, { requestId });

    return createLambdaResponse(
      HTTP_STATUS.INTERNAL_SERVER_ERROR,
      createErrorResponse(API_ERROR_CODES.INTERNAL_ERROR, 'Failed to process ASN', requestId)
    );
  }
}

