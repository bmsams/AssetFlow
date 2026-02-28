# AMS Backend Services

TypeScript Lambda functions and shared utilities for the Asset Management System.

## Project Structure

```
backend/
├── package.json              # Root package.json with workspaces
├── tsconfig.json             # Base TypeScript configuration
├── jest.config.js            # Jest test configuration
├── .eslintrc.js              # ESLint configuration
├── .prettierrc               # Prettier configuration
│
└── packages/
    ├── types/                # @ams/types - Shared TypeScript types
    │   └── src/
    │       ├── asset.ts      # Core asset types
    │       ├── hardware-asset.ts
    │       ├── software-asset.ts
    │       ├── enterprise-asset.ts
    │       ├── contract.ts
    │       ├── stockroom.ts
    │       ├── user.ts
    │       ├── audit.ts
    │       ├── api.ts        # API request/response types
    │       ├── events.ts     # Domain event types
    │       └── common.ts     # Common utility types
    │
    ├── utils/                # @ams/utils - Shared utilities
    │   └── src/
    │       ├── asset-tag.ts  # Asset tag generation
    │       ├── validation.ts # Request validation
    │       ├── logger.ts     # Structured logging
    │       ├── retry.ts      # Retry with backoff
    │       └── date-utils.ts # Date utilities
    │
    ├── database/             # @ams/database - Database utilities
    │   └── src/
    │       ├── connection.ts # Connection management
    │       ├── pool.ts       # Connection pooling
    │       ├── transaction.ts # Transaction support
    │       └── query-builder.ts
    │
    ├── cache/                # @ams/cache - Redis caching
    │   └── src/
    │       ├── client.ts     # Redis client
    │       ├── cache-service.ts # Cache-aside pattern
    │       └── cache-keys.ts # Key generation
    │
    ├── events/               # @ams/events - Event handling
    │   └── src/
    │       ├── publisher.ts  # SNS event publishing
    │       ├── consumer.ts   # SQS message consumption
    │       └── event-handler.ts # Event routing
    │
    └── services/             # Lambda function services
        ├── asset-service/    # @ams/asset-service - Core asset CRUD
        │   └── src/
        │       ├── handlers/ # Lambda handlers
        │       │   ├── create-asset.ts
        │       │   ├── get-asset.ts
        │       │   ├── update-asset.ts
        │       │   ├── delete-asset.ts
        │       │   ├── list-assets.ts
        │       │   └── transition-state.ts
        │       └── service/  # Business logic
        │           ├── asset-service.ts
        │           └── asset-repository.ts
        │
        └── ham-service/      # @ams/ham-service - Hardware Asset Management
            └── src/
                ├── handlers/ # Lambda handlers
                │   ├── get-stockroom-inventory.ts
                │   └── update-inventory.ts
                ├── stockroom/ # Stockroom management
                │   ├── stockroom-service.ts
                │   └── stockroom-repository.ts
                └── normalization/ # Data normalization
                    ├── normalization-engine.ts
                    ├── fuzzy-matching.ts
                    └── lookup-tables.ts
```

## Getting Started

### Prerequisites

- Node.js 18+
- npm 9+

### Installation

```bash
cd backend
npm install
```

### Build

```bash
# Build all packages
npm run build

# Build specific package
npm run build --workspace=@ams/types
```

### Testing

```bash
# Run all tests
npm test

# Run unit tests only
npm run test:unit

# Run property-based tests
npm run test:property

# Run with coverage
npm run test:coverage
```

### Code Quality

```bash
# Lint
npm run lint

# Fix lint issues
npm run lint:fix

# Type check
npm run typecheck

# Format code
npm run format
```

## Package Overview

### @ams/types

Shared TypeScript type definitions for all backend services.

```typescript
import type { Asset, CreateAssetRequest, AssetStatus } from '@ams/types';
```

### @ams/utils

