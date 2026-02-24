/**
 * useDebouncedSearch Hook
 * Hook for managing debounced search input
 */

import { useCallback, useEffect, useMemo, useRef } from 'react';
import { debounce } from 'lodash';

interface UseDebouncedSearchParams {
  onSearch: (value: string) => void;
  debounceMs?: number;
}

interface UseDebouncedSearchReturn {
  handleSearchChange: (value: string) => void;
}

/**
 * Creates a debounced search handler
 */
export function useDebouncedSearch({
  onSearch,
  debounceMs = 300,
}: UseDebouncedSearchParams): UseDebouncedSearchReturn {
  const debouncedSearchRef = useRef<ReturnType<typeof debounce> | null>(
    null
  );

  // Create debounced search function
  const debouncedSearch = useMemo(() => {
    const debouncedFn = debounce((value: string) => {
      onSearch(value);
    }, debounceMs);

    debouncedSearchRef.current = debouncedFn;
    return debouncedFn;
  }, [onSearch, debounceMs]);

  // Handle search input changes
  const handleSearchChange = useCallback(
    (value: string) => {
      const trimmedValue = value?.trim() || '';

      if (debouncedSearchRef.current) {
        debouncedSearchRef.current.cancel();
      }

      if (!trimmedValue) {
        onSearch('');
      } else {
        debouncedSearch(trimmedValue);
      }
    },
    [debouncedSearch, onSearch]
  );

  // Cleanup debounce on unmount
  useEffect(() => {
    return () => {
      if (debouncedSearchRef.current) {
        debouncedSearchRef.current.cancel();
      }
    };
  }, []);

  return {
    handleSearchChange,
  };
}

