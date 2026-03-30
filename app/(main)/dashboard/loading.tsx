import BudgetCardSkeleton from '@/features/dashboard/budget/components/card/BudgetCardSkeleton';
import { cn } from '@/lib/utils';

export default function BudgetLoading() {
  return (
    <div
      className={cn(
        'grid min-w-0 grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 [&>*]:min-w-0',
      )}
    >
      <BudgetCardSkeleton />
      <BudgetCardSkeleton />
      <BudgetCardSkeleton />
    </div>
  );
}
