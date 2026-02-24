/**
 * useCostDetails Hook
 * Hook for fetching and managing cost details with gPrice calculation
 */

import { useEffect, useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { CostApiResponse } from '@/features/cost/types/cost';
import { getCostDetailsWithGPrice } from '@/lib/costCache';

interface UseCostDetailsParams {
  activeTab: 'product' | 'cost';
  organizationId: string;
  showDialog: boolean;
  filteredCosts: CostApiResponse[];
}

interface UseCostDetailsReturn {
  costsWithGPrice: (CostApiResponse & { gPrice?: number | null })[];
  isFetchingCostDetails: boolean;
}

/**
 * Fetches cost details and calculates gPrice when cost tab is active
 */
export function useCostDetails({
  activeTab,
  organizationId,
  showDialog,
  filteredCosts,
}: UseCostDetailsParams): UseCostDetailsReturn {
  const queryClient = useQueryClient();
  const [costsWithGPrice, setCostsWithGPrice] = useState<
    (CostApiResponse & { gPrice?: number | null })[]
  >([]);
  const [isFetchingCostDetails, setIsFetchingCostDetails] = useState(false);

  useEffect(() => {
    // Race condition 방지를 위한 취소 플래그
    let isCancelled = false;

    if (
      activeTab === 'cost' &&
      organizationId &&
      showDialog &&
      filteredCosts.length > 0
    ) {
      setIsFetchingCostDetails(true);
      // Use utility function to fetch with cache
      getCostDetailsWithGPrice(queryClient, organizationId, filteredCosts)
        .then((costsWithPrices) => {
          // 이전 요청이 취소되지 않았을 때만 상태 업데이트
          if (!isCancelled) {
            setCostsWithGPrice(costsWithPrices);
          }
        })
        .catch((error) => {
          // 취소된 요청의 에러는 무시
          if (!isCancelled) {
            console.error('Failed to fetch cost details:', error);
          }
        })
        .finally(() => {
          // 취소되지 않았을 때만 로딩 상태 해제
          if (!isCancelled) {
            setIsFetchingCostDetails(false);
          }
        });
    } else if (activeTab !== 'cost' || !showDialog) {
      // Reset when switching away from cost tab
      setCostsWithGPrice([]);
      setIsFetchingCostDetails(false);
    }

    // Cleanup: 이전 요청 취소
    return () => {
      isCancelled = true;
    };
  }, [activeTab, organizationId, showDialog, filteredCosts, queryClient]);

  return {
    costsWithGPrice,
    isFetchingCostDetails,
  };
}

