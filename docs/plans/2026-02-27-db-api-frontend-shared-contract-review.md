# DB -> API -> Frontend Shared Contract Review (Procurement)

Date: 2026-02-27
Scope: Procurement domain (Purchase Orders + Requisitions)

## 1) Model Inventory (DB-first)

### Purchase Order Header
Source: `migrations/V005__contract_financial_schema.sql`, `migrations/V028__align_purchase_order_status_constraint.sql`

Core entity: `purchase_orders`
- PK: `po_id`
- Key refs: `vendor_id -> vendors.vendor_id`, `cost_center_id -> cost_centers.cost_center_id`
- Workflow refs: `requested_by`, `approved_by`, `rejected_by` -> `users.user_id`
- Financial fields: `subtotal`, `tax_amount`, `shipping_amount`, `total_amount`, `currency`
- Lifecycle fields: `status`, `requested_date`, `approved_date`, `rejected_date`, `sent_date`, `expected_delivery_date`
- Effective status set in DB constraint: `DRAFT`, `PENDING_APPROVAL`, `APPROVED`, `REJECTED`, `SENT`, `ACKNOWLEDGED`, `PARTIALLY_RECEIVED`, `RECEIVED`, `CLOSED`, `INVOICED`, `PAID`, `CANCELLED`, `ON_HOLD`

### Purchase Order Lines
Source: `migrations/V005__contract_financial_schema.sql`, `migrations/V023__po_line_cost_center_stockroom_building.sql`, `migrations/V025__po_line_vendor.sql`

Core entity: `purchase_order_lines`
- PK: `line_id`
- Parent FK: `po_id -> purchase_orders.po_id` (ON DELETE CASCADE)
- Product fields: `product_type`, `product_id`, `product_description`, `product_sku`
- Quantity/price: `quantity`, `unit_price`, `total_price`, `received_quantity`
- Line overrides: `vendor_id`, `vendor_name`, `cost_center_id`
- Line status: `PENDING`, `PARTIALLY_RECEIVED`, `RECEIVED`, `CANCELLED`, `BACKORDERED`

### Requisition Model
Source: `migrations/V026__requisition_workflow.sql`

Entities:
- `requisition_headers` (header + status)
- `requisition_lines` (line item + source snapshot + converted PO references)
- `requisition_distributions` (line-level accounting allocation)
- `requisition_approvals` (approval trail)
- `requisition_line_sources` (candidate/selected vendor pricing)
- `requisition_po_links` (line-level lineage from requisition to PO)

## 2) Cross-Reference Map and Data Flow

### Cross-reference links
- `purchase_order_lines.po_id -> purchase_orders.po_id`
- `purchase_order_lines.vendor_id -> vendors.vendor_id` (optional line override)
- `purchase_order_lines.cost_center_id -> cost_centers.cost_center_id` (optional line override)
- `requisition_lines.converted_po_id -> purchase_orders.po_id`
- `requisition_lines.converted_po_line_id -> purchase_order_lines.line_id`
- `requisition_po_links` joins requisition header/line to PO header/line and vendor

### API-layer projection flow (PO lines)
Source: `backend/packages/services/procurement-service/src/purchase-order/po-repository.ts`

Flow:
1. DB row (`purchase_order_lines` + header joins)
2. Repository projection computes effective values:
   - `effectiveVendorId = COALESCE(pol.vendor_id, po.vendor_id)`
   - `effectiveVendorName = COALESCE(line_vendor.vendor_name, pol.vendor_name, header_vendor.vendor_name, '')`
   - `effectiveCostCenterId = COALESCE(pol.cost_center_id, po.cost_center_id)`
   - `effectiveCostCenterCode = COALESCE(line_cc.code, header_cc.code, '')`
3. Handler returns `createApiResponse(...)` payload to client
4. Frontend maps payload in `frontend/src/services/procurement-api.ts` (`mapPOLine`)

### Action map (service/handler)

PO endpoints in handler:
- GET list/get
- POST create
- POST submit/approve/reject/send/cancel
- POST receipt-accounting/invoice-accounting/close
- GET close-guard
- POST lines, PUT lines/{lineId}, DELETE lines/{lineId}

Requisition endpoints in handler:
- GET list/get
- POST create/submit/approve/reject/convert
- GET links

## 3) Gap Register

### G1 (Closed this pass): OpenAPI PO schema drift on line-level vendor/cost center fields
- Before: OpenAPI `POLine` omitted `vendorId/vendorName/effectiveVendor*/costCenter*/effectiveCostCenter*`
- Runtime: backend and frontend already produce/consume these fields
- Result: docs/codegen contract mismatch
- Status: Fixed in `backend/api/openapi.yaml`

