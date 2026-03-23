import fs from 'node:fs';
import { createHash } from 'node:crypto';
import path from 'node:path';

export interface SeedSummary {
  readonly generatedAt?: string;
  readonly auditRunId: string;
  readonly auditRunKey: string;
  readonly marker: string;
  readonly ids: Record<string, string>;
  readonly verification?: unknown;
}

const repoRoot = path.resolve(__dirname, '..', '..');
const auditDbOutputDir = path.resolve(repoRoot, 'output', 'audit', 'db');

function normalizeAuditRunId(raw: string): string {
  const trimmed = raw.trim();
  if (!trimmed) {
    throw new Error('AUDIT_RUN_ID cannot be empty');
  }
  return trimmed;
}

export function resolveSeedAuditRunId(): string {
  const envRunId = process.env['AUDIT_RUN_ID'];
  if (typeof envRunId === 'string' && envRunId.trim().length > 0) {
    return normalizeAuditRunId(envRunId);
  }
  return `audit-${Date.now()}`;
}

export function toAuditRunKey(auditRunId: string): string {
  const normalized = auditRunId.replace(/[^a-zA-Z0-9]/g, '').toUpperCase();
  const key = normalized.slice(-8);
  return key.length > 0 ? key : 'AUDIT000';
}

export function toAuditMarker(auditRunId: string): string {
  return `[AUDIT_RUN_ID:${auditRunId}]`;
}

export function toAuditRunUuid(auditRunId: string): string {
  const hash = createHash('sha256').update(auditRunId).digest('hex').slice(0, 32).split('');
  // Force UUID v4-like variant bits for compatibility with uuid columns.
  hash[12] = '4';
  const variant = Number.parseInt(hash[16] ?? '0', 16);
  hash[16] = (8 + (variant % 4)).toString(16);
  const normalized = hash.join('');
  return `${normalized.slice(0, 8)}-${normalized.slice(8, 12)}-${normalized.slice(12, 16)}-${normalized.slice(16, 20)}-${normalized.slice(20, 32)}`;
}

export function getAuditDbOutputDir(): string {
  fs.mkdirSync(auditDbOutputDir, { recursive: true });
  return auditDbOutputDir;
}

export function readLatestSeedSummary(): SeedSummary | null {
  const latestPath = path.resolve(getAuditDbOutputDir(), 'seed-latest.json');
  if (!fs.existsSync(latestPath)) {
    return null;
  }
  const parsed = JSON.parse(fs.readFileSync(latestPath, 'utf8')) as SeedSummary;
  if (!parsed.auditRunId || !parsed.auditRunKey || !parsed.marker) {
    return null;
  }
  return parsed;
}

export function resolveExistingRunContext(): {
  readonly auditRunId: string;
  readonly auditRunKey: string;
  readonly marker: string;
  readonly auditRunUuid: string;
} {
  const envRunId = process.env['AUDIT_RUN_ID'];
  if (typeof envRunId === 'string' && envRunId.trim().length > 0) {
    const auditRunId = normalizeAuditRunId(envRunId);
    return {
      auditRunId,
      auditRunKey: toAuditRunKey(auditRunId),
      marker: toAuditMarker(auditRunId),
      auditRunUuid: toAuditRunUuid(auditRunId),
    };
  }

  const latest = readLatestSeedSummary();
  if (!latest) {
    throw new Error(
      'No AUDIT_RUN_ID provided and no seed-latest.json found. Run audit:seed first or set AUDIT_RUN_ID.'
    );
  }

  return {
    auditRunId: latest.auditRunId,
    auditRunKey: latest.auditRunKey,
    marker: latest.marker,
    auditRunUuid: toAuditRunUuid(latest.auditRunId),
  };
}

export function writeAuditArtifact(
  artifactName: string,
  payload: unknown,
  auditRunKey?: string
): { readonly byRunPath: string | null; readonly latestPath: string } {
  const outputDir = getAuditDbOutputDir();
  const serialized = `${JSON.stringify(payload, null, 2)}\n`;

  const latestPath = path.resolve(outputDir, `${artifactName}-latest.json`);
  fs.writeFileSync(latestPath, serialized, 'utf8');

  if (!auditRunKey) {
    return { byRunPath: null, latestPath };
  }

  const byRunPath = path.resolve(outputDir, `${artifactName}-${auditRunKey}.json`);
  fs.writeFileSync(byRunPath, serialized, 'utf8');
  return { byRunPath, latestPath };
}
