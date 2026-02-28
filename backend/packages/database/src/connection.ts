/**
 * Database connection management with AWS Secrets Manager integration
 */

import { GetSecretValueCommand, SecretsManagerClient } from '@aws-sdk/client-secrets-manager';

import { createLogger } from '@ams/utils';

const logger = createLogger({ service: 'database' });

/**
 * Database credentials from Secrets Manager
 */
export interface DatabaseCredentials {
  readonly host: string;
  readonly port: number;
  readonly database: string;
  readonly username: string;
  readonly password: string;
}

/**
 * Database connection configuration
 */
export interface DatabaseConfig {
  readonly secretArn?: string;
  readonly host?: string;
  readonly port?: number;
  readonly database?: string;
  readonly username?: string;
  readonly password?: string;
  readonly ssl?: boolean;
  readonly connectionTimeoutMs?: number;
  readonly idleTimeoutMs?: number;
  readonly maxConnections?: number;
}

/**
 * Cached credentials to avoid repeated Secrets Manager calls
 */
let cachedCredentials: DatabaseCredentials | null = null;
let credentialsCacheTime = 0;
const CREDENTIALS_CACHE_TTL_MS = 5 * 60 * 1000; // 5 minutes

/**
 * Secrets Manager client (reused across invocations)
 */
const secretsClient = new SecretsManagerClient({});

/**
 * Get database credentials from AWS Secrets Manager
 */
export async function getCredentialsFromSecretsManager(
  secretArn: string
): Promise<DatabaseCredentials> {
  // Check cache
  const now = Date.now();
  if (cachedCredentials && now - credentialsCacheTime < CREDENTIALS_CACHE_TTL_MS) {
    logger.debug('Using cached database credentials');
    return cachedCredentials;
  }

  logger.info('Fetching database credentials from Secrets Manager');

  try {
    const command = new GetSecretValueCommand({ SecretId: secretArn });
    const response = await secretsClient.send(command);

    if (!response.SecretString) {
      throw new Error('Secret value is empty');
    }

    const secret = JSON.parse(response.SecretString) as Record<string, unknown>;

    const credentials: DatabaseCredentials = {
      host: secret['host'] as string,
      port: (secret['port'] as number) ?? 5432,
      database: secret['dbname'] as string ?? secret['database'] as string,
      username: secret['username'] as string,
      password: secret['password'] as string,
    };

    // Validate required fields
    if (!credentials.host || !credentials.username || !credentials.password) {
      throw new Error('Missing required database credentials in secret');
    }

    // Cache credentials
    cachedCredentials = credentials;
    credentialsCacheTime = now;

    logger.info('Successfully retrieved database credentials');
    return credentials;
  } catch (error) {
    logger.error('Failed to retrieve database credentials', error as Error);
    throw error;
  }
}

/**
 * Build database configuration from environment and secrets
 */
export async function buildDatabaseConfig(
  config: DatabaseConfig
): Promise<DatabaseCredentials & { ssl: boolean; connectionTimeoutMs: number; idleTimeoutMs: number; maxConnections: number }> {
  let credentials: DatabaseCredentials;

  if (config.secretArn) {
    credentials = await getCredentialsFromSecretsManager(config.secretArn);
  } else if (config.host && config.username && config.password) {
    credentials = {
      host: config.host,
      port: config.port ?? 5432,
      database: config.database ?? 'ams',
      username: config.username,
      password: config.password,
    };
  } else {
    // Try environment variables
    const host = process.env['DB_HOST'];
    const username = process.env['DB_USERNAME'];
    const password = process.env['DB_PASSWORD'];
    const secretArn = process.env['DB_SECRET_ARN'];

    if (secretArn) {
      credentials = await getCredentialsFromSecretsManager(secretArn);
    } else if (host && username && password) {
      credentials = {
        host,
        port: parseInt(process.env['DB_PORT'] ?? '5432', 10),
        database: process.env['DB_NAME'] ?? 'ams',
        username,
        password,
      };
    } else {
      throw new Error(
        'Database configuration not provided. Set DB_SECRET_ARN or DB_HOST/DB_USERNAME/DB_PASSWORD environment variables.'
      );
    }
  }

  return {
    ...credentials,
    ssl: config.ssl ?? process.env['DB_SSL'] !== 'false',
    connectionTimeoutMs: config.connectionTimeoutMs ?? 10000,
    idleTimeoutMs: config.idleTimeoutMs ?? 30000,
    maxConnections: config.maxConnections ?? 10,
  };
}

/**
 * Clear cached credentials (useful for testing or credential rotation)
 */
export function clearCredentialsCache(): void {
  cachedCredentials = null;
  credentialsCacheTime = 0;
  logger.info('Database credentials cache cleared');
}

/**
 * Build PostgreSQL connection string
 */
export function buildConnectionString(credentials: DatabaseCredentials, ssl = true): string {
  const { host, port, database, username, password } = credentials;
  const sslParam = ssl ? '?sslmode=require' : '';
  return `postgresql://${encodeURIComponent(username)}:${encodeURIComponent(password)}@${host}:${port}/${database}${sslParam}`;
}
