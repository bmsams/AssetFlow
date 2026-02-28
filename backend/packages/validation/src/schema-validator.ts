/**
 * Schema Validator
 * 
 * JSON Schema validation using ajv library with support for
 * common formats and custom validation rules.
 * 
 * Validates: Requirements 8.5
 */

import Ajv, { type ErrorObject, type ValidateFunction } from 'ajv';
import addFormats from 'ajv-formats';

import {
  type JsonSchema,
  type SchemaValidatorOptions,
  type ValidationErrorDetail,
  type ValidationResult,
  VALIDATION_ERROR_CODES,
} from './validation-types';

/**
 * Default validator options
 */
const DEFAULT_OPTIONS: SchemaValidatorOptions = {
  allowAdditionalProperties: false,
  coerceTypes: false,
  useDefaults: true,
  removeAdditional: false,
  maxErrors: 10,
};

/**
 * Schema validator class using ajv
 */
export class SchemaValidator {
  private readonly ajv: Ajv;
  private readonly options: SchemaValidatorOptions;
  private readonly compiledSchemas: Map<string, ValidateFunction> = new Map();

  constructor(options: SchemaValidatorOptions = {}) {
    this.options = { ...DEFAULT_OPTIONS, ...options };
    
    this.ajv = new Ajv({
      allErrors: true,
      verbose: true,
      strict: false,
      coerceTypes: this.options.coerceTypes,
      useDefaults: this.options.useDefaults,
      removeAdditional: this.options.removeAdditional,
      messages: true,
    });

    // Add standard formats (email, uuid, date-time, uri, etc.)
    addFormats(this.ajv);

    // Register custom formats if provided
    if (this.options.customFormats) {
      for (const [name, validator] of Object.entries(this.options.customFormats)) {
        this.ajv.addFormat(name, validator);
      }
    }
  }

  /**
   * Validate data against a JSON schema
   */
  validate(data: unknown, schema: JsonSchema, schemaId?: string): ValidationResult {
    const validate = this.getOrCompileSchema(schema, schemaId);
    const valid = validate(data);

    if (valid) {
      return { isValid: true, errors: [] };
    }

    const errors = this.convertErrors(validate.errors ?? []);
    const limitedErrors = this.options.maxErrors 
      ? errors.slice(0, this.options.maxErrors)
      : errors;

    return { isValid: false, errors: limitedErrors };
  }

  /**
   * Validate and return the validated data (with defaults applied)
   */
  validateAndTransform<T>(data: unknown, schema: JsonSchema, schemaId?: string): { isValid: true; data: T } | { isValid: false; errors: readonly ValidationErrorDetail[] } {
    // Clone data to avoid mutating original
    const clonedData = JSON.parse(JSON.stringify(data));
    const validate = this.getOrCompileSchema(schema, schemaId);
    const valid = validate(clonedData);

    if (valid) {
      return { isValid: true, data: clonedData as T };
    }

    const errors = this.convertErrors(validate.errors ?? []);
    const limitedErrors = this.options.maxErrors 
      ? errors.slice(0, this.options.maxErrors)
      : errors;

    return { isValid: false, errors: limitedErrors };
  }

  /**
   * Get or compile a schema
   */
  private getOrCompileSchema(schema: JsonSchema, schemaId?: string): ValidateFunction {
    const cacheKey = schemaId ?? JSON.stringify(schema);
    
    let validate = this.compiledSchemas.get(cacheKey);
    if (!validate) {
      validate = this.ajv.compile(schema);
      this.compiledSchemas.set(cacheKey, validate);
    }
    
    return validate;
  }

  /**
   * Convert ajv errors to ValidationErrorDetail format
   */
  private convertErrors(ajvErrors: ErrorObject[]): ValidationErrorDetail[] {
    return ajvErrors.map((error) => this.convertError(error));
  }

  /**
   * Convert a single ajv error to ValidationErrorDetail
   */
  private convertError(error: ErrorObject): ValidationErrorDetail {
    const field = this.extractFieldName(error);
    const code = this.mapErrorCode(error.keyword);
    const message = this.formatErrorMessage(error, field);

    const detail: ValidationErrorDetail = {
      field,
      message,
      code,
      path: error.instancePath || undefined,
    };

    // Add expected/actual for type errors
    if (error.keyword === 'type' && error.params) {
      return {
        ...detail,
        expected: (error.params as { type?: string }).type,
        actual: typeof error.data,
      };
    }

    // Add expected for enum errors
    if (error.keyword === 'enum' && error.params) {
      return {
        ...detail,
        expected: (error.params as { allowedValues?: unknown[] }).allowedValues?.join(', '),
      };
    }

    return detail;
  }

