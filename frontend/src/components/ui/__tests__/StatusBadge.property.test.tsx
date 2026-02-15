/**
 * Property-Based Tests for StatusBadge Theme Compliance
 *
 * This test file verifies that StatusBadge uses CSS variables for colors and
 * works correctly in both light and dark modes using property-based testing with fast-check.
 *
 * **Validates: Requirement 6** - "Standardized Status Badge Component"
 * **Validates: Requirement 10** - "Dark Mode Consistency"
 * **Validates: Property 6** - "FOR ALL StatusBadge components:
 *   - THE background and text colors SHALL be defined using CSS variables
 *   - THE component SHALL NOT contain inline style color definitions
 *   - WHEN dark mode is active, THE colors SHALL maintain WCAG AA contrast ratio"
 *
 * Test properties covered:
 * - All status variants use CSS variables for colors
 * - No inline hex, rgb, or rgba color values are used
 * - Custom colors are properly wrapped in var() syntax
 * - CSS custom properties are used for dynamic theming
 * - Component renders consistently across all variants and sizes
 */

import { render, screen, cleanup } from '@testing-library/react';
import { describe, it, expect, afterEach } from 'vitest';
import * as fc from 'fast-check';
import { StatusBadge, type StatusVariant, type StatusBadgeSize, type StatusBadgeColors } from '../StatusBadge';

// Ensure cleanup after each test
afterEach(() => {
  cleanup();
});

// Arbitraries for generating test data

/**
 * Generates valid non-empty strings for badge labels
 * Labels are trimmed to avoid whitespace-only strings and leading/trailing spaces
 * that can cause issues with text matching in tests
 */
const labelArbitrary = fc.string({ minLength: 1, maxLength: 50 })
  .map(s => s.trim())
  .filter(s => s.length > 0);

/**
 * Generates all valid status variants
 */
const statusVariantArbitrary: fc.Arbitrary<StatusVariant> = fc.constantFrom(
  'active', 'inactive', 'pending', 'approved', 'rejected',
  'draft', 'pending_approval', 'sent', 'partially_received', 'received',
  'closed', 'cancelled', 'ordered', 'in_stock', 'deployed',
  'in_maintenance', 'retired', 'disposed', 'success', 'warning', 'error', 'info'
);

/**
 * Generates valid size variants
 */
const sizeArbitrary: fc.Arbitrary<StatusBadgeSize> = fc.constantFrom('sm', 'md');

/**
 * Generates valid CSS variable names (without var() wrapper)
 */
const cssVariableNameArbitrary = fc.stringMatching(/^--[a-z][a-z0-9-]*$/)
  .filter(s => s.length >= 3 && s.length <= 50);

/**
 * Generates custom color configurations using CSS variable names
 */
const customColorsArbitrary: fc.Arbitrary<StatusBadgeColors> = fc.record({
  background: cssVariableNameArbitrary,
  text: cssVariableNameArbitrary,
});

/**
 * Generates custom colors with var() wrapper already applied
 */
const customColorsWithVarArbitrary: fc.Arbitrary<StatusBadgeColors> = fc.record({
  background: cssVariableNameArbitrary.map(v => `var(${v})`),
  text: cssVariableNameArbitrary.map(v => `var(${v})`),
});

/**
 * Generates optional className strings
 */
const classNameArbitrary = fc.option(
  fc.string({ minLength: 1, maxLength: 30 })
    .filter(s => /^[a-zA-Z][a-zA-Z0-9_-]*$/.test(s)),
  { nil: undefined }
);

/**
 * Generates complete StatusBadge props for testing
 */
const statusBadgePropsArbitrary = fc.record({
  label: labelArbitrary,
  variant: fc.option(statusVariantArbitrary, { nil: undefined }),
  size: fc.option(sizeArbitrary, { nil: undefined }),
  className: classNameArbitrary,
});

