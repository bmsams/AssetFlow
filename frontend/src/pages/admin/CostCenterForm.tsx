import { useState, useEffect } from 'react';
import { useNavigate, useParams, Link } from 'react-router-dom';
import { adminApi } from '../../services/admin-api';
import type { Department, CreateCostCenterRequest, UpdateCostCenterRequest } from '../../types/admin';
import styles from './AdminPage.module.css';

/**
 * Cost Center Form Component
 * Implements Task 16.3.4: Create CostCenterForm.tsx for create/edit
 */
export function CostCenterForm() {
  const navigate = useNavigate();
  const { costCenterId } = useParams<{ costCenterId: string }>();
  const isEditing = !!(costCenterId && costCenterId !== 'new');

  const [departments, setDepartments] = useState<Department[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [formData, setFormData] = useState({
    code: '',
    name: '',
    departmentId: '',
    budgetAmount: '',
    fiscalYear: new Date().getFullYear().toString(),
  });
  const [formErrors, setFormErrors] = useState<Record<string, string>>({});

  useEffect(() => {
    adminApi.departments.list(isEditing ? undefined : { isActive: true }, { pageSize: 100 })
      .then(res => setDepartments(res.items)).catch(() => {});
  }, [isEditing]);

  useEffect(() => {
    if (isEditing && costCenterId) {
      setIsLoading(true);
      adminApi.costCenters.get(costCenterId)
        .then(cc => {
          setFormData({
            code: cc.code,
            name: cc.name,
            departmentId: cc.departmentId || '',
            budgetAmount: String(cc.budgetAmount),
            fiscalYear: String(cc.fiscalYear),
          });
        })
        .catch(err => setError(err.message))
        .finally(() => setIsLoading(false));
    }
  }, [costCenterId, isEditing]);

  const validateForm = () => {
    const errors: Record<string, string> = {};
    if (!formData.code.trim()) errors.code = 'Code is required';
    if (!formData.name.trim()) errors.name = 'Name is required';
    if (!formData.budgetAmount || Number(formData.budgetAmount) < 0) errors.budgetAmount = 'Valid budget is required';
    if (!formData.fiscalYear) errors.fiscalYear = 'Fiscal year is required';
    setFormErrors(errors);
    return Object.keys(errors).length === 0;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!validateForm()) return;
    try {
      setIsSaving(true);
      if (isEditing && costCenterId) {
        const data: UpdateCostCenterRequest = { name: formData.name, departmentId: formData.departmentId || undefined, budgetAmount: Number(formData.budgetAmount) };
        await adminApi.costCenters.update(costCenterId, data);
      } else {
        const data: CreateCostCenterRequest = { code: formData.code, name: formData.name, departmentId: formData.departmentId || undefined, budgetAmount: Number(formData.budgetAmount), fiscalYear: Number(formData.fiscalYear) };
        await adminApi.costCenters.create(data);
      }
      navigate('/admin/cost-centers');
    } catch (err) { setError(err instanceof Error ? err.message : 'Failed to save'); }
    finally { setIsSaving(false); }
  };

  if (isLoading) return <div className={styles.adminPage}><div className={`${styles.skeleton} ${styles.skeletonFormMedium}`}/></div>;

  return (
    <div className={styles.adminPage}>
      <nav className={styles.breadcrumb}>
        <Link to="/admin/cost-centers" className={styles.breadcrumbLink}>Cost Centers</Link>
        <span className={styles.breadcrumbSeparator}>/</span>
        <span className={styles.breadcrumbCurrent}>{isEditing ? 'Edit' : 'New'}</span>
      </nav>
      <div className={styles.pageHeader}><h1 className={styles.pageTitle}>{isEditing ? 'Edit Cost Center' : 'New Cost Center'}</h1></div>
      {error && <div className={styles.errorBanner}><p>{error}</p></div>}
      <div className={styles.formContainer}>
        <form onSubmit={handleSubmit} className={styles.form}>
          <div className={styles.formSection}>
            <div className={styles.formGrid}>
              <div className={styles.formGroup}>
                <label htmlFor="cc-code" className={`${styles.formLabel} ${styles.required}`}>Code</label>
                <input id="cc-code" type="text" value={formData.code} onChange={(e) => setFormData(p => ({...p, code: e.target.value}))} disabled={isEditing} className={`${styles.formInput} ${formErrors.code ? styles.error : ''}`} placeholder="e.g., CC-001" />
                {formErrors.code && <span className={styles.formError}>{formErrors.code}</span>}
              </div>
              <div className={styles.formGroup}>
                <label htmlFor="cc-name" className={`${styles.formLabel} ${styles.required}`}>Name</label>
                <input id="cc-name" type="text" value={formData.name} onChange={(e) => setFormData(p => ({...p, name: e.target.value}))} className={`${styles.formInput} ${formErrors.name ? styles.error : ''}`} />
                {formErrors.name && <span className={styles.formError}>{formErrors.name}</span>}
              </div>
              <div className={styles.formGroup}>
                <label htmlFor="cc-department" className={styles.formLabel}>Department</label>
                <select id="cc-department" value={formData.departmentId} onChange={(e) => setFormData(p => ({...p, departmentId: e.target.value}))} className={styles.formSelect}>
                  <option value="">Select...</option>
                  {departments.map(d => <option key={d.departmentId} value={d.departmentId}>{d.name}</option>)}
                </select>
              </div>
              <div className={styles.formGroup}>
                <label htmlFor="cc-budget" className={`${styles.formLabel} ${styles.required}`}>Budget Amount</label>
                <input id="cc-budget" type="number" value={formData.budgetAmount} onChange={(e) => setFormData(p => ({...p, budgetAmount: e.target.value}))} className={`${styles.formInput} ${formErrors.budgetAmount ? styles.error : ''}`} min="0" step="0.01" />
                {formErrors.budgetAmount && <span className={styles.formError}>{formErrors.budgetAmount}</span>}
              </div>
              <div className={styles.formGroup}>
                <label htmlFor="cc-fiscal-year" className={`${styles.formLabel} ${styles.required}`}>Fiscal Year</label>
                <input id="cc-fiscal-year" type="number" value={formData.fiscalYear} onChange={(e) => setFormData(p => ({...p, fiscalYear: e.target.value}))} disabled={isEditing} className={`${styles.formInput} ${formErrors.fiscalYear ? styles.error : ''}`} min="2000" max="2100" />
                {formErrors.fiscalYear && <span className={styles.formError}>{formErrors.fiscalYear}</span>}
              </div>
            </div>
          </div>
          <div className={styles.formActions}>
            <button type="button" className={styles.secondaryButton} onClick={() => navigate('/admin/cost-centers')} disabled={isSaving}>Cancel</button>
            <button type="submit" className={styles.primaryButton} disabled={isSaving}>{isSaving ? 'Saving...' : 'Save'}</button>
          </div>
        </form>
      </div>
    </div>
  );
}

export default CostCenterForm;
