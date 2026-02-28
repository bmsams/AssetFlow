# Conversion Task List (Detailed + Execution)

Date: 2026-02-21  
Source docs:
- `docs/plans/2026-02-21-conversion-plan.md`
- `docs/plans/2026-02-21-entity-flow-qa-analysis.md`

## 1) Goal

Execute conversion from mixed contracts to a single, enforceable schema/API/UI model with working master-data-first flows.

## 2) Task Backlog (Detailed)

### WS1 - Schema Contract Freeze

- [ ] Publish contract pack v1 from refreshed mappings (`mappings/db_schema.json`, `mappings/tables.json`, `mappings/flows.json`).
- [ ] Lock canonical PO line model to `purchase_order_lines`; document deprecated assumptions.
- [ ] Lock location model decision:
  - [ ] Option A: keep denormalized location strings.
  - [ ] Option B: migrate to FK-based location hierarchy (recommended).
- [ ] Add `schema-compatibility` checklist to CI for changed services.

Acceptance:
- Contract pack signed off.
- All service owners acknowledge deprecations and target model.

### WS2 - P0 Schema Drift Remediation

- [x] `admin-service` location SQL: remove/replace references to non-existent `room_id` / `rack_id` in `hardware_assets`.
- [x] `lifecycle-service` procurement/receiving SQL: align with current PO/PO-line schema.
- [x] Add startup/runtime guard checks for required columns per service.
- [x] Add schema smoke check script for CI (`backend/scripts/schema-smoke-check.js`).
- [x] Add integration smoke runner for: locations, PO create/list/detail, receiving (`backend/scripts/integration-smoke.ts`).
- [ ] Execute integration smoke runner in integration environment with DB credentials.
- [x] Add and execute Data API read smoke runner (`backend/scripts/integration-smoke-data-api.ts`) against `ams-dev` to validate location/procurement/work-order read paths without direct TCP DB access.
- [ ] Execute full write-path smoke (`backend/scripts/integration-smoke.ts` with optional write mode) from an in-VPC or network-authorized environment.
- [x] Add API write-smoke runner for auth + requisition/PO/receiving/work-order flows (`backend/scripts/api-write-smoke.ts`, `npm run smoke:api:write`).
- [x] Fix API write-smoke server errors observed in `ams-dev`:
  - [x] `POST /procurement/purchase-orders/{poId}/reject` -> `500`
  - [x] `POST /lifecycle/receiving/from-po` -> `500`
  - [x] `POST /eam/work-orders/{workOrderId}/complete` -> `500`

Acceptance:
- No runtime SQL column errors in integration smoke tests.
- API write-smoke completes without server `500` errors for requisition/PO/receiving/work-order lifecycle actions.

### WS3 - Procurement Governance Conversion

- [x] Persist line-level `costCenterId` in create/list/update PO line flow.
- [ ] Finalize line-level vendor strategy:
  - [ ] Apply `V025__po_line_vendor.sql` in target DBs.
  - [x] Enforce effective vendor resolution (line override -> header fallback).
- [x] Enforce approved vendor/model pricing server-side on PO line create/update for `HARDWARE_MODEL` lines.
- [ ] Add currency/country validation rules for vendor model pricing.
  - [x] Currency validation enforced against `vendor_model_prices.currency`.
  - [ ] Country validation blocked by schema gap (`vendor_model_prices` has no country/region key).
- [x] Return effective vendor and effective cost center in PO detail APIs.

Acceptance:
- Invalid vendor/model/price combinations rejected server-side.
- PO line references always resolve to canonical vendor/cost center.

### WS4 - Asset + Location Master Conversion

- [x] Extend asset create/update contract to persist subtype fields (model, department, cost center, location).
- [x] Add building/location-scoped asset filters.
- [x] Add building-scoped work-order listing path (asset/location join).
- [x] Add building-scoped asset selection in work-order creation flow.
- [ ] Backfill existing hardware location and ownership data.
  - [x] Backfill script implemented: `backend/scripts/backfill-hardware-location-ownership.ts`.
  - [x] NPM command added: `npm run db:backfill:hardware-location-ownership`.
  - [ ] Execute backfill in integration/prod DBs and attach before/after evidence.
  - [ ] Latest dry-run execution attempt reached Secrets Manager but failed DB connectivity with `Connection terminated due to connection timeout`; requires network path to RDS (VPN/bastion/allowed source SG).
  - [x] Data API connectivity to `ams-dev` verified on 2026-02-22 (read path available); backfill script still requires direct PostgreSQL connectivity or an in-VPC execution host.
  - [x] UI regression coverage added for building-scoped work-order create flow: `frontend/src/pages/eam/WorkOrdersPage.test.tsx`.
  - [x] API-level regression tests added for building-scoped work-order create/list filters: `backend/packages/services/eam-service/src/__tests__/work-order-building-scope-api.test.ts`.
  - [x] Backend create-work-order now enforces optional `buildingId` scope against asset location.

