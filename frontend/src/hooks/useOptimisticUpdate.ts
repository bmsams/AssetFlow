import { useState, useCallback, useRef } from 'react';

export interface OptimisticUpdateOptions<T> {
  /** Function to perform the actual update */
  updateFn: () => Promise<T>;
  /** Function to apply optimistic update to current state */
  optimisticUpdate: (currentState: T) => T;
  /** Callback on successful update */
  onSuccess?: (result: T) => void;
  /** Callback on failed update */
  onError?: (error: Error, rollbackState: T) => void;
  /** Delay before showing loading state (ms) */
  loadingDelay?: number;
}

export interface OptimisticUpdateState<T> {
  /** Current data state */
  data: T;
  /** Whether an update is in progress */
  isUpdating: boolean;
  /** Whether the update is optimistically applied */
  isOptimistic: boolean;
  /** Error from the last update attempt */
  error: Error | null;
}

export interface OptimisticUpdateResult<T> extends OptimisticUpdateState<T> {
  /** Execute the optimistic update */
  execute: () => Promise<void>;
  /** Reset error state */
  clearError: () => void;
  /** Manually set data */
  setData: (data: T | ((prev: T) => T)) => void;
}

/**
 * Hook for implementing optimistic updates
 * Implements Requirement 11.7: Optimistic updates for improved UX
 * 
 * @param initialData - Initial data state
 * @param options - Update options
 * @returns Optimistic update state and controls
 * 
 * @example
 * ```tsx
 * const { data, isUpdating, execute } = useOptimisticUpdate(asset, {
 *   updateFn: () => api.updateAsset(asset.id, updates),
 *   optimisticUpdate: (current) => ({ ...current, ...updates }),
 *   onError: (error) => toast.error('Failed to update asset'),
 * });
 * ```
 */
export function useOptimisticUpdate<T>(
  initialData: T,
  options?: Partial<OptimisticUpdateOptions<T>>
): OptimisticUpdateResult<T> {
  const [data, setDataState] = useState<T>(initialData);
  const [isUpdating, setIsUpdating] = useState(false);
  const [isOptimistic, setIsOptimistic] = useState(false);
  const [error, setError] = useState<Error | null>(null);
  
  // Store the previous state for rollback
  const previousStateRef = useRef<T>(initialData);
  const updateIdRef = useRef(0);

  const setData = useCallback((newData: T | ((prev: T) => T)) => {
    setDataState(newData);
    setIsOptimistic(false);
    setError(null);
  }, []);

  const clearError = useCallback(() => {
    setError(null);
  }, []);

  const execute = useCallback(async () => {
    if (!options?.updateFn || !options?.optimisticUpdate) {
      console.warn('useOptimisticUpdate: updateFn and optimisticUpdate are required');
      return;
    }

    const currentUpdateId = ++updateIdRef.current;
    const rollbackState = data;
    previousStateRef.current = rollbackState;

    // Apply optimistic update immediately
    const optimisticData = options.optimisticUpdate(data);
    setDataState(optimisticData);
    setIsOptimistic(true);
    setError(null);

    // Optionally delay showing loading state
    let loadingTimeout: ReturnType<typeof setTimeout> | null = null;
    if (options.loadingDelay && options.loadingDelay > 0) {
      loadingTimeout = setTimeout(() => {
        if (updateIdRef.current === currentUpdateId) {
          setIsUpdating(true);
        }
      }, options.loadingDelay);
    } else {
      setIsUpdating(true);
    }

    try {
      const result = await options.updateFn();
      
      // Only update if this is still the latest update
      if (updateIdRef.current === currentUpdateId) {
        setDataState(result);
        setIsOptimistic(false);
        options.onSuccess?.(result);
      }
    } catch (err) {
      // Only rollback if this is still the latest update
      if (updateIdRef.current === currentUpdateId) {
        const error = err instanceof Error ? err : new Error(String(err));
        setDataState(rollbackState);
        setIsOptimistic(false);
        setError(error);
        options.onError?.(error, rollbackState);
      }
    } finally {
      if (loadingTimeout) {
        clearTimeout(loadingTimeout);
      }
      if (updateIdRef.current === currentUpdateId) {
        setIsUpdating(false);
      }
    }
  }, [data, options]);

  return {
    data,
    isUpdating,
    isOptimistic,
    error,
    execute,
    clearError,
    setData,
  };
}

/**
 * Hook for managing a list with optimistic updates
 * Supports add, update, and remove operations
 */
