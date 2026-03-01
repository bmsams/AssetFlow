import type { Page, Route } from 'playwright/test';

type Json = Record<string, unknown> | unknown[] | string | number | boolean | null;

interface RequisitionLineState {
  reqLineId: string;
  requisitionId: string;
  lineNumber: number;
  status: 'DRAFT' | 'APPROVED' | 'REJECTED' | 'CONVERTED';
  productType: 'HARDWARE_MODEL' | 'SOFTWARE_PRODUCT' | 'SERVICE' | 'OTHER';
  productDescription: string;
  quantity: number;
  unitPrice: number;
  lineTotal: number;
  currency: string;
  vendorId?: string;
  vendorName?: string;
  costCenterId?: string;
  costCenterCode?: string;
  sourceType: 'MANUAL';
  sourceSnapshot: Record<string, unknown>;
  convertedPoId?: string;
  convertedPoLineId?: string;
  notes?: string;
  createdAt: string;
  updatedAt: string;
}

interface RequisitionState {
  requisitionId: string;
  requisitionNumber: string;
  status: 'DRAFT' | 'PENDING_APPROVAL' | 'APPROVED' | 'REJECTED' | 'PARTIALLY_CONVERTED' | 'CONVERTED' | 'CANCELLED';
  requestedDate: string;
  needByDate?: string;
  legalEntity?: string;
  currency: string;
  costCenterId?: string;
  shipToBuildingId?: string;
  shipToAddress?: string;
  notes?: string;
  createdAt: string;
  updatedAt: string;
  lines: RequisitionLineState[];
}

interface ReceivingState {
  receivingRecord: Record<string, unknown>;
  lines: Array<Record<string, unknown>>;
}

function json(route: Route, status: number, body: Json): Promise<void> {
  return route.fulfill({
    status,
    contentType: 'application/json',
    body: JSON.stringify(body),
  });
}

function paginated(items: unknown[], page = 1, limit = 100): Record<string, unknown> {
  return {
    items,
    total: items.length,
    page,
    limit,
    totalPages: Math.max(1, Math.ceil(items.length / Math.max(limit, 1))),
  };
}

function toObject(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    return {};
  }
  return value as Record<string, unknown>;
}

function postBody(route: Route): Record<string, unknown> {
  try {
    return toObject(route.request().postDataJSON());
  } catch {
    return {};
  }
}

function makePurchaseOrderDetail(nowIso: string, overrides?: Partial<Record<string, unknown>>): Record<string, unknown> {
  const poId = String(overrides?.poId ?? 'po-converted-001');
  const poNumber = String(overrides?.poNumber ?? 'PO-2026-0001');
  const status = String(overrides?.status ?? 'SENT');
  const lineQuantity = Number(overrides?.lineQuantity ?? 2);
  const unitPrice = Number(overrides?.unitPrice ?? 1200);
  const lineTotal = lineQuantity * unitPrice;

  return {
    poId,
    poNumber,
    vendorName: String(overrides?.vendorName ?? 'Acme Technology'),
    vendorId: String(overrides?.vendorId ?? 'vendor-100'),
    status,
    requestedDate: nowIso,
    orderDate: nowIso,
    expectedDeliveryDate: String(overrides?.expectedDeliveryDate ?? '2026-03-15'),
    totalAmount: lineTotal,
    lineItemCount: 1,
    requesterName: 'E2E User',
    approverName: 'E2E Approver',
    approvedDate: nowIso,
    receivedCount: Number(overrides?.receivedCount ?? 0),
    totalCount: lineQuantity,
    costCenterId: String(overrides?.costCenterId ?? 'cc-100'),
    costCenterCode: String(overrides?.costCenterCode ?? 'CC-100'),
    requestedById: 'user-e2e',
    approvedById: 'approver-e2e',
    sentDate: nowIso,
    subtotal: lineTotal,
    taxAmount: 0,
    shippingAmount: 0,
    notes: 'Converted from requisition',
    lines: [
      {
        lineId: 'po-line-1',
        poId,
        lineNumber: 1,
        productType: 'OTHER',
        productDescription: 'Rugged Laptop Bundle',
        quantity: lineQuantity,
        unitPrice,
        lineTotal,
        quantityReceived: Number(overrides?.receivedCount ?? 0),
        vendorId: String(overrides?.vendorId ?? 'vendor-100'),
        vendorName: String(overrides?.vendorName ?? 'Acme Technology'),
        effectiveVendorId: String(overrides?.vendorId ?? 'vendor-100'),
        effectiveVendorName: String(overrides?.vendorName ?? 'Acme Technology'),
        costCenterId: String(overrides?.costCenterId ?? 'cc-100'),
        costCenterCode: String(overrides?.costCenterCode ?? 'CC-100'),
        effectiveCostCenterId: String(overrides?.costCenterId ?? 'cc-100'),
        effectiveCostCenterCode: String(overrides?.costCenterCode ?? 'CC-100'),
      },
    ],
    statusHistory: [
      {
        historyId: `${poId}-hist-1`,
        poId,
        status: 'APPROVED',
        changedBy: 'approver-e2e',
        changedByName: 'E2E Approver',
        changedAt: nowIso,
        notes: 'Approved via mock flow',
      },
      {
        historyId: `${poId}-hist-2`,
        poId,
        status: 'SENT',
        changedBy: 'procurement-e2e',
        changedByName: 'E2E Procurement',
        changedAt: nowIso,
        notes: 'Sent to vendor',
      },
    ],
  };
}

