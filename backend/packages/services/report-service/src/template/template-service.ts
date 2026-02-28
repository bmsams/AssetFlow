/**
 * Template Service - Report template management
 *
 * Implements report template creation, saving, and sharing.
 *
 * Requirements:
 * - 16.10: Support report templates that can be saved and shared across users
 * - 16.9: Log report access for audit purposes
 */

import type { UUID } from '@ams/types';
import { createLogger } from '@ams/utils';

import * as reportRepository from '../report/report-repository';
import * as templateRepository from './template-repository';
import type {
  CreateTemplateRequest,
  ReportTemplate,
  TemplateListResult,
  TemplateQuery,
  TemplateVisibility,
  UpdateTemplateRequest,
} from '../report/report-types';

const logger = createLogger({ service: 'template-service' });

// ============================================================================
// Template CRUD Operations
// ============================================================================

/**
 * Create a new report template
 *
 * Requirement 16.10: Support report templates that can be saved and shared across users
 */
export async function createTemplate(
  request: CreateTemplateRequest,
  userId: UUID
): Promise<ReportTemplate> {
  // Validate request first
  validateCreateTemplateRequest(request);

  logger.info('Creating report template', {
    name: request.name,
    dataSource: request.definition.dataSource,
    visibility: request.visibility ?? 'PRIVATE',
    userId,
  });

  const now = new Date().toISOString();
  const templateId = generateUUID();

  const template: ReportTemplate = {
    templateId,
    name: request.name,
    description: request.description,
    definition: request.definition,
    defaultFormat: request.defaultFormat ?? 'CSV',
    createdBy: userId,
    createdAt: now,
    updatedAt: now,
    visibility: request.visibility ?? 'PRIVATE',
    sharedWith: request.sharedWith,
    tags: request.tags,
    usageCount: 0,
    isDefault: false,
  };

  const created = await templateRepository.createTemplate(template);

  // Log template creation for audit
  await reportRepository.logReportAccess({
    reportId: templateId,
    reportType: 'ASSET_INVENTORY', // Using existing type for audit
    accessedBy: userId,
    accessedAt: now,
    action: 'GENERATED',
    format: template.defaultFormat,
    filters: { customFilters: { action: 'TEMPLATE_CREATED', templateName: template.name } },
  });

  logger.info('Report template created', {
    templateId,
    name: template.name,
    visibility: template.visibility,
  });

  return created;
}

/**
 * Get a template by ID
 */
export async function getTemplate(
  templateId: UUID,
  userId: UUID
): Promise<ReportTemplate | null> {
  logger.debug('Getting template', { templateId, userId });

  const template = await templateRepository.getTemplateById(templateId);

  if (!template) {
    return null;
  }

  // Check access permissions
  if (!canAccessTemplate(template, userId)) {
    logger.warn('User does not have access to template', { templateId, userId });
    return null;
  }

  return template;
}

/**
 * Update an existing template
 *
 * Requirement 16.10: Support report templates that can be saved and shared across users
 */
export async function updateTemplate(
  templateId: UUID,
  request: UpdateTemplateRequest,
  userId: UUID
): Promise<ReportTemplate> {
  logger.info('Updating report template', { templateId, userId });

  // Get existing template
  const existing = await templateRepository.getTemplateById(templateId);

  if (!existing) {
    throw new Error(`Template not found: ${templateId}`);
  }

  // Check ownership
  if (existing.createdBy !== userId) {
    throw new Error('Only the template owner can update it');
  }

  // Validate update request
  if (request.definition) {
    validateTemplateDefinition(request.definition);
  }

  const now = new Date().toISOString();

  const updated: ReportTemplate = {
    ...existing,
    name: request.name ?? existing.name,
    description: request.description ?? existing.description,
    definition: request.definition ?? existing.definition,
    defaultFormat: request.defaultFormat ?? existing.defaultFormat,
    visibility: request.visibility ?? existing.visibility,
    sharedWith: request.sharedWith ?? existing.sharedWith,
    tags: request.tags ?? existing.tags,
    updatedAt: now,
  };

  const result = await templateRepository.updateTemplate(updated);

  logger.info('Report template updated', {
    templateId,
    name: result.name,
    visibility: result.visibility,
  });

  return result;
}

/**
 * Delete a template
 */
