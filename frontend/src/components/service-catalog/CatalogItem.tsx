import type { HTMLAttributes } from 'react';
import type { CatalogItem as CatalogItemType } from '../../types/service-catalog';
import {
  getCategoryName,
  getAvailabilityText,
  getAvailabilityColor,
  formatCatalogPrice,
} from '../../types/service-catalog';
import styles from './CatalogItem.module.css';

export interface CatalogItemProps extends HTMLAttributes<HTMLDivElement> {
  /** Catalog item data */
  item: CatalogItemType;
  /** View mode */
  viewMode?: 'grid' | 'list';
  /** Callback when item is clicked */
  onItemClick?: (item: CatalogItemType) => void;
  /** Callback when add to cart is clicked */
  onAddToCart?: (item: CatalogItemType) => void;
  /** Whether item is in cart */
  isInCart?: boolean;
}

/**
 * CatalogItem component for displaying a single catalog item
 * Implements Requirement 6B.1: Service catalog shall display available items with descriptions and pricing
 */
export function CatalogItem({
  item,
  viewMode = 'grid',
  onItemClick,
  onAddToCart,
  isInCart = false,
  className = '',
  ...props
}: CatalogItemProps) {
  const isAvailable = item.availability !== 'OUT_OF_STOCK';

  const handleClick = () => {
    onItemClick?.(item);
  };

  const handleAddToCart = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (isAvailable) {
      onAddToCart?.(item);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      handleClick();
    }
  };

  return (
    <article
      className={`${styles.item} ${styles[viewMode]} ${className}`}
      onClick={handleClick}
      onKeyDown={handleKeyDown}
      tabIndex={0}
      role="button"
      aria-label={`View details for ${item.name}`}
      {...props}
    >
      {/* Image */}
      <div className={styles.imageContainer}>
        {item.imageUrl ? (
          <img
            src={item.imageUrl}
            alt={item.name}
            className={styles.image}
            loading="lazy"
          />
        ) : (
          <div className={styles.imagePlaceholder}>
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" aria-hidden="true">
              <rect x="3" y="3" width="18" height="18" rx="2" />
              <circle cx="8.5" cy="8.5" r="1.5" />
              <path d="M21 15l-5-5L5 21" />
            </svg>
          </div>
        )}
        {/* Badges */}
        <div className={styles.badges}>
          {item.isFeatured && (
            <span className={`${styles.badge} ${styles.featuredBadge}`}>Featured</span>
          )}
          {item.isPopular && (
            <span className={`${styles.badge} ${styles.popularBadge}`}>Popular</span>
          )}
        </div>
      </div>

      {/* Content */}
      <div className={styles.content}>
        {/* Category */}
        <span className={styles.category}>{getCategoryName(item.category)}</span>

        {/* Name */}
        <h3 className={styles.name}>{item.name}</h3>

        {/* Manufacturer & Model */}
        <p className={styles.manufacturer}>
          {item.manufacturer} • {item.model}
        </p>

        {/* Description (list view only) */}
        {viewMode === 'list' && (
          <p className={styles.description}>{item.description}</p>
        )}

        {/* Price and Availability */}
        <div className={styles.priceRow}>
          <span className={styles.price}>{formatCatalogPrice(item.price)}</span>
          <span
            className={styles.availability}
            style={{ color: getAvailabilityColor(item.availability) }}
          >
            {getAvailabilityText(item.availability)}
          </span>
        </div>

        {/* Lead Time */}
        {item.leadTimeDays > 0 && (
          <p className={styles.leadTime}>
            Ships in {item.leadTimeDays} {item.leadTimeDays === 1 ? 'day' : 'days'}
          </p>
        )}

        {/* Add to Cart Button */}
        <button
          type="button"
          className={`${styles.addToCartButton} ${isInCart ? styles.inCart : ''}`}
          onClick={handleAddToCart}
          disabled={!isAvailable}
          aria-label={isInCart ? `${item.name} is in cart` : `Add ${item.name} to cart`}
        >
          {isInCart ? (
            <>
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
                <polyline points="20 6 9 17 4 12" />
              </svg>
              In Cart
            </>
          ) : (
            <>
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
                <circle cx="9" cy="21" r="1" />
                <circle cx="20" cy="21" r="1" />
                <path d="M1 1h4l2.68 13.39a2 2 0 002 1.61h9.72a2 2 0 002-1.61L23 6H6" />
              </svg>
              Add to Cart
            </>
          )}
        </button>
      </div>
    </article>
  );
}

export default CatalogItem;