### G2 (Closed this pass): OpenAPI request drift for PO line create/update
- Before: OpenAPI omitted `vendorId` and `costCenterId` on create/update line requests
- Runtime: handlers validate and accept both
- Status: Fixed in `backend/api/openapi.yaml`

### G3 (Closed this pass): OpenAPI PO line endpoint response shape drift
- Before: `/purchase-orders/{poId}/lines` POST/PUT documented as `POLineResponse`; DELETE as 204
- Runtime: handlers return full PO payload (200) for add/update/remove
- Status: Fixed in `backend/api/openapi.yaml`

### G4 (Closed this pass): PO status enum drift between DB and type contracts
- Before: API/frontend/backend-types omitted `ACKNOWLEDGED`, `INVOICED`, `PAID`, `ON_HOLD`
- Risk: unknown statuses collapse to frontend default branch
- Status: Fixed in:
  - `backend/packages/types/src/purchase-order.ts`
  - `frontend/src/types/procurement.ts`
  - `frontend/src/services/procurement-api.ts`
  - `backend/api/openapi.yaml`

### G5 (Closed this pass): Frontend line payload included `vendorName` although backend contract is `vendorId`
- Before: frontend sent optional `vendorName` in create/update line payload types
- Runtime: backend derives `vendor_name` from `vendor_id`; client-provided `vendorName` is non-contract noise
- Status: Fixed in:
  - `frontend/src/services/procurement-api.ts`
  - `frontend/src/pages/procurement/PurchaseOrderForm.tsx`
  - `frontend/src/pages/procurement/POLineEditor.tsx`

### G6 (Closed this pass): Unsupported `DELETE /procurement/purchase-orders/{poId}` path removed
- Runtime router does not handle DELETE by `poId` (only DELETE line item)
- Status: OpenAPI no longer documents the unsupported method

### G7 (Closed this pass): OpenAPI coverage added for implemented procurement endpoints
- Added PO endpoints:
  - `/receipt-accounting`, `/invoice-accounting`, `/close-guard`, `/close`
- Added requisition endpoint family:
  - `/procurement/requisitions*`
- Added schema coverage for requisition entities and conversion/link payloads

## 4) Phased Remediation Plan with Checks

### Phase 1: Contract Stabilization (Completed)
Deliverables:
- PO status enums aligned (DB/API/frontend/backend-types)
- PO line schema/request/response alignment in OpenAPI
- Frontend payload trimmed to contract fields

Checks:
- `cd frontend && npm run typecheck`
- `cd frontend && npm run build`
- OpenAPI YAML parse check

### Phase 2: OpenAPI Coverage Completion (Completed)
Deliverables:
- Add requisition schemas + paths to OpenAPI
- Add missing PO accounting/close endpoints to OpenAPI
- Remove deprecated unsupported `DELETE /purchase-orders/{poId}` path
- Add handler-to-spec parity check script

Checks:
- OpenAPI linter/validator in CI
- Handler-to-spec path parity script (all handler routes must exist in OpenAPI)

### Phase 3: Shared Contract Enforcement (In Progress)
Deliverables:
- Canonical field matrix for procurement entities (DB column -> API field -> frontend field)
- Contract tests:
  - API response keys include required computed/effective fields
  - OpenAPI request/response examples validated against runtime fixtures

Checks:
- CI contract tests for `PurchaseOrder`, `POLine`, `Requisition`, `RequisitionLine`
- Fail build on drift

### Phase 4: Relational Integrity and Migration Guards (Pending)
Deliverables:
- Migration guard checks for required columns/indexes (`vendor_id`, `cost_center_id`, constraint status set)
- FK/index audit gate for hot query paths (`purchase_order_lines.po_id`, line overrides)

Checks:
- Pre-deploy schema verification script
- Post-deploy smoke: create requisition -> convert -> create PO -> receive -> accounting transitions

## 5) Model Rationale (Why This Relational Shape Makes Sense)

### 5.1 Header/Line Override Pattern
- `purchase_orders` carries default procurement context (`vendor_id`, `cost_center_id`) for governance and approval routing.
- `purchase_order_lines` allows controlled per-line overrides (`vendor_id`, `cost_center_id`) for real-world multi-vendor and mixed-allocation orders.
- Effective resolution is deterministic (`line -> header fallback`), preserving compatibility and minimizing null-handling complexity.

