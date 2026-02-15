import { useState, useEffect } from 'react';
import { useNavigate, useParams, Link } from 'react-router-dom';
import { adminApi } from '../../services/admin-api';
import type { Department, CreateDepartmentRequest, UpdateDepartmentRequest } from '../../types/admin';
import styles from './AdminPage.module.css';

/**
 * Department Form Component
 * Implements Task 16.3.2: Create DepartmentForm.tsx for create/edit
 */
export function DepartmentForm() {
  const navigate = useNavigate();
  const { departmentId } = useParams<{ departmentId: string }>();
  const isEditing = !!(departmentId && departmentId !== 'new');

  const [departments, setDepartments] = useState<Department[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [formData, setFormData] = useState({
    code: '',
    name: '',
    parentDepartmentId: '',
  });
  const [formErrors, setFormErrors] = useState<Record<string, string>>({});

  useEffect(() => {
    adminApi.departments.list({ isActive: true }, { pageSize: 100 })
      .then(res => setDepartments(res.items.filter(d => d.departmentId !== departmentId)))
      .catch(() => setDepartments([]));
  }, [departmentId]);

  useEffect(() => {
    if (isEditing && departmentId) {
      setIsLoading(true);
      adminApi.departments.get(departmentId)
        .then(dept => {
          setFormData({
            code: dept.code,
            name: dept.name,
            parentDepartmentId: dept.parentDepartmentId || '',
          });
        })
        .catch(err => setError(err.message))
        .finally(() => setIsLoading(false));
    }
  }, [departmentId, isEditing]);

  const validateForm = () => {
    const errors: Record<string, string> = {};
    if (!formData.code.trim()) errors.code = 'Code is required';
    if (!formData.name.trim()) errors.name = 'Name is required';
    setFormErrors(errors);
    return Object.keys(errors).length === 0;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!validateForm()) return;

    try {
      setIsSaving(true);
      setError(null);
      if (isEditing && departmentId) {
        const data: UpdateDepartmentRequest = {
          name: formData.name,
          parentDepartmentId: formData.parentDepartmentId || undefined,
        };
        await adminApi.departments.update(departmentId, data);
      } else {
        const data: CreateDepartmentRequest = {
          code: formData.code,
          name: formData.name,
          parentDepartmentId: formData.parentDepartmentId || undefined,
        };
        await adminApi.departments.create(data);
      }
      navigate('/admin/departments');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save department');
    } finally {
      setIsSaving(false);
    }
  };

  if (isLoading) return <div className={styles.adminPage}><div className={`${styles.skeleton} ${styles.skeletonFormMedium}`}/></div>;

  return (
    <div className={styles.adminPage}>
      <nav className={styles.breadcrumb}>
        <Link to="/admin/departments" className={styles.breadcrumbLink}>Departments</Link>
        <span className={styles.breadcrumbSeparator}>/</span>
        <span className={styles.breadcrumbCurrent}>{isEditing ? 'Edit' : 'New'}</span>
      </nav>

      <div className={styles.pageHeader}>
        <h1 className={styles.pageTitle}>{isEditing ? 'Edit Department' : 'New Department'}</h1>
      </div>

      {error && <div className={styles.errorBanner}><p>{error}</p></div>}

      <div className={styles.formContainer}>
        <form onSubmit={handleSubmit} className={styles.form}>
          <div className={styles.formSection}>
            <div className={styles.formGrid}>
              <div className={styles.formGroup}>
                <label htmlFor="dept-code" className={`${styles.formLabel} ${styles.required}`}>Code</label>
                <input id="dept-code" type="text" value={formData.code} onChange={(e) => setFormData(p => ({...p, code: e.target.value}))} disabled={isEditing} className={`${styles.formInput} ${formErrors.code ? styles.error : ''}`} placeholder="e.g., IT" />
                {formErrors.code && <span className={styles.formError}>{formErrors.code}</span>}
              </div>
              <div className={styles.formGroup}>
                <label htmlFor="dept-name" className={`${styles.formLabel} ${styles.required}`}>Name</label>
                <input id="dept-name" type="text" value={formData.name} onChange={(e) => setFormData(p => ({...p, name: e.target.value}))} className={`${styles.formInput} ${formErrors.name ? styles.error : ''}`} placeholder="e.g., Information Technology" />
                {formErrors.name && <span className={styles.formError}>{formErrors.name}</span>}
              </div>
              <div className={styles.formGroup}>
                <label htmlFor="dept-parent" className={styles.formLabel}>Parent Department</label>
                <select id="dept-parent" value={formData.parentDepartmentId} onChange={(e) => setFormData(p => ({...p, parentDepartmentId: e.target.value}))} className={styles.formSelect}>
                  <option value="">None (Top Level)</option>
                  {departments.map(d => <option key={d.departmentId} value={d.departmentId}>{d.name}</option>)}
                </select>
              </div>
            </div>
          </div>
          <div className={styles.formActions}>
            <button type="button" className={styles.secondaryButton} onClick={() => navigate('/admin/departments')} disabled={isSaving}>Cancel</button>
            <button type="submit" className={styles.primaryButton} disabled={isSaving}>{isSaving ? 'Saving...' : 'Save'}</button>
          </div>
        </form>
      </div>
    </div>
  );
}

export default DepartmentForm;