export async function deleteTemplate(
  templateId: UUID,
  userId: UUID
): Promise<void> {
  logger.info('Deleting report template', { templateId, userId });

  const existing = await templateRepository.getTemplateById(templateId);

  if (!existing) {
    throw new Error(`Template not found: ${templateId}`);
  }

  // Check ownership
  if (existing.createdBy !== userId) {
    throw new Error('Only the template owner can delete it');
  }

  await templateRepository.deleteTemplate(templateId);

  logger.info('Report template deleted', { templateId });
}

// ============================================================================
// Template Listing and Search
// ============================================================================

/**
 * List templates accessible to a user
 *
 * Requirement 16.10: Support report templates that can be saved and shared across users
 */
export async function listTemplates(
  query: TemplateQuery,
  userId: UUID
): Promise<TemplateListResult> {
  logger.debug('Listing templates', { query, userId });

  // Build query with user access filter
  const accessQuery: TemplateQuery = {
    ...query,
    // Include templates owned by user, shared with user, or public
  };

  const result = await templateRepository.listTemplates(accessQuery, userId);

  return result;
}

/**
 * Get templates shared with a user
 */
export async function getSharedTemplates(
  userId: UUID,
  page: number = 1,
  limit: number = 20
): Promise<TemplateListResult> {
  logger.debug('Getting shared templates', { userId, page, limit });

  return templateRepository.getSharedTemplates(userId, page, limit);
}

/**
 * Get public templates
 */
export async function getPublicTemplates(
  page: number = 1,
  limit: number = 20
): Promise<TemplateListResult> {
  logger.debug('Getting public templates', { page, limit });

  return templateRepository.getPublicTemplates(page, limit);
}

/**
 * Get user's own templates
 */
export async function getUserTemplates(
  userId: UUID,
  page: number = 1,
  limit: number = 20
): Promise<TemplateListResult> {
  logger.debug('Getting user templates', { userId, page, limit });

  return templateRepository.getUserTemplates(userId, page, limit);
}

// ============================================================================
// Template Sharing
// ============================================================================

/**
 * Share a template with specific users
 *
 * Requirement 16.10: Support report templates that can be saved and shared across users
 */
export async function shareTemplate(
  templateId: UUID,
  shareWithUserIds: UUID[],
  userId: UUID
): Promise<ReportTemplate> {
  logger.info('Sharing template', {
    templateId,
    shareWithCount: shareWithUserIds.length,
    userId,
  });

  const existing = await templateRepository.getTemplateById(templateId);

  if (!existing) {
    throw new Error(`Template not found: ${templateId}`);
  }

  // Check ownership
  if (existing.createdBy !== userId) {
    throw new Error('Only the template owner can share it');
  }

  // Merge existing shared users with new ones
  const existingShared = new Set(existing.sharedWith ?? []);
  for (const shareUserId of shareWithUserIds) {
    existingShared.add(shareUserId);
  }

  const updated: ReportTemplate = {
    ...existing,
    sharedWith: Array.from(existingShared),
    visibility: existing.visibility === 'PRIVATE' ? 'SHARED' : existing.visibility,
    updatedAt: new Date().toISOString(),
  };

  const result = await templateRepository.updateTemplate(updated);

  logger.info('Template shared', {
    templateId,
    sharedWithCount: result.sharedWith?.length ?? 0,
  });

  return result;
}

/**
 * Unshare a template from specific users
 */
export async function unshareTemplate(
  templateId: UUID,
  unshareFromUserIds: UUID[],
  userId: UUID
): Promise<ReportTemplate> {
  logger.info('Unsharing template', {
    templateId,
    unshareFromCount: unshareFromUserIds.length,
    userId,
  });

  const existing = await templateRepository.getTemplateById(templateId);

  if (!existing) {
    throw new Error(`Template not found: ${templateId}`);
  }

  // Check ownership
  if (existing.createdBy !== userId) {
    throw new Error('Only the template owner can unshare it');
  }

  // Remove users from shared list
  const unshareSet = new Set(unshareFromUserIds);
  const remainingShared = (existing.sharedWith ?? []).filter(id => !unshareSet.has(id));

  const updated: ReportTemplate = {
    ...existing,
    sharedWith: remainingShared,
    visibility: remainingShared.length === 0 && existing.visibility === 'SHARED' 
      ? 'PRIVATE' 
      : existing.visibility,
    updatedAt: new Date().toISOString(),
  };

  const result = await templateRepository.updateTemplate(updated);

  logger.info('Template unshared', {
    templateId,
    remainingSharedCount: result.sharedWith?.length ?? 0,
  });

  return result;
}

