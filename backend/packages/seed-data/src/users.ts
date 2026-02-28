/**
 * User Seed Data
 * Validates: Requirement 3.2 - At least 10 users with different roles
 */

import type { SeedUser } from './types';

export const USERS: SeedUser[] = [
  { email: 'admin@example.com', firstName: 'System', lastName: 'Administrator', departmentCode: 'IT', role: 'SYSTEM_ADMIN' },
  { email: 'asset.manager@example.com', firstName: 'Alice', lastName: 'Manager', departmentCode: 'IT', role: 'ASSET_MANAGER' },
  { email: 'inventory.manager@example.com', firstName: 'Bob', lastName: 'Inventory', departmentCode: 'OPS', role: 'INVENTORY_MANAGER' },
  { email: 'procurement@example.com', firstName: 'Carol', lastName: 'Procurement', departmentCode: 'FIN', role: 'PROCUREMENT_MANAGER' },
  { email: 'license.analyst@example.com', firstName: 'David', lastName: 'License', departmentCode: 'IT', role: 'LICENSE_ANALYST' },
  { email: 'technician@example.com', firstName: 'Eve', lastName: 'Technician', departmentCode: 'OPS', role: 'MAINTENANCE_TECHNICIAN' },
  { email: 'auditor@example.com', firstName: 'Frank', lastName: 'Auditor', departmentCode: 'FIN', role: 'AUDITOR' },
  { email: 'viewer@example.com', firstName: 'Grace', lastName: 'Viewer', departmentCode: 'HR', role: 'VIEWER' },
  { email: 'engineer1@example.com', firstName: 'Henry', lastName: 'Engineer', departmentCode: 'ENG', role: 'VIEWER' },
  { email: 'engineer2@example.com', firstName: 'Ivy', lastName: 'Developer', departmentCode: 'ENG', role: 'VIEWER' },
  { email: 'sales.rep@example.com', firstName: 'Jack', lastName: 'Sales', departmentCode: 'SALES', role: 'VIEWER' },
  { email: 'marketing@example.com', firstName: 'Kate', lastName: 'Marketing', departmentCode: 'MKT', role: 'VIEWER' },
];
