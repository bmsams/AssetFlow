import { useState, useMemo, useCallback } from 'react';

export interface UseVirtualScrollOptions {
  totalItems: number;
  itemHeight: number;
  containerHeight: number;
  overscan?: number;
}

export interface UseVirtualScrollResult {
  startIndex: number;
  endIndex: number;
  totalHeight: number;
  offsetY: number;
  onScroll: (scrollTop: number) => void;
}

/**
 * Hook that calculates the visible row window for virtual scrolling.
 *
 * Only the rows within the viewport (plus an overscan buffer above and below)
 * are rendered. The caller is responsible for wiring `onScroll` to the scroll
 * container and applying `totalHeight` / `offsetY` for correct scrollbar sizing
 * and row positioning.
 */
export function useVirtualScroll({
  totalItems,
  itemHeight,
  containerHeight,
  overscan = 5,
}: UseVirtualScrollOptions): UseVirtualScrollResult {
  const [scrollTop, setScrollTop] = useState(0);

  const onScroll = useCallback((nextScrollTop: number) => {
    setScrollTop(nextScrollTop);
  }, []);

  const result = useMemo(() => {
    if (itemHeight <= 0 || containerHeight <= 0) {
      return {
        startIndex: 0,
        endIndex: Math.max(0, totalItems - 1),
        totalHeight: 0,
        offsetY: 0,
      };
    }

    const visibleCount = Math.ceil(containerHeight / itemHeight);

    let startIndex = Math.floor(scrollTop / itemHeight) - overscan;
    startIndex = Math.max(0, startIndex);

    let endIndex = startIndex + visibleCount + 2 * overscan;
    endIndex = Math.min(endIndex, totalItems - 1);

    const totalHeight = totalItems * itemHeight;
    const offsetY = startIndex * itemHeight;

    return { startIndex, endIndex, totalHeight, offsetY };
  }, [scrollTop, totalItems, itemHeight, containerHeight, overscan]);

  return {
    ...result,
    onScroll,
  };
}
