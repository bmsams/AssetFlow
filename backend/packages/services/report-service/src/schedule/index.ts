/**
 * Schedule Module Exports
 *
 * Report scheduling functionality for automated report generation and distribution.
 *
 * Requirements:
 * - 16.4: Schedule automated report generation and distribution via email
 */

// Repository functions (low-level data access)
export {
  createSchedule as createScheduleInRepo,
  getScheduleById,
  updateSchedule as updateScheduleInRepo,
  deleteSchedule as deleteScheduleInRepo,
  listSchedules as listSchedulesFromRepo,
  getSchedulesDueForExecution,
  updateScheduleAfterExecution,
  updateScheduleStatus,
  createExecution,
  updateExecution,
  getExecutionById,
  listExecutions as listExecutionsFromRepo,
  getScheduleExecutionHistory as getScheduleExecutionHistoryFromRepo,
  getScheduleExecutionStats as getScheduleExecutionStatsFromRepo,
  generateUUID,
} from './schedule-repository';

// Service functions (business logic) - these wrap repository functions
export {
  createSchedule,
  updateSchedule,
  deleteSchedule,
  listSchedules,
  getSchedule,
  pauseSchedule,
  resumeSchedule,
  processScheduledReports,
  getScheduleExecutionHistory,
  listExecutions,
  getScheduleExecutionStats,
  calculateNextRunTime,
} from './schedule-service';

// Export types from report-types (where they're defined)
export type {
  ScheduleStatus,
  ScheduleFrequency,
  ReportSchedule,
  ScheduleExecution,
  CreateScheduleRequest,
  UpdateScheduleRequest,
  ScheduleQuery,
  ScheduleListResult,
  ScheduleExecutionQuery,
  ScheduleExecutionListResult,
} from '../report/report-types';
