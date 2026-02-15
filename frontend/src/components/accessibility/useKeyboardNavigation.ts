import { useCallback, useState, useRef, useEffect, type KeyboardEvent } from 'react';

export interface UseKeyboardNavigationOptions {
  /** Total number of items */
  itemCount: number;
  /** Initial active index */
  initialIndex?: number;
  /** Whether navigation wraps around */
  wrap?: boolean;
  /** Orientation of the list */
  orientation?: 'horizontal' | 'vertical' | 'both';
  /** Callback when active index changes */
  onIndexChange?: (index: number) => void;
  /** Callback when item is selected (Enter/Space) */
  onSelect?: (index: number) => void;
  /** Whether to enable type-ahead search */
  typeAhead?: boolean;
  /** Function to get item label for type-ahead */
  getItemLabel?: (index: number) => string;
}

export interface UseKeyboardNavigationReturn {
  /** Currently active index */
  activeIndex: number;
  /** Set the active index */
  setActiveIndex: (index: number) => void;
  /** Keyboard event handler to attach to container */
  handleKeyDown: (event: KeyboardEvent) => void;
  /** Get props for an item at a given index */
  getItemProps: (index: number) => {
    tabIndex: number;
    'aria-selected': boolean;
    onFocus: () => void;
  };
}

/**
 * Hook for keyboard navigation in lists, menus, and other collections
 * Supports arrow key navigation, Home/End, and type-ahead search
 * Implements WCAG 2.1 AA requirement for keyboard accessibility
 * 
 * @example
 * ```tsx
 * function Menu({ items }) {
 *   const { activeIndex, handleKeyDown, getItemProps } = useKeyboardNavigation({
 *     itemCount: items.length,
 *     orientation: 'vertical',
 *     onSelect: (index) => items[index].onClick(),
 *   });
 * 
 *   return (
 *     <ul role="menu" onKeyDown={handleKeyDown}>
 *       {items.map((item, index) => (
 *         <li key={index} role="menuitem" {...getItemProps(index)}>
 *           {item.label}
 *         </li>
 *       ))}
 *     </ul>
 *   );
 * }
 * ```
 */
export function useKeyboardNavigation(
  options: UseKeyboardNavigationOptions
): UseKeyboardNavigationReturn {
  const {
    itemCount,
    initialIndex = 0,
    wrap = true,
    orientation = 'vertical',
    onIndexChange,
    onSelect,
    typeAhead = false,
    getItemLabel,
  } = options;

  const [activeIndex, setActiveIndexState] = useState(initialIndex);
  const typeAheadBuffer = useRef('');
  const typeAheadTimeout = useRef<ReturnType<typeof setTimeout>>();

  // Clear type-ahead buffer after delay
  const clearTypeAhead = useCallback(() => {
    if (typeAheadTimeout.current) {
      clearTimeout(typeAheadTimeout.current);
    }
    typeAheadTimeout.current = setTimeout(() => {
      typeAheadBuffer.current = '';
    }, 500);
  }, []);

  // Cleanup timeout on unmount
  useEffect(() => {
    return () => {
      if (typeAheadTimeout.current) {
        clearTimeout(typeAheadTimeout.current);
      }
    };
  }, []);

  const setActiveIndex = useCallback(
    (index: number) => {
      const clampedIndex = Math.max(0, Math.min(index, itemCount - 1));
      setActiveIndexState(clampedIndex);
      onIndexChange?.(clampedIndex);
    },
    [itemCount, onIndexChange]
  );

  const moveNext = useCallback(() => {
    setActiveIndexState((current) => {
      let next = current + 1;
      if (next >= itemCount) {
        next = wrap ? 0 : itemCount - 1;
      }
      onIndexChange?.(next);
      return next;
    });
  }, [itemCount, wrap, onIndexChange]);

  const movePrevious = useCallback(() => {
    setActiveIndexState((current) => {
      let prev = current - 1;
      if (prev < 0) {
        prev = wrap ? itemCount - 1 : 0;
      }
      onIndexChange?.(prev);
      return prev;
    });
  }, [itemCount, wrap, onIndexChange]);

  const moveFirst = useCallback(() => {
    setActiveIndex(0);
  }, [setActiveIndex]);

  const moveLast = useCallback(() => {
    setActiveIndex(itemCount - 1);
  }, [setActiveIndex, itemCount]);

  // Type-ahead search
  const handleTypeAhead = useCallback(
    (char: string) => {
      if (!typeAhead || !getItemLabel) return;

      typeAheadBuffer.current += char.toLowerCase();
      clearTypeAhead();

      // Find matching item
      for (let i = 0; i < itemCount; i++) {
        const label = getItemLabel(i).toLowerCase();
        if (label.startsWith(typeAheadBuffer.current)) {
          setActiveIndex(i);
          break;
        }
      }
    },
    [typeAhead, getItemLabel, itemCount, setActiveIndex, clearTypeAhead]
  );

  const handleKeyDown = useCallback(
    (event: KeyboardEvent) => {
      const { key } = event;

      // Determine which keys to handle based on orientation
      const isVertical = orientation === 'vertical' || orientation === 'both';
      const isHorizontal = orientation === 'horizontal' || orientation === 'both';

      switch (key) {
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

        case 'Home':
          event.preventDefault();
          moveFirst();
          break;

        case 'End':
          event.preventDefault();
          moveLast();
          break;

        case 'Enter':
        case ' ':
          event.preventDefault();
          onSelect?.(activeIndex);
          break;

        default:
          // Handle type-ahead for printable characters
          if (key.length === 1 && /[a-zA-Z0-9]/.test(key)) {
            handleTypeAhead(key);
          }
          break;
      }
    },
    [
      orientation,
      moveNext,
      movePrevious,
      moveFirst,
      moveLast,
      onSelect,
      activeIndex,
      handleTypeAhead,
    ]
  );

  const getItemProps = useCallback(
    (index: number) => ({
      tabIndex: index === activeIndex ? 0 : -1,
      'aria-selected': index === activeIndex,
      onFocus: () => setActiveIndex(index),
    }),
    [activeIndex, setActiveIndex]
  );

  return {
    activeIndex,
    setActiveIndex,
    handleKeyDown,
    getItemProps,
  };
}
