# Customer-First Personas, Journeys, and Edge Cases

## Purpose
Define who uses each AMS module, what their end-to-end journey should look like, and how the system should behave in edge cases.

## Customer Outcomes (Work Backwards)
- A worker can complete their job without leaving role-approved workflows.
- Every handoff between teams preserves context and data integrity.
- Exceptions are recoverable with clear ownership, not silent failures.
- The lifecycle is auditable from request through retirement/disposal.

## Persona Catalog

### 1) Requester (Employee / Team Lead)
- Primary modules: Service Catalog, Requests, Notifications
- Goal: Request hardware/software/services quickly with minimal policy friction
- Success signal: Request submitted once, approved/rejected with clear reason and SLA

### 2) Procurement Specialist / Buyer
- Primary modules: Requisitions, Purchase Orders, Vendors, Approvals, Accounting
- Goal: Convert demand into compliant procurement transactions
- Success signal: POs are accurate, approved, sent, and fully traceable to request lines

### 3) Receiving Clerk / Inventory Coordinator
- Primary modules: Receiving, Stockrooms, Inspection, Bin Locations
- Goal: Receive and inspect items, reconcile expected vs actual, place stock correctly
- Success signal: No orphan receiving lines, variances captured, inventory updated in real time

### 4) Asset Manager
- Primary modules: Assets (hardware/software/enterprise), Deployment, Transfers, Loaners, Disposal
- Goal: Keep asset records accurate across assignment, movement, and lifecycle status
- Success signal: Asset state and ownership are always current and queryable

### 5) Facilities / EAM Manager
- Primary modules: Work Orders, Maintenance Plans, Linear Assets, Parts Inventory
- Goal: Maintain asset uptime, preventive maintenance execution, and parts readiness
- Success signal: Work backlog controlled, overdue maintenance minimized

### 6) License Analyst (SAM)
- Primary modules: Software Products, Entitlements, Installations, Reconciliation, Reclamation, SaaS Usage
- Goal: Keep license position compliant and cost-optimized
- Success signal: Reconciliation actionable, unused licenses reclaimed, audit evidence complete

### 7) Finance / Controller
- Primary modules: Cost Centers, PO Distributions, Budget Encumbrances, Subledger, Depreciation, Lease Payments
- Goal: Ensure spend and capitalization are accurate and timely
- Success signal: Subledger ties out to operational events and budget controls

### 8) Auditor / Compliance Officer
- Primary modules: Audit Log, Reports, Notification History, Contracts
- Goal: Verify policy adherence and reconstruct event timelines quickly
- Success signal: End-to-end traceability with immutable audit evidence

### 9) System / Integration Admin
- Primary modules: Discovery, ERP/Vendor Integrations, Reference Data, User/Roles
- Goal: Keep integrations and master data healthy
- Success signal: Sync jobs complete, failures isolated, retries deterministic

## Canonical End-to-End Journey (Hardware + Financial + Audit)

### Phase A: Demand and Intake
- Actor: Requester
- Flow:
  - User submits request from catalog (items, quantity, business justification, cost center/defaults).
  - Request enters workflow with status and approval routing metadata.
- Expected system behavior:
  - Validate required fields and role permissions.
  - Assign request ID, timestamps, and audit entry.
  - Trigger notification to approvers.

### Phase B: Approval and Budget Control
- Actor: Approver, Procurement Specialist
- Flow:
  - Approval workflow evaluates thresholds, delegation, and policy.
  - Approved request lines become requisition-ready.
- Expected system behavior:
  - Enforce approval routing rules and state transitions.
  - Block if policy/budget constraints fail.
  - Preserve decision rationale in audit trail.

### Phase C: Requisition to Purchase Order
- Actor: Procurement Specialist
- Flow:
  - Build requisition distributions (cost center/split).
  - Convert to PO with line-level vendor/cost center as needed.
  - Submit PO for final approval/send to vendor.
- Expected system behavior:
  - Maintain request → requisition → PO lineage.
  - Resolve effective line defaults from header only where line overrides are empty.
  - Reject PO submit if any required effective line data is unresolved.

### Phase D: Receiving and Inspection
- Actor: Receiving Clerk
- Flow:
  - Receive against PO lines (partial/full, condition, serials).
  - Record inspection results and discrepancies.
  - Move accepted items to stock/bin location.