export interface OptimisticListOptions<T, ID = string> {
  /** Function to get item ID */
  getId: (item: T) => ID;
  /** API function to add item */
  addFn?: (item: T) => Promise<T>;
  /** API function to update item */
  updateFn?: (id: ID, updates: Partial<T>) => Promise<T>;
  /** API function to remove item */
  removeFn?: (id: ID) => Promise<void>;
  /** Callback on error */
  onError?: (error: Error, operation: 'add' | 'update' | 'remove') => void;
}

export interface OptimisticListResult<T, ID = string> {
  /** Current list data */
  items: T[];
  /** IDs of items being updated */
  updatingIds: Set<ID>;
  /** Error from the last operation */
  error: Error | null;
  /** Add an item optimistically */
  addItem: (item: T) => Promise<void>;
  /** Update an item optimistically */
  updateItem: (id: ID, updates: Partial<T>) => Promise<void>;
  /** Remove an item optimistically */
  removeItem: (id: ID) => Promise<void>;
  /** Set items directly */
  setItems: (items: T[] | ((prev: T[]) => T[])) => void;
  /** Clear error */
  clearError: () => void;
}

/**
 * Hook for managing a list with optimistic updates
 * Implements Requirement 11.7: Optimistic updates for improved UX
 */
export function useOptimisticList<T, ID = string>(
  initialItems: T[],
  options: OptimisticListOptions<T, ID>
): OptimisticListResult<T, ID> {
  const [items, setItems] = useState<T[]>(initialItems);
  const [updatingIds, setUpdatingIds] = useState<Set<ID>>(new Set());
  const [error, setError] = useState<Error | null>(null);

  const clearError = useCallback(() => {
    setError(null);
  }, []);

  const addItem = useCallback(async (item: T) => {
    if (!options.addFn) {
      console.warn('useOptimisticList: addFn is required for addItem');
      return;
    }

    const id = options.getId(item);
    const previousItems = items;

    // Optimistically add item
    setItems((prev) => [...prev, item]);
    setUpdatingIds((prev) => new Set(prev).add(id));
    setError(null);

    try {
      const result = await options.addFn(item);
      // Replace optimistic item with server response
      setItems((prev) =>
        prev.map((i) => (options.getId(i) === id ? result : i))
      );
    } catch (err) {
      const error = err instanceof Error ? err : new Error(String(err));
      setItems(previousItems);
      setError(error);
      options.onError?.(error, 'add');
    } finally {
      setUpdatingIds((prev) => {
        const next = new Set(prev);
        next.delete(id);
        return next;
      });
    }
  }, [items, options]);

  const updateItem = useCallback(async (id: ID, updates: Partial<T>) => {
    if (!options.updateFn) {
      console.warn('useOptimisticList: updateFn is required for updateItem');
      return;
    }

    const previousItems = items;
    const itemIndex = items.findIndex((i) => options.getId(i) === id);
    
    if (itemIndex === -1) {
      console.warn('useOptimisticList: Item not found for update');
      return;
    }

    // Optimistically update item
    setItems((prev) =>
      prev.map((i) =>
        options.getId(i) === id ? { ...i, ...updates } : i
      )
    );
    setUpdatingIds((prev) => new Set(prev).add(id));
    setError(null);

    try {
      const result = await options.updateFn(id, updates);
      setItems((prev) =>
        prev.map((i) => (options.getId(i) === id ? result : i))
      );
    } catch (err) {
      const error = err instanceof Error ? err : new Error(String(err));
      setItems(previousItems);
      setError(error);
      options.onError?.(error, 'update');
    } finally {
      setUpdatingIds((prev) => {
        const next = new Set(prev);
        next.delete(id);
        return next;
      });
    }
  }, [items, options]);

  const removeItem = useCallback(async (id: ID) => {
    if (!options.removeFn) {
      console.warn('useOptimisticList: removeFn is required for removeItem');
      return;
    }

    const previousItems = items;

    // Optimistically remove item
    setItems((prev) => prev.filter((i) => options.getId(i) !== id));
    setUpdatingIds((prev) => new Set(prev).add(id));
    setError(null);

    try {
      await options.removeFn(id);
    } catch (err) {
      const error = err instanceof Error ? err : new Error(String(err));
      setItems(previousItems);
      setError(error);
      options.onError?.(error, 'remove');
    } finally {
      setUpdatingIds((prev) => {
        const next = new Set(prev);
        next.delete(id);
        return next;
      });
    }
  }, [items, options]);

  return {
    items,
    updatingIds,
    error,
    addItem,
    updateItem,
    removeItem,
    setItems,
    clearError,
  };
}
