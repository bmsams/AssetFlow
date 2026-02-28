# Complete App Remediation Program Plan

Date: 2026-02-22  
Program scope: End-to-end schema, service, API, frontend, and accounting flow remediation.

References:
- `docs/plans/2026-02-21-conversion-plan.md`
- `docs/plans/2026-02-21-conversion-task-list.md`
- `docs/plans/2026-02-21-complete-remediation-phases.md`
- `docs/plans/2026-02-21-entity-flow-qa-analysis.md`
- `docs/plans/2026-02-22-next-steps-dependency-analysis.md`
- `docs/plans/2026-02-22-next-steps-design.md`
- `docs/plans/2026-02-22-next-steps-qa-analysis.md`
- `docs/plans/2026-02-22-next-steps-task-list.md`

## 1) Program Objective

Deliver one canonical operating model where:
- master data is authoritative and referenced consistently,
- procurement/EAM workflows are deterministic,
- requisition to PO conversion is governed and traceable,
- accounting postings reconcile to source transactions,
- frontend only submits valid, canonical references.

## 2) Current Status Snapshot

Completed in current baseline:
- Requisition entities and backend workflow (create/submit/approve/reject/convert).
- Requisition frontend pages and navigation (`/procurement/requisitions`).
- Accounting posting hooks for:
  - requisition approval -> pre-encumbrance,
  - requisition conversion -> PO distribution copy,
  - PO approval -> encumbrance + subledger entries.
- EAM status normalization and maintenance status filter alignment.
- WS2 API write-flow stabilization in `ams-dev` (reject, receiving-from-PO, and work-order-complete now green in write smoke).
- WS5 API contract tests for maintenance status filter behavior and enum normalization.

Still open at program level:
- WS2 completion item: execute full integration smoke (`npm run smoke:integration`) from a network path that can reach private RDS.
- Procurement vendor governance completion:
  - rollout `V025` to target DBs (service logic and effective vendor fields are implemented),
  - country-level pricing dimension (schema gap in `vendor_model_prices`).
- Building-scoped asset and work-order deterministic flow completion (filters, subtype persistence, and building-scoped asset selection for work-order create are implemented; backfill still pending).
- Full accounting lifecycle after PO approval (receipt accrual + invoice liability + close controls).
- Full regression and reconciliation gate coverage in CI/UAT.

Progress update (this pass):
- Admin-service and lifecycle-service WS2 SQL drift fixes are implemented and building clean.
- Backend schema smoke check added: `backend/scripts/schema-smoke-check.js` (`npm run schema:smoke`).
- Runtime schema guards added in location/procurement/receiving repositories.
- Integration smoke runner added: `backend/scripts/integration-smoke.ts` (`npm run smoke:integration`).
- Data API smoke runner added: `backend/scripts/integration-smoke-data-api.ts` (`npm run smoke:integration:dataapi`).
- Data API smoke executed successfully against `ams-dev` on 2026-02-22:
  - building read path returned `ed8d020d-dca9-41e9-afe4-5a14429a6238` (`BRIAN M SAMS`),
  - procurement read path returned latest PO `PO-202602-0051` with 1 line,
  - work-order read path returned latest work order `85f4d940-7f5d-47a9-a877-6494f33a582d` with `assetTag`.
- Direct TCP smoke (`npm run smoke:integration`) remains blocked from local workstation by private RDS network path (`Connection terminated due to connection timeout`).
- EAM work-order list/detail projection now includes `assetTag`; deployed and validated in live UI/API (`/eam/work-orders`).
- API write smoke runner added: `backend/scripts/api-write-smoke.ts` (`npm run smoke:api:write`).
- API write smoke rerun executed on 2026-02-22 after remediation/deploy:
  - requisition create/submit/approve/convert path passed,
  - PO create/update/submit/reject path passed,
  - receiving from PO create/cancel path passed,
  - work-order create/assign/complete path passed,
  - detailed evidence is tracked in `docs/plans/2026-02-22-api-write-smoke-results.md`.
- WS3 governance guardrails added in procurement PO flows:
  - approved vendor enforcement (`is_active` + rating),
  - active cost center enforcement,
  - `HARDWARE_MODEL` approved price + currency validation against `vendor_model_prices`.
- WS3 line-level vendor strategy implemented in PO APIs:
  - line-level `vendorId` accepted on create/update and carried through requisition conversion,
  - PO detail lines now return `vendorId`, `vendorName`, `effectiveVendorId`, `effectiveVendorName`,
  - PO detail lines now return `effectiveCostCenterId` and `effectiveCostCenterCode`,
  - write-path guard returns validation error when `V025` columns are unavailable.
- WS4 building-scope filters implemented:
  - asset list/search handlers now support `buildingId` and `building`,
  - work order list handlers now support `buildingId` and `building`,
  - `frontend/src/pages/eam/WorkOrdersPage.tsx` now includes building selector (admin master-data sourced) and filters list calls by building.
- WS4 subtype persistence implemented:
  - `asset-service` create/update contracts accept `attributes`,
  - create/update write paths persist subtype/location fields into `hardware_assets`, `software_assets`, and `enterprise_assets`,
  - asset create/edit frontend payload mapping now sends normalized subtype/master-data fields,
  - asset form now includes hardware/enterprise location capture fields.
- WS4 work-order create flow aligned to location master data:
  - `frontend/src/pages/eam/WorkOrdersPage.tsx` now creates work orders via building-scoped asset picker,
  - the create flow requires a selected building and then loads only assets for that building.
