import { useState, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { PageLayout } from '../components/layout/PageLayout';
import { AssetForm } from '../components/asset-form/AssetForm';
import type { AssetFormData } from '../components/asset-form/validation';
import { assetApi } from '../services/asset-api';
import { buildAssetAttributes } from './asset-form-payload';

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
      const attributes = buildAssetAttributes(assetType, data);
      const asset = await assetApi.create({
        assetType,
        displayName: data.displayName,
        description: data.description || undefined,
        status: data.status,
        attributes: Object.keys(attributes).length > 0 ? attributes : undefined,
      });
      navigate(`/assets/${asset.assetId}`);
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
