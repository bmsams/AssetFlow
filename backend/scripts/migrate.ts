#!/usr/bin/env npx ts-node
/**
 * Database Migration Runner Script
 *
 * Executes SQL migrations against Aurora PostgreSQL with Secrets Manager integration.
 * Tracks applied migrations in a schema_migrations table.
 *
 * Usage:
 *   npm run db:migrate
 *
 * Environment Variables:
 *   DB_SECRET_ARN - AWS Secrets Manager ARN for database credentials
 *   AWS_REGION - AWS region (default: us-east-1)
 *   DB_HOST - Direct database host (alternative to Secrets Manager)
 *   DB_PORT - Database port (default: 5432)
 *   DB_NAME - Database name (default: assetmgmt)
 *   DB_USERNAME - Database username
 *   DB_PASSWORD - Database password
 *   DB_SSL - Enable SSL (default: true)
 *
 * Validates: Requirements 2.1, 2.4
 */

import * as fs from 'fs';
import * as path from 'path';

import { GetSecretValueCommand, SecretsManagerClient } from '@aws-sdk/client-secrets-manager';
import { Pool, PoolConfig } from 'pg';

// ============================================================================
// Types and Interfaces
// ============================================================================

/**
 * Configuration for the migration runner
 */
export interface MigrationConfig {
  /** Secrets Manager ARN for DB credentials */
  secretArn?: string;
  /** AWS region */
  region: string;
  /** Use SSL for connection */
  sslEnabled: boolean;
  /** Direct connection config (alternative to Secrets Manager) */
  host?: string;
  port?: number;
  database?: string;
  username?: string;
  password?: string;
  /** Path to migrations directory */
  migrationsPath?: string;
}

/**
 * Result of running migrations
 */
export interface MigrationResult {
  /** Whether all migrations succeeded */
  success: boolean;
  /** List of migrations that were applied in this run */
  appliedMigrations: string[];
  /** Current schema version after migrations */
  currentVersion: string;
  /** Error message if migration failed */
  error?: string;
  /** Migration version that failed (if any) */
  failedVersion?: string;
  /** SQL context around the failure point (if any) */
  failedSqlContext?: string;
}

/**
 * Database credentials from Secrets Manager
 */
interface DatabaseCredentials {
  host: string;
  port: number;
  dbname: string;
  username: string;
  password: string;
}

/**
 * Migration file metadata
 */
interface MigrationFile {
  version: string;
  description: string;
  filename: string;
  sql: string;
}

// ============================================================================
// Secrets Manager Integration
// ============================================================================

/**
 * Fetch database credentials from AWS Secrets Manager
 */
async function getSecretValue(secretArn: string, region: string): Promise<DatabaseCredentials> {
  console.log(`Fetching credentials from Secrets Manager: ${secretArn}`);

  const client = new SecretsManagerClient({ region });
  const command = new GetSecretValueCommand({ SecretId: secretArn });

  try {
    const response = await client.send(command);

    if (!response.SecretString) {
      throw new Error('Secret value is empty');
    }

    const secret = JSON.parse(response.SecretString) as Record<string, unknown>;

    const credentials: DatabaseCredentials = {
      host: secret['host'] as string,
      port: (secret['port'] as number) ?? 5432,
      dbname: (secret['dbname'] as string) ?? (secret['database'] as string) ?? 'assetmgmt',
      username: secret['username'] as string,
      password: secret['password'] as string,
    };

    // Validate required fields
    if (!credentials.host || !credentials.username || !credentials.password) {
      throw new Error('Missing required database credentials in secret');
    }

    console.log(`Successfully retrieved credentials for host: ${credentials.host}`);
    return credentials;
  } catch (error) {
    const err = error as Error;
    console.error(`Failed to retrieve credentials: ${err.message}`);
    throw error;
  }
}

// ============================================================================
// Database Connection
// ============================================================================

/**
 * Create a database connection pool
 */
