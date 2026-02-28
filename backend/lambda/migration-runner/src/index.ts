/**
 * Migration Runner Lambda Handler
 *
 * This Lambda function runs database migrations and seeds against Aurora PostgreSQL.
 * It's deployed in the VPC with access to the database, allowing migrations to be
 * executed without direct VPC connectivity from a developer's machine.
 *
 * Actions:
 *   - migrate: Run pending database migrations
 *   - seed: Seed the database with full test data
 *   - migrate-and-seed: Run migrations then seed
 *   - status: Check migration status
 *   - reset-seed: Clear seed data and re-seed (for testing)
 *
 * Validates: Requirements 3.1-3.12 from real-api-integration spec
 */

import { Handler } from 'aws-lambda';
import { GetSecretValueCommand, SecretsManagerClient } from '@aws-sdk/client-secrets-manager';
import { Pool, PoolConfig } from 'pg';
import * as fs from 'fs';
import * as path from 'path';

// Import shared seed data from @ams/seed-data package
import {
  DEPARTMENTS,
  USERS,
  STOCKROOMS,
  MANUFACTURERS,
  MODELS,
  FACILITIES,
  VENDORS,
  CONTRACTS,
  SOFTWARE_PRODUCTS,
  ENTITLEMENTS,
  ENTERPRISE_ASSETS,
  MAINTENANCE_PLANS,
  PURCHASE_ORDERS,
  LIFECYCLE_STATES,
  MODELS_BY_CATEGORY,
  MODEL_CATEGORIES,
  ASSET_COUNTS_BY_STATE,
  DEPARTMENT_CODES,
  STOCKROOM_CODES,
  ASSIGNABLE_USERS,
  WARRANTY_PERIODS,
  generateAssetTag,
  generateCognitoSub,
} from '@ams/seed-data';

// ============================================================================
// Types
// ============================================================================

interface MigrationEvent {
  action: 'migrate' | 'seed' | 'migrate-and-seed' | 'status' | 'reset-seed';
}

interface MigrationResult {
  success: boolean;
  action: string;
  message: string;
  details?: {
    appliedMigrations?: string[];
    currentVersion?: string;
    seedCounts?: Record<string, number>;
    error?: string;
  };
  duration: number;
}

interface DatabaseCredentials {
  host: string;
  port: number;
  dbname: string;
  username: string;
  password: string;
}

interface MigrationFile {
  version: string;
  description: string;
  filename: string;
  sql: string;
}

// ============================================================================
// Database Connection
// ============================================================================

let cachedCredentials: DatabaseCredentials | null = null;

async function getCredentials(): Promise<DatabaseCredentials> {
  if (cachedCredentials) {
    return cachedCredentials;
  }

  const secretArn = process.env['DB_SECRET_ARN'];
  if (!secretArn) {
    throw new Error('DB_SECRET_ARN environment variable not set');
  }

  const client = new SecretsManagerClient({});
  const response = await client.send(
    new GetSecretValueCommand({ SecretId: secretArn })
  );

  if (!response.SecretString) {
    throw new Error('Secret value is empty');
  }

  const secret = JSON.parse(response.SecretString);
  cachedCredentials = {
    host: secret.host,
    port: secret.port ?? 5432,
    dbname: secret.dbname ?? secret.database ?? 'assetmgmt',
    username: secret.username,
    password: secret.password,
  };

  return cachedCredentials;
}

async function createPool(): Promise<Pool> {
  const credentials = await getCredentials();

  const poolConfig: PoolConfig = {
    host: credentials.host,
    port: credentials.port,
    database: credentials.dbname,
    user: credentials.username,
    password: credentials.password,
    ssl: { rejectUnauthorized: false },
    connectionTimeoutMillis: 10000,
    idleTimeoutMillis: 30000,
    max: 5,
  };

  console.log(`Connecting to database: ${credentials.host}:${credentials.port}/${credentials.dbname}`);

  const pool = new Pool(poolConfig);

  // Test connection
  const client = await pool.connect();
  await client.query('SELECT 1');
  client.release();
  console.log('Database connection established');

  return pool;
}

// ============================================================================
// Migration Functions
// ============================================================================

