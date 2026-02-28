/**
 * Integration smoke runner for WS2 closure:
 * - location dependency paths
 * - purchase order create/list/detail
 * - receiving create/detail
 *
 * Safe usage:
 * - Defaults to read-only checks.
 * - Set ALLOW_SMOKE_WRITE=true to execute create/update/delete smoke flow.
 */

import { closePool, query, queryMany, queryOne } from '@ams/database';

import {
  getBuildingDependencies,
  getFloorDependencies,
  getRackDependencies,
  getRoomDependencies,
} from '../packages/services/admin-service/src/location/location-repository';
import {
  createPurchaseOrder,
  getPurchaseOrderById,
  getPurchaseOrderLines,
  getPurchaseOrders,
} from '../packages/services/lifecycle-service/src/procurement/procurement-repository';
import {
  createReceivingLineFromPO,
  createReceivingRecord,
  getReceivingRecordById,
  getReceivingRecordsByPO,
} from '../packages/services/lifecycle-service/src/receiving/receiving-repository';

async function runLocationSmoke(): Promise<void> {
  const building = await queryOne<{ building_id: string }>(
    'SELECT building_id FROM buildings ORDER BY created_at ASC LIMIT 1'
  );
  if (!building) {
    console.log('[smoke] locations: skipped (no buildings)');
    return;
  }

  await getBuildingDependencies(building.building_id);

  const floor = await queryOne<{ floor_id: string }>(
    'SELECT floor_id FROM floors WHERE building_id = $1 ORDER BY created_at ASC LIMIT 1',
    [building.building_id]
  );
  if (floor) {
    await getFloorDependencies(floor.floor_id);
  }

  const room = await queryOne<{ room_id: string }>(
    'SELECT room_id FROM rooms WHERE floor_id = $1 ORDER BY created_at ASC LIMIT 1',
    [floor?.floor_id ?? null]
  );
  if (room) {
    await getRoomDependencies(room.room_id);
  }

  const rack = await queryOne<{ rack_id: string }>(
    'SELECT rack_id FROM racks WHERE room_id = $1 ORDER BY created_at ASC LIMIT 1',
    [room?.room_id ?? null]
  );
  if (rack) {
    await getRackDependencies(rack.rack_id);
  }

  console.log('[smoke] locations: passed');
}

async function runProcurementReadSmoke(): Promise<void> {
  await getPurchaseOrders({ page: 1, limit: 5 });
  const poRow = await queryOne<{ po_id: string }>(
    'SELECT po_id FROM purchase_orders ORDER BY created_at DESC LIMIT 1'
  );
  if (poRow) {
    await getPurchaseOrderById(poRow.po_id);
    await getPurchaseOrderLines(poRow.po_id);
    await getReceivingRecordsByPO(poRow.po_id);
  }
  console.log('[smoke] procurement-read: passed');
}

async function runWriteSmoke(): Promise<void> {
  const user = await queryOne<{ user_id: string }>('SELECT user_id FROM users ORDER BY created_at ASC LIMIT 1');
  if (!user) {
    throw new Error('write smoke requires at least one user record');
  }

  const created = await createPurchaseOrder({
    requesterId: user.user_id,
    requesterName: 'Integration Smoke',
    currency: 'USD',
    notes: 'integration smoke test',
    lines: [
      {
        productType: 'OTHER',
        productName: 'Smoke PO Line',
        productDescription: 'Smoke PO Line',
        quantity: 1,
        unitPrice: 1,
      },
    ],
  });

  const poId = created.purchaseOrder.poId;
  const lineId = created.lines[0]?.lineId;
  if (!lineId) {
    throw new Error('createPurchaseOrder did not return a line');
  }

  await getPurchaseOrderById(poId);
  await getPurchaseOrderLines(poId);

  const receiving = await createReceivingRecord({
    poId,
    receivedBy: user.user_id,
    notes: 'integration smoke receiving',
  });

  await createReceivingLineFromPO(receiving.receivingId, lineId);
  await getReceivingRecordById(receiving.receivingId);
  await getReceivingRecordsByPO(poId);

  // Cleanup smoke records.
  await query(
    'DELETE FROM receiving_lines WHERE receiving_id IN (SELECT receiving_id FROM receiving_records WHERE po_id = $1)',
    [poId]
  );
  await query('DELETE FROM receiving_records WHERE po_id = $1', [poId]);
  await query('DELETE FROM purchase_orders WHERE po_id = $1', [poId]);

  console.log('[smoke] procurement-write: passed');
}

async function main(): Promise<void> {
  const allowWrite = process.env['ALLOW_SMOKE_WRITE'] === 'true';
  console.log(`[smoke] start (ALLOW_SMOKE_WRITE=${allowWrite ? 'true' : 'false'})`);

  await runLocationSmoke();
  await runProcurementReadSmoke();

  if (allowWrite) {
    await runWriteSmoke();
  } else {
    console.log('[smoke] write flow skipped (set ALLOW_SMOKE_WRITE=true to enable)');
  }

  const touched = await queryMany<{ table_name: string; row_count: string }>(
    `SELECT relname::text AS table_name, n_live_tup::text AS row_count
     FROM pg_stat_user_tables
     WHERE relname IN ('purchase_orders', 'purchase_order_lines', 'receiving_records', 'receiving_lines')
     ORDER BY relname ASC`
  );
  console.log('[smoke] table stats snapshot:', touched);
  console.log('[smoke] complete');
}

main()
  .catch((error: unknown) => {
    console.error('[smoke] failed', error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await closePool();
  });
