import { useEffect, useMemo, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { assetApi } from '../services/asset-api';
import type { AnyAssetDetail, AssetStatus } from '../types/asset';
import styles from './AssetLifecyclePage.module.css';

interface LifecycleTransition {
  fromStatus: AssetStatus;
  toStatus: AssetStatus;
  label: string;
  description: string;
  color: string;
}

interface LifecycleState {
  status: AssetStatus;
  label: string;
  color: string;
  icon: string;
  order: number;
}

const LIFECYCLE_STATES: LifecycleState[] = [
  { status: 'ORDERED', label: 'Ordered', color: '#2563eb', icon: 'shopping_cart', order: 1 },
  { status: 'RECEIVED', label: 'Received', color: '#7c3aed', icon: 'inventory', order: 2 },
  { status: 'IN_STOCK', label: 'In Stock', color: '#059669', icon: 'inventory_2', order: 3 },
  { status: 'RESERVED', label: 'Reserved', color: '#d97706', icon: 'bookmark', order: 4 },
  { status: 'DEPLOYED', label: 'Deployed', color: '#0284c7', icon: 'check_circle', order: 5 },
  { status: 'IN_MAINTENANCE', label: 'Maintenance', color: '#ea580c', icon: 'build', order: 6 },
  { status: 'RETIRED', label: 'Retired', color: '#6b7280', icon: 'archive', order: 7 },
  { status: 'DISPOSED', label: 'Disposed', color: '#4b5563', icon: 'delete_forever', order: 8 },
];

const LIFECYCLE_TRANSITIONS: LifecycleTransition[] = [
  { fromStatus: 'ORDERED', toStatus: 'RECEIVED', label: 'Receive', description: 'Mark as received', color: '#7c3aed' },
  { fromStatus: 'RECEIVED', toStatus: 'IN_STOCK', label: 'Store', description: 'Move into stock', color: '#059669' },
  { fromStatus: 'IN_STOCK', toStatus: 'RESERVED', label: 'Reserve', description: 'Reserve for deployment', color: '#d97706' },
  { fromStatus: 'IN_STOCK', toStatus: 'DEPLOYED', label: 'Deploy', description: 'Deploy directly from stock', color: '#0284c7' },
  { fromStatus: 'RESERVED', toStatus: 'DEPLOYED', label: 'Deploy', description: 'Deploy reserved asset', color: '#0284c7' },
  { fromStatus: 'DEPLOYED', toStatus: 'IN_STOCK', label: 'Return', description: 'Return to stock', color: '#059669' },
  { fromStatus: 'DEPLOYED', toStatus: 'IN_MAINTENANCE', label: 'Maintenance', description: 'Send to maintenance', color: '#ea580c' },
  { fromStatus: 'IN_MAINTENANCE', toStatus: 'DEPLOYED', label: 'Redeploy', description: 'Redeploy after maintenance', color: '#0284c7' },
  { fromStatus: 'IN_MAINTENANCE', toStatus: 'RETIRED', label: 'Retire', description: 'Retire from service', color: '#6b7280' },
  { fromStatus: 'DEPLOYED', toStatus: 'RETIRED', label: 'Retire', description: 'Retire from service', color: '#6b7280' },
  { fromStatus: 'IN_STOCK', toStatus: 'RETIRED', label: 'Retire', description: 'Retire from stock', color: '#6b7280' },
  { fromStatus: 'RETIRED', toStatus: 'DISPOSED', label: 'Dispose', description: 'Dispose permanently', color: '#4b5563' },
];

export function AssetLifecyclePage() {
  const { assetId } = useParams<{ assetId: string }>();
  const navigate = useNavigate();

  const [asset, setAsset] = useState<AnyAssetDetail | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedTransition, setSelectedTransition] = useState<LifecycleTransition | null>(null);
  const [reason, setReason] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    if (!assetId) {
      setError('Asset ID is required');
      setIsLoading(false);
      return;
    }
    const id = assetId;

    let isMounted = true;

    async function loadAsset() {
      try {
        setIsLoading(true);
        setError(null);
        const data = await assetApi.getDetail(id);
        if (isMounted) {
          setAsset(data);
        }
      } catch (err) {
        if (isMounted) {
          setError(err instanceof Error ? err.message : 'Failed to load asset lifecycle');
        }
      } finally {
        if (isMounted) {
          setIsLoading(false);
        }
      }
    }

    loadAsset();

    return () => {
      isMounted = false;
    };
  }, [assetId]);

  const availableTransitions = useMemo(() => {
    if (!asset) {
      return [];
    }
    return LIFECYCLE_TRANSITIONS.filter((transition) => transition.fromStatus === asset.status);
  }, [asset]);

  const currentOrder = LIFECYCLE_STATES.find((state) => state.status === asset?.status)?.order ?? 0;

  async function handleTransitionSubmit() {
    if (!asset || !selectedTransition) {
      return;
    }

    try {
      setIsSubmitting(true);
      const updated = await assetApi.transitionState(asset.assetId, {
        newState: selectedTransition.toStatus,
        reason: reason.trim() || undefined,
      });

      setAsset((prev) => ({
        ...(updated as AnyAssetDetail),
        relationships: prev?.relationships ?? [],
        auditHistory: prev?.auditHistory ?? [],
        attachments: prev?.attachments ?? [],
      }));
      setSelectedTransition(null);
      setReason('');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Transition failed');
    } finally {
      setIsSubmitting(false);
    }
  }

  if (isLoading) {
    return <div className={styles.loading}>Loading asset lifecycle...</div>;
  }

  if (error) {
    return (
      <div className={styles.error}>
        <h3>Error</h3>
        <p>{error}</p>
        <button onClick={() => navigate(-1)}>Go Back</button>
      </div>
    );
  }

  if (!asset) {
    return (
      <div className={styles.error}>
        <h3>Asset Not Found</h3>
        <button onClick={() => navigate(-1)}>Go Back</button>
      </div>
    );
  }

  return (
    <div className={styles.container}>
      <div className={styles.header}>
        <h2>Asset Lifecycle Management</h2>
        <div className={styles.assetInfo}>
          <h3>{asset.displayName}</h3>
          <div className={styles.assetMeta}>
            <span className={styles.assetTag}>{asset.assetTag}</span>
            <span className={styles.assetType}>{asset.assetType}</span>
            <span className={styles.assetStatus}>{asset.status}</span>
          </div>
        </div>
      </div>

      <div className={styles.lifecycleContainer}>
        <div className={styles.lifecycleDiagram}>
          {LIFECYCLE_STATES.map((state) => (
            <div
              key={state.status}
              className={`${styles.lifecycleState} ${asset.status === state.status ? styles.current : ''} ${state.order < currentOrder ? styles.completed : ''}`}
              style={{ borderColor: state.color }}
            >
              <div className={styles.stateIcon} style={{ backgroundColor: state.color }}>
                <span className="material-icons">{state.icon}</span>
              </div>
              <div className={styles.stateLabel}>{state.label}</div>
            </div>
          ))}
        </div>

        <div className={styles.transitionsContainer}>
          <h3>Available Actions</h3>
          {availableTransitions.length === 0 ? (
            <p className={styles.noTransitions}>No transitions available for this status.</p>
          ) : (
            <div className={styles.transitionButtons}>
              {availableTransitions.map((transition) => (
                <button
                  key={`${transition.fromStatus}-${transition.toStatus}`}
                  className={styles.transitionButton}
                  style={{ borderColor: transition.color, color: transition.color }}
                  onClick={() => setSelectedTransition(transition)}
                >
                  {transition.label}
                </button>
              ))}
            </div>
          )}
        </div>

        {selectedTransition && (
          <div className={styles.transitionFormContainer}>
            <div className={styles.transitionForm}>
              <h3>{selectedTransition.label}</h3>
              <p>{selectedTransition.description}</p>
              <textarea
                value={reason}
                onChange={(event) => setReason(event.target.value)}
                rows={3}
                placeholder="Optional reason for this transition"
              />
              <div>
                <button onClick={() => setSelectedTransition(null)} disabled={isSubmitting}>Cancel</button>
                <button onClick={handleTransitionSubmit} disabled={isSubmitting}>
                  {isSubmitting ? 'Processing...' : `Move to ${selectedTransition.toStatus.replace(/_/g, ' ')}`}
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

export default AssetLifecyclePage;
