/**
 * @ams/report-service - Report Service for Asset Management System
 *
 * This service provides report generation capabilities with multiple export formats.
 *
 * Requirements:
 * - 16.1: Generate standard reports: Asset Inventory, Compliance Summary, Cost Analysis, Lifecycle Status
 * - 16.2: Support custom report creation with configurable columns, filters, and groupings
 * - 16.3: Export reports in PDF, Excel, and CSV formats
 * - 16.4: Schedule automated report generation and distribution via email
 * - 16.6: Analytics Dashboard with asset cost trends, depreciation summaries, and budget utilization
 * - 16.8: Financial Report Service for depreciation schedules and asset valuation reports
 * - 16.9: Log report access for audit purposes
 * - 16.10: Support report templates that can be saved and shared across users
 */

// Export modules with namespaces to avoid conflicts
export * as report from './report';
export * as custom from './custom';
export * as template from './template';
export * as schedule from './schedule';
export * as financial from './financial';
export * as assetReports from './asset-reports';
export * as operationalReports from './operational-reports';
export * as exportModule from './export';
export * as dashboard from './dashboard';
