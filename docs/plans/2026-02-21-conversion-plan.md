# Conversion Plan (Schema + Flow Alignment)

Date: 2026-02-21  
Input baseline: `docs/plans/2026-02-21-entity-flow-qa-analysis.md`

Latest program tracker: `docs/plans/2026-02-22-complete-app-remediation-plan.md`

## 1) Objective

Convert the current platform from mixed/stale schema contracts to a single, enforced end-to-end model where:
- DB schema, backend SQL, API contracts, and frontend forms are consistent.
- Building -> equipment -> work order flow is deterministic.
- PO line vendor/cost center and approved pricing rules are enforced server-side.
- Requisition -> approval -> sourcing -> PO conversion follows one-vendor-per-PO grouping.
- Accounting entries are traceable from requisition/PO/receipt to budget and subledger lines.
- Asset create/update persists subtype and ownership/location attributes correctly.

## 2) Conversion Strategy

Use a staged conversion, not big-bang:
1. Stabilize production paths (remove runtime schema/API drift).
2. Normalize master-data references (location + item/vendor model).
3. Enforce transaction rules (PO line governance, receiving, inspection).
4. Align frontend contracts and rollout behind feature flags.

## 3) Scope

In scope:
- `admin-service`, `asset-service`, `eam-service`, `procurement-service`, `lifecycle-service`.
- Frontend pages in `/admin`, `/assets`, `/procurement`, `/eam`.
- DB objects: `hardware_assets`, `purchase_orders`, `purchase_order_lines`, `vendor_model_prices`, location hierarchy tables.
- New DB model areas for conversion: requisition headers/lines/distributions, requisition approvals, requisition-po linkage, budget encumbrance, procurement subledger.

Out of scope (separate follow-up):
- Full BOM redesign.
- New reporting models beyond contract alignment fixes.

## 4) Workstreams

### Domain Ownership (Flow Placement)

- `admin-service`: master data only (vendors, models, vendor pricing, cost centers, locations).
- `procurement-service`: requisitions, approvals, sourcing resolution, PO conversion/grouping, PO lifecycle.
- `lifecycle-service`: receiving/inspection execution against POs.
- `finance` module/service: budget checks, encumbrance, subledger postings, reconciliation.

## WS1: Schema Contract Freeze

Goal: establish canonical schema contract before more feature work.

Tasks:
1. Freeze contract artifact from refreshed schema (`mappings/db_schema.json`, `mappings/tables.json`).
2. Pick canonical PO line model (`purchase_order_lines` only).
3. Decide location model target:
   - Option A: keep string fields (`building/floor/room/rack`) and align code.
   - Option B (recommended): add FK columns (`building_id/floor_id/room_id/rack_id`) and migrate.
4. Publish contract v1 with explicit deprecation list.

Exit criteria:
- Contract doc approved.
- Deprecated columns/queries cataloged.

## WS2: P0 Drift Remediation

Goal: remove runtime breakpoints caused by schema-code mismatch.

Tasks:
1. Fix `admin-service` location repository SQL references to match live schema or newly added FK columns.
2. Fix `lifecycle-service` procurement/receiving SQL that references non-existent PO/PO-line columns.
3. Add migration patches only where business design requires missing columns (avoid speculative columns).
4. Add startup/schema guard checks to fail fast when expected columns are missing.

Exit criteria:
- All P0 queries compile and execute in integration env.
- No runtime SQL errors in smoke tests for locations, PO, receiving.

## WS3: Procurement Governance Conversion

Goal: enforce header+line vendor/cost-center and approved pricing.

Tasks:
1. Align backend DTOs/handlers/repositories to persist line-level `vendorId` and `costCenterId` (if in final schema).
2. Enforce effective vendor rule: line overrides header; header fallback only when line null.
3. Add server validation:
   - line vendor must be active/approved,
   - model must be in vendor approved list,
   - price/currency/country constraints must validate.
4. Extend pricing model for country/region if required (new key dimension + migration + seed rules).
5. Ensure receiving uses effective vendor from persisted source.

Exit criteria:
- Cannot create/update PO line with unapproved vendor/price.
- Receiving and downstream events return consistent effective vendor.

## WS4: Asset + Location Master Conversion

Goal: make asset placement and creation deterministic.

Tasks:
1. Extend asset create/update backend contract to persist subtype fields:
   - hardware model/manufacturer,
   - department/cost center,
   - location assignment.
2. If using normalized location target, migrate hardware location fields to FK references.
3. Add API filters for building/location scopes:
   - assets by building/room/rack,
   - work orders by building via asset/location join.
4. Backfill/migrate existing hardware location data.

Exit criteria:
- Asset created from UI appears with full subtype data in DB.
- Building -> equipment -> work order flow works through API/UI.

## WS5: EAM Contract Alignment

Goal: remove enum/filter mismatches between UI and backend.

Tasks:
1. Standardize status casing for work orders (choose uppercase or lowercase and enforce everywhere).
2. Align maintenance plan filtering contract:
   - either support `status=active|paused`,
   - or UI uses `includeInactive` plus derived status.
3. Update frontend service adapters + backend validators + tests.

Exit criteria:
- EAM pages filter correctly without silent mismatches.

## WS6: Frontend Population and UX Guardrails

Goal: ensure all UI selectors bind to canonical entities.

