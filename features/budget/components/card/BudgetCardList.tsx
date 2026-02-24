'use client';

import { cn } from '@/lib/utils';
import type { BudgetViewProps } from '@/features/budget';
import { PropsWithChildren, useMemo } from 'react';
import BudgetCard from './BudgetCard';

const QB_REFRESH_EXPIRED = 'QB_REFRESH_EXPIRED';

function BudgetCardList({
  yearMonth,
  isOfficeOrAdmin,
  budget,
  budgets,
  budgetError,
  hideChart = false,
}: BudgetViewProps) {
  return (
    <BudgetCardListLayout budgetError={budgetError}>
      <BudgetCardListContent
        budgets={budgets}
        budget={budget}
        isOfficeOrAdmin={isOfficeOrAdmin}
        yearMonth={yearMonth}
        hideChart={hideChart}
      />
    </BudgetCardListLayout>
  );
}

const BudgetCardListContent = ({
  budgets,
  budget,
  isOfficeOrAdmin,
  yearMonth,
  hideChart = false,
}: Pick<
  BudgetViewProps,
  'budgets' | 'budget' | 'isOfficeOrAdmin' | 'yearMonth' | 'hideChart'
>) => {
  // Office/admin: one list ordered by location.createdAt; reconnect from budget.error
  if (isOfficeOrAdmin && budgets.length > 0) {
    return (
      <div
        className={cn(
          'grid grid-cols-1 gap-4 min-w-0 sm:grid-cols-2 lg:grid-cols-3 [&>*]:min-w-0',
        )}
      >
        {budgets.map((b) => (
          <BudgetCard
            key={b.id}
            budget={b}
            isOfficeOrAdmin={isOfficeOrAdmin}
            yearMonth={yearMonth}
            needsReconnect={b.error === QB_REFRESH_EXPIRED}
            hideChart={hideChart}
          />
        ))}
      </div>
    );
  }

  if (!!budget) {
    return (
      <div className="min-w-0 max-w-full">
        <BudgetCard
          budget={budget}
          isOfficeOrAdmin={false}
          yearMonth={yearMonth}
          needsReconnect={budget.error === QB_REFRESH_EXPIRED}
          hideChart={hideChart}
        />
      </div>
    );
  }

  return (
    <p className="text-muted-foreground">
      No budget for your location this month.
      <br />
      Please contact to the administrator.
    </p>
  );
};

const BudgetCardListLayout = ({
  budgetError,
  children,
}: PropsWithChildren<Pick<BudgetViewProps, 'budgetError'>>) => {
  const errorBlock = useMemo(() => {
    if (budgetError == null || budgetError === '') {
      return null;
    }
    return (
      <div
        role="alert"
        className="rounded-md border border-destructive/50 bg-destructive/10 px-4 py-3 text-destructive text-sm"
      >
        <strong>Failed to create or load budget.</strong> {budgetError}
      </div>
    );
  }, [budgetError]);

  return (
    <div className="min-w-0 w-full space-y-3">
      {errorBlock}
      {children}
    </div>
  );
};
export default BudgetCardList;
