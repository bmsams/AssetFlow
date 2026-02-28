"use strict";
/**
 * Validation utilities
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.Validator = void 0;
exports.validResult = validResult;
exports.invalidResult = invalidResult;
exports.createValidationError = createValidationError;
exports.validateRequired = validateRequired;
exports.validateStringLength = validateStringLength;
exports.validateEmail = validateEmail;
exports.validateUUID = validateUUID;
exports.validateNumberRange = validateNumberRange;
exports.validateEnum = validateEnum;
exports.validateISODate = validateISODate;
exports.combineValidationResults = combineValidationResults;
exports.validate = validate;
/**
 * Create a successful validation result
 */
function validResult() {
    return { isValid: true, errors: [] };
}
/**
 * Create a failed validation result
 */
function invalidResult(errors) {
    return { isValid: false, errors };
}
/**
 * Create a validation error
 */
function createValidationError(field, message, code) {
    return { field, message, code };
}
/**
 * Validate required field
 */
function validateRequired(value, fieldName) {
    if (value === undefined || value === null || value === '') {
        return createValidationError(fieldName, `${fieldName} is required`, 'REQUIRED');
    }
    return null;
}
/**
 * Validate string length
 */
function validateStringLength(value, fieldName, minLength, maxLength) {
    if (value === undefined) {
        return null;
    }
    if (minLength !== undefined && value.length < minLength) {
        return createValidationError(fieldName, `${fieldName} must be at least ${minLength} characters`, 'MIN_LENGTH');
    }
    if (maxLength !== undefined && value.length > maxLength) {
        return createValidationError(fieldName, `${fieldName} must be at most ${maxLength} characters`, 'MAX_LENGTH');
    }
    return null;
}
/**
 * Validate email format
 */
function validateEmail(value, fieldName) {
    if (value === undefined) {
        return null;
    }
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(value)) {
        return createValidationError(fieldName, `${fieldName} must be a valid email address`, 'INVALID_EMAIL');
    }
    return null;
}
/**
 * Validate UUID format
 */
function validateUUID(value, fieldName) {
    if (value === undefined) {
        return null;
    }
    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
    if (!uuidRegex.test(value)) {
        return createValidationError(fieldName, `${fieldName} must be a valid UUID`, 'INVALID_UUID');
    }
    return null;
}
/**
 * Validate number range
 */
function validateNumberRange(value, fieldName, min, max) {
    if (value === undefined) {
        return null;
    }
    if (min !== undefined && value < min) {
        return createValidationError(fieldName, `${fieldName} must be at least ${min}`, 'MIN_VALUE');
    }
    if (max !== undefined && value > max) {
        return createValidationError(fieldName, `${fieldName} must be at most ${max}`, 'MAX_VALUE');
    }
    return null;
}
/**
 * Validate enum value
 */
function validateEnum(value, fieldName, allowedValues) {
    if (value === undefined) {
        return null;
    }
    if (!allowedValues.includes(value)) {
        return createValidationError(fieldName, `${fieldName} must be one of: ${allowedValues.join(', ')}`, 'INVALID_ENUM');
    }
    return null;
}
/**
 * Validate ISO date string
 */
function validateISODate(value, fieldName) {
    if (value === undefined) {
        return null;
    }
    const date = new Date(value);
    if (isNaN(date.getTime())) {
        return createValidationError(fieldName, `${fieldName} must be a valid ISO date string`, 'INVALID_DATE');
    }
    return null;
}
/**
 * Combine multiple validation errors
 */
function combineValidationResults(...results) {
    const errors = results.filter((e) => e !== null);
    return errors.length === 0 ? validResult() : invalidResult(errors);
}
/**
 * Validator builder for fluent validation
 */
class Validator {
    errors = [];
    required(value, fieldName) {
        const error = validateRequired(value, fieldName);
        if (error) {
            this.errors.push(error);
        }
        return this;
    }
    stringLength(value, fieldName, minLength, maxLength) {
        const error = validateStringLength(value, fieldName, minLength, maxLength);
        if (error) {
            this.errors.push(error);
        }
        return this;
    }
    email(value, fieldName) {
        const error = validateEmail(value, fieldName);
        if (error) {
            this.errors.push(error);
        }
        return this;
    }
    uuid(value, fieldName) {
        const error = validateUUID(value, fieldName);
        if (error) {
            this.errors.push(error);
        }
        return this;
    }
    numberRange(value, fieldName, min, max) {
        const error = validateNumberRange(value, fieldName, min, max);
        if (error) {
            this.errors.push(error);
        }
        return this;
    }
    enum(value, fieldName, allowedValues) {
        const error = validateEnum(value, fieldName, allowedValues);
        if (error) {
            this.errors.push(error);
        }
        return this;
    }
    isoDate(value, fieldName) {
        const error = validateISODate(value, fieldName);
        if (error) {
            this.errors.push(error);
        }
        return this;
    }
    custom(error) {
        if (error) {
            this.errors.push(error);
        }
        return this;
    }
    result() {
        return this.errors.length === 0
            ? validResult()
            : invalidResult([...this.errors]);
    }
}
exports.Validator = Validator;
/**
 * Create a new validator instance
 */
function validate() {
    return new Validator();
}
//# sourceMappingURL=validation.js.map