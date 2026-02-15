/**
 * Mock data for Asset List View
 * Used for development and testing
 */

import type { Asset, AssetType, AssetStatus } from '../../types/asset';

export interface AssetListSummary {
  totalAssets: number;
  totalValue: number;
  byType: Record<AssetType, number>;
  byStatus: Record<AssetStatus, number>;
  assets: Asset[];
}

// Generate mock assets
const generateMockAssets = (): Asset[] => {
  const types: AssetType[] = ['HARDWARE', 'SOFTWARE', 'ENTERPRISE'];
  const statuses: AssetStatus[] = [
    'ORDERED',
    'RECEIVED',
    'IN_STOCK',
    'RESERVED',
    'DEPLOYED',
    'IN_MAINTENANCE',
    'RETIRED',
    'DISPOSED',
  ];

  const hardwareNames = [
    'Dell Latitude 5540 Laptop',
    'HP EliteBook 840 G9',
    'Lenovo ThinkPad X1 Carbon',
    'MacBook Pro 14"',
    'Dell OptiPlex 7090',
    'HP ProDesk 400 G7',
    'Cisco Catalyst 9200',
    'Dell PowerEdge R750',
    'HP ProLiant DL380',
    'Lenovo ThinkStation P350',
  ];

  const softwareNames = [
    'Microsoft Office 365 E3',
    'Adobe Creative Cloud',
    'Salesforce Enterprise',
    'Slack Business+',
    'Zoom Enterprise',
    'AutoCAD 2024',
    'Visual Studio Enterprise',
    'Jira Software Cloud',
    'Confluence Cloud',
    'ServiceNow ITSM',
  ];

  const enterpriseNames = [
    'HVAC Unit - Building A',
    'Generator - Data Center',
    'UPS System - Server Room',
    'Fire Suppression System',
    'Security Camera System',
    'Access Control Panel',
    'Elevator - Building B',
    'Chiller Unit - Facility',
    'Solar Panel Array',
    'Backup Power System',
  ];

  const assets: Asset[] = [];

  // Generate 50 mock assets
  for (let i = 1; i <= 50; i++) {
    const type = types[i % 3];
    const status = statuses[Math.floor(Math.random() * statuses.length)];
    const names =
      type === 'HARDWARE'
        ? hardwareNames
        : type === 'SOFTWARE'
          ? softwareNames
          : enterpriseNames;
    const name = names[i % names.length];

    const createdDate = new Date();
    createdDate.setDate(createdDate.getDate() - Math.floor(Math.random() * 365));

    const updatedDate = new Date(createdDate);
    updatedDate.setDate(updatedDate.getDate() + Math.floor(Math.random() * 30));

    assets.push({
      assetId: `asset-${String(i).padStart(4, '0')}`,
      assetTag: `AMS-${type.substring(0, 2)}-${createdDate.toISOString().slice(0, 10).replace(/-/g, '')}-${String(i).padStart(4, '0')}`,
      assetType: type,
      displayName: name,
      description: `${name} - Asset #${i}`,
      status,
      createdAt: createdDate.toISOString(),
      updatedAt: updatedDate.toISOString(),
      createdBy: 'user-001',
      updatedBy: 'user-001',
    });
  }

  return assets;
};

export const mockAssets = generateMockAssets();

export const mockAssetListSummary: AssetListSummary = {
  totalAssets: mockAssets.length,
  totalValue: 2450000,
  byType: {
    HARDWARE: mockAssets.filter((a) => a.assetType === 'HARDWARE').length,
    SOFTWARE: mockAssets.filter((a) => a.assetType === 'SOFTWARE').length,
    ENTERPRISE: mockAssets.filter((a) => a.assetType === 'ENTERPRISE').length,
  },
  byStatus: {
    ORDERED: mockAssets.filter((a) => a.status === 'ORDERED').length,
    RECEIVED: mockAssets.filter((a) => a.status === 'RECEIVED').length,
    IN_STOCK: mockAssets.filter((a) => a.status === 'IN_STOCK').length,
    RESERVED: mockAssets.filter((a) => a.status === 'RESERVED').length,
    DEPLOYED: mockAssets.filter((a) => a.status === 'DEPLOYED').length,
    IN_MAINTENANCE: mockAssets.filter((a) => a.status === 'IN_MAINTENANCE').length,
    RETIRED: mockAssets.filter((a) => a.status === 'RETIRED').length,
    DISPOSED: mockAssets.filter((a) => a.status === 'DISPOSED').length,
  },
  assets: mockAssets,
};

/**
 * Simulate API delay for mock data
 */
export function simulateApiDelay<T>(data: T, delayMs = 500): Promise<T> {
  return new Promise((resolve) => {
    setTimeout(() => resolve(data), delayMs);
  });
}
