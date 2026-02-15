/**
 * Shared constants for procurement module
 * 
 * Consolidates common constants to avoid duplication across components.
 */

/**
 * Product type for PO line items
 * Aligned with backend POProductType
 */
export type POProductType = 'HARDWARE_MODEL' | 'SOFTWARE_PRODUCT' | 'SERVICE' | 'OTHER';

/**
 * Product type options for dropdowns and forms
 */
export const PRODUCT_TYPE_OPTIONS: { value: POProductType; label: string }[] = [
  { value: 'HARDWARE_MODEL', label: 'Hardware' },
  { value: 'SOFTWARE_PRODUCT', label: 'Software' },
  { value: 'SERVICE', label: 'Service' },
  { value: 'OTHER', label: 'Other' },
];

/**
 * Get display label for a product type
 */
export function getProductTypeLabel(productType: POProductType): string {
  const option = PRODUCT_TYPE_OPTIONS.find(opt => opt.value === productType);
  return option?.label || productType;
}
