#!/usr/bin/env npx ts-node
/**
 * Database Seed Script
 *
 * Populates the database with realistic test data for the Asset Management System.
 * This script is idempotent - running it multiple times will not create duplicate data.
 *
 * Usage:
 *   npm run db:seed
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
 * Validates: Requirements 3.1-3.12 from real-api-integration spec
 */

import { GetSecretValueCommand, SecretsManagerClient } from '@aws-sdk/client-secrets-manager';
import { Pool, PoolConfig } from 'pg';

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
  TRANSFER_ORDERS,
  LOANER_CHECKOUTS,
  DISPOSAL_WORKFLOWS,
  WORK_ORDERS,
  SPARE_PARTS,
  LINEAR_ASSETS,
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
// Types and Interfaces
// ============================================================================

interface SeedConfig {
  secretArn?: string;
  region: string;
  sslEnabled: boolean;
  host?: string;
  port?: number;
  database?: string;
  username?: string;
  password?: string;
}

interface DatabaseCredentials {
  host: string;
  port: number;
  dbname: string;
  username: string;
  password: string;
}

// ============================================================================
// Configuration
// ============================================================================

function loadConfig(): SeedConfig {
  return {
    secretArn: process.env['DB_SECRET_ARN'],
    region: process.env['AWS_REGION'] || 'us-east-1',
    sslEnabled: process.env['DB_SSL'] !== 'false',
    host: process.env['DB_HOST'],
    port: process.env['DB_PORT'] ? parseInt(process.env['DB_PORT'], 10) : undefined,
    database: process.env['DB_NAME'],
    username: process.env['DB_USERNAME'],
    password: process.env['DB_PASSWORD'],
  };
}

// ============================================================================
// Database Connection
// ============================================================================

async function getCredentialsFromSecrets(secretArn: string, region: string): Promise<DatabaseCredentials> {
  const client = new SecretsManagerClient({ region });
  const response = await client.send(
    new GetSecretValueCommand({ SecretId: secretArn })
  );

  if (!response.SecretString) {
    throw new Error('Secret value is empty');
  }

  const secret = JSON.parse(response.SecretString);
  return {
    host: secret.host,
    port: secret.port ?? 5432,
    dbname: secret.dbname ?? secret.database ?? 'assetmgmt',
    username: secret.username,
    password: secret.password,
  };
}