async function createPool(config: MigrationConfig): Promise<Pool> {
  let poolConfig: PoolConfig;

  if (config.secretArn) {
    // Fetch credentials from Secrets Manager
    const credentials = await getSecretValue(config.secretArn, config.region);

    poolConfig = {
      host: credentials.host,
      port: credentials.port,
      database: credentials.dbname,
      user: credentials.username,
      password: credentials.password,
      ssl: config.sslEnabled ? { rejectUnauthorized: false } : false,
      connectionTimeoutMillis: 10000,
      idleTimeoutMillis: 30000,
      max: 5,
    };
  } else if (config.host && config.username && config.password) {
    // Use direct connection config
    poolConfig = {
      host: config.host,
      port: config.port ?? 5432,
      database: config.database ?? 'assetmgmt',
      user: config.username,
      password: config.password,
      ssl: config.sslEnabled ? { rejectUnauthorized: false } : false,
      connectionTimeoutMillis: 10000,
      idleTimeoutMillis: 30000,
      max: 5,
    };
  } else {
    throw new Error(
      'Database configuration not provided. Set DB_SECRET_ARN or DB_HOST/DB_USERNAME/DB_PASSWORD environment variables.'
    );
  }

  console.log(`Connecting to database: ${poolConfig.host}:${poolConfig.port}/${poolConfig.database}`);

  const pool = new Pool(poolConfig);

  // Test connection
  try {
    const client = await pool.connect();
    await client.query('SELECT 1');
    client.release();
    console.log('Database connection established successfully');
  } catch (error) {
    const err = error as Error;
    console.error(`Failed to connect to database: ${err.message}`);
    await pool.end();
    throw error;
  }

  return pool;
}

// ============================================================================
// Schema Migrations Table
// ============================================================================

/**
 * Create the schema_migrations table if it doesn't exist
 */
async function ensureMigrationsTable(pool: Pool): Promise<void> {
  console.log('Ensuring schema_migrations table exists...');

  const createTableSQL = `
    CREATE TABLE IF NOT EXISTS schema_migrations (
      version VARCHAR(20) PRIMARY KEY,
      description VARCHAR(255) NOT NULL,
      filename VARCHAR(255) NOT NULL,
      applied_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
      checksum VARCHAR(64),
      execution_time_ms INTEGER
    );

    CREATE INDEX IF NOT EXISTS idx_schema_migrations_applied_at 
    ON schema_migrations(applied_at);

    COMMENT ON TABLE schema_migrations IS 'Tracks applied database migrations';
  `;

  try {
    await pool.query(createTableSQL);
    console.log('schema_migrations table ready');
  } catch (error) {
    const err = error as Error;
    console.error(`Failed to create schema_migrations table: ${err.message}`);
    throw error;
  }
}

/**
 * Get list of already applied migrations
 */
async function getAppliedMigrations(pool: Pool): Promise<string[]> {
  const result = await pool.query<{ version: string }>(
    'SELECT version FROM schema_migrations ORDER BY version'
  );
  return result.rows.map((row) => row.version);
}

/**
 * Record a successfully applied migration
 */
async function recordMigration(
  pool: Pool,
  migration: MigrationFile,
  executionTimeMs: number,
  checksum: string
): Promise<void> {
  await pool.query(
    `INSERT INTO schema_migrations (version, description, filename, checksum, execution_time_ms)
     VALUES ($1, $2, $3, $4, $5)`,
    [migration.version, migration.description, migration.filename, checksum, executionTimeMs]
  );
}

// ============================================================================
// Migration File Loading
// ============================================================================

/**
 * Calculate a simple checksum for migration content
 */
function calculateChecksum(content: string): string {
  let hash = 0;
  for (let i = 0; i < content.length; i++) {
    const char = content.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash; // Convert to 32bit integer
  }
  return Math.abs(hash).toString(16).padStart(8, '0');
}

/**
 * Parse migration filename to extract version and description
 * Expected format: V001__description_here.sql
 */
function parseMigrationFilename(filename: string): { version: string; description: string } | null {
  const match = filename.match(/^V(\d+)__(.+)\.sql$/);
  if (!match) {
    return null;
  }

  return {
    version: match[1]!,
    description: match[2]!.replace(/_/g, ' '),
  };
}

/**
 * Load migration files from the migrations directory
 */
async function loadMigrationFiles(migrationsPath: string): Promise<MigrationFile[]> {
  console.log(`Loading migrations from: ${migrationsPath}`);

  if (!fs.existsSync(migrationsPath)) {
    throw new Error(`Migrations directory not found: ${migrationsPath}`);
  }

  const files = fs.readdirSync(migrationsPath);
  const migrations: MigrationFile[] = [];

  for (const filename of files) {
    // Skip non-SQL files
    if (!filename.endsWith('.sql')) {
      continue;
    }

    const parsed = parseMigrationFilename(filename);
    if (!parsed) {
      console.warn(`Skipping file with invalid naming format: ${filename}`);
      continue;
    }

    const filePath = path.join(migrationsPath, filename);
    const sql = fs.readFileSync(filePath, 'utf-8');

    migrations.push({
      version: parsed.version,
      description: parsed.description,
      filename,
      sql,
    });
  }

  // Sort by version number
  migrations.sort((a, b) => {
    const versionA = parseInt(a.version, 10);
    const versionB = parseInt(b.version, 10);
    return versionA - versionB;
  });

  console.log(`Found ${migrations.length} migration files`);
  return migrations;
}

