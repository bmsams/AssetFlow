# Asset Shared Data Contract

Date: 2026-03-06  
Scope: Shared asset entities across DB, backend services, API layer, and frontend (HAM + SAM + EAM)

## 1) Contract Source of Truth

Machine-readable contract:
- `docs/contracts/asset-shared-contract.json`

Enforced parity checks:
- `backend/scripts/asset-model-contract-check.js`
- Command: `npm run contract:asset:model` (from `backend/`)

## 2) Canonical Entity Model

### Asset Core (`assets`)
Purpose:
- Single identity and lifecycle record shared across all modules.

Canonical keys:
- `assetId` / `asset_id`
- `assetTag` / `asset_tag`
- `assetType` / `asset_type` (`HARDWARE | SOFTWARE | ENTERPRISE`)
- `status` (`ORDERED` -> ... -> `DISPOSED`)
- audit fields (`createdAt`, `updatedAt`, `createdBy`, `updatedBy`)

### Asset Relationship (`asset_relationships`)
Purpose:
- CMDB graph for dependency, topology, and composition.

Canonical relationship field:
- `relationType` / `relation_type`

Canonical enum:
- `PARENT_CHILD`, `DEPENDENCY`, `CONNECTED_TO`, `INSTALLED_ON`, `RUNS_ON`, `LOCATION`, `COMPONENT`

Compatibility note:
- Frontend keeps `relationshipType` as a read alias for legacy UI code, but the canonical contract field is `relationType`.

## 3) Module Projections

Core + projection pattern:
- HAM projection: `hardware_assets` (`stockroom_id`, `building`, technical + ownership fields)
- SAM projection: `software_assets` (`software_product_id`, license/procurement fields)
- EAM projection: `enterprise_assets` (`facility_id`, `building`, `operating_hours`)

Rule:
- `assets` is authoritative for identity/lifecycle.
- Module tables are authoritative for subtype attributes.
- API payloads must return normalized camelCase fields that map directly to contract keys.

## 4) Data Flow Across Modules

1. Create: API writes to `assets` first, then subtype table (`hardware_assets`/`software_assets`/`enterprise_assets`).
2. Read/List: API reads from `assets` and merges subtype data when needed.
3. Relationships: API reads/writes `asset_relationships` using `relationType`.
4. Frontend: `asset-api.ts` maps backend relationship payloads into canonical `relationType` and exposes compatibility alias `relationshipType`.

## 5) Quality Gates

Run before deploy:
1. `cd backend`
2. `npm run contract:asset:model`
3. `npm run schema:smoke`

What it verifies:
- DB tables/columns in `mappings/tables.json`
- enum parity across backend types, OpenAPI, frontend types
- relationship field parity (`relationType`) across API + frontend mapping

