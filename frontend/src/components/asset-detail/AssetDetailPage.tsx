import { useState, useEffect, useCallback } from 'react';
import { AssetHeader } from './AssetHeader';
import { AssetAttributes } from './AssetAttributes';
import { AssetRelationships } from './AssetRelationships';
import { AssetHistory } from './AssetHistory';
import { AssetAttachments } from './AssetAttachments';
import { assetApi } from '../../services/asset-api';
import type { AnyAssetDetail, AssetStatus } from '../../types/asset';
import styles from './AssetDetailPage.module.css';

export type TabId = 'details' | 'relationships' | 'history' | 'attachments';

const VALID_TRANSITIONS: Record<AssetStatus, AssetStatus[]> = {
  ORDERED: ['RECEIVED'],
  RECEIVED: ['IN_STOCK'],
  IN_STOCK: ['RESERVED', 'DEPLOYED', 'RETIRED'],
  RESERVED: ['DEPLOYED', 'IN_STOCK'],
  DEPLOYED: ['IN_MAINTENANCE', 'RETIRED'],
  IN_MAINTENANCE: ['DEPLOYED', 'RETIRED'],
  RETIRED: ['DISPOSED'],
  DISPOSED: [],
};

export interface AssetDetailPageProps {
  assetId: string;
  onBack?: () => void;
  onAssetClick?: (assetId: string) => void;
}

interface Tab {
  id: TabId;
  label: string;
}

const tabs: Tab[] = [
  { id: 'details', label: 'Details' },
  { id: 'relationships', label: 'Relationships' },
  { id: 'history', label: 'History' },
  { id: 'attachments', label: 'Attachments' },
];

export function AssetDetailPage({
  assetId,
  onBack,
  onAssetClick,
}: AssetDetailPageProps) {
  const [asset, setAsset] = useState<AnyAssetDetail | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<TabId>('details');
  const [editMode, setEditMode] = useState(false);
  const [isTransitioning, setIsTransitioning] = useState(false);
  const [transitionError, setTransitionError] = useState<string | null>(null);

  useEffect(() => {
    let isMounted = true;

    async function fetchAsset() {
      try {
        setIsLoading(true);
        setError(null);
        const result = await assetApi.getDetail(assetId);
        if (isMounted) {
          setAsset(result);
        }
      } catch (err) {
        if (isMounted) {
          setError(err instanceof Error ? err.message : 'Failed to load asset');
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

  const handleBack = useCallback(() => {
    onBack?.();
  }, [onBack]);

  const handleEdit = useCallback(() => {
    setEditMode((prev) => !prev);
  }, []);

  const handleAttributeChange = useCallback(
    (fieldName: string, value: string | number | boolean) => {
      if (!asset) {
        return;
      }

      setAsset({
        ...asset,
        [fieldName]: value,
        updatedAt: new Date().toISOString(),
      } as AnyAssetDetail);
    },
    [asset]
  );

  const handleTransition = useCallback(
    async (targetState: AssetStatus) => {
      if (!asset) {
        return;
      }

      setIsTransitioning(true);
      setTransitionError(null);
      try {
        const updated = await assetApi.transitionState(asset.assetId, {
          newState: targetState,
        });

        setAsset((prev) => ({
          ...(updated as AnyAssetDetail),
          relationships: prev?.relationships ?? [],
          auditHistory: prev?.auditHistory ?? [],
          attachments: prev?.attachments ?? [],
        }));
      } catch (err) {
        setTransitionError(err instanceof Error ? err.message : 'Failed to transition asset state');
      } finally {
        setIsTransitioning(false);
      }
    },
    [asset]
  );

  const handleAddRelationship = useCallback(() => {
    alert('Add relationship dialog would open here');
  }, []);

  const handleAddAttachment = useCallback(() => {
    alert('File upload dialog would open here');
  }, []);

  const handleDownloadAttachment = useCallback((attachment: { url: string }) => {
    window.open(attachment.url, '_blank');
  }, []);

  const handleDeleteAttachment = useCallback(
    (attachmentId: string) => {
      if (!asset || !confirm('Are you sure you want to delete this attachment?')) {
        return;
      }

      setAsset({
        ...asset,
        attachments: asset.attachments.filter((a) => a.attachmentId !== attachmentId),
      } as AnyAssetDetail);
    },
    [asset]
  );

  if (error) {
    return (
      <div className={styles.assetDetailPage}>
        <div className={styles.errorState}>
          <h2 className={styles.errorTitle}>Unable to load asset</h2>
          <p className={styles.errorMessage}>{error}</p>
          <div className={styles.errorActions}>
            <button type="button" onClick={handleBack} className={styles.backButton}>
              Go Back
            </button>
            <button type="button" onClick={() => window.location.reload()} className={styles.retryButton}>
              Retry
            </button>
          </div>
        </div>
      </div>
    );
  }

  if (isLoading && !asset) {
    return (
      <div className={styles.assetDetailPage}>
        <AssetHeader asset={{} as AnyAssetDetail} onBack={handleBack} isLoading={true} />
      </div>
    );
  }

  if (!asset) {
    return null;
  }

  return (
    <div className={styles.assetDetailPage}>
      <div data-tour="asset-header">
        <AssetHeader asset={asset} onBack={handleBack} onEdit={handleEdit} isLoading={isLoading} />
      </div>

      {VALID_TRANSITIONS[asset.status]?.length > 0 && (
        <div className={styles.transitionBar}>
          <span className={styles.transitionLabel}>Transition to:</span>
          <div className={styles.transitionActions}>
            {VALID_TRANSITIONS[asset.status].map((targetState) => (
              <button
                key={targetState}
                type="button"
                className={styles.transitionButton}
                onClick={() => handleTransition(targetState)}
                disabled={isTransitioning}
              >
                {isTransitioning ? 'Transitioning...' : targetState.replace(/_/g, ' ')}
              </button>
            ))}
          </div>
          {transitionError && <p className={styles.transitionError}>{transitionError}</p>}
        </div>
      )}

      <div className={styles.tabsContainer} data-tour="asset-tabs">
        <div className={styles.tabs} role="tablist" aria-label="Asset sections">
          {tabs.map((tab) => (
            <button
              key={tab.id}
              type="button"
              role="tab"
              id={`tab-${tab.id}`}
              aria-selected={activeTab === tab.id}
              aria-controls={`tabpanel-${tab.id}`}
              className={`${styles.tab} ${activeTab === tab.id ? styles.tabActive : ''}`}
              onClick={() => setActiveTab(tab.id)}
            >
              <span>{tab.label}</span>
            </button>
          ))}
        </div>
      </div>

      <div className={styles.tabContent} role="tabpanel" id={`tabpanel-${activeTab}`} aria-labelledby={`tab-${activeTab}`}>
        {activeTab === 'details' && (
          <AssetAttributes
            asset={asset}
            editMode={editMode}
            onAttributeChange={handleAttributeChange}
            isLoading={isLoading}
          />
        )}
        {activeTab === 'relationships' && (
          <AssetRelationships
            relationships={asset.relationships}
            onAssetClick={onAssetClick}
            onAddRelationship={handleAddRelationship}
            isLoading={isLoading}
          />
        )}
        {activeTab === 'history' && <AssetHistory history={asset.auditHistory} isLoading={isLoading} />}
        {activeTab === 'attachments' && (
          <AssetAttachments
            attachments={asset.attachments}
            onDownload={handleDownloadAttachment}
            onAddAttachment={handleAddAttachment}
            onDeleteAttachment={handleDeleteAttachment}
            isLoading={isLoading}
          />
        )}
      </div>
    </div>
  );
}

export default AssetDetailPage;
