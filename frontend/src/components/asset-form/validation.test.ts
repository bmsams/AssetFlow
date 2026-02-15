import { describe, it, expect } from 'vitest';
import {
  validators,
  validateAssetForm,
  validateField,
  getErrorMap,
  getInitialFormData,
  type AssetFormData,
} from './validation';

describe('validators', () => {
  describe('required', () => {
    it('returns error for undefined value', () => {
      expect(validators.required(undefined, 'Field')).toBe('Field is required');
    });

    it('returns error for null value', () => {
      expect(validators.required(null, 'Field')).toBe('Field is required');
    });

    it('returns error for empty string', () => {
      expect(validators.required('', 'Field')).toBe('Field is required');
    });

    it('returns null for valid value', () => {
      expect(validators.required('value', 'Field')).toBeNull();
    });

    it('returns null for zero', () => {
      expect(validators.required(0, 'Field')).toBeNull();
    });

    it('returns null for false', () => {
      expect(validators.required(false, 'Field')).toBeNull();
    });
  });

  describe('minLength', () => {
    it('returns error when value is too short', () => {
      expect(validators.minLength('ab', 3, 'Field')).toBe(
        'Field must be at least 3 characters'
      );
    });

    it('returns null when value meets minimum', () => {
      expect(validators.minLength('abc', 3, 'Field')).toBeNull();
    });

    it('returns null for empty value', () => {
      expect(validators.minLength('', 3, 'Field')).toBeNull();
    });
  });

  describe('maxLength', () => {
    it('returns error when value is too long', () => {
      expect(validators.maxLength('abcd', 3, 'Field')).toBe(
        'Field must be 3 characters or less'
      );
    });

    it('returns null when value meets maximum', () => {
      expect(validators.maxLength('abc', 3, 'Field')).toBeNull();
    });

    it('returns null for empty value', () => {
      expect(validators.maxLength('', 3, 'Field')).toBeNull();
    });
  });

  describe('pattern', () => {
    it('returns error when pattern does not match', () => {
      expect(validators.pattern('abc', /^\d+$/, 'Must be numbers')).toBe(
        'Must be numbers'
      );
    });

    it('returns null when pattern matches', () => {
      expect(validators.pattern('123', /^\d+$/, 'Must be numbers')).toBeNull();
    });

    it('returns null for empty value', () => {
      expect(validators.pattern('', /^\d+$/, 'Must be numbers')).toBeNull();
    });
  });

  describe('positiveNumber', () => {
    it('returns error for negative number', () => {
      expect(validators.positiveNumber(-5, 'Price')).toBe(
        'Price must be a positive number'
      );
    });

    it('returns error for NaN string', () => {
      expect(validators.positiveNumber('abc', 'Price')).toBe(
        'Price must be a positive number'
      );
    });

    it('returns null for positive number', () => {
      expect(validators.positiveNumber(10, 'Price')).toBeNull();
    });

    it('returns null for zero', () => {
      expect(validators.positiveNumber(0, 'Price')).toBeNull();
    });

    it('returns null for empty string', () => {
      expect(validators.positiveNumber('', 'Price')).toBeNull();
    });

    it('returns null for undefined', () => {
      expect(validators.positiveNumber(undefined as unknown as number, 'Price')).toBeNull();
    });
  });

  describe('email', () => {
    it('returns error for invalid email', () => {
      expect(validators.email('invalid')).toBe('Please enter a valid email address');
    });

    it('returns error for email without domain', () => {
      expect(validators.email('test@')).toBe('Please enter a valid email address');
    });

    it('returns null for valid email', () => {
      expect(validators.email('test@example.com')).toBeNull();
    });

    it('returns null for empty value', () => {
      expect(validators.email('')).toBeNull();
    });
  });

  describe('ipAddress', () => {
    it('returns error for invalid IP', () => {
      expect(validators.ipAddress('invalid')).toBe('Please enter a valid IP address');
    });

    it('returns error for IP with invalid octet', () => {
      expect(validators.ipAddress('192.168.1.256')).toBe(
        'Please enter a valid IP address'
      );
    });

    it('returns null for valid IP', () => {
      expect(validators.ipAddress('192.168.1.100')).toBeNull();
    });

    it('returns null for empty value', () => {
      expect(validators.ipAddress('')).toBeNull();
    });
  });

  describe('macAddress', () => {
    it('returns error for invalid MAC', () => {
      expect(validators.macAddress('invalid')).toContain('valid MAC address');
    });

    it('returns null for valid MAC with colons', () => {
      expect(validators.macAddress('00:1A:2B:3C:4D:5E')).toBeNull();
    });

    it('returns null for valid MAC with dashes', () => {
      expect(validators.macAddress('00-1A-2B-3C-4D-5E')).toBeNull();
    });

    it('returns null for empty value', () => {
      expect(validators.macAddress('')).toBeNull();
    });
  });

  describe('date', () => {
    it('returns error for invalid date', () => {
      expect(validators.date('invalid', 'Date')).toBe('Date must be a valid date');
    });

    it('returns null for valid date', () => {
      expect(validators.date('2024-01-15', 'Date')).toBeNull();
    });

    it('returns null for empty value', () => {
      expect(validators.date('', 'Date')).toBeNull();
    });
  });
});

