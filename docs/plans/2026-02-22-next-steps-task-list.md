# Next Steps Task List (WS7 + WS8 Continuation)

Date: 2026-02-22  
References:
- `docs/plans/2026-02-22-next-steps-dependency-analysis.md`
- `docs/plans/2026-02-22-next-steps-design.md`
- `docs/plans/2026-02-22-next-steps-qa-analysis.md`
- `docs/plans/2026-02-22-complete-app-remediation-plan.md`

Note:
- This task list is closed for the WS7/WS8 continuation pass.
- Remaining full-program remediation work is tracked in:
  - `docs/plans/2026-02-21-conversion-task-list.md`
  - `docs/plans/2026-02-22-complete-app-remediation-plan.md`

## Workstream A: Requisition Frontend

- [x] Add requisition API client methods in frontend procurement service.
- [x] Add requisition pages:
  - [x] list page
  - [x] create page
  - [x] detail/action page
- [x] Add routes and navigation item for requisitions.
- [x] Add status-gated actions and error handling on detail page.

## Workstream B: Accounting Posting Hooks

- [x] Add procurement accounting module (`accounting-repository`, `accounting-service`, exports).
- [x] Requisition approval -> create pre-encumbrance postings.
- [x] Requisition conversion -> copy distributions into `po_distributions`.
- [x] PO approval -> create encumbrance postings and subledger entries/lines.
- [x] Add idempotency guards to avoid duplicate postings.

## Workstream C: QA and Verification

- [x] Backend procurement-service build check.
- [x] Frontend typecheck/build check.
- [x] Update QA analysis with implemented/pass status and residual risks.

## Workstream D: Common Model Alignment Fixes (2026-02-22)

Reference:
- `docs/plans/2026-02-22-common-model-workflow-research-and-implementation-plan.md`

- [x] Fix receiving PO line quantity column drift (`received_quantity`).
- [x] Fix work-order completion actor mapping (`cognito sub` -> `users.user_id`).
- [x] Add PO reject status compatibility for environments missing `REJECTED` in `valid_po_status`.
- [x] Add/extend regression tests for all three fixes.
- [x] Deploy updated lambdas to `ams-dev`.
- [x] Re-run `npm run smoke:api:write` against deployed services and capture green evidence.

## Workstream E: Country-Aware Vendor Pricing + Currency Flow Alignment (2026-02-22)

Reference:
- `docs/plans/2026-02-22-common-model-workflow-research-and-implementation-plan.md`

- [x] Add country dimension to approved vendor/model pricing schema (`vendor_model_prices.country_code`).
- [x] Keep backward compatibility for pre-migration environments with runtime column guards.
- [x] Extend admin vendor-model-price API/contracts to support `countryCode` list/upsert/deactivate behavior.
- [x] Update admin vendor pricing UI to capture/display country code.
- [x] Update procurement requisition source resolution to use ship-to building country with `GLOBAL` fallback.
- [x] Fix requisition->PO conversion currency propagation to use group currency instead of header default.
- [x] Validate build/typecheck across admin-service, procurement-service, and frontend.
