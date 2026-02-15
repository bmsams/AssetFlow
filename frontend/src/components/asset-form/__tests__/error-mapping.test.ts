import { ApiError } from '../../../services/api-client';
import { parseApiErrorToFieldErrors } from '../error-mapping';

describe('parseApiErrorToFieldErrors', () => {
  it('maps a validation error mentioning a known field to fieldErrors', () => {
    const error = new ApiError('VALIDATION_ERROR', 'displayName is required', 400);
    const result = parseApiErrorToFieldErrors(error);

    expect(result.fieldErrors).toEqual({ displayName: 'displayName is required' });
    expect(result.generalError).toBeNull();
  });

  it('returns generalError for a validation error with no recognizable field', () => {
    const error = new ApiError('VALIDATION_ERROR', 'Request body is invalid', 400);
    const result = parseApiErrorToFieldErrors(error);

    expect(result.fieldErrors).toEqual({});
    expect(result.generalError).toBe('Request body is invalid');
  });

  it('returns generalError for non-validation API errors', () => {
    const error = new ApiError('NETWORK_ERROR', 'Network error occurred', 0);
    const result = parseApiErrorToFieldErrors(error);

    expect(result.fieldErrors).toEqual({});
    expect(result.generalError).toBe('Network error occurred');
  });

  it('returns generalError for plain Error objects', () => {
    const error = new Error('Something went wrong');
    const result = parseApiErrorToFieldErrors(error);

    expect(result.fieldErrors).toEqual({});
    expect(result.generalError).toBe('Something went wrong');
  });

  it('returns generalError for non-Error values', () => {
    const result = parseApiErrorToFieldErrors('string error');

    expect(result.fieldErrors).toEqual({});
    expect(result.generalError).toBe('An unexpected error occurred');
  });

  it('maps 422 status errors to field errors when field is mentioned', () => {
    const error = new ApiError('INVALID_INPUT', 'serialNumber already exists', 422);
    const result = parseApiErrorToFieldErrors(error);

    expect(result.fieldErrors).toEqual({ serialNumber: 'serialNumber already exists' });
    expect(result.generalError).toBeNull();
  });

  it('maps 400 status errors with field mentions to field errors', () => {
    const error = new ApiError('BAD_REQUEST', 'Invalid ipAddress format', 400);
    const result = parseApiErrorToFieldErrors(error);

    expect(result.fieldErrors).toEqual({ ipAddress: 'Invalid ipAddress format' });
    expect(result.generalError).toBeNull();
  });

  it('treats server errors (500) as general errors even with field mentions', () => {
    const error = new ApiError('INTERNAL_ERROR', 'Failed to save displayName', 500);
    const result = parseApiErrorToFieldErrors(error);

    expect(result.fieldErrors).toEqual({});
    expect(result.generalError).toBe('Failed to save displayName');
  });
});
