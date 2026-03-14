import { useState, useEffect } from 'react';
import { useNavigate, useParams, Link } from 'react-router-dom';
import { Form } from '@ams/ui';
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

  const [initialValues, setInitialValues] = useState({
    manufacturerId: '', modelName: '', modelNumber: '', sku: '', category: '', status: 'ACTIVE' as ModelStatus,
  });

  useEffect(() => {
    adminApi.manufacturers.list({ isActive: true }, { pageSize: 100 })
      .then(res => setManufacturers(res.items)).catch(() => {});
  }, []);

  useEffect(() => {
    if (isEditing && modelId) {
      setIsLoading(true);
      adminApi.models.get(modelId)
        .then(m => setInitialValues({
          manufacturerId: m.manufacturerId, modelName: m.modelName, modelNumber: m.modelNumber || '',
          sku: m.sku || '', category: m.category || '', status: m.status,
        }))
        .catch(err => setError(err.message))
        .finally(() => setIsLoading(false));
    }
  }, [modelId, isEditing]);

  const validateForm = (values: Record<string, any>) => {
    const errors: Record<string, string> = {};
    if (!values.manufacturerId) errors.manufacturerId = 'Manufacturer is required';
    if (!values.modelName?.trim()) errors.modelName = 'Model name is required';
    return errors;
  };

  const handleSubmit = async (values: Record<string, any>) => {
    try {
      setIsSaving(true);
      setError(null);
      if (isEditing && modelId) {
        const data: UpdateModelRequest = {
          modelName: values.modelName, modelNumber: values.modelNumber || undefined,
          sku: values.sku || undefined, category: values.category || undefined, status: values.status,
        };
        await adminApi.models.update(modelId, data);
      } else {
        const data: CreateModelRequest = {
          manufacturerId: values.manufacturerId, modelName: values.modelName,
          modelNumber: values.modelNumber || undefined, sku: values.sku || undefined, category: values.category || undefined,
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
        <Form
          initialValues={initialValues}
          onSubmit={handleSubmit}
          validate={validateForm}
          className={styles.form}
        >
          <Form.Section title="Model Details" columns={2}>
            <Form.Field name="manufacturerId" label="Manufacturer" required>
              <Form.Select
                name="manufacturerId"
                options={[
                  { value: '', label: 'Select...' },
                  ...manufacturers.map((manufacturer) => ({
                    value: manufacturer.manufacturerId,
                    label: manufacturer.name,
                  })),
                ]}
                placeholder="Select..."
                disabled={isSaving || isEditing}
              />
            </Form.Field>
            <Form.Field name="modelName" label="Model Name" required>
              <Form.Input
                name="modelName"
                placeholder="e.g., PowerEdge R750"
                disabled={isSaving}
              />
            </Form.Field>
            <Form.Field name="modelNumber" label="Model Number">
              <Form.Input
                name="modelNumber"
                placeholder="e.g., R750xs"
                disabled={isSaving}
              />
            </Form.Field>
            <Form.Field name="sku" label="SKU">
              <Form.Input name="sku" disabled={isSaving} />
            </Form.Field>
            <Form.Field name="category" label="Category">
              <Form.Input
                name="category"
                placeholder="e.g., Server"
                disabled={isSaving}
              />
            </Form.Field>
            {isEditing && (
              <Form.Field name="status" label="Lifecycle Status">
                <Form.Select
                  name="status"
                  options={MODEL_STATUSES.map((status) => ({
                    value: status.value,
                    label: status.label,
                  }))}
                  disabled={isSaving}
                />
              </Form.Field>
            )}
          </Form.Section>
          <Form.Actions>
            <Form.Submit
              label={isSaving ? 'Saving...' : 'Save'}
              cancelLabel="Cancel"
              onCancel={() => navigate('/admin/products')}
              disableUntilDirty
            />
          </Form.Actions>
        </Form>
      </div>
    </div>
  );
}

export default ModelForm;
