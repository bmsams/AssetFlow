import { useState, useEffect, useCallback, useMemo } from 'react';
import {
  CatalogSearch,
  CatalogItem,
  CategoryFilter,
  RequestCart,
  filterCatalogItems,
} from '../components/service-catalog';
import type {
  CatalogItem as CatalogItemType,
  CartItem,
  CatalogFilters,
  CatalogCategory,
  CategoryInfo,
  CatalogRequestSubmission,
} from '../types/service-catalog';
import { defaultCatalogFilters, getCategoryName, getCategoryIcon } from '../types/service-catalog';
import { getCatalogItems } from '../services/catalog-api';
import styles from './ServiceCatalogPage.module.css';

type ViewMode = 'grid' | 'list';

/**
 * ServiceCatalogPage component
 * Implements Requirements 6B.1, 6B.2:
 * - Display catalog items with descriptions and pricing
 * - Support categories and search functionality
 * - Request submission flow
 */
export function ServiceCatalogPage() {
  const [isLoading, setIsLoading] = useState(true);
  const [catalogItems, setCatalogItems] = useState<CatalogItemType[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [filters, setFilters] = useState<CatalogFilters>(defaultCatalogFilters);
  const [viewMode, setViewMode] = useState<ViewMode>('grid');
  const [cartItems, setCartItems] = useState<CartItem[]>([]);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [showSuccessMessage, setShowSuccessMessage] = useState(false);

  // Fetch catalog items
  useEffect(() => {
    let isMounted = true;

    async function fetchCatalogItems() {
      try {
        setIsLoading(true);
        setError(null);
        const result = await getCatalogItems();
        if (isMounted) {
          setCatalogItems(result.items as unknown as CatalogItemType[]);
        }
      } catch (err) {
        console.error('Failed to load catalog items:', err);
        if (isMounted) {
          setError('Failed to load catalog items. Please try again.');
        }
      } finally {
        if (isMounted) {
          setIsLoading(false);
        }
      }
    }

    fetchCatalogItems();

    return () => {
      isMounted = false;
    };
  }, []);

  // Filter items based on current filters
  const filteredItems = useMemo(() => {
    return filterCatalogItems(catalogItems, {
      search: filters.search,
      categories: filters.categories,
      availability: filters.availability,
      inStockOnly: filters.inStockOnly,
      priceMin: filters.priceRange.min,
      priceMax: filters.priceRange.max,
    });
  }, [catalogItems, filters]);

  // Derive categories from fetched catalog items
  const derivedCategories: CategoryInfo[] = useMemo(() => {
    if (!catalogItems || catalogItems.length === 0) return [];
    const categoryMap = new Map<CatalogCategory, number>();
    for (const item of catalogItems) {
      categoryMap.set(item.category, (categoryMap.get(item.category) ?? 0) + 1);
    }
    return Array.from(categoryMap.entries()).map(([id, count]) => ({
      id,
      name: getCategoryName(id),
      description: '',
      icon: getCategoryIcon(id),
      itemCount: count,
    }));
  }, [catalogItems]);

  // Handle category change from sidebar
  const handleCategoryChange = useCallback((categories: CatalogCategory[]) => {
    setFilters((prev) => ({ ...prev, categories }));
  }, []);

  // Handle item click - show detail modal (simplified for now)
  const handleItemClick = useCallback((item: CatalogItemType) => {
    console.log('View item details:', item.itemId);
    // In a full implementation, this would open a detail modal
  }, []);

  // Handle add to cart
  const handleAddToCart = useCallback((item: CatalogItemType) => {
    setCartItems((prev) => {
      const existingItem = prev.find((i) => i.itemId === item.itemId);
      if (existingItem) {
        return prev.map((i) =>
          i.itemId === item.itemId ? { ...i, quantity: i.quantity + 1 } : i
        );
      }
      return [
        ...prev,
        {
          itemId: item.itemId,
          catalogItem: item,
          quantity: 1,
          justification: '',
          deliveryLocation: '',
        },
      ];
    });
  }, []);

  // Handle quantity change
  const handleQuantityChange = useCallback((itemId: string, quantity: number) => {
    setCartItems((prev) =>
      prev.map((item) => (item.itemId === itemId ? { ...item, quantity } : item))
    );
  }, []);

  // Handle remove item
  const handleRemoveItem = useCallback((itemId: string) => {
    setCartItems((prev) => prev.filter((item) => item.itemId !== itemId));
  }, []);

  // Handle clear cart
  const handleClearCart = useCallback(() => {
    setCartItems([]);
  }, []);

  // Handle submit request
  const handleSubmitRequest = useCallback(async (submission: CatalogRequestSubmission) => {
    setIsSubmitting(true);
    try {
      // TODO: Replace with real catalog request submission API when available
      console.log('Request submitted:', submission);
      
      // Clear cart and show success
      setCartItems([]);
      setShowSuccessMessage(true);
      
      // Hide success message after 5 seconds
      setTimeout(() => {
        setShowSuccessMessage(false);
      }, 5000);
    } catch (err) {
      console.error('Failed to submit request:', err);
    } finally {
      setIsSubmitting(false);
    }
  }, []);

  // Check if item is in cart
  const isItemInCart = useCallback(
    (itemId: string) => cartItems.some((item) => item.itemId === itemId),
    [cartItems]
  );

  return (
    <div className={styles.catalogPage}>
      {/* Error State */}
      {error && (
        <div className={styles.errorState || ''} role="alert">
          <p>{error}</p>
          <button type="button" onClick={() => window.location.reload()}>
            Retry
          </button>
        </div>
      )}

      {/* Success Message */}
      {showSuccessMessage && (
        <div className={styles.successMessage} role="alert">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
            <path d="M22 11.08V12a10 10 0 11-5.93-9.14" />
            <polyline points="22 4 12 14.01 9 11.01" />
          </svg>
          <span>Your request has been submitted successfully! You will receive a confirmation email shortly.</span>
          <button
            type="button"
            className={styles.dismissButton}
            onClick={() => setShowSuccessMessage(false)}
            aria-label="Dismiss message"
          >
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <line x1="18" y1="6" x2="6" y2="18" />
              <line x1="6" y1="6" x2="18" y2="18" />
            </svg>
          </button>
        </div>
      )}

      {/* Page Header */}
      <div className={styles.pageHeader}>
        <div>
          <h1 className={styles.pageTitle}>Service Catalog</h1>
          <p className={styles.pageDescription}>
            Browse and request hardware, software, and accessories for your work
          </p>
        </div>
        <div className={styles.viewToggle}>
          <button
            type="button"
            className={`${styles.viewButton} ${viewMode === 'grid' ? styles.active : ''}`}
            onClick={() => setViewMode('grid')}
            aria-label="Grid view"
            aria-pressed={viewMode === 'grid'}
          >
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <rect x="3" y="3" width="7" height="7" />
              <rect x="14" y="3" width="7" height="7" />
              <rect x="14" y="14" width="7" height="7" />
              <rect x="3" y="14" width="7" height="7" />
            </svg>
          </button>
          <button
            type="button"
            className={`${styles.viewButton} ${viewMode === 'list' ? styles.active : ''}`}
            onClick={() => setViewMode('list')}
            aria-label="List view"
            aria-pressed={viewMode === 'list'}
          >
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <line x1="8" y1="6" x2="21" y2="6" />
              <line x1="8" y1="12" x2="21" y2="12" />
              <line x1="8" y1="18" x2="21" y2="18" />
              <line x1="3" y1="6" x2="3.01" y2="6" />
              <line x1="3" y1="12" x2="3.01" y2="12" />
              <line x1="3" y1="18" x2="3.01" y2="18" />
            </svg>
          </button>
        </div>
      </div>

      {/* Search and Filters */}
      <CatalogSearch
        filters={filters}
        onFiltersChange={setFilters}
        isLoading={isLoading}
        resultsCount={filteredItems.length}
      />

      {/* Main Content */}
      <div className={styles.mainContent}>
        {/* Category Sidebar */}
        <aside className={styles.sidebar}>
          <CategoryFilter
            categories={derivedCategories}
            selectedCategories={filters.categories}
            onCategoryChange={handleCategoryChange}
            isLoading={isLoading}
            layout="sidebar"
          />
        </aside>

        {/* Catalog Grid/List */}
        <main className={styles.catalogContent}>
          {isLoading ? (
            <div className={`${styles.itemsGrid} ${styles[viewMode]}`}>
              {[1, 2, 3, 4, 5, 6].map((i) => (
                <div key={i} className={styles.skeletonItem}>
                  <div className={styles.skeletonImage} />
                  <div className={styles.skeletonContent}>
                    <div className={styles.skeletonCategory} />
                    <div className={styles.skeletonTitle} />
                    <div className={styles.skeletonMeta} />
                    <div className={styles.skeletonPrice} />
                  </div>
                </div>
              ))}
            </div>
          ) : filteredItems.length === 0 ? (
            <div className={styles.emptyState}>
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
                <circle cx="11" cy="11" r="8" />
                <path d="M21 21l-4.35-4.35" />
              </svg>
              <h3>No items found</h3>
              <p>Try adjusting your search or filters to find what you're looking for.</p>
              <button
                type="button"
                className={styles.clearFiltersButton}
                onClick={() => setFilters(defaultCatalogFilters)}
              >
                Clear all filters
              </button>
            </div>
          ) : (
            <div className={`${styles.itemsGrid} ${styles[viewMode]}`}>
              {filteredItems.map((item) => (
                <CatalogItem
                  key={item.itemId}
                  item={item}
                  viewMode={viewMode}
                  onItemClick={handleItemClick}
                  onAddToCart={handleAddToCart}
                  isInCart={isItemInCart(item.itemId)}
                />
              ))}
            </div>
          )}
        </main>

        {/* Request Cart */}
        <aside className={styles.cartSidebar}>
          <RequestCart
            items={cartItems}
            onQuantityChange={handleQuantityChange}
            onRemoveItem={handleRemoveItem}
            onClearCart={handleClearCart}
            onSubmitRequest={handleSubmitRequest}
            isSubmitting={isSubmitting}
          />
        </aside>
      </div>
    </div>
  );
}

export default ServiceCatalogPage;
