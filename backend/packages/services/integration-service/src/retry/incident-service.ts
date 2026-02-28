/**
 * Incident Service for Integration Failures
 *
 * Creates incident tickets when integrations fail after maximum retries.
 * Provides alerting and tracking for integration issues.
 *
 * Requirements:
 * - 7.9: Create incident ticket and alert administrators after max retries
 */

import { createLogger } from '@ams/utils';
import { v4 as uuidv4 } from 'uuid';

import type {
  CreateIncidentRequest,
  ErrorSeverity,
  IntegrationError,
  IntegrationIncident,
  IntegrationType,
} from './retry-types';

const logger = createLogger({ service: 'incident-service' });

/**
 * In-memory incident store (would be replaced with database in production)
 */
const incidentStore = new Map<string, IntegrationIncident>();
let incidentCounter = 0;

/**
 * Generate a unique incident number
 */
function generateIncidentNumber(): string {
  incidentCounter++;
  const date = new Date();
  const dateStr = date.toISOString().slice(0, 10).replace(/-/g, '');
  return `INC${dateStr}${String(incidentCounter).padStart(5, '0')}`;
}

/**
 * Get severity priority for sorting
 */
function getSeverityPriority(severity: ErrorSeverity): number {
  const priorities: Record<ErrorSeverity, number> = {
    CRITICAL: 4,
    HIGH: 3,
    MEDIUM: 2,
    LOW: 1,
  };
  return priorities[severity];
}

/**
 * Format integration type for display
 */
function formatIntegrationType(integrationType: IntegrationType): string {
  const names: Record<IntegrationType, string> = {
    DISCOVERY_SCCM: 'SCCM Discovery',
    DISCOVERY_JAMF: 'Jamf Discovery',
    DISCOVERY_TANIUM: 'Tanium Discovery',
    ERP_SAP: 'SAP ERP',
    ERP_ORACLE: 'Oracle ERP',
    ERP_WORKDAY: 'Workday ERP',
    VENDOR_CDW: 'CDW Vendor',
    VENDOR_INSIGHT: 'Insight Vendor',
  };
  return names[integrationType] || integrationType;
}

/**
 * Build incident description from errors
 */
function buildIncidentDescription(
  integrationType: IntegrationType,
  errors: readonly IntegrationError[],
  metadata?: Record<string, unknown>
): string {
  const lines: string[] = [
    `Integration failures detected for ${formatIntegrationType(integrationType)}.`,
    '',
    '## Error Summary',
    `- Total Errors: ${errors.length}`,
    `- First Error: ${errors[0]?.timestamp || 'N/A'}`,
    `- Last Error: ${errors[errors.length - 1]?.timestamp || 'N/A'}`,
    '',
    '## Error Details',
  ];

  for (const error of errors.slice(0, 10)) {
    lines.push(`### Attempt ${error.attempt}/${error.maxAttempts}`);
    lines.push(`- **Error Code**: ${error.errorCode}`);
    lines.push(`- **Category**: ${error.errorCategory}`);
    lines.push(`- **Message**: ${error.errorMessage}`);
    lines.push(`- **Timestamp**: ${error.timestamp}`);
    lines.push('');
  }

  if (errors.length > 10) {
    lines.push(`... and ${errors.length - 10} more errors`);
    lines.push('');
  }

  if (metadata && Object.keys(metadata).length > 0) {
    lines.push('## Additional Context');
    for (const [key, value] of Object.entries(metadata)) {
      lines.push(`- **${key}**: ${JSON.stringify(value)}`);
    }
  }

  return lines.join('\n');
}

/**
 * Create an incident ticket for integration failure
 */
export async function createIncident(
  request: CreateIncidentRequest
): Promise<IntegrationIncident> {
  const incidentId = uuidv4();
  const incidentNumber = generateIncidentNumber();
  const now = new Date().toISOString();

  const description = request.description || buildIncidentDescription(
    request.integrationType,
    request.errors,
    request.metadata
  );

  const incident: IntegrationIncident = {
    incidentId,
    incidentNumber,
    integrationType: request.integrationType,
    title: request.title,
    description,
    severity: request.severity,
    status: 'OPEN',
    errors: request.errors,
    auditLogs: request.auditLogs ?? [],
    createdAt: now,
    updatedAt: now,
  };

  // Store incident
  incidentStore.set(incidentId, incident);

  logger.warn('Integration incident created', {
    incidentId,
    incidentNumber,
    integrationType: request.integrationType,
    severity: request.severity,
    title: request.title,
    errorCount: request.errors.length,
  });

  // In production, this would:
  // 1. Store in database
  // 2. Send notifications (email, Slack, PagerDuty)
  // 3. Create ticket in ITSM system (for example, Jira)
  await notifyAdministrators(incident);

  return incident;
}

/**
 * Create an incident from retry exhaustion
 */
export async function createIncidentFromRetryExhaustion(
  integrationType: IntegrationType,
  operation: string,
  errors: readonly IntegrationError[],
  severity: ErrorSeverity = 'HIGH'
): Promise<IntegrationIncident> {
  const title = `${formatIntegrationType(integrationType)} Integration Failed - ${operation}`;

  return createIncident({
    integrationType,
    title,
    description: buildIncidentDescription(integrationType, errors),
    severity,
    errors,
  });
}