Acceptance:
- Building -> equipment -> work order flow works end-to-end from API/UI.

### WS5 - EAM Contract Alignment

- [x] Normalize work-order status/priority request-response values in frontend adapter (lowercase UI <-> uppercase API).
- [x] Add backend maintenance plan list support for `status=active|paused|all`.
- [x] Update maintenance plan page to use explicit status filters.
- [x] Add API contract tests for status filter behavior and enum normalization.

Acceptance:
- EAM filters return expected records for each status filter.

### WS6 - Frontend Population and Guardrails

- [ ] Remove remaining free-text master-data fields where IDs are required.
- [ ] Ensure all selector data is sourced from canonical tables/services.
- [ ] Add inline validation messaging for invalid combinations before submit.
- [ ] Add QA checklist for building/equipment/work-order and PO vendor/price flows.

Acceptance:
- UI cannot submit transactions that violate canonical entity references.

### WS7 - Requisition -> PO Orchestration

- [x] Create migration bundle for requisition entities:
  - [x] `requisition_headers`
  - [x] `requisition_lines`
  - [x] `requisition_distributions`
  - [x] `requisition_approvals`
  - [x] `requisition_line_sources`
  - [x] `requisition_po_links`
- [x] Implement requisition APIs in `procurement-service` (create, submit, approve, reject, list, detail).
- [x] Implement source resolution for requisition lines from approved vendor catalog/pricing.
- [x] Implement conversion job/endpoint:
  - [x] convert approved requisition lines only
  - [x] group lines into one PO per vendor + compatible header dimensions
  - [x] persist requisition-to-PO lineage
- [x] Add frontend requisition pages and conversion traceability view.

Acceptance:
- A single requisition can spawn multiple POs, each with one vendor header.
- Every generated PO line points to an originating requisition line.

### WS8 - Accounting and Budget Model

- [x] Create migration bundle for accounting entities:
  - [x] `po_distributions`
  - [x] `budget_encumbrances`
  - [x] `subledger_entries`
  - [x] `subledger_lines`
- [x] Add encumbrance posting hooks on requisition/PO approval.
- [ ] Add budget validation logic on requisition/PO approval.
- [ ] Add receipt/invoice accounting transitions (accrual + liability state changes).
- [ ] Add reconciliation jobs and dashboards:
  - [ ] source docs vs subledger totals
  - [ ] open encumbrance aging
  - [ ] orphan linkage checks
- [ ] Add close guards to prevent PO closure with unresolved accounting state.

Acceptance:
- Procurement transactions reconcile to subledger without unresolved variance.
- Audit trail exists from requisition/PO/receipt to accounting lines.

## 3) Implementation Completed in This Pass

1. `procurement-service` PO line `costCenterId` now persists and returns from repository queries.
2. `procurement-service` handlers now carry line `costCenterId` through validation/create/add/update flows.
3. EAM frontend API adapter now normalizes work-order status/priority between UI and backend enum casing.
4. EAM maintenance plan list now supports explicit `status=active|paused|all` through backend handler/service/repository and frontend usage.
5. Requisition workflow implemented in `procurement-service` with create/list/detail/submit/approve/reject/convert endpoints.
6. Requisition conversion now groups approved lines into one-vendor-per-PO outputs and persists requisition-to-PO lineage.
7. Accounting baseline schema added via `V027__procurement_accounting.sql` (`po_distributions`, `budget_encumbrances`, `subledger_entries`, `subledger_lines`).
8. Requisition frontend module implemented with list/create/detail pages and route/nav integration.
9. Accounting posting hooks implemented for pre-encumbrance, PO distribution propagation, PO encumbrance, and subledger entry creation.
10. WS2 drift remediation delivered for `admin-service` and `lifecycle-service` SQL contracts.
11. Backend schema smoke checker added and passing (`npm run schema:smoke`).
12. Runtime schema compatibility guards added in location/procurement/receiving repositories.
13. Integration smoke runner added (`npm run smoke:integration`) with optional write flow via `ALLOW_SMOKE_WRITE=true`.
14. WS3 governance guardrails added in `procurement-service`:
    - approved vendor enforcement (`is_active` + rating),
    - active cost-center enforcement,
    - `HARDWARE_MODEL` price/currency validation against `vendor_model_prices`,
    - re-validation on PO create/update, line add/update, and submit-for-approval.
