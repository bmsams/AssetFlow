# Entity Flow QA Analysis (Refreshed Schema)

Date: 2026-02-21  
Scope: Entity flow validation across DB schema, backend APIs, and frontend population points.

## 1) Snapshot Used

Schema was re-pulled from AWS and mappings regenerated:
- Tables: 94
- Columns: 1745
- Foreign keys: 224
- Views: 43
- Functions: 63

Primary artifacts:
- `mappings/db_schema.json`
- `mappings/db_reference_schema.json`
- `mappings/tables.json`
- `mappings/flows.json`
- `mappings/cdk_routes.json`

## 2) App Type (What This System Is)

This is an enterprise Asset Management platform combining:
- ITAM/HAM (hardware inventory, stockrooms, loaners, transfers)
- EAM (work orders, maintenance plans, linear assets, parts)
- SAM (software/licensing/reconciliation)
- Procurement + receiving + approvals
- Admin master data (locations, vendors, manufacturers, models, cost centers, departments, users)

## 3) Target Reference Flow (Master Data First)

Expected sequencing:
1. Location master: buildings, floors, rooms, racks, stockrooms, bins.
2. Org/financial master: departments, cost centers, users/roles.
3. Item/vendor master: manufacturers, models, vendors, vendor pricing contracts/rules.
4. Asset master: base assets + subtype entities + location assignment + relationships/BOM structure.
5. Transactions: PO -> receiving -> stock/deploy -> maintenance/work orders -> transfer/loaner -> retirement/disposal.

## 4) Entity to Frontend Population Map

| Domain | Source tables | API layer | Frontend pages |
|---|---|---|---|
| Location hierarchy | `buildings`, `floors`, `rooms`, `racks` | `admin-service` `/admin/*` | `frontend/src/pages/admin/LocationsPage.tsx` |
| Stock locations | `stockrooms`, `bin_locations`, `stockroom_inventory` | `admin-service`, `ham-service`, `lifecycle-service` | `frontend/src/pages/admin/StoragePage.tsx`, `frontend/src/pages/StockroomPage.tsx` |
| Org + financial | `departments`, `cost_centers`, `users`, `roles` | `admin-service`, `procurement-service` | `frontend/src/pages/admin/DepartmentsPage.tsx`, `frontend/src/pages/admin/CostCentersPage.tsx`, `frontend/src/pages/admin/UsersPage.tsx` |
| Vendor + catalog | `vendors`, `manufacturers`, `models`, `vendor_model_prices` | `admin-service` | `frontend/src/pages/admin/VendorsPage.tsx`, `frontend/src/pages/admin/VendorForm.tsx`, `frontend/src/pages/admin/ModelsPage.tsx`, `frontend/src/pages/admin/ManufacturersPage.tsx` |
| Assets (base) | `assets` | `asset-service` `/assets*` | `frontend/src/pages/AssetsPage.tsx`, `frontend/src/pages/HardwareAssetsPage.tsx`, `frontend/src/pages/SoftwareAssetsPage.tsx`, `frontend/src/pages/EnterpriseAssetsPage.tsx` |
| EAM execution | `work_orders`, `maintenance_plans`, `work_order_parts`, `spare_parts`, `linear_assets`, `linear_asset_segments` | `eam-service` `/eam/*` | `frontend/src/pages/eam/WorkOrdersPage.tsx`, `frontend/src/pages/eam/MaintenancePlansPage.tsx`, `frontend/src/pages/eam/LinearAssetsPage.tsx`, `frontend/src/pages/eam/PartsInventoryPage.tsx` |
| Procurement | `purchase_orders`, `purchase_order_lines`, approvals tables | `procurement-service` `/procurement/*` | `frontend/src/pages/procurement/PurchaseOrdersPage.tsx`, `frontend/src/pages/procurement/PurchaseOrderForm.tsx`, `frontend/src/pages/procurement/PurchaseOrderDetailPage.tsx` |
| Receiving / inspection | `receiving_records`, `receiving_lines`, `inspection_records` | `lifecycle-service` `/lifecycle/receiving*`, `/lifecycle/inspection*` | `frontend/src/pages/procurement/ReceivingForm.tsx`, `frontend/src/pages/procurement/InspectionForm.tsx` |
| HAM ops | `transfer_orders`, `transfer_order_lines`, `loaner_checkouts`, `audit_records`, `audit_scans` | `ham-service` `/ham/*` | `frontend/src/pages/ham/TransfersPage.tsx`, `frontend/src/pages/ham/LoanerManagementPage.tsx`, `frontend/src/pages/ham/AuditScanPage.tsx`, `frontend/src/pages/ham/DisposalPage.tsx` |

## 5) Requested Flow Checks (Pass/Fail)

### A) “Select building -> see equipment in that building -> place work order for equipment in that building”
Status: **FAIL**

Reasons:
- Asset search model has no building filter (`backend/packages/types/src/asset.ts:165`).
- Work order list filters include `assetId/status/priority/assignedTo/maintenancePlanId`, not building (`backend/packages/services/eam-service/src/handlers/list-work-orders.ts:125`).
- Hardware location is denormalized string fields (`building/floor/room/rack`) rather than location FK linkage (`mappings/tables.json:2211`).

