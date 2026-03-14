import { useState, useEffect, useCallback, useMemo } from 'react';
import { useNavigate, useParams, Link } from 'react-router-dom';
import { Form } from '@ams/ui';
import {
  procurementApi,
  type CreatePurchaseOrderRequest,
  type CreatePOLineRequest,
  type CostCenterSummary,
  type PurchaseOrderDetail,
} from '../../services/procurement-api';
import { adminApi } from '../../services/admin-api';
import type { Vendor, Model, VendorModelPrice } from '../../types/admin';
import { useEntityOptions } from '../../hooks/useEntityOptions';
import { formatCurrency } from '../../utils/formatters';
import { PRODUCT_TYPE_OPTIONS } from '../../constants/procurement';
import styles from '../admin/AdminPage.module.css';

type LineItemDraft = CreatePOLineRequest & {
  vendorName?: string;
};

/**
 * Empty line item template
 */
const createEmptyLine = (defaultVendorId = '', defaultCostCenterId = ''): LineItemDraft => ({
  productType: 'HARDWARE_MODEL',
  productDescription: '',
  sku: '',
  quantity: 1,
  unitPrice: 0,
  notes: '',
  vendorId: defaultVendorId,
  costCenterId: defaultCostCenterId,
});

/**
 * Purchase Order Form Component
 * Implements Task 17.1.2: Create PurchaseOrderForm.tsx for create/edit
 *
 * Requirements from spec (Requirement 16):
 * - Create purchase order with vendor, cost center, and line items
 * - Add/update/remove line items with product details, quantities, and unit prices
 * - Calculate totals automatically
 * - Support draft mode for editing before submission
 */
