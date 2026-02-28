/**
 * Validation Types
 * 
 * Defines types for request validation including ValidationError,
 * ValidationResult, and schema definitions.
 * 
 * Validates: Requirements 8.5
 */

import type { ValidationError as BaseValidationError } from '@ams/types';

/**
 * Extended validation error with additional context
 */
export interface ValidationErrorDetail extends BaseValidationError {
  /** JSON path to the invalid field */
  readonly path?: string;
  /** The invalid value (sanitized) */
  readonly value?: unknown;
  /** Expected type or format */
  readonly expected?: string;
  /** Actual type received */
  readonly actual?: string;
}

/**
 * Validation error codes for standardized error responses
 */
export const VALIDATION_ERROR_CODES = {
  REQUIRED: 'REQUIRED',
  INVALID_TYPE: 'INVALID_TYPE',
  INVALID_FORMAT: 'INVALID_FORMAT',
  MIN_LENGTH: 'MIN_LENGTH',
  MAX_LENGTH: 'MAX_LENGTH',
  PATTERN_MISMATCH: 'PATTERN_MISMATCH',
  MIN_VALUE: 'MIN_VALUE',
  MAX_VALUE: 'MAX_VALUE',
  MIN_ITEMS: 'MIN_ITEMS',
  MAX_ITEMS: 'MAX_ITEMS',
  UNIQUE_ITEMS: 'UNIQUE_ITEMS',
  INVALID_ENUM: 'INVALID_ENUM',
  ADDITIONAL_PROPERTIES: 'ADDITIONAL_PROPERTIES',
  INVALID_JSON: 'INVALID_JSON',
  SCHEMA_ERROR: 'SCHEMA_ERROR',
} as const;

export type ValidationErrorCode = (typeof VALIDATION_ERROR_CODES)[keyof typeof VALIDATION_ERROR_CODES];

/**
 * Result of a validation operation
 */
export interface ValidationResult {
  /** Whether the validation passed */
  readonly isValid: boolean;
  /** List of validation errors if validation failed */
  readonly errors: readonly ValidationErrorDetail[];
}

/**
 * JSON Schema type definition
 * Supports JSON Schema draft-07 compatible schemas
 */
export interface JsonSchema {
  readonly type?: string | readonly string[];
  readonly properties?: Record<string, JsonSchema>;
  readonly required?: readonly string[];
  readonly additionalProperties?: boolean | JsonSchema;
  readonly items?: JsonSchema | readonly JsonSchema[];
  readonly minLength?: number;
  readonly maxLength?: number;
  readonly pattern?: string;
  readonly format?: string;
  readonly minimum?: number;
  readonly maximum?: number;
  readonly exclusiveMinimum?: number;
  readonly exclusiveMaximum?: number;
  readonly minItems?: number;
  readonly maxItems?: number;
  readonly uniqueItems?: boolean;
  readonly enum?: readonly unknown[];
  readonly const?: unknown;
  readonly allOf?: readonly JsonSchema[];
  readonly anyOf?: readonly JsonSchema[];
  readonly oneOf?: readonly JsonSchema[];
  readonly not?: JsonSchema;
  readonly $ref?: string;
  readonly $defs?: Record<string, JsonSchema>;
  readonly definitions?: Record<string, JsonSchema>;
  readonly description?: string;
  readonly default?: unknown;
  readonly nullable?: boolean;
}

/**
 * Supported format validators
 */
export const SUPPORTED_FORMATS = [
  'email',
  'uuid',
  'uri',
  'uri-reference',
  'date',
  'date-time',
  'time',
  'hostname',
  'ipv4',
  'ipv6',
  'regex',
] as const;

export type SupportedFormat = (typeof SUPPORTED_FORMATS)[number];

/**
 * Schema validation options
 */
export interface SchemaValidatorOptions {
  /** Whether to allow additional properties not defined in schema */
  readonly allowAdditionalProperties?: boolean;
  /** Whether to coerce types (e.g., string "123" to number 123) */
  readonly coerceTypes?: boolean;
  /** Whether to use default values from schema */
  readonly useDefaults?: boolean;
  /** Whether to remove additional properties */
  readonly removeAdditional?: boolean;
  /** Custom formats to register */
  readonly customFormats?: Record<string, RegExp | ((value: string) => boolean)>;
  /** Maximum number of errors to return */
  readonly maxErrors?: number;
}

/**
 * Request validation target
 */
export type ValidationTarget = 'body' | 'queryStringParameters' | 'pathParameters' | 'headers';

/**
 * Validation schema configuration for an endpoint
 */
export interface EndpointValidationSchema {
  /** Schema for request body */
  readonly body?: JsonSchema;
  /** Schema for query string parameters */
  readonly queryStringParameters?: JsonSchema;
  /** Schema for path parameters */
  readonly pathParameters?: JsonSchema;
  /** Schema for headers */
  readonly headers?: JsonSchema;
}

/**
 * Validation middleware options
 */
export interface ValidationMiddlewareOptions {
  /** Schema validator options */
  readonly validatorOptions?: SchemaValidatorOptions;
  /** Whether to strip unknown properties from body */
  readonly stripUnknown?: boolean;
  /** Custom error message prefix */
  readonly errorMessagePrefix?: string;
}

/**
 * Error thrown when validation fails
 */
export class RequestValidationError extends Error {
  readonly code: string;
  readonly statusCode: number;
  readonly errors: readonly ValidationErrorDetail[];

  constructor(
    message: string,
    errors: readonly ValidationErrorDetail[],
    code: string = 'VALIDATION_ERROR'
  ) {
    super(message);
    this.name = 'RequestValidationError';
    this.code = code;
    this.statusCode = 400;
    this.errors = errors;
  }
}