async function ensureMigrationsTable(pool: Pool): Promise<void> {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS schema_migrations (
      version VARCHAR(20) PRIMARY KEY,
      description VARCHAR(255) NOT NULL,
      filename VARCHAR(255) NOT NULL,
      applied_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
      checksum VARCHAR(64),
      execution_time_ms INTEGER
    );
  `);
}

async function getAppliedMigrations(pool: Pool): Promise<string[]> {
  const result = await pool.query<{ version: string }>(
    'SELECT version FROM schema_migrations ORDER BY version'
  );
  return result.rows.map((row) => row.version);
}

function loadMigrationFiles(): MigrationFile[] {
  const possiblePaths = [
    path.join(__dirname, '../migrations'),
    path.join(__dirname, '../../migrations'),
    '/var/task/migrations',
  ];

  let migrationsPath: string | null = null;
  for (const p of possiblePaths) {
    if (fs.existsSync(p)) {
      migrationsPath = p;
      break;
    }
  }

  if (!migrationsPath) {
    throw new Error(`Migrations directory not found. Tried: ${possiblePaths.join(', ')}`);
  }

  console.log(`Loading migrations from: ${migrationsPath}`);

  const files = fs.readdirSync(migrationsPath);
  const migrations: MigrationFile[] = [];

  for (const filename of files) {
    if (!filename.endsWith('.sql')) continue;

    const match = filename.match(/^V(\d+)__(.+)\.sql$/);
    if (!match) continue;

    const filePath = path.join(migrationsPath, filename);
    const sql = fs.readFileSync(filePath, 'utf-8');

    migrations.push({
      version: match[1]!,
      description: match[2]!.replace(/_/g, ' '),
      filename,
      sql,
    });
  }

  migrations.sort((a, b) => parseInt(a.version, 10) - parseInt(b.version, 10));
  console.log(`Found ${migrations.length} migration files`);

  return migrations;
}

async function runMigrations(pool: Pool): Promise<{ applied: string[]; currentVersion: string }> {
  await ensureMigrationsTable(pool);

  const applied = await getAppliedMigrations(pool);
  const migrations = loadMigrationFiles();
  const pending = migrations.filter((m) => !applied.includes(m.version));

  if (pending.length === 0) {
    console.log('No pending migrations');
    return {
      applied: [],
      currentVersion: migrations.length > 0 ? migrations[migrations.length - 1]!.version : '0',
    };
  }

  console.log(`Applying ${pending.length} pending migrations`);
  const newlyApplied: string[] = [];

  for (const migration of pending) {
    console.log(`Applying V${migration.version}: ${migration.description}`);
    const startTime = Date.now();

    const client = await pool.connect();
    try {
      await client.query('BEGIN');
      await client.query(migration.sql);
      await client.query('COMMIT');

      const executionTime = Date.now() - startTime;
      await pool.query(
        `INSERT INTO schema_migrations (version, description, filename, execution_time_ms)
         VALUES ($1, $2, $3, $4)`,
        [migration.version, migration.description, migration.filename, executionTime]
      );

      newlyApplied.push(migration.version);
      console.log(`✓ V${migration.version} applied (${executionTime}ms)`);
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  }

  return {
    applied: newlyApplied,
    currentVersion: migrations[migrations.length - 1]!.version,
  };
}

// ============================================================================
// Seed Functions
// ============================================================================

/** Check if database is already fully seeded (idempotent check) */
async function isAlreadySeeded(pool: Pool): Promise<boolean> {
  try {
    // Check multiple tables to ensure full seeding was completed
    const checks = [
      { table: 'departments', minCount: 5 },
      { table: 'users', minCount: 5 },
      { table: 'vendors', minCount: 3 },
      { table: 'assets', minCount: 10 },
    ];
    
    for (const check of checks) {
      const result = await pool.query<{ count: string }>(`SELECT COUNT(*) as count FROM ${check.table}`);
      const count = parseInt(result.rows[0]?.count ?? '0', 10);
      if (count < check.minCount) {
        console.log(`Table ${check.table} has ${count} rows, expected at least ${check.minCount} - will seed`);
        return false;
      }
    }
    return true;
  } catch {
    return false;
  }
}

async function seedDepartments(pool: Pool): Promise<Map<string, string>> {
  console.log('Seeding departments...');
  const departmentIds = new Map<string, string>();

  for (const dept of DEPARTMENTS) {
    const result = await pool.query<{ department_id: string }>(
      `INSERT INTO departments (name, code, is_active)
       VALUES ($1, $2, true)
       ON CONFLICT (code) DO UPDATE SET name = EXCLUDED.name
       RETURNING department_id`,
      [dept.name, dept.code]
    );
    departmentIds.set(dept.code, result.rows[0]!.department_id);
  }
  console.log(`✓ Seeded ${DEPARTMENTS.length} departments`);
  return departmentIds;
}

async function seedUsers(pool: Pool, departmentIds: Map<string, string>): Promise<Map<string, string>> {
  console.log('Seeding users...');
  const userIds = new Map<string, string>();

  for (const user of USERS) {
    const deptId = departmentIds.get(user.departmentCode);
    const cognitoSub = generateCognitoSub(user.email);
    const result = await pool.query<{ user_id: string }>(
      `INSERT INTO users (cognito_sub, email, first_name, last_name, department_id, is_active)
       VALUES ($1, $2, $3, $4, $5, true)
       ON CONFLICT (email) DO UPDATE SET 
         first_name = EXCLUDED.first_name,
         last_name = EXCLUDED.last_name,
         department_id = EXCLUDED.department_id
       RETURNING user_id`,
      [cognitoSub, user.email, user.firstName, user.lastName, deptId]
    );
    userIds.set(user.email, result.rows[0]!.user_id);
  }
  console.log(`✓ Seeded ${USERS.length} users`);
  return userIds;
}

async function seedStockrooms(pool: Pool): Promise<Map<string, string>> {
  console.log('Seeding stockrooms...');
  const stockroomIds = new Map<string, string>();

  for (const sr of STOCKROOMS) {
    // First check if stockroom already exists
    const existing = await pool.query<{ stockroom_id: string }>(
      `SELECT stockroom_id FROM stockrooms WHERE stockroom_code = $1`,
      [sr.stockroomCode]
    );
    
    if (existing.rows.length > 0) {
      stockroomIds.set(sr.stockroomCode, existing.rows[0]!.stockroom_id);
      continue;
    }

    const result = await pool.query<{ stockroom_id: string }>(
      `INSERT INTO stockrooms (stockroom_code, name, location, stockroom_type, is_active)
       VALUES ($1, $2, $3, $4, true)
       RETURNING stockroom_id`,
      [sr.stockroomCode, sr.name, sr.location, sr.stockroomType]
    );
    stockroomIds.set(sr.stockroomCode, result.rows[0]!.stockroom_id);
  }
  console.log(`✓ Seeded ${STOCKROOMS.length} stockrooms`);
  return stockroomIds;
}

async function seedManufacturers(pool: Pool): Promise<Map<string, string>> {
  console.log('Seeding manufacturers...');
  const manufacturerIds = new Map<string, string>();

  for (const mfr of MANUFACTURERS) {
    const result = await pool.query<{ manufacturer_id: string }>(
      `INSERT INTO manufacturers (name, normalized_name, aliases, website, is_active)
       VALUES ($1, $2, $3, $4, true)
       ON CONFLICT (normalized_name) DO UPDATE SET name = EXCLUDED.name
       RETURNING manufacturer_id`,
      [mfr.name, mfr.normalizedName, mfr.aliases, mfr.website || null]
    );
    manufacturerIds.set(mfr.normalizedName, result.rows[0]!.manufacturer_id);
  }
  console.log(`✓ Seeded ${MANUFACTURERS.length} manufacturers`);
  return manufacturerIds;
}

async function seedModels(pool: Pool, manufacturerIds: Map<string, string>): Promise<Map<string, string>> {
  console.log('Seeding models...');
  const modelIds = new Map<string, string>();

  for (const model of MODELS) {
    const mfrId = manufacturerIds.get(model.manufacturerName);
    if (!mfrId) continue;

    const result = await pool.query<{ model_id: string }>(
      `INSERT INTO models (manufacturer_id, model_name, normalized_name, model_number, model_category, specifications)
       VALUES ($1, $2, $3, $4, $5, $6)
       ON CONFLICT (manufacturer_id, normalized_name) DO UPDATE SET 
         model_name = EXCLUDED.model_name,
         model_number = EXCLUDED.model_number
       RETURNING model_id`,
      [mfrId, model.modelName, model.normalizedName, model.modelNumber, model.modelCategory, JSON.stringify(model.specifications || {})]
    );
    modelIds.set(model.normalizedName, result.rows[0]!.model_id);
  }
  console.log(`✓ Seeded ${MODELS.length} models`);
  return modelIds;
}

async function seedFacilities(pool: Pool): Promise<Map<string, string>> {
  console.log('Seeding facilities...');
  const facilityIds = new Map<string, string>();

  for (const facility of FACILITIES) {
    const result = await pool.query<{ facility_id: string }>(
      `INSERT INTO facilities (facility_code, name, facility_type, city, state_province, country)
       VALUES ($1, $2, $3, $4, $5, $6)
       ON CONFLICT (facility_code) DO UPDATE SET name = EXCLUDED.name
       RETURNING facility_id`,
      [facility.facilityCode, facility.name, facility.facilityType, facility.city, facility.stateProvince, facility.country]
    );
    facilityIds.set(facility.facilityCode, result.rows[0]!.facility_id);
  }
  console.log(`✓ Seeded ${FACILITIES.length} facilities`);
  return facilityIds;
}

async function seedVendors(pool: Pool): Promise<Map<string, string>> {
  console.log('Seeding vendors...');
  const vendorIds = new Map<string, string>();

  for (const vendor of VENDORS) {
    // First check if vendor already exists
    const existing = await pool.query<{ vendor_id: string }>(
      `SELECT vendor_id FROM vendors WHERE vendor_code = $1`,
      [vendor.vendorCode]
    );
    
    if (existing.rows.length > 0) {
      vendorIds.set(vendor.vendorCode, existing.rows[0]!.vendor_id);
      continue;
    }

    const result = await pool.query<{ vendor_id: string }>(
      `INSERT INTO vendors (vendor_name, vendor_code, vendor_type, contact_name, contact_email, contact_phone, payment_terms)
       VALUES ($1, $2, $3, $4, $5, $6, $7)
       RETURNING vendor_id`,
      [vendor.vendorName, vendor.vendorCode, vendor.vendorType, vendor.contactName, vendor.contactEmail, vendor.contactPhone, vendor.paymentTerms]
    );
    vendorIds.set(vendor.vendorCode, result.rows[0]!.vendor_id);
  }
  console.log(`✓ Seeded ${VENDORS.length} vendors`);
  return vendorIds;
}

async function seedContracts(pool: Pool, vendorIds: Map<string, string>, createdByUserId: string): Promise<Map<string, string>> {
  console.log('Seeding contracts...');
  const contractIds = new Map<string, string>();

  for (const contract of CONTRACTS) {
    const vendorId = vendorIds.get(contract.vendorCode);
    if (!vendorId) continue;

    const result = await pool.query<{ contract_id: string }>(
      `INSERT INTO contracts (contract_number, contract_name, vendor_id, contract_type, total_value, start_date, end_date, status, created_by, updated_by)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
       ON CONFLICT (contract_number) DO UPDATE SET contract_name = EXCLUDED.contract_name
       RETURNING contract_id`,
      [contract.contractNumber, contract.contractName, vendorId, contract.contractType, contract.totalValue, contract.startDate, contract.endDate, contract.status, createdByUserId, createdByUserId]
    );
    contractIds.set(contract.contractNumber, result.rows[0]!.contract_id);
  }
  console.log(`✓ Seeded ${CONTRACTS.length} contracts`);
  return contractIds;
}


/** Requirement 3.6: At least 50 hardware assets across all lifecycle states */
async function seedHardwareAssets(
  pool: Pool,
  modelIds: Map<string, string>,
  departmentIds: Map<string, string>,
  stockroomIds: Map<string, string>,
  userIds: Map<string, string>,
  createdByUserId: string
): Promise<number> {
  console.log('Seeding hardware assets...');
  
  let assetCount = 0;

  for (const state of LIFECYCLE_STATES) {
    const countForState = ASSET_COUNTS_BY_STATE[state] ?? ASSET_COUNTS_BY_STATE['DEFAULT'] ?? 5;
    
    for (let i = 0; i < countForState; i++) {
      assetCount++;
      const category = MODEL_CATEGORIES[assetCount % MODEL_CATEGORIES.length]!;
      const modelsForCategory = MODELS_BY_CATEGORY[category] || ['LATITUDE 5540'];
      const modelName = modelsForCategory[assetCount % modelsForCategory.length]!;
      const department = DEPARTMENT_CODES[assetCount % DEPARTMENT_CODES.length]!;
      
      const assetTag = generateAssetTag('HARDWARE');
      const serialNumber = `SN${Date.now().toString(36).toUpperCase()}${assetCount.toString().padStart(4, '0')}`;
      const modelId = modelIds.get(modelName);
      const departmentId = departmentIds.get(department);
      const stockroomId = ['IN_STOCK', 'RESERVED', 'IN_MAINTENANCE'].includes(state) 
        ? stockroomIds.get(STOCKROOM_CODES[assetCount % STOCKROOM_CODES.length]!) 
        : null;
      const assignedToId = state === 'DEPLOYED' 
        ? userIds.get(ASSIGNABLE_USERS[assetCount % ASSIGNABLE_USERS.length]!) 
        : null;

      // Get manufacturer_id from model
      let manufacturerId: string | null = null;
      if (modelId) {
        const mfrResult = await pool.query<{ manufacturer_id: string }>(
          'SELECT manufacturer_id FROM models WHERE model_id = $1',
          [modelId]
        );
        manufacturerId = mfrResult.rows[0]?.manufacturer_id ?? null;
      }

      // Insert base asset
      const assetResult = await pool.query<{ asset_id: string }>(
        `INSERT INTO assets (asset_tag, asset_type, display_name, description, status, created_by, updated_by)
         VALUES ($1, $2, $3, $4, $5, $6, $7)
         ON CONFLICT (asset_tag) DO NOTHING
         RETURNING asset_id`,
        [assetTag, 'HARDWARE', `${category.charAt(0) + category.slice(1).toLowerCase()} Asset ${assetCount.toString().padStart(3, '0')}`, 
         `${modelName} - ${state} asset for ${department} department`, state, createdByUserId, createdByUserId]
      );

      if (assetResult.rows.length > 0) {
        const assetId = assetResult.rows[0]!.asset_id;
        const purchasePrice = Math.floor(Math.random() * 3000) + 500;
        const warrantyMonths = WARRANTY_PERIODS[assetCount % WARRANTY_PERIODS.length]!;
        const warrantyExpiration = new Date();
        warrantyExpiration.setMonth(warrantyExpiration.getMonth() + warrantyMonths);

        // Insert hardware-specific attributes
        await pool.query(
          `INSERT INTO hardware_assets (asset_id, serial_number, manufacturer_id, model_id, model_category, department_id, stockroom_id, assigned_to, purchase_price, warranty_expiration)
           VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
           ON CONFLICT (asset_id) DO NOTHING`,
          [assetId, serialNumber, manufacturerId, modelId, category, departmentId, stockroomId, assignedToId, purchasePrice, warrantyExpiration.toISOString().slice(0, 10)]
        );
      }
    }
  }

  console.log(`✓ Seeded ${assetCount} hardware assets`);
  return assetCount;
}

async function seedSoftwareProducts(pool: Pool, createdByUserId: string): Promise<Map<string, string>> {
  console.log('Seeding software products...');
  const productIds = new Map<string, string>();

  for (const product of SOFTWARE_PRODUCTS) {
    const result = await pool.query<{ product_id: string }>(
      `INSERT INTO software_products (publisher, product_name, version, edition, product_category, is_saas, normalized_publisher, normalized_product_name, created_by, updated_by)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
       ON CONFLICT (publisher, product_name, version, edition) DO UPDATE SET product_category = EXCLUDED.product_category
       RETURNING product_id`,
      [product.publisher, product.productName, product.version, product.edition, product.productCategory, product.isSaas, 
       product.publisher.toUpperCase(), product.productName.toUpperCase(), createdByUserId, createdByUserId]
    );
    productIds.set(product.productName, result.rows[0]!.product_id);
  }
  console.log(`✓ Seeded ${SOFTWARE_PRODUCTS.length} software products`);
  return productIds;
}

async function seedEntitlements(pool: Pool, productIds: Map<string, string>, createdByUserId: string): Promise<number> {
  console.log('Seeding entitlements...');
  let count = 0;

  for (const entitlement of ENTITLEMENTS) {
    const productId = productIds.get(entitlement.productName);
    if (!productId) continue;

    const totalCost = entitlement.quantityPurchased * entitlement.unitCost;
    await pool.query(
      `INSERT INTO entitlements (software_product_id, license_type, quantity_purchased, quantity_available, unit_cost, total_cost, metric_type, start_date, end_date, created_by, updated_by)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
       ON CONFLICT DO NOTHING`,
      [productId, entitlement.licenseType, entitlement.quantityPurchased, entitlement.quantityPurchased, entitlement.unitCost, totalCost, 
       entitlement.metricType, entitlement.startDate, entitlement.endDate || null, createdByUserId, createdByUserId]
    );
    count++;
  }
  console.log(`✓ Seeded ${count} entitlements`);
  return count;
}

async function seedEnterpriseAssets(pool: Pool, facilityIds: Map<string, string>, createdByUserId: string): Promise<Map<string, string>> {
  console.log('Seeding enterprise assets...');
  const enterpriseAssetIds = new Map<string, string>();

  for (const asset of ENTERPRISE_ASSETS) {
    const assetTag = generateAssetTag('ENTERPRISE');
    const facilityId = facilityIds.get(asset.facilityCode);

    const assetResult = await pool.query<{ asset_id: string }>(
      `INSERT INTO assets (asset_tag, asset_type, display_name, description, status, created_by, updated_by)
       VALUES ($1, $2, $3, $4, $5, $6, $7)
       RETURNING asset_id`,
      [assetTag, 'ENTERPRISE', asset.displayName, asset.description, asset.status, createdByUserId, createdByUserId]
    );
    const assetId = assetResult.rows[0]!.asset_id;

    await pool.query(
      `INSERT INTO enterprise_assets (asset_id, serial_number, manufacturer, model, asset_class, criticality_level, facility_id, operating_hours)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
      [assetId, asset.serialNumber, asset.manufacturer, asset.model, asset.assetClass, asset.criticalityLevel, facilityId, asset.operatingHours]
    );

    enterpriseAssetIds.set(asset.displayName, assetId);
  }
  console.log(`✓ Seeded ${ENTERPRISE_ASSETS.length} enterprise assets`);
  return enterpriseAssetIds;
}

