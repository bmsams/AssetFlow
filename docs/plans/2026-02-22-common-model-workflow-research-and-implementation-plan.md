# Common Data Model and Workflow Research + Implementation Plan

Date: 2026-02-22  
Scope: Align EAM + procurement + receiving + accounting flows to common enterprise patterns, then implement production fixes.

Related docs:
- `docs/plans/2026-02-22-complete-app-remediation-plan.md`
- `docs/plans/2026-02-22-api-write-smoke-results.md`
- `docs/plans/2026-02-21-conversion-plan.md`

## 1) Objective

Create a standards-aligned target operating model and use it to drive concrete fixes for:
- master data integrity (location, asset, vendor, item),
- requisition-to-PO conversion rules,
- receiving and invoice-matching readiness,
- work-order execution bounded by location/asset hierarchy,
- accounting traceability by line/distribution.

## 2) Research Questions

1. What is the normal master-data backbone for EAM + procurement systems?
2. What are canonical requisition -> approval -> PO workflows and grouping rules?
3. How do mature systems enforce approved vendor + item + price controls?
4. What receiving/invoice matching controls are standard for auditability?
5. How should location/equipment/work-order relationships constrain UI/API flows?

## 3) Benchmark Findings (Common Pattern)

## A. Master Data First (authoritative entities)

- Location hierarchy is canonical and upstream of asset/work order context.
- Asset/equipment records are anchored to location/functional location.
- Supplier approval must be modeled as an explicit item-supplier relationship (ASL-style), not free text.
- Item-supplier relationship is not equivalent to supplier approval; approval state and effective dating are separate controls.

## B. Procurement Transaction Flow

- Requisition starts as draft and moves through workflow approvals.
- Approved requisition lines convert into PO lines.
- PO grouping is controlled by supplier/business compatibility rules.
- PO is the commercial commitment; receipts and invoices must reference PO distributions.

## C. Receiving and Accounting Controls

- Receiving updates matched quantities and distribution/accounting downstream.
- 2-way/3-way/4-way matching policies (PO/receipt/inspection/invoice) are explicit control points.
- Encumbrance/open commitment lifecycle must be tied to PO state and fiscal controls.

## D. EAM Execution Flow

- Building/location scope determines the valid equipment set.
- Work orders should be created against assets that belong to the selected location context.
- UI selection paths must enforce this relationship, not rely on free-form entry.

## 4) Canonical Target Model for This App

## Master Data

1. `buildings`/location hierarchy as canonical site context.
2. `assets` + subtype tables (`hardware_assets`, etc.) as canonical equipment registry.
3. `vendors` + approved item/vendor relationship (`vendor_model_prices` + ASL governance attributes).
4. `cost_centers`, departments, and legal entity dimensions for accounting resolution.

## Procurement

1. Requisition header/line/distribution model remains source-of-intent.
2. Conversion service groups approved requisition lines into PO headers by compatibility:
   - vendor,
   - legal entity,
   - currency,
   - ship-to/accounting context.
3. Each PO line snapshots effective vendor/cost/pricing basis.

## Receiving

1. Receiving records and lines reference PO lines using canonical quantity fields.
2. Receive action updates line-level received state and supports downstream matching.

## EAM

1. Work order creation accepts building scope and validates asset belongs to that scope.
2. Completion and assignment transitions must use provisioned internal user IDs.

## Accounting

1. PO/requisition distributions are the accounting anchor for encumbrance/accrual.
2. Posting events must be idempotent and lineage-linked to source documents.

## 5) Gap-to-Fix Mapping (Current)

## Fixed in code (this implementation pass)

1. Receiving from PO SQL drift:
   - Fixed `quantity_received` -> `received_quantity` in `recordReceivingFromPO`.
   - File: `backend/packages/services/lifecycle-service/src/receiving/receiving-service.ts`.

2. Work order completion user identity mismatch:
   - Added Cognito `sub` -> `users.user_id` resolution and provisioning fallback before completion update.
   - File: `backend/packages/services/eam-service/src/handlers/complete-work-order.ts`.

3. PO reject status compatibility drift:
   - Added compatibility logic for environments where `valid_po_status` does not include `REJECTED`, falling back to `CANCELLED` while preserving rejection metadata.
   - File: `backend/packages/services/procurement-service/src/purchase-order/po-repository.ts`.

## Added regression tests