### 5.2 Requisition Normalization and Traceability
- Requisition header/line split isolates workflow state from item detail.
- `requisition_line_sources` stores sourcing provenance separately from selected line state.
- `requisition_po_links` provides explicit many-to-many lineage from requisition lines to generated PO lines, which is critical for audit and financial reconciliation.

### 5.3 Financial and Operational Separation
- Accounting distribution details are normalized in `requisition_distributions` instead of denormalizing allocation fields on line tables.
- Conversion keeps requisition lifecycle immutable enough for audit while allowing downstream PO execution state to evolve independently.
- This keeps reporting, controls, and remediation queries simpler in enterprise operations.

## 6) Current Validation Results (this pass)

- Frontend typecheck: Passed
- OpenAPI YAML parse: Passed
- Procurement OpenAPI parity check: Passed (`backend/scripts/procurement-openapi-parity-check.js`)
- Procurement model contract sanity check: Passed (`backend/scripts/procurement-model-contract-check.js`)
- Backend typecheck: Failed due pre-existing unrelated repository errors (outside procurement contract edits)

## 7) Canonical DB -> API -> Frontend Field Matrix

### Purchase Order Header

| DB source | API field | Frontend field | Notes |
| --- | --- | --- | --- |
| `purchase_orders.po_id` | `poId` | `PurchaseOrder.poId` / `PurchaseOrderDetail.poId` | Stable UUID identity |
| `purchase_orders.po_number` | `poNumber` | `poNumber` | Human-readable key |
| `purchase_orders.vendor_id` + `vendors.vendor_name` | `vendorId`, `vendorName` | `vendorId`, `vendorName` | Header default vendor |
| `purchase_orders.cost_center_id` + `cost_centers.code` | `costCenterId`, `costCenterCode` | `costCenterId`, `costCenterCode` | Header default cost allocation |
| `purchase_orders.status` | `status` | `status` | Enum aligned across DB/types/OpenAPI/frontend |
| `purchase_orders.requested_by` + `users` lookup | `requestedBy`, `requestedByName` | `requestedById`, `requesterName` | frontend mapper supports alias fallback |
| `purchase_orders.approved_by`, `approved_date` | `approvedBy`, `approvedDate`, `approvedByName` | `approvedById`, `approvedDate`, `approverName` | Nullable until approved |
| `purchase_orders.rejected_by`, `rejected_date`, `rejection_reason` | `rejectedBy`, `rejectedDate`, `rejectionReason` | detail view fields | Populated only on reject |
| `subtotal`, `tax_amount`, `shipping_amount`, `total_amount` | `subtotal`, `taxAmount`, `shippingAmount`, `totalAmount` | same names in detail | totals recomputed from lines in repository |

### Purchase Order Line

| DB source | API field | Frontend field | Notes |
| --- | --- | --- | --- |
| `purchase_order_lines.line_id` | `lineId` | `lineId` | Line identity |
| `purchase_order_lines.po_id` | `poId` | `poId` | Parent linkage |
| `line_number`, `product_type`, `product_id`, `product_description`, `product_sku` | `lineNumber`, `productType`, `productId`, `productDescription`, `sku` | same | Core line payload |
| `quantity`, `unit_price`, `total_price`, `received_quantity` | `quantity`, `unitPrice`, `lineTotal`, `quantityReceived` | same | Quantities/pricing |
| `purchase_order_lines.vendor_id` + `vendor_name` | `vendorId`, `vendorName` | `vendorId`, `vendorName` | Optional line override |
| `COALESCE(pol.vendor_id, po.vendor_id)` | `effectiveVendorId` | `effectiveVendorId` | Deterministic fallback |
| `COALESCE(line_vendor/pol.vendor_name/header_vendor)` | `effectiveVendorName` | `effectiveVendorName` | Deterministic fallback |
| `purchase_order_lines.cost_center_id` + `cost_centers.code` | `costCenterId`, `costCenterCode` | same | Optional line override |
| `COALESCE(pol.cost_center_id, po.cost_center_id)` | `effectiveCostCenterId` | `effectiveCostCenterId` | Deterministic fallback |
| `COALESCE(line_cc.code, header_cc.code)` | `effectiveCostCenterCode` | `effectiveCostCenterCode` | Deterministic fallback |

### Requisition Header and Lineage