  /**
   * Extract field name from ajv error
   */
  private extractFieldName(error: ErrorObject): string {
    // For required errors, the missing property is in params
    if (error.keyword === 'required' && error.params) {
      const params = error.params as { missingProperty?: string };
      if (params.missingProperty) {
        const basePath = error.instancePath ? error.instancePath.slice(1).replace(/\//g, '.') : '';
        return basePath ? `${basePath}.${params.missingProperty}` : params.missingProperty;
      }
    }

    // For additionalProperties errors
    if (error.keyword === 'additionalProperties' && error.params) {
      const params = error.params as { additionalProperty?: string };
      if (params.additionalProperty) {
        const basePath = error.instancePath ? error.instancePath.slice(1).replace(/\//g, '.') : '';
        return basePath ? `${basePath}.${params.additionalProperty}` : params.additionalProperty;
      }
    }

    // Convert JSON pointer to dot notation
    if (error.instancePath) {
      return error.instancePath.slice(1).replace(/\//g, '.');
    }

    return 'root';
  }

  /**
   * Map ajv keyword to validation error code
   */
  private mapErrorCode(keyword: string): string {
    const codeMap: Record<string, string> = {
      required: VALIDATION_ERROR_CODES.REQUIRED,
      type: VALIDATION_ERROR_CODES.INVALID_TYPE,
      format: VALIDATION_ERROR_CODES.INVALID_FORMAT,
      minLength: VALIDATION_ERROR_CODES.MIN_LENGTH,
      maxLength: VALIDATION_ERROR_CODES.MAX_LENGTH,
      pattern: VALIDATION_ERROR_CODES.PATTERN_MISMATCH,
      minimum: VALIDATION_ERROR_CODES.MIN_VALUE,
      maximum: VALIDATION_ERROR_CODES.MAX_VALUE,
      exclusiveMinimum: VALIDATION_ERROR_CODES.MIN_VALUE,
      exclusiveMaximum: VALIDATION_ERROR_CODES.MAX_VALUE,
      minItems: VALIDATION_ERROR_CODES.MIN_ITEMS,
      maxItems: VALIDATION_ERROR_CODES.MAX_ITEMS,
      uniqueItems: VALIDATION_ERROR_CODES.UNIQUE_ITEMS,
      enum: VALIDATION_ERROR_CODES.INVALID_ENUM,
      const: VALIDATION_ERROR_CODES.INVALID_ENUM,
      additionalProperties: VALIDATION_ERROR_CODES.ADDITIONAL_PROPERTIES,
    };

    return codeMap[keyword] ?? VALIDATION_ERROR_CODES.SCHEMA_ERROR;
  }

  /**
   * Format a human-readable error message
   */
  private formatErrorMessage(error: ErrorObject, field: string): string {
    const params = error.params as Record<string, unknown>;

    switch (error.keyword) {
      case 'required':
        return `${field} is required`;
      
      case 'type':
        return `${field} must be of type ${params['type']}`;
      
      case 'format':
        return `${field} must be a valid ${params['format']}`;
      
      case 'minLength':
        return `${field} must be at least ${params['limit']} characters`;
      
      case 'maxLength':
        return `${field} must be at most ${params['limit']} characters`;
      
      case 'pattern':
        return `${field} does not match the required pattern`;
      
      case 'minimum':
        return `${field} must be at least ${params['limit']}`;
      
      case 'maximum':
        return `${field} must be at most ${params['limit']}`;
      
      case 'exclusiveMinimum':
        return `${field} must be greater than ${params['limit']}`;
      
      case 'exclusiveMaximum':
        return `${field} must be less than ${params['limit']}`;
      
      case 'minItems':
        return `${field} must have at least ${params['limit']} items`;
      
      case 'maxItems':
        return `${field} must have at most ${params['limit']} items`;
      
      case 'uniqueItems':
        return `${field} must contain unique items`;
      
      case 'enum':
        return `${field} must be one of: ${(params['allowedValues'] as unknown[])?.join(', ')}`;
      
      case 'const':
        return `${field} must be ${JSON.stringify(params['allowedValue'])}`;
      
      case 'additionalProperties':
        return `${field} is not allowed`;
      
      default:
        return error.message ?? `${field} is invalid`;
    }
  }

  /**
   * Clear the compiled schema cache
   */
  clearCache(): void {
    this.compiledSchemas.clear();
  }
}

/**
 * Create a schema validator instance with default options
 */
export function createSchemaValidator(options?: SchemaValidatorOptions): SchemaValidator {
  return new SchemaValidator(options);
}

/**
 * Validate data against a schema (convenience function)
 */
export function validateSchema(
  data: unknown,
  schema: JsonSchema,
  options?: SchemaValidatorOptions
): ValidationResult {
  const validator = new SchemaValidator(options);
  return validator.validate(data, schema);
}