### B) “Anywhere an asset is listed must be referenced from asset table”
Status: **PARTIAL / FAIL ON CREATE FLOW**

Reasons:
- Asset create handler only maps base fields (`assetType/displayName/description/status`) and drops subtype/location/vendor data (`backend/packages/services/asset-service/src/handlers/create-asset.ts:39`).
- UI collects hardware/ownership fields (`manufacturer`, `model`, `departmentId`, `costCenterId`) but create API path does not persist those fields (`frontend/src/components/asset-form/AssetForm.tsx:264`, `frontend/src/components/asset-form/AssetForm.tsx:591`).

### C) “PO line vendor must come from approved vendor list with correct country price/cost”
Status: **FAIL**

Reasons:
- Frontend captures line `vendorId` and `costCenterId` (`frontend/src/pages/procurement/PurchaseOrderForm.tsx:287`, `frontend/src/pages/procurement/PurchaseOrderForm.tsx:289`).
- Procurement create handler drops line-level vendor/cost center during validation mapping (`backend/packages/services/procurement-service/src/handlers/po-handlers.ts:106`).
- Procurement repository line insert does not persist line vendor/cost center fields (`backend/packages/services/procurement-service/src/purchase-order/po-repository.ts:564`).
- Pricing table has `currency` but no country-level pricing dimension (`mappings/tables.json:5633`).

## 6) Critical Findings (Severity Ordered)

## P0

1. Schema/API drift in location service SQL for asset-to-rack/room linkage.
- Evidence: queries reference `hardware_assets.room_id` and `hardware_assets.rack_id` (`backend/packages/services/admin-service/src/location/location-repository.ts:458`, `backend/packages/services/admin-service/src/location/location-repository.ts:1276`).
- Current schema has `room` and `rack` string columns, not `room_id/rack_id` (`mappings/tables.json:2213`, `mappings/tables.json:2214`).

2. Lifecycle procurement/receiving SQL expects columns not present in current schema.
- Evidence: inserts/selects use `purchase_orders.vendor_name`, `purchase_orders.requester_id`, `purchase_order_lines.vendor_id/vendor_name` (`backend/packages/services/lifecycle-service/src/procurement/procurement-repository.ts:703`, `backend/packages/services/lifecycle-service/src/procurement/procurement-repository.ts:749`, `backend/packages/services/lifecycle-service/src/receiving/receiving-repository.ts:530`).
- Current schema lacks those PO/PO-line columns (`mappings/tables.json:3228`, `mappings/tables.json:3302`).

## P1

3. EAM status enum mismatch between frontend and backend (lowercase vs uppercase).
- Frontend expects lowercase (`frontend/src/services/eam-api.ts:24`, `frontend/src/pages/eam/WorkOrdersPage.tsx:13`, `frontend/src/pages/eam/WorkOrdersPage.tsx:91`).
- Backend validates uppercase (`backend/packages/services/eam-service/src/handlers/list-work-orders.ts:20`).

4. Maintenance status filter mismatch.
- Frontend sends `?status=active|paused` (`frontend/src/services/eam-api.ts:241`, `frontend/src/pages/eam/MaintenancePlansPage.tsx:14`).
- Backend list path does not consume `status`; it returns active-only or asset-specific with `includeInactive` (`backend/packages/services/eam-service/src/handlers/maintenance-plan-handlers.ts:457`, `backend/packages/services/eam-service/src/handlers/maintenance-plan-handlers.ts:465`).

5. Procurement line-level vendor and price governance not enforced.
- UI loads vendor model prices (`frontend/src/pages/procurement/PurchaseOrderForm.tsx:177`) but backend create/update logic does not enforce approved vendor/model pricing.

6. Asset subtype persistence gap at creation.
- Base asset created, subtype/entity linkage not persisted in create flow (`backend/packages/services/asset-service/src/handlers/create-asset.ts:39`).

## P2

7. Location model is not normalized for equipment placement.
- Hardware uses free-text `building/floor/room/rack` (`mappings/tables.json:2211`) instead of FK path through location hierarchy tables.
- This blocks deterministic “building -> equipment -> work order” UX.

8. Country pricing requirement is not modeled.
- `vendor_model_prices` has `currency` but no country/region dimension (`mappings/tables.json:5633`).

## 7) Recommended Fix Sequence

1. Resolve schema drift first (P0): align SQL in `admin-service` and `lifecycle-service` with actual DB columns, or apply missing migrations to DB.
2. Pick one PO line model and enforce it everywhere (`purchase_order_lines` only), remove stale assumptions.
3. Add/restore line-level vendor columns if required by design; then enforce effective vendor resolution consistently.
4. Add approved vendor pricing validation server-side on PO line create/update (vendor+model+currency/country rules).
5. Normalize equipment location linkage (FKs to room/rack, or explicit location assignment table).
6. Add building/location filters in asset and work-order APIs for building-scoped EAM workflows.
7. Align EAM status enums and maintenance filter semantics between frontend and backend.
8. Extend asset create flow to persist subtype/ownership/location data, not only base `assets` row.

## 8) Conclusion

The platform design is correct for an integrated EAM/HAM/SAM + procurement app, but current implementation has high-impact schema/service drift and several API-contract mismatches that break critical workflow guarantees.  
Do not treat current frontend flow as authoritative until P0/P1 issues above are resolved.
