# API Write Smoke Results

Date: 2026-02-22  
Environment: `ams-dev`  
API: `https://ujhfnp9m2f.execute-api.us-east-1.amazonaws.com/v1`

## Runner

- Script: `backend/scripts/api-write-smoke.ts`
- Command: `npm run smoke:api:write`
- Auth user: `testuser@example.com`

## Fixture Resolution

- Vendor: `Cisco Systems` (`ad387c70-056f-42c4-bb85-fd7095219799`)
- Cost center: `cc-001` (`38f3a187-f643-403c-80cc-1c44ad69992e`)
- Building: `BRIAN M SAMS` (`ed8d020d-dca9-41e9-afe4-5a14429a6238`)
- Asset: `AMS-HW-20260215-4091D1` (`48864fea-5ecc-4b3a-97d4-7cf664f14d5e`)
- Receivable PO fixture: `PO-202602-0041` (`8f360b2d-57ad-4860-8b53-fb6f6ffecfdf`)

## Flow Results

- Requisition flow: `PASS`
  - create -> submit -> approve -> convert
  - converted PO cleanup cancel succeeded
- PO lifecycle flow: `PARTIAL`
  - create -> update line -> submit -> cancel passed
  - reject endpoint failed with `500`
- Receiving flow: `FAIL`
  - create-from-po endpoint failed with `500`
- EAM work order flow: `PARTIAL`
  - create -> assign passed
  - complete endpoint failed with `500`

## Defects Observed

1. `POST /procurement/purchase-orders/{poId}/reject` returns `500` (`Failed to reject purchase order`).
2. `POST /lifecycle/receiving/from-po` returns `500` (`Failed to record receiving`).
3. `POST /eam/work-orders/{workOrderId}/complete` returns `500` (`Failed to complete work order`).

## Notes

- Runner is intentionally best-effort on cleanup for converted requisition POs.
- Runner exits non-zero when one or more module flows fail, so CI/runtime can gate on unresolved defects.
- Post-code-fix rerun executed on 2026-02-22 before lambda deployment still showed the same three `500` responses, which is expected until updated service packages are deployed.

## Latest Rerun (After Deployment)

Date: 2026-02-22  
Environment: `ams-dev`  
Command: `npm run smoke:api:write`

Result: `PASS`

- Requisition flow: `PASS`
- PO lifecycle flow: `PASS`
  - reject now succeeds
  - cancel-after-reject is skipped when status is already `CANCELLED`
- Receiving flow: `PASS`
- EAM work order flow: `PASS`

Defects resolved in live environment:
1. `POST /procurement/purchase-orders/{poId}/reject`
2. `POST /lifecycle/receiving/from-po`
3. `POST /eam/work-orders/{workOrderId}/complete`
