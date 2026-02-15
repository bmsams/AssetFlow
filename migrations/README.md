# Database Migrations

This directory contains SQL migration files for the Asset Management System database schema.

## Migration Naming Convention

Migrations are named with a version prefix followed by a descriptive name:
- `V001__` - Core asset schema (assets, users, roles, permissions, audit_log)
- `V002__` - Hardware asset schema
- `V003__` - Software asset schema
- `V004__` - Enterprise asset schema
- `V005__` - Contract and financial schema
- `V006__` - Stockroom and inventory schema

## Running Migrations

Migrations are designed to be run against Aurora PostgreSQL Serverless v2.

### Using psql
```bash
psql -h <aurora-endpoint> -U <username> -d <database> -f migrations/V001__core_asset_schema.sql
```

### Using a migration tool (recommended)
Consider using Flyway or Alembic for production deployments:
```bash
flyway -url=jdbc:postgresql://<aurora-endpoint>/<database> migrate
```

## Schema Overview

### Core Tables (V001)
- `departments` - Organizational departments
- `users` - System users linked to Cognito
- `roles` - RBAC roles
- `permissions` - Granular permissions
- `user_roles` - User-role assignments
- `role_permissions` - Role-permission assignments
- `assets` - Base asset table for all asset types
- `audit_log` - Change tracking for all entities

### Hardware Asset Tables (V002)
- `manufacturers` - Normalized manufacturer lookup table
- `models` - Normalized model lookup table with manufacturer reference
- `hardware_assets` - Hardware-specific asset attributes
- `stockrooms` - Physical/logical inventory locations (placeholder)
- `cost_centers` - Financial allocation units (placeholder)
- `vendors` - Vendor/supplier information (placeholder)
- `contracts` - Legal agreements with vendors (placeholder)
- `purchase_orders` - Procurement documents (placeholder)

### Views (V002)
- `v_hardware_assets` - Denormalized hardware asset view
- `v_hardware_summary_by_category` - Dashboard summary by category
- `v_warranty_expiring` - Assets with expiring warranties
- `v_lease_expiring` - Assets with expiring leases

### Functions (V002)
- `normalize_manufacturer()` - Lookup/create normalized manufacturer
- `normalize_model()` - Lookup/create normalized model

## Requirements Traceability

| Migration | Requirements |
|-----------|--------------|
| V001 | 2.1, 2.4, 2.5, 2.7 |
| V002 | 2A.1-2A.9 |
| V003 | 2B.1-2B.9 |
| V004 | 2C.1-2C.9 |
| V005 | 2D.1-2D.9 |
| V006 | 2E.1-2E.9 |
