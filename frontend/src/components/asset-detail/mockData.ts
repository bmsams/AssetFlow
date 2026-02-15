/**
 * Mock data for Asset Detail View
 * Used for development and testing
 */

import type {
  HardwareAssetDetail,
  SoftwareAssetDetail,
  EnterpriseAssetDetail,
  AnyAssetDetail,
  RelatedAsset,
  AuditEntry,
  AssetAttachment,
} from '../../types/asset';

/**
 * Generate mock audit history for an asset
 */
const generateMockAuditHistory = (assetId: string): AuditEntry[] => {
  const actions: Array<{
    action: AuditEntry['action'];
    fieldName?: string;
    previousValue?: string;
    newValue?: string;
    description: string;
  }> = [
    {
      action: 'CREATE',
      description: 'Asset created',
    },
    {
      action: 'UPDATE',
      fieldName: 'description',
      previousValue: 'Initial description',
      newValue: 'Updated description with more details',
      description: 'Description updated',
    },
    {
      action: 'STATUS_CHANGE',
      fieldName: 'status',
      previousValue: 'ORDERED',
      newValue: 'RECEIVED',
      description: 'Status changed from Ordered to Received',
    },
    {
      action: 'STATUS_CHANGE',
      fieldName: 'status',
      previousValue: 'RECEIVED',
      newValue: 'IN_STOCK',
      description: 'Status changed from Received to In Stock',
    },
    {
      action: 'ASSIGNMENT',
      fieldName: 'assignedTo',
      previousValue: undefined,
      newValue: 'John Smith',
      description: 'Asset assigned to John Smith',
    },
    {
      action: 'STATUS_CHANGE',
      fieldName: 'status',
      previousValue: 'IN_STOCK',
      newValue: 'DEPLOYED',
      description: 'Status changed from In Stock to Deployed',
    },
    {
      action: 'UPDATE',
      fieldName: 'location',
      previousValue: 'Stockroom A',
      newValue: 'Building B, Floor 3, Room 301',
      description: 'Location updated',
    },
    {
      action: 'RELATIONSHIP',
      description: 'Linked to parent asset AMS-HW-20240101-0001',
    },
  ];

  const users = [
    { id: 'user-001', name: 'John Smith' },
    { id: 'user-002', name: 'Jane Doe' },
    { id: 'user-003', name: 'Bob Johnson' },
    { id: 'user-004', name: 'Alice Williams' },
  ];

  const baseDate = new Date();
  baseDate.setMonth(baseDate.getMonth() - 6);

  return actions.map((action, index) => {
    const date = new Date(baseDate);
    date.setDate(date.getDate() + index * 7);
    const user = users[index % users.length];

    return {
      auditId: `audit-${assetId}-${String(index + 1).padStart(3, '0')}`,
      assetId,
      action: action.action,
      timestamp: date.toISOString(),
      userId: user.id,
      userName: user.name,
      fieldName: action.fieldName,
      previousValue: action.previousValue,
      newValue: action.newValue,
      description: action.description,
    };
  }).reverse(); // Most recent first
};

/**
 * Generate mock attachments for an asset
 */
const generateMockAttachments = (assetId: string): AssetAttachment[] => {
  const attachments = [
    {
      fileName: 'purchase_invoice.pdf',
      fileType: 'application/pdf',
      fileSize: 245000,
      description: 'Original purchase invoice',
    },
    {
      fileName: 'warranty_certificate.pdf',
      fileType: 'application/pdf',
      fileSize: 128000,
      description: 'Warranty certificate from manufacturer',
    },
    {
      fileName: 'asset_photo.jpg',
      fileType: 'image/jpeg',
      fileSize: 1250000,
      description: 'Photo of asset at deployment',
    },
    {
      fileName: 'configuration_guide.docx',
      fileType: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      fileSize: 89000,
      description: 'Configuration and setup guide',
    },
  ];

  const baseDate = new Date();
  baseDate.setMonth(baseDate.getMonth() - 3);

  return attachments.map((attachment, index) => {
    const date = new Date(baseDate);
    date.setDate(date.getDate() + index * 5);

    return {
      attachmentId: `attachment-${assetId}-${String(index + 1).padStart(3, '0')}`,
      assetId,
      fileName: attachment.fileName,
      fileType: attachment.fileType,
      fileSize: attachment.fileSize,
      uploadedAt: date.toISOString(),
      uploadedBy: 'John Smith',
      description: attachment.description,
      url: `https://example.com/attachments/${assetId}/${attachment.fileName}`,
    };
  });
};

/**
 * Generate mock related assets
 */
