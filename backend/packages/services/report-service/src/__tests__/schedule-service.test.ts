/**
 * Schedule Service Unit Tests
 *
 * Tests for Report Schedule Service:
 * - Schedule creation and management (Requirement 16.4)
 * - Automated report generation
 * - Email distribution
 * - Pause/resume functionality
 * - Execution history tracking
 */

// Mock the dependencies before importing service
jest.mock('@ams/database', () => ({
  queryOne: jest.fn(),
  queryMany: jest.fn(),
  withTransaction: jest.fn((fn) => fn({
    queryOne: jest.fn(),
    queryMany: jest.fn(),
  })),
}));

jest.mock('@ams/cache', () => ({
  del: jest.fn().mockResolvedValue(undefined),
  get: jest.fn().mockResolvedValue(null),
  set: jest.fn().mockResolvedValue(undefined),
}));

jest.mock('@ams/events', () => ({
  publishEvent: jest.fn().mockResolvedValue(undefined),
}));

jest.mock('@ams/utils', () => ({
  createLogger: () => ({
    info: jest.fn(),
    error: jest.fn(),
    warn: jest.fn(),
    debug: jest.fn(),
  }),
  now: () => '2024-01-15T10:00:00.000Z',
  validateUUID: jest.fn().mockReturnValue(null),
}));

// Mock the repositories
jest.mock('../schedule/schedule-repository');
jest.mock('../report/report-repository');
jest.mock('../report/report-service');

import * as scheduleService from '../schedule/schedule-service';
import * as scheduleRepository from '../schedule/schedule-repository';
import * as reportService from '../report/report-service';
import type {
  CreateScheduleRequest,
  ReportSchedule,
  ScheduleExecution,
} from '../report/report-types';


const mockScheduleRepository = scheduleRepository as jest.Mocked<typeof scheduleRepository>;
const mockReportService = reportService as jest.Mocked<typeof reportService>;

