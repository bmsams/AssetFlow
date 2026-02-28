/**
 * Validation utilities
 */

import type { ValidationError } from '@ams/types';

/**
 * Validation result
 */
export interface ValidationResult {
  readonly isValid: boolean;
  readonly errors: readonly ValidationError[];
}

/**
 * Create a successful validation result
 */
export function validResult(): ValidationResult {
  return { isValid: true, errors: [] };
}

/**
 * Create a failed validation result
 */
export function invalidResult(errors: readonly ValidationError[]): ValidationResult {
  return { isValid: false, errors };
}

/**
 * Create a validation error
 */
export function createValidationError(
  field: string,
  message: string,
  code: string
): ValidationError {
  return { field, message, code };
}

/**
 * Validate required field
 */
export function validateRequired(
  value: unknown,
  fieldName: string
): ValidationError | null {
  if (value === undefined || value === null || value === '') {
    return createValidationError(
      fieldName,
      `${fieldName} is required`,
      'REQUIRED'
    );
  }
  return null;
}

/**
 * Validate string length
 */
export function validateStringLength(
  value: string | undefined,
  fieldName: string,
  minLength?: number,
  maxLength?: number
): ValidationError | null {
  if (value === undefined) {
    return null;
  }

  if (minLength !== undefined && value.length < minLength) {
    return createValidationError(
      fieldName,
      `${fieldName} must be at least ${minLength} characters`,
      'MIN_LENGTH'
    );
  }

  if (maxLength !== undefined && value.length > maxLength) {
    return createValidationError(
      fieldName,
      `${fieldName} must be at most ${maxLength} characters`,
      'MAX_LENGTH'
    );
  }

  return null;
}

/**
 * Validate email format
 */
export function validateEmail(
  value: string | undefined,
  fieldName: string
): ValidationError | null {
  if (value === undefined) {
    return null;
  }

  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!emailRegex.test(value)) {
    return createValidationError(
      fieldName,
      `${fieldName} must be a valid email address`,
      'INVALID_EMAIL'
    );
  }

  return null;
}

/**
 * Validate UUID format
 */
export function validateUUID(
  value: string | undefined,
  fieldName: string
): ValidationError | null {
  if (value === undefined) {
    return null;
  }

  const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
  if (!uuidRegex.test(value)) {
    return createValidationError(
      fieldName,
      `${fieldName} must be a valid UUID`,
      'INVALID_UUID'
    );
  }

  return null;
}

/**
 * Validate number range
 */
export function validateNumberRange(
  value: number | undefined,
  fieldName: string,
  min?: number,
  max?: number
): ValidationError | null {
  if (value === undefined) {
    return null;
  }

  if (min !== undefined && value < min) {
    return createValidationError(
      fieldName,
      `${fieldName} must be at least ${min}`,
      'MIN_VALUE'
    );
  }

  if (max !== undefined && value > max) {
    return createValidationError(
      fieldName,
      `${fieldName} must be at most ${max}`,
      'MAX_VALUE'
    );
  }

  return null;
}

/**
 * Validate enum value
 */
export function validateEnum<T extends string>(
  value: string | undefined,
  fieldName: string,
  allowedValues: readonly T[]
): ValidationError | null {
  if (value === undefined) {
    return null;
  }

  if (!allowedValues.includes(value as T)) {
    return createValidationError(
      fieldName,
      `${fieldName} must be one of: ${allowedValues.join(', ')}`,
      'INVALID_ENUM'
    );
  }

  return null;
}

/**
 * Validate ISO date string
 */
export function validateISODate(
  value: string | undefined,
  fieldName: string
): ValidationError | null {
  if (value === undefined) {
    return null;
  }

  const date = new Date(value);
  if (isNaN(date.getTime())) {
    return createValidationError(
      fieldName,
      `${fieldName} must be a valid ISO date string`,
      'INVALID_DATE'
    );
  }

  return null;
}

/**
 * Combine multiple validation errors
 */
export function combineValidationResults(
  ...results: (ValidationError | null)[]
): ValidationResult {
  const errors = results.filter((e): e is ValidationError => e !== null);
  return errors.length === 0 ? validResult() : invalidResult(errors);
}

/**
 * Validator builder for fluent validation
 */
export class Validator {
  private errors: ValidationError[] = [];

  required(value: unknown, fieldName: string): this {
    const error = validateRequired(value, fieldName);
    if (error) {
      this.errors.push(error);
    }
    return this;
  }

  stringLength(
    value: string | undefined,
    fieldName: string,
    minLength?: number,
    maxLength?: number
  ): this {
    const error = validateStringLength(value, fieldName, minLength, maxLength);
    if (error) {
      this.errors.push(error);
    }
    return this;
  }

  email(value: string | undefined, fieldName: string): this {
    const error = validateEmail(value, fieldName);
    if (error) {
      this.errors.push(error);
    }
    return this;
  }

  uuid(value: string | undefined, fieldName: string): this {
    const error = validateUUID(value, fieldName);
    if (error) {
      this.errors.push(error);
    }
    return this;
  }

  numberRange(
    value: number | undefined,
    fieldName: string,
    min?: number,
    max?: number
  ): this {
    const error = validateNumberRange(value, fieldName, min, max);
    if (error) {
      this.errors.push(error);
    }
    return this;
  }

  enum<T extends string>(
    value: string | undefined,
    fieldName: string,
    allowedValues: readonly T[]
  ): this {
    const error = validateEnum(value, fieldName, allowedValues);
    if (error) {
      this.errors.push(error);
    }
    return this;
  }

  isoDate(value: string | undefined, fieldName: string): this {
    const error = validateISODate(value, fieldName);
    if (error) {
      this.errors.push(error);
    }
    return this;
  }

  custom(error: ValidationError | null): this {
    if (error) {
      this.errors.push(error);
    }
    return this;
  }

  result(): ValidationResult {
    return this.errors.length === 0
      ? validResult()
      : invalidResult([...this.errors]);
  }
}

/**
 * Create a new validator instance
 */
export function validate(): Validator {
  return new Validator();
}
