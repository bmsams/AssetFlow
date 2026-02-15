import { type HTMLAttributes } from 'react';
import styles from './StatusBadge.module.css';

/**
 * Predefined status variants for the StatusBadge component.
 * Each variant maps to specific color combinations defined in STATUS_VARIANT_COLORS.
 *
 * @type StatusVariant
 * @see {@link StatusBadgeProps} - Used in the variant prop
 * @see {@link STATUS_VARIANT_COLORS} - Color mappings for each variant
 *
 * ## General Statuses
 * - `'active'` - Green - Entity is active/enabled
 * - `'inactive'` - Gray - Entity is inactive/disabled
 * - `'pending'` - Yellow/Orange - Awaiting action
 *
 * ## Approval Statuses
 * - `'approved'` - Green - Request approved
 * - `'rejected'` - Red - Request rejected
 *
 * ## Purchase Order Statuses
 * - `'draft'` - Gray - PO in draft state
 * - `'pending_approval'` - Yellow - Awaiting approval
 * - `'sent'` - Blue - PO sent to vendor
 * - `'partially_received'` - Light blue - Some items received
 * - `'received'` - Green - All items received
 * - `'closed'` - Gray - PO closed
 * - `'cancelled'` - Red - PO cancelled
 *
 * ## Asset Lifecycle Statuses
 * - `'ordered'` - Light blue - Asset ordered
 * - `'in_stock'` - Green - Asset in inventory
 * - `'deployed'` - Blue - Asset deployed to user
 * - `'in_maintenance'` - Yellow - Asset under maintenance
 * - `'retired'` - Gray - Asset retired
 * - `'disposed'` - Dark gray - Asset disposed
 *
 * ## Semantic Statuses
 * - `'success'` - Green - Success state
 * - `'warning'` - Yellow - Warning state
 * - `'error'` - Red - Error state
 * - `'info'` - Blue - Informational state
 */
export type StatusVariant =
  | 'active'
  | 'inactive'
  | 'pending'
  | 'approved'
  | 'rejected'
  | 'draft'
  | 'pending_approval'
  | 'sent'
  | 'partially_received'
  | 'received'
  | 'closed'
  | 'cancelled'
  | 'ordered'
  | 'in_stock'
  | 'deployed'
  | 'in_maintenance'
  | 'retired'
  | 'disposed'
  | 'success'
  | 'warning'
  | 'error'
  | 'info';

/**
 * Custom color configuration for domain-specific statuses.
 * Uses CSS variable names for theming and dark mode support.
 *
 * @interface StatusBadgeColors
 * @see {@link StatusBadgeProps} - Used in the colors prop
 *
 * @example
 * ```typescript
 * // Custom purple status
 * const customColors: StatusBadgeColors = {
 *   background: '--color-purple-100',
 *   text: '--color-purple-700'
 * };
 *
 * // With var() prefix (also supported)
 * const customColors2: StatusBadgeColors = {
 *   background: 'var(--color-purple-100)',
 *   text: 'var(--color-purple-700)'
 * };
 * ```
 */
export interface StatusBadgeColors {
  /**
   * CSS variable name for the background color.
   * Can be with or without `var()` wrapper.
   * @example '--color-success-100' or 'var(--color-success-100)'
   */
  background: string;

  /**
   * CSS variable name for the text color.
   * Can be with or without `var()` wrapper.
   * @example '--color-success-700' or 'var(--color-success-700)'
   */
  text: string;
}

/**
 * Size variants for the StatusBadge component.
 *
 * @type StatusBadgeSize
 * @see {@link StatusBadgeProps} - Used in the size prop
 *
 * - `'sm'` - Small badge with compact padding (default)
 * - `'md'` - Medium badge with standard padding
 */
export type StatusBadgeSize = 'sm' | 'md';

