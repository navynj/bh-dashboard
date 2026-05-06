'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import type { CostListItem, CostsApiResponse } from '../types/cost';

interface UseCostsState {
  costs: CostListItem[];
  isLoading: boolean;
  error: string | null;
}

export function useCosts() {
  const [state, setState] = useState<UseCostsState>({
    costs: [],
    isLoading: true,
    error: null,
  });
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const currentSearchRef = useRef<string>('');

  const fetchCosts = useCallback(async (search?: string) => {
    setState((prev) => ({ ...prev, isLoading: true, error: null }));
    try {
      const params = new URLSearchParams();
      if (search) params.set('search', search);
      const res = await fetch(`/api/cost?${params}`);
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        const message = body?.error ?? `HTTP ${res.status}`;
        throw new Error(message);
      }
      const data: CostsApiResponse = await res.json();
      setState({ costs: data.costs, isLoading: false, error: null });
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Unknown error';
      console.error('[useCosts] fetch failed:', message);
      setState((prev) => ({ ...prev, isLoading: false, error: message }));
    }
  }, []);

  const handleSearchChange = useCallback(
    (value: string) => {
      const trimmed = value.trim();
      if (trimmed === currentSearchRef.current) return;
      currentSearchRef.current = trimmed;

      if (debounceRef.current) clearTimeout(debounceRef.current);
      debounceRef.current = setTimeout(() => {
        fetchCosts(trimmed || undefined);
      }, 300);
    },
    [fetchCosts],
  );

  useEffect(() => {
    fetchCosts();
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, [fetchCosts]);

  return {
    costs: state.costs,
    isLoading: state.isLoading,
    error: state.error,
    handleSearchChange,
    refetch: fetchCosts,
  };
}
