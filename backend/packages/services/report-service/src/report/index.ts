/**
 * Report Module Exports
 */

export * from './report-types';

// Repository functions (low-level data access)
export {
  getAssetInventoryData,
  getAssetInventorySummary,
  getComplianceData,
  getComplianceSummary,
  getCostAnalysisData,
  getCostTrendData,
  getCostAnalysisSummary,
  getLifecycleStatusData,
  getLifecycleDistribution,
  getLifecycleSummary,
  logReportAccess,
  getReportAccessLogs as getReportAccessLogsFromRepo,
  streamAssetInventoryData,
  streamComplianceData,
  streamLifecycleStatusData,
} from './report-repository';

// Service functions (business logic)
export {
  generateReport,
  logReportDownload,
  logReportView,
  getReportAccessLogs,
} from './report-service';