const generateMockRelationships = (assetId: string, assetType: string): RelatedAsset[] => {
  const relationships: RelatedAsset[] = [];

  if (assetType === 'HARDWARE') {
    // Parent asset (e.g., rack for a server)
    relationships.push({
      asset: {
        assetId: 'asset-parent-001',
        assetTag: 'AMS-HW-20240101-0001',
        assetType: 'HARDWARE',
        displayName: 'Server Rack A-01',
        status: 'DEPLOYED',
        createdAt: '2024-01-01T00:00:00Z',
        updatedAt: '2024-01-15T00:00:00Z',
      },
      relationship: {
        relationshipId: `rel-${assetId}-001`,
        sourceAssetId: 'asset-parent-001',
        targetAssetId: assetId,
        relationshipType: 'PARENT_CHILD',
        description: 'Installed in rack',
        createdAt: '2024-02-01T00:00:00Z',
        createdBy: 'user-001',
      },
      direction: 'target',
    });

    // Dependent software
    relationships.push({
      asset: {
        assetId: 'asset-sw-001',
        assetTag: 'AMS-SW-20240201-0001',
        assetType: 'SOFTWARE',
        displayName: 'Microsoft Office 365 E3',
        status: 'DEPLOYED',
        createdAt: '2024-02-01T00:00:00Z',
        updatedAt: '2024-02-15T00:00:00Z',
      },
      relationship: {
        relationshipId: `rel-${assetId}-002`,
        sourceAssetId: assetId,
        targetAssetId: 'asset-sw-001',
        relationshipType: 'DEPENDENCY',
        description: 'Software installed on this hardware',
        createdAt: '2024-02-15T00:00:00Z',
        createdBy: 'user-002',
      },
      direction: 'source',
    });

    // Component
    relationships.push({
      asset: {
        assetId: 'asset-comp-001',
        assetTag: 'AMS-HW-20240115-0002',
        assetType: 'HARDWARE',
        displayName: 'Samsung 1TB NVMe SSD',
        status: 'DEPLOYED',
        createdAt: '2024-01-15T00:00:00Z',
        updatedAt: '2024-01-20T00:00:00Z',
      },
      relationship: {
        relationshipId: `rel-${assetId}-003`,
        sourceAssetId: assetId,
        targetAssetId: 'asset-comp-001',
        relationshipType: 'COMPONENT',
        description: 'Storage component',
        createdAt: '2024-01-20T00:00:00Z',
        createdBy: 'user-001',
      },
      direction: 'source',
    });
  } else if (assetType === 'SOFTWARE') {
    // Hardware dependency
    relationships.push({
      asset: {
        assetId: 'asset-hw-001',
        assetTag: 'AMS-HW-20240101-0003',
        assetType: 'HARDWARE',
        displayName: 'Dell Latitude 5540 Laptop',
        status: 'DEPLOYED',
        createdAt: '2024-01-01T00:00:00Z',
        updatedAt: '2024-01-15T00:00:00Z',
      },
      relationship: {
        relationshipId: `rel-${assetId}-001`,
        sourceAssetId: 'asset-hw-001',
        targetAssetId: assetId,
        relationshipType: 'DEPENDENCY',
        description: 'Installed on hardware',
        createdAt: '2024-02-01T00:00:00Z',
        createdBy: 'user-001',
      },
      direction: 'target',
    });
  } else if (assetType === 'ENTERPRISE') {
    // Location relationship
    relationships.push({
      asset: {
        assetId: 'asset-loc-001',
        assetTag: 'AMS-EN-20240101-0001',
        assetType: 'ENTERPRISE',
        displayName: 'Building A - Data Center',
        status: 'DEPLOYED',
        createdAt: '2024-01-01T00:00:00Z',
        updatedAt: '2024-01-15T00:00:00Z',
      },
      relationship: {
        relationshipId: `rel-${assetId}-001`,
        sourceAssetId: 'asset-loc-001',
        targetAssetId: assetId,
        relationshipType: 'LOCATION',
        description: 'Located in facility',
        createdAt: '2024-02-01T00:00:00Z',
        createdBy: 'user-001',
      },
      direction: 'target',
    });
  }

  return relationships;
};

/**
 * Mock hardware asset detail
 */
