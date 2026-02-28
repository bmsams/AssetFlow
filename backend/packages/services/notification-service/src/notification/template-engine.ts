/**
 * Template Engine - Variable substitution for notification templates
 *
 * Implements variable substitution using {{variable}} syntax.
 * Supports default values, type coercion, and validation.
 *
 * Requirement 17.7: Support notification templates with variable substitution
 */

import type { NotificationTemplate, TemplateVariable } from './notification-types';

/**
 * Variable pattern for template substitution
 * Matches {{variableName}} or {{variableName|defaultValue}}
 */
const VARIABLE_PATTERN = /\{\{(\w+)(?:\|([^}]*))?\}\}/g;

/**
 * Result of template rendering
 */
export interface RenderResult {
  readonly success: boolean;
  readonly subject: string;
  readonly body: string;
  readonly htmlBody?: string;
  readonly errors: readonly string[];
  readonly warnings: readonly string[];
}

/**
 * Template validation result
 */
export interface ValidationResult {
  readonly isValid: boolean;
  readonly errors: readonly string[];
  readonly warnings: readonly string[];
  readonly extractedVariables: readonly string[];
}

/**
 * Render a template with variable substitution
 *
 * @param template - The notification template
 * @param variables - Variables to substitute
 * @returns Rendered template result
 */
export function renderTemplate(
  template: NotificationTemplate,
  variables: Record<string, string | number | boolean>
): RenderResult {
  const errors: string[] = [];
  const warnings: string[] = [];

  // Build variable map with defaults
  const variableMap = buildVariableMap(template.variables, variables, errors, warnings);

  // Render subject
  const subject = substituteVariables(template.subject, variableMap, errors);

  // Render body
  const body = substituteVariables(template.body, variableMap, errors);

  // Render HTML body if present
  const htmlBody = template.htmlBody
    ? substituteVariables(template.htmlBody, variableMap, errors)
    : undefined;

  return {
    success: errors.length === 0,
    subject,
    body,
    htmlBody,
    errors,
    warnings,
  };
}

/**
 * Render a simple template string with variables
 *
 * @param templateString - Template string with {{variable}} placeholders
 * @param variables - Variables to substitute
 * @returns Rendered string
 */
export function renderString(
  templateString: string,
  variables: Record<string, string | number | boolean>
): string {
  return substituteVariables(templateString, variables, []);
}

/**
 * Validate a template for correctness
 *
 * @param template - Template to validate
 * @returns Validation result
 */
export function validateTemplate(template: NotificationTemplate): ValidationResult {
  const errors: string[] = [];
  const warnings: string[] = [];
  const extractedVariables: string[] = [];

  // Extract variables from all template parts
  const subjectVars = extractVariables(template.subject);
  const bodyVars = extractVariables(template.body);
  const htmlBodyVars = template.htmlBody ? extractVariables(template.htmlBody) : [];

  // Combine all unique variables
  const allVars = new Set([...subjectVars, ...bodyVars, ...htmlBodyVars]);
  extractedVariables.push(...allVars);

  // Check that all defined variables are used
  const definedVarNames = new Set(template.variables.map(v => v.name));
  for (const varName of definedVarNames) {
    if (!allVars.has(varName)) {
      warnings.push(`Variable '${varName}' is defined but not used in template`);
    }
  }

  // Check that all used variables are defined
  for (const varName of allVars) {
    if (!definedVarNames.has(varName)) {
      // Check if it has a default value in the template
      const hasInlineDefault = hasDefaultInTemplate(template, varName);
      if (!hasInlineDefault) {
        errors.push(`Variable '${varName}' is used but not defined in template variables`);
      }
    }
  }

  // Validate required variables have no default
  for (const variable of template.variables) {
    if (variable.required && variable.defaultValue !== undefined) {
      warnings.push(`Required variable '${variable.name}' has a default value, which may be confusing`);
    }
  }

  // Validate template syntax
  validateTemplateSyntax(template.subject, 'subject', errors);
  validateTemplateSyntax(template.body, 'body', errors);
  if (template.htmlBody) {
    validateTemplateSyntax(template.htmlBody, 'htmlBody', errors);
  }

  return {
    isValid: errors.length === 0,
    errors,
    warnings,
    extractedVariables,
  };
}

/**
 * Extract variable names from a template string
 *
 * @param templateString - Template string to extract from
 * @returns Array of variable names
 */
export function extractVariables(templateString: string): string[] {
  const variables: string[] = [];
  let match: RegExpExecArray | null;

  // Reset regex state
  const pattern = new RegExp(VARIABLE_PATTERN.source, 'g');

  while ((match = pattern.exec(templateString)) !== null) {
    const varName = match[1];
    if (varName && !variables.includes(varName)) {
      variables.push(varName);
    }
  }

  return variables;
}

/**
 * Build variable map with defaults and type coercion
 */
