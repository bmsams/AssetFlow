import { useState, useCallback, useEffect, useMemo } from 'react';
import { FormField } from './FormField';
import { AssetTypeSelector } from './AssetTypeSelector';
import { CustomAttributesEditor } from './CustomAttributesEditor';
import type { CustomAttribute } from './CustomAttributesEditor';
import {
  validateAssetForm,
  validateField,
  getErrorMap,
  getInitialFormData,
  type AssetFormData,
} from './validation';
import { parseApiErrorToFieldErrors } from './error-mapping';
import { useEntityOptions } from '../../hooks/useEntityOptions';
import { adminApi } from '../../services/admin-api';
import type { Building, Department, CostCenter, Stockroom } from '../../types/admin';
import type { AssetType, AssetStatus, AnyAsset } from '../../types/asset';
import styles from './AssetForm.module.css';

export type FormMode = 'create' | 'edit';

export interface AssetFormProps {
  /** Form mode - create or edit */
  mode: FormMode;
  /** Initial asset data for edit mode */
  initialData?: AnyAsset;
  /** Submit handler */
  onSubmit: (data: AssetFormData) => Promise<void>;
  /** Cancel handler */
  onCancel: () => void;
  /** Whether the form is submitting */
  isSubmitting?: boolean;
}

const statusOptions = [
  { value: 'ORDERED', label: 'Ordered' },
  { value: 'RECEIVED', label: 'Received' },
  { value: 'IN_STOCK', label: 'In Stock' },
  { value: 'RESERVED', label: 'Reserved' },
  { value: 'DEPLOYED', label: 'Deployed' },
  { value: 'IN_MAINTENANCE', label: 'In Maintenance' },
  { value: 'RETIRED', label: 'Retired' },
  { value: 'DISPOSED', label: 'Disposed' },
];

const modelCategoryOptions = [
  { value: 'LAPTOP', label: 'Laptop' },
  { value: 'DESKTOP', label: 'Desktop' },
  { value: 'SERVER', label: 'Server' },
  { value: 'NETWORK', label: 'Network Device' },
  { value: 'MOBILE', label: 'Mobile Device' },
  { value: 'PERIPHERAL', label: 'Peripheral' },
  { value: 'OTHER', label: 'Other' },
];

const licenseTypeOptions = [
  { value: 'PERPETUAL', label: 'Perpetual' },
  { value: 'SUBSCRIPTION', label: 'Subscription' },
  { value: 'PER_USER', label: 'Per User' },
  { value: 'PER_DEVICE', label: 'Per Device' },
  { value: 'PER_CORE', label: 'Per Core' },
  { value: 'SITE', label: 'Site License' },
  { value: 'ENTERPRISE', label: 'Enterprise' },
  { value: 'CONCURRENT', label: 'Concurrent' },
];

const criticalityOptions = [
  { value: 'CRITICAL', label: 'Critical' },
  { value: 'HIGH', label: 'High' },
  { value: 'MEDIUM', label: 'Medium' },
  { value: 'LOW', label: 'Low' },
];

const assetClassOptions = [
  { value: 'HVAC', label: 'HVAC' },
  { value: 'ELECTRICAL', label: 'Electrical' },
  { value: 'PLUMBING', label: 'Plumbing' },
  { value: 'MEDICAL', label: 'Medical Equipment' },
  { value: 'MANUFACTURING', label: 'Manufacturing' },
  { value: 'FACILITIES', label: 'Facilities' },
  { value: 'OTHER', label: 'Other' },
];

/**
 * AssetForm component - Dynamic form for creating and editing assets
 * 
 * Implements Requirements:
 * - 2.1: System shall maintain a comprehensive asset registry with unique identifiers
 * - 2.8: System shall support custom attributes per asset type for extensibility
 */
