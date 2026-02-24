'use client';

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { useTranslations } from 'next-intl';
import { useCostHistory } from './CostHistoryTimeline/hooks/useCostHistory';
import { HistoryEntry } from './CostHistoryTimeline/components/HistoryEntry';
import { LoadMoreButton } from './CostHistoryTimeline/components/LoadMoreButton';
import { EmptyState } from './CostHistoryTimeline/components/EmptyState';
import { LoadingState } from './CostHistoryTimeline/components/LoadingState';
import type { CostHistoryEntry } from './CostHistoryTimeline/types';

interface CostHistoryTimelineProps {
  costId: string;
  organizationId: string;
}

const CostHistoryTimeline = ({
  costId,
  organizationId,
}: CostHistoryTimelineProps) => {
  const t = useTranslations();

  const {
    history,
    creationEntry,
    hasMoreEntries,
    remainingCount,
    isLoading,
    isFetching,
    error,
    loadMore,
  } = useCostHistory({
    costId,
    organizationId,
    limit: 5,
  });

  // Log error if fetch fails
  if (error) {
    console.error('Failed to fetch cost history:', error);
  }

  // Show loading state on initial load
  if (isLoading && history.length === 0 && !creationEntry) {
    return <LoadingState />;
  }

  // Show empty state if no history
  if (history.length === 0 && !creationEntry) {
    return <EmptyState />;
  }

  return (
    <Card className="bg-gray-50 shadow-none border-none">
      <CardHeader>
        <CardTitle>{t('Cost.history.title')}</CardTitle>
      </CardHeader>
      <CardContent>
        <div>
          {/* Show other entries first (most recent on top) */}
          {history.map((entry, index) => {
            const isLast =
              index === history.length - 1 && !hasMoreEntries && !creationEntry;
            return (
              <HistoryEntry key={entry.id} entry={entry} isLast={isLast} />
            );
          })}

          {/* View More button */}
          {hasMoreEntries && (
            <LoadMoreButton
              remainingCount={remainingCount}
              isLoading={isLoading}
              isFetching={isFetching}
              onLoadMore={loadMore}
              showTimeline={!!creationEntry}
            />
          )}

          {/* Always show creation entry at the bottom */}
          {creationEntry && (
            <HistoryEntry entry={creationEntry} isLast={true} />
          )}
        </div>
      </CardContent>
    </Card>
  );
};

export default CostHistoryTimeline;
export type { CostHistoryEntry } from './CostHistoryTimeline/types';