async function seedMaintenancePlans(pool: Pool, enterpriseAssetIds: Map<string, string>, createdByUserId: string): Promise<number> {
  console.log('Seeding maintenance plans...');
  let count = 0;

  for (const plan of MAINTENANCE_PLANS) {
    const assetId = enterpriseAssetIds.get(plan.assetDisplayName);
    if (!assetId) continue;

    const nextDueDate = new Date();
    nextDueDate.setDate(nextDueDate.getDate() + plan.frequencyDays);

    await pool.query(
      `INSERT INTO maintenance_plans (asset_id, plan_name, maintenance_type, frequency_days, estimated_duration_hours, next_due_date, is_active, created_by, updated_by)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
       ON CONFLICT DO NOTHING`,
      [assetId, plan.planName, plan.maintenanceType, plan.frequencyDays, plan.estimatedDurationHours, nextDueDate.toISOString().slice(0, 10), true, createdByUserId, createdByUserId]
    );
    count++;
  }
  console.log(`✓ Seeded ${count} maintenance plans`);
  return count;
}

async function seedPurchaseOrders(
  pool: Pool,
  vendorIds: Map<string, string>,
  userIds: Map<string, string>,
  createdByUserId: string
): Promise<{ poCount: number; lineCount: number }> {
  console.log('Seeding purchase orders...');
  let poCount = 0;
  let lineCount = 0;

  for (const po of PURCHASE_ORDERS) {
    const vendorId = vendorIds.get(po.vendorCode);
    const requesterId = userIds.get(po.requesterEmail);

    if (!vendorId || !requesterId) {
      console.log(`⚠ Missing vendor or requester for PO: ${po.poNumber}`);
      continue;
    }

    // Insert purchase order (using requested_by column name per V010 migration)
    const poResult = await pool.query<{ po_id: string }>(
      `INSERT INTO purchase_orders (po_number, vendor_id, requested_by, status, order_date, expected_delivery_date, total_amount, created_by, updated_by)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
       ON CONFLICT (po_number) DO UPDATE SET status = EXCLUDED.status
       RETURNING po_id`,
      [po.poNumber, vendorId, requesterId, po.status, po.orderDate, po.expectedDeliveryDate, po.totalAmount, createdByUserId, createdByUserId]
    );
    const poId = poResult.rows[0]!.po_id;
    poCount++;

    // Insert line items into po_lines (V010 table used by procurement service)
    for (const line of po.lines) {
      const lineTotal = line.quantity * line.unitPrice;
      const quantityReceived = ['RECEIVED', 'INVOICED', 'PAID'].includes(po.status) ? line.quantity :
                               po.status === 'PARTIALLY_RECEIVED' ? Math.floor(line.quantity / 2) : 0;

      await pool.query(
        `INSERT INTO po_lines (po_id, line_number, product_type, product_description, quantity, unit_price, line_total, quantity_received)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
         ON CONFLICT (po_id, line_number) DO UPDATE SET product_description = EXCLUDED.product_description`,
        [poId, line.lineNumber, line.productType, line.productDescription, line.quantity, line.unitPrice, lineTotal, quantityReceived]
      );
      lineCount++;
    }
  }

  console.log(`✓ Seeded ${poCount} purchase orders with ${lineCount} line items`);
  return { poCount, lineCount };
}

