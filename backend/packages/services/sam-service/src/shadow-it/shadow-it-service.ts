/**
 * Shadow IT Service - Business logic for shadow IT detection
 *
 * Implements:
 * - Analyze network traffic logs to identify unauthorized SaaS application usage (Requirement 4.8)
 * - Create alerts with application details and user information (Requirement 4.9)
 *
 * Requirements: 4.8, 4.9
 */

import type { UUID } from '@ams/types';
import * as cache from '@ams/cache';
import { publishEvent } from '@ams/events';
import { createLogger, now } from '@ams/utils';
import { v4 as uuidv4 } from 'uuid';

import type {
  ApplicationCategory,
  CreateShadowITAlertRequest,
  KnownApplication,
  RiskLevel,
  ShadowITAlert,
  ShadowITDetection,
  ShadowITStatus,
  TrafficLogEntry,
  UserAccessRecord,
} from './shadow-it-repository';
import * as repository from './shadow-it-repository';

const logger = createLogger({ service: 'shadow-it-service' });

/**
 * Cache keys
 */
function shadowITSummaryCacheKey(): string {
  return 'shadow-it:summary';
}

function approvedAppsCacheKey(): string {
  return 'shadow-it:approved-apps';
}

/**
 * Domain categorization patterns for common SaaS applications
 */
