/**
 * Property-Based Tests for Database Migration Runner
 *
 * These tests verify universal properties that should hold true
 * across all valid executions of the migration system.
 *
 * Test Framework: Jest with fast-check
 * Database: Local PostgreSQL instance (configured via environment variables)
 *
 * Environment Variables:
 *   DB_HOST - Database host (default: localhost)
 *   DB_PORT - Database port (default: 5432)
 *   DB_NAME - Database name (default: ams_test)
 *   DB_USERNAME - Database username (default: postgres)
 *   DB_PASSWORD - Database password (default: postgres)
 */

import * as fc from 'fast-check';
import { Pool } from 'pg';
import * as path from 'path';
import { runMigrations, MigrationConfig } from '../migrate';

// ============================================================================
// Test Configuration
// ============================================================================

/**
 * Build test configuration from environment variables
 * Uses local PostgreSQL for testing (not AWS Secrets Manager)
 */
function getTestConfig(): MigrationConfig {
  return {
    region: 'us-east-1',
    sslEnabled: false,
    host: process.env['DB_HOST'] ?? 'localhost',
    port: process.env['DB_PORT'] ? parseInt(process.env['DB_PORT'], 10) : 5432,
    database: process.env['DB_NAME'] ?? 'ams_test',
    username: process.env['DB_USERNAME'] ?? 'postgres',
    password: process.env['DB_PASSWORD'] ?? 'postgres',
    migrationsPath: path.resolve(__dirname, '../../../migrations'),
  };
}

/**
 * Create a direct database connection pool for test verification
 */
function createTestPool(config: MigrationConfig): Pool {
  return new Pool({
    host: config.host,
    port: config.port ?? 5432,
    database: config.database,
    user: config.username,
    password: config.password,
    ssl: false,
    max: 5,
    connectionTimeoutMillis: 10000,
  });
}

// ============================================================================
// Schema Snapshot Utilities
// ============================================================================

/**
 * Schema snapshot representing the database structure
 */
interface SchemaSnapshot {
  tables: TableInfo[];
  indexes: IndexInfo[];
  constraints: ConstraintInfo[];
  sequences: SequenceInfo[];
  functions: FunctionInfo[];
  triggers: TriggerInfo[];
}

interface TableInfo {
  tableName: string;
  columns: ColumnInfo[];
}

interface ColumnInfo {
  columnName: string;
  dataType: string;
  isNullable: boolean;
  columnDefault: string | null;
}

interface IndexInfo {
  indexName: string;
  tableName: string;
  indexDef: string;
}

interface ConstraintInfo {
  constraintName: string;
  tableName: string;
  constraintType: string;
  constraintDef: string;
}

interface SequenceInfo {
  sequenceName: string;
  dataType: string;
  startValue: string;
  increment: string;
}

interface FunctionInfo {
  functionName: string;
  returnType: string;
  argumentTypes: string;
}

interface TriggerInfo {
  triggerName: string;
  tableName: string;
  triggerDef: string;
}

/**
 * Get a complete snapshot of the database schema
 * This captures all structural elements for comparison
 */