1. `backend/packages/services/lifecycle-service/src/__tests__/receiving-service.test.ts`
2. `backend/packages/services/procurement-service/src/__tests__/po-repository.test.ts`
3. `backend/packages/services/eam-service/src/__tests__/complete-work-order-handler.test.ts`

## 6) Remaining Implementation Plan (Phased)

## Phase 1: Contract Normalization (1-2 sprints)

1. Remove status-model drift by standardizing PO status contract across:
   - DB constraint (`valid_po_status`),
   - OpenAPI enum,
   - service status transitions.
2. Add migration to permanently include canonical states used by API logic.
3. Remove temporary compatibility fallback after migration adoption in all environments.

Exit gate:
- PO reject path uses canonical `REJECTED` in all environments without fallback.

## Phase 2: Approved Vendor/Price Governance (1-2 sprints)

1. Enforce ASL-style approval at PO line create/update (vendor, item/model, effective dates, status).
2. Extend pricing dimension for country/region where required.
3. Block PO line submission when approval/price rules fail.

Exit gate:
- No PO line can be persisted with unapproved vendor-item combination.

## Phase 3: Location/Asset/WO Determinism (1 sprint)

1. Expand building-scoped filters and joins to all WO list/detail/create APIs.
2. Ensure frontend selectors always load assets by selected building/site.
3. Add regression coverage for invalid cross-building asset selection.

Exit gate:
- Building -> asset -> work order flow is enforced API-side and UI-side.

## Phase 4: Receiving-to-Invoice Control Completion (1-2 sprints)

1. Formalize match-control configuration (2/3/4-way policy by supplier/site/category).
2. Ensure receiving updates are reflected in invoice-matchable quantities/distributions.
3. Add close guards for PO closure with unresolved receipt/invoice states.

Exit gate:
- Receiving and AP matching states reconcile for sampled transactions.

## Phase 5: Program QA and Cutover (1 sprint)

1. Run full write-smoke and integration smoke against target environment.
2. Add reconciliation checks:
   - orphan requisition/PO links,
   - invalid vendor-line combinations,
   - accounting tie-out variance.
3. Deploy by wave and monitor endpoint 5xx/error-class metrics.

Exit gate:
- Zero P0 flow breaks in smoke; reconciliation checks clean.

## 7) QA Execution Plan

1. Unit regression on changed modules each PR.
2. API write-smoke in dev after deployment.
3. Integration smoke in network path with private DB connectivity.
4. Production-readiness gate:
   - no critical SQL errors in CloudWatch for targeted endpoints,
   - zero unauthorized FK failures on `updated_by`,
   - reject/receiving/complete paths green.

## 8) Research Sources

1. SAP: Converting Purchase Requisitions  
   https://help.sap.com/saphelp_SCM700_ehp02/helpdata/en/a9/30c95360267614e10000000a174cb4/content.htm
2. SAP: Requisitions (Ariba Buying)  
   https://help.sap.com/docs/buying-invoicing/purchasing-guide-for-procurement-professionals/requisitions
3. SAP: Work Order Detail Screen (equipment + functional location context)  
   https://help.sap.com/docs/SAP_ASSET_MANAGER_IOS/fb9ae24b2b77468ba00e10df21c5cf24/94c7666778604d94bffea2ebf9f9f6f2.html
4. Oracle: Automate Order Creation for Requisitions  
   https://docs.oracle.com/en/cloud/saas/procurement/24c/oaprc/automate-order-creation-for-requisitions-without-previously.html
5. Oracle: Matching Invoice Lines (PO/receipt matching and legal entity constraints)  
   https://docs.oracle.com/en/cloud/saas/financials/25d/fappp/matching-invoice-lines.html
6. Oracle: Two-, Three-, and Four-way Matching  
   https://docs.oracle.com/cd/A60725_05/html/comnls/us/ap/point04.htm
7. Oracle: Approved Supplier List (ASL)  
   https://docs.oracle.com/cd/A60725_05/html/comnls/us/po/asl.htm
8. Oracle: Item supplier association vs ASL distinction  
   https://docs.oracle.com/cd/E18727-01/doc.121/e13109/T381249T381419.htm
9. Microsoft Dynamics 365: Purchase requisition workflow  
   https://learn.microsoft.com/en-us/dynamics365/supply-chain/procurement/purchase-requisitions-workflow
10. Microsoft Dynamics 365: Approve vendors for specific products  
    https://learn.microsoft.com/en-us/dynamics365/supply-chain/procurement/tasks/approve-vendors-specific-products