const DOMAIN_CATEGORIES: Record<string, { category: ApplicationCategory; riskLevel: RiskLevel; name: string }> = {
  // File Sharing - Higher risk due to data exfiltration potential
  'dropbox.com': { category: 'FILE_SHARING', riskLevel: 'HIGH', name: 'Dropbox' },
  'drive.google.com': { category: 'FILE_SHARING', riskLevel: 'MEDIUM', name: 'Google Drive' },
  'box.com': { category: 'FILE_SHARING', riskLevel: 'MEDIUM', name: 'Box' },
  'wetransfer.com': { category: 'FILE_SHARING', riskLevel: 'HIGH', name: 'WeTransfer' },
  'mega.nz': { category: 'FILE_SHARING', riskLevel: 'CRITICAL', name: 'MEGA' },
  'mediafire.com': { category: 'FILE_SHARING', riskLevel: 'HIGH', name: 'MediaFire' },
  
  // Collaboration
  'slack.com': { category: 'COLLABORATION', riskLevel: 'MEDIUM', name: 'Slack' },
  'discord.com': { category: 'COLLABORATION', riskLevel: 'HIGH', name: 'Discord' },
  'notion.so': { category: 'COLLABORATION', riskLevel: 'MEDIUM', name: 'Notion' },
  'trello.com': { category: 'COLLABORATION', riskLevel: 'LOW', name: 'Trello' },
  'asana.com': { category: 'COLLABORATION', riskLevel: 'LOW', name: 'Asana' },
  'monday.com': { category: 'COLLABORATION', riskLevel: 'LOW', name: 'Monday.com' },
  'miro.com': { category: 'COLLABORATION', riskLevel: 'LOW', name: 'Miro' },
  
  // Development
  'github.com': { category: 'DEVELOPMENT', riskLevel: 'MEDIUM', name: 'GitHub' },
  'gitlab.com': { category: 'DEVELOPMENT', riskLevel: 'MEDIUM', name: 'GitLab' },
  'bitbucket.org': { category: 'DEVELOPMENT', riskLevel: 'MEDIUM', name: 'Bitbucket' },
  'replit.com': { category: 'DEVELOPMENT', riskLevel: 'HIGH', name: 'Replit' },
  'codepen.io': { category: 'DEVELOPMENT', riskLevel: 'LOW', name: 'CodePen' },
  'stackblitz.com': { category: 'DEVELOPMENT', riskLevel: 'MEDIUM', name: 'StackBlitz' },
  
  // Communication
  'zoom.us': { category: 'COMMUNICATION', riskLevel: 'MEDIUM', name: 'Zoom' },
  'webex.com': { category: 'COMMUNICATION', riskLevel: 'LOW', name: 'Webex' },
  'meet.google.com': { category: 'COMMUNICATION', riskLevel: 'LOW', name: 'Google Meet' },
  'whatsapp.com': { category: 'COMMUNICATION', riskLevel: 'HIGH', name: 'WhatsApp' },
  'telegram.org': { category: 'COMMUNICATION', riskLevel: 'HIGH', name: 'Telegram' },
  'signal.org': { category: 'COMMUNICATION', riskLevel: 'MEDIUM', name: 'Signal' },
  
  // Productivity
  'canva.com': { category: 'PRODUCTIVITY', riskLevel: 'LOW', name: 'Canva' },
  'figma.com': { category: 'PRODUCTIVITY', riskLevel: 'LOW', name: 'Figma' },
  'airtable.com': { category: 'PRODUCTIVITY', riskLevel: 'MEDIUM', name: 'Airtable' },
  'clickup.com': { category: 'PRODUCTIVITY', riskLevel: 'LOW', name: 'ClickUp' },
  
  // Social Media - High risk for data leakage
  'facebook.com': { category: 'SOCIAL_MEDIA', riskLevel: 'HIGH', name: 'Facebook' },
  'twitter.com': { category: 'SOCIAL_MEDIA', riskLevel: 'MEDIUM', name: 'Twitter/X' },
  'linkedin.com': { category: 'SOCIAL_MEDIA', riskLevel: 'LOW', name: 'LinkedIn' },
  'instagram.com': { category: 'SOCIAL_MEDIA', riskLevel: 'HIGH', name: 'Instagram' },
  'tiktok.com': { category: 'SOCIAL_MEDIA', riskLevel: 'CRITICAL', name: 'TikTok' },
  'reddit.com': { category: 'SOCIAL_MEDIA', riskLevel: 'MEDIUM', name: 'Reddit' },
  
  // Entertainment
  'youtube.com': { category: 'ENTERTAINMENT', riskLevel: 'LOW', name: 'YouTube' },
  'netflix.com': { category: 'ENTERTAINMENT', riskLevel: 'LOW', name: 'Netflix' },
  'spotify.com': { category: 'ENTERTAINMENT', riskLevel: 'LOW', name: 'Spotify' },
  'twitch.tv': { category: 'ENTERTAINMENT', riskLevel: 'MEDIUM', name: 'Twitch' },
  
  // AI Services - High risk for data exposure
  'chat.openai.com': { category: 'PRODUCTIVITY', riskLevel: 'HIGH', name: 'ChatGPT' },
  'openai.com': { category: 'PRODUCTIVITY', riskLevel: 'HIGH', name: 'OpenAI' },
  'claude.ai': { category: 'PRODUCTIVITY', riskLevel: 'HIGH', name: 'Claude' },
  'bard.google.com': { category: 'PRODUCTIVITY', riskLevel: 'MEDIUM', name: 'Google Bard' },
  'copilot.microsoft.com': { category: 'PRODUCTIVITY', riskLevel: 'MEDIUM', name: 'Microsoft Copilot' },
  
  // Analytics
  'mixpanel.com': { category: 'ANALYTICS', riskLevel: 'MEDIUM', name: 'Mixpanel' },
  'amplitude.com': { category: 'ANALYTICS', riskLevel: 'MEDIUM', name: 'Amplitude' },
  'hotjar.com': { category: 'ANALYTICS', riskLevel: 'MEDIUM', name: 'Hotjar' },
  
  // Marketing
  'mailchimp.com': { category: 'MARKETING', riskLevel: 'MEDIUM', name: 'Mailchimp' },
  'hubspot.com': { category: 'MARKETING', riskLevel: 'LOW', name: 'HubSpot' },
  'sendgrid.com': { category: 'MARKETING', riskLevel: 'MEDIUM', name: 'SendGrid' },
  
  // Finance
  'stripe.com': { category: 'FINANCE', riskLevel: 'MEDIUM', name: 'Stripe' },
  'paypal.com': { category: 'FINANCE', riskLevel: 'MEDIUM', name: 'PayPal' },
  'venmo.com': { category: 'FINANCE', riskLevel: 'HIGH', name: 'Venmo' },
  
  // CRM
  'salesforce.com': { category: 'CRM', riskLevel: 'LOW', name: 'Salesforce' },
  'pipedrive.com': { category: 'CRM', riskLevel: 'LOW', name: 'Pipedrive' },
  'zoho.com': { category: 'CRM', riskLevel: 'LOW', name: 'Zoho' },
};