/**
 * Props for the StatusBadge component.
 * Extends HTML span attributes for flexibility.
 *
 * @interface StatusBadgeProps
 * @extends {Omit<HTMLAttributes<HTMLSpanElement>, 'children'>}
 * @see {@link StatusBadge} - The component that uses these props
 * @see {@link StatusVariant} - Available predefined variants
 * @see {@link StatusBadgeColors} - Custom color configuration
 * @see {@link StatusBadgeSize} - Size variants
 *
 * @example
 * ```typescript
 * const badgeProps: StatusBadgeProps = {
 *   label: 'Active',
 *   variant: 'active',
 *   size: 'sm'
 * };
 * ```
 */
export interface StatusBadgeProps extends Omit<HTMLAttributes<HTMLSpanElement>, 'children'> {
  /**
   * Status text to display inside the badge.
   * Should be concise (1-2 words typically).
   */
  label: string;

  /**
   * Predefined status variant for automatic color mapping.
   * Use this for standard statuses across the application.
   * @default 'info'
   * @see {@link StatusVariant}
   */
  variant?: StatusVariant;

  /**
   * Custom colors that override the variant colors.
   * Use for domain-specific statuses not covered by variants.
   * @default undefined
   * @see {@link StatusBadgeColors}
   */
  colors?: StatusBadgeColors;

  /**
   * Size variant controlling padding and font size.
   * @default 'sm'
   * @see {@link StatusBadgeSize}
   */
  size?: StatusBadgeSize;

  /**
   * Additional CSS class name(s) to apply to the badge.
   * @default ''
   */
  className?: string;
}

/**
 * Color mappings for each status variant.
 * Uses CSS variables for dark mode support.
 * @internal
 */
const STATUS_VARIANT_COLORS: Record<StatusVariant, { bg: string; text: string }> = {
  // General statuses
  active: { bg: 'var(--color-success-100)', text: 'var(--color-success-700)' },
  inactive: { bg: 'var(--color-gray-100)', text: 'var(--color-gray-600)' },
  pending: { bg: 'var(--color-warning-100)', text: 'var(--color-warning-700)' },

  // Approval statuses
  approved: { bg: 'var(--color-success-100)', text: 'var(--color-success-700)' },
  rejected: { bg: 'var(--color-error-100)', text: 'var(--color-error-700)' },

  // PO statuses
  draft: { bg: 'var(--color-gray-100)', text: 'var(--color-gray-600)' },
  pending_approval: { bg: 'var(--color-warning-100)', text: 'var(--color-warning-700)' },
  sent: { bg: 'var(--color-primary-100)', text: 'var(--color-primary-700)' },
  partially_received: { bg: 'var(--color-info-100)', text: 'var(--color-info-700)' },
  received: { bg: 'var(--color-success-100)', text: 'var(--color-success-700)' },
  closed: { bg: 'var(--color-gray-100)', text: 'var(--color-gray-600)' },
  cancelled: { bg: 'var(--color-error-100)', text: 'var(--color-error-700)' },

  // Asset lifecycle statuses
  ordered: { bg: 'var(--color-info-100)', text: 'var(--color-info-700)' },
  in_stock: { bg: 'var(--color-success-100)', text: 'var(--color-success-700)' },
  deployed: { bg: 'var(--color-primary-100)', text: 'var(--color-primary-700)' },
  in_maintenance: { bg: 'var(--color-warning-100)', text: 'var(--color-warning-700)' },
  retired: { bg: 'var(--color-gray-100)', text: 'var(--color-gray-600)' },
  disposed: { bg: 'var(--color-gray-200)', text: 'var(--color-gray-500)' },

  // Semantic statuses
  success: { bg: 'var(--color-success-100)', text: 'var(--color-success-700)' },
  warning: { bg: 'var(--color-warning-100)', text: 'var(--color-warning-700)' },
  error: { bg: 'var(--color-error-100)', text: 'var(--color-error-700)' },
  info: { bg: 'var(--color-info-100)', text: 'var(--color-info-700)' },
};

