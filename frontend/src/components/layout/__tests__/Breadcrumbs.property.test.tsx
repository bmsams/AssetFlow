/**
 * Property-Based Tests for Breadcrumbs Component
 *
 * **Validates: Requirement 2** - "Breadcrumb Navigation Component"
 * **Validates: Property 2** - "Breadcrumb Navigation Integrity"
 *
 * FOR ALL breadcrumb configurations with N items where N > 0:
 * - THE last item SHALL be rendered as non-clickable (current page)
 * - THE first N-1 items SHALL be rendered as clickable links
 * - THE aria-current="page" attribute SHALL only appear on the last item
 */

import { render, screen, cleanup } from '@testing-library/react';
import '@testing-library/jest-dom';
import { describe, it, expect, afterEach } from 'vitest';
import * as fc from 'fast-check';
import { Breadcrumbs, type BreadcrumbItem } from '../Breadcrumbs';

afterEach(() => {
  cleanup();
});

const createBreadcrumbPath = (length: number): BreadcrumbItem[] => {
  return Array.from({ length }, (_, i) => {
    const isLast = i === length - 1;
    return isLast
      ? { label: `CurrentPage_${i}` }
      : { label: `Ancestor_${i}`, href: `/path${i}` };
  });
};

const validBreadcrumbPathArbitrary = (minLen = 1, maxLen = 6): fc.Arbitrary<BreadcrumbItem[]> =>
  fc.integer({ min: minLen, max: maxLen }).map(createBreadcrumbPath);

const separatorArbitrary = fc.constantFrom('/', '>', '-');