- WS4 backfill automation added:
  - `backend/scripts/backfill-hardware-location-ownership.ts` created to normalize hardware location/ownership fields,
  - script is dry-run by default and supports `--apply` commit mode,
  - this closes implementation work for backfill mechanics; DB execution evidence is still pending in integration/prod environments.
- WS4 frontend regression tests added:
  - `frontend/src/pages/eam/WorkOrdersPage.test.tsx` now covers building-scoped asset loading and create-form gating.
- WS4 backend enforcement and API regression tests added:
  - `backend/packages/services/eam-service/src/handlers/create-work-order.ts` now enforces optional `buildingId` scope on create,
  - `backend/packages/services/eam-service/src/__tests__/work-order-building-scope-api.test.ts` covers list/create building-scope contract behavior.
- WS5 contract tests added:
  - `backend/packages/services/eam-service/src/__tests__/maintenance-plan-status-filter-api.test.ts` validates maintenance plan `status=active|paused|all` routing and asset-scope filtering,
  - `frontend/src/services/eam-api.test.ts` validates UI/API enum normalization for work-order status and priority.
- WS3 pricing-dimension alignment implemented (current pass):
  - migration added for country-scoped vendor model pricing (`migrations/V029__vendor_model_prices_country_dimension.sql`),
  - admin-service vendor model price list/upsert/deactivate now supports `countryCode`,
  - requisition source resolution now uses ship-to building country with `GLOBAL` fallback.
- Requisition conversion currency drift fix implemented:
  - requisition->PO conversion now applies grouped line currency (`group.currency`) to generated PO header currency.

## 3) Critical Dependency Chain

1. Canonical schema contract freeze (WS1)  
2. Runtime schema drift fixes (WS2)  
3. Master data governance enforcement (WS3 + WS4)  
4. Frontend canonical population hardening (WS6)  
5. Workflow/accounting completion (WS7 + WS8 extension)  
6. Cutover rehearsal and production stabilization

Dependency rule:
- No cutover without WS2 complete and WS8 reconciliation gates passing.

## 4) Remediation Waves

## Wave A: Contract and Runtime Stabilization

Workstreams:
- WS1 Schema contract freeze.
- WS2 P0 schema drift remediation.

Exit gate:
- No missing-column runtime SQL errors in integration smoke.

## Wave B: Master Data and Flow Determinism

Workstreams:
- WS3 Procurement governance completion.
- WS4 Asset/location deterministic flow.
- WS6 Frontend canonical selector and guardrail hardening.

Exit gate:
- Building -> equipment -> work order path is deterministic.
- PO line vendor/cost center/pricing constraints enforced server-side and reflected in UI.

## Wave C: Accounting Completion and Operational Readiness

Workstreams:
- WS8 accounting completion beyond approval hooks.
- Regression, reconciliation, and close controls.
- Cutover and stabilization execution.

Exit gate:
- Requisition/PO/receipt/invoice states reconcile with subledger and encumbrance reports.
- No open P0/P1 defects at release go/no-go.

## 5) Design Authority and Ownership

- Master data authority: `admin-service`.
- Procurement transaction authority: `procurement-service`.
- Receiving and inspection execution: `lifecycle-service`.
- Work-order and maintenance execution: `eam-service`.
- Accounting event and reconciliation ownership: finance/accounting module in procurement domain.

Service contract rule:
- Every transactional table must reference canonical master data IDs, not free-text substitutes.

## 6) QA Strategy and Gates

Per-wave mandatory gates:
- Migration forward/rollback test on staging clone.
- API contract tests for changed endpoints.
- Integration flow tests:
  - building -> asset -> work order,
  - PO create/update with approved vendor/model/price constraints,
  - requisition conversion to one-vendor-per-PO groups,
  - receiving and accounting transitions.
- Data reconciliation jobs:
  - source totals vs subledger totals,
  - open encumbrance aging,
  - orphan lineage/distribution checks.

## 7) Implementation Backlog (Program Remaining)

Priority 1 (must complete before broad feature expansion):
1. WS2 SQL drift remediation in `admin-service` and `lifecycle-service`.
2. WS3 vendor governance completion:
   - enforce approved vendor list,
   - enforce pricing country/currency dimensions,
   - enforce effective vendor rules in create/update/receiving paths.
3. WS4 building-scoped asset/work-order API filters and UI bindings.

Priority 2:
1. WS6 frontend hardening for all master-data selectors and pre-submit validation.
2. WS8 receipt/invoice postings, close guards, reconciliation automation.

Priority 3:
1. UAT scripts, cutover rehearsal artifacts, and post-cutover runbook evidence.

## 8) Next 2 Execution Blocks

Block 1 (immediate):
- Execute integration smoke runner to exercise locations, PO create/list/detail, and receiving.
- Validate no runtime SQL breakpoints on locations, PO, receiving in integration environment.

Block 2 (after Block 1):
- Complete WS3 vendor/country pricing governance.
- Complete WS4 building/equipment/work-order deterministic filters.
- Add integration tests covering those two end-to-end flows.

## 9) Definition of Program Complete

Program is complete only when all are true:
1. Runtime drift issues are closed with regression tests.
2. Master data references are canonical end-to-end.
3. Requisition/PO/receiving/invoice/accounting flow reconciles with no material variance.
4. Frontend cannot submit invalid master-data combinations.
5. Cutover rehearsal succeeds and stabilization metrics meet thresholds.