/**
 * Result of analyzing traffic logs
 */
export interface AnalyzeShadowITResult {
  readonly analysisId: UUID;
  readonly startedAt: string;
  readonly completedAt: string;
  readonly logsAnalyzed: number;
  readonly uniqueDomainsFound: number;
  readonly shadowITDetected: number;
  readonly alertsGenerated: number;
  readonly detections: readonly ShadowITDetection[];
  readonly alerts: readonly ShadowITAlert[];
}

/**
 * Aggregated domain access data
 */
interface DomainAccessData {
  domain: string;
  applicationName: string;
  category: ApplicationCategory;
  riskLevel: RiskLevel;
  users: Map<string, UserAccessRecord>;
  totalBytes: number;
  totalAccesses: number;
  firstSeen: string;
  lastSeen: string;
}

/**
 * Get approved applications (cached)
 */
async function getApprovedApplicationsSet(): Promise<Set<string>> {
  const cacheKey = approvedAppsCacheKey();
  const cached = await cache.get<string[]>(cacheKey);

  if (cached) {
    return new Set(cached.map((d) => d.toLowerCase()));
  }

  const approvedApps = await repository.getApprovedApplications();
  const domains = approvedApps.flatMap((app) => [
    app.domain.toLowerCase(),
    ...app.domainPatterns.map((p) => p.toLowerCase().replace(/%/g, '')),
  ]);

  await cache.set(cacheKey, domains, cache.DEFAULT_TTL.MEDIUM);

  return new Set(domains);
}

/**
 * Extract base domain from URL or full domain
 */
