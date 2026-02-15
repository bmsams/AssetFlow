import { useRef, useCallback, useEffect } from 'react';

export interface UseFocusManagementOptions {
  /** Whether to auto-focus on mount */
  autoFocus?: boolean;
  /** Whether to restore focus on unmount */
  restoreFocus?: boolean;
  /** Selector for the element to focus */
  focusSelector?: string;
}

export interface UseFocusManagementReturn {
  /** Ref to attach to the container element */
  containerRef: React.RefObject<HTMLDivElement>;
  /** Focus the first focusable element in the container */
  focusFirst: () => void;
  /** Focus the last focusable element in the container */
  focusLast: () => void;
  /** Focus a specific element by selector */
  focusElement: (selector: string) => void;
  /** Check if focus is within the container */
  containsFocus: () => boolean;
  /** Get all focusable elements in the container */
  getFocusableElements: () => HTMLElement[];
}

/**
 * Get all focusable elements within a container
 */
function queryFocusableElements(container: HTMLElement): HTMLElement[] {
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
 * Hook for managing focus within a container
 * Provides utilities for programmatic focus management
 * Implements WCAG 2.1 AA requirement for focus management
 * 
 * @example
 * ```tsx
 * function Modal({ isOpen, onClose }) {
 *   const { containerRef, focusFirst } = useFocusManagement({
 *     autoFocus: isOpen,
 *     restoreFocus: true,
 *   });
 * 
 *   return (
 *     <div ref={containerRef} role="dialog">
 *       <button onClick={onClose}>Close</button>
 *     </div>
 *   );
 * }
 * ```
 */
export function useFocusManagement(
  options: UseFocusManagementOptions = {}
): UseFocusManagementReturn {
  const { autoFocus = false, restoreFocus = false, focusSelector } = options;
  
  const containerRef = useRef<HTMLDivElement>(null);
  const previousActiveElement = useRef<HTMLElement | null>(null);

  // Store the previously focused element
  useEffect(() => {
    if (restoreFocus) {
      previousActiveElement.current = document.activeElement as HTMLElement;
    }

    return () => {
      if (restoreFocus && previousActiveElement.current) {
        previousActiveElement.current.focus();
      }
    };
  }, [restoreFocus]);

  // Auto-focus on mount
  useEffect(() => {
    if (!autoFocus || !containerRef.current) return;

    const timeoutId = setTimeout(() => {
      if (focusSelector && containerRef.current) {
        const element = containerRef.current.querySelector<HTMLElement>(focusSelector);
        if (element) {
          element.focus();
          return;
        }
      }

      // Fall back to first focusable element
      if (containerRef.current) {
        const focusableElements = queryFocusableElements(containerRef.current);
        if (focusableElements.length > 0) {
          focusableElements[0].focus();
        }
      }
    }, 0);

    return () => clearTimeout(timeoutId);
  }, [autoFocus, focusSelector]);

  const getFocusableElements = useCallback((): HTMLElement[] => {
    if (!containerRef.current) return [];
    return queryFocusableElements(containerRef.current);
  }, []);

  const focusFirst = useCallback(() => {
    const elements = getFocusableElements();
    if (elements.length > 0) {
      elements[0].focus();
    }
  }, [getFocusableElements]);

  const focusLast = useCallback(() => {
    const elements = getFocusableElements();
    if (elements.length > 0) {
      elements[elements.length - 1].focus();
    }
  }, [getFocusableElements]);

  const focusElement = useCallback((selector: string) => {
    if (!containerRef.current) return;
    const element = containerRef.current.querySelector<HTMLElement>(selector);
    if (element) {
      element.focus();
    }
  }, []);

  const containsFocus = useCallback((): boolean => {
    if (!containerRef.current) return false;
    return containerRef.current.contains(document.activeElement);
  }, []);

  return {
    containerRef,
    focusFirst,
    focusLast,
    focusElement,
    containsFocus,
    getFocusableElements,
  };
}
