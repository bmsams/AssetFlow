/**
 * Property-Based Tests for PageLayout Component
 *
 * This test file verifies that PageLayout renders consistently across all valid
 * prop combinations using property-based testing with fast-check.
 *
 * **Validates: Requirement 1** - "Unified Page Layout Component"
 * **Validates: Property 1** - "FOR ALL pages using PageLayout, THE rendered output SHALL contain:
 *   - A page title element with consistent typography
 *   - A content container with the specified maxWidth constraint
 *   - Proper semantic HTML structure (header, main content areas)"
 *
 * Test properties covered:
 * - Title is always rendered as h1 heading
 * - Content container has correct maxWidth class
 * - Semantic HTML structure is maintained (header element present)
 * - Breadcrumbs render correctly when provided
 * - Children content is always rendered
 */

import { render, screen, within, cleanup } from '@testing-library/react';
import { describe, it, expect, afterEach } from 'vitest';
import * as fc from 'fast-check';
import { MemoryRouter } from 'react-router-dom';
import { PageLayout, type BreadcrumbItem, type PageLayoutProps } from '../PageLayout';

// Ensure cleanup after each test
afterEach(() => {
  cleanup();
});

function renderWithRouter(ui: JSX.Element) {
  return render(<MemoryRouter>{ui}</MemoryRouter>);
}

// Arbitraries for generating test data

/**
 * Generates valid non-empty strings for titles
 * Titles should be non-empty and reasonably sized
 */
const titleArbitrary = fc.string({ minLength: 1, maxLength: 100 })
  .filter(s => s.trim().length > 0);

/**
 * Generates optional description strings
 */
const descriptionArbitrary = fc.option(
  fc.string({ minLength: 1, maxLength: 500 }).filter(s => s.trim().length > 0),
  { nil: undefined }
);

/**
 * Generates valid maxWidth values
 */
const maxWidthArbitrary = fc.constantFrom('sm', 'md', 'lg', 'xl', 'full' as const);

/**
 * Generates valid breadcrumb items
 */
const breadcrumbItemArbitrary: fc.Arbitrary<BreadcrumbItem> = fc.record({
  label: fc.string({ minLength: 1, maxLength: 50 }).filter(s => s.trim().length > 0),
  href: fc.option(fc.webUrl(), { nil: undefined }),
});

/**
 * Generates arrays of breadcrumb items (0-5 items)
 */
const breadcrumbsArbitrary = fc.option(
  fc.array(breadcrumbItemArbitrary, { minLength: 1, maxLength: 5 }),
  { nil: undefined }
);

/**
 * Generates optional className strings
 */
const classNameArbitrary = fc.option(
  fc.string({ minLength: 1, maxLength: 50 })
    .filter(s => /^[a-zA-Z][a-zA-Z0-9_-]*$/.test(s)),
  { nil: undefined }
);

/**
 * Generates valid Date objects for lastUpdated (using integer timestamps to avoid NaN)
 */
const validDateArbitrary = fc.integer({
  min: new Date('2020-01-01').getTime(),
  max: new Date('2030-12-31').getTime()
}).map(timestamp => new Date(timestamp));

/**
 * Generates optional Date objects for lastUpdated
 */
const lastUpdatedArbitrary = fc.option(validDateArbitrary, { nil: undefined });

/**
 * Generates complete PageLayout props (excluding children and headerActions which are React nodes)
 */
const pageLayoutPropsArbitrary = fc.record({
  title: titleArbitrary,
  description: descriptionArbitrary,
  breadcrumbs: breadcrumbsArbitrary,
  maxWidth: fc.option(maxWidthArbitrary, { nil: undefined }),
  className: classNameArbitrary,
  lastUpdated: lastUpdatedArbitrary,
});

