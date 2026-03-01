# Transfer Data Model Contract (DB-First)

Date: 2026-03-01  
Scope: HAM transfer and stockroom inventory workflow

## 1) Core Relational Entities

Primary schema source:
- `backend/lambda/migration-runner/deploy-package-20260301020404/migrations/V006__stockroom_inventory_schema.sql`
- `backend/lambda/migration-runner/deploy-package-20260301020404/migrations/V023__po_line_cost_center_stockroom_building.sql`

### `stockrooms`
Purpose:
- Physical or logical inventory locations used as transfer endpoints.

Key fields:
- `stockroom_id` (PK)
- `stockroom_code` (unique, nullable)
- `name`
- `stockroom_type`
- `manager_id` (FK -> `users.user_id`)
- `parent_stockroom_id` (self-FK)
- `cost_center_id` (FK -> `cost_centers.cost_center_id`)
- `building_id` (FK -> `buildings.building_id`, added in `V023`)

Key constraints:
- `stockroom_code` unique when present.
- Active/inactive lifecycle via `is_active`.

### `stockroom_inventory`
Purpose:
- Per-stockroom inventory ledger by product identity/type.

Key fields:
- `inventory_id` (PK)
- `stockroom_id` (FK -> `stockrooms.stockroom_id`)
- `product_id` (nullable UUID)
- `product_type` (required enum-like check)
- `product_sku`, `product_description`
- `quantity_on_hand`, `quantity_reserved`, `quantity_available` (generated), `quantity_in_transit`, `quantity_on_order`
- `reorder_point`, `reorder_quantity`, `max_quantity`
- `bin_location`, `shelf_location`
- `is_active`

Key constraints:
- Unique tuple: `(stockroom_id, product_id, product_type)`.
- Non-negative quantity checks.
- `quantity_reserved <= quantity_on_hand`.
- Controlled `product_type` and `unit_of_measure` domains.

### `transfer_orders`
Purpose:
- Transfer header/workflow object between two stockrooms.

Key fields:
- `transfer_id` (PK)
- `transfer_number` (unique)
- `from_stockroom_id` (FK -> `stockrooms.stockroom_id`)
- `to_stockroom_id` (FK -> `stockrooms.stockroom_id`)
- `status`
- `priority`
- Request/approval/shipping/receiving audit fields (`requested_by`, `approved_by`, `shipped_by`, `received_by`, dates, notes)
- Aggregate counts (`total_line_count`, `total_quantity`, `shipped_quantity`, `received_quantity`)

Key constraints:
- `from_stockroom_id != to_stockroom_id`.
- Allowed status set:
  - `DRAFT`, `PENDING_APPROVAL`, `APPROVED`, `REJECTED`, `IN_TRANSIT`, `PARTIALLY_RECEIVED`, `RECEIVED`, `COMPLETED`, `CANCELLED`, `ON_HOLD`
- Allowed priority set:
  - `LOW`, `NORMAL`, `HIGH`, `URGENT`, `CRITICAL`

### `transfer_order_lines`
Purpose:
- Transfer line-level granularity for asset or product movements.

Key fields:
- `line_id` (PK)
- `transfer_id` (FK -> `transfer_orders.transfer_id`, cascade delete)
- `line_number` (unique within transfer)
- Item identity: `asset_id` (FK -> `assets.asset_id`) or `product_id`
- Optional descriptors: `product_type`, `product_description`, `serial_number`, `asset_tag`
- Quantities: `quantity`, `shipped_quantity`, `received_quantity`, `damaged_quantity`
- Status and condition: `status`, `condition_shipped`, `condition_received`, `condition_notes`

Key constraints:
- Must reference either `asset_id` or `product_id`.
- Positive `quantity`, non-negative shipped/received/damaged values.
- `shipped_quantity <= quantity`.
- `received_quantity <= shipped_quantity` (unless shipped is 0).
- Allowed line status set:
  - `PENDING`, `SHIPPED`, `IN_TRANSIT`, `RECEIVED`, `PARTIALLY_RECEIVED`, `DAMAGED`, `CANCELLED`

## 2) Cross-Reference Map

- `transfer_orders.from_stockroom_id` -> `stockrooms.stockroom_id`
- `transfer_orders.to_stockroom_id` -> `stockrooms.stockroom_id`
- `transfer_order_lines.transfer_id` -> `transfer_orders.transfer_id`
- `transfer_order_lines.asset_id` -> `assets.asset_id` (optional)
- `stockroom_inventory.stockroom_id` -> `stockrooms.stockroom_id`

Building-aware transfer support:
- `stockrooms.building_id` (from `V023`) enables building-to-building UX and reporting while transfer integrity remains stockroom-based.

## 3) Workflow State Model

Header status progression:
- `DRAFT -> PENDING_APPROVAL -> APPROVED -> IN_TRANSIT -> PARTIALLY_RECEIVED/RECEIVED -> COMPLETED`

Alternate/terminal paths:
- `PENDING_APPROVAL -> REJECTED`
- `* -> CANCELLED` (state dependent)
- `ON_HOLD` can pause and later return to active statuses per service logic.

Line status progression:
- `PENDING -> SHIPPED/IN_TRANSIT -> PARTIALLY_RECEIVED/RECEIVED`
- `DAMAGED` and `CANCELLED` represent exception/terminal outcomes.

## 4) Invariants Required for Data Sync

1. Header source and destination stockrooms must be different.
2. Transfer must have at least one line.
3. Every line must reference an asset or product.
4. Quantities cannot violate line-level constraints.
5. Completion must reconcile with line receipts; inventory posting must not produce negative available stock.
6. `stockrooms.building_id` should be populated for deterministic building filters in UI/API selectors.

## 5) Data Flow Summary (DB -> API -> UI)

1. User creates transfer request (asset-based or product-based line).
2. API validates UUIDs, status rules, and line constraints.
3. Service persists `transfer_orders` + `transfer_order_lines`.
4. Approval and completion actions transition status and update inventory quantities.
5. API responses project transfer header/line data to frontend contract fields.
6. Frontend renders route, status, and actions; completion should submit line receipts.
