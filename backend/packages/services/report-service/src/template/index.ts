/**
 * Template Module Exports
 */

// Repository functions (low-level data access)
export {
  createTemplate as createTemplateInRepo,
  getTemplateById,
  updateTemplate as updateTemplateInRepo,
  deleteTemplate as deleteTemplateInRepo,
  listTemplates as listTemplatesFromRepo,
  getSharedTemplates as getSharedTemplatesFromRepo,
  getPublicTemplates as getPublicTemplatesFromRepo,
  getUserTemplates as getUserTemplatesFromRepo,
  incrementUsageCount,
  getMostUsedTemplates,
  searchTemplates,
  getTemplatesByTags,
} from './template-repository';

// Service functions (business logic) - these wrap repository functions
export {
  createTemplate,
  updateTemplate,
  deleteTemplate,
  listTemplates,
  getTemplate,
  getSharedTemplates,
  getPublicTemplates,
  getUserTemplates,
  shareTemplate,
  unshareTemplate,
  makeTemplatePublic,
  makeTemplatePrivate,
  recordTemplateUsage,
} from './template-service';

// Export types from report-types (where they're defined)
export type {
  ReportTemplate,
  TemplateVisibility,
  TemplateQuery,
  CreateTemplateRequest,
  UpdateTemplateRequest,
  TemplateListResult,
} from '../report/report-types';
