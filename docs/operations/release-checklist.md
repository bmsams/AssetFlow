# Release Checklist (Transfer + Cross-Model Sync)

Date: 2026-03-02

## Pre-Release

- [ ] Migrations applied in target environment
- [ ] Seed dataset includes buildings, stockrooms, inventory, users/roles
- [ ] No unrelated/generated files staged for release commit
- [ ] OpenAPI/runtime contract review complete for touched endpoints

## Backend Verification

- [ ] `npm --prefix backend test` passes
- [ ] Transfer completion validation paths pass (duplicate/unknown/over-receipt/damaged checks)
- [ ] Inventory posting integrity checks pass (source decrement, destination good-quantity increment)

## Frontend Verification

- [ ] `npm --prefix frontend run test -- run` passes
- [ ] Transfers page supports line-level completion receipts
- [ ] Building switch + stockroom/item selection remains functional
- [ ] Validation errors are user-visible and actionable

## E2E Verification

- [ ] `npm run e2e` passes (mocked profile)
- [ ] `E2E_REAL_API=1 E2E_SEED_FROM_STOCKROOM_ID=<source-stockroom-uuid> E2E_SEED_TO_STOCKROOM_ID=<destination-stockroom-uuid> npm run e2e:real-api-smoke` passes
- [ ] Role-based access checks pass for allowed/forbidden routes

## Release Readiness

- [ ] Data-flow docs updated:
  - `docs/contracts/transfer-data-model.md`
  - `docs/contracts/transfer-api-contract.md`
  - `docs/contracts/transfer-data-flow.md`
- [ ] Runbook updated:
  - `docs/operations/transfer-seed-test-deploy-runbook.md`
- [ ] Rollback notes defined:
  - revert frontend
  - rollback backend deployment
  - run DB rollback/forward plan as applicable
