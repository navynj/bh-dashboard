/**
 * Load More Button Component
 * Button for loading more history entries
 */

import { Button } from '@/components/ui/button';
import { Spinner } from '@/components/ui/spinner';
import { ChevronDown, MoreHorizontal } from 'lucide-react';
import { useTranslations } from 'next-intl';

interface LoadMoreButtonProps {
  remainingCount: number;
  isLoading: boolean;
  isFetching: boolean;
  onLoadMore: () => void;
  showTimeline?: boolean;
}

export function LoadMoreButton({
  remainingCount,
  isLoading,
  isFetching,
  onLoadMore,
  showTimeline = true,
}: LoadMoreButtonProps) {
  const t = useTranslations();

  return (
    <div className="relative flex gap-4 pb-4">
      {/* Timeline line */}
      {showTimeline && (
        <div className="absolute left-4 top-8 bottom-0 w-0.5 bg-gray-200" />
      )}
      {/* Icon - ellipsis */}
      <div className="relative z-10 flex h-8 w-8 shrink-0 items-center justify-center">
        {isFetching && !isLoading ? (
          <Spinner className="w-4 h-4" />
        ) : (
          <MoreHorizontal size={16} className="text-gray-600" />
        )}
      </div>
      <div className="flex-1 flex justify-center pt-2">
        <Button
          variant="ghost"
          onClick={onLoadMore}
          className="text-sm"
          isLoading={isFetching && !isLoading}
          disabled={isFetching}
        >
          <ChevronDown size={16} className="mr-1" />
          {t('Cost.history.viewMore')} ({remainingCount})
        </Button>
      </div>
    </div>
  );
}

