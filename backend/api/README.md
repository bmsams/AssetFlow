# Asset Management System API

This directory contains the OpenAPI specification for the Asset Management System (AMS) REST API.

## Overview

The AMS API provides comprehensive lifecycle management for hardware, software, and enterprise assets. It follows RESTful design principles and is documented using OpenAPI 3.0.3.

## Files

```
backend/api/
├── openapi.yaml          # Complete OpenAPI 3.0.3 specification
├── README.md             # This documentation file
├── docker-compose.yaml   # Docker configuration for Swagger UI
├── serve-docs.sh         # Script to serve documentation locally
└── swagger-ui/
    └── index.html        # Custom Swagger UI interface
```

## 🚀 Quick Start - Viewing API Documentation

### Option 1: Docker (Recommended)

The easiest way to view the API documentation is using Docker:

```bash
# Navigate to the api directory
cd backend/api

# Start Swagger UI
docker-compose up swagger-ui

# Access at: http://localhost:8080
```

Or start both Swagger UI and Redoc:

```bash
docker-compose up

# Swagger UI: http://localhost:8080
# Redoc: http://localhost:8081
```

### Option 2: Using the Serve Script

```bash
# Make the script executable
chmod +x serve-docs.sh

# Start Swagger UI (default)
./serve-docs.sh swagger

# Start Redoc
./serve-docs.sh redoc

# Start both (requires Docker)
./serve-docs.sh both
```

### Option 3: Using npx (Node.js)

```bash
# Preview with Redocly CLI
npx @redocly/cli preview-docs openapi.yaml

# Access at: http://localhost:8080
```

### Option 4: Online Editors

