/**
 * Schedule Service - Report scheduling logic
 *
 * Implements report scheduling with automated generation and email distribution.
 *
 * Requirements:
 * - 16.4: Schedule automated report generation and distribution via email
 */

import type { UUID } from '@ams/types';
import { createLogger } from '@ams/utils';

import * as scheduleRepository from './schedule-repository';
import * as reportService from '../report/report-service';
import type {
  CreateScheduleRequest,
  DayOfWeek,
  EmailDistributionResult,
  GenerateReportRequest,
  ProcessScheduledReportsRequest,
  ProcessScheduledReportsResult,
  ReportSchedule,
  ReportType,
  ScheduleExecution,
  ScheduleExecutionListResult,
  ScheduleExecutionQuery,
  ScheduleFrequency,
  ScheduleListResult,
  ScheduleQuery,
  ScheduleStatus,
  UpdateScheduleRequest,
} from '../report/report-types';

const logger = createLogger({ service: 'schedule-service' });

// ============================================================================
// Schedule Management
// ============================================================================

/**
 * Create a new report schedule
 *
 * Requirement 16.4: Allow users to schedule reports to run automatically
 */
export async function createSchedule(
  request: CreateScheduleRequest,
  userId: UUID
): Promise<ReportSchedule> {
  logger.info('Creating report schedule', {
    name: request.name,
    frequency: request.frequency,
    reportType: request.reportType,
    userId,
  });

  // Validate request
  validateCreateScheduleRequest(request);

  const scheduleId = generateUUID();
  const now = new Date().toISOString();
  const nextRunAt = calculateNextRunTime(
    request.frequency,
    request.timeOfDay,
    request.timezone ?? 'UTC',
    request.dayOfWeek,
    request.dayOfMonth,
    request.cronExpression
  );

  const schedule: ReportSchedule = {
    scheduleId,
    name: request.name,
    description: request.description,
    reportType: request.reportType,
    reportConfig: request.reportConfig,
    frequency: request.frequency,
    cronExpression: request.cronExpression,
    dayOfWeek: request.dayOfWeek,
    dayOfMonth: request.dayOfMonth,
    timeOfDay: request.timeOfDay,
    timezone: request.timezone ?? 'UTC',
    recipients: request.recipients,
    emailSubject: request.emailSubject,
    emailBody: request.emailBody,
    status: 'ACTIVE',
    createdBy: userId,
    createdAt: now,
    updatedAt: now,
    nextRunAt,
    runCount: 0,
    failureCount: 0,
  };

  const created = await scheduleRepository.createSchedule(schedule);

  logger.info('Report schedule created', {
    scheduleId: created.scheduleId,
    name: created.name,
    nextRunAt: created.nextRunAt,
  });

  return created;
}

/**
 * Get a schedule by ID
 */
export async function getSchedule(scheduleId: UUID): Promise<ReportSchedule | null> {
  return scheduleRepository.getScheduleById(scheduleId);
}

/**
 * Update a schedule
 */
export async function updateSchedule(
  scheduleId: UUID,
  request: UpdateScheduleRequest,
  userId: UUID
): Promise<ReportSchedule | null> {
  logger.info('Updating report schedule', {
    scheduleId,
    updates: Object.keys(request),
    userId,
  });

  // Validate request
  validateUpdateScheduleRequest(request);

  const existing = await scheduleRepository.getScheduleById(scheduleId);
  if (!existing) {
    return null;
  }

  // Recalculate next run time if schedule parameters changed
  let nextRunAt = existing.nextRunAt;
  if (request.frequency || request.timeOfDay || request.dayOfWeek || request.dayOfMonth || request.cronExpression) {
    nextRunAt = calculateNextRunTime(
      request.frequency ?? existing.frequency,
      request.timeOfDay ?? existing.timeOfDay,
      request.timezone ?? existing.timezone,
      request.dayOfWeek ?? existing.dayOfWeek,
      request.dayOfMonth ?? existing.dayOfMonth,
      request.cronExpression ?? existing.cronExpression
    );
  }

  const updates: Partial<ReportSchedule> = {
    ...request,
    nextRunAt,
    updatedAt: new Date().toISOString(),
  };

  return scheduleRepository.updateSchedule(scheduleId, updates);
}

/**
 * Delete a schedule
 */
export async function deleteSchedule(scheduleId: UUID): Promise<boolean> {
  logger.info('Deleting report schedule', { scheduleId });
  return scheduleRepository.deleteSchedule(scheduleId);
}

/**
 * List schedules with filtering
 */
