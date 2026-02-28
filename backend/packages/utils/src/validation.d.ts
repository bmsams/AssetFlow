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
export declare function validResult(): ValidationResult;
/**
 * Create a failed validation result
 */
export declare function invalidResult(errors: readonly ValidationError[]): ValidationResult;
/**
 * Create a validation error
 */
export declare function createValidationError(field: string, message: string, code: string): ValidationError;
/**
 * Validate required field
 */
export declare function validateRequired(value: unknown, fieldName: string): ValidationError | null;
/**
 * Validate string length
 */
export declare function validateStringLength(value: string | undefined, fieldName: string, minLength?: number, maxLength?: number): ValidationError | null;
/**
 * Validate email format
 */
export declare function validateEmail(value: string | undefined, fieldName: string): ValidationError | null;
/**
 * Validate UUID format
 */
export declare function validateUUID(value: string | undefined, fieldName: string): ValidationError | null;
/**
 * Validate number range
 */
export declare function validateNumberRange(value: number | undefined, fieldName: string, min?: number, max?: number): ValidationError | null;
/**
 * Validate enum value
 */
export declare function validateEnum<T extends string>(value: string | undefined, fieldName: string, allowedValues: readonly T[]): ValidationError | null;
/**
 * Validate ISO date string
 */
export declare function validateISODate(value: string | undefined, fieldName: string): ValidationError | null;
/**
 * Combine multiple validation errors
 */
export declare function combineValidationResults(...results: (ValidationError | null)[]): ValidationResult;
/**
 * Validator builder for fluent validation
 */
export declare class Validator {
    private errors;
    required(value: unknown, fieldName: string): this;
    stringLength(value: string | undefined, fieldName: string, minLength?: number, maxLength?: number): this;
    email(value: string | undefined, fieldName: string): this;
    uuid(value: string | undefined, fieldName: string): this;
    numberRange(value: number | undefined, fieldName: string, min?: number, max?: number): this;
    enum<T extends string>(value: string | undefined, fieldName: string, allowedValues: readonly T[]): this;
    isoDate(value: string | undefined, fieldName: string): this;
    custom(error: ValidationError | null): this;
    result(): ValidationResult;
}
/**
 * Create a new validator instance
 */
export declare function validate(): Validator;
