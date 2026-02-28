/**
 * Schema Validator
 *
 * JSON Schema validation using ajv library with support for
 * common formats and custom validation rules.
 *
 * Validates: Requirements 8.5
 */
import { type JsonSchema, type SchemaValidatorOptions, type ValidationErrorDetail, type ValidationResult } from './validation-types';
/**
 * Schema validator class using ajv
 */
export declare class SchemaValidator {
    private readonly ajv;
    private readonly options;
    private readonly compiledSchemas;
    constructor(options?: SchemaValidatorOptions);
    /**
     * Validate data against a JSON schema
     */
    validate(data: unknown, schema: JsonSchema, schemaId?: string): ValidationResult;
    /**
     * Validate and return the validated data (with defaults applied)
     */
    validateAndTransform<T>(data: unknown, schema: JsonSchema, schemaId?: string): {
        isValid: true;
        data: T;
    } | {
        isValid: false;
        errors: readonly ValidationErrorDetail[];
    };
    /**
     * Get or compile a schema
     */
    private getOrCompileSchema;
    /**
     * Convert ajv errors to ValidationErrorDetail format
     */
    private convertErrors;
    /**
     * Convert a single ajv error to ValidationErrorDetail
     */
    private convertError;
    /**
     * Extract field name from ajv error
     */
    private extractFieldName;
    /**
     * Map ajv keyword to validation error code
     */
    private mapErrorCode;
    /**
     * Format a human-readable error message
     */
    private formatErrorMessage;
    /**
     * Clear the compiled schema cache
     */
    clearCache(): void;
}
/**
 * Create a schema validator instance with default options
 */
export declare function createSchemaValidator(options?: SchemaValidatorOptions): SchemaValidator;
/**
 * Validate data against a schema (convenience function)
 */
export declare function validateSchema(data: unknown, schema: JsonSchema, options?: SchemaValidatorOptions): ValidationResult;
//# sourceMappingURL=schema-validator.d.ts.map