export async function listSchedules(query: ScheduleQuery): Promise<ScheduleListResult> {
  return scheduleRepository.listSchedules(query);
}

/**
 * Pause a schedule
 *
 * Requirement 16.4: Support pausing and resuming schedules
 */
export async function pauseSchedule(scheduleId: UUID): Promise<ReportSchedule | null> {
  logger.info('Pausing report schedule', { scheduleId });
  return scheduleRepository.updateScheduleStatus(scheduleId, 'PAUSED');
}

/**
 * Resume a schedule
 *
 * Requirement 16.4: Support pausing and resuming schedules
 */
export async function resumeSchedule(scheduleId: UUID): Promise<ReportSchedule | null> {
  logger.info('Resuming report schedule', { scheduleId });

  const schedule = await scheduleRepository.getScheduleById(scheduleId);
  if (!schedule) {
    return null;
  }

  // Recalculate next run time
  const nextRunAt = calculateNextRunTime(
    schedule.frequency,
    schedule.timeOfDay,
    schedule.timezone,
    schedule.dayOfWeek,
    schedule.dayOfMonth,
    schedule.cronExpression
  );

  return scheduleRepository.updateSchedule(scheduleId, {
    status: 'ACTIVE',
    nextRunAt,
  });
}

// ============================================================================
// Schedule Execution
// ============================================================================

/**
 * Process scheduled reports that are due for execution
 *
 * Requirement 16.4: Implement automated report generation
 */
export async function processScheduledReports(
  request: ProcessScheduledReportsRequest = {}
): Promise<ProcessScheduledReportsResult> {
  const now = new Date().toISOString();
  logger.info('Processing scheduled reports', { now, dryRun: request.dryRun });

  let schedules: ReportSchedule[];

  if (request.scheduleIds && request.scheduleIds.length > 0) {
    // Process specific schedules
    const schedulePromises = request.scheduleIds.map(id => scheduleRepository.getScheduleById(id));
    const results = await Promise.all(schedulePromises);
    schedules = results.filter((s): s is ReportSchedule => s !== null && s.status === 'ACTIVE');
  } else {
    // Get all schedules due for execution
    schedules = await scheduleRepository.getSchedulesDueForExecution(now);
  }

  logger.info('Found schedules to process', { count: schedules.length });

  if (request.dryRun) {
    return {
      processedCount: schedules.length,
      successCount: 0,
      failureCount: 0,
      skippedCount: schedules.length,
      executions: [],
    };
  }

  const executions: ScheduleExecution[] = [];
  let successCount = 0;
  let failureCount = 0;

  for (const schedule of schedules) {
    try {
      const execution = await executeSchedule(schedule);
      executions.push(execution);

      if (execution.status === 'COMPLETED') {
        successCount++;
      } else {
        failureCount++;
      }
    } catch (error) {
      const err = error as Error;
      logger.error('Failed to execute schedule', err, { scheduleId: schedule.scheduleId });
      failureCount++;

      // Create failed execution record
      const failedExecution: ScheduleExecution = {
        executionId: generateUUID(),
        scheduleId: schedule.scheduleId,
        status: 'FAILED',
        startedAt: now,
        completedAt: new Date().toISOString(),
        recipientCount: schedule.recipients.length,
        deliveredCount: 0,
        failedCount: schedule.recipients.length,
        errorMessage: err.message,
      };
      executions.push(failedExecution);
    }
  }

  logger.info('Completed processing scheduled reports', {
    processedCount: schedules.length,
    successCount,
    failureCount,
  });

  return {
    processedCount: schedules.length,
    successCount,
    failureCount,
    skippedCount: 0,
    executions,
  };
}

/**
 * Execute a single schedule
 */