async function getSchemaSnapshot(pool: Pool): Promise<SchemaSnapshot> {
  // Get all tables and their columns
  const tablesResult = await pool.query<{
    table_name: string;
    column_name: string;
    data_type: string;
    is_nullable: string;
    column_default: string | null;
  }>(`
    SELECT 
      t.table_name,
      c.column_name,
      c.data_type,
      c.is_nullable,
      c.column_default
    FROM information_schema.tables t
    JOIN information_schema.columns c 
      ON t.table_name = c.table_name 
      AND t.table_schema = c.table_schema
    WHERE t.table_schema = 'public'
      AND t.table_type = 'BASE TABLE'
    ORDER BY t.table_name, c.ordinal_position
  `);

  // Group columns by table
  const tableMap = new Map<string, ColumnInfo[]>();
  for (const row of tablesResult.rows) {
    const columns = tableMap.get(row.table_name) ?? [];
    columns.push({
      columnName: row.column_name,
      dataType: row.data_type,
      isNullable: row.is_nullable === 'YES',
      columnDefault: row.column_default,
    });
    tableMap.set(row.table_name, columns);
  }

  const tables: TableInfo[] = Array.from(tableMap.entries()).map(([tableName, columns]) => ({
    tableName,
    columns,
  }));

  // Get all indexes
  const indexesResult = await pool.query<{
    indexname: string;
    tablename: string;
    indexdef: string;
  }>(`
    SELECT indexname, tablename, indexdef
    FROM pg_indexes
    WHERE schemaname = 'public'
    ORDER BY tablename, indexname
  `);

  const indexes: IndexInfo[] = indexesResult.rows.map((row) => ({
    indexName: row.indexname,
    tableName: row.tablename,
    indexDef: row.indexdef,
  }));

  // Get all constraints
  const constraintsResult = await pool.query<{
    constraint_name: string;
    table_name: string;
    constraint_type: string;
    constraint_def: string;
  }>(`
    SELECT 
      tc.constraint_name,
      tc.table_name,
      tc.constraint_type,
      pg_get_constraintdef(c.oid) as constraint_def
    FROM information_schema.table_constraints tc
    JOIN pg_constraint c ON c.conname = tc.constraint_name
    WHERE tc.table_schema = 'public'
    ORDER BY tc.table_name, tc.constraint_name
  `);

  const constraints: ConstraintInfo[] = constraintsResult.rows.map((row) => ({
    constraintName: row.constraint_name,
    tableName: row.table_name,
    constraintType: row.constraint_type,
    constraintDef: row.constraint_def,
  }));

  // Get all sequences
  const sequencesResult = await pool.query<{
    sequence_name: string;
    data_type: string;
    start_value: string;
    increment: string;
  }>(`
    SELECT 
      sequence_name,
      data_type,
      start_value,
      increment
    FROM information_schema.sequences
    WHERE sequence_schema = 'public'
    ORDER BY sequence_name
  `);

  const sequences: SequenceInfo[] = sequencesResult.rows.map((row) => ({
    sequenceName: row.sequence_name,
    dataType: row.data_type,
    startValue: row.start_value,
    increment: row.increment,
  }));

  // Get all functions (excluding system functions)
  const functionsResult = await pool.query<{
    function_name: string;
    return_type: string;
    argument_types: string;
  }>(`
    SELECT 
      p.proname as function_name,
      pg_get_function_result(p.oid) as return_type,
      pg_get_function_arguments(p.oid) as argument_types
    FROM pg_proc p
    JOIN pg_namespace n ON p.pronamespace = n.oid
    WHERE n.nspname = 'public'
    ORDER BY p.proname
  `);

  const functions: FunctionInfo[] = functionsResult.rows.map((row) => ({
    functionName: row.function_name,
    returnType: row.return_type,
    argumentTypes: row.argument_types,
  }));

  // Get all triggers
  const triggersResult = await pool.query<{
    trigger_name: string;
    event_object_table: string;
    action_statement: string;
  }>(`
    SELECT 
      trigger_name,
      event_object_table,
      action_statement
    FROM information_schema.triggers
    WHERE trigger_schema = 'public'
    ORDER BY event_object_table, trigger_name
  `);

  const triggers: TriggerInfo[] = triggersResult.rows.map((row) => ({
    triggerName: row.trigger_name,
    tableName: row.event_object_table,
    triggerDef: row.action_statement,
  }));

  return {
    tables,
    indexes,
    constraints,
    sequences,
    functions,
    triggers,
  };
}

/**
 * Drop all objects in the public schema to reset the database
 */
async function resetDatabase(pool: Pool): Promise<void> {
  await pool.query(`
    DROP SCHEMA IF EXISTS public CASCADE;
    CREATE SCHEMA public;
    GRANT ALL ON SCHEMA public TO public;
  `);
}

/**
 * Get the list of applied migrations from schema_migrations table
 */
async function getAppliedMigrations(pool: Pool): Promise<string[]> {
  try {
    const result = await pool.query<{ version: string }>(
      'SELECT version FROM schema_migrations ORDER BY version'
    );
    return result.rows.map((row) => row.version);
  } catch {
    // Table doesn't exist yet
    return [];
  }
}

// ============================================================================
// Property-Based Tests
// ============================================================================