Tasks:
1. Replace any free-text fields that should be master-data IDs.
2. Ensure dropdown sources are canonical:
   - assets from `assets`,
   - vendors from approved vendor set,
   - prices from validated vendor-model-country context.
3. Add UI-level guard messaging for invalid combinations.

Exit criteria:
- No front-end path can submit a transaction violating canonical reference rules.

## WS7: Requisition-to-PO Orchestration

Goal: implement canonical source-to-procure flow with one vendor per PO.

Tasks:
1. Add requisition entities:
   - `requisition_headers`,
   - `requisition_lines`,
   - `requisition_distributions`,
   - `requisition_approvals`,
   - `requisition_line_sources`,
   - `requisition_po_links`.
2. Enforce source resolution at requisition line:
   - derive vendor + price from catalog/approved vendor-model pricing,
   - snapshot selected source on line.
3. Implement conversion engine in `procurement-service`:
   - convert approved requisition lines only,
   - group by vendor and header compatibility (`legal_entity`, `currency`, `ship_to`, tax/terms),
   - generate one PO per vendor-compatible group.
4. Copy requisition distributions to PO distributions and persist lineage.
5. Expose API to show requisition -> PO traceability on UI.

Exit criteria:
- Approved requisitions create one or multiple POs based on grouping rules.
- No PO is generated with mixed vendors on header.
- Every PO line is traceable back to requisition line/source snapshot.

## WS8: Accounting and Budget Integrity

Goal: make procurement posting deterministic and auditable.

Tasks:
1. Add accounting tables:
   - `po_distributions`,
   - `budget_encumbrances`,
   - `subledger_entries`,
   - `subledger_lines`.
2. Implement posting events:
   - requisition approval -> pre-encumbrance,
   - PO approval -> encumbrance,
   - receipt -> accrual,
   - invoice match -> liability.
3. Add reconciliation jobs:
   - source document totals vs subledger totals,
   - open encumbrance aging,
   - orphan distribution/link detection.
4. Add close controls:
   - prevent PO close when unmatched receiving/invoice states remain.

Exit criteria:
- Financial impact of procurement docs is represented in line-level distributions and subledger lines.
- Reconciliation reports run clean (zero unreconciled material variance).

## 5) Execution Phases and Timeline

Phase 0 (Week 1): WS1 contract freeze + WS2 design decisions  
Phase 1 (Weeks 2-3): WS2 P0 remediation + integration smoke  
Phase 2 (Weeks 3-5): WS3 procurement governance conversion  
Phase 3 (Weeks 5-7): WS4 asset/location conversion + data backfill  
Phase 4 (Weeks 7-8): WS5 EAM contract alignment + WS6 frontend finalization  
Phase 5 (Weeks 8-10): WS7 requisition-to-PO orchestration  
Phase 6 (Weeks 10-11): WS8 accounting and budget integrity  
Phase 7 (Week 12): UAT, cutover rehearsal, production rollout

Detailed phase tracker: `docs/plans/2026-02-21-complete-remediation-phases.md`

## 6) Testing and Quality Gates

Mandatory gates per phase:
1. Migration tests: forward + rollback on staging copy.
2. API contract tests: request/response snapshots for changed endpoints.
3. Integration tests:
   - building -> asset -> work order,
   - PO header/line vendor resolution,
   - requisition -> PO grouping by vendor,
   - receiving from PO with effective vendor.
4. Data reconciliation reports:
   - counts by status before/after,
   - null/missing FK audits,
   - pricing rule violation report (must be zero),
   - accounting/subledger tie-out report (must be zero unresolved).

Release gate:
- No P0/P1 defects open.
- Monitoring dashboards green for 24h in pre-prod.

## 7) Cutover Plan

Pre-cutover:
1. Freeze schema migrations except conversion set.
2. Run backfill dry-run and capture diffs.
3. Enable feature flags in dark mode.

Cutover window:
1. Apply migrations.
2. Run data backfill.
3. Deploy backend contract changes.
4. Deploy frontend toggles.
5. Execute smoke suite.

Post-cutover:
1. Monitor SQL error rate, 4xx/5xx by endpoint, and queue failures.
2. Run reconciliation jobs at +1h, +24h, +72h.

## 8) Rollback Plan

1. Keep reversible migration scripts for each phase.
2. Retain dual-read adapters during conversion phases where possible.
3. Roll back frontend flags first, then backend deploy, then DB migration rollback only if data integrity risk exists.
4. Preserve audit tables and conversion logs for replay.

## 9) Risks and Mitigations

Risk: unclear canonical schema for location fields.  
Mitigation: lock decision in WS1 before code changes.

Risk: data loss during PO line model consolidation.  
Mitigation: pre/post row-level checksums and staged migration with shadow tables.

Risk: hidden consumers of deprecated fields.  
Mitigation: query logs + static scan + temporary compatibility views.

Risk: cross-service contract drift reappears.  
Mitigation: CI contract checks against `mappings/db_schema.json` and endpoint tests.

## 10) Deliverables

1. Approved schema/API contract v1.
2. Migration bundle with rollback scripts.
3. Updated backend services and API docs.
4. Updated frontend modules with canonical population.
5. Requisition conversion engine with vendor grouping.
6. Accounting posting + reconciliation module artifacts.
7. Regression + integration test suites.
8. Cutover runbook and post-cutover validation report.