async function createPool(config: SeedConfig): Promise<Pool> {
  let credentials: DatabaseCredentials;

  if (config.secretArn) {
    console.log('Fetching database credentials from Secrets Manager...');
    credentials = await getCredentialsFromSecrets(config.secretArn, config.region);
  } else if (config.host && config.username && config.password) {
    credentials = {
      host: config.host,
      port: config.port ?? 5432,
      dbname: config.database ?? 'assetmgmt',
      username: config.username,
      password: config.password,
    };
  } else {
    throw new Error('Database credentials not configured. Set DB_SECRET_ARN or DB_HOST/DB_USERNAME/DB_PASSWORD');
  }

  const poolConfig: PoolConfig = {
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

  console.log(`Connecting to database: ${credentials.host}:${credentials.port}/${credentials.dbname}`);

  const pool = new Pool(poolConfig);

  const client = await pool.connect();
  await client.query('SELECT 1');
  client.release();
  console.log('Database connection established successfully');

  return pool;
}

// ============================================================================
// Seed Data Insertion Functions
// ============================================================================

async function isAlreadySeeded(pool: Pool): Promise<boolean> {
  try {
    const result = await pool.query<{ count: string }>('SELECT COUNT(*) as count FROM departments');
    return parseInt(result.rows[0]?.count ?? '0', 10) > 0;
  } catch {
    return false;
  }
}

async function seedDepartments(pool: Pool): Promise<Map<string, string>> {
  console.log('Seeding departments...');
  const departmentIds = new Map<string, string>();

  for (const dept of DEPARTMENTS) {
    const result = await pool.query<{ department_id: string }>(
      `INSERT INTO departments (code, name) 
       VALUES ($1, $2) 
       ON CONFLICT (code) DO UPDATE SET name = EXCLUDED.name
       RETURNING department_id`,
      [dept.code, dept.name]
    );
    departmentIds.set(dept.code, result.rows[0]!.department_id);
  }

  console.log(`  ✓ Seeded ${DEPARTMENTS.length} departments`);
  return departmentIds;
}

async function seedUsers(pool: Pool, departmentIds: Map<string, string>): Promise<Map<string, string>> {
  console.log('Seeding users...');
  const userIds = new Map<string, string>();

  for (const user of USERS) {
    const departmentId = departmentIds.get(user.departmentCode);
    const cognitoSub = generateCognitoSub(user.email);

    const result = await pool.query<{ user_id: string }>(
      `INSERT INTO users (cognito_sub, email, first_name, last_name, department_id) 
       VALUES ($1, $2, $3, $4, $5) 
       ON CONFLICT (email) DO UPDATE SET 
         first_name = EXCLUDED.first_name,
         last_name = EXCLUDED.last_name,
         department_id = EXCLUDED.department_id
       RETURNING user_id`,
      [cognitoSub, user.email, user.firstName, user.lastName, departmentId]
    );
    const userId = result.rows[0]!.user_id;
    userIds.set(user.email, userId);

    // Assign role to user
    const roleResult = await pool.query<{ role_id: string }>(
      `SELECT role_id FROM roles WHERE role_name = $1`,
      [user.role]
    );
    if (roleResult.rows.length > 0) {
      await pool.query(
        `INSERT INTO user_roles (user_id, role_id) 
         VALUES ($1, $2) 
         ON CONFLICT (user_id, role_id) DO NOTHING`,
        [userId, roleResult.rows[0]!.role_id]
      );
    }
  }

  console.log(`  ✓ Seeded ${USERS.length} users with roles`);
  return userIds;
}

async function seedStockrooms(pool: Pool, userIds: Map<string, string>): Promise<Map<string, string>> {
  console.log('Seeding stockrooms...');
  const stockroomIds = new Map<string, string>();
  const managerId = userIds.get('inventory.manager@example.com');

  for (const stockroom of STOCKROOMS) {
    const existing = await pool.query<{ stockroom_id: string }>(
      `SELECT stockroom_id FROM stockrooms WHERE stockroom_code = $1`,
      [stockroom.stockroomCode]
    );

    let stockroomId: string;
    if (existing.rows.length > 0) {
      stockroomId = existing.rows[0]!.stockroom_id;
      await pool.query(
        `UPDATE stockrooms SET name = $1, location = $2, stockroom_type = $3, manager_id = $4 
         WHERE stockroom_id = $5`,
        [stockroom.name, stockroom.location, stockroom.stockroomType, managerId, stockroomId]
      );
    } else {
      const result = await pool.query<{ stockroom_id: string }>(
        `INSERT INTO stockrooms (name, location, stockroom_type, stockroom_code, manager_id) 
         VALUES ($1, $2, $3, $4, $5) 
         RETURNING stockroom_id`,
        [stockroom.name, stockroom.location, stockroom.stockroomType, stockroom.stockroomCode, managerId]
      );
      stockroomId = result.rows[0]!.stockroom_id;
    }
    stockroomIds.set(stockroom.stockroomCode, stockroomId);
  }

  console.log(`  ✓ Seeded ${STOCKROOMS.length} stockrooms`);
  return stockroomIds;
}

async function seedManufacturers(pool: Pool): Promise<Map<string, string>> {
  console.log('Seeding manufacturers...');
  const manufacturerIds = new Map<string, string>();

  for (const mfr of MANUFACTURERS) {
    const result = await pool.query<{ manufacturer_id: string }>(
      `INSERT INTO manufacturers (name, normalized_name, aliases, website) 
       VALUES ($1, $2, $3, $4) 
       ON CONFLICT (normalized_name) DO UPDATE SET 
         name = EXCLUDED.name,
         aliases = EXCLUDED.aliases,
         website = EXCLUDED.website
       RETURNING manufacturer_id`,
      [mfr.name, mfr.normalizedName, mfr.aliases, mfr.website]
    );
    manufacturerIds.set(mfr.normalizedName, result.rows[0]!.manufacturer_id);
  }

  console.log(`  ✓ Seeded ${MANUFACTURERS.length} manufacturers`);
  return manufacturerIds;
}

async function seedModels(pool: Pool, manufacturerIds: Map<string, string>): Promise<Map<string, string>> {
  console.log('Seeding models...');
  const modelIds = new Map<string, string>();

  for (const model of MODELS) {
    const manufacturerId = manufacturerIds.get(model.manufacturerName);
    if (!manufacturerId) continue;

    const result = await pool.query<{ model_id: string }>(
      `INSERT INTO models (manufacturer_id, model_name, normalized_name, model_number, model_category, specifications) 
       VALUES ($1, $2, $3, $4, $5, $6) 
       ON CONFLICT (manufacturer_id, normalized_name) DO UPDATE SET 
         model_name = EXCLUDED.model_name,
         model_number = EXCLUDED.model_number,
         model_category = EXCLUDED.model_category,
         specifications = EXCLUDED.specifications
       RETURNING model_id`,
      [manufacturerId, model.modelName, model.normalizedName, model.modelNumber, model.modelCategory, JSON.stringify(model.specifications || {})]
    );
    modelIds.set(model.normalizedName, result.rows[0]!.model_id);
  }

  console.log(`  ✓ Seeded ${MODELS.length} models`);
  return modelIds;
}

async function seedFacilities(pool: Pool): Promise<Map<string, string>> {
  console.log('Seeding facilities...');
  const facilityIds = new Map<string, string>();

  for (const facility of FACILITIES) {
    const result = await pool.query<{ facility_id: string }>(
      `INSERT INTO facilities (facility_code, name, facility_type, city, state_province, country) 
       VALUES ($1, $2, $3, $4, $5, $6) 
       ON CONFLICT (facility_code) DO UPDATE SET 
         name = EXCLUDED.name,
         facility_type = EXCLUDED.facility_type
       RETURNING facility_id`,
      [facility.facilityCode, facility.name, facility.facilityType, facility.city, facility.stateProvince, facility.country]
    );
    facilityIds.set(facility.facilityCode, result.rows[0]!.facility_id);
  }

  console.log(`  ✓ Seeded ${FACILITIES.length} facilities`);
  return facilityIds;
}

async function seedVendors(pool: Pool): Promise<Map<string, string>> {
  console.log('Seeding vendors...');
  const vendorIds = new Map<string, string>();

  for (const vendor of VENDORS) {
    const existing = await pool.query<{ vendor_id: string }>(
      `SELECT vendor_id FROM vendors WHERE vendor_code = $1`,
      [vendor.vendorCode]
    );

    let vendorId: string;
    if (existing.rows.length > 0) {
      vendorId = existing.rows[0]!.vendor_id;
      await pool.query(
        `UPDATE vendors SET vendor_name = $1, vendor_type = $2, contact_name = $3, 
         contact_email = $4, contact_phone = $5, payment_terms = $6 
         WHERE vendor_id = $7`,
        [vendor.vendorName, vendor.vendorType, vendor.contactName, vendor.contactEmail, 
         vendor.contactPhone, vendor.paymentTerms, vendorId]
      );
    } else {
      const result = await pool.query<{ vendor_id: string }>(
        `INSERT INTO vendors (vendor_name, vendor_code, vendor_type, contact_name, contact_email, contact_phone, payment_terms) 
         VALUES ($1, $2, $3, $4, $5, $6, $7) 
         RETURNING vendor_id`,
        [vendor.vendorName, vendor.vendorCode, vendor.vendorType, vendor.contactName, 
         vendor.contactEmail, vendor.contactPhone, vendor.paymentTerms]
      );
      vendorId = result.rows[0]!.vendor_id;
    }
    vendorIds.set(vendor.vendorCode, vendorId);
  }

  console.log(`  ✓ Seeded ${VENDORS.length} vendors`);
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

  console.log(`  ✓ Seeded ${CONTRACTS.length} contracts`);
  return contractIds;
}


async function seedHardwareAssets(
  pool: Pool,
  modelIds: Map<string, string>,
  departmentIds: Map<string, string>,
  stockroomIds: Map<string, string>,
  userIds: Map<string, string>,
  createdByUserId: string,
  contractIds?: Map<string, string>
): Promise<number> {
  console.log('Seeding hardware assets...');
  
  const leaseContractId = contractIds?.get('CTR-2024-001') ?? null;
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

      let manufacturerId: string | null = null;
      if (modelId) {
        const mfrResult = await pool.query<{ manufacturer_id: string }>(
          'SELECT manufacturer_id FROM models WHERE model_id = $1',
          [modelId]
        );
        manufacturerId = mfrResult.rows[0]?.manufacturer_id ?? null;
      }

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

        // Link some Dell laptops to lease contract
        const contractId = (leaseContractId && category === 'LAPTOP' && modelName.includes('LATITUDE')) ? leaseContractId : null;

        await pool.query(
          `INSERT INTO hardware_assets (asset_id, serial_number, manufacturer_id, model_id, model_category, department_id, stockroom_id, assigned_to, purchase_price, warranty_expiration, contract_id)
           VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
           ON CONFLICT (asset_id) DO NOTHING`,
          [assetId, serialNumber, manufacturerId, modelId, category, departmentId, stockroomId, assignedToId, purchasePrice, warrantyExpiration.toISOString().slice(0, 10), contractId]
        );
      }
    }
  }

  console.log(`  ✓ Seeded ${assetCount} hardware assets`);
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

  console.log(`  ✓ Seeded ${SOFTWARE_PRODUCTS.length} software products`);
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

  console.log(`  ✓ Seeded ${count} entitlements`);
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

  console.log(`  ✓ Seeded ${ENTERPRISE_ASSETS.length} enterprise assets`);
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

  console.log(`  ✓ Seeded ${count} maintenance plans`);
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
      console.log(`  ⚠ Missing vendor or requester for PO: ${po.poNumber}`);
      continue;
    }

    const poResult = await pool.query<{ po_id: string }>(
      `INSERT INTO purchase_orders (po_number, vendor_id, requester_id, status, order_date, expected_delivery_date, total_amount, created_by, updated_by)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
       ON CONFLICT (po_number) DO UPDATE SET status = EXCLUDED.status
       RETURNING po_id`,
      [po.poNumber, vendorId, requesterId, po.status, po.orderDate, po.expectedDeliveryDate, po.totalAmount, createdByUserId, createdByUserId]
    );
    const poId = poResult.rows[0]!.po_id;
    poCount++;

    for (const line of po.lines) {
      const totalPrice = line.quantity * line.unitPrice;
      const receivedQuantity = ['RECEIVED', 'INVOICED', 'PAID'].includes(po.status) ? line.quantity :
                               po.status === 'PARTIALLY_RECEIVED' ? Math.floor(line.quantity / 2) : 0;

      await pool.query(
        `INSERT INTO purchase_order_lines (po_id, line_number, product_description, product_type, quantity, unit_price, total_price, received_quantity, status)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
         ON CONFLICT (po_id, line_number) DO UPDATE SET product_description = EXCLUDED.product_description`,
        [poId, line.lineNumber, line.productDescription, line.productType, line.quantity, line.unitPrice, totalPrice, receivedQuantity,
         receivedQuantity >= line.quantity ? 'RECEIVED' : receivedQuantity > 0 ? 'PARTIALLY_RECEIVED' : 'PENDING']
      );
      lineCount++;
    }
  }

  console.log(`  ✓ Seeded ${poCount} purchase orders with ${lineCount} line items`);
  return { poCount, lineCount };
}

