import { useState, useCallback } from 'react';
import type {
  AnyAssetDetail,
  HardwareAssetDetail,
  SoftwareAssetDetail,
  EnterpriseAssetDetail,
} from '../../types/asset';
import styles from './AssetAttributes.module.css';

export interface AssetAttributesProps {
  /** Asset to display attributes for */
  asset: AnyAssetDetail;
  /** Whether inline editing is enabled */
  editMode?: boolean;
  /** Callback when an attribute is updated */
  onAttributeChange?: (fieldName: string, value: string | number | boolean) => void;
  /** Loading state */
  isLoading?: boolean;
}

interface AttributeField {
  key: string;
  label: string;
  value: string | number | boolean | undefined;
  editable?: boolean;
  type?: 'text' | 'number' | 'date' | 'currency' | 'boolean';
}

const formatCurrency = (value: number): string => {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
  }).format(value);
};

const formatDate = (dateString: string): string => {
  return new Date(dateString).toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  });
};

const formatBoolean = (value: boolean): string => {
  return value ? 'Yes' : 'No';
};

const formatValue = (
  value: string | number | boolean | undefined,
  type?: string
): string => {
  if (value === undefined || value === null || value === '') {
    return '—';
  }
  if (type === 'currency' && typeof value === 'number') {
    return formatCurrency(value);
  }
  if (type === 'date' && typeof value === 'string') {
    return formatDate(value);
  }
  if (type === 'boolean' && typeof value === 'boolean') {
    return formatBoolean(value);
  }
  return String(value);
};

/**
 * Get common attributes for all asset types
 */
const getCommonAttributes = (asset: AnyAssetDetail): AttributeField[] => [
  { key: 'assetId', label: 'Asset ID', value: asset.assetId },
  { key: 'assetTag', label: 'Asset Tag', value: asset.assetTag },
  { key: 'displayName', label: 'Display Name', value: asset.displayName, editable: true },
  { key: 'description', label: 'Description', value: asset.description, editable: true },
  { key: 'status', label: 'Status', value: asset.status },
  { key: 'substatus', label: 'Substatus', value: asset.substatus },
  { key: 'createdAt', label: 'Created', value: asset.createdAt, type: 'date' },
  { key: 'updatedAt', label: 'Last Updated', value: asset.updatedAt, type: 'date' },
];

/**
 * Get hardware-specific attributes
 */
const getHardwareAttributes = (asset: HardwareAssetDetail): AttributeField[] => [
  { key: 'serialNumber', label: 'Serial Number', value: asset.serialNumber },
  { key: 'manufacturer', label: 'Manufacturer', value: asset.manufacturer },
  { key: 'model', label: 'Model', value: asset.model },
  { key: 'modelCategory', label: 'Category', value: asset.modelCategory },
  { key: 'assignedToName', label: 'Assigned To', value: asset.assignedToName, editable: true },
  { key: 'departmentName', label: 'Department', value: asset.departmentName },
  { key: 'costCenterName', label: 'Cost Center', value: asset.costCenterName },
  { key: 'purchasePrice', label: 'Purchase Price', value: asset.purchasePrice, type: 'currency' },
  { key: 'warrantyExpiration', label: 'Warranty Expiration', value: asset.warrantyExpiration, type: 'date' },
  { key: 'cpu', label: 'CPU', value: asset.cpu },
  { key: 'memoryGb', label: 'Memory (GB)', value: asset.memoryGb, type: 'number' },
  { key: 'storageGb', label: 'Storage (GB)', value: asset.storageGb, type: 'number' },
  { key: 'operatingSystem', label: 'Operating System', value: asset.operatingSystem },
  { key: 'ipAddress', label: 'IP Address', value: asset.ipAddress },
  { key: 'macAddress', label: 'MAC Address', value: asset.macAddress },
  { key: 'stockroomName', label: 'Stockroom', value: asset.stockroomName },
  { key: 'vendorName', label: 'Vendor', value: asset.vendorName },
  { key: 'leaseContractNumber', label: 'Lease Contract', value: asset.leaseContractNumber },
];

/**
 * Get software-specific attributes
 */
const getSoftwareAttributes = (asset: SoftwareAssetDetail): AttributeField[] => [
  { key: 'publisher', label: 'Publisher', value: asset.publisher },
  { key: 'productName', label: 'Product Name', value: asset.productName },
  { key: 'version', label: 'Version', value: asset.version },
  { key: 'edition', label: 'Edition', value: asset.edition },
  { key: 'licenseType', label: 'License Type', value: asset.licenseType },
  { key: 'isSaas', label: 'SaaS', value: asset.isSaas, type: 'boolean' },
  { key: 'entitlementCount', label: 'Entitlements', value: asset.entitlementCount, type: 'number' },
  { key: 'installationCount', label: 'Installations', value: asset.installationCount, type: 'number' },
  { key: 'complianceStatus', label: 'Compliance Status', value: asset.complianceStatus },
];

/**
 * Get enterprise-specific attributes
 */
const getEnterpriseAttributes = (asset: EnterpriseAssetDetail): AttributeField[] => [
  { key: 'serialNumber', label: 'Serial Number', value: asset.serialNumber },
  { key: 'manufacturer', label: 'Manufacturer', value: asset.manufacturer },
  { key: 'model', label: 'Model', value: asset.model },
  { key: 'assetClass', label: 'Asset Class', value: asset.assetClass },
  { key: 'criticalityLevel', label: 'Criticality', value: asset.criticalityLevel },
  { key: 'facilityName', label: 'Facility', value: asset.facilityName },
  { key: 'operatingHours', label: 'Operating Hours', value: asset.operatingHours, type: 'number' },
  { key: 'meterReading', label: 'Meter Reading', value: asset.meterReading, type: 'number' },
  { key: 'lastMaintenanceDate', label: 'Last Maintenance', value: asset.lastMaintenanceDate, type: 'date' },
  { key: 'nextMaintenanceDate', label: 'Next Maintenance', value: asset.nextMaintenanceDate, type: 'date' },
  { key: 'maintenancePlanName', label: 'Maintenance Plan', value: asset.maintenancePlanName },
];