export function PurchaseOrderForm() {
  const navigate = useNavigate();
  const { poId } = useParams<{ poId: string }>();
  const isEditing = poId && poId !== 'new';

  // Loading states
  const [isLoading, setIsLoading] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [isLoadingDropdowns, setIsLoadingDropdowns] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Vendor dropdown via useEntityOptions (Validates: Requirement 7.3)
  const fetchVendors = useMemo(() => () => adminApi.vendors.list({ isActive: true }, { pageSize: 100 }), []);
  const vendorLabelFn = useCallback((v: Vendor) => v.vendorCode ? `${v.vendorName} (${v.vendorCode})` : v.vendorName, []);
  const vendorValueFn = useCallback((v: Vendor) => v.vendorId, []);
  const { options: vendorOptions, isLoading: vendorsLoading } = useEntityOptions<Vendor>(
    fetchVendors,
    vendorLabelFn,
    vendorValueFn
  );

  // Cost center dropdown data (kept via procurementApi for budget info)
  const [costCenters, setCostCenters] = useState<CostCenterSummary[]>([]);
  const [models, setModels] = useState<Model[]>([]);
  const [vendorModelPricesByModelId, setVendorModelPricesByModelId] = useState<Record<string, VendorModelPrice>>({});

  // Form data
  const [formData, setFormData] = useState({
    vendorId: '',
    costCenterId: '',
    expectedDeliveryDate: '',
    notes: '',
  });

  // Line items
  const [lineItems, setLineItems] = useState<LineItemDraft[]>([createEmptyLine()]);

  // Form validation errors
  const [formErrors, setFormErrors] = useState<Record<string, string>>({});
  const [lineErrors, setLineErrors] = useState<Record<number, Record<string, string>>>({});

  // Existing PO data (for edit mode)
  const [existingPO, setExistingPO] = useState<PurchaseOrderDetail | null>(null);

  /**
   * Load dropdown data (cost centers)
   */
  const loadDropdownData = useCallback(async () => {
    try {
      setIsLoadingDropdowns(true);
      const [costCentersData, modelsResp] = await Promise.all([
        procurementApi.costCenters.getForDropdown(),
        adminApi.models.list({ isActive: true }, { pageSize: 200 }),
      ]);
      setCostCenters(costCentersData);
      setModels(modelsResp.items);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load form data');
    } finally {
      setIsLoadingDropdowns(false);
    }
  }, []);

  /**
   * Load existing purchase order for editing
   */
  const loadPurchaseOrder = useCallback(async () => {
    if (!poId || poId === 'new') return;

    try {
      setIsLoading(true);
      setError(null);
      const po = await procurementApi.purchaseOrders.get(poId);

      // Check if PO can be edited (only DRAFT status)
      if (po.status !== 'DRAFT') {
        setError('Only draft purchase orders can be edited');
        return;
      }

      setExistingPO(po);
      setFormData({
        vendorId: po.vendorId,
        costCenterId: po.costCenterId,
        expectedDeliveryDate: po.expectedDeliveryDate
          ? po.expectedDeliveryDate.split('T')[0]
          : '',
        notes: po.notes || '',
      });

      // Convert existing lines to form format
      if (po.lines && po.lines.length > 0) {
        setLineItems(
          po.lines.map((line) => ({
            productType: line.productType,
            productId: line.productId,
            productDescription: line.productDescription,
            sku: line.sku || '',
            quantity: line.quantity,
            unitPrice: line.unitPrice,
            notes: line.notes || '',
            vendorId: line.vendorId || '',
            vendorName: line.vendorName || '',
            costCenterId: line.costCenterId || '',
          }))
        );
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load purchase order');
    } finally {
      setIsLoading(false);
    }
  }, [poId]);

  useEffect(() => {
    loadDropdownData();
  }, [loadDropdownData]);

  useEffect(() => {
    if (isEditing) {
      loadPurchaseOrder();
    }
  }, [isEditing, loadPurchaseOrder]);

  // Load vendor-specific model prices for auto-fill in PO lines
  useEffect(() => {
    let isMounted = true;

    const loadVendorPrices = async () => {
      const vendorId = formData.vendorId;
      if (!vendorId) {
        if (isMounted) setVendorModelPricesByModelId({});
        return;
      }

      try {
        const resp = await adminApi.vendorModelPrices.list(vendorId, {
          isActive: true,
          countryCode: 'GLOBAL',
        });
        if (!isMounted) return;
        const map: Record<string, VendorModelPrice> = {};
        for (const p of resp.items) map[p.modelId] = p;
        setVendorModelPricesByModelId(map);
      } catch {
        // If pricing isn't configured (or endpoint not available), keep manual entry working.
        if (isMounted) setVendorModelPricesByModelId({});
      }
    };

    loadVendorPrices();

    return () => {
      isMounted = false;
    };
  }, [formData.vendorId]);

  /**
   * Calculate line total
   */
  const calculateLineTotal = (line: LineItemDraft): number => {
    return line.quantity * line.unitPrice;
  };

  /**
   * Calculate subtotal (sum of all line totals)
   */
  const calculateSubtotal = (): number => {
    return lineItems.reduce((sum, line) => sum + calculateLineTotal(line), 0);
  };

  /**
   * Validate the form
   */
  const validateForm = (): boolean => {
    const errors: Record<string, string> = {};
    const lineErrs: Record<number, Record<string, string>> = {};

    // Validate main form fields — vendor is optional at header level (acts as default for lines)

    if (!formData.costCenterId) {
      errors.costCenterId = 'Cost center is required';
    }

    // Validate line items
    if (lineItems.length === 0) {
      errors.lineItems = 'At least one line item is required';
    }

    lineItems.forEach((line, index) => {
      const lineError: Record<string, string> = {};

      if (line.productType === 'HARDWARE_MODEL') {
        if (!line.productId) {
          lineError.productDescription = 'Model is required';
        }
      } else if (!line.productDescription.trim()) {
        lineError.productDescription = 'Description is required';
      }

      if (line.quantity <= 0) {
        lineError.quantity = 'Quantity must be greater than 0';
      }

      if (line.unitPrice < 0) {
        lineError.unitPrice = 'Unit price cannot be negative';
      }

      if (!line.vendorId && !formData.vendorId) {
        lineError.vendorId = 'Select a line vendor or a default header vendor';
      }

      if (!line.costCenterId && !formData.costCenterId) {
        lineError.costCenterId = 'Select a line cost center or a header cost center';
      }

      if (Object.keys(lineError).length > 0) {
        lineErrs[index] = lineError;
      }
    });

    setFormErrors(errors);
    setLineErrors(lineErrs);

    return Object.keys(errors).length === 0 && Object.keys(lineErrs).length === 0;
  };

  /**
   * Handle form submission
   */
  const handleSubmit = async () => {
    if (isSaving) return;

    if (!validateForm()) return;

    try {
      setIsSaving(true);
      setError(null);

      const requestData: CreatePurchaseOrderRequest = {
        vendorId: formData.vendorId,
        costCenterId: formData.costCenterId,
        expectedDeliveryDate: formData.expectedDeliveryDate || undefined,
        notes: formData.notes || undefined,
        lines: lineItems.map((line) => {
          return {
            productType: line.productType,
            productId: line.productId || undefined,
            productDescription: line.productDescription,
            sku: line.sku || undefined,
            quantity: line.quantity,
            unitPrice: line.unitPrice,
            notes: line.notes || undefined,
            vendorId: line.vendorId || undefined,
            costCenterId: line.costCenterId || undefined,
          };
        }),
      };

      if (isEditing && poId) {
        // For editing, we need to update lines individually
        // First, remove all existing lines and add new ones
        // This is a simplified approach - in production, you might want to diff the lines
        // For now, we'll just create a new PO with the same data
        // Note: The API might need to support a full update endpoint
        // For this implementation, we'll navigate back and show a message
        setError('Editing existing purchase orders is not yet fully supported. Please create a new PO.');
        return;
      } else {
        await procurementApi.purchaseOrders.create(requestData);
      }

      navigate('/procurement/purchase-orders');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save purchase order');
    } finally {
      setIsSaving(false);
    }
  };

  /**
   * Handle main form field changes
   */
  const handleChange = (
    e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>
  ) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));

    // When header vendor changes, pre-populate lines with empty vendorId
    if (name === 'vendorId') {
      setLineItems((prev) =>
        prev.map((line) =>
          !line.vendorId ? { ...line, vendorId: value } : line
        )
      );
    }

    // When header cost center changes, pre-populate lines with empty costCenterId
    if (name === 'costCenterId') {
      setLineItems((prev) =>
        prev.map((line) =>
          !line.costCenterId ? { ...line, costCenterId: value } : line
        )
      );
    }

    // Clear error for this field
    if (formErrors[name]) {
      setFormErrors((prev) => ({ ...prev, [name]: '' }));
    }
  };

  /**
   * Handle line item field changes
   */
  const handleLineChange = (
    index: number,
    field: keyof LineItemDraft,
    value: string | number
  ) => {
    setLineItems((prev) => {
      const updated = [...prev];
      updated[index] = { ...updated[index], [field]: value };
      return updated;
    });

    // Clear error for this line field
    if (lineErrors[index]?.[field]) {
      setLineErrors((prev) => {
        const updated = { ...prev };
        if (updated[index]) {
          updated[index] = { ...updated[index], [field]: '' };
        }
        return updated;
      });
    }
  };

  const handleModelSelect = (index: number, modelId: string) => {
    const model = models.find((m) => m.modelId === modelId);
    const vendorPrice = vendorModelPricesByModelId[modelId];

    setLineItems((prev) => {
      const updated = [...prev];
      const current = updated[index];
      if (!current) return prev;

      updated[index] = {
        ...current,
        productId: modelId || undefined,
        productDescription: model ? `${model.manufacturerName} ${model.modelName}` : current.productDescription,
        sku: model?.sku ?? model?.modelNumber ?? current.sku,
        unitPrice: (current.unitPrice ?? 0) === 0 && vendorPrice ? vendorPrice.unitPrice : current.unitPrice,
      };

      return updated;
    });
  };

  /**
   * Add a new line item
   */
  const handleAddLine = () => {
    setLineItems((prev) => [...prev, createEmptyLine(formData.vendorId, formData.costCenterId)]);
  };

  /**
   * Remove a line item
   */
  const handleRemoveLine = (index: number) => {
    if (lineItems.length <= 1) {
      setFormErrors((prev) => ({
        ...prev,
        lineItems: 'At least one line item is required',
      }));
      return;
    }

    setLineItems((prev) => prev.filter((_, i) => i !== index));

    // Clear errors for removed line
    setLineErrors((prev) => {
      const updated = { ...prev };
      delete updated[index];
      return updated;
    });
  };

  /**
   * Get selected cost center info
   */
  const getSelectedCostCenter = (): CostCenterSummary | undefined => {
    return costCenters.find((cc) => cc.costCenterId === formData.costCenterId);
  };

  // Show loading skeleton while loading
  if (isLoading || isLoadingDropdowns) {
    return (
      <div className={styles.adminPage}>
        <div className={styles.formContainer}>
          <div className={styles.skeleton} style={{ height: '600px' }} />
        </div>
      </div>
    );
  }

  const subtotal = calculateSubtotal();
  const selectedCostCenter = getSelectedCostCenter();

  return (
    <div className={styles.adminPage}>
      <nav className={styles.breadcrumb}>
        <Link to="/procurement/purchase-orders" className={styles.breadcrumbLink}>
          Purchase Orders
        </Link>
        <span className={styles.breadcrumbSeparator}>/</span>
        <span className={styles.breadcrumbCurrent}>
          {isEditing ? `Edit ${existingPO?.poNumber || 'PO'}` : 'New Purchase Order'}
        </span>
      </nav>

      <div className={styles.pageHeader}>
        <div>
          <h1 className={styles.pageTitle}>
            {isEditing ? 'Edit Purchase Order' : 'New Purchase Order'}
          </h1>
          <p className={styles.pageDescription}>
            {isEditing
              ? 'Update purchase order details and line items'
              : 'Create a new purchase order with vendor, cost center, and line items'}
          </p>
        </div>
      </div>

      {error && (
        <div className={styles.errorBanner}>
          <p>{error}</p>
        </div>
      )}

      <div className={styles.formContainer} style={{ maxWidth: '1200px' }}>
        <Form
          initialValues={{}}
          onSubmit={handleSubmit}
          className={styles.form}
          showSubmitError={false}
        >
          {/* Basic Information Section */}
          <div className={styles.formSection}>
            <h2 className={styles.formSectionTitle}>Basic Information</h2>
            <div className={styles.formGrid}>
              <div className={styles.formGroup}>
                <label htmlFor="vendorId" className={styles.formLabel}>
                  Default Vendor
                </label>
                <select
                  id="vendorId"
                  name="vendorId"
                  value={formData.vendorId}
                  onChange={handleChange}
                  className={`${styles.formSelect} ${formErrors.vendorId ? styles.error : ''}`}
                  disabled={vendorsLoading}
                >
                  <option value="">{vendorsLoading ? 'Loading vendors...' : 'Select a vendor...'}</option>
                  {vendorOptions.map((option) => (
                    <option key={option.value} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </select>
                {formErrors.vendorId && (
                  <span className={styles.formError}>{formErrors.vendorId}</span>
                )}
              </div>

              <div className={styles.formGroup}>
                <label htmlFor="costCenterId" className={`${styles.formLabel} ${styles.required}`}>
                  Cost Center
                </label>
                <select
                  id="costCenterId"
                  name="costCenterId"
                  value={formData.costCenterId}
                  onChange={handleChange}
                  className={`${styles.formSelect} ${formErrors.costCenterId ? styles.error : ''}`}
                >
                  <option value="">Select a cost center...</option>
                  {costCenters.map((cc) => (
                    <option key={cc.costCenterId} value={cc.costCenterId}>
                      {cc.code} - {cc.name} (Available: {formatCurrency(cc.availableAmount)})
                    </option>
                  ))}
                </select>
                {formErrors.costCenterId && (
                  <span className={styles.formError}>{formErrors.costCenterId}</span>
                )}
                {selectedCostCenter && subtotal > selectedCostCenter.availableAmount && (
                  <span className={styles.formError} style={{ marginTop: 'var(--spacing-1)' }}>
                    Warning: Order total exceeds available budget
                  </span>
                )}
              </div>

              <div className={styles.formGroup}>
                <label htmlFor="expectedDeliveryDate" className={styles.formLabel}>
                  Expected Delivery Date
                </label>
                <input
                  type="date"
                  id="expectedDeliveryDate"
                  name="expectedDeliveryDate"
                  value={formData.expectedDeliveryDate}
                  onChange={handleChange}
                  min={new Date().toISOString().split('T')[0]}
                  className={styles.formInput}
                />
              </div>

              <div className={`${styles.formGroup} ${styles.formGroupFull}`}>
                <label htmlFor="notes" className={styles.formLabel}>
                  Notes
                </label>
                <textarea
                  id="notes"
                  name="notes"
                  value={formData.notes}
                  onChange={handleChange}
                  className={styles.formTextarea}
                  placeholder="Add any additional notes or instructions for this purchase order..."
                  rows={3}
                />
              </div>
            </div>
          </div>

          {/* Line Items Section */}
          <div className={styles.formSection}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 'var(--spacing-4)' }}>
              <h2 className={styles.formSectionTitle} style={{ margin: 0, border: 'none', paddingBottom: 0 }}>
                Line Items
              </h2>
              <button
                type="button"
                className={styles.secondaryButton}
                onClick={handleAddLine}
              >
                <svg
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  className={styles.buttonIcon}
                >
                  <line x1="12" y1="5" x2="12" y2="19" />
                  <line x1="5" y1="12" x2="19" y2="12" />
                </svg>
                Add Line Item
              </button>
            </div>

            {formErrors.lineItems && (
              <div className={styles.errorBanner} style={{ marginBottom: 'var(--spacing-4)' }}>
                <p>{formErrors.lineItems}</p>
              </div>
            )}

            <div className={styles.tableContainer}>
              <table className={styles.table}>
                <thead>
                  <tr>
                    <th style={{ width: '120px' }}>Type</th>
                    <th>Description</th>
                    <th style={{ width: '100px' }}>SKU</th>
                    <th style={{ width: '150px' }}>Vendor</th>
                    <th style={{ width: '150px' }}>Cost Center</th>
                    <th style={{ width: '80px' }}>Qty</th>
                    <th style={{ width: '120px' }}>Unit Price</th>
                    <th style={{ width: '120px' }}>Line Total</th>
                    <th style={{ width: '60px' }}>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {lineItems.map((line, index) => (
                    <tr key={index}>
                      <td>
                        <select
                          value={line.productType}
                          onChange={(e) =>
                            handleLineChange(index, 'productType', e.target.value as LineItemDraft['productType'])
                          }
                          className={styles.formSelect}
                          style={{ padding: 'var(--spacing-1) var(--spacing-2)', fontSize: 'var(--font-size-xs)' }}
                          aria-label={`Line ${index + 1} product type`}
                        >
                          {PRODUCT_TYPE_OPTIONS.map((opt) => (
                            <option key={opt.value} value={opt.value}>
                              {opt.label}
                            </option>
                          ))}
                        </select>
                      </td>
                      <td>
                        {line.productType === 'HARDWARE_MODEL' ? (
                          <>
                            <select
                              value={line.productId || ''}
                              onChange={(e) => handleModelSelect(index, e.target.value)}
                              className={`${styles.formSelect} ${lineErrors[index]?.productDescription ? styles.error : ''}`}
                              style={{ padding: 'var(--spacing-1) var(--spacing-2)', fontSize: 'var(--font-size-xs)' }}
                              aria-label={`Line ${index + 1} model`}
                            >
                              <option value="">Select a model...</option>
                              {models.map((m) => (
                                <option key={m.modelId} value={m.modelId}>
                                  {m.manufacturerName} {m.modelName}{m.sku ? ` (${m.sku})` : ''}
                                </option>
                              ))}
                            </select>
                            <input
                              type="text"
                              value={line.productDescription}
                              readOnly
                              className={`${styles.formInput} ${lineErrors[index]?.productDescription ? styles.error : ''}`}
                              style={{ padding: 'var(--spacing-1) var(--spacing-2)', fontSize: 'var(--font-size-xs)', marginTop: 'var(--spacing-1)' }}
                              placeholder="Will be set from selected model"
                              aria-label={`Line ${index + 1} product description`}
                            />
                            {lineErrors[index]?.productDescription && (
                              <span className={styles.formError} style={{ fontSize: 'var(--font-size-xs)' }}>
                                {lineErrors[index].productDescription}
                              </span>
                            )}
                          </>
                        ) : (
                          <>
                            <input
                              type="text"
                              value={line.productDescription}
                              onChange={(e) => handleLineChange(index, 'productDescription', e.target.value)}
                              className={`${styles.formInput} ${lineErrors[index]?.productDescription ? styles.error : ''}`}
                              style={{ padding: 'var(--spacing-1) var(--spacing-2)', fontSize: 'var(--font-size-xs)' }}
                              placeholder="Product description..."
                              aria-label={`Line ${index + 1} product description`}
                            />
                            {lineErrors[index]?.productDescription && (
                              <span className={styles.formError} style={{ fontSize: 'var(--font-size-xs)' }}>
                                {lineErrors[index].productDescription}
                              </span>
                            )}
                          </>
                        )}
                      </td>
                      <td>
                        <input
                          type="text"
                          value={line.sku || ''}
                          onChange={(e) => handleLineChange(index, 'sku', e.target.value)}
                          className={styles.formInput}
                          style={{ padding: 'var(--spacing-1) var(--spacing-2)', fontSize: 'var(--font-size-xs)' }}
                          placeholder="SKU"
                          readOnly={line.productType === 'HARDWARE_MODEL'}
                          aria-label={`Line ${index + 1} SKU`}
                        />
                      </td>
                      {/* Line-level Vendor */}
                      <td>
                        <select
                          value={line.vendorId || ''}
                          onChange={(e) => handleLineChange(index, 'vendorId', e.target.value)}
                          className={`${styles.formSelect} ${lineErrors[index]?.vendorId ? styles.error : ''}`}
                          style={{ padding: 'var(--spacing-1) var(--spacing-2)', fontSize: 'var(--font-size-xs)' }}
                          aria-label={`Line ${index + 1} vendor`}
                          disabled={vendorsLoading}
                        >
                          <option value="">
                            {formData.vendorId ? '(use header default)' : 'Select vendor...'}
                          </option>
                          {vendorOptions.map((option) => (
                            <option key={option.value} value={option.value}>
                              {option.label}
                            </option>
                          ))}
                        </select>
                        {lineErrors[index]?.vendorId && (
                          <span className={styles.formError} style={{ fontSize: 'var(--font-size-xs)' }}>
                            {lineErrors[index].vendorId}
                          </span>
                        )}
                      </td>
                      {/* Line-level Cost Center */}
                      <td>
                        <select
                          value={line.costCenterId || ''}
                          onChange={(e) => handleLineChange(index, 'costCenterId', e.target.value)}
                          className={`${styles.formSelect} ${lineErrors[index]?.costCenterId ? styles.error : ''}`}
                          style={{ padding: 'var(--spacing-1) var(--spacing-2)', fontSize: 'var(--font-size-xs)' }}
                          aria-label={`Line ${index + 1} cost center`}
                        >
                          <option value="">
                            {formData.costCenterId ? '(use header default)' : 'Select cost center...'}
                          </option>
                          {costCenters.map((cc) => (
                            <option key={cc.costCenterId} value={cc.costCenterId}>
                              {cc.code} - {cc.name}
                            </option>
                          ))}
                        </select>
                        {lineErrors[index]?.costCenterId && (
                          <span className={styles.formError} style={{ fontSize: 'var(--font-size-xs)' }}>
                            {lineErrors[index].costCenterId}
                          </span>
                        )}
                      </td>
                      <td>
                        <input
                          type="number"
                          value={line.quantity}
                          onChange={(e) => handleLineChange(index, 'quantity', parseInt(e.target.value) || 0)}
                          className={`${styles.formInput} ${lineErrors[index]?.quantity ? styles.error : ''}`}
                          style={{ padding: 'var(--spacing-1) var(--spacing-2)', fontSize: 'var(--font-size-xs)', textAlign: 'right' }}
                          min="1"
                          aria-label={`Line ${index + 1} quantity`}
                        />
                        {lineErrors[index]?.quantity && (
                          <span className={styles.formError} style={{ fontSize: 'var(--font-size-xs)' }}>
                            {lineErrors[index].quantity}
                          </span>
                        )}
                      </td>
                      <td>
                        <input
                          type="number"
                          value={line.unitPrice}
                          onChange={(e) => handleLineChange(index, 'unitPrice', parseFloat(e.target.value) || 0)}
                          className={`${styles.formInput} ${lineErrors[index]?.unitPrice ? styles.error : ''}`}
                          style={{ padding: 'var(--spacing-1) var(--spacing-2)', fontSize: 'var(--font-size-xs)', textAlign: 'right' }}
                          min="0"
                          step="0.01"
                          aria-label={`Line ${index + 1} unit price`}
                        />
                        {lineErrors[index]?.unitPrice && (
                          <span className={styles.formError} style={{ fontSize: 'var(--font-size-xs)' }}>
                            {lineErrors[index].unitPrice}
                          </span>
                        )}
                      </td>
                      <td style={{ textAlign: 'right', fontWeight: 'var(--font-weight-medium)' }}>
                        {formatCurrency(calculateLineTotal(line))}
                      </td>
                      <td>
                        <button
                          type="button"
                          className={`${styles.iconButton} ${styles.dangerButton}`}
                          onClick={() => handleRemoveLine(index)}
                          title="Remove line item"
                          disabled={lineItems.length <= 1}
                        >
                          <svg
                            viewBox="0 0 24 24"
                            fill="none"
                            stroke="currentColor"
                            strokeWidth="2"
                          >
                            <polyline points="3 6 5 6 21 6" />
                            <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
                          </svg>
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
                <tfoot>
                  <tr>
                    <td colSpan={7} style={{ textAlign: 'right', fontWeight: 'var(--font-weight-semibold)' }}>
                      Subtotal:
                    </td>
                    <td style={{ textAlign: 'right', fontWeight: 'var(--font-weight-bold)', fontSize: 'var(--font-size-base)' }}>
                      {formatCurrency(subtotal)}
                    </td>
                    <td />
                  </tr>
                </tfoot>
              </table>
            </div>
          </div>

          {/* Form Actions */}
          <Form.Actions>
            <Form.Submit
              label={isEditing ? 'Update Purchase Order' : 'Create Purchase Order'}
              submittingLabel="Saving..."
              cancelLabel="Cancel"
              onCancel={() => navigate('/procurement/purchase-orders')}
              disabled={isSaving || lineItems.length === 0}
            />
          </Form.Actions>
        </Form>
      </div>
    </div>
  );
}

export default PurchaseOrderForm;