describe('Schedule Service', () => {
  const userId = '123e4567-e89b-12d3-a456-426614174000';

  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('createSchedule', () => {
    const validRequest: CreateScheduleRequest = {
      name: 'Daily Asset Report',
      description: 'Daily report of all assets',
      reportType: 'ASSET_INVENTORY',
      reportConfig: {
        reportType: 'ASSET_INVENTORY',
        format: 'PDF',
      },
      frequency: 'DAILY',
      timeOfDay: '08:00',
      timezone: 'UTC',
      recipients: ['admin@example.com', 'manager@example.com'],
      emailSubject: 'Daily Asset Report',
    };

    beforeEach(() => {
      mockScheduleRepository.createSchedule.mockImplementation(async (schedule) => schedule);
    });

    it('should create a daily schedule successfully', async () => {
      const result = await scheduleService.createSchedule(validRequest, userId);

      expect(result.name).toBe('Daily Asset Report');
      expect(result.frequency).toBe('DAILY');
      expect(result.status).toBe('ACTIVE');
      expect(result.createdBy).toBe(userId);
      expect(result.runCount).toBe(0);
      expect(result.nextRunAt).toBeDefined();
      expect(mockScheduleRepository.createSchedule).toHaveBeenCalled();
    });

    it('should create a weekly schedule with day of week', async () => {
      const weeklyRequest: CreateScheduleRequest = {
        ...validRequest,
        name: 'Weekly Compliance Report',
        frequency: 'WEEKLY',
        dayOfWeek: 'MONDAY',
      };

      const result = await scheduleService.createSchedule(weeklyRequest, userId);

      expect(result.frequency).toBe('WEEKLY');
      expect(result.dayOfWeek).toBe('MONDAY');
    });

    it('should create a monthly schedule with day of month', async () => {
      const monthlyRequest: CreateScheduleRequest = {
        ...validRequest,
        name: 'Monthly Cost Report',
        frequency: 'MONTHLY',
        dayOfMonth: 1,
      };

      const result = await scheduleService.createSchedule(monthlyRequest, userId);

      expect(result.frequency).toBe('MONTHLY');
      expect(result.dayOfMonth).toBe(1);
    });

    it('should create a custom schedule with cron expression', async () => {
      const customRequest: CreateScheduleRequest = {
        ...validRequest,
        name: 'Custom Schedule',
        frequency: 'CUSTOM',
        cronExpression: '0 9 * * 1-5',
      };

      const result = await scheduleService.createSchedule(customRequest, userId);

      expect(result.frequency).toBe('CUSTOM');
      expect(result.cronExpression).toBe('0 9 * * 1-5');
    });

    describe('validation', () => {
      it('should throw error when name is missing', async () => {
        const invalidRequest = { ...validRequest, name: '' };

        await expect(scheduleService.createSchedule(invalidRequest, userId)).rejects.toThrow(
          'Schedule name is required'
        );
      });

      it('should throw error when name is too long', async () => {
        const invalidRequest = { ...validRequest, name: 'a'.repeat(256) };

        await expect(scheduleService.createSchedule(invalidRequest, userId)).rejects.toThrow(
          'Schedule name must be 255 characters or less'
        );
      });

      it('should throw error when reportType is missing', async () => {
        const invalidRequest = { ...validRequest, reportType: '' as any };

        await expect(scheduleService.createSchedule(invalidRequest, userId)).rejects.toThrow(
          'Report type is required'
        );
      });

      it('should throw error when frequency is invalid', async () => {
        const invalidRequest = { ...validRequest, frequency: 'INVALID' as any };

        await expect(scheduleService.createSchedule(invalidRequest, userId)).rejects.toThrow(
          'Invalid frequency'
        );
      });

      it('should throw error when WEEKLY frequency missing dayOfWeek', async () => {
        const invalidRequest = { ...validRequest, frequency: 'WEEKLY' as const, dayOfWeek: undefined };

        await expect(scheduleService.createSchedule(invalidRequest, userId)).rejects.toThrow(
          'Day of week is required for WEEKLY frequency'
        );
      });

      it('should throw error when MONTHLY frequency missing dayOfMonth', async () => {
        const invalidRequest = { ...validRequest, frequency: 'MONTHLY' as const, dayOfMonth: undefined };

        await expect(scheduleService.createSchedule(invalidRequest, userId)).rejects.toThrow(
          'Day of month (1-31) is required for MONTHLY frequency'
        );
      });

      it('should throw error when CUSTOM frequency missing cronExpression', async () => {
        const invalidRequest = { ...validRequest, frequency: 'CUSTOM' as const, cronExpression: undefined };

        await expect(scheduleService.createSchedule(invalidRequest, userId)).rejects.toThrow(
          'Cron expression is required for CUSTOM frequency'
        );
      });

      it('should throw error when timeOfDay is invalid format', async () => {
        const invalidRequest = { ...validRequest, timeOfDay: '25:00' };

        await expect(scheduleService.createSchedule(invalidRequest, userId)).rejects.toThrow(
          'Time of day must be in HH:mm format'
        );
      });

      it('should throw error when recipients is empty', async () => {
        const invalidRequest = { ...validRequest, recipients: [] };

        await expect(scheduleService.createSchedule(invalidRequest, userId)).rejects.toThrow(
          'At least one recipient is required'
        );
      });

      it('should throw error when recipient email is invalid', async () => {
        const invalidRequest = { ...validRequest, recipients: ['invalid-email'] };

        await expect(scheduleService.createSchedule(invalidRequest, userId)).rejects.toThrow(
          'Invalid email address'
        );
      });
    });
  });


  describe('getSchedule', () => {
    it('should return schedule when found', async () => {
      const mockSchedule: ReportSchedule = {
        scheduleId: 'schedule-1',
        name: 'Test Schedule',
        reportType: 'ASSET_INVENTORY',
        reportConfig: { reportType: 'ASSET_INVENTORY', format: 'PDF' },
        frequency: 'DAILY',
        timeOfDay: '08:00',
        timezone: 'UTC',
        recipients: ['admin@example.com'],
        status: 'ACTIVE',
        createdBy: userId,
        createdAt: '2024-01-15T10:00:00.000Z',
        updatedAt: '2024-01-15T10:00:00.000Z',
        runCount: 0,
        failureCount: 0,
      };

      mockScheduleRepository.getScheduleById.mockResolvedValue(mockSchedule);

      const result = await scheduleService.getSchedule('schedule-1');

      expect(result).toEqual(mockSchedule);
      expect(mockScheduleRepository.getScheduleById).toHaveBeenCalledWith('schedule-1');
    });

    it('should return null when schedule not found', async () => {
      mockScheduleRepository.getScheduleById.mockResolvedValue(null);

      const result = await scheduleService.getSchedule('non-existent');

      expect(result).toBeNull();
    });
  });

  describe('updateSchedule', () => {
    const existingSchedule: ReportSchedule = {
      scheduleId: 'schedule-1',
      name: 'Test Schedule',
      reportType: 'ASSET_INVENTORY',
      reportConfig: { reportType: 'ASSET_INVENTORY', format: 'PDF' },
      frequency: 'DAILY',
      timeOfDay: '08:00',
      timezone: 'UTC',
      recipients: ['admin@example.com'],
      status: 'ACTIVE',
      createdBy: userId,
      createdAt: '2024-01-15T10:00:00.000Z',
      updatedAt: '2024-01-15T10:00:00.000Z',
      runCount: 5,
      failureCount: 0,
    };

    beforeEach(() => {
      mockScheduleRepository.getScheduleById.mockResolvedValue(existingSchedule);
      mockScheduleRepository.updateSchedule.mockImplementation(async (_id, updates) => ({
        ...existingSchedule,
        ...updates,
      }));
    });

    it('should update schedule name', async () => {
      const result = await scheduleService.updateSchedule(
        'schedule-1',
        { name: 'Updated Schedule Name' },
        userId
      );

      expect(result?.name).toBe('Updated Schedule Name');
    });

    it('should update schedule recipients', async () => {
      const result = await scheduleService.updateSchedule(
        'schedule-1',
        { recipients: ['new@example.com'] },
        userId
      );

      expect(result?.recipients).toEqual(['new@example.com']);
    });

    it('should recalculate nextRunAt when frequency changes', async () => {
      const result = await scheduleService.updateSchedule(
        'schedule-1',
        { frequency: 'WEEKLY', dayOfWeek: 'FRIDAY' },
        userId
      );

      expect(result?.frequency).toBe('WEEKLY');
      expect(result?.nextRunAt).toBeDefined();
    });

    it('should return null when schedule not found', async () => {
      mockScheduleRepository.getScheduleById.mockResolvedValue(null);

      const result = await scheduleService.updateSchedule(
        'non-existent',
        { name: 'New Name' },
        userId
      );

      expect(result).toBeNull();
    });
  });

  describe('deleteSchedule', () => {
    it('should delete schedule successfully', async () => {
      mockScheduleRepository.deleteSchedule.mockResolvedValue(true);

      const result = await scheduleService.deleteSchedule('schedule-1');

      expect(result).toBe(true);
      expect(mockScheduleRepository.deleteSchedule).toHaveBeenCalledWith('schedule-1');
    });
  });

  describe('pauseSchedule', () => {
    it('should pause an active schedule', async () => {
      const pausedSchedule: ReportSchedule = {
        scheduleId: 'schedule-1',
        name: 'Test Schedule',
        reportType: 'ASSET_INVENTORY',
        reportConfig: { reportType: 'ASSET_INVENTORY', format: 'PDF' },
        frequency: 'DAILY',
        timeOfDay: '08:00',
        timezone: 'UTC',
        recipients: ['admin@example.com'],
        status: 'PAUSED',
        createdBy: userId,
        createdAt: '2024-01-15T10:00:00.000Z',
        updatedAt: '2024-01-15T10:00:00.000Z',
        runCount: 0,
        failureCount: 0,
      };

      mockScheduleRepository.updateScheduleStatus.mockResolvedValue(pausedSchedule);

      const result = await scheduleService.pauseSchedule('schedule-1');

      expect(result?.status).toBe('PAUSED');
      expect(mockScheduleRepository.updateScheduleStatus).toHaveBeenCalledWith('schedule-1', 'PAUSED');
    });
  });

  describe('resumeSchedule', () => {
    const pausedSchedule: ReportSchedule = {
      scheduleId: 'schedule-1',
      name: 'Test Schedule',
      reportType: 'ASSET_INVENTORY',
      reportConfig: { reportType: 'ASSET_INVENTORY', format: 'PDF' },
      frequency: 'DAILY',
      timeOfDay: '08:00',
      timezone: 'UTC',
      recipients: ['admin@example.com'],
      status: 'PAUSED',
      createdBy: userId,
      createdAt: '2024-01-15T10:00:00.000Z',
      updatedAt: '2024-01-15T10:00:00.000Z',
      runCount: 0,
      failureCount: 0,
    };

    it('should resume a paused schedule', async () => {
      mockScheduleRepository.getScheduleById.mockResolvedValue(pausedSchedule);
      mockScheduleRepository.updateSchedule.mockResolvedValue({
        ...pausedSchedule,
        status: 'ACTIVE',
        nextRunAt: '2024-01-16T08:00:00.000Z',
      });

      const result = await scheduleService.resumeSchedule('schedule-1');

      expect(result?.status).toBe('ACTIVE');
      expect(result?.nextRunAt).toBeDefined();
    });

    it('should return null when schedule not found', async () => {
      mockScheduleRepository.getScheduleById.mockResolvedValue(null);

      const result = await scheduleService.resumeSchedule('non-existent');

      expect(result).toBeNull();
    });
  });


  describe('processScheduledReports', () => {
    const activeSchedule: ReportSchedule = {
      scheduleId: 'schedule-1',
      name: 'Daily Report',
      reportType: 'ASSET_INVENTORY',
      reportConfig: { reportType: 'ASSET_INVENTORY', format: 'PDF' },
      frequency: 'DAILY',
      timeOfDay: '08:00',
      timezone: 'UTC',
      recipients: ['admin@example.com'],
      status: 'ACTIVE',
      createdBy: userId,
      createdAt: '2024-01-15T10:00:00.000Z',
      updatedAt: '2024-01-15T10:00:00.000Z',
      nextRunAt: '2024-01-15T08:00:00.000Z',
      runCount: 0,
      failureCount: 0,
    };

    beforeEach(() => {
      mockScheduleRepository.getSchedulesDueForExecution.mockResolvedValue([activeSchedule]);
      mockScheduleRepository.createExecution.mockImplementation(async (exec) => exec);
      mockScheduleRepository.updateExecution.mockResolvedValue(null);
      mockScheduleRepository.updateScheduleAfterExecution.mockResolvedValue();
      mockReportService.generateReport.mockResolvedValue({
        reportId: 'report-1',
        status: 'COMPLETED',
        metadata: {
          reportId: 'report-1',
          reportType: 'ASSET_INVENTORY',
          title: 'Asset Inventory Report',
          generatedAt: '2024-01-15T10:00:00.000Z',
          generatedBy: userId,
          format: 'PDF',
          filters: {},
          totalRecords: 100,
        },
        content: 'base64content',
      });
    });

    it('should process due schedules and generate reports', async () => {
      const result = await scheduleService.processScheduledReports({});

      expect(result.processedCount).toBe(1);
      expect(result.successCount).toBe(1);
      expect(result.failureCount).toBe(0);
      expect(mockReportService.generateReport).toHaveBeenCalled();
      expect(mockScheduleRepository.updateScheduleAfterExecution).toHaveBeenCalled();
    });

    it('should handle dry run without executing', async () => {
      const result = await scheduleService.processScheduledReports({ dryRun: true });

      expect(result.processedCount).toBe(1);
      expect(result.skippedCount).toBe(1);
      expect(result.successCount).toBe(0);
      expect(mockReportService.generateReport).not.toHaveBeenCalled();
    });

    it('should handle report generation failure', async () => {
      mockReportService.generateReport.mockResolvedValue({
        reportId: 'report-1',
        status: 'FAILED',
        metadata: {
          reportId: 'report-1',
          reportType: 'ASSET_INVENTORY',
          title: 'Asset Inventory Report',
          generatedAt: '2024-01-15T10:00:00.000Z',
          generatedBy: userId,
          format: 'PDF',
          filters: {},
          totalRecords: 0,
        },
        errorMessage: 'Database connection failed',
      });

      const result = await scheduleService.processScheduledReports({});

      expect(result.processedCount).toBe(1);
      expect(result.failureCount).toBe(1);
      expect(result.successCount).toBe(0);
    });

    it('should process specific schedules when IDs provided', async () => {
      mockScheduleRepository.getScheduleById.mockResolvedValue(activeSchedule);

      const result = await scheduleService.processScheduledReports({
        scheduleIds: ['schedule-1'],
      });

      expect(result.processedCount).toBe(1);
      expect(mockScheduleRepository.getScheduleById).toHaveBeenCalledWith('schedule-1');
    });
  });

  describe('getScheduleExecutionHistory', () => {
    it('should return execution history for a schedule', async () => {
      const mockExecutions: ScheduleExecution[] = [
        {
          executionId: 'exec-1',
          scheduleId: 'schedule-1',
          reportId: 'report-1',
          status: 'COMPLETED',
          startedAt: '2024-01-15T08:00:00.000Z',
          completedAt: '2024-01-15T08:01:00.000Z',
          duration: 60000,
          recipientCount: 2,
          deliveredCount: 2,
          failedCount: 0,
        },
        {
          executionId: 'exec-2',
          scheduleId: 'schedule-1',
          reportId: 'report-2',
          status: 'COMPLETED',
          startedAt: '2024-01-14T08:00:00.000Z',
          completedAt: '2024-01-14T08:01:00.000Z',
          duration: 55000,
          recipientCount: 2,
          deliveredCount: 2,
          failedCount: 0,
        },
      ];

      mockScheduleRepository.getScheduleExecutionHistory.mockResolvedValue(mockExecutions);

      const result = await scheduleService.getScheduleExecutionHistory('schedule-1', 10);

      expect(result).toEqual(mockExecutions);
      expect(result.length).toBe(2);
      expect(mockScheduleRepository.getScheduleExecutionHistory).toHaveBeenCalledWith('schedule-1', 10);
    });
  });

  describe('calculateNextRunTime', () => {
    it('should calculate next daily run time', () => {
      const nextRun = scheduleService.calculateNextRunTime(
        'DAILY',
        '08:00',
        'UTC'
      );

      expect(nextRun).toBeDefined();
      const nextRunDate = new Date(nextRun);
      expect(nextRunDate.getUTCHours()).toBe(8);
      expect(nextRunDate.getUTCMinutes()).toBe(0);
    });

    it('should calculate next weekly run time', () => {
      const nextRun = scheduleService.calculateNextRunTime(
        'WEEKLY',
        '09:00',
        'UTC',
        'MONDAY'
      );

      expect(nextRun).toBeDefined();
      const nextRunDate = new Date(nextRun);
      expect(nextRunDate.getUTCDay()).toBe(1); // Monday
      expect(nextRunDate.getUTCHours()).toBe(9);
    });

    it('should calculate next monthly run time', () => {
      const nextRun = scheduleService.calculateNextRunTime(
        'MONTHLY',
        '10:00',
        'UTC',
        undefined,
        15
      );

      expect(nextRun).toBeDefined();
      const nextRunDate = new Date(nextRun);
      expect(nextRunDate.getUTCDate()).toBe(15);
      expect(nextRunDate.getUTCHours()).toBe(10);
    });
  });

  describe('listSchedules', () => {
    it('should list schedules with pagination', async () => {
      mockScheduleRepository.listSchedules.mockResolvedValue({
        schedules: [],
        total: 0,
        page: 1,
        limit: 20,
      });

      const result = await scheduleService.listSchedules({
        page: 1,
        limit: 20,
        status: 'ACTIVE',
      });

      expect(result.page).toBe(1);
      expect(result.limit).toBe(20);
      expect(mockScheduleRepository.listSchedules).toHaveBeenCalledWith({
        page: 1,
        limit: 20,
        status: 'ACTIVE',
      });
    });
  });
});