/**
 * AssetAttributes component displays asset attributes organized by category
 * Supports inline editing for editable fields
 * 
 * Implements Requirements:
 * - 2.1: Display all asset attributes by type
 */
export function AssetAttributes({
  asset,
  editMode = false,
  onAttributeChange,
  isLoading = false,
}: AssetAttributesProps) {
  const [editingField, setEditingField] = useState<string | null>(null);
  const [editValue, setEditValue] = useState<string>('');

  const handleStartEdit = useCallback((field: AttributeField) => {
    if (!editMode || !field.editable) return;
    setEditingField(field.key);
    setEditValue(String(field.value ?? ''));
  }, [editMode]);

  const handleSaveEdit = useCallback(() => {
    if (editingField && onAttributeChange) {
      onAttributeChange(editingField, editValue);
    }
    setEditingField(null);
    setEditValue('');
  }, [editingField, editValue, onAttributeChange]);

  const handleCancelEdit = useCallback(() => {
    setEditingField(null);
    setEditValue('');
  }, []);

  const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      handleSaveEdit();
    } else if (e.key === 'Escape') {
      handleCancelEdit();
    }
  }, [handleSaveEdit, handleCancelEdit]);

  // Get type-specific attributes
  const getTypeSpecificAttributes = (): AttributeField[] => {
    switch (asset.assetType) {
      case 'HARDWARE':
        return getHardwareAttributes(asset as HardwareAssetDetail);
      case 'SOFTWARE':
        return getSoftwareAttributes(asset as SoftwareAssetDetail);
      case 'ENTERPRISE':
        return getEnterpriseAttributes(asset as EnterpriseAssetDetail);
      default:
        return [];
    }
  };

  const commonAttributes = getCommonAttributes(asset);
  const typeSpecificAttributes = getTypeSpecificAttributes();

  const renderAttributeValue = (field: AttributeField) => {
    if (editingField === field.key) {
      return (
        <div className={styles.editContainer}>
          <input
            type="text"
            value={editValue}
            onChange={(e) => setEditValue(e.target.value)}
            onKeyDown={handleKeyDown}
            className={styles.editInput}
            autoFocus
            aria-label={`Edit ${field.label}`}
          />
          <div className={styles.editActions}>
            <button
              type="button"
              onClick={handleSaveEdit}
              className={styles.saveButton}
              aria-label="Save"
            >
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
                <polyline points="20 6 9 17 4 12" />
              </svg>
            </button>
            <button
              type="button"
              onClick={handleCancelEdit}
              className={styles.cancelButton}
              aria-label="Cancel"
            >
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
                <line x1="18" y1="6" x2="6" y2="18" />
                <line x1="6" y1="6" x2="18" y2="18" />
              </svg>
            </button>
          </div>
        </div>
      );
    }

    const formattedValue = formatValue(field.value, field.type);
    const isEditable = editMode && field.editable;

    return (
      <span
        className={`${styles.value} ${isEditable ? styles.editable : ''}`}
        onClick={() => isEditable && handleStartEdit(field)}
        onKeyDown={(e) => e.key === 'Enter' && isEditable && handleStartEdit(field)}
        tabIndex={isEditable ? 0 : undefined}
        role={isEditable ? 'button' : undefined}
        aria-label={isEditable ? `Edit ${field.label}` : undefined}
      >
        {formattedValue}
        {isEditable && (
          <svg className={styles.editIcon} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
            <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" />
            <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" />
          </svg>
        )}
      </span>
    );
  };

  const renderAttributeRow = (field: AttributeField) => (
    <div key={field.key} className={styles.attributeRow}>
      <dt className={styles.label}>{field.label}</dt>
      <dd className={styles.valueContainer}>
        {renderAttributeValue(field)}
      </dd>
    </div>
  );

  if (isLoading) {
    return (
      <div className={styles.attributesContainer} aria-busy="true">
        <div className={styles.section}>
          <div className={styles.skeletonSectionTitle} />
          <div className={styles.attributeGrid}>
            {[1, 2, 3, 4, 5, 6].map((i) => (
              <div key={i} className={styles.attributeRow}>
                <div className={styles.skeletonLabel} />
                <div className={styles.skeletonValue} />
              </div>
            ))}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className={styles.attributesContainer}>
      {/* General Information */}
      <section className={styles.section}>
        <h3 className={styles.sectionTitle}>General Information</h3>
        <dl className={styles.attributeGrid}>
          {commonAttributes.map(renderAttributeRow)}
        </dl>
      </section>

      {/* Type-Specific Information */}
      <section className={styles.section}>
        <h3 className={styles.sectionTitle}>
          {asset.assetType === 'HARDWARE' && 'Hardware Details'}
          {asset.assetType === 'SOFTWARE' && 'Software Details'}
          {asset.assetType === 'ENTERPRISE' && 'Enterprise Details'}
        </h3>
        <dl className={styles.attributeGrid}>
          {typeSpecificAttributes.map(renderAttributeRow)}
        </dl>
      </section>
    </div>
  );
}

export default AssetAttributes;