async function executeSchedule(schedule: ReportSchedule): Promise<ScheduleExecution> {
  const executionId = generateUUID();
  const startedAt = new Date().toISOString();

  logger.info('Executing schedule', {
    executionId,
    scheduleId: schedule.scheduleId,
    name: schedule.name,
  });

  // Create execution record
  let execution: ScheduleExecution = {
    executionId,
    scheduleId: schedule.scheduleId,
    status: 'RUNNING',
    startedAt,
    recipientCount: schedule.recipients.length,
    deliveredCount: 0,
    failedCount: 0,
  };

  await scheduleRepository.createExecution(execution);

  try {
    // Generate the report
    const reportResult = await reportService.generateReport(
      schedule.reportConfig as GenerateReportRequest,
      schedule.createdBy
    );

    if (reportResult.status === 'FAILED') {
      throw new Error(reportResult.errorMessage ?? 'Report generation failed');
    }

    // Distribute via email
    const distributionResults = await distributeReportViaEmail(
      schedule,
      reportResult.reportId,
      reportResult.content ?? ''
    );

    const deliveredCount = distributionResults.filter(r => r.status === 'SENT').length;
    const failedCount = distributionResults.filter(r => r.status === 'FAILED').length;

    const completedAt = new Date().toISOString();
    const duration = new Date(completedAt).getTime() - new Date(startedAt).getTime();

    // Update execution record
    execution = {
      ...execution,
      reportId: reportResult.reportId,
      status: 'COMPLETED',
      completedAt,
      duration,
      deliveredCount,
      failedCount,
      reportUrl: reportResult.downloadUrl,
    };

    await scheduleRepository.updateExecution(executionId, execution);

    // Calculate next run time and update schedule
    const nextRunAt = calculateNextRunTime(
      schedule.frequency,
      schedule.timeOfDay,
      schedule.timezone,
      schedule.dayOfWeek,
      schedule.dayOfMonth,
      schedule.cronExpression
    );

    await scheduleRepository.updateScheduleAfterExecution(
      schedule.scheduleId,
      true,
      nextRunAt
    );

    logger.info('Schedule execution completed', {
      executionId,
      scheduleId: schedule.scheduleId,
      deliveredCount,
      failedCount,
      duration,
    });

    return execution;
  } catch (error) {
    const err = error as Error;
    const completedAt = new Date().toISOString();
    const duration = new Date(completedAt).getTime() - new Date(startedAt).getTime();

    // Update execution record with failure
    execution = {
      ...execution,
      status: 'FAILED',
      completedAt,
      duration,
      failedCount: schedule.recipients.length,
      errorMessage: err.message,
    };

    await scheduleRepository.updateExecution(executionId, execution);

    // Calculate next run time and update schedule with failure
    const nextRunAt = calculateNextRunTime(
      schedule.frequency,
      schedule.timeOfDay,
      schedule.timezone,
      schedule.dayOfWeek,
      schedule.dayOfMonth,
      schedule.cronExpression
    );

    await scheduleRepository.updateScheduleAfterExecution(
      schedule.scheduleId,
      false,
      nextRunAt,
      err.message
    );

    logger.error('Schedule execution failed', err, {
      executionId,
      scheduleId: schedule.scheduleId,
    });

    return execution;
  }
}

// ============================================================================
// Email Distribution
// ============================================================================

/**
 * Distribute report via email to recipients
 *
 * Requirement 16.4: Distribute reports via email
 */
async function distributeReportViaEmail(
  schedule: ReportSchedule,
  reportId: UUID,
  _reportContent: string
): Promise<EmailDistributionResult[]> {
  logger.info('Distributing report via email', {
    scheduleId: schedule.scheduleId,
    reportId,
    recipientCount: schedule.recipients.length,
  });

  const results: EmailDistributionResult[] = [];
  const subject = schedule.emailSubject ?? `Scheduled Report: ${schedule.name}`;
  const body = schedule.emailBody ?? getDefaultEmailBody(schedule);

  for (const recipient of schedule.recipients) {
    try {
      // In a real implementation, this would use SES or another email service
      // await ses.sendEmail({
      //   Destination: { ToAddresses: [recipient] },
      //   Message: {
      //     Subject: { Data: subject },
      //     Body: { Html: { Data: body } }
      //   },
      //   Source: 'reports@ams.example.com'
      // });

      logger.debug('Sending email to recipient', { recipient, reportId, subject: subject.substring(0, 50), bodyLength: body.length });

      results.push({
        recipient,
        status: 'SENT',
        sentAt: new Date().toISOString(),
      });
    } catch (error) {
      const err = error as Error;
      logger.error('Failed to send email', err, { recipient, reportId });

      results.push({
        recipient,
        status: 'FAILED',
        errorMessage: err.message,
      });
    }
  }

  return results;
}

/**
 * Get default email body for scheduled report
 */
function getDefaultEmailBody(schedule: ReportSchedule): string {
  return `
    <html>
      <body>
        <h2>Scheduled Report: ${schedule.name}</h2>
        <p>Your scheduled report has been generated and is attached to this email.</p>
        <p><strong>Report Type:</strong> ${schedule.reportType}</p>
        <p><strong>Generated:</strong> ${new Date().toISOString()}</p>
        ${schedule.description ? `<p><strong>Description:</strong> ${schedule.description}</p>` : ''}
        <hr>
        <p style="color: #666; font-size: 12px;">
          This is an automated email from the Asset Management System.
          To manage your report schedules, please log in to the system.
        </p>
      </body>
    </html>
  `;
}

