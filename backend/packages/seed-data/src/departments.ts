/**
 * Department Seed Data
 * Validates: Requirement 3.1 - At least 5 departments with realistic names
 */

import type { SeedDepartment } from './types';

export const DEPARTMENTS: SeedDepartment[] = [
  { name: 'Information Technology', code: 'IT' },
  { name: 'Finance', code: 'FIN' },
  { name: 'Human Resources', code: 'HR' },
  { name: 'Operations', code: 'OPS' },
  { name: 'Engineering', code: 'ENG' },
  { name: 'Sales', code: 'SALES' },
  { name: 'Marketing', code: 'MKT' },
  { name: 'Legal', code: 'LEGAL' },
];
