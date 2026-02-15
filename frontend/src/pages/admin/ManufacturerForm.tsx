import { useState, useEffect } from 'react';
import { useNavigate, useParams, Link } from 'react-router-dom';
import { adminApi } from '../../services/admin-api';
import type { CreateManufacturerRequest, UpdateManufacturerRequest } from '../../types/admin';
import styles from './AdminPage.module.css';

/**
 * Manufacturer Form Component
 * Implements Task 16.3.8: Create ManufacturerForm.tsx for create/edit
 */
export function ManufacturerForm() {
  const navigate = useNavigate();
  const { manufacturerId } = useParams<{ manufacturerId: string }>();
  const isEditing = !!(manufacturerId && manufacturerId !== 'new');

  const [isLoading, setIsLoading] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [formData, setFormData] = useState({ name: '', website: '' });
  const [formErrors, setFormErrors] = useState<Record<string, string>>({});

  useEffect(() => {
    if (isEditing && manufacturerId) {
      setIsLoading(true);
      adminApi.manufacturers.get(manufacturerId)
        .then(m => setFormData({ name: m.name, website: m.website || '' }))
        .catch(err => setError(err.message))
        .finally(() => setIsLoading(false));
    }
  }, [manufacturerId, isEditing]);

  const validateForm = () => {
    const errors: Record<string, string> = {};
    if (!formData.name.trim()) errors.name = 'Name is required';
    if (formData.website && !/^https?:\/\//.test(formData.website)) errors.website = 'Invalid URL (must start with http:// or https://)';
    setFormErrors(errors);
    return Object.keys(errors).length === 0;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!validateForm()) return;
    try {
      setIsSaving(true);
      if (isEditing && manufacturerId) {
        const data: UpdateManufacturerRequest = { name: formData.name, website: formData.website || undefined };
        await adminApi.manufacturers.update(manufacturerId, data);
      } else {
        const data: CreateManufacturerRequest = { name: formData.name, website: formData.website || undefined };
        await adminApi.manufacturers.create(data);
      }
      navigate('/admin/manufacturers');
    } catch (err) { setError(err instanceof Error ? err.message : 'Failed to save'); }
    finally { setIsSaving(false); }
  };

  if (isLoading) return <div className={styles.adminPage}><div className={`${styles.skeleton} ${styles.skeletonFormShort}`}/></div>;

  return (
    <div className={styles.adminPage}>
      <nav className={styles.breadcrumb}>
        <Link to="/admin/manufacturers" className={styles.breadcrumbLink}>Manufacturers</Link>
        <span className={styles.breadcrumbSeparator}>/</span>
        <span className={styles.breadcrumbCurrent}>{isEditing ? 'Edit' : 'New'}</span>
      </nav>
      <div className={styles.pageHeader}><h1 className={styles.pageTitle}>{isEditing ? 'Edit Manufacturer' : 'New Manufacturer'}</h1></div>
      {error && <div className={styles.errorBanner}><p>{error}</p></div>}
      <div className={styles.formContainer}>
        <form onSubmit={handleSubmit} className={styles.form}>
          <div className={styles.formSection}>
            <div className={styles.formGrid}>
              <div className={styles.formGroup}>
                <label htmlFor="mfr-name" className={`${styles.formLabel} ${styles.required}`}>Name</label>
                <input id="mfr-name" type="text" value={formData.name} onChange={(e) => setFormData(p => ({...p, name: e.target.value}))} className={`${styles.formInput} ${formErrors.name ? styles.error : ''}`} placeholder="e.g., Dell Technologies" />
                {formErrors.name && <span className={styles.formError}>{formErrors.name}</span>}
              </div>
              <div className={styles.formGroup}>
                <label htmlFor="mfr-website" className={styles.formLabel}>Website</label>
                <input id="mfr-website" type="url" value={formData.website} onChange={(e) => setFormData(p => ({...p, website: e.target.value}))} className={`${styles.formInput} ${formErrors.website ? styles.error : ''}`} placeholder="https://example.com" />
                {formErrors.website && <span className={styles.formError}>{formErrors.website}</span>}
              </div>
            </div>
          </div>
          <div className={styles.formActions}>
            <button type="button" className={styles.secondaryButton} onClick={() => navigate('/admin/manufacturers')} disabled={isSaving}>Cancel</button>
            <button type="submit" className={styles.primaryButton} disabled={isSaving}>{isSaving ? 'Saving...' : 'Save'}</button>
          </div>
        </form>
      </div>
    </div>
  );
}

export default ManufacturerForm;