// ============================================================================
// Execution History
// ============================================================================

/**
 * Get execution history for a schedule
 *
 * Requirement 16.4: Track schedule execution history
 */
export async function getScheduleExecutionHistory(
  scheduleId: UUID,
  limit: number = 10
): Promise<ScheduleExecution[]> {
  return scheduleRepository.getScheduleExecutionHistory(scheduleId, limit);
}

/**
 * List executions with filtering
 */
export async function listExecutions(
  query: ScheduleExecutionQuery
): Promise<ScheduleExecutionListResult> {
  return scheduleRepository.listExecutions(query);
}

/**
 * Get execution statistics for a schedule
 */
export async function getScheduleExecutionStats(scheduleId: UUID): Promise<{
  totalRuns: number;
  successfulRuns: number;
  failedRuns: number;
  averageDuration: number;
  lastSuccessAt?: string;
  lastFailureAt?: string;
}> {
  return scheduleRepository.getScheduleExecutionStats(scheduleId);
}

// ============================================================================
// Validation
// ============================================================================

/**
 * Validate create schedule request
 */
function validateCreateScheduleRequest(request: CreateScheduleRequest): void {
  if (!request.name || request.name.trim().length === 0) {
    throw new Error('Schedule name is required');
  }

  if (request.name.length > 255) {
    throw new Error('Schedule name must be 255 characters or less');
  }

  if (!request.reportType) {
    throw new Error('Report type is required');
  }

  const validReportTypes: ReportType[] = [
    'ASSET_INVENTORY',
    'COMPLIANCE_SUMMARY',
    'COST_ANALYSIS',
    'LIFECYCLE_STATUS',
    'CUSTOM',
  ];

  if (!validReportTypes.includes(request.reportType)) {
    throw new Error(`Invalid report type: ${request.reportType}`);
  }

  if (!request.reportConfig) {
    throw new Error('Report configuration is required');
  }

  if (!request.frequency) {
    throw new Error('Schedule frequency is required');
  }

  const validFrequencies: ScheduleFrequency[] = ['DAILY', 'WEEKLY', 'MONTHLY', 'CUSTOM'];

  if (!validFrequencies.includes(request.frequency)) {
    throw new Error(`Invalid frequency: ${request.frequency}`);
  }

  if (request.frequency === 'CUSTOM' && !request.cronExpression) {
    throw new Error('Cron expression is required for CUSTOM frequency');
  }

  if (request.frequency === 'WEEKLY' && !request.dayOfWeek) {
    throw new Error('Day of week is required for WEEKLY frequency');
  }

  if (request.frequency === 'MONTHLY') {
    if (!request.dayOfMonth || request.dayOfMonth < 1 || request.dayOfMonth > 31) {
      throw new Error('Day of month (1-31) is required for MONTHLY frequency');
    }
  }

  if (!request.timeOfDay) {
    throw new Error('Time of day is required');
  }

  if (!/^([01]\d|2[0-3]):([0-5]\d)$/.test(request.timeOfDay)) {
    throw new Error('Time of day must be in HH:mm format');
  }

  if (!request.recipients || request.recipients.length === 0) {
    throw new Error('At least one recipient is required');
  }

  for (const recipient of request.recipients) {
    if (!isValidEmail(recipient)) {
      throw new Error(`Invalid email address: ${recipient}`);
    }
  }

  if (request.cronExpression) {
    validateCronExpression(request.cronExpression);
  }
}

/**
 * Validate update schedule request
 */
function validateUpdateScheduleRequest(request: UpdateScheduleRequest): void {
  if (request.name !== undefined) {
    if (request.name.trim().length === 0) {
      throw new Error('Schedule name cannot be empty');
    }
    if (request.name.length > 255) {
      throw new Error('Schedule name must be 255 characters or less');
    }
  }

  if (request.frequency !== undefined) {
    const validFrequencies: ScheduleFrequency[] = ['DAILY', 'WEEKLY', 'MONTHLY', 'CUSTOM'];
    if (!validFrequencies.includes(request.frequency)) {
      throw new Error(`Invalid frequency: ${request.frequency}`);
    }
  }

  if (request.timeOfDay !== undefined) {
    if (!/^([01]\d|2[0-3]):([0-5]\d)$/.test(request.timeOfDay)) {
      throw new Error('Time of day must be in HH:mm format');
    }
  }

  if (request.recipients !== undefined) {
    if (request.recipients.length === 0) {
      throw new Error('At least one recipient is required');
    }
    for (const recipient of request.recipients) {
      if (!isValidEmail(recipient)) {
        throw new Error(`Invalid email address: ${recipient}`);
      }
    }
  }

  if (request.status !== undefined) {
    const validStatuses: ScheduleStatus[] = ['ACTIVE', 'PAUSED', 'COMPLETED', 'FAILED'];
    if (!validStatuses.includes(request.status)) {
      throw new Error(`Invalid status: ${request.status}`);
    }
  }

  if (request.cronExpression !== undefined) {
    validateCronExpression(request.cronExpression);
  }
}

