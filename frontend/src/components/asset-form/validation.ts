import type { AssetType, AssetStatus } from '../../types/asset';
import type { CustomAttribute } from './CustomAttributesEditor';

/**
 * Form validation utilities for Asset Create/Edit Forms
 * 
 * Implements Requirements:
 * - 2.1: System shall maintain a comprehensive asset registry with unique identifiers
 * - 2.8: System shall support custom attributes per asset type
 */

export interface ValidationError {
  field: string;
  message: string;
}

export interface ValidationResult {
  isValid: boolean;
  errors: ValidationError[];
}

// Common field validators
export const validators = {
  required: (value: unknown, fieldName: string): string | null => {
    if (value === undefined || value === null || value === '') {
      return `${fieldName} is required`;
    }
    return null;
  },

  minLength: (value: string, min: number, fieldName: string): string | null => {
    if (value && value.length < min) {
      return `${fieldName} must be at least ${min} characters`;
    }
    return null;
  },

  maxLength: (value: string, max: number, fieldName: string): string | null => {
    if (value && value.length > max) {
      return `${fieldName} must be ${max} characters or less`;
    }
    return null;
  },

  pattern: (value: string, pattern: RegExp, message: string): string | null => {
    if (value && !pattern.test(value)) {
      return message;
    }
    return null;
  },

  positiveNumber: (value: number | string, fieldName: string): string | null => {
    const num = typeof value === 'string' ? parseFloat(value) : value;
    if (value !== '' && value !== undefined && (isNaN(num) || num < 0)) {
      return `${fieldName} must be a positive number`;
    }
    return null;
  },

  email: (value: string): string | null => {
    const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (value && !emailPattern.test(value)) {
      return 'Please enter a valid email address';
    }
    return null;
  },

  ipAddress: (value: string): string | null => {
    const ipPattern = /^(?:(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)\.){3}(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)$/;
    if (value && !ipPattern.test(value)) {
      return 'Please enter a valid IP address';
    }
    return null;
  },

  macAddress: (value: string): string | null => {
    const macPattern = /^([0-9A-Fa-f]{2}[:-]){5}([0-9A-Fa-f]{2})$/;
    if (value && !macPattern.test(value)) {
      return 'Please enter a valid MAC address (e.g., 00:1A:2B:3C:4D:5E)';
    }
    return null;
  },

  date: (value: string, fieldName: string): string | null => {
    if (value && isNaN(Date.parse(value))) {
      return `${fieldName} must be a valid date`;
    }
    return null;
  },

  futureDate: (value: string, fieldName: string): string | null => {
    if (value) {
      const date = new Date(value);
      if (isNaN(date.getTime())) {
        return `${fieldName} must be a valid date`;
      }
      if (date <= new Date()) {
        return `${fieldName} must be a future date`;
      }
    }
    return null;
  },
};

// Asset form data interface
export interface AssetFormData {
  // Common fields
  assetType: AssetType | '';
  displayName: string;
  description: string;
  status: AssetStatus;

  // Hardware fields
  serialNumber?: string;
  manufacturer?: string;
  model?: string;
  modelCategory?: string;
  assignedTo?: string;
  departmentId?: string;
  costCenterId?: string;
  purchasePrice?: number | string;
  warrantyExpiration?: string;
  cpu?: string;
  memoryGb?: number | string;
  storageGb?: number | string;
  operatingSystem?: string;
  ipAddress?: string;
  macAddress?: string;
  stockroomId?: string;
  buildingId?: string;
  building?: string;
  floor?: string;
  room?: string;
  rack?: string;
  rackUnit?: number | string;

  // Software fields
  publisher?: string;
  productName?: string;
  version?: string;
  edition?: string;
  licenseType?: string;
  isSaas?: boolean;

  // Enterprise fields
  assetClass?: string;
  criticalityLevel?: string;
  facilityId?: string;
  zone?: string;
  operatingHours?: number | string;
  meterReading?: number | string;

  // Custom attributes
  customAttributes: CustomAttribute[];
}