1. **Swagger Editor**: Visit [editor.swagger.io](https://editor.swagger.io) and import `openapi.yaml`
2. **Stoplight Studio**: Import the spec at [stoplight.io](https://stoplight.io)

### Option 5: VS Code Extensions

Install one of these extensions:
- **OpenAPI (Swagger) Editor** by 42Crunch
- **Swagger Viewer** by Arjun G

## API Features

### Core Capabilities

| Feature | Description |
|---------|-------------|
| **Asset CRUD** | Create, read, update, and delete assets |
| **Asset Search** | Full-text search with OpenSearch integration |
| **State Transitions** | Lifecycle state management with validation |
| **Asset Relationships** | CMDB relationship management |

### Hardware Asset Management (HAM)

- Hardware asset tracking with normalization
- Stockroom and inventory management
- Loaner asset checkout/return
- Disposal workflow management
- Mobile auditing support

### Software Asset Management (SAM)

- Software product catalog
- License entitlement management
- Compliance reconciliation
- Reclamation candidate identification
- Shadow IT detection

### Enterprise Asset Management (EAM)

- Enterprise asset tracking
- Maintenance plan scheduling
- Work order management
- Parts inventory and reservation

### Integrations

- Discovery data ingestion (SCCM, Jamf, Tanium)
- ERP synchronization (SAP, Oracle, Workday)
- Vendor integration (ASN processing, catalog sync)

## Authentication

All endpoints (except `/health`) require JWT authentication via AWS Cognito.

### Getting a Token

```bash
# Using AWS CLI
aws cognito-idp initiate-auth \
  --client-id YOUR_CLIENT_ID \
  --auth-flow USER_PASSWORD_AUTH \
  --auth-parameters USERNAME=user@example.com,PASSWORD=your-password
```

### Using the Token

Include the JWT token in the `Authorization` header:

```bash
curl -X GET https://api.ams.example.com/v1/assets \
  -H "Authorization: Bearer eyJhbGciOiJSUzI1NiIsInR5cCI6IkpXVCJ9..."
```

## Rate Limiting

| Limit Type | Value |
|------------|-------|
| Default Rate | 1000 requests/second |
| Burst Limit | 2000 requests |
| Scope | Per API key |

When rate limited, the API returns HTTP 429 with a `Retry-After` header.

## Error Handling

All errors follow a consistent format:

```json
{
  "error": {
    "code": "ERROR_CODE",
    "message": "Human-readable error message",
    "details": [
      {
        "field": "fieldName",
        "message": "Validation error message",
        "code": "VALIDATION_CODE"
      }
    ],
    "requestId": "req-123456",
    "timestamp": "2025-01-15T10:30:00Z"
  }
}
```

### Error Codes Reference

| Code | HTTP Status | Description |
|------|-------------|-------------|
| `VALIDATION_ERROR` | 422 | Request validation failed |
| `UNAUTHORIZED` | 401 | Missing or invalid authentication |
| `FORBIDDEN` | 403 | Insufficient permissions |
| `NOT_FOUND` | 404 | Resource not found |
| `CONFLICT` | 409 | Resource state conflict |
| `RATE_LIMITED` | 429 | Rate limit exceeded |
| `INTERNAL_ERROR` | 500 | Internal server error |
| `INVALID_STATE_TRANSITION` | 409 | Invalid asset state transition |
| `BAD_REQUEST` | 400 | Malformed request |
| `SERVICE_UNAVAILABLE` | 503 | Service temporarily unavailable |

## Pagination

List endpoints support pagination with the following parameters:

| Parameter | Type | Default | Max | Description |
|-----------|------|---------|-----|-------------|
| `page` | integer | 1 | - | Page number (1-indexed) |
| `limit` | integer | 20 | 100 | Items per page |
| `sort` | string | `createdAt` | - | Field to sort by |
| `sortDirection` | string | `desc` | - | Sort direction (`asc` or `desc`) |

### Response Format

```json
{
  "data": [...],
  "pagination": {
    "total": 150,
    "page": 1,
    "limit": 20,
    "hasMore": true,
    "nextCursor": "eyJpZCI6..."
  },
  "meta": {
    "requestId": "req-123456",
    "timestamp": "2025-01-15T10:30:00Z"
  }
}
```

### Cursor-Based Pagination

For large datasets, use cursor-based pagination:

```bash
# First request
curl "https://api.ams.example.com/v1/assets?limit=50"

# Subsequent requests using nextCursor
curl "https://api.ams.example.com/v1/assets?limit=50&cursor=eyJpZCI6..."
```

## Asset Lifecycle States

Assets follow a strict state machine:

```
┌─────────┐    ┌──────────┐    ┌──────────┐
│ ORDERED │───▶│ RECEIVED │───▶│ IN_STOCK │
└─────────┘    └──────────┘    └────┬─────┘
                                    │
                    ┌───────────────┼───────────────┐
                    ▼               ▼               ▼
              ┌──────────┐   ┌──────────┐    ┌─────────┐
              │ RESERVED │   │ DEPLOYED │    │ RETIRED │
              └────┬─────┘   └────┬─────┘    └────┬────┘
                   │              │               │
                   └──────┬───────┘               ▼
                          │              ┌──────────┐
                          ▼              │ DISPOSED │
                   ┌──────────────┐      └──────────┘
                   │IN_MAINTENANCE│
                   └──────────────┘
```

### Valid Transitions

| From State | Valid To States |
|------------|-----------------|
| `ORDERED` | `RECEIVED` |
| `RECEIVED` | `IN_STOCK` |
| `IN_STOCK` | `RESERVED`, `DEPLOYED`, `RETIRED` |
| `RESERVED` | `IN_STOCK`, `DEPLOYED` |
| `DEPLOYED` | `IN_STOCK`, `IN_MAINTENANCE`, `RETIRED` |
| `IN_MAINTENANCE` | `DEPLOYED`, `RETIRED` |
| `RETIRED` | `DISPOSED` |

## Asset Tag Format

Asset tags follow the pattern: `AMS-{TYPE}-{DATE}-{RANDOM}`

| Component | Description | Example |
|-----------|-------------|---------|
| `AMS` | System prefix | AMS |
| `TYPE` | Asset type code | HW, SW, EN |
| `DATE` | Creation date (YYYYMMDD) | 20250115 |
| `RANDOM` | 6-character alphanumeric | ABC123 |

**Examples:**
- Hardware: `AMS-HW-20250115-ABC123`
- Software: `AMS-SW-20250115-XYZ789`
- Enterprise: `AMS-EN-20250115-DEF456`

## Quick Start Examples

### Create a Hardware Asset

```bash
curl -X POST https://api.ams.example.com/v1/assets \
  -H "Authorization: Bearer <jwt-token>" \
  -H "Content-Type: application/json" \
  -d '{
    "assetType": "HARDWARE",
    "displayName": "Dell Latitude 5520 Laptop",
    "description": "Employee laptop for engineering team"
  }'
```

**Response:**
```json
{
  "data": {
    "assetId": "550e8400-e29b-41d4-a716-446655440000",
    "assetTag": "AMS-HW-20250115-ABC123",
    "assetType": "HARDWARE",
    "displayName": "Dell Latitude 5520 Laptop",
    "description": "Employee laptop for engineering team",
    "status": "ORDERED",
    "createdAt": "2025-01-15T10:30:00Z",
    "updatedAt": "2025-01-15T10:30:00Z"
  },
  "meta": {
    "requestId": "req-abc123",
    "timestamp": "2025-01-15T10:30:00Z"
  }
}
```

### Search for Assets

```bash
curl -X GET "https://api.ams.example.com/v1/assets/search?q=Dell%20laptop&limit=10" \
  -H "Authorization: Bearer <jwt-token>"
```

### Transition Asset State

```bash
curl -X POST https://api.ams.example.com/v1/assets/{assetId}/transition \
  -H "Authorization: Bearer <jwt-token>" \
  -H "Content-Type: application/json" \
  -d '{
    "newState": "DEPLOYED",
    "reason": "Assigned to new employee John Smith"
  }'
```

### Checkout a Loaner Asset

```bash
curl -X POST https://api.ams.example.com/v1/hardware-assets/{assetId}/loaner/checkout \
  -H "Authorization: Bearer <jwt-token>" \
  -H "Content-Type: application/json" \
  -d '{
    "checkedOutTo": "550e8400-e29b-41d4-a716-446655440000",
    "dueDate": "2025-02-15T17:00:00Z",
    "conditionOut": "GOOD",
    "notes": "Temporary laptop while primary device is being repaired"
  }'
```

### Run Software Reconciliation

```bash
curl -X POST https://api.ams.example.com/v1/software-assets/{productId}/reconciliation \
  -H "Authorization: Bearer <jwt-token>"
```

**Response:**
```json
{
  "data": {
    "resultId": "550e8400-e29b-41d4-a716-446655440000",
    "softwareProductId": "550e8400-e29b-41d4-a716-446655440001",
    "entitlementsOwned": 100,
    "installationsFound": 85,
    "compliancePosition": "OVER_LICENSED",
    "overUnderCount": 15,
    "lastReconciledAt": "2025-01-15T10:30:00Z"
  },
  "meta": {
    "requestId": "req-reconcile-001",
    "timestamp": "2025-01-15T10:30:00Z"
  }
}
```

### Ingest Discovery Data

```bash
curl -X POST https://api.ams.example.com/v1/integrations/discovery \
  -H "Authorization: Bearer <jwt-token>" \
  -H "Content-Type: application/json" \
  -d '{
    "source": "SCCM",
    "sourceId": "sccm-prod-01",
    "records": [
      {
        "sourceRecordId": "SCCM-12345",
        "serialNumber": "DELL-SN-2025-XYZ789",
        "hostname": "LAPTOP-ENG-001",
        "manufacturer": "Dell Inc.",
        "model": "Latitude 5520"
      }
    ]
  }'
```

### Create a Work Order

```bash
curl -X POST https://api.ams.example.com/v1/work-orders \
  -H "Authorization: Bearer <jwt-token>" \
  -H "Content-Type: application/json" \
  -d '{
    "assetId": "550e8400-e29b-41d4-a716-446655440000",
    "workType": "Preventive Maintenance",
    "priority": "MEDIUM",
    "description": "Quarterly maintenance check for HVAC unit",
    "scheduledDate": "2025-02-01T09:00:00Z"
  }'
```

## API Endpoint Summary

### Core Assets

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/assets` | List all assets |
| POST | `/assets` | Create a new asset |
| GET | `/assets/{id}` | Get asset by ID |
| PUT | `/assets/{id}` | Update an asset |
| DELETE | `/assets/{id}` | Delete an asset |
| GET | `/assets/search` | Full-text search |
| POST | `/assets/{id}/transition` | Transition state |
| GET | `/assets/{id}/relationships` | Get relationships |
| POST | `/assets/{id}/relationships` | Create relationship |

### Hardware Assets

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/hardware-assets` | List hardware assets |
| POST | `/hardware-assets` | Create hardware asset |
| GET | `/hardware-assets/{id}` | Get hardware asset |
| PUT | `/hardware-assets/{id}` | Update hardware asset |
| POST | `/hardware-assets/{id}/normalize` | Normalize data |
| POST | `/hardware-assets/{id}/loaner/checkout` | Checkout loaner |
| POST | `/hardware-assets/{id}/loaner/return` | Return loaner |
| POST | `/hardware-assets/{id}/disposal` | Initiate disposal |

### Software Assets

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/software-assets` | List software products |
| POST | `/software-assets` | Create software product |
| GET | `/software-assets/{id}` | Get software product |
| GET | `/software-assets/{id}/entitlements` | List entitlements |
| POST | `/software-assets/{id}/entitlements` | Create entitlement |
| POST | `/software-assets/{id}/reconciliation` | Run reconciliation |
| GET | `/software-assets/{id}/compliance` | Get compliance |
| GET | `/software-assets/reclamation-candidates` | List reclamation candidates |
| GET | `/software-assets/shadow-it` | List shadow IT alerts |

### Enterprise Assets

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/enterprise-assets` | List enterprise assets |
| POST | `/enterprise-assets` | Create enterprise asset |
| GET | `/enterprise-assets/{id}` | Get enterprise asset |
| PUT | `/enterprise-assets/{id}` | Update enterprise asset |

### Stockrooms

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/stockrooms` | List stockrooms |
| POST | `/stockrooms` | Create stockroom |
| GET | `/stockrooms/{id}` | Get stockroom |
| PUT | `/stockrooms/{id}` | Update stockroom |
| GET | `/stockrooms/{id}/inventory` | Get inventory |
| GET | `/stockrooms/{id}/transfers` | List transfers |
| POST | `/stockrooms/{id}/transfers` | Create transfer |
| GET | `/stockrooms/{id}/audits` | List audits |
| POST | `/stockrooms/{id}/audits` | Start audit |
| POST | `/stockrooms/{id}/audits/{auditId}/scans` | Record scan |
| POST | `/stockrooms/{id}/audits/{auditId}/complete` | Complete audit |

### Work Orders

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/work-orders` | List work orders |
| POST | `/work-orders` | Create work order |
| GET | `/work-orders/{id}` | Get work order |
| PUT | `/work-orders/{id}` | Update work order |
| POST | `/work-orders/{id}/assign` | Assign work order |
| POST | `/work-orders/{id}/complete` | Complete work order |
| GET | `/work-orders/{id}/parts` | Get parts |
| POST | `/work-orders/{id}/parts` | Reserve parts |

### Maintenance Plans

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/maintenance-plans` | List plans |
| POST | `/maintenance-plans` | Create plan |
| GET | `/maintenance-plans/{id}` | Get plan |
| PUT | `/maintenance-plans/{id}` | Update plan |
| DELETE | `/maintenance-plans/{id}` | Delete plan |
| POST | `/maintenance-plans/{id}/generate-work-orders` | Generate work orders |

### Integrations

| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/integrations/discovery` | Ingest discovery data |
| GET | `/integrations/discovery/sources` | List discovery sources |
| POST | `/integrations/erp` | Sync ERP data |
| POST | `/integrations/erp/purchase-orders` | Create ERP PO |
| POST | `/integrations/vendor` | Process vendor data |
| POST | `/integrations/vendor/asn` | Process ASN |
| GET | `/integrations/vendor/catalog` | Get vendor catalog |

### Health

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/health` | Health check (no auth required) |

## Validation

To validate the OpenAPI specification:

```bash
# Using Spectral (recommended)
npx @stoplight/spectral-cli lint openapi.yaml

# Using swagger-cli
npx swagger-cli validate openapi.yaml

# Using Redocly CLI
npx @redocly/cli lint openapi.yaml
```

## Code Generation

Generate client SDKs or server stubs:

```bash
# Generate TypeScript Axios client
npx openapi-generator-cli generate \
  -i openapi.yaml \
  -g typescript-axios \
  -o ./generated/typescript-client

# Generate Python client
npx openapi-generator-cli generate \
  -i openapi.yaml \
  -g python \
  -o ./generated/python-client

# Generate Go client
npx openapi-generator-cli generate \
  -i openapi.yaml \
  -g go \
  -o ./generated/go-client
```

## CORS Configuration

The API supports CORS with the following configuration:

| Setting | Value |
|---------|-------|
| Allowed Origins | Configure per environment |
| Allowed Methods | GET, POST, PUT, DELETE, OPTIONS |
| Allowed Headers | Content-Type, Authorization, X-Api-Key, X-Amz-Date, X-Amz-Security-Token, X-Amz-User-Agent |
| Max Age | 1 hour (3600 seconds) |

## Request Tracing

All responses include a `requestId` in the response metadata for distributed tracing:

```json
{
  "meta": {
    "requestId": "req-abc123def456",
    "timestamp": "2025-01-15T10:30:00Z"
  }
}
```

Include this ID when reporting issues or debugging problems.

## Related Documentation

- [AWS CDK Infrastructure](../../stacks/api_stack.py)
- [Backend Services](../packages/services/)
- [Type Definitions](../packages/types/)
- [Database Migrations](../../migrations/)

## Version History

| Version | Date | Changes |
|---------|------|---------|
| 1.0.0 | 2025-01-15 | Initial release with full HAM, SAM, EAM support |

## Support

For API support or to report issues:
- Email: api-support@ams.example.com
- Documentation: https://docs.ams.example.com
- Status Page: https://status.ams.example.com
