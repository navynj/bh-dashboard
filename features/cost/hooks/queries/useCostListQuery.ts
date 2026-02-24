'use client';

import { useQuery } from '@tanstack/react-query';
import type { CostApiResponse } from '@/features/cost/types/cost';

export function useCostListQuery(params?: {
  page?: number;
  pageSize?: number;
  search?: string;
  tagIds?: string[];
  sortKey?: string;
  reverse?: boolean;
}) {
  const page = params?.page ?? 1;
  const pageSize = params?.pageSize ?? 10;
  const search = params?.search ?? '';
  const tagIds = params?.tagIds ?? [];
  const sortKey = params?.sortKey ?? 'CREATED_AT';
  const reverse = params?.reverse ?? false;

  const searchParams = new URLSearchParams();
  searchParams.set('page', String(page));
  searchParams.set('pageSize', String(pageSize));
  if (search) searchParams.set('search', search);
  if (tagIds.length) searchParams.set('tagIds', tagIds.join(','));
  searchParams.set('sortKey', sortKey);
  if (reverse) searchParams.set('reverse', 'true');

  return useQuery({
    queryKey: ['costList', page, pageSize, search, tagIds, sortKey, reverse],
    queryFn: async () => {
      const res = await fetch(`/api/cost?${searchParams.toString()}`);
      if (!res.ok) throw new Error('Failed to fetch costs');
      const data = await res.json();
      return data as {
        costs: CostApiResponse[];
        totalCount: number;
        totalPages: number;
        pageInfo: { hasNextPage: boolean; hasPreviousPage: boolean };
      };
    },
  });
}
