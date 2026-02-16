import { useState, useEffect, useCallback } from 'react';
import { useNavigate, useParams, Link } from 'react-router-dom';
import { Form } from '@ams/ui';
import { adminApi } from '../../services/admin-api';
import type { Department, UserDetails, UpdateUserRequest } from '../../types/admin';
import styles from './AdminPage.module.css';

/**
 * User Edit Page
 * Allows updating firstName, lastName, departmentId, and managerId.
 * Department selector populated from adminApi (Requirement 9.3).
 *
 * Migrated to use Form compound component from @ams/ui.
 */
export function UserEditPage() {
  const navigate = useNavigate();
  const { userId } = useParams<{ userId: string }>();

  const [departments, setDepartments] = useState<Department[]>([]);
  const [users, setUsers] = useState<UserDetails[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [initialValues, setInitialValues] = useState({
    firstName: '',
    lastName: '',
    departmentId: '',
    managerId: '',
  });

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
      setInitialValues({
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

  const validateForm = useCallback((values: Record<string, any>): Record<string, string> => {
    const errors: Record<string, string> = {};
    if (!values.firstName?.trim()) errors.firstName = 'First name is required';
    if (!values.lastName?.trim()) errors.lastName = 'Last name is required';
    return errors;
  }, []);

  const handleSubmit = useCallback(async (values: Record<string, any>) => {
    if (!userId) return;
    try {
      setIsSaving(true);
      setError(null);
      const data: UpdateUserRequest = {
        firstName: values.firstName,
        lastName: values.lastName,
        departmentId: values.departmentId || undefined,
        managerId: values.managerId || undefined,
      };
      await adminApi.users.update(userId, data);
      navigate('/admin/users');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to update user');
    } finally {
      setIsSaving(false);
    }
  }, [userId, navigate]);

  const departmentOptions = departments.map(d => ({
    value: d.departmentId,
    label: d.name,
  }));

  const managerOptions = users.map(u => ({
    value: u.userId,
    label: u.firstName && u.lastName ? `${u.firstName} ${u.lastName}` : u.email,
  }));

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
        <Form
          initialValues={initialValues}
          onSubmit={handleSubmit}
          validate={validateForm}
          className={styles.form}
        >
          <Form.Section title="User Details" columns={2}>
            <Form.Field name="firstName" label="First Name" required>
              <Form.Input name="firstName" placeholder="Enter first name" disabled={isSaving} />
            </Form.Field>
            <Form.Field name="lastName" label="Last Name" required>
              <Form.Input name="lastName" placeholder="Enter last name" disabled={isSaving} />
            </Form.Field>
            <Form.Field name="departmentId" label="Department">
              <Form.Select
                name="departmentId"
                options={departmentOptions}
                placeholder="None"
                disabled={isSaving}
              />
            </Form.Field>
            <Form.Field name="managerId" label="Manager">
              <Form.Select
                name="managerId"
                options={managerOptions}
                placeholder="None"
                disabled={isSaving}
              />
            </Form.Field>
          </Form.Section>
          <Form.Actions>
            <Form.Submit
              label={isSaving ? 'Saving...' : 'Save'}
              cancelLabel="Cancel"
              onCancel={() => navigate('/admin/users')}
              disableUntilDirty
            />
          </Form.Actions>
        </Form>
      </div>
    </div>
  );
}

export default UserEditPage;
