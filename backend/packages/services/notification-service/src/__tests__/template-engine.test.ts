/**
 * Template Engine Unit Tests
 *
 * Tests for Template Engine:
 * - Variable substitution (Requirement 17.7)
 * - Template validation
 * - Default values and type coercion
 */

import {
  renderTemplate,
  renderString,
  validateTemplate,
  extractVariables,
  previewTemplate,
} from '../notification/template-engine';
import type { NotificationTemplate } from '../notification/notification-types';

describe('Template Engine', () => {
  describe('renderString', () => {
    it('should substitute simple variables', () => {
      const template = 'Hello {{name}}, welcome to {{company}}!';
      const variables = { name: 'John', company: 'Acme Corp' };

      const result = renderString(template, variables);

      expect(result).toBe('Hello John, welcome to Acme Corp!');
    });

    it('should handle missing variables by keeping placeholder', () => {
      const template = 'Hello {{name}}, your order {{orderId}} is ready.';
      const variables = { name: 'John' };

      const result = renderString(template, variables);

      expect(result).toBe('Hello John, your order {{orderId}} is ready.');
    });

    it('should use inline default values', () => {
      const template = 'Hello {{name|Guest}}, welcome!';
      const variables = {};

      const result = renderString(template, variables);

      expect(result).toBe('Hello Guest, welcome!');
    });


    it('should handle number variables', () => {
      const template = 'Your balance is {{amount}} credits.';
      const variables = { amount: 150 };

      const result = renderString(template, variables);

      expect(result).toBe('Your balance is 150 credits.');
    });

    it('should handle boolean variables', () => {
      const template = 'Premium status: {{isPremium}}';
      const variables = { isPremium: true };

      const result = renderString(template, variables);

      expect(result).toBe('Premium status: true');
    });

    it('should handle multiple occurrences of same variable', () => {
      const template = '{{name}} said hello. {{name}} is here.';
      const variables = { name: 'Alice' };

      const result = renderString(template, variables);

      expect(result).toBe('Alice said hello. Alice is here.');
    });

    it('should handle empty string variable', () => {
      const template = 'Value: {{value}}';
      const variables = { value: '' };

      const result = renderString(template, variables);

      expect(result).toBe('Value: ');
    });
  });

  describe('extractVariables', () => {
    it('should extract all variable names from template', () => {
      const template = 'Hello {{name}}, your {{itemType}} {{itemName}} is ready.';

      const variables = extractVariables(template);

      expect(variables).toEqual(['name', 'itemType', 'itemName']);
    });

    it('should return unique variable names', () => {
      const template = '{{name}} and {{name}} and {{other}}';

      const variables = extractVariables(template);

      expect(variables).toEqual(['name', 'other']);
    });

    it('should extract variables with default values', () => {
      const template = 'Hello {{name|Guest}}, status: {{status|Active}}';

      const variables = extractVariables(template);

      expect(variables).toEqual(['name', 'status']);
    });

    it('should return empty array for template without variables', () => {
      const template = 'Hello, welcome to our service!';

      const variables = extractVariables(template);

      expect(variables).toEqual([]);
    });
  });


  describe('renderTemplate', () => {
    const createTemplate = (overrides: Partial<NotificationTemplate> = {}): NotificationTemplate => ({
      templateId: 'template-1',
      name: 'Test Template',
      eventType: 'SYSTEM_ALERT',
      channel: 'EMAIL',
      subject: 'Hello {{userName}}',
      body: 'Your asset {{assetName}} has been {{action}}.',
      variables: [
        { name: 'userName', required: true, type: 'string' },
        { name: 'assetName', required: true, type: 'string' },
        { name: 'action', required: false, type: 'string', defaultValue: 'updated' },
      ],
      isActive: true,
      version: 1,
      createdAt: '2024-01-15T10:00:00.000Z',
      updatedAt: '2024-01-15T10:00:00.000Z',
      ...overrides,
    });

    it('should render template with all variables provided', () => {
      const template = createTemplate();
      const variables = {
        userName: 'John',
        assetName: 'Laptop-001',
        action: 'deployed',
      };

      const result = renderTemplate(template, variables);

      expect(result.success).toBe(true);
      expect(result.subject).toBe('Hello John');
      expect(result.body).toBe('Your asset Laptop-001 has been deployed.');
      expect(result.errors).toHaveLength(0);
    });

    it('should use default values for missing optional variables', () => {
      const template = createTemplate();
      const variables = {
        userName: 'John',
        assetName: 'Laptop-001',
      };

      const result = renderTemplate(template, variables);

      expect(result.success).toBe(true);
      expect(result.body).toBe('Your asset Laptop-001 has been updated.');
    });

    it('should report error for missing required variables', () => {
      const template = createTemplate();
      const variables = {
        userName: 'John',
        // assetName is missing
      };

      const result = renderTemplate(template, variables);

      expect(result.success).toBe(false);
      expect(result.errors).toContain("Required variable 'assetName' is missing");
    });

    it('should render HTML body when present', () => {
      const template = createTemplate({
        htmlBody: '<h1>Hello {{userName}}</h1><p>Asset: {{assetName}}</p>',
      });
      const variables = {
        userName: 'John',
        assetName: 'Laptop-001',
      };

      const result = renderTemplate(template, variables);

      expect(result.success).toBe(true);
      expect(result.htmlBody).toBe('<h1>Hello John</h1><p>Asset: Laptop-001</p>');
    });
  });


  describe('validateTemplate', () => {
    const createTemplate = (overrides: Partial<NotificationTemplate> = {}): NotificationTemplate => ({
      templateId: 'template-1',
      name: 'Test Template',
      eventType: 'SYSTEM_ALERT',
      channel: 'EMAIL',
      subject: 'Hello {{userName}}',
      body: 'Your asset {{assetName}} is ready.',
      variables: [
        { name: 'userName', required: true, type: 'string' },
        { name: 'assetName', required: true, type: 'string' },
      ],
      isActive: true,
      version: 1,
      createdAt: '2024-01-15T10:00:00.000Z',
      updatedAt: '2024-01-15T10:00:00.000Z',
      ...overrides,
    });

    it('should validate a correct template', () => {
      const template = createTemplate();

      const result = validateTemplate(template);

      expect(result.isValid).toBe(true);
      expect(result.errors).toHaveLength(0);
      expect(result.extractedVariables).toContain('userName');
      expect(result.extractedVariables).toContain('assetName');
    });

    it('should report error for undefined variables used in template', () => {
      const template = createTemplate({
        body: 'Hello {{userName}}, your {{unknownVar}} is ready.',
        variables: [{ name: 'userName', required: true, type: 'string' }],
      });

      const result = validateTemplate(template);

      expect(result.isValid).toBe(false);
      expect(result.errors).toContain(
        "Variable 'unknownVar' is used but not defined in template variables"
      );
    });

    it('should warn about unused defined variables', () => {
      const template = createTemplate({
        body: 'Hello {{userName}}!',
        variables: [
          { name: 'userName', required: true, type: 'string' },
          { name: 'unusedVar', required: false, type: 'string' },
        ],
      });

      const result = validateTemplate(template);

      expect(result.isValid).toBe(true);
      expect(result.warnings).toContain(
        "Variable 'unusedVar' is defined but not used in template"
      );
    });

    it('should report error for mismatched braces', () => {
      const template = createTemplate({
        body: 'Hello {{userName}, your asset is ready.',
      });

      const result = validateTemplate(template);

      expect(result.isValid).toBe(false);
      expect(result.errors.some(e => e.includes('Mismatched braces'))).toBe(true);
    });

    it('should report error for empty variable placeholder', () => {
      const template = createTemplate({
        body: 'Hello {{}}, welcome!',
      });

      const result = validateTemplate(template);

      expect(result.isValid).toBe(false);
      expect(result.errors.some(e => e.includes('Empty variable placeholder'))).toBe(true);
    });
  });


  describe('previewTemplate', () => {
    const createTemplate = (overrides: Partial<NotificationTemplate> = {}): NotificationTemplate => ({
      templateId: 'template-1',
      name: 'Test Template',
      eventType: 'SYSTEM_ALERT',
      channel: 'EMAIL',
      subject: 'Hello {{userName}}',
      body: 'Your asset {{assetName}} count: {{count}}.',
      variables: [
        { name: 'userName', required: true, type: 'string' },
        { name: 'assetName', required: true, type: 'string' },
        { name: 'count', required: false, type: 'number', defaultValue: '0' },
      ],
      isActive: true,
      version: 1,
      createdAt: '2024-01-15T10:00:00.000Z',
      updatedAt: '2024-01-15T10:00:00.000Z',
      ...overrides,
    });

    it('should generate preview with sample data', () => {
      const template = createTemplate();

      const result = previewTemplate(template);

      expect(result.success).toBe(true);
      expect(result.subject).toBe('Hello [userName]');
      expect(result.body).toBe('Your asset [assetName] count: 0.');
    });

    it('should use provided sample data', () => {
      const template = createTemplate();
      const sampleData = {
        userName: 'Test User',
        assetName: 'Test Asset',
      };

      const result = previewTemplate(template, sampleData);

      expect(result.success).toBe(true);
      expect(result.subject).toBe('Hello Test User');
      expect(result.body).toBe('Your asset Test Asset count: 0.');
    });

    it('should use default values from template variables', () => {
      const template = createTemplate({
        variables: [
          { name: 'userName', required: true, type: 'string', defaultValue: 'Default User' },
          { name: 'assetName', required: true, type: 'string', defaultValue: 'Default Asset' },
          { name: 'count', required: false, type: 'number', defaultValue: '5' },
        ],
      });

      const result = previewTemplate(template);

      expect(result.success).toBe(true);
      expect(result.subject).toBe('Hello Default User');
      expect(result.body).toBe('Your asset Default Asset count: 5.');
    });
  });
});