/** Main seed function - orchestrates all seed data insertion */
async function seedDatabase(pool: Pool): Promise<Record<string, number>> {
  // Check if already seeded
  if (await isAlreadySeeded(pool)) {
    console.log('Database already seeded, skipping');
    return { skipped: 1 };
  }

  console.log('Seeding database with full test data...');
  const counts: Record<string, number> = {};

  // Seed in dependency order
  const departmentIds = await seedDepartments(pool);
  counts['departments'] = departmentIds.size;

  const userIds = await seedUsers(pool, departmentIds);
  counts['users'] = userIds.size;

  const stockroomIds = await seedStockrooms(pool);
  counts['stockrooms'] = stockroomIds.size;

  const manufacturerIds = await seedManufacturers(pool);
  counts['manufacturers'] = manufacturerIds.size;

  const modelIds = await seedModels(pool, manufacturerIds);
  counts['models'] = modelIds.size;

  const facilityIds = await seedFacilities(pool);
  counts['facilities'] = facilityIds.size;

  const vendorIds = await seedVendors(pool);
  counts['vendors'] = vendorIds.size;

  // Get admin user ID for created_by references
  const adminUserId = userIds.get('admin@example.com')!;

  const contractIds = await seedContracts(pool, vendorIds, adminUserId);
  counts['contracts'] = contractIds.size;

  counts['hardware_assets'] = await seedHardwareAssets(pool, modelIds, departmentIds, stockroomIds, userIds, adminUserId);

  const productIds = await seedSoftwareProducts(pool, adminUserId);
  counts['software_products'] = productIds.size;

  counts['entitlements'] = await seedEntitlements(pool, productIds, adminUserId);

  const enterpriseAssetIds = await seedEnterpriseAssets(pool, facilityIds, adminUserId);
  counts['enterprise_assets'] = enterpriseAssetIds.size;

  counts['maintenance_plans'] = await seedMaintenancePlans(pool, enterpriseAssetIds, adminUserId);

  const poResult = await seedPurchaseOrders(pool, vendorIds, userIds, adminUserId);
  counts['purchase_orders'] = poResult.poCount;
  counts['purchase_order_lines'] = poResult.lineCount;

  console.log('Database seeding complete');
  return counts;
}

