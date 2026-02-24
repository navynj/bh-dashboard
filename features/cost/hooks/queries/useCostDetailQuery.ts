'use client';

import { useQuery } from '@tanstack/react-query';
import type { CostApiResponse } from '@/features/cost/types/cost';

export function useCostDetailQuery(costId: string | undefined) {
  return useQuery({
    queryKey: ['costDetail', costId],
    queryFn: async () => {
      if (!costId) return null;
      const res = await fetch(`/api/cost/${costId}`);
      if (!res.ok) {
        if (res.status === 404) return null;
        throw new Error('Failed to fetch cost');
      }
      return res.json() as Promise<CostApiResponse>;
    },
    enabled: !!costId,
  });
}
