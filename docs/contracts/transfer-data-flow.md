# Transfer Data Flow (DB -> API -> Frontend)

Date: 2026-03-02

## 1) Entity Flow

```mermaid
flowchart LR
  TO[transfer_orders]
  TOL[transfer_order_lines]
  SI[stockroom_inventory]
  SR[stockrooms]

  TO -->|transfer_id| TOL
  TO -->|from_stockroom_id| SR
  TO -->|to_stockroom_id| SR
  TOL -->|product_id/product_type| SI
```

Key invariants:
- `transfer_orders.status` lifecycle must follow valid transitions.
- `transfer_order_lines.line_id` is the authoritative key for completion receipts.
- Source inventory cannot go negative.
- Destination inventory increments by good quantity (`received - damaged`).

## 2) API Flow

```mermaid
sequenceDiagram
  participant UI as Frontend
  participant API as HAM API
  participant SVC as Transfer Service
  participant DB as DB

  UI->>API: POST /ham/transfers
  API->>SVC: createTransfer()
  SVC->>DB: insert transfer_orders + transfer_order_lines

  UI->>API: POST /ham/transfers/{id}/approve
  API->>SVC: approveTransfer()
  SVC->>DB: update transfer_orders.status=APPROVED

  UI->>API: POST /ham/transfers/{id}/complete { lineReceipts[] }
  API->>SVC: completeTransfer()
  SVC->>SVC: validate receipts + inventory preflight
  SVC->>DB: post inventory movements
  SVC->>DB: update line receipt fields + transfer status
```

## 3) Frontend State Flow

```mermaid
flowchart TD
  L[List Transfers]
  C[Create Transfer Form]
  A[Approve Action]
  CM[Complete Modal]
  R[Refresh Transfer List]

  L --> C
  L --> A
  L --> CM
  C --> R
  A --> R
  CM -->|submit lineReceipts| R
```

Frontend sync rules:
- Completion UI must submit valid `lineReceipts` keyed by backend `lineId`.
- Completion validation blocks invalid damaged/received combinations before API call.
- Building/stockroom display prefers explicit API linkage and keeps controlled fallback for legacy records.