// Initial form data
export const getInitialFormData = (assetType?: AssetType): AssetFormData => ({
  assetType: assetType || '',
  displayName: '',
  description: '',
  status: 'ORDERED',
  serialNumber: '',
  manufacturer: '',
  model: '',
  modelCategory: '',
  assignedTo: '',
  departmentId: '',
  costCenterId: '',
  purchasePrice: '',
  warrantyExpiration: '',
  cpu: '',
  memoryGb: '',
  storageGb: '',
  operatingSystem: '',
  ipAddress: '',
  macAddress: '',
  stockroomId: '',
  buildingId: '',
  building: '',
  floor: '',
  room: '',
  rack: '',
  rackUnit: '',
  publisher: '',
  productName: '',
  version: '',
  edition: '',
  licenseType: '',
  isSaas: false,
  assetClass: '',
  criticalityLevel: '',
  facilityId: '',
  zone: '',
  operatingHours: '',
  meterReading: '',
  customAttributes: [],
});

// Validate common fields
const validateCommonFields = (data: AssetFormData): ValidationError[] => {
  const errors: ValidationError[] = [];

  const assetTypeError = validators.required(data.assetType, 'Asset Type');
  if (assetTypeError) {
    errors.push({ field: 'assetType', message: assetTypeError });
  }

  const displayNameRequired = validators.required(data.displayName, 'Display Name');
  if (displayNameRequired) {
    errors.push({ field: 'displayName', message: displayNameRequired });
  } else {
    const displayNameMin = validators.minLength(data.displayName, 3, 'Display Name');
    if (displayNameMin) {
      errors.push({ field: 'displayName', message: displayNameMin });
    }
    const displayNameMax = validators.maxLength(data.displayName, 255, 'Display Name');
    if (displayNameMax) {
      errors.push({ field: 'displayName', message: displayNameMax });
    }
  }

  const descriptionMax = validators.maxLength(data.description, 1000, 'Description');
  if (descriptionMax) {
    errors.push({ field: 'description', message: descriptionMax });
  }

  return errors;
};

// Validate hardware-specific fields
const validateHardwareFields = (data: AssetFormData): ValidationError[] => {
  const errors: ValidationError[] = [];

  if (data.serialNumber) {
    const serialMax = validators.maxLength(data.serialNumber, 100, 'Serial Number');
    if (serialMax) {
      errors.push({ field: 'serialNumber', message: serialMax });
    }
  }

  if (data.purchasePrice !== '' && data.purchasePrice !== undefined) {
    const priceError = validators.positiveNumber(data.purchasePrice, 'Purchase Price');
    if (priceError) {
      errors.push({ field: 'purchasePrice', message: priceError });
    }
  }

  if (data.memoryGb !== '' && data.memoryGb !== undefined) {
    const memoryError = validators.positiveNumber(data.memoryGb, 'Memory');
    if (memoryError) {
      errors.push({ field: 'memoryGb', message: memoryError });
    }
  }

  if (data.storageGb !== '' && data.storageGb !== undefined) {
    const storageError = validators.positiveNumber(data.storageGb, 'Storage');
    if (storageError) {
      errors.push({ field: 'storageGb', message: storageError });
    }
  }

  if (data.ipAddress) {
    const ipError = validators.ipAddress(data.ipAddress);
    if (ipError) {
      errors.push({ field: 'ipAddress', message: ipError });
    }
  }

  if (data.macAddress) {
    const macError = validators.macAddress(data.macAddress);
    if (macError) {
      errors.push({ field: 'macAddress', message: macError });
    }
  }

  if (data.warrantyExpiration) {
    const dateError = validators.date(data.warrantyExpiration, 'Warranty Expiration');
    if (dateError) {
      errors.push({ field: 'warrantyExpiration', message: dateError });
    }
  }

  return errors;
};

// Validate software-specific fields
const validateSoftwareFields = (data: AssetFormData): ValidationError[] => {
  const errors: ValidationError[] = [];

  const publisherRequired = validators.required(data.publisher, 'Publisher');
  if (publisherRequired) {
    errors.push({ field: 'publisher', message: publisherRequired });
  }

  const productNameRequired = validators.required(data.productName, 'Product Name');
  if (productNameRequired) {
    errors.push({ field: 'productName', message: productNameRequired });
  }

  return errors;
};

