import { useState, useEffect, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { PageLayout } from '../components/layout/PageLayout';
import { AssetForm } from '../components/asset-form/AssetForm';
import type { AssetFormData } from '../components/asset-form/validation';
import { assetApi } from '../services/asset-api';
import type { AnyAsset } from '../types/asset';
import { buildAssetAttributes } from './asset-form-payload';

/**
 * AssetEditPage - Wraps AssetForm in edit mode with fetched asset data
 * Implements Requirements 2.3, 2.4, 2.5: Asset editing with pre-populated data
 */
export function AssetEditPage() {
  const { assetId } = useParams<{ assetId: string }>();
  const navigate = useNavigate();
  const [asset, setAsset] = useState<AnyAsset | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);

  useEffect(() => {
    if (!assetId) return;

    let isMounted = true;

    async function fetchAsset() {
      try {
        setIsLoading(true);
        setLoadError(null);
        const data = await assetApi.get(assetId);
        if (isMounted) {
          setAsset(data as AnyAsset);
        }
      } catch (err) {
        if (isMounted) {
          setLoadError(err instanceof Error ? err.message : 'Failed to load asset');
        }
      } finally {
        if (isMounted) {
          setIsLoading(false);
        }
      }
    }

    void fetchAsset();

    return () => {
      isMounted = false;
    };
  }, [assetId]);

  const handleSubmit = useCallback(async (data: AssetFormData) => {
    if (!assetId || !asset) return;

    setIsSubmitting(true);
    try {
      if (data.status !== asset.status) {
        await assetApi.transitionState(assetId, {
          newState: data.status,
          reason: 'Updated via edit form',
        });
      }

      const attributes = buildAssetAttributes(asset.assetType, data);

      await assetApi.update(assetId, {
        displayName: data.displayName,
        description: data.description || undefined,
        attributes: Object.keys(attributes).length > 0 ? attributes : undefined,
      });
      navigate(`/assets/${assetId}`);
    } finally {
      setIsSubmitting(false);
    }
  }, [assetId, asset, navigate]);

  const handleCancel = useCallback(() => {
    navigate(`/assets/${assetId}`);
  }, [assetId, navigate]);

  if (!assetId) {
    return (
      <PageLayout
        title="Edit Asset"
        breadcrumbs={[
          { label: 'Dashboard', href: '/' },
          { label: 'Assets', href: '/assets' },
          { label: 'Edit Asset' },
        ]}
      >
        <div role="alert" style={{ color: 'var(--color-error, #dc2626)' }}>
          Asset ID is required
        </div>
      </PageLayout>
    );
  }

  if (isLoading) {
    return (
      <PageLayout
        title="Edit Asset"
        description="Loading asset data..."
        breadcrumbs={[
          { label: 'Dashboard', href: '/' },
          { label: 'Assets', href: '/assets' },
          { label: 'Edit Asset' },
        ]}
        maxWidth="lg"
      >
        <div style={{ textAlign: 'center', padding: '3rem' }}>Loading...</div>
      </PageLayout>
    );
  }

  if (loadError || !asset) {
    return (
      <PageLayout
        title="Edit Asset"
        breadcrumbs={[
          { label: 'Dashboard', href: '/' },
          { label: 'Assets', href: '/assets' },
          { label: 'Edit Asset' },
        ]}
        maxWidth="lg"
      >
        <div role="alert" style={{ color: 'var(--color-error, #dc2626)', textAlign: 'center', padding: '3rem' }}>
          <p>{loadError || 'Asset not found'}</p>
          <button type="button" onClick={() => navigate(`/assets/${assetId}`)} style={{ marginTop: '1rem' }}>
            Back to Asset
          </button>
        </div>
      </PageLayout>
    );
  }

  return (
    <PageLayout
      title={`Edit: ${asset.displayName}`}
      description="Update the asset information below"
      breadcrumbs={[
        { label: 'Dashboard', href: '/' },
        { label: 'Assets', href: '/assets' },
        { label: asset.displayName, href: `/assets/${assetId}` },
        { label: 'Edit' },
      ]}
      maxWidth="lg"
    >
      <AssetForm
        mode="edit"
        initialData={asset}
        onSubmit={handleSubmit}
        onCancel={handleCancel}
        isSubmitting={isSubmitting}
      />
    </PageLayout>
  );
}

export default AssetEditPage;