// ============================================================================
// Migration Execution
// ============================================================================

/**
 * Migration execution error with detailed context
 */
export class MigrationError extends Error {
  constructor(
    message: string,
    public readonly version: string,
    public readonly description: string,
    public readonly sqlContext: string,
    public readonly originalError: Error
  ) {
    super(message);
    this.name = 'MigrationError';
  }
}

/**
 * Extract SQL context around an error (first 500 chars for logging)
 */
function extractSqlContext(sql: string, maxLength: number = 500): string {
  if (sql.length <= maxLength) {
    return sql;
  }
  return sql.substring(0, maxLength) + '... [truncated]';
}

/**
 * Execute a single migration within a transaction
 * Implements transaction rollback on failure per Requirement 2.5
 */
async function runMigration(pool: Pool, migration: MigrationFile): Promise<number> {
  console.log(`\nApplying migration V${migration.version}: ${migration.description}`);
  console.log(`  File: ${migration.filename}`);
  console.log(`  SQL length: ${migration.sql.length} characters`);

  const client = await pool.connect();
  const startTime = Date.now();

  try {
    // Begin transaction for atomic migration
    await client.query('BEGIN');

    // Execute the migration SQL
    await client.query(migration.sql);

    // Commit transaction on success
    await client.query('COMMIT');

    const executionTimeMs = Date.now() - startTime;
    console.log(`  ✓ Migration V${migration.version} applied successfully (${executionTimeMs}ms)`);

    return executionTimeMs;
  } catch (error) {
    // Rollback transaction on failure (Requirement 2.5)
    console.error(`  ✗ Migration V${migration.version} failed, rolling back transaction...`);
    
    try {
      await client.query('ROLLBACK');
      console.log(`  ✓ Transaction rolled back successfully`);
    } catch (rollbackError) {
      const rbErr = rollbackError as Error;
      console.error(`  ✗ Rollback failed: ${rbErr.message}`);
    }

    const err = error as Error;
    const sqlContext = extractSqlContext(migration.sql);
    
    // Log detailed error information (Requirement 2.7)
    console.error('\n========================================');
    console.error('  MIGRATION ERROR DETAILS');
    console.error('========================================');
    console.error(`  Version: V${migration.version}`);
    console.error(`  Description: ${migration.description}`);
    console.error(`  Filename: ${migration.filename}`);
    console.error(`  Error Type: ${err.name}`);
    console.error(`  Error Message: ${err.message}`);
    
    // Log PostgreSQL-specific error details if available
    const pgError = err as Error & { 
      code?: string; 
      detail?: string; 
      hint?: string; 
      position?: string;
      where?: string;
      schema?: string;
      table?: string;
      column?: string;
      constraint?: string;
    };
    
    if (pgError.code) {
      console.error(`  PostgreSQL Error Code: ${pgError.code}`);
    }
    if (pgError.detail) {
      console.error(`  Detail: ${pgError.detail}`);
    }
    if (pgError.hint) {
      console.error(`  Hint: ${pgError.hint}`);
    }
    if (pgError.position) {
      console.error(`  Position: ${pgError.position}`);
    }
    if (pgError.where) {
      console.error(`  Where: ${pgError.where}`);
    }
    if (pgError.schema) {
      console.error(`  Schema: ${pgError.schema}`);
    }
    if (pgError.table) {
      console.error(`  Table: ${pgError.table}`);
    }
    if (pgError.column) {
      console.error(`  Column: ${pgError.column}`);
    }
    if (pgError.constraint) {
      console.error(`  Constraint: ${pgError.constraint}`);
    }
    
    console.error('\n  SQL Context (first 500 chars):');
    console.error('  ---');
    sqlContext.split('\n').forEach(line => console.error(`  ${line}`));
    console.error('  ---');
    console.error('========================================\n');

    // Throw a detailed MigrationError for upstream handling
    throw new MigrationError(
      `Migration V${migration.version} failed: ${err.message}`,
      migration.version,
      migration.description,
      sqlContext,
      err
    );
  } finally {
    client.release();
  }
}

// ============================================================================
// Main Migration Runner
// ============================================================================

/**
 * Run all pending database migrations
 * Returns MigrationResult with success/failure status per Requirement 2.7
 */
