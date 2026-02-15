import { type AnchorHTMLAttributes } from 'react';

export interface SkipLinkProps extends AnchorHTMLAttributes<HTMLAnchorElement> {
  /** Target element ID to skip to (without #) */
  targetId: string;
  /** Link text */
  children?: React.ReactNode;
}

/**
 * SkipLink component for keyboard users to skip navigation
 * Allows users to bypass repetitive content and jump to main content
 * Implements WCAG 2.1 AA requirement for keyboard accessibility
 * 
 * @example
 * ```tsx
 * <SkipLink targetId="main-content">Skip to main content</SkipLink>
 * <nav>...</nav>
 * <main id="main-content">...</main>
 * ```
 */
export function SkipLink({
  targetId,
  children = 'Skip to main content',
  className = '',
  style,
  ...props
}: SkipLinkProps) {
  const skipLinkStyles: React.CSSProperties = {
    position: 'absolute',
    top: '-40px',
    left: 0,
    background: 'var(--color-primary-600, #2563eb)',
    color: 'white',
    padding: 'var(--spacing-2, 0.5rem) var(--spacing-4, 1rem)',
    zIndex: 'var(--z-tooltip, 1070)',
    transition: 'top var(--transition-fast, 150ms ease)',
    textDecoration: 'none',
    fontWeight: 'var(--font-weight-medium, 500)',
    borderRadius: '0 0 var(--radius-md, 0.375rem) 0',
    ...style,
  };

  const handleFocus = (e: React.FocusEvent<HTMLAnchorElement>) => {
    e.currentTarget.style.top = '0';
  };

  const handleBlur = (e: React.FocusEvent<HTMLAnchorElement>) => {
    e.currentTarget.style.top = '-40px';
  };

  return (
    <a
      href={`#${targetId}`}
      className={`skip-link ${className}`.trim()}
      style={skipLinkStyles}
      onFocus={handleFocus}
      onBlur={handleBlur}
      {...props}
    >
      {children}
    </a>
  );
}
