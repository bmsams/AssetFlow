import {
  useRef,
  useEffect,
  useCallback,
  type ReactNode,
  type KeyboardEvent,
} from 'react';

export interface FocusTrapProps {
  /** Content to trap focus within */
  children: ReactNode;
  /** Whether the focus trap is active */
  isActive?: boolean;
  /** Whether to auto-focus the first focusable element when activated */
  autoFocus?: boolean;
  /** Whether to restore focus to the previously focused element when deactivated */
  restoreFocus?: boolean;
  /** Callback when escape key is pressed */
  onEscape?: () => void;
  /** Initial element to focus (selector or ref) */
  initialFocus?: string | React.RefObject<HTMLElement>;
  /** Element to return focus to when deactivated */
  returnFocusTo?: React.RefObject<HTMLElement>;
}

/**
 * Get all focusable elements within a container
 */
function getFocusableElements(container: HTMLElement): HTMLElement[] {
  const focusableSelectors = [
    'a[href]',
    'button:not([disabled])',
    'input:not([disabled])',
    'select:not([disabled])',
    'textarea:not([disabled])',
    '[tabindex]:not([tabindex="-1"])',
    '[contenteditable="true"]',
  ].join(', ');

  const elements = Array.from(
    container.querySelectorAll<HTMLElement>(focusableSelectors)
  );

  // Filter out elements that are not visible
  return elements.filter((el) => {
    const style = window.getComputedStyle(el);
    return (
      style.display !== 'none' &&
      style.visibility !== 'hidden' &&
      el.offsetParent !== null
    );
  });
}

/**
 * FocusTrap component for trapping focus within a container
 * Essential for modal dialogs, dropdown menus, and other overlay components
 * Implements WCAG 2.1 AA requirement for keyboard accessibility
 * 
 * @example
 * ```tsx
 * <FocusTrap isActive={isModalOpen} onEscape={closeModal}>
 *   <div role="dialog" aria-modal="true">
 *     <h2>Modal Title</h2>
 *     <button>Action</button>
 *   </div>
 * </FocusTrap>
 * ```
 */
export function FocusTrap({
  children,
  isActive = true,
  autoFocus = true,
  restoreFocus = true,
  onEscape,
  initialFocus,
  returnFocusTo,
}: FocusTrapProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const previousActiveElement = useRef<HTMLElement | null>(null);

  // Store the previously focused element when trap activates
  useEffect(() => {
    if (isActive && restoreFocus) {
      previousActiveElement.current = document.activeElement as HTMLElement;
    }
  }, [isActive, restoreFocus]);

  // Auto-focus first focusable element or specified initial focus
  useEffect(() => {
    if (!isActive || !autoFocus || !containerRef.current) return;

    const container = containerRef.current;

    // Small delay to ensure DOM is ready
    const timeoutId = setTimeout(() => {
      let elementToFocus: HTMLElement | null = null;

      if (initialFocus) {
        if (typeof initialFocus === 'string') {
          elementToFocus = container.querySelector<HTMLElement>(initialFocus);
        } else if (initialFocus.current) {
          elementToFocus = initialFocus.current;
        }
      }

      if (!elementToFocus) {
        const focusableElements = getFocusableElements(container);
        elementToFocus = focusableElements[0] || null;
      }

      elementToFocus?.focus();
    }, 0);

    return () => clearTimeout(timeoutId);
  }, [isActive, autoFocus, initialFocus]);

  // Restore focus when trap deactivates
  useEffect(() => {
    const returnFocusElement = returnFocusTo?.current;
    const previousElement = previousActiveElement.current;

    return () => {
      if (restoreFocus) {
        const elementToRestore = returnFocusElement || previousElement;
        elementToRestore?.focus();
      }
    };
  }, [restoreFocus, returnFocusTo]);

  // Handle keyboard navigation within the trap
  const handleKeyDown = useCallback(
    (event: KeyboardEvent<HTMLDivElement>) => {
      if (!isActive || !containerRef.current) return;

      // Handle Escape key
      if (event.key === 'Escape' && onEscape) {
        event.preventDefault();
        event.stopPropagation();
        onEscape();
        return;
      }

      // Handle Tab key for focus trapping
      if (event.key === 'Tab') {
        const focusableElements = getFocusableElements(containerRef.current);
        
        if (focusableElements.length === 0) {
          event.preventDefault();
          return;
        }

        const firstElement = focusableElements[0];
        const lastElement = focusableElements[focusableElements.length - 1];
        const activeElement = document.activeElement;

        if (event.shiftKey) {
          // Shift + Tab: Move focus backwards
          if (activeElement === firstElement) {
            event.preventDefault();
            lastElement.focus();
          }
        } else {
          // Tab: Move focus forwards
          if (activeElement === lastElement) {
            event.preventDefault();
            firstElement.focus();
          }
        }
      }
    },
    [isActive, onEscape]
  );

  return (
    <div
      ref={containerRef}
      onKeyDown={handleKeyDown}
      data-focus-trap={isActive ? 'active' : 'inactive'}
    >
      {children}
    </div>
  );
}