export async function runMigrations(config: MigrationConfig): Promise<MigrationResult> {
  console.log('\n========================================');
  console.log('  AMS Database Migration Runner');
  console.log('========================================\n');

  let pool: Pool | null = null;

  try {
    // 1. Create database connection pool
    pool = await createPool(config);

    // 2. Ensure schema_migrations table exists
    await ensureMigrationsTable(pool);

    // 3. Get list of already applied migrations
    const applied = await getAppliedMigrations(pool);
    console.log(`\nAlready applied migrations: ${applied.length > 0 ? applied.join(', ') : 'none'}`);

    // 4. Load migration files
    const migrationsPath = config.migrationsPath ?? path.resolve(__dirname, '../../migrations');
    const migrations = await loadMigrationFiles(migrationsPath);

    // 5. Filter to pending migrations
    const pending = migrations.filter((m) => !applied.includes(m.version));

    if (pending.length === 0) {
      console.log('\n✓ Database is up to date. No migrations to apply.');
      const currentVersion = migrations.length > 0 ? migrations[migrations.length - 1]!.version : '0';
      return {
        success: true,
        appliedMigrations: [],
        currentVersion,
      };
    }

    console.log(`\nPending migrations: ${pending.length}`);

    // 6. Apply pending migrations in order
    const appliedMigrations: string[] = [];

    for (const migration of pending) {
      const executionTimeMs = await runMigration(pool, migration);
      const checksum = calculateChecksum(migration.sql);

      // Record the migration
      await recordMigration(pool, migration, executionTimeMs, checksum);
      appliedMigrations.push(migration.version);
    }

    // 7. Report success
    const currentVersion = migrations[migrations.length - 1]!.version;
    console.log('\n========================================');
    console.log(`  ✓ All migrations applied successfully`);
    console.log(`  Current schema version: V${currentVersion}`);
    console.log('========================================\n');

    return {
      success: true,
      appliedMigrations,
      currentVersion,
    };
  } catch (error) {
    // Handle MigrationError with detailed context
    if (error instanceof MigrationError) {
      console.error('\n========================================');
      console.error(`  ✗ Migration failed at V${error.version}`);
      console.error(`  Description: ${error.description}`);
      console.error(`  Error: ${error.originalError.message}`);
      console.error('========================================\n');

      return {
        success: false,
        appliedMigrations: [],
        currentVersion: '',
        error: error.message,
        failedVersion: error.version,
        failedSqlContext: error.sqlContext,
      };
    }

    // Handle other errors
    const err = error as Error;
    console.error('\n========================================');
    console.error(`  ✗ Migration failed: ${err.message}`);
    console.error('========================================\n');

    return {
      success: false,
      appliedMigrations: [],
      currentVersion: '',
      error: err.message,
    };
  } finally {
    if (pool) {
      await pool.end();
      console.log('Database connection closed');
    }
  }
}

// ============================================================================
// CLI Entry Point
// ============================================================================

/**
 * Build configuration from environment variables
 */
function buildConfigFromEnv(): MigrationConfig {
  return {
    secretArn: process.env['DB_SECRET_ARN'],
    region: process.env['AWS_REGION'] ?? 'us-east-1',
    sslEnabled: process.env['DB_SSL'] !== 'false',
    host: process.env['DB_HOST'],
    port: process.env['DB_PORT'] ? parseInt(process.env['DB_PORT'], 10) : undefined,
    database: process.env['DB_NAME'],
    username: process.env['DB_USERNAME'],
    password: process.env['DB_PASSWORD'],
    migrationsPath: process.env['MIGRATIONS_PATH'],
  };
}

/**
 * Main entry point when run as a script
 */
async function main(): Promise<void> {
  const config = buildConfigFromEnv();

  // Validate that we have some form of database configuration
  if (!config.secretArn && !config.host) {
    console.error('Error: Database configuration not provided.');
    console.error('');
    console.error('Please set one of the following:');
    console.error('  1. DB_SECRET_ARN - AWS Secrets Manager ARN for database credentials');
    console.error('  2. DB_HOST, DB_USERNAME, DB_PASSWORD - Direct database connection');
    console.error('');
    console.error('Optional environment variables:');
    console.error('  AWS_REGION - AWS region (default: us-east-1)');
    console.error('  DB_PORT - Database port (default: 5432)');
    console.error('  DB_NAME - Database name (default: assetmgmt)');
    console.error('  DB_SSL - Enable SSL (default: true)');
    console.error('  MIGRATIONS_PATH - Path to migrations directory');
    process.exit(1);
  }

  const result = await runMigrations(config);

  if (!result.success) {
    process.exit(1);
  }
}

// Run if executed directly
if (require.main === module) {
  main().catch((error) => {
    console.error('Unexpected error:', error);
    process.exit(1);
  });
}
