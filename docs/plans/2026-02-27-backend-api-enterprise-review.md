# Backend + API Enterprise Review (Relational Models, Data Flow, Gap Plan)

Date: 2026-02-27
Scope: `backend/packages/services`, `stacks/api*.py`, `backend/api/openapi.yaml`, `migrations`, `mappings`

## Step 1 - Model Inventory (Entities + Actions)

### Core Platform
- Assets: `assets`, `asset_relationships`, subtype tables (`hardware_assets`, `software_assets`, `enterprise_assets`)
- Identity/RBAC data: `users`, `roles`, `permissions`, `user_roles`, `role_permissions`
- Change history: `audit_log` + trigger functions
- API actions: CRUD assets, state transition, relationship link/unlink, audit retrieval

### Admin / Reference Data
- Entities: `buildings`, `floors`, `rooms`, `racks`, `stockrooms`, `bin_locations`, `departments`, `cost_centers`, `vendors`, `manufacturers`, `models`, `vendor_model_prices`, user admin tables
- API actions: create/list/get/update/deactivate on most reference entities + role assignment APIs

### Procurement + Lifecycle
- Procurement entities: `purchase_orders`, `purchase_order_lines`, `approval_*`, `requisition_*`, `po_distributions`, `budget_encumbrances`, `subledger_*`
- Lifecycle entities: `requests`, `request_lines`, `receiving_records`, `receiving_lines`, `inspection_records`, `deployment_records`, `retirement_*`, `disposal_*`, `catalog_*`
- API actions: PO/requisition workflow, approval routing, receiving/inspection, deployment, retirement/disposal, inventory reservation/check

### HAM (Hardware Operations)
- Entities: `stockroom_inventory`, `transfer_orders`, `transfer_order_lines`, `loaner_checkouts`, `audit_records`, `audit_scans`, `destruction_certificates`
- API actions: transfer create/approve/complete, loaner checkout/return/overdue, audit scan/discrepancy, stockroom inventory updates

### EAM
- Entities: `maintenance_plans`, `work_orders`, `work_order_parts`, `spare_parts`, `linear_assets`, `linear_asset_segments`
- API actions: work order and maintenance plan operations, hierarchy link/unlink/propagate, linear asset + segments, parts reserve/consume

### SAM
- Entities: `software_products`, `entitlements`, `software_installations`, `reconciliation_results`, `reclamation_rules`, `reclamation_candidates`, `saas_subscriptions`, `saas_usage_records`, `shadow_it_*`, `publisher_*`
- API actions: reconciliation run/summary/compliance, reclamation candidates/initiation, shadow IT analysis, SaaS usage sync, workbench summary

### Integration
- Entities: `discovery_*`, `vendor_asns`, `vendor_asn_lines`, `vendor_asn_assets`, `vendor_catalog_items`, `erp_*`
- API actions: discovery ingestion, ASN processing, ERP sync, vendor catalog retrieval

### Notifications + Reports
- Notifications entities (intended): user preferences, notification history, delivery tracking/triggers
- Reports entities: operational/financial/asset aggregation over asset, procurement, maintenance, SAM tables
- API actions: dashboard + report endpoints, notification endpoints

## Step 2 - Cross-Reference Entity and Data Flow Map

### Canonical relational backbone
- `assets` is the central parent for hardware/software/enterprise models.
- `users` is the dominant FK target across domains (ownership, approvals, audit, assignment).
- Procurement spine:
  - `requisition_headers` -> `requisition_lines` -> `requisition_po_links` -> `purchase_orders` -> `purchase_order_lines` -> `receiving_records`/`receiving_lines`
- SAM spine:
  - `software_products` -> `entitlements` -> `software_installations` -> `reconciliation_results` -> `reclamation_candidates`
- HAM spine:
  - `stockrooms` -> `stockroom_inventory` + `transfer_orders`/`transfer_order_lines` + `loaner_checkouts` + `audit_records`
- EAM spine:
  - `assets` -> `maintenance_plans` -> `work_orders` -> `work_order_parts`/`spare_parts`
- Integration spine:
  - discovery inputs (`discovery_records`) correlate back to `assets`; ASN inputs (`vendor_asn_*`) feed asset receiving context.

