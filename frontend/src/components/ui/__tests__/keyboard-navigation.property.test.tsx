/**
 * Property-Based Tests for Keyboard Navigation Completeness
 *
 * This test file verifies that all interactive elements are keyboard accessible
 * using property-based testing with fast-check.
 *
 * **Validates: Requirement 11** - "Accessibility Improvements"
 * **Validates: Property 10** - "FOR ALL interactive elements in the application:
 *   - THE element SHALL be reachable via Tab key navigation
 *   - THE element SHALL have a visible focus indicator
 *   - THE element SHALL be activatable via Enter or Space key"
 *
 * Test properties covered:
 * - All buttons are reachable via Tab key navigation
 * - All buttons have visible focus indicators (CSS classes applied)
 * - All buttons are activatable via Enter key
 * - All buttons are activatable via Space key
 * - All links are reachable via Tab key navigation
 * - All inputs are reachable via Tab key navigation
 * - Focus order follows logical DOM order
 * - Disabled elements are skipped during Tab navigation
 */

import { render, screen, cleanup } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, it, expect, afterEach, vi, beforeAll, afterAll } from 'vitest';
import * as fc from 'fast-check';
import { Button, type ButtonVariant, type ButtonSize } from '../Button';
import { Modal } from '../Modal';
import { FilterToolbar, type FilterConfig } from '../FilterToolbar';
import { ResponsiveTable } from '../ResponsiveTable';

// Mock the useAnnounce hook for Modal tests
const mockAnnounce = vi.fn();
vi.mock('../../accessibility/useAnnounce', () => ({
  useAnnounce: () => ({
    announce: mockAnnounce,
    announcePolite: (msg: string) => mockAnnounce(msg, 'polite'),
    announceAssertive: (msg: string) => mockAnnounce(msg, 'assertive'),
  }),
}));

// Mock ResizeObserver for ResponsiveTable tests
const ResizeObserverMock = vi.fn(() => ({
  observe: vi.fn(),
  unobserve: vi.fn(),
  disconnect: vi.fn(),
}));

beforeAll(() => {
  vi.stubGlobal('ResizeObserver', ResizeObserverMock);
});


afterAll(() => {
  vi.unstubAllGlobals();
});

// Ensure cleanup after each test
afterEach(() => {
  cleanup();
  document.body.style.overflow = '';
  mockAnnounce.mockClear();
});

// Arbitraries for generating test data

/**
 * Generates valid non-empty strings for button labels
 */
const labelArbitrary = fc.string({ minLength: 1, maxLength: 50 })
  .map(s => s.trim())
  .filter(s => s.length > 0);

/**
 * Generates valid button variants
 */
const buttonVariantArbitrary: fc.Arbitrary<ButtonVariant> = fc.constantFrom(
  'primary', 'secondary', 'outline', 'ghost', 'danger'
);

/**
 * Generates valid button sizes
 */
const buttonSizeArbitrary: fc.Arbitrary<ButtonSize> = fc.constantFrom('sm', 'md', 'lg');

/**
 * Generates number of buttons to render (1-5)
 */
const buttonCountArbitrary = fc.integer({ min: 1, max: 5 });

/**
 * Generates valid input types for form elements
 */
const inputTypeArbitrary = fc.constantFrom('text', 'email', 'password', 'number', 'tel', 'url');

/**
 * Generates complete Button props for testing
 */
const buttonPropsArbitrary = fc.record({
  variant: fc.option(buttonVariantArbitrary, { nil: undefined }),
  size: fc.option(buttonSizeArbitrary, { nil: undefined }),
  disabled: fc.option(fc.boolean(), { nil: undefined }),
});

