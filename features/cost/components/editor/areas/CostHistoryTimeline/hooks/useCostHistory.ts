/**
 * useCostHistory Hook
 * Hook for fetching and managing cost history with pagination
 */

import { useState, useEffect, useRef } from 'react';
import { useQuery } from '@tanstack/react-query';
import type { CostHistoryEntry, CostHistoryData } from '../types';

interface UseCostHistoryParams {
  costId: string;
  organizationId: string;
  limit?: number;
}

interface UseCostHistoryReturn {
  history: CostHistoryEntry[];
  creationEntry: CostHistoryEntry | null;
  totalCount: number;
  hasMoreEntries: boolean;
  remainingCount: number;
  isLoading: boolean;
  isFetching: boolean;
  error: Error | null;
  loadMore: () => void;
}

/**
 * Fetches and manages cost history with pagination
 */
export function useCostHistory({
  costId,
  organizationId,
  limit = 5,
}: UseCostHistoryParams): UseCostHistoryReturn {
  const [offset, setOffset] = useState(0);
  const [accumulatedHistory, setAccumulatedHistory] = useState<
    CostHistoryEntry[]
  >([]);
  const [creationEntry, setCreationEntry] = useState<CostHistoryEntry | null>(
    null
  );
  const [totalCount, setTotalCount] = useState(0);
  const pendingLoadMoreOffsetRef = useRef<number | null>(null);
  const lastProcessedOffsetRef = useRef<number | null>(null);
  const pendingOffsetsRef = useRef<Set<number>>(new Set());

  // Fetch history using React Query
  const {
    data: historyData,
    isLoading,
    isFetching,
    error,
  } = useQuery<CostHistoryData>({
    queryKey: ['costHistory', organizationId, costId, offset],
    queryFn: async () => {
      if (!costId || !organizationId) {
        return {
          history: [],
          creationEntry: null,
          totalCount: 0,
          hasMore: false,
        };
      }
      const res = await fetch(
        `/api/organization/${organizationId}/cost/${costId}/history?limit=${limit}&offset=${offset}&includeCreation=${
          offset === 0
        }`
      );
      if (!res.ok) {
        throw new Error('Failed to fetch history');
      }
      return res.json();
    },
    enabled: !!costId && !!organizationId,
    placeholderData: (previousData) => previousData,
  });

  // Accumulate history entries when new data is fetched
  useEffect(() => {
    if (!historyData) return;

    // Only process when fetch is complete
    if (isFetching) {
      return;
    }

    // Skip if we've already processed this offset
    if (lastProcessedOffsetRef.current === offset) {
      return;
    }

    if (offset === 0) {
      // First load or refetch at offset 0: replace all data
      setAccumulatedHistory(historyData.history);
      setCreationEntry(historyData.creationEntry);
      setTotalCount(historyData.totalCount);
      pendingLoadMoreOffsetRef.current = null;
      pendingOffsetsRef.current.clear();
      lastProcessedOffsetRef.current = 0;
    } else if (pendingOffsetsRef.current.has(offset)) {
      // This is an intentional "load more" we initiated: append new entries with deduplication
      setAccumulatedHistory((prev) => {
        const existingIds = new Set(prev.map((entry) => entry.id));
        const newEntries = historyData.history.filter(
          (entry) => !existingIds.has(entry.id)
        );
        return [...prev, ...newEntries];
      });
      pendingOffsetsRef.current.delete(offset);
      lastProcessedOffsetRef.current = offset;
    } else {
      // Unexpected refetch at non-zero offset (e.g., after invalidation)
      // Reset to offset 0 to get fresh data from the beginning
      setOffset(0);
      pendingLoadMoreOffsetRef.current = null;
      pendingOffsetsRef.current.clear();
      lastProcessedOffsetRef.current = null;
    }
  }, [historyData, offset, isFetching]);

  // Reset accumulated history when costId changes
  useEffect(() => {
    setAccumulatedHistory([]);
    setCreationEntry(null);
    setTotalCount(0);
    setOffset(0);
    pendingLoadMoreOffsetRef.current = null;
    pendingOffsetsRef.current.clear();
    lastProcessedOffsetRef.current = null;
  }, [costId]);

  // Deduplicate history entries
  const history = accumulatedHistory.filter((entry, index, self) => {
    return self.findIndex((e) => e.id === entry.id) === index;
  });

  const hasMoreEntries = totalCount > history.length;
  const remainingCount = Math.max(0, totalCount - history.length);

  const loadMore = () => {
    const newOffset = offset + limit;
    pendingLoadMoreOffsetRef.current = newOffset;
    pendingOffsetsRef.current.add(newOffset);
    setOffset(newOffset);
  };

  return {
    history,
    creationEntry,
    totalCount,
    hasMoreEntries,
    remainingCount,
    isLoading,
    isFetching,
    error: error as Error | null,
    loadMore,
  };
}