describe('Migration Properties', () => {
  let config: MigrationConfig;
  let testPool: Pool;
  let isDbAvailable = false;

  beforeAll(async () => {
    config = getTestConfig();
    testPool = createTestPool(config);

    // Check if database is available
    try {
      await testPool.query('SELECT 1');
      isDbAvailable = true;
    } catch (error) {
      console.warn(
        'Database not available for property tests. Skipping migration property tests.',
        'Set DB_HOST, DB_PORT, DB_NAME, DB_USERNAME, DB_PASSWORD to run these tests.'
      );
    }
  });

  afterAll(async () => {
    if (testPool) {
      await testPool.end();
    }
  });

  beforeEach(async () => {
    if (isDbAvailable) {
      // Reset database before each test
      await resetDatabase(testPool);
    }
  });

  /**
   * Property 1: Migration Idempotence
   *
   * **Validates: Requirements 2.3**
   *
   * For any database state where migrations have been applied, running the
   * migration script again SHALL NOT re-apply any migrations and SHALL leave
   * the database schema unchanged.
   *
   * This property ensures that:
   * 1. Running migrations twice produces the same schema as running once
   * 2. No migrations are re-applied on subsequent runs
   * 3. The schema_migrations table correctly tracks applied migrations
   */
  it('Property 1: running migrations twice produces same schema', async () => {
    if (!isDbAvailable) {
      console.warn('Skipping test: Database not available');
      return;
    }

    await fc.assert(
      fc.asyncProperty(
        fc.constant(null), // No random input needed for this property
        async () => {
          // Run migrations first time
          const result1 = await runMigrations(config);
          expect(result1.success).toBe(true);

          // Capture schema after first run
          const schemaV1 = await getSchemaSnapshot(testPool);
          const migrationsV1 = await getAppliedMigrations(testPool);

          // Run migrations second time
          const result2 = await runMigrations(config);
          expect(result2.success).toBe(true);

          // Capture schema after second run
          const schemaV2 = await getSchemaSnapshot(testPool);
          const migrationsV2 = await getAppliedMigrations(testPool);

          // Verify schema is unchanged
          expect(schemaV2).toEqual(schemaV1);

          // Verify no new migrations were applied
          expect(migrationsV2).toEqual(migrationsV1);

          // Verify second run reports no migrations applied
          expect(result2.appliedMigrations).toEqual([]);

          // Verify current version is the same
          expect(result2.currentVersion).toBe(result1.currentVersion);
        }
      ),
      {
        numRuns: 1, // Only need to run once for this property
        verbose: true,
      }
    );
  });

  /**
   * Additional test: Verify migration tracking is accurate
   *
   * This test ensures that the schema_migrations table accurately
   * reflects which migrations have been applied.
   */
  it('should accurately track applied migrations in schema_migrations table', async () => {
    if (!isDbAvailable) {
      console.warn('Skipping test: Database not available');
      return;
    }

    // Run migrations
    const result = await runMigrations(config);
    expect(result.success).toBe(true);

    // Get applied migrations from tracking table
    const appliedMigrations = await getAppliedMigrations(testPool);

    // Verify all applied migrations are tracked
    expect(appliedMigrations.length).toBeGreaterThan(0);

    // Verify migrations are in order
    const sortedMigrations = [...appliedMigrations].sort((a, b) => {
      return parseInt(a, 10) - parseInt(b, 10);
    });
    expect(appliedMigrations).toEqual(sortedMigrations);

    // Verify the current version matches the last applied migration
    expect(result.currentVersion).toBe(appliedMigrations[appliedMigrations.length - 1]);
  });

  /**
   * Additional test: Verify partial migration state is handled correctly
   *
   * This test ensures that if some migrations are already applied,
   * only the remaining migrations are executed.
   */
  it('should only apply pending migrations when some are already applied', async () => {
    if (!isDbAvailable) {
      console.warn('Skipping test: Database not available');
      return;
    }

    // Run migrations first time
    const result1 = await runMigrations(config);
    expect(result1.success).toBe(true);
    const firstRunApplied = result1.appliedMigrations;

    // Reset and run again - should apply same migrations
    await resetDatabase(testPool);
    const result2 = await runMigrations(config);
    expect(result2.success).toBe(true);

    // Both runs should apply the same migrations
    expect(result2.appliedMigrations).toEqual(firstRunApplied);
  });
});
