# Transfer API Contract (Runtime)

Date: 2026-03-01  
Scope: Runtime transfer + stockroom inventory API consumed by frontend

## 1) Scope and Sources

Handler sources:
- `backend/packages/services/ham-service/src/handlers/create-transfer.ts`
- `backend/packages/services/ham-service/src/handlers/list-transfers.ts`
- `backend/packages/services/ham-service/src/handlers/approve-transfer.ts`
- `backend/packages/services/ham-service/src/handlers/complete-transfer.ts`
- `backend/packages/services/ham-service/src/handlers/get-stockroom-inventory.ts`

Frontend client sources:
- `frontend/src/services/ham-api.ts`
- `frontend/src/services/stockroom-api.ts`

## 2) Runtime Endpoints (as consumed by frontend)

### `GET /ham/transfers`
Purpose:
- List transfers with optional status filter.

Query:
- `status` (optional, CSV of statuses)
- `page` (optional, default `1`)
- `limit` (optional, default `50`, max `100`)

Success response shape:
- Envelope: `{ success: true, data, requestId }`
- `data`:
  - `items`: transfer headers
  - `total`, `page`, `limit`, `hasMore`

Transfer header core fields:
- `transferId`, `transferNumber`
- `fromStockroomId`, `toStockroomId`
- `status`, `priority`
- `requestedBy`, `requestedDate`
- `totalLineCount`, `totalQuantity`, `receivedQuantity`
- optional building projection:
  - `fromBuildingId`, `fromBuildingName`, `fromBuildingCode`
  - `toBuildingId`, `toBuildingName`, `toBuildingCode`

### `POST /ham/transfers`
Purpose:
- Create transfer order.

Request shape:
- `fromStockroomId` (UUID, required)
- `toStockroomId` (UUID, required)
- `priority` (optional: `LOW|NORMAL|HIGH|URGENT|CRITICAL`)
- `reason`, `notes` (optional)
- `lines` (required, non-empty):
  - each line requires `quantity > 0` and one of:
    - `assetId` (UUID), or
    - `productId` (UUID)
  - optional: `productType`, `productDescription`, `serialNumber`, `assetTag`, `notes`

Success response shape:
- Envelope: `{ success: true, data, requestId }`
- `data`:
  - `transfer`: transfer header
  - `lines`: created transfer lines

### `POST /ham/transfers/{transferId}/approve`
Purpose:
- Approve transfer (or reject when `?action=reject`).

Request:
- approve: optional `{ notes }`
- reject: `{ rejectionReason }` required

Success response shape:
- Envelope: `{ success: true, data, requestId }`
- `data`:
  - `transfer`
  - `approved` (boolean)
  - `message`

### `POST /ham/transfers/{transferId}/complete`
Purpose:
- Complete transfer by posting receiving line receipts.

Request:
- `receivingNotes` (optional)
- `lineReceipts` (required, non-empty):
  - `lineId` (UUID)
  - `receivedQuantity` (integer, >= 0)
  - optional: `damagedQuantity`, `conditionReceived`, `conditionNotes`

Success response shape:
- Envelope: `{ success: true, data, requestId }`
- `data`:
  - `transfer`
  - `lines`
  - `inventoryUpdated`
  - `fromStockroomUpdated`
  - `toStockroomUpdated`

### `GET /ham/stockrooms/{stockroomId}/inventory`
Purpose:
- List stockroom inventory items.

Query:
- `page`, `limit`, `includeInactive` (optional)

Success response shape:
- Envelope: `{ success: true, data, requestId }`
- `data`:
  - `items`
  - `total`, `page`, `limit`, `hasMore`

Inventory item core fields:
- `inventoryId`, `stockroomId`
- `productId`, `productType`, `productSku`, `productDescription`
- `quantityOnHand`, `quantityReserved`, `quantityAvailable`
- `quantityInTransit`, `quantityOnOrder`
- `reorderPoint`, `reorderQuantity`, `maxQuantity`
- `binLocation`, `shelfLocation`

## 3) Frontend Normalization Rules

From `ham-api.ts`:
- Status normalization:
  - accepts lowercase and alias `PENDING` -> `PENDING_APPROVAL`
- Response compatibility:
  - accepts list as array or `{ items }`
  - accepts action responses as:
    - wrapped `{ transfer: {...} }`, or
    - flat transfer object
- Create compatibility:
  - legacy payload (`assetId`, no `lines`) is converted to transfer-order `lines[]`.

From `stockroom-api.ts`:
- Accepts canonical inventory fields and legacy aliases:
  - `inventoryId` or `itemId`
  - `productDescription` or `productName`
  - `updatedAt` or `lastUpdated`
  - `quantityOnHand` or `quantity`
- Derives `quantityAvailable` from `quantityOnHand` when not supplied.

## 4) Error Contract (high-level)

Common envelope:
- `{ success: false, error: { code, message, errors? }, requestId }`

Typical transfer errors:
- `401` unauthenticated
- `400` validation/UUID/invalid status input
- `404` transfer/stockroom not found
- `409` invalid state transition or inventory conflict
- `500` unexpected internal error

## 5) Known Contract Drift Risk

Current OpenAPI pathing in `backend/api/openapi.yaml` still documents stockroom-centric paths (for example `/stockrooms/{stockroomId}/transfers`) while runtime/frontend use `/ham/...` endpoints.

Action:
- Treat handler + integration tests as source of truth until OpenAPI parity for HAM transfer routes is completed.

## 6) Contract Check Coverage Added

Backend:
- `backend/packages/services/ham-service/src/__tests__/transfer-handlers.test.ts`
  - Asserts critical create/complete response payload keys.

Frontend:
- `frontend/src/services/ham-api.test.ts`
  - Verifies transfer status/filter normalization and response compatibility.
- `frontend/src/services/stockroom-api.test.ts`
  - Verifies canonical + legacy inventory response normalization.