/**
 * Make a template public
 */
export async function makeTemplatePublic(
  templateId: UUID,
  userId: UUID
): Promise<ReportTemplate> {
  logger.info('Making template public', { templateId, userId });

  const existing = await templateRepository.getTemplateById(templateId);

  if (!existing) {
    throw new Error(`Template not found: ${templateId}`);
  }

  // Check ownership
  if (existing.createdBy !== userId) {
    throw new Error('Only the template owner can make it public');
  }

  const updated: ReportTemplate = {
    ...existing,
    visibility: 'PUBLIC',
    updatedAt: new Date().toISOString(),
  };

  return templateRepository.updateTemplate(updated);
}

/**
 * Make a template private
 */
export async function makeTemplatePrivate(
  templateId: UUID,
  userId: UUID
): Promise<ReportTemplate> {
  logger.info('Making template private', { templateId, userId });

  const existing = await templateRepository.getTemplateById(templateId);

  if (!existing) {
    throw new Error(`Template not found: ${templateId}`);
  }

  // Check ownership
  if (existing.createdBy !== userId) {
    throw new Error('Only the template owner can make it private');
  }

  const updated: ReportTemplate = {
    ...existing,
    visibility: 'PRIVATE',
    sharedWith: [],
    updatedAt: new Date().toISOString(),
  };

  return templateRepository.updateTemplate(updated);
}

// ============================================================================
// Template Usage Tracking
// ============================================================================

/**
 * Record template usage
 *
 * Requirement 16.9: Log report access for audit purposes
 */
export async function recordTemplateUsage(
  templateId: UUID,
  userId: UUID
): Promise<void> {
  logger.debug('Recording template usage', { templateId, userId });

  await templateRepository.incrementUsageCount(templateId);

  // Log usage for audit
  await reportRepository.logReportAccess({
    reportId: templateId,
    reportType: 'ASSET_INVENTORY',
    accessedBy: userId,
    accessedAt: new Date().toISOString(),
    action: 'VIEWED',
    format: 'CSV',
    filters: { customFilters: { action: 'TEMPLATE_USED' } },
  });
}

// ============================================================================
// Validation
// ============================================================================

/**
 * Validate create template request
 */
function validateCreateTemplateRequest(request: CreateTemplateRequest): void {
  if (!request.name || request.name.trim().length === 0) {
    throw new Error('Template name is required');
  }

  if (request.name.length > 255) {
    throw new Error('Template name must be 255 characters or less');
  }

  if (request.description && request.description.length > 1000) {
    throw new Error('Template description must be 1000 characters or less');
  }

  validateTemplateDefinition(request.definition);

  if (request.visibility) {
    const validVisibilities: TemplateVisibility[] = ['PRIVATE', 'SHARED', 'PUBLIC'];
    if (!validVisibilities.includes(request.visibility)) {
      throw new Error(`Invalid visibility: ${request.visibility}`);
    }
  }

  if (request.tags) {
    if (request.tags.length > 10) {
      throw new Error('Maximum 10 tags allowed');
    }
    for (const tag of request.tags) {
      if (tag.length > 50) {
        throw new Error('Tag must be 50 characters or less');
      }
    }
  }
}

/**
 * Validate template definition
 */
function validateTemplateDefinition(definition: CreateTemplateRequest['definition']): void {
  if (!definition) {
    throw new Error('Template definition is required');
  }

  if (!definition.dataSource) {
    throw new Error('Data source is required');
  }

  if (!definition.columns || definition.columns.length === 0) {
    throw new Error('At least one column is required');
  }
}

// ============================================================================
// Access Control
// ============================================================================

/**
 * Check if a user can access a template
 */
function canAccessTemplate(template: ReportTemplate, userId: UUID): boolean {
  // Owner can always access
  if (template.createdBy === userId) {
    return true;
  }

  // Public templates are accessible to all
  if (template.visibility === 'PUBLIC') {
    return true;
  }

  // Shared templates are accessible to shared users
  if (template.visibility === 'SHARED' && template.sharedWith?.includes(userId)) {
    return true;
  }

  return false;
}

// ============================================================================
// Helper Functions
// ============================================================================

/**
 * Generate a UUID
 */
function generateUUID(): UUID {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    const v = c === 'x' ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}