function extractBaseDomain(domainOrUrl: string): string {
  let domain = domainOrUrl.toLowerCase();

  // Remove protocol if present
  domain = domain.replace(/^https?:\/\//, '');

  // Remove path and query string
  domain = domain.split('/')[0] ?? domain;
  domain = domain.split('?')[0] ?? domain;

  // Remove port
  domain = domain.split(':')[0] ?? domain;

  // Remove www prefix
  domain = domain.replace(/^www\./, '');

  return domain;
}

/**
 * Categorize a domain
 */
function categorizeDomain(domain: string): { category: ApplicationCategory; riskLevel: RiskLevel; name: string } | null {
  const baseDomain = extractBaseDomain(domain);

  // Check exact match first
  if (DOMAIN_CATEGORIES[baseDomain]) {
    return DOMAIN_CATEGORIES[baseDomain];
  }

  // Check if domain ends with any known domain
  for (const [knownDomain, info] of Object.entries(DOMAIN_CATEGORIES)) {
    if (baseDomain.endsWith(`.${knownDomain}`) || baseDomain === knownDomain) {
      return info;
    }
  }

  return null;
}

/**
 * Calculate risk level based on various factors
 */
function calculateRiskLevel(
  baseRisk: RiskLevel,
  bytesTransferred: number,
  accessCount: number,
  userCount: number
): RiskLevel {
  let riskScore = 0;

  // Base risk score
  switch (baseRisk) {
    case 'LOW':
      riskScore = 1;
      break;
    case 'MEDIUM':
      riskScore = 2;
      break;
    case 'HIGH':
      riskScore = 3;
      break;
    case 'CRITICAL':
      riskScore = 4;
      break;
  }

  // Increase risk based on data transfer (potential data exfiltration)
  if (bytesTransferred > 100 * 1024 * 1024) {
    // > 100MB
    riskScore += 2;
  } else if (bytesTransferred > 10 * 1024 * 1024) {
    // > 10MB
    riskScore += 1;
  }

  // Increase risk based on access frequency
  if (accessCount > 1000) {
    riskScore += 1;
  }

  // Increase risk based on number of users (widespread usage)
  if (userCount > 10) {
    riskScore += 1;
  }

  // Map score back to risk level
  if (riskScore >= 5) return 'CRITICAL';
  if (riskScore >= 4) return 'HIGH';
  if (riskScore >= 2) return 'MEDIUM';
  return 'LOW';
}

/**
 * Analyze traffic logs to detect shadow IT
 * Requirement 4.8: Analyze network traffic logs to identify unauthorized SaaS application usage
 *
 * @param trafficLogs - Array of traffic log entries to analyze
 * @returns Analysis result with detections and alerts
 */
export async function analyzeShadowIT(
  trafficLogs: readonly TrafficLogEntry[]
): Promise<AnalyzeShadowITResult> {
  const analysisId = uuidv4();
  const startedAt = now();

  logger.info('Starting shadow IT analysis', {
    analysisId,
    logCount: trafficLogs.length,
  });

  if (trafficLogs.length === 0) {
    return {
      analysisId,
      startedAt,
      completedAt: now(),
      logsAnalyzed: 0,
      uniqueDomainsFound: 0,
      shadowITDetected: 0,
      alertsGenerated: 0,
      detections: [],
      alerts: [],
    };
  }

  // Get approved applications
  const approvedDomains = await getApprovedApplicationsSet();

  // Aggregate traffic by domain
  const domainData = new Map<string, DomainAccessData>();

  for (const log of trafficLogs) {
    const baseDomain = extractBaseDomain(log.destinationDomain);

    // Skip if domain is approved
    if (approvedDomains.has(baseDomain)) {
      continue;
    }

    // Check if this is a known SaaS application
    const categoryInfo = categorizeDomain(baseDomain);
    if (!categoryInfo) {
      // Skip unknown domains (not SaaS applications we track)
      continue;
    }

    // Get or create domain data
    let data = domainData.get(baseDomain);
    if (!data) {
      data = {
        domain: baseDomain,
        applicationName: categoryInfo.name,
        category: categoryInfo.category,
        riskLevel: categoryInfo.riskLevel,
        users: new Map(),
        totalBytes: 0,
        totalAccesses: 0,
        firstSeen: log.timestamp,
        lastSeen: log.timestamp,
      };
      domainData.set(baseDomain, data);
    }

    // Update domain data
    data.totalBytes += log.bytesTransferred;
    data.totalAccesses += 1;
    if (log.timestamp < data.firstSeen) data.firstSeen = log.timestamp;
    if (log.timestamp > data.lastSeen) data.lastSeen = log.timestamp;

    // Update user data
    let userData = data.users.get(log.userId);
    if (!userData) {
      userData = {
        userId: log.userId,
        userEmail: null,
        accessCount: 0,
        bytesTransferred: 0,
        firstAccessAt: log.timestamp,
        lastAccessAt: log.timestamp,
      };
      data.users.set(log.userId, userData);
    }

    // Update user record (need to create new object since it's readonly)
    data.users.set(log.userId, {
      ...userData,
      accessCount: userData.accessCount + 1,
      bytesTransferred: userData.bytesTransferred + log.bytesTransferred,
      firstAccessAt: log.timestamp < userData.firstAccessAt ? log.timestamp : userData.firstAccessAt,
      lastAccessAt: log.timestamp > userData.lastAccessAt ? log.timestamp : userData.lastAccessAt,
    });
  }

  // Create detections and alerts
  const detections: ShadowITDetection[] = [];
  const alerts: ShadowITAlert[] = [];

  for (const [, data] of domainData) {
    // Calculate final risk level
    const finalRiskLevel = calculateRiskLevel(
      data.riskLevel,
      data.totalBytes,
      data.totalAccesses,
      data.users.size
    );

    // Create or update detection
    const detection = await repository.upsertDetection({
      applicationName: data.applicationName,
      applicationDomain: data.domain,
      category: data.category,
      riskLevel: finalRiskLevel,
      usersAffected: Array.from(data.users.keys()),
      totalBytesTransferred: data.totalBytes,
      accessCount: data.totalAccesses,
      firstDetectedAt: data.firstSeen,
    });

    detections.push(detection);

    // Publish detection event
    await publishEvent('SHADOW_IT_DETECTED', {
      detectionId: detection.detectionId,
      applicationName: data.applicationName,
      applicationDomain: data.domain,
      category: data.category,
      riskLevel: finalRiskLevel,
      usersAffected: data.users.size,
      totalBytesTransferred: data.totalBytes,
      accessCount: data.totalAccesses,
    });

    // Create alerts for each user (Requirement 4.9)
    for (const [userId, userData] of data.users) {
      // Check if alert already exists for this user/detection
      const hasAlert = await repository.hasExistingAlert(detection.detectionId, userId);
      if (hasAlert) {
        continue;
      }

      const alertRequest: CreateShadowITAlertRequest = {
        detectionId: detection.detectionId,
        applicationName: data.applicationName,
        applicationDomain: data.domain,
        userId,
        userEmail: userData.userEmail ?? undefined,
        riskLevel: finalRiskLevel,
        accessCount: userData.accessCount,
        bytesTransferred: userData.bytesTransferred,
        firstAccessAt: userData.firstAccessAt,
        lastAccessAt: userData.lastAccessAt,
      };

      const alert = await repository.createAlert(alertRequest);
      alerts.push(alert);

      // Publish alert event
      await publishEvent('SHADOW_IT_ALERT_CREATED', {
        alertId: alert.alertId,
        detectionId: detection.detectionId,
        applicationName: data.applicationName,
        applicationDomain: data.domain,
        userId,
        riskLevel: finalRiskLevel,
        accessCount: userData.accessCount,
        bytesTransferred: userData.bytesTransferred,
      });
    }
  }

  const completedAt = now();

  // Invalidate cache
  await cache.del(shadowITSummaryCacheKey());

  // Publish analysis completed event
  await publishEvent('SHADOW_IT_ANALYSIS_COMPLETED', {
    analysisId,
    startedAt,
    completedAt,
    logsAnalyzed: trafficLogs.length,
    uniqueDomainsFound: domainData.size,
    shadowITDetected: detections.length,
    alertsGenerated: alerts.length,
  });

  logger.info('Shadow IT analysis completed', {
    analysisId,
    logsAnalyzed: trafficLogs.length,
    uniqueDomainsFound: domainData.size,
    shadowITDetected: detections.length,
    alertsGenerated: alerts.length,
  });

  return {
    analysisId,
    startedAt,
    completedAt,
    logsAnalyzed: trafficLogs.length,
    uniqueDomainsFound: domainData.size,
    shadowITDetected: detections.length,
    alertsGenerated: alerts.length,
    detections,
    alerts,
  };
}

/**
 * Get shadow IT detection by ID
 */
export async function getDetection(detectionId: UUID): Promise<ShadowITDetection | null> {
  return repository.getDetectionById(detectionId);
}

/**
 * Get shadow IT detections
 */
export async function getDetections(
  status?: ShadowITStatus | ShadowITStatus[],
  limit = 100
): Promise<ShadowITDetection[]> {
  return repository.getDetections(status, limit);
}

/**
 * Update detection status (approve, block, or mark under review)
 */
export async function updateDetectionStatus(
  detectionId: UUID,
  status: ShadowITStatus,
  reviewedBy: UUID,
  reviewNotes?: string
): Promise<ShadowITDetection> {
  logger.info('Updating shadow IT detection status', {
    detectionId,
    status,
    reviewedBy,
  });

  const detection = await repository.updateDetectionStatus(
    detectionId,
    status,
    reviewedBy,
    reviewNotes
  );

  // Invalidate cache
  await cache.del(shadowITSummaryCacheKey());
  if (status === 'APPROVED') {
    await cache.del(approvedAppsCacheKey());
  }

  // Publish status change event
  await publishEvent('SHADOW_IT_STATUS_CHANGED', {
    detectionId,
    applicationName: detection.applicationName,
    applicationDomain: detection.applicationDomain,
    previousStatus: 'DETECTED', // We don't track previous status, assume DETECTED
    newStatus: status,
    reviewedBy,
    reviewNotes,
  });

  return detection;
}

/**
 * Get shadow IT alert by ID
 */
export async function getAlert(alertId: UUID): Promise<ShadowITAlert | null> {
  return repository.getAlertById(alertId);
}

/**
 * Get alerts by detection
 */
export async function getAlertsByDetection(detectionId: UUID): Promise<ShadowITAlert[]> {
  return repository.getAlertsByDetectionId(detectionId);
}

/**
 * Get alerts by user
 */
export async function getAlertsByUser(userId: UUID): Promise<ShadowITAlert[]> {
  return repository.getAlertsByUserId(userId);
}

/**
 * Get alerts by status
 */
export async function getAlertsByStatus(
  status: ShadowITAlert['status'] | ShadowITAlert['status'][],
  limit = 100
): Promise<ShadowITAlert[]> {
  return repository.getAlertsByStatus(status, limit);
}

/**
 * Acknowledge alert
 */
export async function acknowledgeAlert(
  alertId: UUID,
  acknowledgedBy: UUID,
  notes?: string
): Promise<ShadowITAlert> {
  logger.info('Acknowledging shadow IT alert', { alertId, acknowledgedBy });

  const alert = await repository.updateAlertStatus(alertId, 'ACKNOWLEDGED', acknowledgedBy, notes);

  await cache.del(shadowITSummaryCacheKey());

  await publishEvent('SHADOW_IT_ALERT_ACKNOWLEDGED', {
    alertId,
    detectionId: alert.detectionId,
    acknowledgedBy,
    notes,
  });

  return alert;
}

/**
 * Resolve alert
 */
export async function resolveAlert(
  alertId: UUID,
  resolvedBy: UUID,
  notes?: string
): Promise<ShadowITAlert> {
  logger.info('Resolving shadow IT alert', { alertId, resolvedBy });

  const alert = await repository.updateAlertStatus(alertId, 'RESOLVED', resolvedBy, notes);

  await cache.del(shadowITSummaryCacheKey());

  await publishEvent('SHADOW_IT_ALERT_RESOLVED', {
    alertId,
    detectionId: alert.detectionId,
    resolvedBy,
    notes,
  });

  return alert;
}

/**
 * Ignore alert
 */
export async function ignoreAlert(
  alertId: UUID,
  ignoredBy: UUID,
  notes?: string
): Promise<ShadowITAlert> {
  logger.info('Ignoring shadow IT alert', { alertId, ignoredBy });

  const alert = await repository.updateAlertStatus(alertId, 'IGNORED', ignoredBy, notes);

  await cache.del(shadowITSummaryCacheKey());

  await publishEvent('SHADOW_IT_ALERT_IGNORED', {
    alertId,
    detectionId: alert.detectionId,
    ignoredBy,
    notes,
  });

  return alert;
}

/**
 * Get known applications
 */
export async function getKnownApplications(): Promise<KnownApplication[]> {
  return repository.getKnownApplications();
}

/**
 * Get approved applications
 */
export async function getApprovedApplications(): Promise<KnownApplication[]> {
  return repository.getApprovedApplications();
}

/**
 * Get blocked applications
 */
export async function getBlockedApplications(): Promise<KnownApplication[]> {
  return repository.getBlockedApplications();
}

/**
 * Get shadow IT summary statistics
 */
export async function getShadowITSummary(): Promise<{
  totalDetections: number;
  byStatus: Record<string, number>;
  byRiskLevel: Record<string, number>;
  byCategory: Record<string, number>;
  totalUsersAffected: number;
  totalAlerts: number;
  newAlerts: number;
}> {
  // Try cache first
  const cacheKey = shadowITSummaryCacheKey();
  const cached = await cache.get<{
    totalDetections: number;
    byStatus: Record<string, number>;
    byRiskLevel: Record<string, number>;
    byCategory: Record<string, number>;
    totalUsersAffected: number;
    totalAlerts: number;
    newAlerts: number;
  }>(cacheKey);

  if (cached) {
    return cached;
  }

  const summary = await repository.getShadowITSummary();

  // Cache the result
  await cache.set(cacheKey, summary, cache.DEFAULT_TTL.SHORT);

  return summary;
}

// Re-export types
export type {
  ApplicationCategory,
  CreateShadowITAlertRequest,
  CreateShadowITDetectionRequest,
  KnownApplication,
  RiskLevel,
  ShadowITAlert,
  ShadowITDetection,
  ShadowITStatus,
  TrafficLogEntry,
  UserAccessRecord,
} from './shadow-it-repository';