function buildVariableMap(
  templateVariables: readonly TemplateVariable[],
  providedVariables: Record<string, string | number | boolean>,
  errors: string[],
  warnings: string[]
): Record<string, string | number | boolean> {
  const result: Record<string, string | number | boolean> = { ...providedVariables };

  for (const templateVar of templateVariables) {
    const providedValue = providedVariables[templateVar.name];

    if (providedValue === undefined) {
      if (templateVar.required && templateVar.defaultValue === undefined) {
        errors.push(`Required variable '${templateVar.name}' is missing`);
      } else if (templateVar.defaultValue !== undefined) {
        const coercedDefault = coerceValue(templateVar.defaultValue, templateVar.type);
        if (coercedDefault !== null) {
          result[templateVar.name] = coercedDefault;
        } else {
          result[templateVar.name] = templateVar.defaultValue;
        }
      }
    } else {
      // Validate type
      const coercedValue = coerceValue(String(providedValue), templateVar.type);
      if (coercedValue === null) {
        warnings.push(
          `Variable '${templateVar.name}' value '${providedValue}' could not be coerced to type '${templateVar.type}'`
        );
        result[templateVar.name] = providedValue;
      } else {
        result[templateVar.name] = coercedValue;
      }
    }
  }

  return result;
}

/**
 * Substitute variables in a template string
 */
function substituteVariables(
  templateString: string,
  variables: Record<string, string | number | boolean>,
  errors: string[]
): string {
  return templateString.replace(VARIABLE_PATTERN, (match, varName: string, defaultValue?: string) => {
    const value = variables[varName];

    if (value !== undefined) {
      return String(value);
    }

    if (defaultValue !== undefined) {
      return defaultValue;
    }

    errors.push(`Variable '${varName}' not found and has no default value`);
    return match; // Keep original placeholder if not found
  });
}

/**
 * Coerce a string value to the specified type
 */
function coerceValue(
  value: string,
  type: 'string' | 'number' | 'boolean' | 'date'
): string | number | boolean | null {
  switch (type) {
    case 'string':
      return value;

    case 'number': {
      const num = Number(value);
      return isNaN(num) ? null : num;
    }

    case 'boolean': {
      const lower = value.toLowerCase();
      if (lower === 'true' || lower === '1' || lower === 'yes') {
        return true;
      }
      if (lower === 'false' || lower === '0' || lower === 'no') {
        return false;
      }
      return null;
    }

    case 'date': {
      const date = new Date(value);
      return isNaN(date.getTime()) ? null : value;
    }

    default:
      return value;
  }
}

/**
 * Check if a variable has an inline default in the template
 */
function hasDefaultInTemplate(template: NotificationTemplate, varName: string): boolean {
  const pattern = new RegExp(`\\{\\{${varName}\\|[^}]*\\}\\}`, 'g');
  return (
    pattern.test(template.subject) ||
    pattern.test(template.body) ||
    (template.htmlBody ? pattern.test(template.htmlBody) : false)
  );
}

/**
 * Validate template syntax for common errors
 */
function validateTemplateSyntax(
  templateString: string,
  fieldName: string,
  errors: string[]
): void {
  // Check for unclosed braces
  const openBraces = (templateString.match(/\{\{/g) || []).length;
  const closeBraces = (templateString.match(/\}\}/g) || []).length;

  if (openBraces !== closeBraces) {
    errors.push(`${fieldName}: Mismatched braces - ${openBraces} opening, ${closeBraces} closing`);
  }

  // Check for nested braces (not supported)
  if (/\{\{[^}]*\{\{/.test(templateString)) {
    errors.push(`${fieldName}: Nested variable placeholders are not supported`);
  }

  // Check for empty variable names
  if (/\{\{\s*\}\}/.test(templateString)) {
    errors.push(`${fieldName}: Empty variable placeholder found`);
  }

  // Check for invalid variable names (must be alphanumeric with underscores)
  const invalidVarPattern = /\{\{([^}|]+)(?:\|[^}]*)?\}\}/g;
  let match: RegExpExecArray | null;
  while ((match = invalidVarPattern.exec(templateString)) !== null) {
    const varName = match[1]?.trim();
    if (varName && !/^\w+$/.test(varName)) {
      errors.push(`${fieldName}: Invalid variable name '${varName}' - must be alphanumeric with underscores`);
    }
  }
}

/**
 * Create a preview of a template with sample data
 */
export function previewTemplate(
  template: NotificationTemplate,
  sampleData?: Record<string, string | number | boolean>
): RenderResult {
  // Generate sample data for undefined variables
  const variables: Record<string, string | number | boolean> = { ...sampleData };

  for (const templateVar of template.variables) {
    if (variables[templateVar.name] === undefined) {
      variables[templateVar.name] = generateSampleValue(templateVar);
    }
  }

  return renderTemplate(template, variables);
}

/**
 * Generate a sample value for a template variable
 */
function generateSampleValue(variable: TemplateVariable): string | number | boolean {
  if (variable.defaultValue !== undefined) {
    return variable.defaultValue;
  }

  switch (variable.type) {
    case 'string':
      return `[${variable.name}]`;
    case 'number':
      return 0;
    case 'boolean':
      return false;
    case 'date':
      return new Date().toISOString();
    default:
      return `[${variable.name}]`;
  }
}
