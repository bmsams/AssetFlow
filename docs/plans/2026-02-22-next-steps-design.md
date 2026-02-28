# Next Steps Design (WS7 UI + WS8 Posting)

Date: 2026-02-22  
Related:
- `docs/plans/2026-02-21-conversion-plan.md`
- `docs/plans/2026-02-22-next-steps-dependency-analysis.md`

## 1) Design Goals

1. Expose requisition lifecycle end-to-end in frontend.
2. Enforce accounting lifecycle postings in backend without breaking existing PO/requisition workflows.
3. Keep implementation incremental and backward-compatible.

## 2) Functional Design

## A) Requisition Frontend Module

- New procurement-facing routes:
  - `/procurement/requisitions`
  - `/procurement/requisitions/new`
  - `/procurement/requisitions/:requisitionId`
- UI capabilities:
  - List requisitions with status/date/search filters.
  - Create requisition with line items (product type, description, qty, price, optional vendor/cost center).
  - Detail page actions by status:
    - `DRAFT`/`REJECTED`: submit
    - `PENDING_APPROVAL`: approve/reject
    - `APPROVED`/`PARTIALLY_CONVERTED`: convert to PO(s)
  - Display conversion linkage (`requisition_po_links`).

## B) Accounting Posting Module (procurement-service)

- Add `accounting` module with repository + service layers.
- Trigger points:
  - `approveRequisition` -> create pre-encumbrance rows.
  - `convertRequisitionToPOs` -> copy requisition distributions to `po_distributions`.
  - `approvePurchaseOrder` -> create PO encumbrances and subledger entry/lines.
- Idempotency behavior:
  - before insert, check whether equivalent posting rows already exist for source doc/line/type.
- Failure behavior:
  - non-fatal fallback when accounting tables are missing (log + continue), to prevent procurement outages pre-migration.

## 3) Data Design Notes

- `po_distributions` rows are sourced from requisition distributions where available.
- `budget_encumbrances` source typing:
  - requisition approval -> `source_type='REQUISITION'`, `encumbrance_type='PRE_ENCUMBRANCE'`
  - PO approval -> `source_type='PURCHASE_ORDER'`, `encumbrance_type='ENCUMBRANCE'`
- `subledger_entries`:
  - one header per PO approval posting batch.
  - lines generated as debit/credit pairs per PO distribution.

## 4) API Design Notes

- Requisition endpoints already live in procurement service; frontend client will align to this shape:
  - `GET /procurement/requisitions`
  - `POST /procurement/requisitions`
  - `GET /procurement/requisitions/{id}`
  - `POST /procurement/requisitions/{id}/submit`
  - `POST /procurement/requisitions/{id}/approve`
  - `POST /procurement/requisitions/{id}/reject`
  - `POST /procurement/requisitions/{id}/convert`
  - `GET /procurement/requisitions/{id}/links`

## 5) QA-by-Design Criteria

1. Requisition -> PO conversion preserves line-level lineage and distributions.
2. Approving requisition creates pre-encumbrance records.
3. Approving PO creates encumbrance + subledger records.
4. Requisition UI actions are status-gated and show clear error states from API.