// ============================================================================
// Status Function
// ============================================================================

async function getStatus(pool: Pool): Promise<{ applied: string[]; currentVersion: string; tableCount: number; seedStatus: Record<string, number> }> {
  await ensureMigrationsTable(pool);
  
  const applied = await getAppliedMigrations(pool);
  
  // Count tables
  const tableResult = await pool.query(`
    SELECT COUNT(*) as count 
    FROM information_schema.tables 
    WHERE table_schema = 'public' AND table_type = 'BASE TABLE'
  `);

  // Get seed counts
  const seedStatus: Record<string, number> = {};
  const tables = ['departments', 'users', 'stockrooms', 'manufacturers', 'models', 'assets', 'hardware_assets', 'software_products', 'entitlements', 'enterprise_assets', 'maintenance_plans', 'contracts', 'vendors', 'facilities', 'purchase_orders', 'po_lines'];
  
  for (const table of tables) {
    try {
      const result = await pool.query(`SELECT COUNT(*) as count FROM ${table}`);
      seedStatus[table] = parseInt(result.rows[0].count, 10);
    } catch {
      seedStatus[table] = 0;
    }
  }
  
  return {
    applied,
    currentVersion: applied.length > 0 ? applied[applied.length - 1]! : '0',
    tableCount: parseInt(tableResult.rows[0].count, 10),
    seedStatus,
  };
}

