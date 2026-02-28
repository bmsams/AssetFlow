/**
 * Contract Seed Data
 * Validates: Requirement 3.9 - At least 5 contracts with different types
 */

import type { SeedContract } from './types';

export const CONTRACTS: SeedContract[] = [
  { contractNumber: 'CTR-2024-001', contractName: 'Dell Hardware Lease Agreement', vendorCode: 'DELL', contractType: 'LEASE', totalValue: 250000, startDate: '2024-01-01', endDate: '2026-12-31', status: 'ACTIVE' },
  { contractNumber: 'CTR-2024-002', contractName: 'Microsoft Enterprise Agreement', vendorCode: 'MSFT', contractType: 'LICENSE', totalValue: 180000, startDate: '2024-01-01', endDate: '2024-12-31', status: 'ACTIVE' },
  { contractNumber: 'CTR-2024-003', contractName: 'TechServe IT Support Contract', vendorCode: 'TECHSERVE', contractType: 'SUPPORT', totalValue: 120000, startDate: '2024-01-01', endDate: '2024-12-31', status: 'ACTIVE' },
  { contractNumber: 'CTR-2024-004', contractName: 'Cisco Network Maintenance', vendorCode: 'CISCO', contractType: 'MAINTENANCE', totalValue: 45000, startDate: '2024-01-01', endDate: '2024-12-31', status: 'ACTIVE' },
  { contractNumber: 'CTR-2024-005', contractName: 'HP Printer Warranty Extension', vendorCode: 'HP', contractType: 'WARRANTY', totalValue: 15000, startDate: '2024-01-01', endDate: '2025-12-31', status: 'ACTIVE' },
  { contractNumber: 'CTR-2023-010', contractName: 'CDW Hardware Purchase Agreement', vendorCode: 'CDW', contractType: 'PURCHASE', totalValue: 500000, startDate: '2023-01-01', endDate: '2023-12-31', status: 'EXPIRED' },
  { contractNumber: 'CTR-2024-006', contractName: 'SHI Software Reseller Agreement', vendorCode: 'SHI', contractType: 'LICENSE', totalValue: 75000, startDate: '2024-03-01', endDate: '2025-02-28', status: 'ACTIVE' },
];
