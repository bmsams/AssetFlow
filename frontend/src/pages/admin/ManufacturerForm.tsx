import { useState, useEffect } from 'react';
import { useNavigate, useParams, Link } from 'react-router-dom';
import { Form } from '@ams/ui';
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
  const [initialValues, setInitialValues] = useState({ name: '', website: '' });

  type ManufacturerFormValues = {
    name: string;
    website: string;
  };

  const getValue = (values: Record<string, unknown>, key: keyof ManufacturerFormValues): string => {
    const value = values[key];
    return typeof value === 'string' ? value : '';
  };

  useEffect(() => {
    if (isEditing && manufacturerId) {
      setIsLoading(true);
      adminApi.manufacturers.get(manufacturerId)
        .then(m => setInitialValues({ name: m.name, website: m.website || '' }))
        .catch((err: unknown) => setError(err instanceof Error ? err.message : 'Failed to load manufacturer'))
        .finally(() => setIsLoading(false));
    }
  }, [manufacturerId, isEditing]);

  const validateForm = (values: Record<string, unknown>) => {
    const errors: Record<string, string> = {};
    const name = getValue(values, 'name').trim();
    const website = getValue(values, 'website').trim();

    if (!name) errors.name = 'Name is required';
    if (website && !/^https?:\/\//.test(website)) errors.website = 'Invalid URL (must start with http:// or https://)';
    return errors;
  };

  const handleSubmit = async (values: Record<string, unknown>) => {
    const name = getValue(values, 'name').trim();
    const website = getValue(values, 'website').trim();

    try {
      setIsSaving(true);
      setError(null);
      if (isEditing && manufacturerId) {
        const data: UpdateManufacturerRequest = { name, website: website || undefined };
        await adminApi.manufacturers.update(manufacturerId, data);
      } else {
        const data: CreateManufacturerRequest = { name, website: website || undefined };
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
        <Form
          initialValues={initialValues}
          onSubmit={handleSubmit}
          validate={validateForm}
          className={styles.form}
        >
          <Form.Section title="Manufacturer Details" columns={2}>
            <Form.Field name="name" label="Name" required>
              <Form.Input
                name="name"
                placeholder="e.g., Dell Technologies"
                disabled={isSaving}
              />
            </Form.Field>
            <Form.Field name="website" label="Website">
              <Form.Input
                name="website"
                type="url"
                placeholder="https://example.com"
                disabled={isSaving}
              />
            </Form.Field>
          </Form.Section>
          <Form.Actions>
            <Form.Submit
              label={isSaving ? 'Saving...' : 'Save'}
              cancelLabel="Cancel"
              onCancel={() => navigate('/admin/manufacturers')}
              disableUntilDirty
            />
          </Form.Actions>
        </Form>
      </div>
    </div>
  );
}

export default ManufacturerForm;
