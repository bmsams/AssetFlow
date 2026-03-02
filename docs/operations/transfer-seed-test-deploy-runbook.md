# Transfer Seed/Test/Deploy Runbook

Date: 2026-03-02

## 1) Purpose

Operational runbook for validating transfer + receiving workflows across DB, API, and frontend.

## 2) Environment Prerequisites

- Node/npm installed
- AWS credentials configured (`default` profile or exported env vars)
- Backend and frontend dependencies installed
- Database migrated to latest schema

## 3) Seed Checklist

Minimum dataset:
- 2 active buildings
- 2 active stockrooms mapped to those buildings
- Inventory in source stockroom (`quantityOnHand > 0`)
- At least one transferable asset and one transferable stock item
- Users with roles:
  - `inventory_manager`
  - `procurement_manager`
  - `viewer`

## 4) Validation Commands

Backend transfer integrity:
```bash
npm --prefix backend run test -- transfer
```

Frontend transfer/stockroom API contracts:
```bash
npm --prefix frontend run test -- run ham-api stockroom-api
```

PO/receiving sync contracts:
```bash
npm --prefix backend run test -- procurement-service receiving-service receiving-handlers contract-handlers
npm --prefix frontend run test -- run receiving-api ReceivingForm
```

Mocked E2E:
```bash
npm run e2e
```

Real API E2E smoke:
```bash
E2E_REAL_API=1 E2E_SEED_FROM_STOCKROOM_ID=<source-stockroom-uuid> E2E_SEED_TO_STOCKROOM_ID=<destination-stockroom-uuid> npm run e2e:real-api-smoke
```

## 5) Real-API Smoke Gates

A run is considered passing when all are true:
- Seeded source and destination stockrooms are selectable on Transfers page
- Transfer item selector loads at least one transferable option for the seeded source stockroom
- No 5xx HAM API responses occur during page load + selector interactions

## 6) Deploy Order

1. Deploy backend handlers/services.
2. Run migrations.
3. Seed/refresh test data.
4. Deploy frontend.
5. Run mocked E2E.
6. Run real-API smoke E2E.

## 7) Troubleshooting Matrix

- `UNKNOWN_RECEIPT_LINE` on complete:
  - Cause: frontend submitted stale/missing line IDs
  - Fix: refresh transfers and retry completion with current lines

- `Insufficient inventory in source stockroom`:
  - Cause: source quantity below required issue quantity
  - Fix: replenish source inventory or reduce transfer quantity

- Transfers page shows no stockrooms for selected building:
  - Cause: incomplete building linkage in source data
  - Fix: verify stockroom/building association in admin data

- Real API e2e unstable:
  - Cause: non-deterministic seed data or stale environment
  - Fix: reseed environment, export `E2E_SEED_FROM_STOCKROOM_ID` and `E2E_SEED_TO_STOCKROOM_ID`, rerun smoke profile
