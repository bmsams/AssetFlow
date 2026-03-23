/**
 * Enterprise audit seed script.
 *
 * Creates deterministic, tagged records that can be reconciled and safely cleaned up
 * by AUDIT_RUN_ID.
 *
 * Usage:
 *   AUDIT_RUN_ID=<id> npm --prefix backend run audit:seed
 */

import { closePool, getAuditDbMode, query, queryOne } from './audit-db-client';
import {
  type SeedSummary,
  resolveSeedAuditRunId,
  toAuditMarker,
  toAuditRunUuid,
  toAuditRunKey,
  writeAuditArtifact,
} from './audit-run-context';

interface SeedVerification {
  readonly adminHierarchyComplete: boolean;
  readonly transferReady: boolean;
  readonly procurementReady: boolean;
  readonly receivingReady: boolean;
  readonly workOrderReady: boolean;
  readonly samReconciliationReady: boolean;
  readonly integrationReady: boolean;
  readonly notificationReady: boolean;
}

async function verifySeedState(auditRunKey: string): Promise<SeedVerification> {
  const buildingCode = `AUD-BLD-${auditRunKey}`;
  const sourceStockroomCode = `AUD-SRC-${auditRunKey}`;
  const destinationStockroomCode = `AUD-DST-${auditRunKey}`;
  const transferNumber = `AUDTR-${auditRunKey}`;
  const poNumber = `AUDPO-${auditRunKey}`;
  const receivingNumber = `AUDRCV-${auditRunKey}`;
  const workOrderNumber = `AUDWO-${auditRunKey}`;
  const discoverySourceId = `AUD-DISC-${auditRunKey}`;
  const subscriptionPortalId = `AUD-SUB-${auditRunKey}`;

  const adminHierarchy = await queryOne<{
    building_count: string;
    floor_count: string;
    room_count: string;
    rack_count: string;
    stockroom_count: string;
  }>(
    `SELECT
       COUNT(DISTINCT b.building_id)::text AS building_count,
       COUNT(DISTINCT f.floor_id)::text AS floor_count,
       COUNT(DISTINCT r.room_id)::text AS room_count,
       COUNT(DISTINCT k.rack_id)::text AS rack_count,
       COUNT(DISTINCT s.stockroom_id)::text AS stockroom_count
     FROM buildings b
     LEFT JOIN floors f ON f.building_id = b.building_id
     LEFT JOIN rooms r ON r.floor_id = f.floor_id
     LEFT JOIN racks k ON k.room_id = r.room_id
     LEFT JOIN stockrooms s ON s.building_id = b.building_id
     WHERE b.building_code = $1`,
    [buildingCode]
  );

  const transferReady = await queryOne<{ ready: boolean }>(
    `SELECT EXISTS (
       SELECT 1
       FROM transfer_orders t
       JOIN transfer_order_lines tl ON tl.transfer_id = t.transfer_id
       JOIN stockrooms src ON src.stockroom_id = t.from_stockroom_id
       JOIN stockrooms dst ON dst.stockroom_id = t.to_stockroom_id
       WHERE t.transfer_number = $1
         AND src.stockroom_code = $2
         AND dst.stockroom_code = $3
         AND src.stockroom_id <> dst.stockroom_id
     ) AS ready`,
    [transferNumber, sourceStockroomCode, destinationStockroomCode]
  );

  const procurementReady = await queryOne<{ ready: boolean }>(
    `SELECT EXISTS (
       SELECT 1
       FROM purchase_orders po
       JOIN purchase_order_lines pol ON pol.po_id = po.po_id
       WHERE po.po_number = $1
         AND pol.quantity > 0
         AND pol.unit_price >= 0
     ) AS ready`,
    [poNumber]
  );

  const receivingReady = await queryOne<{ ready: boolean }>(
    `SELECT EXISTS (
       SELECT 1
       FROM receiving_records rr
       JOIN receiving_lines rl ON rl.receiving_id = rr.receiving_id
       JOIN purchase_order_lines pol ON pol.line_id = rl.po_line_id
       JOIN purchase_orders po ON po.po_id = pol.po_id
       WHERE rr.receiving_number = $1
         AND po.po_number = $2
     ) AS ready`,
    [receivingNumber, poNumber]
  );

  const workOrderReady = await queryOne<{ ready: boolean }>(
    `SELECT EXISTS (
       SELECT 1 FROM work_orders WHERE work_order_number = $1
     ) AS ready`,
    [workOrderNumber]
  );

  const samReady = await queryOne<{ ready: boolean }>(
    `SELECT EXISTS (
       SELECT 1
       FROM reconciliation_results
       WHERE notes ILIKE $1
     ) AS ready`,
    [`%${auditRunKey}%seeded reconciliation%`]
  );

  const integrationReady = await queryOne<{ ready: boolean }>(
    `SELECT EXISTS (
       SELECT 1
       FROM discovery_records
       WHERE source_type = 'SCCM' AND source_id = $1
     ) AS ready`,
    [discoverySourceId]
  );

  const notificationReady = await queryOne<{ ready: boolean }>(
    `SELECT EXISTS (
       SELECT 1
       FROM renewal_notifications rn
       JOIN saas_subscriptions ss ON ss.subscription_id = rn.subscription_id
       WHERE ss.vendor_portal_id = $1
     ) AS ready`,
    [subscriptionPortalId]
  );

  return {
    adminHierarchyComplete:
      Number(adminHierarchy?.building_count ?? '0') >= 1 &&
      Number(adminHierarchy?.floor_count ?? '0') >= 1 &&
      Number(adminHierarchy?.room_count ?? '0') >= 1 &&
      Number(adminHierarchy?.rack_count ?? '0') >= 1 &&
      Number(adminHierarchy?.stockroom_count ?? '0') >= 2,
    transferReady: Boolean(transferReady?.ready),
    procurementReady: Boolean(procurementReady?.ready),
    receivingReady: Boolean(receivingReady?.ready),
    workOrderReady: Boolean(workOrderReady?.ready),
    samReconciliationReady: Boolean(samReady?.ready),
    integrationReady: Boolean(integrationReady?.ready),
    notificationReady: Boolean(notificationReady?.ready),
  };
}

