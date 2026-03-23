import { useState, useEffect } from 'react';
import { useNavigate, useParams, Link } from 'react-router-dom';
import { Form } from '@ams/ui';
import { adminApi } from '../../services/admin-api';
import type { VendorType, VendorRating, CreateVendorRequest, UpdateVendorRequest, Model, VendorModelPrice } from '../../types/admin';
import styles from './AdminPage.module.css';

const VENDOR_TYPES: { value: VendorType; label: string }[] = [
  { value: 'MANUFACTURER', label: 'Manufacturer' },
  { value: 'RESELLER', label: 'Reseller' },
  { value: 'DISTRIBUTOR', label: 'Distributor' },
  { value: 'SERVICE_PROVIDER', label: 'Service Provider' },
  { value: 'CONSULTANT', label: 'Consultant' },
  { value: 'CONTRACTOR', label: 'Contractor' },
  { value: 'LESSOR', label: 'Lessor' },
  { value: 'OTHER', label: 'Other' },
];

const VENDOR_RATINGS: { value: VendorRating; label: string }[] = [
  { value: 'PREFERRED', label: 'Preferred' },
  { value: 'APPROVED', label: 'Approved' },
  { value: 'CONDITIONAL', label: 'Conditional' },
  { value: 'PROBATION', label: 'Probation' },
  { value: 'SUSPENDED', label: 'Suspended' },
  { value: 'BLACKLISTED', label: 'Blacklisted' },
];