- Expected system behavior:
  - Enforce quantity ceilings (cannot over-receive without controlled exception path).
  - Capture variance reason codes and evidence.
  - Update inventory and PO line received quantities atomically.

### Phase E: Asset Creation and Deployment
- Actor: Asset Manager / Inventory Coordinator
- Flow:
  - Convert received units into asset records with identifiers and ownership.
  - Assign/deploy to user/location/department.
- Expected system behavior:
  - Generate canonical asset tags and preserve serial uniqueness constraints.
  - Track deployment records and assignment history.
  - Emit notifications for assignment/state changes.

### Phase F: Operate, Maintain, and Optimize
- Actor: Facilities Manager, License Analyst, Asset Manager
- Flow:
  - Run maintenance plans/work orders for enterprise assets.
  - Run reconciliation/reclamation/SaaS usage for software.
  - Process transfers, loaners, and periodic audits.
- Expected system behavior:
  - Keep maintenance, compliance, and movement events linked to asset IDs.
  - Enforce valid status transitions and role boundaries.
  - Maintain alerting for overdue, expiring, or non-compliant states.

### Phase G: Retirement / Disposal / Financial Close
- Actor: Asset Manager, Finance, Auditor
- Flow:
  - Initiate retirement/disposal workflow and certificate evidence.
  - Close depreciation/lease and subledger impacts.
  - Produce audit/report outputs.
- Expected system behavior:
  - Prevent destructive actions without approvals/evidence.
  - Keep immutable retirement lineage and supporting documents.
  - Reconcile operational closure with accounting entries.

## Edge-Case Playbook (Expected Behavior)

### 1) Missing effective vendor on PO line
- Detect: PO submit validation
- Expected behavior: hard-block submit, return line-specific error, keep draft unchanged
- Owner: Procurement Specialist

### 2) Partial receiving with damaged units
- Detect: receiving line condition + qty variance
- Expected behavior: split accepted/rejected quantities, log discrepancy, preserve backorder
- Owner: Receiving Clerk + Procurement

### 3) Over-receipt attempt
- Detect: received > ordered guard
- Expected behavior: reject by default; allow only explicit exception workflow with approval
- Owner: Receiving Lead

### 4) Duplicate serial number during asset creation
- Detect: serial uniqueness check
- Expected behavior: block duplicate create, provide existing asset reference for review
- Owner: Asset Manager

### 5) Asset transfer while open critical work order exists
- Detect: pre-transfer dependency check
- Expected behavior: block or require override approval with reason code
- Owner: Asset Manager + Facilities

### 6) Reconciliation run with stale source data
- Detect: source sync timestamp outside freshness SLA
- Expected behavior: mark result as warning/degraded, do not auto-close compliance actions
- Owner: License Analyst + Integration Admin

### 7) Budget overrun on requisition/PO distribution
- Detect: encumbrance/budget check
- Expected behavior: route to escalation approval; no silent auto-approval
- Owner: Procurement + Finance

### 8) Integration outage (ERP/vendor/discovery)
- Detect: connector health/sync failure
- Expected behavior: retry with backoff, idempotent reprocessing, alert with runbook link
- Owner: Integration Admin

### 9) Unauthorized page/action access
- Detect: route/action RBAC enforcement
- Expected behavior: show access-denied context + redirect to role landing page
- Owner: Platform Admin

### 10) Retirement attempted without certificate/evidence where required
- Detect: retirement completion validation
- Expected behavior: block completion until mandatory evidence uploaded
- Owner: Asset Manager + Compliance

## Cross-Module Handoff Contracts (Must Hold)
- Request line IDs remain traceable through requisition, PO line, receiving line, and asset records.
- Status transitions are state-machine controlled (no illegal jumps).
- Financial postings are derived from approved operational events, not manual side channels.
- Every mutating action writes audit metadata (`who`, `when`, `what before/after`).
- Notification events reference stable entity IDs and actionable links.

## Validation Checklist
- Persona walkthroughs validated in UAT with role-specific test accounts.
- Happy-path and edge-case scripts executed per persona.
- Audit reconstruction test: sample asset from request to retirement in under 5 minutes.
- Integration failure drill performed (ERP/discovery) with measured recovery time.
- Monthly review of blocked-action telemetry to refine UX and policy rules.