export async function installBusinessFlowMocks(page: Page): Promise<void> {
  if (process.env.E2E_REAL_API === '1') return;

  const nowIso = '2026-03-01T12:00:00.000Z';

  const buildings = [
    {
      buildingId: 'bldg-hq',
      buildingCode: 'HQ',
      name: 'HQ North Campus',
      addressLine1: '100 Innovation Way',
      addressLine2: null,
      city: 'Austin',
      stateProvince: 'TX',
      postalCode: '78701',
      country: 'USA',
      contactName: null,
      contactEmail: null,
      contactPhone: null,
      totalFloors: 4,
      isActive: true,
      createdAt: nowIso,
      updatedAt: nowIso,
    },
    {
      buildingId: 'bldg-dc',
      buildingCode: 'DC',
      name: 'Data Center East',
      addressLine1: '42 Circuit Ave',
      addressLine2: null,
      city: 'Dallas',
      stateProvince: 'TX',
      postalCode: '75001',
      country: 'USA',
      contactName: null,
      contactEmail: null,
      contactPhone: null,
      totalFloors: 2,
      isActive: true,
      createdAt: nowIso,
      updatedAt: nowIso,
    },
  ];

  const vendors = [
    {
      vendorId: 'vendor-100',
      vendorName: 'Acme Technology',
      vendorCode: 'ACME',
    },
  ];

  const costCenters = [
    {
      costCenterId: 'cc-100',
      code: 'CC-100',
      name: 'IT Operations',
      availableAmount: 100000,
    },
  ];

  const assetsByBuilding: Record<string, Array<Record<string, unknown>>> = {
    'bldg-hq': [
      {
        assetId: 'asset-hq-01',
        assetTag: 'AST-HQ-01',
        assetType: 'HARDWARE',
        displayName: 'HQ Router',
        status: 'DEPLOYED',
        createdAt: nowIso,
        updatedAt: nowIso,
      },
    ],
    'bldg-dc': [
      {
        assetId: 'asset-dc-01',
        assetTag: 'AST-DC-01',
        assetType: 'HARDWARE',
        displayName: 'Data Center UPS',
        status: 'DEPLOYED',
        createdAt: nowIso,
        updatedAt: nowIso,
      },
    ],
  };

  const purchaseOrders = new Map<string, Record<string, unknown>>();
  purchaseOrders.set(
    'po-seeded-001',
    makePurchaseOrderDetail(nowIso, {
      poId: 'po-seeded-001',
      poNumber: 'PO-2026-0100',
      lineQuantity: 1,
      unitPrice: 700,
      status: 'SENT',
    })
  );

  const workOrders: Array<Record<string, unknown>> = [];
  const transfers: Array<Record<string, unknown>> = [
    {
      transferId: 'TRF-1001',
      assetId: 'asset-hq-01',
      assetTag: 'AST-HQ-01',
      fromStockroomId: 'sr-main',
      fromStockroomName: 'Main Stockroom',
      toStockroomId: 'sr-dc',
      toStockroomName: 'Data Center Stockroom',
      status: 'pending',
      requestedBy: 'e2e-user',
      requestedAt: nowIso,
      notes: 'Move router to DC',
    },
  ];

  let requisition: RequisitionState | null = null;
  let requisitionLinks: Array<Record<string, unknown>> = [];
  const receivingById = new Map<string, ReceivingState>();

  await page.route('**/v1/**', async (route) => {
    const req = route.request();
    const method = req.method().toUpperCase();
    const url = new URL(req.url());
    const idx = url.pathname.indexOf('/v1/');
    const apiPath = idx >= 0 ? url.pathname.slice(idx + 3) : url.pathname;

    if (method === 'GET' && apiPath === '/admin/vendors') {
      return json(route, 200, paginated(vendors));
    }

    if (method === 'GET' && apiPath === '/admin/cost-centers') {
      return json(route, 200, paginated(costCenters));
    }

    if (method === 'GET' && apiPath === '/admin/buildings') {
      return json(route, 200, paginated(buildings));
    }

    if (method === 'GET' && apiPath === '/assets') {
      const buildingId = url.searchParams.get('buildingId') ?? '';
      const items = assetsByBuilding[buildingId] ?? [];
      return json(route, 200, paginated(items));
    }

    if (method === 'GET' && apiPath === '/procurement/requisitions') {
      const items = requisition ? [requisition] : [];
      return json(route, 200, paginated(items));
    }

    if (method === 'POST' && apiPath === '/procurement/requisitions') {
      const body = postBody(route);
      const linesInput = Array.isArray(body['lines']) ? (body['lines'] as Record<string, unknown>[]) : [];

      const lines: RequisitionLineState[] = linesInput.map((line, index) => {
        const quantity = Number(line['quantity'] ?? 0);
        const unitPrice = Number(line['unitPrice'] ?? 0);
        const vendorId = String(line['vendorId'] ?? '');
        const vendorName = vendors.find((v) => v.vendorId === vendorId)?.vendorName;
        const lineCostCenterId = String(line['costCenterId'] ?? body['costCenterId'] ?? '');
        const lineCostCenterCode = costCenters.find((cc) => cc.costCenterId === lineCostCenterId)?.code;

        return {
          reqLineId: `req-line-${index + 1}`,
          requisitionId: 'req-1001',
          lineNumber: index + 1,
          status: 'DRAFT',
          productType: String(line['productType'] ?? 'OTHER') as RequisitionLineState['productType'],
          productDescription: String(line['productDescription'] ?? ''),
          quantity,
          unitPrice,
          lineTotal: quantity * unitPrice,
          currency: String(line['currency'] ?? body['currency'] ?? 'USD'),
          vendorId: vendorId || undefined,
          vendorName: vendorName || undefined,
          costCenterId: lineCostCenterId || undefined,
          costCenterCode: lineCostCenterCode || undefined,
          sourceType: 'MANUAL',
          sourceSnapshot: {},
          notes: String(line['notes'] ?? '') || undefined,
          createdAt: nowIso,
          updatedAt: nowIso,
        };
      });

      requisition = {
        requisitionId: 'req-1001',
        requisitionNumber: 'REQ-2026-0001',
        status: 'DRAFT',
        requestedDate: nowIso,
        needByDate: String(body['needByDate'] ?? '') || undefined,
        legalEntity: String(body['legalEntity'] ?? '') || undefined,
        currency: String(body['currency'] ?? 'USD'),
        costCenterId: String(body['costCenterId'] ?? '') || undefined,
        shipToBuildingId: String(body['shipToBuildingId'] ?? '') || undefined,
        shipToAddress: String(body['shipToAddress'] ?? '') || undefined,
        notes: String(body['notes'] ?? '') || undefined,
        createdAt: nowIso,
        updatedAt: nowIso,
        lines,
      };

      return json(route, 201, requisition);
    }

    if (method === 'GET' && /^\/procurement\/requisitions\/[^/]+$/.test(apiPath)) {
      if (!requisition) {
        return json(route, 404, { error: { code: 'NOT_FOUND', message: 'Requisition not found' } });
      }
      return json(route, 200, requisition);
    }

    if (method === 'GET' && /^\/procurement\/requisitions\/[^/]+\/links$/.test(apiPath)) {
      return json(route, 200, { items: requisitionLinks });
    }

    if (method === 'POST' && /^\/procurement\/requisitions\/[^/]+\/submit$/.test(apiPath)) {
      if (!requisition) {
        return json(route, 404, { error: { code: 'NOT_FOUND', message: 'Requisition not found' } });
      }

      requisition = {
        ...requisition,
        status: 'APPROVED',
        updatedAt: nowIso,
        lines: requisition.lines.map((line) => ({
          ...line,
          status: 'APPROVED',
          updatedAt: nowIso,
        })),
      };
      return json(route, 200, requisition);
    }

    if (method === 'POST' && /^\/procurement\/requisitions\/[^/]+\/convert$/.test(apiPath)) {
      if (!requisition) {
        return json(route, 404, { error: { code: 'NOT_FOUND', message: 'Requisition not found' } });
      }

      const convertedPoId = 'po-converted-001';
      if (!purchaseOrders.has(convertedPoId)) {
        purchaseOrders.set(
          convertedPoId,
          makePurchaseOrderDetail(nowIso, {
            poId: convertedPoId,
            poNumber: 'PO-2026-0001',
            status: 'SENT',
            lineQuantity: requisition.lines[0]?.quantity ?? 1,
            unitPrice: requisition.lines[0]?.unitPrice ?? 0,
            vendorId: requisition.lines[0]?.vendorId ?? 'vendor-100',
            vendorName: requisition.lines[0]?.vendorName ?? 'Acme Technology',
            costCenterId: requisition.lines[0]?.costCenterId ?? requisition.costCenterId ?? 'cc-100',
            costCenterCode: requisition.lines[0]?.costCenterCode ?? 'CC-100',
          })
        );
      }

      requisition = {
        ...requisition,
        status: 'CONVERTED',
        updatedAt: nowIso,
        lines: requisition.lines.map((line, index) => ({
          ...line,
          status: 'CONVERTED',
          convertedPoId,
          convertedPoLineId: `po-line-${index + 1}`,
          updatedAt: nowIso,
        })),
      };

      requisitionLinks = requisition.lines.map((line, index) => ({
        requisitionPoLinkId: `req-link-${index + 1}`,
        requisitionId: requisition!.requisitionId,
        reqLineId: line.reqLineId,
        poId: convertedPoId,
        poLineId: `po-line-${index + 1}`,
        vendorId: line.vendorId ?? 'vendor-100',
        linkedAt: nowIso,
      }));

      return json(route, 200, {
        requisition,
        purchaseOrders: [purchaseOrders.get(convertedPoId)],
        links: requisitionLinks,
      });
    }

    if (method === 'GET' && /^\/procurement\/purchase-orders\/[^/]+\/close-guard$/.test(apiPath)) {
      return json(route, 200, {
        canClose: false,
        reasons: ['At least one receiving line remains pending.'],
      });
    }

    if (method === 'GET' && /^\/procurement\/purchase-orders\/[^/]+$/.test(apiPath)) {
      const poId = apiPath.split('/').pop() ?? '';
      const po = purchaseOrders.get(poId);
      if (!po) {
        return json(route, 404, { error: { code: 'NOT_FOUND', message: 'Purchase order not found' } });
      }
      return json(route, 200, po);
    }

    if (method === 'POST' && apiPath === '/lifecycle/receiving/from-po') {
      const body = postBody(route);
      const poId = String(body['poId'] ?? '');
      const po = purchaseOrders.get(poId);
      if (!po) {
        return json(route, 404, { error: { code: 'NOT_FOUND', message: 'Purchase order not found' } });
      }

      const existing = receivingById.get(`recv-${poId}`);
      if (existing) {
        return json(route, 200, existing);
      }

      const poLines = Array.isArray(po['lines']) ? (po['lines'] as Record<string, unknown>[]) : [];
      const lines = poLines.map((line, index) => {
        const expectedQuantity = Number(line['quantity'] ?? 0);
        const receivedQuantity = Number(line['quantityReceived'] ?? 0);
        return {
          receivingLineId: `recv-line-${index + 1}`,
          receivingId: `recv-${poId}`,
          lineNumber: index + 1,
          poLineId: String(line['lineId'] ?? ''),
          productDescription: String(line['productDescription'] ?? ''),
          productType: String(line['productType'] ?? 'OTHER'),
          expectedQuantity,
          receivedQuantity,
          pendingQuantity: Math.max(0, expectedQuantity - receivedQuantity),
          inspectionRequired: false,
          notes: '',
        };
      });

      const receivingState: ReceivingState = {
        receivingRecord: {
          receivingId: `recv-${poId}`,
          poId,
          poNumber: String(po['poNumber'] ?? ''),
          vendorName: String(po['vendorName'] ?? ''),
          status: 'IN_PROGRESS',
          stockroomId: 'sr-main',
          stockroomName: 'Main Stockroom',
          createdAt: nowIso,
          updatedAt: nowIso,
        },
        lines,
      };

      receivingById.set(`recv-${poId}`, receivingState);
      return json(route, 201, receivingState);
    }

    if (method === 'GET' && /^\/lifecycle\/receiving\/[^/]+$/.test(apiPath)) {
      const receivingId = apiPath.split('/').pop() ?? '';
      const receivingState = receivingById.get(receivingId);
      if (!receivingState) {
        return json(route, 404, { error: { code: 'NOT_FOUND', message: 'Receiving record not found' } });
      }
      return json(route, 200, receivingState);
    }

    if (method === 'POST' && /^\/lifecycle\/receiving\/[^/]+\/scan$/.test(apiPath)) {
      const parts = apiPath.split('/');
      const receivingId = parts[parts.length - 2] ?? '';
      const receivingState = receivingById.get(receivingId);
      if (!receivingState) {
        return json(route, 404, { error: { code: 'NOT_FOUND', message: 'Receiving record not found' } });
      }

      const body = postBody(route);
      const receivingLineId = String(body['receivingLineId'] ?? '');
      const serialNumber = String(body['serialNumber'] ?? '');

      const line = receivingState.lines.find((entry) => String(entry['receivingLineId']) === receivingLineId);
      if (!line) {
        return json(route, 400, { error: { code: 'LINE_NOT_FOUND', message: 'Receiving line not found' } });
      }

      const expectedQuantity = Number(line['expectedQuantity'] ?? 0);
      const nextReceived = Math.min(expectedQuantity, Number(line['receivedQuantity'] ?? 0) + 1);
      line.receivedQuantity = nextReceived;
      line.pendingQuantity = Math.max(0, expectedQuantity - nextReceived);

      receivingState.receivingRecord = {
        ...receivingState.receivingRecord,
        status: 'IN_PROGRESS',
        updatedAt: nowIso,
      };

      return json(route, 200, {
        asset: {
          assetId: `asset-scan-${nextReceived}`,
          assetTag: `NEW-${nextReceived}`,
          serialNumber,
          condition: 'NEW',
          receivingLineId,
          receivingId,
          createdAt: nowIso,
        },
        receivingLine: line,
        receivingRecord: receivingState.receivingRecord,
        isLineComplete: Number(line.pendingQuantity) === 0,
        isReceivingComplete: receivingState.lines.every((entry) => Number(entry['pendingQuantity'] ?? 0) === 0),
      });
    }

    if (method === 'POST' && /^\/lifecycle\/receiving\/[^/]+\/complete$/.test(apiPath)) {
      const parts = apiPath.split('/');
      const receivingId = parts[parts.length - 2] ?? '';
      const receivingState = receivingById.get(receivingId);
      if (!receivingState) {
        return json(route, 404, { error: { code: 'NOT_FOUND', message: 'Receiving record not found' } });
      }

      receivingState.receivingRecord = {
        ...receivingState.receivingRecord,
        status: 'COMPLETED',
        receivedAt: nowIso,
        updatedAt: nowIso,
      };
      return json(route, 200, receivingState);
    }

    if (method === 'POST' && /^\/lifecycle\/receiving\/[^/]+\/cancel$/.test(apiPath)) {
      const parts = apiPath.split('/');
      const receivingId = parts[parts.length - 2] ?? '';
      const receivingState = receivingById.get(receivingId);
      if (!receivingState) {
        return json(route, 404, { error: { code: 'NOT_FOUND', message: 'Receiving record not found' } });
      }

      receivingState.receivingRecord = {
        ...receivingState.receivingRecord,
        status: 'CANCELLED',
        updatedAt: nowIso,
      };
      return json(route, 200, receivingState);
    }

    if (method === 'POST' && apiPath === '/lifecycle/inspection') {
      const body = postBody(route);
      return json(route, 200, {
        inspectionRecord: {
          inspectionId: 'insp-1001',
          receivingLineId: String(body['receivingLineId'] ?? ''),
          status: 'PENDING',
          createdAt: nowIso,
          updatedAt: nowIso,
        },
        receivingLine: {
          receivingLineId: String(body['receivingLineId'] ?? ''),
          receivingId: '',
          lineNumber: 1,
          productDescription: 'Inspection item',
          expectedQuantity: 1,
          receivedQuantity: 0,
          pendingQuantity: 1,
          inspectionRequired: true,
        },
      });
    }

    if (method === 'GET' && apiPath === '/ham/transfers') {
      const status = url.searchParams.get('status');
      const items =
        status && status.trim().length > 0
          ? transfers.filter((transfer) => String(transfer['status']) === status)
          : transfers;
      return json(route, 200, items);
    }

    if (method === 'POST' && /^\/ham\/transfers\/[^/]+\/approve$/.test(apiPath)) {
      const transferId = apiPath.split('/')[3] ?? '';
      const transfer = transfers.find((entry) => String(entry['transferId']) === transferId);
      if (!transfer) {
        return json(route, 404, { error: { code: 'NOT_FOUND', message: 'Transfer not found' } });
      }
      transfer.status = 'approved';
      transfer.approvedAt = nowIso;
      transfer.approvedBy = 'e2e-approver';
      return json(route, 200, transfer);
    }

    if (method === 'POST' && /^\/ham\/transfers\/[^/]+\/complete$/.test(apiPath)) {
      const transferId = apiPath.split('/')[3] ?? '';
      const transfer = transfers.find((entry) => String(entry['transferId']) === transferId);
      if (!transfer) {
        return json(route, 404, { error: { code: 'NOT_FOUND', message: 'Transfer not found' } });
      }
      transfer.status = 'completed';
      transfer.completedAt = nowIso;
      return json(route, 200, transfer);
    }

    if (method === 'GET' && apiPath === '/eam/work-orders') {
      const status = url.searchParams.get('status');
      const priority = url.searchParams.get('priority');
      const buildingId = url.searchParams.get('buildingId');

      let filtered = [...workOrders];
      if (status) {
        filtered = filtered.filter((entry) => String(entry['status']) === status);
      }
      if (priority) {
        filtered = filtered.filter((entry) => String(entry['priority']) === priority);
      }
      if (buildingId) {
        filtered = filtered.filter((entry) => String(entry['buildingId']) === buildingId);
      }
      return json(route, 200, filtered);
    }

    if (method === 'POST' && apiPath === '/eam/work-orders') {
      const body = postBody(route);
      const assetId = String(body['assetId'] ?? '');
      const buildingId = String(body['buildingId'] ?? '');
      const asset = (assetsByBuilding[buildingId] ?? []).find((entry) => String(entry['assetId']) === assetId);

      const created = {
        workOrderId: `wo-${String(workOrders.length + 1).padStart(4, '0')}`,
        assetId,
        assetTag: String(asset?.['assetTag'] ?? 'UNKNOWN'),
        title: String(body['title'] ?? ''),
        description: String(body['description'] ?? ''),
        priority: String(body['priority'] ?? 'MEDIUM'),
        status: 'OPEN',
        createdBy: 'e2e-user',
        createdAt: nowIso,
        buildingId,
      };

      workOrders.unshift(created);
      return json(route, 201, created);
    }

    return route.fallback();
  });
}

