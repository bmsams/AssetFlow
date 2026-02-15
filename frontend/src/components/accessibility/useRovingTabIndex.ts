import { useRef, useCallback, useEffect, useState, type RefObject } from 'react';

export interface UseRovingTabIndexOptions {
  /** Refs to the focusable elements */
  refs: RefObject<HTMLElement>[];
  /** Initial focused index */
  initialIndex?: number;
  /** Whether navigation wraps around */
  wrap?: boolean;
  /** Orientation for arrow key navigation */
  orientation?: 'horizontal' | 'vertical' | 'both';
  /** Callback when focused index changes */
  onFocusChange?: (index: number) => void;
}

export interface UseRovingTabIndexReturn {
  /** Currently focused index */
  focusedIndex: number;
  /** Set the focused index and move focus */
  setFocusedIndex: (index: number) => void;
  /** Get tabIndex for an element at given index */
  getTabIndex: (index: number) => 0 | -1;
  /** Handle keyboard navigation */
  handleKeyDown: (event: React.KeyboardEvent) => void;
}

/**
 * Hook for implementing roving tabindex pattern
 * Only one element in a group is tabbable at a time
 * Arrow keys move focus between elements
 * Implements WCAG 2.1 AA requirement for keyboard accessibility
 * 
 * @example
 * ```tsx
 * function Toolbar() {
 *   const buttonRefs = [useRef(null), useRef(null), useRef(null)];
 *   const { focusedIndex, getTabIndex, handleKeyDown } = useRovingTabIndex({
 *     refs: buttonRefs,
 *     orientation: 'horizontal',
 *   });
 * 
 *   return (
 *     <div role="toolbar" onKeyDown={handleKeyDown}>
 *       {['Bold', 'Italic', 'Underline'].map((label, i) => (
 *         <button
 *           key={label}
 *           ref={buttonRefs[i]}
 *           tabIndex={getTabIndex(i)}
 *         >
 *           {label}
 *         </button>
 *       ))}
 *     </div>
 *   );
 * }
 * ```
 */
export function useRovingTabIndex(
  options: UseRovingTabIndexOptions
): UseRovingTabIndexReturn {
  const {
    refs,
    initialIndex = 0,
    wrap = true,
    orientation = 'horizontal',
    onFocusChange,
  } = options;

  const [focusedIndex, setFocusedIndexState] = useState(initialIndex);
  const isInitialMount = useRef(true);

  // Focus the element when focusedIndex changes (but not on initial mount)
  useEffect(() => {
    if (isInitialMount.current) {
      isInitialMount.current = false;
      return;
    }

    const element = refs[focusedIndex]?.current;
    if (element) {
      element.focus();
    }
  }, [focusedIndex, refs]);

  const setFocusedIndex = useCallback(
    (index: number) => {
      const validIndex = Math.max(0, Math.min(index, refs.length - 1));
      setFocusedIndexState(validIndex);
      onFocusChange?.(validIndex);
    },
    [refs.length, onFocusChange]
  );

  const moveNext = useCallback(() => {
    setFocusedIndexState((current) => {
      let next = current + 1;
      if (next >= refs.length) {
        next = wrap ? 0 : refs.length - 1;
      }
      onFocusChange?.(next);
      return next;
    });
  }, [refs.length, wrap, onFocusChange]);

  const movePrevious = useCallback(() => {
    setFocusedIndexState((current) => {
      let prev = current - 1;
      if (prev < 0) {
        prev = wrap ? refs.length - 1 : 0;
      }
      onFocusChange?.(prev);
      return prev;
    });
  }, [refs.length, wrap, onFocusChange]);

  const moveFirst = useCallback(() => {
    setFocusedIndex(0);
  }, [setFocusedIndex]);

  const moveLast = useCallback(() => {
    setFocusedIndex(refs.length - 1);
  }, [setFocusedIndex, refs.length]);

  const handleKeyDown = useCallback(
    (event: React.KeyboardEvent) => {
      const { key } = event;

      const isVertical = orientation === 'vertical' || orientation === 'both';
      const isHorizontal = orientation === 'horizontal' || orientation === 'both';

      switch (key) {
        case 'ArrowRight':
          if (isHorizontal) {
            event.preventDefault();
            moveNext();
          }
          break;

        case 'ArrowLeft':
          if (isHorizontal) {
            event.preventDefault();
            movePrevious();
          }
          break;

        case 'ArrowDown':
          if (isVertical) {
            event.preventDefault();
            moveNext();
          }
          break;

        case 'ArrowUp':
          if (isVertical) {
            event.preventDefault();
            movePrevious();
          }
          break;

        case 'Home':
          event.preventDefault();
          moveFirst();
          break;

        case 'End':
          event.preventDefault();
          moveLast();
          break;
      }
    },
    [orientation, moveNext, movePrevious, moveFirst, moveLast]
  );

  const getTabIndex = useCallback(
    (index: number): 0 | -1 => {
      return index === focusedIndex ? 0 : -1;
    },
    [focusedIndex]
  );

  return {
    focusedIndex,
    setFocusedIndex,
    getTabIndex,
    handleKeyDown,
  };
}