describe('validateAssetForm', () => {
  describe('Common Fields', () => {
    it('returns error when assetType is empty', () => {
      const data = getInitialFormData();
      const result = validateAssetForm(data);

      expect(result.isValid).toBe(false);
      expect(result.errors).toContainEqual({
        field: 'assetType',
        message: 'Asset Type is required',
      });
    });

    it('returns error when displayName is empty', () => {
      const data: AssetFormData = {
        ...getInitialFormData('HARDWARE'),
        displayName: '',
      };
      const result = validateAssetForm(data);

      expect(result.isValid).toBe(false);
      expect(result.errors).toContainEqual({
        field: 'displayName',
        message: 'Display Name is required',
      });
    });

    it('returns error when displayName is too short', () => {
      const data: AssetFormData = {
        ...getInitialFormData('HARDWARE'),
        displayName: 'ab',
      };
      const result = validateAssetForm(data);

      expect(result.isValid).toBe(false);
      expect(result.errors).toContainEqual({
        field: 'displayName',
        message: 'Display Name must be at least 3 characters',
      });
    });

    it('returns error when displayName is too long', () => {
      const data: AssetFormData = {
        ...getInitialFormData('HARDWARE'),
        displayName: 'a'.repeat(256),
      };
      const result = validateAssetForm(data);

      expect(result.isValid).toBe(false);
      expect(result.errors).toContainEqual({
        field: 'displayName',
        message: 'Display Name must be 255 characters or less',
      });
    });

    it('returns error when description is too long', () => {
      const data: AssetFormData = {
        ...getInitialFormData('HARDWARE'),
        displayName: 'Valid Name',
        description: 'a'.repeat(1001),
      };
      const result = validateAssetForm(data);

      expect(result.isValid).toBe(false);
      expect(result.errors).toContainEqual({
        field: 'description',
        message: 'Description must be 1000 characters or less',
      });
    });
  });

  describe('Hardware Fields', () => {
    it('validates hardware form with valid data', () => {
      const data: AssetFormData = {
        ...getInitialFormData('HARDWARE'),
        displayName: 'Dell Laptop',
        serialNumber: 'ABC123',
        purchasePrice: 1499.99,
        memoryGb: 16,
        storageGb: 512,
        ipAddress: '192.168.1.100',
        macAddress: '00:1A:2B:3C:4D:5E',
      };
      const result = validateAssetForm(data);

      expect(result.isValid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it('returns error for invalid IP address', () => {
      const data: AssetFormData = {
        ...getInitialFormData('HARDWARE'),
        displayName: 'Dell Laptop',
        ipAddress: 'invalid-ip',
      };
      const result = validateAssetForm(data);

      expect(result.isValid).toBe(false);
      expect(result.errors).toContainEqual({
        field: 'ipAddress',
        message: 'Please enter a valid IP address',
      });
    });

    it('returns error for invalid MAC address', () => {
      const data: AssetFormData = {
        ...getInitialFormData('HARDWARE'),
        displayName: 'Dell Laptop',
        macAddress: 'invalid-mac',
      };
      const result = validateAssetForm(data);

      expect(result.isValid).toBe(false);
      expect(result.errors).toContainEqual(
        expect.objectContaining({
          field: 'macAddress',
        })
      );
    });

    it('returns error for negative purchase price', () => {
      const data: AssetFormData = {
        ...getInitialFormData('HARDWARE'),
        displayName: 'Dell Laptop',
        purchasePrice: -100,
      };
      const result = validateAssetForm(data);

      expect(result.isValid).toBe(false);
      expect(result.errors).toContainEqual({
        field: 'purchasePrice',
        message: 'Purchase Price must be a positive number',
      });
    });

    it('returns error for negative memory', () => {
      const data: AssetFormData = {
        ...getInitialFormData('HARDWARE'),
        displayName: 'Dell Laptop',
        memoryGb: -16,
      };
      const result = validateAssetForm(data);

      expect(result.isValid).toBe(false);
      expect(result.errors).toContainEqual({
        field: 'memoryGb',
        message: 'Memory must be a positive number',
      });
    });
  });

  describe('Software Fields', () => {
    it('validates software form with valid data', () => {
      const data: AssetFormData = {
        ...getInitialFormData('SOFTWARE'),
        displayName: 'Microsoft Office',
        publisher: 'Microsoft',
        productName: 'Office 365',
        version: '2024',
        licenseType: 'SUBSCRIPTION',
        isSaas: true,
      };
      const result = validateAssetForm(data);

      expect(result.isValid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it('returns error when publisher is missing for software', () => {
      const data: AssetFormData = {
        ...getInitialFormData('SOFTWARE'),
        displayName: 'Microsoft Office',
        publisher: '',
        productName: 'Office 365',
      };
      const result = validateAssetForm(data);

      expect(result.isValid).toBe(false);
      expect(result.errors).toContainEqual({
        field: 'publisher',
        message: 'Publisher is required',
      });
    });

    it('returns error when productName is missing for software', () => {
      const data: AssetFormData = {
        ...getInitialFormData('SOFTWARE'),
        displayName: 'Microsoft Office',
        publisher: 'Microsoft',
        productName: '',
      };
      const result = validateAssetForm(data);

      expect(result.isValid).toBe(false);
      expect(result.errors).toContainEqual({
        field: 'productName',
        message: 'Product Name is required',
      });
    });
  });

  describe('Enterprise Fields', () => {
    it('validates enterprise form with valid data', () => {
      const data: AssetFormData = {
        ...getInitialFormData('ENTERPRISE'),
        displayName: 'HVAC Unit',
        serialNumber: 'HVAC-001',
        assetClass: 'HVAC',
        criticalityLevel: 'HIGH',
        operatingHours: 5000,
        meterReading: 12345.67,
      };
      const result = validateAssetForm(data);

      expect(result.isValid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it('returns error for negative operating hours', () => {
      const data: AssetFormData = {
        ...getInitialFormData('ENTERPRISE'),
        displayName: 'HVAC Unit',
        operatingHours: -100,
      };
      const result = validateAssetForm(data);

      expect(result.isValid).toBe(false);
      expect(result.errors).toContainEqual({
        field: 'operatingHours',
        message: 'Operating Hours must be a positive number',
      });
    });

    it('returns error for negative meter reading', () => {
      const data: AssetFormData = {
        ...getInitialFormData('ENTERPRISE'),
        displayName: 'HVAC Unit',
        meterReading: -50,
      };
      const result = validateAssetForm(data);

      expect(result.isValid).toBe(false);
      expect(result.errors).toContainEqual({
        field: 'meterReading',
        message: 'Meter Reading must be a positive number',
      });
    });
  });

  describe('Custom Attributes', () => {
    it('validates custom attributes with valid data', () => {
      const data: AssetFormData = {
        ...getInitialFormData('HARDWARE'),
        displayName: 'Dell Laptop',
        customAttributes: [
          { id: '1', key: 'color', value: 'black' },
          { id: '2', key: 'warranty_type', value: 'extended' },
        ],
      };
      const result = validateAssetForm(data);

      expect(result.isValid).toBe(true);
    });

    it('returns error for empty attribute key', () => {
      const data: AssetFormData = {
        ...getInitialFormData('HARDWARE'),
        displayName: 'Dell Laptop',
        customAttributes: [{ id: '1', key: '', value: 'value' }],
      };
      const result = validateAssetForm(data);

      expect(result.isValid).toBe(false);
      expect(result.errors).toContainEqual({
        field: 'customAttributes[0].key',
        message: 'Attribute key is required',
      });
    });

    it('returns error for duplicate attribute keys', () => {
      const data: AssetFormData = {
        ...getInitialFormData('HARDWARE'),
        displayName: 'Dell Laptop',
        customAttributes: [
          { id: '1', key: 'color', value: 'black' },
          { id: '2', key: 'color', value: 'white' },
        ],
      };
      const result = validateAssetForm(data);

      expect(result.isValid).toBe(false);
      expect(result.errors).toContainEqual({
        field: 'customAttributes[1].key',
        message: 'Duplicate attribute key',
      });
    });

    it('returns error for attribute key exceeding max length', () => {
      const data: AssetFormData = {
        ...getInitialFormData('HARDWARE'),
        displayName: 'Dell Laptop',
        customAttributes: [{ id: '1', key: 'a'.repeat(51), value: 'value' }],
      };
      const result = validateAssetForm(data);

      expect(result.isValid).toBe(false);
      expect(result.errors).toContainEqual({
        field: 'customAttributes[0].key',
        message: 'Attribute key must be 50 characters or less',
      });
    });

    it('returns error for attribute value exceeding max length', () => {
      const data: AssetFormData = {
        ...getInitialFormData('HARDWARE'),
        displayName: 'Dell Laptop',
        customAttributes: [{ id: '1', key: 'notes', value: 'a'.repeat(501) }],
      };
      const result = validateAssetForm(data);

      expect(result.isValid).toBe(false);
      expect(result.errors).toContainEqual({
        field: 'customAttributes[0].value',
        message: 'Attribute value must be 500 characters or less',
      });
    });
  });
});

describe('validateField', () => {
  it('validates displayName field', () => {
    const formData = getInitialFormData('HARDWARE');
    
    expect(validateField('displayName', '', formData)).toBe('Display Name is required');
    expect(validateField('displayName', 'ab', formData)).toBe(
      'Display Name must be at least 3 characters'
    );
    expect(validateField('displayName', 'Valid Name', formData)).toBeNull();
  });

  it('validates ipAddress field', () => {
    const formData = getInitialFormData('HARDWARE');
    
    expect(validateField('ipAddress', 'invalid', formData)).toBe(
      'Please enter a valid IP address'
    );
    expect(validateField('ipAddress', '192.168.1.1', formData)).toBeNull();
  });

  it('validates publisher field for software type', () => {
    const formData: AssetFormData = {
      ...getInitialFormData('SOFTWARE'),
    };
    
    expect(validateField('publisher', '', formData)).toBe('Publisher is required');
    expect(validateField('publisher', 'Microsoft', formData)).toBeNull();
  });

  it('does not require publisher for non-software types', () => {
    const formData = getInitialFormData('HARDWARE');
    
    expect(validateField('publisher', '', formData)).toBeNull();
  });
});

describe('getErrorMap', () => {
  it('converts error array to map', () => {
    const errors = [
      { field: 'displayName', message: 'Required' },
      { field: 'ipAddress', message: 'Invalid' },
    ];
    
    const map = getErrorMap(errors);
    
    expect(map).toEqual({
      displayName: 'Required',
      ipAddress: 'Invalid',
    });
  });

  it('returns empty object for empty array', () => {
    expect(getErrorMap([])).toEqual({});
  });
});

describe('getInitialFormData', () => {
  it('returns form data with specified asset type', () => {
    const data = getInitialFormData('HARDWARE');
    
    expect(data.assetType).toBe('HARDWARE');
    expect(data.displayName).toBe('');
    expect(data.status).toBe('ORDERED');
    expect(data.customAttributes).toEqual([]);
  });

  it('returns form data with empty asset type when not specified', () => {
    const data = getInitialFormData();
    
    expect(data.assetType).toBe('');
  });
});

describe('Validation - Requirements Validation', () => {
  /**
   * Validates Requirement 2.1: System shall maintain a comprehensive asset registry
   */
  it('validates comprehensive asset attributes (Requirement 2.1)', () => {
    const data: AssetFormData = {
      ...getInitialFormData('HARDWARE'),
      displayName: 'Dell Latitude 5540',
      description: 'Development laptop',
      status: 'DEPLOYED',
      serialNumber: 'DELL-ABC123',
      manufacturer: 'Dell',
      model: 'Latitude 5540',
      modelCategory: 'LAPTOP',
      cpu: 'Intel Core i7',
      memoryGb: 16,
      storageGb: 512,
      operatingSystem: 'Windows 11',
      ipAddress: '192.168.1.100',
      macAddress: '00:1A:2B:3C:4D:5E',
      purchasePrice: 1499.99,
      warrantyExpiration: '2026-01-15',
      customAttributes: [
        { id: '1', key: 'department', value: 'Engineering' },
      ],
    };
    
    const result = validateAssetForm(data);
    expect(result.isValid).toBe(true);
  });

  /**
   * Validates Requirement 2.8: System shall support custom attributes per asset type
   */
  it('validates custom attributes support (Requirement 2.8)', () => {
    const data: AssetFormData = {
      ...getInitialFormData('HARDWARE'),
      displayName: 'Test Asset',
      customAttributes: [
        { id: '1', key: 'customField1', value: 'value1' },
        { id: '2', key: 'customField2', value: 'value2' },
        { id: '3', key: 'customField3', value: 'value3' },
      ],
    };
    
    const result = validateAssetForm(data);
    expect(result.isValid).toBe(true);
  });
});
