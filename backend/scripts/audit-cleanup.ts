/**
 * Enterprise audit cleanup script.
 *
 * Removes deterministic audit rows created by `audit-seed.ts`.
 *
 * Usage:
 *   AUDIT_RUN_ID=<id> npm --prefix backend run audit:cleanup
 *   npm --prefix backend run audit:cleanup         (uses seed-latest.json)
 */

import { closePool, getAuditDbMode, query } from './audit-db-client';

import { resolveExistingRunContext, writeAuditArtifact } from './audit-run-context';

async function deleteRows(
  label: string,
  sql: string,
  values: unknown[],
  deleted: Record<string, number>
): Promise<void> {
  const result = await query(sql, values);
  deleted[label] = (deleted[label] ?? 0) + (result.rowCount ?? 0);
}

async function main(): Promise<void> {
  const dbMode = await getAuditDbMode();
  const { auditRunId, auditRunKey, marker, auditRunUuid } = resolveExistingRunContext();
  const nowIso = new Date().toISOString();

  console.log(`[audit-cleanup] db-mode=${dbMode}`);

  const departmentCode = `AUD-DEP-${auditRunKey}`;
  const costCenterCode = `AUD-CC-${auditRunKey}`;
  const vendorCode = `AUD-VND-${auditRunKey}`;
  const buildingCode = `AUD-BLD-${auditRunKey}`;
  const roomNumber = `AUD-R-${auditRunKey}`;
  const rackName = `AUDIT-RACK-${auditRunKey}`;
  const sourceStockroomCode = `AUD-SRC-${auditRunKey}`;
  const destinationStockroomCode = `AUD-DST-${auditRunKey}`;
  const transferNumber = `AUDTR-${auditRunKey}`;
  const poNumber = `AUDPO-${auditRunKey}`;
  const receivingNumber = `AUDRCV-${auditRunKey}`;
  const workOrderNumber = `AUDWO-${auditRunKey}`;
  const subscriptionPortalId = `AUD-SUB-${auditRunKey}`;
  const discoverySourceId = `AUD-DISC-${auditRunKey}`;

  const deleted: Record<string, number> = {};

  await query('BEGIN');
  try {
    await deleteRows(
      'receiving_lines',
      `DELETE FROM receiving_lines
       WHERE receiving_id IN (
         SELECT receiving_id FROM receiving_records WHERE receiving_number = $1
       )`,
      [receivingNumber],
      deleted
    );

    await deleteRows(
      'receiving_records',
      'DELETE FROM receiving_records WHERE receiving_number = $1',
      [receivingNumber],
      deleted
    );

    await deleteRows(
      'purchase_order_lines',
      `DELETE FROM purchase_order_lines
       WHERE po_id IN (
         SELECT po_id FROM purchase_orders WHERE po_number = $1
       )`,
      [poNumber],
      deleted
    );

    await deleteRows(
      'purchase_orders',
      'DELETE FROM purchase_orders WHERE po_number = $1',
      [poNumber],
      deleted
    );

    await deleteRows(
      'transfer_order_lines',
      `DELETE FROM transfer_order_lines
       WHERE transfer_id IN (
         SELECT transfer_id FROM transfer_orders WHERE transfer_number = $1
       )`,
      [transferNumber],
      deleted
    );

    await deleteRows(
      'transfer_orders',
      'DELETE FROM transfer_orders WHERE transfer_number = $1',
      [transferNumber],
      deleted
    );

    await deleteRows(
      'work_order_parts',
      `DELETE FROM work_order_parts
       WHERE work_order_id IN (
         SELECT work_order_id FROM work_orders WHERE work_order_number = $1
       )`,
      [workOrderNumber],
      deleted
    );

    await deleteRows(
      'work_orders',
      'DELETE FROM work_orders WHERE work_order_number = $1',
      [workOrderNumber],
      deleted
    );

    await deleteRows(
      'stockroom_inventory',
      `DELETE FROM stockroom_inventory
       WHERE stockroom_id IN (
         SELECT stockroom_id
         FROM stockrooms
         WHERE stockroom_code = $1 OR stockroom_code = $2
       )`,
      [sourceStockroomCode, destinationStockroomCode],
      deleted
    );

    await deleteRows(
      'stockrooms',
      `DELETE FROM stockrooms
       WHERE stockroom_code = $1 OR stockroom_code = $2`,
      [sourceStockroomCode, destinationStockroomCode],
      deleted
    );

    await deleteRows(
      'renewal_notifications',
      `DELETE FROM renewal_notifications
       WHERE subscription_id IN (
         SELECT subscription_id FROM saas_subscriptions WHERE vendor_portal_id = $1
       )`,
      [subscriptionPortalId],
      deleted
    );

    await deleteRows(
      'saas_usage_records',
      `DELETE FROM saas_usage_records
       WHERE subscription_id IN (
         SELECT subscription_id FROM saas_subscriptions WHERE vendor_portal_id = $1
       )`,
      [subscriptionPortalId],
      deleted
    );

    await deleteRows(
      'saas_subscriptions',
      'DELETE FROM saas_subscriptions WHERE vendor_portal_id = $1',
      [subscriptionPortalId],
      deleted
    );

    await deleteRows(
      'discovery_records',
      `DELETE FROM discovery_records
       WHERE source_type = 'SCCM' AND source_id = $1`,
      [discoverySourceId],
      deleted
    );

    await deleteRows(
      'reconciliation_results',
      `DELETE FROM reconciliation_results
       WHERE notes = $1 OR notes ILIKE $2`,
      [`${marker} seeded reconciliation`, `%${auditRunKey}%seeded reconciliation%`],
      deleted
    );

    await deleteRows(
      'racks',
      `DELETE FROM racks
       WHERE rack_name = $1
         AND room_id IN (
           SELECT room_id FROM rooms WHERE room_number = $2
         )`,
      [rackName, roomNumber],
      deleted
    );

    await deleteRows(
      'rooms',
      'DELETE FROM rooms WHERE room_number = $1',
      [roomNumber],
      deleted
    );

    await deleteRows(
      'floors',
      `DELETE FROM floors
       WHERE building_id IN (
         SELECT building_id FROM buildings WHERE building_code = $1
       )`,
      [buildingCode],
      deleted
    );

    await deleteRows(
      'buildings',
      'DELETE FROM buildings WHERE building_code = $1',
      [buildingCode],
      deleted
    );

    await deleteRows(
      'cost_centers',
      'DELETE FROM cost_centers WHERE code = $1',
      [costCenterCode],
      deleted
    );

    await deleteRows(
      'departments',
      'DELETE FROM departments WHERE code = $1',
      [departmentCode],
      deleted
    );

    await deleteRows(
      'vendors',
      'DELETE FROM vendors WHERE vendor_code = $1',
      [vendorCode],
      deleted
    );

    await deleteRows(
      'audit_log',
      `DELETE FROM audit_log
       WHERE (action_type = 'CREATE' AND resource_type = 'AUDIT_RUN' AND resource_id = $1)
          OR (action_type = 'CREATE' AND resource_type = 'AUDIT_RUN' AND new_values::text ILIKE $2)`,
      [auditRunUuid, `%${auditRunId}%`],
      deleted
    );

    await query('COMMIT');
  } catch (error: unknown) {
    await query('ROLLBACK');
    throw error;
  }

  const totalDeleted = Object.values(deleted).reduce((sum, value) => sum + value, 0);
  const summary = {
    generatedAt: nowIso,
    auditRunId,
    auditRunKey,
    marker,
    deleted,
    totalDeleted,
  };

  const artifacts = writeAuditArtifact('cleanup', summary, auditRunKey);
  console.log(`[audit-cleanup] completed (AUDIT_RUN_ID=${auditRunId}, AUDIT_RUN_KEY=${auditRunKey})`);
  console.log(`[audit-cleanup] deleted rows: ${totalDeleted}`);
  if (artifacts.byRunPath) {
    console.log(`[audit-cleanup] artifact: ${artifacts.byRunPath}`);
  }
}

main()
  .catch((error: unknown) => {
    console.error('[audit-cleanup] failed', error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await closePool();
  });
