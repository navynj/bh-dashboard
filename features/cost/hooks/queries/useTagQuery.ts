'use client';

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import type { TagBase } from '@/features/cost/types/cost';

async function fetchTags(): Promise<TagBase[]> {
  const res = await fetch('/api/cost/tag');
  if (!res.ok) throw new Error('Failed to fetch tags');
  return res.json();
}

export function useTagQuery() {
  return useQuery({
    queryKey: ['costTags'],
    queryFn: fetchTags,
  });
}

export function useCreateTagMutation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (params: { name: string; color: string }) => {
      const res = await fetch('/api/cost/tag', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(params),
      });
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data?.message ?? 'Failed to create tag');
      }
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['costTags'] });
      queryClient.invalidateQueries({ queryKey: ['costList'] });
      queryClient.invalidateQueries({ queryKey: ['costDetail'] });
    },
  });
}
