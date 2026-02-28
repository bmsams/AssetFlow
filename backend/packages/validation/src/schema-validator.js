"use strict";
/**
 * Schema Validator
 *
 * JSON Schema validation using ajv library with support for
 * common formats and custom validation rules.
 *
 * Validates: Requirements 8.5
 */
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.SchemaValidator = void 0;
exports.createSchemaValidator = createSchemaValidator;
exports.validateSchema = validateSchema;
const ajv_1 = __importDefault(require("ajv"));
const ajv_formats_1 = __importDefault(require("ajv-formats"));
const validation_types_1 = require("./validation-types");
/**
 * Default validator options
 */
const DEFAULT_OPTIONS = {
    allowAdditionalProperties: false,
    coerceTypes: false,
    useDefaults: true,
    removeAdditional: false,
    maxErrors: 10,
};
/**
 * Schema validator class using ajv
 */
class SchemaValidator {
    ajv;
    options;
    compiledSchemas = new Map();
    constructor(options = {}) {
        this.options = { ...DEFAULT_OPTIONS, ...options };
        this.ajv = new ajv_1.default({
            allErrors: true,
            verbose: true,
            strict: false,
            coerceTypes: this.options.coerceTypes,
            useDefaults: this.options.useDefaults,
            removeAdditional: this.options.removeAdditional,
            messages: true,
        });
        // Add standard formats (email, uuid, date-time, uri, etc.)
        (0, ajv_formats_1.default)(this.ajv);
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
    validate(data, schema, schemaId) {
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
    validateAndTransform(data, schema, schemaId) {
        // Clone data to avoid mutating original
        const clonedData = JSON.parse(JSON.stringify(data));
        const validate = this.getOrCompileSchema(schema, schemaId);
        const valid = validate(clonedData);
        if (valid) {
            return { isValid: true, data: clonedData };
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
    getOrCompileSchema(schema, schemaId) {
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
    convertErrors(ajvErrors) {
        return ajvErrors.map((error) => this.convertError(error));
    }
    /**
     * Convert a single ajv error to ValidationErrorDetail
     */
    convertError(error) {
        const field = this.extractFieldName(error);
        const code = this.mapErrorCode(error.keyword);
        const message = this.formatErrorMessage(error, field);
        const detail = {
            field,
            message,
            code,
            path: error.instancePath || undefined,
        };
        // Add expected/actual for type errors
        if (error.keyword === 'type' && error.params) {
            return {
                ...detail,
                expected: error.params.type,
                actual: typeof error.data,
            };
        }
        // Add expected for enum errors
        if (error.keyword === 'enum' && error.params) {
            return {
                ...detail,
                expected: error.params.allowedValues?.join(', '),
            };
        }
        return detail;
    }
    /**
     * Extract field name from ajv error
     */
    extractFieldName(error) {
        // For required errors, the missing property is in params
        if (error.keyword === 'required' && error.params) {
            const params = error.params;
            if (params.missingProperty) {
                const basePath = error.instancePath ? error.instancePath.slice(1).replace(/\//g, '.') : '';
                return basePath ? `${basePath}.${params.missingProperty}` : params.missingProperty;
            }
        }
        // For additionalProperties errors
        if (error.keyword === 'additionalProperties' && error.params) {
            const params = error.params;
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
    mapErrorCode(keyword) {
        const codeMap = {
            required: validation_types_1.VALIDATION_ERROR_CODES.REQUIRED,
            type: validation_types_1.VALIDATION_ERROR_CODES.INVALID_TYPE,
            format: validation_types_1.VALIDATION_ERROR_CODES.INVALID_FORMAT,
            minLength: validation_types_1.VALIDATION_ERROR_CODES.MIN_LENGTH,
            maxLength: validation_types_1.VALIDATION_ERROR_CODES.MAX_LENGTH,
            pattern: validation_types_1.VALIDATION_ERROR_CODES.PATTERN_MISMATCH,
            minimum: validation_types_1.VALIDATION_ERROR_CODES.MIN_VALUE,
            maximum: validation_types_1.VALIDATION_ERROR_CODES.MAX_VALUE,
            exclusiveMinimum: validation_types_1.VALIDATION_ERROR_CODES.MIN_VALUE,
            exclusiveMaximum: validation_types_1.VALIDATION_ERROR_CODES.MAX_VALUE,
            minItems: validation_types_1.VALIDATION_ERROR_CODES.MIN_ITEMS,
            maxItems: validation_types_1.VALIDATION_ERROR_CODES.MAX_ITEMS,
            uniqueItems: validation_types_1.VALIDATION_ERROR_CODES.UNIQUE_ITEMS,
            enum: validation_types_1.VALIDATION_ERROR_CODES.INVALID_ENUM,
            const: validation_types_1.VALIDATION_ERROR_CODES.INVALID_ENUM,
            additionalProperties: validation_types_1.VALIDATION_ERROR_CODES.ADDITIONAL_PROPERTIES,
        };
        return codeMap[keyword] ?? validation_types_1.VALIDATION_ERROR_CODES.SCHEMA_ERROR;
    }
    /**
     * Format a human-readable error message
     */
    formatErrorMessage(error, field) {
        const params = error.params;
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
                return `${field} must be one of: ${params['allowedValues']?.join(', ')}`;
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
    clearCache() {
        this.compiledSchemas.clear();
    }
}
exports.SchemaValidator = SchemaValidator;
/**
 * Create a schema validator instance with default options
 */
function createSchemaValidator(options) {
    return new SchemaValidator(options);
}
/**
 * Validate data against a schema (convenience function)
 */
function validateSchema(data, schema, options) {
    const validator = new SchemaValidator(options);
    return validator.validate(data, schema);
}
//# sourceMappingURL=schema-validator.js.map