import { useState, useEffect } from 'react';
import { useNavigate, useParams, Link } from 'react-router-dom';
import { adminApi } from '../../services/admin-api';
import type { Manufacturer, ModelStatus, CreateModelRequest, UpdateModelRequest } from '../../types/admin';
import styles from './AdminPage.module.css';

const MODEL_STATUSES: { value: ModelStatus; label: string }[] = [
  { value: 'ACTIVE', label: 'Active' },
  { value: 'DEPRECATED', label: 'Deprecated' },
  { value: 'END_OF_LIFE', label: 'End of Life' },
];

/**
 * Model Form Component
 * Implements Task 16.3.10: Create ModelForm.tsx for create/edit
 */
export function ModelForm() {
  const navigate = useNavigate();
  const { modelId } = useParams<{ modelId: string }>();
  const isEditing = !!(modelId && modelId !== 'new');

  const [manufacturers, setManufacturers] = useState<Manufacturer[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [formData, setFormData] = useState({
    manufacturerId: '', modelName: '', modelNumber: '', sku: '', category: '', status: 'ACTIVE' as ModelStatus,
  });
  const [formErrors, setFormErrors] = useState<Record<string, string>>({});

  useEffect(() => {
    adminApi.manufacturers.list({ isActive: true }, { pageSize: 100 })
      .then(res => setManufacturers(res.items)).catch(() => {});
  }, []);

  useEffect(() => {
    if (isEditing && modelId) {
      setIsLoading(true);
      adminApi.models.get(modelId)
        .then(m => setFormData({
          manufacturerId: m.manufacturerId, modelName: m.modelName, modelNumber: m.modelNumber || '',
          sku: m.sku || '', category: m.category || '', status: m.status,
        }))
        .catch(err => setError(err.message))
        .finally(() => setIsLoading(false));
    }
  }, [modelId, isEditing]);

  const validateForm = () => {
    const errors: Record<string, string> = {};
    if (!formData.manufacturerId) errors.manufacturerId = 'Manufacturer is required';
    if (!formData.modelName.trim()) errors.modelName = 'Model name is required';
    setFormErrors(errors);
    return Object.keys(errors).length === 0;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!validateForm()) return;
    try {
      setIsSaving(true);
      if (isEditing && modelId) {
        const data: UpdateModelRequest = {
          modelName: formData.modelName, modelNumber: formData.modelNumber || undefined,
          sku: formData.sku || undefined, category: formData.category || undefined, status: formData.status,
        };
        await adminApi.models.update(modelId, data);
      } else {
        const data: CreateModelRequest = {
          manufacturerId: formData.manufacturerId, modelName: formData.modelName,
          modelNumber: formData.modelNumber || undefined, sku: formData.sku || undefined, category: formData.category || undefined,
        };
        await adminApi.models.create(data);
      }
      navigate('/admin/products');
    } catch (err) { setError(err instanceof Error ? err.message : 'Failed to save'); }
    finally { setIsSaving(false); }
  };

  if (isLoading) return <div className={styles.adminPage}><div className={`${styles.skeleton} ${styles.skeletonFormMedium}`}/></div>;

  return (
    <div className={styles.adminPage}>
      <nav className={styles.breadcrumb}>
        <Link to="/admin/products" className={styles.breadcrumbLink}>Product Catalog</Link>
        <span className={styles.breadcrumbSeparator}>/</span>
        <span className={styles.breadcrumbCurrent}>{isEditing ? 'Edit' : 'New'}</span>
      </nav>
      <div className={styles.pageHeader}><h1 className={styles.pageTitle}>{isEditing ? 'Edit Model' : 'New Model'}</h1></div>
      {error && <div className={styles.errorBanner}><p>{error}</p></div>}
      <div className={styles.formContainer}>
        <form onSubmit={handleSubmit} className={styles.form}>
          <div className={styles.formSection}>
            <div className={styles.formGrid}>
              <div className={styles.formGroup}>
                <label htmlFor="model-manufacturer" className={`${styles.formLabel} ${styles.required}`}>Manufacturer</label>
                <select id="model-manufacturer" value={formData.manufacturerId} onChange={(e) => setFormData(p => ({...p, manufacturerId: e.target.value}))} disabled={isEditing} className={`${styles.formSelect} ${formErrors.manufacturerId ? styles.error : ''}`}>
                  <option value="">Select...</option>
                  {manufacturers.map(m => <option key={m.manufacturerId} value={m.manufacturerId}>{m.name}</option>)}
                </select>
                {formErrors.manufacturerId && <span className={styles.formError}>{formErrors.manufacturerId}</span>}
              </div>
              <div className={styles.formGroup}>
                <label htmlFor="model-name" className={`${styles.formLabel} ${styles.required}`}>Model Name</label>
                <input id="model-name" type="text" value={formData.modelName} onChange={(e) => setFormData(p => ({...p, modelName: e.target.value}))} className={`${styles.formInput} ${formErrors.modelName ? styles.error : ''}`} placeholder="e.g., PowerEdge R750" />
                {formErrors.modelName && <span className={styles.formError}>{formErrors.modelName}</span>}
              </div>
              <div className={styles.formGroup}>
                <label htmlFor="model-number" className={styles.formLabel}>Model Number</label>
                <input id="model-number" type="text" value={formData.modelNumber} onChange={(e) => setFormData(p => ({...p, modelNumber: e.target.value}))} className={styles.formInput} placeholder="e.g., R750xs" />
              </div>
              <div className={styles.formGroup}>
                <label htmlFor="model-sku" className={styles.formLabel}>SKU</label>
                <input id="model-sku" type="text" value={formData.sku} onChange={(e) => setFormData(p => ({...p, sku: e.target.value}))} className={styles.formInput} />
              </div>
              <div className={styles.formGroup}>
                <label htmlFor="model-category" className={styles.formLabel}>Category</label>
                <input id="model-category" type="text" value={formData.category} onChange={(e) => setFormData(p => ({...p, category: e.target.value}))} className={styles.formInput} placeholder="e.g., Server" />
              </div>
              {isEditing && (
                <div className={styles.formGroup}>
                  <label htmlFor="model-status" className={styles.formLabel}>Lifecycle Status</label>
                  <select id="model-status" value={formData.status} onChange={(e) => setFormData(p => ({...p, status: e.target.value as ModelStatus}))} className={styles.formSelect}>
                    {MODEL_STATUSES.map(s => <option key={s.value} value={s.value}>{s.label}</option>)}
                  </select>
                </div>
              )}
            </div>
          </div>
          <div className={styles.formActions}>
            <button type="button" className={styles.secondaryButton} onClick={() => navigate('/admin/products')} disabled={isSaving}>Cancel</button>
            <button type="submit" className={styles.primaryButton} disabled={isSaving}>{isSaving ? 'Saving...' : 'Save'}</button>
          </div>
        </form>
      </div>
    </div>
  );
}

export default ModelForm;