export function AssetForm({
  mode,
  initialData,
  onSubmit,
  onCancel,
  isSubmitting = false,
}: AssetFormProps) {
  const [formData, setFormData] = useState<AssetFormData>(() => {
    if (mode === 'edit' && initialData) {
      return {
        ...getInitialFormData(initialData.assetType),
        ...initialData,
        customAttributes: [],
      };
    }
    return getInitialFormData();
  });

  const [errors, setErrors] = useState<Record<string, string>>({});
  const [touched, setTouched] = useState<Set<string>>(new Set());
  const [submitAttempted, setSubmitAttempted] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  // Fetch department and cost center options from Admin API
  // Validates: Requirements 7.1, 7.2
  const fetchDepartments = useMemo(() => () => adminApi.departments.list(), []);
  const fetchCostCenters = useMemo(() => () => adminApi.costCenters.list(), []);
  const fetchBuildings = useMemo(() => () => adminApi.buildings.list({ isActive: true }), []);
  const fetchStockrooms = useMemo(() => () => adminApi.stockrooms.list({ isActive: true }), []);
  const departmentLabelFn = useCallback((d: Department) => d.name, []);
  const departmentValueFn = useCallback((d: Department) => d.departmentId, []);
  const costCenterLabelFn = useCallback((c: CostCenter) => `${c.code} - ${c.name}`, []);
  const costCenterValueFn = useCallback((c: CostCenter) => c.costCenterId, []);
  const buildingLabelFn = useCallback((b: Building) => `${b.buildingCode} - ${b.name}`, []);
  const buildingValueFn = useCallback((b: Building) => b.buildingId, []);
  const stockroomLabelFn = useCallback((s: Stockroom) => `${s.stockroomCode} - ${s.name}`, []);
  const stockroomValueFn = useCallback((s: Stockroom) => s.stockroomId, []);

  const { options: departmentOptions, isLoading: departmentsLoading } = useEntityOptions<Department>(
    fetchDepartments,
    departmentLabelFn,
    departmentValueFn
  );
  const { options: costCenterOptions, isLoading: costCentersLoading } = useEntityOptions<CostCenter>(
    fetchCostCenters,
    costCenterLabelFn,
    costCenterValueFn
  );
  const { options: buildingOptions, isLoading: buildingsLoading } = useEntityOptions<Building>(
    fetchBuildings,
    buildingLabelFn,
    buildingValueFn
  );
  const { options: stockroomOptions, isLoading: stockroomsLoading } = useEntityOptions<Stockroom>(
    fetchStockrooms,
    stockroomLabelFn,
    stockroomValueFn
  );

  // Update form data when initialData changes (for edit mode)
  useEffect(() => {
    if (mode === 'edit' && initialData) {
      setFormData({
        ...getInitialFormData(initialData.assetType),
        ...initialData,
        customAttributes: [],
      });
    }
  }, [mode, initialData]);

  const handleFieldChange = useCallback(
    (name: string, value: string | number | boolean) => {
      setFormData((prev) => ({
        ...prev,
        [name]: value,
      }));

      // Clear field error when field is modified
      if (errors[name]) {
        setErrors((prev) => {
          const newErrors = { ...prev };
          delete newErrors[name];
          return newErrors;
        });
      }

      // Clear form-level error when user edits any field
      if (formError) {
        setFormError(null);
      }
    },
    [errors, formError]
  );

  const handleFieldBlur = useCallback(
    (name: string) => {
      setTouched((prev) => new Set(prev).add(name));

      // Validate field on blur
      const error = validateField(name, formData[name as keyof AssetFormData], formData);
      if (error) {
        setErrors((prev) => ({ ...prev, [name]: error }));
      }
    },
    [formData]
  );

  const handleAssetTypeChange = useCallback((type: AssetType) => {
    setFormData((prev) => ({
      ...getInitialFormData(type),
      displayName: prev.displayName,
      description: prev.description,
      status: prev.status,
      customAttributes: prev.customAttributes,
    }));
    setErrors({});
    setTouched(new Set());
  }, []);

  const handleCustomAttributesChange = useCallback((attributes: CustomAttribute[]) => {
    setFormData((prev) => ({
      ...prev,
      customAttributes: attributes,
    }));
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitAttempted(true);

    const validation = validateAssetForm(formData);
    if (!validation.isValid) {
      setErrors(getErrorMap(validation.errors));
      // Focus first error field
      const firstError = validation.errors[0];
      if (firstError) {
        const element = document.querySelector(`[name="${firstError.field}"]`);
        if (element instanceof HTMLElement) {
          element.focus();
        }
      }
      return;
    }

    try {
      setFormError(null);
      await onSubmit(formData);
    } catch (error) {
      const { fieldErrors, generalError } = parseApiErrorToFieldErrors(error);

      if (Object.keys(fieldErrors).length > 0) {
        setErrors((prev) => ({ ...prev, ...fieldErrors }));
        // Focus the first field with an error
        const firstField = Object.keys(fieldErrors)[0];
        if (firstField) {
          const element = document.querySelector(`[name="${firstField}"]`);
          if (element instanceof HTMLElement) {
            element.focus();
          }
        }
      }

      if (generalError) {
        setFormError(generalError);
      }
    }
  };

  const getFieldError = (name: string): string | undefined => {
    if (submitAttempted || touched.has(name)) {
      return errors[name];
    }
    return undefined;
  };

  const renderHardwareFields = () => (
    <div className={styles.section}>
      <h3 className={styles.sectionTitle}>Hardware Details</h3>
      <div className={styles.fieldGrid}>
        <FormField
          name="serialNumber"
          label="Serial Number"
          value={formData.serialNumber || ''}
          onChange={handleFieldChange}
          onBlur={handleFieldBlur}
          error={getFieldError('serialNumber')}
          placeholder="Enter serial number"
        />
        <FormField
          name="manufacturer"
          label="Manufacturer"
          value={formData.manufacturer || ''}
          onChange={handleFieldChange}
          onBlur={handleFieldBlur}
          error={getFieldError('manufacturer')}
          placeholder="e.g., Dell, HP, Lenovo"
        />
        <FormField
          name="model"
          label="Model"
          value={formData.model || ''}
          onChange={handleFieldChange}
          onBlur={handleFieldBlur}
          error={getFieldError('model')}
          placeholder="e.g., Latitude 5540"
        />
        <FormField
          name="modelCategory"
          label="Category"
          type="select"
          value={formData.modelCategory || ''}
          onChange={handleFieldChange}
          onBlur={handleFieldBlur}
          error={getFieldError('modelCategory')}
          options={modelCategoryOptions}
        />
      </div>

      <h4 className={styles.subsectionTitle}>Technical Specifications</h4>
      <div className={styles.fieldGrid}>
        <FormField
          name="cpu"
          label="CPU"
          value={formData.cpu || ''}
          onChange={handleFieldChange}
          onBlur={handleFieldBlur}
          error={getFieldError('cpu')}
          placeholder="e.g., Intel Core i7-1365U"
        />
        <FormField
          name="memoryGb"
          label="Memory (GB)"
          type="number"
          value={formData.memoryGb || ''}
          onChange={handleFieldChange}
          onBlur={handleFieldBlur}
          error={getFieldError('memoryGb')}
          min={0}
          placeholder="e.g., 16"
        />
        <FormField
          name="storageGb"
          label="Storage (GB)"
          type="number"
          value={formData.storageGb || ''}
          onChange={handleFieldChange}
          onBlur={handleFieldBlur}
          error={getFieldError('storageGb')}
          min={0}
          placeholder="e.g., 512"
        />
        <FormField
          name="operatingSystem"
          label="Operating System"
          value={formData.operatingSystem || ''}
          onChange={handleFieldChange}
          onBlur={handleFieldBlur}
          error={getFieldError('operatingSystem')}
          placeholder="e.g., Windows 11 Pro"
        />
      </div>

      <h4 className={styles.subsectionTitle}>Network</h4>
      <div className={styles.fieldGrid}>
        <FormField
          name="ipAddress"
          label="IP Address"
          value={formData.ipAddress || ''}
          onChange={handleFieldChange}
          onBlur={handleFieldBlur}
          error={getFieldError('ipAddress')}
          placeholder="e.g., 192.168.1.100"
        />
        <FormField
          name="macAddress"
          label="MAC Address"
          value={formData.macAddress || ''}
          onChange={handleFieldChange}
          onBlur={handleFieldBlur}
          error={getFieldError('macAddress')}
          placeholder="e.g., 00:1A:2B:3C:4D:5E"
        />
      </div>

      <h4 className={styles.subsectionTitle}>Location and Ownership</h4>
      <div className={styles.fieldGrid}>
        <FormField
          name="stockroomId"
          label="Stockroom"
          type="select"
          value={formData.stockroomId || ''}
          onChange={handleFieldChange}
          onBlur={handleFieldBlur}
          error={getFieldError('stockroomId')}
          options={stockroomOptions}
          disabled={stockroomsLoading}
          placeholder={stockroomsLoading ? 'Loading stockrooms...' : 'Select a stockroom'}
        />
        <FormField
          name="buildingId"
          label="Building"
          type="select"
          value={formData.buildingId || ''}
          onChange={handleFieldChange}
          onBlur={handleFieldBlur}
          error={getFieldError('buildingId')}
          options={buildingOptions}
          disabled={buildingsLoading}
          placeholder={buildingsLoading ? 'Loading buildings...' : 'Select a building'}
        />
        <FormField
          name="floor"
          label="Floor"
          value={formData.floor || ''}
          onChange={handleFieldChange}
          onBlur={handleFieldBlur}
          error={getFieldError('floor')}
          placeholder="e.g., 2"
        />
        <FormField
          name="room"
          label="Room"
          value={formData.room || ''}
          onChange={handleFieldChange}
          onBlur={handleFieldBlur}
          error={getFieldError('room')}
          placeholder="e.g., 201"
        />
        <FormField
          name="rack"
          label="Rack"
          value={formData.rack || ''}
          onChange={handleFieldChange}
          onBlur={handleFieldBlur}
          error={getFieldError('rack')}
          placeholder="e.g., A-12"
        />
        <FormField
          name="rackUnit"
          label="Rack Unit"
          type="number"
          value={formData.rackUnit || ''}
          onChange={handleFieldChange}
          onBlur={handleFieldBlur}
          error={getFieldError('rackUnit')}
          min={1}
          placeholder="e.g., 24"
        />
      </div>

      <h4 className={styles.subsectionTitle}>Financial</h4>
      <div className={styles.fieldGrid}>
        <FormField
          name="purchasePrice"
          label="Purchase Price ($)"
          type="number"
          value={formData.purchasePrice || ''}
          onChange={handleFieldChange}
          onBlur={handleFieldBlur}
          error={getFieldError('purchasePrice')}
          min={0}
          step={0.01}
          placeholder="e.g., 1499.99"
        />
        <FormField
          name="warrantyExpiration"
          label="Warranty Expiration"
          type="date"
          value={formData.warrantyExpiration || ''}
          onChange={handleFieldChange}
          onBlur={handleFieldBlur}
          error={getFieldError('warrantyExpiration')}
        />
      </div>
    </div>
  );

  const renderSoftwareFields = () => (
    <div className={styles.section}>
      <h3 className={styles.sectionTitle}>Software Details</h3>
      <div className={styles.fieldGrid}>
        <FormField
          name="publisher"
          label="Publisher"
          value={formData.publisher || ''}
          onChange={handleFieldChange}
          onBlur={handleFieldBlur}
          error={getFieldError('publisher')}
          required
          placeholder="e.g., Microsoft, Adobe"
        />
        <FormField
          name="productName"
          label="Product Name"
          value={formData.productName || ''}
          onChange={handleFieldChange}
          onBlur={handleFieldBlur}
          error={getFieldError('productName')}
          required
          placeholder="e.g., Office 365"
        />
        <FormField
          name="version"
          label="Version"
          value={formData.version || ''}
          onChange={handleFieldChange}
          onBlur={handleFieldBlur}
          error={getFieldError('version')}
          placeholder="e.g., 2024"
        />
        <FormField
          name="edition"
          label="Edition"
          value={formData.edition || ''}
          onChange={handleFieldChange}
          onBlur={handleFieldBlur}
          error={getFieldError('edition')}
          placeholder="e.g., Enterprise, Professional"
        />
        <FormField
          name="licenseType"
          label="License Type"
          type="select"
          value={formData.licenseType || ''}
          onChange={handleFieldChange}
          onBlur={handleFieldBlur}
          error={getFieldError('licenseType')}
          options={licenseTypeOptions}
        />
        <FormField
          name="isSaas"
          label="SaaS Product"
          type="checkbox"
          value={formData.isSaas || false}
          onChange={handleFieldChange}
          onBlur={handleFieldBlur}
          error={getFieldError('isSaas')}
        />
      </div>
    </div>
  );

  const renderEnterpriseFields = () => (
    <div className={styles.section}>
      <h3 className={styles.sectionTitle}>Enterprise Asset Details</h3>
      <div className={styles.fieldGrid}>
        <FormField
          name="serialNumber"
          label="Serial Number"
          value={formData.serialNumber || ''}
          onChange={handleFieldChange}
          onBlur={handleFieldBlur}
          error={getFieldError('serialNumber')}
          placeholder="Enter serial number"
        />
        <FormField
          name="manufacturer"
          label="Manufacturer"
          value={formData.manufacturer || ''}
          onChange={handleFieldChange}
          onBlur={handleFieldBlur}
          error={getFieldError('manufacturer')}
          placeholder="e.g., Carrier, Siemens"
        />
        <FormField
          name="model"
          label="Model"
          value={formData.model || ''}
          onChange={handleFieldChange}
          onBlur={handleFieldBlur}
          error={getFieldError('model')}
          placeholder="Enter model name"
        />
        <FormField
          name="assetClass"
          label="Asset Class"
          type="select"
          value={formData.assetClass || ''}
          onChange={handleFieldChange}
          onBlur={handleFieldBlur}
          error={getFieldError('assetClass')}
          options={assetClassOptions}
        />
        <FormField
          name="criticalityLevel"
          label="Criticality Level"
          type="select"
          value={formData.criticalityLevel || ''}
          onChange={handleFieldChange}
          onBlur={handleFieldBlur}
          error={getFieldError('criticalityLevel')}
          options={criticalityOptions}
        />
      </div>

      <h4 className={styles.subsectionTitle}>Location</h4>
      <div className={styles.fieldGrid}>
        <FormField
          name="facilityId"
          label="Facility ID"
          value={formData.facilityId || ''}
          onChange={handleFieldChange}
          onBlur={handleFieldBlur}
          error={getFieldError('facilityId')}
          placeholder="Facility UUID"
        />
        <FormField
          name="buildingId"
          label="Building"
          type="select"
          value={formData.buildingId || ''}
          onChange={handleFieldChange}
          onBlur={handleFieldBlur}
          error={getFieldError('buildingId')}
          options={buildingOptions}
          disabled={buildingsLoading}
          placeholder={buildingsLoading ? 'Loading buildings...' : 'Select a building'}
        />
        <FormField
          name="floor"
          label="Floor"
          value={formData.floor || ''}
          onChange={handleFieldChange}
          onBlur={handleFieldBlur}
          error={getFieldError('floor')}
          placeholder="e.g., 1"
        />
        <FormField
          name="zone"
          label="Zone"
          value={formData.zone || ''}
          onChange={handleFieldChange}
          onBlur={handleFieldBlur}
          error={getFieldError('zone')}
          placeholder="e.g., North Wing"
        />
      </div>

      <h4 className={styles.subsectionTitle}>Operational Data</h4>
      <div className={styles.fieldGrid}>
        <FormField
          name="operatingHours"
          label="Operating Hours"
          type="number"
          value={formData.operatingHours || ''}
          onChange={handleFieldChange}
          onBlur={handleFieldBlur}
          error={getFieldError('operatingHours')}
          min={0}
          placeholder="Total operating hours"
        />
        <FormField
          name="meterReading"
          label="Meter Reading"
          type="number"
          value={formData.meterReading || ''}
          onChange={handleFieldChange}
          onBlur={handleFieldBlur}
          error={getFieldError('meterReading')}
          min={0}
          step={0.01}
          placeholder="Current meter reading"
        />
      </div>
    </div>
  );

  return (
    <form onSubmit={handleSubmit} className={styles.form} noValidate>
      {/* Header */}
      <div className={styles.header}>
        <h2 className={styles.title}>
          {mode === 'create' ? 'Create New Asset' : 'Edit Asset'}
        </h2>
        <p className={styles.subtitle}>
          {mode === 'create'
            ? 'Fill in the details below to create a new asset'
            : 'Update the asset information below'}
        </p>
      </div>

      {/* Form-level API error */}
      {formError && (
        <div className={styles.formError} role="alert">
          {formError}
        </div>
      )}

      {/* Asset Type Selection (only for create mode) */}
      {mode === 'create' && (
        <AssetTypeSelector
          value={formData.assetType}
          onChange={handleAssetTypeChange}
          disabled={isSubmitting}
          error={getFieldError('assetType')}
        />
      )}

      {/* Common Fields */}
      <div className={styles.section}>
        <h3 className={styles.sectionTitle}>General Information</h3>
        <div className={styles.fieldGrid}>
          <FormField
            name="displayName"
            label="Display Name"
            value={formData.displayName}
            onChange={handleFieldChange}
            onBlur={handleFieldBlur}
            error={getFieldError('displayName')}
            required
            placeholder="Enter a descriptive name"
            autoFocus={mode === 'edit'}
          />
          <FormField
            name="status"
            label="Status"
            type="select"
            value={formData.status}
            onChange={handleFieldChange}
            onBlur={handleFieldBlur}
            error={getFieldError('status')}
            options={statusOptions}
            required
          />
          <FormField
            name="departmentId"
            label="Department"
            type="select"
            value={formData.departmentId || ''}
            onChange={handleFieldChange}
            onBlur={handleFieldBlur}
            error={getFieldError('departmentId')}
            options={departmentOptions}
            disabled={departmentsLoading}
            placeholder={departmentsLoading ? 'Loading departments...' : 'Select a department'}
          />
          <FormField
            name="costCenterId"
            label="Cost Center"
            type="select"
            value={formData.costCenterId || ''}
            onChange={handleFieldChange}
            onBlur={handleFieldBlur}
            error={getFieldError('costCenterId')}
            options={costCenterOptions}
            disabled={costCentersLoading}
            placeholder={costCentersLoading ? 'Loading cost centers...' : 'Select a cost center'}
          />
        </div>
        <FormField
          name="description"
          label="Description"
          type="textarea"
          value={formData.description}
          onChange={handleFieldChange}
          onBlur={handleFieldBlur}
          error={getFieldError('description')}
          placeholder="Enter a detailed description (optional)"
          rows={3}
        />
      </div>

      {/* Type-Specific Fields */}
      {formData.assetType === 'HARDWARE' && renderHardwareFields()}
      {formData.assetType === 'SOFTWARE' && renderSoftwareFields()}
      {formData.assetType === 'ENTERPRISE' && renderEnterpriseFields()}

      {/* Custom Attributes */}
      {formData.assetType && (
        <CustomAttributesEditor
          attributes={formData.customAttributes}
          onChange={handleCustomAttributesChange}
          disabled={isSubmitting}
        />
      )}

      {/* Form Actions */}
      <div className={styles.actions}>
        <button
          type="button"
          onClick={onCancel}
          className={styles.cancelButton}
          disabled={isSubmitting}
        >
          Cancel
        </button>
        <button
          type="submit"
          className={styles.submitButton}
          disabled={isSubmitting || !formData.assetType}
          title={!formData.assetType ? 'Select an asset type above to continue' : undefined}
        >
          {isSubmitting ? (
            <>
              <span className={styles.spinner} aria-hidden="true" />
              {mode === 'create' ? 'Creating...' : 'Saving...'}
            </>
          ) : mode === 'create' ? (
            'Create Asset'
          ) : (
            'Save Changes'
          )}
        </button>
      </div>
    </form>
  );
}

export default AssetForm;