15. Line-level vendor governance completed in PO APIs:
    - PO line contracts now include `vendorId` and effective vendor/cost-center fields,
    - repository resolves effective vendor and cost center in line query responses,
    - line vendor override writes are guarded when `V025` columns are unavailable,
    - requisition-to-PO mapping now carries line `vendorId` into generated PO lines.
16. Contract artifacts and schema smoke updated for `V025` (`purchase_order_lines.vendor_id` / `vendor_name`).
17. WS4 deterministic flow started with building scope filters:
    - `asset-service` list/search now supports `buildingId` and `building` filters (via `hardware_assets` location).
    - `eam-service` work order list now supports `buildingId` and `building` filters.
    - `WorkOrdersPage` now binds a building selector from admin master data and sends `buildingId` in list calls.
18. WS4 subtype persistence pass implemented:
    - `asset-service` create/update contracts now accept `attributes`.
    - create/update persistence now writes subtype rows for `hardware_assets`, `software_assets`, and `enterprise_assets` in the same transaction as base `assets`.
    - frontend asset create/edit payload mapping now sends normalized subtype/master-data fields (`departmentId`, `costCenterId`, hardware location fields, and enterprise location/criticality fields).
    - asset form now captures hardware and enterprise location fields (building/stockroom/floor/room/rack/zone) using admin master-data selectors where available.
19. WS4 work-order creation flow now enforces building-scoped asset selection:
    - `WorkOrdersPage` create form requires building selection,
    - asset picker is loaded from `assetApi.list` with `buildingId`,
    - new work orders are created only from that filtered asset set.
20. WS4 location/ownership backfill automation implemented:
    - backend script added at `backend/scripts/backfill-hardware-location-ownership.ts`,
    - script defaults to dry-run and uses `--apply` to commit,
    - script outputs before/after null-ownership/location metrics plus touched asset samples.
21. WS4 UI regression coverage added for deterministic create flow:
    - `frontend/src/pages/eam/WorkOrdersPage.test.tsx` validates:
      - building selection triggers scoped asset lookup,
      - create flow gating requires building/asset/title,
      - create request uses building-scoped asset and refreshes filtered list.
22. WS4 backend API contract hardening added:
    - create-work-order handler now accepts optional `buildingId` and rejects mismatched asset/building combinations.
    - regression tests added in `backend/packages/services/eam-service/src/__tests__/work-order-building-scope-api.test.ts` covering:
      - invalid `buildingId` query/body validation,
      - building-scope mismatch rejection on create,
      - valid list/create behavior with building filters.
23. WS2 API write-smoke failures remediated and validated in `ams-dev`:
    - PO reject path now returns success (compat fallback to `CANCELLED` where `REJECTED` is not in status enum),
    - receiving from PO now supplies required `receiving_number` and `stockroom_id`,
    - work-order complete resolves Cognito `sub` to internal `users.user_id`,
    - `npm run smoke:api:write` now passes end-to-end.
24. WS5 contract coverage added for status filters and enum normalization:
    - backend API handler tests added at `backend/packages/services/eam-service/src/__tests__/maintenance-plan-status-filter-api.test.ts`,
    - frontend adapter tests added at `frontend/src/services/eam-api.test.ts`,
    - validates `status=active|paused|all` behavior and lowercase UI <-> uppercase API enum mapping.

## 4) Next Execution Order

1. Execute integration smoke checks in integration env (set DB credentials, then run `npm run smoke:integration` and `ALLOW_SMOKE_WRITE=true npm run smoke:integration`).
2. Apply `V025__po_line_vendor.sql` in target DBs and rerun integration smoke on PO line create/update with line-level vendors.
3. Resolve pricing country-dimension schema gap for country-level validation.
4. Complete WS4 by running location/ownership backfill (`npm run db:backfill:hardware-location-ownership` then rerun with `-- --apply`) and attaching execution evidence.
5. Complete WS8 remaining accounting scope (budget validation, receipt/invoice postings, reconciliation jobs, close guards).

## 5) Phase Tracker

Execution phases are tracked in:
- `docs/plans/2026-02-21-complete-remediation-phases.md`
