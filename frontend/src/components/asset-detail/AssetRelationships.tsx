import { useCallback } from 'react';
import type { RelatedAsset, RelationshipType, AssetType } from '../../types/asset';
import styles from './AssetRelationships.module.css';

export interface AssetRelationshipsProps {
  /** Related assets to display */
  relationships: RelatedAsset[];
  /** Callback when a related asset is clicked */
  onAssetClick?: (assetId: string) => void;
  /** Callback when add relationship is clicked */
  onAddRelationship?: () => void;
  /** Loading state */
  isLoading?: boolean;
}

const getRelationshipTypeLabel = (type: RelationshipType): string => {
  const labels: Record<RelationshipType, string> = {
    PARENT_CHILD: 'Parent/Child',
    DEPENDENCY: 'Dependency',
    LOCATION: 'Location',
    COMPONENT: 'Component',
  };
  return labels[type];
};

const getRelationshipIcon = (type: RelationshipType): React.ReactNode => {
  switch (type) {
    case 'PARENT_CHILD':
      return (
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
          <path d="M12 2v6m0 0l-3-3m3 3l3-3" />
          <rect x="3" y="14" width="6" height="6" rx="1" />
          <rect x="15" y="14" width="6" height="6" rx="1" />
          <path d="M6 14v-2h12v2" />
          <path d="M12 8v4" />
        </svg>
      );
    case 'DEPENDENCY':
      return (
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
          <circle cx="6" cy="12" r="3" />
          <circle cx="18" cy="12" r="3" />
          <path d="M9 12h6" />
          <path d="M12 9l3 3-3 3" />
        </svg>
      );
    case 'LOCATION':
      return (
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
          <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z" />
          <circle cx="12" cy="10" r="3" />
        </svg>
      );
    case 'COMPONENT':
      return (
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
          <rect x="3" y="3" width="7" height="7" rx="1" />
          <rect x="14" y="3" width="7" height="7" rx="1" />
          <rect x="3" y="14" width="7" height="7" rx="1" />
          <rect x="14" y="14" width="7" height="7" rx="1" />
        </svg>
      );
    default:
      return null;
  }
};

const getAssetTypeLabel = (type: AssetType): string => {
  const labels: Record<AssetType, string> = {
    HARDWARE: 'Hardware',
    SOFTWARE: 'Software',
    ENTERPRISE: 'Enterprise',
  };
  return labels[type];
};

const formatDate = (dateString: string): string => {
  return new Date(dateString).toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  });
};

/**
 * AssetRelationships component displays asset relationships in the CMDB
 * Shows parent-child, dependency, location, and component relationships
 * 
 * Implements Requirements:
 * - 2.3: System shall support asset relationships (parent-child, dependencies)
 */
export function AssetRelationships({
  relationships,
  onAssetClick,
  onAddRelationship,
  isLoading = false,
}: AssetRelationshipsProps) {
  const handleAssetClick = useCallback(
    (assetId: string) => {
      onAssetClick?.(assetId);
    },
    [onAssetClick]
  );

  const handleAddClick = useCallback(() => {
    onAddRelationship?.();
  }, [onAddRelationship]);

  // Group relationships by type
  const groupedRelationships = relationships.reduce(
    (acc, rel) => {
      const type = rel.relationship.relationshipType;
      if (!acc[type]) {
        acc[type] = [];
      }
      acc[type].push(rel);
      return acc;
    },
    {} as Record<RelationshipType, RelatedAsset[]>
  );

  if (isLoading) {
    return (
      <div className={styles.relationshipsContainer} aria-busy="true">
        <div className={styles.header}>
          <div className={styles.skeletonTitle} />
          <div className={styles.skeletonButton} />
        </div>
        <div className={styles.relationshipsList}>
          {[1, 2, 3].map((i) => (
            <div key={i} className={styles.relationshipCard}>
              <div className={styles.skeletonIcon} />
              <div className={styles.skeletonContent}>
                <div className={styles.skeletonName} />
                <div className={styles.skeletonMeta} />
              </div>
            </div>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className={styles.relationshipsContainer}>
      {/* Header */}
      <div className={styles.header}>
        <h3 className={styles.title}>
          Relationships
          <span className={styles.count}>({relationships.length})</span>
        </h3>
        <button
          type="button"
          className={styles.addButton}
          onClick={handleAddClick}
          aria-label="Add relationship"
        >
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
            <line x1="12" y1="5" x2="12" y2="19" />
            <line x1="5" y1="12" x2="19" y2="12" />
          </svg>
          <span>Add</span>
        </button>
      </div>

      {/* Empty State */}
      {relationships.length === 0 && (
        <div className={styles.emptyState}>
          <svg
            className={styles.emptyIcon}
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            aria-hidden="true"
          >
            <circle cx="6" cy="12" r="3" />
            <circle cx="18" cy="12" r="3" />
            <path d="M9 12h6" strokeDasharray="2 2" />
          </svg>
          <p className={styles.emptyText}>No relationships defined</p>
          <p className={styles.emptySubtext}>
            Add relationships to link this asset with other assets
          </p>
        </div>
      )}

      {/* Relationships by Type */}
      {Object.entries(groupedRelationships).map(([type, rels]) => (
        <div key={type} className={styles.relationshipGroup}>
          <h4 className={styles.groupTitle}>
            {getRelationshipIcon(type as RelationshipType)}
            <span>{getRelationshipTypeLabel(type as RelationshipType)}</span>
            <span className={styles.groupCount}>({rels.length})</span>
          </h4>
          <div className={styles.relationshipsList}>
            {rels.map((rel) => (
              <button
                key={rel.relationship.relationshipId}
                type="button"
                className={styles.relationshipCard}
                onClick={() => handleAssetClick(rel.asset.assetId)}
                aria-label={`View ${rel.asset.displayName}`}
              >
                <div className={styles.cardIcon}>
                  {rel.direction === 'source' ? (
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
                      <line x1="5" y1="12" x2="19" y2="12" />
                      <polyline points="12 5 19 12 12 19" />
                    </svg>
                  ) : (
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
                      <line x1="19" y1="12" x2="5" y2="12" />
                      <polyline points="12 19 5 12 12 5" />
                    </svg>
                  )}
                </div>
                <div className={styles.cardContent}>
                  <div className={styles.cardHeader}>
                    <span className={styles.assetName}>{rel.asset.displayName}</span>
                    <span className={`${styles.typeBadge} ${styles[`type${rel.asset.assetType}`]}`}>
                      {getAssetTypeLabel(rel.asset.assetType)}
                    </span>
                  </div>
                  <div className={styles.cardMeta}>
                    <span className={styles.assetTag}>{rel.asset.assetTag}</span>
                    {rel.relationship.description && (
                      <>
                        <span className={styles.separator}>•</span>
                        <span className={styles.description}>{rel.relationship.description}</span>
                      </>
                    )}
                  </div>
                  <div className={styles.cardFooter}>
                    <span className={styles.createdAt}>
                      Linked: {formatDate(rel.relationship.createdAt)}
                    </span>
                  </div>
                </div>
                <div className={styles.cardArrow}>
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
                    <polyline points="9 18 15 12 9 6" />
                  </svg>
                </div>
              </button>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}

export default AssetRelationships;