describe('PageLayout Property-Based Tests', () => {
  /**
   * Property 1.1: Title Rendering Consistency
   * FOR ALL valid titles, THE PageLayout SHALL render an h1 heading containing the title text
   */
  describe('Property 1.1: Title Rendering Consistency', () => {
    it('always renders the title as an h1 heading element', () => {
      fc.assert(
        fc.property(titleArbitrary, (title) => {
          cleanup();
          renderWithRouter(
            <PageLayout title={title}>
              <div>Content</div>
            </PageLayout>
          );

          // The title should always be rendered as an h1 heading
          const heading = screen.getByRole('heading', { level: 1 });
          expect(heading).toBeInTheDocument();
          expect(heading.textContent).toBe(title);
        }),
        { numRuns: 50 }
      );
    });

    it('title heading has consistent typography class', () => {
      fc.assert(
        fc.property(titleArbitrary, (title) => {
          cleanup();
          renderWithRouter(
            <PageLayout title={title}>
              <div>Content</div>
            </PageLayout>
          );

          const heading = screen.getByRole('heading', { level: 1 });
          // The heading should have a class applied (from CSS modules)
          expect(heading.className).toBeTruthy();
          expect(heading.className.length).toBeGreaterThan(0);
        }),
        { numRuns: 30 }
      );
    });
  });

  /**
   * Property 1.2: MaxWidth Constraint Consistency
   * FOR ALL maxWidth values, THE content container SHALL have the corresponding maxWidth class
   */
  describe('Property 1.2: MaxWidth Constraint Consistency', () => {
    it('applies the correct maxWidth class to the container', () => {
      fc.assert(
        fc.property(
          titleArbitrary,
          maxWidthArbitrary,
          (title, maxWidth) => {
            cleanup();
            const { container } = renderWithRouter(
              <PageLayout title={title} maxWidth={maxWidth}>
                <div>Content</div>
              </PageLayout>
            );

            const layoutContainer = container.firstChild as HTMLElement;
            // The container should have a class containing the maxWidth value
            expect(layoutContainer.className).toContain(`maxWidth-${maxWidth}`);
          }
        ),
        { numRuns: 25 }
      );
    });

    it('defaults to xl maxWidth when not specified', () => {
      fc.assert(
        fc.property(titleArbitrary, (title) => {
          cleanup();
          const { container } = renderWithRouter(
            <PageLayout title={title}>
              <div>Content</div>
            </PageLayout>
          );

          const layoutContainer = container.firstChild as HTMLElement;
          expect(layoutContainer.className).toContain('maxWidth-xl');
        }),
        { numRuns: 20 }
      );
    });
  });

  /**
   * Property 1.3: Semantic HTML Structure
   * FOR ALL PageLayout instances, THE rendered output SHALL contain proper semantic HTML structure
   */
  describe('Property 1.3: Semantic HTML Structure', () => {
    it('always renders a header element (banner role)', () => {
      fc.assert(
        fc.property(titleArbitrary, (title) => {
          cleanup();
          renderWithRouter(
            <PageLayout title={title}>
              <div>Content</div>
            </PageLayout>
          );

          // The header element should always be present
          const header = screen.getByRole('banner');
          expect(header).toBeInTheDocument();
          expect(header.tagName).toBe('HEADER');
        }),
        { numRuns: 50 }
      );
    });

    it('header contains the title heading', () => {
      fc.assert(
        fc.property(titleArbitrary, (title) => {
          cleanup();
          renderWithRouter(
            <PageLayout title={title}>
              <div>Content</div>
            </PageLayout>
          );

          const header = screen.getByRole('banner');
          const heading = within(header).getByRole('heading', { level: 1 });
          expect(heading).toBeInTheDocument();
          expect(heading.textContent).toBe(title);
        }),
        { numRuns: 30 }
      );
    });

    it('renders children content in a content container', () => {
      fc.assert(
        fc.property(
          titleArbitrary,
          fc.string({ minLength: 1, maxLength: 100 }),
          (title, childContent) => {
            cleanup();
            const testId = 'test-child-content';
            renderWithRouter(
              <PageLayout title={title}>
                <div data-testid={testId}>{childContent}</div>
              </PageLayout>
            );

            const childElement = screen.getByTestId(testId);
            expect(childElement).toBeInTheDocument();
            expect(childElement.textContent).toBe(childContent);
          }
        ),
        { numRuns: 30 }
      );
    });
  });

  /**
   * Property 1.4: Breadcrumb Navigation Consistency
   * FOR ALL breadcrumb configurations, THE PageLayout SHALL render breadcrumbs correctly
   */
  describe('Property 1.4: Breadcrumb Navigation Consistency', () => {
    it('renders breadcrumb navigation when breadcrumbs are provided', () => {
      fc.assert(
        fc.property(
          titleArbitrary,
          fc.array(breadcrumbItemArbitrary, { minLength: 1, maxLength: 5 }),
          (title, breadcrumbs) => {
            cleanup();
            renderWithRouter(
              <PageLayout title={title} breadcrumbs={breadcrumbs}>
                <div>Content</div>
              </PageLayout>
            );

            // Breadcrumb navigation should be present
            const nav = screen.getByRole('navigation', { name: /breadcrumb/i });
            expect(nav).toBeInTheDocument();
            expect(nav).toHaveAttribute('aria-label', 'Breadcrumb');
          }
        ),
        { numRuns: 30 }
      );
    });

    it('does not render breadcrumb navigation when breadcrumbs are not provided', () => {
      fc.assert(
        fc.property(titleArbitrary, (title) => {
          cleanup();
          renderWithRouter(
            <PageLayout title={title}>
              <div>Content</div>
            </PageLayout>
          );

          // Breadcrumb navigation should not be present
          const nav = screen.queryByRole('navigation', { name: /breadcrumb/i });
          expect(nav).not.toBeInTheDocument();
        }),
        { numRuns: 20 }
      );
    });

    it('renders correct number of breadcrumb items', () => {
      fc.assert(
        fc.property(
          titleArbitrary,
          fc.array(breadcrumbItemArbitrary, { minLength: 1, maxLength: 5 }),
          (title, breadcrumbs) => {
            cleanup();
            renderWithRouter(
              <PageLayout title={title} breadcrumbs={breadcrumbs}>
                <div>Content</div>
              </PageLayout>
            );

            const listItems = screen.getAllByRole('listitem');
            expect(listItems).toHaveLength(breadcrumbs.length);
          }
        ),
        { numRuns: 30 }
      );
    });

    it('last breadcrumb item has aria-current="page"', () => {
      fc.assert(
        fc.property(
          titleArbitrary,
          fc.array(breadcrumbItemArbitrary, { minLength: 1, maxLength: 5 }),
          (title, breadcrumbs) => {
            cleanup();
            renderWithRouter(
              <PageLayout title={title} breadcrumbs={breadcrumbs}>
                <div>Content</div>
              </PageLayout>
            );

            // Find all elements with aria-current="page"
            const currentPageElements = screen.getAllByRole('listitem')
              .map(li => li.querySelector('[aria-current="page"]'))
              .filter(Boolean);
            
            // There should be exactly one element with aria-current="page"
            expect(currentPageElements).toHaveLength(1);
            
            // It should be in the last list item
            const lastListItem = screen.getAllByRole('listitem').pop();
            const lastCurrentElement = lastListItem?.querySelector('[aria-current="page"]');
            expect(lastCurrentElement).toBeTruthy();
            expect(lastCurrentElement?.textContent).toBe(breadcrumbs[breadcrumbs.length - 1].label);
          }
        ),
        { numRuns: 30 }
      );
    });
  });

  /**
   * Property 1.5: Description Rendering Consistency
   * FOR ALL descriptions, THE PageLayout SHALL render the description when provided
   */
  describe('Property 1.5: Description Rendering Consistency', () => {
    it('renders description when provided', () => {
      fc.assert(
        fc.property(
          titleArbitrary,
          fc.string({ minLength: 1, maxLength: 200 }).filter(s => s.trim().length > 0),
          (title, description) => {
            cleanup();
            renderWithRouter(
              <PageLayout title={title} description={description}>
                <div>Content</div>
              </PageLayout>
            );

            // Find the description paragraph within the header
            const header = screen.getByRole('banner');
            const descriptionElement = header.querySelector('p');
            expect(descriptionElement).toBeTruthy();
            expect(descriptionElement?.textContent).toBe(description);
          }
        ),
        { numRuns: 30 }
      );
    });

    it('does not render description paragraph when not provided', () => {
      fc.assert(
        fc.property(titleArbitrary, (title) => {
          cleanup();
          renderWithRouter(
            <PageLayout title={title}>
              <div>Content</div>
            </PageLayout>
          );

          // The header should not contain any paragraph elements
          const header = screen.getByRole('banner');
          const paragraphs = header.querySelectorAll('p');
          expect(paragraphs).toHaveLength(0);
        }),
        { numRuns: 20 }
      );
    });
  });

  /**
   * Property 1.6: Custom ClassName Consistency
   * FOR ALL custom classNames, THE PageLayout SHALL apply them to the container
   */
  describe('Property 1.6: Custom ClassName Consistency', () => {
    it('applies custom className to the container', () => {
      fc.assert(
        fc.property(
          titleArbitrary,
          fc.string({ minLength: 1, maxLength: 30 }).filter(s => /^[a-zA-Z][a-zA-Z0-9_-]*$/.test(s)),
          (title, customClass) => {
            cleanup();
            const { container } = renderWithRouter(
              <PageLayout title={title} className={customClass}>
                <div>Content</div>
              </PageLayout>
            );

            const layoutContainer = container.firstChild as HTMLElement;
            expect(layoutContainer.className).toContain(customClass);
          }
        ),
        { numRuns: 30 }
      );
    });

    it('combines custom className with default classes', () => {
      fc.assert(
        fc.property(
          titleArbitrary,
          maxWidthArbitrary,
          fc.string({ minLength: 1, maxLength: 30 }).filter(s => /^[a-zA-Z][a-zA-Z0-9_-]*$/.test(s)),
          (title, maxWidth, customClass) => {
            cleanup();
            const { container } = renderWithRouter(
              <PageLayout title={title} maxWidth={maxWidth} className={customClass}>
                <div>Content</div>
              </PageLayout>
            );

            const layoutContainer = container.firstChild as HTMLElement;
            // Should have both the maxWidth class and custom class
            expect(layoutContainer.className).toContain(`maxWidth-${maxWidth}`);
            expect(layoutContainer.className).toContain(customClass);
          }
        ),
        { numRuns: 30 }
      );
    });
  });

  /**
   * Property 1.7: Last Updated Timestamp Consistency
   * FOR ALL lastUpdated dates, THE PageLayout SHALL render the timestamp when provided
   */
  describe('Property 1.7: Last Updated Timestamp Consistency', () => {
    it('renders last updated text when date is provided', () => {
      fc.assert(
        fc.property(
          titleArbitrary,
          validDateArbitrary,
          (title, lastUpdated) => {
            cleanup();
            renderWithRouter(
              <PageLayout title={title} lastUpdated={lastUpdated}>
                <div>Content</div>
              </PageLayout>
            );

            expect(screen.getByText(/last updated:/i)).toBeInTheDocument();
          }
        ),
        { numRuns: 30 }
      );
    });

    it('does not render last updated when not provided', () => {
      fc.assert(
        fc.property(titleArbitrary, (title) => {
          cleanup();
          renderWithRouter(
            <PageLayout title={title}>
              <div>Content</div>
            </PageLayout>
          );

          expect(screen.queryByText(/last updated:/i)).not.toBeInTheDocument();
        }),
        { numRuns: 20 }
      );
    });
  });

  /**
   * Property 1.8: Header Actions Rendering Consistency
   * FOR ALL header actions, THE PageLayout SHALL render them in the header actions area
   */
  describe('Property 1.8: Header Actions Rendering Consistency', () => {
    it('renders header actions when provided', () => {
      fc.assert(
        fc.property(
          titleArbitrary,
          fc.string({ minLength: 1, maxLength: 50 }),
          (title, buttonText) => {
            cleanup();
            const testId = 'header-action-button';
            renderWithRouter(
              <PageLayout
                title={title}
                headerActions={<button data-testid={testId}>{buttonText}</button>}
              >
                <div>Content</div>
              </PageLayout>
            );

            const actionButton = screen.getByTestId(testId);
            expect(actionButton).toBeInTheDocument();
            expect(actionButton.textContent).toBe(buttonText);
          }
        ),
        { numRuns: 30 }
      );
    });
  });

  /**
   * Property 1.9: Combined Props Consistency
   * FOR ALL combinations of props, THE PageLayout SHALL render consistently
   */
  describe('Property 1.9: Combined Props Consistency', () => {
    it('renders correctly with all props combined', () => {
      fc.assert(
        fc.property(
          pageLayoutPropsArbitrary,
          (props) => {
            cleanup();
            const { container } = renderWithRouter(
              <PageLayout {...props}>
                <div data-testid="child-content">Test Content</div>
              </PageLayout>
            );

            // Core structure should always be present
            const layoutContainer = container.firstChild as HTMLElement;
            expect(layoutContainer).toBeInTheDocument();

            // Title should always be rendered
            const heading = screen.getByRole('heading', { level: 1 });
            expect(heading).toBeInTheDocument();
            expect(heading.textContent).toBe(props.title);

            // Header should always be present
            const header = screen.getByRole('banner');
            expect(header).toBeInTheDocument();

            // Children should always be rendered
            const childContent = screen.getByTestId('child-content');
            expect(childContent).toBeInTheDocument();

            // MaxWidth class should be applied (default or specified)
            const expectedMaxWidth = props.maxWidth || 'xl';
            expect(layoutContainer.className).toContain(`maxWidth-${expectedMaxWidth}`);

            // Breadcrumbs should be present only when provided
            const nav = screen.queryByRole('navigation', { name: /breadcrumb/i });
            if (props.breadcrumbs && props.breadcrumbs.length > 0) {
              expect(nav).toBeInTheDocument();
            } else {
              expect(nav).not.toBeInTheDocument();
            }

            // Description should be present only when provided
            if (props.description) {
              const descriptionElement = header.querySelector('p');
              expect(descriptionElement).toBeTruthy();
              expect(descriptionElement?.textContent).toBe(props.description);
            }

            // Last updated should be present only when provided
            if (props.lastUpdated) {
              expect(screen.getByText(/last updated:/i)).toBeInTheDocument();
            }

            // Custom className should be applied when provided
            if (props.className) {
              expect(layoutContainer.className).toContain(props.className);
            }
          }
        ),
        { numRuns: 100 }
      );
    });
  });
});