// ============================================================================
// HAM Operation Seeding Functions
// ============================================================================

async function seedTransferOrders(
  pool: Pool,
  stockroomIds: Map<string, string>,
  userIds: Map<string, string>,
  createdByUserId: string
): Promise<number> {
  console.log('Seeding transfer orders...');
  let count = 0;

  for (const transfer of TRANSFER_ORDERS) {
    const fromStockroomId = stockroomIds.get(transfer.fromStockroomCode);
    const toStockroomId = stockroomIds.get(transfer.toStockroomCode);
    const requesterId = userIds.get(transfer.requesterEmail);
    if (!fromStockroomId || !toStockroomId || !requesterId) continue;

    const approvedBy = transfer.status !== 'DRAFT' && transfer.status !== 'PENDING_APPROVAL'
      ? userIds.get('asset.manager@example.com') : null;

    const result = await pool.query<{ transfer_id: string }>(
      `INSERT INTO transfer_orders (transfer_number, from_stockroom_id, to_stockroom_id, status, priority, requested_by, reason, approved_by, total_line_count, total_quantity, created_by, updated_by)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)
       ON CONFLICT (transfer_number) DO UPDATE SET status = EXCLUDED.status
       RETURNING transfer_id`,
      [transfer.transferNumber, fromStockroomId, toStockroomId, transfer.status, transfer.priority,
       requesterId, transfer.reason, approvedBy,
       transfer.lines.length, transfer.lines.reduce((s: number, l: { quantity: number }) => s + l.quantity, 0),
       createdByUserId, createdByUserId]
    );
    const transferId = result.rows[0]!.transfer_id;

    for (const line of transfer.lines) {
      await pool.query(
        `INSERT INTO transfer_order_lines (transfer_id, line_number, product_description, quantity, status)
         VALUES ($1, $2, $3, $4, $5)
         ON CONFLICT (transfer_id, line_number) DO NOTHING`,
        [transferId, line.lineNumber, line.productDescription, line.quantity, line.status]
      );
    }
    count++;
  }

  console.log(`  ✓ Seeded ${count} transfer orders`);
  return count;
}