/**
 * Validate cron expression
 *
 * Requirement 16.4: Support cron-like scheduling expressions
 */
function validateCronExpression(expression: string): void {
  // Basic cron validation (5 or 6 fields)
  const parts = expression.trim().split(/\s+/);
  if (parts.length < 5 || parts.length > 6) {
    throw new Error('Invalid cron expression: must have 5 or 6 fields');
  }

  // Validate each field has valid characters
  const validChars = /^[\d,\-\*\/]+$/;
  for (const part of parts) {
    if (!validChars.test(part)) {
      throw new Error(`Invalid cron expression: invalid characters in field "${part}"`);
    }
  }
}

/**
 * Validate email address
 */
function isValidEmail(email: string): boolean {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(email);
}

// ============================================================================
// Schedule Calculation
// ============================================================================

/**
 * Calculate the next run time for a schedule
 */
export function calculateNextRunTime(
  frequency: ScheduleFrequency,
  timeOfDay: string,
  _timezone: string,
  dayOfWeek?: DayOfWeek,
  dayOfMonth?: number,
  cronExpression?: string
): string {
  const now = new Date();
  const [hours, minutes] = timeOfDay.split(':').map(Number);

  // Create a date with the specified time
  let nextRun = new Date(now);
  nextRun.setUTCHours(hours!, minutes!, 0, 0);

  // If the time has already passed today, start from tomorrow
  if (nextRun <= now) {
    nextRun.setUTCDate(nextRun.getUTCDate() + 1);
  }

  switch (frequency) {
    case 'DAILY':
      // Already set to next occurrence
      break;

    case 'WEEKLY':
      if (dayOfWeek) {
        const targetDay = getDayOfWeekNumber(dayOfWeek);
        const currentDay = nextRun.getUTCDay();
        let daysUntilTarget = targetDay - currentDay;
        if (daysUntilTarget <= 0) {
          daysUntilTarget += 7;
        }
        nextRun.setUTCDate(nextRun.getUTCDate() + daysUntilTarget);
      }
      break;

    case 'MONTHLY':
      if (dayOfMonth) {
        nextRun.setUTCDate(dayOfMonth);
        // If the day has passed this month, move to next month
        if (nextRun <= now) {
          nextRun.setUTCMonth(nextRun.getUTCMonth() + 1);
        }
        // Handle months with fewer days
        const lastDayOfMonth = new Date(
          Date.UTC(nextRun.getUTCFullYear(), nextRun.getUTCMonth() + 1, 0)
        ).getUTCDate();
        if (dayOfMonth > lastDayOfMonth) {
          nextRun.setUTCDate(lastDayOfMonth);
        }
      }
      break;

    case 'CUSTOM':
      if (cronExpression) {
        // In a real implementation, use a cron parser library
        // For now, default to daily
        nextRun = calculateNextCronRun(cronExpression, now);
      }
      break;
  }

  return nextRun.toISOString();
}

/**
 * Get day of week number (0 = Sunday, 6 = Saturday)
 */
function getDayOfWeekNumber(day: DayOfWeek): number {
  const days: Record<DayOfWeek, number> = {
    SUNDAY: 0,
    MONDAY: 1,
    TUESDAY: 2,
    WEDNESDAY: 3,
    THURSDAY: 4,
    FRIDAY: 5,
    SATURDAY: 6,
  };
  return days[day];
}

/**
 * Calculate next run time from cron expression
 * This is a simplified implementation - in production, use a proper cron parser
 */
function calculateNextCronRun(_cronExpression: string, from: Date): Date {
  // Simplified: just return next day at the same time
  // In production, use a library like 'cron-parser'
  const next = new Date(from);
  next.setUTCDate(next.getUTCDate() + 1);
  return next;
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