export const mockHardwareAssetDetail: HardwareAssetDetail = {
  assetId: 'asset-0001',
  assetTag: 'AMS-HW-20240115-0001',
  assetType: 'HARDWARE',
  displayName: 'Dell Latitude 5540 Laptop',
  description: 'Dell Latitude 5540 business laptop with Intel Core i7 processor, 16GB RAM, and 512GB SSD. Assigned to Engineering department.',
  status: 'DEPLOYED',
  substatus: 'Active',
  createdAt: '2024-01-15T10:30:00Z',
  updatedAt: '2024-06-20T14:45:00Z',
  createdBy: 'user-001',
  updatedBy: 'user-002',
  // Hardware-specific fields
  serialNumber: 'DELL-5540-ABC123XYZ',
  manufacturer: 'Dell',
  model: 'Latitude 5540',
  modelCategory: 'Laptop',
  assignedTo: 'user-003',
  assignedToName: 'John Smith',
  departmentId: 'dept-001',
  departmentName: 'Engineering',
  costCenterId: 'cc-001',
  costCenterName: 'IT Operations',
  purchasePrice: 1499.99,
  warrantyExpiration: '2027-01-15',
  cpu: 'Intel Core i7-1365U',
  memoryGb: 16,
  storageGb: 512,
  operatingSystem: 'Windows 11 Pro',
  ipAddress: '192.168.1.105',
  macAddress: '00:1A:2B:3C:4D:5E',
  stockroomName: 'Main IT Stockroom',
  vendorName: 'CDW Corporation',
  leaseContractNumber: 'LEASE-2024-001',
  relationships: generateMockRelationships('asset-0001', 'HARDWARE'),
  auditHistory: generateMockAuditHistory('asset-0001'),
  attachments: generateMockAttachments('asset-0001'),
};

/**
 * Mock software asset detail
 */
export const mockSoftwareAssetDetail: SoftwareAssetDetail = {
  assetId: 'asset-0002',
  assetTag: 'AMS-SW-20240201-0001',
  assetType: 'SOFTWARE',
  displayName: 'Microsoft Office 365 E3',
  description: 'Microsoft Office 365 E3 subscription license for enterprise productivity suite including Word, Excel, PowerPoint, Outlook, and Teams.',
  status: 'DEPLOYED',
  createdAt: '2024-02-01T09:00:00Z',
  updatedAt: '2024-06-15T11:30:00Z',
  createdBy: 'user-001',
  updatedBy: 'user-001',
  // Software-specific fields
  publisher: 'Microsoft',
  productName: 'Office 365',
  version: 'E3',
  edition: 'Enterprise',
  licenseType: 'Subscription',
  isSaas: true,
  entitlementCount: 500,
  installationCount: 423,
  complianceStatus: 'COMPLIANT',
  relationships: generateMockRelationships('asset-0002', 'SOFTWARE'),
  auditHistory: generateMockAuditHistory('asset-0002'),
  attachments: generateMockAttachments('asset-0002'),
};

/**
 * Mock enterprise asset detail
 */
export const mockEnterpriseAssetDetail: EnterpriseAssetDetail = {
  assetId: 'asset-0003',
  assetTag: 'AMS-EN-20240301-0001',
  assetType: 'ENTERPRISE',
  displayName: 'HVAC Unit - Building A',
  description: 'Carrier commercial HVAC unit serving Building A floors 1-5. Includes heating, ventilation, and air conditioning capabilities.',
  status: 'DEPLOYED',
  createdAt: '2024-03-01T08:00:00Z',
  updatedAt: '2024-06-10T16:00:00Z',
  createdBy: 'user-004',
  updatedBy: 'user-004',
  // Enterprise-specific fields
  serialNumber: 'CARRIER-HVAC-2024-001',
  manufacturer: 'Carrier',
  model: 'WeatherExpert 50XC',
  assetClass: 'HVAC',
  criticalityLevel: 'HIGH',
  facilityId: 'facility-001',
  facilityName: 'Corporate Headquarters',
  operatingHours: 8760,
  meterReading: 15420,
  lastMaintenanceDate: '2024-05-15',
  nextMaintenanceDate: '2024-08-15',
  maintenancePlanName: 'Quarterly HVAC Maintenance',
  relationships: generateMockRelationships('asset-0003', 'ENTERPRISE'),
  auditHistory: generateMockAuditHistory('asset-0003'),
  attachments: generateMockAttachments('asset-0003'),
};

/**
 * Get mock asset detail by ID
 */
export function getMockAssetDetail(assetId: string): AnyAssetDetail | null {
  const assets: Record<string, AnyAssetDetail> = {
    'asset-0001': mockHardwareAssetDetail,
    'asset-0002': mockSoftwareAssetDetail,
    'asset-0003': mockEnterpriseAssetDetail,
  };

  return assets[assetId] || null;
}

/**
 * Simulate API delay for mock data
 */
export function simulateApiDelay<T>(data: T, delayMs = 500): Promise<T> {
  return new Promise((resolve) => {
    setTimeout(() => resolve(data), delayMs);
  });
}