async function seedLoanerCheckouts(
  pool: Pool,
  userIds: Map<string, string>,
  departmentIds: Map<string, string>,
  createdByUserId: string
): Promise<number> {
  console.log('Seeding loaner checkouts...');
  let count = 0;

  // Get hardware assets in DEPLOYED state to use as loaners
  const assetResult = await pool.query<{ asset_id: string }>(
    `SELECT a.asset_id FROM assets a WHERE a.asset_type = 'HARDWARE' AND a.status = 'DEPLOYED' LIMIT $1`,
    [LOANER_CHECKOUTS.length]
  );

  for (let i = 0; i < LOANER_CHECKOUTS.length && i < assetResult.rows.length; i++) {
    const checkout = LOANER_CHECKOUTS[i]!;
    const assetId = assetResult.rows[i]!.asset_id;
    const checkedOutToId = userIds.get(checkout.checkedOutToEmail);
    const checkedOutById = userIds.get(checkout.checkedOutByEmail);
    const departmentId = departmentIds.get(checkout.departmentCode);
    if (!checkedOutToId || !checkedOutById) continue;

    const dueDate = new Date();
    dueDate.setDate(dueDate.getDate() + checkout.dueDateOffsetDays);

    await pool.query(
      `INSERT INTO loaner_checkouts (checkout_number, asset_id, checked_out_to, checked_out_by, due_date, condition_out, purpose, department_id, status, is_overdue, created_by, updated_by)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)
       ON CONFLICT (checkout_number) DO UPDATE SET status = EXCLUDED.status`,
      [checkout.checkoutNumber, assetId, checkedOutToId, checkedOutById, dueDate.toISOString().slice(0, 10),
       checkout.conditionOut, checkout.purpose, departmentId, checkout.status, checkout.isOverdue,
       createdByUserId, createdByUserId]
    );
    count++;
  }

  console.log(`  ✓ Seeded ${count} loaner checkouts`);
  return count;
}

