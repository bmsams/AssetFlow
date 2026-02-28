/**
 * Get Inspection Lambda Handler
 *
 * Retrieves a single inspection record with its receiving line context.
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

import * as receivingService from '../receiving/receiving-service';

const logger = createLogger({ service: 'get-inspection-handler' });

export async function handler(
  event: APIGatewayProxyEvent
): Promise<APIGatewayProxyResult> {
  const requestId = event.requestContext.requestId;
  const userId = event.requestContext.authorizer?.['claims']?.['sub'] as string | undefined;
  const inspectionId = event.pathParameters?.['inspectionId'];

  logger.info('Get inspection request received', { requestId, inspectionId });

  try {
    if (!userId) {
      return createLambdaResponse(
        HTTP_STATUS.UNAUTHORIZED,
        createErrorResponse(API_ERROR_CODES.UNAUTHORIZED, 'User authentication required', requestId)
      );
    }

    if (!inspectionId) {
      return createLambdaResponse(
        HTTP_STATUS.BAD_REQUEST,
        createErrorResponse(API_ERROR_CODES.BAD_REQUEST, 'inspectionId is required', requestId)
      );
    }

    const uuidError = validateUUID(inspectionId, 'inspectionId');
    if (uuidError) {
      return createLambdaResponse(
        HTTP_STATUS.BAD_REQUEST,
        createErrorResponse(API_ERROR_CODES.VALIDATION_ERROR, uuidError.message, requestId)
      );
    }

    const inspectionRecord = await receivingService.getInspectionRecord(inspectionId);
    if (!inspectionRecord) {
      return createLambdaResponse(
        HTTP_STATUS.NOT_FOUND,
        createErrorResponse(API_ERROR_CODES.NOT_FOUND, `Inspection not found: ${inspectionId}`, requestId)
      );
    }

    const receivingLine = await receivingService.getReceivingLine(inspectionRecord.receivingLineId);

    if (!receivingLine) {
      return createLambdaResponse(
        HTTP_STATUS.NOT_FOUND,
        createErrorResponse(
          API_ERROR_CODES.NOT_FOUND,
          `Receiving line not found for inspection: ${inspectionId}`,
          requestId
        )
      );
    }

    return createLambdaResponse(
      HTTP_STATUS.OK,
      createApiResponse(
        {
          inspectionRecord: {
            inspectionId: inspectionRecord.inspectionId,
            receivingLineId: inspectionRecord.receivingLineId,
            assetId: inspectionRecord.assetId ?? undefined,
            serialNumber: inspectionRecord.serialNumber ?? undefined,
            status: inspectionRecord.inspectionStatus,
            result: inspectionRecord.result ?? undefined,
            inspectedBy: inspectionRecord.inspectedBy ?? undefined,
            inspectedByName: inspectionRecord.inspectedByName ?? undefined,
            inspectedAt: inspectionRecord.inspectedDate ?? undefined,
            notes: inspectionRecord.notes ?? undefined,
            failureReason: inspectionRecord.failureReason ?? undefined,
            createdAt: inspectionRecord.createdAt,
            updatedAt: inspectionRecord.updatedAt,
          },
          receivingLine: {
            receivingLineId: receivingLine.lineId,
            receivingId: receivingLine.receivingId,
            poLineId: receivingLine.poLineId ?? undefined,
            productDescription: receivingLine.productName ?? '',
            productType: receivingLine.productType ?? undefined,
            expectedQuantity: receivingLine.quantityExpected,
            receivedQuantity: receivingLine.quantityReceived,
            pendingQuantity: Math.max(0, receivingLine.quantityExpected - receivingLine.quantityReceived),
            inspectionRequired: true,
            notes: receivingLine.notes ?? undefined,
          },
        },
        requestId
      )
    );
  } catch (error) {
    const err = error as Error;
    logger.error('Failed to get inspection', err, { requestId, inspectionId });
    return createLambdaResponse(
      HTTP_STATUS.INTERNAL_SERVER_ERROR,
      createErrorResponse(API_ERROR_CODES.INTERNAL_ERROR, 'Failed to get inspection', requestId)
    );
  }
}
