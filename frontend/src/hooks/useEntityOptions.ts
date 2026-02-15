import { useState, useEffect, useCallback } from 'react';
import type { SelectOption } from '../components/asset-form/FormField';

/**
 * Generic hook for populating entity selector dropdowns from API data.
 *
 * Accepts any async fetch function that returns an object with an `items` array,
 * plus mapper functions to derive label/value from each item.
 *
 * @example
 * ```tsx
 * const { options, isLoading } = useEntityOptions(
 *   () => adminApi.departments.list(),
 *   (d) => d.name,
 *   (d) => d.departmentId
 * );
 * ```
 *
 * Validates: Requirements 7.1, 7.2, 7.3, 7.4, 7.5
 */
export function useEntityOptions<T>(
  fetchFn: () => Promise<{ items: T[] }>,
  labelFn: (item: T) => string,
  valueFn: (item: T) => string
): {
  options: SelectOption[];
  isLoading: boolean;
  error: Error | null;
  refetch: () => void;
} {
  const [options, setOptions] = useState<SelectOption[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  const load = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const response = await fetchFn();
      setOptions(
        response.items.map((item) => ({
          label: labelFn(item),
          value: valueFn(item),
        }))
      );
    } catch (err) {
      setError(err instanceof Error ? err : new Error(String(err)));
    } finally {
      setIsLoading(false);
    }
  }, [fetchFn, labelFn, valueFn]);

  useEffect(() => {
    load();
  }, [load]);

  return { options, isLoading, error, refetch: load };
}