async function seedDisposalWorkflows(
  pool: Pool,
  userIds: Map<string, string>,
  createdByUserId: string
): Promise<number> {
  console.log('Seeding disposal workflows...');
  let count = 0;

  // Get hardware assets in RETIRED state for disposal
  const assetResult = await pool.query<{ asset_id: string }>(
    `SELECT a.asset_id FROM assets a WHERE a.asset_type = 'HARDWARE' AND a.status IN ('RETIRED', 'DISPOSED') LIMIT $1`,
    [DISPOSAL_WORKFLOWS.length]
  );

  for (let i = 0; i < DISPOSAL_WORKFLOWS.length && i < assetResult.rows.length; i++) {
    const disposal = DISPOSAL_WORKFLOWS[i]!;
    const assetId = assetResult.rows[i]!.asset_id;
    const initiatedById = userIds.get(disposal.initiatedByEmail);
    if (!initiatedById) continue;

    const wfResult = await pool.query<{ workflow_id: string }>(
      `INSERT INTO disposal_workflows (workflow_number, asset_id, status, disposal_method, initiated_by, data_wipe_required, environmental_check_required, notes, created_by)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
       ON CONFLICT (workflow_number) DO UPDATE SET status = EXCLUDED.status
       RETURNING workflow_id`,
      [disposal.workflowNumber, assetId, disposal.status, disposal.disposalMethod, initiatedById,
       disposal.dataWipeRequired, disposal.environmentalCheckRequired, disposal.notes, createdByUserId]
    );
    const workflowId = wfResult.rows[0]!.workflow_id;

    for (const task of disposal.tasks) {
      await pool.query(
        `INSERT INTO disposal_tasks (workflow_id, task_type, task_name, description, status, sequence, is_required, created_by)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
         ON CONFLICT DO NOTHING`,
        [workflowId, task.taskType, task.taskName, task.description, task.status, task.sequence, task.isRequired, createdByUserId]
      );
    }
    count++;
  }

  console.log(`  ✓ Seeded ${count} disposal workflows`);
  return count;
}