// Validate enterprise-specific fields
const validateEnterpriseFields = (data: AssetFormData): ValidationError[] => {
  const errors: ValidationError[] = [];

  if (data.operatingHours !== '' && data.operatingHours !== undefined) {
    const hoursError = validators.positiveNumber(data.operatingHours, 'Operating Hours');
    if (hoursError) {
      errors.push({ field: 'operatingHours', message: hoursError });
    }
  }

  if (data.meterReading !== '' && data.meterReading !== undefined) {
    const meterError = validators.positiveNumber(data.meterReading, 'Meter Reading');
    if (meterError) {
      errors.push({ field: 'meterReading', message: meterError });
    }
  }

  return errors;
};

// Validate custom attributes
const validateCustomAttributes = (attributes: CustomAttribute[]): ValidationError[] => {
  const errors: ValidationError[] = [];
  const keys = new Set<string>();

  attributes.forEach((attr, index) => {
    if (!attr.key.trim()) {
      errors.push({
        field: `customAttributes[${index}].key`,
        message: 'Attribute key is required',
      });
    } else if (keys.has(attr.key.toLowerCase())) {
      errors.push({
        field: `customAttributes[${index}].key`,
        message: 'Duplicate attribute key',
      });
    } else {
      keys.add(attr.key.toLowerCase());
    }

    if (attr.key.length > 50) {
      errors.push({
        field: `customAttributes[${index}].key`,
        message: 'Attribute key must be 50 characters or less',
      });
    }

    if (attr.value.length > 500) {
      errors.push({
        field: `customAttributes[${index}].value`,
        message: 'Attribute value must be 500 characters or less',
      });
    }
  });

  return errors;
};

// Main validation function
export const validateAssetForm = (data: AssetFormData): ValidationResult => {
  const errors: ValidationError[] = [];

  // Validate common fields
  errors.push(...validateCommonFields(data));

  // Validate type-specific fields
  if (data.assetType === 'HARDWARE') {
    errors.push(...validateHardwareFields(data));
  } else if (data.assetType === 'SOFTWARE') {
    errors.push(...validateSoftwareFields(data));
  } else if (data.assetType === 'ENTERPRISE') {
    errors.push(...validateEnterpriseFields(data));
  }

  // Validate custom attributes
  errors.push(...validateCustomAttributes(data.customAttributes));

  return {
    isValid: errors.length === 0,
    errors,
  };
};

// Validate a single field
export const validateField = (
  fieldName: string,
  value: unknown,
  formData: AssetFormData
): string | null => {
  switch (fieldName) {
    case 'assetType':
      return validators.required(value, 'Asset Type');
    case 'displayName':
      if (!value) return 'Display Name is required';
      if (typeof value === 'string') {
        return (
          validators.minLength(value, 3, 'Display Name') ||
          validators.maxLength(value, 255, 'Display Name')
        );
      }
      return null;
    case 'description':
      return typeof value === 'string'
        ? validators.maxLength(value, 1000, 'Description')
        : null;
    case 'serialNumber':
      return typeof value === 'string'
        ? validators.maxLength(value, 100, 'Serial Number')
        : null;
    case 'purchasePrice':
    case 'memoryGb':
    case 'storageGb':
    case 'operatingHours':
    case 'meterReading':
      if (value !== '' && value !== undefined) {
        return validators.positiveNumber(value as number | string, fieldName);
      }
      return null;
    case 'ipAddress':
      return typeof value === 'string' ? validators.ipAddress(value) : null;
    case 'macAddress':
      return typeof value === 'string' ? validators.macAddress(value) : null;
    case 'warrantyExpiration':
      return typeof value === 'string'
        ? validators.date(value, 'Warranty Expiration')
        : null;
    case 'publisher':
      if (formData.assetType === 'SOFTWARE') {
        return validators.required(value, 'Publisher');
      }
      return null;
    case 'productName':
      if (formData.assetType === 'SOFTWARE') {
        return validators.required(value, 'Product Name');
      }
      return null;
    default:
      return null;
  }
};

// Get errors as a map for easy lookup
export const getErrorMap = (errors: ValidationError[]): Record<string, string> => {
  return errors.reduce((acc, error) => {
    acc[error.field] = error.message;
    return acc;
  }, {} as Record<string, string>);
};
