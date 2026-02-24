'use client';

import { useMutation, useQueryClient } from '@tanstack/react-query';
import type { CostApiResponse } from '@/features/cost/types/cost';
import {
  prepareIngredientsForDuplicate,
  preparePackagingsForDuplicate,
  preparePricesForDuplicate,
  prepareLaborsForDuplicate,
  prepareOthersForDuplicate,
  prepareImageForApi,
  preparePricesForApi,
} from '@/features/cost/utils/api/costApiHelpers';

export function useCostMutations() {
  const queryClient = useQueryClient();

  const invalidateCostList = () => {
    queryClient.invalidateQueries({ queryKey: ['costList'] });
    queryClient.invalidateQueries({ queryKey: ['costDetail'] });
  };

  const deleteMutation = useMutation({
    mutationFn: async (costId: string) => {
      const res = await fetch(`/api/cost/${costId}`, { method: 'DELETE' });
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data?.message ?? 'Failed to delete cost');
      }
      return res.json();
    },
    onSuccess: () => invalidateCostList(),
  });

  const duplicateMutation = useMutation({
    mutationFn: async (costId: string) => {
      const res = await fetch(`/api/cost/${costId}`);
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data?.message ?? 'Failed to fetch cost');
      }
      const costData: CostApiResponse = await res.json();

      const {
        id,
        ingredients,
        packagings,
        labors,
        others,
        prices,
        tags,
        ...rest
      } = costData;

      const newIngredients = prepareIngredientsForDuplicate(ingredients ?? []);
      const newPackagings = preparePackagingsForDuplicate(packagings ?? []);
      const newLabors = prepareLaborsForDuplicate(labors ?? []);
      const newOthers = prepareOthersForDuplicate(others ?? []);
      const finalPrices = preparePricesForDuplicate(prices ?? []);

      const createRes = await fetch('/api/cost', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...rest,
          title: `${rest.title} (copy)`,
          ingredients: newIngredients.map(({ image, ...item }) => ({
            ...item,
            image: prepareImageForApi(image),
          })),
          packagings: newPackagings.map(({ image, ...item }) => ({
            ...item,
            image: prepareImageForApi(image),
          })),
          labors: newLabors,
          others: newOthers,
          prices: preparePricesForApi(finalPrices),
          tags: tags?.map((t) => t.id) ?? [],
        }),
      });

      if (!createRes.ok) {
        const data = await createRes.json();
        throw new Error(data?.message ?? 'Failed to duplicate cost');
      }
      return createRes.json();
    },
    onSuccess: () => invalidateCostList(),
  });

  return {
    deleteMutation,
    duplicateMutation,
    invalidateCostList,
  };
}
