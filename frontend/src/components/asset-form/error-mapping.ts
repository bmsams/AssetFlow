import { ApiError } from '../../services/api-client';

/**
 * Known form field names that can receive API validation errors
 */
const KNOWN_FIELDS = new Set([
  'assetType', 'displayName', 'description', 'status',
  'serialNumber', 'manufacturer', 'model', 'modelCategory',
  'assignedTo', 'departmentId', 'costCenterId',
  'purchasePrice', 'warrantyExpiration',
  'cpu', 'memoryGb', 'storageGb', 'operatingSystem',
  'ipAddress', 'macAddress',
  'publisher', 'productName', 'version', 'edition', 'licenseType', 'isSaas',
  'assetClass', 'criticalityLevel', 'facilityId', 'operatingHours', 'meterReading',
]);

/**
 * Result of parsing an API error for form display
 */
export interface FormErrorResult {
  /** Field-level errors mapped by field name */
  fieldErrors: Record<string, string>;
  /** General error message (not tied to a specific field) */
  generalError: string | null;
}

/**
 * Attempt to extract a field name from an error message.
 * Matches patterns like "displayName is required" or "Invalid value for serialNumber".
 */
function extractFieldFromMessage(message: string): string | null {
  for (const field of KNOWN_FIELDS) {
    const lower = message.toLowerCase();
    const fieldLower = field.toLowerCase();
    if (lower.includes(fieldLower)) {
      return field;
    }
  }
  return null;
}

/**
 * Parse an API error into field-level and general form errors.
 *
 * Handles:
 * - ApiError with a code like VALIDATION_ERROR and field info in the message
 * - ApiError with a generic message (shown as general error)
 * - Plain Error objects (shown as general error)
 */
export function parseApiErrorToFieldErrors(error: unknown): FormErrorResult {
  const result: FormErrorResult = { fieldErrors: {}, generalError: null };

  if (!(error instanceof Error)) {
    result.generalError = 'An unexpected error occurred';
    return result;
  }

  const message = error.message;

  if (error instanceof ApiError) {
    const isValidationError =
      error.code === 'VALIDATION_ERROR' ||
      error.code === 'INVALID_INPUT' ||
      error.statusCode === 422 ||
      (error.statusCode === 400 && error.code !== 'NETWORK_ERROR');

    if (isValidationError) {
      // Try to map the error message to a specific field
      const field = extractFieldFromMessage(message);
      if (field) {
        result.fieldErrors[field] = message;
      } else {
        result.generalError = message;
      }
      return result;
    }
  }

  // Fallback: show as general error
  result.generalError = message || 'An unexpected error occurred';
  return result;
}
