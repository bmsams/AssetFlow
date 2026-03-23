import { useState, useEffect } from 'react';
import { useNavigate, useParams, Link } from 'react-router-dom';
import { Form } from '@ams/ui';
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

  const [initialValues, setInitialValues] = useState({
    code: '',
    name: '',
    parentDepartmentId: '',
  });

  type DepartmentFormValues = {
    code: string;
    name: string;
    parentDepartmentId: string;
  };

  const getValue = (values: Record<string, unknown>, key: keyof DepartmentFormValues): string => {
    const value = values[key];
    return typeof value === 'string' ? value : '';
  };

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
          setInitialValues({
            code: dept.code,
            name: dept.name,
            parentDepartmentId: dept.parentDepartmentId || '',
          });
        })
        .catch((err: unknown) => setError(err instanceof Error ? err.message : 'Failed to load department'))
        .finally(() => setIsLoading(false));
    }
  }, [departmentId, isEditing]);

  const validateForm = (values: Record<string, unknown>) => {
    const errors: Record<string, string> = {};
    const code = getValue(values, 'code').trim();
    const name = getValue(values, 'name').trim();

    if (!code) errors.code = 'Code is required';
    if (!name) errors.name = 'Name is required';
    return errors;
  };

  const handleSubmit = async (values: Record<string, unknown>) => {
    const name = getValue(values, 'name').trim();
    const parentDepartmentId = getValue(values, 'parentDepartmentId').trim();
    const code = getValue(values, 'code').trim();

    try {
      setIsSaving(true);
      setError(null);
      if (isEditing && departmentId) {
        const data: UpdateDepartmentRequest = {
          name,
          parentDepartmentId: parentDepartmentId || undefined,
        };
        await adminApi.departments.update(departmentId, data);
      } else {
        const data: CreateDepartmentRequest = {
          code,
          name,
          parentDepartmentId: parentDepartmentId || undefined,
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
        <Form
          initialValues={initialValues}
          onSubmit={handleSubmit}
          validate={validateForm}
          className={styles.form}
        >
          <Form.Section title="Department Details" columns={2}>
            <Form.Field name="code" label="Code" required>
              <Form.Input
                name="code"
                placeholder="e.g., IT"
                disabled={isSaving || isEditing}
              />
            </Form.Field>
            <Form.Field name="name" label="Name" required>
              <Form.Input
                name="name"
                placeholder="e.g., Information Technology"
                disabled={isSaving}
              />
            </Form.Field>
            <Form.Field name="parentDepartmentId" label="Parent Department">
              <Form.Select
                name="parentDepartmentId"
                options={[
                  { value: '', label: 'None (Top Level)' },
                  ...departments.map((department) => ({
                    value: department.departmentId,
                    label: department.name,
                  })),
                ]}
                placeholder="None (Top Level)"
                disabled={isSaving}
              />
            </Form.Field>
          </Form.Section>
          <Form.Actions>
            <Form.Submit
              label={isSaving ? 'Saving...' : 'Save'}
              cancelLabel="Cancel"
              onCancel={() => navigate('/admin/departments')}
              disableUntilDirty
            />
          </Form.Actions>
        </Form>
      </div>
    </div>
  );
}

export default DepartmentForm;