describe('Breadcrumbs Property-Based Tests', () => {
  describe('Property 2.1: Last Item Non-Clickable', () => {
    it('last item is always rendered as a span, not a link', () => {
      fc.assert(
        fc.property(validBreadcrumbPathArbitrary(1, 6), (items) => {
          cleanup();
          render(<Breadcrumbs items={items} />);
          const listItems = screen.getAllByRole('listitem');
          const lastListItem = listItems[listItems.length - 1];
          const lastItemLink = lastListItem.querySelector('a');
          const lastItemSpan = lastListItem.querySelector('span[aria-current="page"]');
          expect(lastItemLink).toBeNull();
          expect(lastItemSpan).not.toBeNull();
          expect(lastItemSpan?.textContent).toBe(items[items.length - 1].label);
        }),
        { numRuns: 50 }
      );
    });
  });

  describe('Property 2.2: First N-1 Items as Clickable Links', () => {
    it('all ancestor items with href are rendered as links', () => {
      fc.assert(
        fc.property(validBreadcrumbPathArbitrary(2, 4), (items) => {
          cleanup();
          render(<Breadcrumbs items={items} />);
          const links = screen.getAllByRole('link');
          const itemsWithHref = items.slice(0, -1).filter((item) => item.href);
          expect(links.length).toBe(itemsWithHref.length);
          itemsWithHref.forEach((item, index) => {
            expect(links[index]).toHaveAttribute('href', item.href);
          });
        }),
        { numRuns: 50 }
      );
    });
  });

  describe('Property 2.3: aria-current="page" Only on Last Item', () => {
    it('exactly one element has aria-current="page"', () => {
      fc.assert(
        fc.property(validBreadcrumbPathArbitrary(1, 6), (items) => {
          cleanup();
          const { container } = render(<Breadcrumbs items={items} />);
          const elementsWithAriaCurrent = container.querySelectorAll('[aria-current="page"]');
          expect(elementsWithAriaCurrent.length).toBe(1);
        }),
        { numRuns: 50 }
      );
    });

    it('aria-current="page" is on the last item only', () => {
      fc.assert(
        fc.property(validBreadcrumbPathArbitrary(1, 6), (items) => {
          cleanup();
          const { container } = render(<Breadcrumbs items={items} />);
          const elementWithAriaCurrent = container.querySelector('[aria-current="page"]');
          expect(elementWithAriaCurrent).not.toBeNull();
          expect(elementWithAriaCurrent?.textContent).toBe(items[items.length - 1].label);
        }),
        { numRuns: 50 }
      );
    });

    it('no ancestor items have aria-current attribute', () => {
      fc.assert(
        fc.property(validBreadcrumbPathArbitrary(2, 4), (items) => {
          cleanup();
          render(<Breadcrumbs items={items} />);
          const ancestorItems = items.slice(0, -1);
          ancestorItems.forEach((item) => {
            const elements = screen.getAllByText(item.label);
            elements.forEach((element) => {
              expect(element).not.toHaveAttribute('aria-current');
            });
          });
        }),
        { numRuns: 50 }
      );
    });
  });

  describe('Property 2.4: ARIA Accessibility Attributes', () => {
    it('navigation element has aria-label="Breadcrumb"', () => {
      fc.assert(
        fc.property(validBreadcrumbPathArbitrary(1, 6), (items) => {
          cleanup();
          render(<Breadcrumbs items={items} />);
          const nav = screen.getByRole('navigation');
          expect(nav).toHaveAttribute('aria-label', 'Breadcrumb');
        }),
        { numRuns: 50 }
      );
    });

    it('breadcrumb items are rendered in an ordered list', () => {
      fc.assert(
        fc.property(validBreadcrumbPathArbitrary(1, 6), (items) => {
          cleanup();
          render(<Breadcrumbs items={items} />);
          const list = screen.getByRole('list');
          expect(list.tagName).toBe('OL');
        }),
        { numRuns: 30 }
      );
    });

    it('separators have aria-hidden="true"', () => {
      fc.assert(
        fc.property(validBreadcrumbPathArbitrary(2, 5), separatorArbitrary, (items, separator) => {
          cleanup();
          const { container } = render(<Breadcrumbs items={items} separator={separator} />);
          const separatorElements = container.querySelectorAll('[aria-hidden="true"]');
          expect(separatorElements.length).toBeGreaterThanOrEqual(items.length - 1);
        }),
        { numRuns: 30 }
      );
    });
  });

  describe('Property 2.5: Separator Rendering Consistency', () => {
    it('correct number of separators are rendered', () => {
      fc.assert(
        fc.property(validBreadcrumbPathArbitrary(2, 4), separatorArbitrary, (items, separator) => {
          cleanup();
          render(<Breadcrumbs items={items} separator={separator} maxItems={10} />);
          const separatorElements = screen.getAllByText(separator);
          expect(separatorElements.length).toBe(items.length - 1);
        }),
        { numRuns: 30 }
      );
    });
  });

  describe('Property 2.6: Truncation Behavior with maxItems', () => {
    it('first and last items are always visible when truncated', () => {
      fc.assert(
        fc.property(validBreadcrumbPathArbitrary(5, 8), fc.integer({ min: 2, max: 4 }), (items, maxItems) => {
          cleanup();
          render(<Breadcrumbs items={items} maxItems={maxItems} />);
          expect(screen.getByText(items[0].label)).toBeInTheDocument();
          expect(screen.getByText(items[items.length - 1].label)).toBeInTheDocument();
          expect(screen.getByText('\u2026')).toBeInTheDocument();
        }),
        { numRuns: 30 }
      );
    });

    it('ellipsis has aria-hidden="true"', () => {
      fc.assert(
        fc.property(validBreadcrumbPathArbitrary(5, 8), fc.integer({ min: 2, max: 4 }), (items, maxItems) => {
          cleanup();
          render(<Breadcrumbs items={items} maxItems={maxItems} />);
          const ellipsis = screen.getByText('\u2026');
          expect(ellipsis).toHaveAttribute('aria-hidden', 'true');
        }),
        { numRuns: 30 }
      );
    });

    it('no truncation when items count is less than or equal to maxItems', () => {
      fc.assert(
        fc.property(validBreadcrumbPathArbitrary(2, 4), fc.integer({ min: 4, max: 10 }), (items, maxItems) => {
          cleanup();
          render(<Breadcrumbs items={items} maxItems={maxItems} />);
          expect(screen.queryByText('\u2026')).toBeNull();
          items.forEach((item) => {
            expect(screen.getByText(item.label)).toBeInTheDocument();
          });
        }),
        { numRuns: 30 }
      );
    });
  });

  describe('Property 2.7: Navigation Integrity Under Various Configurations', () => {
    it('maintains navigation integrity with various separators', () => {
      fc.assert(
        fc.property(validBreadcrumbPathArbitrary(2, 5), separatorArbitrary, (items, separator) => {
          cleanup();
          render(<Breadcrumbs items={items} separator={separator} maxItems={10} />);
          const currentPage = screen.getByText(items[items.length - 1].label);
          expect(currentPage).toHaveAttribute('aria-current', 'page');
          const links = screen.getAllByRole('link');
          expect(links.length).toBe(items.length - 1);
        }),
        { numRuns: 30 }
      );
    });

    it('single item breadcrumb is always current page', () => {
      fc.assert(
        fc.property(
          fc.stringMatching(/^[a-zA-Z0-9]{1,20}$/),
          (label) => {
            cleanup();
            const item: BreadcrumbItem = { label };
            render(<Breadcrumbs items={[item]} />);
            const currentPage = screen.getByText(label);
            expect(currentPage).toHaveAttribute('aria-current', 'page');
            expect(currentPage.tagName).toBe('SPAN');
            expect(screen.queryAllByRole('link')).toHaveLength(0);
          }
        ),
        { numRuns: 30 }
      );
    });
  });

  describe('Property 2.8: Empty and Edge Cases', () => {
    it('returns null for empty items array', () => {
      const { container } = render(<Breadcrumbs items={[]} />);
      expect(container.firstChild).toBeNull();
    });

    it('handles items with special characters in labels', () => {
      fc.assert(
        fc.property(fc.integer({ min: 1, max: 4 }), (length) => {
          cleanup();
          const items: BreadcrumbItem[] = Array.from({ length }, (_, i) => ({
            label: `Item${i} and test quotes`,
            href: i < length - 1 ? `/path${i}` : undefined,
          }));
          render(<Breadcrumbs items={items} />);
          items.forEach((item) => {
            expect(screen.getByText(item.label)).toBeInTheDocument();
          });
        }),
        { numRuns: 20 }
      );
    });
  });
});
