/**
 * Service Catalog Components
 * Implements Requirements 6B.1, 6B.2: Service catalog with items, categories, and search
 */

export { CatalogSearch } from './CatalogSearch';
export type { CatalogSearchProps } from './CatalogSearch';

export { CatalogItem } from './CatalogItem';
export type { CatalogItemProps } from './CatalogItem';

export { CategoryFilter } from './CategoryFilter';
export type { CategoryFilterProps } from './CategoryFilter';

export { RequestCart } from './RequestCart';
export type { RequestCartProps } from './RequestCart';

// Re-export mock data for development
export {
  mockCatalogItems,
  mockCategories,
  simulateApiDelay,
  filterCatalogItems,
} from './mockData';