### Cross-domain coupling highlights
- Procurement to financial controls is explicit through `po_distributions`, `budget_encumbrances`, and `subledger_*`.
- SAM and lifecycle intersect at `contracts`, `purchase_orders`, and user assignment context from hardware/asset ownership.
- Reporting service references nearly every operational domain table, making schema contract stability critical.

## Gap Report (Prioritized)

### Critical
1. API contract drift between deployed CDK routes and OpenAPI spec.
- Evidence:
  - CDK has routes not documented in OpenAPI (examples: close/close-guard, user role delete, vendor-catalog hyphen form).
  - OpenAPI has routes not deployed by CDK (examples: `/work-orders` family vs `/eam/work-orders`, `/integrations/vendor/catalog` vs `/integrations/vendor-catalog`).
- References:
  - `stacks/api_lambda_stack.py` lines 295, 332-333, 417-420, 476-477
  - `backend/api/openapi.yaml` lines 1871, 1949, 2014, 2050, 2092, 2615

2. Multiple backend services contain non-production placeholders instead of persistence/integration logic.
- Evidence:
  - Notification repository explicitly returns placeholders for create/query/update paths.
  - Report repositories are largely stubbed (`rows: []`, totals `0`, "In a real implementation" comments).
  - ERP connectors use simulated auth tokens and simulated responses.
- References:
  - `backend/packages/services/notification-service/src/notification/notification-repository.ts` lines 49, 67, 92, 103, 120, 157, 248, 312, 403
  - `backend/packages/services/report-service/src/report/report-repository.ts` lines 41, 104, 127, 152, 179, 193, 251, 301, 318
  - `backend/packages/services/integration-service/src/erp/connectors/sap-connector.ts` lines 67, 76, 130, 136
  - `backend/packages/services/integration-service/src/erp/connectors/workday-connector.ts` lines 70, 76, 113, 119

3. Authorization model is authentication-heavy but lacks centralized RBAC enforcement in service handlers.
- Evidence:
  - Service source has no imports/usage of `@ams/auth` middleware (`withAuth`, permission guards, operation guards).
  - Handlers mostly derive `sub` and map to `user_id`, but do not enforce role/permission checks.
  - Report handler falls back to `system` when claims are missing.
- References:
  - `backend/packages/services/procurement-service/src/handlers/po-handlers.ts` lines 56-58, 205, 687, 757, 885, 958, 1066, 1221, 1308
  - `backend/packages/services/report-service/src/handlers/report-handlers.ts` lines 45-46
  - `stacks/api_lambda_stack.py` line 230 (Cognito auth type applied at API method level only)

### High
4. Procurement workflow lacks atomic transaction boundaries across multi-step writes/events.
- Evidence:
  - PO create writes header then loops line inserts without transaction guard.
  - Approval updates PO then posts accounting in separate call sequence.
- References:
  - `backend/packages/services/procurement-service/src/purchase-order/po-service.ts` lines 115, 133, 138, 525, 549-550

5. SQL correctness/injection risk from direct SQL interpolation.
- Evidence:
  - Interpolated `LIMIT ${limit}` in SAM repositories.
  - Dynamic SQL assembly from user-defined field names/table names/sort clauses in custom report repo.
- References:
  - `backend/packages/services/sam-service/src/saas-license/saas-license-repository.ts` lines 345, 383
  - `backend/packages/services/sam-service/src/reclamation/reclamation-repository.ts` line 527
  - `backend/packages/services/sam-service/src/shadow-it/shadow-it-repository.ts` lines 503, 643
  - `backend/packages/services/report-service/src/custom/custom-report-repository.ts` lines 65, 70, 90-91, 97, 100, 131, 137-197

6. Invalid PostgreSQL patterns (`RETURNING COUNT(*)`) likely to fail at runtime.
- References:
  - `backend/packages/services/sam-service/src/saas-license/saas-license-repository.ts` lines 469, 479, 625

7. Accounting protections can silently downgrade to permissive behavior when schema objects are missing.
- Evidence:
  - Budget validation may return valid=true on missing schema.
  - PO close guard may default to canClose=true on missing schema.