Common utilities including:
- **Asset tag generation**: Unique tag generation with type prefixes
- **Validation**: Request validation with fluent API
- **Logging**: Structured JSON logging for CloudWatch
- **Retry**: Exponential backoff with circuit breaker

```typescript
import { generateAssetTag, validate, createLogger, withRetry } from '@ams/utils';
```

### @ams/database

PostgreSQL database utilities optimized for Lambda:
- Connection pooling with reuse across invocations
- Transaction support with isolation levels
- Query builder for common operations

```typescript
import { query, withTransaction, getPool } from '@ams/database';
```

### @ams/cache

Redis caching utilities:
- Cache-aside pattern implementation
- Automatic cache invalidation
- Batch operations

```typescript
import { getOrSet, invalidate, DEFAULT_TTL } from '@ams/cache';
```

### @ams/events

Event-driven architecture support:
- SNS event publishing
- SQS message consumption
- Event routing and handling

```typescript
import { publishEvent, createEventRouter, createLambdaHandler } from '@ams/events';
```

### @ams/ham-service

Hardware Asset Management service providing:
- Stockroom inventory management
- Manufacturer/model normalization with fuzzy matching
- Inventory quantity tracking with audit trails

```typescript
// Stockroom operations
import { StockroomService } from '@ams/ham-service/stockroom';

// Data normalization
import { NormalizationEngine, fuzzyMatch } from '@ams/ham-service/normalization';
```

## Environment Variables

| Variable | Description | Required |
|----------|-------------|----------|
| `DB_SECRET_ARN` | Secrets Manager ARN for database credentials | Yes* |
| `DB_HOST` | Database host (alternative to secret) | Yes* |
| `DB_PORT` | Database port (default: 5432) | No |
| `DB_NAME` | Database name (default: ams) | No |
| `DB_USERNAME` | Database username | Yes* |
| `DB_PASSWORD` | Database password | Yes* |
| `REDIS_HOST` | Redis host | Yes |
| `REDIS_PORT` | Redis port (default: 6379) | No |
| `REDIS_PASSWORD` | Redis password | No |
| `EVENTS_TOPIC_ARN` | SNS topic ARN for events | Yes |
| `SERVICE_NAME` | Service name for logging | No |
| `NODE_ENV` | Environment (development/production) | No |

*Either `DB_SECRET_ARN` or `DB_HOST`/`DB_USERNAME`/`DB_PASSWORD` required.

## Testing Strategy

### Unit Tests

Test individual functions and components in isolation.

```typescript
describe('generateAssetTag', () => {
  it('should generate unique tags', () => {
    const tag1 = generateAssetTag('HARDWARE');
    const tag2 = generateAssetTag('HARDWARE');
    expect(tag1).not.toBe(tag2);
  });
});
```

### Property-Based Tests

Verify properties hold across random inputs using fast-check.

```typescript
import * as fc from 'fast-check';

describe('Asset Tag Uniqueness', () => {
  it('should generate unique tags for any number of assets', () => {
    fc.assert(
      fc.property(
        fc.array(fc.constantFrom('HARDWARE', 'SOFTWARE', 'ENTERPRISE'), { minLength: 1, maxLength: 100 }),
        (types) => {
          const tags = types.map(t => generateAssetTag(t));
          const uniqueTags = new Set(tags);
          return uniqueTags.size === tags.length;
        }
      ),
      { numRuns: 100 }
    );
  });
});
```

## Adding a New Service

1. Create package directory:
   ```bash
   mkdir -p packages/services/my-service/src/{handlers,service}
   ```

2. Create `package.json`:
   ```json
   {
     "name": "@ams/my-service",
     "version": "1.0.0",
     "dependencies": {
       "@ams/types": "1.0.0",
       "@ams/utils": "1.0.0",
       "@ams/database": "1.0.0"
     }
   }
   ```

3. Create `tsconfig.json` extending the base config.

4. Implement handlers and service layer.

5. Add tests in `__tests__/` directory.

## License

Proprietary - Asset Management System
