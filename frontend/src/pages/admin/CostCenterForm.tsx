import { useState, useEffect } from 'react';
import { useNavigate, useParams, Link } from 'react-router-dom';
import { Form } from '@ams/ui';
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

  const [initialValues, setInitialValues] = useState({
    code: '',
    name: '',
    departmentId: '',
    budgetAmount: '',
    fiscalYear: new Date().getFullYear().toString(),
  });

  type CostCenterFormValues = {
    code: string;
    name: string;
    departmentId: string;
    budgetAmount: string;
    fiscalYear: string;
  };

  const getValue = (values: Record<string, unknown>, key: keyof CostCenterFormValues): string => {
    const value = values[key];
    return typeof value === 'string' ? value : '';
  };

  useEffect(() => {
    adminApi.departments.list(isEditing ? undefined : { isActive: true }, { pageSize: 100 })
      .then(res => setDepartments(res.items)).catch(() => {});
  }, [isEditing]);

  useEffect(() => {
    if (isEditing && costCenterId) {
      setIsLoading(true);
      adminApi.costCenters.get(costCenterId)
        .then(cc => {
          setInitialValues({
            code: cc.code,
            name: cc.name,
            departmentId: cc.departmentId || '',
            budgetAmount: String(cc.budgetAmount),
            fiscalYear: String(cc.fiscalYear),
          });
        })
        .catch((err: unknown) => setError(err instanceof Error ? err.message : 'Failed to load cost center'))
        .finally(() => setIsLoading(false));
    }
  }, [costCenterId, isEditing]);

  const validateForm = (values: Record<string, unknown>) => {
    const errors: Record<string, string> = {};
    const code = getValue(values, 'code').trim();
    const name = getValue(values, 'name').trim();
    const budgetAmount = getValue(values, 'budgetAmount').trim();
    const fiscalYear = getValue(values, 'fiscalYear').trim();

    if (!code) errors.code = 'Code is required';
    if (!name) errors.name = 'Name is required';
    if (!budgetAmount || Number(budgetAmount) < 0) errors.budgetAmount = 'Valid budget is required';
    if (!fiscalYear) errors.fiscalYear = 'Fiscal year is required';
    return errors;
  };

  const handleSubmit = async (values: Record<string, unknown>) => {
    const code = getValue(values, 'code').trim();
    const name = getValue(values, 'name').trim();
    const departmentId = getValue(values, 'departmentId').trim();
    const budgetAmount = Number(getValue(values, 'budgetAmount'));
    const fiscalYear = Number(getValue(values, 'fiscalYear'));

    try {
      setIsSaving(true);
      setError(null);
      if (isEditing && costCenterId) {
        const data: UpdateCostCenterRequest = { name, departmentId: departmentId || undefined, budgetAmount };
        await adminApi.costCenters.update(costCenterId, data);
      } else {
        const data: CreateCostCenterRequest = { code, name, departmentId: departmentId || undefined, budgetAmount, fiscalYear };
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
        <Form
          initialValues={initialValues}
          onSubmit={handleSubmit}
          validate={validateForm}
          className={styles.form}
        >
          <Form.Section title="Cost Center Details" columns={2}>
            <Form.Field name="code" label="Code" required>
              <Form.Input
                name="code"
                placeholder="e.g., CC-001"
                disabled={isSaving || isEditing}
              />
            </Form.Field>
            <Form.Field name="name" label="Name" required>
              <Form.Input
                name="name"
                placeholder="Enter cost center name"
                disabled={isSaving}
              />
            </Form.Field>
            <Form.Field name="departmentId" label="Department">
              <Form.Select
                name="departmentId"
                options={[
                  { value: '', label: 'Select...' },
                  ...departments.map((department) => ({
                    value: department.departmentId,
                    label: department.name,
                  })),
                ]}
                placeholder="Select..."
                disabled={isSaving}
              />
            </Form.Field>
            <Form.Field name="budgetAmount" label="Budget Amount" required>
              <Form.Input
                name="budgetAmount"
                type="number"
                min={0}
                step={0.01}
                disabled={isSaving}
              />
            </Form.Field>
            <Form.Field name="fiscalYear" label="Fiscal Year" required>
              <Form.Input
                name="fiscalYear"
                type="number"
                min={2000}
                max={2100}
                disabled={isSaving || isEditing}
              />
            </Form.Field>
          </Form.Section>
          <Form.Actions>
            <Form.Submit
              label={isSaving ? 'Saving...' : 'Save'}
              cancelLabel="Cancel"
              onCancel={() => navigate('/admin/cost-centers')}
              disableUntilDirty
            />
          </Form.Actions>
        </Form>
      </div>
    </div>
  );
}

export default CostCenterForm;
