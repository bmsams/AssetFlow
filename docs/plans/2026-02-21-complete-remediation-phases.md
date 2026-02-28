# Complete Remediation Phases

Date: 2026-02-21  
Parent docs:
- `docs/plans/2026-02-21-conversion-plan.md`
- `docs/plans/2026-02-21-conversion-task-list.md`
- `docs/plans/2026-02-22-complete-app-remediation-plan.md`

Current status (as of 2026-02-22):
- Phase 0: in progress (contract artifacts exist; final sign-off still open).
- Phase 1: in progress (admin/lifecycle SQL drift fixes and runtime schema guards complete; integration smoke pending).
- Phase 2: in progress (cost center and requisition flow done; approved vendor/model pricing enforced for hardware-model PO lines; line-level vendor/effective resolution implemented; remaining gaps are `V025` rollout in target DBs and country pricing dimension).
- Phase 3: in progress (building-scoped filters, subtype persistence, building-scoped work-order create selection, and regression coverage are implemented; backfill automation is implemented via `backend/scripts/backfill-hardware-location-ownership.ts`; remaining work is DB backfill execution evidence).
- Phase 4: in progress (key EAM alignment done; full frontend hardening pending).
- Phase 5: in progress (requisition backend + frontend delivered).
- Phase 6: in progress (approval-time postings delivered; downstream accounting transitions pending).
- Phase 7: not started.

## Phase 0 - Contract Freeze (Week 1)

Scope:
- Confirm canonical schema/API contracts.
- Lock location model and PO line model.

Outputs:
- Contract pack v1.
- Deprecation register.

Exit gate:
- Architecture sign-off complete.

## Phase 1 - P0 Runtime Drift Fixes (Weeks 2-3)

Scope:
- `admin-service` location SQL mismatch fixes.
- `lifecycle-service` procurement/receiving SQL mismatch fixes.

Outputs:
- Zero missing-column runtime SQL failures in smoke tests.

Exit gate:
- Integration smoke pass for locations/PO/receiving.

## Phase 2 - Procurement Governance Hardening (Weeks 3-5)

Scope:
- Persist and enforce line-level procurement references.
- Vendor/source/price validation.

Outputs:
- Effective vendor/cost center logic fully enforced.

Exit gate:
- Invalid vendor/model/price permutations rejected server-side.

## Phase 3 - Asset/Location Deterministic Flow (Weeks 5-7)

Scope:
- Persist subtype/location data.
- Building-scoped asset/work-order flows.

Outputs:
- Building -> equipment -> work order API/UI path complete.

Exit gate:
- End-to-end workflow test pass.

## Phase 4 - EAM + Frontend Contract Cleanup (Weeks 7-8)

Scope:
- Enum casing/filter alignment.
- Frontend canonical selector population and guardrails.

Outputs:
- No silent filter mismatches or invalid submissions.

Exit gate:
- UI/API contract test snapshots pass.

## Phase 5 - Requisition to PO Orchestration (Weeks 8-10)

Scope:
- Build requisition entities and approval flow.
- Convert approved requisition lines into vendor-grouped PO drafts.

Grouping rule:
- One PO per vendor + compatible header keys (`legal_entity`, `currency`, `ship_to`, tax/terms).

Outputs:
- Requisition conversion engine and lineage (`requisition_po_links`).

Exit gate:
- Approved requisition with multi-vendor lines creates multiple single-vendor POs correctly.

## Phase 6 - Accounting and Budget Integrity (Weeks 10-11)

Scope:
- Add distributions, encumbrance, and subledger posting pipeline.
- Reconciliation and close controls.

Outputs:
- `po_distributions`, `budget_encumbrances`, `subledger_entries`, `subledger_lines`.

Exit gate:
- Reconciliation report shows zero unresolved material variance.

## Phase 7 - Cutover and Stabilization (Week 12)

Scope:
- UAT, migration dry-run, production cutover rehearsal.
- Post-cutover monitoring and reconciliation at +1h/+24h/+72h.

Outputs:
- Production runbook execution evidence and stabilization report.

Exit gate:
- No P0/P1 defects open; monitoring baseline stable.
