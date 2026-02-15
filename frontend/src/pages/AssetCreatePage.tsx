import { useState, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { PageLayout } from '../components/layout/PageLayout';
import { AssetForm } from '../components/asset-form/AssetForm';
import type { AssetFormData } from '../components/asset-form/validation';
import { assetApi } from '../services/asset-api';

/**
 * AssetCreatePage - Wraps AssetForm in create mode
 * Implements Requirements 2.1, 2.2: Asset creation with type selection
 */
export function AssetCreatePage() {
  const navigate = useNavigate();
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = useCallback(async (data: AssetFormData) => {
    if (!data.assetType) {
      throw new Error('Asset type is required');
    }
    setIsSubmitting(true);
    try {
      const assetType = data.assetType;
      const asset = await assetApi.create({
        assetType,
        displayName: data.displayName,
        description: data.description || undefined,
        status: data.status,
        attributes: {
          status: data.status,
          ...(assetType === 'HARDWARE' && {
            serialNumber: data.serialNumber,
            manufacturer: data.manufacturer,
            model: data.model,
            modelCategory: data.modelCategory,
            cpu: data.cpu,
            memoryGb: data.memoryGb,
            storageGb: data.storageGb,
            operatingSystem: data.operatingSystem,
            ipAddress: data.ipAddress,
            macAddress: data.macAddress,
            purchasePrice: data.purchasePrice,
            warrantyExpiration: data.warrantyExpiration,
          }),
          ...(assetType === 'SOFTWARE' && {
            publisher: data.publisher,
            productName: data.productName,
            version: data.version,
            edition: data.edition,
            licenseType: data.licenseType,
            isSaas: data.isSaas,
          }),
          ...(assetType === 'ENTERPRISE' && {
            serialNumber: data.serialNumber,
            manufacturer: data.manufacturer,
            model: data.model,
            assetClass: data.assetClass,
            criticalityLevel: data.criticalityLevel,
            operatingHours: data.operatingHours,
            meterReading: data.meterReading,
          }),
        },
      });
      navigate(`/assets/${asset.assetId}`);
    } catch (err) {
      // Re-throw so AssetForm can map API errors to field-level errors
      throw err;
    } finally {
      setIsSubmitting(false);
    }
  }, [navigate]);

  const handleCancel = useCallback(() => {
    navigate('/assets');
  }, [navigate]);

  return (
    <PageLayout
      title="Create Asset"
      description="Create a new asset in the system"
      breadcrumbs={[
        { label: 'Dashboard', href: '/' },
        { label: 'Assets', href: '/assets' },
        { label: 'Create Asset' },
      ]}
      maxWidth="lg"
    >
      <AssetForm
        mode="create"
        onSubmit={handleSubmit}
        onCancel={handleCancel}
        isSubmitting={isSubmitting}
      />
    </PageLayout>
  );
}

export default AssetCreatePage;