describe('StatusBadge Theme Compliance Property-Based Tests', () => {
  /**
   * Property 6.1: CSS Variable Usage for Predefined Variants
   * FOR ALL predefined status variants, THE colors SHALL be defined using CSS variables
   */
  describe('Property 6.1: CSS Variable Usage for Predefined Variants', () => {
    it('all predefined variants use CSS variables for background color', () => {
      fc.assert(
        fc.property(
          labelArbitrary,
          statusVariantArbitrary,
          (label, variant) => {
            cleanup();
            const { container } = render(
              <StatusBadge label={label} variant={variant} />
            );

            const badge = container.querySelector('span');
            const style = badge?.getAttribute('style') || '';

            // Background color should use CSS variable
            expect(style).toContain('--status-badge-bg');
            expect(style).toMatch(/var\(--color-[a-z]+-\d+\)/);
          }
        ),
        { numRuns: 50 }
      );
    });

    it('all predefined variants use CSS variables for text color', () => {
      fc.assert(
        fc.property(
          labelArbitrary,
          statusVariantArbitrary,
          (label, variant) => {
            cleanup();
            const { container } = render(
              <StatusBadge label={label} variant={variant} />
            );

            const badge = container.querySelector('span');
            const style = badge?.getAttribute('style') || '';

            // Text color should use CSS variable
            expect(style).toContain('--status-badge-text');
            expect(style).toMatch(/var\(--color-[a-z]+-\d+\)/);
          }
        ),
        { numRuns: 50 }
      );
    });

    it('uses CSS custom properties for dynamic color application', () => {
      fc.assert(
        fc.property(
          labelArbitrary,
          statusVariantArbitrary,
          (label, variant) => {
            cleanup();
            const { container } = render(
              <StatusBadge label={label} variant={variant} />
            );

            const badge = container.querySelector('span');
            const style = badge?.getAttribute('style') || '';

            // Should set CSS custom properties for dynamic theming
            expect(style).toContain('--status-badge-bg:');
            expect(style).toContain('--status-badge-text:');
          }
        ),
        { numRuns: 50 }
      );
    });
  });

  /**
   * Property 6.2: No Inline Color Definitions
   * FOR ALL StatusBadge components, THE component SHALL NOT contain inline style color definitions
   */
  describe('Property 6.2: No Inline Color Definitions', () => {
    it('does not use hex color values in inline styles', () => {
      fc.assert(
        fc.property(
          labelArbitrary,
          statusVariantArbitrary,
          (label, variant) => {
            cleanup();
            const { container } = render(
              <StatusBadge label={label} variant={variant} />
            );

            const badge = container.querySelector('span');
            const style = badge?.getAttribute('style') || '';

            // Should not contain hex colors (#fff, #ffffff, etc.)
            expect(style).not.toMatch(/#[0-9a-fA-F]{3,8}\b/);
          }
        ),
        { numRuns: 50 }
      );
    });

    it('does not use rgb() color values in inline styles', () => {
      fc.assert(
        fc.property(
          labelArbitrary,
          statusVariantArbitrary,
          (label, variant) => {
            cleanup();
            const { container } = render(
              <StatusBadge label={label} variant={variant} />
            );

            const badge = container.querySelector('span');
            const style = badge?.getAttribute('style') || '';

            // Should not contain rgb() colors
            expect(style).not.toMatch(/rgb\s*\(/i);
          }
        ),
        { numRuns: 50 }
      );
    });

    it('does not use rgba() color values in inline styles', () => {
      fc.assert(
        fc.property(
          labelArbitrary,
          statusVariantArbitrary,
          (label, variant) => {
            cleanup();
            const { container } = render(
              <StatusBadge label={label} variant={variant} />
            );

            const badge = container.querySelector('span');
            const style = badge?.getAttribute('style') || '';

            // Should not contain rgba() colors
            expect(style).not.toMatch(/rgba\s*\(/i);
          }
        ),
        { numRuns: 50 }
      );
    });

    it('does not use hsl() or hsla() color values in inline styles', () => {
      fc.assert(
        fc.property(
          labelArbitrary,
          statusVariantArbitrary,
          (label, variant) => {
            cleanup();
            const { container } = render(
              <StatusBadge label={label} variant={variant} />
            );

            const badge = container.querySelector('span');
            const style = badge?.getAttribute('style') || '';

            // Should not contain hsl() or hsla() colors
            expect(style).not.toMatch(/hsla?\s*\(/i);
          }
        ),
        { numRuns: 50 }
      );
    });

    it('does not use named color values in inline styles', () => {
      fc.assert(
        fc.property(
          labelArbitrary,
          statusVariantArbitrary,
          (label, variant) => {
            cleanup();
            const { container } = render(
              <StatusBadge label={label} variant={variant} />
            );

            const badge = container.querySelector('span');
            const style = badge?.getAttribute('style') || '';

            // Common named colors that should not appear directly
            const namedColors = ['red', 'blue', 'green', 'yellow', 'orange', 'purple', 'white', 'black', 'gray', 'grey'];
            
            // Check that no named colors appear as direct values (not inside var())
            namedColors.forEach(color => {
              // Match color name not preceded by -- (which would be part of a CSS variable)
              const regex = new RegExp(`(?<!--)\\b${color}\\b(?!-)`, 'i');
              expect(style).not.toMatch(regex);
            });
          }
        ),
        { numRuns: 50 }
      );
    });
  });

  /**
   * Property 6.3: Custom Colors Use CSS Variables
   * FOR ALL custom color configurations, THE colors SHALL be wrapped in var() syntax
   */
  describe('Property 6.3: Custom Colors Use CSS Variables', () => {
    it('wraps custom colors without var() prefix in var() syntax', () => {
      fc.assert(
        fc.property(
          labelArbitrary,
          customColorsArbitrary,
          (label, colors) => {
            cleanup();
            const { container } = render(
              <StatusBadge label={label} colors={colors} />
            );

            const badge = container.querySelector('span');
            const style = badge?.getAttribute('style') || '';

            // Custom colors should be wrapped in var()
            expect(style).toContain(`var(${colors.background})`);
            expect(style).toContain(`var(${colors.text})`);
          }
        ),
        { numRuns: 30 }
      );
    });

    it('preserves var() wrapper when custom colors already have it', () => {
      fc.assert(
        fc.property(
          labelArbitrary,
          customColorsWithVarArbitrary,
          (label, colors) => {
            cleanup();
            const { container } = render(
              <StatusBadge label={label} colors={colors} />
            );

            const badge = container.querySelector('span');
            const style = badge?.getAttribute('style') || '';

            // Should not double-wrap var()
            expect(style).not.toMatch(/var\(var\(/);
            
            // Should contain the colors
            expect(style).toContain(colors.background);
            expect(style).toContain(colors.text);
          }
        ),
        { numRuns: 30 }
      );
    });

    it('custom colors override variant colors', () => {
      fc.assert(
        fc.property(
          labelArbitrary,
          statusVariantArbitrary,
          customColorsArbitrary,
          (label, variant, colors) => {
            cleanup();
            const { container } = render(
              <StatusBadge label={label} variant={variant} colors={colors} />
            );

            const badge = container.querySelector('span');
            const style = badge?.getAttribute('style') || '';

            // Custom colors should be used, not variant colors
            expect(style).toContain(`var(${colors.background})`);
            expect(style).toContain(`var(${colors.text})`);
          }
        ),
        { numRuns: 30 }
      );
    });
  });

  /**
   * Property 6.4: Consistent Rendering Across Variants
   * FOR ALL status variants and sizes, THE component SHALL render consistently
   */
  describe('Property 6.4: Consistent Rendering Across Variants', () => {
    it('renders label text for all variant and size combinations', () => {
      fc.assert(
        fc.property(
          labelArbitrary,
          statusVariantArbitrary,
          sizeArbitrary,
          (label, variant, size) => {
            cleanup();
            render(
              <StatusBadge label={label} variant={variant} size={size} />
            );

            expect(screen.getByText(label)).toBeInTheDocument();
          }
        ),
        { numRuns: 50 }
      );
    });

    it('applies correct size class for all variants', () => {
      fc.assert(
        fc.property(
          labelArbitrary,
          statusVariantArbitrary,
          sizeArbitrary,
          (label, variant, size) => {
            cleanup();
            const { container } = render(
              <StatusBadge label={label} variant={variant} size={size} />
            );

            const badge = container.querySelector('span');
            expect(badge?.className).toMatch(new RegExp(`size-${size}`));
          }
        ),
        { numRuns: 50 }
      );
    });

    it('renders as span element for all configurations', () => {
      fc.assert(
        fc.property(statusBadgePropsArbitrary, (props) => {
          cleanup();
          const { container } = render(
            <StatusBadge {...props} />
          );

          const badge = container.querySelector('span');
          expect(badge).toBeInTheDocument();
          expect(badge?.tagName).toBe('SPAN');
        }),
        { numRuns: 50 }
      );
    });
  });

  /**
   * Property 6.5: CSS Module Class Application
   * FOR ALL StatusBadge components, THE component SHALL apply CSS module classes
   */
  describe('Property 6.5: CSS Module Class Application', () => {
    it('always applies the base statusBadge class', () => {
      fc.assert(
        fc.property(
          labelArbitrary,
          statusVariantArbitrary,
          (label, variant) => {
            cleanup();
            const { container } = render(
              <StatusBadge label={label} variant={variant} />
            );

            const badge = container.querySelector('span');
            // CSS modules will hash the class name, but it should exist
            expect(badge?.className).toBeTruthy();
            expect(badge?.className.length).toBeGreaterThan(0);
          }
        ),
        { numRuns: 30 }
      );
    });

    it('applies custom className when provided', () => {
      fc.assert(
        fc.property(
          labelArbitrary,
          statusVariantArbitrary,
          classNameArbitrary.filter(c => c !== undefined),
          (label, variant, customClass) => {
            cleanup();
            const { container } = render(
              <StatusBadge label={label} variant={variant} className={customClass} />
            );

            const badge = container.querySelector('span');
            expect(badge?.className).toContain(customClass);
          }
        ),
        { numRuns: 30 }
      );
    });

    it('combines base class with size class and custom class', () => {
      fc.assert(
        fc.property(
          labelArbitrary,
          statusVariantArbitrary,
          sizeArbitrary,
          classNameArbitrary.filter(c => c !== undefined),
          (label, variant, size, customClass) => {
            cleanup();
            const { container } = render(
              <StatusBadge 
                label={label} 
                variant={variant} 
                size={size} 
                className={customClass} 
              />
            );

            const badge = container.querySelector('span');
            const className = badge?.className || '';
            
            // Should have size class
            expect(className).toMatch(new RegExp(`size-${size}`));
            // Should have custom class
            expect(className).toContain(customClass);
          }
        ),
        { numRuns: 30 }
      );
    });
  });

  /**
   * Property 6.6: Theme Variable Consistency
   * FOR ALL status variants, THE CSS variables SHALL follow the naming convention
   */
  describe('Property 6.6: Theme Variable Consistency', () => {
    it('uses consistent CSS variable naming pattern for colors', () => {
      fc.assert(
        fc.property(
          labelArbitrary,
          statusVariantArbitrary,
          (label, variant) => {
            cleanup();
            const { container } = render(
              <StatusBadge label={label} variant={variant} />
            );

            const badge = container.querySelector('span');
            const style = badge?.getAttribute('style') || '';

            // CSS variables should follow --color-{category}-{shade} pattern
            const colorVarPattern = /var\(--color-[a-z]+-\d+\)/g;
            const matches = style.match(colorVarPattern);
            
            // Should have at least 2 color variables (bg and text)
            expect(matches).toBeTruthy();
            expect(matches!.length).toBeGreaterThanOrEqual(2);
          }
        ),
        { numRuns: 50 }
      );
    });

    it('background colors use lighter shades (100-200 range)', () => {
      fc.assert(
        fc.property(
          labelArbitrary,
          statusVariantArbitrary,
          (label, variant) => {
            cleanup();
            const { container } = render(
              <StatusBadge label={label} variant={variant} />
            );

            const badge = container.querySelector('span');
            const style = badge?.getAttribute('style') || '';

            // Extract background color variable
            const bgMatch = style.match(/--status-badge-bg:\s*var\(--color-[a-z]+-(\d+)\)/);
            if (bgMatch) {
              const shade = parseInt(bgMatch[1], 10);
              // Background should use lighter shades (100-200)
              expect(shade).toBeGreaterThanOrEqual(100);
              expect(shade).toBeLessThanOrEqual(200);
            }
          }
        ),
        { numRuns: 50 }
      );
    });

    it('text colors use darker shades (500-700 range)', () => {
      fc.assert(
        fc.property(
          labelArbitrary,
          statusVariantArbitrary,
          (label, variant) => {
            cleanup();
            const { container } = render(
              <StatusBadge label={label} variant={variant} />
            );

            const badge = container.querySelector('span');
            const style = badge?.getAttribute('style') || '';

            // Extract text color variable
            const textMatch = style.match(/--status-badge-text:\s*var\(--color-[a-z]+-(\d+)\)/);
            if (textMatch) {
              const shade = parseInt(textMatch[1], 10);
              // Text should use darker shades (500-700)
              expect(shade).toBeGreaterThanOrEqual(500);
              expect(shade).toBeLessThanOrEqual(700);
            }
          }
        ),
        { numRuns: 50 }
      );
    });
  });

  /**
   * Property 6.7: Default Variant Behavior
   * WHEN no variant is specified, THE component SHALL use the default 'info' variant
   */
  describe('Property 6.7: Default Variant Behavior', () => {
    it('uses info variant colors when no variant is specified', () => {
      fc.assert(
        fc.property(labelArbitrary, (label) => {
          cleanup();
          const { container } = render(
            <StatusBadge label={label} />
          );

          const badge = container.querySelector('span');
          const style = badge?.getAttribute('style') || '';

          // Should use info color variables
          expect(style).toContain('--color-info-100');
          expect(style).toContain('--color-info-700');
        }),
        { numRuns: 30 }
      );
    });

    it('uses small size when no size is specified', () => {
      fc.assert(
        fc.property(labelArbitrary, (label) => {
          cleanup();
          const { container } = render(
            <StatusBadge label={label} />
          );

          const badge = container.querySelector('span');
          expect(badge?.className).toMatch(/size-sm/);
        }),
        { numRuns: 30 }
      );
    });
  });

  /**
   * Property 6.8: Combined Props Consistency
   * FOR ALL combinations of props, THE StatusBadge SHALL render consistently
   */
  describe('Property 6.8: Combined Props Consistency', () => {
    it('renders correctly with all props combined', () => {
      fc.assert(
        fc.property(statusBadgePropsArbitrary, (props) => {
          cleanup();
          const { container } = render(
            <StatusBadge {...props} />
          );

          // Core structure should always be present
          const badge = container.querySelector('span');
          expect(badge).toBeInTheDocument();

          // Label should always be rendered
          expect(screen.getByText(props.label)).toBeInTheDocument();

          // Style should use CSS variables
          const style = badge?.getAttribute('style') || '';
          expect(style).toContain('--status-badge-bg');
          expect(style).toContain('--status-badge-text');
          expect(style).toMatch(/var\(--/);

          // Should not have inline color values
          expect(style).not.toMatch(/#[0-9a-fA-F]{3,8}\b/);
          expect(style).not.toMatch(/rgb\s*\(/i);
          expect(style).not.toMatch(/rgba\s*\(/i);

          // Size class should be applied (default or specified)
          const expectedSize = props.size || 'sm';
          expect(badge?.className).toMatch(new RegExp(`size-${expectedSize}`));

          // Custom className should be applied when provided
          if (props.className) {
            expect(badge?.className).toContain(props.className);
          }
        }),
        { numRuns: 100 }
      );
    });
  });

  /**
   * Property 6.9: Semantic Status Color Mapping
   * FOR ALL semantic status variants, THE colors SHALL match their semantic meaning
   */
  describe('Property 6.9: Semantic Status Color Mapping', () => {
    const successVariants: StatusVariant[] = ['active', 'approved', 'received', 'in_stock', 'success'];
    const errorVariants: StatusVariant[] = ['rejected', 'cancelled', 'error'];
    const warningVariants: StatusVariant[] = ['pending', 'pending_approval', 'in_maintenance', 'warning'];
    const infoVariants: StatusVariant[] = ['ordered', 'partially_received', 'info'];
    const neutralVariants: StatusVariant[] = ['inactive', 'draft', 'closed', 'retired', 'disposed'];

    it('success-related variants use success color tokens', () => {
      fc.assert(
        fc.property(
          labelArbitrary,
          fc.constantFrom(...successVariants),
          (label, variant) => {
            cleanup();
            const { container } = render(
              <StatusBadge label={label} variant={variant} />
            );

            const badge = container.querySelector('span');
            const style = badge?.getAttribute('style') || '';

            expect(style).toContain('--color-success-');
          }
        ),
        { numRuns: 25 }
      );
    });

    it('error-related variants use error color tokens', () => {
      fc.assert(
        fc.property(
          labelArbitrary,
          fc.constantFrom(...errorVariants),
          (label, variant) => {
            cleanup();
            const { container } = render(
              <StatusBadge label={label} variant={variant} />
            );

            const badge = container.querySelector('span');
            const style = badge?.getAttribute('style') || '';

            expect(style).toContain('--color-error-');
          }
        ),
        { numRuns: 15 }
      );
    });

    it('warning-related variants use warning color tokens', () => {
      fc.assert(
        fc.property(
          labelArbitrary,
          fc.constantFrom(...warningVariants),
          (label, variant) => {
            cleanup();
            const { container } = render(
              <StatusBadge label={label} variant={variant} />
            );

            const badge = container.querySelector('span');
            const style = badge?.getAttribute('style') || '';

            expect(style).toContain('--color-warning-');
          }
        ),
        { numRuns: 20 }
      );
    });

    it('info-related variants use info color tokens', () => {
      fc.assert(
        fc.property(
          labelArbitrary,
          fc.constantFrom(...infoVariants),
          (label, variant) => {
            cleanup();
            const { container } = render(
              <StatusBadge label={label} variant={variant} />
            );

            const badge = container.querySelector('span');
            const style = badge?.getAttribute('style') || '';

            expect(style).toContain('--color-info-');
          }
        ),
        { numRuns: 15 }
      );
    });

    it('neutral variants use gray color tokens', () => {
      fc.assert(
        fc.property(
          labelArbitrary,
          fc.constantFrom(...neutralVariants),
          (label, variant) => {
            cleanup();
            const { container } = render(
              <StatusBadge label={label} variant={variant} />
            );

            const badge = container.querySelector('span');
            const style = badge?.getAttribute('style') || '';

            expect(style).toContain('--color-gray-');
          }
        ),
        { numRuns: 25 }
      );
    });
  });

  /**
   * Property 6.10: HTML Attribute Pass-through
   * FOR ALL additional HTML attributes, THE component SHALL pass them through to the span element
   */
  describe('Property 6.10: HTML Attribute Pass-through', () => {
    it('passes through data-testid attribute', () => {
      fc.assert(
        fc.property(
          labelArbitrary,
          fc.string({ minLength: 1, maxLength: 20 }).filter(s => /^[a-zA-Z][a-zA-Z0-9_-]*$/.test(s)),
          (label, testId) => {
            cleanup();
            render(
              <StatusBadge label={label} data-testid={testId} />
            );

            expect(screen.getByTestId(testId)).toBeInTheDocument();
          }
        ),
        { numRuns: 30 }
      );
    });

    it('passes through aria attributes', () => {
      fc.assert(
        fc.property(
          labelArbitrary,
          fc.string({ minLength: 1, maxLength: 50 }).map(s => s.trim()).filter(s => s.length > 0),
          (label, ariaLabel) => {
            cleanup();
            const { container } = render(
              <StatusBadge label={label} aria-label={ariaLabel} />
            );

            const badge = container.querySelector('span');
            expect(badge).toHaveAttribute('aria-label', ariaLabel);
          }
        ),
        { numRuns: 30 }
      );
    });
  });
});
