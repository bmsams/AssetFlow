/**
 * Stockroom Seed Data
 * Validates: Requirement 3.3 - At least 3 stockrooms
 */

import type { SeedStockroom } from './types';

export const STOCKROOMS: SeedStockroom[] = [
  { name: 'Main Warehouse', location: 'Building A, Floor 1', stockroomType: 'MAIN', stockroomCode: 'MAIN-WH' },
  { name: 'IT Closet', location: 'Building B, Floor 2', stockroomType: 'SATELLITE', stockroomCode: 'IT-CLOSET' },
  { name: 'Remote Office', location: 'Remote Site 1', stockroomType: 'SATELLITE', stockroomCode: 'REMOTE-1' },
  { name: 'Repair Center', location: 'Building A, Floor B1', stockroomType: 'REPAIR', stockroomCode: 'REPAIR-CTR' },
  { name: 'Disposal Staging', location: 'Building C, Dock', stockroomType: 'DISPOSAL', stockroomCode: 'DISPOSAL' },
];
