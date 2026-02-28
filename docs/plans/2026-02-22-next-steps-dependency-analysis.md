# Next Steps Deep Dependency Analysis

Date: 2026-02-22  
Scope: Post-WS7 schema rollout and WS8 baseline (`V026`, `V027`).

## 1) Current State Summary

- Backend requisition workflow endpoints now exist in `procurement-service` (`/procurement/requisitions*`).
- Requisition DB schema is present (`requisition_headers`, `requisition_lines`, `requisition_distributions`, linkage tables).
- Accounting baseline tables exist in migration (`po_distributions`, `budget_encumbrances`, `subledger_entries`, `subledger_lines`) but posting logic is not yet wired.
- Frontend has PO/receiving pages but no requisition UI routes/pages.

## 2) Critical Dependency Graph

## A) Requisition UX Dependency Chain

1. API routes must be exposed in infra:
   - `stacks/api_lambda_stack.py` -> `requisition-handlers`.
2. Frontend service client must support requisition operations:
   - list/get/create/submit/approve/reject/convert/getLinks.
3. Routes/navigation must include requisitions:
   - `frontend/src/routes/routes.tsx`
   - `frontend/src/pages/procurement/index.ts`
4. Pages depend on canonical master data selectors:
   - vendors and cost centers from admin APIs.

## B) Accounting Posting Dependency Chain

1. Posting trigger points:
   - requisition approval -> pre-encumbrance.
   - PO approval -> encumbrance + subledger.
2. Distribution availability:
   - requisition distributions must flow to `po_distributions` during requisition->PO conversion.
3. Posting tables:
   - `budget_encumbrances` and `subledger_*` required before service calls.
4. Financial dimensions:
   - `cost_center_id` required on source lines/distributions.
   - `department_id`, `gl_account` optional fallbacks.

## 3) Cross-Service Dependencies

- `procurement-service` depends on:
  - `@ams/database` for transactional writes.
  - `@ams/events` for domain events.
  - `@ams/types` event-type restrictions (no requisition-specific event type yet).
- `lifecycle-service` receiving path depends on PO/line references and will be downstream consumer of encumbrance/accrual lifecycle later.
- `frontend` depends on `api-client` response envelope (`{ success, data, error }`) and route-level RBAC.

## 4) Main Risks

1. Posting logic may fail in environments without `V027` applied.
2. Duplicate posting risk without idempotency guard.
3. Requisition conversion can create PO lines without copied distributions unless conversion step includes propagation.
4. Frontend can expose actions that backend rejects due status/role mismatches if client-state assumptions diverge.

## 5) Dependency-Driven Next Step Sequence

1. Implement accounting service/repository with safe idempotent posting routines.
2. Wire posting calls into requisition approve and PO approve paths.
3. Propagate requisition distributions -> PO distributions during conversion.
4. Add frontend requisition API + routes + pages with status-driven actions.
5. Run targeted QA checks for:
   - requisition lifecycle transitions,
   - one-vendor-per-PO conversion,
   - accounting rows generated at approval milestones.