- References:
  - `backend/packages/services/procurement-service/src/accounting/accounting-service.ts` lines 165, 191, 279, 284

### Medium
8. PO number generation is count-based (`COUNT(*)`) and prone to race collisions under concurrency.
- References:
  - `backend/packages/services/procurement-service/src/purchase-order/po-repository.ts` lines 66, 68, 72

9. Data model performance hardening gap: numerous foreign keys without supporting indexes.
- Evidence file lists many missing FK indexes.
- References:
  - `mappings/gaps.json` line 35 (`missing_fk_indexes`)

10. Ownership/documentation ambiguity: many tables are unowned or cross-owned by many services.
- Evidence:
  - 49 tables are currently unowned in generated ownership map.
- References:
  - `mappings/gaps.json` line 509 (`tables_without_service`)

## Comprehensive Remediation Plan (Phased + Checks)

### Phase 0 - Baseline Governance (1 week)
- Deliverables:
  - Define API spec source-of-truth (`OpenAPI-first` or `CDK-first`).
  - Define table ownership registry (single owner + consumers per table).
  - Define authorization policy matrix (operation -> required role/permission).
- Checks:
  - Architecture decision records approved.
  - CI check fails if ownership metadata missing for any table.

### Phase 1 - Contract and Security Alignment (2 weeks)
- Deliverables:
  - Reconcile OpenAPI vs CDK route map (eliminate all path/method drift).
  - Introduce shared auth wrapper using `@ams/auth` and enforce per-operation permissions on all handlers.
  - Remove `system` fallback for authenticated business endpoints.
- Checks:
  - Automated route diff must be zero.
  - Permission contract tests for each handler group (happy + forbidden cases).
  - No endpoint returns success without authenticated principal except explicit public health.

### Phase 2 - Persistence Hardening (2-3 weeks)
- Deliverables:
  - Replace placeholder repositories/connectors with production implementations or explicitly disable routes not ready.
  - Parameterize all dynamic SQL (`LIMIT/OFFSET/order/filter`) through allowlisted builders.
  - Fix invalid SQL patterns (`RETURNING COUNT(*)`) and add SQL unit tests.
- Checks:
  - Static query lint passes (no raw interpolated SQL from user-controlled fields).
  - Integration tests validate non-empty persistence behavior for notification/report/integration endpoints.

### Phase 3 - Transactional Integrity and Accounting Controls (2 weeks)
- Deliverables:
  - Wrap multi-step procurement workflows in DB transactions (PO create+lines, approve+encumbrance, close+posting).
  - Replace count-based PO numbering with sequence-backed/UUID-backed deterministic scheme.
  - Convert permissive "missing accounting schema" fallbacks into explicit feature flags with hard-fail in production.
- Checks:
  - Concurrency tests (parallel PO create/approve) pass without duplicates or partial states.
  - Compensating rollback tests for failed accounting postings.

### Phase 4 - Relational Performance and Observability (1-2 weeks)
- Deliverables:
  - Add missing FK indexes from `mappings/gaps.json`.
  - Add query latency SLO dashboards and slow-query alerts by service/table.
  - Validate migration idempotency and rollback plans.
- Checks:
  - EXPLAIN plans for top N queries meet threshold.
  - p95/p99 query latency target met in load test.

### Phase 5 - Data Flow Documentation and Operational Readiness (ongoing)
- Deliverables:
  - Publish canonical ERD and service-to-table interaction map.
  - Publish "critical business flows" runbooks (procure-to-receive, reclaim license, transfer stock, close PO).
  - Add release checklist gating on schema+API+permission diff checks.
- Checks:
  - Quarterly architecture drift report generated automatically.
  - No release without green schema/API/security guardrails.

## Existing Strengths Worth Preserving
- Strong TypeScript strictness configuration.
- Infrastructure-level security baseline: Cognito authorizer wiring, WAF managed rule sets + rate limiting.
- Mature relational footprint already in place (104 tables, 63 DB functions).
- Some repositories already use explicit transactions correctly (asset repository).

## Notes
- This review was static analysis of source + mapping artifacts; no live runtime validation was executed in this pass.