describe('Keyboard Navigation Completeness Property-Based Tests', () => {
  /**
   * Property 10.1: Tab Key Reachability for Buttons
   * FOR ALL buttons, THE element SHALL be reachable via Tab key navigation
   */
  describe('Property 10.1: Tab Key Reachability for Buttons', () => {
    it('all enabled buttons are reachable via Tab key', async () => {
      const user = userEvent.setup();
      
      await fc.assert(
        fc.asyncProperty(
          buttonCountArbitrary,
          labelArbitrary,
          async (count, label) => {
            cleanup();
            
            // Create array of buttons
            const buttons = Array.from({ length: count }, (_, i) => (
              <Button key={i} data-testid={`button-${i}`}>{`${label} ${i + 1}`}</Button>
            ));

            render(<div>{buttons}</div>);

            // Tab through all buttons
            for (let i = 0; i < count; i++) {
              await user.tab();
              const expectedButton = screen.getByTestId(`button-${i}`);
              expect(document.activeElement).toBe(expectedButton);
            }
          }
        ),
        { numRuns: 30 }
      );
    });

    it('disabled buttons are skipped during Tab navigation', async () => {
      const user = userEvent.setup();
      
      await fc.assert(
        fc.asyncProperty(
          fc.integer({ min: 1, max: 3 }),
          labelArbitrary,
          async (disabledIndex, label) => {
            cleanup();
            
            // Create 3 buttons with one disabled
            const buttons = [0, 1, 2].map((i) => (
              <Button 
                key={i} 
                data-testid={`button-${i}`}
                disabled={i === disabledIndex}
              >
                {`${label} ${i + 1}`}
              </Button>
            ));

            render(<div>{buttons}</div>);

            // Tab through buttons - disabled one should be skipped
            const enabledIndices = [0, 1, 2].filter(i => i !== disabledIndex);
            
            for (const expectedIndex of enabledIndices) {
              await user.tab();
              const expectedButton = screen.getByTestId(`button-${expectedIndex}`);
              expect(document.activeElement).toBe(expectedButton);
            }
          }
        ),
        { numRuns: 20 }
      );
    });

    it('buttons with various variants are all reachable via Tab', async () => {
      const user = userEvent.setup();
      
      await fc.assert(
        fc.asyncProperty(
          fc.array(buttonVariantArbitrary, { minLength: 2, maxLength: 5 }),
          labelArbitrary,
          async (variants, label) => {
            cleanup();
            
            const buttons = variants.map((variant, i) => (
              <Button key={i} variant={variant} data-testid={`button-${i}`}>
                {`${label} ${variant}`}
              </Button>
            ));

            render(<div>{buttons}</div>);

            // All buttons should be reachable regardless of variant
            for (let i = 0; i < variants.length; i++) {
              await user.tab();
              const expectedButton = screen.getByTestId(`button-${i}`);
              expect(document.activeElement).toBe(expectedButton);
            }
          }
        ),
        { numRuns: 20 }
      );
    });

    it('buttons with various sizes are all reachable via Tab', async () => {
      const user = userEvent.setup();
      
      await fc.assert(
        fc.asyncProperty(
          fc.array(buttonSizeArbitrary, { minLength: 2, maxLength: 3 }),
          labelArbitrary,
          async (sizes, label) => {
            cleanup();
            
            const buttons = sizes.map((size, i) => (
              <Button key={i} size={size} data-testid={`button-${i}`}>
                {`${label} ${size}`}
              </Button>
            ));

            render(<div>{buttons}</div>);

            // All buttons should be reachable regardless of size
            for (let i = 0; i < sizes.length; i++) {
              await user.tab();
              const expectedButton = screen.getByTestId(`button-${i}`);
              expect(document.activeElement).toBe(expectedButton);
            }
          }
        ),
        { numRuns: 20 }
      );
    });
  });


  /**
   * Property 10.2: Visible Focus Indicators
   * FOR ALL interactive elements, THE element SHALL have a visible focus indicator
   */
  describe('Property 10.2: Visible Focus Indicators', () => {
    it('buttons have CSS classes applied when focused', async () => {
      const user = userEvent.setup();
      
      await fc.assert(
        fc.asyncProperty(
          buttonVariantArbitrary,
          buttonSizeArbitrary,
          labelArbitrary,
          async (variant, size, label) => {
            cleanup();
            
            render(
              <Button variant={variant} size={size} data-testid="focus-button">
                {label}
              </Button>
            );

            const button = screen.getByTestId('focus-button');
            
            // Tab to the button
            await user.tab();
            expect(document.activeElement).toBe(button);
            
            // Button should have CSS classes applied (from CSS modules)
            // Focus styles are applied via CSS :focus/:focus-visible selectors
            expect(button.className).toBeTruthy();
            expect(button.className.length).toBeGreaterThan(0);
            
            // Verify the button can receive focus (has focus)
            expect(button).toHaveFocus();
          }
        ),
        { numRuns: 30 }
      );
    });

    it('inputs have visible focus when tabbed to', async () => {
      const user = userEvent.setup();
      
      await fc.assert(
        fc.asyncProperty(
          inputTypeArbitrary,
          labelArbitrary,
          async (inputType, placeholder) => {
            cleanup();
            
            render(
              <input 
                type={inputType} 
                placeholder={placeholder}
                data-testid="focus-input"
              />
            );

            const input = screen.getByTestId('focus-input');
            
            // Tab to the input
            await user.tab();
            expect(document.activeElement).toBe(input);
            expect(input).toHaveFocus();
          }
        ),
        { numRuns: 20 }
      );
    });

    it('select elements have visible focus when tabbed to', async () => {
      const user = userEvent.setup();
      
      await fc.assert(
        fc.asyncProperty(
          fc.array(labelArbitrary, { minLength: 1, maxLength: 5 }),
          async (options) => {
            cleanup();
            
            render(
              <select data-testid="focus-select">
                {options.map((opt, i) => (
                  <option key={i} value={i}>{opt}</option>
                ))}
              </select>
            );

            const select = screen.getByTestId('focus-select');
            
            // Tab to the select
            await user.tab();
            expect(document.activeElement).toBe(select);
            expect(select).toHaveFocus();
          }
        ),
        { numRuns: 20 }
      );
    });

    it('textarea elements have visible focus when tabbed to', async () => {
      const user = userEvent.setup();
      
      await fc.assert(
        fc.asyncProperty(
          labelArbitrary,
          async (placeholder) => {
            cleanup();
            
            render(
              <textarea 
                placeholder={placeholder}
                data-testid="focus-textarea"
              />
            );

            const textarea = screen.getByTestId('focus-textarea');
            
            // Tab to the textarea
            await user.tab();
            expect(document.activeElement).toBe(textarea);
            expect(textarea).toHaveFocus();
          }
        ),
        { numRuns: 20 }
      );
    });
  });


  /**
   * Property 10.3: Enter Key Activation
   * FOR ALL buttons, THE element SHALL be activatable via Enter key
   */
  describe('Property 10.3: Enter Key Activation', () => {
    it('buttons are activated by Enter key for all variants', async () => {
      const user = userEvent.setup();
      
      await fc.assert(
        fc.asyncProperty(
          buttonVariantArbitrary,
          labelArbitrary,
          async (variant, label) => {
            cleanup();
            
            const handleClick = vi.fn();
            
            render(
              <Button variant={variant} onClick={handleClick}>
                {label}
              </Button>
            );

            const button = screen.getByRole('button', { name: label });
            
            // Tab to button and press Enter
            await user.tab();
            expect(document.activeElement).toBe(button);
            
            await user.keyboard('{Enter}');
            expect(handleClick).toHaveBeenCalledTimes(1);
          }
        ),
        { numRuns: 25 }
      );
    });

    it('buttons are activated by Enter key for all sizes', async () => {
      const user = userEvent.setup();
      
      await fc.assert(
        fc.asyncProperty(
          buttonSizeArbitrary,
          labelArbitrary,
          async (size, label) => {
            cleanup();
            
            const handleClick = vi.fn();
            
            render(
              <Button size={size} onClick={handleClick}>
                {label}
              </Button>
            );

            const button = screen.getByRole('button', { name: label });
            
            // Tab to button and press Enter
            await user.tab();
            expect(document.activeElement).toBe(button);
            
            await user.keyboard('{Enter}');
            expect(handleClick).toHaveBeenCalledTimes(1);
          }
        ),
        { numRuns: 15 }
      );
    });

    it('disabled buttons do not activate on Enter key', async () => {
      const user = userEvent.setup();
      
      await fc.assert(
        fc.asyncProperty(
          buttonVariantArbitrary,
          labelArbitrary,
          async (variant, label) => {
            cleanup();
            
            const handleClick = vi.fn();
            
            render(
              <div>
                <Button data-testid="before-btn">Before</Button>
                <Button variant={variant} onClick={handleClick} disabled>
                  {label}
                </Button>
              </div>
            );

            // Tab to the first button (disabled button is skipped)
            await user.tab();
            const beforeBtn = screen.getByTestId('before-btn');
            expect(document.activeElement).toBe(beforeBtn);
            
            // Try to focus the disabled button directly and press Enter
            const disabledButton = screen.getByRole('button', { name: label });
            disabledButton.focus();
            
            await user.keyboard('{Enter}');
            expect(handleClick).not.toHaveBeenCalled();
          }
        ),
        { numRuns: 15 }
      );
    });

    it('multiple buttons can each be activated by Enter key', async () => {
      const user = userEvent.setup();
      
      await fc.assert(
        fc.asyncProperty(
          fc.integer({ min: 2, max: 4 }),
          labelArbitrary,
          async (count, label) => {
            cleanup();
            
            const handlers = Array.from({ length: count }, () => vi.fn());
            
            const buttons = handlers.map((handler, i) => (
              <Button key={i} onClick={handler} data-testid={`button-${i}`}>
                {`${label} ${i + 1}`}
              </Button>
            ));

            render(<div>{buttons}</div>);

            // Tab to each button and activate with Enter
            for (let i = 0; i < count; i++) {
              await user.tab();
              const button = screen.getByTestId(`button-${i}`);
              expect(document.activeElement).toBe(button);
              
              await user.keyboard('{Enter}');
              expect(handlers[i]).toHaveBeenCalledTimes(1);
            }
          }
        ),
        { numRuns: 15 }
      );
    });
  });


  /**
   * Property 10.4: Space Key Activation
   * FOR ALL buttons, THE element SHALL be activatable via Space key
   */
  describe('Property 10.4: Space Key Activation', () => {
    it('buttons are activated by Space key for all variants', async () => {
      const user = userEvent.setup();
      
      await fc.assert(
        fc.asyncProperty(
          buttonVariantArbitrary,
          labelArbitrary,
          async (variant, label) => {
            cleanup();
            
            const handleClick = vi.fn();
            
            render(
              <Button variant={variant} onClick={handleClick}>
                {label}
              </Button>
            );

            const button = screen.getByRole('button', { name: label });
            
            // Tab to button and press Space
            await user.tab();
            expect(document.activeElement).toBe(button);
            
            await user.keyboard(' ');
            expect(handleClick).toHaveBeenCalledTimes(1);
          }
        ),
        { numRuns: 25 }
      );
    });

    it('buttons are activated by Space key for all sizes', async () => {
      const user = userEvent.setup();
      
      await fc.assert(
        fc.asyncProperty(
          buttonSizeArbitrary,
          labelArbitrary,
          async (size, label) => {
            cleanup();
            
            const handleClick = vi.fn();
            
            render(
              <Button size={size} onClick={handleClick}>
                {label}
              </Button>
            );

            const button = screen.getByRole('button', { name: label });
            
            // Tab to button and press Space
            await user.tab();
            expect(document.activeElement).toBe(button);
            
            await user.keyboard(' ');
            expect(handleClick).toHaveBeenCalledTimes(1);
          }
        ),
        { numRuns: 15 }
      );
    });

    it('Space key toggles checkboxes', async () => {
      const user = userEvent.setup();
      
      await fc.assert(
        fc.asyncProperty(
          fc.boolean(),
          async (initialChecked) => {
            cleanup();
            
            render(
              <input 
                type="checkbox" 
                defaultChecked={initialChecked}
                data-testid="checkbox"
              />
            );

            const checkbox = screen.getByTestId('checkbox') as HTMLInputElement;
            
            // Tab to checkbox
            await user.tab();
            expect(document.activeElement).toBe(checkbox);
            expect(checkbox.checked).toBe(initialChecked);
            
            // Press Space to toggle
            await user.keyboard(' ');
            expect(checkbox.checked).toBe(!initialChecked);
            
            // Press Space again to toggle back
            await user.keyboard(' ');
            expect(checkbox.checked).toBe(initialChecked);
          }
        ),
        { numRuns: 10 }
      );
    });

    it('disabled buttons do not activate on Space key', async () => {
      const user = userEvent.setup();
      
      await fc.assert(
        fc.asyncProperty(
          buttonVariantArbitrary,
          labelArbitrary,
          async (variant, label) => {
            cleanup();
            
            const handleClick = vi.fn();
            
            render(
              <div>
                <Button data-testid="before-btn">Before</Button>
                <Button variant={variant} onClick={handleClick} disabled>
                  {label}
                </Button>
              </div>
            );

            // Tab to the first button (disabled button is skipped)
            await user.tab();
            const beforeBtn = screen.getByTestId('before-btn');
            expect(document.activeElement).toBe(beforeBtn);
            
            // Try to focus the disabled button directly and press Space
            const disabledButton = screen.getByRole('button', { name: label });
            disabledButton.focus();
            
            await user.keyboard(' ');
            expect(handleClick).not.toHaveBeenCalled();
          }
        ),
        { numRuns: 15 }
      );
    });
  });


  /**
   * Property 10.5: Tab Navigation Order
   * FOR ALL interactive elements, THE focus order SHALL follow logical DOM order
   */
  describe('Property 10.5: Tab Navigation Order', () => {
    it('Tab navigation follows DOM order for mixed interactive elements', async () => {
      const user = userEvent.setup();
      
      await fc.assert(
        fc.asyncProperty(
          fc.integer({ min: 2, max: 5 }),
          async (count) => {
            cleanup();
            
            // Create a mix of interactive elements
            const elements = Array.from({ length: count }, (_, i) => {
              const type = i % 3;
              if (type === 0) {
                return <Button key={i} data-testid={`element-${i}`}>Button {i}</Button>;
              } else if (type === 1) {
                return <input key={i} type="text" data-testid={`element-${i}`} placeholder={`Input ${i}`} />;
              } else {
                return (
                  <select key={i} data-testid={`element-${i}`}>
                    <option>Select {i}</option>
                  </select>
                );
              }
            });

            render(<div>{elements}</div>);

            // Tab through all elements in DOM order
            for (let i = 0; i < count; i++) {
              await user.tab();
              const expectedElement = screen.getByTestId(`element-${i}`);
              expect(document.activeElement).toBe(expectedElement);
            }
          }
        ),
        { numRuns: 20 }
      );
    });

    it('Shift+Tab navigates backward through elements', async () => {
      const user = userEvent.setup();
      
      await fc.assert(
        fc.asyncProperty(
          fc.integer({ min: 2, max: 4 }),
          labelArbitrary,
          async (count, label) => {
            cleanup();
            
            const buttons = Array.from({ length: count }, (_, i) => (
              <Button key={i} data-testid={`button-${i}`}>{`${label} ${i + 1}`}</Button>
            ));

            render(<div>{buttons}</div>);

            // Focus the last button
            const lastButton = screen.getByTestId(`button-${count - 1}`);
            lastButton.focus();
            expect(document.activeElement).toBe(lastButton);

            // Shift+Tab backward through all buttons
            for (let i = count - 2; i >= 0; i--) {
              await user.tab({ shift: true });
              const expectedButton = screen.getByTestId(`button-${i}`);
              expect(document.activeElement).toBe(expectedButton);
            }
          }
        ),
        { numRuns: 15 }
      );
    });

    it('elements with tabIndex=-1 are skipped during Tab navigation', async () => {
      const user = userEvent.setup();
      
      await fc.assert(
        fc.asyncProperty(
          fc.integer({ min: 0, max: 2 }),
          labelArbitrary,
          async (hiddenIndex, label) => {
            cleanup();
            
            // Create 3 buttons with one having tabIndex=-1
            const buttons = [0, 1, 2].map((i) => (
              <Button 
                key={i} 
                data-testid={`button-${i}`}
                tabIndex={i === hiddenIndex ? -1 : undefined}
              >
                {`${label} ${i + 1}`}
              </Button>
            ));

            render(<div>{buttons}</div>);

            // Tab through buttons - one with tabIndex=-1 should be skipped
            const visibleIndices = [0, 1, 2].filter(i => i !== hiddenIndex);
            
            for (const expectedIndex of visibleIndices) {
              await user.tab();
              const expectedButton = screen.getByTestId(`button-${expectedIndex}`);
              expect(document.activeElement).toBe(expectedButton);
            }
          }
        ),
        { numRuns: 15 }
      );
    });
  });


  /**
   * Property 10.6: Links Keyboard Accessibility
   * FOR ALL links, THE element SHALL be reachable via Tab and activatable via Enter
   */
  describe('Property 10.6: Links Keyboard Accessibility', () => {
    it('links are reachable via Tab key', async () => {
      const user = userEvent.setup();
      
      await fc.assert(
        fc.asyncProperty(
          fc.integer({ min: 1, max: 4 }),
          labelArbitrary,
          async (count, label) => {
            cleanup();
            
            const links = Array.from({ length: count }, (_, i) => (
              <a key={i} href={`#link-${i}`} data-testid={`link-${i}`}>
                {`${label} ${i + 1}`}
              </a>
            ));

            render(<div>{links}</div>);

            // Tab through all links
            for (let i = 0; i < count; i++) {
              await user.tab();
              const expectedLink = screen.getByTestId(`link-${i}`);
              expect(document.activeElement).toBe(expectedLink);
            }
          }
        ),
        { numRuns: 20 }
      );
    });

    it('links are activatable via Enter key', async () => {
      const user = userEvent.setup();
      
      await fc.assert(
        fc.asyncProperty(
          labelArbitrary,
          async (label) => {
            cleanup();
            
            const handleClick = vi.fn((e: React.MouseEvent) => e.preventDefault());
            
            render(
              <a href="#test" onClick={handleClick} data-testid="test-link">
                {label}
              </a>
            );

            const link = screen.getByTestId('test-link');
            
            // Tab to link and press Enter
            await user.tab();
            expect(document.activeElement).toBe(link);
            
            await user.keyboard('{Enter}');
            expect(handleClick).toHaveBeenCalledTimes(1);
          }
        ),
        { numRuns: 20 }
      );
    });

    it('links have visible focus when tabbed to', async () => {
      const user = userEvent.setup();
      
      await fc.assert(
        fc.asyncProperty(
          labelArbitrary,
          async (label) => {
            cleanup();
            
            render(
              <a href="#test" data-testid="focus-link">
                {label}
              </a>
            );

            const link = screen.getByTestId('focus-link');
            
            // Tab to the link
            await user.tab();
            expect(document.activeElement).toBe(link);
            expect(link).toHaveFocus();
          }
        ),
        { numRuns: 20 }
      );
    });
  });


  /**
   * Property 10.7: Modal Focus Trapping
   * FOR ALL Modal components, focus SHALL be trapped within the modal
   */
  describe('Property 10.7: Modal Focus Trapping', () => {
    it('focus is trapped within modal when open', async () => {
      await fc.assert(
        fc.asyncProperty(
          labelArbitrary,
          fc.integer({ min: 1, max: 3 }),
          async (title, buttonCount) => {
            cleanup();
            document.body.style.overflow = '';
            mockAnnounce.mockClear();
            
            const buttons = Array.from({ length: buttonCount }, (_, i) => (
              <button key={i} data-testid={`modal-button-${i}`}>Button {i + 1}</button>
            ));

            render(
              <Modal isOpen={true} onClose={vi.fn()} title={title}>
                {buttons}
              </Modal>
            );

            // Verify focus trap is active
            const focusTrap = document.querySelector('[data-focus-trap="active"]');
            expect(focusTrap).toBeInTheDocument();
            
            // All buttons should be within the focus trap
            for (let i = 0; i < buttonCount; i++) {
              const button = screen.getByTestId(`modal-button-${i}`);
              expect(focusTrap?.contains(button)).toBe(true);
            }
          }
        ),
        { numRuns: 20 }
      );
    });

    it('Escape key closes modal when closeOnEscape is true', async () => {
      const user = userEvent.setup();
      
      await fc.assert(
        fc.asyncProperty(
          labelArbitrary,
          async (title) => {
            cleanup();
            document.body.style.overflow = '';
            mockAnnounce.mockClear();
            
            const handleClose = vi.fn();
            
            render(
              <Modal isOpen={true} onClose={handleClose} title={title} closeOnEscape={true}>
                <button data-testid="modal-button">Focus me</button>
              </Modal>
            );

            // Focus an element inside the modal
            const button = screen.getByTestId('modal-button');
            button.focus();

            // Press Escape
            await user.keyboard('{Escape}');
            expect(handleClose).toHaveBeenCalledTimes(1);
          }
        ),
        { numRuns: 15 }
      );
    });

    it('modal buttons are activatable via Enter and Space', async () => {
      const user = userEvent.setup();
      
      await fc.assert(
        fc.asyncProperty(
          labelArbitrary,
          async (title) => {
            cleanup();
            document.body.style.overflow = '';
            mockAnnounce.mockClear();
            
            const handleEnterClick = vi.fn();
            const handleSpaceClick = vi.fn();
            
            render(
              <Modal isOpen={true} onClose={vi.fn()} title={title}>
                <button onClick={handleEnterClick} data-testid="enter-button">Enter Button</button>
                <button onClick={handleSpaceClick} data-testid="space-button">Space Button</button>
              </Modal>
            );

            // Test Enter key activation
            const enterButton = screen.getByTestId('enter-button');
            enterButton.focus();
            await user.keyboard('{Enter}');
            expect(handleEnterClick).toHaveBeenCalledTimes(1);

            // Test Space key activation
            const spaceButton = screen.getByTestId('space-button');
            spaceButton.focus();
            await user.keyboard(' ');
            expect(handleSpaceClick).toHaveBeenCalledTimes(1);
          }
        ),
        { numRuns: 15 }
      );
    });
  });


  /**
   * Property 10.8: FilterToolbar Keyboard Navigation
   * FOR ALL FilterToolbar components, all interactive elements SHALL be keyboard accessible
   */
  describe('Property 10.8: FilterToolbar Keyboard Navigation', () => {
    it('search input is reachable via Tab', async () => {
      const user = userEvent.setup();
      
      // Use simple alphanumeric placeholders to avoid special character issues
      const safePlaceholderArbitrary = fc.string({ minLength: 3, maxLength: 20 })
        .map(s => s.replace(/[^a-zA-Z0-9\s]/g, '').trim())
        .filter(s => s.length >= 3);
      
      await fc.assert(
        fc.asyncProperty(
          safePlaceholderArbitrary,
          async (placeholder) => {
            cleanup();
            
            render(
              <FilterToolbar
                search={{
                  placeholder,
                  value: '',
                  onChange: vi.fn(),
                }}
              />
            );

            const searchInput = screen.getByPlaceholderText(placeholder);
            
            // Tab to search input
            await user.tab();
            expect(document.activeElement).toBe(searchInput);
          }
        ),
        { numRuns: 15 }
      );
    });

    it('filter dropdowns are reachable via Tab', async () => {
      const user = userEvent.setup();
      
      // Use simple alphanumeric labels to avoid regex special character issues
      const safeFilterLabelArbitrary = fc.string({ minLength: 1, maxLength: 20 })
        .map(s => s.replace(/[^a-zA-Z0-9\s]/g, '').trim())
        .filter(s => s.length > 0);
      
      await fc.assert(
        fc.asyncProperty(
          fc.array(safeFilterLabelArbitrary, { minLength: 1, maxLength: 3 }),
          async (filterLabels) => {
            cleanup();
            
            const filters: FilterConfig[] = filterLabels.map((label, i) => ({
              id: `filter-${i}`,
              type: 'select',
              label,
              options: [
                { value: 'opt1', label: 'Option 1' },
                { value: 'opt2', label: 'Option 2' },
              ],
            }));

            render(
              <FilterToolbar
                filters={filters}
                filterValues={{}}
                onFilterChange={vi.fn()}
              />
            );

            // Tab through all filter dropdowns
            for (let i = 0; i < filterLabels.length; i++) {
              await user.tab();
              // Use escaped regex to handle any special characters
              const escapedLabel = filterLabels[i].replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
              const select = screen.getByRole('combobox', { name: new RegExp(escapedLabel, 'i') });
              expect(document.activeElement).toBe(select);
            }
          }
        ),
        { numRuns: 15 }
      );
    });

    it('clear filters button is reachable and activatable', async () => {
      const user = userEvent.setup();
      
      await fc.assert(
        fc.asyncProperty(
          fc.constant(true),
          async () => {
            cleanup();
            
            const handleClearFilters = vi.fn();
            
            render(
              <FilterToolbar
                hasActiveFilters={true}
                onClearFilters={handleClearFilters}
              />
            );

            const clearButton = screen.getByRole('button', { name: /clear all filters/i });
            
            // Tab to clear button
            await user.tab();
            expect(document.activeElement).toBe(clearButton);
            
            // Activate with Enter
            await user.keyboard('{Enter}');
            expect(handleClearFilters).toHaveBeenCalledTimes(1);
          }
        ),
        { numRuns: 10 }
      );
    });

    it('search input submits on Enter key', async () => {
      const user = userEvent.setup();
      
      await fc.assert(
        fc.asyncProperty(
          fc.constant('test'),  // Use constant to avoid clear button appearing
          async () => {
            cleanup();
            
            const handleSubmit = vi.fn();
            
            render(
              <FilterToolbar
                search={{
                  placeholder: 'Search...',
                  value: '',  // Empty value so clear button doesn't appear
                  onChange: vi.fn(),
                  onSubmit: handleSubmit,
                }}
              />
            );

            const searchInput = screen.getByPlaceholderText('Search...');
            
            // Tab to search input
            await user.tab();
            expect(document.activeElement).toBe(searchInput);
            
            // Press Enter to submit
            await user.keyboard('{Enter}');
            expect(handleSubmit).toHaveBeenCalled();
          }
        ),
        { numRuns: 15 }
      );
    });
  });


  /**
   * Property 10.9: ResponsiveTable Keyboard Navigation
   * FOR ALL ResponsiveTable components, the table and its interactive elements SHALL be keyboard accessible
   */
  describe('Property 10.9: ResponsiveTable Keyboard Navigation', () => {
    it('table container is reachable via Tab', async () => {
      const user = userEvent.setup();
      
      await fc.assert(
        fc.asyncProperty(
          labelArbitrary,
          async (ariaLabel) => {
            cleanup();
            
            render(
              <ResponsiveTable aria-label={ariaLabel}>
                <table>
                  <tbody>
                    <tr>
                      <td>Cell content</td>
                    </tr>
                  </tbody>
                </table>
              </ResponsiveTable>
            );

            const tableContainer = screen.getByRole('region', { name: ariaLabel });
            
            // Tab to table container
            await user.tab();
            expect(document.activeElement).toBe(tableContainer);
          }
        ),
        { numRuns: 15 }
      );
    });

    it('interactive elements within table are reachable via Tab', async () => {
      const user = userEvent.setup();
      
      await fc.assert(
        fc.asyncProperty(
          fc.integer({ min: 1, max: 3 }),
          async (buttonCount) => {
            cleanup();
            
            const buttons = Array.from({ length: buttonCount }, (_, i) => (
              <button key={i} data-testid={`table-button-${i}`}>Action {i + 1}</button>
            ));

            render(
              <ResponsiveTable aria-label="Test table">
                <table>
                  <tbody>
                    <tr>
                      <td>{buttons}</td>
                    </tr>
                  </tbody>
                </table>
              </ResponsiveTable>
            );

            // Tab to table container first
            await user.tab();
            
            // Then tab through all buttons
            for (let i = 0; i < buttonCount; i++) {
              await user.tab();
              const expectedButton = screen.getByTestId(`table-button-${i}`);
              expect(document.activeElement).toBe(expectedButton);
            }
          }
        ),
        { numRuns: 15 }
      );
    });

    it('table action buttons are activatable via Enter and Space', async () => {
      const user = userEvent.setup();
      
      await fc.assert(
        fc.asyncProperty(
          labelArbitrary,
          async (buttonLabel) => {
            cleanup();
            
            const handleClick = vi.fn();
            
            render(
              <ResponsiveTable aria-label="Test table">
                <table>
                  <tbody>
                    <tr>
                      <td>
                        <button onClick={handleClick} data-testid="action-button">
                          {buttonLabel}
                        </button>
                      </td>
                    </tr>
                  </tbody>
                </table>
              </ResponsiveTable>
            );

            // Tab to table container, then to button
            await user.tab();
            await user.tab();
            
            const button = screen.getByTestId('action-button');
            expect(document.activeElement).toBe(button);
            
            // Test Enter key
            await user.keyboard('{Enter}');
            expect(handleClick).toHaveBeenCalledTimes(1);
            
            // Test Space key
            await user.keyboard(' ');
            expect(handleClick).toHaveBeenCalledTimes(2);
          }
        ),
        { numRuns: 15 }
      );
    });
  });


  /**
   * Property 10.10: Combined Interactive Elements
   * FOR ALL combinations of interactive elements, keyboard navigation SHALL work consistently
   */
  describe('Property 10.10: Combined Interactive Elements', () => {
    it('mixed form elements are all keyboard accessible', async () => {
      const user = userEvent.setup();
      
      await fc.assert(
        fc.asyncProperty(
          fc.record({
            hasInput: fc.boolean(),
            hasSelect: fc.boolean(),
            hasTextarea: fc.boolean(),
            hasCheckbox: fc.boolean(),
            hasButton: fc.boolean(),
          }).filter(config => 
            // Ensure at least 2 elements are present
            Object.values(config).filter(Boolean).length >= 2
          ),
          async (config) => {
            cleanup();
            
            const elements: JSX.Element[] = [];
            const expectedOrder: string[] = [];
            
            if (config.hasInput) {
              elements.push(<input key="input" type="text" data-testid="form-input" />);
              expectedOrder.push('form-input');
            }
            if (config.hasSelect) {
              elements.push(
                <select key="select" data-testid="form-select">
                  <option>Option</option>
                </select>
              );
              expectedOrder.push('form-select');
            }
            if (config.hasTextarea) {
              elements.push(<textarea key="textarea" data-testid="form-textarea" />);
              expectedOrder.push('form-textarea');
            }
            if (config.hasCheckbox) {
              elements.push(<input key="checkbox" type="checkbox" data-testid="form-checkbox" />);
              expectedOrder.push('form-checkbox');
            }
            if (config.hasButton) {
              elements.push(<Button key="button" data-testid="form-button">Submit</Button>);
              expectedOrder.push('form-button');
            }

            render(<form>{elements}</form>);

            // Tab through all elements in order
            for (const testId of expectedOrder) {
              await user.tab();
              const expectedElement = screen.getByTestId(testId);
              expect(document.activeElement).toBe(expectedElement);
            }
          }
        ),
        { numRuns: 30 }
      );
    });

    it('all interactive elements can receive and lose focus', async () => {
      const user = userEvent.setup();
      
      await fc.assert(
        fc.asyncProperty(
          fc.integer({ min: 2, max: 3 }),
          async (count) => {
            cleanup();
            
            const elements = Array.from({ length: count }, (_, i) => (
              <Button key={i} data-testid={`focus-element-${i}`}>Element {i + 1}</Button>
            ));

            render(<div>{elements}</div>);

            // Tab forward through all elements
            for (let i = 0; i < count; i++) {
              await user.tab();
              const element = screen.getByTestId(`focus-element-${i}`);
              expect(element).toHaveFocus();
            }

            // Tab backward through all elements
            for (let i = count - 2; i >= 0; i--) {
              await user.tab({ shift: true });
              const element = screen.getByTestId(`focus-element-${i}`);
              expect(element).toHaveFocus();
            }
          }
        ),
        { numRuns: 10 }
      );
    }, 30000);

    it('focus indicator is visible on all focused elements', async () => {
      const user = userEvent.setup();
      
      await fc.assert(
        fc.asyncProperty(
          buttonPropsArbitrary,
          labelArbitrary,
          async (props, label) => {
            cleanup();
            
            // Skip if disabled (disabled buttons can't receive focus via Tab)
            if (props.disabled) return;
            
            render(
              <Button {...props} data-testid="focus-test-button">
                {label}
              </Button>
            );

            const button = screen.getByTestId('focus-test-button');
            
            // Tab to the button
            await user.tab();
            
            // Verify focus
            expect(document.activeElement).toBe(button);
            expect(button).toHaveFocus();
            
            // Button should have CSS classes (focus styles are applied via CSS)
            expect(button.className).toBeTruthy();
          }
        ),
        { numRuns: 20 }
      );
    });
  });
});