// ============================================================================
// EAM Operation Seeding Functions
// ============================================================================

async function seedSpareParts(
  pool: Pool,
  _vendorIds: Map<string, string>,
  createdByUserId: string
): Promise<Map<string, string>> {
  console.log('Seeding spare parts...');
  const partIds = new Map<string, string>();

  for (const part of SPARE_PARTS) {
    const result = await pool.query<{ part_id: string }>(
      `INSERT INTO spare_parts (part_number, part_name, description, manufacturer, category, quantity_on_hand, reorder_point, reorder_quantity, unit_cost, storage_location, is_critical, abc_classification, is_active, created_by, updated_by)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15)
       ON CONFLICT (part_number) DO UPDATE SET quantity_on_hand = EXCLUDED.quantity_on_hand
       RETURNING part_id`,
      [part.partNumber, part.partName, part.description, part.manufacturer, part.category,
       part.quantityOnHand, part.reorderPoint, part.reorderQuantity, part.unitCost, part.storageLocation,
       part.isCritical, part.abcClassification, true, createdByUserId, createdByUserId]
    );
    partIds.set(part.partNumber, result.rows[0]!.part_id);
  }

  console.log(`  ✓ Seeded ${SPARE_PARTS.length} spare parts`);
  return partIds;
}

async function seedWorkOrders(
  pool: Pool,
  enterpriseAssetIds: Map<string, string>,
  facilityIds: Map<string, string>,
  userIds: Map<string, string>,
  createdByUserId: string
): Promise<number> {
  console.log('Seeding work orders...');
  let count = 0;

  for (const wo of WORK_ORDERS) {
    const assetId = enterpriseAssetIds.get(wo.assetDisplayName);
    const facilityId = facilityIds.get(wo.facilityCode);
    const assignedToId = wo.assignedToEmail ? userIds.get(wo.assignedToEmail) : null;
    if (!assetId || !facilityId) continue;

    const scheduledDate = new Date();
    scheduledDate.setDate(scheduledDate.getDate() + wo.scheduledDateOffsetDays);
    const completedDate = wo.status === 'COMPLETED' ? scheduledDate.toISOString().slice(0, 10) : null;

    await pool.query(
      `INSERT INTO work_orders (work_order_number, asset_id, work_type, priority, status, title, description, estimated_duration_hours, assigned_to, facility_id, scheduled_date, completed_date, created_by, updated_by)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14)
       ON CONFLICT (work_order_number) DO UPDATE SET status = EXCLUDED.status`,
      [wo.workOrderNumber, assetId, wo.workType, wo.priority, wo.status, wo.title, wo.description,
       wo.estimatedDurationHours, assignedToId, facilityId, scheduledDate.toISOString().slice(0, 10),
       completedDate, createdByUserId, createdByUserId]
    );
    count++;
  }

  console.log(`  ✓ Seeded ${count} work orders`);
  return count;
}

async function seedLinearAssets(
  pool: Pool,
  enterpriseAssetIds: Map<string, string>
): Promise<number> {
  console.log('Seeding linear assets...');
  let count = 0;

  for (const la of LINEAR_ASSETS) {
    const assetId = enterpriseAssetIds.get(la.assetDisplayName);
    if (!assetId) continue;

    const laResult = await pool.query<{ linear_asset_id: string }>(
      `INSERT INTO linear_assets (asset_id, start_location, end_location, total_length, segment_count, linear_unit_of_measure, route_type, route_description, overall_condition_rating)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
       ON CONFLICT (asset_id) DO UPDATE SET total_length = EXCLUDED.total_length
       RETURNING linear_asset_id`,
      [assetId, la.startLocation, la.endLocation, la.totalLength, la.segments.length,
       la.linearUnit, la.routeType, la.routeDescription, la.overallCondition]
    );
    const linearAssetId = laResult.rows[0]!.linear_asset_id;

    for (const seg of la.segments) {
      await pool.query(
        `INSERT INTO linear_asset_segments (linear_asset_id, sequence_number, start_marker, end_marker, segment_length, condition_rating, material, segment_description)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
         ON CONFLICT DO NOTHING`,
        [linearAssetId, seg.sequenceNumber, seg.startMarker, seg.endMarker, seg.segmentLength,
         seg.conditionRating, seg.material, seg.segmentDescription]
      );
    }
    count++;
  }

  console.log(`  ✓ Seeded ${count} linear assets with segments`);
  return count;
}

