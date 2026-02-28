/**
 * Audit logging types
 */
import type { ISODateString, UUID } from './common';
/**
 * Audit action types
 */
export type AuditActionType = 'CREATE' | 'UPDATE' | 'DELETE' | 'STATE_CHANGE' | 'ASSIGN' | 'TRANSFER' | 'CHECKOUT' | 'CHECKIN' | 'APPROVE' | 'REJECT' | 'LOGIN' | 'LOGOUT' | 'EXPORT' | 'IMPORT';
/**
 * Audit log entry
 */
export interface AuditLogEntry {
    readonly logId: UUID;
    readonly userId?: UUID;
    readonly actionType: AuditActionType;
    readonly resourceType: string;
    readonly resourceId?: UUID;
    readonly oldValues?: Record<string, unknown>;
    readonly newValues?: Record<string, unknown>;
    readonly ipAddress?: string;
    readonly userAgent?: string;
    readonly timestamp: ISODateString;
}
/**
 * Create audit log request
 */
export interface CreateAuditLogRequest {
    readonly userId?: UUID;
    readonly actionType: AuditActionType;
    readonly resourceType: string;
    readonly resourceId?: UUID;
    readonly oldValues?: Record<string, unknown>;
    readonly newValues?: Record<string, unknown>;
    readonly ipAddress?: string;
    readonly userAgent?: string;
}
/**
 * Audit log query parameters
 */
export interface AuditLogQuery {
    readonly userId?: UUID;
    readonly resourceType?: string;
    readonly resourceId?: UUID;
    readonly actionType?: AuditActionType;
    readonly startDate?: ISODateString;
    readonly endDate?: ISODateString;
    readonly limit?: number;
    readonly cursor?: string;
}
/**
 * Change tracking for entity updates
 */
export interface ChangeSet {
    readonly field: string;
    readonly oldValue: unknown;
    readonly newValue: unknown;
}
/**
 * Calculate changes between two objects
 */
export declare function calculateChanges<T extends Record<string, unknown>>(oldObj: T, newObj: Partial<T>): ChangeSet[];
