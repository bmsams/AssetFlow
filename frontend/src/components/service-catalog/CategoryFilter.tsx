import type { HTMLAttributes } from 'react';
import type { CategoryInfo, CatalogCategory } from '../../types/service-catalog';
import { getCategoryIcon } from '../../types/service-catalog';
import styles from './CategoryFilter.module.css';

export interface CategoryFilterProps extends HTMLAttributes<HTMLDivElement> {
  /** List of categories with counts */
  categories: CategoryInfo[];
  /** Currently selected categories */
  selectedCategories: CatalogCategory[];
  /** Callback when category selection changes */
  onCategoryChange: (categories: CatalogCategory[]) => void;
  /** Loading state */
  isLoading?: boolean;
  /** Show as sidebar or horizontal */
  layout?: 'sidebar' | 'horizontal';
}

/**
 * CategoryFilter component for filtering catalog by category
 * Implements Requirement 6B.2: Service catalog shall support categories
 */
export function CategoryFilter({
  categories,
  selectedCategories,
  onCategoryChange,
  isLoading = false,
  layout = 'sidebar',
  className = '',
  ...props
}: CategoryFilterProps) {
  const handleCategoryClick = (categoryId: CatalogCategory) => {
    if (selectedCategories.includes(categoryId)) {
      onCategoryChange(selectedCategories.filter((c) => c !== categoryId));
    } else {
      onCategoryChange([...selectedCategories, categoryId]);
    }
  };

  const handleSelectAll = () => {
    onCategoryChange([]);
  };

  const totalItems = categories.reduce((sum, cat) => sum + cat.itemCount, 0);

  if (isLoading) {
    return (
      <div className={`${styles.container} ${styles[layout]} ${className}`} {...props}>
        <div className={styles.header}>
          <h3 className={styles.title}>Categories</h3>
        </div>
        <div className={styles.list} aria-busy="true">
          {[1, 2, 3, 4, 5].map((i) => (
            <div key={i} className={styles.skeletonItem}>
              <div className={styles.skeletonIcon} />
              <div className={styles.skeletonText} />
            </div>
          ))}
        </div>
      </div>
    );
  }

  return (
    <nav
      className={`${styles.container} ${styles[layout]} ${className}`}
      aria-label="Category filter"
      {...props}
    >
      <div className={styles.header}>
        <h3 className={styles.title}>Categories</h3>
        {selectedCategories.length > 0 && (
          <button
            type="button"
            className={styles.clearButton}
            onClick={handleSelectAll}
            aria-label="Clear category filter"
          >
            Clear
          </button>
        )}
      </div>

      <ul className={styles.list} role="listbox" aria-multiselectable="true">
        {/* All Items */}
        <li className={styles.categoryItem}>
          <button
            type="button"
            className={`${styles.categoryButton} ${selectedCategories.length === 0 ? styles.active : ''}`}
            onClick={handleSelectAll}
            role="option"
            aria-selected={selectedCategories.length === 0}
          >
            <span className={styles.iconWrapper}>
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
                <rect x="3" y="3" width="7" height="7" />
                <rect x="14" y="3" width="7" height="7" />
                <rect x="14" y="14" width="7" height="7" />
                <rect x="3" y="14" width="7" height="7" />
              </svg>
            </span>
            <span className={styles.categoryName}>All Items</span>
            <span className={styles.itemCount}>{totalItems}</span>
          </button>
        </li>

        {/* Category Items */}
        {categories.map((category) => (
          <li key={category.id} className={styles.categoryItem}>
            <button
              type="button"
              className={`${styles.categoryButton} ${selectedCategories.includes(category.id) ? styles.active : ''}`}
              onClick={() => handleCategoryClick(category.id)}
              role="option"
              aria-selected={selectedCategories.includes(category.id)}
            >
              <span className={styles.iconWrapper}>
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
                  <path d={getCategoryIcon(category.id)} />
                </svg>
              </span>
              <span className={styles.categoryName}>{category.name}</span>
              <span className={styles.itemCount}>{category.itemCount}</span>
            </button>
          </li>
        ))}
      </ul>
    </nav>
  );
}

export default CategoryFilter;
