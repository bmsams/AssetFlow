/**
 * Mock data for the Asset Estate Dashboard
 * Used for development and testing
 */

import type {
  AssetEstateSummary,
  CategoryCount,
  LifecycleDistribution,
  LeaseExpiration,
  ComplianceIndicator,
} from '../../types/dashboard';

/**
 * Mock category counts
 */
export const mockCategoryCounts: CategoryCount[] = [
  {
    category: 'HARDWARE',
    label: 'Hardware Assets',
    count: 2847,
    value: 4250000,
    percentageOfTotal: 58.2,
  },
  {
    category: 'SOFTWARE',
    label: 'Software Licenses',
    count: 1523,
    value: 1850000,
    percentageOfTotal: 31.1,
  },
  {
    category: 'ENTERPRISE',
    label: 'Enterprise Assets',
    count: 524,
    value: 2100000,
    percentageOfTotal: 10.7,
  },
];

/**
 * Mock lifecycle distribution with colors
 */
export const mockLifecycleDistribution: LifecycleDistribution[] = [
  {
    status: 'DEPLOYED',
    label: 'Deployed',
    count: 2156,
    percentage: 44.0,
    color: '#22c55e', // green
  },
  {
    status: 'IN_STOCK',
    label: 'In Stock',
    count: 892,
    percentage: 18.2,
    color: '#3b82f6', // blue
  },
  {
    status: 'ORDERED',
    label: 'Ordered',
    count: 423,
    percentage: 8.6,
    color: '#8b5cf6', // purple
  },
  {
    status: 'RECEIVED',
    label: 'Received',
    count: 287,
    percentage: 5.9,
    color: '#06b6d4', // cyan
  },
  {
    status: 'RESERVED',
    label: 'Reserved',
    count: 356,
    percentage: 7.3,
    color: '#f59e0b', // amber
  },
  {
    status: 'IN_MAINTENANCE',
    label: 'In Maintenance',
    count: 234,
    percentage: 4.8,
    color: '#f97316', // orange
  },
  {
    status: 'RETIRED',
    label: 'Retired',
    count: 412,
    percentage: 8.4,
    color: '#6b7280', // gray
  },
  {
    status: 'DISPOSED',
    label: 'Disposed',
    count: 134,
    percentage: 2.7,
    color: '#ef4444', // red
  },
];

/**
 * Mock lease expirations
 */
export const mockLeaseExpirations: LeaseExpiration[] = [
  {
    assetId: 'asset-001',
    assetTag: 'AMS-HW-20240115-ABC123',
    displayName: 'Dell PowerEdge R750 Server',
    leaseEndDate: '2025-02-15',
    daysUntilExpiration: 18,
    monthlyLeaseCost: 2500,
    severity: 'critical',
  },
  {
    assetId: 'asset-002',
    assetTag: 'AMS-HW-20240220-DEF456',
    displayName: 'HP ProLiant DL380 Gen10',
    leaseEndDate: '2025-02-28',
    daysUntilExpiration: 31,
    monthlyLeaseCost: 1800,
    severity: 'warning',
  },
  {
    assetId: 'asset-003',
    assetTag: 'AMS-HW-20240305-GHI789',
    displayName: 'Cisco Catalyst 9300 Switch',
    leaseEndDate: '2025-03-15',
    daysUntilExpiration: 46,
    monthlyLeaseCost: 950,
    severity: 'warning',
  },
  {
    assetId: 'asset-004',
    assetTag: 'AMS-HW-20240410-JKL012',
    displayName: 'NetApp FAS2750 Storage',
    leaseEndDate: '2025-04-10',
    daysUntilExpiration: 72,
    monthlyLeaseCost: 3200,
    severity: 'info',
  },
  {
    assetId: 'asset-005',
    assetTag: 'AMS-HW-20240512-MNO345',
    displayName: 'Lenovo ThinkSystem SR650',
    leaseEndDate: '2025-05-12',
    daysUntilExpiration: 104,
    monthlyLeaseCost: 1650,
    severity: 'info',
  },
  {
    assetId: 'asset-006',
    assetTag: 'AMS-HW-20240618-PQR678',
    displayName: 'Dell EMC Unity XT 380',
    leaseEndDate: '2025-06-18',
    daysUntilExpiration: 141,
    monthlyLeaseCost: 4100,
    severity: 'info',
  },
];

/**
 * Mock compliance indicators
 */
export const mockComplianceIndicators: ComplianceIndicator[] = [
  {
    id: 'compliance-001',
    name: 'Microsoft Licenses',
    type: 'license',
    status: 'compliant',
    value: 847,
    threshold: 900,
    description: 'Office 365 and Windows licenses within entitlement limits',
    lastChecked: new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString(), // 2 hours ago
  },
  {
    id: 'compliance-002',
    name: 'Oracle Database',
    type: 'license',
    status: 'at_risk',
    value: 48,
    threshold: 50,
    description: 'Database licenses approaching limit, review usage',
    lastChecked: new Date(Date.now() - 4 * 60 * 60 * 1000).toISOString(), // 4 hours ago
  },
  {
    id: 'compliance-003',
    name: 'Hardware Warranties',
    type: 'warranty',
    status: 'non_compliant',
    value: 156,
    threshold: 100,
    description: '156 assets with expired warranties require attention',
    lastChecked: new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString(), // 1 day ago
  },
  {
    id: 'compliance-004',
    name: 'Maintenance Plans',
    type: 'maintenance',
    status: 'compliant',
    value: 234,
    threshold: 300,
    description: 'All scheduled maintenance plans are up to date',
    lastChecked: new Date(Date.now() - 6 * 60 * 60 * 1000).toISOString(), // 6 hours ago
  },
  {
    id: 'compliance-005',
    name: 'Adobe Creative Cloud',
    type: 'license',
    status: 'at_risk',
    value: 95,
    threshold: 100,
    description: 'Creative Cloud licenses at 95% utilization',
    lastChecked: new Date(Date.now() - 1 * 60 * 60 * 1000).toISOString(), // 1 hour ago
  },
  {
    id: 'compliance-006',
    name: 'Annual Audit',
    type: 'audit',
    status: 'compliant',
    value: 4894,
    threshold: 4894,
    description: 'All assets verified in last audit cycle',
    lastChecked: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString(), // 7 days ago
  },
];

/**
 * Complete mock asset estate summary
 */
export const mockAssetEstateSummary: AssetEstateSummary = {
  totalAssetValue: 8200000,
  totalAssetCount: 4894,
  countsByCategory: mockCategoryCounts,
  lifecycleDistribution: mockLifecycleDistribution,
  leaseExpirations: mockLeaseExpirations,
  complianceIndicators: mockComplianceIndicators,
};

/**
 * Helper to simulate API loading delay
 */
export function simulateApiDelay<T>(data: T, delayMs = 1000): Promise<T> {
  return new Promise((resolve) => {
    setTimeout(() => resolve(data), delayMs);
  });
}