// ============================================================================
// Main Seed Function
// ============================================================================

async function seedDatabase(pool: Pool): Promise<Record<string, number>> {
  if (await isAlreadySeeded(pool)) {
    console.log('Database already seeded, skipping');
    return { skipped: 1 };
  }

  console.log('Seeding database with full test data...');
  const counts: Record<string, number> = {};

  const departmentIds = await seedDepartments(pool);
  counts['departments'] = departmentIds.size;

  const userIds = await seedUsers(pool, departmentIds);
  counts['users'] = userIds.size;

  const stockroomIds = await seedStockrooms(pool, userIds);
  counts['stockrooms'] = stockroomIds.size;

  const manufacturerIds = await seedManufacturers(pool);
  counts['manufacturers'] = manufacturerIds.size;

  const modelIds = await seedModels(pool, manufacturerIds);
  counts['models'] = modelIds.size;

  const facilityIds = await seedFacilities(pool);
  counts['facilities'] = facilityIds.size;

  const vendorIds = await seedVendors(pool);
  counts['vendors'] = vendorIds.size;

  const adminUserId = userIds.get('admin@example.com')!;

  const contractIds = await seedContracts(pool, vendorIds, adminUserId);
  counts['contracts'] = contractIds.size;

  counts['hardware_assets'] = await seedHardwareAssets(pool, modelIds, departmentIds, stockroomIds, userIds, adminUserId, contractIds);

  const productIds = await seedSoftwareProducts(pool, adminUserId);
  counts['software_products'] = productIds.size;

  counts['entitlements'] = await seedEntitlements(pool, productIds, adminUserId);

  const enterpriseAssetIds = await seedEnterpriseAssets(pool, facilityIds, adminUserId);
  counts['enterprise_assets'] = enterpriseAssetIds.size;

  counts['maintenance_plans'] = await seedMaintenancePlans(pool, enterpriseAssetIds, adminUserId);

  const poResult = await seedPurchaseOrders(pool, vendorIds, userIds, adminUserId);
  counts['purchase_orders'] = poResult.poCount;
  counts['purchase_order_lines'] = poResult.lineCount;

  // HAM Operations
  counts['transfer_orders'] = await seedTransferOrders(pool, stockroomIds, userIds, adminUserId);
  counts['loaner_checkouts'] = await seedLoanerCheckouts(pool, userIds, departmentIds, adminUserId);
  counts['disposal_workflows'] = await seedDisposalWorkflows(pool, userIds, adminUserId);

  // EAM Operations
  const partIds = await seedSpareParts(pool, vendorIds, adminUserId);
  counts['spare_parts'] = partIds.size;
  counts['work_orders'] = await seedWorkOrders(pool, enterpriseAssetIds, facilityIds, userIds, adminUserId);
  counts['linear_assets'] = await seedLinearAssets(pool, enterpriseAssetIds);

  console.log('\nDatabase seeding complete!');
  return counts;
}

// ============================================================================
// Main Entry Point
// ============================================================================

async function main(): Promise<void> {
  console.log('='.repeat(60));
  console.log('Asset Management System - Database Seed Script');
  console.log('='.repeat(60));

  const config = loadConfig();
  let pool: Pool | null = null;

  try {
    pool = await createPool(config);
    const counts = await seedDatabase(pool);

    console.log('\nSeed Summary:');
    for (const [table, count] of Object.entries(counts)) {
      console.log(`  ${table}: ${count}`);
    }
  } catch (error) {
    console.error('Seed failed:', error);
    process.exit(1);
  } finally {
    if (pool) {
      await pool.end();
    }
  }
}

main();