// ============================================================================
// Lambda Handler
// ============================================================================

export const handler: Handler<MigrationEvent, MigrationResult> = async (event) => {
  const startTime = Date.now();
  const action = event.action || 'status';
  
  console.log(`Migration runner invoked with action: ${action}`);
  
  let pool: Pool | null = null;
  
  try {
    pool = await createPool();
    
    switch (action) {
      case 'migrate': {
        const result = await runMigrations(pool);
        return {
          success: true,
          action,
          message: result.applied.length > 0 
            ? `Applied ${result.applied.length} migrations` 
            : 'No pending migrations',
          details: {
            appliedMigrations: result.applied,
            currentVersion: result.currentVersion,
          },
          duration: Date.now() - startTime,
        };
      }
      
      case 'seed': {
        const counts = await seedDatabase(pool);
        return {
          success: true,
          action,
          message: counts['skipped'] ? 'Database already seeded' : 'Database seeded successfully with full test data',
          details: {
            seedCounts: counts,
          },
          duration: Date.now() - startTime,
        };
      }
      
      case 'migrate-and-seed': {
        const migrateResult = await runMigrations(pool);
        const seedCounts = await seedDatabase(pool);
        return {
          success: true,
          action,
          message: 'Migrations and seeding complete',
          details: {
            appliedMigrations: migrateResult.applied,
            currentVersion: migrateResult.currentVersion,
            seedCounts,
          },
          duration: Date.now() - startTime,
        };
      }
      
      case 'status': {
        const status = await getStatus(pool);
        return {
          success: true,
          action,
          message: `Database at version V${status.currentVersion} with ${status.tableCount} tables`,
          details: {
            appliedMigrations: status.applied,
            currentVersion: status.currentVersion,
            seedCounts: status.seedStatus,
          },
          duration: Date.now() - startTime,
        };
      }

      case 'reset-seed': {
        // Truncate seed data tables (in reverse dependency order)
        console.log('Resetting seed data...');
        const truncateTables = [
          'po_lines', 'purchase_order_lines', 'purchase_orders',
          'maintenance_plans', 'enterprise_assets', 'entitlements', 'software_products',
          'hardware_assets', 'contracts', 'vendors', 'facilities', 'models', 
          'manufacturers', 'stockrooms', 'users', 'departments'
        ];
        for (const table of truncateTables) {
          try {
            await pool.query(`TRUNCATE TABLE ${table} CASCADE`);
            console.log(`✓ Truncated ${table}`);
          } catch (e) {
            console.log(`⚠ Could not truncate ${table}: ${(e as Error).message}`);
          }
        }
        // Also truncate assets table
        try {
          await pool.query('TRUNCATE TABLE assets CASCADE');
          console.log('✓ Truncated assets');
        } catch (e) {
          console.log(`⚠ Could not truncate assets: ${(e as Error).message}`);
        }
        
        // Re-seed
        const seedCounts = await seedDatabase(pool);
        return {
          success: true,
          action,
          message: 'Database reset and re-seeded successfully',
          details: {
            seedCounts,
          },
          duration: Date.now() - startTime,
        };
      }
      
      default:
        return {
          success: false,
          action,
          message: `Unknown action: ${action}. Valid actions: migrate, seed, migrate-and-seed, status, reset-seed`,
          duration: Date.now() - startTime,
        };
    }
  } catch (error) {
    const err = error as Error;
    console.error('Migration error:', err);
    return {
      success: false,
      action,
      message: `Migration failed: ${err.message}`,
      details: {
        error: err.message,
      },
      duration: Date.now() - startTime,
    };
  } finally {
    if (pool) {
      await pool.end();
    }
  }
};
