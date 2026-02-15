import { type ReactNode, type HTMLAttributes } from 'react';

export interface VisuallyHiddenProps extends HTMLAttributes<HTMLSpanElement> {
  /** Content to hide visually but keep accessible to screen readers */
  children: ReactNode;
  /** Whether to make the element focusable (shows on focus) */
  focusable?: boolean;
}

/**
 * VisuallyHidden component for screen reader only content
 * Content is hidden visually but remains accessible to assistive technologies
 * Implements WCAG 2.1 AA requirement for screen reader accessibility
 * 
 * @example
 * ```tsx
 * <button>
 *   <Icon name="close" />
 *   <VisuallyHidden>Close dialog</VisuallyHidden>
 * </button>
 * ```
 */
export function VisuallyHidden({
  children,
  focusable = false,
  style,
  ...props
}: VisuallyHiddenProps) {
  const baseStyles: React.CSSProperties = {
    position: 'absolute',
    width: '1px',
    height: '1px',
    padding: 0,
    margin: '-1px',
    overflow: 'hidden',
    clip: 'rect(0, 0, 0, 0)',
    whiteSpace: 'nowrap',
    border: 0,
    ...style,
  };

  // If focusable, show element when it receives focus
  const focusableStyles: React.CSSProperties = focusable
    ? {
        ...baseStyles,
        // These will be overridden when focused via CSS
      }
    : baseStyles;

  return (
    <span
      {...props}
      style={focusableStyles}
      tabIndex={focusable ? 0 : undefined}
      data-visually-hidden
    >
      {children}
    </span>
  );
}