/**
 * StatusBadge displays status text with a colored background for visual distinction.
 *
 * This component implements **Requirement 6: Standardized Status Badge Component** from the
 * frontend UI improvements specification. It provides consistent status indicators
 * so users can quickly understand entity states across the application.
 *
 * ## Features
 * - **Predefined variants** - 20+ status variants with appropriate colors
 * - **Custom colors** - Support for domain-specific status colors
 * - **CSS variable theming** - Full dark mode support
 * - **No inline styles** - Colors applied via CSS custom properties
 * - **Size variants** - Small and medium sizes available
 * - **Consistent styling** - Uniform padding, border-radius, and typography
 *
 * ## Dark Mode Support
 * All colors are defined using CSS variables, ensuring proper contrast
 * and appearance in both light and dark modes. The component never uses
 * hardcoded color values.
 *
 * ## Accessibility
 * - Text content is readable by screen readers
 * - Color is not the only means of conveying status (text label included)
 * - Sufficient color contrast in both light and dark modes
 *
 * @param props - Component props (extends HTMLSpanElement attributes)
 * @param props.label - Status text to display (required)
 * @param props.variant - Predefined status variant (default: 'info')
 * @param props.colors - Custom colors (overrides variant)
 * @param props.size - Size variant ('sm' | 'md', default: 'sm')
 * @param props.className - Additional CSS classes
 *
 * @returns JSX span element styled as a status badge
 *
 * @see {@link StatusVariant} - Available predefined variants
 * @see {@link StatusBadgeColors} - Custom color configuration
 * @see {@link STATUS_COLORS} - Color mappings in types/status.ts
 *
 * @example
 * Using a predefined variant:
 * ```tsx
 * <StatusBadge label="Active" variant="active" />
 * <StatusBadge label="Pending Approval" variant="pending_approval" />
 * <StatusBadge label="Deployed" variant="deployed" />
 * ```
 *
 * @example
 * Using custom colors for domain-specific status:
 * ```tsx
 * <StatusBadge
 *   label="Custom Status"
 *   colors={{
 *     background: '--color-purple-100',
 *     text: '--color-purple-700'
 *   }}
 * />
 * ```
 *
 * @example
 * Different sizes:
 * ```tsx
 * <StatusBadge label="Small" variant="info" size="sm" />
 * <StatusBadge label="Medium" variant="info" size="md" />
 * ```
 *
 * @example
 * In a table cell:
 * ```tsx
 * <td>
 *   <StatusBadge
 *     label={asset.status.replace('_', ' ')}
 *     variant={asset.status as StatusVariant}
 *   />
 * </td>
 * ```
 *
 * @example
 * With additional HTML attributes:
 * ```tsx
 * <StatusBadge
 *   label="Approved"
 *   variant="approved"
 *   title="Approved on Jan 15, 2025"
 *   data-testid="approval-status"
 * />
 * ```
 */
export function StatusBadge({
  label,
  variant = 'info',
  colors,
  size = 'sm',
  className = '',
  ...props
}: StatusBadgeProps): JSX.Element {
  // Determine colors: custom colors take precedence over variant colors
  const colorConfig = colors
    ? {
        bg: colors.background.startsWith('var(')
          ? colors.background
          : `var(${colors.background})`,
        text: colors.text.startsWith('var(') ? colors.text : `var(${colors.text})`,
      }
    : STATUS_VARIANT_COLORS[variant];

  const classNames = [styles.statusBadge, styles[`size-${size}`], className]
    .filter(Boolean)
    .join(' ');

  // Use CSS custom properties for dynamic colors
  const style = {
    '--status-badge-bg': colorConfig.bg,
    '--status-badge-text': colorConfig.text,
  } as React.CSSProperties;

  return (
    <span className={classNames} style={style} {...props}>
      {label}
    </span>
  );
}

StatusBadge.displayName = 'StatusBadge';