| DB source | API field | Frontend field | Notes |
| --- | --- | --- | --- |
| `requisition_headers.requisition_id` | `requisitionId` | `RequisitionSummary.requisitionId` | Primary ID |
| `requisition_headers.requisition_number` | `requisitionNumber` | `requisitionNumber` | Human-readable key |
| `requisition_headers.status` | `status` | `status` | Enum aligned across DB/OpenAPI/frontend |
| `requested_by`, `requested_date`, `need_by_date` | `requestedBy`, `requestedDate`, `needByDate` | same | Workflow timing |
| `cost_center_id`, `ship_to_building_id`, `ship_to_address` | `costCenterId`, `shipToBuildingId`, `shipToAddress` | same | Header defaults |
| `approved_*`, `rejected_*`, `converted_date` | `approvedBy`, `approvedDate`, `rejectedBy`, `rejectedDate`, `rejectionReason`, `convertedDate` | same | Lifecycle trail |
| `requisition_lines.*` | `lines[]` objects | `RequisitionLine` | Product, sourcing, and financial line details |
| `requisition_lines.converted_po_id`, `converted_po_line_id` | `convertedPoId`, `convertedPoLineId` | same | Direct pointer to generated PO line |
| `requisition_po_links` | `links[]` | `RequisitionPOLink[]` | Explicit many-to-many lineage table |

### Accounting Linkage Tables

| DB source | API field | Frontend field | Notes |
| --- | --- | --- | --- |
| `po_distributions` | accounting transition effects | `AccountingTransitionResult` | line-level accounting allocations |
| `budget_encumbrances` | accounting transition effects | `AccountingTransitionResult` | commitment/release lifecycle |
| `subledger_entries` + `subledger_lines` | accounting transition effects | `AccountingTransitionResult` | generated postings per business event |
| close guard computed from accounting tables | `canClose`, `reasons` | `POCloseGuardResult` | closure gate from financial readiness |

## 8) Research-Based Model Sense Check

The current procurement model is structurally sound for enterprise relational workloads because it uses:
- Header/line normalization (`purchase_orders` + `purchase_order_lines`, `requisition_headers` + `requisition_lines`)
- Explicit lineage (`requisition_po_links`, plus converted IDs on lines)
- Separate financial subdomain tables (`requisition_distributions`, `po_distributions`, `budget_encumbrances`, `subledger_*`)
- FK-backed traceability to core reference data (`vendors`, `cost_centers`, `users`, `buildings`)

Remaining model-level risks to address:

### R1: Number generation race risk
- `generatePONumber()` and `generateRequisitionNumber()` are count-based and can collide under concurrency.
- Recommendation: move to sequence-backed numbering with deterministic prefix formatting.

### R2: Requisition approval status column is free-form text
- `requisition_approvals.status` uses `VARCHAR(30)` rather than enum/constraint.
- Recommendation: add a check constraint or enum (`PENDING`, `APPROVED`, `REJECTED`) to harden data quality.

### R3: PO creation and line insertion are not atomic at service boundary
- PO header insert and line inserts are not wrapped in one explicit transaction in `po-service`.
- Recommendation: wrap create header + all lines + totals recompute in a single transaction boundary.

## 9) Next Phase Checks

- Add CI gate: `cd backend && npm run contract:procurement:model`
- Add runtime contract test for PO line effective fallback fields (`effectiveVendor*`, `effectiveCostCenter*`)
- Add migration test proving status enum/constraint parity (`V028`, `V026`)

## 10) Implementation Update (Completed)

Implemented in this pass:
- Sequence-backed numbering:
  - Added migration `migrations/V030__procurement_number_sequences_and_approval_status_guard.sql`
  - Added/updated DB generators:
    - `generate_po_number()` using `purchase_order_number_seq`
    - `generate_requisition_number()` using `requisition_number_seq`
  - Repositories now call DB generators directly:
    - `po-repository.ts` -> `SELECT generate_po_number()`
    - `requisition-repository.ts` -> `SELECT generate_requisition_number()`
- Requisition approval status guard:
  - Added `valid_requisition_approval_status` constraint on `requisition_approvals.status`
  - Migration normalizes invalid/NULL legacy rows to `PENDING` before applying constraint
- Transactional PO creation:
  - Added `createPurchaseOrderWithLines(...)` in `po-repository.ts`
  - PO header insert + all line inserts + totals recalculation now execute in one DB transaction
  - `po-service.ts` create path now uses the transactional repository method

Validation:
- `npm run contract:procurement:model` (backend): Passed
- `npm run contract:procurement:openapi` (backend): Passed
- `jest` target: `po-repository.test.ts` Passed
- `jest` target: `po-service.test.ts` blocked by unrelated pre-existing cache typing errors outside procurement changes
