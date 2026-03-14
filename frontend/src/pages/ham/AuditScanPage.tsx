import { useState } from 'react';
import { Form } from '@ams/ui';
import { PageLayout } from '../../components/layout/PageLayout';
import { ErrorMessage } from '../../components/ui/ErrorMessage';
import { EmptyState } from '../../components/ui/EmptyState';
import {
  recordAuditScan,
  type AuditScan,
} from '../../services/ham-api';
import styles from '../Page.module.css';

export function AuditScanPage() {
  const [error, setError] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [initialValues, setInitialValues] = useState({ assetTag: '', locationId: '' });
  const [scanResult, setScanResult] = useState<string | null>(null);
  const [recentScans, setRecentScans] = useState<AuditScan[]>([]);

  const validateScanForm = (values: Record<string, any>) => {
    const errors: Record<string, string> = {};
    if (!values.assetTag?.trim()) errors.assetTag = 'Asset Tag is required';
    if (!values.locationId?.trim()) errors.locationId = 'Location ID is required';
    return errors;
  };

  const handleScan = async (values: Record<string, any>) => {
    try {
      setIsSaving(true);
      setScanResult(null);
      setError(null);
      const scan = await recordAuditScan({
        assetTag: values.assetTag.trim(),
        locationId: values.locationId.trim(),
      });
      setScanResult(scan.matched ? 'Match confirmed' : 'Mismatch detected');
      setRecentScans((prev) => [scan, ...prev]);
      setInitialValues({ assetTag: '', locationId: '' });
    } catch {
      setError('Failed to record scan. Please try again.');
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <PageLayout
      title="Audit Scans"
      description="Record asset audit scans and review discrepancies"
      breadcrumbs={[{ label: 'Dashboard', href: '/' }, { label: 'Audit Scans' }]}
      maxWidth="xl"
    >
      <div className={styles.pageContent}>
        <Form
          initialValues={initialValues}
          onSubmit={handleScan}
          validate={validateScanForm}
          className={styles.form}
        >
          <Form.Section title="Record Scan" columns={2}>
            <Form.Field name="assetTag" label="Asset Tag" required>
              <Form.Input
                name="assetTag"
                placeholder="AMS-HW-..."
                disabled={isSaving}
              />
            </Form.Field>
            <Form.Field name="locationId" label="Location ID" required>
              <Form.Input
                name="locationId"
                placeholder="Location ID"
                disabled={isSaving}
              />
            </Form.Field>
          </Form.Section>
          <Form.Actions>
            <Form.Submit
              label={isSaving ? 'Recording...' : 'Record Scan'}
              disableUntilDirty
            />
          </Form.Actions>
        </Form>

        {scanResult && (
          <div role="status" className={styles.statusMessage}>
            {scanResult}
          </div>
        )}

        {error && (
          <ErrorMessage
            title="Error"
            message={error}
            type="error"
            variant="inline"
          />
        )}

        <h2 className={styles.sectionHeading}>Recent Scans</h2>

        {recentScans.length === 0 && (
          <EmptyState
            title="No scans recorded"
            description="Use the form above to scan an asset tag and verify its location."
          />
        )}

        {recentScans.length > 0 && (
          <table className={styles.dataTable || ''} role="table" aria-label="Recent audit scans">
            <thead>
              <tr>
                <th scope="col">Asset Tag</th>
                <th scope="col">Location</th>
                <th scope="col">Scanned By</th>
                <th scope="col">Scanned At</th>
                <th scope="col">Result</th>
              </tr>
            </thead>
            <tbody>
              {recentScans.map((s) => (
                <tr key={s.scanId}>
                  <td>{s.assetTag}</td>
                  <td>{s.locationName}</td>
                  <td>{s.scannedBy}</td>
                  <td>{new Date(s.scannedAt).toLocaleString()}</td>
                  <td>{s.matched ? 'Matched' : 'Mismatch'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </PageLayout>
  );
}