async function main(): Promise<void> {
  const dbMode = await getAuditDbMode();
  const auditRunId = resolveSeedAuditRunId();
  const auditRunKey = toAuditRunKey(auditRunId);
  const auditRunUuid = toAuditRunUuid(auditRunId);
  const marker = toAuditMarker(auditRunId);
  const now = new Date().toISOString();
  const fiscalYear = new Date().getUTCFullYear();

  console.log(`[audit-seed] db-mode=${dbMode}`);

  const ids: Record<string, string> = {};
  ids['auditRunUuid'] = auditRunUuid;

  const user = await queryOne<{ user_id: string }>(
    'SELECT user_id FROM users WHERE is_active = TRUE ORDER BY created_at ASC LIMIT 1'
  );
  if (!user) {
    throw new Error('No active users found. Seed base data first.');
  }
  ids['userId'] = user.user_id;

  const model = await queryOne<{ model_id: string; model_name: string | null }>(
    'SELECT model_id, model_name FROM models ORDER BY created_at ASC LIMIT 1'
  );
  if (!model) {
    throw new Error('No models found. Seed base data first.');
  }
  ids['modelId'] = model.model_id;

  const softwareProduct = await queryOne<{ product_id: string }>(
    'SELECT product_id FROM software_products ORDER BY created_at ASC LIMIT 1'
  );
  if (!softwareProduct) {
    throw new Error('No software products found. Seed base data first.');
  }
  ids['softwareProductId'] = softwareProduct.product_id;

  const asset = await queryOne<{ asset_id: string }>(
    "SELECT asset_id FROM assets WHERE asset_type = 'HARDWARE' ORDER BY created_at ASC LIMIT 1"
  );
  if (!asset) {
    throw new Error('No hardware assets found. Seed base data first.');
  }
  ids['assetId'] = asset.asset_id;

  const departmentCode = `AUD-DEP-${auditRunKey}`;
  const department = await queryOne<{ department_id: string }>(
    `INSERT INTO departments (code, name, is_active, created_at, updated_at)
     VALUES ($1, $2, TRUE, $3, $3)
     ON CONFLICT (code)
     DO UPDATE SET name = EXCLUDED.name, updated_at = EXCLUDED.updated_at
     RETURNING department_id`,
    [departmentCode, `Audit Department ${auditRunKey}`, now]
  );
  if (!department) {
    throw new Error('Failed to create/update audit department');
  }
  ids['departmentId'] = department.department_id;

  const costCenterCode = `AUD-CC-${auditRunKey}`;
  const costCenter = await queryOne<{ cost_center_id: string }>(
    `INSERT INTO cost_centers (
       code, name, department_id, budget_amount, spent_amount, fiscal_year,
       is_active, created_at, updated_at
     )
     VALUES ($1, $2, $3, 100000, 0, $4, TRUE, $5, $5)
     ON CONFLICT (code)
     DO UPDATE SET
       name = EXCLUDED.name,
       department_id = EXCLUDED.department_id,
       fiscal_year = EXCLUDED.fiscal_year,
       updated_at = EXCLUDED.updated_at
     RETURNING cost_center_id`,
    [costCenterCode, `Audit Cost Center ${auditRunKey}`, department.department_id, fiscalYear, now]
  );
  if (!costCenter) {
    throw new Error('Failed to create/update audit cost center');
  }
  ids['costCenterId'] = costCenter.cost_center_id;

  const vendorCode = `AUD-VND-${auditRunKey}`;
  const existingVendor = await queryOne<{ vendor_id: string }>(
    'SELECT vendor_id FROM vendors WHERE vendor_code = $1 LIMIT 1',
    [vendorCode]
  );
  const vendor = existingVendor
    ? await queryOne<{ vendor_id: string }>(
        `UPDATE vendors
         SET vendor_name = $1,
             contact_email = $2,
             updated_at = $3
         WHERE vendor_id = $4
         RETURNING vendor_id`,
        [
          `Audit Vendor ${auditRunKey}`,
          `audit+${auditRunKey}@example.com`,
          now,
          existingVendor.vendor_id,
        ]
      )
    : await queryOne<{ vendor_id: string }>(
        `INSERT INTO vendors (
           vendor_name, vendor_code, vendor_type, contact_name, contact_email,
           is_active, created_at, updated_at
         )
         VALUES ($1, $2, 'RESELLER', 'Audit Vendor', $3, TRUE, $4, $4)
         RETURNING vendor_id`,
        [`Audit Vendor ${auditRunKey}`, vendorCode, `audit+${auditRunKey}@example.com`, now]
      );
  if (!vendor) {
    throw new Error('Failed to create/update audit vendor');
  }
  ids['vendorId'] = vendor.vendor_id;

  const buildingCode = `AUD-BLD-${auditRunKey}`;
  const building = await queryOne<{ building_id: string }>(
    `INSERT INTO buildings (
       building_code, name, country, is_active,
       created_at, updated_at, created_by, updated_by
     )
     VALUES ($1, $2, 'USA', TRUE, $3, $3, $4, $4)
     ON CONFLICT (building_code)
     DO UPDATE SET
       name = EXCLUDED.name,
       updated_at = EXCLUDED.updated_at,
       updated_by = EXCLUDED.updated_by
     RETURNING building_id`,
    [buildingCode, `Audit Building ${auditRunKey}`, now, user.user_id]
  );
  if (!building) {
    throw new Error('Failed to create/update audit building');
  }
  ids['buildingId'] = building.building_id;

  const floorNumber = 1;
  let floor = await queryOne<{ floor_id: string }>(
    'SELECT floor_id FROM floors WHERE building_id = $1 AND floor_number = $2',
    [building.building_id, floorNumber]
  );
  if (!floor) {
    floor = await queryOne<{ floor_id: string }>(
      `INSERT INTO floors (
         building_id, floor_number, name, is_active,
         created_at, updated_at, created_by, updated_by
       )
       VALUES ($1, $2, $3, TRUE, $4, $4, $5, $5)
       RETURNING floor_id`,
      [building.building_id, floorNumber, `Audit Floor ${auditRunKey}`, now, user.user_id]
    );
  }
  if (!floor) {
    throw new Error('Failed to create/find audit floor');
  }
  ids['floorId'] = floor.floor_id;

  const roomNumber = `AUD-R-${auditRunKey}`;
  let room = await queryOne<{ room_id: string }>(
    'SELECT room_id FROM rooms WHERE floor_id = $1 AND room_number = $2',
    [floor.floor_id, roomNumber]
  );
  if (!room) {
    room = await queryOne<{ room_id: string }>(
      `INSERT INTO rooms (
         floor_id, room_number, name, room_type, is_active,
         created_at, updated_at, created_by, updated_by
       )
       VALUES ($1, $2, $3, 'STORAGE', TRUE, $4, $4, $5, $5)
       RETURNING room_id`,
      [floor.floor_id, roomNumber, `Audit Room ${auditRunKey}`, now, user.user_id]
    );
  }
  if (!room) {
    throw new Error('Failed to create/find audit room');
  }
  ids['roomId'] = room.room_id;

  const rackName = `AUDIT-RACK-${auditRunKey}`;
  let rack = await queryOne<{ rack_id: string }>(
    'SELECT rack_id FROM racks WHERE room_id = $1 AND rack_name = $2',
    [room.room_id, rackName]
  );
  if (!rack) {
    rack = await queryOne<{ rack_id: string }>(
      `INSERT INTO racks (
         room_id, rack_name, total_units, used_units, is_active,
         created_at, updated_at, created_by, updated_by
       )
       VALUES ($1, $2, 42, 0, TRUE, $3, $3, $4, $4)
       RETURNING rack_id`,
      [room.room_id, rackName, now, user.user_id]
    );
  }
  if (!rack) {
    throw new Error('Failed to create/find audit rack');
  }
  ids['rackId'] = rack.rack_id;

  const sourceStockroomCode = `AUD-SRC-${auditRunKey}`;
  const destStockroomCode = `AUD-DST-${auditRunKey}`;

  const existingSourceStockroom = await queryOne<{ stockroom_id: string }>(
    'SELECT stockroom_id FROM stockrooms WHERE stockroom_code = $1 LIMIT 1',
    [sourceStockroomCode]
  );
  const sourceStockroom = existingSourceStockroom
    ? await queryOne<{ stockroom_id: string }>(
        `UPDATE stockrooms
         SET name = $1,
             stockroom_type = 'MAIN',
             is_active = TRUE,
             building_id = $2,
             cost_center_id = $3,
             updated_at = $4,
             updated_by = $5
         WHERE stockroom_id = $6
         RETURNING stockroom_id`,
        [
          `Audit Source Stockroom ${auditRunKey}`,
          building.building_id,
          costCenter.cost_center_id,
          now,
          user.user_id,
          existingSourceStockroom.stockroom_id,
        ]
      )
    : await queryOne<{ stockroom_id: string }>(
        `INSERT INTO stockrooms (
           name, stockroom_code, stockroom_type, is_active, building_id, cost_center_id,
           created_at, updated_at, created_by, updated_by
         )
         VALUES ($1, $2, 'MAIN', TRUE, $3, $4, $5, $5, $6, $6)
         RETURNING stockroom_id`,
        [
          `Audit Source Stockroom ${auditRunKey}`,
          sourceStockroomCode,
          building.building_id,
          costCenter.cost_center_id,
          now,
          user.user_id,
        ]
      );

  const existingDestinationStockroom = await queryOne<{ stockroom_id: string }>(
    'SELECT stockroom_id FROM stockrooms WHERE stockroom_code = $1 LIMIT 1',
    [destStockroomCode]
  );
  const destinationStockroom = existingDestinationStockroom
    ? await queryOne<{ stockroom_id: string }>(
        `UPDATE stockrooms
         SET name = $1,
             stockroom_type = 'SATELLITE',
             is_active = TRUE,
             building_id = $2,
             cost_center_id = $3,
             updated_at = $4,
             updated_by = $5
         WHERE stockroom_id = $6
         RETURNING stockroom_id`,
        [
          `Audit Destination Stockroom ${auditRunKey}`,
          building.building_id,
          costCenter.cost_center_id,
          now,
          user.user_id,
          existingDestinationStockroom.stockroom_id,
        ]
      )
    : await queryOne<{ stockroom_id: string }>(
        `INSERT INTO stockrooms (
           name, stockroom_code, stockroom_type, is_active, building_id, cost_center_id,
           created_at, updated_at, created_by, updated_by
         )
         VALUES ($1, $2, 'SATELLITE', TRUE, $3, $4, $5, $5, $6, $6)
         RETURNING stockroom_id`,
        [
          `Audit Destination Stockroom ${auditRunKey}`,
          destStockroomCode,
          building.building_id,
          costCenter.cost_center_id,
          now,
          user.user_id,
        ]
      );
  if (!sourceStockroom || !destinationStockroom) {
    throw new Error('Failed to create/find audit stockrooms');
  }
  ids['sourceStockroomId'] = sourceStockroom.stockroom_id;
  ids['destinationStockroomId'] = destinationStockroom.stockroom_id;

  await query(
    `INSERT INTO stockroom_inventory (
       stockroom_id, product_id, product_type, product_description,
       quantity_on_hand, quantity_reserved, unit_cost, total_value,
       is_active, created_at, updated_at
     )
     VALUES ($1, $2, 'HARDWARE_MODEL', $3, 25, 0, 100, 2500, TRUE, $4, $4)
     ON CONFLICT (stockroom_id, product_id, product_type)
     DO UPDATE SET
       product_description = EXCLUDED.product_description,
       quantity_on_hand = EXCLUDED.quantity_on_hand,
       unit_cost = EXCLUDED.unit_cost,
       total_value = EXCLUDED.total_value,
       updated_at = EXCLUDED.updated_at`,
    [
      sourceStockroom.stockroom_id,
      model.model_id,
      `${marker} hardware model seed`,
      now,
    ]
  );

  const transferNumber = `AUDTR-${auditRunKey}`;
  const transfer = await queryOne<{ transfer_id: string }>(
    `INSERT INTO transfer_orders (
       transfer_number, from_stockroom_id, to_stockroom_id,
       status, priority, requested_by, requested_date, reason,
       total_line_count, total_quantity, notes,
       created_at, updated_at, created_by, updated_by
     )
     VALUES ($1, $2, $3, 'APPROVED', 'HIGH', $4, $5, $6, 1, 5, $7, $5, $5, $4, $4)
     ON CONFLICT (transfer_number)
     DO UPDATE SET
       status = EXCLUDED.status,
       total_line_count = EXCLUDED.total_line_count,
       total_quantity = EXCLUDED.total_quantity,
       notes = EXCLUDED.notes,
       updated_at = EXCLUDED.updated_at,
       updated_by = EXCLUDED.updated_by
     RETURNING transfer_id`,
    [
      transferNumber,
      sourceStockroom.stockroom_id,
      destinationStockroom.stockroom_id,
      user.user_id,
      now,
      `${marker} seeded transfer`,
      `${marker} seeded transfer`,
    ]
  );
  if (!transfer) {
    throw new Error('Failed to create/update audit transfer order');
  }
  ids['transferId'] = transfer.transfer_id;

  await query(
    `INSERT INTO transfer_order_lines (
       transfer_id, line_number, product_id, product_type, product_description,
       quantity, shipped_quantity, received_quantity, status, notes, created_at, updated_at
     )
     VALUES ($1, 1, $2, 'HARDWARE_MODEL', $3, 5, 0, 0, 'PENDING', $4, $5, $5)
     ON CONFLICT (transfer_id, line_number)
     DO UPDATE SET
       product_description = EXCLUDED.product_description,
       quantity = EXCLUDED.quantity,
       status = EXCLUDED.status,
       notes = EXCLUDED.notes,
       updated_at = EXCLUDED.updated_at`,
    [
      transfer.transfer_id,
      model.model_id,
      `${model.model_name ?? 'Audit Model'} ${marker}`,
      `${marker} seeded transfer line`,
      now,
    ]
  );

  const poNumber = `AUDPO-${auditRunKey}`;
  const purchaseOrder = await queryOne<{ po_id: string }>(
    `INSERT INTO purchase_orders (
       po_number, vendor_id, requested_by, approved_by, status,
       requested_date, order_date, expected_delivery_date,
       currency, subtotal, tax_amount, shipping_amount, total_amount,
       ship_to_address, shipping_method, payment_terms,
       notes, created_at, updated_at, created_by, updated_by
     )
     VALUES (
       $1, $2, $3, $3, 'APPROVED',
       CURRENT_DATE, CURRENT_DATE, CURRENT_DATE + INTERVAL '7 day',
       'USD', 500, 0, 0, 500,
       'Audit Receiving Dock', 'GROUND', 'NET30',
       $4, $5, $5, $3, $3
     )
     ON CONFLICT (po_number)
     DO UPDATE SET
       status = EXCLUDED.status,
       total_amount = EXCLUDED.total_amount,
       notes = EXCLUDED.notes,
       updated_at = EXCLUDED.updated_at,
       updated_by = EXCLUDED.updated_by
     RETURNING po_id`,
    [poNumber, vendor.vendor_id, user.user_id, `${marker} seeded purchase order`, now]
  );
  if (!purchaseOrder) {
    throw new Error('Failed to create/update audit purchase order');
  }
  ids['purchaseOrderId'] = purchaseOrder.po_id;

  const poLine = await queryOne<{ line_id: string }>(
    `INSERT INTO purchase_order_lines (
       po_id, line_number, product_id, product_type, product_description,
       quantity, received_quantity, unit_price, total_price, status,
       vendor_id, vendor_name, cost_center_id, notes, created_at, updated_at
     )
     VALUES (
       $1, 1, $2, 'HARDWARE', $3,
       5, 0, 100, 500, 'PENDING',
       $4, $5, $6, $7, $8, $8
     )
     ON CONFLICT (po_id, line_number)
     DO UPDATE SET
       product_description = EXCLUDED.product_description,
       quantity = EXCLUDED.quantity,
       unit_price = EXCLUDED.unit_price,
       total_price = EXCLUDED.total_price,
       notes = EXCLUDED.notes,
       updated_at = EXCLUDED.updated_at
     RETURNING line_id`,
    [
      purchaseOrder.po_id,
      model.model_id,
      `${model.model_name ?? 'Audit Model'} ${marker}`,
      vendor.vendor_id,
      `Audit Vendor ${auditRunKey}`,
      costCenter.cost_center_id,
      `${marker} seeded purchase order line`,
      now,
    ]
  );
  if (!poLine) {
    throw new Error('Failed to create/update audit purchase order line');
  }
  ids['purchaseOrderLineId'] = poLine.line_id;

  const receivingNumber = `AUDRCV-${auditRunKey}`;
  const receivingRecord = await queryOne<{ receiving_id: string }>(
    `INSERT INTO receiving_records (
       receiving_number, po_id, stockroom_id, received_by, received_date, vendor_id,
       status, total_line_count, total_quantity_expected, total_quantity_received,
       notes, created_at, updated_at, created_by, updated_by
     )
     VALUES (
       $1, $2, $3, $4, $5, $6,
       'IN_PROGRESS', 1, 5, 0,
       $7, $5, $5, $4, $4
     )
     ON CONFLICT (receiving_number)
     DO UPDATE SET
       status = EXCLUDED.status,
       total_line_count = EXCLUDED.total_line_count,
       total_quantity_expected = EXCLUDED.total_quantity_expected,
       notes = EXCLUDED.notes,
       updated_at = EXCLUDED.updated_at,
       updated_by = EXCLUDED.updated_by
     RETURNING receiving_id`,
    [
      receivingNumber,
      purchaseOrder.po_id,
      sourceStockroom.stockroom_id,
      user.user_id,
      now,
      vendor.vendor_id,
      `${marker} seeded receiving`,
    ]
  );
  if (!receivingRecord) {
    throw new Error('Failed to create/update audit receiving record');
  }
  ids['receivingId'] = receivingRecord.receiving_id;

  await query(
    `INSERT INTO receiving_lines (
       receiving_id, line_number, po_line_id, product_id, product_type, product_description,
       quantity_expected, quantity_received, status, condition,
       asset_ids_created, serial_numbers_scanned, notes, created_at, updated_at
     )
     VALUES (
       $1, 1, $2, $3, 'HARDWARE', $4,
       5, 0, 'PENDING', 'GOOD',
       '{}', '{}', $5, $6, $6
     )
     ON CONFLICT (receiving_id, line_number)
     DO UPDATE SET
       quantity_expected = EXCLUDED.quantity_expected,
       status = EXCLUDED.status,
       notes = EXCLUDED.notes,
       updated_at = EXCLUDED.updated_at`,
    [
      receivingRecord.receiving_id,
      poLine.line_id,
      model.model_id,
      `${model.model_name ?? 'Audit Model'} ${marker}`,
      `${marker} seeded receiving line`,
      now,
    ]
  );

  const workOrderNumber = `AUDWO-${auditRunKey}`;
  const workOrder = await queryOne<{ work_order_id: string }>(
    `INSERT INTO work_orders (
       work_order_number, asset_id, work_type, priority, status,
       title, description, requested_date, scheduled_date, due_date,
       assigned_to, assigned_date, created_at, updated_at, created_by, updated_by
     )
     VALUES (
       $1, $2, 'CORRECTIVE', 'HIGH', 'ASSIGNED',
       $3, $4, CURRENT_DATE, CURRENT_DATE, CURRENT_DATE + INTERVAL '2 day',
       $5, $6, $6, $6, $5, $5
     )
     ON CONFLICT (work_order_number)
     DO UPDATE SET
       status = EXCLUDED.status,
       title = EXCLUDED.title,
       description = EXCLUDED.description,
       updated_at = EXCLUDED.updated_at,
       updated_by = EXCLUDED.updated_by
     RETURNING work_order_id`,
    [
      workOrderNumber,
      asset.asset_id,
      `Audit Work Order ${auditRunKey}`,
      `${marker} seeded eam work order`,
      user.user_id,
      now,
    ]
  );
  if (!workOrder) {
    throw new Error('Failed to create/update audit work order');
  }
  ids['workOrderId'] = workOrder.work_order_id;

  const existingReconciliation = await queryOne<{ result_id: string }>(
    'SELECT result_id FROM reconciliation_results WHERE notes = $1 LIMIT 1',
    [`${marker} seeded reconciliation`]
  );

  if (existingReconciliation) {
    ids['reconciliationResultId'] = existingReconciliation.result_id;
  } else {
    const reconciliation = await queryOne<{ result_id: string }>(
      `INSERT INTO reconciliation_results (
         software_product_id, entitlements_owned, installations_found, compliance_position,
         over_under_licensed_count, last_reconciled_at, effective_license_position, license_demand,
         compliance_percentage, reconciliation_run_id, reconciliation_type, notes, created_at, created_by
       )
       VALUES (
         $1, 50, 45, 'OVER_LICENSED',
         5, $2, 50, 45,
         111.11, NULL, 'ON_DEMAND', $3, $2, $4
       )
       RETURNING result_id`,
      [
        softwareProduct.product_id,
        now,
        `${marker} seeded reconciliation`,
        user.user_id,
      ]
    );
    if (!reconciliation) {
      throw new Error('Failed to create audit reconciliation result');
    }
    ids['reconciliationResultId'] = reconciliation.result_id;
  }

  const discoverySourceId = `AUD-DISC-${auditRunKey}`;
  const discovery = await queryOne<{ discovery_record_id: string }>(
    `INSERT INTO discovery_records (
       source_type, source_id, source_name, serial_number, hostname,
       last_seen, discovered_at, status, matched_asset_id, raw_data, created_at, updated_at
     )
     VALUES (
       'SCCM', $1, $2, $3, $4,
       $5, $5, 'MATCHED', $6, $7::jsonb, $5, $5
     )
     ON CONFLICT (source_type, source_id)
     DO UPDATE SET
       source_name = EXCLUDED.source_name,
       serial_number = EXCLUDED.serial_number,
       hostname = EXCLUDED.hostname,
       last_seen = EXCLUDED.last_seen,
       discovered_at = EXCLUDED.discovered_at,
       status = EXCLUDED.status,
       matched_asset_id = EXCLUDED.matched_asset_id,
       raw_data = EXCLUDED.raw_data,
       updated_at = EXCLUDED.updated_at
     RETURNING discovery_record_id`,
    [
      discoverySourceId,
      `Audit SCCM ${auditRunKey}`,
      `AUD-SN-${auditRunKey}`,
      `audit-host-${auditRunKey.toLowerCase()}`,
      now,
      asset.asset_id,
      JSON.stringify({
        auditRunId,
        auditRunKey,
        source: 'SCCM',
      }),
    ]
  );
  if (!discovery) {
    throw new Error('Failed to create/update audit discovery record');
  }
  ids['discoveryRecordId'] = discovery.discovery_record_id;

  const subscriptionPortalId = `AUD-SUB-${auditRunKey}`;
  const existingSubscription = await queryOne<{ subscription_id: string }>(
    'SELECT subscription_id FROM saas_subscriptions WHERE vendor_portal_id = $1 LIMIT 1',
    [subscriptionPortalId]
  );

  const subscription =
    existingSubscription ??
    (await queryOne<{ subscription_id: string }>(
      `INSERT INTO saas_subscriptions (
         software_product_id, vendor_portal_id, total_licenses, assigned_licenses,
         monthly_cost, annual_cost, renewal_date, subscription_name, subscription_tier,
         billing_cycle, status, start_date, created_at, updated_at, created_by, updated_by
       )
       VALUES (
         $1, $2, 50, 10,
         500, 6000, CURRENT_DATE + INTERVAL '30 day', $3, 'ENTERPRISE',
         'MONTHLY', 'ACTIVE', CURRENT_DATE - INTERVAL '30 day', $4, $4, $5, $5
       )
       RETURNING subscription_id`,
      [
        softwareProduct.product_id,
        subscriptionPortalId,
        `Audit SaaS Subscription ${auditRunKey}`,
        now,
        user.user_id,
      ]
    ));

  if (!subscription) {
    throw new Error('Failed to create/find audit SaaS subscription');
  }
  ids['saasSubscriptionId'] = subscription.subscription_id;

  const renewalNotification = await queryOne<{ notification_id: string }>(
    `INSERT INTO renewal_notifications (
       subscription_id, days_before_renewal, notification_type, status,
       sent_at, created_at, updated_at, created_by
     )
     VALUES ($1, 30, '30_DAY', 'SENT', $2, $2, $2, $3)
     ON CONFLICT (subscription_id, notification_type)
     DO UPDATE SET
       status = EXCLUDED.status,
       sent_at = EXCLUDED.sent_at,
       updated_at = EXCLUDED.updated_at
     RETURNING notification_id`,
    [subscription.subscription_id, now, user.user_id]
  );
  if (!renewalNotification) {
    throw new Error('Failed to create/update audit renewal notification');
  }
  ids['renewalNotificationId'] = renewalNotification.notification_id;

  await query(
    `INSERT INTO audit_log (
       user_id, action_type, resource_type, resource_id, old_values, new_values, timestamp
     )
     VALUES ($1, 'CREATE', 'AUDIT_RUN', $2, '{}'::jsonb, $3::jsonb, $4)`,
    [
      user.user_id,
      auditRunUuid,
      JSON.stringify({
        auditRunId,
        auditRunKey,
        auditRunUuid,
        transferNumber,
        poNumber,
        workOrderNumber,
      }),
      now,
    ]
  );

  const verification = await verifySeedState(auditRunKey);
  const allSeedChecksPassed = Object.values(verification).every((value) => value);
  if (!allSeedChecksPassed) {
    throw new Error(`Seed verification failed for AUDIT_RUN_KEY=${auditRunKey}`);
  }

  const summary: SeedSummary = {
    generatedAt: new Date().toISOString(),
    auditRunId,
    auditRunKey,
    marker,
    ids,
    verification,
  };

  const artifactPaths = writeAuditArtifact('seed', summary, auditRunKey);
  console.log(
    `[audit-seed] completed (AUDIT_RUN_ID=${auditRunId}, AUDIT_RUN_KEY=${auditRunKey})`
  );
  if (artifactPaths.byRunPath) {
    console.log(`[audit-seed] artifact: ${artifactPaths.byRunPath}`);
  }
}

main()
  .catch((error: unknown) => {
    console.error('[audit-seed] failed', error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await closePool();
  });
