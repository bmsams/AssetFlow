import { useState, useEffect, useCallback } from 'react';
import { useNavigate, useParams, Link } from 'react-router-dom';
import { adminApi } from '../../services/admin-api';
import type { Department, UserDetails, UpdateUserRequest } from '../../types/admin';
import styles from './AdminPage.module.css';

/**
 * User Edit Page
 * Allows updating firstName, lastName, departmentId, and managerId.
 * Department selector populated from adminApi (Requirement 9.3).
 */
export function UserEditPage() {
  const navigate = useNavigate();
  const { userId } = useParams<{ userId: string }>();

  const [departments, setDepartments] = useState<Department[]>([]);
  const [users, setUsers] = useState<UserDetails[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [formData, setFormData] = useState({
    firstName: '',
    lastName: '',
    departmentId: '',
    managerId: '',
  });
  const [formErrors, setFormErrors] = useState<Record<string, string>>({});

  // Load departments from adminApi for the Department selector (Requirement 9.3)
  useEffect(() => {
    adminApi.departments.list({ isActive: true }, { pageSize: 100 })
      .then(res => setDepartments(res.items))
      .catch(() => setDepartments([]));
  }, []);

  // Load users for the Manager selector
  useEffect(() => {
    adminApi.users.list({ isActive: true }, { pageSize: 100 })
      .then(res => setUsers(res.items.filter(u => u.userId !== userId)))
      .catch(() => setUsers([]));
  }, [userId]);

  // Load existing user data
  const loadUser = useCallback(async () => {
    if (!userId) return;
    try {
      setIsLoading(true);
      setError(null);
      const user = await adminApi.users.get(userId);
      setFormData({
        firstName: user.firstName || '',
        lastName: user.lastName || '',
        departmentId: user.departmentId || '',
        managerId: user.managerId || '',
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load user');
    } finally {
      setIsLoading(false);
    }
  }, [userId]);

  useEffect(() => {
    loadUser();
  }, [loadUser]);

  const validateForm = () => {
    const errors: Record<string, string> = {};
    if (!formData.firstName.trim()) errors.firstName = 'First name is required';
    if (!formData.lastName.trim()) errors.lastName = 'Last name is required';
    setFormErrors(errors);
    return Object.keys(errors).length === 0;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!validateForm() || !userId) return;
    try {
      setIsSaving(true);
      setError(null);
      const data: UpdateUserRequest = {
        firstName: formData.firstName,
        lastName: formData.lastName,
        departmentId: formData.departmentId || undefined,
        managerId: formData.managerId || undefined,
      };
      await adminApi.users.update(userId, data);
      navigate('/admin/users');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to update user');
    } finally {
      setIsSaving(false);
    }
  };

  if (isLoading) {
    return (
      <div className={styles.adminPage}>
        <div className={`${styles.skeleton} ${styles.skeletonFormMedium}`} />
      </div>
    );
  }

  return (
    <div className={styles.adminPage}>
      <nav className={styles.breadcrumb}>
        <Link to="/admin/users" className={styles.breadcrumbLink}>Users</Link>
        <span className={styles.breadcrumbSeparator}>/</span>
        <span className={styles.breadcrumbCurrent}>Edit</span>
      </nav>
      <div className={styles.pageHeader}>
        <h1 className={styles.pageTitle}>Edit User</h1>
      </div>
      {error && <div className={styles.errorBanner}><p>{error}</p></div>}
      <div className={styles.formContainer}>
        <form onSubmit={handleSubmit} className={styles.form}>
          <div className={styles.formSection}>
            <div className={styles.formGrid}>
              <div className={styles.formGroup}>
                <label className={`${styles.formLabel} ${styles.required}`}>First Name</label>
                <input
                  type="text"
                  value={formData.firstName}
                  onChange={(e) => setFormData(p => ({ ...p, firstName: e.target.value }))}
                  className={`${styles.formInput} ${formErrors.firstName ? styles.error : ''}`}
                />
                {formErrors.firstName && <span className={styles.formError}>{formErrors.firstName}</span>}
              </div>
              <div className={styles.formGroup}>
                <label className={`${styles.formLabel} ${styles.required}`}>Last Name</label>
                <input
                  type="text"
                  value={formData.lastName}
                  onChange={(e) => setFormData(p => ({ ...p, lastName: e.target.value }))}
                  className={`${styles.formInput} ${formErrors.lastName ? styles.error : ''}`}
                />
                {formErrors.lastName && <span className={styles.formError}>{formErrors.lastName}</span>}
              </div>
              <div className={styles.formGroup}>
                <label className={styles.formLabel}>Department</label>
                <select
                  value={formData.departmentId}
                  onChange={(e) => setFormData(p => ({ ...p, departmentId: e.target.value }))}
                  className={styles.formSelect}
                >
                  <option value="">None</option>
                  {departments.map(d => (
                    <option key={d.departmentId} value={d.departmentId}>{d.name}</option>
                  ))}
                </select>
              </div>
              <div className={styles.formGroup}>
                <label className={styles.formLabel}>Manager</label>
                <select
                  value={formData.managerId}
                  onChange={(e) => setFormData(p => ({ ...p, managerId: e.target.value }))}
                  className={styles.formSelect}
                >
                  <option value="">None</option>
                  {users.map(u => (
                    <option key={u.userId} value={u.userId}>
                      {u.firstName && u.lastName ? `${u.firstName} ${u.lastName}` : u.email}
                    </option>
                  ))}
                </select>
              </div>
            </div>
          </div>
          <div className={styles.formActions}>
            <button type="button" className={styles.secondaryButton} onClick={() => navigate('/admin/users')} disabled={isSaving}>
              Cancel
            </button>
            <button type="submit" className={styles.primaryButton} disabled={isSaving}>
              {isSaving ? 'Saving...' : 'Save'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

export default UserEditPage;