/**
 * Get incident by ID
 */
export async function getIncident(incidentId: string): Promise<IntegrationIncident | null> {
  return incidentStore.get(incidentId) ?? null;
}

/**
 * Get incident by number
 */
export async function getIncidentByNumber(
  incidentNumber: string
): Promise<IntegrationIncident | null> {
  for (const incident of incidentStore.values()) {
    if (incident.incidentNumber === incidentNumber) {
      return incident;
    }
  }
  return null;
}

/**
 * Get all incidents for an integration type
 */
export async function getIncidentsByIntegrationType(
  integrationType: IntegrationType
): Promise<IntegrationIncident[]> {
  const incidents: IntegrationIncident[] = [];
  for (const incident of incidentStore.values()) {
    if (incident.integrationType === integrationType) {
      incidents.push(incident);
    }
  }
  return incidents.sort(
    (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
  );
}

/**
 * Get all open incidents
 */
export async function getOpenIncidents(): Promise<IntegrationIncident[]> {
  const incidents: IntegrationIncident[] = [];
  for (const incident of incidentStore.values()) {
    if (incident.status === 'OPEN' || incident.status === 'IN_PROGRESS') {
      incidents.push(incident);
    }
  }
  return incidents.sort(
    (a, b) => getSeverityPriority(b.severity) - getSeverityPriority(a.severity)
  );
}

/**
 * Update incident status
 */
export async function updateIncidentStatus(
  incidentId: string,
  status: IntegrationIncident['status'],
  assignedTo?: string
): Promise<IntegrationIncident | null> {
  const incident = incidentStore.get(incidentId);
  if (!incident) {
    return null;
  }

  const now = new Date().toISOString();
  const updatedIncident: IntegrationIncident = {
    ...incident,
    status,
    assignedTo: assignedTo ?? incident.assignedTo,
    updatedAt: now,
    resolvedAt: status === 'RESOLVED' || status === 'CLOSED' ? now : incident.resolvedAt,
  };

  incidentStore.set(incidentId, updatedIncident);

  logger.info('Incident status updated', {
    incidentId,
    incidentNumber: incident.incidentNumber,
    previousStatus: incident.status,
    newStatus: status,
    assignedTo,
  });

  return updatedIncident;
}

/**
 * Resolve an incident
 */
export async function resolveIncident(
  incidentId: string,
  resolution?: string
): Promise<IntegrationIncident | null> {
  const incident = incidentStore.get(incidentId);
  if (!incident) {
    return null;
  }

  const now = new Date().toISOString();
  const updatedIncident: IntegrationIncident = {
    ...incident,
    status: 'RESOLVED',
    description: resolution
      ? `${incident.description}\n\n## Resolution\n${resolution}`
      : incident.description,
    updatedAt: now,
    resolvedAt: now,
  };

  incidentStore.set(incidentId, updatedIncident);

  logger.info('Incident resolved', {
    incidentId,
    incidentNumber: incident.incidentNumber,
    integrationType: incident.integrationType,
  });

  return updatedIncident;
}

/**
 * Get incident statistics
 */
export async function getIncidentStatistics(): Promise<{
  total: number;
  open: number;
  inProgress: number;
  resolved: number;
  closed: number;
  bySeverity: Record<ErrorSeverity, number>;
  byIntegrationType: Record<string, number>;
}> {
  const stats = {
    total: 0,
    open: 0,
    inProgress: 0,
    resolved: 0,
    closed: 0,
    bySeverity: {
      CRITICAL: 0,
      HIGH: 0,
      MEDIUM: 0,
      LOW: 0,
    } as Record<ErrorSeverity, number>,
    byIntegrationType: {} as Record<string, number>,
  };

  for (const incident of incidentStore.values()) {
    stats.total++;
    
    switch (incident.status) {
      case 'OPEN':
        stats.open++;
        break;
      case 'IN_PROGRESS':
        stats.inProgress++;
        break;
      case 'RESOLVED':
        stats.resolved++;
        break;
      case 'CLOSED':
        stats.closed++;
        break;
    }

    stats.bySeverity[incident.severity]++;
    stats.byIntegrationType[incident.integrationType] =
      (stats.byIntegrationType[incident.integrationType] || 0) + 1;
  }

  return stats;
}

/**
 * Notify administrators about a new incident
 * In production, this would integrate with notification services
 */
async function notifyAdministrators(incident: IntegrationIncident): Promise<void> {
  // Log notification (in production, send actual notifications)
  logger.info('Administrator notification sent', {
    incidentId: incident.incidentId,
    incidentNumber: incident.incidentNumber,
    severity: incident.severity,
    integrationType: incident.integrationType,
    title: incident.title,
  });

  // In production, implement:
  // - Email notifications
  // - Slack/Teams webhooks
  // - PagerDuty alerts for CRITICAL severity
  // - SNS topic publishing
}

/**
 * Clear all incidents (for testing)
 */
export function clearAllIncidents(): void {
  incidentStore.clear();
  incidentCounter = 0;
}
