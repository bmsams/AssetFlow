# Next Steps QA Analysis

Date: 2026-02-22  
Scope: Planned implementation for requisition frontend and accounting posting hooks.

## 1) Pre-Implementation QA Findings

1. No requisition UI route exists, so WS7 is API-only and not operational for end users.
2. `V027` schema exists but no posting code creates rows in accounting tables.
3. Requisition conversion creates PO lines and linkage, but no explicit distribution copy into `po_distributions`.
4. PO approval publishes event but does not persist accounting artifacts.

## 2) QA Test Matrix for This Pass

1. Requisition list/create/detail client calls.
2. Requisition state transitions:
   - submit, approve, reject.
3. Requisition conversion:
   - creates PO(s), returns linkage.
4. Accounting posting:
   - requisition approval inserts pre-encumbrance rows.
   - PO approval inserts encumbrance + subledger rows.
5. Distribution propagation:
   - requisition distributions copied to `po_distributions`.

## 3) Validation Strategy

- Static verification: route wiring, export wiring, handler/service invocation paths.
- Build verification:
  - backend procurement-service bundle.
  - frontend typecheck/build.
- Runtime integration is deferred to environment with migrated DB (`V026`, `V027` applied).

## 4) Residual Risks After This Pass

1. No invoice/accrual postings yet (receipt/invoice lifecycle remains pending).
2. No reconciliation jobs/dashboards implemented yet.
3. Accounting fallbacks for missing tables are operationally safe but may mask migration drift if monitoring is absent.

## 5) Post-Implementation QA Status (This Pass)

Implemented:
- Requisition frontend routes/pages/API client:
  - list/create/detail + submit/approve/reject/convert actions
  - requisition->PO link display
- Backend accounting hooks:
  - requisition approval -> pre-encumbrance
  - requisition conversion -> `po_distributions` propagation
  - PO approval -> encumbrance + subledger entry/lines
  - idempotency guards and missing-schema graceful skip

Build/Type checks:
1. `backend`: `npm run build --workspace @ams/procurement-service` -> PASS
2. `frontend`: `npm run typecheck` -> PASS
3. `frontend`: `npm run build` -> PASS

Open items:
1. End-to-end runtime verification in migrated environment (`V026` + `V027`) still required.
2. Receipt/invoice accounting transitions and reconciliation jobs remain future tasks.

## 6) Post-Implementation QA Status (Country Pricing + Currency Alignment Pass)

Implemented:
- `vendor_model_prices` now supports country-scoped approved pricing (`country_code`) with `GLOBAL` fallback migration path.
- Admin vendor-model-price list/upsert/deactivate contracts now support `countryCode`.
- Runtime compatibility guards added where `country_code` is absent pre-migration.
- Requisition source resolution now selects vendor model price by ship-to building country (fallback `GLOBAL`).
- Requisition->PO conversion now uses grouped line currency (`group.currency`) for PO header currency.

Validation:
1. `backend`: `npm run build --workspace @ams/admin-service` -> PASS
2. `backend`: `npm run build --workspace @ams/procurement-service` -> PASS
3. `frontend`: `npm run typecheck` -> PASS
4. `frontend`: `npm run build` -> PASS

Residual risks:
1. Direct PO create path still defaults governance pricing lookups to `GLOBAL` country context when no ship-to country is provided.
2. Migration `V029` must be applied in target environments before country-specific prices are operationally enforceable end-to-end.