export function VendorForm() {
  const navigate = useNavigate();
  const { vendorId } = useParams<{ vendorId: string }>();
  const isEditing = !!(vendorId && vendorId !== 'new');

  const [isLoading, setIsLoading] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [initialValues, setInitialValues] = useState({
    vendorCode: '',
    vendorName: '',
    vendorType: '' as VendorType | '',
    contactName: '',
    contactEmail: '',
    contactPhone: '',
    paymentTerms: '',
    rating: '' as VendorRating | '',
  });

  const [models, setModels] = useState<Model[]>([]);
  const [modelPrices, setModelPrices] = useState<VendorModelPrice[]>([]);
  const [isPricingLoading, setIsPricingLoading] = useState(false);
  const [pricingError, setPricingError] = useState<string | null>(null);
  const [isSavingPrice, setIsSavingPrice] = useState(false);
  const [priceFormError, setPriceFormError] = useState<string | null>(null);
  const [priceForm, setPriceForm] = useState({
    modelId: '',
    unitPrice: '',
    currency: 'USD',
    countryCode: 'GLOBAL',
    vendorSku: '',
  });

  type VendorFormValues = {
    vendorCode: string;
    vendorName: string;
    vendorType: string;
    contactName: string;
    contactEmail: string;
    contactPhone: string;
    paymentTerms: string;
    rating: string;
  };

  const getValue = (values: Record<string, unknown>, key: keyof VendorFormValues): string => {
    const value = values[key];
    return typeof value === 'string' ? value : '';
  };

  useEffect(() => {
    if (isEditing && vendorId) {
      setIsLoading(true);
      adminApi.vendors.get(vendorId)
        .then(v => setInitialValues({
          vendorCode: v.vendorCode || '',
          vendorName: v.vendorName,
          vendorType: v.vendorType || '',
          contactName: v.contactName || '',
          contactEmail: v.contactEmail || '',
          contactPhone: v.contactPhone || '',
          paymentTerms: v.paymentTerms || '',
          rating: v.rating || '',
        }))
        .catch((err: unknown) => setError(err instanceof Error ? err.message : 'Failed to load vendor'))
        .finally(() => setIsLoading(false));
    }
  }, [vendorId, isEditing]);

  useEffect(() => {
    if (!isEditing || !vendorId) return;

    setIsPricingLoading(true);
    setPricingError(null);

    Promise.all([
      adminApi.vendorModelPrices.list(vendorId, { isActive: true }),
      adminApi.models.list({ isActive: true }, { pageSize: 200 }),
    ])
      .then(([prices, modelsResp]) => {
        setModelPrices(prices.items);
        setModels(modelsResp.items);
      })
      .catch((err) => setPricingError(err instanceof Error ? err.message : String(err)))
      .finally(() => setIsPricingLoading(false));
  }, [isEditing, vendorId]);

  const validateForm = (values: Record<string, unknown>) => {
    const errors: Record<string, string> = {};
    const vendorName = getValue(values, 'vendorName').trim();
    const contactEmail = getValue(values, 'contactEmail').trim();

    if (!vendorName) errors.vendorName = 'Vendor name is required';
    if (contactEmail && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(contactEmail)) errors.contactEmail = 'Invalid email';
    return errors;
  };

  const handleSubmit = async (values: Record<string, unknown>) => {
    const vendorCode = getValue(values, 'vendorCode').trim();
    const vendorName = getValue(values, 'vendorName').trim();
    const vendorType = getValue(values, 'vendorType').trim();
    const contactName = getValue(values, 'contactName').trim();
    const contactEmail = getValue(values, 'contactEmail').trim();
    const contactPhone = getValue(values, 'contactPhone').trim();
    const paymentTerms = getValue(values, 'paymentTerms').trim();
    const rating = getValue(values, 'rating').trim();

    try {
      setIsSaving(true);
      setError(null);
      if (isEditing && vendorId) {
        const data: UpdateVendorRequest = {
          vendorName,
          vendorType: vendorType ? (vendorType as VendorType) : undefined,
          contactName: contactName || undefined,
          contactEmail: contactEmail || undefined,
          contactPhone: contactPhone || undefined,
          paymentTerms: paymentTerms || undefined,
          rating: rating ? (rating as VendorRating) : undefined,
        };
        await adminApi.vendors.update(vendorId, data);
      } else {
        const data: CreateVendorRequest = {
          vendorCode: vendorCode || undefined,
          vendorName,
          vendorType: vendorType ? (vendorType as VendorType) : undefined,
          contactName: contactName || undefined,
          contactEmail: contactEmail || undefined,
          contactPhone: contactPhone || undefined,
          paymentTerms: paymentTerms || undefined,
        };
        await adminApi.vendors.create(data);
      }
      navigate('/admin/vendors');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save');
    } finally {
      setIsSaving(false);
    }
  };

  const refreshPricing = async () => {
    if (!isEditing || !vendorId) return;
    const prices = await adminApi.vendorModelPrices.list(vendorId, { isActive: true });
    setModelPrices(prices.items);
  };

  const handleSavePrice = async () => {
    if (!vendorId) return;

    setPriceFormError(null);
    const modelId = priceForm.modelId;
    const unitPrice = Number.parseFloat(priceForm.unitPrice);
    const currency = (priceForm.currency || 'USD').trim().toUpperCase();
    const countryCode = (priceForm.countryCode || 'GLOBAL').trim().toUpperCase();

    if (!modelId) {
      setPriceFormError('Model is required');
      return;
    }

    if (!Number.isFinite(unitPrice) || unitPrice < 0) {
      setPriceFormError('Unit price must be a non-negative number');
      return;
    }

    if (currency.length !== 3) {
      setPriceFormError('Currency must be a 3-letter code (e.g., USD)');
      return;
    }

    if (!/^[A-Z0-9_-]{2,10}$/.test(countryCode)) {
      setPriceFormError('Country code must be 2-10 characters using A-Z, 0-9, _ or -');
      return;
    }

    try {
      setIsSavingPrice(true);
      await adminApi.vendorModelPrices.upsert(vendorId, modelId, {
        unitPrice,
        currency,
        countryCode,
        vendorSku: priceForm.vendorSku.trim() || undefined,
        isActive: true,
      });
      await refreshPricing();
      setPriceForm({ modelId: '', unitPrice: '', currency: 'USD', countryCode: 'GLOBAL', vendorSku: '' });
    } catch (err) {
      setPriceFormError(err instanceof Error ? err.message : 'Failed to save price');
    } finally {
      setIsSavingPrice(false);
    }
  };

  const handleDeactivatePrice = async (price: VendorModelPrice) => {
    if (!vendorId) return;
    if (!window.confirm(`Deactivate pricing for ${price.manufacturerName} ${price.modelName}?`)) return;

    try {
      setIsSavingPrice(true);
      await adminApi.vendorModelPrices.deactivate(vendorId, price.modelId, price.countryCode);
      await refreshPricing();
    } catch (err) {
      setPricingError(err instanceof Error ? err.message : 'Failed to deactivate price');
    } finally {
      setIsSavingPrice(false);
    }
  };

  if (isLoading) return <div className={styles.adminPage}><div className={`${styles.skeleton} ${styles.skeletonFormMedium}`}/></div>;

  return (
    <div className={styles.adminPage}>
      <nav className={styles.breadcrumb}>
        <Link to="/admin/vendors" className={styles.breadcrumbLink}>Vendors</Link>
        <span className={styles.breadcrumbSeparator}>/</span>
        <span className={styles.breadcrumbCurrent}>{isEditing ? 'Edit' : 'New'}</span>
      </nav>
      <div className={styles.pageHeader}><h1 className={styles.pageTitle}>{isEditing ? 'Edit Vendor' : 'New Vendor'}</h1></div>
      {error && <div className={styles.errorBanner}><p>{error}</p></div>}
      <div className={styles.formContainer}>
        <Form
          initialValues={initialValues}
          onSubmit={handleSubmit}
          validate={validateForm}
          className={styles.form}
        >
          <Form.Section title="Basic Information" columns={2}>
            <Form.Field name="vendorCode" label="Vendor Code">
              <Form.Input
                name="vendorCode"
                placeholder="Auto-generated if empty"
                disabled={isSaving}
              />
            </Form.Field>
            <Form.Field name="vendorName" label="Vendor Name" required>
              <Form.Input name="vendorName" disabled={isSaving} />
            </Form.Field>
            <Form.Field name="vendorType" label="Type">
              <Form.Select
                name="vendorType"
                options={[
                  { value: '', label: 'Select...' },
                  ...VENDOR_TYPES.map((type) => ({
                    value: type.value,
                    label: type.label,
                  })),
                ]}
                placeholder="Select..."
                disabled={isSaving}
              />
            </Form.Field>
            {isEditing && (
              <Form.Field name="rating" label="Rating">
                <Form.Select
                  name="rating"
                  options={[
                    { value: '', label: 'Not Rated' },
                    ...VENDOR_RATINGS.map((rating) => ({
                      value: rating.value,
                      label: rating.label,
                    })),
                  ]}
                  placeholder="Not Rated"
                  disabled={isSaving}
                />
              </Form.Field>
            )}
          </Form.Section>

          <Form.Section title="Contact" columns={2}>
            <Form.Field name="contactName" label="Contact Name">
              <Form.Input name="contactName" disabled={isSaving} />
            </Form.Field>
            <Form.Field name="contactEmail" label="Email">
              <Form.Input name="contactEmail" type="email" disabled={isSaving} />
            </Form.Field>
            <Form.Field name="contactPhone" label="Phone">
              <Form.Input name="contactPhone" type="tel" disabled={isSaving} />
            </Form.Field>
            <Form.Field name="paymentTerms" label="Payment Terms">
              <Form.Input
                name="paymentTerms"
                placeholder="e.g., Net 30"
                disabled={isSaving}
              />
            </Form.Field>
          </Form.Section>

          {isEditing && (
            <div className={styles.formSection}>
              <h2 className={styles.formSectionTitle}>Model Pricing</h2>

              {pricingError && <div className={styles.errorBanner}><p>{pricingError}</p></div>}
              {priceFormError && <div className={styles.errorBanner}><p>{priceFormError}</p></div>}

              <div className={styles.formGrid}>
                <div className={styles.formGroup}>
                  <label htmlFor="vendor-pricing-model" className={`${styles.formLabel} ${styles.required}`}>Model</label>
                  <select
                    id="vendor-pricing-model"
                    value={priceForm.modelId}
                    onChange={(e) => setPriceForm(p => ({ ...p, modelId: e.target.value }))}
                    className={styles.formSelect}
                    disabled={isPricingLoading || isSavingPrice}
                  >
                    <option value="">{isPricingLoading ? 'Loading models...' : 'Select a model...'}</option>
                    {models.map((m) => (
                      <option key={m.modelId} value={m.modelId}>
                        {m.manufacturerName} {m.modelName}{m.sku ? ` (${m.sku})` : ''}
                      </option>
                    ))}
                  </select>
                </div>

                <div className={styles.formGroup}>
                  <label htmlFor="vendor-unit-price" className={`${styles.formLabel} ${styles.required}`}>Unit Price</label>
                  <input
                    id="vendor-unit-price"
                    type="number"
                    min="0"
                    step="0.01"
                    value={priceForm.unitPrice}
                    onChange={(e) => setPriceForm(p => ({ ...p, unitPrice: e.target.value }))}
                    className={styles.formInput}
                    disabled={isSavingPrice}
                    placeholder="0.00"
                  />
                </div>

                <div className={styles.formGroup}>
                  <label htmlFor="vendor-currency" className={styles.formLabel}>Currency</label>
                  <input
                    id="vendor-currency"
                    type="text"
                    value={priceForm.currency}
                    onChange={(e) => setPriceForm(p => ({ ...p, currency: e.target.value }))}
                    className={styles.formInput}
                    disabled={isSavingPrice}
                    placeholder="USD"
                  />
                </div>

                <div className={styles.formGroup}>
                  <label htmlFor="vendor-country-code" className={styles.formLabel}>Country Code</label>
                  <input
                    id="vendor-country-code"
                    type="text"
                    value={priceForm.countryCode}
                    onChange={(e) => setPriceForm(p => ({ ...p, countryCode: e.target.value }))}
                    className={styles.formInput}
                    disabled={isSavingPrice}
                    placeholder="GLOBAL or ISO code"
                  />
                </div>

                <div className={styles.formGroup}>
                  <label htmlFor="vendor-sku" className={styles.formLabel}>Vendor SKU</label>
                  <input
                    id="vendor-sku"
                    type="text"
                    value={priceForm.vendorSku}
                    onChange={(e) => setPriceForm(p => ({ ...p, vendorSku: e.target.value }))}
                    className={styles.formInput}
                    disabled={isSavingPrice}
                    placeholder="Optional"
                  />
                </div>

                <div className={styles.formGroup} style={{ display: 'flex', alignItems: 'flex-end' }}>
                  <button
                    type="button"
                    className={styles.primaryButton}
                    onClick={handleSavePrice}
                    disabled={isSavingPrice || isPricingLoading}
                  >
                    {isSavingPrice ? 'Saving...' : 'Save Price'}
                  </button>
                </div>
              </div>

              <div className={styles.tableContainer}>
                <table className={styles.table}>
                  <thead>
                    <tr>
                      <th>Model</th>
                      <th style={{ width: '120px' }}>SKU</th>
                      <th style={{ width: '140px' }}>Unit Price</th>
                      <th style={{ width: '90px' }}>Currency</th>
                      <th style={{ width: '110px' }}>Country</th>
                      <th>Vendor SKU</th>
                      <th style={{ width: '90px' }}>Status</th>
                      <th style={{ width: '110px' }}>Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {isPricingLoading ? (
                      <tr><td colSpan={8}><div className={`${styles.skeleton} ${styles.skeletonLg}`} /></td></tr>
                    ) : modelPrices.length === 0 ? (
                      <tr><td colSpan={8} style={{ color: 'var(--color-text-secondary)' }}>No model pricing configured for this vendor.</td></tr>
                    ) : (
                      modelPrices.map((p) => (
                        <tr key={`${p.vendorId}-${p.modelId}-${p.countryCode}`}>
                          <td>{p.manufacturerName} {p.modelName}</td>
                          <td className={styles.codeCell}>{p.sku || '-'}</td>
                          <td style={{ textAlign: 'right' }}>{p.unitPrice.toFixed(2)}</td>
                          <td>{p.currency}</td>
                          <td>{p.countryCode}</td>
                          <td>{p.vendorSku || '-'}</td>
                          <td><span className={`${styles.statusBadge} ${p.isActive ? styles.statusActive : styles.statusInactive}`}>{p.isActive ? 'Active' : 'Inactive'}</span></td>
                          <td>
                            <button
                              type="button"
                              className={`${styles.iconButton} ${styles.dangerButton}`}
                              onClick={() => handleDeactivatePrice(p)}
                              disabled={isSavingPrice}
                              title="Deactivate"
                              aria-label={`Deactivate pricing for ${p.modelName}`}
                            >
                              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="10" /><line x1="15" y1="9" x2="9" y2="15" /><line x1="9" y1="9" x2="15" y2="15" /></svg>
                            </button>
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          <Form.Actions>
            <Form.Submit
              label={isSaving ? 'Saving...' : 'Save'}
              cancelLabel="Cancel"
              onCancel={() => navigate('/admin/vendors')}
              disableUntilDirty
            />
          </Form.Actions>
        </Form>
      </div>
    </div>
  );
}

export default VendorForm;
