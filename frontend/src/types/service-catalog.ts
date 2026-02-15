/**
 * Service Catalog types for the Asset Management System
 * Implements Requirements 6B.1, 6B.2: Service catalog with categories and search
 */

/**
 * Catalog item category
 */
export type CatalogCategory =
  | 'LAPTOPS'
  | 'DESKTOPS'
  | 'MONITORS'
  | 'PERIPHERALS'
  | 'MOBILE_DEVICES'
  | 'SOFTWARE'
  | 'NETWORK_EQUIPMENT'
  | 'ACCESSORIES';

/**
 * Catalog item availability status
 */
export type CatalogItemAvailability = 'IN_STOCK' | 'LOW_STOCK' | 'OUT_OF_STOCK' | 'BACKORDERED';

/**
 * Request cart item status
 */
export type CartItemStatus = 'PENDING' | 'APPROVED' | 'REJECTED';

/**
 * Catalog item entity
 */
export interface CatalogItem {
  itemId: string;
  name: string;
  description: string;
  category: CatalogCategory;
  manufacturer: string;
  model: string;
  imageUrl?: string;
  price: number;
  availability: CatalogItemAvailability;
  stockQuantity: number;
  leadTimeDays: number;
  specifications: Record<string, string>;
  tags: string[];
  isPopular?: boolean;
  isFeatured?: boolean;
}

/**
 * Cart item for request submission
 */
export interface CartItem {
  itemId: string;
  catalogItem: CatalogItem;
  quantity: number;
  justification: string;
  deliveryLocation: string;
}

/**
 * Request submission payload
 */
export interface CatalogRequestSubmission {
  items: CartItem[];
  priority: 'LOW' | 'MEDIUM' | 'HIGH' | 'URGENT';
  notes?: string;
  requiredByDate?: string;
}

/**
 * Category metadata for display
 */
export interface CategoryInfo {
  id: CatalogCategory;
  name: string;
  description: string;
  icon: string;
  itemCount: number;
}

/**
 * Search and filter state
 */
export interface CatalogFilters {
  search: string;
  categories: CatalogCategory[];
  availability: CatalogItemAvailability[];
  priceRange: {
    min: number | null;
    max: number | null;
  };
  inStockOnly: boolean;
}

/**
 * Get category display name
 */
export function getCategoryName(category: CatalogCategory): string {
  const names: Record<CatalogCategory, string> = {
    LAPTOPS: 'Laptops',
    DESKTOPS: 'Desktops',
    MONITORS: 'Monitors',
    PERIPHERALS: 'Peripherals',
    MOBILE_DEVICES: 'Mobile Devices',
    SOFTWARE: 'Software',
    NETWORK_EQUIPMENT: 'Network Equipment',
    ACCESSORIES: 'Accessories',
  };
  return names[category] || category;
}

/**
 * Get availability display text
 */
export function getAvailabilityText(availability: CatalogItemAvailability): string {
  const texts: Record<CatalogItemAvailability, string> = {
    IN_STOCK: 'In Stock',
    LOW_STOCK: 'Low Stock',
    OUT_OF_STOCK: 'Out of Stock',
    BACKORDERED: 'Backordered',
  };
  return texts[availability] || availability;
}

/**
 * Get availability color
 */
export function getAvailabilityColor(availability: CatalogItemAvailability): string {
  switch (availability) {
    case 'IN_STOCK':
      return 'var(--color-success-500)';
    case 'LOW_STOCK':
      return 'var(--color-warning-500)';
    case 'OUT_OF_STOCK':
      return 'var(--color-error-500)';
    case 'BACKORDERED':
      return 'var(--color-info-500)';
    default:
      return 'var(--color-gray-500)';
  }
}

/**
 * Format price for display
 */
export function formatCatalogPrice(price: number): string {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(price);
}

/**
 * Get category icon SVG path
 */
export function getCategoryIcon(category: CatalogCategory): string {
  const icons: Record<CatalogCategory, string> = {
    LAPTOPS: 'M4 6h16v10H4V6zm2 12h12',
    DESKTOPS: 'M8 21h8m-4-4v4M5 3h14a2 2 0 012 2v10a2 2 0 01-2 2H5a2 2 0 01-2-2V5a2 2 0 012-2z',
    MONITORS: 'M9.75 17L9 20l-1 1h8l-1-1-.75-3M3 13h18M5 17h14a2 2 0 002-2V5a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z',
    PERIPHERALS: 'M12 14l9-5-9-5-9 5 9 5zm0 7l9-5-9-5-9 5 9 5z',
    MOBILE_DEVICES: 'M12 18h.01M8 21h8a2 2 0 002-2V5a2 2 0 00-2-2H8a2 2 0 00-2 2v14a2 2 0 002 2z',
    SOFTWARE: 'M9 3v2m6-2v2M9 19v2m6-2v2M5 9H3m2 6H3m18-6h-2m2 6h-2M7 19h10a2 2 0 002-2V7a2 2 0 00-2-2H7a2 2 0 00-2 2v10a2 2 0 002 2z',
    NETWORK_EQUIPMENT: 'M5 12h14M5 12a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v4a2 2 0 01-2 2M5 12a2 2 0 00-2 2v4a2 2 0 002 2h14a2 2 0 002-2v-4a2 2 0 00-2-2m-2-4h.01M17 16h.01',
    ACCESSORIES: 'M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4',
  };
  return icons[category] || 'M4 6h16v12H4z';
}

/**
 * Default empty filters
 */
export const defaultCatalogFilters: CatalogFilters = {
  search: '',
  categories: [],
  availability: [],
  priceRange: { min: null, max: null },
  inStockOnly: false,
};
